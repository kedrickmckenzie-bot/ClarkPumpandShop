import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildProgramModel } from "@/app/app/_data/operator-presenter";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildMaintenancePlan } from "@/lib/ops/maintenance-plan";
import { workListNavigation } from "@/lib/ops/work-list-navigation";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import { planningScenario } from "@/lib/ops/planning-scenario";
import { workCreatedRange } from "@/lib/ops/work-created-range";
import type { OperatorSession } from "@/components/ops/data-contract";

vi.mock("server-only", () => ({}));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "demo", displayName: "Demo", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Store 104", role: "facilities", permissions: ["ops:*"], demoEdition: "complete", storeIds: ["store-northline-104"] };
const query = (href: string) => Object.fromEntries(new URL(href, "http://local.test").searchParams);

describe("demo navigation and planning", () => {
  it("saves and replaces personal scenarios without changing another owner's view", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const input = { id: "scenario-one", organizationId: session.organizationId, ownerMembershipId: "owner-one", surface: "trends", name: "Repair allowance", queryString: "view=planning&planTarget=50000&planAllowance=1000.10", createdAt: "2026-09-15T00:00:00.000Z" };
    await repository.putSavedView(input);
    await repository.putSavedView({ ...input, id: "scenario-other", ownerMembershipId: "owner-two" });
    await repository.putSavedView({ ...input, id: "scenario-revised", queryString: "view=planning&planTarget=60000" });
    expect(await repository.listSavedViews(session.organizationId, "owner-one", "trends")).toEqual([expect.objectContaining({ id: "scenario-revised", queryString: "view=planning&planTarget=60000" })]);
    expect(await repository.listSavedViews(session.organizationId, "owner-two", "trends")).toEqual([expect.objectContaining({ queryString: input.queryString })]);
    expect(await repository.listSavedViews("other-org", "owner-one", "trends")).toEqual([]);
  });
  it("compares money in minor units and preserves personal scenario assumptions for saving", () => {
    const scenario = planningScenario(new URLSearchParams("planTarget=50000&planAllowance=1000.10&planContingency=250.20"), 3665000);
    expect(scenario).toMatchObject({ target: 5000000, total: 3790030, gap: 1209970, invalid: false });
    expect(planningScenario(new URLSearchParams("planTarget=-1"), 0).invalid).toBe(true);
    expect(planningScenario(new URLSearchParams("planTarget=1e9"), 0).invalid).toBe(true);
    expect(planningScenario(new URLSearchParams("planTarget=1.123"), 0).invalid).toBe(true);
    expect(planningScenario(new URLSearchParams("planTarget=0"), 1).gap).toBe(-1);
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session, { view: "planning", planTarget: "50000", planAllowance: "1000.10", planContingency: "250.20" });
    expect(new URLSearchParams(model.canonicalQuery).get("planTarget")).toBe("50000");
    expect(new URLSearchParams(model.canonicalQuery).get("planAllowance")).toBe("1000.10");
  });

  it("filters work by inclusive created dates, independently of cost dates", async () => {
    expect(workCreatedRange("2026-08-01", "2026-08-25")).toEqual({ createdFrom: "2026-08-01T00:00:00.000Z", createdTo: "2026-08-26T00:00:00.000Z" });
    expect(() => workCreatedRange("2026-02-30")).toThrow();
    expect(() => workCreatedRange("2026-08-26", "2026-08-25")).toThrow();
    const fixture = buildNorthlinePresentationFixture();
    const model = await buildQueryListModel(createOpsFixtureRepository(fixture), session, "work-orders", { status: "all", createdFrom: "2026-08-01", createdThrough: "2026-08-25" });
    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.every((row) => { const work = fixture.workOrders.find((work) => work.id === row.id)!; return work.createdAt >= "2026-08-01" && work.createdAt < "2026-08-26"; })).toBe(true);
  });
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
