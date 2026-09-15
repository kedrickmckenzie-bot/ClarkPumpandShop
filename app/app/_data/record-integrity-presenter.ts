import type { ListPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { INTEGRITY_SOURCES, integrityHref, type IntegrityCounts, type IntegritySource } from "@/lib/ops/record-integrity-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { briefRecordHref } from "./owner-brief-query-presenter";
import type { OperatorSearchParameters } from "./operator-presenter";

export interface IntegritySummary { counts: IntegrityCounts; asOf: string; scopeLabel: string; }
const scopeFor = (session: OperatorSession) => ({ organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds });
export async function buildIntegritySummary(repository: OpsRepository, session: OperatorSession, asOf: string): Promise<IntegritySummary> {
  return { counts: (await repository.listRecordIntegrity(scopeFor(session), asOf, { kind: "closed_work", limit: 1 })).counts, asOf, scopeLabel: session.scopeLabel };
}
export async function buildIntegrityRecords(repository: OpsRepository, session: OperatorSession, asOf: string, search: OperatorSearchParameters): Promise<ListPageViewModel> {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const kind = first(search.kind) ?? "missing_action";
  if (!Object.hasOwn(INTEGRITY_SOURCES, kind)) throw new RangeError("Choose a valid record check.");
  const source = kind as IntegritySource;
  const requested = Number(first(search.offset) ?? 0);
  const offset = Number.isSafeInteger(requested) && requested >= 0 ? requested : 0;
  const result = await repository.listRecordIntegrity(scopeFor(session), asOf, { kind: source, limit: 25, offset });
  const optional = ["unclassified_work", "missing_life"].includes(source);
  const descriptions: Partial<Record<IntegritySource, string>> = {
    missing_action: "Open work with no open follow-up task.", aged_invoice: "Fully visible invoices with a review flag open for at least 30 days.",
    verified: "The latest recorded outside-work outcome has a matching verification.", unverified: "The latest outside-work outcome has not been verified. Verification is optional.",
    without_cost: "Closed work with no cost entered. Cost entry is optional.", without_outcome: "Closed work with no outcome in its latest visit record.",
    missing_life: "Optional equipment detail. Category defaults may still support planning.", unclassified_work: "Optional classification, including open and closed work.",
  };
  const href = (value: number) => integrityHref(source, value);
  return {
    state: result.items.length ? { kind: "ready" } : { kind: "empty", title: "No matching records", message: result.totalCount ? "Return to the first page." : "No records match this check in your scope." },
    page: { title: INTEGRITY_SOURCES[source], description: descriptions[source] ?? "Current evidence on resolved and closed work orders.", scopeLabel: session.scopeLabel, periodLabel: `All history · checked ${formatOperationsDate(asOf)}`, secondaryAction: { label: "Owner brief", href: "/app/brief#record-checks" } },
    table: { id: "integrity-records", caption: optional ? "Optional details" : "Supporting records", columns: [{ key: "record", label: "Record" }, { key: "status", label: "Status" }, { key: "date", label: source === "aged_invoice" ? "Flag opened" : "Record date" }],
      rows: result.items.map(row => ({ id: row.id, label: row.label, href: briefRecordHref(row)!, cells: [
        { key: "record", value: row.label, secondary: row.detail, link: { href: briefRecordHref(row)!, label: "Open source record" } },
        { key: "status", value: row.status.replaceAll("_", " ") }, { key: "date", value: row.date ? formatOperationsDate(row.date) : "—" },
      ] })) },
    resultSummary: `${result.totalCount} records`, clearFiltersHref: href(0),
    pagination: result.totalCount > 25 || offset > 0 ? { summary: "25 records per page", currentPage: Math.floor(offset / 25) + 1, totalPages: Math.max(1, Math.ceil(result.totalCount / 25)), pageLinks: [{ page: 1, href: href(0), current: offset === 0 }], previousHref: offset > 0 ? href(Math.max(0, offset - 25)) : undefined, nextHref: result.nextOffset !== undefined ? href(result.nextOffset) : undefined } : undefined,
  };
}
