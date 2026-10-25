import type { OrganizationScope } from "./repository";
import type { OpsFixture } from "./types";
import { daysToComplete, median, type JobFact, type ReportContext } from "./reports/facts";
import { pmClosedEligible, pmScheduleRowsFromFixture, type PmScheduleRow } from "./pm-schedule-query";

/** The six measures Trends follows. All are worked out from source records; none is a score. */
export const TREND_MEASURES = ["spend", "jobs", "cost_per_job", "days_to_fix", "came_back", "pm_done"] as const;
export type TrendMeasure = typeof TREND_MEASURES[number];
export const MEASURE_INFO: Record<TrendMeasure, { label: string; unit: "money" | "count" | "days" | "percent"; lowerIsBetter: boolean; definition: string }> = {
  spend: { label: "Spending", unit: "money", lowerIsBetter: true, definition: "All repair and maintenance costs, by the date of each cost." },
  jobs: { label: "Repairs", unit: "count", lowerIsBetter: true, definition: "Repairs started each month. Scheduled maintenance isn't counted." },
  cost_per_job: { label: "Average repair cost", unit: "money", lowerIsBetter: true, definition: "Repair costs divided by the number of repairs that had a cost." },
  days_to_fix: { label: "Days to fix", unit: "days", lowerIsBetter: true, definition: "How long a repair usually takes, from reported to fixed." },
  came_back: { label: "Broke again", unit: "percent", lowerIsBetter: true, definition: "Repairs where the same machine needed another repair within 30 days. Repairs from the last 30 days aren't counted yet." },
  pm_done: { label: "Scheduled maintenance completed", unit: "percent", lowerIsBetter: false, definition: "Of the scheduled maintenance that came due, how much got done. Late still counts as done; skipped or canceled maintenance isn't counted." },
};

const DAY = 86_400_000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export interface Range { from: string; to: string }
export interface TrendMonth { key: string; range: Range; partial: boolean }

/** The last 24 calendar months, oldest first; the current month counts only through today. */
export function trendMonths(today: string, count = 24): TrendMonth[] {
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    const key = date.toISOString().slice(0, 7);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { key, range: { from: `${key}-01`, to: end < today ? end : today }, partial: end >= today && index === count - 1 };
  });
}
/** The same days one year earlier, so a partial month is compared fairly. */
export const yearBefore = (range: Range): Range => ({ from: `${Number(range.from.slice(0, 4)) - 1}${range.from.slice(4)}`, to: `${Number(range.to.slice(0, 4)) - 1}${range.to.slice(4)}`.replace(/-02-29$/, "-02-28") });

const inRange = (date: string | undefined, range: Range) => Boolean(date && date.slice(0, 10) >= range.from && date.slice(0, 10) <= range.to);

/** One measured value with the records behind it. */
export interface MeasureValue { value?: number; count: number; jobIds: string[]; occurrenceIds?: string[] }

export interface TrendData { ctx: ReportContext; jobs: JobFact[]; repairs: JobFact[]; pm: PmScheduleRow[] }

export function trendData(ctx: ReportContext, fixture: OpsFixture, scope: OrganizationScope, options: { store?: string; region?: string; category?: string }): TrendData {
  const matches = (category?: string) => !options.category || (options.category === "unclassified" ? !category : category === options.category);
  const jobs = ctx.jobs.filter(job => matches(job.category));
  const pm = pmScheduleRowsFromFixture(fixture, scope, { asOf: ctx.now, store: options.store, region: options.region }).filter(row => matches(row.categoryKey));
  return { ctx, jobs, repairs: jobs.filter(job => !job.pm), pm };
}

