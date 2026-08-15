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

export type ReplacementEstimateSource = "asset_override" | "profile_benchmark" | "legacy_asset" | "unavailable";

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
      explanation: `${profile.name} benchmark, escalated ${Math.round(profile.annualEscalationBps / 100) / 100}% annually${asset.replacementAdjustmentBps ? ` with a ${asset.replacementAdjustmentBps > 0 ? "+" : ""}${Math.round(asset.replacementAdjustmentBps / 100) / 100}% asset adjustment` : ""}. ${evidenceCount === 1 ? "One dated source is on record; it is usable now but is not presented as a market average." : `${evidenceCount} dated sources are preserved in the benchmark history.`}`,
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
