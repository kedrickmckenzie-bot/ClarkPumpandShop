import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { ActorContext, OpsFixture, WorkOrder } from "./types";

/**
 * "Since you last looked": four kinds of change to jobs between a person's last
 * "Mark as seen" and now. One rule per kind, used for both the Overview count and
 * the job list it opens, so the two always agree.
 */
export const SINCE_KINDS = ["fixed", "urgent", "declined", "overdue"] as const;
export type SinceKind = typeof SINCE_KINDS[number];
export interface SinceWindow { kind: SinceKind; from: string; to: string }

/** One saved "Mark as seen" press. Insert-only; the newest row is the person's last look. */
export interface OverviewSeenMark { id: string; organizationId: string; membershipId: string; seenAt: string }

export const SINCE_LABELS: Record<SinceKind, { one: string; many: string; filter: string }> = {
  fixed: { one: "fixed", many: "fixed", filter: "Fixed since you last looked" },
  urgent: { one: "new urgent", many: "new urgent", filter: "New urgent since you last looked" },
  declined: { one: "vendor declined", many: "vendors declined", filter: "Vendor declined since you last looked" },
  overdue: { one: "now overdue", many: "now overdue", filter: "Became overdue since you last looked" },
};

/** Before someone first presses "Mark as seen", the tile covers the last 7 days. */
export const FIRST_LOOK_DAYS = 7;
const DONE = ["completed_pending_review", "resolved", "closed", "cancelled"];

/**
 * When a job left limbo: the confirmation time ("resolved"), or, when no check was required, the time it
 * closed by itself. Jobs waiting for a check have neither, so they are not fixed yet.
 */
export function fixedAt(work: WorkOrder) {
  return work.resolvedAt ?? (work.requireConfirmation === false && work.status === "closed" ? work.closedAt : undefined);
}

export function isSinceKind(value: unknown): value is SinceKind { return typeof value === "string" && (SINCE_KINDS as readonly string[]).includes(value); }

/** Reads ?change=&changedFrom=&changedTo= from a list URL; anything malformed is ignored. */
export function sinceWindowFromQuery(kind?: string, from?: string, to?: string): SinceWindow | undefined {
  if (!isSinceKind(kind) || !from || !to) return undefined;
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return undefined;
  return { kind, from: new Date(a).toISOString(), to: new Date(b).toISOString() };
}

export function sinceHref(window: SinceWindow) {
  return `/app/work-orders?${new URLSearchParams({ change: window.kind, changedFrom: window.from, changedTo: window.to })}`;
}

/** Fixture rule. Windows are (from, to]: a change exactly at the last look was already seen. */
export function matchesSince(fixture: OpsFixture, work: WorkOrder, window: SinceWindow | undefined) {
  if (!window) return true;
  if (work.status === "cancelled") return false;
  const inside = (at?: string) => Boolean(at && at > window.from && at <= window.to);
  const org = work.organizationId;
  switch (window.kind) {
    case "fixed": {
      // Fixed means out of limbo: confirmed (or closed by itself when no check is required), not just reported done.
      const completed = fixture.siteVisitWorkOrders.some(link => link.organizationId === org && link.workOrderId === work.id && link.outcome === "completed")
        || (fixture.workResults ?? []).some(result => result.organizationId === org && result.workOrderId === work.id && result.outcome === "completed");
      return completed && (work.status === "resolved" || work.status === "closed") && inside(fixedAt(work));
    }
    case "urgent":
      return (work.priority === "urgent" || work.priority === "emergency") && inside(work.createdAt);
    case "declined":
      return fixture.vendorResponses.some(response => response.organizationId === org && response.workOrderId === work.id && response.response === "declined" && inside(response.respondedAt));
    case "overdue":
      return !DONE.includes(work.status) && inside(work.dueAt);
  }
}

/** SQL rule, the same as `matchesSince`; `w` is the work-order alias. */
export function sinceSql(window: SinceWindow): { sql: string; params: unknown[] } {
  const { from, to } = window;
  switch (window.kind) {
    case "fixed":
      return { sql: `w.status IN ('resolved','closed') AND COALESCE(w.resolved_at, CASE WHEN w.require_confirmation = 0 AND w.status = 'closed' THEN w.closed_at END) > ? AND COALESCE(w.resolved_at, CASE WHEN w.require_confirmation = 0 AND w.status = 'closed' THEN w.closed_at END) <= ?
        AND (EXISTS (SELECT 1 FROM ops_site_visit_work_orders sx WHERE sx.organization_id = w.organization_id AND sx.work_order_id = w.id AND sx.outcome = 'completed')
          OR EXISTS (SELECT 1 FROM ops_work_results rx WHERE rx.organization_id = w.organization_id AND rx.work_order_id = w.id AND rx.outcome = 'completed'))`, params: [from, to] };
    case "urgent":
      return { sql: "w.status <> 'cancelled' AND w.priority IN ('urgent','emergency') AND w.created_at > ? AND w.created_at <= ?", params: [from, to] };
    case "declined":
      return { sql: "w.status <> 'cancelled' AND EXISTS (SELECT 1 FROM ops_vendor_responses dx WHERE dx.organization_id = w.organization_id AND dx.work_order_id = w.id AND dx.response = 'declined' AND dx.responded_at > ? AND dx.responded_at <= ?)", params: [from, to] };
    case "overdue":
      return { sql: `w.status NOT IN (${DONE.map(() => "?").join(",")}) AND w.due_at > ? AND w.due_at <= ?`, params: [...DONE, from, to] };
  }
}

export function sinceStartFor(lastSeenAt: string | undefined, now: string) {
  return lastSeenAt && lastSeenAt < now ? lastSeenAt : new Date(Date.parse(now) - FIRST_LOOK_DAYS * 86_400_000).toISOString();
}

/** Records "Mark as seen" for the signed-in person. Insert-only: earlier looks stay as history. */
export async function markOverviewSeen(dependencies: OpsCommandServices, input: { organizationId: string; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "Sign in to mark this as seen.");
  const now = dependencies.clock?.now() ?? new Date().toISOString();
  const id = (dependencies.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` }).next("overview-seen");
  await dependencies.repository.atomicWrite([{ sql: "INSERT INTO ops_overview_seen_marks (id, organization_id, membership_id, seen_at) VALUES (?, ?, ?, ?)", params: [id, input.organizationId, input.actor.actorId, now] }]);
  return { id, seenAt: now };
}
