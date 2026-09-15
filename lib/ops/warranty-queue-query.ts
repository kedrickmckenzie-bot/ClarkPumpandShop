import type { OpsFixture, PageRequest } from "./types";
import type { OrganizationScope } from "./repository";
import { pmStoreAllowed } from "./pm-record-query";
import { dashboardPageBounds } from "./dashboard-query";
export const warrantyQueueViews = ["all", "open", "diagnosis", "held", "exposure"] as const;
export type WarrantyQueueView = typeof warrantyQueueViews[number];
export interface WarrantyQueueQuery extends PageRequest {
    view: WarrantyQueueView;
    currency: string;
    search?: string;
}
export interface WarrantyQueueRow {
    id: string;
    caseId: string;
    workId: string;
    workNumber: string;
    storeNumber: string;
    storeName: string;
    status: string;
    coverage: string;
    diagnosis: boolean;
    held: boolean;
    date: string;
    amountMinor?: number;
    detail?: string;
}
export interface WarrantyQueuePage {
    rows: WarrantyQueueRow[];
    totalCount: number;
    nextOffset?: number;
    counts: Record<WarrantyQueueView, number>;
    exposureMinor: number;
}
export function warrantyQueueFromFixture(f: OpsFixture, scope: OrganizationScope, q: WarrantyQueueQuery): WarrantyQueuePage {
    if (!warrantyQueueViews.includes(q.view))
        throw new RangeError("Choose a warranty view.");
    const stores = new Map(f.stores.filter(s => pmStoreAllowed(scope, s)).map(s => [s.id, s])), work = new Map(f.workOrders.filter(w => w.organizationId === scope.organizationId && stores.has(w.storeId)).map(w => [w.id, w]));
    const cases = f.warrantyCases.filter(c => c.organizationId === scope.organizationId && work.has(c.workOrderId) && (!q.search || `${work.get(c.workOrderId)!.number} ${work.get(c.workOrderId)!.problem} ${stores.get(work.get(c.workOrderId)!.storeId)!.storeNumber} ${stores.get(work.get(c.workOrderId)!.storeId)!.name}`.toLowerCase().includes(q.search.toLowerCase())));
    const events = f.valueEvents.filter(e => e.organizationId === scope.organizationId && e.category === "identified_exposure" && e.amount.currency === q.currency && cases.some(c => c.id === e.warrantyCaseId));
    const counts = { all: cases.length, open: cases.filter(c => !c.closedAt).length, diagnosis: cases.filter(c => c.diagnosisRequired).length, held: cases.filter(c => c.invoiceHold).length, exposure: events.length };
    const row = (id: string): WarrantyQueueRow => { const c = cases.find(c => c.id === id)!, w = work.get(c.workOrderId)!, s = stores.get(w.storeId)!; return { id: c.id, caseId: c.id, workId: w.id, workNumber: w.number, storeNumber: s.storeNumber, storeName: s.name, status: c.status, coverage: c.coverageDecision, diagnosis: c.diagnosisRequired, held: c.invoiceHold, date: new Date(c.createdAt).toISOString() }; };
    const rows = (q.view === "exposure" ? events.map(e => ({ ...row(e.warrantyCaseId!), id: e.id, date: new Date(e.occurredAt).toISOString(), amountMinor: e.amount.amountMinor, detail: e.sourceDecision })) : cases.filter(c => q.view === "all" || q.view === "open" && !c.closedAt || q.view === "diagnosis" && c.diagnosisRequired || q.view === "held" && c.invoiceHold).map(c => row(c.id))).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const { limit, offset } = dashboardPageBounds(q);
    return { rows: rows.slice(offset, offset + limit), totalCount: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : undefined, counts, exposureMinor: events.reduce((s, e) => s + e.amount.amountMinor, 0) };
}
