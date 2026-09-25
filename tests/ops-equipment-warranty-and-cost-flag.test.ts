import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID as org } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { addEquipmentWarranty } from "@/lib/ops/warranty-commands";
import { createWorkOrder } from "@/lib/ops/commands";
import { recordWorkOrderCost } from "@/lib/ops/work-recording-commands";
const actor = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
function setup() {
  const fixture = buildNorthlinePresentationFixture(); const repository = createOpsFixtureRepository(fixture); let i = 0;
  return { fixture, repository, services: { repository, clock: { now: () => "2026-08-25T14:00:00.000Z" }, ids: { next: (prefix: string) => `${prefix}-new-coverage-${++i}` } } };
}
describe("equipment warranties", () => {
  function input(assetId: string) { return { organizationId: org, actor, assetId, providerKind: "manufacturer" as const, providerName: "Example manufacturer", title: "Parts warranty", startDate: "2026-01-01", expirationDate: "2028-01-01", partsCoverage: "Compressor parts", laborCoverage: "Excluded" }; }
  it("keeps multiple manufacturer/component and vendor-work coverages with audit", async () => {
    const t = setup(); const component = t.fixture.components[0]; const before = t.repository.snapshot().manufacturerWarranties.length;
    await addEquipmentWarranty(input(component.assetId), t.services);
    await addEquipmentWarranty({ ...input(component.assetId), componentId: component.id, providerKind: "vendor", providerName: "Service company", title: "Repair labor", partsCoverage: "Excluded", laborCoverage: "Repair workmanship" }, t.services);
    const snapshot = t.repository.snapshot(); expect(snapshot.manufacturerWarranties).toHaveLength(before + 2);
    expect(snapshot.manufacturerWarranties.slice(-2).map(w => w.providerKind)).toEqual(["manufacturer", "vendor"]);
    expect(snapshot.manufacturerWarranties.at(-1)?.componentId).toBe(component.id);
    expect(snapshot.auditEvents.filter(e => e.eventType === "equipment_warranty.added")).toHaveLength(2);
  });
  it("rejects a different equipment's component, invalid dates and cross-tenant access", async () => {
    const t = setup(); const component = t.fixture.components[0]; const other = t.fixture.assets.find(a => a.id !== component.assetId)!;
    for (const bad of [{ componentId: component.id }, { expirationDate: "2025-01-01" }, { startDate: "2026-02-30" }, { organizationId: "other-tenant" }]) {
      await expect(addEquipmentWarranty({ ...input(other.id), ...bad }, t.services)).rejects.toBeDefined();
    }
  });
  it("rejects a regional reviewer outside the equipment store", async () => {
    const t = setup(); const regional = t.fixture.memberships.find(m => m.role === "regional_manager")!;
    const grants = t.fixture.scopeGrants.filter(g => g.membershipId === regional.id);
    const asset = t.fixture.assets.find(a => { const store = t.fixture.stores.find(s => s.id === a.storeId)!; return !grants.some(g => g.scopeId === org || g.scopeId === store.id || g.scopeId === store.regionId); })!;
    await expect(addEquipmentWarranty({ ...input(asset.id), actor: { ...actor, actorId: regional.id } }, t.services)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
describe("internal work cost flag", () => {
  it("persists a separate amount and flags cumulative costs once, without changing authorization", async () => {
    const t = setup(); const result = await createWorkOrder(t.services, { organizationId: org, actor, storeId: t.fixture.stores[0].id, problem: "Cost flag regression", accountableParty: "Facilities", nextAction: "Choose service", internalReviewThresholdMinor: 10000, nteAmountMinor: 50000, currency: "USD" });
    const work = await t.repository.getWorkOrder(org, result.id); expect(work?.internalReviewThresholdMinor).toBe(10000); expect(work?.nte?.amountMinor).toBe(50000);
    const cost = { organizationId: org, actor, workOrderId: result.id, kind: "labor" as const, amountMinor: 5000, currency: "USD", description: "Recorded labor", serviceDate: "2026-08-20" };
    await recordWorkOrderCost(t.services, cost); await recordWorkOrderCost(t.services, cost);
    expect((await t.repository.listWorkflowTasksForWorkOrder(org, result.id)).filter(task => task.title === "Review costs above internal flag")).toHaveLength(0);
    await recordWorkOrderCost(t.services, cost); await recordWorkOrderCost(t.services, cost);
    const tasks = (await t.repository.listWorkflowTasksForWorkOrder(org, result.id)).filter(task => task.title === "Review costs above internal flag");
    expect(tasks).toHaveLength(1); expect(tasks[0].blocking).toBe(false);
    expect((await t.repository.getWorkOrder(org, result.id))?.nte).toEqual(work?.nte);
  });
  it("does not combine currencies", async () => {
    const t = setup(); const work = t.fixture.workOrders[0]; work.internalReviewThresholdMinor = 100; work.internalReviewCurrency = "USD";
    const repository = createOpsFixtureRepository(t.fixture);
    await recordWorkOrderCost({ ...t.services, repository }, { organizationId: org, actor, workOrderId: work.id, kind: "parts", amountMinor: 10000, currency: "CAD", description: "Foreign currency cost", serviceDate: "2026-08-20" });
    expect((await repository.listWorkflowTasksForWorkOrder(org, work.id)).some(task => task.title === "Review costs above internal flag")).toBe(false);
  });
});
