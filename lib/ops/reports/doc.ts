import { cachedDateTimeFormat, cachedNumberFormat } from "../intl-format-cache";
import type { ReportAudience, ReportOptions } from "./options";
import type { ReportPeriod } from "./period";

/** A change from a comparison period. "Good" depends on the measure: lower spend is good, more jobs done is good. */
export interface Change { text: string; tone: "good" | "bad" | "neutral" }

export interface Kpi { label: string; value: string; note?: string; changes?: Change[] }
export interface Column { key: string; label: string; align?: "end"; width?: "wide" | "narrow" }
export interface Row { id: string; cells: Record<string, string | undefined>; sub?: Record<string, string | undefined>; href?: string; tone?: "warn" | "muted"; group?: string }

export type Section =
  | { kind: "table"; id: string; title: string; note?: string; columns: Column[]; rows: Row[]; totals?: Record<string, string>; empty?: string; detailOnly?: boolean; more?: string }
  | { kind: "bars"; id: string; title: string; note?: string; items: Array<{ label: string; value: number; display: string; extra?: string; href?: string; other?: boolean }>; empty?: string; detailOnly?: boolean }
  | { kind: "split"; id: string; title: string; note?: string; parts: Array<{ label: string; tone: "vendor" | "in_house" | "other"; value: number; display: string; facts: string[] }> };

export interface ReportDoc {
  reportId: string;
  title: string;
  audience: ReportAudience;
  organizationName: string;
  scopeLabel: string;
  /** Purpose-built reports carry a resolved period with comparisons; older reports carry only a label. */
  period?: ReportPeriod;
  periodLabel?: string;
  options: ReportOptions;
  /** One sentence on what the report is for. */
  purpose: string;
  /** "How this is counted": short plain lines. */
  howCounted: string[];
  /** "What to look at": the few facts worth a reader's attention. */
  highlights: string[];
  kpis: Kpi[];
  sections: Section[];
  /** The main record list, for CSV export. */
  recordsSectionId?: string;
  /** Footer notes, e.g. what the report is not. */
  notes?: string[];
}

export const money = (minor: number) => cachedNumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(minor / 100));
export const count = (n: number) => cachedNumberFormat("en-US").format(n);
export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;
export const days = (d?: number) => d === undefined ? "—" : d < 1 ? "Same day" : `${d < 10 ? d.toFixed(1).replace(/\.0$/, "") : Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`;
export const hours = (seconds: number) => `${cachedNumberFormat("en-US", { maximumFractionDigits: seconds < 36_000 ? 1 : 0 }).format(seconds / 3600)} h`;
export const shortDate = (iso?: string) => iso ? cachedDateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : "—";

/**
 * "Up 12% vs September" / "Down $4,200 vs Oct 2025". `lowerIsBetter` decides the tone.
 * Under $1 or under 1% reads as "About the same"; nothing to compare reads as "No earlier data".
 */
export function change(current: number, previous: number, label: string, opts: { lowerIsBetter?: boolean; asMoney?: boolean } = {}): Change {
  if (!previous && !current) return { text: `None in ${label} either`, tone: "neutral" };
  if (!previous) return { text: `None in ${label}`, tone: "neutral" };
  const diff = current - previous, ratio = diff / Math.abs(previous);
  if (Math.abs(ratio) < 0.01) return { text: `About the same as ${label}`, tone: "neutral" };
  const better = opts.lowerIsBetter ? diff < 0 : diff > 0;
  const size = Math.abs(ratio) >= 10 ? `${Math.round(Math.abs(ratio))}×` : pct(Math.abs(ratio));
  return { text: `${diff > 0 ? "Up" : "Down"} ${size}${opts.asMoney ? ` (${money(Math.abs(diff))})` : ""} vs ${label}`, tone: Math.abs(ratio) < 0.05 ? "neutral" : better ? "good" : "bad" };
}

export const titleCase = (key?: string) => !key ? "Unclassified" : key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase()).replace(/\bHvac\b/, "HVAC");
