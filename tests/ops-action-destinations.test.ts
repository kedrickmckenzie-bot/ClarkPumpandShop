import { describe, expect, it } from "vitest";
import { nextActionRedirect, workflowTaskActionLabel, workflowTaskHref } from "@/lib/ops/workflow-task-destination";
import { presentAttentionRow } from "@/app/app/_data/attention-presenter";
import type { AttentionQueueRow } from "@/lib/ops/attention-query";

const row = (patch: Partial<AttentionQueueRow>): AttentionQueueRow => ({
  id: "task-1", sourceKind: "workflow_task", sourceCount: 1, title: "Accept or counter ColdLine's proposed service date",
  reason: "ColdLine proposed a time.", owner: "Facilities coordinator", dueAt: "2026-10-02T17:00:00.000Z",
  priority: "high", lane: "mine", group: "work_vendor", workOrderId: "wo-1", linkHref: "/app/work-orders/wo-1?view=service#vendor-response", ...patch,
});

describe("queue action destinations", () => {
  it("sends each work-order task to where that task is done", () => {
    expect(workflowTaskHref({ taskType: "schedule_service", workOrderId: "wo 1" })).toBe("/app/work-orders/wo%201?view=service#vendor-response");
    expect(workflowTaskHref({ taskType: "choose_service_provider", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?view=service#issue-work");
    expect(workflowTaskHref({ taskType: "verify_repair", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?view=confirmation#work-verification");
    expect(workflowTaskHref({ taskType: "approve_quote", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?view=service&path=bids#bid-requests");
  });

  it("names exactly the place each link opens", () => {
    const cases: Array<[string, string]> = [["schedule_service", "#vendor-response"], ["vendor_response_required", "#vendor-response"], ["choose_service_provider", "#issue-work"], ["verify_repair", "#work-verification"], ["approve_quote", "#bid-requests"], ["other", "next=action"]];
    const labels: Record<string, string> = { "#vendor-response": "Review", "#issue-work": "Choose vendor", "#work-verification": "Confirm result", "#bid-requests": "Review quotes", "next=action": "Open next step" };
    for (const [taskType, place] of cases) {
      expect(workflowTaskHref({ taskType, workOrderId: "wo-1" })).toContain(place);
      expect(workflowTaskActionLabel({ taskType, workOrderId: "wo-1" })).toContain(labels[place]);
    }
  });

  it("keeps standalone tasks on the task list and request tasks on the request", () => {
    expect(workflowTaskHref({ taskType: "confirm_store_access", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?view=accountability#workflow-tasks");
    expect(workflowTaskHref({ taskType: "resolve_invoice_exception", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?view=accountability#workflow-tasks");
    expect(workflowTaskHref({ taskType: "other", workOrderId: "wo-1" })).toBe("/app/work-orders/wo-1?next=action");
    expect(workflowTaskHref({ taskType: "review_issue", serviceRequestId: "req-1" })).toBe("/app/requests/req-1");
  });

  it("keeps review-queue navigation when resolving the next action", () => {
    expect(nextActionRedirect("/app/work-orders/wo-1?view=service#vendor-response", { next: "action", reviewQueue: "/app/action-center?lane=mine", reviewItem: "task-1", reviewAfter: "task-2,task-3" }))
      .toBe("/app/work-orders/wo-1?view=service&reviewQueue=%2Fapp%2Faction-center%3Flane%3Dmine&reviewItem=task-1&reviewAfter=task-2%2Ctask-3#vendor-response");
  });

  it("names the action each row opens", () => {
    const asOf = "2026-10-01T12:00:00.000Z";
    expect(presentAttentionRow(row({ taskType: "schedule_service" }), asOf).link.label).toBe("Review visit date");
    expect(presentAttentionRow(row({ taskType: "verify_repair", group: "completion" }), asOf).link.label).toBe("Confirm result");
    expect(presentAttentionRow(row({ taskType: "choose_service_provider" }), asOf).link.label).toBe("Choose vendor");
    expect(presentAttentionRow(row({ sourceKind: "quote_round", taskType: undefined }), asOf).link.label).toBe("Review quotes");
    expect(presentAttentionRow(row({ sourceKind: "exception", taskType: undefined, group: "financial", reason: "invoice_without_work_order" }), asOf).link.label).toBe("Review invoice");
    expect(presentAttentionRow(row({ lane: "history" }), asOf).link.label).toBe("View history");
  });
});
