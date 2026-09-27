import { createServiceRequest, recordWorkOrderNote, OpsDomainError, type OpsCommandServices } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, StoredFile } from "./types";

export function insertRecord(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([,value]) => value) };
}
export async function evidenceDigest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2,"0")).join("");
}
export function evidenceFence(org: string, key: string, id: string, now: string): OpsStatement {
  return insertRecord("ops_idempotency_keys", { organization_id: org, key, command: "communication.evidence", result_id: id, request_hash: key, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" });
}
export function communicationAudit(org: string, id: string, event: string, actor: ActorContext, now: string, payload: unknown, aggregateType = "inbound_email") {
  return insertRecord("ops_audit_events", { id: `audit-${crypto.randomUUID()}`, organization_id: org, aggregate_type: aggregateType, aggregate_id: id, event_type: event, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now, payload_json: JSON.stringify(payload) });
}

export interface IncomingEmail {
  organizationId: string; messageKey: string; sender: string; subject: string; body: string;
  reportedDate?: string; files?: StoredFile[];
}

export async function receiveEmail(svc: OpsCommandServices, input: IncomingEmail) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  if (!input.messageKey.trim() || input.messageKey.length > 300 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.sender) || !input.body.trim() || input.body.length > 30000 || input.subject.length > 300 || (input.reportedDate?.length ?? 0) > 300) throw new OpsDomainError("VALIDATION", "Enter the sender, subject and email text within the allowed limits.");
  if (!await svc.repository.getOrganization(input.organizationId)) throw new OpsDomainError("NOT_FOUND", "Mailbox organization not found");
  const digest = await evidenceDigest(`${input.organizationId}:${input.messageKey}`);
  const id = `email-${digest}`;
  const existing = await svc.repository.getInboundEmail(input.organizationId,id);
  if (existing) return existing;
  if ((input.files?.length ?? 0) > 5 || input.files?.some(file => file.organizationId !== input.organizationId || file.status !== "available" || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.byteLength) || file.byteLength < 0)) throw new OpsDomainError("VALIDATION", "Email attachments must belong to this mailbox.");
  const actor: ActorContext = { organizationId: input.organizationId, actorType: "system", actorName: "Email intake" };
  const statements = [evidenceFence(input.organizationId, `email-received:${digest}`, id, now), insertRecord("ops_inbound_emails", {
    id, organization_id: input.organizationId, message_key: input.messageKey, sender: input.sender.toLowerCase(), subject: input.subject.trim(), body: input.body, reported_date: input.reportedDate, received_at: now, status: "needs_review",
  }), communicationAudit(input.organizationId,id,"email.received",actor,now,{ sender: input.sender, subject: input.subject })];
  for (const file of input.files ?? []) statements.push(
    insertRecord("ops_files", { id:file.id, organization_id:file.organizationId, storage_key:file.storageKey, sha256:file.sha256, original_name:file.originalName, content_type:file.contentType, byte_length:file.byteLength, status:file.status, created_at:now }),
    insertRecord("ops_entity_files", { id:`link-${crypto.randomUUID()}`, organization_id:input.organizationId, file_id:file.id, entity_type:"inbound_email", entity_id:id, purpose:"service_document", visibility:"internal", created_at:now }),
  );
  try { await svc.repository.atomicWrite(statements); } catch (error) { const replay = await svc.repository.getInboundEmail(input.organizationId,id); if (replay) return replay; throw error; }
  return (await svc.repository.getInboundEmail(input.organizationId,id))!;
}

