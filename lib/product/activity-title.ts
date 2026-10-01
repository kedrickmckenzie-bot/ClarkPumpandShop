/** Plain titles for work history entries, from the recorded event type. */
const TITLES: Record<string, string> = {
  "request.submitted": "Store reported the problem",
  "work_order.created": "Work order created",
  "work_order.assigned": "Assigned",
  "work_order.issued": "Work order sent",
  "work_order.cost_recorded": "Cost added",
  "work_order.visit_started": "Technician checked in",
  "visit.checked_in": "Technician checked in",
  "visit.checked_out": "Technician checked out",
  "vendor.response_recorded": "Vendor replied",
  "work_order_estimate.requested": "Price requested",
  "vendor_estimate.submitted": "Vendor sent a price",
  "approval.requested": "Approval requested",
  "warranty_case.detected": "Possible warranty found",
  "invoice_reference.recorded": "Invoice added",
  "invoice.exception_flagged": "Invoice flagged for review",
  "workflow_task.created": "Follow-up created",
  "file.available": "File added",
};

export function activityTitle(eventType: string): string {
  const revision = eventType.match(/^(.*)\.r(\d+)$/);
  if (revision) return `${activityTitle(revision[1])} (version ${revision[2]})`;
  if (TITLES[eventType]) return TITLES[eventType];
  const words = eventType.replace(/[._]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
