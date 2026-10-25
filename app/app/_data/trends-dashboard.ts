import type { OperatorSession, PaginationViewModel } from "@/components/ops/data-contract";
import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { cameBack, lastYear, measure, MEASURE_INFO, movers, spendChange, TREND_MEASURES, trendData, trendMonths, unusualMonths, yearBefore, type TrendData, type TrendMeasure } from "@/lib/ops/trend-measures";
import { daysToComplete } from "@/lib/ops/reports/facts";
import { compactStoreLabel } from "@/lib/product/store-label";
import type { OpsFixture } from "@/lib/ops/types";
import { sentence } from "./operator-presenter";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const usd = cachedNumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (minor: number) => usd.format(minor / 100);
const short = (minor: number) => { const dollars = Math.abs(minor) / 100; const sign = minor < 0 ? "-" : ""; return dollars >= 1000 ? `${sign}$${(dollars / 1000).toFixed(dollars >= 100_000 ? 0 : 1)}k` : `${sign}$${Math.round(dollars)}`; };
const monthName = (key: string, long = false) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" });
const KEYS = ["store", "region", "category"];
const clip = (text: string, max: number) => text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;

export function formatMeasure(which: TrendMeasure, value: number | undefined) {
  if (value === undefined) return "—";
  const unit = MEASURE_INFO[which].unit;
  return unit === "money" ? money(value) : unit === "percent" ? `${Math.round(value * 100)}%` : unit === "days" ? `${value < 1 ? value.toFixed(1) : value.toFixed(1)} days` : String(Math.round(value));
}
/** "+12% vs last year", "+3 pts", "+0.8 days"; and whether that is better, worse or about the same. */
export function changeOf(which: TrendMeasure, before?: number, after?: number) {
  if (before === undefined || after === undefined) return { label: "No data from last year to compare", tone: "neutral" as const };
  const unit = MEASURE_INFO[which].unit;
  const diff = after - before;
  const relative = before ? diff / Math.abs(before) : undefined;
  const amount = unit === "percent" ? `${Math.abs(Math.round(diff * 100))} points` : unit === "days" ? `${Math.abs(diff).toFixed(1)} days` : relative === undefined ? "" : `${Math.abs(Math.round(relative * 100))}%`;
  const small = unit === "percent" ? Math.abs(diff) < 0.02 : unit === "days" ? Math.abs(diff) < 0.3 : relative !== undefined && Math.abs(relative) < 0.03;
  const worse = MEASURE_INFO[which].lowerIsBetter ? diff > 0 : diff < 0;
  const label = small ? "About the same as last year" : relative === undefined && unit !== "percent" && unit !== "days" ? "New since last year" : `${diff > 0 ? "Up" : "Down"} ${amount} from last year`;
  return { label, tone: small ? "neutral" as const : worse ? "worse" as const : "better" as const };
}

interface Context { data: TrendData; today: string; href: (path: string, changes?: Record<string, string | undefined>) => string; scopeLabel: string; filters: { store?: string; region?: string; category?: string } }

function context(fixture: OpsFixture, session: OperatorSession, query: Query): Context {
  const filters = { store: first(query.store), region: first(query.region), category: first(query.category) };
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const today = fixture.asOf.slice(0, 10);
  const ctx = buildReportContext(fixture, scope, { store: filters.store, region: filters.region }, fixture.asOf, today);
  const data = trendData(ctx, fixture, scope, filters);
  const href = (path: string, changes: Record<string, string | undefined> = {}) => {
    const values = new URLSearchParams();
    for (const key of KEYS) { const value = first(query[key]); if (value) values.set(key, value); }
    for (const [key, value] of Object.entries(changes)) { if (value) values.set(key, value); else values.delete(key); }
    return `${path}${values.size ? `?${values}` : ""}`;
  };
  const store = filters.store ? ctx.stores.find(row => row.id === filters.store) : undefined;
  const region = filters.region ? fixture.regions.find(row => row.organizationId === session.organizationId && row.id === filters.region) : undefined;
  const scopeLabel = [store ? compactStoreLabel(`Store ${store.storeNumber} · ${store.name}`, session.organizationName) : region ? `${region.name} · ${ctx.stores.length} stores` : compactStoreLabel(session.scopeLabel, session.organizationName),
    filters.category ? (filters.category === "unclassified" ? "Not classified" : sentence(filters.category)) : undefined].filter(Boolean).join(" · ");
  return { data, today, href, scopeLabel, filters };
}

