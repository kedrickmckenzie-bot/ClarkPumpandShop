import type {
  Asset,
  AssetReplacementOverride,
  IsoDateTime,
  Money,
  OpsFixture,
  ReplacementBenchmark,
  ReplacementProfile,
} from "./types";

const MILLIS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1_000;

export type ReplacementEstimateSource = "asset_override" | "profile_benchmark" | "legacy_asset" | "planning_excluded" | "unavailable";

export interface ReplacementEstimateResolution {
  source: ReplacementEstimateSource;
  amount?: Money;
  lowAmount?: Money;
  highAmount?: Money;
  effectiveAt?: IsoDateTime;
  benchmarkId?: string;
  profile?: ReplacementProfile;
  ageMonths?: number;
  evidenceCount: number;
  freshness: "current" | "aging" | "stale" | "unavailable";
  explanation: string;
}

function clampBps(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(-9_000, Math.min(50_000, Math.round(value)));
}

function yearsBetween(from: string, to: string) {
  const elapsed = Date.parse(to) - Date.parse(from);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed / MILLIS_PER_YEAR) : 0;
}

function ageMonths(from: string, to: string) {
  return Math.max(0, Math.round(yearsBetween(from, to) * 12));
}

function freshnessFor(months: number) {
  if (months <= 18) return "current" as const;
  if (months <= 36) return "aging" as const;
  return "stale" as const;
}

function adjustedMinor(baseMinor: number, escalationBps: number, adjustmentBps: number, years: number) {
  const escalated = baseMinor * Math.pow(1 + clampBps(escalationBps) / 10_000, years);
  return Math.max(0, Math.round(escalated * (1 + clampBps(adjustmentBps) / 10_000)));
}

function activeOverride(
  rows: readonly AssetReplacementOverride[],
  organizationId: string,
  assetId: string,
) {
  return rows
    .filter((row) => row.organizationId === organizationId && row.assetId === assetId && row.status === "active")
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}

function activeBenchmark(
  rows: readonly ReplacementBenchmark[],
  organizationId: string,
  profileId: string,
) {
  return rows
    .filter((row) => row.organizationId === organizationId && row.profileId === profileId && row.status === "published")
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}

export function resolveAssetReplacementEstimate(
  fixture: Pick<OpsFixture, "replacementProfiles" | "replacementBenchmarks" | "assetReplacementOverrides">,
  asset: Asset,
  asOf: IsoDateTime,
): ReplacementEstimateResolution {
  if (asset.replacementPlanningExcludedAt) {
    return {
      source: "planning_excluded",
      evidenceCount: 0,
      freshness: "unavailable",
      explanation: `Not included in company lifecycle planning: ${asset.replacementPlanningExclusionReason ?? "manager choice"}`,
    };
  }
  const override = activeOverride(fixture.assetReplacementOverrides, asset.organizationId, asset.id);
  if (override) {
    const months = ageMonths(override.effectiveAt, asOf);
    return {
      source: "asset_override",
      amount: override.amount,
      lowAmount: override.amount,
      highAmount: override.amount,
      effectiveAt: override.effectiveAt,
      ageMonths: months,
      evidenceCount: 1,
      freshness: freshnessFor(months),
      explanation: `Asset-specific estimate: ${override.reason}`,
    };
  }

  const profile = asset.replacementProfileId
    ? fixture.replacementProfiles.find((row) => row.organizationId === asset.organizationId && row.id === asset.replacementProfileId && row.active)
    : undefined;
  const benchmark = profile ? activeBenchmark(fixture.replacementBenchmarks, asset.organizationId, profile.id) : undefined;
  if (profile && benchmark) {
    const evidenceCount = fixture.replacementBenchmarks.filter((row) => row.organizationId === asset.organizationId && row.profileId === profile.id).length;
    const years = yearsBetween(benchmark.effectiveAt, asOf);
    const months = Math.max(0, Math.round(years * 12));
    const amountMinor = adjustedMinor(
      benchmark.totalAmount.amountMinor,
      profile.annualEscalationBps,
      asset.replacementAdjustmentBps ?? 0,
      years,
    );
    return {
      source: "profile_benchmark",
      amount: { amountMinor, currency: benchmark.totalAmount.currency },
      lowAmount: {
        amountMinor: Math.max(0, Math.round(amountMinor * (1 - clampBps(profile.lowVarianceBps) / 10_000))),
        currency: benchmark.totalAmount.currency,
      },
      highAmount: {
        amountMinor: Math.max(0, Math.round(amountMinor * (1 + clampBps(profile.highVarianceBps) / 10_000))),
        currency: benchmark.totalAmount.currency,
      },
      effectiveAt: benchmark.effectiveAt,
      benchmarkId: benchmark.id,
      profile,
      ageMonths: months,
      evidenceCount,
      freshness: freshnessFor(months),
      explanation: `${profile.name} benchmark, escalated ${profile.annualEscalationBps / 100}% annually${asset.replacementAdjustmentBps ? ` with a ${asset.replacementAdjustmentBps > 0 ? "+" : ""}${asset.replacementAdjustmentBps / 100}% asset adjustment` : ""}. ${evidenceCount === 1 ? "One dated source is on record; it is usable now but is not presented as a market average." : `${evidenceCount} dated sources are preserved in the benchmark history.`}`,
    };
  }

  if (asset.replacementEstimate) {
    return {
      source: "legacy_asset",
      amount: asset.replacementEstimate,
      lowAmount: asset.replacementEstimate,
      highAmount: asset.replacementEstimate,
      evidenceCount: 1,
      freshness: "stale",
      explanation: "Legacy equipment estimate. Assign a replacement profile to keep it current from comparable quote and final-cost evidence.",
    };
  }

  return {
    source: "unavailable",
    evidenceCount: 0,
    freshness: "unavailable",
    explanation: "No replacement profile benchmark or asset-specific estimate is available.",
  };
}

