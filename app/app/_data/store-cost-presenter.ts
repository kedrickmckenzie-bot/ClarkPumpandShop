import type { ListPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { rollingYearStart, validateDashboardWindow } from "@/lib/ops/dashboard-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { compactStoreLabel } from "@/lib/product/store-label";
import type { OperatorSearchParameters } from "./operator-presenter";

const PAGE_SIZE = 25;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** The dashboard's complete store ranking preserves its service-date window and currency. */
export async function buildStoreCostRanking(repository: OpsRepository, session: OperatorSession, query: OperatorSearchParameters, asOf: string): Promise<ListPageViewModel> {
  const window = { asOf, costFrom: first(query.costFrom) ?? rollingYearStart(asOf), costTo: first(query.costTo) ?? asOf.slice(0, 10), currency: first(query.currency) ?? "USD" };
  const context = { sort: "cost", costFrom: window.costFrom, costTo: window.costTo, currency: window.currency };
  const rankingHref = (extra: Record<string, string> = {}) => `/app/stores?${new URLSearchParams({ ...context, ...extra })}`;
  const page = Number(first(query.page) ?? "1");
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const search = first(query.q)?.trim() ?? "";
  const table = { id: "store-cost-ranking", caption: "Store cost ranking", columns: [{ key: "store", label: "Store" }, { key: "cost", label: "Recorded work cost", align: "end" as const }, { key: "share", label: "Share", align: "end" as const }], rows: [] };
  const pageContext = { title: "Store cost ranking", eyebrow: "Recorded work cost", description: "Compare stores, then open an amount to see its work records.", scopeLabel: session.scopeLabel, secondaryAction: { label: "Store directory", href: "/app/stores" } };
  try { validateDashboardWindow(window); }
  catch {
    return { state: { kind: "error", title: "Choose a valid cost period", message: "The start must be on or before the end, and the period cannot extend beyond the reporting date." }, page: { ...pageContext, primaryAction: { label: "Use the last 12 months", href: "/app/stores?sort=cost" } }, table, resultSummary: "No ranking loaded" };
  }
  const scope = { organizationId: session.organizationId, regionIds: session.regionIds, storeIds: session.storeIds };
  const result = await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE, search });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: window.currency, maximumFractionDigits: 0 }).format(value / 100);
  const costHref = (store?: string) => `/app/work-orders?${new URLSearchParams({ hasCost: "true", costFrom: window.costFrom, costTo: window.costTo, currency: window.currency, ...(store ? { store } : {}) })}`;
  return {
    state: result.items.length || result.totalCount === 0 && !search ? { kind: "ready" } : { kind: "empty", title: result.totalCount ? "This page has no stores" : "No matching stores", message: result.totalCount ? "Open the first page of the ranking." : "Try another store name or number." },
    page: { ...pageContext, periodLabel: `${formatOperationsDate(window.costFrom)} – ${formatOperationsDate(window.costTo)} · ${window.currency}`, updatedLabel: `Source data through ${formatOperationsDate(asOf)}` },
    metrics: search ? undefined : [{ id: "store-ranking-cost", label: "Recorded work cost", value: money(result.totalValue), supportingText: `${result.totalCount === 1 ? "1 store" : `All ${result.totalCount} stores`} in this scope and period`, link: { href: costHref(), label: "Open the cost records" } }],
    table: { ...table, rows: result.items.map(row => ({ id: row.id, label: compactStoreLabel(row.label, session.organizationName), href: costHref(row.id), cells: [
      { key: "store", value: compactStoreLabel(row.label, session.organizationName), link: { href: `/app/stores/${encodeURIComponent(row.id)}`, label: "Open store" } },
      { key: "cost", value: money(row.value), link: { href: costHref(row.id), label: "Open these cost records" } },
      { key: "share", value: result.totalValue ? `${Math.round(row.value / result.totalValue * 100)}%` : "—", secondary: search ? "of matching stores" : "of scope total" },
    ] })) },
    resultSummary: `${result.totalCount} ${search ? "matching " : ""}${result.totalCount === 1 ? "store" : "stores"} · highest cost first`, rowNavigation: "record",
    search: { label: "Search store cost ranking", placeholder: "Store name or number", value: search, action: "/app/stores", preservedParameters: Object.entries(context).map(([name, value]) => ({ name, value })) },
    clearFiltersHref: rankingHref(),
    pagination: totalPages > 1 || currentPage > 1 ? { summary: `${result.totalCount} stores · ${PAGE_SIZE} per page`, currentPage, totalPages,
      pageLinks: [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])].filter(value => value > 0 && value <= totalPages).sort((a, b) => a - b).map(value => ({ page: value, current: value === currentPage, href: rankingHref({ q: search, page: String(value) }) })),
      previousHref: currentPage > 1 ? rankingHref({ q: search, page: String(currentPage - 1) }) : undefined,
      nextHref: currentPage < totalPages ? rankingHref({ q: search, page: String(currentPage + 1) }) : undefined } : undefined,
  };
}
