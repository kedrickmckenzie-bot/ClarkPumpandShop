/**
 * Service areas where work is about the site rather than a machine (snow, lot,
 * cleaning). Open jobs in these areas never need equipment linked.
 */
export const SITE_LEVEL_CATEGORIES: readonly string[] = ["exterior", "store_sanitation"];

/** A work order whose equipment still needs choosing: no equipment linked and not site-level work. */
export function needsEquipmentChoice(work: { assetId?: string | null; categoryKey?: string | null }): boolean {
  return !work.assetId && !SITE_LEVEL_CATEGORIES.includes(work.categoryKey ?? "");
}
