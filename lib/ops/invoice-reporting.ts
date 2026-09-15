import type { OpsFixture, Money } from "./types";
import { invoiceLinkFacts } from "./invoice-linking";

export interface InvoiceReportingAllocation {
  id: string; invoiceId: string; invoiceLineId?: string; workOrderId: string;
  assetId?: string; componentId?: string; storeId?: string;
  invoiceNumber: string; invoiceDate: string; vendorId: string; amount: Money; gross: Money; href: string;
}

/** Canonical invoices own reporting once present. Legacy references are only a
 * compatibility source for identities not yet represented in the invoice ledger.
 * Never fall back to an older reference when a canonical match is invalidated. */
export type InvoiceReportingSources = Pick<OpsFixture, "invoices" | "invoiceLines" | "invoiceLineAllocations" | "accountingInvoiceSources" | "invoiceReferences" | "invoiceAllocations">;

export function invoiceReporting(fixture: InvoiceReportingSources, organizationId: string) {
  const allocations: InvoiceReportingAllocation[] = [];
  const pending: Array<{ id: string; invoiceDate: string; vendorId: string; amount: Money; href: string }> = [];
  const invoices = fixture.invoices.filter((row) => row.organizationId === organizationId);
  const canonicalIds = new Set(invoices.map((row) => row.id));
  const sources = new Map((fixture.accountingInvoiceSources ?? []).filter((row) => row.organizationId === organizationId && row.invoiceId).flatMap((row) => {
    try {
      const payload = JSON.parse(row.payloadJson);
      return payload?.delivery?.kind === "bill" ? [[row.invoiceId!, { source: row }] as const] : [];
    } catch { return []; }
  }));
  const byInvoice = new Map<string, OpsFixture["invoiceLines"]>();
  for (const line of fixture.invoiceLines.filter((row) => row.organizationId === organizationId)) byInvoice.set(line.invoiceId, [...(byInvoice.get(line.invoiceId) ?? []), line]);
  const byLine = new Map<string, OpsFixture["invoiceLineAllocations"]>();
  for (const split of fixture.invoiceLineAllocations.filter((row) => row.organizationId === organizationId)) byLine.set(split.invoiceLineId, [...(byLine.get(split.invoiceLineId) ?? []), split]);
  for (const invoice of invoices) {
    const lines = byInvoice.get(invoice.id) ?? [];
    const { excluded, reconciles, supported } = invoiceLinkFacts({ invoiceLines: lines, invoiceLineAllocations: lines.flatMap(line => byLine.get(line.id) ?? []), accountingInvoiceSources: fixture.accountingInvoiceSources }, invoice);
    if (excluded) continue;
    let confirmed = 0;
      for (const split of supported) {
        confirmed += split.amount.amountMinor;
        allocations.push({ ...split, invoiceId: invoice.id, invoiceNumber: invoice.vendorInvoiceNumber, invoiceDate: invoice.invoiceDate, vendorId: invoice.vendorId, gross: invoice.total, href: `/app/invoices/${invoice.id}?section=matches&match=${encodeURIComponent(split.id)}#allocation-${split.id}` });
      }
    if (!reconciles || confirmed < invoice.total.amountMinor) pending.push({ id: invoice.id, invoiceDate: invoice.invoiceDate, vendorId: invoice.vendorId, amount: { amountMinor: Math.max(0, invoice.total.amountMinor - confirmed), currency: invoice.total.currency }, href: sources.has(invoice.id) ? `/app/invoices/accounting?source=${sources.get(invoice.id)!.source.id}` : `/app/invoices/${invoice.id}` });
  }
  for (const invoice of fixture.invoiceReferences.filter((row) => row.organizationId === organizationId && !canonicalIds.has(row.id))) {
    const splits = fixture.invoiceAllocations.filter((row) => row.organizationId === organizationId && row.invoiceReferenceId === invoice.id && row.confirmedAt && row.amount.currency === invoice.grossAmount.currency);
    if (invoice.matchStatus !== "confirmed" || splits.reduce((sum, row) => sum + row.amount.amountMinor, 0) !== invoice.grossAmount.amountMinor) { pending.push({ id: invoice.id, invoiceDate: invoice.invoiceDate, vendorId: invoice.vendorId, amount: invoice.grossAmount, href: `/app/invoices/${invoice.id}` }); continue; }
    for (const split of splits) allocations.push({ ...split, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate, vendorId: invoice.vendorId, gross: invoice.grossAmount, href: `/app/invoices/${invoice.id}` });
  }
  return { allocations, pending };
}
