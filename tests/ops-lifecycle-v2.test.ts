import { describe, expect, it } from "vitest";
import { buildLifecycleRecommendationDraft, LIFECYCLE_RECOMMENDATION_MODEL_VERSION } from "@/lib/ops/replacement-intelligence";
import type { Asset, OpsFixture } from "@/lib/ops/types";

const ORG = "org-test";
const AS_OF = "2026-08-20T12:00:00.000Z";

function emptyFixture() {
  return {
    replacementProfiles: [],
    replacementBenchmarks: [],
    assetReplacementOverrides: [],
    workOrders: [],
    costLines: [],
    pmWorkItems: [],
    components: [],
    componentLifecycleEvents: [],
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    organizationId: ORG,
    storeId: "store-1",
    assetTag: "TAG-1",
    name: "Walk-in freezer",
    categoryKey: "hvac",
    status: "active",
    installedAt: "2016-08-20T00:00:00.000Z",
    expectedLifeYears: 10,
    createdAt: AS_OF,
    ...overrides,
  } as unknown as Asset;
}

function workOrder(id: string, createdAt: string) {
  return { id, organizationId: ORG, assetId: "asset-1", createdAt } as unknown as OpsFixture["workOrders"][number];
}

describe("transparent-rules-v2 lifecycle recommendation", () => {
  it("reports the model version and stays at repair when no threshold is met", () => {
    const draft = buildLifecycleRecommendationDraft(emptyFixture(), asset({ installedAt: "2025-01-01T00:00:00.000Z" }), AS_OF);
    expect(draft.modelVersion).toBe(LIFECYCLE_RECOMMENDATION_MODEL_VERSION);
    expect(LIFECYCLE_RECOMMENDATION_MODEL_VERSION).toBe("transparent-rules-v2");
    expect(draft.recommendation).toBe("repair");
    expect(draft.missingData).toContain("Component failure history");
  });

  it("demotes a replace outcome to capital review while the asset is under warranty and says so", () => {
    const fixture = { ...emptyFixture(), workOrders: [workOrder("wo-1", "2024-03-01T00:00:00.000Z"), workOrder("wo-2", "2024-09-01T00:00:00.000Z"), workOrder("wo-3", "2025-06-01T00:00:00.000Z")] };
    const draft = buildLifecycleRecommendationDraft(fixture, asset({ warrantyEndsAt: "2027-01-01T00:00:00.000Z" }), AS_OF);
    // Age signal alone (10-year-old asset with 10-year life) plus repeat work would reach "replace";
    // active warranty must demote it to a human capital review.
    expect(draft.recommendation).toBe("capital_review");
    const inputs = JSON.parse(draft.inputsJson) as { metThresholds: string[]; warrantyActive: boolean };
    expect(inputs.warrantyActive).toBe(true);
    expect(inputs.metThresholds.length).toBeGreaterThanOrEqual(2);
    expect(draft.explanation).toContain("Active warranty coverage favors repair under warranty");
  });

  it("treats abnormal component churn as its own transparent threshold", () => {
    const componentA = { id: "comp-a", organizationId: ORG, assetId: "asset-1", name: "Evaporator fan" } as unknown as OpsFixture["components"][number];
    const componentB = { id: "comp-b", organizationId: ORG, assetId: "asset-1", name: "Door heater" } as unknown as OpsFixture["components"][number];
    const fixture = {
      ...emptyFixture(),
      components: [componentA, componentB],
      componentLifecycleEvents: [
        { id: "cle-1", organizationId: ORG, assetId: "asset-1", removedComponentId: "comp-a", installedAt: "2025-02-01T00:00:00.000Z" },
        { id: "cle-2", organizationId: ORG, assetId: "asset-1", removedComponentId: "comp-b", installedAt: "2026-01-15T00:00:00.000Z" },
      ],
    } as unknown as Parameters<typeof buildLifecycleRecommendationDraft>[0];
    const draft = buildLifecycleRecommendationDraft(fixture, asset({ installedAt: "2024-01-01T00:00:00.000Z" }), AS_OF);
    expect(draft.recommendation).toBe("capital_review");
    const inputs = JSON.parse(draft.inputsJson) as { componentReplacements24Months: number; metThresholds: string[] };
    expect(inputs.componentReplacements24Months).toBe(2);
    expect(inputs.metThresholds.some((item) => item.includes("components were replaced"))).toBe(true);
    expect(draft.explanation).toContain("components were replaced in the last 24 months");
  });

  it("keeps zero-dollar warranty callbacks counting toward the repeat-work threshold", () => {
    const fixture = { ...emptyFixture(), workOrders: [workOrder("wo-1", "2025-01-10T00:00:00.000Z"), workOrder("wo-2", "2025-05-10T00:00:00.000Z"), workOrder("wo-3", "2026-02-10T00:00:00.000Z")] };
    const draft = buildLifecycleRecommendationDraft(fixture, asset({ installedAt: "2024-06-01T00:00:00.000Z", warrantyEndsAt: "2024-12-31T00:00:00.000Z" }), AS_OF);
    const inputs = JSON.parse(draft.inputsJson) as { reactiveServiceEventCount36Months: number };
    expect(inputs.reactiveServiceEventCount36Months).toBe(3);
    expect(draft.recommendation).toBe("capital_review");
  });

  it("excludes preventive-maintenance work orders and costs from reactive replacement pressure", () => {
    const pmWorkOrders = [
      workOrder("wo-pm-1", "2025-01-10T00:00:00.000Z"),
      workOrder("wo-pm-2", "2025-04-10T00:00:00.000Z"),
      workOrder("wo-pm-3", "2025-07-10T00:00:00.000Z"),
      workOrder("wo-pm-4", "2025-10-10T00:00:00.000Z"),
    ];
    const fixture = {
      ...emptyFixture(),
      workOrders: pmWorkOrders,
      pmWorkItems: pmWorkOrders.map((work, index) => ({ id: `pm-item-${index}`, organizationId: ORG, occurrenceId: `occurrence-${index}`, workOrderId: work.id, assetId: "asset-1" })),
      costLines: pmWorkOrders.map((work, index) => ({ id: `cost-${index}`, organizationId: ORG, workOrderId: work.id, amount: { amountMinor: 500_000, currency: "USD" } })),
    } as unknown as Parameters<typeof buildLifecycleRecommendationDraft>[0];
    const draft = buildLifecycleRecommendationDraft(fixture, asset({ installedAt: "2024-01-01T00:00:00.000Z", replacementEstimate: { amountMinor: 1_000_000, currency: "USD" } }), AS_OF);
    const inputs = JSON.parse(draft.inputsJson) as { reactiveServiceEventCount36Months: number; excludedPmWorkOrderCount36Months: number; trailingRepairSpendMinor: number; metThresholds: string[] };
    expect(inputs).toMatchObject({ reactiveServiceEventCount36Months: 0, excludedPmWorkOrderCount36Months: 4, trailingRepairSpendMinor: 0 });
    expect(inputs.metThresholds).not.toContain(expect.stringMatching(/service events/i));
    expect(draft.recommendation).toBe("repair");
  });
});
