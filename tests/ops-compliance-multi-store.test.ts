import { describe, expect, it } from "vitest";
import { createComplianceSchedulesForStores } from "@/lib/ops/compliance";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { ActorContext } from "@/lib/ops/types";

const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "user-northline-facilities", actorName: "Jordan Lee" } as ActorContext;
const base = { organizationId: NORTHLINE_ORGANIZATION_ID, name: "Fire extinguisher check", instructions: "", requirementSource: "", evidenceLabel: "Inspection report", kind: "inspection" as const, firstDueDate: "2026-11-01", intervalUnit: "months" as const, intervalCount: 12, leadDays: 30, evidenceRequired: 1, escalationDays: 0, escalationTo: "Facilities coordinator" };

function setup() {
  const fixture = buildNorthlinePresentationFixture();
  const repository = createOpsFixtureRepository(fixture);
  const stores = fixture.stores.filter((store) => store.organizationId === NORTHLINE_ORGANIZATION_ID);
  return { fixture, repository, stores };
}

describe("inspection schedules for several stores", () => {
  it("assigns each store its own store manager when the store team handles it", async () => {
    const { repository, stores } = setup();
    const chosen = stores.slice(0, 3);
    const created = await createComplianceSchedulesForStores({ repository }, base, chosen.map((store) => store.id), { kind: "team" }, actor);
    expect(created.map((schedule) => schedule.storeId)).toEqual(chosen.map((store) => store.id));
    for (const schedule of created) {
      expect(schedule.handler).toBe("internal");
      expect(schedule.membershipId).toBe(`membership-northline-store-${chosen.find((store) => store.id === schedule.storeId)!.storeNumber}`);
    }
  });

  it("uses one outside vendor for every store it covers and saves nothing when it misses one", async () => {
    const { fixture, repository, stores } = setup();
    const vendor = fixture.vendors.find((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID && row.status === "approved")!;
    const covered: string[] = [];
    for (const store of stores) if (await repository.vendorCoversStore(NORTHLINE_ORGANIZATION_ID, vendor.id, store.id)) covered.push(store.id);
    const created = await createComplianceSchedulesForStores({ repository }, base, covered.slice(0, 2), { kind: "vendor", vendorId: vendor.id }, actor);
    expect(created.every((schedule) => schedule.handler === "vendor" && schedule.vendorId === vendor.id)).toBe(true);

    const uncovered = stores.find((store) => !covered.includes(store.id));
    if (uncovered) {
      const before = (await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length;
      await expect(createComplianceSchedulesForStores({ repository }, base, [covered[0], uncovered.id], { kind: "vendor", vendorId: vendor.id }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
      expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before);
    }
  });

  it("keeps a named person and an equipment tag to a single store", async () => {
    const { repository, stores } = setup();
    const ids = stores.slice(0, 2).map((store) => store.id);
    await expect(createComplianceSchedulesForStores({ repository }, base, ids, { kind: "person", membershipId: "membership-northline-facilities" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createComplianceSchedulesForStores({ repository }, { ...base, assetId: "asset-101-beer-cave" }, ids, { kind: "team" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createComplianceSchedulesForStores({ repository }, base, [], { kind: "team" }, actor)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
