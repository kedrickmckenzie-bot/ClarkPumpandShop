import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
  buildSyntheticTrendScaleFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildTrendsModel: typeof import("@/app/app/_data/trends-presenter").buildTrendsModel;
let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;
let buildProgramModel: typeof import("@/app/app/_data/operator-presenter").buildProgramModel;

beforeAll(async () => {
  ({ buildTrendsModel } = await import("@/app/app/_data/trends-presenter"));
  ({ buildListModel, buildProgramModel } = await import("@/app/app/_data/operator-presenter"));
});

function session(): OperatorSession {
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
  };
}

function queryFromHref(value: string) {
  return Object.fromEntries(new URL(value, "https://operations.test").searchParams.entries());
}

function queryFromSearch(value: string) {
  return Object.fromEntries(new URLSearchParams(value).entries());
}

function sourceCount(value: string) {
  const match = /^(\d+) record/.exec(value);
  if (!match) throw new Error(`Could not read a record count from: ${value}`);
  return Number(match[1]);
}

function summary(model: ReturnType<typeof buildTrendsModel>, id: string) {
  const item = model.summary.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing ${id} trend summary`);
  return item;
}

describe("enterprise trends presenter", () => {
  it("offers company-to-component filters, six measures, comparison history, and exact month source links", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), { period: "12", compare: "previous_year" });

    expect(model.page.title).toBe("Trends");
    expect(model.filters.find((filter) => filter.id === "metric")?.options).toHaveLength(6);
    expect(model.filters.map((filter) => filter.id)).toEqual([
      "metric", "period", "compare", "breakdown", "workType", "region", "store", "category", "costKind", "path", "profile", "asset", "component", "vendor",
    ]);
    expect(model.series).toHaveLength(12);
    expect(model.series.every((point) => new URL(point.currentLink.href, "https://operations.test").searchParams.get("detailMonth") === point.id)).toBe(true);
    expect(model.outlook.label).toMatch(/12-month recorded work cost|not enough history/i);
    expect(model.outlook.caution).toMatch(/not a budget|will not create/i);
    expect(model.benchmark.methodology).toMatch(/same equipment|other stores/i);
    expect(model.sourceTable.columns.at(-1)?.label).toBe("Cost");
    expect(queryFromHref(model.drivers.sortLinks[0].link.href)).not.toHaveProperty("detailKind");
  });

  it("separates narrowing the full investigation from opening exact supporting records", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      breakdown: "category",
    });
    const row = model.drivers.rows.find((candidate) => candidate.focusLink && candidate.currentSourceCount > 0)!;
    const focus = queryFromHref(row.focusLink!.href);
    const records = queryFromHref(row.recordsLink.href);

    expect(focus).toMatchObject({ category: row.id, breakdown: "group" });
    expect(focus).not.toHaveProperty("detailKind");
    expect(focus).not.toHaveProperty("driverBreakdown");
    expect(records).toMatchObject({
      breakdown: "category",
      detailKind: "both",
      driverBreakdown: "category",
      driverValue: row.id,
    });
    expect(records).not.toHaveProperty("category");
  });

  it("keeps the exact-record focus visible and intact while evidence is sorted or paged", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "recorded_cost",
      period: "12",
      detailKind: "current",
      sourceSort: "value",
      sourceDirection: "desc",
    });
    const sortLink = model.sourceSortLinks.find((candidate) => candidate.id === "record")!;
    const nextPage = model.sourcePagination.pageLinks.find((candidate) => candidate.page === 2);

    expect(model.investigation.evidence?.label).toContain("Selected 12 months");
    expect(queryFromHref(sortLink.link.href)).toMatchObject({ detailKind: "current", sourceSort: "record" });
    expect(nextPage).toBeDefined();
    expect(queryFromHref(nextPage!.href)).toMatchObject({ detailKind: "current", sourcePage: "2" });
    expect(queryFromHref(model.investigation.evidence!.clearLink.href)).not.toHaveProperty("detailKind");
  });

  it("uses breadcrumb trails to clear only the selected investigation level and everything below it", () => {
    const fixture = buildNorthlinePresentationFixture();
    const asset = fixture.assets.find((candidate) => candidate.categoryKey && candidate.groupPath.length)!;
    const store = fixture.stores.find((candidate) => candidate.id === asset.storeId)!;
    const model = buildTrendsModel(fixture, session(), {
      region: store.regionId,
      store: store.id,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
      asset: asset.id,
    });
    const location = model.investigation.trails.find((trail) => trail.id === "location")!;
    const maintenance = model.investigation.trails.find((trail) => trail.id === "maintenance")!;
    const companywide = queryFromHref(location.crumbs[0].link!.href);
    const region = queryFromHref(location.crumbs[1].link!.href);
    const category = maintenance.crumbs.find((crumb) => crumb.id === asset.categoryKey)!;
    const categoryQuery = queryFromHref(category.link!.href);

    expect(companywide).not.toHaveProperty("region");
    expect(companywide).not.toHaveProperty("store");
    expect(region).toMatchObject({ region: store.regionId });
    expect(region).not.toHaveProperty("store");
    expect(categoryQuery).toMatchObject({ category: asset.categoryKey });
    expect(categoryQuery).not.toHaveProperty("path");
    expect(categoryQuery).not.toHaveProperty("asset");
  });

  it("keeps PM-related measures limited to preventive work and explains non-additive tables honestly", () => {
    const fixture = buildNorthlinePresentationFixture();
    const pm = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "12" });
    const response = buildTrendsModel(fixture, session(), { metric: "vendor_response", breakdown: "vendor" });

    expect(pm.relatedMeasures).toHaveLength(3);
    expect(pm.relatedMeasures.every((measure) => queryFromHref(measure.link.href).workType === "preventive")).toBe(true);
    expect(response.drivers.reconciliationLabel).toMatch(/do not add up/i);
  });

  it("separates reactive and preventive work and supports cost-type analysis without losing totals", () => {
    const fixture = buildNorthlinePresentationFixture();
    const total = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12" });
    const reactive = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", workType: "reactive" });
    const preventive = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", workType: "preventive" });
    const costKinds = ["labor", "parts", "travel", "materials", "other"].map((costKind) => buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", costKind }));
    const currentTotal = (model: typeof total) => model.series.reduce((sum, point) => sum + point.currentValue, 0);

    expect(currentTotal(reactive) + currentTotal(preventive)).toBe(currentTotal(total));
    expect(costKinds.reduce((sum, model) => sum + currentTotal(model), 0)).toBe(currentTotal(total));
    expect(queryFromHref(summary(reactive, "current").link.href)).toMatchObject({ workType: "reactive" });
    expect(queryFromHref(summary(costKinds[0], "current").link.href)).toMatchObject({ costKind: "labor" });
  });

  it("paginates exact evidence and exposes an export for the complete filtered population", () => {
    const fixture = buildNorthlinePresentationFixture();
    const firstPage = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", detailKind: "current" });
    const secondPage = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", detailKind: "current", sourcePage: "2" });
    const exportParameters = queryFromHref(firstPage.sourceExportLink.href);

    expect(firstPage.sourceTable.rows).toHaveLength(25);
    expect(firstPage.sourcePagination.totalPages).toBeGreaterThan(1);
    expect(secondPage.sourcePagination.currentPage).toBe(2);
    expect(firstPage.sourcePagination.pageLinks[0]).toMatchObject({ page: 1, current: true });
    expect(firstPage.sourcePagination.pageLinks.at(-1)?.page).toBe(firstPage.sourcePagination.totalPages);
    expect(new Set(firstPage.sourceTable.rows.map((row) => row.id)).isDisjointFrom(new Set(secondPage.sourceTable.rows.map((row) => row.id)))).toBe(true);
    expect(exportParameters).toMatchObject({ metric: "recorded_cost", period: "12", detailKind: "current" });
    expect(exportParameters).not.toHaveProperty("sourcePage");
  });

  it("pages store-level change and comparison tables before a larger portfolio becomes a continuous list", () => {
    const fixture = buildNorthlinePresentationFixture();
    const sourceStore = fixture.stores[0];
    const sourceWork = fixture.workOrders.find((work) => work.storeId === sourceStore.id && fixture.costLines.some((line) => line.workOrderId === work.id))!;
    const sourceLine = fixture.costLines.find((line) => line.workOrderId === sourceWork.id)!;
    for (let index = 0; index < 20; index += 1) {
      const suffix = String(index + 1).padStart(2, "0");
      const storeId = `store-trend-page-${suffix}`;
      const workOrderId = `work-trend-page-${suffix}`;
      fixture.stores.push({ ...sourceStore, id: storeId, storeNumber: `9${suffix}`, name: `Pagination Store ${suffix}` });
      fixture.workOrders.push({ ...sourceWork, id: workOrderId, storeId, number: `CPS-PAGE-${suffix}`, assetId: undefined, componentId: undefined });
      fixture.costLines.push({ ...sourceLine, id: `cost-trend-page-${suffix}`, workOrderId, amount: { ...sourceLine.amount, amountMinor: sourceLine.amount.amountMinor + index } });
    }

    const first = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", breakdown: "store" });
    const second = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", breakdown: "store", driverPage: "2", storePage: "2" });

    expect(first.drivers.pagination).toBeDefined();
    expect(first.benchmark.pagination).toBeDefined();
    expect(first.drivers.rows).toHaveLength(15);
    expect(first.benchmark.rows).toHaveLength(15);
    expect(second.drivers.pagination?.currentPage).toBe(2);
    expect(second.benchmark.pagination?.currentPage).toBe(2);
    expect(new Set(first.drivers.rows.map((row) => row.id)).isDisjointFrom(new Set(second.drivers.rows.map((row) => row.id)))).toBe(true);
    expect(new Set(first.benchmark.rows.map((row) => row.id)).isDisjointFrom(new Set(second.benchmark.rows.map((row) => row.id)))).toBe(true);
  });

  it("opens the exact full current and comparison periods while preserving every selected dimension", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      category: "refrigeration",
      breakdown: "category",
      storeSort: "coverage",
      storeDirection: "asc",
    });
    const expectedCurrentCount = model.series.reduce((sum, point) => sum + point.currentSourceCount, 0);
    const expectedComparisonCount = model.series.reduce((sum, point) => sum + (point.comparisonSourceCount ?? 0), 0);
    const currentParameters = queryFromHref(summary(model, "current").link.href);
    const comparisonParameters = queryFromHref(summary(model, "comparison").link.href);

    expect(currentParameters).toMatchObject({
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      category: "refrigeration",
      breakdown: "category",
      storeSort: "coverage",
      storeDirection: "asc",
      detailKind: "current",
    });
    expect(currentParameters).not.toHaveProperty("detailMonth");
    expect(comparisonParameters).toMatchObject({
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      category: "refrigeration",
      detailKind: "comparison",
    });
    expect(comparisonParameters).not.toHaveProperty("detailMonth");

    const currentDetail = buildTrendsModel(fixture, session(), currentParameters);
    const comparisonDetail = buildTrendsModel(fixture, session(), comparisonParameters);
    expect(sourceCount(currentDetail.sourceSummary)).toBe(expectedCurrentCount);
    expect(sourceCount(comparisonDetail.sourceSummary)).toBe(expectedComparisonCount);
    expect(currentDetail.sourcePeriodLabel).toMatch(/^Selected 6 months/);
    expect(comparisonDetail.sourcePeriodLabel).toMatch(/^Earlier 6 months/);
  });

  it("reconciles a linked-invoice chart month to scoped allocation rows instead of gross invoices", () => {
    const fixture = buildNorthlinePresentationFixture();
    const base = buildTrendsModel(fixture, session(), { metric: "linked_invoice" });
    const month = base.series.find((point) => point.currentValue > 0)!;
    const scoped = buildTrendsModel(fixture, session(), { metric: "linked_invoice", detailMonth: month.id });
    const rowTotal = scoped.sourceTable.rows.reduce((sum, row) => {
      const value = row.cells.find((cell) => cell.key === "value")?.value ?? "$0";
      return sum + Number(value.replace(/[$,]/g, "")) * 100;
    }, 0);

    expect(rowTotal).toBe(month.currentValue);
    expect(scoped.sourceTable.columns.at(-1)?.label).toBe("Linked amount");
    expect(scoped.sourceTable.rows.every((row) => row.cells.find((cell) => cell.key === "value")?.secondary?.includes("invoice gross"))).toBe(true);
  });

  it("includes only confirmed invoice allocations in the linked-invoice trend", () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find((candidate) => candidate.categoryKey && candidate.assetId)!;
    const vendorId = fixture.vendors.find((candidate) => candidate.organizationId === NORTHLINE_ORGANIZATION_ID)!.id;
    fixture.invoiceReferences = [
      {
        id: "invoice-trend-confirmed",
        organizationId: NORTHLINE_ORGANIZATION_ID,
        vendorId,
        invoiceNumber: "TREND-CONFIRMED",
        invoiceDate: "2026-08-12",
        grossAmount: { amountMinor: 12_300, currency: "USD" },
        operatorWorkOrderNumber: work.number,
        matchStatus: "confirmed",
        createdAt: "2026-08-12T14:00:00.000Z",
      },
      {
        id: "invoice-trend-suggested",
        organizationId: NORTHLINE_ORGANIZATION_ID,
        vendorId,
        invoiceNumber: "TREND-SUGGESTED",
        invoiceDate: "2026-08-13",
        grossAmount: { amountMinor: 77_700, currency: "USD" },
        operatorWorkOrderNumber: work.number,
        matchStatus: "suggested",
        createdAt: "2026-08-13T14:00:00.000Z",
      },
    ];
    fixture.invoiceAllocations = [
      {
        id: "allocation-trend-confirmed",
        organizationId: NORTHLINE_ORGANIZATION_ID,
        invoiceReferenceId: "invoice-trend-confirmed",
        workOrderId: work.id,
        amount: { amountMinor: 12_300, currency: "USD" },
        confirmedByMembershipId: "membership-northline-finance",
        confirmedAt: "2026-08-12T15:00:00.000Z",
      },
      {
        id: "allocation-trend-not-confirmed",
        organizationId: NORTHLINE_ORGANIZATION_ID,
        invoiceReferenceId: "invoice-trend-confirmed",
        workOrderId: work.id,
        amount: { amountMinor: 99_900, currency: "USD" },
      },
      {
        id: "allocation-trend-suggested",
        organizationId: NORTHLINE_ORGANIZATION_ID,
        invoiceReferenceId: "invoice-trend-suggested",
        workOrderId: work.id,
        amount: { amountMinor: 77_700, currency: "USD" },
        confirmedByMembershipId: "membership-northline-finance",
        confirmedAt: "2026-08-13T15:00:00.000Z",
      },
    ];

    const model = buildTrendsModel(fixture, session(), { metric: "linked_invoice", period: "3", detailKind: "current" });
    expect(summary(model, "current").value).toBe("$123");
    expect(sourceCount(model.sourceSummary)).toBe(1);
    expect(model.sourceTable.rows.map((row) => row.label)).toEqual(["TREND-CONFIRMED"]);
  });

  it("uses every completed PM status, excludes waived and cancelled windows, and distinguishes no denominator from zero", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = fixture.stores[0].id;
    const baseOccurrence = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      planId: "pm-plan-trend-contract",
      storeId,
      dueAt: "2026-08-15T16:00:00.000Z",
      windowStartsAt: "2026-08-10T16:00:00.000Z",
      windowEndsAt: "2026-08-20T16:00:00.000Z",
      createdAt: "2026-05-01T12:00:00.000Z",
    } as const;
    fixture.pmOccurrences = [
      { ...baseOccurrence, id: "pm-trend-early", status: "completed_early", completedAt: "2026-08-11T16:00:00.000Z" },
      { ...baseOccurrence, id: "pm-trend-on-time", status: "completed_on_time", completedAt: "2026-08-15T16:00:00.000Z" },
      { ...baseOccurrence, id: "pm-trend-late", status: "completed_late", completedAt: "2026-08-19T16:00:00.000Z" },
      { ...baseOccurrence, id: "pm-trend-missed", status: "missed", exceptionReason: "Vendor did not attend" },
      { ...baseOccurrence, id: "pm-trend-waived", status: "waived", exceptionReason: "Approved waiver" },
      { ...baseOccurrence, id: "pm-trend-cancelled", status: "cancelled", exceptionReason: "Plan retired" },
    ];

    const model = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "3", detailKind: "current" });
    const august = model.series.find((point) => point.id === "2026-08")!;
    expect(august.currentValue).toBe(75);
    expect(august.currentSourceCount).toBe(4);
    expect(summary(model, "current").value).toBe("75%");
    expect(sourceCount(model.sourceSummary)).toBe(4);
    expect(model.sourceTable.rows.map((row) => row.cells.find((cell) => cell.key === "value")?.value).sort()).toEqual([
      "Completed Early",
      "Completed Late",
      "Completed On Time",
      "Missed",
    ]);

    fixture.pmOccurrences = [];
    const noData = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "3" });
    expect(summary(noData, "current").value).toBe("No data");
    expect(noData.series.every((point) => point.currentHasData === false && point.currentFormattedValue === "No data")).toBe(true);
    expect(noData.outlook.value).toBe("No data");
  });

  it("never overlaps a long current window with its comparison window", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), { period: "24", compare: "previous_year" });
    const currentMonths = new Set(model.series.map((point) => point.id));
    const comparisonMonths = model.series.map((point) => queryFromHref(point.comparisonLink!.href).detailMonth);

    expect(model.comparisonId).toBe("previous_period");
    expect(comparisonMonths).toHaveLength(24);
    expect(comparisonMonths.every((month) => month && !currentMonths.has(month))).toBe(true);
  });

  it("keeps store benchmark arithmetic reconcilable and exposes stable sort links", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "recorded_cost",
      period: "12",
      category: "refrigeration",
      storeSort: "variance",
      storeDirection: "desc",
    });
    const comparable = model.benchmark.rows.filter((row) => row.expectedValue !== undefined && row.comparableActualValue !== undefined && row.varianceValue !== undefined);
    expect(comparable.length).toBeGreaterThan(0);
    expect(comparable.every((row) => row.varianceValue === row.comparableActualValue! - row.expectedValue!)).toBe(true);

    const definedVariances = model.benchmark.rows.flatMap((row) => row.varianceValue === undefined ? [] : [row.varianceValue]);
    expect(definedVariances).toEqual([...definedVariances].sort((left, right) => right - left));
    expect(model.benchmark.sortLinks.map((link) => link.id)).toEqual(["store", "comparable", "expected", "variance", "signal", "coverage"]);
    const activeSort = model.benchmark.sortLinks.find((link) => link.id === "variance")!;
    expect(activeSort).toMatchObject({ active: true, direction: "desc" });
    expect(queryFromHref(activeSort.link.href)).toMatchObject({
      metric: "recorded_cost",
      period: "12",
      category: "refrigeration",
      storeSort: "variance",
      storeDirection: "asc",
    });

    const rowLink = queryFromHref(comparable[0].recordsLink.href);
    expect(rowLink).toMatchObject({
      category: "refrigeration",
      detailKind: "current",
      driverBreakdown: "store",
      driverValue: comparable[0].id,
    });
    expect(rowLink).not.toHaveProperty("store");
    expect(rowLink).not.toHaveProperty("detailMonth");
    expect(queryFromHref(comparable[0].focusLink.href)).toMatchObject({ category: "refrigeration", store: comparable[0].id });
  });

  it("keeps analysis views in the URL and sends evidence links to source records", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "recorded_cost",
      period: "6",
      category: "refrigeration",
      view: "drivers",
    });

    expect(model.activeView).toBe("drivers");
    expect(queryFromSearch(model.canonicalQuery)).toMatchObject({ view: "drivers", category: "refrigeration" });
    expect(model.views.map((view) => view.id)).toEqual(["overview", "stores", "drivers", "records"]);
    expect(model.views.every((view) => queryFromHref(view.link.href).category === "refrigeration")).toBe(true);
    expect(queryFromHref(summary(model, "current").link.href)).toMatchObject({ view: "records", detailKind: "current" });
  });

  it("uses a stable long-window peer range and suppresses weak or zero cost baselines", () => {
    const fixture = buildNorthlinePresentationFixture();
    const threeMonths = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "3", category: "refrigeration" });
    const twelveMonths = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", category: "refrigeration" });
    const threeSample = threeMonths.benchmark.sampleLabel.match(/(\d+) reference months/)?.[1];
    const twelveSample = twelveMonths.benchmark.sampleLabel.match(/(\d+) reference months/)?.[1];
    const reliable = twelveMonths.benchmark.rows.filter((row) => row.expectedValue !== undefined);

    expect(threeSample).toBe(twelveSample);
    expect(Number(threeSample)).toBeGreaterThanOrEqual(18);
    expect(reliable.length).toBeGreaterThan(0);
    expect(reliable.every((row) => (row.rangeHighValue ?? 0) > 0 && row.rangeLabel.includes("–"))).toBe(true);
    expect(new Set(reliable.map((row) => row.expectedValue)).size).toBeGreaterThan(1);

    const portfolio = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "3" });
    const comparablePortfolioRows = portfolio.benchmark.rows.filter((row) => row.rangeLowValue !== undefined && row.rangeHighValue !== undefined);
    const insideRange = comparablePortfolioRows.filter((row) =>
      row.comparableActualValue !== undefined
      && row.comparableActualValue >= row.rangeLowValue!
      && row.comparableActualValue <= row.rangeHighValue!);
    const aboveRange = comparablePortfolioRows.filter((row) =>
      row.comparableActualValue !== undefined
      && row.comparableActualValue > row.rangeHighValue!);
    expect(comparablePortfolioRows.length).toBeGreaterThanOrEqual(10);
    expect(insideRange.length).toBeGreaterThan(0);
    expect(aboveRange.length).toBeLessThan(comparablePortfolioRows.length);
    if (aboveRange.length / comparablePortfolioRows.length >= 0.6) {
      expect(portfolio.benchmark.description).toContain("portfolio-wide increase");
      expect(portfolio.insights.find((insight) => insight.id === "store-variance")?.eyebrow).toBe("Largest store variance");
    }

    fixture.costLines = fixture.costLines.filter((line) => line.serviceDate >= "2026-08-01");
    const weak = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "3", category: "refrigeration" });
    expect(weak.benchmark.rows.every((row) => row.ratioValue === undefined)).toBe(true);
    expect(weak.benchmark.rows.every((row) => row.signalLabel === "No reliable peer comparison yet")).toBe(true);
  });

  it("increases the equipment-mix baseline when identical equipment is added", () => {
    const fixture = buildNorthlinePresentationFixture();
    const initial = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", category: "refrigeration" });
    const target = initial.benchmark.rows.find((row) => row.expectedValue !== undefined)!;
    const sourceAsset = fixture.assets.find((asset) => asset.storeId === target.id && asset.categoryKey === "refrigeration" && asset.replacementProfileId)!;
    fixture.assets.push({ ...sourceAsset, id: `${sourceAsset.id}-additional`, assetTag: `${sourceAsset.assetTag}-B`, serialNumber: `${sourceAsset.serialNumber ?? "SERIAL"}-B` });
    const expanded = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", category: "refrigeration", store: target.id });

    expect(expanded.benchmark.rows[0].expectedValue).toBeGreaterThan(target.expectedValue!);
  });

  it("keeps the 65-store, 36-month analysis bounded to the requested page", () => {
    const fixture = buildSyntheticTrendScaleFixture(65, 36);
    const startedAt = performance.now();
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", view: "stores" });
    const elapsed = performance.now() - startedAt;

    expect(fixture.workOrders.length).toBeGreaterThan(3_000);
    expect(model.benchmark.rows).toHaveLength(15);
    expect(model.benchmark.pagination?.totalPages).toBeGreaterThan(4);
    expect(model.benchmark.rows.some((row) => row.expectedValue !== undefined)).toBe(true);
    expect(elapsed).toBeLessThan(2_500);
  });

  it("keeps focused non-additive store comparisons connected to the other eligible stores", () => {
    const fixture = buildNorthlinePresentationFixture();
    const companywide = buildTrendsModel(fixture, session(), { metric: "vendor_response", period: "12" });
    const candidate = companywide.benchmark.rows.find((row) => row.actualValue !== undefined && row.expectedValue !== undefined)!;
    const focused = buildTrendsModel(fixture, session(), { metric: "vendor_response", period: "12", store: candidate.id });

    expect(candidate).toBeDefined();
    expect(focused.benchmark.rows).toHaveLength(1);
    expect(focused.benchmark.rows[0]).toMatchObject({ id: candidate.id, expectedValue: candidate.expectedValue });
    expect(focused.benchmark.rows[0].coverageLabel).toMatch(/[3-9]|1\d other stores compared/);
  });

  it("supports canonical pipe-delimited equipment paths without emptying the analysis", () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find((candidate) => candidate.assetId && fixture.costLines.some((line) => line.workOrderId === candidate.id))!;
    const asset = fixture.assets.find((candidate) => candidate.id === work.assetId)!;
    const path = asset.groupPath.join("|");
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", category: asset.categoryKey, path });
    const pathFilter = model.filters.find((filter) => filter.id === "path")!;

    expect(model.series.reduce((sum, point) => sum + point.currentSourceCount, 0)).toBeGreaterThan(0);
    expect(pathFilter.value).toBe(path);
    expect(pathFilter.options.some((option) => option.value === path)).toBe(true);
    expect(model.investigation.trails.find((trail) => trail.id === "maintenance")?.crumbs.some((crumb) => crumb.id === path)).toBe(true);
  });

  it("turns comparison-off cards into a clear enable-comparison action instead of invalid evidence links", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6", compare: "none" });

    expect(queryFromHref(summary(model, "comparison").link.href)).toMatchObject({ compare: "previous_period" });
    expect(queryFromHref(summary(model, "comparison").link.href)).not.toHaveProperty("detailKind");
    expect(queryFromHref(summary(model, "change").link.href)).toMatchObject({ compare: "previous_period" });
    expect(queryFromHref(model.insights.find((insight) => insight.id === "period-movement")!.link.href)).toMatchObject({ compare: "previous_period" });

    const sharedBadState = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6", compare: "none", detailKind: "both" });
    expect(sharedBadState.sourcePeriodLabel).toMatch(/^Selected 6 months/);
    expect(sharedBadState.investigation.evidence?.label).toMatch(/Selected 6 months/);
  });

  it("anchors the rolling window to the organization-local month", () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.asOf = "2026-09-01T02:00:00.000Z";
    const model = buildTrendsModel(fixture, session(), { period: "6" });

    expect(model.series.map((point) => point.id)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(model.currentPeriodLabel).toMatch(/Aug 31, 2026$/);
  });

  it("uses metric-specific planning and benchmark language for count measures", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrders = buildTrendsModel(fixture, session(), { metric: "work_orders", period: "12" });
    const visits = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "12" });

    expect(workOrders.outlook.label).toMatch(/work-order volume/i);
    expect(workOrders.outlook.label).not.toMatch(/cost/i);
    expect(workOrders.benchmark.title).toMatch(/work orders created/i);
    expect(workOrders.benchmark.description).not.toMatch(/spent|cost/i);
    expect(visits.outlook.label).toMatch(/service-visit volume/i);
    expect(visits.outlook.caution).toMatch(/not a workload commitment or staffing forecast/i);
  });

  it("shows no denominator as no data instead of a critical zero-percent classification problem", () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.costLines = [];
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6" });
    const coverage = summary(model, "coverage");

    expect(coverage).toMatchObject({ value: "No data", tone: "neutral" });
    expect(coverage.supportingText).toMatch(/No records/i);
  });

  it("shows the complete peer-equipment basis, including zero observations, behind an expected result", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12", category: "refrigeration" });
    const row = model.benchmark.rows.find((candidate) => candidate.peerLink)!;
    const detail = buildTrendsModel(fixture, session(), queryFromHref(row.peerLink!.href));

    expect(detail.sourceTable.rows.length).toBeGreaterThan(0);
    expect(detail.sourceTable.rows.every((source) => source.id.startsWith("benchmark:"))).toBe(true);
    expect(detail.sourceTable.rows.some((source) => source.cells.find((cell) => cell.key === "value")?.value === "$0")).toBe(true);
    expect(detail.sourceTable.rows.some((source) => source.cells.find((cell) => cell.key === "record")?.secondary?.includes("recorded zero months remain included"))).toBe(true);
    expect(detail.sourceHeading).toBe("Inputs behind this comparison");
    expect(detail.sourceDescription).toMatch(/calculation|peer equipment|underlying records/i);
    expect(row.peerLink?.label).toMatch(/comparison inputs/i);
    expect(row.peerLink?.label).not.toMatch(/source records/i);
  });

  it("keeps a measured zero-percent peer result distinct from missing peer data", () => {
    const fixture = buildNorthlinePresentationFixture();
    const stores = fixture.stores.slice(0, 4);
    const template = fixture.pmOccurrences[0]!;
    fixture.pmOccurrences = stores.map((store, index) => ({
      ...template,
      id: `pm-zero-peer-${index}`,
      storeId: store.id,
      assetId: undefined,
      workOrderId: undefined,
      status: "missed" as const,
      dueAt: "2026-07-15T16:00:00.000Z",
      windowStartsAt: "2026-07-08T16:00:00.000Z",
      windowEndsAt: "2026-07-22T16:00:00.000Z",
      completedAt: undefined,
    }));
    const model = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "6", store: stores[0].id });

    expect(model.benchmark.rows).toHaveLength(1);
    expect(model.benchmark.rows[0].expectedValue).toBe(0);
    expect(model.benchmark.rows[0].expectedLabel).toBe("0%");
    expect(model.benchmark.rows[0].signalLabel).not.toBe("Not enough data");
    expect(model.benchmark.rows[0].peerLink).toBeDefined();
  });

  it("clears incompatible descendant filters and rejects malformed detail months", () => {
    const fixture = buildNorthlinePresentationFixture();
    const region = fixture.regions[0];
    const otherRegionStore = fixture.stores.find((store) => store.regionId !== region.id)!;
    const locationModel = buildTrendsModel(fixture, session(), { region: region.id, store: otherRegionStore.id });
    const maintenanceModel = buildTrendsModel(fixture, session(), { category: "hvac", path: "Refrigeration|Walk-in refrigeration|Coolers|Beer caves" });
    const invalidMonth = buildTrendsModel(fixture, session(), { detailMonth: "garbage" });

    expect(locationModel.filters.find((filter) => filter.id === "store")?.value).toBe("");
    expect(locationModel.page.scopeLabel).toBe(region.name);
    expect(maintenanceModel.filters.find((filter) => filter.id === "path")?.value).toBe("");
    expect(invalidMonth.investigation.evidence).toBeUndefined();
    expect(invalidMonth.sourcePeriodLabel).toMatch(/^Selected/);
  });

  it("reconciles additive change drivers to the chart totals and drills to each exact segment", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      breakdown: "category",
    });
    const chartCurrent = model.series.reduce((sum, point) => sum + point.currentValue, 0);
    const chartComparison = model.series.reduce((sum, point) => sum + (point.comparisonValue ?? 0), 0);
    const driverCurrent = model.drivers.rows.reduce((sum, row) => sum + (row.currentValue ?? 0), 0);
    const driverComparison = model.drivers.rows.reduce((sum, row) => sum + (row.comparisonValue ?? 0), 0);
    const driverChange = model.drivers.rows.reduce((sum, row) => sum + (row.changeValue ?? 0), 0);

    expect(driverCurrent).toBe(chartCurrent);
    expect(driverComparison).toBe(chartComparison);
    expect(driverChange).toBe(chartCurrent - chartComparison);

    const selectedDriver = model.drivers.rows.find((row) => row.currentSourceCount > 0)!;
    const parameters = queryFromHref(selectedDriver.link.href);
    expect(parameters).toMatchObject({
      metric: "recorded_cost",
      period: "6",
      compare: "previous_period",
      breakdown: "category",
      detailKind: "both",
      driverBreakdown: "category",
      driverValue: selectedDriver.id,
    });
    const detail = buildTrendsModel(fixture, session(), parameters);
    expect(sourceCount(detail.sourceSummary)).toBe(selectedDriver.currentSourceCount + selectedDriver.comparisonSourceCount);
  });

  it("sorts every analytical table across its complete result set and keeps the active scope", () => {
    const fixture = buildNorthlinePresentationFixture();
    const drivers = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "12",
      compare: "previous_period",
      category: "refrigeration",
      breakdown: "store",
      driverSort: "current",
      driverDirection: "desc",
    });
    const driverValues = drivers.drivers.rows.flatMap((row) => row.currentValue === undefined ? [] : [row.currentValue]);
    expect(driverValues).toEqual([...driverValues].sort((left, right) => right - left));
    expect(drivers.drivers.sortLinks.map((link) => link.id)).toEqual(["segment", "current", "comparison", "change", "evidence"]);
    const currentSort = drivers.drivers.sortLinks.find((link) => link.id === "current")!;
    expect(currentSort).toMatchObject({ active: true, direction: "desc" });
    expect(queryFromHref(currentSort.link.href)).toMatchObject({
      metric: "recorded_cost",
      category: "refrigeration",
      breakdown: "store",
      driverSort: "current",
      driverDirection: "asc",
    });

    const sources = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "12",
      category: "refrigeration",
      detailKind: "current",
      sourceSort: "value",
      sourceDirection: "desc",
      sourcePage: "2",
    });
    const sourceValues = sources.sourceTable.rows.map((row) => Number((row.cells.find((cell) => cell.key === "value")?.value ?? "0").replace(/[$,]/g, "")));
    expect(sourceValues).toEqual([...sourceValues].sort((left, right) => right - left));
    expect(sources.sourceSortLinks.map((link) => link.id)).toEqual(["record", "store", "service", "date", "value"]);
    const valueSort = sources.sourceSortLinks.find((link) => link.id === "value")!;
    expect(valueSort).toMatchObject({ active: true, direction: "desc" });
    const valueSortQuery = queryFromHref(valueSort.link.href);
    expect(valueSortQuery).toMatchObject({
      metric: "recorded_cost",
      category: "refrigeration",
      detailKind: "current",
      sourceSort: "value",
      sourceDirection: "asc",
    });
    expect(valueSortQuery).not.toHaveProperty("sourcePage");
    expect(queryFromHref(sources.sourceExportLink.href)).toMatchObject({ sourceSort: "value", sourceDirection: "desc" });

    const comparable = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "12",
      storeSort: "comparable",
      storeDirection: "desc",
    });
    const comparableValues = comparable.benchmark.rows.flatMap((row) => row.comparableActualValue === undefined ? [] : [row.comparableActualValue]);
    expect(comparableValues).toEqual([...comparableValues].sort((left, right) => right - left));
  }, 30_000);

  it("groups timestamped service events into the store-local month", () => {
    const fixture = buildNorthlinePresentationFixture();
    const store = fixture.stores[0];
    const vendor = fixture.vendors[0];
    expect(store.timeZone).toBe("America/New_York");
    fixture.asOf = "2026-09-02T16:00:00.000Z";
    fixture.visits = [{
      id: "visit-local-month-boundary",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: store.id,
      providerKind: "outside_vendor",
      vendorId: vendor.id,
      technicianName: "Taylor Reed",
      providerName: vendor.name,
      purpose: "Month-boundary service visit",
      status: "checked_out",
      startedChannel: "qr",
      endedChannel: "qr",
      checkedInAt: "2026-09-01T03:30:00.000Z",
      checkedOutAt: "2026-09-01T04:15:00.000Z",
      outcome: "resolved",
      observedDurationSeconds: 2_700,
    }];

    const model = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "3", detailMonth: "2026-08" });
    expect(model.series.find((point) => point.id === "2026-08")?.currentValue).toBe(1);
    expect(model.series.find((point) => point.id === "2026-09")?.currentValue).toBe(0);
    expect(model.sourceTable.rows).toHaveLength(1);
    expect(model.sourceTable.rows[0].cells.find((cell) => cell.key === "date")?.value).toBe("Aug 31, 2026");
  });

  it("keeps the legacy spend invoice drill-through on one exact month and every selected dimension", () => {
    const fixture = buildNorthlinePresentationFixture();
    const allocation = fixture.invoiceAllocations.find((candidate) => {
      const work = fixture.workOrders.find((row) => row.id === candidate.workOrderId);
      return Boolean(work?.assetId && work.componentId && work.categoryKey);
    })!;
    const work = fixture.workOrders.find((row) => row.id === allocation.workOrderId)!;
    const asset = fixture.assets.find((row) => row.id === work.assetId)!;
    const store = fixture.stores.find((row) => row.id === work.storeId)!;
    const categoryLabel = asset.categoryKey.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const hierarchyPath = asset.groupPath[0]?.toLocaleLowerCase("en-US") === asset.categoryKey.toLocaleLowerCase("en-US")
      || asset.groupPath[0]?.toLocaleLowerCase("en-US") === categoryLabel.toLocaleLowerCase("en-US")
      ? asset.groupPath
      : [categoryLabel, ...asset.groupPath];
    const model = buildProgramModel(fixture, session(), "spend", {
      basis: "invoiced",
      period: "12m",
      region: store.regionId,
      store: store.id,
      category: work.categoryKey,
      path: hierarchyPath.join("|"),
      asset: work.assetId,
      component: work.componentId,
    });
    const point = model.trends[0]?.points.find((candidate) => candidate.value > 0);
    expect(point).toBeDefined();
    if (!point) throw new Error("Expected a linked-invoice month for the selected equipment and component");
    const parameters = queryFromHref(point.link.href);

    expect(parameters).toMatchObject({
      region: store.regionId,
      store: store.id,
      category: work.categoryKey,
      asset: work.assetId,
      component: work.componentId,
      from: `${point.id}-01`,
    });
    expect(parameters.path).toBe(hierarchyPath.join("|"));
    expect(parameters.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parameters.to.slice(0, 7)).toBe(point.id);

    const invoices = buildListModel(fixture, session(), "invoices", parameters);
    expect(invoices.table.rows.length).toBeGreaterThan(0);
    expect(invoices.table.columns.find((column) => column.key === "amount")?.label).toBe("Linked in scope / gross");
    expect(invoices.table.rows.every((row) => row.cells.find((cell) => cell.key === "amount")?.secondary?.includes("invoice gross"))).toBe(true);
  });

  it("does not present behavioral rates as forecasts", () => {
    const fixture = buildNorthlinePresentationFixture();
    const response = buildTrendsModel(fixture, session(), { metric: "vendor_response" });
    const pm = buildTrendsModel(fixture, session(), { metric: "pm_completion" });

    expect(response.outlook.kind).toBe("measured_baseline");
    expect(response.outlook.label).toBe("Typical vendor response time");
    expect(response.outlook.caution).toMatch(/not a forecast/i);
    expect(pm.outlook.kind).toBe("measured_baseline");
    expect(pm.outlook.label).toBe("PM completion rate");
    expect(pm.outlook.caution).toMatch(/not a forecast/i);
  });

  it("benchmarks one selected asset and its profile against the same peer equipment instead of zeroing the peer cohort", () => {
    const fixture = buildNorthlinePresentationFixture();
    const assets = fixture.assets.filter((asset) => asset.replacementProfileId === "replacement-profile-beer-cave-medium");
    const sourceWork = fixture.workOrders.find((work) => work.organizationId === NORTHLINE_ORGANIZATION_ID)!;
    const sourceLine = fixture.costLines[0]!;
    fixture.costLines = [];

    assets.forEach((asset, index) => {
      const workOrderId = `work-trend-peer-${asset.id}`;
      fixture.workOrders.push({
        ...sourceWork,
        id: workOrderId,
        storeId: asset.storeId,
        number: `CPS-PEER-${String(index + 1).padStart(2, "0")}`,
        categoryKey: asset.categoryKey,
        assetId: asset.id,
        componentId: undefined,
        createdAt: "2026-08-01T14:00:00.000Z",
      });
      fixture.costLines.push({
        ...sourceLine,
        id: `cost-trend-peer-${asset.id}`,
        workOrderId,
        serviceDate: "2026-08-10",
        amount: { ...sourceLine.amount, amountMinor: (index + 1) * 10_000 },
      });
      Array.from({ length: 18 }, (_, monthIndex) => {
        const date = new Date(Date.UTC(2024, 11 + monthIndex, 10, 12)).toISOString().slice(0, 10);
        fixture.costLines.push({
          ...sourceLine,
          id: `cost-trend-peer-history-${asset.id}-${monthIndex}`,
          workOrderId,
          serviceDate: date,
          amount: { ...sourceLine.amount, amountMinor: (index + 2) * 4_000 },
        });
      });
    });

    const target = assets[0]!;
    const exact = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "3",
      store: target.storeId,
      category: target.categoryKey,
      profile: target.replacementProfileId,
      asset: target.id,
    });
    const profile = buildTrendsModel(fixture, session(), {
      metric: "recorded_cost",
      period: "3",
      store: target.storeId,
      category: target.categoryKey,
      profile: target.replacementProfileId,
    });

    expect(exact.benchmark.rows).toHaveLength(1);
    expect(exact.benchmark.rows[0].actualValue).toBe(10_000);
    expect(exact.benchmark.rows[0].expectedValue).toBeGreaterThan(0);
    expect(exact.benchmark.rows[0].coverageLabel).toMatch(/1 equipment record$/);
    expect(profile.benchmark.rows[0]).toMatchObject({
      actualValue: exact.benchmark.rows[0].actualValue,
      expectedValue: exact.benchmark.rows[0].expectedValue,
    });
    expect(profile.benchmark.rows[0].coverageLabel).toMatch(/1 equipment record$/);
  });

  it("counts one physical multi-work visit once companywide while retaining every linked service area", () => {
    const fixture = buildNorthlinePresentationFixture();
    const store = fixture.stores[0]!;
    const refrigerationAsset = fixture.assets.find((asset) => asset.storeId === store.id && asset.categoryKey === "refrigeration")!;
    const hvacAsset = fixture.assets.find((asset) => asset.storeId === store.id && asset.categoryKey === "hvac")!;
    const sourceWork = fixture.workOrders.find((work) => work.organizationId === NORTHLINE_ORGANIZATION_ID)!;
    const sourceVisit = fixture.visits[0]!;
    const refrigerationWorkId = "work-trend-multi-refrigeration";
    const hvacWorkId = "work-trend-multi-hvac";
    fixture.workOrders.push(
      { ...sourceWork, id: refrigerationWorkId, storeId: store.id, number: "CPS-MULTI-REF", categoryKey: "refrigeration", assetId: refrigerationAsset.id, componentId: undefined },
      { ...sourceWork, id: hvacWorkId, storeId: store.id, number: "CPS-MULTI-HVAC", categoryKey: "hvac", assetId: hvacAsset.id, componentId: undefined },
    );
    fixture.visits = [{
      ...sourceVisit,
      id: "visit-trend-multi-work",
      storeId: store.id,
      workOrderId: undefined,
      checkedInAt: "2026-08-12T14:00:00.000Z",
      checkedOutAt: "2026-08-12T15:00:00.000Z",
    }];
    fixture.siteVisitWorkOrders = [
      { id: "visit-work-trend-ref", organizationId: NORTHLINE_ORGANIZATION_ID, visitId: "visit-trend-multi-work", workOrderId: refrigerationWorkId, ordinal: 0, linkedByActorType: "technician", linkedByActorName: "Taylor Reed", linkedAt: "2026-08-12T14:00:00.000Z" },
      { id: "visit-work-trend-hvac", organizationId: NORTHLINE_ORGANIZATION_ID, visitId: "visit-trend-multi-work", workOrderId: hvacWorkId, ordinal: 1, linkedByActorType: "technician", linkedByActorName: "Taylor Reed", linkedAt: "2026-08-12T14:00:00.000Z" },
    ];

    const companywide = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "3", detailKind: "current" });
    const refrigeration = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "3", category: "refrigeration", detailKind: "current" });
    const hvac = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "3", category: "hvac", detailKind: "current" });
    const currentTotal = (model: typeof companywide) => model.series.reduce((sum, point) => sum + point.currentValue, 0);

    expect(currentTotal(companywide)).toBe(1);
    expect(currentTotal(refrigeration)).toBe(1);
    expect(currentTotal(hvac)).toBe(1);
    expect(companywide.sourceTable.rows.map((row) => row.id)).toEqual(["visit-trend-multi-work"]);
    expect(refrigeration.sourceTable.rows.map((row) => row.id)).toEqual(["visit-trend-multi-work"]);
    expect(hvac.sourceTable.rows.map((row) => row.id)).toEqual(["visit-trend-multi-work"]);
  });

  it("rejects incomplete evidence tuples instead of labeling an unrelated record set as exact evidence", () => {
    const fixture = buildNorthlinePresentationFixture();
    const base = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6" });
    const missingBenchmarkStore = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6", detailKind: "benchmark" });
    const missingDriverValue = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6", driverBreakdown: "category" });
    const missingDriverDimension = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "6", driverValue: "refrigeration" });

    for (const model of [missingBenchmarkStore, missingDriverValue, missingDriverDimension]) {
      expect(model.investigation.evidence).toBeUndefined();
      expect(model.sourcePeriodLabel).toMatch(/^Selected 6 months/);
      expect(sourceCount(model.sourceSummary)).toBe(sourceCount(base.sourceSummary));
      expect(queryFromSearch(model.canonicalQuery)).not.toHaveProperty("detailKind");
      expect(queryFromSearch(model.canonicalQuery)).not.toHaveProperty("benchmarkStore");
      expect(queryFromSearch(model.canonicalQuery)).not.toHaveProperty("driverBreakdown");
      expect(queryFromSearch(model.canonicalQuery)).not.toHaveProperty("driverValue");
    }
  });

  it("retains forecourt and foodservice hierarchy paths whose display root differs from the category key", () => {
    const fixture = buildNorthlinePresentationFixture();
    for (const category of ["forecourt", "foodservice"]) {
      const asset = fixture.assets.find((candidate) => candidate.categoryKey === category)!;
      const path = asset.groupPath.join("|");
      const model = buildTrendsModel(fixture, session(), { metric: "work_orders", category, path });
      const pathFilter = model.filters.find((filter) => filter.id === "path")!;

      expect(pathFilter.value).toBe(path);
      expect(pathFilter.options.some((option) => option.value === path)).toBe(true);
      expect(queryFromSearch(model.canonicalQuery)).toMatchObject({ category, path });
    }
  });

  it("keeps linked-invoice language distinct from recorded work cost throughout the analysis", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), { metric: "linked_invoice", period: "12" });
    const peak = model.insights.find((insight) => insight.id === "peak-month")!;

    expect(model.outlook.label).toMatch(/linked invoice amount/i);
    expect(model.outlook.label).not.toMatch(/\bcost\b/i);
    expect(peak.eyebrow).toBe("Highest linked-invoice month");
    expect(model.benchmark.title).toMatch(/linked invoice amount/i);
    expect(model.benchmark.description).toMatch(/confirmed invoice amount linked/i);
    expect(model.benchmark.description).not.toMatch(/recorded work cost/i);
  });

  it("uses the PM benchmark signal tone in the largest store-variance insight", () => {
    const fixture = buildNorthlinePresentationFixture();
    const stores = fixture.stores.slice(0, 4);
    const template = fixture.pmOccurrences[0]!;
    fixture.pmOccurrences = stores.map((store, index) => ({
      ...template,
      id: `pm-tone-${store.id}`,
      storeId: store.id,
      assetId: undefined,
      workOrderId: undefined,
      status: index === 0 ? "completed_on_time" as const : "missed" as const,
      dueAt: "2026-08-15T16:00:00.000Z",
      windowStartsAt: "2026-08-08T16:00:00.000Z",
      windowEndsAt: "2026-08-22T16:00:00.000Z",
      completedAt: index === 0 ? "2026-08-15T16:00:00.000Z" : undefined,
    }));

    const model = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "3" });
    const strongest = [...model.benchmark.rows]
      .filter((row) => row.varianceValue !== undefined)
      .sort((left, right) => Math.abs(right.varianceValue ?? 0) - Math.abs(left.varianceValue ?? 0))[0]!;
    const insight = model.insights.find((candidate) => candidate.id === "store-variance")!;

    expect(strongest.id).toBe(stores[0].id);
    expect(strongest.signalTone).toBe("positive");
    expect(insight.title).toContain(strongest.label);
    expect(insight.tone).toBe(strongest.signalTone);
  });

  it("keeps an inactive historical vendor selectable and clears an unknown vendor id", () => {
    const fixture = buildNorthlinePresentationFixture();
    const allocation = fixture.invoiceAllocations.find((candidate) => candidate.confirmedAt)!;
    const invoice = fixture.invoiceReferences.find((candidate) => candidate.id === allocation.invoiceReferenceId)!;
    const vendor = fixture.vendors.find((candidate) => candidate.id === invoice.vendorId)!;
    vendor.status = "inactive";

    const historical = buildTrendsModel(fixture, session(), { metric: "linked_invoice", period: "24", vendor: vendor.id });
    const vendorFilter = historical.filters.find((filter) => filter.id === "vendor")!;
    expect(vendorFilter.value).toBe(vendor.id);
    expect(vendorFilter.options.find((option) => option.value === vendor.id)?.label).toMatch(/Inactive$/);
    expect(queryFromSearch(historical.canonicalQuery)).toMatchObject({ vendor: vendor.id });

    const invalid = buildTrendsModel(fixture, session(), { metric: "linked_invoice", vendor: "vendor-that-does-not-exist" });
    expect(invalid.filters.find((filter) => filter.id === "vendor")?.value).toBe("");
    expect(queryFromSearch(invalid.canonicalQuery)).not.toHaveProperty("vendor");
    expect(invalid.page.scopeLabel).not.toMatch(/Selected vendor/i);
  });

  it("builds a canonical saved query without transient pages or invalid evidence state", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "not-a-metric",
      period: "24",
      compare: "previous_year",
      detailKind: "benchmark",
      benchmarkStore: "missing-store",
      driverBreakdown: "category",
      sourcePage: "8",
      driverPage: "4",
      storePage: "3",
    });
    const canonical = queryFromSearch(model.canonicalQuery);

    expect(canonical).toMatchObject({ metric: "recorded_cost", period: "24", compare: "previous_period" });
    expect(canonical).not.toHaveProperty("detailKind");
    expect(canonical).not.toHaveProperty("benchmarkStore");
    expect(canonical).not.toHaveProperty("driverBreakdown");
    expect(canonical).not.toHaveProperty("driverValue");
    expect(canonical).not.toHaveProperty("sourcePage");
    expect(canonical).not.toHaveProperty("driverPage");
    expect(canonical).not.toHaveProperty("storePage");
  });

  it("uses peer-store count as the non-additive match-coverage value and sort key", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {
      metric: "vendor_response",
      period: "12",
      storeSort: "coverage",
      storeDirection: "desc",
    });
    const coverageValues = model.benchmark.rows.map((row) => row.coverageValue);

    expect(coverageValues).toEqual([...coverageValues].sort((left, right) => right - left));
    expect(model.benchmark.rows.every((row) => {
      const match = /^(\d+) other stores compared$/.exec(row.coverageLabel);
      return Boolean(match && Number(match[1]) === row.coverageValue);
    })).toBe(true);
    expect(model.benchmark.sortLinks.find((link) => link.id === "coverage")).toMatchObject({ active: true, direction: "desc" });
  });

  it("labels additive driver evidence as change effect only when it is showing change contribution", () => {
    const fixture = buildNorthlinePresentationFixture();
    const sourceLine = fixture.costLines[0]!;
    fixture.costLines = [
      { ...sourceLine, id: "cost-driver-current", serviceDate: "2026-08-10", amount: { ...sourceLine.amount, amountMinor: 20_000 } },
      { ...sourceLine, id: "cost-driver-comparison", serviceDate: "2026-05-10", amount: { ...sourceLine.amount, amountMinor: 10_000 } },
    ];

    const compared = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "3", compare: "previous_period", breakdown: "category" });
    const currentOnly = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "3", compare: "none", breakdown: "category" });

    expect(compared.drivers.sortLinks.find((link) => link.id === "evidence")?.label).toBe("Effect on change");
    expect(compared.drivers.rows[0].shareLabel).toMatch(/overall increase/i);
    expect(currentOnly.drivers.sortLinks.find((link) => link.id === "evidence")?.label).toBe("Share of selected total");
    expect(currentOnly.drivers.rows[0].shareLabel).toMatch(/% of current$/);
  });

  it("offers only trend measures whose source records the preview role can open", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeManager = buildTrendsModel(fixture, { ...session(), role: "store_manager", storeIds: [fixture.stores[0].id] }, { metric: "linked_invoice" });
    const finance = buildTrendsModel(fixture, { ...session(), role: "finance" }, { metric: "pm_completion" });
    const storeManagerMetrics = storeManager.filters.find((filter) => filter.id === "metric")!.options.map((option) => option.value);
    const financeMetrics = finance.filters.find((filter) => filter.id === "metric")!.options.map((option) => option.value);

    expect(storeManager.metricId).toBe("recorded_cost");
    expect(storeManagerMetrics).not.toContain("linked_invoice");
    expect(storeManager.relatedMeasures.map((measure) => measure.metricId)).not.toContain("linked_invoice");
    expect(finance.metricId).toBe("recorded_cost");
    expect(financeMetrics).not.toContain("pm_completion");
    expect(finance.relatedMeasures.map((measure) => measure.metricId)).not.toContain("pm_completion");
  });

  it("fails closed when a location-scoped role has no location grant", () => {
    const fixture = buildNorthlinePresentationFixture();
    const regional = buildTrendsModel(fixture, { ...session(), role: "regional", regionIds: undefined }, { metric: "recorded_cost", detailKind: "current" });
    const storeManager = buildTrendsModel(fixture, { ...session(), role: "store_manager", storeIds: undefined }, { metric: "recorded_cost", detailKind: "current" });

    for (const model of [regional, storeManager]) {
      expect(model.sourceSummary).toBe("0 records");
      expect(model.benchmark.rows).toHaveLength(0);
      expect(model.filters.find((filter) => filter.id === "store")?.options).toHaveLength(1);
    }
  });

  it("uses the same taxonomy-link predicate for classification coverage and its drill-down", () => {
    const fixture = buildNorthlinePresentationFixture();
    const store = fixture.stores[0]!;
    const hvacAsset = fixture.assets.find((asset) => asset.storeId === store.id && asset.categoryKey === "hvac")!;
    const sourceWork = fixture.workOrders[0]!;
    const sourceVisit = fixture.visits[0]!;
    fixture.workOrders = [
      { ...sourceWork, id: "work-trend-unclassified-ref", storeId: store.id, number: "CPS-UNCLASSIFIED-REF", categoryKey: "refrigeration", assetId: undefined, componentId: undefined },
      { ...sourceWork, id: "work-trend-classified-hvac", storeId: store.id, number: "CPS-CLASSIFIED-HVAC", categoryKey: "hvac", assetId: hvacAsset.id, componentId: undefined },
    ];
    fixture.visits = [{
      ...sourceVisit,
      id: "visit-trend-mixed-classification",
      storeId: store.id,
      workOrderId: undefined,
      checkedInAt: "2026-08-12T14:00:00.000Z",
      checkedOutAt: "2026-08-12T15:00:00.000Z",
    }];
    fixture.siteVisitWorkOrders = [
      { id: "visit-work-unclassified-ref", organizationId: NORTHLINE_ORGANIZATION_ID, visitId: "visit-trend-mixed-classification", workOrderId: "work-trend-unclassified-ref", ordinal: 0, linkedByActorType: "technician", linkedByActorName: "Taylor Reed", linkedAt: "2026-08-12T14:00:00.000Z" },
      { id: "visit-work-classified-hvac", organizationId: NORTHLINE_ORGANIZATION_ID, visitId: "visit-trend-mixed-classification", workOrderId: "work-trend-classified-hvac", ordinal: 1, linkedByActorType: "technician", linkedByActorName: "Taylor Reed", linkedAt: "2026-08-12T14:00:00.000Z" },
    ];

    const model = buildTrendsModel(fixture, session(), { metric: "service_visits", period: "3", category: "refrigeration" });
    const coverage = summary(model, "coverage");
    const drill = buildTrendsModel(fixture, session(), queryFromHref(coverage.link!.href));

    expect(coverage.value).toBe("0%");
    expect(drill.sourceTable.rows.map((row) => row.id)).toEqual(["visit-trend-mixed-classification"]);
  });

  it("opens an exact PM occurrence when no work order has been generated", () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.pmOccurrences[0]!;
    fixture.pmOccurrences = [{
      ...source,
      id: "pm-trend-exact-occurrence",
      workOrderId: undefined,
      status: "missed",
      dueAt: "2026-08-10T16:00:00.000Z",
      windowStartsAt: "2026-08-03T16:00:00.000Z",
      windowEndsAt: "2026-08-17T16:00:00.000Z",
      completedAt: undefined,
    }];
    const model = buildTrendsModel(fixture, session(), { metric: "pm_completion", period: "3", detailKind: "current" });
    const row = model.sourceTable.rows.find((candidate) => candidate.id === "pm-trend-exact-occurrence")!;

    expect(queryFromHref(row.href)).toMatchObject({ occurrence: "pm-trend-exact-occurrence", view: "all" });
  });

  it("opens the complete-month records used by the simple planning estimate", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), { metric: "recorded_cost", period: "12" });

    expect(model.outlook.kind).toBe("projection");
    expect(model.outlook.evidenceLink).toBeDefined();
    const detail = buildTrendsModel(fixture, session(), queryFromHref(model.outlook.evidenceLink!.href));
    expect(detail.investigation.evidence?.label).toMatch(/complete months used/i);
    expect(detail.sourceSummary).toMatch(/record/);
  });
});
