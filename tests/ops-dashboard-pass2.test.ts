import { invoiceEvidenceFromFixture } from "@/lib/ops/invoice-evidence-query";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildAccountabilityDashboardModel, buildDashboardModel, buildListModel, buildProgramModel, type OperatorListRoute } from "@/app/app/_data/operator-presenter";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildEquipmentReview } from "@/app/app/_data/equipment-review";
import { buildDecisionContext } from "@/app/app/_data/decision-context";
import { buildInvoiceEvidenceModel as buildEvidenceModel, invoiceEvidenceParameters } from "@/app/app/_data/invoice-evidence-presenter";
import { invoiceReporting } from "@/lib/ops/invoice-reporting";
import { scopedInvoiceRecords } from "@/lib/ops/dashboard-cohorts";
import { ControlTower } from "@/components/workspace/control-tower";

vi.mock("server-only", () => ({}));
const fixture = buildNorthlinePresentationFixture();
const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);
function session(role: OperatorSession["role"]): OperatorSession {
  return { role, userId: `user-northline-${role}`, membershipId: `membership-northline-${role}`, displayName: "Reviewer", email: "reviewer@example.test", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark", scopeLabel: "Test scope", permissions: ["ops:*"],
    ...(role === "store_manager" ? { storeIds: ["store-northline-104"] } : role === "regional" ? { regionIds: [fixture.regions[1].id] } : {}) };
}

it("keeps the full review count while sending only the seven visible home rows", () => {
  const viewer = session("facilities");
  const model = buildDashboardModel(fixture, viewer);
  const sourceRows = fixtureRows(viewer, "/app/action-center");
  expect(sourceRows.length).toBeGreaterThan(7);
  expect(model.metrics.find(metric => metric.id === "open-exceptions")?.value).toBe(String(sourceRows.length));
  expect(model.priorityActions).toHaveLength(7);
  expect(model.priorityActions.map(row => row.id)).toEqual(sourceRows.slice(0, 7).map(row => row.id));
});
function query(href: string) { return Object.fromEntries(new URL(href, "https://local.test").searchParams); }
function scopedStores(viewer: OperatorSession) { return fixture.stores.filter((row) => row.organizationId === viewer.organizationId && (!viewer.storeIds || viewer.storeIds.includes(row.id)) && (!viewer.regionIds || !!row.regionId && viewer.regionIds.includes(row.regionId))); }
async function queryRows(viewer: OperatorSession, href: string) {
  const route = new URL(href, "https://local.test").pathname.split("/").at(-1) as OperatorListRoute;
  const rows = [];
  let next: string | undefined = href;
  while (next) {
    const model = await buildQueryListModel(createOpsFixtureRepository(fixture), viewer, route, query(next));
    rows.push(...model.table.rows); next = model.pagination?.nextHref;
  }
  return rows;
}
function fixtureRows(viewer: OperatorSession, href: string) {
  const route = new URL(href, "https://local.test").pathname.split("/").at(-1) as OperatorListRoute;
  const rows = [];
  let next: string | undefined = href;
  while (next) { const model: ReturnType<typeof buildProgramModel> | ReturnType<typeof buildListModel> = (route as string) === "equipment" ? buildProgramModel(fixture, viewer, "equipment", query(next)) : buildListModel(fixture, viewer, route, query(next)); rows.push(...model.table!.rows); next = model.pagination?.nextHref; }
  return rows;
}

