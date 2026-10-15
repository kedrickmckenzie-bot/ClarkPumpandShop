import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, WorkOrder } from "./types";

/**
 * Callbacks. A callback is its own work order, linked to the earlier job it returns to. It is sent from the earlier
 * job ("Call vendor back") or linked later when someone recognizes a repeat. The vendor just does the work; afterwards
 * the facilities manager closes it out as a no-charge callback or unlinks it as new billable work. The earlier job is
 * never changed. One row per callback work order; "not a callback" answers are kept so the prompt doesn't come back.
 */
export type CallbackStatus = "open" | "no_charge" | "new_work" | "not_callback";
export type CallbackSource = "sent" | "linked" | "suggested";

export interface WorkCallback {
  id: string;
  organizationId: string;
  workOrderId: string;
  originalWorkOrderId: string;
  source: CallbackSource;
  status: CallbackStatus;
  createdAt: string;
  createdByName: string;
  createdByActorId?: string;
  resolvedAt?: string;
  resolvedByName?: string;
  reason?: string;
}

/** How recently an earlier repair must have finished for a new job on the same equipment to be offered as a callback. */
export const CALLBACK_WINDOW_DAYS = 30;
export const isLinked = (row: WorkCallback) => row.status === "open" || row.status === "no_charge";
export const CALLBACK_STATUS_LABELS: Record<CallbackStatus, string> = { open: "Callback · not closed out", no_charge: "Callback · no charge", new_work: "Was a callback · changed to new billable work", not_callback: "Not a callback" };

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}
const audit = (organizationId: string, workOrderId: string, eventType: string, actor: ActorContext, now: string, payload: object): OpsStatement =>
  insert("ops_audit_events", { id: `audit-${crypto.randomUUID()}`, organization_id: organizationId, aggregate_type: "work_order", aggregate_id: workOrderId, event_type: eventType, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now, payload_json: JSON.stringify(payload) });

/** The link row and its audit, written in the same transaction as whatever creates or links the callback. */
export function callbackStatements(input: { organizationId: string; workOrderId: string; originalWorkOrderId: string; source: CallbackSource; status: "open" | "not_callback"; actor: ActorContext; now: string }): OpsStatement[] {
  const id = `callback-${input.workOrderId}`;
  return [
    insert("ops_work_order_callbacks", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, original_work_order_id: input.originalWorkOrderId, source: input.source, status: input.status, created_at: input.now, created_by_name: input.actor.actorName ?? "Team member", created_by_actor_id: input.actor.actorId }),
    audit(input.organizationId, input.workOrderId, input.status === "open" ? "work_order.callback_linked" : "work_order.callback_declined", input.actor, input.now, { originalWorkOrderId: input.originalWorkOrderId, source: input.source }),
  ];
}

const completedAt = (work: Pick<WorkOrder, "resolvedAt" | "closedAt">) => work.resolvedAt ?? work.closedAt;

/** Checks that a job can be the earlier job for a callback on this one: same organization and store, finished, not this job. */
export async function assertCallbackPair(repository: OpsRepository, organizationId: string, workOrderId: string | undefined, originalWorkOrderId: string, storeId: string) {
  if (workOrderId === originalWorkOrderId) throw new OpsDomainError("VALIDATION", "A job can't be a callback for itself.");
  const original = await repository.getWorkOrder(organizationId, originalWorkOrderId);
  if (!original) throw new OpsDomainError("NOT_FOUND", "The earlier job was not found.");
  if (original.storeId !== storeId) throw new OpsDomainError("VALIDATION", "A callback must be at the same store as the earlier job.");
  if (!completedAt(original) || original.status === "cancelled") throw new OpsDomainError("VALIDATION", "The earlier job isn't finished yet, so this can't be a callback for it.");
  return original;
}

