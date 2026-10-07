import { civilDate } from "./dispatch-calendar";
import { addCalendarDays } from "./internal-schedule-types";
import type { WorkOrderListRow } from "./view-models";
import { cachedDateTimeFormat } from "./intl-format-cache";
import { formatOperationsDate } from "./local-time";

/** Only operational fields cross the board's client boundary. */
export type DispatchJob = Omit<WorkOrderListRow, "recordedCostMinor" | "recordedCostLineCount" | "currency"> & { storeZone?: string; storeRegionId?: string };
export function dispatchJob(row: WorkOrderListRow, storeZone?: string, storeRegionId?: string): DispatchJob {
  return { shortName: row.shortName, technicianNotes: row.technicianNotes, estimatedMinutes: row.estimatedMinutes, confirmationDelay: row.confirmationDelay, id: row.id, number: row.number, problem: row.problem, storeId: row.storeId, storeNumber: row.storeNumber, storeName: row.storeName,
    storeZone, storeRegionId, priority: row.priority, status: row.status, schedule: row.schedule, targetCompletionAt: row.targetCompletionAt,
    categoryKey: row.categoryKey, assignmentKind: row.assignmentKind, assignmentStatus: row.assignmentStatus, assignmentId: row.assignmentId,
    internalMembershipId: row.internalMembershipId, internalAssigneeName: row.internalAssigneeName, internalTarget: row.internalTarget,
    internalAccountableId: row.internalAccountableId, internalAccountableParty: row.internalAccountableParty,
    accountableParty: row.accountableParty, nextAction: row.nextAction, dueAt: row.dueAt, version: row.version,
    createdAt: row.createdAt, updatedAt: row.updatedAt, visitCount: row.visitCount, inspectionId: row.inspectionId,
    hasOpenFollowUp: row.hasOpenFollowUp, visitHoldPosture: row.visitHoldPosture, visitHoldDeadlineAt: row.visitHoldDeadlineAt,
    needsConfirmation: row.needsConfirmation, assetName: row.assetName, assetTag: row.assetTag };
}
export function friendlyZone(zone: string, at = new Date().toISOString()) {
  return cachedDateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longGeneric" }).formatToParts(new Date(at))
    .find(part => part.type === "timeZoneName")!.value.replace(/ Time$/, "");
}
export function dispatchTime(at: string, storeZone: string, organizationZone: string) {
  const text = cachedDateTimeFormat("en-US", { timeZone: storeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(at));
  return text + (storeZone !== organizationZone ? ` ${friendlyZone(storeZone, at)}` : "");
}
export function dispatchPlanLabel(plan: WorkOrderListRow["schedule"], organizationZone: string) {
  if (!plan) return "No date yet";
  if (plan.precision === "week") return `Week of ${formatOperationsDate(plan.week)} · Choose a day`;
  if (plan.startsAt) return dispatchTime(plan.startsAt, plan.entryZone ?? plan.planningZone, organizationZone);
  return formatOperationsDate(plan.day ?? plan.week);
}
export function dispatchStatus(row: Pick<WorkOrderListRow, "status" | "hasOpenFollowUp" | "visitHoldPosture" | "internalTarget"> & {assignmentKind?:WorkOrderListRow["assignmentKind"]}) {
  if (row.status === "waiting_on_parts") return { label: "Waiting on parts", tone: "waiting" };
  if (row.status === "waiting_on_vendor") return { label: "Waiting on vendor", tone: "waiting" };
  if (row.status === "completed_pending_review") return { label: "Reported done, needs a check", tone: "done" };
  if (row.status === "resolved" || row.status === "closed") return { label: "Confirmed", tone: "done" };
  if (row.status === "in_progress") return { label: "Work started", tone: "started" };
  if (row.hasOpenFollowUp) return { label: "Waiting on manager", tone: "waiting" };
  if (row.visitHoldPosture) return { label: "Do on next visit", tone: "normal" };
  if (row.assignmentKind === "outside_vendor") return {label:row.status === "scheduled" ? "Vendor visit planned" : row.status === "accepted" ? "Vendor accepted" : row.status === "issued" ? "Waiting on vendor" : "Manager arranging work",tone:row.status === "issued" ? "waiting" : "normal"};
  if (row.internalTarget !== "person") return { label: "Needs a technician", tone: "normal" };
  return { label: "Ready to work", tone: "normal" };
}
export function canPlanJob(row: DispatchJob) {
  return Boolean(row.assignmentId && !row.inspectionId && !row.hasOpenFollowUp && !row.visitHoldPosture && !["draft", "awaiting_approval", "in_progress", "completed_pending_review", "resolved", "closed", "cancelled"].includes(row.status));
}
const priorityRank: Record<string, number> = { emergency: 3, urgent: 2, routine: 1, planned: 0 };

/** One order for a day's jobs, shared by My work and "What's next": stop order, start time, most urgent, soonest due. */
export function orderedStops<T extends Pick<DispatchJob, "id" | "schedule" | "priority" | "dueAt">>(rows: T[]) {
  return [...rows].sort((a, b) => ((a.schedule?.stopOrder ?? 1000000) - (b.schedule?.stopOrder ?? 1000000)) || (a.schedule?.startsAt ?? "9999").localeCompare(b.schedule?.startsAt ?? "9999")
    || (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0)
    || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")
    || a.id.localeCompare(b.id));
}

export function dueLabel(job:Pick<DispatchJob,"dueAt"|"storeZone">,today:string,zone:string,at=new Date().toISOString()) {
  if(!job.dueAt)return "";
  const localZone=job.storeZone??zone, date=civilDate(job.dueAt,localZone);
  const time=cachedDateTimeFormat("en-US",{timeZone:localZone,hour:"numeric",minute:"2-digit"}).format(new Date(job.dueAt)).replace(":00","").replace("12 PM","noon");
  const label=date===today?"today":date===addCalendarDays(today,1)?"tomorrow":cachedDateTimeFormat("en-US",{timeZone:localZone,month:"short",day:"numeric"}).format(new Date(job.dueAt));
  return `${Date.parse(job.dueAt)<Date.parse(at)?"Late · due":"Due"} ${label}, ${time}`;
}
