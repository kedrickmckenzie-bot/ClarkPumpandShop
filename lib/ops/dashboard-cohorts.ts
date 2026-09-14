import type { OpsFixture, WorkOrder } from "./types";
import { selectWorkflowTaskProjection } from "./workflow-task-commands";

/** Shared by dashboard counts and repository-backed queue filters. */
export const PENDING_REQUEST_STATUSES = ["submitted", "under_review"] as const;
export const WORK_STAGE_STATUSES: Record<string, readonly string[]> = {
  "not-sent": ["approved"],
  "vendor-response": ["issued", "waiting_on_vendor"],
};

export function matchesRequestStatus(request: { status: string; linkedWorkOrderId?: string }, status?: string) {
  return !status || (status === "pending"
    ? PENDING_REQUEST_STATUSES.some((value) => value === request.status)
    : status === "acknowledged_unlinked"
      ? request.status === "acknowledged" && !request.linkedWorkOrderId
      : request.status === status);
}

export function matchesWorkStage(work: WorkOrder, stage: string | undefined, fixture: OpsFixture) {
  if (!stage) return true;
  if (!WORK_STAGE_STATUSES[stage]?.includes(work.status)) return false;
  if (stage !== "vendor-response") return true;
  const assignment = fixture.assignments.filter((row) => row.organizationId === work.organizationId && row.workOrderId === work.id)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt) || b.id.localeCompare(a.id))[0];
  if (!assignment?.vendorId || assignment.kind !== "outside_vendor" || !["pending", "issued", "opened", "accepted"].includes(assignment.status)) return false;
  const primary = selectWorkflowTaskProjection(fixture.workflowTasks.filter((task) => task.organizationId === work.organizationId && task.workOrderId === work.id));
  if (primary) return primary.assigneeType === "vendor" && primary.assigneeId === assignment.vendorId;
  // Older records may predate typed tasks. Never classify an operator-owned step as a vendor wait.
  return fixture.vendors.some((vendor) => vendor.organizationId === work.organizationId && vendor.id === assignment.vendorId && vendor.name === work.accountableParty);
}

export function visitHasWork(fixture: OpsFixture, visit: OpsFixture["visits"][number]) {
  return Boolean(visit.workOrderId || fixture.siteVisitWorkOrders.some((link) => link.organizationId === visit.organizationId && link.visitId === visit.id));
}

/** Invoice records the caller can open in full; references and allocations are separate entities. */
export function scopedInvoiceRecords(fixture: OpsFixture, organizationId: string, storeIds: ReadonlySet<string>) {
  return fixture.invoices.filter((invoice) => {
    if (invoice.organizationId !== organizationId) return false;
    const lineIds = new Set(fixture.invoiceLines.filter((line) => line.organizationId === organizationId && line.invoiceId === invoice.id).map((line) => line.id));
    const allocations = fixture.invoiceLineAllocations.filter((allocation) => allocation.organizationId === organizationId && lineIds.has(allocation.invoiceLineId));
    return allocations.length > 0 && allocations.every((allocation) => storeIds.has(allocation.storeId));
  });
}
