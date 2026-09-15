import type { OrganizationScope } from "./repository";
import type { Money, OpsFixture, PageRequest } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmStoreAllowed } from "./pm-record-query";

export const invoiceQueueViews = ["all", "review", "flags", "exposure"] as const;
export type InvoiceQueueView = typeof invoiceQueueViews[number];
export interface InvoiceQueueQuery extends PageRequest { view: InvoiceQueueView; search?: string; currency: string; }
export interface InvoiceQueueRow { id: string; invoiceId: string; number: string; vendorId?: string; vendorName?: string; date: string; status: string; label?: string; detail?: string; lineId?: string; workId?: string; amount: Money; approved?: Money; paid?: Money; openFlags: number; }
export interface InvoiceQueuePage { rows: InvoiceQueueRow[]; totalCount: number; nextOffset?: number; counts: { invoices: number; review: number; flags: number; exposure: number }; exposureAmount: Money; }
export function validateInvoiceQueueQuery(query: InvoiceQueueQuery) { if (!invoiceQueueViews.includes(query.view) || !/^[A-Z]{3}$/.test(query.currency)) throw new RangeError("Choose an invoice view and currency."); }
export function invoiceQueueFromFixture(fixture: OpsFixture, scope: OrganizationScope, query: InvoiceQueueQuery): InvoiceQueuePage {
  validateInvoiceQueueQuery(query);
  const org = scope.organizationId, stores = new Set(fixture.stores.filter(s => pmStoreAllowed(scope, s)).map(s => s.id));
  const work = new Map(fixture.workOrders.filter(w => w.organizationId === org && stores.has(w.storeId)).map(w => [w.id, w]));
  const invoices = fixture.invoices.filter(i => {
    if (i.organizationId !== org) return false;
    const lines = new Set(fixture.invoiceLines.filter(l => l.organizationId === org && l.invoiceId === i.id).map(l => l.id));
    const allocations = fixture.invoiceLineAllocations.filter(a => a.organizationId === org && lines.has(a.invoiceLineId));
    if (!allocations.length && (scope.storeIds !== undefined || scope.regionIds !== undefined) || allocations.some(a => work.get(a.workOrderId)?.storeId !== a.storeId)) return false;
    const vendor = fixture.vendors.find(v => v.organizationId === org && v.id === i.vendorId);
    return !query.search || `${i.vendorInvoiceNumber} ${vendor?.name ?? ""}`.toLowerCase().includes(query.search.toLowerCase());
  });
  const ids = new Set(invoices.map(i => i.id)), lines = new Map(fixture.invoiceLines.filter(l => l.organizationId === org && ids.has(l.invoiceId)).map(l => [l.id, l]));
  const flags = fixture.invoiceExceptions.filter(f => f.organizationId === org && ids.has(f.invoiceId) && f.status === "open");
  const events = fixture.valueEvents.filter(e => e.organizationId === org && e.category === "identified_exposure" && e.amount.currency === query.currency && e.invoiceLineId && lines.has(e.invoiceLineId) && (!e.workOrderId || fixture.invoiceLineAllocations.some(a => a.organizationId === org && a.invoiceLineId === e.invoiceLineId && a.workOrderId === e.workOrderId)));
  const base = (invoiceId: string): InvoiceQueueRow => { const i = invoices.find(i => i.id === invoiceId)!, v = fixture.vendors.find(v => v.organizationId === org && v.id === i.vendorId); return { id: i.id, invoiceId: i.id, number: i.vendorInvoiceNumber, vendorId: v?.id, vendorName: v?.name, date: new Date(i.invoiceDate).toISOString(), status: i.status, amount: i.total, approved: i.approvedForPayment, paid: i.paidAmount, openFlags: flags.filter(f => f.invoiceId === i.id).length }; };
  let rows: InvoiceQueueRow[];
  if (query.view === "flags") rows = flags.map(f => ({ ...base(f.invoiceId), id: f.id, date: new Date(f.detectedAt).toISOString(), status: f.status, label: f.kind, detail: f.summary, amount: f.amount, approved: undefined, paid: undefined }));
  else if (query.view === "exposure") rows = events.map(e => ({ ...base(lines.get(e.invoiceLineId!)!.invoiceId), id: e.id, date: new Date(e.occurredAt).toISOString(), status: "Recorded flag", label: e.eventType, detail: e.sourceDecision, amount: e.amount, lineId: e.invoiceLineId, workId: e.workOrderId, approved: undefined, paid: undefined }));
  else rows = invoices.map(i => base(i.id)).filter(i => query.view !== "review" || i.openFlags > 0);
  rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(query), totalCount = rows.length;
  return { rows: rows.slice(offset, offset + limit), totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined, counts: { invoices: invoices.length, review: new Set(flags.map(f => f.invoiceId)).size, flags: flags.length, exposure: events.length }, exposureAmount: { amountMinor: events.reduce((sum, e) => sum + e.amount.amountMinor, 0), currency: query.currency } };
}
