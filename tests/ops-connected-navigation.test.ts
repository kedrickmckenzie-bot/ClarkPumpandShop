import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { advanceNavigationTrail, workspaceStartHref } from "@/lib/ops/navigation-trail";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildCreateWorkOrderModel, buildDetailModel, buildVendorPerformanceDetailModel } from "@/app/app/_data/operator-presenter";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import { WorkOrderVisitHistory } from "@/components/workspace/work-order-visit-history";
import { ListSurface, ListView } from "@/components/ops/views";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/work-orders", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "user-northline-facilities", displayName: "Jordan Lee", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Companywide", role: "facilities", permissions: ["ops:*"], demoEdition: "complete" };

function fixtureContext() { const fixture = buildNorthlinePresentationFixture(); return { fixture, repository: createOpsFixtureRepository(fixture) }; }

describe("connected navigation", () => {
  it("empty explicit location grants never become companywide in compatibility readers", () => {
    const { fixture } = fixtureContext();
    for (const restricted of [{ ...session, storeIds: [] }, { ...session, regionIds: [] }]) {
      expect(buildDetailModel(fixture, restricted, "store", "store-northline-104").state.kind).not.toBe("ready");
      expect(buildCreateWorkOrderModel(fixture, restricted).stores).toHaveLength(0);
      const trends = buildTrendsModel(fixture, restricted, { metric: "recorded_cost", view: "records" });
      expect(trends.sourceTable.rows).toHaveLength(0);
    }
  });

  it("lands new records at the workspace start while retaining exact evidence anchors", () => {
    expect(workspaceStartHref("/app/work-orders/wo-1?view=cost")).toBe("/app/work-orders/wo-1?view=cost#main-content");
    expect(workspaceStartHref("/app/invoices/invoice-1#allocation-1")).toBe("/app/invoices/invoice-1#allocation-1");
    expect(workspaceStartHref("https://external.test")).toBe("https://external.test");
  });
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
    expect(markup).toContain(`href="/app/work-orders/${work.id}?view=cost#main-content"`);
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
    const work = buildCreateWorkOrderModel(fixture, session, { store: store.id, asset: asset.id });
    expect(work.defaults).toMatchObject({ storeId: store.id, assetId: asset.id });
    const restricted = { ...session, storeIds: ["store-northline-101"] };
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


describe("work-order review entry", () => {
  it("opens the work order from every history-row data cell, including store and vendor", async () => {
    const { repository } = fixtureContext();
    const model = await buildQueryListModel(repository, session, "work-orders", { status: "history" });
    const html = renderToStaticMarkup(createElement(ListSurface, { model, surface: "work-orders", searchParams: { status: "history" } }));
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    const links = [...body.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href.startsWith("/app/work-orders/"))).toBe(true);
    expect(body).not.toContain("selected=");
  });

  it("keeps each bundled job's notes with that job instead of borrowing the primary job's checkout", () => {
    const fixture = buildNorthlinePresentationFixture();
    const visit = fixture.visits.find((item) => item.workOrderId && item.checkedOutAt)!;
    const work = fixture.workOrders.find((item) => item.storeId === visit.storeId && item.id !== visit.workOrderId)!;
    visit.outcomeNotes = "Primary job only";
    fixture.siteVisitWorkOrders.push({ id: "review-scope-link", organizationId: session.organizationId, visitId: visit.id, workOrderId: work.id, ordinal: 99, linkedByActorType: "system", linkedByActorName: "Test", linkedAt: visit.checkedInAt, outcome: "completed", outcomeNotes: "This job only" });
    const detail = buildDetailModel(fixture, session, "work-order", work.id);
    const history = detail.sections.find((section) => section.id === "visits")!;
    const row = history.table!.rows.find((item) => item.id === visit.id)!;
    expect(row.cells.find((cell) => cell.key === "outcome")?.secondary).toBe("This job only");
    const markup = renderToStaticMarkup(createElement(WorkOrderVisitHistory, { section: { ...history, table: { ...history.table!, rows: [row] } } }));
    expect(markup).toContain("Visit history");
    expect(markup).toContain(visit.technicianName);
    expect(markup).toContain("This job only");
    expect(markup).not.toContain("Primary job only");
    expect(history.timeline?.find((event) => event.link?.href === `/app/visits/${visit.id}`)?.description).toBe("This job only");
    fixture.siteVisitWorkOrders.at(-1)!.outcomeNotes = undefined;
    const noNote = buildDetailModel(fixture, session, "work-order", work.id).sections.find((section) => section.id === "visits")!;
    expect(noNote.table!.rows.find((item) => item.id === visit.id)!.cells.find((cell) => cell.key === "outcome")?.secondary).toBe("No checkout note recorded");
  });
});
