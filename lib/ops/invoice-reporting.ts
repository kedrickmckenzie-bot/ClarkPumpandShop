import type { OpsFixture, Money } from "./types";

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
    const payload = JSON.parse(row.payloadJson) as { delivery: { kind: string; maintenance: boolean } };
    return payload.delivery.kind === "bill" ? [[row.invoiceId!, { source: row, maintenance: payload.delivery.maintenance }] as const] : [];
  }));
  const byInvoice = new Map<string, OpsFixture["invoiceLines"]>();
  for (const line of fixture.invoiceLines.filter((row) => row.organizationId === organizationId)) byInvoice.set(line.invoiceId, [...(byInvoice.get(line.invoiceId) ?? []), line]);
  const byLine = new Map<string, OpsFixture["invoiceLineAllocations"]>();
  for (const split of fixture.invoiceLineAllocations.filter((row) => row.organizationId === organizationId)) byLine.set(split.invoiceLineId, [...(byLine.get(split.invoiceLineId) ?? []), split]);
  for (const invoice of invoices) {
    if (invoice.status === "void" || sources.get(invoice.id)?.maintenance === false) continue;
    const lines = byInvoice.get(invoice.id) ?? [];
    let confirmed = 0;
    const reconciles = lines.every((line) => line.lineAmount.currency === invoice.total.currency) && lines.reduce((sum, line) => sum + line.lineAmount.amountMinor, 0) === invoice.total.amountMinor;
    if (reconciles) for (const line of lines) {
      const splits = (byLine.get(line.id) ?? []).filter((split) => split.confirmedAt && split.amount.amountMinor > 0 && split.amount.currency === invoice.total.currency);
      if (splits.reduce((sum, split) => sum + split.amount.amountMinor, 0) > line.lineAmount.amountMinor) continue;
      for (const split of splits) {
        confirmed += split.amount.amountMinor;
        allocations.push({ ...split, invoiceId: invoice.id, invoiceNumber: invoice.vendorInvoiceNumber, invoiceDate: invoice.invoiceDate, vendorId: invoice.vendorId, gross: invoice.total, href: `/app/invoices/${invoice.id}#allocation-${split.id}` });
      }
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
