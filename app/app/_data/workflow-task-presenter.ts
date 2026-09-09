import "server-only";

import type {
  OperatorSession,
  SelectOptionViewModel,
  Tone,
  WorkflowTaskItemViewModel,
  WorkflowTaskWorkspaceViewModel,
} from "@/components/ops/data-contract";
import { roleCan } from "@/components/ops/role-policy";
import type {
  OpsFixture,
  WorkflowTask,
  WorkflowTaskSlaPause,
} from "@/lib/ops/types";
import { isDomainManagedReactiveTask, isOpenWorkflowTask } from "@/lib/ops/workflow-task-commands";
import { domainLabel } from "@/lib/product/domain-label";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDateTime } from "@/lib/ops/local-time";

const workflowTaskTypes = [
  "review_issue",
  "approve_quote",
  "vendor_response_required",
  "confirm_store_access",
  "choose_service_provider",
  "schedule_service",
  "record_service_outcome",
  "schedule_return_visit",
  "verify_repair",
  "other",
] as const;

const workflowTaskPriorities = ["critical", "high", "normal", "low"] as const;
const workflowTaskAssigneeTypes = ["user", "team", "vendor", "role"] as const;
const workflowTaskSlaClocks = [
  "intake_review",
  "approval",
  "vendor_response",
  "scheduling",
  "arrival",
  "operational_restoration",
  "completion",
  "verification",
] as const;
const workflowTaskPauseReasons = [
  "awaiting_vendor",
  "awaiting_parts",
  "awaiting_approval",
  "awaiting_store_access",
  "awaiting_customer",
  "weather_or_site_condition",
  "scheduled_future_event",
  "external_dependency",
  "other",
] as const;
const workflowTaskPauseOwnerTypes = [
  "membership",
  "team",
  "vendor",
  "store",
  "external_party",
  "system",
] as const;
const organizationRoles = [
  "executive",
  "facilities_admin",
  "regional_manager",
  "store_manager",
  "store_employee",
  "finance_reviewer",
  "internal_technician",
  "vendor_user",
  "support",
] as const;

const priorityRank: Record<WorkflowTask["priority"], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function options(values: readonly string[]): SelectOptionViewModel[] {
  return values.map((value) => ({ value, label: domainLabel(value) }));
}

function dateTime(value: string | undefined, timeZone: string): string | undefined {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return formatOperationsDateTime(value, timeZone);
}

function taskTone(task: WorkflowTask, asOf: string): Tone {
  if (task.status === "completed") return "positive";
  if (task.status === "cancelled") return "neutral";
  if (task.dueAt && task.dueAt < asOf) return "critical";
  if (task.blocking) return "warning";
  return task.status === "in_progress" ? "info" : "neutral";
}

function pauseModel(
  fixture: OpsFixture,
  task: WorkflowTask,
  pause: WorkflowTaskSlaPause,
  timeZone: string,
) {
  const resume = fixture.workflowTaskSlaResumes.find((candidate) => (
    candidate.organizationId === task.organizationId
    && candidate.workflowTaskId === task.id
    && candidate.pauseId === pause.id
  ));
  return {
    id: pause.id,
    state: resume ? "resumed" as const : "active" as const,
    reasonLabel: domainLabel(pause.reasonCode),
    reasonDetail: pause.reasonDetail,
    ownerLabel: `${pause.ownerName} · ${domainLabel(pause.ownerType)}`,
    affectedClocksLabel: pause.affectedClocks.map((clock) => domainLabel(clock)).join(", "),
    expectedResumeLabel: dateTime(pause.expectedResumeAt, timeZone),
    pausedByLabel: pause.pausedByActorName,
    pausedLabel: dateTime(pause.pausedAt, timeZone) ?? "Time unavailable",
    resumedByLabel: resume?.resumedByActorName,
    resumedLabel: dateTime(resume?.resumedAt, timeZone),
    resumeNote: resume?.note,
  };
}

