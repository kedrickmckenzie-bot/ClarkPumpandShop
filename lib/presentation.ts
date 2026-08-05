import type { Priority, VerificationState, VisitOutcome, WorkOrderStatus } from "@/lib/domain/types";

export const workOrderStatusLabel: Record<WorkOrderStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  awaiting_vendor_acceptance: "Awaiting vendor",
  accepted: "Accepted",
  visit_active: "Visit active",
  follow_up_required: "Follow-up required",
  waiting_on_vendor: "Waiting on vendor",
  waiting_on_quote: "Waiting on quote",
  waiting_on_approval: "Waiting on approval",
  waiting_on_parts: "Waiting on parts",
  return_visit_scheduled: "Return visit scheduled",
  completed_pending_verification: "Pending verification",
  completed_pending_invoice: "Pending invoice",
  closed: "Closed",
  reopened: "Reopened",
  cancelled: "Cancelled",
};

export const priorityLabel: Record<Priority, string> = { critical: "Critical", high: "High", routine: "Routine", low: "Low" };

export function statusTone(status: WorkOrderStatus) {
  if (["closed"].includes(status)) return "closed";
  if (["visit_active", "return_visit_scheduled"].includes(status)) return "active";
  if (["awaiting_vendor_acceptance", "waiting_on_quote", "waiting_on_approval", "waiting_on_parts", "completed_pending_invoice"].includes(status)) return "pending";
  if (["follow_up_required", "reopened"].includes(status)) return "exception";
  return "neutral";
}

export const visitOutcomeLabel: Record<VisitOutcome, string> = {
  resolved: "Completed — issue resolved",
  temporary: "Temporary resolution",
  diagnosed_unresolved: "Diagnosed — unresolved",
  unable_to_diagnose: "Unable to diagnose",
  no_issue_found: "No issue found",
  unable_to_perform: "Unable to perform service",
};

export const verificationLabel: Record<VerificationState, string> = {
  verified: "Verified",
  outside_geofence: "Outside geofence",
  inaccurate: "Location inaccurate",
  permission_denied: "Permission denied",
  exception: "Unverified exception",
};
