import "server-only";

import type { AssetReplacementIntelligenceViewModel, ReplacementProfileManagerViewModel, ReplacementProfileViewModel, WorkOrderReplacementIntelligenceViewModel } from "@/components/ops/replacement-intelligence-panel";
import { roleCan } from "@/components/ops/role-policy";
import { buildLifecycleRecommendationDraft, replacementBenchmarkPortfolioImpact, resolveAssetReplacementEstimate, suggestReplacementProfilesForAsset } from "@/lib/ops/replacement-intelligence";
import type { Asset, OpsFixture, ReplacementProfile } from "@/lib/ops/types";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";
import { formatOperationsDate } from "@/lib/ops/local-time";

function money(amountMinor: number | undefined, currency = "USD") { return amountMinor === undefined ? "Not available" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100); }
function date(value: string | undefined) { return value ? formatOperationsDate(value) : "No effective date"; }
function sentence(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function profileView(fixture: OpsFixture, profile: ReplacementProfile, currentAsset?: Asset, scopedAssets?: Asset[]): ReplacementProfileViewModel {
  const history = fixture.replacementBenchmarks.filter((row) => row.organizationId === profile.organizationId && row.profileId === profile.id);
  const benchmark = history.filter((row) => row.status === "published").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  const ageMonths = benchmark ? Math.max(0, Math.round((Date.parse(fixture.asOf) - Date.parse(benchmark.effectiveAt)) / (365.2425 / 12 * 86_400_000))) : undefined;
  const freshness = ageMonths === undefined ? "unavailable" as const : ageMonths <= 18 ? "current" as const : ageMonths <= 36 ? "aging" as const : "stale" as const;
  const impact = replacementBenchmarkPortfolioImpact({ assets: scopedAssets ?? fixture.assets, assetReplacementOverrides: fixture.assetReplacementOverrides }, profile, currentAsset);
  return {
    id: profile.id, code: profile.code, name: profile.name, categoryLabel: sentence(profile.categoryKey), description: profile.description,
    specificationLabel: profile.matchKeys.map((key) => `${sentence(key)}: ${profile.attributes[key] ?? "not set"}`).join(" · "),
    expectedLifeLabel: profile.expectedLifeYears ? `${profile.expectedLifeYears} years` : "Not set",
    escalationLabel: `${(profile.annualEscalationBps / 100).toFixed(2)}% annually`,
    benchmarkAmountLabel: benchmark ? money(benchmark.totalAmount.amountMinor, benchmark.totalAmount.currency) : "No published benchmark",
    benchmarkSourceLabel: benchmark ? sentence(benchmark.sourceType) : "No evidence",
    benchmarkEffectiveLabel: date(benchmark?.effectiveAt),
    evidenceHistoryLabel: history.length === 1 ? "1 dated source; useful now, not a market average" : `${history.length} dated sources preserved`,
    peerCount: impact.affectedAssetCount,
    impact,
    freshness,
  };
}

async function context() {
  const session = await loadOperatorSession();
  const fixture = await getServerOpsFixtureSnapshot(session.organizationId);
  return { session, fixture };
}

export async function loadAssetReplacementIntelligenceModel(assetId: string): Promise<AssetReplacementIntelligenceViewModel | null> {
  const { session, fixture } = await context();
  const asset = fixture.assets.find((row) => row.organizationId === session.organizationId && row.id === assetId);
  if (!asset || session.storeIds && !session.storeIds.includes(asset.storeId) || session.regionIds && !session.regionIds.includes(fixture.stores.find((store) => store.id === asset.storeId)?.regionId ?? "")) return null;
  const resolution = resolveAssetReplacementEstimate(fixture, asset, fixture.asOf);
  const profile = asset.replacementProfileId ? fixture.replacementProfiles.find((row) => row.id === asset.replacementProfileId && row.organizationId === session.organizationId) : undefined;
  const event = fixture.replacementEvents.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id && row.status === "approved").sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))[0];
  const recommendationDraft = buildLifecycleRecommendationDraft(fixture, asset, fixture.asOf);
  const recommendationHistory = fixture.lifecycleRecommendations.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id).sort((a, b) => b.version - a.version);
  const latestRecommendation = recommendationHistory[0];
  const workOrder = event ? fixture.workOrders.find((row) => row.organizationId === session.organizationId && row.id === event.workOrderId) : undefined;
  return {
    assetId: asset.id, permitted: roleCan(session.role, "manage_lifecycle"), action: `/api/ops/equipment/${encodeURIComponent(asset.id)}/replacement`,
    currentAmountLabel: money(resolution.amount?.amountMinor, resolution.amount?.currency), rangeLabel: resolution.lowAmount && resolution.highAmount ? `${money(resolution.lowAmount.amountMinor, resolution.lowAmount.currency)}–${money(resolution.highAmount.amountMinor, resolution.highAmount.currency)} planning range` : "No range available",
    sourceLabel: sentence(resolution.source), effectiveLabel: date(resolution.effectiveAt), freshnessLabel: sentence(resolution.freshness), explanation: resolution.explanation,
    currentProfileId: profile?.id, profileName: profile?.name, specificationLabel: profile ? profile.matchKeys.map((key) => `${sentence(key)}: ${asset.replacementAttributes?.[key] ?? profile.attributes[key] ?? "not set"}`).join(" · ") : "Assign a functional profile to inherit current comparable evidence.",
    adjustmentLabel: asset.replacementAdjustmentBps ? `${asset.replacementAdjustmentBps > 0 ? "+" : ""}${(asset.replacementAdjustmentBps / 100).toFixed(2)}%` : "None",
    inheritedPeerCount: profile ? fixture.assets.filter((row) => row.organizationId === session.organizationId && row.replacementProfileId === profile.id && row.status !== "retired").length : 0,
    profiles: fixture.replacementProfiles.filter((row) => row.organizationId === session.organizationId && row.active && row.categoryKey === asset.categoryKey).map((row) => profileView(fixture, row)),
    event: event && workOrder ? { id: event.id, approvedAmountLabel: money(event.approvedAmount.amountMinor, event.approvedAmount.currency), approvedAtLabel: date(event.approvedAt), workOrderNumber: workOrder.number } : undefined,
    recommendation: { recommendationLabel: sentence(recommendationDraft.recommendation), confidenceLabel: sentence(recommendationDraft.confidence), explanation: recommendationDraft.explanation, missingData: recommendationDraft.missingData },
    recommendationHistory: recommendationHistory.map((row) => ({ id: row.id, version: row.version, modelVersion: row.modelVersion, recommendationLabel: sentence(row.recommendation), confidenceLabel: sentence(row.confidence), decisionLabel: sentence(row.userDecision), planningLabel: row.plannedForYear ? `Planned for ${row.plannedForYear}` : "No replacement year committed", reason: row.userReason, decidedAtLabel: date(row.decidedAt), explanation: row.explanation, missingData: row.missingData, actualOutcomeLabel: row.actualOutcome ? sentence(row.actualOutcome) : "Outcome not recorded yet" })),
    latestRecommendationId: latestRecommendation?.id,
    defaultPlanningYear: new Date(fixture.asOf).getUTCFullYear() + 1,
    assetDefaults: { tag: asset.assetTag, name: asset.name, manufacturer: asset.manufacturer ?? "", model: asset.model ?? "", supplier: asset.supplier ?? "" },
  };
}

