import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildDashboardModel, buildProgramModel, buildVendorPerformanceDetailModel } from "@/app/app/_data/operator-presenter";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";
import { buildInvoiceEvidenceModel } from "@/app/app/_data/invoice-evidence-presenter";
import { paginateVendorEvidence } from "@/app/app/_data/vendor-evidence-pagination";
import { ListSurface } from "@/components/ops/views";
import type { OperatorSession } from "@/components/ops/data-contract";
import { workCostDrilldownRegression } from "./helpers/work-cost-drilldown-regression";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/work-orders", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "user-northline-facilities", displayName: "Jordan", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Companywide", role: "facilities", permissions: ["ops:*"], demoEdition: "complete" };
const queryFrom = (href: string) => Object.fromEntries(new URL(href, "http://local.test").searchParams);

describe("spend and connected workflow audit", () => {
  it("keeps all 12 Overview months and source totals on scoped, paginated cost records", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const held = vi.spyOn(repository, "getHeldWorkPortfolioSummary");
    const chart = buildDashboardModel(fixture, session).trends.find((item) => item.id === "recorded-cost-trend")!;
    expect(chart.points).toHaveLength(12);
    for (const point of chart.points) {
      let params = queryFrom(point.link.href);
      const ids = new Set<string>();
      let total = 0;
      for (;;) {
        const result = await buildQueryListModel(repository, session, "work-orders", params);
        expect(result.rowNavigation).toBe("record");
        expect(result.metrics).toBeUndefined();
        for (const row of result.table.rows) {
          expect(ids.has(row.id)).toBe(false); ids.add(row.id);
          expect(row.href).toContain("?view=cost");
          total += fixture.costLines.filter((line) => line.workOrderId === row.id && line.serviceDate.slice(0, 7) === point.id && line.serviceDate.slice(0, 10) <= fixture.asOf.slice(0, 10)).reduce((sum, line) => sum + line.amount.amountMinor, 0);
        }
        if (!result.pagination?.nextHref) break;
        params = queryFrom(result.pagination.nextHref);
      }
      expect(total).toBe(point.value);
    }
    expect(held).not.toHaveBeenCalled();
    const params = queryFrom(chart.sourceLink.href);
    const model = await buildQueryListModel(repository, session, "work-orders", params);
    const html = renderToStaticMarkup(createElement(ListSurface, { model, surface: "work-orders", searchParams: params, canManageWorkflowTasks: true }));
    expect(html).toContain('?view=cost');
    expect(html).not.toContain('bulk-follow-up');
    expect(html).not.toContain('selected=');
  });

  it("uses the same date conditions for row eligibility and amounts", async () => {
    await workCostDrilldownRegression(createOpsFixtureRepository(buildNorthlinePresentationFixture()));
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders[0];
    const line = fixture.costLines.find((row) => row.workOrderId === work.id)!;
    fixture.costLines = [
      { ...line, id: "old", serviceDate: "2026-06-01", amount: { amountMinor: 90_000, currency: "USD" } },
      { ...line, id: "current", serviceDate: "2026-07-10", amount: { amountMinor: 12_300, currency: "USD" } },
      { ...line, id: "later", serviceDate: "2026-07-30", amount: { amountMinor: 80_000, currency: "USD" } },
      { ...line, id: "foreign", serviceDate: "2026-07-10", amount: { amountMinor: 500_000, currency: "CAD" } },
    ];
    const repository = createOpsFixtureRepository(fixture);
    const result = await repository.listWorkOrders({ organizationId: session.organizationId }, { costMonth: "2026-07", costTo: "2026-07-20" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].recordedCostMinor).toBe(12_300);
    const canadian = await repository.listWorkOrders({ organizationId: session.organizationId }, { costMonth: "2026-07", currency: "CAD" });
    expect(canadian.items[0]).toMatchObject({ recordedCostMinor: 500_000, currency: "CAD" });
  });

  it("preserves invoice month, hierarchy, and exact confirmed allocations through Spending", () => {
    const fixture = buildNorthlinePresentationFixture();
    const spend = buildProgramModel(fixture, session, "spend", { basis: "invoiced", period: "12m", store: "store-northline-104" });
    for (const point of spend.trends[0].points) {
      const query = queryFrom(point.link.href);
      expect(query.store).toBe("store-northline-104");
      const model = buildInvoiceEvidenceModel(fixture, session, query);
      const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(point.value / 100);
      expect(model.resultSummary).toContain(money);
      expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "store")?.value === "Store 104")).toBe(true);
    }
    const fromTotal = queryFrom(spend.metrics[0].link.href);
    expect(buildInvoiceEvidenceModel(fixture, { ...session, storeIds: [] }, fromTotal).table.rows).toEqual([]);
    expect(buildInvoiceEvidenceModel(fixture, session, { ...fromTotal, category: "nonexistent" }).table.rows).toEqual([]);
    expect(spend.table!.rows.every((row) => row.href.endsWith("?view=cost"))).toBe(true);
  });

  it("pages vendor histories without dropping rows, altering totals, or losing the section", () => {
    const model = buildVendorPerformanceDetailModel(buildNorthlinePresentationFixture(), session, "vendor-northline-summit");
    const first = paginateVendorEvidence(model, "vendor-northline-summit", {});
    expect(first.visitRows).toHaveLength(25);
    expect(first.costRows.length).toBeLessThanOrEqual(25);
    expect(first.evidencePagination.costRows?.nextHref).toContain("#cost-evidence");
    expect(first.summary).toEqual(model.summary);
    const ids: string[] = [];
    for (let page = 1; page <= first.evidencePagination.visitRows!.totalPages; page++) {
      const result = paginateVendorEvidence(model, "vendor-northline-summit", { visitPage: String(page), authorizationPage: "2" });
      ids.push(...result.visitRows.map((row) => row.id));
      expect(result.evidencePagination.visitRows?.pageLinks[0].href).toContain("authorizationPage=2");
      expect(result.evidencePagination.visitRows?.pageLinks[0].href).toContain("#visit-evidence");
    }
    expect(ids).toEqual(model.visitRows.map((row) => row.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
