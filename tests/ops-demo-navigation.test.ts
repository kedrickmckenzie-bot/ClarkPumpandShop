import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildProgramModel } from "@/app/app/_data/operator-presenter";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildMaintenancePlan } from "@/lib/ops/maintenance-plan";
import { workListNavigation } from "@/lib/ops/work-list-navigation";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import type { OperatorSession } from "@/components/ops/data-contract";

vi.mock("server-only", () => ({}));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "demo", displayName: "Demo", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Store 104", role: "facilities", permissions: ["ops:*"], demoEdition: "complete", storeIds: ["store-northline-104"] };
const query = (href: string) => Object.fromEntries(new URL(href, "http://local.test").searchParams);

describe("demo navigation and planning", () => {
  it("keeps evidence filters while removing incompatible queue filters", () => {
    const history = workListNavigation({ store: "104", vendor: "vendor", costFrom: "2026-01-01", q: "cooler", stage: "not-sent", visitPlan: "ready", selected: "old", page: "3" }).find((item) => item.value === "history")!;
    expect(query(history.href)).toEqual({ store: "104", vendor: "vendor", costFrom: "2026-01-01", q: "cooler", status: "history" });
    expect(query(workListNavigation({ status: "history" }).find((item) => item.value === "all")!.href).status).toBe("all");
  });

  it("history returns both terminal statuses and all work retains the full scoped set", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const history = await buildQueryListModel(repository, session, "work-orders", { status: "history" });
    const expected = fixture.workOrders.filter((work) => work.organizationId === session.organizationId && session.storeIds!.includes(work.storeId) && ["closed", "cancelled"].includes(work.status));
    expect(history.table.rows.every((row) => expected.some((work) => work.id === row.id))).toBe(true);
    expect(history.resultSummary).toContain(String(expected.length));
    const all = await buildQueryListModel(repository, session, "work-orders", { status: "all" });
    expect(all.resultSummary).toContain(String(fixture.workOrders.filter((work) => work.organizationId === session.organizationId && session.storeIds!.includes(work.storeId)).length));
  });

  it("equipment type and store groups reconcile to exact scoped records", () => {
    const fixture = buildNorthlinePresentationFixture();
    for (const browse of ["types", "stores"]) {
      const grouped = buildProgramModel(fixture, session, "equipment", { browse });
      const ids = new Set<string>();
      for (const row of grouped.table!.rows) {
        const detail = buildProgramModel(fixture, session, "equipment", query(row.href));
        expect(detail.table!.rows.length).toBe(Number(row.cells.find((cell) => cell.key === "count")!.value));
        for (const asset of detail.table!.rows) { expect(ids.has(asset.id)).toBe(false); ids.add(asset.id); }
      }
      expect([...ids].sort()).toEqual(fixture.assets.filter((asset) => asset.organizationId === session.organizationId && session.storeIds!.includes(asset.storeId)).map((asset) => asset.id).sort());
    }
    const gas = buildProgramModel(fixture, session, "equipment", { q: "gas pumps" });
    expect(gas.table!.rows.length).toBeGreaterThan(0);
  });

  it("plan totals use repair estimates, not NTE or invoices, and exclude terminal/foreign work", () => {
    const fixture = buildNorthlinePresentationFixture();
    const selected = fixture.workOrders.find((work) => work.storeId === "store-northline-104")!;
    selected.status = "approved";
    selected.repairEstimate = { amountMinor: 12000, currency: "USD" };
    selected.nte = { amountMinor: 900000, currency: "USD" };
    const foreign = { ...selected, id: "foreign", organizationId: "other" };
    const closed = { ...selected, id: "closed", status: "closed" as const };
    const unknown = { ...selected, id: "unknown", repairEstimate: undefined };
    fixture.workOrders.push(foreign, closed, unknown);
    const plan = buildMaintenancePlan(fixture, session.organizationId, new Set([selected.id, foreign.id, closed.id, unknown.id]), "USD");
    expect(plan.estimateLabel).toBe("$120");
    expect(plan.totalCount).toBe(2);
    expect(plan.unpricedCount).toBe(1);
    expect(plan.rows.some((row) => row.estimate === "Price needed")).toBe(true);
  });

  it("planning retains store and vendor scope across pages and ignores historical cost windows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const scoped = buildTrendsModel(fixture, session, { view: "planning", vendor: "vendor-northline-summit", period: "3" }).maintenancePlan!;
    expect(scoped.totalCount).toBeGreaterThan(0);
    for (const row of scoped.rows) {
      const work = fixture.workOrders.find((work) => work.id === row.id)!;
      expect(work.storeId).toBe("store-northline-104");
      expect(fixture.assignments.some((assignment) => assignment.workOrderId === work.id && assignment.vendorId === "vendor-northline-summit")).toBe(true);
    }
    const company = { ...session, storeIds: undefined };
    const first = buildTrendsModel(fixture, company, { view: "planning", period: "3" }).maintenancePlan!;
    const second = buildTrendsModel(fixture, company, { view: "planning", period: "24", planPage: "2" }).maintenancePlan!;
    expect(first.totalCount).toBe(second.totalCount);
    expect(second.page).toBe(2);
    expect(second.rows.some((row) => first.rows.some((prior) => prior.id === row.id))).toBe(false);
    expect(buildTrendsModel(fixture, { ...session, storeIds: [] }, { view: "planning" }).maintenancePlan!.totalCount).toBe(0);
  });
});