export function measure(data: TrendData, which: TrendMeasure, range: Range): MeasureValue {
  if (which === "spend") {
    const rows = data.jobs.filter(job => job.costs.some(cost => inRange(cost.date, range)));
    return { value: rows.reduce((sum, job) => sum + job.costs.reduce((total, cost) => total + (inRange(cost.date, range) ? cost.amountMinor : 0), 0), 0), count: rows.length, jobIds: rows.map(job => job.id) };
  }
  if (which === "jobs") {
    const rows = data.repairs.filter(job => inRange(job.createdAt, range));
    return { value: rows.length, count: rows.length, jobIds: rows.map(job => job.id) };
  }
  if (which === "cost_per_job") {
    const rows = data.repairs.filter(job => job.costs.some(cost => inRange(cost.date, range)));
    const total = rows.reduce((sum, job) => sum + job.costs.reduce((t, cost) => t + (inRange(cost.date, range) ? cost.amountMinor : 0), 0), 0);
    return { value: rows.length ? Math.round(total / rows.length) : undefined, count: rows.length, jobIds: rows.map(job => job.id) };
  }
  if (which === "days_to_fix") {
    const rows = data.repairs.filter(job => job.status !== "cancelled" && inRange(job.completedAt, range));
    return { value: median(rows.flatMap(job => daysToComplete(job) ?? [])), count: rows.length, jobIds: rows.map(job => job.id) };
  }
  if (which === "came_back") {
    const rows = data.repairs.filter(job => job.assetId && job.status !== "cancelled" && inRange(job.completedAt, range) && addDays(job.completedAt!.slice(0, 10), 30) <= data.ctx.today);
    const back = rows.filter(job => cameBack(data, job));
    return { value: rows.length ? back.length / rows.length : undefined, count: rows.length, jobIds: rows.map(job => job.id) };
  }
  const rows = data.pm.filter(row => inRange(row.dueAt, range) && pmClosedEligible(row, data.ctx.now));
  return { value: rows.length ? rows.filter(row => row.status === "completed").length / rows.length : undefined, count: rows.length, jobIds: [], occurrenceIds: rows.map(row => row.id) };
}

/** Another repair on the same machine opened within 30 days of finishing this one. */
export function cameBack(data: TrendData, job: JobFact) {
  if (!job.assetId || !job.completedAt) return false;
  const until = addDays(job.completedAt.slice(0, 10), 30);
  return data.repairs.some(other => other.id !== job.id && other.assetId === job.assetId && other.createdAt > job.completedAt! && other.createdAt.slice(0, 10) <= until);
}

export function lastYear(today: string): { current: Range; prior: Range } {
  const current = { from: addDays(today, -364), to: today };
  return { current, prior: { from: addDays(current.from, -365), to: addDays(today, -365) } };
}

/** What the spend change is made of; the four parts add up exactly to the change. */
export interface SpendChange {
  before: number; after: number;
  parts: Array<{ id: "big" | "volume" | "mix" | "rate"; amount: number }>;
  bigThreshold: number; bigJobs: { before: JobCost[]; after: JobCost[] };
  areas: Array<{ key: string; jobsBefore: number; jobsAfter: number; avgBefore?: number; avgAfter?: number }>;
  regular: { jobsBefore: number; jobsAfter: number; avgBefore: number; avgAfter: number };
}
export interface JobCost { job: JobFact; amount: number }

