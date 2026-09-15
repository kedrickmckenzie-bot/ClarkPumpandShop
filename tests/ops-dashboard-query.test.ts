import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { dashboardQueryRegression } from "./helpers/dashboard-query-regression";

describe("dashboard activity and paginated source groups", () => {
  it("keeps current queues separate from service-date costs and matches the source lists", async () => {
    const fixture = buildNorthlinePresentationFixture();
    await dashboardQueryRegression(createOpsFixtureRepository(fixture), fixture);
  });

  it("preserves unclassified and zero-cost sources, excludes foreign/future costs, and separates currencies", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const store = fixture.stores.find(row => row.storeNumber === "104")!;
    const work = fixture.workOrders.find(row => row.storeId === store.id && row.status === "approved")!;
    work.categoryKey = undefined;
    work.createdAt = "2020-01-01T00:00:00.000Z";
    const cost = fixture.costLines[0];
    fixture.costLines = [
      { ...cost, id: "cost-zero", workOrderId: work.id, serviceDate: "2026-08-25", amount: { amountMinor: 0, currency: "USD" } },
      { ...cost, id: "cost-in-window", workOrderId: work.id, serviceDate: "2026-08-25", amount: { amountMinor: 12345, currency: "USD" } },
      { ...cost, id: "cost-next-day", workOrderId: work.id, serviceDate: "2026-08-26", amount: { amountMinor: 900000, currency: "USD" } },
      { ...cost, id: "cost-cad", workOrderId: work.id, serviceDate: "2026-08-25", amount: { amountMinor: 9900, currency: "CAD" } },
      { ...cost, id: "cost-foreign", organizationId: "another-company", workOrderId: work.id, serviceDate: "2026-08-25", amount: { amountMinor: 900000, currency: "USD" } },
    ];
    const repository = createOpsFixtureRepository(fixture);
    const scope = { organizationId: work.organizationId, storeIds: [store.id] };
    const window = { asOf: fixture.asOf, costFrom: "2026-08-25", costTo: "2026-08-25", currency: "USD" };
    expect(await repository.getDashboardActivity(scope, window)).toMatchObject({
      recordedCostMinor: 12345, costWorkOrders: 1, costLines: 2,
      unclassifiedCostMinor: 12345, unclassifiedCostWorkOrders: 1, openWork: 8,
    });
    const group = await repository.listDashboardBreakdown(scope, window, { kind: "cost_category", limit: 1 });
    expect(group.items).toEqual([{ id: "unclassified", label: "unclassified", value: 12345 }]);
    expect(group.totalCount).toBeGreaterThan(1);
    expect(group.totalValue).toBe(12345);
    const usd = await repository.getDashboardActivity(scope, window);
    const cad = await repository.getDashboardActivity(scope, { ...window, currency: "CAD" });
    expect(cad.recordedCostMinor).toBe(9900);
    expect(cad.openWork).toBe(usd.openWork);
    expect((await repository.listWorkOrders(scope, { statuses: ["approved"], limit: 100 })).items.some(row => row.id === work.id)).toBe(true);
  });

  it("counts a visit as linked when the work reference is on the join record", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const visit = fixture.visits.find(row => row.workOrderId && fixture.siteVisitWorkOrders.some(link => link.visitId === row.id))!;
    const repository = createOpsFixtureRepository(fixture);
    const scope = { organizationId: visit.organizationId };
    const window = { asOf: fixture.asOf, costFrom: "2025-09-01", costTo: fixture.asOf.slice(0, 10), currency: "USD" };
    const before = await repository.getDashboardActivity(scope, window);
    visit.workOrderId = undefined;
    const after = await createOpsFixtureRepository(fixture).getDashboardActivity(scope, window);
    expect(after.visitsWithoutWork).toBe(before.visitsWithoutWork);
  });
});
