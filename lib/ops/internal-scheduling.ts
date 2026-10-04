import { cachedDateTimeFormat } from "./intl-format-cache";
import { OpsDomainError } from "./errors";
import { atomicWorkOrderMutation, persistedWorkOrderVersion } from "./concurrency";
import {
  buildDispatchNotification,
  changeInternalDispatch,
  dispatchAccessAssertion,
  dispatchIdentity,
  internalManagerRoles,
  internalTarget,
  insertDispatchRecord,
  isInternalAssignmentTask,
  resolveDispatchAccountability,
  type InternalTarget,
} from "./internal-dispatch";
import { assertPlanningZone, calendarDate, civilDate, exactStoreInstant, mondayOf, scheduleLabel } from "./dispatch-calendar";
import { addCalendarDays, type InternalSchedule } from "./internal-schedule-types";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
  selectWorkflowTaskProjection,
} from "./workflow-task-commands";
import type { OpsCommandServices } from "./commands";
import type { OpsStatement } from "./repository";
import type { ActorContext, WorkOrderAssignment, WorkflowTask } from "./types";

export interface ScheduleInput {
  organizationId: string;
  workOrderId: string;
  actor: ActorContext;
  expectedVersion: number;
  expectedAssignmentId: string;
  expectedScheduleId: string | null;
  key: string;
  precision: "week" | "day" | "appointment" | "removed";
  date?: string;
  localStart?: string;
  disambiguation?: "earlier" | "later";
  durationMinutes?: number;
  tentative?: boolean;
  reviewReason?: string;
  keepConflicts?: boolean;
  target?: InternalTarget;
  membershipId?: string;
  managerId?: string;
}
async function requestHash(input: unknown) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input))))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
export function internalScheduleStatement(plan: InternalSchedule): OpsStatement {
  const values = Object.fromEntries(
    Object.entries(plan).map(([k, v]) => [k.replace(/[A-Z]/g, c => "_" + c.toLowerCase()), k === "tentative" ? Number(v) : v]),
  );
  return insertDispatchRecord("ops_internal_schedules", values);
}
/** Save is live. Work-order fencing serializes schedule, result and assignment changes together. */
export async function saveInternalSchedule(svc: OpsCommandServices, input: ScheduleInput) {
  const r = svc.repository,
    now = svc.clock?.now() ?? new Date().toISOString(),
    ids = svc.ids ?? { next: (prefix: string) => prefix + "-" + crypto.randomUUID() };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId)
    throw new OpsDomainError("FORBIDDEN", "Sign in to plan internal work.");
  if (
    !/^[A-Za-z0-9_-]{8,120}$/.test(input.key) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    !["week", "day", "appointment", "removed"].includes(input.precision) ||
    (input.disambiguation && !["earlier", "later"].includes(input.disambiguation))
  )
    throw new OpsDomainError("VALIDATION", "Refresh the job and choose a valid schedule.");
  if (
    input.durationMinutes !== undefined &&
    (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440)
  )
    throw new OpsDomainError("VALIDATION", "Enter a repair estimate from 1 to 1,440 minutes, or leave it unknown.");
  if ((input.reviewReason?.length ?? 0) > 1000) throw new OpsDomainError("VALIDATION", "Keep the review reason under 1,000 characters.");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  const identity = await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, [
    "internal_technician",
    ...internalManagerRoles,
  ]);
  const manager = identity.role !== "internal_technician",
    key = "internal-schedule:" + input.actor.actorId + ":" + input.key;
  const hash = await requestHash({ ...input, actor: { id: input.actor.actorId }, reviewReason: input.reviewReason?.trim() ?? "" });
  const replay = async () => {
    const receipt = await r.getIdempotencyKey(input.organizationId, key);
    if (!receipt) return null;
    if (receipt.requestHash !== hash)
      throw new OpsDomainError("CONFLICT", "This retry contains a different schedule. Review your changes.");
    const schedule = await r.getInternalSchedule(input.organizationId, receipt.resultId);
    if (!schedule) throw new OpsDomainError("CONFLICT", "The saved plan is unavailable.");
    return { schedule, version: input.expectedVersion + 1, replayed: true };
  };
  const saved = await replay();
  if (saved) return saved;
  const assignment = await r.getActiveAssignment(input.organizationId, work.id);
  async function changedState() {
    const current = await r.getWorkOrder(input.organizationId, work!.id);
    if (!current) return "This job is no longer available. Refresh the work list.";
    await dispatchIdentity(
      r,
      input.organizationId,
      input.actor.actorId!,
      current.storeId,
      manager ? internalManagerRoles : ["internal_technician"],
    );
    const plan = current.internalScheduleId ? await r.getInternalSchedule(input.organizationId, current.internalScheduleId) : null;
    return `This job or plan changed. Current plan: ${scheduleLabel(plan ?? undefined)}. Next action: ${current.nextAction} (${current.accountableParty}). Refresh and review your proposed schedule.`;
  }
  if (
    persistedWorkOrderVersion(work) !== input.expectedVersion ||
    assignment?.id !== input.expectedAssignmentId ||
    (work.internalScheduleId ?? null) !== input.expectedScheduleId
  )
    throw new OpsDomainError("CONFLICT", await changedState());
  if (
    assignment.kind !== "internal" ||
    ["draft", "awaiting_approval", "completed_pending_review", "resolved", "closed", "cancelled"].includes(work.status)
  )
    throw new OpsDomainError("CONFLICT", "This job is not available for internal scheduling.");
  const [store, org, prior, history, detail, inspection, tasks, appointments] = await Promise.all([
    r.getStore(input.organizationId, work.storeId),
    r.getOrganization(input.organizationId),
    work.internalScheduleId ? r.getInternalSchedule(input.organizationId, work.internalScheduleId) : null,
    r.listInternalSchedules(input.organizationId, work.id),
    r.getWorkOrderDetail({ organizationId: input.organizationId }, work.id),
    r.inspectionForWork(input.organizationId, work.id),
    r.listWorkflowTasksForWorkOrder(input.organizationId, work.id),
    r.listServiceAppointmentsForWorkOrder(input.organizationId, work.id),
  ]);
  if (!store || !org) throw new OpsDomainError("NOT_FOUND", "Store not found.");
  if (inspection?.workOrderId === work.id || detail?.visits.some(v => v.status === "active"))
    throw new OpsDomainError("CONFLICT", "Finish the active visit or use the inspection record before planning another attempt.");
  if (
    !manager &&
    (assignment.internalMembershipId !== input.actor.actorId ||
      input.precision === "appointment" ||
      prior?.precision === "appointment" ||
      (input.target && input.target !== "person") ||
      (input.membershipId && input.membershipId !== input.actor.actorId) ||
      input.managerId)
  )
    throw new OpsDomainError(
      "FORBIDDEN",
      "You can move only your own flexible week or day work. A manager changes appointments and assignments.",
    );
  const waiting =
    ["waiting_on_parts", "waiting_on_vendor"].includes(work.status) ||
    Boolean(detail?.followUps.some(f => f.status === "open")) ||
    Boolean(detail?.visitHoldPosture);
  if (input.precision !== "removed" && waiting && (!manager || !input.tentative || !input.reviewReason?.trim()))
    throw new OpsDomainError(
      "CONFLICT",
      "Review what is needed first, or save an unconfirmed date with a short reason.",
    );
  if (input.precision !== "removed" && !waiting && input.tentative && !manager)
    throw new OpsDomainError("FORBIDDEN", "Ask your manager to record a date while work is waiting.");
  const planningZone = assertPlanningZone(org.timeZone),
    entryZone = assertPlanningZone(store.timeZone ?? org.timeZone);
  let day: string | undefined,
    startsAt: string | undefined,
    week = mondayOf(civilDate(now, planningZone));
  if (input.precision === "week") {
    week = mondayOf(calendarDate(input.date ?? ""));
  }
  if (input.precision === "day") {
    day = calendarDate(input.date ?? "");
    week = mondayOf(day);
  }
  if (input.precision === "appointment") {
    startsAt = exactStoreInstant(input.localStart ?? "", entryZone, input.disambiguation);
    day = civilDate(startsAt, planningZone);
    week = mondayOf(day);
  }
  if (input.precision === "removed" && (!prior || prior.assignmentId !== assignment.id))
    throw new OpsDomainError("CONFLICT", "This job is already unscheduled.");
  const endsAt =
    startsAt && input.durationMinutes ? new Date(Date.parse(startsAt) + input.durationMinutes * 60000).toISOString() : undefined;
  const warnings: string[] = [];
  if (work.targetCompletionAt && input.precision !== "removed") {
    const targetDay = civilDate(work.targetCompletionAt, planningZone);
    if (startsAt ? (endsAt ?? startsAt) > work.targetCompletionAt : (day ?? week) > targetDay)
      warnings.push("After the finish-by date.");
    else if (input.precision === "week" && addCalendarDays(week, 6) > targetDay)
      warnings.push("This week may pass the finish-by date. Pick a day to check.");
    else if (input.precision === "day" && day === targetDay)
      warnings.push("This is the finish-by day, but the time is not confirmed.");
  }
  if (input.precision !== "removed" && appointments.some(a => a.status === "confirmed"))
    warnings.push("Another visit is already booked for this job.");
  const target = input.target ?? internalTarget(assignment)!;
  const membershipId = target === "person" ? (input.membershipId ?? assignment.internalMembershipId) : undefined;
  if (startsAt && membershipId) {
    const peers = await r.listWorkOrders(
      { organizationId: input.organizationId },
      {
        internalOnly: true,
        internalMembershipId: membershipId,
        scheduleView: "week",
        scheduleFrom: addCalendarDays(day!, -1),
        scheduleTo: addCalendarDays(day!, 1),
        limit: 100,
        statuses: ["approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"],
      },
    );
    if (peers.totalCount! > 100) warnings.push("Some jobs could not be checked for overlap. Review the day before keeping this date.");
    for (const peer of peers.items.filter(p => p.id !== work.id && p.schedule?.precision === "appointment")) {
      const p = peer.schedule!;
      if (!endsAt || !p.endsAt) warnings.push("A job has no time estimate. Check that there is enough time.");
      else if (startsAt < p.endsAt && endsAt > p.startsAt!) {
        const time = cachedDateTimeFormat("en-US", { timeZone: entryZone, hour: "numeric", minute: "2-digit" }).format(new Date(p.startsAt!)).replace(":00", "");
        warnings.push(`Overlaps ${peer.internalAssigneeName ?? "the technician"}'s ${time} job.`);
      }
    }
  }
  if (warnings.length && !input.keepConflicts)
    throw new OpsDomainError("VALIDATION", warnings.join(" "), { kind: "schedule_warning", warnings: [...new Set(warnings)] });
  const change =
    target !== internalTarget(assignment) ||
    membershipId !== assignment.internalMembershipId ||
    Boolean(input.managerId && input.managerId !== work.internalAccountableId);
  if (change && (!manager || input.precision === "removed"))
    throw new OpsDomainError("FORBIDDEN", "Only a manager can change who handles this job.");
  const primary = selectWorkflowTaskProjection(tasks);
  if (
    change &&
    primary &&
    !isInternalAssignmentTask(primary) &&
    !["schedule_service", "schedule_return_visit", "record_service_outcome"].includes(primary.taskType)
  )
    throw new OpsDomainError(
      "CONFLICT",
      "Review the required action before changing the assignment. Save the plan without changing who handles it.",
    );
  const owner = await resolveDispatchAccountability(r, work);
  const plan: InternalSchedule = {
    id: ids.next("internal-schedule"),
    organizationId: input.organizationId,
    workOrderId: work.id,
    assignmentId: assignment.id,
    revision: (history[0]?.revision ?? 0) + 1,
    attempt: prior?.assignmentId === assignment.id ? prior.attempt : (history[0]?.attempt ?? 0) + 1,
    precision: input.precision,
    planningZone,
    week,
    day,
    startsAt,
    endsAt,
    entryZone: startsAt ? entryZone : undefined,
    localStart: startsAt ? input.localStart : undefined,
    disambiguation: input.disambiguation,
    durationMinutes: input.precision === "removed" ? undefined : input.durationMinutes,
    tentative: input.precision === "removed" ? false : Boolean(input.tentative),
    reviewReason: input.reviewReason?.trim() || undefined,
    supersedesId: prior?.id,
    recordedBy: input.actor.actorId,
    recordedByName: input.actor.actorName,
    recordedAt: now,
  };
  async function prepare(nextAssignment: WorkOrderAssignment, observedTasks: readonly WorkflowTask[] = tasks) {
    plan.assignmentId = nextAssignment.id;
    const statements: OpsStatement[] = [
      dispatchAccessAssertion(
        input.organizationId,
        input.actor.actorId!,
        work!.storeId,
        manager ? internalManagerRoles : ["internal_technician"],
        now,
      ),
      internalScheduleStatement(plan),
      {
        sql: "UPDATE ops_work_orders SET internal_schedule_id = ? WHERE organization_id = ? AND id = ?",
        params: [input.precision === "removed" ? null : plan.id, input.organizationId, work!.id],
      },
      insertDispatchRecord("ops_idempotency_keys", {
        organization_id: input.organizationId,
        key,
        command: "internal_schedule.save",
        result_id: plan.id,
        request_hash: hash,
        created_at: now,
        expires_at: "9999-12-31T23:59:59.999Z",
      }),
    ];
    if (nextAssignment.internalMembershipId)
      statements.push(
        dispatchAccessAssertion(input.organizationId, nextAssignment.internalMembershipId, work!.storeId, ["internal_technician"], now),
      );
    if (change) {
      const oldAllocation = new Set(tasks.filter(isInternalAssignmentTask).map(t => t.id));
      const obsolete = observedTasks.filter(t => oldAllocation.has(t.id) && ["open", "in_progress"].includes(t.status));
      for (const task of obsolete)
        statements.push(
          ...buildCompleteWorkflowTaskStatements({
            task,
            actor: input.actor,
            occurredAt: now,
            ids,
            resolutionNote: "Replaced by the live scheduled assignment",
          }),
        );
      observedTasks = observedTasks.map(t => (obsolete.includes(t) ? { ...t, status: "completed" as const } : t));
      if (obsolete.length) statements.push(buildWorkflowTaskProjectionStatement(input.organizationId, work!.id, observedTasks));
    }
    const scheduling = observedTasks.filter(
      t =>
        ["open", "in_progress"].includes(t.status) &&
        ["schedule_service", "schedule_return_visit"].includes(t.taskType) &&
        !t.sourceFollowUpId &&
        !t.sourceApprovalRequestId,
    );
    if (scheduling.length && input.precision !== "removed" && !plan.tentative) {
      const due = new Date(Date.parse(now) + (["urgent", "emergency"].includes(work!.priority) ? 24 : 72) * 3600000).toISOString();
      const task = buildWorkflowTaskRecord({
        id: ids.next("workflow-task"),
        organizationId: input.organizationId,
        workOrderId: work!.id,
        actor: input.actor,
        createdAt: now,
        draft: {
          taskType: "record_service_outcome",
          title: "Complete planned internal work",
          reason: work!.problem,
          assigneeType: nextAssignment.internalMembershipId ? "user" : owner.assigneeType,
          assigneeId: nextAssignment.internalMembershipId ?? owner.assigneeId,
          assigneeName: nextAssignment.internalMembershipId
            ? identity.role === "internal_technician"
              ? identity.name
              : "Assigned technician"
            : owner.assigneeName,
          priority: ["urgent", "emergency"].includes(work!.priority) ? "high" : "normal",
          dueAt: due,
          completionCriteria: "Record a result or report a blocker",
          escalationDestination: owner.escalationDestination,
          applicableSlaClock: "completion",
        },
      });
      for (const t of scheduling)
        statements.push(
          ...buildCompleteWorkflowTaskStatements({
            task: t,
            actor: input.actor,
            occurredAt: now,
            ids,
            resolutionNote: "Live internal schedule saved",
          }),
        );
      const execution = observedTasks.find(
        t =>
          t.taskType === "record_service_outcome" &&
          t.title === "Complete planned internal work" &&
          ["open", "in_progress"].includes(t.status),
      );
      if (!execution) statements.push(...buildCreateTaskStatements({ task, actor: input.actor, ids }));
      statements.push(
        buildWorkflowTaskProjectionStatement(input.organizationId, work!.id, [
          ...observedTasks.filter(t => !scheduling.includes(t)),
          ...(!execution ? [task] : []),
        ]),
      );
    }
    const recipients = manager
      ? [nextAssignment.internalMembershipId, assignment!.internalMembershipId].filter((s): s is string => Boolean(s))
      : owner.assigneeType === "user" && owner.assigneeId
        ? [owner.assigneeId]
        : [];
    const material =
      manager || !prior || prior.week !== plan.week || prior.day !== plan.day || prior.precision !== plan.precision || warnings.length > 0;
    if (material && (recipients.length || !manager))
      statements.push(
        buildDispatchNotification({
          id: ids.next("outbox"),
          work: work!,
          now,
          recipients,
          notifyCoordinationTeam: !manager && !recipients.length,
          headline:
            plan.precision === "removed"
              ? "Internal schedule removed"
              : plan.tentative
                ? "Tentative internal plan saved"
                : "Live internal schedule changed",
          payload: {
            plannedLabel: scheduleLabel(plan),
            assignmentId: nextAssignment.id,
            scheduleId: plan.id,
            scheduleRemoved: plan.precision === "removed",
            priorScheduleId: prior?.id,
            precision: plan.precision,
            week,
            day,
            startsAt,
            warnings,
          },
        }),
      );
    statements.push(
      insertDispatchRecord("ops_audit_events", {
        id: ids.next("audit"),
        organization_id: input.organizationId,
        aggregate_type: "work_order",
        aggregate_id: work!.id,
        event_type: "internal_schedule.saved",
        actor_type: "user",
        actor_id: input.actor.actorId,
        actor_name: input.actor.actorName,
        occurred_at: now,
        payload_json: JSON.stringify({
          plan,
          warnings,
          nextActionPolicy:
            scheduling.length && !plan.tentative
              ? "Internal execution: urgent 24h; routine 72h from scheduling"
              : "Existing obligations and deadlines retained",
        }),
      }),
    );
    return statements;
  }
  try {
    if (change)
      await changeInternalDispatch(
        svc,
        {
          organizationId: input.organizationId,
          workOrderId: work.id,
          actor: input.actor,
          expectedVersion: input.expectedVersion,
          expectedAssignmentId: assignment.id,
          key: input.key,
          action: "assign",
          target,
          membershipId,
          managerId: input.managerId,
        },
        {
          intent: hash,
          preserveSchedulingTasks: plan.tentative,
          executionDueAt:
            !plan.tentative &&
            tasks.some(
              t =>
                ["open", "in_progress"].includes(t.status) &&
                ["schedule_service", "schedule_return_visit"].includes(t.taskType) &&
                !t.sourceFollowUpId &&
                !t.sourceApprovalRequestId,
            )
              ? new Date(Date.parse(now) + (["urgent", "emergency"].includes(work.priority) ? 24 : 72) * 3600000).toISOString()
              : undefined,
          prepare: (_, next, projected) => prepare(next, projected),
        },
      );
    else
      await atomicWorkOrderMutation({
        repository: r,
        workOrder: work,
        now,
        statements: await prepare(assignment),
        conflictMessage: "The job changed while saving. Refresh and review your schedule.",
      });
  } catch (error) {
    const retried = await replay();
    if (retried) return retried;
    await dispatchIdentity(
      r,
      input.organizationId,
      input.actor.actorId!,
      work.storeId,
      manager ? internalManagerRoles : ["internal_technician"],
    );
    if (membershipId) await dispatchIdentity(r, input.organizationId, membershipId, work.storeId, ["internal_technician"]);
    if (error instanceof OpsDomainError && error.code === "CONFLICT") throw new OpsDomainError("CONFLICT", await changedState());
    throw error;
  }
  return { schedule: plan, version: input.expectedVersion + 1, replayed: false };
}

