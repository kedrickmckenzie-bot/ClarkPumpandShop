import type { OrganizationScope } from "./repository";
import type { Money, OpsFixture, PageRequest } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmStoreAllowed } from "./pm-record-query";

export const invoiceRecordSections = ["items", "matches", "evidence", "flags", "history"] as const;
export type InvoiceRecordSection = typeof invoiceRecordSections[number];
export interface InvoiceRecordQuery extends PageRequest { section: InvoiceRecordSection; line?: string; match?: string; flag?: string; basis?: "linked" | "unmatched"; open?: boolean; accounting?: boolean; }
export interface InvoiceRecordRow {
  id: string; kind: string; label: string; detail: string; status: string; date?: string; amount?: Money;
  lineId?: string; lineNumber?: number; workId?: string; workNumber?: string; workStatus?: string; storeId?: string; storeNumber?: string;
  visitId?: string; visitDate?: string; unavailableVisit?: boolean; actor?: string;
}
export interface InvoiceRecordHeader {
  id: string; number: string; version: number; date: string; status: string; reason?: string;
  submittedByMembershipId?: string; vendorId?: string; vendorName?: string; agreement?: string; unavailableAgreement: boolean;
  total: Money; approved: Money; paid: Money; linked: Money; unmatched: Money; itemsReconcile: boolean; reportingState: "excluded" | "needs_review" | "matched";
  counts: Record<InvoiceRecordSection, number>; openFlags: number;
}
export interface InvoiceRecordPage { invoice: InvoiceRecordHeader | null; rows: InvoiceRecordRow[]; totalCount: number; nextOffset?: number; }
const instant = (value: string) => new Date(value).toISOString();
export function validateInvoiceRecordQuery(query: InvoiceRecordQuery) {
  if (!invoiceRecordSections.includes(query.section)) throw new RangeError("Choose an invoice section.");
}
export function invoiceRecordFromFixture(fixture: OpsFixture, scope: OrganizationScope, invoiceId: string, query: InvoiceRecordQuery): InvoiceRecordPage {
  validateInvoiceRecordQuery(query);
  const organizationId = scope.organizationId, invoice = fixture.invoices.find(i => i.organizationId === organizationId && i.id === invoiceId);
  const denied: InvoiceRecordPage = { invoice: null, rows: [], totalCount: 0 };
  if (!invoice) return denied;
  const lines = fixture.invoiceLines.filter(l => l.organizationId === organizationId && l.invoiceId === invoiceId);
  const lineIds = new Set(lines.map(l => l.id)), allocations = fixture.invoiceLineAllocations.filter(a => a.organizationId === organizationId && lineIds.has(a.invoiceLineId));
  const stores = new Map(fixture.stores.filter(s => pmStoreAllowed(scope, s)).map(s => [s.id, s]));
  const work = new Map(fixture.workOrders.filter(w => w.organizationId === organizationId && stores.has(w.storeId)).map(w => [w.id, w]));
  const unrestricted = scope.storeIds === undefined && scope.regionIds === undefined;
  if (!allocations.length && !unrestricted || allocations.some(a => !stores.has(a.storeId) || work.get(a.workOrderId)?.storeId !== a.storeId)) return denied;
  const workIds = new Set(allocations.map(a => a.workOrderId));
  const vendor = fixture.vendors.find(v => v.organizationId === organizationId && v.id === invoice.vendorId);
  const agreement = fixture.contractVersions.find(c => c.organizationId === organizationId && c.vendorId === invoice.vendorId && c.id === invoice.contractVersionId);
  const flags = fixture.invoiceExceptions.filter(e => e.organizationId === organizationId && e.invoiceId === invoice.id);
  const relevantSources = (fixture.accountingInvoiceSources ?? []).filter(s => s.organizationId === organizationId && s.invoiceId === invoice.id);
  // Invalid imported JSON remains unavailable rather than crashing invoice review.
  const safeSources = relevantSources.flatMap(source => { try { const payload = JSON.parse(source.payloadJson); return payload?.delivery && typeof payload.delivery === "object" ? [{ source, payload }] : []; } catch { return []; } });
  const excluded = invoice.status === "void" || safeSources.some(s => s.payload.delivery.kind === "bill" && s.payload.delivery.maintenance === false);
  const reconciles = lines.every(l => l.lineAmount.currency === invoice.total.currency) && lines.reduce((sum, l) => sum + l.lineAmount.amountMinor, 0) === invoice.total.amountMinor;
  const eligible = allocations.filter(a => a.confirmedAt && a.amount.amountMinor > 0 && a.amount.currency === invoice.total.currency);
  const supported = excluded || !reconciles ? [] : eligible.filter(a => eligible.filter(x => x.invoiceLineId === a.invoiceLineId).reduce((sum, x) => sum + x.amount.amountMinor, 0) <= lines.find(l => l.id === a.invoiceLineId)!.lineAmount.amountMinor);
  const linkedMinor = supported.reduce((sum, a) => sum + a.amount.amountMinor, 0), pending = !excluded && (!reconciles || linkedMinor < invoice.total.amountMinor);
  const groups: Record<InvoiceRecordSection, InvoiceRecordRow[]> = {
    items: lines.map(l => { const count = allocations.filter(a => a.invoiceLineId === l.id).length; return { id: l.id, kind: "item", label: l.description, detail: l.category, status: `${count} ${count === 1 ? "match" : "matches"}`, date: instant(l.createdAt), amount: l.lineAmount, lineId: l.id, lineNumber: l.lineNumber }; }),
    matches: allocations.map(a => {
      const line = lines.find(l => l.id === a.invoiceLineId)!, w = work.get(a.workOrderId)!, s = stores.get(a.storeId)!;
      const outcome = fixture.siteVisitWorkOrders.find(l => l.organizationId === organizationId && l.id === a.siteVisitWorkOrderId && l.workOrderId === w.id);
      const visit = outcome ? fixture.visits.find(v => v.organizationId === organizationId && v.id === outcome.visitId && v.storeId === s.id) : undefined;
      return { id: a.id, kind: "match", label: w.number, detail: line.description, status: a.confirmedAt ? "Confirmed match" : "Awaiting review", date: a.confirmedAt ? instant(a.confirmedAt) : undefined, amount: a.amount, lineId: line.id, lineNumber: line.lineNumber, workId: w.id, workNumber: w.number, workStatus: w.status, storeId: s.id, storeNumber: s.storeNumber, visitId: visit?.id, visitDate: visit ? instant(visit.checkedInAt) : undefined, unavailableVisit: Boolean(a.siteVisitWorkOrderId && !visit) };
    }),
    evidence: [
      ...fixture.authorizations.filter(a => a.organizationId === organizationId && workIds.has(a.workOrderId)).map(a => ({ id: a.id, kind: "authorization", label: a.authorizationType, detail: a.authorizedScope, status: a.supersedesAuthorizationId ? "Amendment" : "Recorded", date: instant(a.authorizedAt), amount: a.authorizedAmount, workId: a.workOrderId, workNumber: work.get(a.workOrderId)!.number, actor: a.approverName })),
      ...fixture.warrantyCases.filter(c => c.organizationId === organizationId && workIds.has(c.workOrderId)).map(c => ({ id: c.id, kind: "warranty", label: c.diagnosisRequired ? "Diagnosis needed" : "Diagnosis recorded", detail: c.invoiceHold ? "Invoice on hold" : "No warranty hold", status: c.coverageDecision, date: instant(c.createdAt), workId: c.workOrderId, workNumber: work.get(c.workOrderId)!.number })),
    ],
    flags: flags.map(e => ({ id: e.id, kind: "flag", label: e.kind, detail: e.summary, status: e.status, date: instant(e.detectedAt), amount: e.amount, actor: e.resolutionReason })),
    history: [
      ...fixture.invoiceAdjustments.filter(a => a.organizationId === organizationId && a.invoiceId === invoiceId).map(a => ({ id: a.id, kind: "adjustment", label: a.kind, detail: a.reason, status: "Recorded", date: instant(a.createdAt), amount: a.amount, actor: fixture.users.find(u => u.id === fixture.memberships.find(m => m.organizationId === organizationId && m.id === a.createdByMembershipId)?.userId)?.displayName ?? "Recorded reviewer" })),
      ...fixture.valueEvents.filter(e => e.organizationId === organizationId && e.invoiceLineId && lineIds.has(e.invoiceLineId) && e.category === "realized_verified" && (!e.workOrderId || workIds.has(e.workOrderId))).map(e => ({ id: e.id, kind: "benefit", label: e.eventType, detail: e.sourceDecision, status: "Confirmed benefit", date: instant(e.occurredAt), amount: e.amount })),
      ...fixture.auditEvents.filter(e => e.organizationId === organizationId && e.aggregateType === "invoice" && e.aggregateId === invoice.id).map(e => ({ id: e.id, kind: "audit", label: e.eventType, detail: "Invoice event", status: "Recorded", date: instant(e.occurredAt), actor: e.actorName })),
      ...(query.accounting && unrestricted ? relevantSources.map(s => ({ id: s.id, kind: "accounting", label: "Accounting source", detail: s.externalInvoiceId, status: s.matchState, date: instant(s.updatedAt) })) : []),
    ],
  };
  const counts = Object.fromEntries(invoiceRecordSections.map(k => [k, groups[k].length])) as InvoiceRecordHeader["counts"];
  let rows = groups[query.section]; if (query.line && query.section === "matches") rows = rows.filter(r => r.lineId === query.line);
  if (query.match && query.section === "matches") rows = rows.filter(r => r.id === query.match);
  if (query.flag && query.section === "flags") rows = rows.filter(r => r.id === query.flag);
  if (query.open && query.section === "flags") rows = rows.filter(r => r.status === "open");
  if (query.basis === "linked" && query.section === "matches") rows = rows.filter(r => supported.some(a => a.id === r.id));
  if (query.basis === "unmatched" && query.section === "items") rows = excluded ? [] : rows.map(r => ({ ...r, amount: { amountMinor: Math.max(0, r.amount!.amountMinor - supported.filter(a => a.invoiceLineId === r.id).reduce((sum, a) => sum + a.amount.amountMinor, 0)), currency: r.amount!.currency } })).filter(r => r.amount.amountMinor > 0);
  rows.sort((a, b) => (query.section === "items" ? (a.lineNumber ?? 0) - (b.lineNumber ?? 0) : Date.parse(b.date ?? "1970-01-01") - Date.parse(a.date ?? "1970-01-01")) || (a.id < b.id ? -1 : a.id > b.id ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(query), totalCount = rows.length;
  return { invoice: { id: invoice.id, number: invoice.vendorInvoiceNumber, version: invoice.version ?? 0, submittedByMembershipId: invoice.submittedByMembershipId, date: invoice.invoiceDate, status: invoice.status, reason: invoice.exceptionReason, vendorId: vendor?.id, vendorName: vendor?.name, agreement: agreement ? `${agreement.sourceAgreementReference} · Version ${agreement.version}` : undefined, unavailableAgreement: Boolean(invoice.contractVersionId && !agreement), total: invoice.total, approved: invoice.approvedForPayment, paid: invoice.paidAmount, linked: { amountMinor: linkedMinor, currency: invoice.total.currency }, unmatched: { amountMinor: pending ? Math.max(0, invoice.total.amountMinor - linkedMinor) : 0, currency: invoice.total.currency }, itemsReconcile: reconciles, reportingState: excluded ? "excluded" : pending ? "needs_review" : "matched", counts, openFlags: flags.filter(f => f.status === "open").length }, rows: rows.slice(offset, offset + limit), totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
