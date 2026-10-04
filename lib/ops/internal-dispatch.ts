import { OpsDomainError } from "./errors";
import { atomicWorkOrderMutation, persistedWorkOrderVersion } from "./concurrency";
import { resolveInternalAccountability } from "./internal-accountability";
import { grantCoversStore, writableOpsPermissions } from "./store-scope";
import { buildReplacePrimaryTaskStatements, buildWorkflowTaskRecord, selectWorkflowTaskProjection } from "./workflow-task-commands";
import type { OpsCommandServices } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, WorkOrder, WorkOrderAssignment, WorkflowTask } from "./types";

export type InternalTarget = NonNullable<WorkOrderAssignment["internalTarget"]>;
export const internalManagerRoles = ["facilities_admin", "regional_manager", "field_manager"] as const;
export function internalTarget(assignment: WorkOrderAssignment): InternalTarget | undefined {
  return assignment.kind === "internal" ? assignment.internalTarget ?? (assignment.internalMembershipId ? "person" : undefined) : undefined;
}
export function insertDispatchRecord(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

/** The same identity/grant check is used by reads, commands and SQL transaction assertions. */
export async function dispatchIdentity(repository: OpsRepository, org: string, membershipId: string, storeId: string, roles: readonly string[], write = true) {
  const [member, store, grants] = await Promise.all([repository.getMembership(org, membershipId), repository.getStore(org, storeId), repository.listScopeGrantsForMembership(org, membershipId)]);
  const user = member ? await repository.getUserInOrganization(org, member.userId) : null;
  if (!member || member.status !== "active" || !user || user.status !== "active" || !roles.includes(member.role) || !store
    || !grants.some(g => grantCoversStore(g, store) && (!write || writableOpsPermissions.includes(g.permission)))) {
    throw new OpsDomainError("FORBIDDEN", "This person no longer has access to internal work at this store.");
  }
  return { membershipId: member.id, role: member.role, name: user.displayName };
}

export function dispatchAccessAssertion(org: string, membershipId: string, storeId: string, roles: readonly string[], now: string): OpsStatement {
  const key = `dispatch-access:${crypto.randomUUID()}`;
  // A failed assertion violates NOT NULL inside the batch/transaction. Testing
  // row counts after a D1 batch would be too late to roll back its other writes.
  return {
    dispatchAccess: { org, membershipId, storeId, roles: [...roles] },
    sql: `INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, request_hash, created_at, expires_at) VALUES (?, ?, 'dispatch.access_assertion', CASE WHEN EXISTS (
      SELECT 1 FROM ops_memberships m JOIN ops_users u ON u.id=m.user_id JOIN ops_stores s ON s.organization_id=m.organization_id AND s.id=?
      WHERE m.organization_id=? AND m.id=? AND m.status='active' AND u.status='active' AND m.role IN (${roles.map(() => "?").join(",")}) AND EXISTS (
        SELECT 1 FROM ops_scope_grants g WHERE g.organization_id=m.organization_id AND g.membership_id=m.id AND g.permission IN ('ops:*','ops:write','ops:read_write','ops:store_manage')
        AND (g.scope_kind='organization' AND g.scope_id=m.organization_id OR g.scope_kind='store' AND g.scope_id=s.id OR g.scope_kind='region' AND g.scope_id=s.region_id OR g.scope_kind='division' AND g.scope_id=s.division_id)
      )) THEN ? ELSE NULL END, ?, ?, ?)`,
    params: [org, key, storeId, org, membershipId, ...roles, membershipId, key, now, "9999-12-31T23:59:59.999Z"],
  };
}

export async function resolveDispatchTarget(repository: OpsRepository, work: Pick<WorkOrder, "organizationId" | "storeId">, input: { target: InternalTarget; membershipId?: string; managerId?: string }) {
  if (!["person", "pool", "awaiting_allocation"].includes(input.target) || (input.target === "person") !== Boolean(input.membershipId)) throw new OpsDomainError("VALIDATION", "Choose a technician, the team, or a manager to arrange work.");
  const person = input.membershipId ? await dispatchIdentity(repository, work.organizationId, input.membershipId, work.storeId, ["internal_technician"]) : undefined;
  const manager = input.managerId ? await dispatchIdentity(repository, work.organizationId, input.managerId, work.storeId, internalManagerRoles) : undefined;
  if (input.target === "awaiting_allocation" && !manager) throw new OpsDomainError("VALIDATION", "Choose the manager who will arrange this work.");
  return { person, manager };
}

export async function resolveDispatchAccountability(repository: OpsRepository, work: WorkOrder) {
  const owner = await resolveInternalAccountability(repository, work);
  if (owner.assigneeType !== "user" || !owner.assigneeId) return owner;
  try {
    const manager = await dispatchIdentity(repository, work.organizationId, owner.assigneeId, work.storeId, internalManagerRoles);
    return { ...owner, assigneeName: manager.name };
  } catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return { assigneeType: "team" as const, assigneeId: "facilities-coordination", assigneeName: "Facilities coordination", escalationDestination: owner.escalationDestination };
  }
}

