import type { Asset, PmPlan } from "./types";

/** Stored on the existing plan; issued work items are immutable coverage snapshots. */
export interface PmCoverageRule {
  kind: "store_category";
  categoryKey: string;
  cadenceOverride?: boolean;
  includedAssetIds: string[];
  excludedAssetIds: string[];
}
export function pmCoverageRule(plan: Pick<PmPlan, "assetSelectionRule">): PmCoverageRule | undefined {
  if (!plan.assetSelectionRule?.startsWith("{")) return;
  try {
    const rule = JSON.parse(plan.assetSelectionRule) as PmCoverageRule;
    if (rule.kind === "store_category" && typeof rule.categoryKey === "string" && Array.isArray(rule.includedAssetIds) && Array.isArray(rule.excludedAssetIds)) return rule;
  } catch { /* Legacy rules remain supported by their existing asset plan. */ }
}
export function coveredPmAssets(plan: PmPlan, assets: Asset[]): Asset[] {
  const rule = pmCoverageRule(plan);
  return assets.filter(a => a.organizationId === plan.organizationId && a.storeId === plan.storeId && a.status !== "retired" && !a.retiredAt && (rule
    ? !rule.excludedAssetIds.includes(a.id) && (a.categoryKey === rule.categoryKey || rule.includedAssetIds.includes(a.id))
    : a.id === plan.assetId));
}
