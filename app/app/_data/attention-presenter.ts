import type { OpsRepository } from "@/lib/ops/repository";
import { reviewQueueExceptionCopy } from '@/lib/ops/attention-copy';
import type { ActionItemViewModel, OperatorSession } from "@/components/ops/data-contract";
import { roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import type { AttentionAccess, AttentionQueueRow } from "@/lib/ops/attention-query";
import type { ExceptionKind } from "@/lib/ops/types";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { workflowTaskActionLabel } from "@/lib/ops/workflow-task-destination";
import { INSPECTION_RESULT_TASK_TYPES } from "@/lib/ops/attention-projection";

export function attentionAccess(session: OperatorSession): AttentionAccess {
  return {
    role: session.role === "facilities" ? "facilities_admin" : session.role === "regional" ? "regional_manager" : session.role === "finance" ? "finance_reviewer" : session.role,
    membershipId: session.membershipId,
    canOpenWarranty: roleCanOpenOperatorHref(session.role, "/app/warranties/record"),
    canOpenRequest: roleCanOpenOperatorHref(session.role, "/app/requests/record"),
    accountabilityOnly: session.demoEdition === "accountability",
  };
}

export { reviewQueueExceptionCopy } from '@/lib/ops/attention-copy';

/** A short verb phrase naming what happens when the row is opened. */
function actionLabel(item: AttentionQueueRow, exception: boolean) {
  if (item.lane === "history") return "View history";
  // Same table as the row's link, so the label always names the place it opens.
  if (item.sourceKind === "workflow_task") return workflowTaskActionLabel(item);
  if (item.sourceKind === "quote_round") return "Review quotes";
  if (item.sourceKind === "held_work") return "Review saved job";
  if (item.sourceKind === "vendor_reminder") return "Open vendor";
  if (item.sourceKind === "inspection_review") return "Review findings";
  if (exception) return item.group === "financial" ? "Review invoice" : "Check record";
  return item.group === "completion" ? "Confirm result" : "Open follow-up";
}

/** Dashboard rows show the next step; full source details stay on the linked record. */
export function presentAttentionRow(item: AttentionQueueRow, asOf: string): ActionItemViewModel {
  const history = item.lane === "history";
  const exception = item.sourceKind === "exception";
  const copy = exception ? reviewQueueExceptionCopy[item.reason as ExceptionKind] : undefined;
  // An inspection review carries the inspection's due date; the review itself is not "overdue".
  const inspectionReview = item.sourceKind === "inspection_review";
  const overdue = !inspectionReview && Boolean(item.dueAt && Date.parse(item.dueAt) <= Date.parse(asOf));
  const waiting = item.lane === "waiting";
  const categoryLabel = item.sourceKind === "inspection_review" ? "Inspection review" : item.group === "financial" ? "Financial review" : item.group === "completion" ? "Completion check" : exception ? "Service record to check" : item.sourceKind === "vendor_reminder" ? "Vendor relationship" : "Work and vendor decision";
  const date = (value: string) => formatOperationsDate(value);
  return {
    id: item.id, title: copy?.title ?? item.title, description: exception ? item.title : item.reason, categoryLabel,
    attentionType: exception ? "service_record" : item.sourceKind === "vendor_reminder" ? "vendor_task" : "follow_up",
    attentionLane: item.lane, attentionGroup: item.group, sourceCount: item.sourceCount,
    reasonLabel: copy?.label ?? (waiting ? "Waiting on another party" : item.lane === "mine" ? "Needs my action" : item.lane === "upcoming" ? "Upcoming review" : "Team work"),
    storeLabel: item.storeLabel ?? "Companywide", recordLabel: item.workNumber ?? item.requestReference ?? item.vendorName ?? categoryLabel,
    dueAt: item.dueAt, dueLabel: history ? item.completedAt ? `Ended ${date(item.completedAt)}` : "End date not recorded" : inspectionReview && item.dueAt ? `Inspection due ${date(item.dueAt)}` : exception ? `Open since ${date(item.dueAt!)}` : !item.dueAt ? "No deadline — reason recorded" : overdue && waiting ? `Missed promised date ${date(item.dueAt)}` : overdue ? `Overdue since ${date(item.dueAt)}` : `Due ${date(item.dueAt)}`,
    ownerLabel: item.owner, priorityLabel: history ? "Completed / canceled" : overdue ? "Overdue" : item.priority === "critical" ? "Critical" : item.priority[0].toUpperCase() + item.priority.slice(1),
    tone: history ? "neutral" : overdue || item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "neutral",
    link: { href: item.linkHref, label: actionLabel(item, exception) },
  };
}


const INSPECTION_RESULT_TASKS = new Set<string>(INSPECTION_RESULT_TASK_TYPES);

/**
 * Result-review rows for inspection work (record the outcome, confirm, close) open the
 * inspection, where findings and paperwork are reviewed. Every other row on the same
 * job — a vendor's date reply, an invoice, a quote — keeps its own destination.
 */
export async function routeInspectionRows(repository: Pick<OpsRepository, "inspectionForWork">, organizationId: string, items: readonly AttentionQueueRow[], actions: ActionItemViewModel[]) {
  await Promise.all(items.map(async (item, index) => {
    if (!item.workOrderId || item.lane === "history" || !INSPECTION_RESULT_TASKS.has(item.taskType ?? "") || !actions[index]) return;
    const inspection = await repository.inspectionForWork(organizationId, item.workOrderId);
    if (!inspection || inspection.correctiveWorkOrderId === item.workOrderId || inspection.status === "passed") return;
    actions[index].link = { href: `/app/compliance/${encodeURIComponent(inspection.id)}`, label: inspection.status === "pending" ? "Open inspection" : "Review findings" };
  }));
}