export interface DispatchAction {
  organizationId: string;
  workOrderId: string;
  actor: ActorContext;
  action: "assign" | "claim" | "return";
  target?: InternalTarget;
  membershipId?: string;
  managerId?: string;
  expectedVersion: number;
  expectedAssignmentId: string | null;
  key: string;
  reason?: string;
}

/** One atomic lifecycle mutation for manager allocation and technician pickup/return. */
export async function changeInternalDispatch(svc: OpsCommandServices, input: DispatchAction, composition?: {
  /** Scheduling supplies its normalized intent so assignment replay cannot drop a different plan. */
  intent: string;
  executionDueAt?: string;
  /** A tentative plan cannot satisfy an existing scheduling obligation. */
  preserveSchedulingTasks?: boolean;
  prepare(work: WorkOrder, assignment: WorkOrderAssignment, tasks: readonly WorkflowTask[]): Promise<OpsStatement[]>;
}) {
  const r = svc.repository;
  const now = svc.clock?.now() ?? new Date().toISOString();
  const id = (prefix: string) => svc.ids?.next(prefix) ?? `${prefix}-${crypto.randomUUID()}`;
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "Sign in to handle internal work.");
  if (!["assign", "claim", "return"].includes(input.action) || !input.key?.trim() || input.key.length > 120 || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || (input.reason?.length ?? 0) > 1000) throw new OpsDomainError("VALIDATION", "Refresh the job and try this action again.");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  const actorRoles = input.action === "assign" ? internalManagerRoles : ["internal_technician"];
  await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, actorRoles);
  const key = `internal-dispatch:${input.actor.actorId}:${input.action}:${input.key}`;
  const normalized = JSON.stringify({ work: work.id, action: input.action, target: input.target ?? null, membership: input.membershipId ?? null, manager: input.managerId ?? null, version: input.expectedVersion, assignment: input.expectedAssignmentId, reason: input.reason?.trim() ?? "" });
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized + (composition?.intent ?? ""))))].map(b => b.toString(16).padStart(2, "0")).join("");
  async function replay() {
    const saved = await r.getIdempotencyKey(input.organizationId, key);
    if (!saved) return null;
    if (saved.requestHash !== hash) throw new OpsDomainError("CONFLICT", "This retry contains different changes. Refresh before saving.");
    const assignment = await r.getAssignment(input.organizationId, saved.resultId);
    if (!assignment) throw new OpsDomainError("CONFLICT", "The saved assignment is unavailable. Refresh the job.");
    return { assignment, version: input.expectedVersion + 1, replayed: true };
  }
  const saved = await replay();
  if (saved) return saved;
  const prior = await r.getActiveAssignment(input.organizationId, work.id);
  if (persistedWorkOrderVersion(work) !== input.expectedVersion || (prior?.id ?? null) !== input.expectedAssignmentId) throw new OpsDomainError("CONFLICT", "This job changed or another person took it. Refresh to see who handles it now.");
  if (["draft", "awaiting_approval", "completed_pending_review", "resolved", "closed", "cancelled"].includes(work.status)) throw new OpsDomainError("CONFLICT", "This job needs review or is already finished. Open the work order.");
  if (["waiting_on_parts", "waiting_on_vendor"].includes(work.status)) throw new OpsDomainError("CONFLICT", "Review the parts or vendor follow-up before changing this assignment.");
  const inspection = await r.inspectionForWork(input.organizationId, work.id);
  if (inspection?.workOrderId === work.id) throw new OpsDomainError("CONFLICT", "Use the inspection record to change who handles this inspection.");
  const [links, estimates, tasks, appointments, hold, detail] = await Promise.all([r.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, work.id), r.listEstimateRequestsForWorkOrder(input.organizationId, work.id), r.listWorkflowTasksForWorkOrder(input.organizationId, work.id), r.listServiceAppointmentsForWorkOrder(input.organizationId, work.id), r.getWorkOrderVisitHold(input.organizationId, work.id), r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id)]);
  const visitIds = [...new Set(links.map(link => link.visitId))];
  const visits = await Promise.all(visitIds.map(visitId => r.getVisit(input.organizationId, visitId)));
  if (visits.some(v => v?.status === "active") || (await r.listActiveVisitsForStore(input.organizationId, work.storeId)).some(v => v.workOrderId === work.id)) throw new OpsDomainError("CONFLICT", "A visit is active. Finish the visit or ask the responsible manager for help before changing the assignment.");
  if (estimates.some(e => ["requested", "opened", "submitted", "selected"].includes(e.status)) || tasks.some(t => t.sourceApprovalRequestId && ["open", "in_progress"].includes(t.status))) throw new OpsDomainError("CONFLICT", "Review the open approval or quote decision before changing this assignment.");
  if (detail?.followUps.some(f => f.status === "open") || tasks.some(t => t.sourceFollowUpId && ["open", "in_progress"].includes(t.status))) throw new OpsDomainError("CONFLICT", "Review the open follow-up before changing this assignment.");
  if (input.action !== "assign" && (input.membershipId || input.managerId || input.target)) throw new OpsDomainError("VALIDATION", "Take and return use your signed-in identity.");
  if (input.action === "claim" && (prior?.kind !== "internal" || internalTarget(prior) !== "pool" || ["waiting_on_parts", "waiting_on_vendor"].includes(work.status))) throw new OpsDomainError("CONFLICT", "This job is not available to take. Refresh the list.");
  if (input.action === "return" && (prior?.kind !== "internal" || prior.internalMembershipId !== input.actor.actorId)) throw new OpsDomainError("FORBIDDEN", "You can return only your own assigned work.");
  const target = input.action === "claim" ? "person" : input.action === "return" ? "pool" : input.target!;
  const membershipId = input.action === "claim" ? input.actor.actorId : input.action === "return" ? undefined : input.membershipId;
  const resolved = await resolveDispatchTarget(r, work, { target, membershipId, managerId: input.managerId });
  const owner = await resolveDispatchAccountability(r, work);
  const nextWork = { ...work, internalAccountableType: owner.assigneeType === "user" ? "membership" as const : "team" as const, internalAccountableId: owner.assigneeId, internalAccountableParty: owner.assigneeName, ...(resolved.manager ? { internalAccountableType: "membership" as const, internalAccountableId: resolved.manager.membershipId, internalAccountableParty: resolved.manager.name } : {}) };
  const accountable = resolved.manager ? { ...owner, assigneeType: "user" as const, assigneeId: resolved.manager.membershipId, assigneeName: resolved.manager.name } : owner;
  const held = hold?.status === "active" || hold?.status === "review_required";
  const preserveScheduling = composition?.preserveSchedulingTasks && tasks.some(t => ["open", "in_progress"].includes(t.status) && ["schedule_service", "schedule_return_visit"].includes(t.taskType) && !t.sourceFollowUpId && !t.sourceApprovalRequestId);
  const title = held ? "Wait for a suitable internal visit" : target === "person" ? "Begin internal work" : target === "pool" ? "Arrange team pickup" : "Arrange internal work";
  const dueAt = composition?.executionDueAt ?? work.dueAt ?? new Date(Date.parse(now) + 72 * 3600000).toISOString();
  const task = buildWorkflowTaskRecord({ id: id("workflow-task"), organizationId: input.organizationId, workOrderId: work.id, actor: input.actor, createdAt: now, inheritedDueAt: work.dueAt, draft: {
    taskType: composition?.executionDueAt ? "record_service_outcome" : "other", title: composition?.executionDueAt ? "Complete planned internal work" : title, reason: work.problem, assigneeType: resolved.person && !held ? "user" : accountable.assigneeType,
    assigneeId: !held && resolved.person ? resolved.person.membershipId : accountable.assigneeId, assigneeName: !held && resolved.person ? resolved.person.name : accountable.assigneeName,
    priority: work.priority === "emergency" ? "critical" : work.priority === "urgent" ? "high" : "normal", dueAt,
    completionCriteria: target === "person" ? "Record the work result or ask the responsible manager for help" : "Give this work to an eligible internal technician",
    escalationDestination: accountable.escalationDestination, applicableSlaClock: composition?.executionDueAt ? "completion" : "scheduling",
  } });
  const assignment: WorkOrderAssignment = { id: id("assignment"), organizationId: input.organizationId, workOrderId: work.id, kind: "internal", internalTarget: target, internalMembershipId: membershipId, status: "pending", assignedAt: now, supersedesAssignmentId: prior?.id };
  const statements: OpsStatement[] = [dispatchAccessAssertion(input.organizationId, input.actor.actorId, work.storeId, actorRoles, now)];
  if (resolved.person) statements.push(dispatchAccessAssertion(input.organizationId, resolved.person.membershipId, work.storeId, ["internal_technician"], now));
  if (accountable.assigneeType === "user" && accountable.assigneeId) statements.push(dispatchAccessAssertion(input.organizationId, accountable.assigneeId, work.storeId, internalManagerRoles, now));
  statements.push(insertDispatchRecord("ops_idempotency_keys", { organization_id: input.organizationId, key, command: `internal_dispatch.${input.action}`, result_id: assignment.id, request_hash: hash, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" }));
  if (prior) statements.push({ sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?", params: ["superseded", input.organizationId, prior.id] });
  if (prior?.kind === "outside_vendor") {
    const issuances = await r.listIssuancesForWorkOrder(input.organizationId, work.id);
    for (const issuance of issuances) statements.push({ sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND subject_id = ? AND revoked_at IS NULL", params: [now, input.organizationId, issuance.id] });
    for (const appointment of appointments.filter(a => a.assignmentId === prior.id && a.status !== "cancelled")) statements.push({ sql: "UPDATE ops_service_appointments SET status = ? WHERE organization_id = ? AND id = ?", params: ["cancelled", input.organizationId, appointment.id] });
  }
  statements.push(insertDispatchRecord("ops_work_order_assignments", { id: assignment.id, organization_id: input.organizationId, work_order_id: work.id, kind: "internal", internal_target: target, internal_membership_id: membershipId, status: "pending", assigned_at: now, supersedes_assignment_id: prior?.id }),
    { sql: "UPDATE ops_work_orders SET internal_accountable_type = ?, internal_accountable_id = ?, internal_accountable_party = ? WHERE organization_id = ? AND id = ?", params: [nextWork.internalAccountableType ?? "team", nextWork.internalAccountableId ?? "facilities-coordination", nextWork.internalAccountableParty ?? accountable.assigneeName, input.organizationId, work.id] },
    ...(preserveScheduling ? [] : buildReplacePrimaryTaskStatements({ workOrder: work, tasks, replacementTask: task, actor: input.actor, occurredAt: now, ids: { next: id }, resolutionNote: input.reason?.trim() || "Internal assignment changed" })));
  const event = `internal_dispatch.${input.action}`;
  const payload = { assignmentId: assignment.id, priorAssignmentId: prior?.id, internalTarget: target, internalMembershipId: membershipId, managerId: nextWork.internalAccountableId, reason: input.reason?.trim(), version: input.expectedVersion + 1, priorScheduleId: work.internalScheduleId, scheduleConsequence: composition ? "replaced_in_same_transaction" : input.action === "claim" && work.internalScheduleId ? "carried_to_claimed_assignment" : work.internalScheduleId ? "removed_for_new_assignment" : "unscheduled" };
  statements.push(insertDispatchRecord("ops_audit_events", { id: id("audit"), organization_id: input.organizationId, aggregate_type: "work_order", aggregate_id: work.id, event_type: event, actor_type: "user", actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: now, payload_json: JSON.stringify(payload) }));
  const recipients = new Set<string>();
  if (input.action === "assign") { if (membershipId) recipients.add(membershipId); if (prior?.internalMembershipId && prior.internalMembershipId !== membershipId) recipients.add(prior.internalMembershipId); if (resolved.manager) recipients.add(resolved.manager.membershipId); }
  if (input.action === "return" && (["urgent", "emergency"].includes(work.priority) || dueAt < now)) {
    if (accountable.assigneeType === "user" && accountable.assigneeId) recipients.add(accountable.assigneeId);
    // The named coordination team remains accountable when no person is set.
  }
  if (recipients.size || input.action === "return" && (["urgent", "emergency"].includes(work.priority) || dueAt < now)) statements.push(buildDispatchNotification({ id: id("outbox"), work, now, payload, recipients: [...recipients], notifyCoordinationTeam: !recipients.size, headline: input.action === "return" ? "Urgent work returned to the team" : "Internal assignment changed" }));
  statements.push({sql:"UPDATE ops_work_orders SET internal_schedule_id = ? WHERE organization_id = ? AND id = ?",params:[null,input.organizationId,work.id]});
  if (!composition && input.action === "claim" && work.internalScheduleId) {
    const plan = await r.getInternalSchedule(input.organizationId, work.internalScheduleId);
    if (plan && plan.assignmentId === prior?.id) {
      const history = await r.listInternalSchedules(input.organizationId,work.id);
      const claimedPlan = {...plan,id:id("internal-schedule"),assignmentId:assignment.id,revision:(history[0]?.revision??0)+1,supersedesId:plan.id,recordedBy:input.actor.actorId,recordedByName:input.actor.actorName,recordedAt:now};
      const {internalScheduleStatement} = await import("./internal-scheduling");
      statements.push(internalScheduleStatement(claimedPlan),{sql:"UPDATE ops_work_orders SET internal_schedule_id = ? WHERE organization_id = ? AND id = ?",params:[claimedPlan.id,input.organizationId,work.id]},
        insertDispatchRecord("ops_audit_events",{id:id("audit"),organization_id:input.organizationId,aggregate_type:"work_order",aggregate_id:work.id,event_type:"internal_schedule.claimed",actor_type:"user",actor_id:input.actor.actorId,actor_name:input.actor.actorName,occurred_at:now,payload_json:JSON.stringify({priorScheduleId:plan.id,schedule:claimedPlan})}));
    }
  }
  if (composition) {
    // The combined command sends one material update containing the saved plan.
    for (let i=statements.length-1;i>=0;i--) if (statements[i]!.sql.startsWith("INSERT INTO ops_outbox_messages") && statements[i]!.params.includes("ops.internal_dispatch.notification")) statements.splice(i,1);
    const primary = selectWorkflowTaskProjection(tasks);
    const projectedTasks = preserveScheduling ? tasks : tasks.map(t => t.id === primary?.id ? {...t,status:"completed" as const} : t).concat(task);
    statements.push(...await composition.prepare(work, assignment, projectedTasks));
  }
  try { await atomicWorkOrderMutation({ repository: r, workOrder: work, now, statements, conflictMessage: "This job changed or another person took it. Refresh to see who handles it now." }); }
  catch (error) { const retried = await replay(); if (retried) return retried; await dispatchIdentity(r, input.organizationId, input.actor.actorId!, work.storeId, actorRoles); if (resolved.person) await dispatchIdentity(r, input.organizationId, resolved.person.membershipId, work.storeId, ["internal_technician"]); if (accountable.assigneeType === "user" && accountable.assigneeId) await dispatchIdentity(r, input.organizationId, accountable.assigneeId, work.storeId, internalManagerRoles); throw error; }
  return { assignment, version: input.expectedVersion + 1, replayed: false };
}

/** Creation and later changes use the same transactional notification contract. */
export function buildDispatchNotification(input: { id: string; work: Pick<WorkOrder, "organizationId" | "id">; now: string; payload: Record<string, unknown>; recipients: string[]; notifyCoordinationTeam?: boolean; headline?: string }): OpsStatement {
  return insertDispatchRecord("ops_outbox_messages", {
    id: input.id, organization_id: input.work.organizationId, topic: "ops.internal_dispatch.notification",
    aggregate_type: "work_order", aggregate_id: input.work.id,
    payload_json: JSON.stringify({ ...input.payload, recipientMembershipIds: [...new Set(input.recipients)], notifyCoordinationTeam: input.notifyCoordinationTeam ?? false, headline: input.headline ?? "Internal assignment changed" }),
    status: "pending", available_at: input.now, created_at: input.now, attempt_count: 0,
  });
}

export function initialInternalTask(work: WorkOrder, assignment: { internalTarget?: InternalTarget; internalMembershipId?: string }, personName?: string) {
  const target = work.nextAction === "Wait for a suitable internal visit" ? "awaiting_allocation" : assignment.internalTarget ?? "person";
  return {
    taskType: "other" as const, title: work.nextAction === "Wait for a suitable internal visit" ? work.nextAction : target === "person" ? "Begin internal work" : target === "pool" ? "Arrange team pickup" : "Arrange internal work", reason: work.problem,
    assigneeType: target === "person" ? "user" as const : work.internalAccountableType === "membership" ? "user" as const : "team" as const,
    assigneeId: target === "person" ? assignment.internalMembershipId : work.internalAccountableId ?? "facilities-coordination",
    assigneeName: target === "person" ? personName ?? "Internal maintenance" : work.internalAccountableParty ?? "Facilities coordination",
    priority: work.priority === "emergency" ? "critical" as const : work.priority === "urgent" ? "high" as const : "normal" as const,
    dueAt: work.dueAt, completionCriteria: "Arrange internal service and record its outcome", escalationDestination: work.escalationTo ?? "Facilities leadership", applicableSlaClock: "scheduling" as const,
  };
}

/** Recognize our allocation obligation without completing an unrelated required task. */
export function isInternalAssignmentTask(task: WorkflowTask) {
  return task.taskType === "other" && !task.sourceFollowUpId && !task.sourceApprovalRequestId
    && ["Begin internal work", "Arrange team pickup", "Arrange internal work", "Wait for a suitable internal visit"].includes(task.title)
    && ["Arrange internal service and record its outcome", "Record the work result or ask the responsible manager for help", "Give this work to an eligible internal technician"].includes(task.completionCriteria);
}

/** Approval activates the current internal assignment in the approval transaction. */
export async function prepareApprovedInternalDispatch(input: {
  repository: OpsRepository; work: WorkOrder; actor: ActorContext; now: string; ids: { next(prefix: string): string };
}) {
  const { repository, work, actor, now, ids } = input;
  const current = await repository.getActiveAssignment(work.organizationId, work.id);
  if (current?.kind !== "internal") return null;
  const inspection = await repository.inspectionForWork(work.organizationId, work.id);
  if (inspection?.workOrderId === work.id) return null;
  const owner = await resolveDispatchAccountability(repository, work);
  const statements: OpsStatement[] = [];
  let assignment = current;
  let person: Awaited<ReturnType<typeof dispatchIdentity>> | undefined;
  if (internalTarget(current) === "person" && current.internalMembershipId) {
    try { person = await dispatchIdentity(repository, work.organizationId, current.internalMembershipId, work.storeId, ["internal_technician"]); }
    catch (error) {
      if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
      // Keep the original assignment as history; approval cannot activate a revoked performer.
      assignment = { id: ids.next("assignment"), organizationId: work.organizationId, workOrderId: work.id,
        kind: "internal", internalTarget: "awaiting_allocation", status: "pending", assignedAt: now, supersedesAssignmentId: current.id };
      statements.push({ sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?", params: ["superseded", work.organizationId, current.id] },
        insertDispatchRecord("ops_work_order_assignments", { id: assignment.id, organization_id: work.organizationId, work_order_id: work.id, kind: "internal", internal_target: "awaiting_allocation", status: "pending", assigned_at: now, supersedes_assignment_id: current.id }),
        insertDispatchRecord("ops_audit_events", { id: ids.next("audit"), organization_id: work.organizationId, aggregate_type: "work_order", aggregate_id: work.id,
          event_type: "internal_dispatch.approval_reallocation", actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now,
          payload_json: JSON.stringify({ assignmentId: assignment.id, priorAssignmentId: current.id, reason: "Assigned technician no longer has writable store access" }) }));
    }
  }
  if (person) statements.push(dispatchAccessAssertion(work.organizationId, person.membershipId, work.storeId, ["internal_technician"], now));
  if (owner.assigneeType === "user" && owner.assigneeId) statements.push(dispatchAccessAssertion(work.organizationId, owner.assigneeId, work.storeId, internalManagerRoles, now));
  const hold = await repository.getWorkOrderVisitHold(work.organizationId, work.id);
  const held = hold?.status === "active" || hold?.status === "review_required";
  const nextWork: WorkOrder = { ...work, internalAccountableType: owner.assigneeType === "user" ? "membership" : "team",
    internalAccountableId: owner.assigneeId, internalAccountableParty: owner.assigneeName, nextAction: held ? "Wait for a suitable internal visit" : work.nextAction };
  const draft = initialInternalTask(nextWork, { ...assignment, internalTarget: internalTarget(assignment) }, person?.name);
  statements.push({ sql: "UPDATE ops_work_orders SET internal_accountable_type = ?, internal_accountable_id = ?, internal_accountable_party = ? WHERE organization_id = ? AND id = ?",
    params: [nextWork.internalAccountableType, owner.assigneeId, owner.assigneeName, work.organizationId, work.id] });
  const notifyManager = held || internalTarget(assignment) === "awaiting_allocation";
  const recipients = notifyManager ? owner.assigneeType === "user" && owner.assigneeId ? [owner.assigneeId] : [] : person ? [person.membershipId] : [];
  if (recipients.length || notifyManager) statements.push(buildDispatchNotification({ id: ids.next("outbox"), work, now,
    payload: { assignmentId: assignment.id, priorAssignmentId: assignment.supersedesAssignmentId, internalTarget: internalTarget(assignment), internalMembershipId: assignment.internalMembershipId,
      managerId: owner.assigneeId, version: (work.version ?? 0) + 1, resumedAfterApproval: true }, recipients,
    notifyCoordinationTeam: notifyManager && owner.assigneeType === "team", headline: "Internal work approved" }));
  return { draft, statements };
}