const areaName = (key: string) => key === "unclassified" ? "Not classified" : sentence(key);

/** Trends overview: six measures with their year, the chosen measure's months, why spending changed, who moved, odd months. */
export function buildTrendsDashboard(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const c = context(fixture, session, query);
  const selected = (TREND_MEASURES as readonly string[]).includes(first(query.measure) ?? "") ? first(query.measure) as TrendMeasure : "spend";
  const months = trendMonths(c.today);
  const { current, prior } = lastYear(c.today);
  const tiles = TREND_MEASURES.map(which => {
    const after = measure(c.data, which, current).value, before = measure(c.data, which, prior).value;
    return { id: which, label: MEASURE_INFO[which].label, value: formatMeasure(which, after), before: formatMeasure(which, before), change: changeOf(which, before, after), selected: which === selected,
      href: c.href("/app/trends", { measure: which === "spend" ? undefined : which }), spark: months.map(month => measure(c.data, which, month.range).value ?? null) };
  });
  const lastTwelve = months.slice(-12);
  const chart = {
    measure: selected, label: MEASURE_INFO[selected].label, definition: MEASURE_INFO[selected].definition,
    points: lastTwelve.map(month => {
      const now = measure(c.data, selected, month.range), then = measure(c.data, selected, yearBefore(month.range));
      return { key: month.key, label: monthName(month.key), partial: month.partial, value: now.value ?? null, valueLabel: formatMeasure(selected, now.value), before: then.value ?? null, beforeLabel: formatMeasure(selected, then.value),
        href: c.href("/app/trends/month", { measure: selected, month: month.key }), beforeHref: c.href("/app/trends/month", { measure: selected, month: yearBefore(month.range).from.slice(0, 7) }) };
    }),
  };
  const change = spendChange(c.data, c.today);
  const sign = (id: string) => change.parts.find(part => part.id === id)!.amount;
  const totalJobsBefore = change.regular.jobsBefore, totalJobsAfter = change.regular.jobsAfter;
  // The service area whose share of repairs moved most explains the "kind of repairs" part in plain words.
  const shifted = [...change.areas].map(row => ({ ...row, p0: totalJobsBefore ? row.jobsBefore / totalJobsBefore : 0, p1: totalJobsAfter ? row.jobsAfter / totalJobsAfter : 0 }))
    .sort((x, y) => Math.abs(y.p1 - y.p0) - Math.abs(x.p1 - x.p0))[0];
  const partLabel = { big: "A few very expensive repairs", volume: totalJobsAfter >= totalJobsBefore ? "More repairs" : "Fewer repairs",
    mix: sign("mix") >= 0 ? "More of the costly kinds of repairs" : "More of the low-cost kinds of repairs", rate: sign("rate") >= 0 ? "The same repairs cost more" : "The same repairs cost less" } as const;
  const bigBefore = change.bigJobs.before.length, bigAfter = change.bigJobs.after.length;
  const partDetail = {
    big: `${bigAfter} ${bigAfter === 1 ? "repair" : "repairs"} over ${short(change.bigThreshold)} this year, ${bigBefore ? bigBefore : "none"} last year`,
    volume: `${totalJobsAfter} repairs this year vs. ${totalJobsBefore} last year`,
    mix: shifted ? `${areaName(shifted.key)} went from ${Math.round(shifted.p0 * 100)}% to ${Math.round(shifted.p1 * 100)}% of all repairs` : "The mix of repairs changed",
    rate: `An average repair was ${short(change.regular.avgAfter)}, ${change.regular.avgAfter >= change.regular.avgBefore ? "up" : "down"} from ${short(change.regular.avgBefore)}`,
  };
  const why = { before: money(change.before), after: money(change.after), change: change.after - change.before, changeLabel: `${change.after >= change.before ? "+" : "−"}${money(Math.abs(change.after - change.before))}`,
    parts: change.parts.map(part => ({ ...part, label: partLabel[part.id], detail: partDetail[part.id], amountLabel: `${part.amount >= 0 ? "+" : "−"}${money(Math.abs(part.amount))}`, href: `${c.href("/app/trends/why")}#${part.id}` })),
    max: Math.max(1, ...change.parts.map(part => Math.abs(part.amount))) };
  const by = first(query.by) === "area" || first(query.by) === "vendor" ? first(query.by) as "area" | "vendor" : "store";
  const storeById = new Map(c.data.ctx.stores.map(row => [row.id, row]));
  const moverLabel = (key: string) => by === "store" ? storeById.get(key) ? `Store ${storeById.get(key)!.storeNumber}` : "Store" : by === "area" ? areaName(key) : key === "in_house" ? "In-house jobs" : key === "unmarked" ? "Not marked" : c.data.ctx.vendorName(key);
  const moverHref = (key: string) => by === "store" ? c.href("/app/trends", { store: key, region: undefined }) : by === "area" ? c.href("/app/trends", { category: key }) : key.startsWith("in_house") || key === "unmarked" ? "/app/spend/vendors" : `/app/trends?view=vendors&vendor=${encodeURIComponent(key)}`;
  const moverRows = movers(c.data, c.today, by).slice(0, 6);
  const moverMax = Math.max(1, ...moverRows.map(row => Math.abs(row.change)));
  const odd = unusualMonths(c.data, months).slice(0, 4).map(row => ({ key: row.month.key, label: monthName(row.month.key, true), value: money(row.value), times: `${(row.value / row.typical).toFixed(1)} times a normal month`,
    cause: row.top && row.top.amount ? `Biggest repair: ${row.top.job.number} · ${clip(row.top.job.problem, 70)} · ${money(row.top.amount)}` : undefined, causeHref: row.top ? `/app/work-orders/${encodeURIComponent(row.top.job.id)}` : undefined,
    href: c.href("/app/trends/month", { measure: "spend", month: row.month.key }) }));
  return { whyTitle: change.after >= change.before ? "Why spending went up" : "Why spending went down", scopeLabel: c.scopeLabel, periodLabel: `Last 12 months (${formatOperationsDate(`${current.from}T12:00:00Z`, "UTC")} – ${formatOperationsDate(`${current.to}T12:00:00Z`, "UTC")}) vs. the 12 before`,
    tiles, chart, why, movers: { by, rows: moverRows.map(row => ({ key: row.key, label: moverLabel(row.key), before: short(row.before), after: short(row.after), change: row.change, changeLabel: `${row.change >= 0 ? "+" : "−"}${short(Math.abs(row.change))}`, href: moverHref(row.key) })), max: moverMax,
      options: (["store", "area", "vendor"] as const).map(key => ({ value: key, label: key === "store" ? "Stores" : key === "area" ? "Service areas" : "Vendors", selected: key === by, href: c.href("/app/trends", { by: key === "store" ? undefined : key, measure: selected === "spend" ? undefined : selected }) })) },
    odd, href: c.href,
    areaOptions: [{ value: "", label: "All service areas", selected: !c.filters.category, href: c.href("/app/trends", { category: undefined }) },
      ...[...new Set(c.data.ctx.jobs.map(job => job.category).filter((key): key is string => Boolean(key)))].sort().map(key => ({ value: key, label: areaName(key), selected: key === c.filters.category, href: c.href("/app/trends", { category: key }) }))] };
}

