import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DashboardPageViewModel, OperatorRole, OperatorSession } from "@/components/ops/data-contract";
import {
  roleCan,
  roleCanAccessListRoute,
  roleCanAccessProgramRoute,
  roleCanOpenOperatorHref,
  roleCanSeeInsightsNavigation,
  roleCanSeePrimaryNavigation,
  roleCanSeeWorkNavigation,
} from "@/components/ops/role-policy";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildDashboardModel: typeof import("@/app/app/_data/operator-presenter").buildDashboardModel;
let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;

beforeAll(async () => {
  ({ buildDashboardModel, buildListModel } = await import("@/app/app/_data/operator-presenter"));
});

function session(
  role: OperatorRole,
  scope: Pick<OperatorSession, "scopeLabel" | "regionIds" | "storeIds"> = {
    scopeLabel: "Northline companywide · 15 stores",
  },
): OperatorSession {
  return {
    userId: `user-northline-${role}`,
    membershipId: `membership-northline-${role}`,
    displayName: `${role} preview`,
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: scope.scopeLabel,
    regionIds: scope.regionIds,
    storeIds: scope.storeIds,
  };
}

function dashboardHrefs(model: DashboardPageViewModel): string[] {
  return [
    model.page.primaryAction?.href,
    model.page.secondaryAction?.href,
    ...model.metrics.map((metric) => metric.link.href),
    ...(model.journey ?? []).map((stage) => stage.link.href),
    ...model.priorityActions.map((action) => action.link.href),
    model.prioritySection?.link.href,
    ...model.breakdowns.flatMap((breakdown) => [
      breakdown.sourceLink.href,
      ...breakdown.segments.map((segment) => segment.link.href),
    ]),
    ...model.trends.flatMap((trend) => [
      trend.sourceLink.href,
      ...trend.points.map((point) => point.link.href),
    ]),
    model.spotlight?.link.href,
    ...(model.spotlight?.facts.flatMap((fact) => fact.link?.href ?? []) ?? []),
  ].filter((href): href is string => Boolean(href));
}

function cellValue(row: ReturnType<typeof buildListModel>["table"]["rows"][number], key: string) {
  return row.cells.find((cell) => cell.key === key)?.value;
}

