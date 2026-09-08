import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("organization-first fixture reads", () => {
  it("does not join hostile same-id records from another tenant", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const otherOrganizationId = "org-hostile";
    fixture.organizations.push({ id: otherOrganizationId, name: "Other Operator", slug: "other", timeZone: "UTC", workOrderPrefix: "OT", createdAt: fixture.asOf });
    fixture.costLines.push({ id: "hostile-cost", organizationId: otherOrganizationId, workOrderId: "wo-northline-104", kind: "other", description: "Must never cross tenant", amount: { amountMinor: 999_999_999, currency: "USD" }, serviceDate: "2026-07-08", recordedAt: fixture.asOf });
    fixture.visits.push({ id: "hostile-visit", organizationId: otherOrganizationId, storeId: "store-northline-104", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", workOrderId: "wo-northline-104", technicianName: "Cross Tenant", providerName: "Wrong Vendor", purpose: "Must never appear", status: "checked_out", startedChannel: "qr", endedChannel: "qr", checkedInAt: "2026-07-08T12:00:00.000Z", checkedOutAt: "2026-07-08T13:00:00.000Z", outcome: "resolved", observedDurationSeconds: 3600 });
    fixture.vendorSpecialties.push({ id: "hostile-specialty", organizationId: otherOrganizationId, vendorId: "vendor-northline-summit", canonicalKey: "hostile", displayName: "Wrong-tenant specialty", searchAliases: ["should-not-search"] });
    const repo = createOpsFixtureRepository(fixture);
    const scope = { organizationId: "org-northline-demo" };
    const detail = await repo.getWorkOrderDetail(scope, "wo-northline-104");
    expect(detail?.visits.some((row) => row.id === "hostile-visit")).toBe(false);
    expect(detail?.recordedCostMinor).toBeLessThan(999_999_999);
    expect((await repo.listVendors(scope, "should-not-search")).items).toHaveLength(0);
    expect((await repo.searchStores(scope, "104")).items[0].recordedCostMinor).toBeLessThan(999_999_999);
  });

  it("applies explicit store scope to aggregates, lists, and details", async () => {
    const repo = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const storeScope = { organizationId: "org-northline-demo", storeIds: ["store-northline-104"] };
    expect((await repo.searchStores(storeScope, "")).items).toHaveLength(1);
    expect((await repo.listWorkOrders(storeScope)).items.every((row) => row.storeId === "store-northline-104")).toBe(true);
    expect(await repo.getStoreDetail(storeScope, "store-northline-105")).toBeNull();
    const period = { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.999Z" };
    const snapshot = await repo.getExecutiveSnapshot(storeScope, period);
    expect(snapshot.scope.storeId).toBe("store-northline-104");
    expect(snapshot.sourceCounts.workOrders).toBe((await repo.listWorkOrders(storeScope, { createdFrom: period.startsAt, createdTo: period.endsAt, limit: 100 })).items.length);
  });

  it("treats the unlinked equipment and component filters as null semantics", async () => {
    const repo = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const scope = { organizationId: "org-northline-demo" };
    const [unlinkedAssets, unlinkedComponents] = await Promise.all([
      repo.listWorkOrders(scope, { assetId: "unlinked", limit: 100 }),
      repo.listWorkOrders(scope, { componentId: "unlinked", limit: 100 }),
    ]);
    expect(unlinkedAssets.items.length).toBeGreaterThan(0);
    expect(unlinkedComponents.items.length).toBeGreaterThan(0);
    expect(unlinkedAssets.items.every((row) => row.internalAccountableParty.length > 0)).toBe(true);
    expect(unlinkedAssets.items.some((row) => row.id === "unlinked")).toBe(false);
  });
});
