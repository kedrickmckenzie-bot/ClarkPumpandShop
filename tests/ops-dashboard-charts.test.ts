import { expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, buildSyntheticScaleFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { loadDashboardChartPages, presentDashboardCharts } from "@/app/app/_data/dashboard-charts";
import { buildStoreCostRanking } from "@/app/app/_data/store-cost-presenter";
import { rollingYearStart } from "@/lib/ops/dashboard-query";
import type { OperatorSession } from "@/components/ops/data-contract";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { queryDashboardBreakdown } from "@/lib/ops/dashboard-sql";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("returns all 65 persisted zero-work stores through bounded SQL pages", async () => {
  const fixture = buildSyntheticScaleFixture(65);
  const db = new DatabaseSync(":memory:");
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read-only check"); } };
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const scope = { organizationId: fixture.organizations[0].id }, window = { asOf: fixture.asOf, costFrom: "2025-09-01", costTo: "2026-08-25", currency: "USD" };
    const ids: string[] = [];
    for (const offset of [0, 25, 50]) {
      const page = await queryDashboardBreakdown(driver, scope, window, { kind: "cost_store", offset, limit: 25 });
      expect(page.totalCount).toBe(65); expect(page.totalValue).toBe(0);
      expect(page.items.length).toBeLessThanOrEqual(25); expect(page.items.every(row => row.value === 0)).toBe(true);
      ids.push(...page.items.map(row => row.id));
    }
    expect(new Set(ids).size).toBe(65);
    expect((await queryDashboardBreakdown(driver, scope, window, { kind: "cost_store", search: "2001" })).items.map(row => row.id)).toEqual(["store-scale-2001"]);
  } finally { db.close(); }
});

it("keeps full chart totals, explicit unclassified work and zero-cost stores outside a five-row preview", async () => {
  const fixture = buildNorthlinePresentationFixture();
  const base = fixture.stores[0];
  fixture.stores.push({ ...base, id: "store-new-no-work", storeNumber: "999", name: "New store" });
  const repository = createOpsFixtureRepository(fixture), scope = { organizationId: fixture.organizations[0].id };
  const window = { asOf: fixture.asOf, costFrom: rollingYearStart(fixture.asOf), costTo: fixture.asOf.slice(0, 10), currency: "USD" };
  const read = vi.spyOn(repository, "listDashboardBreakdown");
  const pages = await loadDashboardChartPages(repository, scope, window);
  expect(read.mock.calls).toHaveLength(6);
  expect(read.mock.calls.every(call => call[2].limit! <= 25)).toBe(true);
  const activity = await repository.getDashboardActivity(scope, window);
  const charts = presentDashboardCharts(pages, activity, window);
  expect(charts.storeBreakdown.segments).toHaveLength(5);
  expect(charts.storeBreakdown.coverageLabel).toBe("Showing 5 of 16 stores. Total includes all.");
  expect(charts.storeBreakdown.totalValue).toBe(activity.recordedCostMinor);
  for (const row of charts.storeBreakdown.segments) expect(row.shareLabel).toBe(`${Math.round(row.value / activity.recordedCostMinor * 100)}% of recorded cost`);
  expect((await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", search: "New store" })).items).toEqual([{ id: "store-new-no-work", label: "Store 999 · New store", value: 0 }]);
  const tiny = { ...pages, cost_category: { ...pages.cost_category, items: pages.cost_category.items.filter(row => row.id !== "unclassified").slice(0, 1) } };
  expect(presentDashboardCharts(tiny, { ...activity, unclassifiedWork: 1, unclassifiedCostMinor: 0 }, window).categoryBreakdown.segments.find(row => row.id === "unclassified")?.value).toBe(0);
  expect(charts.trend.points).toHaveLength(12);
  expect(charts.trend.points.reduce((sum, row) => sum + row.value, 0)).toBe(activity.recordedCostMinor);
});

it("pages a 65-store cost ranking without changing scope, cost window or exact source links", async () => {
  const fixture = buildSyntheticScaleFixture(65);
  const repository = createOpsFixtureRepository(fixture);
  const session = { role: "facilities", organizationId: fixture.organizations[0].id, scopeLabel: "65 test stores" } as OperatorSession;
  const query = { sort: "cost", costFrom: "2025-09-01", costTo: "2026-08-25", currency: "USD" };
  const ids: string[] = [];
  let page = await buildStoreCostRanking(repository, session, query, fixture.asOf);
  expect(page.metrics?.[0].supportingText).toContain("All 65 stores");
  for (;;) {
    expect(page.table.rows.length).toBeLessThanOrEqual(25);
    ids.push(...page.table.rows.map(row => row.id));
    for (const row of page.table.rows) expect(Object.fromEntries(new URL(row.href, "https://example.test").searchParams)).toMatchObject({ costFrom: query.costFrom, costTo: query.costTo, currency: "USD", hasCost: "true", store: row.id });
    if (!page.pagination?.nextHref) break;
    page = await buildStoreCostRanking(repository, session, Object.fromEntries(new URL(page.pagination.nextHref, "https://example.test").searchParams), fixture.asOf);
  }
  expect(ids).toHaveLength(65);
  expect(new Set(ids).size).toBe(65);
  const selected = await buildStoreCostRanking(repository, session, { ...query, q: "2001" }, fixture.asOf);
  expect(selected.table.rows.map(row => row.id)).toEqual(["store-scale-2001"]);
  expect(selected.metrics).toBeUndefined();
  expect((await buildStoreCostRanking(repository, { ...session, storeIds: [] }, query, fixture.asOf)).table.rows).toEqual([]);
  expect((await buildStoreCostRanking(repository, session, { ...query, costTo: "2099-01-01" }, fixture.asOf)).state.kind).toBe("error");
});
