import { internalScheduleStatement } from "./internal-scheduling";
import type { OpsCommandServices } from "./commands";
import type { ActorContext, WorkOrder } from "./types";
import {
  atomicWorkOrderMutation,
  persistedWorkOrderVersion,
} from "./concurrency";
import {
  dispatchAccessAssertion,
  dispatchIdentity,
  internalManagerRoles,
} from "./internal-dispatch";
import { resultAudit } from "./internal-execution";
import { OpsDomainError } from "./errors";

/** Shared preparation facts belong to the job, independently of its assignment or date. */
export async function updateJobPreparation(
  svc: OpsCommandServices,
  input: {
    organizationId: string;
    workOrderId: string;
    actor: ActorContext;
    expectedVersion: number;
    /** Few-word planning label; leave undefined to keep the current one. */
    shortName?: string;
    technicianNotes?: string;
    estimatedMinutes?: number;
    confirmationDelay?: WorkOrder["confirmationDelay"];
    remainingMinutes?: number;
  },
) {
  const r = svc.repository,
    work = await r.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  if (
    input.actor.organizationId !== work.organizationId ||
    input.actor.actorType !== "user" ||
    !input.actor.actorId
  )
    throw new OpsDomainError("FORBIDDEN", "Sign in to update this job.");
  const identity = await dispatchIdentity(
    r,
    work.organizationId,
    input.actor.actorId,
    work.storeId,
    [...internalManagerRoles, "internal_technician"],
  );
  if (persistedWorkOrderVersion(work) !== input.expectedVersion)
    throw new OpsDomainError(
      "CONFLICT",
      "This job changed. Refresh before saving your notes.",
    );
  if (["closed", "cancelled", "resolved"].includes(work.status))
    throw new OpsDomainError("CONFLICT", "This job is no longer open.");
  if ((input.shortName?.trim().length ?? 0) > 40)
    throw new OpsDomainError("VALIDATION", "Keep the short name to 40 characters.");
  if ((input.technicianNotes?.length ?? 0) > 3000)
    throw new OpsDomainError(
      "VALIDATION",
      "Keep notes under 3,000 characters.",
    );
  if (
    input.confirmationDelay &&
    !["next_morning", "four_hours"].includes(input.confirmationDelay)
  )
    throw new OpsDomainError("VALIDATION", "Choose a confirmation time.");
  let minutes = input.estimatedMinutes;
  const now = svc.clock?.now() ?? new Date().toISOString();
  if (input.remainingMinutes !== undefined) {
    if (
      !Number.isSafeInteger(input.remainingMinutes) ||
      input.remainingMinutes < 1 ||
      input.remainingMinutes > 1440
    )
      throw new OpsDomainError(
        "VALIDATION",
        "Enter remaining minutes from 1 to 1,440.",
      );
    const detail = await r.getWorkOrderDetail(
      { organizationId: work.organizationId },
      work.id,
    );
    const visit = detail?.visits.find((v) => v.status === "active");
    if (!visit)
      throw new OpsDomainError(
        "CONFLICT",
        "Check in before updating time remaining.",
      );
    minutes =
      Math.ceil((Date.parse(now) - Date.parse(visit.checkedInAt)) / 60000) +
      input.remainingMinutes;
  }
  if (
    minutes !== undefined &&
    (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440)
  )
    throw new OpsDomainError(
      "VALIDATION",
      "Enter an estimate from 1 to 1,440 minutes, or leave it unknown.",
    );
  if (identity.role === "internal_technician") {
    const assignment = await r.getActiveAssignment(
      work.organizationId,
      work.id,
    );
    if (assignment?.internalMembershipId !== identity.membershipId)
      throw new OpsDomainError("FORBIDDEN", "Update only your assigned job.");
    if (input.confirmationDelay !== work.confirmationDelay)
      throw new OpsDomainError(
        "FORBIDDEN",
        "A manager changes confirmation timing.",
      );
  }
  const notes = input.technicianNotes?.trim() || undefined;
  // Technicians keep the manager's planning label; managers may change or clear it.
  const shortName = input.shortName === undefined || identity.role === "internal_technician" ? work.shortName : input.shortName.trim() || undefined;
  const ids = svc.ids ?? {
    next: (prefix: string) => `${prefix}-${crypto.randomUUID()}`,
  };
  const priorPlan = work.internalScheduleId
    ? await r.getInternalSchedule(work.organizationId, work.internalScheduleId)
    : null;
  const plan =
    priorPlan && priorPlan.precision !== "removed"
      ? {
          ...priorPlan,
          id: ids.next("internal-schedule"),
          revision:
            Math.max(
              ...(
                await r.listInternalSchedules(work.organizationId, work.id)
              ).map((p) => p.revision),
              0,
            ) + 1,
          durationMinutes: minutes,
          supersedesId: priorPlan.id,
          recordedBy: input.actor.actorId,
          recordedByName: input.actor.actorName,
          recordedAt: now,
        }
      : undefined;
  await atomicWorkOrderMutation({
    repository: r,
    workOrder: work,
    now,
    statements: [
      ...(plan
        ? [
            internalScheduleStatement(plan),
            {
              sql: "UPDATE ops_work_orders SET internal_schedule_id = ? WHERE organization_id = ? AND id = ?",
              params: [plan.id, work.organizationId, work.id],
            },
          ]
        : []),
      dispatchAccessAssertion(
        work.organizationId,
        input.actor.actorId,
        work.storeId,
        [...internalManagerRoles, "internal_technician"],
        now,
      ),
      {
        sql: "UPDATE ops_work_orders SET short_name = ?, technician_notes = ?, estimated_minutes = ?, confirmation_delay = ? WHERE organization_id = ? AND id = ?",
        params: [
          shortName ?? null,
          notes ?? null,
          minutes ?? null,
          input.confirmationDelay ?? null,
          work.organizationId,
          work.id,
        ],
      },
      ...resultAudit(
        work,
        input.actor,
        now,
        ids,
        "work_order.preparation_updated",
        {
          previous: {
            shortName: work.shortName,
            notes: work.technicianNotes,
            minutes: work.estimatedMinutes,
            confirmationDelay: work.confirmationDelay,
          },
          shortName,
          notes,
          minutes,
          confirmationDelay: input.confirmationDelay,
          remainingMinutes: input.remainingMinutes,
        },
      ),
    ],
  });
  return { version: input.expectedVersion + 1 };
}
