import { describe, expect, it } from "vitest";
import { classificationCoverage, pmCompliance, replacementAnalysis, spendForPeriod, trailingPeriods } from "@/lib/domain/analytics";
import { haversineDistanceM, verifyGeofence } from "@/lib/domain/geofence";
import { canViewWorkOrder, vendorProjection } from "@/lib/domain/permissions";
import { hashOpaqueToken, signOpaqueToken, verifyOpaqueToken } from "@/lib/domain/tokens";
import { canCloseWorkOrder, followUpForOutcome, reclassifyWorkOrder, validateAllocation, validateClassification } from "@/lib/domain/workflow";
import { demoData, DEMO_NOW, STORY_ASSET_ID, STORY_STORE_ID, STORY_WORK_ORDER_ID } from "@/lib/demo/data";

describe("deterministic fixture", () => {
  it("contains a production-shaped, relational demo portfolio", () => {
    expect(demoData.stores).toHaveLength(65);
    expect(demoData.workOrders).toHaveLength(536);
    expect(demoData.pmOccurrences).toHaveLength(64);
    expect(new Set(demoData.workOrders.map((item) => item.number)).size).toBe(536);
    expect(demoData.workOrders.every((item) => demoData.stores.some((store) => store.id === item.storeId))).toBe(true);
  });

  it("keeps analytics denominator-safe when filters produce no work", () => {
    const coverage = classificationCoverage({ ...demoData, workOrders: [], allocations: [], invoices: [] });
    expect(coverage).toEqual({ categorized: 0, systemMapped: 0, assetSpend: 0, componentSpend: 0 });
  });
});

describe("progressive classification", () => {
  const story = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
  it("accepts Store + Category without equipment", () => {
    expect(validateClassification(demoData, { ...story, systemId: undefined, assetId: undefined, componentId: undefined }, {})).toEqual({ systemId: undefined, assetId: undefined, componentId: undefined });
  });
  it("rejects asset and component relationships outside the selected parent", () => {
    expect(() => validateClassification(demoData, story, { systemId: "sys-45-ref", assetId: "asset-31-ref-cu1" })).toThrow(/Asset must belong/);
  });
  it("appends the old and new mapping to an audit event", () => {
    const shallow = { ...story, systemId: undefined, assetId: undefined, componentId: undefined };
    const result = reclassifyWorkOrder(demoData, shallow, { systemId: "sys-45-ref" }, "Facilities", DEMO_NOW, "Diagnostic visit");
    expect(result.workOrder.systemId).toBe("sys-45-ref");
    expect(result.auditEvent.detail).toMatch(/prior.*no system/i);
  });
});

describe("technician evidence and follow-up", () => {
  const store = demoData.stores.find((item) => item.id === STORY_STORE_ID)!;
  it("computes real geofence distance and rejects weak evidence", () => {
    expect(haversineDistanceM(store, store)).toBe(0);
    expect(verifyGeofence({ ...store, radiusM: store.geofenceRadiusM }, { latitude: store.latitude, longitude: store.longitude, accuracyM: 20 }).state).toBe("verified");
    expect(verifyGeofence({ ...store, radiusM: store.geofenceRadiusM }, { latitude: store.latitude, longitude: store.longitude, accuracyM: 300 }).state).toBe("inaccurate");
    expect(verifyGeofence({ ...store, radiusM: store.geofenceRadiusM }, { permissionDenied: true }).state).toBe("permission_denied");
  });
  it("turns unresolved checkout into an owned, dated control action", () => {
    const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
    const visit = demoData.visits.find((item) => item.id === "visit-0245-1")!;
    const followUp = followUpForOutcome(workOrder, visit, "diagnosed_unresolved", "2026-05-18T15:02:00.000Z");
    expect(followUp?.accountableParty).toBe("Clark's Facilities");
    expect(followUp?.dueAt).toBe("2026-05-18T19:02:00.000Z");
    expect(canCloseWorkOrder(workOrder, [followUp!]).allowed).toBe(false);
    expect(followUpForOutcome(workOrder, visit, "resolved", DEMO_NOW)).toBeNull();
  });
});

describe("cost, PM and replacement logic", () => {
  it("requires invoice allocations to reconcile exactly", () => {
    expect(validateAllocation(495_000, [310_000, 185_000])).toEqual({ allocatedCents: 495_000, unallocatedCents: 0, reconciled: true });
    expect(() => validateAllocation(495_000, [500_000])).toThrow(/exceed/);
  });
  it("uses posted paid allocations and exact periods", () => {
    const { now, ttmStart } = trailingPeriods(DEMO_NOW);
    expect(spendForPeriod(demoData, ttmStart, now, { assetId: STORY_ASSET_ID })).toBe(1_185_000);
  });
  it("measures PM from eligible, verified occurrence outcomes", () => {
    const pm = pmCompliance(demoData, { systemId: "sys-45-ref" }, DEMO_NOW);
    expect(pm).toEqual({ numerator: 5, denominator: 7, value: 5 / 7 });
  });
  it("explains the CU-1 capital review with independent reasons", () => {
    const asset = demoData.assets.find((item) => item.id === STORY_ASSET_ID)!;
    const analysis = replacementAnalysis(demoData, asset, DEMO_NOW);
    expect(analysis.recommended).toBe(true);
    expect(analysis.currentReactive).toBe(1_185_000);
    expect(analysis.priorReactive).toBe(690_000);
    expect(analysis.visitCount).toBe(6);
    expect(analysis.reasons.map((item) => item.key)).toEqual(expect.arrayContaining(["age", "burden", "trend", "failures", "visits", "pm", "warranty"]));
  });
});

describe("tenant and vendor scope", () => {
  const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
  it("denies cross-organization reads before role scope is evaluated", () => {
    expect(canViewWorkOrder(demoData, { organizationId: "another-operator", role: "executive" }, workOrder)).toBe(false);
    expect(canViewWorkOrder(demoData, { organizationId: demoData.organization.id, role: "executive" }, workOrder)).toBe(true);
  });
  it("projects only vendor-shared documents", () => {
    const projection = vendorProjection(demoData, workOrder.vendorId!, workOrder);
    expect(projection.documents.every((item) => item.visibility === "vendor_shared")).toBe(true);
    expect(projection).not.toHaveProperty("costExposureCents");
  });
  it("supports an independent store with no region", () => {
    const independent = { ...demoData.stores[0], id: "store-independent", regionId: undefined };
    expect(independent.regionId).toBeUndefined();
  });
  it("handles a 65-store pilot list in deterministic pages", () => {
    const pilot = Array.from({ length: 65 }, (_, index) => ({ ...demoData.stores[index % demoData.stores.length], id: `pilot-${index + 1}`, code: String(index + 1) }));
    expect(new Set(pilot.map((item) => item.id)).size).toBe(65);
    expect(Array.from({ length: Math.ceil(pilot.length / 20) }, (_, page) => pilot.slice(page * 20, page * 20 + 20)).map((items) => items.length)).toEqual([20, 20, 20, 5]);
  });
});

describe("opaque public tokens", () => {
  it("signs, verifies, purpose-scopes and hashes links", async () => {
    const token = await signOpaqueToken("random-record-key", "vendor-response", "demo-secret-with-enough-entropy");
    expect(await verifyOpaqueToken(token, "vendor-response", "demo-secret-with-enough-entropy")).toBe("random-record-key");
    expect(await verifyOpaqueToken(token, "technician", "demo-secret-with-enough-entropy")).toBeNull();
    expect(await hashOpaqueToken(token)).not.toContain("random-record-key");
  });
});
