import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import type { DashboardWindow } from "@/lib/ops/dashboard-query";
import { rollingYearStart, validateDashboardWindow } from "@/lib/ops/dashboard-query";
import { equipmentIssueHistoryHref, equipmentIssueRankingHref, type EquipmentIssuePage } from "@/lib/ops/equipment-issues";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { OpsRepository } from "@/lib/ops/repository";
import type { DashboardPageViewModel, ListPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import { compactStoreLabel } from "@/lib/product/store-label";

export function presentEquipmentIssues(result: EquipmentIssuePage, window: DashboardWindow, session: OperatorSession): NonNullable<DashboardPageViewModel["equipmentIssues"]> {
  const money = (amount: number) => cachedNumberFormat("en-US", { style: "currency", currency: window.currency, minimumFractionDigits: 2 }).format(amount / 100);
  return { period: `${formatOperationsDate(window.costFrom)}–${formatOperationsDate(window.costTo)}`, currency: window.currency,
    totalCount: result.totalCount, href: equipmentIssueRankingHref(window),
    rows: result.items.map(row => ({ ...row, storeLabel: compactStoreLabel(row.storeLabel, session.organizationName),
      href: equipmentIssueHistoryHref(row.id, window), latestIssue: formatOperationsDate(row.latestIssue.slice(0, 10)),
      cost: row.costWorkCount ? money(row.recordedCostMinor) : "Not recorded", coverage: `${row.costWorkCount} of ${row.issueCount} ${row.issueCount === 1 ? "issue" : "issues"} with ${window.currency} costs`,
    })),
  };
}

export async function buildEquipmentIssueRanking(repository: OpsRepository, session: OperatorSession, query: Record<string, string | string[] | undefined>, asOf: string): Promise<ListPageViewModel> {
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const window = { asOf, costFrom: first(query.issueFrom) ?? rollingYearStart(asOf), costTo: first(query.issueTo) ?? asOf.slice(0, 10), currency: first(query.currency) ?? "USD" };
  const requestedPage = Number(first(query.page) ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const table: ListPageViewModel["table"] = { id: "equipment-issues", caption: "Equipment ranked by issue count", columns: [{ key: "asset", label: "Equipment" }, { key: "store", label: "Store" }, { key: "issues", label: "Issues", align: "end" }, { key: "cost", label: `Recorded work cost · ${window.currency}` }, { key: "latest", label: "Latest issue" }], rows: [] };
  const context = { title: "Most frequent equipment issues", scopeLabel: session.scopeLabel, description: "Unplanned work orders opened in this period. Scheduled maintenance and cancelled work are excluded. Each work order counts once.", secondaryAction: { label: "Equipment directory", href: "/app/equipment" }, primaryAction: { label: "Back to Overview", href: session.role === "executive" ? "/app/brief#equipment-issues" : "/app/overview#equipment-issues" } };
  try { validateDashboardWindow(window); } catch {
    return { state: { kind: "error", title: "Choose a valid issue period", message: "Open the ranking again from Overview to use its reporting period." }, page: context, table, resultSummary: "No ranking loaded" };
  }
  const result = await repository.listEquipmentIssues({ organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds }, window, { limit: 25, offset: (page - 1) * 25 });
  const model = presentEquipmentIssues(result, window, session);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / 25));
  return { state: { kind: "ready" }, page: { ...context, periodLabel: model.period }, rowNavigation: "record",
    table: { ...table, rows: model.rows.map(row => ({ id: row.id, label: row.name, href: row.href, cells: [
      { key: "asset", value: row.name, secondary: row.assetTag, link: { label: "Open equipment history", href: row.href } },
      { key: "store", value: row.storeLabel }, { key: "issues", value: String(row.issueCount), link: { label: "Open these issues", href: row.href } },
      { key: "cost", value: row.cost, secondary: row.coverage }, { key: "latest", value: row.latestIssue },
    ] })) }, resultSummary: `${result.totalCount} equipment records · highest issue count first · only work linked to equipment is ranked`,
    clearFiltersHref: equipmentIssueRankingHref(window),
    pagination: totalPages > 1 || page > 1 ? { summary: `${result.totalCount} equipment records · 25 per page`, currentPage: page, totalPages,
      pageLinks: [...new Set([1, page - 1, page, page + 1, totalPages])].filter(n => n > 0 && n <= totalPages).sort((a,b) => a-b).map(n => ({ page: n, current: n === page, href: equipmentIssueRankingHref(window, n) })),
      previousHref: page > 1 ? equipmentIssueRankingHref(window, page - 1) : undefined, nextHref: page < totalPages ? equipmentIssueRankingHref(window, page + 1) : undefined } : undefined,
  };
}
