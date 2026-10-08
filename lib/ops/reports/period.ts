/**
 * Report periods. Dates are calendar days (YYYY-MM-DD, inclusive) in the organization's zone.
 * Every period carries the period before it and the same period last year, so a report can say
 * "up 8% from September" or "down 3% from October last year" without guessing.
 */
export const PERIOD_PRESETS = ["last_month", "this_month", "last_quarter", "ytd", "last_12"] as const;
export type PeriodPreset = typeof PERIOD_PRESETS[number];
/** A preset, or one named month such as "month:2026-09". */
export type PeriodKey = PeriodPreset | `month:${string}`;

export interface DateRange { from: string; to: string; label: string }
export interface ReportPeriod extends DateRange {
  key: PeriodKey;
  /** The equal-length period just before (absent when it is the same as last year). */
  prior?: DateRange;
  lastYear: DateRange;
  /** Whole days in the period. */
  days: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map(m => m.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const parts = (day: string) => day.split("-").map(Number) as [number, number, number];
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
const monthStart = (y: number, m: number) => ymd(y, m, 1);
const monthEnd = (y: number, m: number) => ymd(y, m, daysIn(y, m));
/** Same calendar day one year earlier (Feb 29 becomes Feb 28). */
const yearBack = (day: string) => { const [y, m, d] = parts(day); return ymd(y - 1, m, Math.min(d, daysIn(y - 1, m))); };
const shift = (y: number, m: number, by: number) => { const i = y * 12 + (m - 1) + by; return [Math.floor(i / 12), (i % 12) + 1] as const; };

export function rangeLabel(from: string, to: string) {
  const [fy, fm, fd] = parts(from), [ty, tm, td] = parts(to);
  if (fd === 1 && td === daysIn(ty, tm)) {
    if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fy}`;
    return fy === ty ? `${SHORT[fm - 1]} – ${SHORT[tm - 1]} ${ty}` : `${SHORT[fm - 1]} ${fy} – ${SHORT[tm - 1]} ${ty}`;
  }
  return fy === ty ? `${SHORT[fm - 1]} ${fd} – ${SHORT[tm - 1]} ${td}, ${ty}` : `${SHORT[fm - 1]} ${fd}, ${fy} – ${SHORT[tm - 1]} ${td}, ${ty}`;
}
const range = (from: string, to: string): DateRange => ({ from, to, label: rangeLabel(from, to) });

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === "string" && ((PERIOD_PRESETS as readonly string[]).includes(value) || /^month:\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  last_month: "Last month", this_month: "This month so far", last_quarter: "Last quarter", ytd: "Year to date", last_12: "Last 12 months",
};

/** Resolves a period against "today" in the organization's zone. */
export function resolvePeriod(key: PeriodKey, today: string): ReportPeriod {
  const [y, m, d] = parts(today);
  let from: string, to: string, prior: DateRange | undefined;
  if (key.startsWith("month:")) {
    const [py, pm] = key.slice(6).split("-").map(Number) as [number, number];
    from = monthStart(py, pm); to = monthEnd(py, pm);
    if (to > today) to = today;
    const [qy, qm] = shift(py, pm, -1);
    prior = range(monthStart(qy, qm), monthEnd(qy, qm));
  } else if (key === "last_month") {
    const [py, pm] = shift(y, m, -1);
    from = monthStart(py, pm); to = monthEnd(py, pm);
    const [qy, qm] = shift(py, pm, -1);
    prior = range(monthStart(qy, qm), monthEnd(qy, qm));
  } else if (key === "this_month") {
    from = monthStart(y, m); to = today;
    const [qy, qm] = shift(y, m, -1);
    prior = range(monthStart(qy, qm), ymd(qy, qm, Math.min(d, daysIn(qy, qm))));
  } else if (key === "last_quarter") {
    const q = Math.floor((m - 1) / 3), [py, pm] = shift(y, q * 3 + 1, -3);
    from = monthStart(py, pm); const [ey, em] = shift(py, pm, 2); to = monthEnd(ey, em);
    const [qy, qm] = shift(py, pm, -3), [ry, rm] = shift(qy, qm, 2);
    prior = range(monthStart(qy, qm), monthEnd(ry, rm));
  } else if (key === "ytd") {
    from = ymd(y, 1, 1); to = today;
  } else {
    from = addDays(yearBack(today), 1); to = today;
  }
  const lastYear = range(yearBack(from), yearBack(to));
  if (key === "last_12" || key === "ytd") prior = undefined;
  return { key, ...range(from, to), prior, lastYear, days: dayCount(from, to) };
}

/** Choices for a period picker: the presets plus the last 12 named months. */
export function periodChoices(today: string) {
  const [y, m] = parts(today);
  const months = Array.from({ length: 12 }, (_, i) => { const [py, pm] = shift(y, m, -(i + 1)); return { value: `month:${py}-${pad(pm)}` as PeriodKey, label: `${MONTHS[pm - 1]} ${py}` }; });
  return [...PERIOD_PRESETS.map(value => ({ value: value as PeriodKey, label: PERIOD_LABELS[value] })), ...months];
}

export const inRange = (day: string | undefined, r: Pick<DateRange, "from" | "to">) => Boolean(day) && day!.slice(0, 10) >= r.from && day!.slice(0, 10) <= r.to;
