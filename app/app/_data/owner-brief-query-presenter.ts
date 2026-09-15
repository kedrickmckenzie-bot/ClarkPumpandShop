import type { OperatorSession, ListPageViewModel } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { BRIEF_SOURCES, briefSourceHref, validateBriefPeriod, type BriefSource, type BriefSourceRow, type BriefSummary } from "@/lib/ops/owner-brief-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { compactStoreLabel } from "@/lib/product/store-label";
import type { OperatorSearchParameters } from "./operator-presenter";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export const briefMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
export const briefRecordHref = (row: BriefSourceRow) => {
  const routes = { work_order: "work-orders", invoice: "invoices", asset: "equipment", request: "requests", store: "stores", pm_occurrence: "pm/occurrences" };
  return row.entityType && row.entityId ? `/app/${routes[row.entityType]}/${encodeURIComponent(row.entityId)}` : undefined;
};
export function briefPeriod(query: OperatorSearchParameters, asOf: string) {
  const period = { from: first(query.from) ?? new Date(Date.parse(asOf) - 29 * 86_400_000).toISOString().slice(0, 10), to: first(query.to) ?? asOf.slice(0, 10), currency: first(query.currency) ?? "USD", asOf };
  validateBriefPeriod(period);
  return period;
}
const scopeFor = (session: OperatorSession) => ({ organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds });
export async function buildQueryOwnerBrief(repository: OpsRepository, session: OperatorSession, query: OperatorSearchParameters, asOf: string): Promise<BriefSummary & { scopeLabel: string }> {
  const period = briefPeriod(query, asOf);
  const sources = Object.fromEntries(await Promise.all((Object.keys(BRIEF_SOURCES) as BriefSource[]).map(async kind => [kind, await repository.listBriefSources(scopeFor(session), period, { kind, limit: kind === "decisions" ? 6 : kind === "stores" ? 5 : 1 })]))) as BriefSummary["sources"];
  sources.stores.items = sources.stores.items.map(row => ({ ...row, label: compactStoreLabel(row.label, session.organizationName) }));
  return { period, sources, scopeLabel: session.scopeLabel };
}
export async function buildQueryBriefRecords(repository: OpsRepository, session: OperatorSession, query: OperatorSearchParameters, asOf: string): Promise<ListPageViewModel> {
  const period = briefPeriod(query, asOf);
  const kind = first(query.kind) ?? "recorded_cost";
  if (!Object.hasOwn(BRIEF_SOURCES, kind)) throw new RangeError("Choose a brief record type.");
  const source = kind as BriefSource;
  const offsetInput = Number(first(query.offset) ?? 0);
  const offset = Number.isSafeInteger(offsetInput) && offsetInput >= 0 ? offsetInput : 0;
  const storeId = first(query.store);
  const result = await repository.listBriefSources(scopeFor(session), period, { kind: source, storeId, offset, limit: 25 });
  const selectedStore = storeId ? (await repository.listBriefSources(scopeFor(session), period, { kind: "stores", storeId, limit: 1 })).items[0] : undefined;
  const moneySource = ["recorded_cost", "invoice_review", "verified_value", "opportunity", "other_exposure", "stores"].includes(kind);
  const current = ["invoice_review", "active_work", "escalations", "decisions"].includes(kind);
  const href = (nextOffset: number) => briefSourceHref(period, source, nextOffset, storeId);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / 25));
  const currentPage = Math.floor(offset / 25) + 1;
  return {
    state: result.items.length ? { kind: "ready" } : { kind: "empty", title: "No records on this page", message: result.totalCount ? "Return to the first page." : "Nothing matches this scope and period." },
    page: { title: BRIEF_SOURCES[source], description: current ? "Current records in your scope." : "Source records for this brief period.", scopeLabel: `${session.scopeLabel}${storeId ? ` · ${selectedStore ? compactStoreLabel(selectedStore.label, session.organizationName) : "No matching store"}` : ""}`, periodLabel: `${current ? `As of ${formatOperationsDate(asOf)}` : `${formatOperationsDate(period.from)} – ${formatOperationsDate(period.to)}`} · ${period.currency}`, secondaryAction: { label: "Owner brief", href: `/app/brief?${new URLSearchParams({ from: period.from, to: period.to, currency: period.currency })}` } },
    table: {
      id: "brief-source-records", caption: BRIEF_SOURCES[source], columns: [{ key: "record", label: source === "stores" ? "Store" : "Record" }, { key: "status", label: "Status" }, ...(moneySource ? [{ key: "amount", label: "Amount", align: "end" as const }] : []), ...(source === "stores" ? [{ key: "opened", label: "Work opened", align: "end" as const }] : [{ key: "date", label: "Date" }])],
      rows: result.items.map(row => {
        const targetHref = briefRecordHref(row);
        const recordHref = targetHref && row.entityType === "pm_occurrence" ? `${targetHref}?${new URLSearchParams({ returnTo: href(offset) })}` : targetHref;
        const label = source === "stores" ? compactStoreLabel(row.label, session.organizationName) : row.label.replaceAll("_", " ");
        return { id: row.id, label, href: recordHref ?? href(offset), cells: [
          { key: "record", value: label, secondary: row.detail && row.detail !== row.status ? row.detail : undefined, link: recordHref ? { href: recordHref, label: "Open source record" } : undefined },
          { key: "status", value: row.status.replaceAll("_", " ") },
          ...(moneySource ? [{ key: "amount", value: briefMoney(row.amountMinor, period.currency), link: source === "stores" ? { href: briefSourceHref(period, "recorded_cost", 0, row.id), label: "Open store cost records" } : undefined }] : []),
          ...(source === "stores" ? [{ key: "opened", value: String(row.openedWork ?? 0), link: { href: briefSourceHref(period, "opened_work", 0, row.id), label: "Open this store's work" } }] : [{ key: "date", value: row.date ? formatOperationsDate(row.date) : "—" }]),
        ] };
      }),
    },
    resultSummary: `${result.totalCount} records${moneySource ? ` · ${briefMoney(result.totalAmountMinor, period.currency)} ${period.currency}` : ""}`, clearFiltersHref: href(0),
    pagination: totalPages > 1 || offset > 0 ? { summary: `${result.totalCount} records · 25 per page`, currentPage, totalPages, pageLinks: [{ page: 1, href: href(0), current: offset === 0 }], previousHref: offset > 0 ? href(Math.max(0, offset - 25)) : undefined, nextHref: result.nextOffset !== undefined ? href(result.nextOffset) : undefined } : undefined,
  };
}
