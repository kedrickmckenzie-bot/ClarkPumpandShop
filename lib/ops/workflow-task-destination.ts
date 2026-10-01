import type { WorkflowTaskType } from "./types";

/**
 * Where each work-order task is done, and the words for it. Labels and links come
 * from this one table so a queue row never promises one action and opens another.
 */
const TASK_DESTINATIONS: Partial<Record<WorkflowTaskType, { view: string; label: string }>> = {
  vendor_response_required: { view: "view=service#vendor-response", label: "Answer vendor" },
  schedule_service: { view: "view=service#vendor-response", label: "Accept or change date" },
  choose_service_provider: { view: "view=service#issue-work", label: "Choose vendor" },
  schedule_return_visit: { view: "view=service", label: "Arrange next visit" },
  approve_quote: { view: "view=service&path=bids#bid-requests", label: "Review quotes" },
  submit_quote: { view: "view=service&path=bids#bid-requests", label: "Review quotes" },
  record_service_outcome: { view: "view=visits", label: "Record result" },
  verify_repair: { view: "view=confirmation#work-verification", label: "Confirm result" },
  close_verified_work: { view: "view=confirmation#work-verification", label: "Close work" },
};

/** Tasks completed on the task itself (a separate job, an invoice or discrepancy answer). */
const TASK_LIST_TYPES = new Set<WorkflowTaskType>([
  "confirm_store_access",
  "resolve_invoice_exception",
  "respond_service_discrepancy",
]);

const TASK_LIST_LABELS: Partial<Record<WorkflowTaskType, string>> = {
  resolve_invoice_exception: "Review invoice",
  respond_service_discrepancy: "Open task",
  confirm_store_access: "Open task",
};

export function workOrderNextActionHref(workOrderId: string) {
  return `/app/work-orders/${encodeURIComponent(workOrderId)}?next=action`;
}

export function workflowTaskHref(input: { taskType?: string; workOrderId?: string; serviceRequestId?: string }) {
  const type = input.taskType as WorkflowTaskType | undefined;
  if (input.workOrderId) {
    const base = `/app/work-orders/${encodeURIComponent(input.workOrderId)}`;
    if (type && TASK_LIST_TYPES.has(type)) return `${base}?view=accountability#workflow-tasks`;
    const destination = type ? TASK_DESTINATIONS[type] : undefined;
    // Other tasks follow the work order's current step (for example, an inspection opens the inspection).
    return destination ? `${base}?${destination.view}` : workOrderNextActionHref(input.workOrderId);
  }
  return `/app/requests/${encodeURIComponent(input.serviceRequestId!)}`;
}

/** The label for the place `workflowTaskHref` opens. */
export function workflowTaskActionLabel(input: { taskType?: string; workOrderId?: string }) {
  const type = input.taskType as WorkflowTaskType | undefined;
  if (type === "review_warranty") return "Review warranty";
  if (!input.workOrderId) return "Review report";
  if (type && TASK_LIST_TYPES.has(type)) return TASK_LIST_LABELS[type] ?? "Open task";
  return (type && TASK_DESTINATIONS[type]?.label) ?? "Open next step";
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
