import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import {
  MEASURES, MEASURE_INFO, SMALL_SAMPLE, buildScorecard, historyLength, inWindow, isMeasure, isPeriod, jobResult, rankRows,
  scoreRows, scorecardWindowAt, summarizeAll, tradeLabel,
  type MeasureSummary, type ScoreRow, type ScorecardMeasureKey, type ScorecardPeriod, type ScorecardWindow, type VendorJobFact,
} from "@/lib/ops/vendor-scorecard";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Owner, facilities and district managers. Store managers and the field maintenance manager do not see vendor scorecards. */
export function canViewVendorScorecards(session: Pick<OperatorSession, "role" | "persona">) {
  return ["executive", "facilities", "regional"].includes(session.role) && session.persona !== "field_manager";
}

export const PERIOD_LABELS: Record<ScorecardPeriod, string> = { 30: "30 days", 90: "90 days", 180: "6 months", 365: "12 months" };

export interface ScorecardCell { measure: ScorecardMeasureKey; value: string; detail: string; summary: MeasureSummary; href: string; empty: boolean; trendLabel?: string }
export interface ScorecardRow { key: string; label: string; sublabel?: string; href?: string; cells: ScorecardCell[] }
/** Where a job list opens: under the table whose number was tapped. */
export type DrillPlacement = "vendors" | "summary" | "history" | "district" | "trade" | `compare:${string}`;
export interface ScorecardDrill {
  placement: DrillPlacement; context: string; measure: ScorecardMeasureKey; measureLabel: string; definition: string; headline: string; closeHref: string;
  rows: Array<{ workOrderId: string; number: string; problem: string; store: string; sent: string; result: string; tone: "good" | "bad" | "neutral" }>;
}
export interface HistoryCell { value: string; detail: string; href: string; quiet: boolean; counted: number }
export interface VendorCard {
  id: string; name: string; profileHref: string; backHref: string; jobs: number;
  summary: ScorecardCell[];
  history: { columns: Array<{ label: string; current: boolean }>; rows: Array<{ measure: ScorecardMeasureKey; label: string; cells: HistoryCell[] }> };
  byDistrict: ScorecardRow[];
  byTrade: ScorecardRow[];
}
export interface ScorecardPageModel {
  view: "all" | "vendor";
  scopeLabel: string; periodLabel: string; priorLabel: string; period: ScorecardPeriod;
  periods: Array<{ value: ScorecardPeriod; label: string; href: string; selected: boolean }>;
  regions: Array<{ value: string; label: string }>; region?: string; regionBase: string;
  trades: Array<{ value: string; label: string; jobs: number; href: string; selected: boolean }>; allTradesHref: string; trade?: string;
  totals: { vendors: number; jobs: number };
  vendors: ScorecardRow[];
  /** Types of work two or more vendors did: side by side, with Best and Weakest. */
  comparisons: Array<{ trade: string; label: string; jobs: number; rows: ScorecardRow[] }>;
  vendor?: VendorCard;
  drill?: ScorecardDrill;
  definitions: Array<{ label: string; definition: string }>;
  smallSample: number;
}

