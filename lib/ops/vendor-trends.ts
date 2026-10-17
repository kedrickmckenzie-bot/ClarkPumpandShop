import { civilDate } from "./dispatch-calendar";
import type { JobFact } from "./reports/facts";
import { jobResult, notCountedReason, type VendorJobFact } from "./vendor-scorecard";

/**
 * Outside-vendor trends month by month. Per-job rules come from the vendor scorecard (jobResult), so the trend
 * and the scorecard always agree; this file only groups jobs into months and says whether a change looks like
 * one bad month or a real trend.
 */
export const VENDOR_TREND_MEASURES = ["spend", "jobs", "onTime", "callbacks", "costPerJob"] as const;
export type VendorTrendMeasure = typeof VENDOR_TREND_MEASURES[number];
export const isVendorTrendMeasure = (value: unknown): value is VendorTrendMeasure => (VENDOR_TREND_MEASURES as readonly unknown[]).includes(value);

export const VENDOR_TREND_INFO: Record<VendorTrendMeasure, { label: string; unit: "money" | "count" | "percent"; direction: "higher" | "lower" | "neutral"; basis: string }> = {
  spend: { label: "Outside spend", unit: "money", direction: "neutral", basis: "Recorded vendor work cost, by the month it was recorded. Faint line: same month last year." },
  jobs: { label: "Jobs sent to vendors", unit: "count", direction: "neutral", basis: "Jobs first sent in the month. Cancelled jobs are left out. Faint line: same month last year." },
  onTime: { label: "Done by the agreed date", unit: "percent", direction: "higher", basis: "Jobs sent in the month that were finished by their agreed date." },
  callbacks: { label: "Callbacks", unit: "percent", direction: "lower", basis: "Repairs on equipment that needed another repair within 30 days. Jobs sent in the month." },
  costPerJob: { label: "Cost per job", unit: "money", direction: "neutral", basis: "Average recorded cost of jobs sent in the month, for jobs with a cost." },
};

/** Fewer jobs than this in a month are too few to judge that month. */
export const SMALL_MONTH = 3;

export interface VendorTrendPoint {
  month: string;
  value?: number;
  /** Jobs that counted toward this month's value. */
  counted: number;
  tooFew: boolean;
  /** The month is still running. */
  partial: boolean;
  /** The same month a year earlier (spend only). */
  lastYear?: number;
}

export interface VendorTrendVerdict { tone: "good" | "bad" | "neutral"; text: string; short: string }
export interface VendorTrendSeries { key: VendorTrendMeasure; points: VendorTrendPoint[]; normal?: number; verdict: VendorTrendVerdict }

export interface VendorTrendFilter { vendorId?: string; category?: string }

/** The last `count` calendar months ending with the current one, oldest first ("2026-10"). */
export function trendMonths(today: string, count = 12) {
  const [year, month] = today.slice(0, 7).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return d.toISOString().slice(0, 7);
  });
}

const shiftYear = (month: string, years: number) => `${Number(month.slice(0, 4)) + years}${month.slice(4)}`;
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const monthName = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** Whether a vendor job matches the chosen vendor and category. Uncategorized jobs only count under "all categories". */
export const factMatches = (fact: VendorJobFact, filter: VendorTrendFilter) =>
  (!filter.vendorId || fact.vendorId === filter.vendorId) && (!filter.category || fact.trade === filter.category);

export const factMonth = (fact: VendorJobFact, timeZone: string) => civilDate(fact.sentAt, timeZone).slice(0, 7);

/** Vendor cost lines on matching jobs, as [job, line] pairs. */
function vendorCostLines(jobs: JobFact[], filter: VendorTrendFilter) {
  return jobs.filter((job) => !filter.category || job.category === filter.category)
    .flatMap((job) => job.costs.filter((line) => line.provider === "vendor" && (!filter.vendorId || line.vendorId === filter.vendorId)).map((line) => ({ job, line })));
}

