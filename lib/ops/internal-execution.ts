import { confirmationWindow } from "./delayed-confirmation";
import type { OpsCommandServices, OpsIdSource } from "./commands";
import { assignWorkOrder } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, WorkOrder, WorkResult, SiteVisitWorkOrder, StoredFile, WorkflowTask } from "./types";
import { OpsDomainError } from "./errors";
import { atomicWorkOrderMutation, persistedWorkOrderVersion } from "./concurrency";
import {
  dispatchIdentity,
  dispatchAccessAssertion,
  internalManagerRoles,
  insertDispatchRecord as insert,
  buildDispatchNotification,
} from "./internal-dispatch";
import { resolveInternalAccountability } from "./internal-accountability";
import { confirmationAssignee } from "./confirmation-policy";
import { assertHeldWorkOutcome } from "./held-work-policy";
import { addCalendarDays } from "./internal-schedule-types";
import { civilDate, exactStoreInstant } from "./dispatch-calendar";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskRecord,
  buildWorkflowTaskProjectionStatement,
  isOpenWorkflowTask,
} from "./workflow-task-commands";

const executionTitles = new Set([
  "Begin internal work",
  "Arrange team pickup",
  "Arrange internal work",
  "Wait for a suitable internal visit",
]);
export function workResultStatement(result: WorkResult): OpsStatement {
  return insert("ops_work_results", {
    id: result.id,
    organization_id: result.organizationId,
    work_order_id: result.workOrderId,
    assignment_id: result.assignmentId,
    site_visit_work_order_id: result.siteVisitWorkOrderId,
    performer_membership_id: result.performerMembershipId,
    performer_name: result.performerName,
    source: result.source,
    outcome: result.outcome,
    outcome_notes: result.outcomeNotes,
    blocker: result.blocker,
    linked_at: result.linkedAt,
    cycle_version: result.cycleVersion,
    outcome_recorded_at: result.outcomeRecordedAt,
    outcome_recorded_by_actor_type: result.outcomeRecordedByActorType,
    outcome_recorded_by_actor_id: result.outcomeRecordedByActorId,
    outcome_recorded_by_actor_name: result.outcomeRecordedByActorName,
    reported_performed_at: result.reportedPerformedAt,
    supersedes_result_id: result.supersedesResultId,
    correction_reason: result.correctionReason,
    follow_up_id: result.followUpId,
  });
}

export function resultAudit(
  work: WorkOrder,
  actor: ActorContext,
  now: string,
  ids: OpsIdSource,
  event: string,
  payload: unknown,
  availableAt = now,
): OpsStatement[] {
  const payloadJson = JSON.stringify(payload);
  return [
    insert("ops_audit_events", {
      id: ids.next("audit"),
      organization_id: work.organizationId,
      aggregate_type: "work_order",
      aggregate_id: work.id,
      event_type: event,
      actor_type: actor.actorType,
      actor_id: actor.actorId,
      actor_name: actor.actorName,
      occurred_at: now,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: ids.next("outbox"),
      organization_id: work.organizationId,
      aggregate_type: "work_order",
      aggregate_id: work.id,
      topic: `ops.${event}`,
      payload_json: payloadJson,
      status: "pending",
      available_at: availableAt,
      created_at: now,
      attempt_count: 0,
    }),
  ];
}

/**
 * Follow-up reviews are due at 5 PM store time on the next weekday, never in
 * the middle of the night just because the report came in late.
 */
async function followUpDueAt(repository: OpsRepository, work: WorkOrder, now: string) {
  const [store, org] = await Promise.all([
    repository.getStore(work.organizationId, work.storeId),
    repository.getOrganization(work.organizationId),
  ]);
  const zone = store?.timeZone ?? org?.timeZone;
  if (!zone) return new Date(Date.parse(now) + 24 * 3600000).toISOString();
  let day = addCalendarDays(civilDate(now, zone), 1);
  while ([0, 6].includes(new Date(day + "T12:00:00Z").getUTCDay())) day = addCalendarDays(day, 1);
  return exactStoreInstant(day + "T17:00", zone, "earlier");
}

