import { OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, evidenceDigest, evidenceFence, insertRecord } from "./email-intake";
import type { OpsRepository } from "./repository";
import type { ActorContext, WorkOrder } from "./types";
import type { OutboxDeliveryMessage } from "./outbox-delivery";
import type { TransactionalEmailProvider } from "./email-delivery";
import { selectPrimaryWorkflowTask, escalateWorkflowTask } from "./workflow-task-commands";

export async function saveFollowUpPreference(svc: OpsCommandServices, organizationId: string, cadenceHours: number, actor: ActorContext) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN","Organization mismatch");
  if (![0,24,48,168].includes(cadenceHours)) throw new OpsDomainError("VALIDATION","Choose a supported follow-up frequency.");
  const now = svc.clock?.now() ?? new Date().toISOString();
  const id = `follow-up-policy-${crypto.randomUUID()}`;
  await svc.repository.atomicWrite([insertRecord("ops_follow_up_preferences",{id,organization_id:organizationId,cadence_hours:cadenceHours,created_at:now}),communicationAudit(organizationId,id,"follow_up.preference_changed",actor,now,{cadenceHours},"follow_up_preference")]);
}

async function reminderState(repository: OpsRepository, work: WorkOrder, now: string) {
  if (["closed","cancelled","resolved"].includes(work.status)) return null;
  const [appointments,detail,assignment,tasks] = await Promise.all([
    repository.listServiceAppointmentsForWorkOrder(work.organizationId,work.id),
    repository.getWorkOrderDetail({organizationId:work.organizationId},work.id),
    repository.getActiveAssignment(work.organizationId,work.id),
    repository.listWorkflowTasksForWorkOrder(work.organizationId,work.id),
  ]);
  if (detail?.visits.some(visit => visit.status === "active")) return null;
  const latest = appointments.filter(row => row.assignmentId === assignment?.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  const openTasks = tasks.filter(task => !["completed","cancelled"].includes(task.status));
  const task = selectPrimaryWorkflowTask(openTasks);
  if (task && await repository.getActiveWorkflowTaskSlaPause(work.organizationId,task.id)) return null;
  const missed = latest?.status === "confirmed" && latest.startsAt < now && !detail?.visits.some(visit => visit.vendorId === assignment?.vendorId && visit.checkedInAt >= latest.createdAt && visit.checkedInAt >= new Date(Date.parse(latest.startsAt)-86400000).toISOString());
  // An agreed future appointment is the current commitment; an older response
  // deadline must not prompt another chase before that appointment.
  if (latest?.status === "confirmed" && latest.startsAt > now && work.status === "scheduled") return null;
  const kind = work.status === "completed_pending_review" ? "verify" : missed ? "appointment" : "response";
  const dueAt = missed ? latest.startsAt : task?.dueAt ?? work.dueAt;
  if (!dueAt || dueAt > now) return null;
  const title = kind === "verify" ? "Did the repair fix the problem?" : kind === "appointment" ? "Visit date passed — add an update" : work.nextAction;
  return {kind,dueAt,title,assignment,task,fingerprint:await evidenceDigest(JSON.stringify({version:work.version ?? 0,status:work.status,dueAt,assignment:assignment?.id,appointment:latest?.id,task:task?.id,level:task?.escalationLevel}))};
}

/** Bounded pages, immutable preferences and a transaction fence per due-date/cadence window. */
export async function runRoutineFollowUpCycle(svc: OpsCommandServices, onlyOrganizationId?: string) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const summary = {queued:0,skipped:0,failed:0};
  const organizations = onlyOrganizationId ? [onlyOrganizationId] : await svc.repository.listFollowUpOrganizations();
  for (const organizationId of organizations) {
    const policy = await svc.repository.getFollowUpPreference(organizationId);
    if (!policy?.cadenceHours) continue;
    let offset = 0;
    for (;;) {
      const page = await svc.repository.listWorkOrders({organizationId},{statuses:["draft","awaiting_approval","approved","issued","accepted","scheduled","in_progress","waiting_on_vendor","waiting_on_parts","completed_pending_review"],offset,limit:100});
      for (const row of page.items) {
        try {
          let work = await svc.repository.getWorkOrder(organizationId,row.id);
          if (!work) continue;
          let state = await reminderState(svc.repository,work,now);
          if (!state) continue;
          const slot = Math.floor((Date.parse(now)-Date.parse(state.dueAt))/(policy.cadenceHours*3600000));
          const key = `routine:${work.id}:${state.dueAt}:${policy.id}:${slot}`;
          if (await svc.repository.getIdempotencyKey(organizationId,key)) { summary.skipped++; continue; }
          if (slot >= 2 && state.task && state.task.escalationLevel < 1) {
            await escalateWorkflowTask(svc,{organizationId,workflowTaskId:state.task.id,escalationDestination:state.task.escalationDestination,escalationLevel:1,reason:"Routine follow-up remained unanswered for two reminder intervals.",actor:{organizationId,actorType:"system",actorName:"Routine follow-up"}});
            work = (await svc.repository.getWorkOrder(organizationId,work.id))!;
            state = await reminderState(svc.repository,work,now);
            if (!state) continue;
          }
          const id = `outbox-${crypto.randomUUID()}`;
          const payload = {workOrderId:work.id,policyId:policy.id,fingerprint:state.fingerprint,title:state.title,kind:state.kind,dueAt:state.dueAt};
          await svc.repository.atomicWrite([evidenceFence(organizationId,key,id,now),insertRecord("ops_outbox_messages",{id,organization_id:organizationId,topic:"ops.routine.reminder",aggregate_type:"work_order",aggregate_id:work.id,payload_json:JSON.stringify(payload),status:"pending",available_at:now,created_at:now,attempt_count:0})]);
          summary.queued++;
        } catch { summary.failed++; }
      }
      offset += page.items.length;
      if (!page.items.length || offset >= (page.totalCount ?? Number.MAX_SAFE_INTEGER)) break;
    }
  }
  return summary;
}

