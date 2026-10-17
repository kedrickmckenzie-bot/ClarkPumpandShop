import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID as org } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createWorkOrder } from "@/lib/ops/commands";

const actor = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
function setup() {
  const fixture = buildNorthlinePresentationFixture(); const repository = createOpsFixtureRepository(fixture); let i = 0;
  return { fixture, repository, services: { repository, clock: { now: () => "2026-08-25T14:00:00.000Z" }, ids: { next: (prefix: string) => `${prefix}-category-${++i}` } } };
}
const base = { organizationId: org, actor, accountableParty: "Facilities", nextAction: "Choose service" };

describe("a new job's category", () => {
  it("comes from the equipment when no category is picked, so reports never drop it", async () => {
    const t = setup(); const asset = t.fixture.assets.find(a => a.categoryKey)!;
    const { id } = await createWorkOrder(t.services, { ...base, storeId: asset.storeId, assetId: asset.id, problem: "Not cooling" });
    const work = await t.repository.getWorkOrder(org, id);
    expect(work?.categoryKey).toBe(asset.categoryKey);
    expect(t.repository.snapshot().workOrders.find(w => w.id === id)?.categoryKey).toBe(asset.categoryKey);
  });

  it("comes from the chosen equipment group when no category is picked", async () => {
    const t = setup(); const group = t.fixture.taxonomyNodes.find(n => n.active && n.parentNodeId)!;
    let root = group; while (root.parentNodeId) root = t.fixture.taxonomyNodes.find(n => n.id === root.parentNodeId)!;
    const { id } = await createWorkOrder(t.services, { ...base, storeId: t.fixture.stores[0].id, taxonomyNodeId: group.id, problem: "Needs a look" });
    expect((await t.repository.getWorkOrder(org, id))?.categoryKey).toBe(root.canonicalKey);
  });

  it("still refuses equipment from a different category and allows choosing later", async () => {
    const t = setup(); const asset = t.fixture.assets.find(a => a.categoryKey === "refrigeration")!;
    await expect(createWorkOrder(t.services, { ...base, storeId: asset.storeId, assetId: asset.id, categoryKey: "plumbing", problem: "Wrong pick" })).rejects.toThrow(/category/);
    const { id } = await createWorkOrder(t.services, { ...base, storeId: asset.storeId, problem: "Unknown yet" });
    expect((await t.repository.getWorkOrder(org, id))?.categoryKey).toBeUndefined();
  });
});
