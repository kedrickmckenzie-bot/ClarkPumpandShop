import type { WorkOrderListRow } from "./view-models";

/** Immutable live-plan revision. Calendar values are never fictitious appointments. */
export interface InternalSchedule {
  id: string;
  organizationId: string;
  workOrderId: string;
  assignmentId: string;
  revision: number;
  attempt: number;
  precision: "week" | "day" | "appointment" | "removed";
  planningZone: string;
  week: string;
  day?: string;
  startsAt?: string;
  endsAt?: string;
  entryZone?: string;
  localStart?: string;
  disambiguation?: "earlier" | "later";
  durationMinutes?: number;
  stopOrder?: number;
  tentative: boolean;
  reviewReason?: string;
  supersedesId?: string;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
}

export interface ScheduleProjection {
  reviewReason?: string; localStart?: string; disambiguation?: "earlier" | "later";
  id: string;
  precision: InternalSchedule["precision"];
  planningZone: string;
  week: string;
  day?: string;
  startsAt?: string;
  endsAt?: string;
  entryZone?: string;
  tentative: boolean;
  durationMinutes?: number;
  stopOrder?: number;
}

export type ScheduleView = "backlog" | "week" | "today" | "upcoming" | "replan";
export function scheduleMatches(row: Pick<WorkOrderListRow, "schedule">, view?: ScheduleView, from?: string, to?: string) {
  const p = row.schedule;
  if (!view) return true;
  if (view === "backlog") return !p;
  if (!p || !from) return false;
  const calendar = p.day ?? p.week;
  if (view === "today") return p.precision !== "week" && calendar === from;
  if (view === "week") return p.precision === "week" ? p.week >= from && p.week <= (to ?? from) : calendar >= from && calendar <= (to ?? from);
  const weekEnd = addCalendarDays(p.week, 6);
  if (view === "upcoming") return p.precision === "week" ? weekEnd >= from : calendar > from;
  return p.precision === "week" ? weekEnd < from : calendar < from;
}

export function addCalendarDays(value: string, count: number) {
  return new Date(Date.parse(value + "T12:00:00Z") + count * 86400000).toISOString().slice(0, 10);
}
