import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { reportCatalog, reportCatalogEntry } from "@/lib/ops/report-catalog";
import { buildReport, canOpenReport } from "@/lib/ops/reports/registry";
import { parseReportOptions, type ReportOptions } from "@/lib/ops/reports/options";
import { resolvePeriod } from "@/lib/ops/reports/period";
import { apCheck } from "@/lib/ops/reports/vendor-ap";
import type { ReportDoc } from "@/lib/ops/reports/doc";

const f = buildNorthlinePresentationFixture();
const org = f.organizations[0]!.id;
const now = f.asOf, today = f.asOf.slice(0, 10);
const scope = { organizationId: org };
const dollars = (text: string) => Math.round(Number(text.replace(/[^0-9.-]/g, "")) * 100);
const build = (id: string, options: Partial<ReportOptions> = {}, s: { organizationId: string; storeIds?: string[] } = scope) =>
  buildReport(reportCatalogEntry(id)!, f, s, { period: "last_quarter", work: "both", detail: "summary", ...options }, now, today);
const kpi = (doc: ReportDoc, label: string) => doc.kpis.find(k => k.label === label)!.value;
const section = (doc: ReportDoc, id: string) => doc.sections.find(s => s.id === id);

/** Recorded cost straight from the source cost lines, independent of the report code. */
function sourceSpend(from: string, to: string, storeIds?: string[]) {
  const stores = new Map(f.workOrders.map(w => [w.id, w.storeId]));
  return f.costLines.filter(c => c.organizationId === org && c.amount.currency === "USD" && c.serviceDate.slice(0, 10) >= from && c.serviceDate.slice(0, 10) <= to
    && (!storeIds || storeIds.includes(stores.get(c.workOrderId)!))).reduce((sum, c) => sum + c.amount.amountMinor, 0);
}

describe("built reports", () => {
  const period = resolvePeriod("last_quarter", today);

  it("owner summary spend equals the source cost lines and splits without double counting", () => {
    const doc = build("owner-summary");
    const spend = dollars(kpi(doc, "Maintenance spend"));
    expect(Math.abs(spend - sourceSpend(period.from, period.to))).toBeLessThanOrEqual(100);
    const vendor = dollars(kpi(build("owner-summary", { work: "vendor" }), "Maintenance spend"));
    const inHouse = dollars(kpi(build("owner-summary", { work: "in_house" }), "Maintenance spend"));
    expect(Math.abs(vendor + inHouse - spend)).toBeLessThanOrEqual(200);
    const split = doc.sections.find(s => s.kind === "split");
    if (split?.kind === "split") expect(Math.abs(split.parts.reduce((s, p) => s + p.value, 0) - sourceSpend(period.from, period.to))).toBeLessThanOrEqual(1);
    const byStore = doc.sections.find(s => s.kind === "bars" && /store/i.test(s.title));
    if (byStore?.kind === "bars") expect(byStore.items.reduce((s, i) => s + i.value, 0)).toBe(sourceSpend(period.from, period.to));
  });

  it("stays inside the person's stores", () => {
    const storeIds = [f.stores.find(s => s.organizationId === org)!.id];
    const doc = build("owner-summary", {}, { organizationId: org, storeIds });
    expect(Math.abs(dollars(kpi(doc, "Maintenance spend")) - sourceSpend(period.from, period.to, storeIds))).toBeLessThanOrEqual(100);
    expect(build("owner-summary", {}, { organizationId: "another-org" }).kpis.find(k => k.label === "Maintenance spend")!.value).toBe("$0");
  });

  it("every-record mode adds the full lists that summary leaves out", () => {
    for (const id of ["owner-summary", "vendor-ap", "vendor-performance", "in-house-team", "store-report"]) {
      const summary = build(id), all = build(id, { detail: "all" });
      expect(all.sections.length, id).toBeGreaterThanOrEqual(summary.sections.length);
      if (all.recordsSectionId) expect(section(all, all.recordsSectionId), id).toBeDefined();
    }
  });

  it("one-sided reports stay one-sided whatever the link says", () => {
    const vendorAp = reportCatalogEntry("vendor-ap")!, team = reportCatalogEntry("in-house-team")!;
    expect(vendorAp.audience).toBe("vendor");
    expect(team.audience).toBe("in_house");
    expect(parseReportOptions(k => ({ work: "in_house" } as Record<string, string>)[k], { period: "last_month", audience: "vendor" }).work).toBe("vendor");
    expect(parseReportOptions(k => ({ work: "vendor", period: "bogus" } as Record<string, string>)[k], { period: "last_month", audience: "both" })).toMatchObject({ work: "vendor", period: "last_month" });
    // No in-house work order appears on the AP report.
    const ap = build("vendor-ap", { detail: "all" });
    const inHouseNumbers = new Set(f.workOrders.filter(w => f.assignments.some(a => a.workOrderId === w.id && a.kind === "internal") && !f.assignments.some(a => a.workOrderId === w.id && a.kind === "outside_vendor")).map(w => w.number));
    const apNumbers = ap.sections.flatMap(s => s.kind === "table" ? s.rows.map(r => r.cells.number ?? r.cells.wo) : []).filter(Boolean);
    expect(inHouseNumbers.size).toBeGreaterThan(0);
    expect(apNumbers.length).toBeGreaterThan(0);
    expect(apNumbers.some(n => inHouseNumbers.has(n!))).toBe(false);
  });

  it("AP check flags differences as review facts", () => {
    expect(apCheck({ nteMinor: 50000, completedAt: "2026-07-01" }, 40000, 40050)).toMatchObject({ flag: false });
    expect(apCheck({ nteMinor: 50000, completedAt: "2026-07-01" }, 52000, 52000)).toMatchObject({ flag: true, text: expect.stringContaining("over the approved limit") });
    expect(apCheck({ nteMinor: 0, completedAt: "2026-07-01" }, 52000, 52000)).toMatchObject({ flag: false });
    expect(apCheck({ nteMinor: undefined, completedAt: "2026-07-01" }, 30000, 0)).toMatchObject({ flag: true, text: "No invoice linked yet" });
    expect(apCheck({ nteMinor: undefined, completedAt: undefined }, 0, 0)).toMatchObject({ flag: false });
  });

  it("who may open each report", () => {
    const ap = reportCatalogEntry("vendor-ap")!;
    expect(canOpenReport(ap, "finance")).toBe(true);
    expect(canOpenReport(ap, "store_manager")).toBe(false);
    expect(reportCatalog.filter(e => e.source.kind === "built").every(e => canOpenReport(e, "executive"))).toBe(true);
  });
});