/** Answers "Is this a callback?" for a job created on recently repaired equipment: link it, or record that it isn't. */
export async function answerCallback(svc: OpsCommandServices, input: { organizationId: string; workOrderId: string; originalWorkOrderId: string; isCallback: boolean; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This is outside your organization.");
  const work = await svc.repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  const existing = (await svc.repository.listWorkCallbacks(input.organizationId, [input.workOrderId])).find((row) => row.workOrderId === input.workOrderId);
  if (existing) {
    if (existing.originalWorkOrderId === input.originalWorkOrderId && (existing.status === "not_callback") === !input.isCallback) return existing;
    throw new OpsDomainError("CONFLICT", "This has already been answered. Refresh the page to see it.");
  }
  await assertCallbackPair(svc.repository, input.organizationId, input.workOrderId, input.originalWorkOrderId, work.storeId);
  const now = svc.clock?.now() ?? new Date().toISOString();
  await svc.repository.atomicWrite(callbackStatements({ organizationId: input.organizationId, workOrderId: input.workOrderId, originalWorkOrderId: input.originalWorkOrderId, source: input.isCallback ? "linked" : "suggested", status: input.isCallback ? "open" : "not_callback", actor: input.actor, now }));
}

/** Closes out a callback: keep it linked at no charge, or unlink it as new billable work (with a short reason). */
export async function resolveCallback(svc: OpsCommandServices, input: { organizationId: string; workOrderId: string; decision: "no_charge" | "new_work"; reason?: string; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This is outside your organization.");
  const row = (await svc.repository.listWorkCallbacks(input.organizationId, [input.workOrderId])).find((item) => item.workOrderId === input.workOrderId);
  if (!row || row.status === "not_callback") throw new OpsDomainError("NOT_FOUND", "This job isn't a callback.");
  const reason = input.reason?.trim();
  if (input.decision === "new_work" && !reason) throw new OpsDomainError("VALIDATION", "Say briefly why this is new billable work, like what the vendor found.");
  if ((reason?.length ?? 0) > 300) throw new OpsDomainError("VALIDATION", "Keep the reason under 300 characters.");
  if (row.status === input.decision && (row.reason ?? "") === (reason ?? "")) return;
  const now = svc.clock?.now() ?? new Date().toISOString();
  await svc.repository.atomicWrite([
    { sql: "UPDATE ops_work_order_callbacks SET status = ?, resolved_at = ?, resolved_by_name = ?, reason = ? WHERE organization_id = ? AND id = ?", params: [input.decision, now, input.actor.actorName ?? "Team member", reason ?? null, input.organizationId, row.id] },
    audit(input.organizationId, input.workOrderId, input.decision === "no_charge" ? "work_order.callback_no_charge" : "work_order.callback_new_work", input.actor, now, { originalWorkOrderId: row.originalWorkOrderId, previousStatus: row.status, reason }),
  ]);
}

export interface RepairSummary {
  id: string;
  number: string;
  problem: string;
  status: WorkOrder["status"];
  createdAt: string;
  completedAt?: string;
  /** Who did it: the vendor's name, or "In-house team". */
  doneBy?: string;
  vendorId?: string;
  /** The last checkout note: what was done. */
  did?: string;
  /** The store or manager's check, when one was recorded. */
  check?: "verified" | "rejected" | "inconclusive";
}

/** A quick picture of a job: the problem, who did it, what they recorded doing and whether it was confirmed. */
export async function repairSummary(repository: OpsRepository, organizationId: string, workOrderId: string): Promise<RepairSummary | null> {
  const work = await repository.getWorkOrder(organizationId, workOrderId);
  if (!work) return null;
  const [outcomes, checks, assignment] = await Promise.all([
    repository.listWorkOutcomesForWorkOrder(organizationId, workOrderId),
    repository.listWorkOrderVerifications(organizationId, workOrderId),
    repository.getLatestServiceAssignment(organizationId, workOrderId),
  ]);
  const vendor = assignment?.kind === "outside_vendor" && assignment.vendorId ? await repository.getVendor(organizationId, assignment.vendorId) : null;
  const did = outcomes.filter((outcome) => outcome.outcomeNotes?.trim()).sort((a, b) => (b.outcomeRecordedAt ?? "").localeCompare(a.outcomeRecordedAt ?? ""))[0]?.outcomeNotes?.trim();
  return {
    id: work.id, number: work.number, problem: work.problem, status: work.status, createdAt: work.createdAt, completedAt: completedAt(work),
    doneBy: vendor?.name ?? (assignment?.kind === "internal" ? "In-house team" : undefined), vendorId: vendor?.id, did,
    check: checks.at(-1)?.decision,
  };
}

/** The most recent finished repair on the same equipment within the window before this job, if it isn't answered yet. */
export async function callbackCandidate(repository: OpsRepository, organizationId: string, work: WorkOrder, links: readonly WorkCallback[]) {
  if (!work.assetId || links.some((row) => row.workOrderId === work.id)) return undefined;
  const from = new Date(Date.parse(work.createdAt) - CALLBACK_WINDOW_DAYS * 86_400_000).toISOString();
  const earlierId = await repository.findRecentRepairOnAsset(organizationId, work.assetId, work.id, from, work.createdAt);
  return earlierId ? await repairSummary(repository, organizationId, earlierId) ?? undefined : undefined;
}

/**
 * Fictional callbacks for the Clark Pump and Shop showcase: two repeat repairs on the same equipment within the
 * window, one closed out as no charge and one not closed out yet (so the close-out can be tried). Added only when
 * the demo is built fresh (seed or reset); the startup top-up skips them because they point at generated history.
 */
export function addCallbacksDemo(f: import("./types").OpsFixture): import("./types").OpsFixture {
  const org = f.organizations[0]?.id;
  if (!org || f.stores.filter((store) => store.organizationId === org).length !== 15) return f;
  f.workCallbacks ??= [];
  const done = (work: WorkOrder) => work.resolvedAt ?? work.closedAt;
  // Story jobs only (not generated history), so the same callbacks appear whichever way the demo is built.
  const repairs = f.workOrders.filter((work) => work.organizationId === org && work.assetId && work.priority !== "planned" && work.status !== "cancelled" && !work.id.startsWith("wo-history-")).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const vendorJob = new Set(f.assignments.filter((row) => row.organizationId === org && row.kind === "outside_vendor").map((row) => row.workOrderId));
  const pairs: Array<[WorkOrder, WorkOrder]> = [];
  for (const earlier of repairs) {
    const finished = done(earlier);
    if (!finished || !vendorJob.has(earlier.id) || pairs.some(([a, b]) => [a.id, b.id].includes(earlier.id))) continue;
    const next = repairs.find((work) => work.id !== earlier.id && work.assetId === earlier.assetId && work.createdAt > finished && Date.parse(work.createdAt) - Date.parse(finished) <= CALLBACK_WINDOW_DAYS * 86_400_000 && !pairs.some(([a, b]) => [a.id, b.id].includes(work.id)));
    if (next) pairs.push([earlier, next]);
  }
  const plan: Array<{ status: CallbackStatus; reason?: string }> = [{ status: "no_charge" }, { status: "open" }];
  pairs.slice(-plan.length).forEach(([earlier, next], index) => {
    const id = `callback-demo-${next.id}`;
    if (f.workCallbacks!.some((row) => row.workOrderId === next.id)) return;
    const { status, reason } = plan[index]!;
    f.workCallbacks!.push({ id, organizationId: org, workOrderId: next.id, originalWorkOrderId: earlier.id, source: "sent", status, createdAt: next.createdAt, createdByName: "Jordan Lee",
      ...(status === "open" ? {} : { resolvedAt: done(next) ?? next.createdAt, resolvedByName: "Jordan Lee", reason }) });
  });
  return f;
}