export interface ReplacementProfileMatch {
  assetId: string;
  profileId: string;
  matchedKeys: string[];
  conflictingKeys: string[];
  missingKeys: string[];
  classification: "exact" | "review" | "not_comparable";
}

export function matchAssetToReplacementProfile(asset: Asset, profile: ReplacementProfile): ReplacementProfileMatch {
  if (asset.organizationId !== profile.organizationId || asset.categoryKey !== profile.categoryKey) {
    return { assetId: asset.id, profileId: profile.id, matchedKeys: [], conflictingKeys: [], missingKeys: profile.matchKeys, classification: "not_comparable" };
  }
  const matchedKeys: string[] = [];
  const conflictingKeys: string[] = [];
  const missingKeys: string[] = [];
  for (const key of profile.matchKeys) {
    const expected = profile.attributes[key]?.trim().toLocaleLowerCase("en-US");
    const observed = asset.replacementAttributes?.[key]?.trim().toLocaleLowerCase("en-US");
    if (!expected || !observed) missingKeys.push(key);
    else if (expected === observed) matchedKeys.push(key);
    else conflictingKeys.push(key);
  }
  const classification = conflictingKeys.length
    ? "not_comparable"
    : missingKeys.length
      ? "review"
      : "exact";
  return { assetId: asset.id, profileId: profile.id, matchedKeys, conflictingKeys, missingKeys, classification };
}

export function benchmarkPeerImpact(fixture: Pick<OpsFixture, "assets">, profile: ReplacementProfile) {
  return fixture.assets
    .filter((asset) => asset.organizationId === profile.organizationId && asset.status !== "retired")
    .map((asset) => matchAssetToReplacementProfile(asset, profile))
    .filter((match) => match.classification !== "not_comparable" || fixture.assets.some((asset) => asset.id === match.assetId && asset.replacementProfileId === profile.id));
}

export interface ReplacementProfileSuggestion {
  profile: ReplacementProfile;
  match: ReplacementProfileMatch;
  confidence: "strong" | "review";
  explanation: string;
}

/**
 * Suggests plain-language planning groups without auto-assigning equipment.
 * Exact comparison details win; a shared company equipment classification is
 * a reviewable fallback. Conflicting comparison details are never suggested.
 */