export function spendSeries(jobs: JobFact[], months: string[], filter: VendorTrendFilter, today: string): VendorTrendSeries {
  const totals = new Map<string, { amount: number; jobs: Set<string> }>();
  for (const { job, line } of vendorCostLines(jobs, filter)) {
    const key = line.date.slice(0, 7), entry = totals.get(key) ?? { amount: 0, jobs: new Set() };
    entry.amount += line.amountMinor; entry.jobs.add(job.id); totals.set(key, entry);
  }
  const current = today.slice(0, 7);
  const points = months.map((month) => ({ month, value: totals.get(month)?.amount ?? 0, counted: totals.get(month)?.jobs.size ?? 0, tooFew: false, partial: month === current, lastYear: totals.get(shiftYear(month, -1))?.amount ?? 0 }));
  return withVerdict("spend", points);
}

export function factSeries(facts: VendorJobFact[], months: string[], key: Exclude<VendorTrendMeasure, "spend">, filter: VendorTrendFilter, now: string, timeZone: string, today: string): VendorTrendSeries {
  const byMonth = new Map<string, VendorJobFact[]>();
  for (const fact of facts) if (factMatches(fact, filter)) { const m = factMonth(fact, timeZone); byMonth.set(m, [...byMonth.get(m) ?? [], fact]); }
  const current = today.slice(0, 7);
  const points = months.map((month): VendorTrendPoint => {
    const rows = byMonth.get(month) ?? [];
    if (key === "jobs") return { month, value: rows.length, counted: rows.length, tooFew: false, partial: month === current, lastYear: byMonth.get(shiftYear(month, -1))?.length ?? 0 };
    const results = rows.map((fact) => jobResult(fact, key === "costPerJob" ? "cost" : key, now)).filter((r) => r.counted);
    const value = !results.length ? undefined : key === "costPerJob" ? results.reduce((sum, r) => sum + (r.value ?? 0), 0) / results.length : results.filter((r) => r.hit).length / results.length;
    return { month, value, counted: results.length, tooFew: results.length > 0 && results.length < SMALL_MONTH, partial: month === current };
  });
  return withVerdict(key, points);
}

/**
 * "Normal" is the middle value of the finished months with enough jobs. A month is unusual when it is far from
 * normal: 10 points for percentages, a quarter for money and counts. The last three finished months decide a trend.
 */
export function withVerdict(key: VendorTrendMeasure, points: VendorTrendPoint[]): VendorTrendSeries {
  const info = VENDOR_TREND_INFO[key];
  if (key === "spend" || key === "jobs") return { key, points, verdict: yearOverYear(key, points) };
  const judged = points.filter((p) => !p.partial && !p.tooFew && p.value !== undefined);
  if (judged.length < 4) return { key, points, verdict: { tone: "neutral", text: "Not enough jobs yet to see a trend.", short: "Too few jobs" } };
  const normal = median(judged.map((p) => p.value!));
  const off = (p: VendorTrendPoint) => {
    const gap = p.value! - normal;
    const big = info.unit === "percent" ? Math.abs(gap) >= 0.1 : normal > 0 ? Math.abs(gap) >= normal * 0.25 : gap !== 0;
    if (!big) return 0;
    if (info.direction === "neutral") return gap > 0 ? 1 : -1;
    return (gap > 0) === (info.direction === "higher") ? -1 : 1; // 1 = worse
  };
  const neutral = info.direction === "neutral";
  const word = (sign: number) => neutral ? (sign > 0 ? "higher" : "lower") : (sign > 0 ? "worse" : "better");
  const tone = (sign: number): VendorTrendVerdict["tone"] => neutral ? "neutral" : sign > 0 ? "bad" : "good";
  const last3 = judged.slice(-3);
  for (const sign of [1, -1]) if (last3.length === 3 && last3.every((p) => off(p) === sign)) {
    return { key, points, normal, verdict: { tone: tone(sign), text: `${neutral ? (sign > 0 ? "Rising" : "Falling") : sign > 0 ? "Getting worse" : "Getting better"}: the last 3 months were all ${word(sign)} than normal.`, short: neutral ? (sign > 0 ? "Rising" : "Falling") : sign > 0 ? "Getting worse" : "Getting better" } };
  }
  const recent = judged.slice(-6), flagged = recent.filter((p) => off(p) > 0 || (neutral && off(p) !== 0));
  if (!flagged.length) return { key, points, normal, verdict: { tone: "good", text: "Steady. No unusual months lately.", short: "Steady" } };
  const names = flagged.map((p) => monthName(p.month));
  const latest = judged.at(-1)!;
  const sign = off(flagged[0]!);
  if (flagged.length === 1 && flagged[0] === latest) return { key, points, normal, verdict: { tone: tone(sign), text: `${names[0]} was ${word(sign)} than normal. Too soon to call it a trend.`, short: `${names[0]} ${word(sign)}` } };
  if (flagged.length === 1) return { key, points, normal, verdict: { tone: "neutral", text: `One ${neutral ? "unusual" : "bad"} month (${names[0]}). Back to normal since.`, short: `One ${neutral ? "unusual" : "bad"} month` } };
  return { key, points, normal, verdict: neutral ? { tone: "neutral", text: `Varies month to month: unusual in ${names.join(", ")}.`, short: "Varies" } : { tone: "bad", text: `Worse than normal in ${names.join(", ")}. Not yet 3 months in a row.`, short: `${flagged.length} bad months` } };
}

