import type { WorkOrderListRow } from "./view-models";
import { cachedDateTimeFormat } from "./intl-format-cache";
import { formatOperationsDate } from "./local-time";

/** Only operational fields cross the board's client boundary. */
export type DispatchJob = Omit<WorkOrderListRow, "recordedCostMinor" | "recordedCostLineCount" | "currency"> & { storeZone?: string };
export function dispatchJob(row: WorkOrderListRow, storeZone?: string): DispatchJob {
  return { id: row.id, number: row.number, problem: row.problem, storeId: row.storeId, storeNumber: row.storeNumber, storeName: row.storeName,
    storeZone, priority: row.priority, status: row.status, schedule: row.schedule, targetCompletionAt: row.targetCompletionAt,
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
  return Boolean(row.assignmentId && !row.inspectionId && !["draft", "awaiting_approval", "in_progress", "completed_pending_review", "resolved", "closed", "cancelled"].includes(row.status));
}
export function orderedStops(rows: DispatchJob[]) {
  return [...rows].sort((a, b) => (a.schedule?.startsAt ?? "9999").localeCompare(b.schedule?.startsAt ?? "9999")
    || ({ emergency: 0, urgent: 1, routine: 2, planned: 3 }[a.priority] - { emergency: 0, urgent: 1, routine: 2, planned: 3 }[b.priority])
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
