import { isPeriodKey, type PeriodKey } from "./period";

/** Who did the work: outside vendors, the in-house team, or both. */
export type WorkFilter = "both" | "vendor" | "in_house";
export type DetailLevel = "summary" | "all";
/** Which side of the work a report covers. */
export type ReportAudience = "both" | "vendor" | "in_house";

export interface ReportOptions {
  period: PeriodKey;
  store?: string;
  region?: string;
  vendor?: string;
  work: WorkFilter;
  detail: DetailLevel;
}

const first = (value: string | string[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? undefined;
const safeId = (value?: string) => value && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : undefined;

/**
 * Reads options from a link or a saved schedule. Anything unknown falls back to the report's default,
 * and a report that covers only one side of the work is always locked to that side.
 */
export function parseReportOptions(get: (key: string) => string | string[] | null | undefined, defaults: { period: PeriodKey; audience: ReportAudience }): ReportOptions {
  const period = first(get("period"));
  const work = first(get("work"));
  const detail = first(get("detail"));
  return {
    period: isPeriodKey(period) ? period : defaults.period,
    store: safeId(first(get("store"))),
    region: safeId(first(get("region"))),
    vendor: safeId(first(get("vendor"))),
    work: defaults.audience !== "both" ? defaults.audience : work === "vendor" || work === "in_house" ? work : "both",
    detail: detail === "all" ? "all" : "summary",
  };
}

export function reportOptionsQuery(options: Partial<ReportOptions>) {
  const query = new URLSearchParams();
  for (const key of ["period", "store", "region", "vendor", "work", "detail"] as const) {
    const value = options[key];
    if (value && !(key === "work" && value === "both") && !(key === "detail" && value === "summary")) query.set(key, value);
  }
  return query;
}

export const WORK_LABELS: Record<WorkFilter, string> = { both: "Vendors and in-house", vendor: "Outside vendors", in_house: "In-house team" };
export const AUDIENCE_LABELS: Record<ReportAudience, string> = { both: "Vendors and in-house", vendor: "Outside vendors only", in_house: "In-house team only" };
