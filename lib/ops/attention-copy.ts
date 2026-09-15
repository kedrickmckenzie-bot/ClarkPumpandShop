import type { ExceptionKind } from './types';

export const reviewQueueExceptionCopy: Record<ExceptionKind, { label: string; title: string }> = {
  no_work_order: { label: "Visit without a work order", title: "Create or link a work order" },
  unexpected_visit: { label: "Unplanned visit", title: "Review an unplanned vendor visit" },
  missing_checkout: { label: "Missing checkout", title: "Close or follow up on an open visit" },
  outside_geofence: { label: "Check-in outside store area", title: "Review the check-in location" },
  low_accuracy_location: { label: "Weak location data", title: "Review a check-in with weak location data" },
  duplicate_active_visit: { label: "Possible duplicate visits", title: "Check for a duplicate visit" },
  unmatched_invoice: { label: "Invoice not linked", title: "Link the invoice to the right work" },
  amount_above_authorization: { label: "Cost above approved amount", title: "Review a cost above the approved amount" },
  overdue_pm: { label: "Scheduled maintenance is overdue", title: "Review overdue preventive maintenance" },
};

