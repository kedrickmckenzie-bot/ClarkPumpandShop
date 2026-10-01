import { describe, expect, it } from "vitest";
import { createComplianceSchedulesForStores, storeTeamOwner } from "@/lib/ops/compliance";
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

  it("names the store manager the form shows, and saves that same person", async () => {
    const { repository, stores } = setup();
    const store = stores[0];
    const owner = await storeTeamOwner(repository, NORTHLINE_ORGANIZATION_ID, store);
    expect(owner?.displayName).toBeTruthy();
    const [schedule] = await createComplianceSchedulesForStores({ repository }, base, [store.id], { kind: "team" }, actor);
    expect(schedule.membershipId).toBe(owner!.membershipId);
  });

  it("returns the same schedules when the same form is submitted twice", async () => {
    const { repository, stores } = setup();
    const ids = stores.slice(0, 3).map((store) => store.id);
    const before = (await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length;
    const first = await createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [], "submission-retry-1");
    // Same stores in a different order is the same request.
    const again = await createComplianceSchedulesForStores({ repository }, base, [...ids].reverse(), { kind: "team" }, actor, [], "submission-retry-1");
    expect(again.map((row) => row.id).sort()).toEqual(first.map((row) => row.id).sort());
    expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before + 3);
  });

  it("refuses a retry whose details changed instead of returning the old schedules", async () => {
    const { fixture, repository, stores } = setup();
    const ids = stores.slice(0, 3).map((store) => store.id);
    const file = { id: "file-1", organizationId: NORTHLINE_ORGANIZATION_ID, storageKey: "k1", sha256: "a".repeat(64), originalName: "form.pdf", contentType: "application/pdf", byteLength: 10, status: "available" as const, createdAt: "2026-10-01T00:00:00.000Z" };
    await createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [file], "submission-changed");
    const before = (await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length;
    const vendor = fixture.vendors.find((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID && row.status === "approved")!;
    const changes: Array<[string, Parameters<typeof createComplianceSchedulesForStores>]> = [
      ["name", [{ repository }, { ...base, name: "Hood check" }, ids, { kind: "team" }, actor, [file], "submission-changed"]],
      ["first due date", [{ repository }, { ...base, firstDueDate: "2026-12-01" }, ids, { kind: "team" }, actor, [file], "submission-changed"]],
      ["recurrence", [{ repository }, { ...base, intervalCount: 6 }, ids, { kind: "team" }, actor, [file], "submission-changed"]],
      ["assignment", [{ repository }, base, ids, { kind: "vendor", vendorId: vendor.id }, actor, [file], "submission-changed"]],
      ["documents", [{ repository }, base, ids, { kind: "team" }, actor, [{ ...file, sha256: "b".repeat(64) }], "submission-changed"]],
      ["fewer stores", [{ repository }, base, ids.slice(0, 2), { kind: "team" }, actor, [file], "submission-changed"]],
      ["other stores", [{ repository }, base, stores.slice(3, 6).map((store) => store.id), { kind: "team" }, actor, [file], "submission-changed"]],
    ];
    for (const [, args] of changes) await expect(createComplianceSchedulesForStores(...args)).rejects.toMatchObject({ code: "CONFLICT" });
    // A re-uploaded identical file (new storage key, same content) is still the same request.
    await expect(createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [{ ...file, id: "file-2", storageKey: "k2" }], "submission-changed")).resolves.toHaveLength(3);
    expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before);
  });

  it("creates one set of schedules when the same form is submitted twice at once", async () => {
    const { repository, stores } = setup();
    const ids = stores.slice(0, 3).map((store) => store.id);
    const before = (await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length;
    const [left, right] = await Promise.all([
      createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [], "submission-race-1"),
      createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [], "submission-race-1"),
    ]);
    expect(right.map((row) => row.id).sort()).toEqual(left.map((row) => row.id).sort());
    expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before + 3);
    // A different request racing on the same key is a conflict, not a silent second result.
    const outcomes = await Promise.allSettled([
      createComplianceSchedulesForStores({ repository }, base, ids, { kind: "team" }, actor, [], "submission-race-2"),
      createComplianceSchedulesForStores({ repository }, { ...base, name: "Different" }, ids, { kind: "team" }, actor, [], "submission-race-2"),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before + 6);
  });

  it("saves every store or none when the save itself fails", async () => {
    const { repository, stores } = setup();
    const before = (await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length;
    let writes = 0;
    const failing = new Proxy(repository, { get(target, key, receiver) {
      if (key === "atomicWrite") return async () => { writes += 1; throw new Error("database unavailable"); };
      return Reflect.get(target, key, receiver);
    } });
    await expect(createComplianceSchedulesForStores({ repository: failing }, base, stores.slice(0, 3).map((store) => store.id), { kind: "team" }, actor)).rejects.toThrow("database unavailable");
    expect(writes).toBe(1);
    expect((await repository.listComplianceSchedules({ organizationId: NORTHLINE_ORGANIZATION_ID })).length).toBe(before);
  });
});
