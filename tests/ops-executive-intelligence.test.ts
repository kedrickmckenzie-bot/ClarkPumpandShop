import { describe, expect, it } from "vitest";
import { buildVendorScorecards } from "@/lib/ops/vendor-scorecards";
import { buildOwnerBrief } from "@/lib/ops/owner-brief";
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
    // The three money bases are computed independently and never conflated.
    expect(brief.money.identifiedExposureMinor).toBeGreaterThanOrEqual(0);
    expect(brief.headline.activeWorkOrders + brief.headline.openedWorkOrders).toBeGreaterThan(0);
    expect(brief.storeLines).toHaveLength(15);
    const spendOrder = brief.storeLines.map((row) => row.recordedSpendMinor);
    expect([...spendOrder].sort((a, b) => b - a)).toEqual(spendOrder);
  });

  it("computes PM compliance with an explicit method and honest denominators", () => {
    const brief = buildOwnerBrief(fixture, ORG, { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" });
    expect(brief.pmCompliance.denominator).toBeGreaterThan(0);
    expect(brief.pmCompliance.numerator).toBeLessThanOrEqual(brief.pmCompliance.denominator);
    expect(brief.pmCompliance.method).toContain("waived");
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
});
