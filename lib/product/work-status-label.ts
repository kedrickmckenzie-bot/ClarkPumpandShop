import type { WorkOrder } from "@/lib/ops/types";

/** A status describes the work; the separate next-action owner says who must act. */
export function workStatusLabel(status: WorkOrder["status"]): string {
  return {
    draft: "Draft", awaiting_approval: "Approval needed", approved: "Approved · not sent",
    issued: "Sent to vendor", accepted: "Vendor accepted", scheduled: "Scheduled",
    in_progress: "Work in progress", waiting_on_vendor: "Vendor follow-up", waiting_on_parts: "Waiting on parts",
    completed_pending_review: "Completed · review needed", resolved: "Closeout ready", closed: "Closed", cancelled: "Cancelled",
  }[status];
}
