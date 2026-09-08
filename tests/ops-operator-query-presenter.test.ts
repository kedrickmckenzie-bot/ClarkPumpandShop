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
