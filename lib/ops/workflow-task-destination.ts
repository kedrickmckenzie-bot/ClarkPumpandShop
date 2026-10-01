import type { WorkflowTaskType } from "./types";

/**
 * Task types completed on the task itself (a separate internal job, an invoice
 * or discrepancy answer). Every other work-order task mirrors the work order's
 * own next step, so a queue link lands where that step is actually done
 * (vendor response, confirmation, quotes, inspection) rather than on the task list.
 */
const TASK_LIST_TYPES = new Set<WorkflowTaskType>([
  "confirm_store_access",
  "resolve_invoice_exception",
  "respond_service_discrepancy",
]);

export function workOrderNextActionHref(workOrderId: string) {
  return `/app/work-orders/${encodeURIComponent(workOrderId)}?next=action`;
}

export function workflowTaskHref(input: { taskType?: string; workOrderId?: string; serviceRequestId?: string }) {
  if (input.workOrderId) {
    return input.taskType && TASK_LIST_TYPES.has(input.taskType as WorkflowTaskType)
      ? `/app/work-orders/${encodeURIComponent(input.workOrderId)}?view=accountability#workflow-tasks`
      : workOrderNextActionHref(input.workOrderId);
  }
  return `/app/requests/${encodeURIComponent(input.serviceRequestId!)}`;
}

const REVIEW_PARAMETERS = ["reviewQueue", "reviewItem", "reviewAfter", "reviewNext"] as const;

/** Resolve `?next=action` to the work order's current action, keeping queue navigation. */
export function nextActionRedirect(actionHref: string, query: Record<string, string | string[] | undefined>) {
  const url = new URL(actionHref, "https://ops.invalid");
  for (const name of REVIEW_PARAMETERS) {
    const value = query[name];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) url.searchParams.set(name, first);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
