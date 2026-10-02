import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildQueryDashboardModel: typeof import("@/app/app/_data/operator-query-presenter").buildQueryDashboardModel;
let buildQueryListModel: typeof import("@/app/app/_data/operator-query-presenter").buildQueryListModel;
let buildQuerySearchModel: typeof import("@/app/app/_data/operator-query-presenter").buildQuerySearchModel;

beforeAll(async () => {
  ({ buildQueryDashboardModel, buildQueryListModel, buildQuerySearchModel } = await import("@/app/app/_data/operator-query-presenter"));
});

function session(overrides: Partial<OperatorSession> = {}): OperatorSession {
  return {
    userId: "user-northline-executive",
    membershipId: "membership-northline-executive",
    displayName: "Alex Morgan",
    email: "alex.morgan@clark-demo.example",
    role: "executive",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    permissions: ["ops:*"],
    demoEdition: "complete",
    ...overrides,
  };
}

describe("operator query presenter", () => {
  it("shows only pending confirmations and permission-aware repair actions", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    for (const role of ["facilities", "regional", "store_manager", "finance"] as const) {
      const model = await buildQueryListModel(repository, session({ role }), "work-orders", { status: "completed_pending_review" });
      expect(model.table.rows.length).toBeGreaterThan(0);
      for (const row of model.table.rows) {
        expect(fixture.workOrders.find(work => work.id === row.id)?.status).toBe("completed_pending_review");
        if (role === "finance") expect(row.action).toBeUndefined();
        else expect(row.action).toEqual({ label: "Confirm work", href: `/app/work-orders/${row.id}?view=confirmation#work-verification` });
      }
      expect(model.filters?.flatMap(filter => filter.options).some(option => option.label === "Needs confirmation" && option.selected)).toBe(true);
    }
  });

  it("filters and paginates work orders before building table rows", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const model = await buildQueryListModel(repository, session(), "work-orders", {
      store: "store-northline-104",
      category: "refrigeration",
      page: "1",
    });

    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.length).toBeLessThanOrEqual(25);
    expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "store")?.value === "Store 104")).toBe(true);
    expect(model.table.columns.find((column) => column.key === "next")?.label).toBe("Description");
    for (const row of model.table.rows) {
      expect(row.cells.find((cell) => cell.key === "next")).toMatchObject({ expandable: true, value: fixture.workOrders.find((work) => work.id === row.id)!.problem });
    }
  });

  it("restores the facilities journey from default work to held-work bundling without abandoning query-first rows", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQueryListModel(repository, session({ role: "facilities", membershipId: "membership-northline-facilities" }), "work-orders", { visitPlan: "ready" });
    const heldMetric = model.metrics?.find((metric) => metric.id === "ready-to-bundle");
    const multipleMetric = model.metrics?.find((metric) => metric.id === "store-sweep-opportunities");
    const timing = model.filters?.find((filter) => filter.id === "work-visit-plan");

    expect(model.table.rows.length).toBeLessThanOrEqual(25);
    expect(heldMetric?.link.href).toBe("/app/work-orders?visitPlan=ready");
    expect(Number(heldMetric?.value)).toBeGreaterThan(0);
    expect(multipleMetric?.link.href).toContain("storeGroup=multiple");
    expect(timing?.options.map((option) => option.label)).toContainEqual(expect.stringContaining("Approved for next suitable visit"));
    expect(model.page.primaryAction?.href).toContain("/app/store-sweeps/new");
    expect(model.page.primaryAction?.href).toContain("returnTo=");
  });

  it("keeps the normal held-work portfolio on bounded repository rows with context-preserving planning", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const facilities = session({ role: "facilities", membershipId: "membership-northline-facilities" });
    const model = await buildQueryListModel(repository, facilities, "work-orders", {
      visitPlan: "ready",
      storeGroup: "multiple",
      region: "region-northline-north",
    });
    const activeHeldIds = new Set((fixture.workOrderVisitHolds ?? [])
      .filter((hold) => hold.status === "active")
      .filter((hold) => fixture.workOrders.some((work) => work.id === hold.workOrderId && work.status === "approved"))
      .map((hold) => hold.workOrderId));

    expect(model.page.eyebrow).toBe("Held-work portfolio");
    expect(model.page.primaryAction?.label).toBe("Send approved jobs together");
    expect(model.page.primaryAction?.href).toContain(encodeURIComponent("/app/work-orders?visitPlan=ready&storeGroup=multiple&region=region-northline-north"));
    expect(model.page.secondaryAction?.href).toBe("/app/work-orders?region=region-northline-north");
    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.every((row) => activeHeldIds.has(row.id))).toBe(true);
    expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "next")?.secondary?.startsWith("Internal owner:"))).toBe(true);
    expect(model.filters?.find((filter) => filter.id === "work-visit-plan")?.options.find((option) => option.value === "ready")?.selected).toBe(true);
    expect(model.appliedFilters?.find((filter) => filter.id === "visitPlan")?.label).toBe("Approved for next suitable visit");
    expect(model.appliedFilters?.find((filter) => filter.id === "storeGroup")?.label).toBe("Stores with 2+ approved jobs");
    expect(model.clearFiltersHref).toBe("/app/work-orders?visitPlan=ready");
    expect(model.resultSummary).toContain("portfolio counts shown above");
  });

  it("hides held-work dispatch actions from store and finance roles", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    for (const role of ["store_manager", "finance"] as const) {
      const model = await buildQueryListModel(repository, session({ role }), "work-orders", {});
      expect(model.metrics?.some((metric) => metric.id === "ready-to-bundle") ?? false).toBe(false);
      expect(model.page.secondaryAction).toBeUndefined();
    }
  });

  it("keeps visit filter controls and applied-filter removal links in the query projection", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQueryListModel(repository, session(), "visits", { status: "active", vendor: "vendor-northline-summit" });
    expect(model.filters?.find((filter) => filter.id === "status")?.options.map((option) => option.label)).toEqual(["Upcoming", "All visits", "No checkout recorded", "Completed"]);
    expect(model.filters?.find((filter) => filter.id === "status")?.options.find((option) => option.label === "No checkout recorded")?.selected).toBe(true);
    expect(model.appliedFilters?.map((filter) => filter.label)).toContain("No checkout recorded");
    expect(model.appliedFilters?.find((filter) => filter.id === "status")?.removeHref).toContain("vendor=vendor-northline-summit");
  });

  it("restores scoped visit summaries and makes the review metric a real bounded filter", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const summary = await buildQueryListModel(repository, session({ role: "facilities" }), "visits", { store: "store-northline-107" });
    const review = summary.metrics?.find((metric) => metric.id === "visit-review");
    expect(summary.metrics?.map((metric) => metric.id)).toEqual(["upcoming-visits", "active-visits", "completed-visits", "visit-review"]);
    expect(review?.link.href).toContain("store=store-northline-107");
    expect(review?.link.href).toContain("review=true");
    expect(Number(review?.value)).toBeGreaterThan(0);

    const filtered = await buildQueryListModel(repository, session({ role: "facilities" }), "visits", { store: "store-northline-107", review: "true" });
    expect(filtered.page.title).toBe("Visits needing review");
    expect(filtered.appliedFilters?.find((filter) => filter.id === "review")?.label).toBe("Needs review");
    expect(filtered.table.rows.length).toBeGreaterThan(0);
    expect(filtered.table.rows.every((row) => row.cells.find((cell) => cell.key === "store")?.value === "Store 107")).toBe(true);
  });

  it("restores portfolio-wide store summaries without deriving them from the current page", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQueryListModel(repository, session({ role: "regional", regionIds: ["region-northline-north"] }), "stores", { q: "Ridgeview" });
    expect(model.table.rows).toHaveLength(1);
    expect(model.metrics?.find((metric) => metric.id === "stores-in-scope")?.value).toBe("5");
    expect(model.metrics?.find((metric) => metric.id === "stores-in-scope")?.supportingText).toContain("Portfolio-wide");
    expect(model.metrics?.every((metric) => metric.link.href.startsWith("/app/"))).toBe(true);
  });

  it("keeps global search inside the manager's store scope", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const storeSession = session({
      role: "store_manager",
      membershipId: "membership-northline-store-104",
      storeIds: ["store-northline-104"],
      scopeLabel: "Store 104 · Ridgeview",
    });
    const model = await buildQuerySearchModel(repository, storeSession, { q: "beer cave" });

    expect(model.groups.length).toBeGreaterThan(0);
    expect(model.groups
      .filter((group) => group.id !== "vendors")
      .flatMap((group) => group.rows)
      .every((row) => row.cells.some((cell) => cell.value.includes("104") || cell.secondary?.includes("104"))))
      .toBe(true);
  });

  it("builds overview metrics from persisted aggregate read models", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQueryDashboardModel(repository, session());

    expect(model.metrics.map((metric) => metric.id)).toEqual(["open-work", "onsite", "review", "cost"]);
    expect(model.metrics.every((metric) => metric.link.href.startsWith("/app/"))).toBe(true);
    expect(model.priorityActions.every((item) => item.link.href.startsWith("/app/"))).toBe(true);
  });
});

