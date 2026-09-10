import type { AccountingInvoiceDelivery } from "./accounting-import";

export interface AccountingChanges {
  financial: boolean;
  matching: boolean;
  payment: boolean;
  metadata: boolean;
  allMatches: boolean;
  lineIds: string[];
  reasons: string[];
}

/** Source references are matching evidence even when the price stays the same. */
export function classifyAccountingChanges(before: AccountingInvoiceDelivery, after: AccountingInvoiceDelivery): AccountingChanges {
  const result: AccountingChanges = { financial: false, matching: false, payment: before.paidMinor !== after.paidMinor, metadata: false, allMatches: false, lineIds: [], reasons: [] };
  const reason = (text: string) => { if (!result.reasons.includes(text)) result.reasons.push(text); };
  if (before.vendorId !== after.vendorId || before.vendorExternalId !== after.vendorExternalId) {
    result.financial = result.matching = result.allMatches = true; reason("Accounting changed the vendor. Check the linked work.");
  }
  if (before.currency !== after.currency || before.totalMinor !== after.totalMinor) {
    result.financial = true; reason("Accounting changed the invoice amount or currency. Check the charges.");
    if (before.currency !== after.currency) result.matching = result.allMatches = true;
  }
  if (before.maintenance !== after.maintenance || before.voided !== after.voided || before.relatedExternalInvoiceId !== after.relatedExternalInvoiceId) {
    result.financial = result.matching = result.allMatches = true;
    reason(after.voided ? "Accounting voided this invoice. Its charges are excluded from linked invoice totals." : !after.maintenance ? "Accounting moved this invoice outside maintenance. Its charges are excluded from maintenance totals." : "Accounting changed what this invoice covers. Check the linked work.");
  }
  const old = new Map(before.lines.map((line) => [line.id, line]));
  const next = new Map(after.lines.map((line) => [line.id, line]));
  for (const key of new Set([...old.keys(), ...next.keys()])) {
    const a = old.get(key), b = next.get(key);
    if (!a || !b || a.amountMinor !== b.amountMinor || a.category !== b.category || a.description !== b.description) {
      result.financial = result.matching = true; result.lineIds.push(key);
      reason(!a || !b ? "Accounting added or removed invoice items. Check the linked work." : "Accounting changed an invoice item. Check its amount, description and linked work.");
    }
    if (a && b && (a.storeCode !== b.storeCode || a.workOrderNumber !== b.workOrderNumber)) {
      result.matching = true; result.lineIds.push(key);
      reason(a.storeCode !== b.storeCode ? "Accounting changed the store reference. Check the linked work." : "Accounting changed the work-order reference. Check the linked work.");
    }
  }
  result.lineIds = [...new Set(result.lineIds)];
  result.metadata = before.invoiceDate !== after.invoiceDate || before.invoiceNumber !== after.invoiceNumber || before.documentUrl !== after.documentUrl;
  return result;
}