export function suggestReplacementProfilesForAsset(
  asset: Asset,
  profiles: readonly ReplacementProfile[],
): ReplacementProfileSuggestion[] {
  return profiles
    .filter((profile) => profile.active && profile.organizationId === asset.organizationId && profile.categoryKey === asset.categoryKey)
    .map((profile) => {
      const match = matchAssetToReplacementProfile(asset, profile);
      const sameCompanyType = Boolean(profile.taxonomyNodeId && asset.taxonomyNodeId === profile.taxonomyNodeId);
      if (match.classification === "not_comparable") return undefined;
      const confidence = match.classification === "exact" ? "strong" as const : "review" as const;
      const explanation = confidence === "strong"
        ? "The recorded equipment details match this company planning group."
        : sameCompanyType
          ? "The company equipment type matches; review the group before saving."
          : "The service area matches, but the equipment details need a quick review.";
      return { profile, match, confidence, explanation, sameCompanyType };
    })
    .filter((row): row is ReplacementProfileSuggestion & { sameCompanyType: boolean } => Boolean(row))
    .sort((left, right) => {
      const score = (row: ReplacementProfileSuggestion & { sameCompanyType: boolean }) => row.confidence === "strong" ? 2 : row.sameCompanyType ? 1 : 0;
      return score(right) - score(left) || left.profile.name.localeCompare(right.profile.name) || left.profile.id.localeCompare(right.profile.id);
    })
    .map((row) => ({
      profile: row.profile,
      match: row.match,
      confidence: row.confidence,
      explanation: row.explanation,
    }));
}

export function replacementBenchmarkPortfolioImpact(
  fixture: Pick<OpsFixture, "assets" | "assetReplacementOverrides">,
  profile: ReplacementProfile,
  currentAsset?: Asset,
) {
  const affectedAssets = [...new Map([
    ...fixture.assets.filter((row) => row.organizationId === profile.organizationId && row.replacementProfileId === profile.id && row.status !== "retired"),
    ...(currentAsset && currentAsset.status !== "retired" ? [currentAsset] : []),
  ].map((row) => [row.id, row])).values()];
  const overrideCount = affectedAssets.filter((row) => Boolean(activeOverride(fixture.assetReplacementOverrides, row.organizationId, row.id))).length;
  return {
    affectedAssetCount: affectedAssets.length,
    affectedStoreCount: new Set(affectedAssets.map((row) => row.storeId)).size,
    overrideCount,
  };
}

export const LIFECYCLE_RECOMMENDATION_MODEL_VERSION = "transparent-rules-v2";

export interface LifecycleRecommendationDraft {
  modelVersion: string;
  recommendation: "repair" | "replace" | "capital_review";
  confidence: "low" | "medium" | "high";
  inputsJson: string;
  explanation: string;
  missingData: string[];
  workOrderId?: string;
}