export async function setInternalCompletionTarget(
  svc: OpsCommandServices,
  input: {
    organizationId: string;
    workOrderId: string;
    actor: ActorContext;
    expectedVersion: number;
    key: string;
    localTarget?: string;
    disambiguation?: "earlier" | "later";
    reason: string;
  },
) {
  const r = svc.repository,
    now = svc.clock?.now() ?? new Date().toISOString();
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId)
    throw new OpsDomainError("FORBIDDEN", "A manager sets Target completion.");
  const work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
  if (
    !input.reason.trim() ||
    input.reason.length > 1000 ||
    !/^[A-Za-z0-9_-]{8,120}$/.test(input.key) ||
    !Number.isSafeInteger(input.expectedVersion)
  )
    throw new OpsDomainError("VALIDATION", "Give a short reason for the target change.");
  const key = "internal-target:" + input.actor.actorId + ":" + input.key,
    hash = await requestHash({ ...input, actor: { id: input.actor.actorId } });
  const receipt = await r.getIdempotencyKey(input.organizationId, key);
  if (receipt) {
    if (receipt.requestHash !== hash) throw new OpsDomainError("CONFLICT", "This retry has a different target.");
    return { version: input.expectedVersion + 1, replayed: true };
  }
  if (persistedWorkOrderVersion(work) !== input.expectedVersion || ["closed", "cancelled"].includes(work.status))
    throw new OpsDomainError("CONFLICT", "This job changed. Refresh before changing its target.");
  const store = await r.getStore(input.organizationId, work.storeId),
    org = await r.getOrganization(input.organizationId);
  const target = input.localTarget
    ? exactStoreInstant(input.localTarget, store?.timeZone ?? org!.timeZone, input.disambiguation)
    : undefined;
  const ids = svc.ids ?? { next: (p: string) => p + "-" + crypto.randomUUID() };
  const assignment = await r.getActiveAssignment(input.organizationId, work.id);
  const notice =
    assignment?.kind === "internal" && assignment.internalMembershipId
      ? buildDispatchNotification({
          id: ids.next("outbox"),
          work,
          now,
          recipients: [assignment.internalMembershipId],
          headline: "Target completion changed",
          payload: { assignmentId: assignment.id, targetCompletionAt: target ?? null },
        })
      : null;
  try {
    await atomicWorkOrderMutation({
      repository: r,
      workOrder: work,
      now,
      statements: [
        ...(notice ? [notice] : []),
        dispatchAccessAssertion(input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles, now),
        {
          sql: "UPDATE ops_work_orders SET target_completion_at = ?, target_completion_source = ? WHERE organization_id = ? AND id = ?",
          params: [target ?? null, target ? "manager:" + input.actor.actorId : null, input.organizationId, work.id],
        },
        insertDispatchRecord("ops_idempotency_keys", {
          organization_id: input.organizationId,
          key,
          command: "internal_target.changed",
          result_id: work.id,
          request_hash: hash,
          created_at: now,
          expires_at: "9999-12-31T23:59:59.999Z",
        }),
        insertDispatchRecord("ops_audit_events", {
          id: ids.next("audit"),
          organization_id: input.organizationId,
          aggregate_type: "work_order",
          aggregate_id: work.id,
          event_type: "internal_target.changed",
          actor_type: "user",
          actor_id: input.actor.actorId,
          actor_name: input.actor.actorName,
          occurred_at: now,
          payload_json: JSON.stringify({
            priorTarget: work.targetCompletionAt,
            target,
            reason: input.reason.trim(),
            source: "manager",
            zone: store?.timeZone ?? org?.timeZone,
          }),
        }),
      ],
    });
  } catch (error) {
    const saved = await r.getIdempotencyKey(input.organizationId, key);
    if (saved?.requestHash === hash) return { version: input.expectedVersion + 1, replayed: true };
    await dispatchIdentity(r, input.organizationId, input.actor.actorId, work.storeId, internalManagerRoles);
    throw error;
  }
  return { version: input.expectedVersion + 1, replayed: false };
}