/** The deadline the job had before its latest blocker, so a delay never makes the repair due sooner. */
function repairDeadlineBefore(tasks: readonly WorkflowTask[], blockedAt: string, fallback?: string) {
  const execution = tasks
    .filter(
      task =>
        !task.sourceFollowUpId &&
        (executionTitles.has(task.title) || task.taskType === "record_service_outcome") &&
        task.createdAt <= blockedAt &&
        task.dueAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return execution?.dueAt ?? fallback;
}

/** Same consequences for internal checkout and a truthful report without a visit. */
export async function buildInternalResultStatements(
  repository: OpsRepository,
  input: {
    work: WorkOrder;
    actor: ActorContext;
    now: string;
    ids: OpsIdSource;
    outcome: WorkResult["outcome"];
    notes?: string;
    blocker?: WorkResult["blocker"];
    source: WorkResult["source"];
    performerMembershipId?: string;
    performerName: string;
    link?: SiteVisitWorkOrder;
    reportedPerformedAt?: string;
    supersedesResultId?: string;
    correctionReason?: string;
    files?: StoredFile[];
  },
) {
  const { work, actor, now, ids } = input;
  const inspection = await repository.inspectionForWork(work.organizationId, work.id);
  if (inspection?.workOrderId === work.id)
    throw new OpsDomainError("CONFLICT", "Use the inspection checklist to record this inspection's result.");
  const [tasks, assignment, results, hold] = await Promise.all([
    repository.listWorkflowTasksForWorkOrder(work.organizationId, work.id),
    repository.getActiveAssignment(work.organizationId, work.id),
    repository.listWorkResults(work.organizationId, work.id),
    repository.getWorkOrderVisitHold(work.organizationId, work.id),
  ]);
  if (hold && (!["released", "cancelled", "completed"].includes(hold.status) || input.link?.workOrderHoldId === hold.id))
    assertHeldWorkOutcome(hold.posture, input.outcome);
  const previousResult = input.supersedesResultId ? results.find(result => result.id === input.supersedesResultId) : results[0];
  const amended = input.source === "correction" ? previousResult : undefined;
  if (input.source === "correction" && !amended)
    throw new OpsDomainError("CONFLICT", "The original work result is unavailable. Refresh before correcting it.");
  const owner = await resolveInternalAccountability(repository, work);
  const successful = ["completed", "no_issue_found"].includes(input.outcome);
  if (
    ![
      "completed",
      "no_issue_found",
      "return_visit_required",
      "parts_required",
      "quote_required",
      "diagnosis_only",
      "not_addressed",
      "temporary_repair",
      "store_access_unavailable",
      "work_not_authorized",
    ].includes(input.outcome) ||
    (input.blocker &&
      { parts: "parts_required", help: "diagnosis_only", vendor: "quote_required", cannot_today: "not_addressed" }[input.blocker] !==
        input.outcome)
  )
    throw new OpsDomainError("VALIDATION", "Choose a result that matches the problem selected.");
  if (!successful && !input.notes?.trim()) throw new OpsDomainError("VALIDATION", "Explain what remains to be done.");
  const pending = tasks.filter(isOpenWorkflowTask);
  const superseded = pending.filter(task =>
    task.sourceFollowUpId
      ? task.taskType === "schedule_return_visit" && task.sourceFollowUpId === previousResult?.followUpId
      : executionTitles.has(task.title) || ["record_service_outcome", "verify_repair", "close_verified_work"].includes(task.taskType),
  );
  const previousFollowUps = new Set(superseded.flatMap(task => (task.sourceFollowUpId ? [task.sourceFollowUpId] : [])));
  const confirmation=successful&&work.requireConfirmation!==false?await confirmationWindow(repository,work,now):undefined;
  const due = confirmation?.dueAt ?? await followUpDueAt(repository, work, now);
  const title = successful
    ? "Confirm work was completed as expected"
    : input.blocker === "parts" || input.outcome === "parts_required"
      ? "Arrange parts and mark the job ready"
      : input.blocker === "vendor" || input.outcome === "quote_required"
        ? "Choose an outside vendor for this job"
        : input.blocker === "help"
          ? "Arrange help for the technician"
          : input.blocker === "cannot_today"
            ? "Review when the technician can return"
            : "Arrange remaining internal work";
  const followUpId = successful ? undefined : ids.next("follow-up");
  const result: WorkResult = {
    id: ids.next("work-result"),
    organizationId: work.organizationId,
    workOrderId: work.id,
    assignmentId: amended ? amended.assignmentId : assignment?.id,
    siteVisitWorkOrderId: input.link?.id ?? amended?.siteVisitWorkOrderId,
    linkedAt: amended?.linkedAt ?? input.link?.linkedAt ?? now,
    cycleVersion: persistedWorkOrderVersion(work) + 1,
    performerMembershipId: amended ? amended.performerMembershipId : input.performerMembershipId,
    performerName: input.performerName,
    source: input.source,
    outcome: input.outcome,
    outcomeNotes: input.notes?.trim() || undefined,
    blocker: input.blocker,
    outcomeRecordedAt: now,
    outcomeRecordedByActorType: actor.actorType,
    outcomeRecordedByActorId: actor.actorId,
    outcomeRecordedByActorName: actor.actorName,
    followUpId,
    reportedPerformedAt: amended?.reportedPerformedAt ?? input.reportedPerformedAt,
    supersedesResultId: input.supersedesResultId,
    correctionReason: input.correctionReason,
  };
  const remaining = pending.filter(task => !superseded.includes(task));
  // A result never closes its own job; confirmation or an attributed manager closeout is required.
  const canClose = false;
  const task = canClose
    ? undefined
    : buildWorkflowTaskRecord({
        id: ids.next("workflow-task"),
        organizationId: work.organizationId,
        workOrderId: work.id,
        actor,
        createdAt: now,
        draft: {
          taskType: successful ? (work.requireConfirmation === false ? "close_verified_work" : "verify_repair") : "schedule_return_visit",
          title: successful && work.requireConfirmation === false ? "Manager to review and close with a reason" : title,
          reason: input.notes?.trim() || work.problem,
          ...(successful && work.requireConfirmation !== false ? await confirmationAssignee(repository, work) : owner),
          priority: ["urgent", "emergency"].includes(work.priority) ? "high" : "normal",
          blocking: true,
          requiredForProgress: true,
          dueAt: due,
          applicableSlaClock: successful ? "verification" : "scheduling",
          sourceFollowUpId: followUpId,
          completionCriteria: successful ? "Review the exact recorded result under the job's confirmation policy" : title,
          escalationDestination: owner.escalationDestination,
        },
      });
  if(task&&confirmation)task.availableAt=confirmation.availableAt;
  const statements: OpsStatement[] = [
    workResultStatement(result),
    ...superseded.flatMap(task =>
      buildCompleteWorkflowTaskStatements({ task, actor, occurredAt: now, ids, resolutionNote: "New internal work result recorded" }),
    ),
    ...[...previousFollowUps].map(id => ({
      sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["completed", now, work.organizationId, id, "open"],
    })),
  ];
  if (followUpId)
    statements.push(
      insert("ops_follow_ups", {
        id: followUpId,
        organization_id: work.organizationId,
        work_order_id: work.id,
        source_visit_id: input.link?.visitId,
        accountable_party: owner.assigneeName,
        next_action: title,
        due_at: due,
        escalation_to: owner.escalationDestination,
        status: "open",
        created_at: now,
      }),
    );
  if (task) statements.push(...buildCreateTaskStatements({ task, actor, ids }));
  const status = successful
    ? canClose
      ? "closed"
      : work.requireConfirmation === false
        ? "resolved"
        : "completed_pending_review"
    : input.outcome === "parts_required"
      ? "waiting_on_parts"
      : "in_progress";
  statements.push({
    sql: "UPDATE ops_work_orders SET status = ?, resolved_at = ?, closed_at = ?, accountable_party = ?, next_action = ?, due_at = ? WHERE organization_id = ? AND id = ?",
    params: [
      status,
      canClose ? now : null,
      canClose ? now : null,
      canClose ? "No action required" : (task?.assigneeName ?? owner.assigneeName),
      canClose ? "Work completed; confirmation not required" : (task?.title ?? title),
      canClose ? null : due,
      work.organizationId,
      work.id,
    ],
  });
  // A human-entered estimate survives removing the completed attempt from Plan.
  const priorPlan = work.internalScheduleId ? await repository.getInternalSchedule(work.organizationId,work.internalScheduleId) : null;
  if(work.estimatedMinutes === undefined && priorPlan?.durationMinutes !== undefined) statements.push({sql:"UPDATE ops_work_orders SET estimated_minutes = ? WHERE organization_id = ? AND id = ?",params:[priorPlan.durationMinutes,work.organizationId,work.id]});
  // A result finishes this execution attempt; any return needs an explicit new plan.
  statements.push({
    sql: "UPDATE ops_work_orders SET internal_schedule_id = ? WHERE organization_id = ? AND id = ?",
    params: [null, work.organizationId, work.id],
  });
  if (!canClose)
    statements.push(buildWorkflowTaskProjectionStatement(work.organizationId, work.id, [...remaining, ...(task ? [task] : [])]));
  if (input.link?.workOrderHoldId)
    statements.push({
      sql: "UPDATE ops_work_order_visit_holds SET status = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ?",
      params: [successful ? "completed" : "review_required", now, work.organizationId, input.link.workOrderHoldId],
    });
  else if (hold)
    statements.push({
      sql: "UPDATE ops_work_order_visit_holds SET status = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND work_order_id = ? AND status = ?",
      params: [successful ? "completed" : "review_required", now, work.organizationId, work.id, "active"],
    });
  for (const file of input.files ?? []) {
    if (file.organizationId !== work.organizationId || file.status !== "available")
      throw new OpsDomainError("VALIDATION", "A result attachment is unavailable.");
    statements.push(
      insert("ops_files", {
        id: file.id,
        organization_id: file.organizationId,
        storage_key: file.storageKey,
        sha256: file.sha256,
        original_name: file.originalName,
        content_type: file.contentType,
        byte_length: file.byteLength,
        status: file.status,
        created_at: file.createdAt,
      }),
      insert("ops_entity_files", {
        id: ids.next("entity-file"),
        organization_id: work.organizationId,
        entity_type: "work_order",
        entity_id: work.id,
        file_id: file.id,
        purpose: `work_result:${result.id}`,
        uploaded_by_name: actor.actorName,
        created_at: now,
      }),
    );
  }
  statements.push(
    ...resultAudit(
      work,
      actor,
      now,
      ids,
      input.source === "correction" ? "work_order.service_result_corrected" : "work_order.internal_result_recorded",
      {
        resultId: result.id,
        source: result.source,
        outcome: result.outcome,
        performer: result.performerName,
        followUpId,
        reportedPerformedAt: result.reportedPerformedAt,
        correctionReason: input.correctionReason,
        supersedesResultId: input.supersedesResultId,
        visitId: input.link?.visitId,
        evidenceMeaning: input.link ? "observed_visit_with_reported_result" : "reported_result_without_presence_evidence",
      },
    ),
  );
  if (successful && work.requireConfirmation !== false)
    statements.push(
      ...resultAudit(work, actor, now, ids, "work_order.confirmation_requested", {
        workOrderId: work.id,
        workResultId: result.id,
        availableAt:confirmation?.availableAt,
        dueAt: due,
      },confirmation?.availableAt),
    );
  if (!successful)
    statements.push(
      buildDispatchNotification({
        id: ids.next("outbox"),
        work,
        now,
        recipients: owner.assigneeType === "user" && owner.assigneeId ? [owner.assigneeId] : [],
        notifyCoordinationTeam: owner.assigneeType !== "user",
        headline: title,
        payload: { resultId: result.id, followUpId, assignmentId: assignment?.id },
      }),
    );
  return { statements, result };
}

export interface InternalResultInput {
  organizationId: string;
  workOrderId: string;
  actor: ActorContext;
  expectedVersion: number;
  expectedAssignmentId: string;
  key: string;
  outcome: WorkResult["outcome"];
  notes?: string;
  blocker?: WorkResult["blocker"];
  files?: StoredFile[];
  source?: "phone" | "email" | "in_person";
  performerName?: string;
  reportedPerformedAt?: string;
  exceptionReason?: string;
}
export async function recordInternalWorkResult(svc: OpsCommandServices, input: InternalResultInput) {
  const r = svc.repository,
    now = svc.clock?.now() ?? new Date().toISOString(),
    ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId)
    throw new OpsDomainError("FORBIDDEN", "Use your signed-in maintenance account.");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  const identity = await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, [
    "internal_technician",
    ...internalManagerRoles,
  ]);
  const manager = identity.role !== "internal_technician";
  const hash = await internalResultRequestHash(input);
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.key)) throw new OpsDomainError("VALIDATION", "A valid submission key is required.");
  const key = `internal-result:${input.actor.actorId}:${input.key}`;
  const replay = async () => {
    const receipt = await r.getIdempotencyKey(input.organizationId, key);
    if (!receipt) return;
    if (receipt.requestHash !== hash) throw new OpsDomainError("CONFLICT", "This submission key was already used for different details.");
    return (await r.listWorkResults(input.organizationId, work.id)).find(result => result.id === receipt.resultId);
  };
  const prior = await replay();
  if (prior) return prior;
  const assignment = await r.getActiveAssignment(input.organizationId, work.id);
  if (
    !Number.isInteger(input.expectedVersion) ||
    persistedWorkOrderVersion(work) !== input.expectedVersion ||
    assignment?.id !== input.expectedAssignmentId
  )
    throw new OpsDomainError("CONFLICT", "This job changed. Refresh before saving.");
  if (
    !assignment ||
    assignment.kind !== "internal" ||
    !assignment.internalMembershipId ||
    (!manager && assignment.internalMembershipId !== input.actor.actorId)
  )
    throw new OpsDomainError("FORBIDDEN", "Record results only for your assigned internal work.");
  if (["draft", "awaiting_approval", "closed", "cancelled", "completed_pending_review", "resolved"].includes(work.status))
    throw new OpsDomainError("CONFLICT", "This job is not ready for another work result.");
  if (
    ![
      "completed",
      "no_issue_found",
      "return_visit_required",
      "parts_required",
      "quote_required",
      "diagnosis_only",
      "not_addressed",
    ].includes(input.outcome) ||
    (input.blocker && !["parts", "help", "vendor", "cannot_today"].includes(input.blocker))
  )
    throw new OpsDomainError("VALIDATION", "Choose a work result or problem.");
  if (!["completed", "no_issue_found"].includes(input.outcome) && !input.notes?.trim())
    throw new OpsDomainError("VALIDATION", "Add a short note about what is still needed.");
  if (
    input.blocker &&
    { parts: "parts_required", help: "diagnosis_only", vendor: "quote_required", cannot_today: "not_addressed" }[input.blocker] !==
      input.outcome
  )
    throw new OpsDomainError("VALIDATION", "The result does not match the problem selected.");
  const detail = await r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id);
  if (
    !input.blocker &&
    (await r.listWorkflowTasksForWorkOrder(input.organizationId, work.id)).some(
      task => isOpenWorkflowTask(task) && task.taskType === "schedule_return_visit" && task.sourceFollowUpId,
    )
  )
    throw new OpsDomainError("CONFLICT", "Ask a manager to mark the job ready for return work first.");
  const policy = await r.getActiveWorkflowPolicy(input.organizationId);
  if (!input.blocker && detail?.visits.some(visit => visit.status === "active"))
    throw new OpsDomainError("CONFLICT", "Record this result when checking out of the active visit.");
  if (policy?.internalCheckInRequired && !input.blocker && (!manager || !input.exceptionReason?.trim()))
    throw new OpsDomainError("CONFLICT", "Check in before recording a result, or ask a manager to record an explained exception.");
  if (manager && (!input.source || !["phone", "email", "in_person"].includes(input.source) || !input.performerName?.trim()))
    throw new OpsDomainError("VALIDATION", "Name the reported performer and how you received the result.");
  if (!manager && (input.source || input.performerName || input.reportedPerformedAt || input.exceptionReason))
    throw new OpsDomainError("FORBIDDEN", "Technician reports use your signed-in identity.");
  if (input.reportedPerformedAt && (!Number.isFinite(Date.parse(input.reportedPerformedAt)) || input.reportedPerformedAt > now))
    throw new OpsDomainError("VALIDATION", "Reported work time must be a valid past time.");
  const performerMember = manager ? await r.getMembership(input.organizationId, assignment.internalMembershipId) : undefined;
  const performerUser = performerMember ? await r.getUserInOrganization(input.organizationId, performerMember.userId) : undefined;
  const { statements, result } = await buildInternalResultStatements(r, {
    work,
    actor: { ...input.actor, actorName: identity.name },
    now,
    ids,
    outcome: input.outcome,
    notes: input.notes,
    blocker: input.blocker,
    files: input.files,
    source: manager ? input.source! : "technician_report",
    performerMembershipId:
      manager && input.performerName?.trim() !== performerUser?.displayName ? undefined : assignment.internalMembershipId,
    performerName: manager ? input.performerName!.trim() : identity.name,
    reportedPerformedAt: input.reportedPerformedAt,
  });
  statements.unshift(
    dispatchAccessAssertion(
      input.organizationId,
      input.actor.actorId,
      work.storeId,
      manager ? internalManagerRoles : ["internal_technician"],
      now,
    ),
    insert("ops_idempotency_keys", {
      organization_id: input.organizationId,
      key,
      command: "internal_result.record",
      result_id: result.id,
      request_hash: hash,
      created_at: now,
      expires_at: "9999-12-31T23:59:59.999Z",
    }),
  );
  if (input.exceptionReason)
    statements.push(
      ...resultAudit(work, input.actor, now, ids, "work_order.check_in_exception", { resultId: result.id, reason: input.exceptionReason }),
    );
  try {
    await atomicWorkOrderMutation({ repository: r, workOrder: work, now, statements });
  } catch (error) {
    await dispatchIdentity(
      r,
      input.organizationId,
      input.actor.actorId,
      work.storeId,
      manager ? internalManagerRoles : ["internal_technician"],
    );
    const retry = await replay();
    if (retry) return retry;
    throw error;
  }
  return result;
}

