import { atomicWorkOrderMutation, persistedWorkOrderVersion } from "./concurrency";
import { OpsDomainError } from "./errors";
import type { OpsCommandServices, OpsIdSource } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
  isOpenWorkflowTask,
} from "./workflow-task-commands";
import type {
  ActorContext,
  IsoDateTime,
  OpsId,
  OrganizationRole,
  SiteVisitWorkOrder,
  SiteVisitWorkOrderOutcome,
  WorkOrder,
  WorkOrderVerification,
  WorkOrderVerificationDecision,
  WorkflowTask,
} from "./types";

export type { WorkOrderVerificationDecision } from "./types";
export type WorkOrderVerificationRecord = WorkOrderVerification;

const systemClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const decisionRoles = new Set<OrganizationRole>([
  "facilities_admin",
  "regional_manager",
  "store_manager",
]);
const closureRoles = new Set<OrganizationRole>(["facilities_admin", "regional_manager"]);
const reviewableOutcomes = new Set<SiteVisitWorkOrderOutcome>(["completed", "no_issue_found"]);
const openTaskStatuses = new Set<WorkflowTask["status"]>(["open", "in_progress"]);

export const CLOSE_VERIFIED_WORK_TASK_TITLE = "Close verified work";
export const RETURN_REJECTED_WORK_TASK_TITLE = "Coordinate return work after rejected verification";

function services(input: OpsCommandServices) {
  return {
    repository: input.repository,
    clock: input.clock ?? systemClock,
    ids: input.ids ?? randomIds,
  };
}

function clean(value: string | undefined) {
  const candidate = value?.trim();
  return candidate || undefined;
}

function addHours(value: IsoDateTime, hours: number): IsoDateTime {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1_000).toISOString();
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([column]) => column).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  aggregateType?: string;
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: OpsIdSource;
}): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"),
      organization_id: input.organizationId,
      aggregate_type: input.aggregateType ?? "work_order",
      aggregate_id: input.aggregateId,
      event_type: input.eventType,
      actor_type: input.actor.actorType,
      actor_id: input.actor.actorId,
      actor_name: input.actor.actorName,
      occurred_at: input.occurredAt,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"),
      organization_id: input.organizationId,
      topic: `ops.${input.eventType}`,
      aggregate_type: input.aggregateType ?? "work_order",
      aggregate_id: input.aggregateId,
      payload_json: payloadJson,
      status: "pending",
      available_at: input.occurredAt,
      created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

function latestOutcome(records: readonly SiteVisitWorkOrder[]) {
  const currentVisitWork = [...records].sort((left, right) => (
    right.linkedAt.localeCompare(left.linkedAt)
    || (right.outcomeRecordedAt ?? "").localeCompare(left.outcomeRecordedAt ?? "")
    || right.id.localeCompare(left.id)
  ))[0];
  return currentVisitWork?.outcome && currentVisitWork.outcomeRecordedAt ? currentVisitWork : undefined;
}

function latestVerification(records: readonly WorkOrderVerificationRecord[]) {
  return [...records].sort((left, right) => (
    right.cycle - left.cycle
    || right.decidedAt.localeCompare(left.decidedAt)
    || right.id.localeCompare(left.id)
  ))[0];
}

function completedTask(
  task: WorkflowTask,
  actor: ActorContext,
  occurredAt: IsoDateTime,
  resolutionNote: string,
): WorkflowTask {
  return {
    ...task,
    status: "completed",
    completedByActorType: actor.actorType,
    completedByActorId: actor.actorId,
    completedByActorName: actor.actorName,
    completedAt: occurredAt,
    resolutionNote,
  };
}

async function assertDecisionMembership(
  repository: OpsRepository,
  organizationId: OpsId,
  actor: ActorContext,
) {
  if (actor.organizationId !== organizationId) {
    throw new OpsDomainError("FORBIDDEN", "Actor organization does not match verification organization");
  }
  if (actor.actorType !== "user" || !actor.actorId) {
    throw new OpsDomainError("FORBIDDEN", "An active operator membership must record verification");
  }
  const membership = await repository.getMembership(organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || !decisionRoles.has(membership.role)) {
    throw new OpsDomainError("FORBIDDEN", "This membership cannot verify or reject store repair evidence");
  }
  return membership;
}

export interface RecordWorkOrderVerificationInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  expectedWorkOrderVersion: number;
  expectedSiteVisitWorkOrderId: OpsId;
  expectedOutcomeRecordedAt: IsoDateTime;
  decision: WorkOrderVerificationDecision;
  /** Optional, explicit manager attestation; never inferred from checkout. */
  avoidedSeparateTripConfirmed?: boolean;
  reason?: string;
  actor: ActorContext;
}

