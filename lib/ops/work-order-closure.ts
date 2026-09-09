import type { OpsRepository } from "./repository";
import type {
  OpsId,
  OrganizationWorkflowPolicy,
  WorkOrder,
  WorkOrderVerification,
  WorkflowTask,
} from "./types";
import { applicableOutcomeVerification, latestRecordedWorkOutcome } from "./work-order-outcome";

const openTaskStatuses = new Set<WorkflowTask["status"]>(["open", "in_progress"]);
const financialTaskTypes = new Set<WorkflowTask["taskType"]>([
  "resolve_invoice_exception",
  "respond_service_discrepancy",
]);

export type WorkOrderClosureBlocker =
  | "policy_disabled"
  | "policy_not_applicable"
  | "priority_not_routine"
  | "latest_outcome_not_verified"
  | "active_visit"
  | "open_follow_up"
  | "open_operational_task"
  | "closure_task_missing";

export interface WorkOrderClosureEvaluation {
  eligible: boolean;
  blockers: WorkOrderClosureBlocker[];
  policyId?: OpsId;
  policyVersion?: number;
}

export function isCloseVerifiedWorkTask(task: WorkflowTask) {
  return (task.taskType as string) === "close_verified_work";
}

/** Shared operational closure gate. Financial-only tasks intentionally do not block service closure. */
export function evaluateWorkOrderClosureEligibility(input: {
  mode: "automatic" | "manual";
  workOrder: WorkOrder;
  policy?: OrganizationWorkflowPolicy | null;
  outcomes: Awaited<ReturnType<OpsRepository["listSiteVisitWorkOrdersForWorkOrder"]>>;
  verifications: WorkOrderVerification[];
  tasks: WorkflowTask[];
  visits: Array<{ status: string } | null>;
  openFollowUpIds: ReadonlySet<OpsId>;
  verificationOverride?: WorkOrderVerification;
  ignoredTaskIds?: ReadonlySet<OpsId>;
  ignoredFollowUpIds?: ReadonlySet<OpsId>;
}): WorkOrderClosureEvaluation {
  const blockers: WorkOrderClosureBlocker[] = [];
  const latestOutcome = latestRecordedWorkOutcome(input.outcomes);
  const verification = input.verificationOverride ?? applicableOutcomeVerification(input.verifications, latestOutcome);
  if (
    !latestOutcome
    || !verification
    || verification.decision !== "verified"
    || verification.siteVisitWorkOrderId !== latestOutcome.id
    || verification.outcome !== latestOutcome.outcome
    || verification.outcomeRecordedAt !== latestOutcome.outcomeRecordedAt
  ) blockers.push("latest_outcome_not_verified");

  if (input.visits.some((visit) => visit?.status === "active")) blockers.push("active_visit");
  if ([...input.openFollowUpIds].some((id) => !input.ignoredFollowUpIds?.has(id))) blockers.push("open_follow_up");

  const openTasks = input.tasks.filter((task) => openTaskStatuses.has(task.status) && !input.ignoredTaskIds?.has(task.id));
  const otherRequiredTasks = openTasks.filter((task) => (
    !isCloseVerifiedWorkTask(task)
    && !financialTaskTypes.has(task.taskType)
    && (task.blocking || task.requiredForProgress)
  ));
  if (otherRequiredTasks.length) blockers.push("open_operational_task");

  if (input.mode === "manual") {
    if (openTasks.filter(isCloseVerifiedWorkTask).length !== 1) blockers.push("closure_task_missing");
  } else {
    if (!input.policy?.autoCloseRoutineAfterVerification) blockers.push("policy_disabled");
    if (input.workOrder.priority !== "routine") blockers.push("priority_not_routine");
    if (input.policy && !input.policy.appliesToActiveWork && Date.parse(input.workOrder.createdAt) < Date.parse(input.policy.createdAt)) {
      blockers.push("policy_not_applicable");
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    policyId: input.policy?.id,
    policyVersion: input.policy?.version,
  };
}
