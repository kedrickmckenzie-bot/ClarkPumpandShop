import type { OpsCommandServices } from "./commands";
import type { ActorContext, WorkOrder, WorkOrderAssignment, WorkOrderIssuance } from "./types";
import type { ServiceAuthorizationSnapshot } from "./view-models";
import { OpsDomainError } from "./errors";
import { atomicWorkOrderMutation } from "./concurrency";
import { membershipHasCapability } from "./capability-policy";

export function sentWorkSnapshot(issuance: WorkOrderIssuance): ServiceAuthorizationSnapshot | null {
  try {
    const value = JSON.parse(issuance.immutablePayloadJson) as ServiceAuthorizationSnapshot;
    return value && typeof value.problem === "string" && typeof value.workOrderNumber === "string"
      && typeof value.store?.name === "string" && typeof value.vendor?.name === "string" ? value : null;
  } catch { return null; }
}

export function canShareSentWork(work: WorkOrder, issuance: WorkOrderIssuance, latest: WorkOrderIssuance | null | undefined, assignment: WorkOrderAssignment | null | undefined, active: WorkOrderAssignment | null | undefined) {
  return work.status !== "cancelled" && latest?.id === issuance.id
    && assignment?.workOrderId === work.id && assignment.kind === "outside_vendor"
    && ["issued", "opened", "accepted", "completed"].includes(assignment.status)
    && (active?.id === assignment.id || assignment.status === "completed" && !active);
}

/** Creates access to the same saved revision; never resends or revises the work. */
export async function createSentWorkLink(svc: OpsCommandServices, input: { organizationId: string; workOrderId: string; issuanceId: string; actor: ActorContext }) {
  const { repository } = svc;
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "An active account is required.");
  const member = await repository.getMembership(input.organizationId, input.actor.actorId);
  if (!member || member.status !== "active" || !await membershipHasCapability(repository, input.organizationId, member.id, "issue_work_order")) throw new OpsDomainError("FORBIDDEN", "Your role cannot share vendor links.");
  const work = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  const [store, grants, rows, active] = await Promise.all([
    repository.getStore(input.organizationId, work.storeId),
    repository.listScopeGrantsForMembership(input.organizationId, member.id),
    repository.listIssuancesForWorkOrder(input.organizationId, work.id),
    repository.getActiveAssignment(input.organizationId, work.id),
  ]);
  if (!grants.some(g => g.scopeKind === "organization" && g.scopeId === input.organizationId || g.scopeKind === "store" && g.scopeId === work.storeId || g.scopeKind === "region" && g.scopeId === store?.regionId)) throw new OpsDomainError("FORBIDDEN", "This store is outside your access.");
  const issuance = rows.find(row => row.id === input.issuanceId);
  if (!issuance) throw new OpsDomainError("NOT_FOUND", "Sent version not found.");
  const latest = [...rows].sort((a,b) => b.revision-a.revision)[0];
  const assignment = await repository.getAssignment(input.organizationId, issuance.assignmentId);
  if (!canShareSentWork(work, issuance, latest, assignment, active)) throw new OpsDomainError("CONFLICT", "This version is no longer available to the vendor. You can still view its saved copy.");
  if (!sentWorkSnapshot(issuance)) throw new OpsDomainError("CONFLICT", "The saved version could not be read.");
  const now = svc.clock?.now() ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(now) + 30 * 86400000).toISOString();
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,"0")).join("");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))), byte => byte.toString(16).padStart(2,"0")).join("");
  const nextId = (prefix:string) => svc.ids?.next(prefix) ?? `${prefix}-${crypto.randomUUID()}`;
  await atomicWorkOrderMutation({ repository, workOrder:work, now, statements:[
    {sql:"INSERT INTO ops_public_tokens (id, organization_id, purpose, subject_type, subject_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",params:[nextId("public-token"),input.organizationId,"service_authorization","work_order_issuance",issuance.id,hash,expiresAt,now]},
    {sql:"INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",params:[nextId("audit"),input.organizationId,"work_order",work.id,"work_order.vendor_link_created",input.actor.actorType,input.actor.actorId,input.actor.actorName,now,JSON.stringify({issuanceId:issuance.id,revision:issuance.revision,expiresAt})]},
  ]});
  return {publicPath:`/public/service/${raw}`,expiresAt};
}
