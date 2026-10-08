import type { ListPageViewModel, ProgramPageViewModel } from "@/components/ops/data-contract";
import type { ReportCatalogEntry } from "../report-catalog";
import type { Column, ReportDoc, Section } from "./doc";
import type { ReportOptions } from "./options";

/** Screen hints that make no sense on paper. */
const SCREEN_SPEAK = /\b(click|open|choose|select|visible rather|forced into a guess|continue into|drill|tap)\b/i;
const SUMMARY_ROWS = 25;

/**
 * Runs an older screen-based report through the report layout: keeps its numbers and records,
 * drops columns that say the same thing on every row and screen-only hints, and honors summary vs all records.
 */
export function legacyReportDoc(entry: ReportCatalogEntry, model: ListPageViewModel | ProgramPageViewModel, organizationName: string, options: ReportOptions): ReportDoc {
  const all = options.detail === "all";
  const howCounted = [entry.definition];
  const sections: Section[] = [];
  for (const breakdown of ("breakdowns" in model ? model.breakdowns : []).filter(b => b.segments.length).slice(0, 2)) {
    sections.push({ kind: "bars", id: breakdown.id, title: breakdown.title, note: breakdown.coverageLabel && !SCREEN_SPEAK.test(breakdown.coverageLabel) ? breakdown.coverageLabel : undefined,
      items: breakdown.segments.filter(seg => seg.value > 0 || all).slice(0, all ? 100 : 10).map(seg => ({ label: seg.label, value: seg.value, display: seg.formattedValue, extra: seg.shareLabel })) });
  }
  const table = model.table;
  if (table) {
    // A column with one value on every row (e.g. "Source basis: Recorded work cost") becomes a line under "How this is counted".
    const constant = table.rows.length > 1 ? table.columns.filter(column => new Set(table.rows.map(row => row.cells.find(c => c.key === column.key)?.value ?? "")).size === 1) : [];
    for (const column of constant) {
      const value = table.rows[0]!.cells.find(c => c.key === column.key)?.value;
      if (value) howCounted.push(`${column.label}: ${value} on every row.`);
    }
    const columns: Column[] = table.columns.filter(c => !constant.includes(c)).map(c => ({ key: c.key, label: c.label, align: c.align === "end" ? "end" : undefined }));
    const rows = all ? table.rows : table.rows.slice(0, SUMMARY_ROWS);
    const total = model.pagination ? Number(model.pagination.summary.match(/of\s+([\d,]+)/)?.[1]?.replaceAll(",", "") ?? table.rows.length) : table.rows.length;
    sections.push({ kind: "table", id: "records", title: table.caption || "Records", columns,
      rows: rows.map(row => ({ id: row.id, href: row.href, cells: Object.fromEntries(row.cells.map(c => [c.key, c.value])), sub: Object.fromEntries(row.cells.filter(c => c.secondary && !SCREEN_SPEAK.test(c.secondary)).map(c => [c.key, c.secondary])) })),
      empty: "No records in this scope and period.",
      more: total > rows.length ? `${total - rows.length} more ${all ? "are in the live report" : "in the full version (choose “Every record”)"}` : undefined });
  }
  return {
    reportId: entry.id, title: entry.title, audience: entry.audience, organizationName, scopeLabel: model.page.scopeLabel,
    periodLabel: model.page.periodLabel ?? model.page.updatedLabel ?? "Current records", options,
    purpose: entry.description, howCounted, highlights: [],
    kpis: (model.metrics ?? []).slice(0, 6).map(m => ({ label: m.label, value: m.value, note: m.supportingText && m.supportingText.length <= 60 && !SCREEN_SPEAK.test(m.supportingText) ? m.supportingText : undefined })),
    sections, recordsSectionId: table ? "records" : undefined,
  };
}