export async function loadWorkOrderReplacementIntelligenceModel(workOrderId: string): Promise<WorkOrderReplacementIntelligenceViewModel> {
  const { session, fixture } = await context();
  const workOrder = fixture.workOrders.find((row) => row.organizationId === session.organizationId && row.id === workOrderId);
  const asset = workOrder?.assetId ? fixture.assets.find((row) => row.organizationId === session.organizationId && row.id === workOrder.assetId) : undefined;
  if (!workOrder || session.storeIds && !session.storeIds.includes(workOrder.storeId) || session.regionIds && !session.regionIds.includes(fixture.stores.find((store) => store.id === workOrder.storeId)?.regionId ?? "")) return { workOrderId, permitted: false, canPublishGroup: false, action: "", profiles: [] };
  const selectedRequest = fixture.estimateRequests.find((row) => row.organizationId === session.organizationId && row.workOrderId === workOrder.id && row.status === "selected");
  const proposal = selectedRequest?.decisionKind === "replacement_quote" ? fixture.estimateProposals.filter((row) => row.organizationId === session.organizationId && row.requestId === selectedRequest.id).sort((a, b) => b.revision - a.revision)[0] : undefined;
  const vendor = proposal ? fixture.vendors.find((row) => row.organizationId === session.organizationId && row.id === proposal.vendorId) : undefined;
  const existing = proposal ? fixture.replacementEvents.find((row) => row.organizationId === session.organizationId && row.sourceEstimateProposalId === proposal.id) : undefined;
  const existingProfile = existing ? fixture.replacementProfiles.find((row) => row.organizationId === session.organizationId && row.id === existing.profileId) : undefined;
  const benchmark = existing ? fixture.replacementBenchmarks.find((row) => row.organizationId === session.organizationId && row.sourceEstimateProposalId === proposal?.id) : undefined;
  return {
    workOrderId: workOrder.id, permitted: roleCan(session.role, "manage_lifecycle"), canPublishGroup: session.role === "facilities", action: `/api/ops/work-orders/${encodeURIComponent(workOrder.id)}/replacement`, assetName: asset?.name,
    selectedQuote: proposal && vendor ? { vendorName: vendor.name, amountLabel: money(proposal.amount.amountMinor, proposal.amount.currency), amountInput: (proposal.amount.amountMinor / 100).toFixed(2), currency: proposal.amount.currency, scope: proposal.scope, submittedLabel: `Submitted ${date(proposal.submittedAt)}` } : undefined,
    profiles: asset ? fixture.replacementProfiles.filter((row) => row.organizationId === session.organizationId && row.active && row.categoryKey === asset.categoryKey).map((row) => profileView(fixture, row, asset)) : [],
    selectedProfileId: asset?.replacementProfileId,
    existingDecision: existing && existingProfile ? { approvedAmountLabel: money(existing.approvedAmount.amountMinor, existing.approvedAmount.currency), profileName: existingProfile.name, affectedAssetCount: benchmark ? fixture.assets.filter((row) => row.organizationId === session.organizationId && row.replacementProfileId === existingProfile.id && row.status !== "retired").length : 1, benchmarkEffectiveLabel: date(benchmark?.effectiveAt), applicationLabel: benchmark ? `The dated planning reference now supports ${fixture.assets.filter((row) => row.organizationId === session.organizationId && row.replacementProfileId === existingProfile.id && row.status !== "retired").length} active equipment records.` : "The planning reference applies only to this equipment." } : undefined,
  };
}

