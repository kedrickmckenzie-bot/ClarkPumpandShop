import { describe, expect, it } from "vitest";
import { nextActionRedirect, workflowTaskActionLabel, workflowTaskHref } from "@/lib/ops/workflow-task-destination";
import { presentAttentionRow, routeInspectionRows } from "@/app/app/_data/attention-presenter";
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
    const cases: Array<[string, string, string]> = [["schedule_service", "#vendor-response", "Accept or change date"], ["vendor_response_required", "#vendor-response", "Answer vendor"], ["choose_service_provider", "#issue-work", "Choose vendor"], ["verify_repair", "#work-verification", "Confirm result"], ["approve_quote", "#bid-requests", "Review quotes"], ["other", "next=action", "Open next step"]];
    for (const [taskType, place, label] of cases) {
      expect(workflowTaskHref({ taskType, workOrderId: "wo-1" })).toContain(place);
      expect(workflowTaskActionLabel({ taskType, workOrderId: "wo-1" })).toBe(label);
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
    expect(presentAttentionRow(row({ taskType: "schedule_service" }), asOf).link.label).toBe("Accept or change date");
    expect(presentAttentionRow(row({ taskType: "verify_repair", group: "completion" }), asOf).link.label).toBe("Confirm result");
    expect(presentAttentionRow(row({ taskType: "choose_service_provider" }), asOf).link.label).toBe("Choose vendor");
    expect(presentAttentionRow(row({ sourceKind: "quote_round", taskType: undefined }), asOf).link.label).toBe("Review quotes");
    expect(presentAttentionRow(row({ sourceKind: "exception", taskType: undefined, group: "financial", reason: "invoice_without_work_order" }), asOf).link.label).toBe("Review invoice");
    expect(presentAttentionRow(row({ lane: "history" }), asOf).link.label).toBe("View history");
  });

  it("sends only result-review rows on inspection work to the inspection", async () => {
    const repository = { inspectionForWork: async () => ({ id: "insp-1", status: "performed", correctiveWorkOrderId: undefined }) } as never;
    const items = [
      row({ id: "date", taskType: "schedule_service" }),
      row({ id: "invoice", sourceKind: "exception", group: "financial", linkHref: "/app/invoices/inv-1" }),
      row({ id: "confirm", taskType: "verify_repair", group: "completion", linkHref: "/app/work-orders/wo-1?view=confirmation#work-verification" }),
      row({ id: "follow", sourceKind: "follow_up", group: "completion", linkHref: "/app/action-center/fu-1" }),
    ];
    const actions = items.map((item) => presentAttentionRow(item, "2026-10-02T12:00:00.000Z"));
    const before = actions.map((action) => action.link.href);
    await routeInspectionRows(repository, "org", items, actions);
    expect(actions[0].link.href).toBe(before[0]);
    expect(actions[1].link.href).toBe(before[1]);
    expect(actions[2].link).toEqual({ href: "/app/compliance/insp-1", label: "Review findings" });
    expect(actions[3].link.href).toBe(before[3]);
  });
});