export function spendChange(data: TrendData, today: string): SpendChange {
  const { current, prior } = lastYear(today);
  const costs = (range: Range): JobCost[] => data.jobs.map(job => ({ job, amount: job.costs.reduce((sum, cost) => sum + (inRange(cost.date, range) ? cost.amountMinor : 0), 0) })).filter(row => row.amount > 0);
  const before = costs(prior), after = costs(current);
  // A one-off is a job far above normal: at least $5,000 and five times the typical job.
  const typical = median([...before, ...after].map(row => row.amount)) ?? 0;
  const bigThreshold = Math.max(500_000, typical * 5);
  const big = (rows: JobCost[]) => rows.filter(row => row.amount >= bigThreshold);
  const regular = (rows: JobCost[]) => rows.filter(row => row.amount < bigThreshold);
  const sum = (rows: JobCost[]) => rows.reduce((total, row) => total + row.amount, 0);
  const r0 = regular(before), r1 = regular(after);
  const n0 = r0.length, n1 = r1.length, s0 = sum(r0), s1 = sum(r1), a0 = n0 ? s0 / n0 : 0;
  const keys = [...new Set([...r0, ...r1].map(row => row.job.category ?? "unclassified"))].sort();
  const group = (rows: JobCost[], key: string) => rows.filter(row => (row.job.category ?? "unclassified") === key);
  let mix = 0, rate = 0;
  for (const key of keys) {
    const g0 = group(r0, key), g1 = group(r1, key);
    const avg0 = g0.length ? sum(g0) / g0.length : a0, avg1 = g1.length ? sum(g1) / g1.length : 0;
    const p0 = n0 ? g0.length / n0 : 0, p1 = n1 ? g1.length / n1 : 0;
    mix += n1 * (p1 - p0) * avg0;
    rate += n1 * p1 * (avg1 - avg0);
  }
  const volume = (n1 - n0) * a0;
  const bigChange = sum(big(after)) - sum(big(before));
  // Round each part, then put any rounding remainder on the largest so the parts still add up to the exact change.
  const parts = [{ id: "big" as const, amount: Math.round(bigChange) }, { id: "volume" as const, amount: Math.round(volume) }, { id: "mix" as const, amount: Math.round(mix) }, { id: "rate" as const, amount: Math.round(rate) }];
  const exact = sum(after) - sum(before), drift = exact - parts.reduce((total, part) => total + part.amount, 0);
  if (drift) [...parts].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0]!.amount += drift;
  return {
    before: sum(before), after: sum(after), parts, bigThreshold,
    bigJobs: { before: big(before).sort((a, b) => b.amount - a.amount), after: big(after).sort((a, b) => b.amount - a.amount) },
    areas: keys.map(key => { const g0 = group(r0, key), g1 = group(r1, key); return { key, jobsBefore: g0.length, jobsAfter: g1.length, avgBefore: g0.length ? Math.round(sum(g0) / g0.length) : undefined, avgAfter: g1.length ? Math.round(sum(g1) / g1.length) : undefined }; }),
    regular: { jobsBefore: n0, jobsAfter: n1, avgBefore: Math.round(a0), avgAfter: n1 ? Math.round(s1 / n1) : 0 },
  };
}

/** Spend change last 12 months vs. the 12 before, by store, service area or vendor. */
export function movers(data: TrendData, today: string, by: "store" | "area" | "vendor") {
  const { current, prior } = lastYear(today);
  const totals = new Map<string, { before: number; after: number }>();
  for (const job of data.jobs) for (const cost of job.costs) {
    const key = by === "store" ? job.storeId : by === "area" ? job.category ?? "unclassified" : cost.provider === "in_house" ? "in_house" : cost.vendorId ?? job.vendorId ?? "unmarked";
    const row = totals.get(key) ?? { before: 0, after: 0 };
    if (inRange(cost.date, current)) row.after += cost.amountMinor; else if (inRange(cost.date, prior)) row.before += cost.amountMinor; else continue;
    totals.set(key, row);
  }
  return [...totals].map(([key, row]) => ({ key, ...row, change: row.after - row.before })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.key.localeCompare(b.key));
}

/** Months well above normal (at least 1.6× the typical month and $5,000 more), with the job that cost most that month. */
export function unusualMonths(data: TrendData, months: TrendMonth[]) {
  const values = months.map(month => ({ month, value: measure(data, "spend", month.range).value ?? 0 }));
  const typical = median(values.filter(row => !row.month.partial).map(row => row.value)) ?? 0;
  return values.filter(row => typical && row.value >= typical * 1.6 && row.value - typical >= 500_000).map(row => {
    const top = data.jobs.map(job => ({ job, amount: job.costs.reduce((sum, cost) => sum + (inRange(cost.date, row.month.range) ? cost.amountMinor : 0), 0) })).sort((a, b) => b.amount - a.amount)[0];
    return { month: row.month, value: row.value, typical, top };
  }).reverse();
}