export function buildLifecycleRecommendationDraft(
  fixture: Pick<OpsFixture, "replacementProfiles" | "replacementBenchmarks" | "assetReplacementOverrides" | "workOrders" | "costLines" | "components" | "componentLifecycleEvents" | "pmWorkItems">,
  asset: Asset,
  asOf: IsoDateTime,
): LifecycleRecommendationDraft {
  const estimate = resolveAssetReplacementEstimate(fixture, asset, asOf);
  const expectedLifeYears = asset.expectedLifeYears ?? estimate.profile?.expectedLifeYears;
  const installedAt = asset.installedAt;
  const assetAgeYears = installedAt ? Math.round(yearsBetween(installedAt, asOf) * 10) / 10 : undefined;
  const ageRatio = assetAgeYears !== undefined && expectedLifeYears ? assetAgeYears / expectedLifeYears : undefined;
  const assetWorkOrders = fixture.workOrders.filter((row) => row.organizationId === asset.organizationId && row.assetId === asset.id);
  const preventiveWorkOrderIds = new Set(fixture.pmWorkItems.filter((row) => row.organizationId === asset.organizationId && row.assetId === asset.id).map((row) => row.workOrderId));
  const trailing36Start = new Date(Date.parse(asOf) - 3 * MILLIS_PER_YEAR).toISOString();
  const trailingReactiveWorkOrders = assetWorkOrders.filter((row) => !preventiveWorkOrderIds.has(row.id) && row.createdAt >= trailing36Start && row.createdAt <= asOf);
  const trailingReactiveWorkOrderIds = new Set(trailingReactiveWorkOrders.map((row) => row.id));
  const trailingRepairSpendMinor = fixture.costLines.filter((row) => row.organizationId === asset.organizationId && trailingReactiveWorkOrderIds.has(row.workOrderId)).reduce((sum, row) => sum + row.amount.amountMinor, 0);
  const replacementEstimateMinor = estimate.amount?.amountMinor;
  const spendRatio = replacementEstimateMinor ? trailingRepairSpendMinor / replacementEstimateMinor : undefined;
  const warrantyActive = Boolean(asset.warrantyEndsAt && asset.warrantyEndsAt >= asOf);
  const assetComponentIds = new Set(fixture.components.filter((row) => row.organizationId === asset.organizationId && row.assetId === asset.id).map((row) => row.id));
  const trailing24Start = new Date(Date.parse(asOf) - 2 * MILLIS_PER_YEAR).toISOString();
  const componentReplacements24Months = fixture.componentLifecycleEvents.filter((row) => row.organizationId === asset.organizationId && assetComponentIds.has(row.removedComponentId) && row.installedAt >= trailing24Start && row.installedAt <= asOf).length;
  const profileMatch = estimate.profile ? matchAssetToReplacementProfile(asset, estimate.profile) : undefined;
  const missingData = [
    !installedAt ? "Installation date" : undefined,
    !expectedLifeYears ? "Expected useful-life range" : undefined,
    !replacementEstimateMinor ? "Current replacement estimate" : undefined,
    assetComponentIds.size === 0 ? "Component failure history" : undefined,
    "Verified downtime history",
    "Peer model failure cohort",
  ].filter((value): value is string => Boolean(value));
  const ageSignal = (ageRatio ?? 0) >= 0.85;
  const spendSignal = (spendRatio ?? 0) >= 0.25;
  const repeatWorkSignal = trailingReactiveWorkOrders.length >= 3;
  const componentChurnSignal = componentReplacements24Months >= 2;
  const metThresholds = [
    ageSignal ? "Useful-life position is at or beyond 85% of expected life" : undefined,
    spendSignal ? "Trailing 36-month repair spend reached at least 25% of the current replacement estimate" : undefined,
    repeatWorkSignal ? "Three or more reactive service events were recorded in the last 36 months" : undefined,
    componentChurnSignal ? "Two or more components were replaced in the last 24 months" : undefined,
  ].filter((value): value is string => Boolean(value));
  const replacementSignals = metThresholds.length;
  let recommendation: LifecycleRecommendationDraft["recommendation"] = replacementSignals >= 2 ? "replace" : replacementSignals === 1 ? "capital_review" : "repair";
  let warrantyDemoted = false;
  if (recommendation === "replace" && warrantyActive) {
    recommendation = "capital_review";
    warrantyDemoted = true;
  }
  const completeCoreInputs = [installedAt, expectedLifeYears, replacementEstimateMinor].filter((value) => value !== undefined).length;
  let confidence: LifecycleRecommendationDraft["confidence"] = completeCoreInputs === 3 && trailingReactiveWorkOrders.length >= 3 ? "high" : completeCoreInputs >= 2 ? "medium" : "low";
  if (confidence === "high" && profileMatch && profileMatch.classification !== "exact") confidence = "medium";
  const thresholdSentence = metThresholds.length
    ? ` Met thresholds: ${metThresholds.map((item) => `${item}.`).join(" ")}${warrantyDemoted ? " Active warranty coverage favors repair under warranty, so a human must review the capital case." : ""}`
    : "";
  const explanation = recommendation === "replace"
    ? `Capital review is recommended because ${replacementSignals} transparent thresholds are met: useful-life position, recent repair burden, or repeat work. This is a rule-based recommendation for a human decision, not an automatic replacement or prediction.${thresholdSentence}`
    : recommendation === "capital_review"
      ? `One transparent lifecycle threshold is met. Review repair scope, remaining life, warranty, and the dated replacement estimate before choosing; the evidence is not strong enough for an automatic conclusion.${thresholdSentence}`
      : "Current structured evidence favors repair. Continue to monitor repeat work and cost; this conclusion should be revisited when new source records arrive.";
  const latestWorkOrder = trailingReactiveWorkOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  return {
    modelVersion: LIFECYCLE_RECOMMENDATION_MODEL_VERSION,
    recommendation,
    confidence,
    inputsJson: JSON.stringify({ asOf, assetAgeYears: assetAgeYears ?? null, expectedLifeYears: expectedLifeYears ?? null, trailingRepairSpendMinor, replacementEstimateMinor: replacementEstimateMinor ?? null, replacementCurrency: estimate.amount?.currency ?? null, reactiveServiceEventCount36Months: trailingReactiveWorkOrders.length, excludedPmWorkOrderCount36Months: assetWorkOrders.filter((row) => preventiveWorkOrderIds.has(row.id) && row.createdAt >= trailing36Start && row.createdAt <= asOf).length, componentReplacements24Months, metThresholds, profileMatchClassification: profileMatch?.classification ?? null, warrantyActive, warrantyEndsAt: asset.warrantyEndsAt ?? null, downtimeMinutes: null }),
    explanation,
    missingData,
    workOrderId: latestWorkOrder?.id,
  };
}
