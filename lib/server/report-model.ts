import "server-only";
import { notFound } from "next/navigation";
import { loadListModel, loadOperatorSession, loadProgramModel } from "@/app/app/_data/operator-loader";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { reportCatalogEntry, type ReportCatalogEntry } from "@/lib/ops/report-catalog";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { buildReport, canOpenReport } from "@/lib/ops/reports/registry";
import { legacyReportDoc } from "@/lib/ops/reports/legacy";
import { parseReportOptions, type ReportOptions } from "@/lib/ops/reports/options";
import type { ReportDoc } from "@/lib/ops/reports/doc";

/** Filters a report link may carry; anything else is ignored. */
export const REPORT_FILTER_KEYS = ["store", "region", "category", "status", "period", "from", "costFrom", "costMonth"] as const;

/** An older screen-based report's full source rows (used by its CSV export). */
export async function loadReportModel(reportId: string, incoming: (key: string) => string | null | undefined) {
  const definition = reportCatalogEntry(reportId);
  if (!definition || definition.source.kind === "built") return undefined;
  const query: Record<string, string> = { ...(definition.source.query ?? {}), export: "all" };
  for (const key of REPORT_FILTER_KEYS) {
    const value = incoming(key)?.trim();
    if (value) query[key] = value;
  }
  const model = definition.source.kind === "list"
    ? await loadListModel(definition.source.route, query)
    : await loadProgramModel(definition.source.route, query);
  return { definition, model, query };
}

export function reportDefaults(entry: ReportCatalogEntry) {
  return { period: entry.source.kind === "built" ? entry.source.defaultPeriod : "last_month" as const, audience: entry.audience };
}

/**
 * Any report as a document, for the signed-in person: only their stores, only reports their role may open.
 * `now` is fixed for scheduled runs so a run always shows the same period.
 */
export interface ReportChoices {
  stores: Array<{ value: string; label: string }>;
  regions: Array<{ value: string; label: string }>;
  vendors: Array<{ value: string; label: string }>;
}

export async function loadReportDoc(reportId: string, get: (key: string) => string | string[] | null | undefined, now = new Date().toISOString()): Promise<{ entry: ReportCatalogEntry; doc: ReportDoc; options: ReportOptions; today: string; zone: string; choices: ReportChoices }> {
  const entry = reportCatalogEntry(reportId);
  if (!entry) notFound();
  const session = await loadOperatorSession();
  if (!canOpenReport(entry, session.role)) notFound();
  const options = parseReportOptions(get, reportDefaults(entry));
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const zone = fixture.organizations.find(o => o.id === session.organizationId)?.timeZone ?? "America/New_York";
  const today = civilDate(now, zone);
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const visible = fixture.stores.filter(s => s.organizationId === scope.organizationId && (scope.storeIds === undefined || scope.storeIds.includes(s.id)) && (scope.regionIds === undefined || Boolean(s.regionId && scope.regionIds.includes(s.regionId))))
    .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true }));
  const orgName = fixture.organizations.find(o => o.id === scope.organizationId)?.name ?? "";
  const choices: ReportChoices = {
    stores: visible.map(s => ({ value: s.id, label: `Store ${s.storeNumber} · ${s.name.replace(`${orgName} - `, "")}` })),
    regions: fixture.regions.filter(r => r.organizationId === scope.organizationId && visible.some(s => s.regionId === r.id)).map(r => ({ value: r.id, label: r.name })),
    vendors: fixture.vendors.filter(v => v.organizationId === scope.organizationId).map(v => ({ value: v.id, label: v.name })).sort((a, b) => a.label.localeCompare(b.label)),
  };
  if (entry.source.kind === "built") {
    const doc = buildReport(entry, fixture, scope, options, now, today);
    return { entry, doc, options, today, zone, choices };
  }
  const loaded = await loadReportModel(reportId, key => { const v = get(key); return Array.isArray(v) ? v[0] : v; });
  if (!loaded) notFound();
  return { entry, doc: legacyReportDoc(entry, loaded.model, session.organizationName, options), options, today, zone, choices };
}
