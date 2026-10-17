import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID as org } from "@/lib/ops/fixtures";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { vendorJobFactsFromFixture } from "@/lib/ops/vendor-scorecard";
import { factSeries, monthJobs, spendSeries, trendMonths, withVerdict, type VendorTrendPoint } from "@/lib/ops/vendor-trends";

const months = trendMonths("2026-10-17");
const pts = (values: Array<number | undefined>, partialLast = false): VendorTrendPoint[] => values.map((value, i) => ({ month: months[i]!, value, counted: 10, tooFew: false, partial: partialLast && i === values.length - 1 }));

describe("vendor trend verdicts", () => {
  it("lists twelve months ending this month", () => {
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-11");
    expect(months.at(-1)).toBe("2026-10");
  });
  it("calls one bad month a blip, three in a row a trend, and flat lines steady", () => {
    const steady = Array(12).fill(0.9);
    expect(withVerdict("onTime", pts(steady)).verdict.short).toBe("Steady");
    const blip = [...steady]; blip[7] = 0.6;
    expect(withVerdict("onTime", pts(blip)).verdict.text).toMatch(/One bad month \(Jun\)\. Back to normal since/);
    const slide = [...steady]; slide[9] = 0.7; slide[10] = 0.65; slide[11] = 0.6;
    expect(withVerdict("onTime", pts(slide)).verdict).toMatchObject({ tone: "bad", short: "Getting worse" });
    const calls = Array(12).fill(0.1); calls[9] = 0.3; calls[10] = 0.35; calls[11] = 0.3;
    expect(withVerdict("callbacks", pts(calls)).verdict.short).toBe("Getting worse");
    const latest = [...steady]; latest[11] = 0.5;
    expect(withVerdict("onTime", pts(latest)).verdict.text).toMatch(/Too soon to call it a trend/);
    const spend = pts(Array(12).fill(100)).map((p) => ({ ...p, lastYear: 50 }));
    expect(withVerdict("spend", spend).verdict.text).toMatch(/up 100% from the same months last year/);
    expect(withVerdict("spend", pts(Array(12).fill(100)).map((p) => ({ ...p, lastYear: 95 }))).verdict.short).toBe("Same as last year");
  });
  it("leaves the running month and tiny months out of the judgement", () => {
    const steady = [...Array(11).fill(0.9), 0.2];
    expect(withVerdict("onTime", pts(steady, true)).verdict.short).toBe("Steady");
    const few = pts(Array(12).fill(0.9)).map((p, i) => ({ ...p, tooFew: i > 2 }));
    expect(withVerdict("onTime", few).verdict.short).toBe("Too few jobs");
  });
});

describe("vendor trends on the demo company", () => {
  const fixture = buildNorthlinePresentationFixture("2026-10-17T20:00:00.000Z", { operatingHistory: true });
  const now = "2026-10-17T20:00:00.000Z", today = "2026-10-17", tz = "America/New_York";
  const scope = { organizationId: org };
  const facts = vendorJobFactsFromFixture(fixture, scope, { from: "2024-10-01T00:00:00.000Z", to: now });
  const ctx = buildReportContext(fixture, scope, {}, now, today);
  const vendorName = (id?: string) => fixture.vendors.find((v) => v.id === id)?.name ?? "Vendor";

  it("every month's job list matches the number on the chart", () => {
    for (const key of ["jobs", "onTime", "callbacks", "costPerJob"] as const) {
      const series = factSeries(facts, months, key, {}, now, tz, today);
      for (const point of series.points) {
        const rows = monthJobs({ facts, jobs: ctx.jobs, month: point.month, key, filter: {}, now, timeZone: tz, vendorName });
        expect(rows.filter((r) => !r.result.startsWith("Not counted")).length).toBe(point.counted);
      }
    }
    const spend = spendSeries(ctx.jobs, months, {}, today);
    for (const point of spend.points) {
      const rows = monthJobs({ facts, jobs: ctx.jobs, month: point.month, key: "spend", filter: {}, now, timeZone: tz, vendorName });
      expect(rows.reduce((sum, r) => sum + (r.amountMinor ?? 0), 0)).toBe(point.value);
    }
  });

  it("a category view adds up across categories and leaves out uncategorized jobs; one vendor is a subset", () => {
    const all = factSeries(facts, months, "jobs", {}, now, tz, today).points.reduce((s, p) => s + p.counted, 0);
    const categories = [...new Set(facts.map((f) => f.trade))];
    const byCategory = categories.filter((c) => c !== "unclassified").map((category) => factSeries(facts, months, "jobs", { category }, now, tz, today).points.reduce((s, p) => s + p.counted, 0));
    const unclassified = facts.filter((f) => f.trade === "unclassified" && months.includes(f.sentAt.slice(0, 7))).length;
    expect(byCategory.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(all - unclassified - 2);
    expect(factSeries(facts, months, "jobs", { category: "unclassified" }, now, tz, today).points.length).toBe(12);
    const coldline = fixture.vendors.find((v) => /ColdLine/.test(v.name))!;
    const one = factSeries(facts, months, "jobs", { vendorId: coldline.id }, now, tz, today).points.reduce((s, p) => s + p.counted, 0);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(all);
    expect(spendSeries(ctx.jobs, months, {}, today).points.some((p) => (p.value ?? 0) > 0)).toBe(true);
  });
});
