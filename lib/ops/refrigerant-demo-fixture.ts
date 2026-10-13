import { addDays, leakRateForAddition, refrigerantCoverage, type AssetRefrigerant, type RefrigerantEvent, type RefrigerantLeakStatus, type RefrigerantSystemUse } from "./refrigerant";
import type { OpsFixture } from "./types";

/**
 * Fictional refrigerant facts and records for the Clark Pump and Shop showcase, so the refrigerant page has a full story:
 * one open leak repair, one closed repair, one chronic leaker with an overdue follow-up check, and units missing info.
 * Stable IDs; persisted facts win during insert-only backfill. Every number on the page is worked out from these rows.
 */
type Facts = [refrigerant: string, pounds: number | undefined, use: RefrigerantSystemUse];
const unitFacts: Record<string, (store: number) => Facts | null> = {
  "beer-cave": (store) => [store % 2 ? "R-448A" : "R-404A", store === 113 || store === 115 ? undefined : 18 + (store % 5) * 2, "commercial_refrigeration"],
  "walk-in-freezer": (store) => store === 114 ? null : ["R-404A", 16 + (store % 4) * 2, "commercial_refrigeration"],
  "ice-machine": () => ["R-404A", 1.5, "commercial_refrigeration"],
  "rtu-1": () => ["R-410A", 17, "comfort_cooling"],
  "rtu-2": () => ["R-410A", 9, "light_commercial_ac"],
};

type Story = { key: string; asset: string; daysAgo: number; addedLb: number; leak?: RefrigerantLeakStatus; check?: ["initial" | "follow_up", "passed" | "failed"]; tech: string; cert: string; notes?: string; workOrderId?: string };
const stories: Story[] = [
  { key: "104-cave-1", asset: "asset-104-beer-cave", daysAgo: 200, addedLb: 2, leak: "none_found", tech: "Sam Ortiz", cert: "608-UNIV-48213" },
  { key: "104-cave-2", asset: "asset-104-beer-cave", daysAgo: 12, addedLb: 6, leak: "found_not_repaired", tech: "Sam Ortiz", cert: "608-UNIV-48213", notes: "Oily residue at the evaporator return bend. Coil replacement quoted.", workOrderId: "ai-demo-job-104-cave" },
  { key: "101-freezer-1", asset: "asset-101-walk-in-freezer", daysAgo: 70, addedLb: 5, leak: "found_repaired", tech: "Sam Ortiz", cert: "608-UNIV-48213", notes: "Cracked flare at the expansion valve, replaced." },
  { key: "101-freezer-2", asset: "asset-101-walk-in-freezer", daysAgo: 70, addedLb: 0, check: ["initial", "passed"], tech: "Sam Ortiz", cert: "608-UNIV-48213" },
  { key: "101-freezer-3", asset: "asset-101-walk-in-freezer", daysAgo: 62, addedLb: 0, check: ["follow_up", "passed"], tech: "Sam Ortiz", cert: "608-UNIV-48213" },
  { key: "107-cave-1", asset: "asset-107-beer-cave", daysAgo: 150, addedLb: 10, leak: "found_repaired", tech: "Lena Brooks", cert: "608-UNIV-77104", notes: "Leak at the liquid line drier, brazed." },
  { key: "107-cave-2", asset: "asset-107-beer-cave", daysAgo: 142, addedLb: 0, check: ["follow_up", "passed"], tech: "Lena Brooks", cert: "608-UNIV-77104" },
  { key: "107-cave-3", asset: "asset-107-beer-cave", daysAgo: 90, addedLb: 9, leak: "found_repaired", tech: "Lena Brooks", cert: "608-UNIV-77104", notes: "Same drier joint leaking again, rebrazed." },
  { key: "107-cave-4", asset: "asset-107-beer-cave", daysAgo: 82, addedLb: 0, check: ["follow_up", "passed"], tech: "Lena Brooks", cert: "608-UNIV-77104" },
  { key: "107-cave-5", asset: "asset-107-beer-cave", daysAgo: 30, addedLb: 9, leak: "found_repaired", tech: "Lena Brooks", cert: "608-UNIV-77104", notes: "Evaporator header pinhole, repaired. Unit may need replacing." },
  { key: "102-rtu-1", asset: "asset-102-rtu-1", daysAgo: 40, addedLb: 1, leak: "none_found", tech: "Marcus Hill", cert: "608-II-22051" },
];

export function addRefrigerantDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  // Only the Clark Pump and Shop presentation gets this story; other fixtures (such as the 65-store scale test) don't.
  if (!org || !stories.every((story) => f.assets.some((asset) => asset.id === story.asset))) return f;
  const today = f.asOf.slice(0, 10), setupAt = `${addDays(today, -400)}T15:00:00.000Z`;
  const facts: AssetRefrigerant[] = (f.assetRefrigerants ??= []);
  for (const asset of f.assets) {
    const match = /^asset-(\d{3})-(.+)$/u.exec(asset.id);
    const row = match ? unitFacts[match[2]!]?.(Number(match[1])) : null;
    if (!row || asset.organizationId !== org || facts.some((existing) => existing.assetId === asset.id)) continue;
    facts.push({ organizationId: org, assetId: asset.id, version: 1, refrigerant: row[0], fullChargeOz: row[1] === undefined ? undefined : Math.round(row[1] * 16), systemUse: row[2], chargeSource: row[1] === undefined ? undefined : "installer", recordedByName: "Fictional demo setup", createdAt: setupAt });
  }
  const events: RefrigerantEvent[] = (f.refrigerantEvents ??= []);
  for (const story of [...stories].sort((a, b) => b.daysAgo - a.daysAgo)) {
    const asset = f.assets.find((row) => row.id === story.asset)!, current = facts.find((row) => row.assetId === asset.id)!;
    const occurredAt = addDays(today, -story.daysAgo), coverage = refrigerantCoverage(current, occurredAt);
    const prior = events.filter((event) => event.assetId === asset.id);
    const addedOz = Math.round(story.addedLb * 16);
    events.push({
      id: `refrigerant-demo-${story.key}`, organizationId: org, assetId: asset.id, storeId: asset.storeId,
      workOrderId: story.workOrderId && f.workOrders.some((work) => work.id === story.workOrderId) ? story.workOrderId : undefined,
      kind: story.check ? "verification" : "service", occurredAt, addedOz, leakStatus: story.leak,
      verificationStage: story.check?.[0], verificationResult: story.check?.[1],
      refrigerant: current.refrigerant, fullChargeOz: current.fullChargeOz, rule: coverage.covered ? coverage.rule : undefined,
      leakRateBps: addedOz && current.fullChargeOz ? leakRateForAddition(prior, occurredAt, addedOz, current.fullChargeOz) : undefined,
      thresholdBps: coverage.covered ? coverage.thresholdBps : undefined,
      technicianName: story.tech, technicianCert: story.cert, source: "vendor", recordedByName: story.tech, notes: story.notes,
      createdAt: `${occurredAt}T18:00:00.000Z`,
    });
  }
  return f;
}