/** Shared commands still own request/work mutations; routing and file links commit with them. */
export async function resolveEmail(svc: OpsCommandServices, input: { organizationId: string; emailId: string; workOrderId?: string; storeId?: string; dismiss?: boolean; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Organization mismatch");
  const email = await svc.repository.getInboundEmail(input.organizationId,input.emailId);
  if (!email) throw new OpsDomainError("NOT_FOUND", "Email not found");
  if (email.status !== "needs_review") throw new OpsDomainError("CONFLICT", "This email was already reviewed. Refresh the inbox.");
  if (Number(Boolean(input.workOrderId)) + Number(Boolean(input.storeId)) + Number(Boolean(input.dismiss)) !== 1) throw new OpsDomainError("VALIDATION", "Choose one work order, a store for a new request, or dismiss.");
  const now = svc.clock?.now() ?? new Date().toISOString();
  const requestId = `request-email-${email.id.slice(6)}`;
  const statements: OpsStatement[] = [evidenceFence(input.organizationId,`email-resolved:${email.id}`,email.id,now), {
    sql:"UPDATE ops_inbound_emails SET status = ?, work_order_id = ?, request_id = ? WHERE organization_id = ? AND id = ? AND status = ?",
    params:[input.dismiss ? "dismissed" : "linked",input.workOrderId ?? null,input.storeId ? requestId : null,input.organizationId,email.id,"needs_review"],
  }, communicationAudit(input.organizationId,email.id,"email.reviewed",input.actor,now,{ workOrderId: input.workOrderId, requestId: input.storeId ? requestId : undefined, dismissed: input.dismiss })];
  for (const file of await svc.repository.listFilesForEntity(input.organizationId,"inbound_email",email.id)) {
    if (!input.dismiss) statements.push(insertRecord("ops_entity_files",{ id:`link-${crypto.randomUUID()}`,organization_id:input.organizationId,file_id:file.id,entity_type:input.workOrderId ? "work_order" : "request",entity_id:input.workOrderId ?? requestId,purpose:"service_document",visibility:"internal",created_at:now }));
  }
  const repository = new Proxy(svc.repository, { get(target,key) { if (key === "atomicWrite") return (commands: readonly OpsStatement[]) => target.atomicWrite([...commands,...statements]); const value = Reflect.get(target,key); return typeof value === "function" ? value.bind(target) : value; } }) as OpsRepository;
  const note = `Email from ${email.sender}\n${email.subject}\n\n${email.body}${email.reportedDate ? `\nReported date (unconfirmed): ${email.reportedDate}` : ""}`;
  if (input.dismiss) await svc.repository.atomicWrite(statements);
  else if (input.workOrderId) {
    const work = await repository.getWorkOrder(input.organizationId,input.workOrderId);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found");
    await recordWorkOrderNote({ ...svc,repository },{ organizationId:input.organizationId,workOrderId:work.id,expectedVersion:work.version ?? 0,note,actor:input.actor });
  } else {
    await createServiceRequest({ ...svc,repository,ids:{ next: prefix => prefix === "request" ? requestId : `${prefix}-${crypto.randomUUID()}` } },{ organizationId:input.organizationId,storeId:input.storeId!,reporterName:email.sender,problem:note,actor:input.actor });
  }
  return svc.repository.getInboundEmail(input.organizationId,email.id);
}

/** Auto-routing adds evidence only. It never accepts work or confirms a reported date. */
export async function routeVerifiedEmail(svc: OpsCommandServices, emailId: string, organizationId: string, senderVerified: boolean) {
  const email = await svc.repository.getInboundEmail(organizationId,emailId);
  if (!email || email.status !== "needs_review" || !senderVerified) return email;
  const organization = await svc.repository.getOrganization(organizationId);
  const tokens = email.subject.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gi) ?? [];
  const prefix = (organization?.workOrderPrefix ?? "WO").replace(/-+$/, "").toUpperCase();
  const references = [...new Set(tokens.filter(token => token.toUpperCase().startsWith(`${prefix}-`)).map(token => token.toUpperCase()))];
  const actor: ActorContext = { organizationId,actorType:"system",actorName:"Verified email intake" };
  if (references.length === 1) {
    const matches = (await svc.repository.listWorkOrders({organizationId},{search:references[0],limit:100})).items.filter(work => work.number.toUpperCase() === references[0].toUpperCase());
    if (matches.length !== 1) return email;
    const assignment = await svc.repository.getActiveAssignment(organizationId,matches[0].id);
    const vendor = assignment?.vendorId ? await svc.repository.getVendor(organizationId,assignment.vendorId) : null;
    if (vendor?.dispatchEmail.toLowerCase() === email.sender.toLowerCase()) return resolveEmail(svc,{organizationId,emailId,workOrderId:matches[0].id,actor});
  } else if (!references.length) {
    const stores = [...new Set([...email.subject.matchAll(/\bstore\s*#?\s*(\d+)\b/gi)].map(match => match[1]))];
    if (stores.length !== 1) return email;
    const matches = (await svc.repository.searchStores({organizationId},stores[0],{limit:100})).items.filter(store => store.storeNumber === stores[0]);
    if (matches.length === 1) return resolveEmail(svc,{organizationId,emailId,storeId:matches[0].id,actor});
  }
  return email;
}
