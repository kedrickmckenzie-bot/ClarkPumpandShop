import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { matchesRequestStatus, matchesWorkStage, scopedInvoiceRecords, visitHasWork } from "./dashboard-cohorts";

/** Current activity has no creation-date cutoff. Only recorded costs use this inclusive service-date window. */
export interface DashboardWindow {
  asOf: string;
  costFrom: string;
  costTo: string;
  currency: string;
}

export function rollingYearStart(asOf: string): string {
  const value = new Date(asOf);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
}

export interface DashboardActivitySummary {
  stores: number;
  openWork: number;
  pendingRequests: number;
  approvedNotSent: number;
  awaitingVendor: number;
  activeVisits: number;
  completedVisits: number;
  totalVisits: number;
  visitsWithoutWork: number;
  upcomingAppointments: number;
  watchAssets: number;
  invoiceRecords: number;
  recordedCostMinor: number;
  costWorkOrders: number;
  costLines: number;
  unclassifiedCostMinor: number;
  unclassifiedCostWorkOrders: number;
}

export type DashboardBreakdownKind = "work_status" | "cost_category" | "cost_store" | "cost_month" | "active_vendor" | "observed_vendor";
export interface DashboardBreakdownRow { id: string; label: string; value: number; }
export interface DashboardBreakdownPage {
  items: DashboardBreakdownRow[];
  totalCount: number;
  totalValue: number;
  nextCursor?: string;
}
export interface DashboardBreakdownQuery extends PageRequest { kind: DashboardBreakdownKind; }

export function validateDashboardWindow(window: DashboardWindow) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!Number.isFinite(Date.parse(window.asOf)) || !validDate(window.costFrom) || !validDate(window.costTo)
    || window.costFrom > window.costTo || window.costTo > new Date(window.asOf).toISOString().slice(0, 10)
    || !/^[A-Z]{3}$/.test(window.currency)) throw new RangeError("Choose a valid cost period and currency.");
}

export function dashboardPageBounds(query: PageRequest) {
  const integer = (value: number | undefined, fallback: number) => value === undefined ? fallback : Number.isFinite(value) ? Math.floor(value) : fallback;
  return { limit: Math.max(1, Math.min(100, integer(query.limit, 25))), offset: Math.max(0, integer(query.offset, 0)) };
}

export function dashboardCursor(row: DashboardBreakdownRow) {
  return Buffer.from(JSON.stringify([row.value, row.id]), "utf8").toString("base64url");
}

export function readDashboardCursor(value?: string): { value: number; id: string } | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && Number.isSafeInteger(parsed[0]) && typeof parsed[1] === "string") return { value: parsed[0], id: parsed[1] };
  } catch { /* Invalid cursors cannot silently restart a source page. */ }
  throw new RangeError("This page link is invalid. Open the first page.");
}

function scopedSources(fixture: OpsFixture, scope: OrganizationScope, window: DashboardWindow) {
  validateDashboardWindow(window);
  const stores = fixture.stores.filter(store => store.organizationId === scope.organizationId
    && (scope.storeIds === undefined || scope.storeIds.includes(store.id))
    && (scope.regionIds === undefined || Boolean(store.regionId && scope.regionIds.includes(store.regionId))));
  const storeIds = new Set(stores.map(store => store.id));
  const work = fixture.workOrders.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId));
  const workIds = new Set(work.map(row => row.id));
  const visits = fixture.visits.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId));
  const costs = fixture.costLines.filter(row => row.organizationId === scope.organizationId && workIds.has(row.workOrderId)
    && row.serviceDate.slice(0, 10) >= window.costFrom && row.serviceDate.slice(0, 10) <= window.costTo && row.amount.currency === window.currency);
  return { stores, storeIds, work, workIds, visits, costs };
}

