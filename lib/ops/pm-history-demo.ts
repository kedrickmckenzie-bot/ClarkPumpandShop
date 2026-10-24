import type { OpsFixture } from "./types";

/**
 * A fictional annual coil cleaning that several of the busiest machines missed this year, so the PM page's
 * "repairs when maintenance is done vs. missed" comparison has enough missed machines to read sensibly.
 * Insert-only and stable (prefix "pm-history-demo-"): a hosted demo gains them if missing and never has them overwritten.
 */
const MACHINES = [
  { assetId: "asset-107-beer-cave", daysAgo: 12 }, { assetId: "asset-101-beer-cave", daysAgo: 15 }, { assetId: "asset-104-beer-cave", daysAgo: 18 },
  { assetId: "asset-108-beer-cave", daysAgo: 21 }, { assetId: "asset-109-beer-cave", daysAgo: 24 },
  { assetId: "asset-107-rtu-1", daysAgo: 27 }, { assetId: "asset-102-rtu-1", daysAgo: 30 },
];
const DAY = 86_400_000;

export function addPmHistoryDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  if (!org || f.pmPlans.some(row => row.id.startsWith("pm-history-demo-"))) return f;
  const asOf = Date.parse(f.asOf), iso = (ms: number) => new Date(ms).toISOString();
  for (const machine of MACHINES) {
    const asset = f.assets.find(row => row.organizationId === org && row.id === machine.assetId);
    if (!asset) continue;
    const hvac = asset.categoryKey === "hvac";
    const vendorId = hvac ? "vendor-northline-cedar" : "vendor-northline-summit";
    const planId = `pm-history-demo-plan-${asset.id}`, occurrenceId = `pm-history-demo-occurrence-${asset.id}`;
    const windowEndsAt = asOf - machine.daysAgo * DAY;
    f.pmPlans.push({ id: planId, organizationId: org, name: hvac ? "Annual coil cleaning and belt check" : "Annual condenser coil cleaning", storeId: asset.storeId, assetId: asset.id,
      categoryKey: asset.categoryKey, cadenceDays: 365, completionWindowDays: 21, preferredVendorId: f.vendors.some(row => row.id === vendorId) ? vendorId : undefined,
      active: true, createdAt: iso(asOf - 400 * DAY) });
    f.pmOccurrences.push({ id: occurrenceId, organizationId: org, planId, storeId: asset.storeId, assetId: asset.id, planVersion: 1,
      dueAt: iso(windowEndsAt - 10 * DAY), windowStartsAt: iso(windowEndsAt - 21 * DAY), windowEndsAt: iso(windowEndsAt), status: "scheduled",
      exceptionReason: "Vendor capacity was not committed inside the due window", recurrenceKey: `${planId}:annual`, createdAt: iso(windowEndsAt - 60 * DAY) });
    f.auditEvents.push({ id: `pm-history-demo-audit-${asset.id}`, organizationId: org, aggregateType: "pm_plan", aggregateId: planId, eventType: "pm_plan.created", actorType: "system", actorName: "Fictional demo setup",
      occurredAt: iso(asOf - 400 * DAY), payloadJson: JSON.stringify({ meaning: "fictional_example", assetId: asset.id }) });
  }
  return f;
}
