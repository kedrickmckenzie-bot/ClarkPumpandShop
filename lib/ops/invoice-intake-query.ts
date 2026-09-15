import type { OpsFixture, PageRequest } from "./types";
import type { OrganizationScope } from "./repository";
import { dashboardPageBounds } from "./dashboard-query";
export interface InvoiceIntakeQuery extends PageRequest { kind: "work" | "vendor" | "agreement"; search?: string; vendorId?: string; }
export interface InvoiceIntakeOption { id: string; label: string; detail: string; }
export interface InvoiceIntakePage { items: InvoiceIntakeOption[]; totalCount: number; nextOffset?: number; }
export interface InvoiceIntakeChecks { duplicateNumber: boolean; priorInvoice?: Pick<OpsFixture["invoices"][number], "id" | "vendorInvoiceNumber" | "invoiceDate">; warrantyHold?: Pick<OpsFixture["warrantyCases"][number], "id" | "coverageDecision" | "customerChargeStatus">; }
export function invoiceIntakeChecksFromFixture(f: OpsFixture, organizationId: string, workId: string, vendorId: string, number: string): InvoiceIntakeChecks {
  const invoices = f.invoices.filter(i => i.organizationId === organizationId), normalized = number.trim().toLowerCase();
  const prior = invoices.filter(i => i.vendorInvoiceNumber.trim().toLowerCase() !== normalized && f.invoiceLines.some(l => l.organizationId === organizationId && l.invoiceId === i.id && f.invoiceLineAllocations.some(a => a.organizationId === organizationId && a.invoiceLineId === l.id && a.workOrderId === workId))).sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate) || (a.id < b.id ? 1 : -1))[0];
  const hold = f.warrantyCases.filter(c => c.organizationId === organizationId && c.workOrderId === workId && c.invoiceHold && !c.closedAt).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt) || (a.id < b.id ? 1 : -1))[0];
  return { duplicateNumber: invoices.some(i => i.vendorId === vendorId && i.vendorInvoiceNumber.trim().toLowerCase() === normalized), priorInvoice: prior ? { id: prior.id, vendorInvoiceNumber: prior.vendorInvoiceNumber, invoiceDate: prior.invoiceDate } : undefined, warrantyHold: hold ? { id: hold.id, coverageDecision: hold.coverageDecision, customerChargeStatus: hold.customerChargeStatus } : undefined };
}
export function invoiceIntakeFromFixture(f: OpsFixture, scope: OrganizationScope, q: InvoiceIntakeQuery): InvoiceIntakePage {
  if (scope.storeIds !== undefined || scope.regionIds !== undefined) return { items: [], totalCount: 0 };
  const org = scope.organizationId;
  let items: InvoiceIntakeOption[];
  if (q.kind === "work") items = f.workOrders.filter(w => w.organizationId === org && w.status !== "cancelled").flatMap(w => { const s = f.stores.find(s => s.organizationId === org && s.id === w.storeId); return s ? [{ id: w.id, label: w.number, detail: `Store ${s.storeNumber} · ${w.problem}` }] : []; });
  else if (q.kind === "vendor") items = f.vendors.filter(v => v.organizationId === org && v.status !== "inactive").map(v => ({ id: v.id, label: v.name, detail: "Approved vendor" }));
  else items = f.contractVersions.filter(c => c.organizationId === org && c.vendorId === q.vendorId && c.status === "active" && f.vendors.some(v => v.organizationId === org && v.id === c.vendorId && v.status !== "inactive")).map(c => ({ id: c.id, label: c.sourceAgreementReference, detail: `Version ${c.version}` }));
  if (q.search) items = items.filter(r => `${r.label} ${r.detail}`.toLowerCase().includes(q.search!.toLowerCase()));
  items.sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const { limit, offset } = dashboardPageBounds(q), totalCount = items.length;
  return { items: items.slice(offset, offset + limit), totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
