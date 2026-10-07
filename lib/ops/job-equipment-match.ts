import type { Asset } from "./types";

const base = (name: string) => name.split(" - ")[0].toLowerCase().replace(/\s+/g, " ").trim();

/**
 * For a job not linked to equipment: the one unit at the store the report names ("beer cave", or its tag),
 * or, when that is unclear, a short list of units that could fit. Never picks between two units with the same name.
 */
export function matchJobEquipment(problem: string, categoryKey: string | undefined, assets: Asset[]) {
  const text = problem.toLowerCase().replace(/\s+/g, " ");
  const live = assets.filter(asset => asset.status !== "retired");
  const named = live.filter(asset => {
    const name = base(asset.name);
    return (name.length >= 4 && text.includes(name)) || (asset.assetTag.length >= 4 && text.includes(asset.assetTag.toLowerCase()));
  });
  if (named.length === 1) return { unit: named[0], candidates: [] as Asset[] };
  const candidates = (named.length ? named : live.filter(asset => categoryKey && asset.categoryKey === categoryKey)).slice(0, 8);
  return { unit: undefined, candidates };
}