/**
 * Accepts or rejects only the latest immutable per-work-order checkout result.
 * It never rewrites visit evidence and it never closes work automatically.
 */
export async function recordWorkOrderVerification(
  svc: OpsCommandServices,
  input: RecordWorkOrderVerificationInput,
): Promise<WorkOrderVerificationRecord> {
  const { repository, clock, ids } = services(svc);
  const membership = await assertDecisionMembership(repository, input.organizationId, input.actor);
  if (!Number.isInteger(input.expectedWorkOrderVersion) || input.expectedWorkOrderVersion < 0) {
    throw new OpsDomainError("VALIDATION", "Expected work-order version is invalid");
  }
  if (input.decision !== "verified" && input.decision !== "rejected") {
    throw new OpsDomainError("VALIDATION", "Verification decision is invalid");
  }
  const reason = clean(input.reason);
  if (input.decision === "rejected" && !reason) {
    throw new OpsDomainError("VALIDATION", "A rejection reason is required");
  }

  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (workOrder.status !== "completed_pending_review") {
    throw new OpsDomainError("CONFLICT", "Only work awaiting internal verification can receive this decision");
  }
  if (persistedWorkOrderVersion(workOrder) !== input.expectedWorkOrderVersion) {
    throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before recording verification");
  }

  const [outcomes, priorVerifications, tasks] = await Promise.all([
    repository.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, workOrder.id),
    repository.listWorkOrderVerifications(input.organizationId, workOrder.id),
    repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id),
  ]);
  const outcome = latestOutcome(outcomes);
  if (
    !outcome
    || outcome.id !== input.expectedSiteVisitWorkOrderId
    || outcome.outcomeRecordedAt !== input.expectedOutcomeRecordedAt
  ) {
    throw new OpsDomainError("CONFLICT", "The current technician outcome changed. Refresh before recording verification");
  }
  if (!outcome.outcome || !reviewableOutcomes.has(outcome.outcome)) {
    throw new OpsDomainError("CONFLICT", "The current technician outcome requires follow-up instead of verification");
  }
  const [visitWork, plannedRouteStop] = outcome.selectionSource === "held_work"
    ? await Promise.all([
        repository.listSiteVisitWorkOrders(input.organizationId, outcome.visitId),
        repository.getRouteStopForVisit(input.organizationId, outcome.visitId),
      ])
    : [[], undefined];
  const mayConfirmAvoidedSeparateTrip = outcome.selectionSource === "held_work" && (
    Boolean(plannedRouteStop)
    || visitWork.some((link) => link.selectionSource === "assigned_work" || link.selectionSource === "service_run")
  );
  if (input.avoidedSeparateTripConfirmed && input.decision !== "verified") {
    throw new OpsDomainError("VALIDATION", "An avoided-trip confirmation can accompany only an accepted verification");
  }
  if (input.avoidedSeparateTripConfirmed && !mayConfirmAvoidedSeparateTrip) {
    throw new OpsDomainError("VALIDATION", "This visit was not already planned, so a separate avoided trip cannot be verified");
  }
  if (priorVerifications.some((verification) => verification.siteVisitWorkOrderId === outcome.id)) {
    throw new OpsDomainError("CONFLICT", "This technician outcome already has an immutable verification decision");
  }

  const verifyTask = [...tasks]
    .filter((task) => (
      task.taskType === "verify_repair"
      && isOpenWorkflowTask(task)
      && task.createdAt >= outcome.outcomeRecordedAt!
    ))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0];
  if (!verifyTask) {
    throw new OpsDomainError("CONFLICT", "The current repair-verification obligation is missing or already complete");
  }
  const sourceFollowUp = verifyTask.sourceFollowUpId
    ? await repository.getFollowUp(input.organizationId, verifyTask.sourceFollowUpId)
    : undefined;
  if (verifyTask.sourceFollowUpId && (!sourceFollowUp || sourceFollowUp.workOrderId !== workOrder.id)) {
    throw new OpsDomainError("CONFLICT", "The repair-verification task has an invalid source follow-up");
  }

  const now = clock.now();
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) < Date.parse(outcome.outcomeRecordedAt!)) {
    throw new OpsDomainError("VALIDATION", "Verification time cannot precede the recorded technician outcome");
  }
  const cycle = priorVerifications.reduce((maximum, verification) => Math.max(maximum, verification.cycle), 0) + 1;
  const verification: WorkOrderVerificationRecord = {
    id: ids.next("work-order-verification"),
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    siteVisitWorkOrderId: outcome.id,
    outcome: outcome.outcome,
    outcomeRecordedAt: outcome.outcomeRecordedAt!,
    cycle,
    decision: input.decision,
    reason,
    decidedByMembershipId: membership.id,
    decidedByName: input.actor.actorName,
    decidedAt: now,
  };
  const resolutionNote = input.decision === "verified"
    ? reason ?? `Accepted ${outcome.outcome} outcome from visit work ${outcome.id}`
    : `Rejected ${outcome.outcome} outcome: ${reason}`;
  const resolvedVerifyTask = completedTask(verifyTask, input.actor, now, resolutionNote);
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"),
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    draft: input.decision === "verified"
      ? {
          taskType: "close_verified_work" as WorkflowTask["taskType"],
          title: CLOSE_VERIFIED_WORK_TASK_TITLE,
          reason: `The latest repair outcome for ${workOrder.number} has accepted internal verification`,
          assigneeType: "role",
          assigneeRole: "facilities_admin",
          assigneeName: "Facilities coordinator",
          priority: workOrder.priority === "emergency" ? "critical" : workOrder.priority === "urgent" ? "high" : "normal",
          blocking: true,
          requiredForProgress: true,
          dueAt: addHours(now, 24),
          applicableSlaClock: "verification",
          completionCriteria: "Close the resolved work order after confirming no active visit, open follow-up, or other required task remains",
          escalationDestination: "Facilities director",
        }
      : {
          taskType: "schedule_return_visit",
          title: RETURN_REJECTED_WORK_TASK_TITLE,
          reason: `Internal verification rejected the latest repair outcome for ${workOrder.number}`,
          assigneeType: "role",
          assigneeRole: "facilities_admin",
          assigneeName: "Facilities coordinator",
          priority: workOrder.priority === "emergency" ? "critical" : "high",
          blocking: true,
          requiredForProgress: true,
          dueAt: addHours(now, workOrder.priority === "emergency" ? 1 : 4),
          applicableSlaClock: "operational_restoration",
          completionCriteria: "Coordinate and observe return work, then record a new per-work-order visit outcome",
          escalationDestination: "Facilities director",
        },
    actor: input.actor,
    createdAt: now,
  });
  const projectedTasks = tasks
    .map((task) => task.id === verifyTask.id ? resolvedVerifyTask : task)
    .concat(replacementTask);
  const nextStatus = input.decision === "verified" ? "resolved" : "in_progress";

  const statements: OpsStatement[] = [
    insert("ops_work_order_verifications", {
      id: verification.id,
      organization_id: verification.organizationId,
      work_order_id: verification.workOrderId,
      site_visit_work_order_id: verification.siteVisitWorkOrderId,
      outcome: verification.outcome,
      outcome_recorded_at: verification.outcomeRecordedAt,
      cycle: verification.cycle,
      decision: verification.decision,
      reason: verification.reason,
      decided_by_membership_id: verification.decidedByMembershipId,
      decided_by_name: verification.decidedByName,
      decided_at: verification.decidedAt,
    }),
    {
      sql: "UPDATE ops_work_orders SET status = ?, resolved_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: [
        nextStatus,
        input.decision === "verified" ? now : null,
        input.organizationId,
        workOrder.id,
        "completed_pending_review",
      ],
    },
    ...(sourceFollowUp?.status === "open"
      ? [
          {
            sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
            params: ["completed", now, input.organizationId, sourceFollowUp.id, "open"],
          } satisfies OpsStatement,
          ...auditAndOutbox({
            organizationId: input.organizationId,
            aggregateType: "follow_up",
            aggregateId: sourceFollowUp.id,
            eventType: "follow_up.completed_by_verification",
            actor: input.actor,
            occurredAt: now,
            payload: {
              workOrderId: workOrder.id,
              verificationId: verification.id,
              decision: input.decision,
              resolution: resolutionNote,
            },
            ids,
          }),
        ]
      : []),
    ...buildCompleteWorkflowTaskStatements({
      task: verifyTask,
      actor: input.actor,
      occurredAt: now,
      ids,
      resolutionNote,
    }),
    ...buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }),
    buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, projectedTasks),
    ...(input.avoidedSeparateTripConfirmed
      ? auditAndOutbox({
          organizationId: input.organizationId,
          aggregateId: workOrder.id,
          eventType: "work_order.held_work_avoided_trip_verified",
          actor: input.actor,
          occurredAt: now,
          payload: {
            verificationId: verification.id,
            siteVisitWorkOrderId: outcome.id,
            visitId: outcome.visitId,
            evidenceCategory: "verified_avoided_trip",
            assertionMeaning: "manager_confirmed_this_approved_item_would_otherwise_have_required_a_separate_vendor_trip",
            amountMeaning: "no_dollar_value_inferred",
          },
          ids,
        })
      : []),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateId: workOrder.id,
      eventType: input.decision === "verified" ? "work_order.verified_and_resolved" : "work_order.verification_rejected",
      actor: input.actor,
      occurredAt: now,
      payload: {
        verificationId: verification.id,
        siteVisitWorkOrderId: outcome.id,
        visitId: outcome.visitId,
        outcome: outcome.outcome,
        outcomeRecordedAt: outcome.outcomeRecordedAt,
        cycle,
        decision: input.decision,
        avoidedSeparateTripConfirmed: Boolean(input.avoidedSeparateTripConfirmed),
        reason,
        previousStatus: workOrder.status,
        status: nextStatus,
        nextWorkflowTaskId: replacementTask.id,
      },
      ids,
    }),
  ];
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "This work order or technician outcome changed. Refresh before recording verification.",
  });
  return verification;
}

