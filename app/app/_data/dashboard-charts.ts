import type { BreakdownViewModel, TrendViewModel } from "@/components/ops/data-contract";
import type { DashboardActivitySummary, DashboardBreakdownKind, DashboardBreakdownPage, DashboardWindow } from "@/lib/ops/dashboard-query";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { workspaceStartHref } from "@/lib/ops/navigation-trail";
import { workStatusLabel } from "@/lib/product/work-status-label";
import { domainLabel } from "@/lib/product/domain-label";
import { compactStoreLabel } from "@/lib/product/store-label";
import type { WorkOrder } from "@/lib/ops/types";

export const DASHBOARD_CHART_LIMITS = { cost_store: 5, cost_category: 5, cost_month: 12, work_status: 25, active_vendor: 5, observed_vendor: 5 } as const;
export type DashboardChartPages = Record<DashboardBreakdownKind, DashboardBreakdownPage>;
export async function loadDashboardChartPages(repository: OpsRepository, scope: OrganizationScope, window: DashboardWindow): Promise<DashboardChartPages> {
  const kinds = Object.keys(DASHBOARD_CHART_LIMITS) as DashboardBreakdownKind[];
  const pages = await Promise.all(kinds.map(kind => repository.listDashboardBreakdown(scope, window, { kind, limit: DASHBOARD_CHART_LIMITS[kind] })));
  return Object.fromEntries(kinds.map((kind, index) => [kind, pages[index]])) as DashboardChartPages;
}
function href(path: string, values: Record<string, string>) { return `${path}?${new URLSearchParams(values)}`; }

/** Totals and shares describe the complete cohort; visible rows are only a short ranking. */
export function presentDashboardCharts(pages: DashboardChartPages, activity: DashboardActivitySummary, window: DashboardWindow, organizationName?: string) {
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: window.currency, maximumFractionDigits: 0 }).format(value / 100);
  const costContext = { costFrom: window.costFrom, costTo: window.costTo, currency: window.currency };
  const categories = { ...pages.cost_category, items: [...pages.cost_category.items] };
  if (activity.unclassifiedWork && !categories.items.some(row => row.id === "unclassified")) categories.items.push({ id: "unclassified", label: "unclassified", value: activity.unclassifiedCostMinor });
  const cost = (page: DashboardBreakdownPage, id: string, title: string, kind: "store" | "category", sourceLink: BreakdownViewModel["sourceLink"]): BreakdownViewModel => ({
    id, title, totalLabel: money(page.totalValue), totalValue: page.totalValue,
    coverageLabel: page.totalCount > page.items.length ? `Showing ${page.items.length} of ${page.totalCount} ${kind === "store" ? "stores" : "service areas"}. Total includes all.` : undefined,
    segments: page.items.map((row, index) => ({ id: row.id, label: kind === "category" ? domainLabel(row.id) : compactStoreLabel(row.label, organizationName), value: row.value, formattedValue: money(row.value), shareLabel: page.totalValue ? `${Math.round(row.value / page.totalValue * 100)}% of recorded cost` : "No recorded cost", tone: index === 0 ? "warning" : "neutral", link: { href: href("/app/work-orders", { [kind]: row.id, hasCost: "true", ...costContext }), label: kind === "store" ? "Open this store's cost" : "Drill into this service area" } })),
    sourceLink,
  });
  const count = (page: DashboardBreakdownPage, id: string, title: string, noun: string, hrefFor: (id: string) => string, sourceLink: BreakdownViewModel["sourceLink"], status = false): BreakdownViewModel => ({
    id, title, totalLabel: `${page.totalValue} ${noun}`, totalValue: page.totalValue,
    coverageLabel: page.totalCount > page.items.length ? `Showing ${page.items.length} of ${page.totalCount} vendors. Total includes all.` : undefined,
    segments: page.items.filter(row => row.value > 0).map((row, index) => ({ id: row.id, label: status ? workStatusLabel(row.id as WorkOrder["status"]) : row.label, value: row.value, formattedValue: String(row.value), shareLabel: page.totalValue ? `${Math.round(row.value / page.totalValue * 100)}%` : "No records", tone: index === 0 ? "warning" : "neutral", link: { href: hrefFor(row.id), label: "Open supporting records" } })),
    sourceLink,
  });
  const finalMonth = new Date(window.costTo + "T00:00:00Z");
  const months = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(finalMonth.getUTCFullYear(), finalMonth.getUTCMonth() - 11 + index, 1)).toISOString().slice(0, 7));
  const monthly = new Map(pages.cost_month.items.map(row => [row.id, row.value]));
  const monthLabel = (key: string) => new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  const trend: TrendViewModel = {
    id: "recorded-cost-trend", title: "Recorded work cost — last 12 months",
    description: `Entered work costs by service month. ${monthLabel(months.at(-1)!)} runs through ${formatOperationsDate(window.costTo)}.`,
    points: months.map(key => ({ id: key, label: monthLabel(key), value: monthly.get(key) ?? 0, formattedValue: money(monthly.get(key) ?? 0), link: { href: workspaceStartHref(href("/app/work-orders", { costMonth: key, costTo: window.costTo, currency: window.currency })), label: `Open ${monthLabel(key)} work` } })),
    sourceLink: { href: workspaceStartHref(href("/app/work-orders", { hasCost: "true", ...costContext })), label: `Open ${activity.costWorkOrders} work orders with cost` },
  };
  return {
    storeBreakdown: cost(pages.cost_store, "recorded-cost-by-store", "Recorded cost by store", "store", { href: href("/app/stores", { sort: "cost", ...costContext }), label: "View all store costs" }),
    categoryBreakdown: cost(categories, "recorded-cost-by-service-area", "Recorded cost by service area", "category", { href: href("/app/work-orders", { hasCost: "true", ...costContext }), label: "View all cost records" }),
    vendorAccountabilityBreakdown: count(pages.observed_vendor, "observed-visits-by-vendor", "Observed service visits by vendor", "observed outside-vendor visits", id => href("/app/visits", { vendor: id }), { href: "/app/vendors", label: "Open vendor accountability" }),
    workStatusBreakdown: count(pages.work_status, "open-work-status", "Open work by status", "open work orders", id => href("/app/work-orders", { status: id }), { href: "/app/work-orders?status=open", label: "View all open work orders" }, true),
    activeVendorBreakdown: { ...count(pages.active_vendor, "onsite-vendor", "Who is onsite now", "active visits", id => href("/app/visits", { status: "active", vendor: id }), { href: "/app/visits?status=active", label: "Open all live visits" }), description: "Active check-ins by outside vendor." },
    highestCostStore: pages.cost_store.items[0] ? { ...pages.cost_store.items[0], label: compactStoreLabel(pages.cost_store.items[0].label, organizationName) } : undefined, trend,
  };
}