function taskModel(
  fixture: OpsFixture,
  task: WorkflowTask,
  genericResolutionLeavesRequiredTask = false,
): WorkflowTaskItemViewModel {
  if (!task.workOrderId) throw new Error(`Workflow task ${task.id} is not attached to a work order`);
  const workOrder = fixture.workOrders.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.workOrderId);
  const store = workOrder ? fixture.stores.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === workOrder.storeId) : undefined;
  const timeZone = store?.timeZone
    ?? fixture.organizations.find((organization) => organization.id === task.organizationId)?.timeZone
    ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const pauses = fixture.workflowTaskSlaPauses
    .filter((pause) => (
      pause.organizationId === task.organizationId
      && pause.workflowTaskId === task.id
      && pause.workOrderId === task.workOrderId
    ))
    .sort((left, right) => right.pausedAt.localeCompare(left.pausedAt) || right.id.localeCompare(left.id))
    .map((pause) => pauseModel(fixture, task, pause, timeZone));
  const activePause = pauses.find((pause) => pause.state === "active");
  const terminal = task.status === "completed" || task.status === "cancelled";
  const genericResolutionAvailable = genericResolutionLeavesRequiredTask
    && !isDomainManagedReactiveTask(task);
  const availableActions: WorkflowTaskItemViewModel["availableActions"] = terminal
    ? []
    : activePause
      ? ["resume", "escalate", ...(genericResolutionAvailable ? ["cancel" as const] : [])]
      : [
          ...(task.status === "open" ? ["start" as const] : []),
          ...(genericResolutionAvailable ? ["complete" as const, "cancel" as const] : []),
          "pause" as const,
          "escalate" as const,
        ];

  return {
    id: task.id,
    action: `/api/ops/work-orders/${encodeURIComponent(task.workOrderId)}/tasks/${encodeURIComponent(task.id)}`,
    typeLabel: domainLabel(task.taskType),
    title: task.title,
    reason: task.reason,
    assigneeTypeLabel: domainLabel(task.assigneeType),
    assigneeLabel: task.assigneeName,
    priorityLabel: domainLabel(task.priority),
    status: task.status,
    statusLabel: activePause ? "SLA paused" : domainLabel(task.status),
    statusTone: taskTone(task, fixture.asOf),
    blocking: task.blocking,
    requiredForProgress: task.requiredForProgress,
    dueAt: task.dueAt,
    dueLabel: dateTime(task.dueAt, timeZone) ?? "No SLA deadline",
    noSlaReason: task.noSlaReason,
    slaClockLabel: task.applicableSlaClock ? domainLabel(task.applicableSlaClock) : undefined,
    completionCriteria: task.completionCriteria,
    escalationDestination: task.escalationDestination,
    escalationLevel: task.escalationLevel,
    createdByLabel: task.createdByActorName,
    createdLabel: dateTime(task.createdAt, timeZone) ?? "Time unavailable",
    startedLabel: dateTime(task.startedAt, timeZone),
    completedLabel: dateTime(task.completedAt, timeZone),
    cancelledLabel: dateTime(task.cancelledAt, timeZone),
    resolutionNote: task.resolutionNote,
    activePauseId: activePause?.id,
    pauses,
    availableActions,
  };
}

function emptyWorkspace(permitted: boolean): WorkflowTaskWorkspaceViewModel {
  return {
    permitted,
    permissionMessage: permitted
      ? "You can create and manage accountable tasks for this work order."
      : "Your role can review Workflow Tasks and SLA evidence but cannot change them.",
    createAction: "",
    activeTasks: [],
    history: [],
    taskTypeOptions: options(workflowTaskTypes),
    priorityOptions: options(workflowTaskPriorities),
    assigneeTypeOptions: options(workflowTaskAssigneeTypes),
    memberOptions: [],
    vendorOptions: [],
    roleOptions: options(organizationRoles),
    slaClockOptions: options(workflowTaskSlaClocks),
    pauseReasonOptions: options(workflowTaskPauseReasons),
    pauseOwnerTypeOptions: options(workflowTaskPauseOwnerTypes),
  };
}

export function buildWorkflowTaskWorkspaceModel(
  fixture: OpsFixture,
  session: OperatorSession,
  workOrderId: string,
): WorkflowTaskWorkspaceViewModel {
  const permitted = roleCan(session, "manage_workflow_tasks");
  const workOrder = fixture.workOrders.find((candidate) => (
    candidate.organizationId === session.organizationId && candidate.id === workOrderId
  ));
  if (!workOrder) return emptyWorkspace(false);
  const store = fixture.stores.find((candidate) => (
    candidate.organizationId === session.organizationId && candidate.id === workOrder.storeId
  ));
  const storeInScope = Boolean(
    store
    && (!session.storeIds?.length || session.storeIds.includes(store.id))
    && (!session.regionIds?.length || Boolean(store.regionId && session.regionIds.includes(store.regionId)))
    && !(session.role === "store_manager" && !session.storeIds?.length)
    && !(session.role === "regional" && !session.regionIds?.length)
  );
  if (!storeInScope) return emptyWorkspace(false);

  const workspace = emptyWorkspace(permitted);
  const tasks = fixture.workflowTasks
    .filter((task) => (
      task.organizationId === session.organizationId && task.workOrderId === workOrder.id
    ));
  workspace.createAction = `/api/ops/work-orders/${encodeURIComponent(workOrder.id)}/tasks`;
  const activeTasks = tasks.filter(isOpenWorkflowTask);
  workspace.activeTasks = activeTasks
    .sort((left, right) => (
      Number(right.blocking) - Number(left.blocking)
      || (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")
      || priorityRank[left.priority] - priorityRank[right.priority]
      || left.title.localeCompare(right.title)
    ))
    .map((task) => taskModel(
      fixture,
      task,
      activeTasks.some((candidate) => candidate.id !== task.id && candidate.requiredForProgress),
    ));
  workspace.history = tasks
    .filter((task) => task.status === "completed" || task.status === "cancelled")
    .sort((left, right) => (
      (right.completedAt ?? right.cancelledAt ?? right.createdAt)
        .localeCompare(left.completedAt ?? left.cancelledAt ?? left.createdAt)
      || right.id.localeCompare(left.id)
    ))
    .map((task) => taskModel(fixture, task));
  workspace.memberOptions = fixture.memberships
    .filter((membership) => (
      membership.organizationId === session.organizationId
      && membership.status === "active"
      && membership.id === session.membershipId
    ))
    .map((membership) => {
      const user = fixture.users.find((candidate) => candidate.id === membership.userId);
      return {
        value: membership.id,
        label: user?.displayName ?? membership.id,
        description: domainLabel(membership.role),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
  workspace.vendorOptions = fixture.vendors
    .filter((vendor) => vendor.organizationId === session.organizationId && vendor.status === "approved")
    .map((vendor) => ({ value: vendor.id, label: vendor.name, description: vendor.preferred ? "Preferred vendor" : "Approved vendor" }))
    .sort((left, right) => left.label.localeCompare(right.label));
  return workspace;
}
