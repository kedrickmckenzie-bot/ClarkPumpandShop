import { describe, expect, it } from "vitest";
import { createWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID as organizationId } from "@/lib/ops/fixtures";
import { createAsset, createMaintenanceProgramAndEnrollEquipment, overridePmPlanCadence } from "@/lib/ops/setup-commands";
import { coveredPmAssets } from "@/lib/ops/pm-coverage";

const actor = { organizationId, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
function harness() {
  const repository = createNorthlineFixtureRepository(); let sequence = 0;
  const svc: OpsCommandServices = { repository, clock: { now: () => "2026-08-10T19:00:00.000Z" }, ids: { next: p => `${p}-coverage-${++sequence}` } };
  return { repository, svc };
}
const input = { organizationId, name: "Quarterly HVAC network service", applicableEquipmentTemplateIds: [], categoryKey: "hvac", storeIds: ["store-northline-101", "store-northline-102"], cadenceDays: 90, completionWindowDays: 7, firstDueAt: "2026-08-15T00:00:00.000Z", actor };
describe("store-based PM coverage", () => {
  it("creates one occurrence per selected store, snapshots several units into one work order, and keeps history when coverage changes", async () => {
    const { repository, svc } = harness();
    const result = await createMaintenanceProgramAndEnrollEquipment(svc, input);
    expect(result.plans).toHaveLength(2); expect(result.occurrences).toHaveLength(2);
    expect(result.plans.every(p => !p.assetId)).toBe(true);
    const plan = result.plans[0], occurrence = result.occurrences[0];
    const assets = await repository.listAssetsForStore(organizationId, plan.storeId!);
    const expected = coveredPmAssets(plan, assets);
    expect(expected.length).toBeGreaterThan(1);
    const work = await createWorkOrder(svc, { organizationId, storeId: plan.storeId!, pmOccurrenceId: occurrence.id, problem: "HVAC service", categoryKey: "hvac", priority: "planned", accountableParty: "Facilities", nextAction: "Assign vendor", actor });
    const items = repository.snapshot().pmWorkItems.filter(i => i.workOrderId === work.id);
    expect(items.map(i => i.assetId).sort()).toEqual(expected.map(a => a.id).sort());
    const added = assets.find(a => a.categoryKey !== "hvac" && a.status !== "retired")!;
    const updated = await overridePmPlanCadence(svc, { organizationId, planId: plan.id, cadenceDays: 45, completionWindowDays: 5, coverage: { includedAssetIds: [added.id], excludedAssetIds: [expected[0].id] }, reason: "Store needs different service", actor });
    expect(coveredPmAssets(updated, assets).map(a => a.id)).toContain(added.id);
    expect(coveredPmAssets(updated, assets).map(a => a.id)).not.toContain(expected[0].id);
    expect(repository.snapshot().pmWorkItems.filter(i => i.workOrderId === work.id)).toEqual(items);
    expect((await repository.getPmPlan(organizationId, result.plans[1].id))?.cadenceDays).toBe(90);
    const reset = await overridePmPlanCadence(svc, { organizationId, planId: plan.id, cadenceDays: 45, completionWindowDays: 5, useDefaults: true, reason: "", actor });
    expect(reset.cadenceDays).toBe(90); expect(reset.cadenceOverrideReason).toBeUndefined();
    expect(coveredPmAssets(reset, assets).map(a => a.id)).toEqual(expected.map(a => a.id));
  });
  it("automatically includes newly classified equipment without adding extra plans", async () => {
    const { repository, svc } = harness(); const result = await createMaintenanceProgramAndEnrollEquipment(svc, input);
    const asset = await createAsset(svc, { organizationId, storeId: input.storeIds[0], categoryKey: "hvac", assetTag: "NEW-HVAC", name: "New HVAC unit", status: "operational", actor });
    expect(coveredPmAssets(result.plans[0], await repository.listAssetsForStore(organizationId, input.storeIds[0])).map(a => a.id)).toContain(asset.id);
    expect(repository.snapshot().pmPlans.filter(p => p.programId === result.program.id)).toHaveLength(2);
    const page = await repository.listPmSetup({ organizationId }, { kind: "targets", program: result.program.id, asOf: "2026-08-10T19:00:00.000Z" });
    expect(page.totalCount).toBe(2); expect(page.summary.covered).toBe(2);
  });
  it("versions company edits, preserves store exceptions and old occurrences, and adds only newly selected stores", async () => {
    const { repository, svc } = harness();
    const first = await createMaintenanceProgramAndEnrollEquipment(svc, input);
    const before = repository.snapshot().pmOccurrences.filter(o => o.programId === first.program.id);
    await overridePmPlanCadence(svc, { organizationId, planId: first.plans[0].id, cadenceDays: 30, completionWindowDays: 3, reason: "Busy store", actor });
    await overridePmPlanCadence(svc, { organizationId, planId: first.plans[1].id, cadenceDays: 90, completionWindowDays: 7, instructions: "Use side entrance", reason: "Access note only", actor });
    const next = await createMaintenanceProgramAndEnrollEquipment(svc, { ...input, replacesProgramId: first.program.id, cadenceDays: 60, storeIds: [...input.storeIds, "store-northline-103"] });
    expect(next.program.version).toBe(2); expect(next.program.supersedesProgramId).toBe(first.program.id);
    expect(next.plans).toHaveLength(3); expect(next.occurrences).toHaveLength(1);
    expect(next.plans.find(p => p.storeId === input.storeIds[0])?.cadenceDays).toBe(30);
    expect(next.plans.find(p => p.storeId === input.storeIds[1])?.cadenceDays).toBe(60);
    expect(repository.snapshot().pmOccurrences.filter(o => o.programId === first.program.id)).toEqual(before);
    expect((await repository.getMaintenanceProgram(organizationId, first.program.id))?.status).toBe("superseded");
  });
  it("keeps retired equipment out and can remove a store without deleting its history", async () => {
    const { repository, svc } = harness(); const result = await createMaintenanceProgramAndEnrollEquipment(svc, input); const plan = result.plans[0];
    const assets = await repository.listAssetsForStore(organizationId, plan.storeId!);
    expect(coveredPmAssets(plan, assets.map(a => ({ ...a, status: "retired" })))).toHaveLength(0);
    await overridePmPlanCadence(svc, { organizationId, planId: plan.id, cadenceDays: 90, completionWindowDays: 7, active: false, reason: "Store removed", actor });
    expect(repository.snapshot().pmOccurrences.some(o => o.id === result.occurrences[0].id)).toBe(true);
    await expect(createWorkOrder(svc, { organizationId, storeId: plan.storeId!, pmOccurrenceId: result.occurrences[0].id, problem: "HVAC service", categoryKey: "hvac", priority: "planned", accountableParty: "Facilities", nextAction: "Assign vendor", actor })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects foreign stores and equipment exceptions without partial writes", async () => {
    const { repository, svc } = harness();
    await expect(createMaintenanceProgramAndEnrollEquipment(svc, { ...input, storeIds: [input.storeIds[0], "foreign"] })).rejects.toMatchObject({ code: "VALIDATION" });
    const result = await createMaintenanceProgramAndEnrollEquipment(svc, input);
    await expect(overridePmPlanCadence(svc, { organizationId, planId: result.plans[0].id, cadenceDays: 45, completionWindowDays: 5, coverage: { includedAssetIds: ["asset-102-beer-cave"], excludedAssetIds: [] }, reason: "Invalid", actor })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await repository.getPmPlan(organizationId, result.plans[0].id))?.cadenceDays).toBe(90);
  });
});
