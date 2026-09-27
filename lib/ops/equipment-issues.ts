import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest, WorkOrder } from "./types";
import { dashboardPageBounds, validateDashboardWindow, type DashboardWindow } from "./dashboard-query";

export interface EquipmentIssueRow {
  id: string;
  name: string;
  assetTag: string;
  storeId: string;
  storeLabel: string;
  issueCount: number;
  latestIssue: string;
  recordedCostMinor: number;
  costWorkCount: number;
}
export interface EquipmentIssuePage { items: EquipmentIssueRow[]; totalCount: number; }

/** An issue is one non-cancelled, unplanned work order opened in the window. Visits never multiply it. */
export function isEquipmentIssue(work: WorkOrder, window: DashboardWindow, pmWorkIds: ReadonlySet<string>) {
  return work.status !== "cancelled" && work.priority !== "planned" && !pmWorkIds.has(work.id)
    && work.createdAt.slice(0, 10) >= window.costFrom && work.createdAt.slice(0, 10) <= window.costTo;
}

export function equipmentIssuesFromFixture(fixture: OpsFixture, scope: OrganizationScope, window: DashboardWindow, query: PageRequest = {}): EquipmentIssuePage {
  validateDashboardWindow(window);
  const stores = new Map(fixture.stores.filter(s => s.organizationId === scope.organizationId
    && (scope.storeIds === undefined || scope.storeIds.includes(s.id))
    && (scope.regionIds === undefined || Boolean(s.regionId && scope.regionIds.includes(s.regionId)))).map(s => [s.id, s]));
  const pm = new Set(fixture.pmOccurrences.filter(p => p.organizationId === scope.organizationId).flatMap(p => p.workOrderId ? [p.workOrderId] : []));
  const work = fixture.workOrders.filter(w => w.organizationId === scope.organizationId && stores.has(w.storeId) && isEquipmentIssue(w, window, pm));
  const rows = fixture.assets.filter(a => a.organizationId === scope.organizationId && stores.has(a.storeId)).flatMap(asset => {
    const issues = work.filter(w => w.assetId === asset.id && w.storeId === asset.storeId);
    if (!issues.length) return [];
    const ids = new Set(issues.map(w => w.id));
    const costs = fixture.costLines.filter(c => c.organizationId === scope.organizationId && ids.has(c.workOrderId)
      && c.serviceDate.slice(0, 10) >= window.costFrom && c.serviceDate.slice(0, 10) <= window.costTo && c.amount.currency === window.currency);
    const store = stores.get(asset.storeId)!;
    return [{ id: asset.id, name: asset.name, assetTag: asset.assetTag, storeId: store.id,
      storeLabel: `Store ${store.storeNumber} · ${store.name}`, issueCount: issues.length,
      latestIssue: issues.map(w => w.createdAt).sort().at(-1)!,
      recordedCostMinor: costs.reduce((sum, c) => sum + c.amount.amountMinor, 0), costWorkCount: new Set(costs.map(c => c.workOrderId)).size }];
  }).sort((a, b) => b.issueCount - a.issueCount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(query);
  return { items: rows.slice(offset, offset + limit), totalCount: rows.length };
}

export function equipmentIssueHistoryHref(assetId: string, window: DashboardWindow) {
  return `/app/equipment/${encodeURIComponent(assetId)}?${new URLSearchParams({ cohort: "issues", history: "12", issueFrom: window.costFrom, issueTo: window.costTo, currency: window.currency })}#equipment-review`;
}
export function equipmentIssueRankingHref(window: DashboardWindow, page = 1) {
  return `/app/equipment?${new URLSearchParams({ view: "issues", issueFrom: window.costFrom, issueTo: window.costTo, currency: window.currency, ...(page > 1 ? { page: String(page) } : {}) })}`;
}
