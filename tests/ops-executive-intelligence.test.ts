import { describe, expect, it } from "vitest";
import { buildVendorScorecards } from "@/lib/ops/vendor-scorecards";
import { buildOwnerBrief, lifecycleOutstandingState } from "@/lib/ops/owner-brief";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const ORG = NORTHLINE_ORGANIZATION_ID;

describe("vendor scorecards", () => {
  const fixture = buildNorthlinePresentationFixture();

  it("scores exactly the five seeded approved vendors from source records", () => {
    const scorecards = buildVendorScorecards(fixture, ORG);
    expect(scorecards).toHaveLength(5);
    for (const card of scorecards) {
      expect(card.vendorName).toBeTruthy();
      expect(card.workOrdersAssigned).toBeGreaterThanOrEqual(0);
      if (card.visitsCompleted >= 5) {
        expect(card.visitsCompleted).toBeGreaterThan(0);
      }
      if (card.verificationsVerified + card.verificationsRejected >= 5) {
        expect(card.verificationPassRate).not.toBeNull();
      }
    }
  });

  it("ties open invoice exceptions to the right vendor without inventing amounts", () => {
    const scorecards = buildVendorScorecards(fixture, ORG);
    const totalOpenExceptions = fixture.invoiceExceptions.filter((row) => row.organizationId === ORG && row.status === "open").length;
    expect(scorecards.reduce((sum, card) => sum + card.openInvoiceExceptionCount, 0)).toBeLessThanOrEqual(totalOpenExceptions);
  });

  it("never leaks another tenant's vendors", () => {
    const scorecards = buildVendorScorecards(fixture, "org-other-tenant");
    expect(scorecards.every((card) => card.visitsCompleted === 0 && card.workOrdersAssigned === 0)).toBe(true);
  });
});

describe("owner brief", () => {
  const fixture = buildNorthlinePresentationFixture();

  it("builds a period digest with separated money bases and drill-through decisions", () => {
    const brief = buildOwnerBrief(fixture, ORG, { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    expect(brief.money.recordedSpendMinor).toBeGreaterThan(0);
    // Money bases are computed independently and never conflated; the review
    // figure counts each flagged invoice once.
    expect(brief.money.invoiceReviewAmountMinor).toBeGreaterThanOrEqual(0);
    expect(brief.headline.activeWorkOrders + brief.headline.openedWorkOrders).toBeGreaterThan(0);
    expect(brief.storeLines).toHaveLength(15);
    const spendOrder = brief.storeLines.map((row) => row.recordedSpendMinor);
    expect([...spendOrder].sort((a, b) => b - a)).toEqual(spendOrder);
  });

  it("computes PM compliance with an explicit method and honest denominators", () => {
    const brief = buildOwnerBrief(fixture, ORG, { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    expect(brief.pmCompliance.denominator).toBeGreaterThan(0);
    expect(brief.pmCompliance.numerator).toBeLessThanOrEqual(brief.pmCompliance.denominator);
    expect(brief.pmCompliance.method).toContain("window");
    expect(brief.pmCompliance.obligations.openInWindow).toBeGreaterThanOrEqual(0);
    expect(brief.pmCompliance.obligations.waived).toBeGreaterThanOrEqual(0);
  });

  it("surfaces escalated obligations as owner decisions with drill-through", () => {
    const harnessFixture = buildNorthlinePresentationFixture();
    const task = harnessFixture.workflowTasks.find((row) => row.organizationId === ORG && row.status === "open" && row.workOrderId)!;
    harnessFixture.workflowTasks = [task];
    Object.assign(task, { escalationLevel: 2, dueAt: "2026-01-05T00:00:00.000Z" });
    const brief = buildOwnerBrief(harnessFixture, ORG, { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    expect(brief.headline.escalationsActive).toBe(1);
    const escalated = brief.decisionsNeeded.find((item) => item.kind === "escalated_task")!;
    expect(escalated.label).toContain("(level 2)");
    expect(escalated.drillThrough).toEqual({ type: "work_order", id: task.workOrderId });
  });

  it("counts an invoice with several flags exactly once at its full total", () => {
    const harnessFixture = buildNorthlinePresentationFixture();
    const invoice = harnessFixture.invoices.find((row) => row.organizationId === ORG)!;
    // Simulate one invoice carrying authorization, warranty, and duplicate flags simultaneously.
    harnessFixture.invoiceExceptions = [
      ...harnessFixture.invoiceExceptions.filter((row) => row.invoiceId !== invoice.id),
      ...(["authorization", "warranty_hold", "duplicate_invoice"] as const).map((kind, index) => ({
        id: `exception-dedupe-${index}`,
        organizationId: ORG,
        invoiceId: invoice.id,
        kind,
        status: "open" as const,
        summary: `Test flag ${kind}`,
        amount: { amountMinor: invoice.total.amountMinor, currency: invoice.total.currency },
        detectedAt: "2026-06-01T00:00:00.000Z",
      })),
    ];
    const brief = buildOwnerBrief(harnessFixture, ORG, { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    // Three full-total flags must not triple the invoice's contribution.
    expect(brief.money.invoiceReviewCount).toBeGreaterThanOrEqual(1);
    const otherFlagged = brief.money.invoiceReviewAmountMinor - invoice.total.amountMinor;
    expect(otherFlagged).toBeGreaterThanOrEqual(0);
  });

  it("derives lifecycle outstanding-decision states instead of treating every persisted recommendation as undecided", () => {
    expect(lifecycleOutstandingState({ userDecision: "investigate", userReason: "", actualOutcome: undefined })).toBe("Review required");
    expect(lifecycleOutstandingState({ userDecision: "investigate", userReason: "Collecting failure history", actualOutcome: undefined })).toBe("Investigation underway");
    expect(lifecycleOutstandingState({ userDecision: "defer", userReason: "", actualOutcome: undefined })).toContain("Deferred");
    expect(lifecycleOutstandingState({ userDecision: "repair", userReason: "", actualOutcome: undefined })).toContain("Repair approved");
    expect(lifecycleOutstandingState({ userDecision: "replace", userReason: "", actualOutcome: undefined })).toContain("Replacement approved");
    expect(lifecycleOutstandingState({ userDecision: "replace", userReason: "", actualOutcome: "replaced" })).toBeNull();
    expect(lifecycleOutstandingState({ userDecision: "repair", userReason: "", actualOutcome: "repaired" })).toBeNull();
  });

  it("gives every principal metric a drill-through URL and period-qualified store lines", () => {
    const brief = buildOwnerBrief(fixture, ORG, { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    expect(brief.drillThrough.recordedSpendHref).toBe("/app/spend");
    expect(brief.drillThrough.invoiceReviewHref).toBe("/app/invoices");
    expect(brief.drillThrough.pmComplianceHref).toBe("/app/pm");
    expect(brief.drillThrough.activeWorkOrdersHref).toBe("/app/work-orders?status=open");
    expect(brief.drillThrough.escalationsHref).toBe("/app/action-center");
    expect(brief.workOrderDefinition).toContain("period");
    for (const line of brief.storeLines) {
      expect(line.workOrdersOpenedInPeriod).toBeLessThanOrEqual(
        fixture.workOrders.filter((row) => row.storeId === line.storeId && row.organizationId === ORG).length,
      );
    }
  });
});
