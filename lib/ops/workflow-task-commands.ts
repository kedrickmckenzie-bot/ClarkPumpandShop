import { atomicWorkOrderMutation } from "./concurrency";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { OpsClock, OpsCommandServices, OpsIdSource } from "./commands";
import type {
  ActorContext,
  ActorType,
  IsoDateTime,
  OpsId,
  OrganizationRole,
  WorkOrder,
  WorkflowTask,
  WorkflowTaskAssigneeType,
  WorkflowTaskPriority,
  WorkflowTaskSlaClock,
  WorkflowTaskSlaOwnerType,
  WorkflowTaskSlaPause,
  WorkflowTaskSlaPauseReason,
  WorkflowTaskSlaResume,
  WorkflowTaskType,
} from "./types";
import { evaluateWorkOrderClosureEligibility, isCloseVerifiedWorkTask } from "./work-order-closure";

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const terminalWorkOrderStatuses = new Set(["closed", "cancelled"]);
const openTaskStatuses = new Set<WorkflowTask["status"]>(["open", "in_progress"]);
const domainManagedReactiveTaskTypes = new Set<WorkflowTask["taskType"]>([
  "review_issue",
  "approve_quote",
  "vendor_response_required",
  "confirm_store_access",
  "submit_quote",
  "choose_service_provider",
  "schedule_service",
  "record_service_outcome",
  "schedule_return_visit",
  "verify_repair",
  "close_verified_work",
]);
const priorityRank: Record<WorkflowTaskPriority, number> = { critical: 4, high: 3, normal: 2, low: 1 };
const organizationRoles = new Set<OrganizationRole>([
  "executive", "facilities_admin", "regional_manager", "store_manager", "store_employee",
  "internal_technician", "finance_reviewer", "vendor_user", "support",
]);
const taskTypes = new Set<WorkflowTaskType>([
  "review_issue", "approve_quote", "vendor_response_required", "confirm_store_access", "submit_quote",
  "choose_service_provider", "schedule_service", "record_service_outcome", "schedule_return_visit",
  "verify_repair", "close_verified_work", "review_warranty", "resolve_invoice_exception", "respond_service_discrepancy", "other",
]);
const taskPriorities = new Set<WorkflowTaskPriority>(["critical", "high", "normal", "low"]);
const slaClocks = new Set<WorkflowTaskSlaClock>([
  "intake_review", "approval", "vendor_response", "scheduling", "arrival", "operational_restoration",
  "completion", "verification", "invoice_submission", "warranty_response", "service_discrepancy_response",
]);
const pauseReasons = new Set<WorkflowTaskSlaPauseReason>([
  "awaiting_vendor", "awaiting_parts", "awaiting_approval", "awaiting_store_access", "awaiting_customer",
  "weather_or_site_condition", "scheduled_future_event", "external_dependency", "other",
]);
const pauseOwnerTypes = new Set<WorkflowTaskSlaOwnerType>([
  "membership", "team", "vendor", "store", "external_party", "system",
]);

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function optionalClean(value: string | undefined) {
  const clean = value?.trim();
  return clean || undefined;
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
}