export async function loadReplacementProfileManagerModel(): Promise<ReplacementProfileManagerViewModel> {
  const { session, fixture } = await context();
  const scopedStoreIds = new Set(fixture.stores.filter((store) => store.organizationId === session.organizationId && (!session.storeIds || session.storeIds.includes(store.id)) && (!session.regionIds || Boolean(store.regionId && session.regionIds.includes(store.regionId)))).map((store) => store.id));
  const activeAssets = fixture.assets.filter((row) => row.organizationId === session.organizationId && scopedStoreIds.has(row.storeId) && row.status !== "retired");
  const profiles = fixture.replacementProfiles.filter((row) => row.organizationId === session.organizationId && row.active);
  const profileModels = profiles.map((row) => profileView(fixture, row, undefined, activeAssets));
  const excludedAssets = activeAssets.filter((row) => Boolean(row.replacementPlanningExcludedAt));
  const lifecycleTrackedAssets = activeAssets.filter((row) => !row.replacementPlanningExcludedAt);
  const assignedAssets = lifecycleTrackedAssets.filter((row) => Boolean(row.replacementProfileId));
  const needsClassification = lifecycleTrackedAssets.filter((row) => !row.replacementProfileId);
  const currentEstimateCount = lifecycleTrackedAssets.filter((row) => {
    const resolution = resolveAssetReplacementEstimate(fixture, row, fixture.asOf);
    return Boolean(resolution.amount) && resolution.freshness !== "stale";
  }).length;
  const classificationAssets = [...needsClassification].sort((left, right) => {
    const leftStore = fixture.stores.find((row) => row.id === left.storeId)?.storeNumber ?? left.storeId;
    const rightStore = fixture.stores.find((row) => row.id === right.storeId)?.storeNumber ?? right.storeId;
    return leftStore.localeCompare(rightStore, undefined, { numeric: true }) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
  const classificationRows = classificationAssets.slice(0, 25).map((asset) => {
    const store = fixture.stores.find((row) => row.organizationId === session.organizationId && row.id === asset.storeId);
    const resolution = resolveAssetReplacementEstimate(fixture, asset, fixture.asOf);
    const candidates = suggestReplacementProfilesForAsset(asset, profiles).slice(0, 4).map((suggestion) => ({ profileId: suggestion.profile.id, profileName: suggestion.profile.name, confidenceLabel: suggestion.confidence === "strong" ? "recorded details match" : "review suggested", explanation: suggestion.explanation }));
    return {
      assetId: asset.id,
      assetName: asset.name,
      assetTag: asset.assetTag,
      storeLabel: store ? `Store ${store.storeNumber}` : "Store unavailable",
      categoryLabel: sentence(asset.categoryKey),
      status: asset.replacementPlanningExcludedAt ? "not_tracked" as const : "needs_classification" as const,
      currentEstimateLabel: resolution.amount ? `${money(resolution.amount.amountMinor, resolution.amount.currency)} ${resolution.source === "legacy_asset" ? "legacy estimate" : "equipment estimate"}` : "No current planning estimate",
      defaultDecision: asset.replacementPlanningExcludedAt ? "leave" : candidates[0]?.confidenceLabel === "recorded details match" ? `profile:${candidates[0].profileId}` : "leave",
      candidates,
      exclusionReason: asset.replacementPlanningExclusionReason,
    };
  });
  const staleProfiles = profileModels.filter((profile) => profile.freshness === "stale" && profile.peerCount > 0).map((profile) => ({ id: profile.id, name: profile.name, effectiveLabel: profile.benchmarkEffectiveLabel, peerCount: profile.peerCount }));
  return {
    permitted: roleCan(session.role, "manage_lifecycle"),
    canManageGroups: session.role === "facilities",
    action: "/api/ops/replacement-profiles",
    profiles: profileModels,
    categories: fixture.taxonomyNodes.filter((row) => row.organizationId === session.organizationId && row.nodeKind === "category" && row.active).map((row) => ({ id: row.canonicalKey ?? row.id, label: row.name, taxonomyNodeId: row.id })),
    coverage: {
      activeAssetCount: activeAssets.length,
      lifecycleTrackedCount: lifecycleTrackedAssets.length,
      assignedCount: assignedAssets.length,
      currentEstimateCount,
      needsClassificationCount: needsClassification.length,
      excludedCount: excludedAssets.length,
      staleProfileCount: staleProfiles.length,
      coveragePercentage: lifecycleTrackedAssets.length ? Math.round(assignedAssets.length / lifecycleTrackedAssets.length * 100) : 100,
    },
    classificationRows,
    classificationTotalCount: classificationAssets.length,
    staleProfiles,
  };
}
