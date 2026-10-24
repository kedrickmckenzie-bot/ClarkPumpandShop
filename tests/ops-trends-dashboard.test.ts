import { describe, expect, it } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildTrendMonth, buildTrendsDashboard, buildTrendWhy } from "@/app/app/_data/trends-dashboard";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { measure, spendChange, trendData, trendMonths, yearBefore } from "@/lib/ops/trend-measures";

const session = (role: OperatorSession["role"] = "facilities", storeIds?: string[]): OperatorSession => ({ organizationId: NORTHLINE_ORGANIZATION_ID, userId: "u", displayName: "Manager", email: "m@example.test", organizationName: "Clark Pump and Shop", scopeLabel: "All stores", role, ...(storeIds ? { storeIds } : {}) });

describe("Trends dashboard", () => {
  const fixture = buildNorthlinePresentationFixture(undefined, { operatingHistory: true });
  const today = fixture.asOf.slice(0, 10);
  const scope = { organizationId: NORTHLINE_ORGANIZATION_ID };
  const data = trendData(buildReportContext(fixture, scope, {}, fixture.asOf, today), fixture, scope, {});

  it("splits the spend change into parts that add up exactly", () => {
    const change = spendChange(data, today);
    expect(change.parts.reduce((sum, part) => sum + part.amount, 0)).toBe(change.after - change.before);
    expect(change.bigJobs.after.every(row => row.amount >= change.bigThreshold)).toBe(true);
  });
  it("compares each month with the same days a year earlier and opens exactly the records counted", () => {
    const months = trendMonths(today);
    expect(months).toHaveLength(24);
    expect(months.at(-1)!.range.to).toBe(today);
    expect(yearBefore({ from: "2026-10-01", to: "2026-10-24" })).toEqual({ from: "2025-10-01", to: "2025-10-24" });
    const month = months.at(-4)!;
    const spend = measure(data, "spend", month.range);
    const page = buildTrendMonth(fixture, session(), { measure: "spend", month: month.key });
    expect(page.count).toBe(spend.jobIds.length);
    const jobs = measure(data, "jobs", month.range);
    expect(buildTrendMonth(fixture, session(), { measure: "jobs", month: month.key }).count).toBe(jobs.value);
  });
  it("shows six measures, with links that keep the store filter", () => {
    const store = fixture.stores[2].id;
    const model = buildTrendsDashboard(fixture, session(), { store });
    expect(model.tiles.map(tile => tile.id)).toEqual(["spend", "jobs", "cost_per_job", "days_to_fix", "came_back", "pm_done"]);
    expect(model.tiles.every(tile => tile.spark.length === 24)).toBe(true);
    expect(model.chart.points.every(point => new URL(point.href, "https://x.test").searchParams.get("store") === store)).toBe(true);
    expect(buildTrendWhy(fixture, session(), { store }).backHref).toContain(`store=${store}`);
  });
  it("keeps a store manager to their own store", () => {
    const store = fixture.stores[0].id;
    const model = buildTrendMonth(fixture, session("store_manager", [store]), { measure: "spend", month: today.slice(0, 7) });
    expect(model.rows.every(row => row.store === `Store ${fixture.stores[0].storeNumber}`)).toBe(true);
  });
});
