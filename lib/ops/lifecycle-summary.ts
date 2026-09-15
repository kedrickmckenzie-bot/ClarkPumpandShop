import type { Asset, AssetReplacementOverride, LifecycleRecommendation, Money, OpsFixture, ReplacementBenchmark, ReplacementEvent, ReplacementProfile, WorkOrder } from "./types";
import type { OrganizationScope } from "./repository";
import { resolveAssetReplacementEstimate } from "./replacement-intelligence";
import { calculateRepairReplacementScreening } from "./lifecycle-analytics";
import { resolveLifecycleDecisionState } from "./lifecycle-decision-state";
import { selectLifecycleReplacementPrice } from "./lifecycle-price-selection";

export interface LifecycleScreeningInput {
  asset: Asset;
  work?: WorkOrder;
  profile?: ReplacementProfile;
  benchmark?: ReplacementBenchmark;
  override?: AssetReplacementOverride;
  recordedCostMinor: number;
}
export interface LifecycleSpotlightEvidence {
  decision?: LifecycleRecommendation;
  decisionEvent?: ReplacementEvent;
  priceEvent?: ReplacementEvent;
  selectedPrice?: Money;
  reportedPrice?: Money;
  recordedCosts: Money[];
}
export interface DashboardLifecycleSummary {
  repairComparisonCount: number;
  replacementEstimates: Money[];
  spotlight?: {
    assetId: string; assetName: string; workId: string; workNumber: string;
    stateLabel: string; repairEstimate?: Money; replacement?: Money;
    replacementBasis: string; recordedCosts: Money[];
  };
}
export const lifecycleIdOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function equipmentHistoryStart(asOf: string) { const start = new Date(asOf); start.setUTCMonth(start.getUTCMonth() - 12); return start.toISOString().slice(0, 10); }
export function validateLifecycleAsOf(asOf: string) { if (!Number.isFinite(Date.parse(asOf))) throw new RangeError("Choose a valid reporting date."); }

/** Retains one leading candidate and currency aggregates while batches are consumed. */
export function createLifecycleSummary(asOf: string) {
  validateLifecycleAsOf(asOf);
  let repairComparisonCount = 0;
  const totals = new Map<string, number>();
  let candidate: { input: LifecycleScreeningInput; planning?: Money; screening: ReturnType<typeof calculateRepairReplacementScreening> } | undefined;
  return {
    add(input: LifecycleScreeningInput) {
      const planning = resolveAssetReplacementEstimate({ replacementProfiles: input.profile ? [input.profile] : [], replacementBenchmarks: input.benchmark ? [input.benchmark] : [], assetReplacementOverrides: input.override ? [input.override] : [] }, input.asset, asOf).amount;
      if (planning) totals.set(planning.currency, (totals.get(planning.currency) ?? 0) + planning.amountMinor);
      const screening = calculateRepairReplacementScreening({ ...input.asset, replacementEstimate: planning }, input.work ? { proposalId: input.work.id, repairEstimateMinor: input.work.repairEstimate?.amountMinor, repairEstimateCurrency: input.work.repairEstimate?.currency, estimatedServiceExtensionMonths: input.work.estimatedServiceExtensionMonths } : undefined, { asOf });
      if (screening.state !== "compare_alternatives") return;
      repairComparisonCount++;
      const order = candidate ? (candidate.input.work?.repairEstimate?.amountMinor ?? 0) - (input.work?.repairEstimate?.amountMinor ?? 0)
        || candidate.input.recordedCostMinor - input.recordedCostMinor || lifecycleIdOrder(input.asset.id, candidate.input.asset.id) : -1;
      if (!candidate || order < 0) candidate = { input, planning, screening };
    },
    get candidate() { return candidate; },
    finish(evidence?: LifecycleSpotlightEvidence): DashboardLifecycleSummary {
      const work = candidate?.input.work;
      const selection = selectLifecycleReplacementPrice(evidence?.priceEvent?.approvedAmount, evidence?.selectedPrice, evidence?.reportedPrice);
      const replacement = selection.amount ?? candidate?.planning;
      return {
        repairComparisonCount,
        replacementEstimates: [...totals].sort(([a], [b]) => lifecycleIdOrder(a, b)).map(([currency, amountMinor]) => ({ currency, amountMinor })),
        spotlight: candidate && work && evidence ? {
          assetId: candidate.input.asset.id, assetName: candidate.input.asset.name, workId: work.id, workNumber: work.number,
          stateLabel: resolveLifecycleDecisionState({ screening: candidate.screening, latestDecision: evidence.decision, replacementEvents: evidence.decisionEvent ? [evidence.decisionEvent] : [] }).label,
          repairEstimate: work.repairEstimate, replacement,
          replacementBasis: selection.amount ? selection.basis : "Planning estimate",
          recordedCosts: evidence.recordedCosts,
        } : undefined,
      };
    },
  };
}

