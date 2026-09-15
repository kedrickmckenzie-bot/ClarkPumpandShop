import type { OpsFixture, PageRequest } from "./types";
import type { OrganizationScope } from "./repository";
import { invoiceReporting } from "./invoice-reporting";
import { pmStoreAllowed } from "./pm-record-query";
import { matchesWorkCategoryPath } from "./work-cost-query";
import { dashboardPageBounds } from "./dashboard-query";
export interface InvoiceEvidenceQuery extends PageRequest {
    currency: string;
    from?: string;
    to?: string;
    costMonth?: string;
    store?: string;
    region?: string;
    category?: string;
    path?: string[];
    asset?: string;
    component?: string;
    search?: string;
}
export interface InvoiceEvidenceRow {
    id: string;
    invoiceId: string;
    number: string;
    date: string;
    amountMinor: number;
    workId: string;
    workNumber: string;
    problem: string;
    storeId: string;
    storeNumber: string;
    storeName: string;
    href: string;
}
export interface InvoiceEvidencePage {
    filterLabels: string[];
    rows: InvoiceEvidenceRow[];
    totalCount: number;
    amountMinor: number;
    nextOffset?: number;
}
export function invoiceEvidenceFromFixture(f: OpsFixture, scope: OrganizationScope, q: InvoiceEvidenceQuery): InvoiceEvidencePage {
    const stores = new Map(f.stores.filter(s => pmStoreAllowed(scope, s)).map(s => [s.id, s]));
    const work = new Map(f.workOrders.filter(w => w.organizationId === scope.organizationId && stores.has(w.storeId)).map(w => [w.id, w]));
    const rows = invoiceReporting(f, scope.organizationId).allocations.flatMap(a => {
        const w = work.get(a.workOrderId), s = w && stores.get(w.storeId);
        if (!w || !s || a.storeId && a.storeId !== s.id || a.amount.currency !== q.currency)
            return [];
        const asset = f.assets.find(x => x.organizationId === scope.organizationId && x.id === w.assetId && x.storeId === w.storeId);
        if (q.from && a.invoiceDate < q.from || q.to && a.invoiceDate.slice(0, 10) > q.to || q.costMonth && a.invoiceDate.slice(0, 7) !== q.costMonth || q.store && s.id !== q.store || q.region && s.regionId !== q.region || q.category && (w.categoryKey ?? "unclassified") !== q.category || q.asset && (q.asset === "unlinked" ? Boolean(w.assetId) : w.assetId !== q.asset) || q.component && (q.component === "unlinked" ? Boolean(w.componentId) : w.componentId !== q.component) || !matchesWorkCategoryPath(asset, q.path) || q.search && !`${a.invoiceNumber} ${w.number} ${w.problem} ${s.storeNumber}`.toLowerCase().includes(q.search.toLowerCase()))
            return [];
        const ids = new Set(f.invoiceLines.filter(l => l.organizationId === scope.organizationId && l.invoiceId === a.invoiceId).map(l => l.id));
        const matches = f.invoiceLineAllocations.filter(x => x.organizationId === scope.organizationId && ids.has(x.invoiceLineId));
        const full = matches.length > 0 && matches.every(x => stores.has(x.storeId) && work.get(x.workOrderId)?.storeId === x.storeId);
        return [{ id: a.id, invoiceId: a.invoiceId, number: a.invoiceNumber, date: a.invoiceDate.slice(0, 10), amountMinor: a.amount.amountMinor, workId: w.id, workNumber: w.number, problem: w.problem, storeId: s.id, storeNumber: s.storeNumber, storeName: s.name, href: full ? a.href : `/app/work-orders/${w.id}?view=cost` }];
    }).sort((a, b) => b.date.localeCompare(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const { limit, offset } = dashboardPageBounds(q);
    const labels: string[] = [];
    if (q.store) {
        const s = stores.get(q.store);
        labels.push(s ? `Store ${s.storeNumber} · ${s.name}` : "Store unavailable");
    }
    if (q.region) {
        const r = f.regions.find(r => r.organizationId === scope.organizationId && r.id === q.region && [...stores.values()].some(s => s.regionId === r.id));
        labels.push(r?.name ?? "Region unavailable");
    }
    if (q.asset) {
        const a = f.assets.find(a => a.organizationId === scope.organizationId && a.id === q.asset && stores.has(a.storeId));
        labels.push(q.asset === "unlinked" ? "Unlinked equipment" : a?.name ?? "Equipment unavailable");
    }
    if (q.component) {
        const c = f.components.find(c => c.organizationId === scope.organizationId && c.id === q.component && f.assets.some(a => a.organizationId === scope.organizationId && a.id === c.assetId && stores.has(a.storeId)));
        labels.push(q.component === "unlinked" ? "Unlinked component" : c?.name ?? "Component unavailable");
    }
    return { filterLabels: labels, rows: rows.slice(offset, offset + limit), totalCount: rows.length, amountMinor: rows.reduce((s, r) => s + r.amountMinor, 0), nextOffset: offset + limit < rows.length ? offset + limit : undefined };
}
