import type { Invoice, OpsFixture } from "./types";

/** Canonical linked-amount rules, independent of the record's display cohort. */
export function invoiceLinkFacts(fixture: Pick<OpsFixture, "invoiceLines" | "invoiceLineAllocations" | "accountingInvoiceSources">, invoice: Invoice) {
  const lines = fixture.invoiceLines.filter(l => l.organizationId === invoice.organizationId && l.invoiceId === invoice.id);
  const ids = new Set(lines.map(l => l.id));
  const eligible = fixture.invoiceLineAllocations.filter(a => a.organizationId === invoice.organizationId && ids.has(a.invoiceLineId) && a.confirmedAt && a.amount.amountMinor > 0 && a.amount.currency === invoice.total.currency);
  const excluded = invoice.status === "void" || (fixture.accountingInvoiceSources ?? []).some(s => {
    if (s.organizationId !== invoice.organizationId || s.invoiceId !== invoice.id) return false;
    try { const p = JSON.parse(s.payloadJson); return p?.delivery?.kind === "bill" && p.delivery.maintenance === false; } catch { return false; }
  });
  const reconciles = lines.every(l => l.lineAmount.currency === invoice.total.currency) && lines.reduce((sum, l) => sum + l.lineAmount.amountMinor, 0) === invoice.total.amountMinor;
  const totals = new Map<string, number>(); for (const a of eligible) totals.set(a.invoiceLineId, (totals.get(a.invoiceLineId) ?? 0) + a.amount.amountMinor);
  const limits = new Map(lines.map(l => [l.id, l.lineAmount.amountMinor]));
  const supported = excluded || !reconciles ? [] : eligible.filter(a => totals.get(a.invoiceLineId)! <= limits.get(a.invoiceLineId)!);
  return { excluded, reconciles, supported };
}
