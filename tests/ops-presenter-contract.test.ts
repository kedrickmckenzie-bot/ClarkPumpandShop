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
    const upcoming = buildListModel(fixture, session, "visits", { status: "upcoming" });
    const activeCount = fixture.visits.filter((visit) => visit.status === "active").length;
    const upcomingCount = (fixture.serviceAppointments ?? []).filter(
      (appointment) => appointment.status === "confirmed" && Date.parse(appointment.startsAt) >= Date.parse(fixture.asOf),
    ).length;

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
    expect(upcoming.page.title).toBe("Upcoming visits");
    expect(upcoming.table.rows).toHaveLength(upcomingCount);
    expect(upcoming.table.rows.every((row) => row.href.includes("/app/work-orders/") && row.href.includes("view=service"))).toBe(true);
    expect(upcoming.table.rows.every((row) => row.cells.find((cell) => cell.key === "outcome")?.value === "Upcoming")).toBe(true);
    expect(upcoming.metrics?.find((metric) => metric.id === "upcoming-visits")?.value).toBe(String(upcomingCount));
    expect(upcoming.filters?.[0]?.options.map((option) => option.label)).toEqual(
      expect.arrayContaining([`History (${fixture.visits.length})`, `Upcoming (${upcomingCount})`]),
    );
  });

  it("separates work approved for later from scheduled appointments", () => {
    const fixture = buildNorthlinePresentationFixture();
    const facilitiesSession: OperatorSession = {
      ...executiveSession(),
      userId: "user-northline-facilities",
      membershipId: "membership-northline-facilities",
      role: "facilities",
    };
    const model = buildListModel(fixture, facilitiesSession, "work-orders", { visitPlan: "ready" });
    const activeHolds = (fixture.workOrderVisitHolds ?? []).filter((hold) => hold.status === "active");
    const heldStoreCount = new Set(
      activeHolds.map((hold) => fixture.workOrders.find((workOrder) => workOrder.id === hold.workOrderId)?.storeId).filter(Boolean),
    ).size;

    expect(model.page.title).toBe("Approved for next suitable visit");
    expect(model.page.secondaryAction?.label).toBe("Send approved jobs together");
    expect(model.table.columns.map((column) => column.key)).toEqual(["work", "store", "assignment", "next"]);
    expect(model.table.rows).toHaveLength(activeHolds.length);
    expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "assignment")?.value === "Waiting for a suitable visit")).toBe(true);
    expect(model.table.rows.every((row) => row.cells.find((cell) => cell.key === "store")?.value.startsWith("Store "))).toBe(true);
    expect(model.table.rows.every((row) => row.management?.kind === "approved_later" && row.management.canManage)).toBe(true);
    expect(model.table.rows[0]?.management).toMatchObject({
      posture: expect.stringMatching(/complete_using_professional_judgment|look_and_report/),
      priority: expect.stringMatching(/emergency|urgent|routine|planned/),
      storeTimeZone: expect.any(String),
      deadlineInputValue: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    });
    expect(model.resultSummary).toBe(`${activeHolds.length} approved jobs across ${heldStoreCount} stores`);
    expect(model.filters?.[0]?.label).toBe("Work timing");
    expect(model.filters?.[0]?.options.some((option) => option.label === `Approved for next suitable visit (${activeHolds.length})`)).toBe(true);
  });

  it("gives the store directory source-linked network measures before the location register", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildListModel(fixture, executiveSession(), "stores");
    const openWork = fixture.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status));
    const activeVisits = fixture.visits.filter((visit) => visit.status === "active");
    const workIds = new Set(fixture.workOrders.map((work) => work.id));
    const recordedCost = fixture.costLines
      .filter((line) => workIds.has(line.workOrderId))
      .reduce((sum, line) => sum + line.amount.amountMinor, 0);

    expect(model.metrics?.find((metric) => metric.id === "stores-in-scope")?.value).toBe("15");
    expect(model.metrics?.find((metric) => metric.id === "store-open-work")).toMatchObject({
      value: String(openWork.length),
      link: { href: "/app/work-orders?status=open" },
    });
    expect(model.metrics?.find((metric) => metric.id === "store-onsite-now")).toMatchObject({
      value: String(activeVisits.length),
      link: { href: "/app/visits?status=active" },
    });
    expect(model.metrics?.find((metric) => metric.id === "store-recorded-cost")?.value).toBe(
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(recordedCost / 100),
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
    const asOfDate = new Date(fixture.asOf);
    const periodStart = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
    const storeWorkIds = new Set(
      fixture.workOrders
        .filter((workOrder) => workOrder.organizationId === NORTHLINE_ORGANIZATION_ID && workOrder.storeId === storeId)
        .map((workOrder) => workOrder.id),
    );
    const sourceLineCount = fixture.costLines.filter(
      (line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(line.workOrderId) && line.serviceDate >= periodStart,
    ).length;
    const periodInvoiceIds = new Set(
      fixture.invoiceReferences
        .filter((invoice) => invoice.organizationId === NORTHLINE_ORGANIZATION_ID && invoice.invoiceDate >= periodStart)
        .map((invoice) => invoice.id),
    );
    const storeInvoiceCount = new Set(
      fixture.invoiceAllocations
        .filter((allocation) => allocation.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(allocation.workOrderId) && periodInvoiceIds.has(allocation.invoiceReferenceId))
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
    expect(effectiveness?.description).toMatch(/not enough data|does not prove/i);
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
    expect(attention.metrics.find((metric) => metric.id === "out-of-service")).toMatchObject({ value: "2" });
    expect(all.table?.rows).toHaveLength(25);
    expect(all.pagination?.nextHref).toContain("page=2");
    expect(all.search?.placeholder).toMatch(/serial/i);
    expect(searched.table?.rows.some((row) => row.cells.some((cell) => cell.secondary?.includes(serial!)))).toBe(true);
    expect(outOfService.table?.rows).toHaveLength(2);
    expect(outOfService.table?.rows.every((row) => row.cells.find((cell) => cell.key === "status")?.value === "Out of service")).toBe(true);
    expect(outOfService.table?.rows.every((row) => row.href?.includes("section=service-history"))).toBe(true);
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
    expect(defaultView.table!.rows).toHaveLength(3);
    expect(defaultView.table!.rows.map((row) => row.id)).toEqual(expect.arrayContaining([
      "asset-102-rtu-1",
      "asset-110-beer-cave",
      "asset-115-beer-cave",
    ]));
    const approvedReplacement = defaultView.table!.rows.find((row) => row.id === "asset-115-beer-cave")!;
    expect(approvedReplacement.cells.find((cell) => cell.key === "evidence")?.value).toBe("Replacement approved");
    expect(approvedReplacement.cells.find((cell) => cell.key === "status")?.value).toBe("Replacement approved");
    expect(defaultView.table!.rows.length).toBeLessThan(fixture.assets.length);
    expect(allEquipment.table!.rows).toHaveLength(25);
    expect(allEquipment.pagination).toMatchObject({ currentPage: 1, totalPages: Math.ceil(fixture.assets.length / 25) });
    expect(allEquipment.pagination?.summary).toBe(`Showing 1–25 of ${fixture.assets.length}`);
    expect(capitalView.table!.rows).toHaveLength(planned.length);
    expect(capitalView.table!.columns.find((column) => column.key === "evidence")?.label).toBe("Why it is planned");
    expect(capitalView.table!.columns.find((column) => column.key === "status")?.label).toBe("Funding plan");
    expect(capitalView.table!.rows.every((row) => row.cells.find((cell) => cell.key === "evidence")?.value === "Management-planned replacement")).toBe(true);
    expect(capitalView.table!.rows.some((row) => row.cells.find((cell) => cell.key === "work")?.value === "No active repair decision")).toBe(true);
    expect(JSON.stringify(capitalView.table!.rows)).not.toContain("Current comparison inputs needed");
    expect(planned.length).toBeGreaterThanOrEqual(5);
    expect(planned.length).toBeLessThanOrEqual(10);
    expect(new Set(planned.map((recommendation) => recommendation.plannedForYear)).size).toBeGreaterThanOrEqual(2);
    expect(defaultView.filters?.[0]?.options.map((option) => option.value)).toEqual(["review", "capital", "all"]);
    expect(defaultView.page.title).toBe("Current lifecycle cases");
    expect(defaultView.metrics.map((metric) => metric.label)).toEqual([
      "Current lifecycle cases",
      "Repair prices entered",
      "Replacement estimates ready",
      "Portfolio planning",
    ]);
    expect(defaultView.metrics.map((metric) => metric.value).some((value) => value.startsWith("$"))).toBe(false);
    expect(defaultView.trends).toHaveLength(0);
    expect(capitalView.page.title).toBe("Planned replacements");
    expect(capitalView.metrics.find((metric) => metric.id === "planned-value")?.supportingText).toMatch(/not an approved budget/i);
    expect(capitalView.trends[0]).toMatchObject({ title: "Planned replacements by funding year" });
    expect(capitalView.trends[0]?.points.every((point) => point.link.href.includes("plan=management") && point.link.href.includes("view=capital"))).toBe(true);
    expect(allEquipment.page.title).toBe("Replacement planning register");
    expect(allEquipment.metrics.map((metric) => metric.label)).not.toContain("Estimated full-scope replacement value");
    expect(allEquipment.metrics.map((metric) => metric.value).some((value) => value.startsWith("$"))).toBe(false);
    expect(allEquipment.page.description).toMatch(/does not total.*entire portfolio/i);
    expect(allEquipment.trends).toHaveLength(0);
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

  it("keeps component drill-down, cost, replacement history, and multi-work visits connected", () => {
    const fixture = buildNorthlinePresentationFixture();
    const detail = buildDetailModel(fixture, executiveSession(), "equipment", "asset-104-beer-cave");
    const componentSection = detail.sections.find((section) => section.id === "components")!;
    if (!componentSection.table) throw new Error("Expected the component table");
    const compressor = componentSection.table.rows.find((row) => row.id === "component-104-compressor")!;
    const serviceHistory = detail.sections.find((section) => section.id === "service-history")!;

    expect(compressor.href).toBe("/app/equipment/asset-104-beer-cave/components/component-104-compressor");
    expect(compressor.cells.find((cell) => cell.key === "cost")?.value).toBe("$24,110");
    expect(compressor.cells.find((cell) => cell.key === "work")?.secondary).toBe("1 replacement record");
    expect(serviceHistory.description).toBe("6 observed visits connect to this equipment through its work orders.");

    const visitDetail = buildDetailModel(fixture, executiveSession(), "visit", "visit-northline-104-2");
    expect(visitDetail.facts.find((fact) => fact.label === "Operator work orders")?.value).toBe("CPS-2026-0104 · CPS-2026-0035");
    const visitWork = visitDetail.sections.find((section) => section.id === "work-orders")!;
    expect(visitWork.table?.rows).toHaveLength(2);
    expect(visitWork.table?.rows.find((row) => row.id.includes("wo-northline-104"))?.cells.find((cell) => cell.key === "outcome")?.secondary).toMatch(/compressor replaced/i);
    expect(visitDetail.sections.find((section) => section.id === "missing-work-order")).toBeUndefined();
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

  it("keeps store-device entry points in the accountability edition without cluttering the full manager record", () => {
    const fixture = buildNorthlinePresentationFixture();
    const full = buildDetailModel(fixture, executiveSession(), "store", NORTHLINE_DEMO_HANDLES.storyStoreId);
    const accountability = buildDetailModel(fixture, { ...executiveSession(), demoEdition: "accountability" }, "store", NORTHLINE_DEMO_HANDLES.storyStoreId);
    const section = accountability.sections.find((candidate) => candidate.id === "demo-entry-points");

    expect(full.sections.some((candidate) => candidate.id === "demo-entry-points")).toBe(false);
    expect(section?.facts).toHaveLength(2);
    expect(section?.facts?.map((fact) => fact.link?.href)).toEqual([
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`,
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104}`,
    ]);
    expect(section?.facts?.every((fact) => Boolean(fact.link?.label))).toBe(true);
  });

  it("turns the full store record into six manager drill-downs with decision-ready PM, equipment, and history", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const detail = buildDetailModel(fixture, executiveSession(), "store", storeId);
    const pm = detail.sections.find((section) => section.id === "preventive-maintenance-plans");
    const equipment = detail.sections.find((section) => section.id === "equipment");
    const history = detail.sections.find((section) => section.id === "work-history");
    const storeAssets = fixture.assets.filter((asset) => asset.storeId === storeId);
    const storePlans = fixture.pmPlans.filter((plan) => plan.storeId === storeId && plan.active);

    expect(detail.statusLabel).toBe("Limited operations");
    expect(detail.sections.map((section) => section.title)).toEqual([
      "Upcoming visits",
      "Approved for next suitable visit",
      "Preventive maintenance",
      "Service areas and spending",
      "Equipment and lifecycle",
      "Work and visit history",
    ]);
    expect(pm?.facts?.map((fact) => fact.label)).toEqual(["Due now", "Missed", "Next due", "Last completed"]);
    expect(pm?.table?.rows).toHaveLength(storePlans.length);
    expect(pm?.table?.columns.map((column) => column.key)).toEqual(["plan", "timing", "status", "evidence"]);
    expect(equipment?.table?.rows).toHaveLength(storeAssets.length);
    expect(equipment?.table?.rows.every((row) => row.href === `/app/equipment/${row.id}`)).toBe(true);
    expect(equipment?.table?.columns.map((column) => column.key)).toEqual(["equipment", "area", "age", "cost", "open", "status"]);
    expect(history?.facts?.map((fact) => fact.label)).toEqual(["Work orders", "Open work", "Recorded visits", "Visits without a work order"]);
    expect(history?.table?.rows.length).toBeGreaterThan(0);
    expect(history?.timeline?.length).toBeGreaterThan(0);
    expect(history?.tableHeading).toBe("Current and recent work orders");
    expect(history?.timelineHeading).toBe("Latest observed visits");
  });

  it("surfaces confirmed appointments directly on the individual store record", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const detail = buildDetailModel(fixture, executiveSession(), "store", storeId);
    const upcomingFact = detail.facts.find((fact) => fact.label === "Upcoming visits");
    const upcomingSection = detail.sections.find((section) => section.id === "upcoming-visits");

    expect(upcomingFact).toMatchObject({
      value: "2",
      link: { href: `/app/visits?store=${storeId}&status=upcoming`, label: "Open upcoming visits" },
    });
    expect(upcomingSection?.title).toBe("Upcoming visits");
    expect(upcomingSection?.table?.rows).toHaveLength(2);
    expect(upcomingSection?.table?.rows.some((row) => row.cells.find((cell) => cell.key === "work")?.value === "CPS-2026-0216")).toBe(true);
    expect(upcomingSection?.table?.rows.every((row) => row.cells.find((cell) => cell.key === "observed")?.secondary === "Confirmed appointment · store-local time")).toBe(true);
    expect(upcomingSection?.action?.href).toBe(`/app/visits?store=${storeId}&status=upcoming`);
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
    expect(model.requests.every((request) => request.kindLabel === "Service quote - pricing only")).toBe(true);
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
