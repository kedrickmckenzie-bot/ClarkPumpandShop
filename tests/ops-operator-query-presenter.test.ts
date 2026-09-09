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
    expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "next")?.secondary?.includes("Internal:"))).toBe(true);
  });

  it("restores the facilities journey from default work to held-work bundling without abandoning query-first rows", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQueryListModel(repository, session({ role: "facilities", membershipId: "membership-northline-facilities" }), "work-orders", {});
    const heldMetric = model.metrics?.find((metric) => metric.id === "ready-to-bundle");
    const multipleMetric = model.metrics?.find((metric) => metric.id === "store-sweep-opportunities");
    const timing = model.filters?.find((filter) => filter.id === "work-visit-plan");

    expect(model.table.rows.length).toBeLessThanOrEqual(25);
    expect(heldMetric?.link.href).toBe("/app/work-orders?visitPlan=ready");
    expect(Number(heldMetric?.value)).toBeGreaterThan(0);
    expect(multipleMetric?.link.href).toContain("storeGroup=multiple");
    expect(timing?.options.map((option) => option.label)).toContainEqual(expect.stringContaining("Approved for next suitable visit"));
    expect(model.page.secondaryAction?.href).toContain("/app/store-sweeps/new");
    expect(model.page.secondaryAction?.href).toContain("returnTo=");
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
    expect(model.filters?.find((filter) => filter.id === "status")?.options.map((option) => option.label)).toEqual(["All visits", "Onsite now", "Completed"]);
    expect(model.filters?.find((filter) => filter.id === "status")?.options.find((option) => option.label === "Onsite now")?.selected).toBe(true);
    expect(model.appliedFilters?.map((filter) => filter.label)).toContain("Onsite now");
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
