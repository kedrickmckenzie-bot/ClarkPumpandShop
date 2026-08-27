import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_DEMO_ENTRY_TOKENS,
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;
let buildProgramModel: typeof import("@/app/app/_data/operator-presenter").buildProgramModel;
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;
let buildCreateWorkOrderModel: typeof import("@/app/app/_data/operator-presenter").buildCreateWorkOrderModel;
let buildDashboardModel: typeof import("@/app/app/_data/operator-presenter").buildDashboardModel;
let buildSearchModel: typeof import("@/app/app/_data/operator-presenter").buildSearchModel;
let buildEstimateComparisonModel: typeof import("@/app/app/_data/operator-presenter").buildEstimateComparisonModel;

beforeAll(async () => {
  ({ buildListModel, buildProgramModel, buildDetailModel, buildCreateWorkOrderModel, buildDashboardModel, buildSearchModel, buildEstimateComparisonModel } = await import("@/app/app/_data/operator-presenter"));
});

function executiveSession(): OperatorSession {
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

function queryValue(href: string, key: string) {
  return new URL(href, "https://operations.test").searchParams.get(key);
}

describe("operator presenter drill-through contracts", () => {
  it("makes visit history visible and explains active-only drill-downs", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const allVisits = buildListModel(fixture, session, "visits");
    const onsite = buildListModel(fixture, session, "visits", { status: "active" });
    const activeCount = fixture.visits.filter((visit) => visit.status === "active").length;

    expect(allVisits.table.rows).toHaveLength(Math.min(25, fixture.visits.length));
    expect(allVisits.pagination?.summary).toBe(`Showing 1–${Math.min(25, fixture.visits.length)} of ${fixture.visits.length}`);
    expect(onsite.table.rows).toHaveLength(activeCount);
    expect(onsite.page.title).toBe("Vendors onsite now");
    expect(onsite.resultSummary).toBe(`${activeCount} matching of ${fixture.visits.length} visits`);
    expect(onsite.appliedFilters?.map((filter) => filter.label)).toContain("Onsite now");
    expect(onsite.clearFiltersHref).toBe("/app/visits");
    expect(onsite.metrics?.find((metric) => metric.id === "completed-visits")?.value).toBe(
      String(fixture.visits.filter((visit) => visit.status !== "active").length),
    );
  });

  it("keeps the executive home strategic and searches across operational records", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const dashboard = buildDashboardModel(fixture, session);
    const search = buildSearchModel(fixture, session, { q: "Ridgeview" });

    expect(dashboard.page.title).toBe("Your company at a glance");
    expect(dashboard.journey).toBeUndefined();
    expect(dashboard.metrics.map((metric) => metric.id)).toEqual(
      expect.arrayContaining(["recorded-cost", "open-work", "open-exceptions", "watch-assets"]),
    );
    const costTrend = dashboard.trends.find((trend) => trend.id === "recorded-cost-trend");
    expect(costTrend?.title).toBe("Recorded work cost — last 12 months");
    expect(costTrend?.points).toHaveLength(12);
    expect(costTrend?.points.map((point) => point.id)).toEqual([
      "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
    const fixtureWithAnEmptyMonth = {
      ...fixture,
      costLines: fixture.costLines.filter((line) => !line.serviceDate.startsWith("2025-09")),
    };
    const emptyMonthTrend = buildDashboardModel(fixtureWithAnEmptyMonth, session).trends.find(
      (trend) => trend.id === "recorded-cost-trend",
    );
    expect(emptyMonthTrend?.points.find((point) => point.id === "2025-09")?.value).toBe(0);
    expect(search.groups.find((group) => group.id === "stores")?.rows.some((row) => row.id === NORTHLINE_DEMO_HANDLES.storyStoreId)).toBe(true);
    expect(search.resultSummary).toMatch(/matches across/i);
  });

  it("keeps the selected store scope on spend context, totals, and source links", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const model = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    const store = fixture.stores.find((candidate) => candidate.id === storeId)!;
    const storeWorkIds = new Set(
      fixture.workOrders
        .filter((workOrder) => workOrder.organizationId === NORTHLINE_ORGANIZATION_ID && workOrder.storeId === storeId)
        .map((workOrder) => workOrder.id),
    );
    const sourceLineCount = fixture.costLines.filter(
      (line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(line.workOrderId),
    ).length;
    const storeInvoiceCount = new Set(
      fixture.invoiceAllocations
        .filter((allocation) => allocation.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(allocation.workOrderId))
        .map((allocation) => allocation.invoiceReferenceId),
    ).size;

    expect(model.page.scopeLabel).toContain(`Store ${store.storeNumber}`);
    expect(model.metrics.find((metric) => metric.id === "total")?.supportingText).toContain(`${sourceLineCount} entered source lines`);
    expect(model.metrics.find((metric) => metric.id === "invoices")?.value).toBe(String(storeInvoiceCount));

    const totalSource = model.metrics.find((metric) => metric.id === "total")?.link?.href;
    expect(totalSource && queryValue(totalSource, "store")).toBe(storeId);

    const categorySources = model.breakdowns.find((breakdown) => breakdown.id.includes("service-area"))?.segments ?? [];
    expect(categorySources.length).toBeGreaterThan(0);
    expect(categorySources.every((segment) => queryValue(segment.link.href, "store") === storeId)).toBe(true);

    const equipmentSources = model.breakdowns.find((breakdown) => breakdown.id.includes("equipment"))?.segments ?? [];
    expect(equipmentSources.length).toBeGreaterThan(0);
    expect(equipmentSources.every((segment) => queryValue(segment.link.href, "store") === storeId)).toBe(true);

    const companyModel = buildProgramModel(fixture, executiveSession(), "spend");
    const storeSources = companyModel.breakdowns.find((breakdown) => breakdown.id.includes("by-store"))?.segments ?? [];
    expect(storeSources.length).toBeGreaterThan(1);
    expect(storeSources.every((segment) => queryValue(segment.link.href, "store") === segment.id)).toBe(true);

    const monthlySources = model.trends.flatMap((trend) => trend.points);
    expect(monthlySources.length).toBeGreaterThan(0);
    expect(monthlySources.every((point) => queryValue(point.link.href, "store") === storeId)).toBe(true);
  });

  it("keeps spend interactive through service area, flexible groups, equipment, and component", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const asset = fixture.assets.find((candidate) => candidate.id === NORTHLINE_DEMO_HANDLES.storyAssetId)!;
    const component = fixture.components.find((candidate) => candidate.assetId === asset.id)!;

    const company = buildProgramModel(fixture, session, "spend");
    const refrigeration = company.breakdowns[0].segments.find((segment) => segment.id === "refrigeration")!;
    expect(new URL(refrigeration.link.href, "https://operations.test").pathname).toBe("/app/spend");
    expect(queryValue(refrigeration.link.href, "category")).toBe("refrigeration");

    const grouped = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
    });
    const equipment = grouped.breakdowns[0].segments.find((segment) => segment.id === asset.id)!;
    expect(queryValue(equipment.link.href, "store")).toBe(asset.storeId);
    expect(queryValue(equipment.link.href, "asset")).toBe(asset.id);

    const assetSpend = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
      asset: asset.id,
    });
    const componentSpendLink = assetSpend.breakdowns[0].segments.find((segment) => segment.id === component.id)?.link.href;
    expect(componentSpendLink && queryValue(componentSpendLink, "component")).toBe(component.id);

    const componentSpend = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
      asset: asset.id,
      component: component.id,
    });
    expect(componentSpend.page.title).toBe(component.name);
    expect(componentSpend.breakdowns[0].title).toMatch(/source type/i);
    expect(componentSpend.metrics.find((metric) => metric.id === "total")?.link.href).toContain(`component=${encodeURIComponent(component.id)}`);
  });

  it("enforces the advertised rolling-12-month period instead of including old cost", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const baseline = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    const baselineTotal = baseline.metrics.find((metric) => metric.id === "total")?.value;
    const source = fixture.costLines.find((line) => line.workOrderId === NORTHLINE_DEMO_HANDLES.storyWorkOrderId)!;
    fixture.costLines.push({
      ...source,
      id: "cost-contract-outside-rolling-window",
      amount: { amountMinor: 9_999_999, currency: "USD" },
      serviceDate: "2024-01-15",
      recordedAt: "2024-01-15T18:00:00.000Z",
    });

    const withOldCost = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    expect(withOldCost.page.periodLabel).toMatch(/^Rolling 12 months/);
    expect(withOldCost.metrics.find((metric) => metric.id === "total")?.value).toBe(baselineTotal);
  });

  it("makes every PM status tile an exact row filter and uses only closed windows in compliance", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const model = buildProgramModel(fixture, session, "pm");
    expect(model.metrics.map((metric) => metric.id)).toEqual(["due", "scheduled", "completed", "missed", "waived"]);
    expect(model.filters?.find((filter) => filter.id === "view")?.options.map((option) => option.value)).toEqual(["attention", "upcoming", "all"]);
    expect(model.table!.rows.every((row) => ["due", "missed"].includes(row.cells.find((cell) => cell.key === "status")?.value.toLocaleLowerCase("en-US") ?? ""))).toBe(true);
    for (const metric of model.metrics) {
      const filtered = buildProgramModel(fixture, session, "pm", { status: metric.id });
      expect(filtered.table!.rows).toHaveLength(Math.min(30, Number(metric.value)));
      expect(
        filtered.table!.rows.every(
          (row) => row.cells.find((cell) => cell.key === "status")?.value.toLocaleLowerCase("en-US") === metric.id,
        ),
      ).toBe(true);
      if (Number(metric.value) > 30) expect(filtered.pagination?.nextHref).toContain("page=2");
    }

    const closedOccurrences = fixture.pmOccurrences.filter(
      (occurrence) => occurrence.status !== "waived" && Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf),
    );
    const completed = closedOccurrences.filter(
      (occurrence) => occurrence.status === "completed" || Boolean(occurrence.completedAt),
    ).length;
    expect(model.breakdowns[0].description).toContain(`${completed} completed / ${closedOccurrences.length} eligible occurrences`);
    const effectiveness = model.breakdowns.find((row) => row.id === "pm-effectiveness-cohorts");
    expect(effectiveness?.segments.map((row) => row.id)).toEqual(["latest-compliant", "latest-noncompliant"]);
    expect(effectiveness?.description).toMatch(/per 100 equipment-months/i);
    expect(effectiveness?.description).toMatch(/directional only|descriptive association only/i);
    expect(model.trends.find((row) => row.id === "pm-reactive-cost")?.description).toMatch(/not proof/i);
    expect(effectiveness?.segments.every((row) => row.link.href.startsWith("/app/pm"))).toBe(true);
  });

  it("opens Equipment as a bounded attention queue with a searchable, paginated full register", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const attention = buildProgramModel(fixture, session, "equipment");
    const all = buildProgramModel(fixture, session, "equipment", { view: "all" });
    const serial = fixture.assets.find((asset) => asset.serialNumber)?.serialNumber;
    const searched = buildProgramModel(fixture, session, "equipment", { q: serial });
    const outOfService = buildProgramModel(fixture, session, "equipment", { view: "all", status: "out_of_service" });

    expect(attention.filters?.find((filter) => filter.id === "view")?.options.map((option) => option.value)).toEqual(["attention", "recent", "all"]);
    expect(attention.table?.rows.length).toBeLessThan(fixture.assets.length);
    expect(attention.table?.caption).toMatch(/needing attention/i);
    expect(attention.resultSummary).toContain(`${fixture.assets.length} total equipment`);
    expect(attention.metrics.find((metric) => metric.id === "out-of-service")).toMatchObject({ value: "1" });
    expect(all.table?.rows).toHaveLength(25);
    expect(all.pagination?.nextHref).toContain("page=2");
    expect(all.search?.placeholder).toMatch(/serial/i);
    expect(searched.table?.rows.some((row) => row.cells.some((cell) => cell.secondary?.includes(serial!)))).toBe(true);
    expect(outOfService.table?.rows).toHaveLength(1);
    expect(outOfService.table?.rows[0]?.cells.find((cell) => cell.key === "status")?.value).toBe("Out of service");
    expect(outOfService.table?.rows[0]?.href).toContain("section=service-history");
    expect(outOfService.appliedFilters).toEqual([expect.objectContaining({ id: "status", label: "Status: Out of service" })]);
    expect(outOfService.breakdowns.find((breakdown) => breakdown.id === "equipment-status")?.segments.find((segment) => segment.id === "out_of_service")?.link.href).toContain("status=out_of_service");
  });

  it("keeps interactive lists paginated while allowing a scoped complete export projection", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const interactive = buildListModel(fixture, session, "work-orders");
    const exported = buildListModel(fixture, session, "work-orders", { export: "all" });
    const scopedCount = fixture.workOrders.filter((workOrder) => workOrder.organizationId === session.organizationId).length;

    expect(interactive.table.rows).toHaveLength(25);
    expect(exported.table.rows).toHaveLength(scopedCount);
    expect(exported.table.rows.every((row) => row.href.startsWith("/app/work-orders/"))).toBe(true);
  });

  it("keeps Store 104's repair economics separate from visit history and opens exact planning-year assets", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const store104 = buildProgramModel(fixture, session, "lifecycle", {
      asset: NORTHLINE_DEMO_HANDLES.storyAssetId,
    });
    const evidence = store104.table!.rows[0]?.cells.find((cell) => cell.key === "evidence")?.value;
    const proposal = store104.table!.rows[0]?.cells.find((cell) => cell.key === "work");
    const storyAsset = fixture.assets.find((asset) => asset.id === NORTHLINE_DEMO_HANDLES.storyAssetId)!;
    expect(store104.page.scopeLabel).toContain(storyAsset.name);
    expect(store104.metrics.find((metric) => metric.id === "scope")).toMatchObject({ value: "1" });
    expect(store104.metrics.map((metric) => metric.label)).not.toContain("Comparison inputs complete");
    expect(store104.metrics.every((metric) => metric.link.href.includes(`asset=${encodeURIComponent(storyAsset.id)}`))).toBe(true);
    expect(store104.priorityActions).toHaveLength(0);
    expect(evidence).toMatch(/small repair; not flagged/i);
    expect(evidence).not.toMatch(/return visit|recorded work cost|percent of replacement/i);
    expect(proposal?.value).toContain("$1,250");
    expect(proposal?.secondary).toMatch(/1 year.*replacement estimate/i);
    const benchmarkAsset = fixture.assets.find(
      (asset) =>
        Boolean(asset.replacementProfileId) &&
        !fixture.assetReplacementOverrides.some(
          (override) => override.assetId === asset.id && override.status === "active",
        ),
    )!;
    const benchmarkProfile = fixture.replacementProfiles.find(
      (profile) => profile.id === benchmarkAsset.replacementProfileId,
    )!;
    const benchmarkLifecycle = buildProgramModel(fixture, session, "lifecycle", {
      asset: benchmarkAsset.id,
    });
    expect(
      benchmarkLifecycle.table!.rows[0]?.cells.find((cell) => cell.key === "replacement")?.secondary,
    ).toContain(`${benchmarkProfile.annualEscalationBps / 100}% annually`);

    const replacementYear = String(new Date(storyAsset.installedAt!).getUTCFullYear() + storyAsset.expectedLifeYears!);
    const filtered = buildProgramModel(fixture, session, "lifecycle", { replacementYear });
    expect(filtered.table!.rows.some((row) => row.id === storyAsset.id)).toBe(true);
    expect(
      filtered.table!.rows.every((row) => {
        const asset = fixture.assets.find((candidate) => candidate.id === row.id)!;
        return String(new Date(asset.installedAt!).getUTCFullYear() + asset.expectedLifeYears!) === replacementYear;
      }),
    ).toBe(true);
  });

  it("opens lifecycle as a live decision queue while keeping the capital plan and full register one filter away", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const defaultView = buildProgramModel(fixture, session, "lifecycle");
    const capitalView = buildProgramModel(fixture, session, "lifecycle", { view: "capital" });
    const allEquipment = buildProgramModel(fixture, session, "lifecycle", { view: "all" });
    const planned = fixture.lifecycleRecommendations.filter(
      (recommendation) => recommendation.plannedForYear && ["replace", "defer"].includes(recommendation.userDecision),
    );

    expect(defaultView.table!.rows).toHaveLength(Number(defaultView.metrics.find((metric) => metric.id === "review")?.value));
    expect(defaultView.table!.rows.length).toBeLessThan(allEquipment.table!.rows.length);
    expect(allEquipment.table!.rows).toHaveLength(fixture.assets.length);
    expect(capitalView.table!.rows).toHaveLength(planned.length);
    expect(planned.length).toBeGreaterThanOrEqual(5);
    expect(planned.length).toBeLessThanOrEqual(10);
    expect(new Set(planned.map((recommendation) => recommendation.plannedForYear)).size).toBeGreaterThanOrEqual(2);
    expect(defaultView.filters?.[0]?.options.map((option) => option.value)).toEqual(["review", "capital", "all"]);
  });

  it("lands invoice and action-center drill-downs on the promised source rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const invoiceReports = buildListModel(fixture, session, "reports", { q: "invoice" });
    expect(invoiceReports.state.kind).toBe("ready");
    expect(invoiceReports.table.rows.length).toBeGreaterThan(0);

    const followUp = fixture.followUps[0];
    followUp.status = "open";
    const exceptionOnly = buildListModel(fixture, session, "action-center", { type: "exception" });
    expect(exceptionOnly.table.rows.some((row) => row.id === followUp.id)).toBe(false);
  });

  it("keeps unmatched invoice references visible without pretending to be accounts payable", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const source = fixture.invoiceReferences[0];
    fixture.invoiceReferences.push({
      ...source,
      id: "invoice-presenter-unmatched",
      invoiceNumber: "INV-REVIEW-401",
      operatorWorkOrderNumber: "CPS-2026-UNKNOWN",
      matchStatus: "unmatched",
      grossAmount: { amountMinor: 148_500, currency: "USD" },
    });

    const list = buildListModel(fixture, session, "invoices", { q: "INV-REVIEW-401" });
    expect(list.table.rows).toHaveLength(1);
    expect(list.table.rows[0].href).toBe("/app/invoices/invoice-presenter-unmatched");
    expect(list.table.rows[0].cells.find((cell) => cell.key === "work")?.secondary).toMatch(/not linked/i);

    const detail = buildDetailModel(fixture, session, "invoice", "invoice-presenter-unmatched");
    expect(detail.state.kind).toBe("ready");
    expect(detail.page.description).toMatch(/does not approve or pay/i);
    expect(detail.facts.find((fact) => fact.label === "Unmatched balance")?.value).not.toBe("$0");
  });

  it("opens a complete equipment record and carries it into work-order creation", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const assetId = NORTHLINE_DEMO_HANDLES.storyAssetId;
    const asset = fixture.assets.find((candidate) => candidate.id === assetId)!;
    const detail = buildDetailModel(fixture, session, "equipment", assetId);

    expect(detail.state.kind).toBe("ready");
    expect(detail.page.title).toBe(asset.name);
    expect(detail.facts.map((fact) => fact.label)).toEqual(
      expect.arrayContaining(["Asset tag", "Manufacturer / model", "Serial number", "Warranty", "Recorded work cost", "Replacement outlook"]),
    );
    expect(detail.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["lifecycle-evidence", "components", "service-history", "preventive-maintenance"]),
    );
    expect(detail.sections.find((section) => section.id === "components")?.table?.rows.length).toBeGreaterThan(0);
    expect(detail.sections.find((section) => section.id === "service-history")?.table?.rows.length).toBeGreaterThan(0);

    const create = buildCreateWorkOrderModel(fixture, session, { store: asset.storeId, asset: asset.id });
    expect(create.defaults).toEqual({ storeId: asset.storeId, assetId: asset.id, categoryKey: asset.categoryKey });
    expect(create.lifecycleAsOf).toBe(fixture.asOf);
    expect(create.assetLifecycleInputs.find((input) => input.id === asset.id)).toMatchObject({
      installedAt: asset.installedAt,
      expectedLifeYears: asset.expectedLifeYears,
      replacementEstimate: asset.replacementEstimate,
    });
  });

  it("promotes a current large repair comparison instead of accumulated historical spend", () => {
    const fixture = buildNorthlinePresentationFixture();
    const dashboard = buildDashboardModel(fixture, executiveSession());

    expect(dashboard.spotlight?.title).toContain("CPS-2026-0115");
    expect(dashboard.spotlight?.eyebrow).toBe("Repair or replace");
    expect(dashboard.spotlight?.description).toMatch(/proposed repair.*would need.*continued service/i);
    expect(dashboard.spotlight?.description).toMatch(/entered vendor estimate/i);
    expect(dashboard.spotlight?.description).toMatch(/age, warranty, prior repairs, visits, and preventive maintenance/i);
    expect(dashboard.spotlight?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Proposed repair", value: "$18,000" }),
      expect.objectContaining({ label: "Required service runway", value: "6.6 years" }),
      expect.objectContaining({ label: "Entered service estimate", value: "5 years" }),
      expect.objectContaining({ label: "Estimated replacement", value: "$32,853" }),
    ]));
    expect(dashboard.spotlight?.link.label).toBe("Open repair-or-replace details");
    expect(JSON.stringify(dashboard.spotlight)).not.toMatch(/recorded work cost|break-even|economic screening|before issuing|expected to keep/i);
  });

  it("exposes working Store 104 QR, trusted-device, and vendor entry points", () => {
    const fixture = buildNorthlinePresentationFixture();
    const detail = buildDetailModel(fixture, executiveSession(), "store", NORTHLINE_DEMO_HANDLES.storyStoreId);
    const section = detail.sections.find((candidate) => candidate.id === "demo-entry-points");

    expect(section?.facts).toHaveLength(3);
    expect(section?.facts?.map((fact) => fact.link?.href)).toEqual([
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`,
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104}`,
      `/public/service/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104}`,
    ]);
    expect(section?.facts?.every((fact) => Boolean(fact.link?.label))).toBe(true);
  });

  it("reconciles the store PM denominator to its service-area rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const detail = buildDetailModel(fixture, executiveSession(), "store", NORTHLINE_DEMO_HANDLES.storyStoreId);
    const compliance = detail.facts.find((fact) => fact.label === "PM compliance")!;
    const match = compliance.helperText?.match(/(\d+) completed \/ (\d+) eligible occurrences/);
    expect(match).toBeTruthy();
    const serviceAreaRows = detail.sections.find((section) => section.id === "service-areas")?.table?.rows ?? [];
    const categoryTotals = serviceAreaRows.reduce((totals, row) => {
      const value = row.cells.find((cell) => cell.key === "pm")?.value ?? "";
      const categoryMatch = value.match(/(\d+)\/(\d+) eligible completed/);
      return categoryMatch ? [totals[0] + Number(categoryMatch[1]), totals[1] + Number(categoryMatch[2])] : totals;
    }, [0, 0]);
    expect(categoryTotals).toEqual([Number(match![1]), Number(match![2])]);
  });

  it("compares multiple vendor bids on one canonical work order without creating spend", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = { ...executiveSession(), role: "facilities" as const };
    const workOrderId = "wo-northline-105-price-check";
    const model = buildEstimateComparisonModel(fixture, session, workOrderId);

    expect(model).toMatchObject({
      available: true,
      permitted: true,
      workOrderNumber: "CPS-2026-0117",
      activeRequestCount: 2,
      proposalCount: 2,
    });
    expect(model.requests.map((request) => [request.vendorName, request.latestProposal?.amountLabel])).toEqual([
      ["ClearFlow HVAC, Plumbing & Kitchen Repair", "$1,780.00"],
      ["ColdLine Refrigeration & HVAC", "$2,450.00"],
    ]);
    expect(model.requests.every((request) => request.kindLabel === "Service bid - pricing only")).toBe(true);
    expect(model.requests.every((request) => request.canSelect)).toBe(true);
    expect(fixture.workOrders.filter((workOrder) => workOrder.id === workOrderId)).toHaveLength(1);
    expect(fixture.costLines.filter((line) => line.workOrderId === workOrderId)).toHaveLength(0);
    expect(fixture.invoiceAllocations.filter((allocation) => allocation.workOrderId === workOrderId)).toHaveLength(0);
  });

  it("presents elapsed vendor estimates as expired while preserving withdrawal cleanup", () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.asOf = "2026-10-01T00:00:00.000Z";
    const session = { ...executiveSession(), role: "facilities" as const };
    const model = buildEstimateComparisonModel(fixture, session, "wo-northline-105-price-check");

    expect(model.activeRequestCount).toBe(0);
    expect(model.requests).toHaveLength(2);
    expect(model.requests.every((request) => (
      request.status === "expired"
      && request.statusLabel === "Expired"
      && request.canSelect === false
      && request.canWithdraw === true
    ))).toBe(true);
  });
});
