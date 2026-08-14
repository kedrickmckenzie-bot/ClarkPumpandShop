import { describe, expect, it } from "vitest";

import {
  calculateRepairReplacementScreening,
  type RepairProposalInput,
} from "@/lib/ops/lifecycle-analytics";
import type { Asset } from "@/lib/ops/types";

const baseAsset: Asset = {
  id: "asset-test-1",
  organizationId: "org-test",
  storeId: "store-test",
  categoryKey: "refrigeration",
  groupPath: ["Refrigeration", "Walk-in refrigeration"],
  assetTag: "TEST-REF-01",
  name: "Walk-in condensing unit",
  installedAt: "2021-01-01T00:00:00.000Z",
  expectedLifeYears: 10,
  replacementEstimate: { amountMinor: 10_000_000, currency: "USD" },
  status: "operational",
  createdAt: "2021-01-01T00:00:00.000Z",
};

const asOf = "2026-01-01T00:00:00.000Z";

function screen(proposal: RepairProposalInput, asset: Asset = baseAsset) {
  return calculateRepairReplacementScreening(asset, proposal, { asOf });
}

describe("repair-versus-replacement lifecycle screening", () => {
  it("keeps an $800 short-horizon repair below materiality even when its same-horizon ratio exceeds one", () => {
    const hugeReplacement: Asset = {
      ...baseAsset,
      replacementEstimate: { amountMinor: 100_000_000, currency: "USD" },
    };
    const result = screen(
      { repairEstimateMinor: 80_000, estimatedServiceExtensionMonths: 0.05 },
      hugeReplacement,
    );

    expect(result.comparison.repairToBreakEvenRatio).toBeGreaterThan(1);
    expect(result.state).toBe("below_materiality");
    expect(result.capitalPlanningState).toBe("not_economically_flagged");
    expect(result.reviewTriggers).toEqual([]);
    expect(result.reasons).toEqual(["repair_amount_below_minimum"]);
  });

  it("compares a $15,000 repair when both dollar and share gates are met", () => {
    const asset: Asset = {
      ...baseAsset,
      replacementEstimate: { amountMinor: 10_000_000, currency: "USD" },
    };
    const result = screen(
      { repairEstimateMinor: 1_500_000, estimatedServiceExtensionMonths: 6 },
      asset,
    );

    expect(result.comparison).toMatchObject({
      repairToReplacementRatio: 0.15,
      repairToBreakEvenRatio: 3,
      minimumRepairAmountMinor: 250_000,
      minimumRepairToReplacementRatio: 0.1,
      nearSameHorizonRatio: 0.8,
      directHighReplacementShareRatio: 0.5,
    });
    expect(result.state).toBe("compare_alternatives");
    expect(result.capitalPlanningState).toBe("review_candidate");
    expect(result.reviewTriggers).toEqual(["same_horizon_economics"]);
    expect(result.reasons).toEqual(["same_horizon_meets_review_threshold"]);
  });

  it("requires both materiality gates before same-horizon economics can trigger review", () => {
    const result = screen({
      repairEstimateMinor: 500_000,
      estimatedServiceExtensionMonths: 3,
    });

    expect(result.comparison.repairToBreakEvenRatio).toBe(2);
    expect(result.comparison.repairToReplacementRatio).toBe(0.05);
    expect(result.state).toBe("below_economic_review");
    expect(result.reviewTriggers).toEqual([]);
    expect(result.reasons).toEqual(["repair_share_below_minimum"]);
  });

  it("uses the direct replacement-share trigger only after the dollar minimum is met", () => {
    const result = screen({
      repairEstimateMinor: 5_000_000,
      estimatedServiceExtensionMonths: 120,
    });

    expect(result.comparison.repairToReplacementRatio).toBe(0.5);
    expect(result.comparison.repairToBreakEvenRatio).toBe(0.5);
    expect(result.state).toBe("compare_alternatives");
    expect(result.reviewTriggers).toEqual(["direct_replacement_share"]);
    expect(result.reasons).toEqual(["direct_replacement_share_meets_review_threshold"]);
  });

  it("keeps an explicit cheap bridge repair below materiality after expected life", () => {
    const pastReferenceLife: Asset = {
      ...baseAsset,
      installedAt: "2015-01-01T00:00:00.000Z",
    };

    const withoutExtension = screen({ repairEstimateMinor: 100_000 }, pastReferenceLife);
    expect(withoutExtension.state).toBe("below_materiality");
    expect(withoutExtension.dataGaps).toContain("no_positive_comparison_horizon");

    const withExtension = screen(
      { repairEstimateMinor: 100_000, estimatedServiceExtensionMonths: 6 },
      pastReferenceLife,
    );
    expect(withExtension.age.lifeUsedPercentage).toBeGreaterThan(100);
    expect(withExtension.state).toBe("below_materiality");
    expect(withExtension.reviewTriggers).toEqual([]);
    expect(withExtension.definition).toMatch(/age, historical spend, and reliability are context only/i);
  });

  it("keeps a material repair below review when same-horizon economics remain low", () => {
    const result = screen({
      repairEstimateMinor: 1_000_000,
      estimatedServiceExtensionMonths: 24,
    });

    expect(result.comparison.repairToReplacementRatio).toBe(0.1);
    expect(result.comparison.repairToBreakEvenRatio).toBe(0.5);
    expect(result.state).toBe("below_economic_review");
    expect(result.reasons).toEqual(["same_horizon_below_review_threshold"]);
  });

  it("returns incomplete when required economic inputs are unavailable", () => {
    const result = calculateRepairReplacementScreening(
      { ...baseAsset, replacementEstimate: undefined },
      undefined,
      { asOf },
    );

    expect(result.state).toBe("incomplete");
    expect(result.capitalPlanningState).toBe("inputs_needed");
    expect(result.reasons).toEqual(["required_economic_inputs_missing"]);
    expect(result.dataGaps).toEqual(expect.arrayContaining([
      "missing_replacement_estimate",
      "missing_repair_estimate",
    ]));
    expect(result.comparison.breakEvenRepairAmountMinor).toBeUndefined();
  });

  it("does not let giant historical cost or repeat counts change the state", () => {
    const proposal = { repairEstimateMinor: 500_000, estimatedServiceExtensionMonths: 3 };
    const cleanHistory = calculateRepairReplacementScreening(baseAsset, proposal, {
      asOf,
      historicalContext: {
        recordedWorkCostMinor: 0,
        distinctWorkOrderCount: 0,
        sourceRecordIds: ["history-clean"],
      },
    });
    const giantHistory = calculateRepairReplacementScreening(baseAsset, proposal, {
      asOf,
      historicalContext: {
        recordedWorkCostMinor: 500_000_000,
        distinctWorkOrderCount: 2_500,
        distinctVisitCount: 4_000,
        repeatIssueCount: 1_200,
        sourceRecordIds: ["history-giant"],
      },
    });

    expect(giantHistory.state).toBe("below_economic_review");
    expect(giantHistory.state).toBe(cleanHistory.state);
    expect(giantHistory.capitalPlanningState).toBe(cleanHistory.capitalPlanningState);
    expect(giantHistory.reviewTriggers).toEqual(cleanHistory.reviewTriggers);
    expect(giantHistory.reasons).toEqual(cleanHistory.reasons);
    expect(giantHistory.comparison).toEqual(cleanHistory.comparison);
    expect(giantHistory.historicalContext?.recordedWorkCostMinor).toBe(500_000_000);
  });

  it("preserves proposal and context source IDs without mixing context into economic evidence", () => {
    const result = calculateRepairReplacementScreening(
      baseAsset,
      {
        proposalId: "proposal-7",
        repairEstimateMinor: 500_000,
        sourceRecordIds: ["estimate-7", "proposal-7"],
      },
      {
        asOf,
        historicalContext: {
          distinctWorkOrderCount: 2,
          sourceRecordIds: ["wo-1", "wo-2"],
        },
      },
    );

    expect(result.economicSourceRecordIds).toEqual([
      "asset-test-1",
      "proposal-7",
      "estimate-7",
    ]);
    expect(result.historicalContextSourceRecordIds).toEqual(["wo-1", "wo-2"]);
    expect(result.sourceRecordIds).toEqual([
      "asset-test-1",
      "proposal-7",
      "estimate-7",
      "wo-1",
      "wo-2",
    ]);
  });

  it("validates custom materiality policy ordering", () => {
    expect(() => calculateRepairReplacementScreening(baseAsset, { repairEstimateMinor: 500_000 }, {
      asOf,
      policy: { directHighReplacementShareRatio: 0.05 },
    })).toThrow(/materiality/i);
  });
});