/** Spend and job counts swing with the seasons, so they are compared with the same months a year earlier. */
function yearOverYear(key: "spend" | "jobs", points: VendorTrendPoint[]): VendorTrendVerdict {
  const last3 = points.filter((p) => !p.partial).slice(-3);
  const now = last3.reduce((sum, p) => sum + (p.value ?? 0), 0), before = last3.reduce((sum, p) => sum + (p.lastYear ?? 0), 0);
  const span = last3.length ? `${monthName(last3[0]!.month)}–${monthName(last3.at(-1)!.month)}` : "";
  if (!before) return { tone: "neutral", text: `No ${key === "spend" ? "vendor spend" : "vendor jobs"} in ${span} last year to compare with.`, short: "Nothing to compare" };
  const change = (now - before) / before;
  if (Math.abs(change) < 0.15) return { tone: "neutral", text: `${span}: about the same as the same months last year.`, short: "Same as last year" };
  const pct = `${Math.round(Math.abs(change) * 100)}%`;
  return { tone: "neutral", text: `${span}: ${change > 0 ? "up" : "down"} ${pct} from the same months last year.`, short: `${change > 0 ? "Up" : "Down"} ${pct} vs last year` };
}

export interface VendorTrendJob { workOrderId: string; number: string; problem: string; storeId: string; vendorName: string; result: string; amountMinor?: number }

/** The jobs behind one month of one chart, with what each contributed. */
export function monthJobs(input: { facts: VendorJobFact[]; jobs: JobFact[]; month: string; key: VendorTrendMeasure; filter: VendorTrendFilter; now: string; timeZone: string; vendorName: (id?: string) => string }): VendorTrendJob[] {
  const { month, key, filter, now } = input;
  if (key === "spend") {
    const byJob = new Map<string, VendorTrendJob>();
    for (const { job, line } of vendorCostLines(input.jobs, filter)) {
      if (line.date.slice(0, 7) !== month) continue;
      const row = byJob.get(job.id) ?? { workOrderId: job.id, number: job.number, problem: job.problem, storeId: job.storeId, vendorName: input.vendorName(line.vendorId ?? job.vendorId), result: "", amountMinor: 0 };
      row.amountMinor = (row.amountMinor ?? 0) + line.amountMinor; byJob.set(job.id, row);
    }
    return [...byJob.values()].sort((a, b) => (b.amountMinor ?? 0) - (a.amountMinor ?? 0) || a.number.localeCompare(b.number));
  }
  const measure = key === "costPerJob" ? "cost" : key;
  return input.facts.filter((fact) => factMatches(fact, filter) && factMonth(fact, input.timeZone) === month).map((fact) => {
    const r = jobResult(fact, measure, now);
    const result = key === "jobs" ? (fact.firstCompletedAt ? "Done" : fact.declined ? "Declined" : "Not done yet")
      : !r.counted ? `Not counted: ${notCountedReason(fact, measure, now) ?? "no result yet"}`
        : key === "onTime" ? (r.hit ? "On time" : "Late")
          : key === "callbacks" ? (r.hit ? "Repaired again within 30 days" : "Held up 30 days")
            : "Cost recorded";
    return { workOrderId: fact.workOrderId, number: fact.number, problem: fact.problem, storeId: fact.storeId, vendorName: fact.vendorName, result, amountMinor: key === "costPerJob" && r.counted ? r.value : undefined };
  }).sort((a, b) => Number(a.result.startsWith("Not counted")) - Number(b.result.startsWith("Not counted")) || a.number.localeCompare(b.number));
}