const money = (minor: number) => cachedNumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);
const percent = (value: number) => `${Math.round(value * 100)}%`;
export function hoursLabel(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} hr`;
  return `${Math.round(hours / 24)} days`;
}
function formatValue(key: ScorecardMeasureKey, value: number) {
  return key === "response" ? hoursLabel(value) : key === "cost" ? money(value) : key === "jobs" || key === "invoice" ? String(value) : percent(value);
}

function cellFor(summary: MeasureSummary, href: string): ScorecardCell {
  const key = summary.key;
  const empty = summary.counted === 0 || summary.value === undefined;
  const value = empty || summary.tooFew ? "—" : formatValue(key, summary.value!);
  const detail = empty ? (key === "callbacks" ? "Too early to tell" : "No data yet")
    : summary.tooFew ? `${summary.counted} ${summary.counted === 1 ? "job" : "jobs"} · too few to judge`
    : key === "jobs" ? "sent"
    : key === "response" ? `${summary.counted} replies`
    : key === "cost" ? `${summary.counted} jobs with cost`
    : key === "invoice" ? (summary.hits ? `of ${summary.counted} jobs` : "none open")
    : `${summary.hits} of ${summary.counted}`;
  const trendLabel = summary.trend && summary.priorValue !== undefined ? `${summary.trend === "better" ? "Better" : "Worse"} than the previous period (was ${formatValue(key, summary.priorValue)})` : undefined;
  return { measure: key, value, detail, summary, href, empty, trendLabel };
}

function drillResult(fact: VendorJobFact, measure: ScorecardMeasureKey, now: string): { result: string; tone: "good" | "bad" | "neutral"; counted: boolean } {
  const r = jobResult(fact, measure, now);
  if (!r.counted) return { result: "", tone: "neutral", counted: false };
  switch (measure) {
    case "jobs": return { result: fact.declined ? "Declined" : fact.firstOutcome ? "Visited" : fact.firstResponseAt ? "Replied" : "No reply yet", tone: "neutral", counted: true };
    case "response": return { result: hoursLabel(r.value!), tone: "neutral", counted: true };
    case "cost": return { result: money(r.value!), tone: "neutral", counted: true };
    case "onTime": return { result: r.hit ? "On time" : "Late", tone: r.hit ? "good" : "bad", counted: true };
    case "firstFix": return { result: r.hit ? "Fixed first visit" : `First visit: ${(fact.firstOutcome ?? "").replaceAll("_", " ")}`, tone: r.hit ? "good" : "bad", counted: true };
    case "fixHeld": return { result: r.hit ? "Confirmed" : "Rejected", tone: r.hit ? "good" : "bad", counted: true };
    case "callbacks": return { result: r.hit ? "Broke again within 30 days" : "Held 30 days", tone: r.hit ? "bad" : "good", counted: true };
    case "declined": return { result: r.hit ? "Declined" : "Not declined", tone: r.hit ? "bad" : "neutral", counted: true };
    case "invoice": return { result: r.hit ? "Open invoice issue" : "No open issue", tone: r.hit ? "bad" : "neutral", counted: true };
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
/** Column labels: dates for short periods, months with years for long ones, so a past period is never ambiguous. */
const periodLabel = (window: ScorecardWindow, days: ScorecardPeriod) => days >= 180 ? `${monthYear(window.from)} – ${monthYear(window.to)}` : `${shortDate(window.from)} – ${shortDate(window.to)}`;

/** The vendor's main types of work, busiest first: two named, the rest counted. Unclassified work is left out. */
function tradeSummary(facts: VendorJobFact[]) {
  const counts = new Map<string, number>();
  for (const fact of facts) if (fact.trade !== "unclassified") counts.set(fact.trade, (counts.get(fact.trade) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => tradeLabel(key));
  return ordered.length > 2 ? `${ordered.slice(0, 2).join(" · ")} · +${ordered.length - 2} more` : ordered.join(" · ") || undefined;
}

export async function buildVendorScorecardPage(repository: OpsRepository, session: OperatorSession, query: Query, now: string): Promise<ScorecardPageModel> {
  const requested = Number(first(query.period));
  const period: ScorecardPeriod = isPeriod(requested) ? requested : 90;
  const baseScope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const regions = (await repository.getCapitalFilters(baseScope)).regions.map(r => ({ value: r.id, label: r.label }));
  const requestedRegion = first(query.region);
  const region = regions.some(r => r.value === requestedRegion) ? requestedRegion : undefined;
  const scope = region ? { ...baseScope, regionIds: [region] } : baseScope;
  const requestedVendor = first(query.vendor);

  // One read: every vendor for this period and the one before, or one vendor across its "over time" range.
  const depth = requestedVendor ? historyLength(period) : 2;
  const windows = Array.from({ length: depth }, (_, back) => scorecardWindowAt(now, period, back));
  const [current, prior] = [windows[0]!, windows[1]!];
  const facts = await repository.listVendorJobFacts(scope, { from: windows.at(-1)!.from, to: current.to, vendorId: requestedVendor });
  const at = (window: ScorecardWindow) => facts.filter(f => inWindow(f, window));
  const currentFacts = at(current), priorFacts = at(prior);
  // A vendor with no jobs in range still gets a card; another organization's vendor never does.
  const vendorName = requestedVendor ? facts[0]?.vendorName ?? (await repository.getVendor(session.organizationId, requestedVendor))?.name : undefined;
  const vendorId = vendorName ? requestedVendor : undefined;

  const tradeKeys = [...new Set(currentFacts.map(f => f.trade))];
  const requestedTrade = first(query.trade);
  const trade = !vendorId && tradeKeys.includes(requestedTrade ?? "") ? requestedTrade : undefined;
  const href = (changes: Record<string, string | undefined>, hash = "") => {
    const values = { period: String(period), region, trade, vendor: vendorId, ...changes };
    const search = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]) && !(entry[0] === "period" && entry[1] === "90")));
    return `/app/vendors/scorecards${search.size ? `?${search}` : ""}${hash}`;
  };
  const cells = (row: ScoreRow, link: (measure: ScorecardMeasureKey) => string) => MEASURES.map(key => cellFor(row.measures[key], link(key)));
  const drillLink = (measure: ScorecardMeasureKey, extra: Record<string, string | undefined>) => href({ measure, ...extra }, "#scorecard-jobs");

  let vendors: ScorecardRow[] = [];
  let comparisons: ScorecardPageModel["comparisons"] = [];
  let vendor: VendorCard | undefined;
  if (!vendorId) {
    const scoped = (list: VendorJobFact[]) => trade ? list.filter(f => f.trade === trade) : list;
    const rows = scoreRows(scoped(currentFacts), scoped(priorFacts), now, f => f.vendorId, f => f.vendorName);
    // One chosen type of work is like for like, so it gets Best and Weakest.
    if (trade) rankRows(rows);
    vendors = rows.map(row => ({ key: row.key, label: row.label, href: href({ vendor: row.key, trade: undefined }),
      sublabel: trade ? undefined : tradeSummary(currentFacts.filter(f => f.vendorId === row.key)),
      cells: cells(row, measure => drillLink(measure, { drillVendor: row.key })) }));
    if (!trade) comparisons = buildScorecard(currentFacts, priorFacts, now).filter(g => g.vendors.length > 1 && g.trade !== "unclassified").map(group => ({
      trade: group.trade, label: group.label, jobs: group.jobs,
      rows: group.vendors.map(v => ({ key: v.vendorId, label: v.vendorName, href: href({ vendor: v.vendorId }),
        cells: cells({ key: v.vendorId, label: v.vendorName, measures: v.measures }, measure => drillLink(measure, { drillVendor: v.vendorId, slice: `trade:${group.trade}` })) })),
    }));
  } else {
    const columns = windows.slice().reverse();
    vendor = {
      id: vendorId, name: vendorName!, profileHref: `/app/vendors/${encodeURIComponent(vendorId)}`, backHref: href({ vendor: undefined }), jobs: currentFacts.length,
      summary: cells({ key: vendorId, label: vendorName!, measures: summarizeAll(currentFacts, priorFacts, now) }, measure => drillLink(measure, {})),
      history: {
        columns: columns.map((window, index) => ({ label: periodLabel(window, period), current: index === columns.length - 1 })),
        rows: MEASURES.map(measure => ({ measure, label: MEASURE_INFO[measure].label, cells: columns.map(window => {
          const back = windows.indexOf(window);
          const cell = cellFor(summarizeAll(at(window), [], now)[measure], drillLink(measure, { slice: "history", back: String(back) }));
          return { value: cell.value, detail: cell.empty ? "" : cell.summary.tooFew ? "too few" : cell.detail, href: cell.href, quiet: cell.empty || cell.summary.tooFew, counted: cell.summary.counted };
        }) })),
      },
      byDistrict: scoreRows(currentFacts, priorFacts, now, f => f.regionId ?? "none", f => f.regionName ?? "No district").map(row => ({ key: row.key, label: row.label,
        cells: cells(row, measure => drillLink(measure, { slice: `region:${row.key}` })) })),
      byTrade: scoreRows(currentFacts, priorFacts, now, f => f.trade, f => tradeLabel(f.trade)).map(row => ({ key: row.key, label: row.label,
        cells: cells(row, measure => drillLink(measure, { slice: `trade:${row.key}` })) })),
    };
  }

  // The job list behind a tapped number: one vendor, one measure, optionally one type of work, district or past period.
  let drill: ScorecardDrill | undefined;
  const drillMeasure = first(query.measure), slice = first(query.slice) ?? "";
  const drillVendor = vendorId ?? first(query.drillVendor);
  const [sliceKind, sliceValue] = slice.includes(":") ? [slice.slice(0, slice.indexOf(":")), slice.slice(slice.indexOf(":") + 1)] : [slice, ""];
  if (drillVendor && isMeasure(drillMeasure) && facts.some(f => f.vendorId === drillVendor) || vendorId && isMeasure(drillMeasure)) {
    const back = sliceKind === "history" ? Math.max(0, Math.min(depth - 1, Math.floor(Number(first(query.back)) || 0))) : 0;
    const window = windows[back]!;
    const pool = at(window).filter(f => f.vendorId === drillVendor
      && (sliceKind !== "trade" || f.trade === sliceValue)
      && (sliceKind !== "region" || (f.regionId ?? "none") === sliceValue)
      && (vendorId !== undefined || !trade || f.trade === trade));
    const measure = drillMeasure as ScorecardMeasureKey;
    const rows = pool.map(fact => ({ fact, ...drillResult(fact, measure, now) })).filter(row => row.counted)
      .sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1) || b.fact.sentAt.localeCompare(a.fact.sentAt));
    const summary = summarizeAll(pool, [], now)[measure], cell = cellFor(summary, "");
    const info = MEASURE_INFO[measure];
    const name = vendorName ?? facts.find(f => f.vendorId === drillVendor)!.vendorName;
    const placement: DrillPlacement = vendorId
      ? (sliceKind === "history" ? "history" : sliceKind === "region" ? "district" : sliceKind === "trade" ? "trade" : "summary")
      : sliceKind === "trade" ? `compare:${sliceValue}` : "vendors";
    const sliceLabel = sliceKind === "trade" ? tradeLabel(sliceValue) : sliceKind === "region" ? (pool[0]?.regionName ?? "No district") : sliceKind === "history" ? periodLabel(window, period) : undefined;
    drill = {
      placement, context: [name, sliceLabel].filter(Boolean).join(" · "), measure, measureLabel: info.label, definition: info.definition,
      headline: cell.empty ? "No jobs count toward this yet." : summary.tooFew ? `${cell.detail}. Showing the jobs so far.` : `${cell.value}${cell.detail && !["sent", "none open"].includes(cell.detail) ? ` · ${cell.detail}` : ""}`,
      closeHref: href({}, `#${placement === "vendors" ? "scorecard-vendors" : placement.startsWith("compare:") ? `scorecard-${sliceValue}` : `scorecard-${placement}`}`),
      rows: rows.map(({ fact, result, tone }) => ({ workOrderId: fact.workOrderId, number: fact.number, problem: fact.problem, store: `Store ${fact.storeNumber}`, sent: formatOperationsDate(fact.sentAt.slice(0, 10)), result, tone })),
    };
  }

  const dated = (iso: string) => formatOperationsDate(iso.slice(0, 10));
  return {
    view: vendorId ? "vendor" : "all",
    scopeLabel: region ? regions.find(r => r.value === region)!.label : session.scopeLabel,
    periodLabel: `${dated(current.from)} – ${dated(current.to)}`,
    priorLabel: `${dated(prior.from)} – ${dated(prior.to)}`,
    period,
    periods: ([30, 90, 180, 365] as const).map(value => ({ value, label: PERIOD_LABELS[value], href: href({ period: String(value) }), selected: value === period })),
    regions: regions.length > 1 ? regions : [], region, regionBase: href({ region: undefined }),
    trades: vendorId ? [] : tradeKeys.map(key => ({ value: key, label: tradeLabel(key), jobs: currentFacts.filter(f => f.trade === key).length, href: href({ trade: key }), selected: key === trade }))
      .sort((a, b) => (a.value === "unclassified" ? 1 : 0) - (b.value === "unclassified" ? 1 : 0) || b.jobs - a.jobs || a.label.localeCompare(b.label)),
    allTradesHref: href({ trade: undefined }), trade,
    totals: { vendors: new Set(currentFacts.map(f => f.vendorId)).size, jobs: currentFacts.length },
    vendors, comparisons, vendor, drill, smallSample: SMALL_SAMPLE,
    definitions: MEASURES.map(key => ({ label: MEASURE_INFO[key].label, definition: MEASURE_INFO[key].definition })),
  };
}