/** The records behind one month of one measure. */
export function buildTrendMonth(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const c = context(fixture, session, query);
  const which = (TREND_MEASURES as readonly string[]).includes(first(query.measure) ?? "") ? first(query.measure) as TrendMeasure : "spend";
  const month = /^\d{4}-\d{2}$/.test(first(query.month) ?? "") ? first(query.month)! : c.today.slice(0, 7);
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const range = { from: `${month}-01`, to: end < c.today ? end : c.today };
  const result = measure(c.data, which, range);
  const jobs = new Map(c.data.jobs.map(job => [job.id, job]));
  const rows = which === "pm_done"
    ? c.data.pm.filter(row => result.occurrenceIds?.includes(row.id)).map(row => ({ id: row.id, title: row.planName, detail: row.assetName ?? "Store maintenance", store: `Store ${row.storeNumber}`, value: row.status === "completed" ? "Done" : "Missed", bad: row.status !== "completed", sort: row.status === "completed" ? 1 : 0, href: `/app/pm/occurrences/${encodeURIComponent(row.id)}` }))
    : result.jobIds.map(id => jobs.get(id)!).map(job => {
      const cost = job.costs.reduce((sum, line) => sum + (line.date >= range.from && line.date <= range.to ? line.amountMinor : 0), 0);
      const days = daysToComplete(job), back = which === "came_back" ? cameBack(c.data, job) : false;
      const value = which === "spend" || which === "cost_per_job" ? money(cost) : which === "days_to_fix" ? `${(days ?? 0).toFixed(1)} days` : which === "came_back" ? back ? "Came back" : "Held" : formatOperationsDate(job.createdAt);
      return { id: job.id, title: `${job.number} · ${job.problem}`, detail: job.assetName ?? (job.category ? areaName(job.category) : "Not classified"), store: `Store ${job.storeNumber}`, value, bad: back, sort: which === "spend" || which === "cost_per_job" ? -cost : which === "days_to_fix" ? -(days ?? 0) : back ? 0 : 1, href: `/app/work-orders/${encodeURIComponent(job.id)}` };
    }).sort((a, b) => a.sort - b.sort);
  const size = 25, page = Math.max(1, Number(first(query.page) ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pageHref = (next: number) => `${c.href("/app/trends/month", { measure: which, month })}&page=${next}`;
  const pagination: PaginationViewModel | undefined = pages > 1 ? { summary: `Page ${page} of ${pages}`, currentPage: page, totalPages: pages, pageLinks: [], previousHref: page > 1 ? pageHref(page - 1) : undefined, nextHref: page < pages ? pageHref(page + 1) : undefined } : undefined;
  return { scopeLabel: c.scopeLabel, title: `${MEASURE_INFO[which].label} · ${monthName(month, true)}`, value: formatMeasure(which, result.value), definition: MEASURE_INFO[which].definition, count: rows.length,
    rows: rows.slice((page - 1) * size, page * size), pagination, backHref: c.href("/app/trends", { measure: which === "spend" ? undefined : which }) };
}

/** Why spending changed: the jobs and service areas behind each part. */
export function buildTrendWhy(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const c = context(fixture, session, query);
  const change = spendChange(c.data, c.today);
  const job = (row: { job: { id: string; number: string; problem: string; storeNumber: string }; amount: number }) => ({ id: row.job.id, label: `${row.job.number} · ${row.job.problem}`, store: `Store ${row.job.storeNumber}`, amount: money(row.amount), href: `/app/work-orders/${encodeURIComponent(row.job.id)}` });
  return { scopeLabel: c.scopeLabel, backHref: c.href("/app/trends"), before: money(change.before), after: money(change.after), threshold: money(change.bigThreshold),
    parts: Object.fromEntries(change.parts.map(part => [part.id, `${part.amount >= 0 ? "+" : "−"}${money(Math.abs(part.amount))}`])) as Record<"big" | "volume" | "mix" | "rate", string>,
    bigAfter: change.bigJobs.after.map(job), bigBefore: change.bigJobs.before.map(job),
    regular: { jobsBefore: change.regular.jobsBefore, jobsAfter: change.regular.jobsAfter, avgBefore: money(change.regular.avgBefore), avgAfter: money(change.regular.avgAfter) },
    areas: change.areas.map(row => ({ key: row.key, label: areaName(row.key), jobsBefore: row.jobsBefore, jobsAfter: row.jobsAfter, avgBefore: row.avgBefore === undefined ? "—" : money(row.avgBefore), avgAfter: row.avgAfter === undefined ? "—" : money(row.avgAfter),
      shareBefore: change.regular.jobsBefore ? `${Math.round(row.jobsBefore / change.regular.jobsBefore * 100)}%` : "—", shareAfter: change.regular.jobsAfter ? `${Math.round(row.jobsAfter / change.regular.jobsAfter * 100)}%` : "—" })).sort((a, b) => b.jobsAfter - a.jobsAfter) };
}