export function isCloseVerifiedWorkTask(task: WorkflowTask) {
  return (task.taskType as string) === "close_verified_work";
}

/**
 * Evidence gate used by the administrative work-order control command. Only a
 * currently verified outcome may proceed from resolved to closed.
 */
export async function assertWorkOrderReadyForClosure(
  repository: OpsRepository,
  workOrder: WorkOrder,
  actor: ActorContext,
) {
  if (actor.organizationId !== workOrder.organizationId || actor.actorType !== "user" || !actor.actorId) {
    throw new OpsDomainError("FORBIDDEN", "An active operator membership must close resolved work");
  }
  const membership = await repository.getMembership(workOrder.organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || !closureRoles.has(membership.role)) {
    throw new OpsDomainError("FORBIDDEN", "Only facilities or regional management can close resolved work");
  }
  if ((workOrder.status as string) !== "resolved") {
    throw new OpsDomainError("CONFLICT", "Only resolved work can be closed");
  }
  const [outcomes, verifications, tasks, detail] = await Promise.all([
    repository.listSiteVisitWorkOrdersForWorkOrder(workOrder.organizationId, workOrder.id),
    repository.listWorkOrderVerifications(workOrder.organizationId, workOrder.id),
    repository.listWorkflowTasksForWorkOrder(workOrder.organizationId, workOrder.id),
    repository.getWorkOrderDetail({ organizationId: workOrder.organizationId }, workOrder.id),
  ]);
  const outcome = latestOutcome(outcomes);
  const verification = latestVerification(verifications);
  if (
    !outcome
    || !verification
    || verification.decision !== "verified"
    || verification.siteVisitWorkOrderId !== outcome.id
    || verification.outcome !== outcome.outcome
    || verification.outcomeRecordedAt !== outcome.outcomeRecordedAt
  ) {
    throw new OpsDomainError("CONFLICT", "The current technician outcome does not have accepted internal verification");
  }

  const visitIds = [...new Set(outcomes.map((record) => record.visitId))];
  const visits = await Promise.all(visitIds.map((visitId) => repository.getVisit(workOrder.organizationId, visitId)));
  if (visits.some((visit) => visit?.status === "active") || detail?.visits.some((visit) => visit.status === "active")) {
    throw new OpsDomainError("CONFLICT", "Finish the active visit before closing this work order");
  }
  if (detail?.followUps.some((followUp) => followUp.status === "open")) {
    throw new OpsDomainError("CONFLICT", "Complete or cancel open follow-ups before closing this work order");
  }

  const openTasks = tasks.filter((task) => openTaskStatuses.has(task.status));
  const closeTasks = openTasks.filter(isCloseVerifiedWorkTask);
  if (closeTasks.length !== 1) {
    throw new OpsDomainError("CONFLICT", "Exactly one open verified-work closure obligation is required");
  }
  const otherRequiredTasks = openTasks.filter((task) => (
    !isCloseVerifiedWorkTask(task) && (task.blocking || task.requiredForProgress)
  ));
  if (otherRequiredTasks.length) {
    throw new OpsDomainError("CONFLICT", "Complete every other blocking or required task before closing this work order");
  }
}

export function resolvedWorkOrderProjection(
  workOrder: WorkOrder,
  verification: WorkOrderVerificationRecord,
): WorkOrder {
  return {
    ...workOrder,
    status: "resolved",
    version: persistedWorkOrderVersion(workOrder) + 1,
    resolvedAt: verification.decidedAt,
  };
}