describe("workspace search finds what people call things", () => {
  it("matches everyday words to the platform's terms", async () => {
    const { vendorSearchTerm } = await import("@/lib/ops/store-vendors");
    expect(vendorSearchTerm("gas pump")).toBe("dispenser");
    expect(vendorSearchTerm("Card reader")).toBe("payment terminal");
    expect(vendorSearchTerm("air conditioner")).toBe("hvac");
    expect(vendorSearchTerm("fridge")).toBe("refrigeration");
    expect(vendorSearchTerm("beer cave")).toBe("beer cave");
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQuerySearchModel(repository, session(), { q: "gas pump" });
    expect(model.groups.find((group) => group.id === "work")?.rows.length).toBeGreaterThan(0);
  });

  it("keeps everyday-word matches when opening the matching list", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const search = await buildQuerySearchModel(repository, session(), { q: "air conditioner" });
    const work = search.groups.find((group) => group.id === "work");
    expect(work?.rows.length).toBeGreaterThan(0);
    // "air conditioner" appears in no record; every match comes through "hvac".
    expect(work?.rows.some((row) => /hvac/i.test(JSON.stringify(row)))).toBe(true);
    const link = new URL(work!.moreLink!.href, "https://example.test");
    expect(Object.fromEntries(link.searchParams)).toEqual({ q: "air conditioner", status: "all" });
    const list = await buildQueryListModel(repository, session(), "work-orders", Object.fromEntries(link.searchParams));
    expect(list.table.rows.slice(0, work!.rows.length).map((row) => row.id)).toEqual(work!.rows.map((row) => row.id));
    for (const route of ["requests"] as const) {
      const group = search.groups.find((item) => item.id === route);
      if (!group) continue;
      const page = await buildQueryListModel(repository, session(), route, Object.fromEntries(new URL(group.moreLink!.href, "https://example.test").searchParams));
      expect(page.table.rows.slice(0, group.rows.length).map((row) => row.id)).toEqual(group.rows.map((row) => row.id));
    }
    const equipment = search.groups.find((group) => group.id === "equipment");
    expect(equipment?.rows.length).toBeGreaterThan(0);
    const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
    const equipmentQuery = Object.fromEntries(new URL(equipment!.moreLink!.href, "https://example.test").searchParams);
    const listed = new Set<string>();
    let next: string | undefined = "first";
    while (next) {
      const model = buildProgramModel(fixture, session(), "equipment", next === "first" ? equipmentQuery : Object.fromEntries(new URL(next, "https://example.test").searchParams));
      for (const row of model.table?.rows ?? []) listed.add(row.id);
      next = model.pagination?.nextHref;
    }
    expect(equipment!.rows.filter((row) => !listed.has(row.id)).map((row) => row.label)).toEqual([]);
  });

  it("previews 20 people and pages through every match", async () => {
    const base = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const everyone = Array.from({ length: 73 }, (_, index) => ({ id: `membership-${String(index).padStart(2, "0")}`, name: `Robin Person ${String(index).padStart(2, "0")}` }));
    const calls: Array<{ limit?: number; offset?: number }> = [];
    const repository = new Proxy(base, { get(target, key, receiver) {
      if (key === "listComplianceOwners") return async (_org: string, _search: string, page: { limit?: number; offset?: number } = {}) => { calls.push(page); const start = page.offset ?? 0; return everyone.slice(start, start + (page.limit ?? 20)); };
      return Reflect.get(target, key, receiver);
    } });
    const preview = (await buildQuerySearchModel(repository, session(), { q: "Robin" })).groups.find((group) => group.id === "people");
    expect(preview).toMatchObject({ resultCount: 20, hasMore: true, countIsLowerBound: true, moreLink: { href: "/app/search?q=Robin&type=people", label: "See all matching people" } });
    expect(preview?.rows).toHaveLength(20);
    const first = await buildQuerySearchModel(repository, session(), { q: "Robin", type: "people" });
    expect(first.groups.map((group) => group.id)).toEqual(["people"]);
    expect(first.groups[0]).toMatchObject({ hasMore: true, moreLink: { href: "/app/search?q=Robin&type=people&offset=50", label: "Show more people" } });
    expect(first.groups[0].rows).toHaveLength(50);
    expect(first.resultSummary).toBe("Showing people 1–50; more match");
    const second = await buildQuerySearchModel(repository, session(), { q: "Robin", type: "people", offset: "50" });
    expect(second.groups[0].rows.map((row) => row.label)).toEqual(everyone.slice(50).map((person) => person.name));
    expect(second.groups[0]).toMatchObject({ hasMore: false, countIsLowerBound: false, moreLink: { href: "/app/search?q=Robin", label: "All results" } });
    expect(second.resultSummary).toBe("Showing people 51–73");
    expect(calls).toEqual([{ limit: 21, offset: 0 }, { limit: 51, offset: 0 }, { limit: 51, offset: 50 }]);
    const store = session({ role: "store_manager", userId: "user-northline-store-104", membershipId: "membership-northline-store-104", storeIds: ["store-northline-104"] });
    expect((await buildQuerySearchModel(repository, store, { q: "Robin", type: "people" })).groups.some((group) => group.id === "people")).toBe(false);
  });

  it("finds invoices and people for roles that can see them, and not for a store manager", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const owner = await buildQuerySearchModel(repository, session(), { q: "SUM-104" });
    expect(owner.groups.find((group) => group.id === "invoices")?.rows.map((row) => row.label)).toContain("SUM-104-2611-W");
    const people = await buildQuerySearchModel(repository, session(), { q: "Robin" });
    expect(people.groups.find((group) => group.id === "people")?.rows[0]).toMatchObject({ label: "Robin Carter" });
    const store = session({ role: "store_manager", userId: "user-northline-store-104", membershipId: "membership-northline-store-104", storeIds: ["store-northline-104"] });
    expect((await buildQuerySearchModel(repository, store, { q: "SUM-104" })).groups.some((group) => group.id === "invoices")).toBe(false);
    expect((await buildQuerySearchModel(repository, store, { q: "Robin" })).groups.some((group) => group.id === "people")).toBe(false);
  });
});
