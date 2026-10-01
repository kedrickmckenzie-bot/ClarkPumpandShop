import { describe, expect, it } from "vitest";
import { nextActionRedirect, workflowTaskHref } from "@/lib/ops/workflow-task-destination";
import { presentAttentionRow } from "@/app/app/_data/attention-presenter";
import type { AttentionQueueRow } from "@/lib/ops/attention-query";

const row = (patch: Partial<AttentionQueueRow>): AttentionQueueRow => ({
  id: "task-1", sourceKind: "workflow_task", sourceCount: 1, title: "Accept or counter ColdLine's proposed service date",
  reason: "ColdLine proposed a time.", owner: "Facilities coordinator", dueAt: "2026-10-02T17:00:00.000Z",
  priority: "high", lane: "mine", group: "work_vendor", linkHref: "/app/work-orders/wo-1?next=action", ...patch,
});

describe("queue action destinations", () => {
  it("sends work-order stage tasks to the work order's current action, not the task list", () => {
    for (const taskType of ["schedule_service", "vendor_response_required", "choose_service_provider", "verify_repair", "approve_quote"]) {
      expect(workflowTaskHref({ taskType, workOrderId: "wo 1" })).toBe("/app/work-orders/wo%201?next=action");
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
