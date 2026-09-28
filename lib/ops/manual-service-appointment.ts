import { createFollowUp, updateWorkOrderControl, OpsDomainError, type OpsCommandServices } from "./commands";
import { atomicWorkOrderMutation, persistedWorkOrderVersion } from "./concurrency";
import { communicationAudit, insertRecord } from "./email-intake";
import { resolveInternalAccountability } from "./internal-accountability";
import { buildReplacePrimaryTaskStatements, buildWorkflowTaskRecord, selectPrimaryWorkflowTask } from "./workflow-task-commands";
import type { ActorContext } from "./types";

/** A manually recorded commitment is not a vendor portal response or an observed visit. */
export async function recordManualAppointment(svc: OpsCommandServices, input: {
  organizationId: string; workOrderId: string; expectedVersion: number;
  startsAt: string; confirmedBy: string; source: string; note: string; actor: ActorContext;
}) {
  const r = svc.repository, now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Organization access required");
  const member = input.actor.actorId ? await r.getMembership(input.organizationId, input.actor.actorId) : null;
  if (!member || member.status !== "active" || !["facilities_admin", "regional_manager"].includes(member.role)) throw new OpsDomainError("FORBIDDEN", "An active maintenance manager is required");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (persistedWorkOrderVersion(work) !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Work changed. Refresh before saving");
  if (!["approved", "issued", "accepted", "scheduled", "waiting_on_vendor", "waiting_on_parts", "in_progress"].includes(work.status)) throw new OpsDomainError("CONFLICT", "Resolve the current work action before scheduling");
  if (!Number.isFinite(Date.parse(input.startsAt)) || Date.parse(input.startsAt) <= Date.parse(now) || !input.confirmedBy.trim() || !input.note.trim() || !["phone", "email", "in_person"].includes(input.source)) throw new OpsDomainError("VALIDATION", "Enter a future appointment, confirmation source, name and note");
  const [assignment, tasks, detail] = await Promise.all([r.getActiveAssignment(input.organizationId, work.id), r.listWorkflowTasksForWorkOrder(input.organizationId, work.id), r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id)]);
  const primary = selectPrimaryWorkflowTask(tasks);
  if (!assignment || assignment.kind === "choose_later" || ["declined", "cancelled", "completed", "superseded"].includes(assignment.status)) throw new OpsDomainError("CONFLICT", "Choose a provider before recording an appointment");
  if (tasks.some(t => ["open", "in_progress", "paused"].includes(t.status) && t.sourceApprovalRequestId) || detail?.visits.some(v => v.status === "active")) throw new OpsDomainError("CONFLICT", "Resolve the active approval or visit before scheduling");
  const owner = await resolveInternalAccountability(r, work);
  const vendor = assignment.vendorId ? await r.getVendor(input.organizationId, assignment.vendorId) : null;
  const startsAt = new Date(input.startsAt).toISOString(), id = ids.next("appointment");
  const task = buildWorkflowTaskRecord({ id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: work.id, actor: input.actor, createdAt: now, draft: {
    taskType: "confirm_store_access", title: "Attend the confirmed service appointment", reason: input.note,
    assigneeType: vendor ? "vendor" : owner.assigneeType, assigneeId: vendor?.id ?? owner.assigneeId,
    assigneeRole: vendor ? undefined : owner.assigneeRole, assigneeName: vendor?.name ?? owner.assigneeName,
    priority: "normal", blocking: true, requiredForProgress: true, dueAt: startsAt, applicableSlaClock: "arrival",
    completionCriteria: "Record the visit or update the agreed appointment", escalationDestination: owner.escalationDestination,
  } });
  const prior = (await r.listServiceAppointmentsForWorkOrder(input.organizationId, work.id)).filter(row => row.status !== "cancelled");
  await atomicWorkOrderMutation({ repository: r, workOrder: work, now, statements: [
    ...(primary?.sourceFollowUpId ? [
      { sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", now, input.organizationId, primary.sourceFollowUpId, "open"] },
      communicationAudit(input.organizationId, primary.sourceFollowUpId, "follow_up.appointment_confirmed", input.actor, now, { workOrderId: work.id, appointmentId: id, startsAt, note: input.note }, "follow_up"),
    ] : []),
    ...prior.map(row => ({ sql: "UPDATE ops_service_appointments SET status = ? WHERE organization_id = ? AND id = ?", params: ["cancelled", input.organizationId, row.id] })),
    insertRecord("ops_service_appointments", { id, organization_id: input.organizationId, work_order_id: work.id, assignment_id: assignment.id, status: "confirmed", proposed_by: "operator", starts_at: startsAt, note: `${input.source}: confirmed by ${input.confirmedBy}. ${input.note}`, created_by_membership_id: member.id, created_at: now }),
    ...buildReplacePrimaryTaskStatements({ workOrder: work, tasks, replacementTask: task, actor: input.actor, occurredAt: now, ids, resolutionNote: input.note }),
    { sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?", params: ["scheduled", input.organizationId, work.id] },
    communicationAudit(input.organizationId, work.id, "work_order.appointment_recorded_manually", input.actor, now, { appointmentId: id, replacedAppointments: prior.map(row => ({ id: row.id, status: row.status, startsAt: row.startsAt })), startsAt, confirmedBy: input.confirmedBy, source: input.source, note: input.note }, "work_order"),
  ] });
  return { id, startsAt };
}

export async function recordManualServiceDelay(svc: OpsCommandServices, input: {
  organizationId: string; workOrderId: string; expectedVersion: number; kind: "parts" | "unresolved";
  dueAt: string; note: string; actor: ActorContext;
}) {
  const r = svc.repository, now = svc.clock?.now() ?? new Date().toISOString();
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Organization access required");
  const member = input.actor.actorId ? await r.getMembership(input.organizationId, input.actor.actorId) : null;
  if (!member || member.status !== "active" || !["facilities_admin", "regional_manager"].includes(member.role)) throw new OpsDomainError("FORBIDDEN", "Maintenance manager access required");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work || persistedWorkOrderVersion(work) !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Work changed. Refresh before saving");
  if (["closed", "cancelled", "awaiting_approval", "resolved"].includes(work.status) || !input.note.trim() || !Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Check the current work state, note and follow-up date");
  const [tasks, detail] = await Promise.all([r.listWorkflowTasksForWorkOrder(input.organizationId, work.id), r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id)]);
  if (tasks.some(t => ["open", "in_progress", "paused"].includes(t.status) && t.sourceApprovalRequestId) || detail?.visits.some(v => v.status === "active")) throw new OpsDomainError("CONFLICT", "Finish the active visit or approval before recording this update");
  const owner = await resolveInternalAccountability(r, work), primary = selectPrimaryWorkflowTask(tasks);
  const nextAction = input.kind === "parts" ? "Confirm parts arrival and return visit" : "Arrange return work for the unresolved problem";
  const status = input.kind === "parts" ? "waiting_on_parts" : "in_progress";
  const proxy = new Proxy(r, { get(target, key) {
    if (key === "getWorkOrder") return async (org: string, id: string) => org === work.organizationId && id === work.id ? work : target.getWorkOrder(org, id);
    if (key === "atomicWrite") return (statements: readonly import("./repository").OpsStatement[]) => target.atomicWrite([...statements, { sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?", params: [status, work.organizationId, work.id] }, communicationAudit(work.organizationId, work.id, "work_order.service_update_recorded", input.actor, now, { kind: input.kind, note: input.note, dueAt: input.dueAt }, "work_order")]);
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
  if (primary?.sourceFollowUpId) await updateWorkOrderControl({ ...svc, repository: proxy }, { organizationId: input.organizationId, workOrderId: work.id, expectedVersion: input.expectedVersion, expectedStatus: work.status, status: work.status, nextAction, dueAt: input.dueAt, note: input.note, actor: input.actor });
  else await createFollowUp({ ...svc, repository: proxy }, { organizationId: input.organizationId, workOrderId: work.id, accountableParty: owner.assigneeName, nextAction, dueAt: input.dueAt, escalationTo: owner.escalationDestination, promoteToPrimary: true, actor: input.actor });
}
