import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { advanceNavigationTrail } from "@/lib/ops/navigation-trail";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildCreateRequestModel, buildCreateWorkOrderModel, buildDetailModel, buildVendorPerformanceDetailModel } from "@/app/app/_data/operator-presenter";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import { ListView } from "@/components/ops/views";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/work-orders", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "user-northline-facilities", displayName: "Jordan Lee", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Companywide", role: "facilities", permissions: ["ops:*"], demoEdition: "complete" };

function fixtureContext() { const fixture = buildNorthlinePresentationFixture(); return { fixture, repository: createOpsFixtureRepository(fixture) }; }

describe("connected navigation", () => {
  it("connects trend source stores without altering the underlying cohort record destination", () => {
    const { fixture } = fixtureContext();
    const model = buildTrendsModel(fixture, session, { metric: "recorded_cost", period: "6", view: "records", store: "store-northline-104" });
    expect(model.sourceTable.rows.length).toBeGreaterThan(0);
    for (const row of model.sourceTable.rows) {
      expect(row.cells.find((cell) => cell.key === "store")?.link?.href).toBe("/app/stores/store-northline-104");
      expect(row.href).toMatch(/^\/app\/work-orders\//);
    }
  });

  it("returns through exact filtered and paginated views, retains an intentional revisit, and bounds the trail", () => {
    const source = { href: "/app/trends?period=6&metric=recorded_cost&store=104&view=records&page=2", label: "Cost evidence" };
    const work = { href: "/app/work-orders/wo-1?view=cost", label: "WO-1 costs" };
    const vendor = { href: "/app/vendors/vendor-1", label: "Vendor" };
    let trail = advanceNavigationTrail(advanceNavigationTrail([source], work), vendor);
    expect(trail[0]).toEqual(source);
    trail = advanceNavigationTrail(trail, work);
    expect(trail).toEqual([source, work, vendor, work]);
    expect(advanceNavigationTrail(trail, work)).toBe(trail);
    expect(advanceNavigationTrail(trail, { href: "https://other.test", label: "External" })).toBe(trail);
    expect(advanceNavigationTrail(trail, { href: "/application", label: "Other" })).toBe(trail);
    for (let i = 0; i < 10; i++) trail = advanceNavigationTrail(trail, { href: `/app/stores/${i}`, label: `Store ${i}` });
    expect(trail).toHaveLength(6);
  });

  it("lets a manager open the named store, provider, and cost evidence independently from a queue row", async () => {
    const { fixture, repository } = fixtureContext();
    const model = await buildQueryListModel(repository, session, "work-orders", { store: "store-northline-104" });
    const row = model.table.rows.find((item) => item.cells.find((cell) => cell.key === "assignment")?.link)!;
    const work = fixture.workOrders.find((item) => item.id === row.id)!;
    expect(row.cells.find((cell) => cell.key === "store")?.link?.href).toBe(`/app/stores/${work.storeId}`);
    expect(row.cells.find((cell) => cell.key === "cost")?.link?.href).toBe(`/app/work-orders/${work.id}?view=cost`);
    const markup = renderToStaticMarkup(createElement(ListView, { model }));
    expect(markup).toContain(`href="/app/work-orders/${work.id}?view=cost"`);
    expect(markup).toContain('aria-label="Open store: Store 104"');
    expect(model.page.primaryAction?.href).toBe("/app/work-orders/new?store=store-northline-104");
  });

  it("store open-work and onsite counts open the corresponding scoped records", async () => {
    const { repository } = fixtureContext();
    const stores = await buildQueryListModel(repository, session, "stores", {});
    const row = stores.table.rows[0];
    for (const [key, route] of [["work", "work-orders"], ["onsite", "visits"]] as const) {
      const cell = row.cells.find((item) => item.key === key)!;
      const target = new URL(cell.link!.href, "https://ops.test");
      const records = await buildQueryListModel(repository, session, route, Object.fromEntries(target.searchParams));
      expect(records.table.rows).toHaveLength(Number(cell.value));
      expect(target.searchParams.get("store")).toBe(row.id);
    }
  });

  it("does not send finance viewers to the unavailable visit queue", async () => {
    const { repository } = fixtureContext();
    const model = await buildQueryListModel(repository, { ...session, role: "finance" }, "stores", {});
    expect(model.table.rows.length).toBeGreaterThan(0);
    for (const row of model.table.rows) {
      expect(row.cells.find((cell) => cell.key === "onsite")?.link).toBeUndefined();
      expect(row.cells.find((cell) => cell.key === "work")?.link).toBeDefined();
    }
  });

  it("keeps prefilled creation inside permitted stores and carries equipment into work", () => {
    const { fixture } = fixtureContext();
    const store = fixture.stores.find((item) => item.id === "store-northline-104")!;
    const asset = fixture.assets.find((item) => item.storeId === store.id)!;
    expect(buildCreateRequestModel(fixture, session, { store: store.id }).defaultStoreId).toBe(store.id);
    const work = buildCreateWorkOrderModel(fixture, session, { store: store.id, asset: asset.id });
    expect(work.defaults).toMatchObject({ storeId: store.id, assetId: asset.id });
    const restricted = { ...session, storeIds: ["store-northline-101"] };
    const form = buildCreateRequestModel(fixture, restricted, { store: store.id });
    expect(form.stores.some((item) => item.value === store.id)).toBe(false);
    expect(form.defaultStoreId).not.toBe(store.id);
    expect(buildDetailModel(fixture, restricted, "store", store.id).state.kind).not.toBe("ready");
  });

  it("vendor visits expose separate work-order and store destinations while unmatched visits stay reviewable", () => {
    const { fixture } = fixtureContext();
    const model = buildVendorPerformanceDetailModel(fixture, session, "vendor-northline-summit");
    const linked = model.visitRows.find((row) => row.workOrderHref)!;
    expect(linked.workOrderHref).toMatch(/^\/app\/work-orders\//);
    expect(linked.href).toMatch(/^\/app\/visits\//);
    expect(linked.storeHref).toMatch(/^\/app\/stores\//);
    const unmatched = model.visitRows.find((row) => row.isNoWorkOrder)!;
    expect(unmatched.workOrderHref).toBeUndefined();
    expect(unmatched.href).toMatch(/^\/app\/visits\//);
  });
});
