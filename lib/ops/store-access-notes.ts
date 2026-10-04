import { OpsDomainError } from "./errors";
import { dispatchAccessAssertion, dispatchIdentity, insertDispatchRecord } from "./internal-dispatch";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext } from "./types";

const roles = ["facilities_admin", "regional_manager", "field_manager", "store_manager"];
/** Store instructions are configuration; each correction still has an immutable audit. */
export async function saveStoreAccessNotes(repository: OpsRepository, input: {
  organizationId: string; storeId: string; actor: ActorContext; expectedVersion: number; notes: string; key: string;
}) {
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId || !input.key || input.key.length > 120 || input.notes.length > 3000 || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)
    throw new OpsDomainError("VALIDATION", "Keep access notes under 3,000 characters and refresh before saving.");
  await dispatchIdentity(repository, input.organizationId, input.actor.actorId, input.storeId, roles);
  const notes = input.notes.trim();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([input.storeId,input.actor.actorId,input.expectedVersion,notes])))), value => value.toString(16).padStart(2,"0")).join("");
  input={...input,key:`store-access:${input.actor.actorId}:${input.key}`};
  const previous = await repository.getIdempotencyKey(input.organizationId, input.key);
  if (previous) {
    if (previous.command !== "store.access_notes" || previous.requestHash !== hash) throw new OpsDomainError("CONFLICT", "This save was already used for different notes. Refresh before saving.");
    return {saved:true};
  }
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store || (store.accessNotesVersion ?? 0) !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "These notes changed. Refresh before saving.");
  const now = new Date().toISOString(), next = input.expectedVersion + 1;
  const fence: OpsStatement = {
    storeNotesFence: {org:input.organizationId,storeId:input.storeId,version:input.expectedVersion},
    sql: "INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, created_at, expires_at, request_hash) VALUES (?, ?, ?, ?, ?, ?, (SELECT ? FROM ops_stores WHERE organization_id = ? AND id = ? AND access_notes_version = ?))",
    params: [input.organizationId,`store-notes:${input.storeId}:${next}`,"store.notes_fence",input.storeId,now,"9999-12-31T23:59:59.999Z",hash,input.organizationId,input.storeId,input.expectedVersion],
  };
  try {
    await repository.atomicWrite([
      dispatchAccessAssertion(input.organizationId,input.actor.actorId!,input.storeId,roles,now), fence,
      {sql:"UPDATE ops_stores SET access_notes = ?, access_notes_version = ? WHERE organization_id = ? AND id = ?",params:[notes || null,next,input.organizationId,input.storeId]},
      insertDispatchRecord("ops_audit_events",{id:crypto.randomUUID(),organization_id:input.organizationId,aggregate_type:"store",aggregate_id:input.storeId,event_type:"store.access_notes_changed",actor_type:input.actor.actorType,actor_id:input.actor.actorId,actor_name:input.actor.actorName,occurred_at:now,payload_json:JSON.stringify({previous:store.accessNotes ?? "",notes,version:next})}),
      insertDispatchRecord("ops_idempotency_keys",{organization_id:input.organizationId,key:input.key,command:"store.access_notes",result_id:input.storeId,request_hash:hash,created_at:now,expires_at:"9999-12-31T23:59:59.999Z"}),
    ]);
  } catch (error) {
    const receipt = await repository.getIdempotencyKey(input.organizationId,input.key);
    if (receipt?.command === "store.access_notes" && receipt.requestHash === hash) return {saved:true};
    if ((await repository.getStore(input.organizationId,input.storeId))?.accessNotesVersion !== input.expectedVersion) throw new OpsDomainError("CONFLICT","These notes changed. Refresh before saving.");
    throw error;
  }
  return {saved:true};
}