describe("role-specific operator experiences", () => {
  it("gives all five roles distinct dashboard framing and metrics", () => {
    const fixture = buildNorthlinePresentationFixture();
    const centralRegion = fixture.regions.find((region) => region.name === "Central District")!;
    const dashboards = {
      executive: buildDashboardModel(fixture, session("executive")),
      facilities: buildDashboardModel(fixture, session("facilities")),
      regional: buildDashboardModel(
        fixture,
        session("regional", {
          scopeLabel: "Central District · 5 stores",
          regionIds: [centralRegion.id],
        }),
      ),
      store_manager: buildDashboardModel(
        fixture,
        session("store_manager", {
          scopeLabel: "Store 104 · Ridgeview",
          storeIds: [NORTHLINE_DEMO_HANDLES.storyStoreId],
        }),
      ),
      finance: buildDashboardModel(fixture, session("finance")),
    };

    expect(new Set(Object.values(dashboards).map((model) => model.page.title))).toHaveLength(5);
    expect(
      new Set(
        Object.values(dashboards).map((model) =>
          model.metrics.map((metric) => metric.id).sort().join("|"),
        ),
      ),
    ).toHaveLength(5);

    expect(dashboards.executive.journey).toBeUndefined();
    expect(dashboards.finance.journey).toBeUndefined();
    expect(dashboards.facilities.journey).not.toHaveLength(0);
    expect(dashboards.regional.journey).not.toHaveLength(0);
    expect(dashboards.store_manager.journey).not.toHaveLength(0);
  });

  it("keeps the regional dashboard and supporting records inside Central's five stores", () => {
    const fixture = buildNorthlinePresentationFixture();
    const centralRegion = fixture.regions.find((region) => region.name === "Central District")!;
    const centralStores = fixture.stores.filter((store) => store.regionId === centralRegion.id);
    const regional = session("regional", {
      scopeLabel: "Central District · 5 stores",
      regionIds: [centralRegion.id],
    });
    const dashboard = buildDashboardModel(fixture, regional);
    const supportingStores = buildListModel(fixture, regional, "stores");
    const storeCost = dashboard.breakdowns.find((breakdown) => breakdown.title === "Recorded cost by store");

    expect(centralStores).toHaveLength(5);
    expect(supportingStores.table.rows.map((row) => row.id).sort()).toEqual(
      centralStores.map((store) => store.id).sort(),
    );
    expect(storeCost?.segments.map((segment) => segment.id).sort()).toEqual(
      centralStores.map((store) => store.id).sort(),
    );
    expect(supportingStores.table.rows.every((row) => cellValue(row, "region") === "Central District")).toBe(true);
  });

  it("keeps the store-manager home on Store 104 and removes lifecycle and work-order creation", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeManager = session("store_manager", {
      scopeLabel: "Store 104 · Ridgeview",
      storeIds: [NORTHLINE_DEMO_HANDLES.storyStoreId],
    });
    const dashboard = buildDashboardModel(fixture, storeManager);
    const hrefs = dashboardHrefs(dashboard);

    expect(dashboard.page.title).toContain("Store 104");
    expect(hrefs.some((href) => href.startsWith("/app/lifecycle"))).toBe(false);
    expect(hrefs).not.toContain("/app/work-orders/new");
    expect(dashboard.spotlight).toBeUndefined();

    for (const route of ["stores", "requests", "work-orders", "visits"] as const) {
      const source = buildListModel(fixture, storeManager, route);
      if (route === "stores") {
        expect(source.table.rows.map((row) => row.id)).toEqual([NORTHLINE_DEMO_HANDLES.storyStoreId]);
      } else {
        expect(source.table.rows.every((row) => cellValue(row, "store")?.includes("Store 104"))).toBe(true);
      }
    }
  });

  it("keeps finance out of request, visit, and PM workflows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const dashboard = buildDashboardModel(fixture, session("finance"));
    const hrefs = dashboardHrefs(dashboard);

    expect(hrefs.some((href) => href.startsWith("/app/requests"))).toBe(false);
    expect(hrefs.some((href) => href.startsWith("/app/visits"))).toBe(false);
    expect(hrefs.some((href) => href.startsWith("/app/pm"))).toBe(false);
  });

  it("expresses the expected navigation and access policy for every role", () => {
    expect(roleCan("facilities", "administer")).toBe(true);
    expect(roleCan("facilities", "create_store")).toBe(true);
    expect(roleCanSeeWorkNavigation("facilities", "invoice-review")).toBe(true);

    expect(roleCan("regional", "create_work_order")).toBe(true);
    expect(roleCan("regional", "create_store")).toBe(false);
    expect(roleCanAccessListRoute("regional", "invoices")).toBe(true);
    expect(roleCanSeeInsightsNavigation("regional", "lifecycle")).toBe(true);

    expect(roleCan("store_manager", "create_request")).toBe(true);
    expect(roleCan("store_manager", "create_work_order")).toBe(false);
    expect(roleCanAccessListRoute("store_manager", "invoices")).toBe(false);
    expect(roleCanAccessProgramRoute("store_manager", "lifecycle")).toBe(false);
    expect(roleCanSeeWorkNavigation("store_manager", "needs-attention")).toBe(false);
    expect(roleCanSeeWorkNavigation("store_manager", "invoice-review")).toBe(false);

    expect(roleCanSeePrimaryNavigation("executive", "work")).toBe(false);
    expect(roleCanAccessListRoute("executive", "requests")).toBe(true);
    expect(roleCanAccessProgramRoute("executive", "pm")).toBe(true);
    expect(roleCan("executive", "create_request")).toBe(false);

    expect(roleCanSeePrimaryNavigation("finance", "work")).toBe(true);
    expect(roleCanAccessListRoute("finance", "invoices")).toBe(true);
    expect(roleCanAccessListRoute("finance", "requests")).toBe(false);
    expect(roleCanAccessListRoute("finance", "visits")).toBe(false);
    expect(roleCanAccessProgramRoute("finance", "pm")).toBe(false);
    expect(roleCanAccessProgramRoute("finance", "lifecycle")).toBe(true);
  });

  it("does not expose the invoice list to a store manager at the policy boundary", () => {
    expect(roleCanAccessListRoute("store_manager", "invoices")).toBe(false);
    expect(roleCanOpenOperatorHref("store_manager", "/app/invoices")).toBe(false);
    expect(roleCanOpenOperatorHref("store_manager", "/app/invoices/invoice-northline-104")).toBe(false);
  });

  it("limits regional invoice presenter rows to allocations on scoped work", () => {
    const fixture = buildNorthlinePresentationFixture();
    const centralRegion = fixture.regions.find((region) => region.name === "Central District")!;
    const scopedSessions = [session("regional", {
      scopeLabel: "Central District · 5 stores",
      regionIds: [centralRegion.id],
    })];
    const unallocatedInvoiceId = "invoice-role-scope-unallocated";
    fixture.invoiceReferences.push({
      id: unallocatedInvoiceId,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      vendorId: fixture.vendors[0].id,
      invoiceNumber: "INV-ROLE-SCOPE-UNALLOCATED",
      invoiceDate: fixture.asOf.slice(0, 10),
      grossAmount: { amountMinor: 42_000, currency: "USD" },
      matchStatus: "unmatched",
      createdAt: fixture.asOf,
    });

    for (const scopedSession of scopedSessions) {
      const scopedStoreIds = new Set(
        fixture.stores
          .filter((store) =>
            scopedSession.storeIds?.length
              ? scopedSession.storeIds.includes(store.id)
              : scopedSession.regionIds?.includes(store.regionId ?? ""),
          )
          .map((store) => store.id),
      );
      const scopedWorkIds = new Set(
        fixture.workOrders
          .filter((work) => scopedStoreIds.has(work.storeId))
          .map((work) => work.id),
      );
      const expectedInvoiceIds = new Set(
        fixture.invoiceAllocations
          .filter((allocation) => scopedWorkIds.has(allocation.workOrderId))
          .map((allocation) => allocation.invoiceReferenceId),
      );
      const invoiceList = buildListModel(fixture, scopedSession, "invoices");
      const actualInvoiceIds = new Set(invoiceList.table.rows.map((row) => row.id));

      expect(actualInvoiceIds).toEqual(expectedInvoiceIds);
      expect(actualInvoiceIds.has(unallocatedInvoiceId)).toBe(false);
    }
  });

  it("keeps every dashboard link within its role's accessible surface", () => {
    const fixture = buildNorthlinePresentationFixture();
    const centralRegion = fixture.regions.find((region) => region.name === "Central District")!;
    const sessions = [
      session("executive"),
      session("facilities"),
      session("regional", {
        scopeLabel: "Central District · 5 stores",
        regionIds: [centralRegion.id],
      }),
      session("store_manager", {
        scopeLabel: "Store 104 · Ridgeview",
        storeIds: [NORTHLINE_DEMO_HANDLES.storyStoreId],
      }),
      session("finance"),
    ];

    for (const scopedSession of sessions) {
      const inaccessible = dashboardHrefs(buildDashboardModel(fixture, scopedSession)).filter(
        (href) => !roleCanOpenOperatorHref(scopedSession.role, href),
      );
      expect(inaccessible, `${scopedSession.role} dashboard contains inaccessible links`).toEqual([]);
    }
  });
});
