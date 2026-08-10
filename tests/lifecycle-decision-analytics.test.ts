import { describe, expect, it } from "vitest";

import {
  getAssetLifecycleDecisionFacts,
  getUpcomingLifecycleCapexProjection,
  listAssetLifecycleDecisionFacts,
} from "@/lib/cstore/analytics";
import { DEMO_ORGANIZATION_ID, demoData } from "@/lib/cstore/demo-data";
import type { DemoDataset } from "@/lib/cstore/types";

describe("transparent lifecycle decision facts", () => {
  it("keeps distinct Store 104 activity and clean versus needs-review cost separate", () => {
    const facts = getAssetLifecycleDecisionFacts(
      demoData,
      DEMO_ORGANIZATION_ID,
      "asset-104-beer-cave",
    )!;

    expect(facts.assetAgeYears).toBe(12.4);
    expect(facts.expectedLifeYears).toBe(12);
    expect(facts.expectedLifePercentage).toBe(103.3);
    expect(facts.expectedReplacementOn).toBe("2026-03-15");
    expect(facts.expectedReplacementYear).toBe(2026);
    expect(facts.currentReplacementEstimateMinor).toBe(1_925_000);
    expect(facts.warranty.status).toBe("expired");

    expect(facts.reactiveActivity.trailing12Months.distinctWorkOrderCount).toBe(3);
    expect(facts.reactiveActivity.trailing12Months.distinctVisitCount).toBe(5);
    expect(new Set(facts.reactiveActivity.trailing12Months.workOrderIds)).toHaveLength(3);
    expect(new Set(facts.reactiveActivity.trailing12Months.visitIds)).toHaveLength(5);

    expect(facts.costs.trailing12Months).toMatchObject({
      authorizedMinor: 965_000,
      recordedMinor: 1_041_000,
      cleanInvoiceMinor: 468_000,
      needsReviewInvoiceMinor: 573_000,
      confirmedActualMinor: 1_041_000,
      confirmedActualShareOfReplacementPercentage: 54.1,
    });
    expect(facts.costs.trailing24Months).toMatchObject({
      recordedMinor: 1_041_000,
      cleanInvoiceMinor: 468_000,
      needsReviewInvoiceMinor: 573_000,
      confirmedActualMinor: 1_041_000,
    });

    expect(facts.pm.planCount).toBe(1);
    expect(facts.pm.trailing12Months.occurrenceCount).toBe(1);
    expect(facts.pm.trailing12Months.completedCount).toBe(1);
    expect(facts.confirmedComponentRecurrences.trailing12Months).toHaveLength(1);
    expect(facts.confirmedComponentRecurrences.trailing12Months[0]).toMatchObject({
      componentId: "component-104-beer-cave-comp-1",
      distinctWorkOrderCount: 3,
      distinctVisitCount: 5,
    });
    expect(facts.reviewReasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      "expected_life_reference_reached",
      "reactive_work_order_volume",
      "confirmed_component_recurrence",
      "invoice_cost_needs_review",
      "temporary_or_unresolved_work",
    ]));
    expect(facts.reviewReasons.map((reason) => reason.code)).toContain("clean_cost_share_12_months");
  });

  it("does not infer component recurrence when explicit component links are absent", () => {
    const recurrentWorkIds = new Set<string>([
      "wo-104-refrigeration-main",
      "wo-104-refrigeration-callback-1",
      "wo-104-refrigeration-compressor-replacement",
    ]);
    const dataset: DemoDataset = {
      ...demoData,
      workOrders: demoData.workOrders.map((workOrder) =>
        recurrentWorkIds.has(workOrder.id) ? { ...workOrder, componentId: undefined } : workOrder,
      ),
    };

    const facts = getAssetLifecycleDecisionFacts(dataset, DEMO_ORGANIZATION_ID, "asset-104-beer-cave")!;

    expect(facts.reactiveActivity.trailing12Months.distinctWorkOrderCount).toBe(3);
    expect(facts.reactiveActivity.trailing12Months.distinctVisitCount).toBe(5);
    expect(facts.confirmedComponentRecurrences.trailing12Months).toEqual([]);
    expect(facts.reviewReasons.map((reason) => reason.code)).not.toContain("confirmed_component_recurrence");
  });

  it("continues to surface activity and expected-life facts when invoice safeguards are unused", () => {
    const dataset: DemoDataset = {
      ...demoData,
      invoices: [],
      invoiceWorkLinks: [],
      exceptions: demoData.exceptions.filter((exception) =>
        !["invoice_over_nte", "invoice_missing_work_order", "duplicate_invoice_reference"].includes(exception.type),
      ),
    };

    const facts = getAssetLifecycleDecisionFacts(dataset, DEMO_ORGANIZATION_ID, "asset-104-beer-cave")!;
    expect(facts.costs.trailing12Months).toMatchObject({
      authorizedMinor: 965_000,
      recordedMinor: 1_041_000,
      cleanInvoiceMinor: 0,
      needsReviewInvoiceMinor: 0,
      confirmedActualMinor: 1_041_000,
    });
    expect(facts.reactiveActivity.trailing12Months.distinctWorkOrderCount).toBe(3);
    expect(facts.confirmedComponentRecurrences.trailing12Months[0].distinctWorkOrderCount).toBe(3);
    expect(facts.reviewReasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      "expected_life_reference_reached",
      "reactive_work_order_volume",
      "confirmed_component_recurrence",
      "clean_cost_share_12_months",
    ]));
    expect(facts.reviewReasons.map((reason) => reason.code)).not.toContain("invoice_cost_needs_review");

    const capex = getUpcomingLifecycleCapexProjection(
      dataset,
      DEMO_ORGANIZATION_ID,
      { storeId: "store-104", startYear: 2026, endYear: 2029 },
    );
    expect(capex.projectedAmountMinor).toBeGreaterThan(0);
    expect(capex.overdueRows.some((row) => row.assetId === "asset-104-beer-cave")).toBe(true);
  });

  it("lists tenant-scoped facts without filtering to candidates", () => {
    const rows = listAssetLifecycleDecisionFacts(
      demoData,
      DEMO_ORGANIZATION_ID,
      { storeId: "store-104", categoryId: "category-refrigeration" },
    );

    expect(rows.map((row) => row.asset.id)).toEqual([
      "asset-104-beer-cave",
      "asset-104-walkin-freezer",
    ]);
  });

  it("builds a non-persisted, editable projection grouped by expected replacement year", () => {
    const projection = getUpcomingLifecycleCapexProjection(
      demoData,
      DEMO_ORGANIZATION_ID,
      { storeId: "store-104", startYear: 2026, endYear: 2029 },
    );
    const projectedRows = projection.yearBuckets.flatMap((bucket) => bucket.rows);

    expect(projection.overdueRows.map((row) => row.assetId)).toEqual([
      "asset-104-oven-1",
      "asset-104-beer-cave",
      "asset-104-fuel-controller",
    ]);
    expect(projectedRows.map((row) => row.assetId)).toEqual([
      "asset-104-rtu-1",
      "asset-104-walkin-freezer",
    ]);
    expect(projection.yearBuckets.find((bucket) => bucket.year === 2028)).toMatchObject({
      assetCount: 1,
      projectedAmountMinor: 2_525_000,
    });
    expect(projection.yearBuckets.find((bucket) => bucket.year === 2029)).toMatchObject({
      assetCount: 1,
      projectedAmountMinor: 2_275_000,
    });

    const beerCaveDraft = projection.overdueRows.find((row) => row.assetId === "asset-104-beer-cave")!.draft;
    expect(beerCaveDraft).toEqual({ include: true, targetYear: 2026, amountMinor: 1_925_000, note: "" });
    beerCaveDraft.amountMinor = 1;
    const rebuilt = getUpcomingLifecycleCapexProjection(
      demoData,
      DEMO_ORGANIZATION_ID,
      { storeId: "store-104", startYear: 2026, endYear: 2029 },
    );
    expect(rebuilt.overdueRows.find((row) => row.assetId === "asset-104-beer-cave")!.draft.amountMinor).toBe(1_925_000);
    expect(projection.definition).toMatch(/not a failure prediction, replacement decision, or persisted capital plan/i);
  });
});