export async function deliverRoutineReminder(input: {repository:OpsRepository;provider:TransactionalEmailProvider|null;baseUrl:string}, message:OutboxDeliveryMessage, now = new Date().toISOString()) {
  const payload = JSON.parse(message.payloadJson) as {policyId:string;fingerprint:string};
  const policy = await input.repository.getFollowUpPreference(message.organizationId);
  const work = await input.repository.getWorkOrder(message.organizationId,message.aggregateId);
  if (!work || !policy?.cadenceHours || policy.id !== payload.policyId) return;
  const state = await reminderState(input.repository,work,now);
  if (!state || state.fingerprint !== payload.fingerprint) return;
  const store = await input.repository.getStore(message.organizationId,work.storeId);
  const recipients = new Map<string,string>();
  const escalation = (state.task?.escalationLevel ?? 0) > 0;
  if (state.kind !== "verify" && state.assignment?.vendorId && !escalation && (state.kind === "appointment" || state.task?.assigneeType === "vendor")) {
    const vendor = await input.repository.getVendor(message.organizationId,state.assignment.vendorId);
    if (vendor?.dispatchEmail) recipients.set(vendor.dispatchEmail.toLowerCase(),vendor.name);
  } else {
    const membership = state.task?.assigneeType === "user" && state.task.assigneeId ? await input.repository.getMembership(message.organizationId,state.task.assigneeId) : null;
    const candidateRole = membership?.role ?? state.task?.assigneeRole;
    const role: import("./types").NotificationRecipientRole = state.kind === "verify" ? "store_manager" : escalation ? "facilities_admin" : candidateRole && ["facilities_admin","regional_manager","store_manager","executive","finance_reviewer"].includes(candidateRole) ? candidateRole as import("./types").NotificationRecipientRole : "facilities_admin";
    const candidates = await input.repository.listNotificationRecipients(message.organizationId,role,{storeId:work.storeId,regionId:store?.regionId});
    const assigned = !escalation && state.task?.assigneeType === "user" ? candidates.filter(person => person.membershipId === state.task?.assigneeId) : candidates;
    for (const person of assigned) recipients.set(person.email.toLowerCase(),person.displayName);
  }
  if (!recipients.size) throw new Error("No recipient is configured for this follow-up");
  if (!input.provider) throw new Error("Routine follow-ups are enabled but email delivery is not configured");
  const href = new URL(`/app/work-orders/${work.id}?view=${state.kind === "verify" ? "visits#work-verification" : "overview#add-update"}`,input.baseUrl).toString();
  for (const [to] of recipients) {
    // Vendor recipients can reply through their existing email workflow; they are never sent an operator-only URL.
    const vendorRecipient = state.assignment?.vendorId && state.kind !== "verify" && !escalation && (state.kind === "appointment" || state.task?.assigneeType === "vendor");
    const text = `${state.title}\n\n${work.number} · Store ${store?.storeNumber ?? ""}\n${work.problem}\n\n${vendorRecipient ? "Reply with an update and keep the work order number in the subject." : `Update the record: ${href}`}`;
    const escape = (value:string) => value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
    await input.provider.send({to,subject:`${work.number} · ${state.title}`,text,html:`<div style="white-space:pre-line;font-family:Arial,sans-serif">${escape(text)}</div>`,idempotencyKey:`${message.id}/${to}`});
  }
}
