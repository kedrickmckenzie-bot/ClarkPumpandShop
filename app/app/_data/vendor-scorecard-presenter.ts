import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import {
  MEASURES, MEASURE_INFO, SMALL_SAMPLE, buildScorecard, isMeasure, isPeriod, jobResult, scorecardWindows, tradeLabel,
  type MeasureSummary, type ScorecardMeasureKey, type ScorecardPeriod, type TradeGroup, type VendorJobFact,
} from "@/lib/ops/vendor-scorecard";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Owner, facilities and district managers. Store managers and the field maintenance manager do not see vendor scorecards. */
export function canViewVendorScorecards(session: Pick<OperatorSession, "role" | "persona">) {
  return ["executive", "facilities", "regional"].includes(session.role) && session.persona !== "field_manager";
}

export const PERIOD_LABELS: Record<ScorecardPeriod, string> = { 30: "30 days", 90: "90 days", 180: "6 months", 365: "12 months" };

export interface ScorecardCell { measure: ScorecardMeasureKey; value: string; detail: string; summary: MeasureSummary; href: string; empty: boolean; trendLabel?: string }
export interface ScorecardDrill {
  vendorName: string; trade: string; tradeLabel: string; measure: ScorecardMeasureKey; measureLabel: string; definition: string; headline: string; closeHref: string;
  rows: Array<{ workOrderId: string; number: string; problem: string; store: string; sent: string; result: string; tone: "good" | "bad" | "neutral" }>;
}
export interface ScorecardRow { vendorId: string; vendorName: string; vendorHref: string; trade: string; tradeLabel: string; cells: ScorecardCell[] }
export interface ScorecardPageModel {
  scopeLabel: string; periodLabel: string; priorLabel: string; period: ScorecardPeriod;
  periods: Array<{ value: ScorecardPeriod; label: string; href: string; selected: boolean }>;
  regions: Array<{ value: string; label: string }>; region?: string; regionBase: string;
  trades: Array<{ value: string; label: string; jobs: number; href: string; selected: boolean }>; allTradesHref: string;
  totals: { vendors: number; jobs: number };
  groups: Array<TradeGroup & { rows: ScorecardRow[] }>;
  /** Types of work only one vendor did: shown together, since there is nothing to compare them with. */
  solo: ScorecardRow[];
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
  const value = empty ? "—" : summary.tooFew ? "—" : formatValue(key, summary.value!);
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

/** What one job shows in the drill-down, for the selected measure. */
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
    case "declined": return { result: r.hit ? "Declined" : "Accepted or no decline", tone: r.hit ? "bad" : "neutral", counted: true };
    case "invoice": return { result: r.hit ? "Open invoice issue" : "No open issue", tone: r.hit ? "bad" : "neutral", counted: true };
  }
}

