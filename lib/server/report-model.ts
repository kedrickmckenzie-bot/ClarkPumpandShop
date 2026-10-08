import "server-only";
import { loadListModel, loadProgramModel } from "@/app/app/_data/operator-loader";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";

/** Filters a report link may carry; anything else is ignored. */
export const REPORT_FILTER_KEYS = ["store", "region", "category", "status", "period", "from", "costFrom", "costMonth"] as const;

/**
 * One report's full source rows, for the CSV export and the printable version alike,
 * so both show exactly the same records as the live view in the same scope.
 */
export async function loadReportModel(reportId: string, incoming: (key: string) => string | null | undefined) {
  const definition = reportCatalogEntry(reportId);
  if (!definition) return undefined;
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
