import { OpsDomainError } from "./errors";
import type { OpsCommandServices } from "./commands";
import type { OpsStatement } from "./repository";
import type { ActorContext, OpsId, OrganizationRole, WorkflowTask } from "./types";
import { escalateWorkflowTask, isOpenWorkflowTask } from "./workflow-task-commands";
import { waitingOn } from "./review-buckets";

/** Nudges in a row (by anyone) before the item goes to the next person up. */
function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

export const NUDGES_BEFORE_ESCALATION = 3;
const DAY = 86_400_000;
/** Who an item goes to next when nudges don't move it. */
const LADDER: Array<{ role: OrganizationRole; label: string }> = [
  { role: "store_manager", label: "Regional manager" }, { role: "field_manager", label: "Facilities" },
  { role: "regional_manager", label: "Facilities" }, { role: "facilities_admin", label: "Owner" }, { role: "executive", label: "Owner" },
];
const UP = ["Store manager", "Regional manager", "Facilities", "Owner"];

/** The next person up from where the item sits now. */
export function nextUp(task: Pick<WorkflowTask, "assigneeType" | "assigneeRole" | "escalationDestination">) {
  const current = UP.indexOf(task.escalationDestination ?? "");
  if (current >= 0) return UP[Math.min(UP.length - 1, current + 1)];
  return LADDER.find(step => step.role === task.assigneeRole)?.label ?? "Facilities";
}

export interface NudgeRecord { workOrderId: OpsId; taskId: OpsId; actorId?: OpsId; actorName: string; occurredAt: string }

/** Whether this person may nudge now, and how many nudges the item already has since it last moved up. */
export function nudgeState(nudges: readonly NudgeRecord[], task: Pick<WorkflowTask, "id">, actorId: OpsId | undefined, now: string) {
  const mine = nudges.filter(row => row.taskId === task.id);
  const last = mine.filter(row => row.actorId === actorId).map(row => row.occurredAt).sort().at(-1);
  const nextAllowedAt = last ? new Date(Date.parse(last) + DAY).toISOString() : undefined;
  return { count: mine.length, nudgedToday: Boolean(nextAllowedAt && nextAllowedAt > now), nextAllowedAt, lastAt: mine.map(row => row.occurredAt).sort().at(-1) };
}

export interface NudgeInput { organizationId: OpsId; workflowTaskId: OpsId; actor: ActorContext; actorRole: OrganizationRole; actorMembershipId?: OpsId }

/**
 * Asks whoever an item is waiting on to move it. Recorded on the job's history with the person's name, once a day per
 * person. Every third nudge sends the item to the next person up. A nudge never approves, assigns or changes the work.
 */
export async function nudgeWorkflowTask(svc: OpsCommandServices, input: NudgeInput) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
  const task = await svc.repository.getWorkflowTask(input.organizationId, input.workflowTaskId);
  if (!task || !task.workOrderId) throw new OpsDomainError("NOT_FOUND", "This item was not found.");
  if (!isOpenWorkflowTask(task)) throw new OpsDomainError("CONFLICT", "This is already done.");
  if ((task.assigneeType === "role" && task.assigneeRole === input.actorRole) || (task.assigneeType === "user" && task.assigneeId === input.actorMembershipId)) {
    throw new OpsDomainError("CONFLICT", "This one is yours. Open it to take the next step.");
  }
  const nudges = await svc.repository.listWorkOrderNudges(input.organizationId, [task.workOrderId]);
  const state = nudgeState(nudges.filter(row => row.occurredAt >= task.createdAt), task, input.actor.actorId, now);
  if (state.nudgedToday) throw new OpsDomainError("CONFLICT", "You already nudged this today.");
  const number = state.count + 1;
  const who = waitingOn(task.assigneeName, task);
  const escalate = number % NUDGES_BEFORE_ESCALATION === 0;
  const destination = escalate ? nextUp(task) : undefined;
  const payload = { taskId: task.id, waitingOn: who, nudgeNumber: number,
    message: escalate ? `Still waiting on ${who}. Nudged ${number} times, so it went to ${destination}.` : `Still waiting on ${who}. Nudge ${number}.` };
  const json = JSON.stringify(payload);
  const statements: OpsStatement[] = [
    insert("ops_audit_events", { id: ids.next("audit"), organization_id: input.organizationId, aggregate_type: "work_order", aggregate_id: task.workOrderId, event_type: "work_order.nudged",
      actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: now, payload_json: json }),
    insert("ops_outbox_messages", { id: ids.next("outbox"), organization_id: input.organizationId, topic: "ops.work_order.nudged", aggregate_type: "work_order", aggregate_id: task.workOrderId,
      payload_json: json, status: "pending", available_at: now, created_at: now, attempt_count: 0 }),
  ];
  await svc.repository.atomicWrite(statements);
  if (escalate) await escalateWorkflowTask(svc, { organizationId: input.organizationId, workflowTaskId: task.id, actor: input.actor,
    escalationDestination: destination!, escalationLevel: task.escalationLevel + 1, reason: `Nudged ${number} times without moving.` });
  return { nudgeNumber: number, escalatedTo: destination };
}