export function dashboardLifecycleFromFixture(fixture: OpsFixture, scope: OrganizationScope, asOf: string): DashboardLifecycleSummary {
  const summary = createLifecycleSummary(asOf);
  const stores = new Set(fixture.stores.filter(store => store.organizationId === scope.organizationId && (scope.storeIds === undefined || scope.storeIds.includes(store.id)) && (scope.regionIds === undefined || Boolean(store.regionId && scope.regionIds.includes(store.regionId)))).map(store => store.id));
  for (const asset of fixture.assets.filter(asset => asset.organizationId === scope.organizationId && stores.has(asset.storeId))) {
    const work = fixture.workOrders.filter(work => work.organizationId === scope.organizationId && work.storeId === asset.storeId && work.assetId === asset.id);
    const workIds = new Set(work.map(work => work.id));
    summary.add({ asset,
      work: work.filter(work => work.priority !== "planned" && !["closed", "cancelled", "completed_pending_review", "resolved"].includes(work.status) && work.repairEstimate).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || lifecycleIdOrder(b.id, a.id))[0],
      profile: fixture.replacementProfiles.find(row => row.organizationId === scope.organizationId && row.id === asset.replacementProfileId && row.active),
      benchmark: fixture.replacementBenchmarks.filter(row => row.organizationId === scope.organizationId && row.profileId === asset.replacementProfileId && row.status === "published").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || lifecycleIdOrder(b.id, a.id))[0],
      override: fixture.assetReplacementOverrides.filter(row => row.organizationId === scope.organizationId && row.assetId === asset.id && row.status === "active").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || lifecycleIdOrder(b.id, a.id))[0],
      recordedCostMinor: fixture.costLines.filter(row => row.organizationId === scope.organizationId && workIds.has(row.workOrderId) && row.amount.currency === "USD").reduce((sum, row) => sum + row.amount.amountMinor, 0),
    });
  }
  const candidate = summary.candidate;
  if (!candidate?.input.work) return summary.finish();
  const { asset, work } = candidate.input;
  const events = fixture.replacementEvents.filter(row => row.organizationId === scope.organizationId && row.assetId === asset.id && row.workOrderId === work!.id && row.status !== "cancelled");
  const selectedRequests = new Set(fixture.estimateRequests.filter(row => row.organizationId === scope.organizationId && row.workOrderId === work!.id && row.decisionKind === "replacement_quote" && row.status === "selected").map(row => `${row.id}\0${row.vendorId}`));
  const assetWork = new Set(fixture.workOrders.filter(row => row.organizationId === scope.organizationId && row.storeId === asset.storeId && row.assetId === asset.id).map(row => row.id));
  const costs = new Map<string, number>();
  for (const row of fixture.costLines.filter(row => row.organizationId === scope.organizationId && assetWork.has(row.workOrderId) && row.serviceDate.slice(0, 10) >= equipmentHistoryStart(asOf) && row.serviceDate.slice(0, 10) <= asOf.slice(0, 10))) costs.set(row.amount.currency, (costs.get(row.amount.currency) ?? 0) + row.amount.amountMinor);
  return summary.finish({
    decision: fixture.lifecycleRecommendations.filter(row => row.organizationId === scope.organizationId && row.assetId === asset.id).sort((a, b) => b.version - a.version || b.decidedAt.localeCompare(a.decidedAt) || lifecycleIdOrder(b.id, a.id))[0],
    decisionEvent: [...events].sort((a, b) => Number(b.status === "completed") - Number(a.status === "completed") || b.approvedAt.localeCompare(a.approvedAt) || lifecycleIdOrder(b.id, a.id))[0],
    priceEvent: [...events].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || lifecycleIdOrder(b.id, a.id))[0],
    selectedPrice: fixture.estimateProposals.filter(row => row.organizationId === scope.organizationId && row.workOrderId === work!.id && selectedRequests.has(`${row.requestId}\0${row.vendorId}`)).sort((a, b) => b.revision - a.revision || b.submittedAt.localeCompare(a.submittedAt) || lifecycleIdOrder(b.id, a.id))[0]?.amount,
    reportedPrice: (fixture.workPrices ?? []).filter(row => row.organizationId === scope.organizationId && row.workOrderId === work!.id && row.kind === "replace" && row.scopeKind === "whole").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || lifecycleIdOrder(b.id, a.id))[0]?.amount,
    recordedCosts: [...costs].sort(([a], [b]) => lifecycleIdOrder(a, b)).map(([currency, amountMinor]) => ({ currency, amountMinor })),
  });
}
