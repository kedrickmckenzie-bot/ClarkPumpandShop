import { describe, expect, it } from "vitest";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { reportFoundProblem, underWarranty } from "@/lib/ops/found-problem";
import type { ActorContext } from "@/lib/ops/types";

const AS_OF = "2026-10-15T18:00:00.000Z", TODAY = "2026-10-15";

function setup() {
  const f = buildShowcaseFixture(AS_OF), repository = createOpsFixtureRepository(f), org = f.organizations[0]!.id;
  const tech = "membership-northline-tech-1";
  const actor: ActorContext = { actorType: "user", actorId: tech, actorName: "Maria Santos", organizationId: org };
  return { f, repository, org, tech, actor };
}

describe("a technician reports a problem they found", () => {
  it("fix now: the job is theirs straight away and marked as found by them", async () => {
    const { repository, org, tech, actor, f } = setup();
    const store = (await repository.listStoreIdsForMembership(org, tech))[0]!;
    const asset = f.assets.find(a => a.storeId === store && a.categoryKey === "plumbing") ?? undefined;
    const work = await reportFoundProblem({ repository }, { organizationId: org, actor, storeId: store, assetId: asset?.id, problem: "Mop sink faucet is dripping", fixNow: true, today: TODAY, key: "found-problem-test-1" });
    const saved = await repository.getWorkOrder(org, work.id);
    expect(saved).toMatchObject({ foundByMembershipId: tech, problem: "Mop sink faucet is dripping" });
    expect(await repository.getActiveAssignment(org, work.id)).toMatchObject({ kind: "internal", internalMembershipId: tech });
    // A retry with the same key returns the same job, never a second one.
    const again = await reportFoundProblem({ repository }, { organizationId: org, actor, storeId: store, assetId: asset?.id, problem: "Mop sink faucet is dripping", fixNow: true, today: TODAY, key: "found-problem-test-1" });
    expect(again.id).toBe(work.id);
  });

  it("send to manager: the job waits for a manager to choose who handles it", async () => {
    const { repository, org, tech, actor } = setup();
    const store = (await repository.listStoreIdsForMembership(org, tech))[0]!;
    const work = await reportFoundProblem({ repository }, { organizationId: org, actor, storeId: store, problem: "Back door closer is broken", fixNow: false, today: TODAY, key: "found-problem-test-2" });
    expect(await repository.getWorkOrder(org, work.id)).toMatchObject({ foundByMembershipId: tech, accountableParty: "Facilities coordinator" });
    expect(await repository.getActiveAssignment(org, work.id)).toMatchObject({ kind: "choose_later" });
    // The tech can still find what they sent, until a manager routes it.
    const scope = { organizationId: org, storeIds: [store] };
    const sent = await repository.listWorkOrders(scope, { foundByMembershipId: tech, limit: 25 });
    expect(sent.items.find(job => job.id === work.id)).toMatchObject({ assignmentKind: "choose_later" });
  });

  it("won't let a tech repair warrantied equipment on the spot, and keeps techs to their own stores", async () => {
    const { repository, org, tech, actor, f } = setup();
    const stores = await repository.listStoreIdsForMembership(org, tech);
    let covered: { storeId: string; assetId: string } | undefined;
    for (const asset of f.assets.filter(a => stores.includes(a.storeId))) if (await underWarranty({ repository }, org, asset.storeId, asset.id, TODAY)) { covered = { storeId: asset.storeId, assetId: asset.id }; break; }
    expect(covered, "the demo has warrantied equipment in Maria's stores").toBeDefined();
    await expect(reportFoundProblem({ repository }, { organizationId: org, actor, ...covered!, problem: "Making a loud noise", fixNow: true, today: TODAY, key: "found-problem-test-3" })).rejects.toThrow(/under warranty/);
    expect((await reportFoundProblem({ repository }, { organizationId: org, actor, ...covered!, problem: "Making a loud noise", fixNow: false, today: TODAY, key: "found-problem-test-4" })).id).toBeTruthy();
    // Limit Alex to one store, then try another.
    const limited = buildShowcaseFixture(AS_OF), alexId = "membership-northline-tech-3";
    const grant = limited.scopeGrants.find(g => g.membershipId === alexId)!;
    Object.assign(grant, { scopeKind: "store", scopeId: limited.stores[0]!.id });
    limited.scopeGrants = limited.scopeGrants.filter(g => g.membershipId !== alexId || g === grant);
    await expect(reportFoundProblem({ repository: createOpsFixtureRepository(limited) }, { organizationId: org, actor: { ...actor, actorId: alexId, actorName: "Alex Morgan" }, storeId: limited.stores[1]!.id, problem: "Leak", fixNow: true, today: TODAY, key: "found-problem-test-5" })).rejects.toThrow(/don't cover/);
    const manager: typeof actor = { ...actor, actorId: "membership-northline-facilities" };
    await expect(reportFoundProblem({ repository }, { organizationId: org, actor: manager, storeId: stores[0]!, problem: "Leak", fixNow: true, today: TODAY, key: "found-problem-test-6" })).rejects.toThrow(/Only technicians/);
  });
});
