import { describe, expect, it } from "vitest";
import { demoData, STORY_REPORT_ID, STORY_WORK_ORDER_ID } from "@/lib/demo/data";
import { canCloseWorkOrder, followUpForOutcome } from "@/lib/domain/workflow";

describe("report → review → work → vendor → visit → follow-up → close", () => {
  it("preserves the source report and resolves each customer-side control", () => {
    const report = demoData.reports.find((item) => item.id === STORY_REPORT_ID)!;
    const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
    const reviews = demoData.reportReviews.filter((item) => item.reportId === report.id);
    const response = demoData.vendorResponses.find((item) => item.workOrderId === workOrder.id)!;
    const visits = demoData.visits.filter((item) => item.workOrderId === workOrder.id);
    const unresolved = visits.find((item) => item.outcome === "diagnosed_unresolved")!;
    const generated = followUpForOutcome(workOrder, unresolved, unresolved.outcome!, unresolved.checkedOutAt!);
    const stored = demoData.followUps.find((item) => item.sourceVisitId === unresolved.id)!;
    const allocations = demoData.allocations.filter((item) => item.workOrderId === workOrder.id);

    expect(report.originalDescription).toBe("Beer cave feels warm and the fans sound louder than usual. The thermometer near the door reads 49°F.");
    expect(reviews.map((item) => item.decision)).toEqual(["Confirmed · vendor escalation recommended", "Approved urgent escalation"]);
    expect(workOrder.reportIds).toContain(report.id);
    expect(response.response).toBe("accepted");
    expect(visits.map((item) => item.outcome)).toEqual(["diagnosed_unresolved", "resolved"]);
    expect(stored.nextAction).toBe(generated?.nextAction);
    expect(stored.status).toBe("completed");
    expect(allocations.reduce((sum, item) => sum + item.amountCents, 0)).toBe(495_000);
    expect(canCloseWorkOrder(workOrder, demoData.followUps).allowed).toBe(true);
    expect(workOrder.status).toBe("closed");
    expect(workOrder.closedAt).toBeTruthy();
  });
});
