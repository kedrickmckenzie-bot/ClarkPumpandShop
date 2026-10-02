import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { sessionHasNoStores } from "@/components/ops/role-policy";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_FIELD_MANAGER, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));

/** The field manager signed in through the real membership resolver, with grants changed per case. */
async function fieldManagerSession(grants: Array<{ scopeKind: "organization" | "region" | "store"; scopeId: string }>) {
  const fixture = buildNorthlinePresentationFixture();
  fixture.scopeGrants = fixture.scopeGrants.filter((grant) => grant.membershipId !== NORTHLINE_FIELD_MANAGER.membership.id)
    .concat(grants.map((grant, index) => ({ ...NORTHLINE_FIELD_MANAGER.scopeGrant, id: `scope-fm-${index}`, ...grant })));
  const { resolveAuthenticatedOperatorSession } = await import("@/lib/server/operator-membership");
  const session = await resolveAuthenticatedOperatorSession(createOpsFixtureRepository(fixture), { userId: NORTHLINE_FIELD_MANAGER.user.id, organizationId: NORTHLINE_ORGANIZATION_ID });
  return { fixture, session };
}

function storesFor(fixture: OpsFixture, session: OperatorSession) {
  return new Set(fixture.stores.filter((store) => (session.storeIds === undefined || session.storeIds.includes(store.id)) && (session.regionIds === undefined || session.regionIds.includes(store.regionId ?? "")) && !sessionHasNoStores(session)).map((store) => store.id));
}

async function screens(fixture: OpsFixture, session: OperatorSession) {
  const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
  const { buildWorkOrderVerificationModel } = await import("@/app/app/_data/work-order-verification-presenter");
  const { buildWorkflowTaskWorkspaceModel } = await import("@/app/app/_data/workflow-task-presenter");
  const { buildEquipmentReview } = await import("@/app/app/_data/equipment-review");
  const { loadWorkReview } = await import("@/lib/ops/work-review");
  const equipment = Number(buildProgramModel(fixture, session, "equipment", {}).metrics.find((metric) => metric.id === "assets")!.value);
  const work = (inScope: boolean) => fixture.workOrders.filter((row) => storesFor(fixture, session).has(row.storeId) === inScope && fixture.workflowTasks.some((task) => task.workOrderId === row.id));
  const inside = work(true)[0], outside = work(false)[0];
  const asset = (inScope: boolean) => fixture.assets.find((row) => storesFor(fixture, session).has(row.storeId) === inScope);
  return {
    equipment,
    verifyInside: inside ? buildWorkOrderVerificationModel(fixture, session, inside.id).available : undefined,
    verifyOutside: outside ? buildWorkOrderVerificationModel(fixture, session, outside.id).available : undefined,
    tasksInside: inside ? buildWorkflowTaskWorkspaceModel(fixture, session, inside.id).activeTasks.length + buildWorkflowTaskWorkspaceModel(fixture, session, inside.id).history.length : undefined,
    tasksOutside: outside ? buildWorkflowTaskWorkspaceModel(fixture, session, outside.id).activeTasks.length + buildWorkflowTaskWorkspaceModel(fixture, session, outside.id).history.length : undefined,
    reviewInside: asset(true) ? buildEquipmentReview(fixture, session, asset(true)!.id, {}) !== null : undefined,
    reviewOutside: asset(false) ? buildEquipmentReview(fixture, session, asset(false)!.id, {}) !== null : undefined,
    workReviewInside: inside ? (await loadWorkReview(createOpsFixtureRepository(fixture), session, inside.id, fixture.asOf)) !== null : undefined,
  };
}

describe("field manager sees exactly the stores the grants allow on every screen", () => {
  it("companywide: all 15 stores, all equipment, verification and tasks available like the facilities manager", async () => {
    const { fixture, session } = await fieldManagerSession([{ scopeKind: "organization", scopeId: NORTHLINE_ORGANIZATION_ID }]);
    expect(session).toMatchObject({ role: "regional", persona: "field_manager" });
    expect([session.regionIds, session.storeIds, session.companywide]).toEqual([undefined, undefined, true]);
    const result = await screens(fixture, session);
    expect(result.equipment).toBe(fixture.assets.length);
    expect(result).toMatchObject({ verifyInside: true, reviewInside: true, workReviewInside: true });
    expect(result.tasksInside).toBeGreaterThan(0);
    const facilities: OperatorSession = { ...session, role: "facilities", persona: undefined, membershipId: "membership-northline-facilities", userId: "user-northline-facilities" };
    expect((await screens(fixture, facilities)).equipment).toBe(result.equipment);
  });

  it("one region: only that region's stores, and records elsewhere stay unavailable", async () => {
    const region = buildNorthlinePresentationFixture().regions[0];
    const { fixture, session } = await fieldManagerSession([{ scopeKind: "region", scopeId: region.id }]);
    expect(session.regionIds).toEqual([region.id]);
    expect(session.companywide).toBeUndefined();
    const result = await screens(fixture, session);
    expect(result.equipment).toBe(fixture.assets.filter((asset) => fixture.stores.find((store) => store.id === asset.storeId)?.regionId === region.id).length);
    expect(result).toMatchObject({ verifyInside: true, verifyOutside: false, reviewInside: true, reviewOutside: false, workReviewInside: true, tasksOutside: 0 });
    expect(result.tasksInside).toBeGreaterThan(0);
  });

  it("one store: only that store", async () => {
    const { fixture, session } = await fieldManagerSession([{ scopeKind: "store", scopeId: "store-northline-104" }]);
    expect(session.storeIds).toEqual(["store-northline-104"]);
    const result = await screens(fixture, session);
    expect(result.equipment).toBe(fixture.assets.filter((asset) => asset.storeId === "store-northline-104").length);
    expect(result).toMatchObject({ verifyInside: true, verifyOutside: false, reviewInside: true, reviewOutside: false, tasksOutside: 0 });
  });

  it("no stores: cannot sign in, and an explicitly empty scope shows nothing", async () => {
    await expect(fieldManagerSession([])).rejects.toThrow(/No stores are assigned/);
    const { fixture, session } = await fieldManagerSession([{ scopeKind: "organization", scopeId: NORTHLINE_ORGANIZATION_ID }]);
    for (const empty of [{ ...session, regionIds: [] }, { ...session, storeIds: [] }]) {
      expect(sessionHasNoStores(empty)).toBe(true);
      const result = await screens(fixture, empty);
      expect(result).toMatchObject({ equipment: 0, reviewOutside: false, verifyOutside: false, tasksOutside: 0 });
    }
    // A location-scoped role with no lists is companywide only when sign-in confirmed it.
    expect(sessionHasNoStores({ role: "regional" })).toBe(true);
    expect(sessionHasNoStores({ role: "store_manager" })).toBe(true);
    expect(sessionHasNoStores({ role: "regional", companywide: true })).toBe(false);
    expect(sessionHasNoStores({ role: "facilities" })).toBe(false);
  });
});