/** Fixture adapter only; persisted adapters aggregate in SQL and never hydrate source records here. */
export function dashboardActivityFromFixture(fixture: OpsFixture, scope: OrganizationScope, window: DashboardWindow): DashboardActivitySummary {
  const { stores, storeIds, work, workIds, visits, costs } = scopedSources(fixture, scope, window);
  const unclassified = new Set(work.filter(row => !row.categoryKey).map(row => row.id));
  const unclassifiedCosts = costs.filter(row => unclassified.has(row.workOrderId));
  return {
    stores: stores.length,
    openWork: work.filter(row => !["closed", "cancelled"].includes(row.status)).length,
    pendingRequests: fixture.requests.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId) && matchesRequestStatus(row, "pending")).length,
    approvedNotSent: work.filter(row => matchesWorkStage(row, "not-sent", fixture)).length,
    awaitingVendor: work.filter(row => matchesWorkStage(row, "vendor-response", fixture)).length,
    activeVisits: visits.filter(row => row.status === "active").length,
    completedVisits: visits.filter(row => row.status !== "active").length,
    totalVisits: visits.length,
    visitsWithoutWork: visits.filter(row => !visitHasWork(fixture, row)).length,
    upcomingAppointments: (fixture.serviceAppointments ?? []).filter(row => row.organizationId === scope.organizationId && workIds.has(row.workOrderId) && row.status === "confirmed" && Date.parse(row.startsAt) >= Date.parse(window.asOf)).length,
    watchAssets: fixture.assets.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId) && row.status === "watch").length,
    invoiceRecords: scopedInvoiceRecords(fixture, scope.organizationId, storeIds).length,
    recordedCostMinor: costs.reduce((sum, row) => sum + row.amount.amountMinor, 0),
    costWorkOrders: new Set(costs.map(row => row.workOrderId)).size,
    costLines: costs.length,
    unclassifiedCostMinor: unclassifiedCosts.reduce((sum, row) => sum + row.amount.amountMinor, 0),
    unclassifiedCostWorkOrders: new Set(unclassifiedCosts.map(row => row.workOrderId)).size,
  };
}

export function dashboardBreakdownFromFixture(fixture: OpsFixture, scope: OrganizationScope, window: DashboardWindow, query: DashboardBreakdownQuery): DashboardBreakdownPage {
  const { stores, work, visits, costs } = scopedSources(fixture, scope, window);
  const values = new Map<string, DashboardBreakdownRow>();
  const add = (id: string, label: string, amount: number) => values.set(id, { id, label, value: (values.get(id)?.value ?? 0) + amount });
  if (query.kind === "work_status") {
    for (const row of work) if (!["closed", "cancelled"].includes(row.status)) add(row.status, row.status, 1);
  } else if (query.kind === "active_vendor" || query.kind === "observed_vendor") {
    for (const row of visits) if (row.vendorId && (query.kind === "observed_vendor" || row.status === "active")) {
      add(row.vendorId, fixture.vendors.find(vendor => vendor.organizationId === scope.organizationId && vendor.id === row.vendorId)?.name ?? "Unknown vendor", 1);
    }
  } else if (query.kind === "cost_month") {
    for (const row of costs) add(row.serviceDate.slice(0, 7), row.serviceDate.slice(0, 7), row.amount.amountMinor);
  } else if (query.kind === "cost_store" || query.kind === "cost_category") {
    const costByWork = new Map<string, number>();
    for (const row of costs) costByWork.set(row.workOrderId, (costByWork.get(row.workOrderId) ?? 0) + row.amount.amountMinor);
    for (const row of work) {
      const store = stores.find(store => store.id === row.storeId);
      const id = query.kind === "cost_store" ? row.storeId : row.categoryKey ?? "unclassified";
      add(id, query.kind === "cost_store" ? `Store ${store!.storeNumber} · ${store!.name}` : id, costByWork.get(row.id) ?? 0);
    }
  } else throw new RangeError("Choose a supported dashboard breakdown.");
  // Explicit ID tie-breaker is independent of insertion order and locale collation.
  const rows = [...values.values()].sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(query);
  const cursor = readDashboardCursor(query.cursor);
  const filtered = cursor ? rows.filter(row => row.value < cursor.value || row.value === cursor.value && row.id > cursor.id) : rows.slice(offset);
  const items = filtered.slice(0, limit);
  return { items, totalCount: rows.length, totalValue: rows.reduce((sum, row) => sum + row.value, 0), nextCursor: filtered.length > limit ? dashboardCursor(items.at(-1)!) : undefined };
}