export async function buildVendorScorecardPage(repository: OpsRepository, session: OperatorSession, query: Query, now: string): Promise<ScorecardPageModel> {
  const requested = Number(first(query.period));
  const period: ScorecardPeriod = isPeriod(requested) ? requested : 90;
  const baseScope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const regions = (await repository.getCapitalFilters(baseScope)).regions.map(r => ({ value: r.id, label: r.label }));
  const requestedRegion = first(query.region);
  const region = regions.some(r => r.value === requestedRegion) ? requestedRegion : undefined;
  const scope = region ? { ...baseScope, regionIds: [region] } : baseScope;
  const windows = scorecardWindows(now, period);
  const [facts, prior] = await Promise.all([repository.listVendorJobFacts(scope, windows.current), repository.listVendorJobFacts(scope, windows.prior)]);
  const allGroups = buildScorecard(facts, prior, now);
  const requestedTrade = first(query.trade);
  const trade = allGroups.some(g => g.trade === requestedTrade) ? requestedTrade : undefined;
  const params = (changes: Record<string, string | undefined>) => {
    const values = { period: String(period), region, trade, ...changes };
    const search = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]) && !(entry[0] === "period" && entry[1] === "90")));
    return `/app/vendors/scorecards${search.size ? `?${search}` : ""}`;
  };
  const visible = trade ? allGroups.filter(g => g.trade === trade) : allGroups;
  const built = visible.map(group => ({ ...group, rows: group.vendors.map(vendor => ({
    vendorId: vendor.vendorId, vendorName: vendor.vendorName, vendorHref: `/app/vendors/${encodeURIComponent(vendor.vendorId)}`, trade: group.trade, tradeLabel: group.label,
    cells: MEASURES.map(key => cellFor(vendor.measures[key], `${params({ vendor: vendor.vendorId, group: group.trade, measure: key })}#scorecard-jobs`)),
  })) }));
  // A chosen type of work always shows as its own table; otherwise single-vendor types share one table.
  // Unclassified work is never a fair comparison, so it always sits with the single-vendor rows.
  const compared = (group: typeof built[number]) => group.rows.length > 1 && group.trade !== "unclassified";
  const groups = trade ? built : built.filter(compared);
  const solo = trade ? [] : built.filter(group => !compared(group)).flatMap(group => group.rows);

  let drill: ScorecardDrill | undefined;
  const drillVendor = first(query.vendor), drillGroup = first(query.group), drillMeasure = first(query.measure);
  const drillRow = built.find(g => g.trade === drillGroup)?.rows.find(r => r.vendorId === drillVendor);
  if (drillRow && isMeasure(drillMeasure)) {
    const cell = drillRow.cells.find(c => c.measure === drillMeasure)!;
    const rows = facts.filter(f => f.vendorId === drillVendor && f.trade === drillGroup)
      .map(fact => ({ fact, ...drillResult(fact, drillMeasure, now) }))
      .filter(row => row.counted)
      // Misses first, then most recent.
      .sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1) || b.fact.sentAt.localeCompare(a.fact.sentAt));
    const info = MEASURE_INFO[drillMeasure];
    drill = {
      vendorName: drillRow.vendorName, trade: drillGroup!, tradeLabel: tradeLabel(drillGroup!), measure: drillMeasure, measureLabel: info.label, definition: info.definition,
      headline: cell.empty ? "No jobs count toward this yet." : cell.summary.tooFew ? `${cell.detail}. Showing the jobs so far.` : `${cell.value}${cell.detail && !["sent", "none open"].includes(cell.detail) ? ` · ${cell.detail}` : ""}`,
      closeHref: `${params({})}#${solo.some(row => row.trade === drillGroup) ? "scorecard-solo" : `scorecard-${drillGroup}`}`,
      rows: rows.map(({ fact, result, tone }) => ({ workOrderId: fact.workOrderId, number: fact.number, problem: fact.problem, store: `Store ${fact.storeNumber}`, sent: formatOperationsDate(fact.sentAt.slice(0, 10)), result, tone })),
    };
  }

  const dated = (iso: string) => formatOperationsDate(iso.slice(0, 10));
  return {
    scopeLabel: region ? regions.find(r => r.value === region)!.label : session.scopeLabel,
    periodLabel: `${dated(windows.current.from)} – ${dated(windows.current.to)}`,
    priorLabel: `${dated(windows.prior.from)} – ${dated(windows.prior.to)}`,
    period,
    periods: ([30, 90, 180, 365] as const).map(value => ({ value, label: PERIOD_LABELS[value], href: params({ period: String(value), trade }), selected: value === period })),
    regions: regions.length > 1 ? regions : [], region, regionBase: params({ region: undefined }),
    allTradesHref: params({ trade: undefined }),
    trades: allGroups.map(g => ({ value: g.trade, label: g.label, jobs: g.jobs, href: params({ trade: g.trade }), selected: g.trade === trade })),
    totals: { vendors: new Set(facts.map(f => f.vendorId)).size, jobs: facts.length },
    groups, solo, drill, smallSample: SMALL_SAMPLE,
    definitions: MEASURES.map(key => ({ label: MEASURE_INFO[key].label, definition: MEASURE_INFO[key].definition })),
  };
}