export async function markInternalWorkReady(
  svc: OpsCommandServices,
  input: Pick<
    InternalResultInput,
    "organizationId" | "workOrderId" | "actor" | "expectedVersion" | "expectedAssignmentId" | "key" | "notes"
  >,
) {
  const r = svc.repository,
    now = svc.clock?.now() ?? new Date().toISOString(),
    ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId)
    throw new OpsDomainError("FORBIDDEN", "A manager must review readiness.");
  await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
  if (!input.notes?.trim() || !/^[A-Za-z0-9_-]{8,120}$/.test(input.key))
    throw new OpsDomainError("VALIDATION", "Explain what changed before marking this job ready.");
  const key = `internal-ready:${input.actor.actorId}:${input.key}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const replay = await r.getIdempotencyKey(input.organizationId, key);
  if (replay) {
    if (replay.requestHash !== hash) throw new OpsDomainError("CONFLICT", "Submission details changed.");
    return;
  }
  const assignment = await r.getActiveAssignment(input.organizationId, work.id);
  if (persistedWorkOrderVersion(work) !== input.expectedVersion || assignment?.id !== input.expectedAssignmentId)
    throw new OpsDomainError("CONFLICT", "This job changed. Refresh before saving.");
  if (
    assignment?.kind !== "internal" ||
    !assignment.internalMembershipId ||
    ["closed", "cancelled", "resolved", "completed_pending_review"].includes(work.status)
  )
    throw new OpsDomainError("CONFLICT", "This job is not waiting for internal return work.");
  const results = await r.listWorkResults(input.organizationId, work.id),
    blocked = results[0];
  if (
    !blocked ||
    ["completed", "no_issue_found"].includes(blocked.outcome) ||
    blocked.blocker === "vendor" ||
    blocked.outcome === "quote_required"
  )
    throw new OpsDomainError("CONFLICT", "Review the latest result and vendor routing before marking ready.");
  const detail = await r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id);
  if (detail?.visits.some(v => v.status === "active")) throw new OpsDomainError("CONFLICT", "Finish the active visit first.");
  const tasks = await r.listWorkflowTasksForWorkOrder(input.organizationId, work.id),
    previous = tasks.filter(t => t.sourceFollowUpId === blocked.followUpId && isOpenWorkflowTask(t));
  if (!previous.length) throw new OpsDomainError("CONFLICT", "This blocker has already been reviewed.");
  const readinessHeadline = tasks.some(t => isOpenWorkflowTask(t) && t.sourceFollowUpId && !previous.includes(t))
    ? "Return work reviewed; required actions remain"
    : "Job ready for return work";
  const owner = await resolveInternalAccountability(r, work);
  const poolAssignmentId=ids.next("assignment");
  const repairDue = repairDeadlineBefore(tasks, blocked.outcomeRecordedAt, work.dueAt);
  const task = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"),
    organizationId: input.organizationId,
    workOrderId: work.id,
    actor: input.actor,
    createdAt: now,
    inheritedDueAt: repairDue,
    draft: {
      priority: "normal",
      taskType: "other",
      title: "Arrange team pickup",
      reason: input.notes,
      ...owner,
      dueAt: repairDue ?? new Date(Date.parse(now) + 24 * 3600000).toISOString(),
      applicableSlaClock: "completion",
      completionCriteria: "Record the return work result",
      escalationDestination: work.escalationTo ?? "Facilities leadership",
    },
  });
  const statements: OpsStatement[] = [
    dispatchAccessAssertion(input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles, now),
    {sql:"UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",params:["superseded",input.organizationId,assignment.id]},
    insert("ops_work_order_assignments",{id:poolAssignmentId,organization_id:input.organizationId,work_order_id:work.id,kind:"internal",internal_target:"pool",status:"pending",assigned_at:now,supersedes_assignment_id:assignment.id}),
    {sql:"UPDATE ops_work_orders SET internal_schedule_id = NULL WHERE organization_id = ? AND id = ?",params:[input.organizationId,work.id]},
    insert("ops_idempotency_keys", {
      organization_id: input.organizationId,
      key,
      command: "internal_result.ready",
      result_id: work.id,
      request_hash: hash,
      created_at: now,
      expires_at: "9999-12-31T23:59:59.999Z",
    }),
    ...previous.flatMap(t =>
      buildCompleteWorkflowTaskStatements({ task: t, actor: input.actor, occurredAt: now, ids, resolutionNote: input.notes! }),
    ),
    ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
    {
      sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["approved", input.organizationId, work.id],
    },
    buildWorkflowTaskProjectionStatement(input.organizationId, work.id, [...tasks.filter(t => !previous.includes(t)), task]),
    ...resultAudit(work, input.actor, now, ids, "work_order.internal_work_ready", { resultId: blocked.id, reason: input.notes, previousAssignmentId:assignment.id, assignmentId:poolAssignmentId, internalTarget:"pool" }),
    buildDispatchNotification({
      id: ids.next("outbox"),
      work,
      now,
      recipients: owner.assigneeId?[owner.assigneeId]:[],
      headline: readinessHeadline,
      payload: { assignmentId: poolAssignmentId, previousAssignmentId:assignment.id },
    }),
  ];
  if (blocked.followUpId)
    statements.push({
      sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["completed", now, input.organizationId, blocked.followUpId, "open"],
    });
  try {
    await atomicWorkOrderMutation({ repository: r, workOrder: work, now, statements });
  } catch (error) {
    await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
    const receipt = await r.getIdempotencyKey(input.organizationId, key);
    if (receipt?.requestHash === hash) return;
    throw error;
  }
}

export async function internalResultRequestHash(
  input: Omit<InternalResultInput, "files"> & { files?: Array<Pick<StoredFile, "sha256" | "originalName" | "contentType">> },
) {
  const request = JSON.stringify({
    ...input,
    actor: input.actor.actorId,
    files: input.files?.map(file => ({ sha256: file.sha256, originalName: file.originalName, contentType: file.contentType })),
  });
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request))), b =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Manager selection changes the provider; existing issuance remains a separate authorization. */
export async function handoffInternalWorkToVendor(
  svc: OpsCommandServices,
  input: Pick<InternalResultInput, "organizationId" | "workOrderId" | "actor" | "expectedVersion" | "expectedAssignmentId" | "key"> & {
    vendorId: string;
  },
) {
  const r = svc.repository,
    work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId)
    throw new OpsDomainError("FORBIDDEN", "A manager must choose the outside vendor.");
  await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.key) || !input.vendorId)
    throw new OpsDomainError("VALIDATION", "Choose a vendor and refresh the job if needed.");
  const key = `internal-vendor:${input.actor.actorId}:${input.key}`,
    now = svc.clock?.now() ?? new Date().toISOString();
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...input, actor: input.actor.actorId }))),
    ),
    b => b.toString(16).padStart(2, "0"),
  ).join("");
  const replay = async () => {
    const receipt = await r.getIdempotencyKey(input.organizationId, key);
    if (!receipt) return;
    if (receipt.requestHash !== hash) throw new OpsDomainError("CONFLICT", "The selected vendor changed. Refresh before saving.");
    return r.getAssignment(input.organizationId, receipt.resultId);
  };
  const saved = await replay();
  if (saved) return saved;
  const assignment = await r.getActiveAssignment(input.organizationId, work.id);
  if (
    !Number.isInteger(input.expectedVersion) ||
    persistedWorkOrderVersion(work) !== input.expectedVersion ||
    assignment?.id !== input.expectedAssignmentId
  )
    throw new OpsDomainError("CONFLICT", "This job changed. Refresh before choosing the vendor.");
  const result = (await r.listWorkResults(input.organizationId, work.id))[0];
  if (
    assignment?.kind !== "internal" ||
    !result ||
    result.outcome !== "quote_required" ||
    ["draft", "awaiting_approval", "completed_pending_review", "resolved", "closed", "cancelled"].includes(work.status)
  )
    throw new OpsDomainError("CONFLICT", "Review the internal vendor finding before changing this provider.");
  const inspection = await r.inspectionForWork(input.organizationId, work.id);
  if (inspection?.workOrderId === work.id) throw new OpsDomainError("CONFLICT", "Use the inspection record to arrange inspection work.");
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` },
    assignmentId = ids.next("assignment");
  const guarded = new Proxy(r, {
    get(target, property) {
      if (property === "getWorkOrder")
        return (org: string, id: string) =>
          org === input.organizationId && id === work.id ? Promise.resolve(work) : target.getWorkOrder(org, id);
      if (property === "atomicWrite")
        return (statements: readonly OpsStatement[]) =>
          target.atomicWrite([
            ...statements,
            dispatchAccessAssertion(input.organizationId, input.actor.actorId!, work.storeId, internalManagerRoles, now),
            insert("ops_idempotency_keys", {
              organization_id: input.organizationId,
              key,
              command: "internal_result.vendor",
              result_id: assignmentId,
              request_hash: hash,
              created_at: now,
              expires_at: "9999-12-31T23:59:59.999Z",
            }),
          ]);
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  try {
    return await assignWorkOrder(
      {
        ...svc,
        repository: guarded,
        clock: { now: () => now },
        ids: { next: prefix => (prefix === "assignment" ? assignmentId : ids.next(prefix)) },
      },
      { organizationId: input.organizationId, workOrderId: work.id, kind: "outside_vendor", vendorId: input.vendorId, actor: input.actor },
    );
  } catch (error) {
    await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
    const retry = await replay();
    if (retry) return retry;
    throw error;
  }
}