function assertInstant(value: IsoDateTime, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  aggregateType?: "workflow_task" | "work_order";
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: OpsIdSource;
}): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  const aggregateType = input.aggregateType ?? "workflow_task";
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: aggregateType,
      aggregate_id: input.aggregateId, event_type: input.eventType, actor_type: input.actor.actorType,
      actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`,
      aggregate_type: aggregateType, aggregate_id: input.aggregateId, payload_json: payloadJson,
      status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0,
    }),
  ];
}

export interface WorkflowTaskDraft {
  taskType: WorkflowTaskType;
  title: string;
  reason: string;
  assigneeType: WorkflowTaskAssigneeType;
  assigneeId?: OpsId;
  assigneeRole?: OrganizationRole;
  assigneeName: string;
  priority: WorkflowTaskPriority;
  blocking?: boolean;
  requiredForProgress?: boolean;
  dueAt?: IsoDateTime;
  noSlaReason?: string;
  applicableSlaClock?: WorkflowTaskSlaClock;
  completionCriteria: string;
  escalationDestination: string;
  escalationLevel?: number;
  sourceFollowUpId?: OpsId;
  sourceApprovalRequestId?: OpsId;
  /** Statement composers may create an already-started obligation atomically. */
  initialStatus?: "open" | "in_progress";
}

function validateDraftShape(draft: WorkflowTaskDraft, createdAt: IsoDateTime) {
  if (!taskTypes.has(draft.taskType)) throw new OpsDomainError("VALIDATION", "Workflow task type is invalid");
  if (!taskPriorities.has(draft.priority)) throw new OpsDomainError("VALIDATION", "Workflow task priority is invalid");
  required(draft.title, "Task title");
  required(draft.reason, "Task reason");
  required(draft.assigneeName, "Task assignee name");
  required(draft.completionCriteria, "Task completion criteria");
  required(draft.escalationDestination, "Task escalation destination");
  if (draft.assigneeType === "role") {
    if (draft.assigneeId || !draft.assigneeRole || !organizationRoles.has(draft.assigneeRole)) throw new OpsDomainError("VALIDATION", "Role task assignee is invalid");
  } else if (!draft.assigneeId || draft.assigneeRole) {
    throw new OpsDomainError("VALIDATION", "Task assignee id is required for user, team, and vendor assignees");
  }
  const noSlaReason = optionalClean(draft.noSlaReason);
  if (Boolean(draft.dueAt) === Boolean(noSlaReason)) throw new OpsDomainError("VALIDATION", "Provide a due time or an explicit no-SLA reason, but not both");
  assertInstant(createdAt, "Task creation time");
  if (draft.dueAt) {
    assertInstant(draft.dueAt, "Task due time");
    if (Date.parse(draft.dueAt) < Date.parse(createdAt)) throw new OpsDomainError("VALIDATION", "Task due time cannot precede task creation");
  }
  if (draft.applicableSlaClock && !slaClocks.has(draft.applicableSlaClock)) throw new OpsDomainError("VALIDATION", "Applicable SLA clock is invalid");
  if (!Number.isInteger(draft.escalationLevel ?? 0) || (draft.escalationLevel ?? 0) < 0) throw new OpsDomainError("VALIDATION", "Task escalation level must be a non-negative integer");
}

export function buildWorkflowTaskRecord(input: {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  draft: WorkflowTaskDraft;
  actor: ActorContext;
  createdAt: IsoDateTime;
}): WorkflowTask {
  assertActorOrganization(input.actor, input.organizationId);
  validateDraftShape(input.draft, input.createdAt);
  const status = input.draft.initialStatus ?? "open";
  return {
    id: input.id,
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    taskType: input.draft.taskType,
    title: required(input.draft.title, "Task title"),
    reason: required(input.draft.reason, "Task reason"),
    assigneeType: input.draft.assigneeType,
    assigneeId: input.draft.assigneeId,
    assigneeRole: input.draft.assigneeRole,
    assigneeName: required(input.draft.assigneeName, "Task assignee name"),
    priority: input.draft.priority,
    status,
    blocking: input.draft.blocking ?? false,
    requiredForProgress: input.draft.requiredForProgress ?? true,
    dueAt: input.draft.dueAt,
    noSlaReason: optionalClean(input.draft.noSlaReason),
    applicableSlaClock: input.draft.applicableSlaClock,
    completionCriteria: required(input.draft.completionCriteria, "Task completion criteria"),
    escalationDestination: required(input.draft.escalationDestination, "Task escalation destination"),
    escalationLevel: input.draft.escalationLevel ?? 0,
    sourceFollowUpId: input.draft.sourceFollowUpId,
    sourceApprovalRequestId: input.draft.sourceApprovalRequestId,
    createdByActorType: input.actor.actorType,
    createdByActorId: input.actor.actorId,
    createdByActorName: input.actor.actorName,
    createdAt: input.createdAt,
    ...(status === "in_progress" ? {
      startedByActorType: input.actor.actorType,
      startedByActorId: input.actor.actorId,
      startedByActorName: input.actor.actorName,
      startedAt: input.createdAt,
    } : {}),
  };
}

function workflowTaskInsertStatement(task: WorkflowTask): OpsStatement {
  return insert("ops_workflow_tasks", {
    id: task.id, organization_id: task.organizationId, work_order_id: task.workOrderId,
    task_type: task.taskType, title: task.title, reason: task.reason, assignee_type: task.assigneeType,
    assignee_id: task.assigneeId, assignee_role: task.assigneeRole, assignee_name: task.assigneeName,
    priority: task.priority, status: task.status, blocking: task.blocking, required_for_progress: task.requiredForProgress,
    due_at: task.dueAt, no_sla_reason: task.noSlaReason, applicable_sla_clock: task.applicableSlaClock,
    completion_criteria: task.completionCriteria, escalation_destination: task.escalationDestination,
    escalation_level: task.escalationLevel, source_follow_up_id: task.sourceFollowUpId,
    source_approval_request_id: task.sourceApprovalRequestId, created_by_actor_type: task.createdByActorType,
    created_by_actor_id: task.createdByActorId, created_by_actor_name: task.createdByActorName, created_at: task.createdAt,
    started_by_actor_type: task.startedByActorType, started_by_actor_id: task.startedByActorId,
    started_by_actor_name: task.startedByActorName, started_at: task.startedAt,
  });
}

export function buildCreateTaskStatements(input: { task: WorkflowTask; actor: ActorContext; ids: OpsIdSource }): OpsStatement[] {
  assertActorOrganization(input.actor, input.task.organizationId);
  return [
    workflowTaskInsertStatement(input.task),
    ...auditAndOutbox({
      organizationId: input.task.organizationId,
      aggregateId: input.task.id,
      eventType: "workflow_task.created",
      actor: input.actor,
      occurredAt: input.task.createdAt,
      payload: {
        workOrderId: input.task.workOrderId, taskType: input.task.taskType, assigneeType: input.task.assigneeType,
        assigneeId: input.task.assigneeId, assigneeRole: input.task.assigneeRole, priority: input.task.priority,
        blocking: input.task.blocking, requiredForProgress: input.task.requiredForProgress,
        dueAt: input.task.dueAt, noSlaReason: input.task.noSlaReason, sourceFollowUpId: input.task.sourceFollowUpId,
        sourceApprovalRequestId: input.task.sourceApprovalRequestId,
      },
      ids: input.ids,
    }),
  ];
}

export const buildCreateWorkflowTaskStatements = buildCreateTaskStatements;

export function isOpenWorkflowTask(task: WorkflowTask) {
  return openTaskStatuses.has(task.status);
}

/**
 * These obligations are projections of an evidence-bearing domain transition.
 * They must be resolved by the command that records that evidence, rather than
 * by the generic task-completion endpoint.
 */
export function isDomainManagedReactiveTask(task: WorkflowTask) {
  return Boolean(task.sourceApprovalRequestId || task.sourceFollowUpId)
    || domainManagedReactiveTaskTypes.has(task.taskType)
    || task.taskType === "other" && task.title.trim().toLocaleLowerCase("en-US") === "issue service authorization";
}

export function selectWorkflowTaskProjection(tasks: readonly WorkflowTask[]): WorkflowTask | undefined {
  return [...tasks].filter(isOpenWorkflowTask).sort((left, right) =>
    Number(right.blocking) - Number(left.blocking)
    || Number(right.requiredForProgress) - Number(left.requiredForProgress)
    || priorityRank[right.priority] - priorityRank[left.priority]
    || (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")
    || Number(right.status === "in_progress") - Number(left.status === "in_progress")
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id))[0];
}

export const selectPrimaryWorkflowTask = selectWorkflowTaskProjection;

export function buildWorkflowTaskProjectionStatement(
  organizationId: OpsId,
  workOrderId: OpsId,
  tasks: readonly WorkflowTask[],
): OpsStatement {
  const primary = selectWorkflowTaskProjection(tasks);
  return {
    sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?",
    params: primary
      ? [primary.assigneeName, primary.title, primary.dueAt ?? null, primary.escalationDestination, organizationId, workOrderId]
      : ["No accountable task", "No open workflow task", null, null, organizationId, workOrderId],
  };
}

export interface WorkflowTaskPatch {
  taskType?: WorkflowTaskType;
  title?: string;
  reason?: string;
  assigneeType?: WorkflowTaskAssigneeType;
  assigneeId?: OpsId | null;
  assigneeRole?: OrganizationRole | null;
  assigneeName?: string;
  priority?: WorkflowTaskPriority;
  blocking?: boolean;
  requiredForProgress?: boolean;
  dueAt?: IsoDateTime | null;
  noSlaReason?: string | null;
  applicableSlaClock?: WorkflowTaskSlaClock | null;
  completionCriteria?: string;
  escalationDestination?: string;
  escalationLevel?: number;
}

export function workflowTaskUpdateStatement(input: {
  organizationId: OpsId;
  workflowTaskId: OpsId;
  patch: WorkflowTaskPatch;
}): OpsStatement {
  const patch = { ...input.patch };
  if (patch.title !== undefined) patch.title = required(patch.title, "Task title");
  if (patch.reason !== undefined) patch.reason = required(patch.reason, "Task reason");
  if (patch.assigneeName !== undefined) patch.assigneeName = required(patch.assigneeName, "Task assignee name");
  if (patch.completionCriteria !== undefined) patch.completionCriteria = required(patch.completionCriteria, "Task completion criteria");
  if (patch.escalationDestination !== undefined) patch.escalationDestination = required(patch.escalationDestination, "Task escalation destination");
  if (patch.taskType !== undefined && !taskTypes.has(patch.taskType)) throw new OpsDomainError("VALIDATION", "Workflow task type is invalid");
  if (patch.priority !== undefined && !taskPriorities.has(patch.priority)) throw new OpsDomainError("VALIDATION", "Workflow task priority is invalid");
  if (patch.applicableSlaClock && !slaClocks.has(patch.applicableSlaClock)) throw new OpsDomainError("VALIDATION", "Applicable SLA clock is invalid");
  if (patch.escalationLevel !== undefined && (!Number.isInteger(patch.escalationLevel) || patch.escalationLevel < 0)) throw new OpsDomainError("VALIDATION", "Task escalation level must be a non-negative integer");
  if (patch.dueAt) { assertInstant(patch.dueAt, "Task due time"); patch.noSlaReason = null; }
  if (patch.noSlaReason) { patch.noSlaReason = required(patch.noSlaReason, "No-SLA reason"); patch.dueAt = null; }
  if (patch.assigneeType === "role" && (patch.assigneeId || !patch.assigneeRole)) throw new OpsDomainError("VALIDATION", "Role task assignee is invalid");
  if (patch.assigneeType && patch.assigneeType !== "role" && (!patch.assigneeId || patch.assigneeRole)) throw new OpsDomainError("VALIDATION", "Task assignee id is required for this assignee type");
  const columns: Record<keyof WorkflowTaskPatch, string> = {
    taskType: "task_type", title: "title", reason: "reason", assigneeType: "assignee_type",
    assigneeId: "assignee_id", assigneeRole: "assignee_role", assigneeName: "assignee_name", priority: "priority",
    blocking: "blocking", requiredForProgress: "required_for_progress", dueAt: "due_at", noSlaReason: "no_sla_reason",
    applicableSlaClock: "applicable_sla_clock", completionCriteria: "completion_criteria",
    escalationDestination: "escalation_destination", escalationLevel: "escalation_level",
  };
  const entries = (Object.keys(columns) as Array<keyof WorkflowTaskPatch>)
    .filter((key) => Object.prototype.hasOwnProperty.call(patch, key))
    .map((key) => [columns[key], patch[key]] as const);
  if (!entries.length) throw new OpsDomainError("VALIDATION", "Workflow task update has no fields");
  return {
    sql: `UPDATE ops_workflow_tasks SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE organization_id = ? AND id = ?`,
    params: [...entries.map(([, value]) => value), input.organizationId, input.workflowTaskId],
  };
}

function completedTask(task: WorkflowTask, actor: ActorContext, occurredAt: IsoDateTime, resolutionNote: string): WorkflowTask {
  return { ...task, status: "completed", completedByActorType: actor.actorType, completedByActorId: actor.actorId, completedByActorName: actor.actorName, completedAt: occurredAt, resolutionNote };
}

function cancelledTask(task: WorkflowTask, actor: ActorContext, occurredAt: IsoDateTime, resolutionNote: string): WorkflowTask {
  return { ...task, status: "cancelled", cancelledByActorType: actor.actorType, cancelledByActorId: actor.actorId, cancelledByActorName: actor.actorName, cancelledAt: occurredAt, resolutionNote };
}

export function buildStartWorkflowTaskStatements(input: { task: WorkflowTask; actor: ActorContext; occurredAt: IsoDateTime; ids: OpsIdSource }): OpsStatement[] {
  assertActorOrganization(input.actor, input.task.organizationId);
  return [
    { sql: "UPDATE ops_workflow_tasks SET status = ?, started_by_actor_type = ?, started_by_actor_id = ?, started_by_actor_name = ?, started_at = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, input.occurredAt, input.task.organizationId, input.task.id] },
    ...auditAndOutbox({ organizationId: input.task.organizationId, aggregateId: input.task.id, eventType: "workflow_task.started", actor: input.actor, occurredAt: input.occurredAt, payload: { workOrderId: input.task.workOrderId, previousStatus: input.task.status, status: "in_progress" }, ids: input.ids }),
  ];
}

export function buildCompleteWorkflowTaskStatements(input: { task: WorkflowTask; actor: ActorContext; occurredAt: IsoDateTime; ids: OpsIdSource; resolutionNote: string }): OpsStatement[] {
  assertActorOrganization(input.actor, input.task.organizationId);
  const note = required(input.resolutionNote, "Task resolution note");
  return [
    { sql: "UPDATE ops_workflow_tasks SET status = ?, completed_by_actor_type = ?, completed_by_actor_id = ?, completed_by_actor_name = ?, completed_at = ?, resolution_note = ? WHERE organization_id = ? AND id = ?", params: ["completed", input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, input.occurredAt, note, input.task.organizationId, input.task.id] },
    ...auditAndOutbox({ organizationId: input.task.organizationId, aggregateId: input.task.id, eventType: "workflow_task.completed", actor: input.actor, occurredAt: input.occurredAt, payload: { workOrderId: input.task.workOrderId, previousStatus: input.task.status, status: "completed", resolutionNote: note, sourceFollowUpId: input.task.sourceFollowUpId, sourceApprovalRequestId: input.task.sourceApprovalRequestId }, ids: input.ids }),
  ];
}

export function buildCancelWorkflowTaskStatements(input: { task: WorkflowTask; actor: ActorContext; occurredAt: IsoDateTime; ids: OpsIdSource; resolutionNote: string }): OpsStatement[] {
  assertActorOrganization(input.actor, input.task.organizationId);
  const note = required(input.resolutionNote, "Task cancellation reason");
  return [
    { sql: "UPDATE ops_workflow_tasks SET status = ?, cancelled_by_actor_type = ?, cancelled_by_actor_id = ?, cancelled_by_actor_name = ?, cancelled_at = ?, resolution_note = ? WHERE organization_id = ? AND id = ?", params: ["cancelled", input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, input.occurredAt, note, input.task.organizationId, input.task.id] },
    ...auditAndOutbox({ organizationId: input.task.organizationId, aggregateId: input.task.id, eventType: "workflow_task.cancelled", actor: input.actor, occurredAt: input.occurredAt, payload: { workOrderId: input.task.workOrderId, previousStatus: input.task.status, status: "cancelled", resolutionNote: note, sourceFollowUpId: input.task.sourceFollowUpId, sourceApprovalRequestId: input.task.sourceApprovalRequestId }, ids: input.ids }),
  ];
}

export function buildReplacePrimaryTaskStatements(input: {
  workOrder: WorkOrder;
  tasks: readonly WorkflowTask[];
  replacementTask: WorkflowTask;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  ids: OpsIdSource;
  resolutionNote: string;
}): OpsStatement[] {
  const primary = selectWorkflowTaskProjection(input.tasks);
  if (input.replacementTask.organizationId !== input.workOrder.organizationId || input.replacementTask.workOrderId !== input.workOrder.id) throw new OpsDomainError("VALIDATION", "Replacement task does not belong to this work order");
  const nextTasks = input.tasks.map((task) => primary && task.id === primary.id ? completedTask(task, input.actor, input.occurredAt, required(input.resolutionNote, "Task resolution note")) : task).concat(input.replacementTask);
  return [
    ...(primary ? buildCompleteWorkflowTaskStatements({ task: primary, actor: input.actor, occurredAt: input.occurredAt, ids: input.ids, resolutionNote: input.resolutionNote }) : []),
    ...buildCreateTaskStatements({ task: input.replacementTask, actor: input.actor, ids: input.ids }),
    buildWorkflowTaskProjectionStatement(input.workOrder.organizationId, input.workOrder.id, nextTasks),
  ];
}

export function buildCompleteTasksForTransition(input: {
  workOrder: WorkOrder;
  tasks: readonly WorkflowTask[];
  targetStatus: "closed" | "cancelled";
  actor: ActorContext;
  occurredAt: IsoDateTime;
  ids: OpsIdSource;
  resolutionNote: string;
}): OpsStatement[] {
  const openTasks = input.tasks.filter(isOpenWorkflowTask);
  const terminalTasks = input.tasks.map((task) => {
    if (!isOpenWorkflowTask(task)) return task;
    return input.targetStatus === "closed"
      ? completedTask(task, input.actor, input.occurredAt, required(input.resolutionNote, "Task resolution note"))
      : cancelledTask(task, input.actor, input.occurredAt, required(input.resolutionNote, "Task cancellation reason"));
  });
  return [
    ...openTasks.flatMap((task) => input.targetStatus === "closed"
      ? buildCompleteWorkflowTaskStatements({ task, actor: input.actor, occurredAt: input.occurredAt, ids: input.ids, resolutionNote: input.resolutionNote })
      : buildCancelWorkflowTaskStatements({ task, actor: input.actor, occurredAt: input.occurredAt, ids: input.ids, resolutionNote: input.resolutionNote })),
    buildWorkflowTaskProjectionStatement(input.workOrder.organizationId, input.workOrder.id, terminalTasks),
  ];
}

async function validateReferences(repository: OpsRepository, workOrder: WorkOrder, task: WorkflowTask, existingTasks: readonly WorkflowTask[]) {
  if (task.assigneeType === "user" && !(await repository.getMembership(task.organizationId, task.assigneeId!))) throw new OpsDomainError("NOT_FOUND", "Task assignee membership not found in this organization");
  if (task.assigneeType === "vendor") {
    const vendor = await repository.getVendor(task.organizationId, task.assigneeId!);
    if (!vendor || vendor.status === "inactive") throw new OpsDomainError("NOT_FOUND", "Task assignee vendor not found in this organization");
  }
  if (task.sourceFollowUpId) {
    const followUp = await repository.getFollowUp(task.organizationId, task.sourceFollowUpId);
    if (!followUp || followUp.workOrderId !== workOrder.id) throw new OpsDomainError("NOT_FOUND", "Source follow-up does not belong to this work order");
    if (existingTasks.some((candidate) => candidate.sourceFollowUpId === task.sourceFollowUpId)) throw new OpsDomainError("CONFLICT", "Source follow-up already has a workflow task");
  }
  if (task.sourceApprovalRequestId) {
    const approval = await repository.getApprovalRequest(task.organizationId, task.sourceApprovalRequestId);
    if (!approval) throw new OpsDomainError("NOT_FOUND", "Source approval request not found in this organization");
    let targetsWorkOrder = approval.subjectType === "work_order" && approval.subjectId === workOrder.id;
    if (approval.subjectType === "service_request") {
      const request = await repository.getRequest(task.organizationId, approval.subjectId);
      targetsWorkOrder = request?.convertedWorkOrderId === workOrder.id;
    }
    if (!targetsWorkOrder) throw new OpsDomainError("CONFLICT", "Source approval request does not belong to this work order");
    if (existingTasks.some((candidate) => candidate.sourceApprovalRequestId === task.sourceApprovalRequestId)) throw new OpsDomainError("CONFLICT", "Source approval request already has a workflow task");
  }
}

export interface CreateWorkflowTaskInput extends Omit<WorkflowTaskDraft, "initialStatus"> {
  organizationId: OpsId;
  workOrderId: OpsId;
  actor: ActorContext;
}

export async function createWorkflowTask(svc: OpsCommandServices, input: CreateWorkflowTaskInput): Promise<WorkflowTask> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found in this organization");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot receive an open workflow task");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const { organizationId, workOrderId, actor, ...draft } = input;
  const task = buildWorkflowTaskRecord({ id: ids.next("workflow-task"), organizationId, workOrderId, draft, actor, createdAt: now });
  await validateReferences(repository, workOrder, task, tasks);
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    ...buildCreateTaskStatements({ task, actor, ids }),
    buildWorkflowTaskProjectionStatement(organizationId, workOrderId, [...tasks, task]),
  ] });
  return task;
}

async function loadOpenTask(repository: OpsRepository, organizationId: OpsId, workflowTaskId: OpsId) {
  const task = await repository.getWorkflowTask(organizationId, workflowTaskId);
  if (!task) throw new OpsDomainError("NOT_FOUND", "Workflow task not found in this organization");
  if (!isOpenWorkflowTask(task)) throw new OpsDomainError("CONFLICT", "Workflow task is already terminal");
  if (!task.workOrderId) throw new OpsDomainError("CONFLICT", "Request-review tasks are managed through the request impact review command");
  const workOrder = await repository.getWorkOrder(organizationId, task.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Workflow task work order not found in this organization");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "A terminal work order cannot retain an open workflow task");
  return { task, workOrder };
}

export interface WorkflowTaskActionInput { organizationId: OpsId; workflowTaskId: OpsId; actor: ActorContext }

export async function startWorkflowTask(svc: OpsCommandServices, input: WorkflowTaskActionInput): Promise<WorkflowTask> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const { task, workOrder } = await loadOpenTask(repository, input.organizationId, input.workflowTaskId);
  if (task.status !== "open") throw new OpsDomainError("CONFLICT", "Workflow task has already started");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const started: WorkflowTask = { ...task, status: "in_progress", startedByActorType: input.actor.actorType, startedByActorId: input.actor.actorId, startedByActorName: input.actor.actorName, startedAt: now };
  const projected = tasks.map((candidate) => candidate.id === task.id ? started : candidate);
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    ...buildStartWorkflowTaskStatements({ task, actor: input.actor, occurredAt: now, ids }),
    buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, projected),
  ] });
  return started;
}

export interface ResolveWorkflowTaskInput extends WorkflowTaskActionInput {
  resolutionNote: string;
  replacementTask?: WorkflowTaskDraft;
  /** Compatibility alias for callers composing a replacement obligation. */
  replacement?: WorkflowTaskDraft;
}

async function resolveWorkflowTask(svc: OpsCommandServices, input: ResolveWorkflowTaskInput, outcome: "completed" | "cancelled") {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const { task, workOrder } = await loadOpenTask(repository, input.organizationId, input.workflowTaskId);
  if (isDomainManagedReactiveTask(task)) {
    throw new OpsDomainError(
      "CONFLICT",
      task.taskType === "close_verified_work"
        ? "Close verified work through the guarded work-order closure action"
        : "Complete this obligation through its evidence-bearing workflow action",
    );
  }
  const now = clock.now();
  const note = required(input.resolutionNote, outcome === "completed" ? "Task resolution note" : "Task cancellation reason");
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  if (input.replacementTask && input.replacement) throw new OpsDomainError("VALIDATION", "Provide only one replacement task");
  const replacementDraft = input.replacementTask ?? input.replacement;
  let replacementTask: WorkflowTask | undefined;
  if (replacementDraft) {
    replacementTask = buildWorkflowTaskRecord({ id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id, draft: replacementDraft, actor: input.actor, createdAt: now });
    await validateReferences(repository, workOrder, replacementTask, tasks);
  }
  const resolved = outcome === "completed" ? completedTask(task, input.actor, now, note) : cancelledTask(task, input.actor, now, note);
  const projected = tasks.map((candidate) => candidate.id === task.id ? resolved : candidate).concat(replacementTask ? [replacementTask] : []);
  let automaticClosure: Awaited<ReturnType<typeof evaluateWorkOrderClosureEligibility>> | undefined;
  if (outcome === "completed" && !replacementTask && workOrder.status === "resolved") {
    const [policy, outcomes, verifications, detail] = await Promise.all([
      repository.getActiveWorkflowPolicy(input.organizationId),
      repository.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, workOrder.id),
      repository.listWorkOrderVerifications(input.organizationId, workOrder.id),
      repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
    ]);
    const visitIds = [...new Set(outcomes.map((record) => record.visitId))];
    const visits = await Promise.all(visitIds.map((visitId) => repository.getVisit(input.organizationId, visitId)));
    automaticClosure = evaluateWorkOrderClosureEligibility({
      mode: "automatic",
      workOrder,
      policy,
      outcomes,
      verifications,
      tasks: projected,
      visits: [...visits, ...(detail?.visits.some((visit) => visit.status === "active") ? [{ status: "active" }] : [])],
      openFollowUpIds: new Set(detail?.followUps.filter((followUp) => followUp.status === "open").map((followUp) => followUp.id) ?? []),
    });
  }
  const autoClosed = Boolean(automaticClosure?.eligible);
  if (!autoClosed && !projected.some((candidate) => isOpenWorkflowTask(candidate) && candidate.requiredForProgress)) {
    throw new OpsDomainError("CONFLICT", "A nonterminal work order must retain a required open workflow task; create its replacement atomically");
  }
  const openClosureTasks = autoClosed ? projected.filter((candidate) => isOpenWorkflowTask(candidate) && isCloseVerifiedWorkTask(candidate)) : [];
  const finalTasks = autoClosed
    ? projected.map((candidate) => openClosureTasks.some((closureTask) => closureTask.id === candidate.id)
        ? completedTask(candidate, input.actor, now, "Automatically closed after the final required operational obligation was completed")
        : candidate)
    : projected;
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    ...(outcome === "completed"
      ? buildCompleteWorkflowTaskStatements({ task, actor: input.actor, occurredAt: now, ids, resolutionNote: note })
      : buildCancelWorkflowTaskStatements({ task, actor: input.actor, occurredAt: now, ids, resolutionNote: note })),
    ...(replacementTask ? buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }) : []),
    ...openClosureTasks.flatMap((closureTask) => buildCompleteWorkflowTaskStatements({
      task: closureTask,
      actor: input.actor,
      occurredAt: now,
      ids,
      resolutionNote: "Automatically closed after the final required operational obligation was completed",
    })),
    ...(autoClosed
      ? [{
          sql: "UPDATE ops_work_orders SET status = ?, closed_at = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status = ?",
          params: ["closed", now, "No active owner", "No further operational action", null, null, input.organizationId, workOrder.id, "resolved"],
        } satisfies OpsStatement]
      : [buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, finalTasks)]),
    ...(autoClosed ? auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "work_order",
      aggregateId: workOrder.id,
      eventType: "work_order.auto_closed_after_operational_task",
      actor: input.actor,
      occurredAt: now,
      payload: {
        triggeringWorkflowTaskId: task.id,
        completedClosureTaskIds: openClosureTasks.map((candidate) => candidate.id),
        workflowPolicyId: automaticClosure?.policyId,
        workflowPolicyVersion: automaticClosure?.policyVersion,
        previousStatus: workOrder.status,
        status: "closed",
      },
      ids,
    }) : []),
  ] });
  return { ...resolved, replacementTask, autoClosed };
}

export function completeWorkflowTask(svc: OpsCommandServices, input: ResolveWorkflowTaskInput) {
  return resolveWorkflowTask(svc, input, "completed");
}

export function cancelWorkflowTask(svc: OpsCommandServices, input: ResolveWorkflowTaskInput) {
  return resolveWorkflowTask(svc, input, "cancelled");
}

async function validatePauseOwner(repository: OpsRepository, organizationId: OpsId, ownerType: WorkflowTaskSlaOwnerType, ownerId: OpsId | undefined) {
  if (!pauseOwnerTypes.has(ownerType)) throw new OpsDomainError("VALIDATION", "SLA pause owner type is invalid");
  if (["membership", "team", "vendor", "store"].includes(ownerType) && !ownerId) throw new OpsDomainError("VALIDATION", "SLA pause owner id is required");
  if (ownerType === "membership" && !(await repository.getMembership(organizationId, ownerId!))) throw new OpsDomainError("NOT_FOUND", "SLA pause owner membership not found in this organization");
  if (ownerType === "vendor" && !(await repository.getVendor(organizationId, ownerId!))) throw new OpsDomainError("NOT_FOUND", "SLA pause owner vendor not found in this organization");
  if (ownerType === "store" && !(await repository.getStore(organizationId, ownerId!))) throw new OpsDomainError("NOT_FOUND", "SLA pause owner store not found in this organization");
}

export interface PauseWorkflowTaskSlaInput extends WorkflowTaskActionInput {
  reasonCode: WorkflowTaskSlaPauseReason;
  reasonDetail: string;
  ownerType: WorkflowTaskSlaOwnerType;
  ownerId?: OpsId;
  ownerName: string;
  affectedClocks: WorkflowTaskSlaClock[];
  expectedResumeAt?: IsoDateTime;
}

export async function pauseWorkflowTaskSla(svc: OpsCommandServices, input: PauseWorkflowTaskSlaInput): Promise<WorkflowTaskSlaPause> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const { task, workOrder } = await loadOpenTask(repository, input.organizationId, input.workflowTaskId);
  if (await repository.getActiveWorkflowTaskSlaPause(input.organizationId, task.id)) throw new OpsDomainError("CONFLICT", "Workflow task already has an active SLA pause");
  if (!pauseReasons.has(input.reasonCode)) throw new OpsDomainError("VALIDATION", "SLA pause reason is invalid");
  await validatePauseOwner(repository, input.organizationId, input.ownerType, input.ownerId);
  const affectedClocks = [...new Set(input.affectedClocks)];
  if (!affectedClocks.length || affectedClocks.some((clock) => !slaClocks.has(clock))) throw new OpsDomainError("VALIDATION", "At least one valid affected SLA clock is required");
  const now = clock.now();
  if (input.expectedResumeAt) {
    assertInstant(input.expectedResumeAt, "Expected SLA resume time");
    if (Date.parse(input.expectedResumeAt) <= Date.parse(now)) throw new OpsDomainError("VALIDATION", "Expected SLA resume time must be in the future");
  }
  const pause: WorkflowTaskSlaPause = {
    id: ids.next("workflow-task-sla-pause"), organizationId: input.organizationId, workflowTaskId: task.id,
    workOrderId: workOrder.id, reasonCode: input.reasonCode, reasonDetail: required(input.reasonDetail, "SLA pause reason detail"),
    ownerType: input.ownerType, ownerId: input.ownerId, ownerName: required(input.ownerName, "SLA pause owner name"),
    affectedClocks, expectedResumeAt: input.expectedResumeAt, pausedByActorType: input.actor.actorType,
    pausedByActorId: input.actor.actorId, pausedByActorName: input.actor.actorName, pausedAt: now,
  };
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    insert("ops_workflow_task_sla_pauses", { id: pause.id, organization_id: pause.organizationId, workflow_task_id: pause.workflowTaskId, work_order_id: pause.workOrderId, reason_code: pause.reasonCode, reason_detail: pause.reasonDetail, owner_type: pause.ownerType, owner_id: pause.ownerId, owner_name: pause.ownerName, affected_clocks_json: JSON.stringify(pause.affectedClocks), expected_resume_at: pause.expectedResumeAt, paused_by_actor_type: pause.pausedByActorType, paused_by_actor_id: pause.pausedByActorId, paused_by_actor_name: pause.pausedByActorName, paused_at: pause.pausedAt }),
    ...auditAndOutbox({ organizationId: pause.organizationId, aggregateId: task.id, eventType: "workflow_task.sla_paused", actor: input.actor, occurredAt: now, payload: { pauseId: pause.id, workOrderId: pause.workOrderId, reasonCode: pause.reasonCode, reasonDetail: pause.reasonDetail, ownerType: pause.ownerType, ownerId: pause.ownerId, ownerName: pause.ownerName, affectedClocks, expectedResumeAt: pause.expectedResumeAt }, ids }),
  ] });
  return pause;
}

export const pauseWorkflowTask = pauseWorkflowTaskSla;

export interface ResumeWorkflowTaskSlaInput extends WorkflowTaskActionInput { pauseId?: OpsId; note?: string }

export async function resumeWorkflowTaskSla(svc: OpsCommandServices, input: ResumeWorkflowTaskSlaInput): Promise<WorkflowTaskSlaResume> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const { task, workOrder } = await loadOpenTask(repository, input.organizationId, input.workflowTaskId);
  const pause = await repository.getActiveWorkflowTaskSlaPause(input.organizationId, task.id);
  if (!pause) throw new OpsDomainError("CONFLICT", "Workflow task does not have an active SLA pause");
  if (input.pauseId && input.pauseId !== pause.id) throw new OpsDomainError("CONFLICT", "SLA pause changed; refresh before resuming it");
  const now = clock.now();
  if (Date.parse(now) < Date.parse(pause.pausedAt)) throw new OpsDomainError("CONFLICT", "SLA pause cannot resume before it began");
  const resume: WorkflowTaskSlaResume = {
    id: ids.next("workflow-task-sla-resume"), organizationId: input.organizationId, workflowTaskId: task.id,
    workOrderId: workOrder.id, pauseId: pause.id, resumedByActorType: input.actor.actorType,
    resumedByActorId: input.actor.actorId, resumedByActorName: input.actor.actorName, resumedAt: now,
    note: optionalClean(input.note),
  };
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    insert("ops_workflow_task_sla_resumes", { id: resume.id, organization_id: resume.organizationId, workflow_task_id: resume.workflowTaskId, work_order_id: resume.workOrderId, pause_id: resume.pauseId, resumed_by_actor_type: resume.resumedByActorType, resumed_by_actor_id: resume.resumedByActorId, resumed_by_actor_name: resume.resumedByActorName, resumed_at: resume.resumedAt, note: resume.note }),
    ...auditAndOutbox({ organizationId: resume.organizationId, aggregateId: task.id, eventType: "workflow_task.sla_resumed", actor: input.actor, occurredAt: now, payload: { resumeId: resume.id, pauseId: pause.id, workOrderId: resume.workOrderId, affectedClocks: pause.affectedClocks, note: resume.note }, ids }),
  ] });
  return resume;
}

export const resumeWorkflowTask = resumeWorkflowTaskSla;

export interface WorkflowTaskCommandIdempotency {
  key: string;
  command: "workflow_task.escalate";
  requestHash: string;
  expiresAt: IsoDateTime;
}

function idempotencyStatement(organizationId: OpsId, taskId: OpsId, now: IsoDateTime, input: WorkflowTaskCommandIdempotency): OpsStatement {
  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(input.key) || !/^[a-f0-9]{64}$/i.test(input.requestHash) || input.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Workflow task idempotency metadata is invalid");
  return insert("ops_idempotency_keys", { organization_id: organizationId, key: input.key, command: input.command, result_id: taskId, request_hash: input.requestHash.toLowerCase(), created_at: now, expires_at: input.expiresAt });
}

export interface EscalateWorkflowTaskInput extends WorkflowTaskActionInput {
  escalationDestination: string;
  reason: string;
  escalationLevel?: number;
  /** Compatibility alias. */
  level?: number;
  idempotency?: WorkflowTaskCommandIdempotency;
}

export async function escalateWorkflowTask(svc: OpsCommandServices, input: EscalateWorkflowTaskInput): Promise<WorkflowTask> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (input.idempotency) {
    const prior = await repository.getIdempotencyKey(input.organizationId, input.idempotency.key);
    if (prior) {
      if (prior.command !== input.idempotency.command || prior.requestHash !== input.idempotency.requestHash.toLowerCase()) throw new OpsDomainError("CONFLICT", "Idempotency key was already used for another workflow task escalation");
      const replay = await repository.getWorkflowTask(input.organizationId, prior.resultId);
      if (!replay) throw new OpsDomainError("CONFLICT", "Idempotent workflow task result is no longer available");
      return replay;
    }
  }
  const { task, workOrder } = await loadOpenTask(repository, input.organizationId, input.workflowTaskId);
  const destination = required(input.escalationDestination, "Escalation destination");
  const reason = required(input.reason, "Escalation reason");
  const explicitLevel = input.escalationLevel ?? input.level;
  const targetLevel = explicitLevel ?? task.escalationLevel + 1;
  if (!Number.isInteger(targetLevel) || targetLevel < 1) throw new OpsDomainError("VALIDATION", "Escalation level must be a positive integer");
  if (targetLevel === task.escalationLevel && destination === task.escalationDestination) return task;
  if (explicitLevel === undefined && task.escalationLevel > 0 && destination === task.escalationDestination) return task;
  if (targetLevel !== task.escalationLevel + 1) throw new OpsDomainError("CONFLICT", "Workflow task escalations must advance exactly one level");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const escalated: WorkflowTask = { ...task, escalationDestination: destination, escalationLevel: targetLevel };
  const projected = tasks.map((candidate) => candidate.id === task.id ? escalated : candidate);
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    ...(input.idempotency ? [idempotencyStatement(input.organizationId, task.id, now, input.idempotency)] : []),
    workflowTaskUpdateStatement({ organizationId: input.organizationId, workflowTaskId: task.id, patch: { escalationDestination: destination, escalationLevel: targetLevel } }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateId: task.id, eventType: "workflow_task.escalated", actor: input.actor, occurredAt: now, payload: { workOrderId: task.workOrderId, previousLevel: task.escalationLevel, escalationLevel: targetLevel, previousDestination: task.escalationDestination, escalationDestination: destination, reason }, ids }),
    buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, projected),
  ] });
  return escalated;
}

export type WorkflowTaskActorFields = {
  actorType: ActorType;
  actorId?: OpsId;
  actorName: string;
};
