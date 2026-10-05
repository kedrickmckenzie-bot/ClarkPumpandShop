import type { OpsRepository } from "./repository";
import type { WorkOrder, WorkflowTask } from "./types";
import type { OpsCommandServices } from "./commands";
import { civilDate, exactStoreInstant } from "./dispatch-calendar";
import { addCalendarDays } from "./internal-schedule-types";
import { atomicWorkOrderMutation } from "./concurrency";
import { resultAudit } from "./internal-execution";

export async function confirmationWindow(
  repository: OpsRepository,
  work: WorkOrder,
  now: string,
) {
  const [policy, store, org] = await Promise.all([
    repository.getActiveWorkflowPolicy(work.organizationId),
    repository.getStore(work.organizationId, work.storeId),
    repository.getOrganization(work.organizationId),
  ]);
  const delay =
    work.confirmationDelay ?? policy?.confirmationDelay ?? "next_morning";
  const zone = store?.timeZone ?? org!.timeZone;
  const availableAt =
    delay === "four_hours"
      ? new Date(Date.parse(now) + 4 * 3600000).toISOString()
      : exactStoreInstant(
          `${addCalendarDays(civilDate(now, zone), 1)}T08:00`,
          zone,
          "earlier",
        );
  return {
    availableAt,
    dueAt: new Date(Date.parse(availableAt) + 24 * 3600000).toISOString(),
  };
}

/** Returns true when the reminder window is still running; escalation follows it. */
export async function waitForConfirmationReminder(
  svc: OpsCommandServices,
  task: WorkflowTask,
) {
  if (
    task.taskType !== "verify_repair" ||
    !task.availableAt ||
    !task.workOrderId
  )
    return false;
  const r = svc.repository,
    now = svc.clock?.now() ?? new Date().toISOString();
  if (task.remindedAt) {
    const policy = await r.getActiveWorkflowPolicy(task.organizationId);
    return (
      Date.parse(now) <
      Date.parse(task.remindedAt) +
        (policy?.confirmationEscalationHours ?? 24) * 3600000
    );
  }
  const work = await r.getWorkOrder(task.organizationId, task.workOrderId);
  if (!work) return true;
  const fresh = await r.getWorkflowTask(task.organizationId, task.id);
  if (
    !fresh ||
    fresh.remindedAt ||
    !["open", "in_progress"].includes(fresh.status)
  )
    return true;
  const ids = svc.ids ?? {
      next: (prefix: string) => `${prefix}-${crypto.randomUUID()}`,
    },
    actor = {
      organizationId: work.organizationId,
      actorType: "system" as const,
      actorName: "Confirmation reminder",
    };
  await atomicWorkOrderMutation({
    repository: r,
    workOrder: work,
    now,
    statements: [
      {
        sql: "UPDATE ops_workflow_tasks SET reminded_at = ? WHERE organization_id = ? AND id = ?",
        params: [now, task.organizationId, task.id],
      },
      ...resultAudit(
        work,
        actor,
        now,
        ids,
        "work_order.confirmation_requested",
        {
          workOrderId: work.id,
          workflowTaskId: task.id,
          reminder: true,
          confirmationMembershipId: work.confirmationMembershipId,
          dueAt: task.dueAt,
        },
      ),
    ],
  });
  return true;
}
