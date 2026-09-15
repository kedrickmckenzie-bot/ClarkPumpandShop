import type { ActionItemViewModel, OperatorSession } from "@/components/ops/data-contract";
import { roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import type { AttentionAccess, AttentionQueueRow } from "@/lib/ops/attention-query";
import type { ExceptionKind } from "@/lib/ops/types";
import { formatOperationsDate } from "@/lib/ops/local-time";

export function attentionAccess(session: OperatorSession): AttentionAccess {
  return {
    role: session.role === "facilities" ? "facilities_admin" : session.role === "regional" ? "regional_manager" : session.role === "finance" ? "finance_reviewer" : session.role,
    membershipId: session.membershipId,
    canOpenWarranty: roleCanOpenOperatorHref(session.role, "/app/warranties/record"),
    canOpenRequest: roleCanOpenOperatorHref(session.role, "/app/requests/record"),
    accountabilityOnly: session.demoEdition === "accountability",
  };
}

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

/** Dashboard rows show the next step; full source details stay on the linked record. */
export function presentAttentionRow(item: AttentionQueueRow, asOf: string): ActionItemViewModel {
  const exception = item.sourceKind === "exception";
  const copy = exception ? reviewQueueExceptionCopy[item.reason as ExceptionKind] : undefined;
  const overdue = Boolean(item.dueAt && Date.parse(item.dueAt) <= Date.parse(asOf));
  const waiting = item.lane === "waiting";
  const categoryLabel = item.group === "financial" ? "Financial review" : item.group === "completion" ? "Completion check" : exception ? "Service record to check" : item.sourceKind === "vendor_reminder" ? "Vendor relationship" : "Work and vendor decision";
  const date = (value: string) => formatOperationsDate(value);
  return {
    id: item.id, title: copy?.title ?? item.title, description: exception ? item.title : item.reason, categoryLabel,
    attentionType: exception ? "service_record" : item.sourceKind === "vendor_reminder" ? "vendor_task" : "follow_up",
    attentionLane: item.lane, attentionGroup: item.group, sourceCount: item.sourceCount,
    reasonLabel: copy?.label ?? (waiting ? "Waiting on another party" : item.lane === "mine" ? "Needs my action" : item.lane === "upcoming" ? "Upcoming review" : "Team work"),
    storeLabel: item.storeLabel ?? "Companywide", recordLabel: item.workNumber ?? item.requestReference ?? item.vendorName ?? categoryLabel,
    dueAt: item.dueAt, dueLabel: exception ? `Open since ${date(item.dueAt!)}` : !item.dueAt ? "No deadline — reason recorded" : overdue && waiting ? `Commitment missed ${date(item.dueAt)}` : overdue ? `Overdue since ${date(item.dueAt)}` : `Due ${date(item.dueAt)}`,
    ownerLabel: item.owner, priorityLabel: overdue ? "Overdue" : item.priority === "critical" ? "Critical" : item.priority[0].toUpperCase() + item.priority.slice(1),
    tone: overdue || item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "neutral",
    link: { href: item.linkHref, label: exception ? "Review and decide" : "Open review" },
  };
}