describe("Pass 2 dashboard source contracts", () => {
  it.each(["facilities", "regional", "store_manager", "executive", "finance"] as const)("reconciles every count and cost source for %s", async (role) => {
    const viewer = session(role), model = buildDashboardModel(fixture, viewer);
    const stores = new Set(scopedStores(viewer).map((row) => row.id));
    const work = fixture.workOrders.filter((row) => row.organizationId === viewer.organizationId && stores.has(row.storeId));
    const workIds = new Set(work.map((row) => row.id));
    const costs = fixture.costLines.filter((row) => row.organizationId === viewer.organizationId && workIds.has(row.workOrderId) && row.serviceDate >= "2025-09-01" && row.serviceDate <= "2026-08-25" && row.amount.currency === "USD");
    for (const metric of [...model.metrics, ...model.journey ?? []]) {
      const path = new URL(metric.link.href, "https://local.test").pathname;
      if (["/app/requests", "/app/work-orders", "/app/visits"].includes(path) && !metric.link.href.includes("upcoming")) {
        const found = await queryRows(viewer, metric.link.href);
        expect(found.length, metric.id).toBe(Number(metric.value));
        expect(new Set(found.map((row) => row.id)).size).toBe(found.length);
      } else if (path === "/app/action-center") {
        expect(fixtureRows(viewer, metric.link.href).length, metric.id).toBe(Number(metric.value));
      } else if (metric.id === "recorded-cost") {
        expect(metric.value).toBe(money(costs.reduce((sum, row) => sum + row.amount.amountMinor, 0)));
        const spend = buildProgramModel(fixture, viewer, "spend", query(metric.link.href));
        expect(JSON.stringify(spend.metrics)).toContain(metric.value);
      } else if (metric.id === "watch-assets") {
        expect(new Set(fixtureRows(viewer, metric.link.href).map((row) => row.id))).toEqual(new Set(fixture.assets.filter((row) => stores.has(row.storeId) && row.status === "watch").map((row) => row.id)));
      } else if (metric.id === "invoice-references") {
        expect(metric.label).toBe("Invoice records");
        expect(metric.value).toBe(String(scopedInvoiceRecords(fixture, viewer.organizationId, stores).length));
        expect(metric.link.href).toBe("/app/invoices");
      }
    }
    for (const breakdown of model.breakdowns) {
      for (const segment of breakdown.segments) {
        const q = query(segment.link.href);
        if (segment.link.href.startsWith("/app/work-orders") && q.hasCost === "true") {
          const matchingCosts = costs.filter(row => work.some(record => record.id === row.workOrderId && (!q.store || record.storeId === q.store) && (!q.category || (record.categoryKey ?? "unclassified") === q.category)));
          expect(segment.value).toBe(matchingCosts.reduce((sum, row) => sum + row.amount.amountMinor, 0));
          expect(new Set((await queryRows(viewer, segment.link.href)).map(row => row.id))).toEqual(new Set(matchingCosts.map(row => row.workOrderId)));
        } else if (segment.link.href.startsWith("/app/work-orders")) {
          const expected = work.filter((row) => row.status === q.status);
          expect(new Set((await queryRows(viewer, segment.link.href)).map((row) => row.id))).toEqual(new Set(expected.map((row) => row.id)));
          expect(segment.value).toBe(expected.length);
        } else if (segment.link.href.startsWith("/app/visits")) {
          const expected = fixture.visits.filter((row) => stores.has(row.storeId) && row.vendorId === q.vendor && (!q.status || row.status === q.status));
          expect(new Set((await queryRows(viewer, segment.link.href)).map((row) => row.id))).toEqual(new Set(expected.map((row) => row.id)));
          expect(segment.value).toBe(expected.length);
        } else if (segment.link.href.startsWith("/app/spend")) {
          const selectedWork = new Set(work.filter((row) => (!q.store || row.storeId === q.store) && (!q.category || (row.categoryKey ?? "unclassified") === q.category)).map((row) => row.id));
          expect(segment.value).toBe(costs.filter((row) => selectedWork.has(row.workOrderId)).reduce((sum, row) => sum + row.amount.amountMinor, 0));
        }
      }
      if (breakdown.id === "open-work-status") expect(breakdown.segments.reduce((sum, row) => sum + row.value, 0)).toBe(work.filter((row) => !["closed", "cancelled"].includes(row.status)).length);
    }
    for (const trend of model.trends) for (const point of trend.points) {
      const expected = costs.filter((row) => row.serviceDate.startsWith(point.id));
      expect(point.value).toBe(expected.reduce((sum, row) => sum + row.amount.amountMinor, 0));
      expect(new Set((await queryRows(viewer, point.link.href)).map((row) => row.id))).toEqual(new Set(expected.map((row) => row.workOrderId)));
    }
  });

  it("keeps approved unsent work out of vendor response and renders all nine work states", async () => {
    const viewer = session("facilities"), model = buildDashboardModel(fixture, viewer);
    const pending = model.journey!.find((row) => row.id === "intake")!;
    expect(pending.value).toBe("5");
    const found = await queryRows(viewer, pending.link.href);
    expect(new Set(found.map((row) => row.id))).toEqual(new Set(fixture.requests.filter((row) => ["submitted", "under_review"].includes(row.status)).map((row) => row.id)));
    const vendor = model.journey!.find((row) => row.id === "authorization")!;
    expect(vendor.value).toBe("2");
    const foundVendor = await queryRows(viewer, vendor.link.href);
    expect(new Set(foundVendor.map((row) => row.id))).toEqual(new Set(fixture.workOrders.filter((work) => ["CPS-2026-0116", "CPS-2026-0206"].includes(work.number)).map((work) => work.id)));
    expect(foundVendor.every((row) => fixture.workOrders.find((work) => work.id === row.id)!.status !== "approved")).toBe(true);
    expect((await queryRows(viewer, "/app/work-orders?stage=vendor-response&status=closed"))).toEqual([]);
    const html = renderToStaticMarkup(createElement(ControlTower, { model }));
    for (const segment of model.breakdowns[0].segments) expect(html).toContain(segment.link.href.replaceAll("&", "&amp;"));
    expect(model.breakdowns[0].segments).toHaveLength(9);
    const owner = buildDashboardModel(fixture, session("executive"));
    const stores = owner.breakdowns.find((row) => row.id === "recorded-cost-by-store")!;
    expect(stores.segments).toHaveLength(5);
    expect(stores.coverageLabel).toBe("Showing 5 of 15 stores. Total includes all.");
    expect(stores.totalValue).toBeGreaterThan(stores.segments.reduce((sum, row) => sum + row.value, 0));
    expect(query(stores.sourceLink.href)).toEqual({ sort: "cost", costFrom: "2025-09-01", costTo: "2026-08-25", currency: "USD" });
    const ownerHtml = renderToStaticMarkup(createElement(ControlTower, { model: owner }));
    for (const segment of stores.segments) expect(ownerHtml).toContain(segment.link.href.replaceAll("&", "&amp;"));
  });

  it("uses whole-equipment cost and the identical window for Store 115, excluding future costs", () => {
    const data = structuredClone(fixture), viewer = session("facilities"), assetId = "asset-115-beer-cave";
    const cost = data.costLines.find((line) => data.workOrders.some((work) => work.id === line.workOrderId && work.assetId === assetId))!;
    data.costLines.push({ ...cost, id: "future-cost", serviceDate: "2026-08-26", amount: { currency: "USD", amountMinor: 99999999 } });
    const spotlight = buildDashboardModel(data, viewer).spotlight!;
    expect(spotlight.facts.find((row) => row.label === "Recorded cost · 12 months")?.value).toBe("$440.00");
    const q = query(spotlight.link.href);
    const review = buildEquipmentReview(data, viewer, assetId, q)!;
    expect(review.workCost).toBe("$440.00");
    const context = buildDecisionContext(data, viewer, assetId, q)!;
    expect(context.costs.map((row) => row.id)).not.toContain("future-cost");
    expect(context.costs).toHaveLength(2);
    expect(q.history).toBe("12"); expect(q.component).toBeUndefined();
  });

  it("keeps invoice records, references and allocations distinct without counting legacy mirrors twice", () => {
    const viewer = session("finance"), model = buildDashboardModel(fixture, viewer);
    expect(model.metrics.find((row) => row.id === "invoice-references")?.value).toBe("90");
    expect(fixture.invoiceReferences).toHaveLength(97);
    const reporting = invoiceReporting(fixture, viewer.organizationId);
    const ids = new Set(reporting.allocations.map((row) => row.id));
    expect(ids.size).toBe(reporting.allocations.length);
    const expected = reporting.allocations.filter((row) => row.invoiceDate >= "2025-09-01" && row.invoiceDate <= "2026-08-25" && row.amount.currency === "USD");
    const found: string[] = [];
    let q: Record<string, string> = { from: "2025-09-01", to: "2026-08-25", currency: "USD" };
    for (;;) { const model = buildInvoiceEvidenceModel(fixture, viewer, q); found.push(...model.table.rows.map((row) => row.id)); if (!model.pagination?.nextHref) break; q = query(model.pagination.nextHref); }
    expect(new Set(found)).toEqual(new Set(expected.map((row) => row.id)));
    expect(found.length).toBe(expected.length);
    for (const invoice of fixture.invoices.filter((row) => row.status !== "void")) {
      const linked = reporting.allocations.filter((row) => row.invoiceId === invoice.id).reduce((sum, row) => sum + row.amount.amountMinor, 0);
      const unmatched = reporting.pending.filter((row) => row.id === invoice.id).reduce((sum, row) => sum + row.amount.amountMinor, 0);
      expect(linked + unmatched, invoice.id).toBe(invoice.total.amountMinor);
    }
  });

  it("keeps unmatched visits separate from the broader review queue in the smaller package", () => {
    const viewer = session("facilities"), model = buildAccountabilityDashboardModel(fixture, viewer);
    for (const id of ["no-work-order", "visit-review"]) {
      const metric = model.metrics.find((row) => row.id === id)!;
      expect(fixtureRows(viewer, metric.link.href).length).toBe(Number(metric.value));
    }
  });

  it("preserves pending status, store and search through a second page", async () => {
    const data = structuredClone(fixture), source = data.requests.find((row) => row.status === "submitted")!;
    for (let index = 0; index < 30; index++) data.requests.push({ ...source, id: `pending-${index}`, reference: `PENDING-${index}`, problem: "Paging regression", submittedAt: "2026-08-25T12:00:00.000Z" });
    const repository = createOpsFixtureRepository(data), viewer = session("facilities");
    const page = await buildQueryListModel(repository, viewer, "requests", { status: "pending", store: source.storeId, q: "Paging regression" });
    expect(page.table.rows).toHaveLength(25);
    expect(query(page.pagination!.nextHref!)).toEqual({ status: "pending", store: source.storeId, q: "Paging regression", page: "2" });
    const next = await buildQueryListModel(repository, viewer, "requests", query(page.pagination!.nextHref!));
    expect(next.table.rows).toHaveLength(5);
    expect(new Set([...page.table.rows, ...next.table.rows].map((row) => row.id)).size).toBe(30);
  });

  it.each(["facilities", "regional", "store_manager"] as const)("opens exact PM numerator and denominator records for %s", (role) => {
    const viewer = session(role), stores = new Set(scopedStores(viewer).map((row) => row.id));
    const model = buildProgramModel(fixture, viewer, "pm");
    const compliance = model.breakdowns.find((row) => row.id === "pm-compliance")!;
    const closed = fixture.pmOccurrences.filter((row) => row.organizationId === viewer.organizationId && stores.has(row.storeId) && row.status !== "waived" && row.windowEndsAt < fixture.asOf);
    const gather = (href: string) => {
      const ids: string[] = [];
      let next: string | undefined = href;
      while (next) { const page: ReturnType<typeof buildProgramModel> = buildProgramModel(fixture, viewer, "pm", query(next)); ids.push(...page.table!.rows.map((row) => row.id)); next = page.pagination?.nextHref; }
      return ids;
    };
    const closedModel = buildProgramModel(fixture, viewer, "pm", query(compliance.sourceLink.href));
    for (const option of closedModel.filters!.find((row) => row.id === "view")!.options) expect(query(option.href).window).toBe("closed");
    expect(new Set(gather(compliance.sourceLink.href))).toEqual(new Set(closed.map((row) => row.id)));
    for (const segment of compliance.segments) {
      const expected = closed.filter((row) => segment.id === "completed" ? row.status === "completed" || !!row.completedAt : row.status !== "completed" && !row.completedAt);
      expect(segment.value).toBe(expected.length);
      expect(new Set(gather(segment.link.href))).toEqual(new Set(expected.map((row) => row.id)));
    }
    for (const metric of model.metrics) expect(gather(metric.link.href).length, metric.id).toBe(Number(metric.value));
  });
});

function buildInvoiceEvidenceModel(fixture: import("@/lib/ops/types").OpsFixture, session: import("@/components/ops/data-contract").OperatorSession, query: import("@/app/app/_data/operator-presenter").OperatorSearchParameters) { return buildEvidenceModel(invoiceEvidenceFromFixture(fixture,session,invoiceEvidenceParameters(query)),session,query); }
