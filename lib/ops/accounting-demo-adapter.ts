import type { AccountingInvoiceDelivery } from "./accounting-import";

/** Fictional normalized deliveries. No network connection or accounting write-back. */
export function accountingDemoDelivery(step: string): AccountingInvoiceDelivery {
  const base: AccountingInvoiceDelivery = {
    connectionKey: "demo-accounting", companyKey: "fictional-retail-company", externalInvoiceId: "demo-bill-104",
    revision: 1, vendorExternalId: "coldline-demo", vendorId: "vendor-northline-summit", invoiceNumber: "DEMO-ACCOUNTING-104",
    invoiceDate: "2026-09-09", currency: "USD", totalMinor: 45000, paidMinor: 0, voided: false,
    kind: "bill", maintenance: true,
    lines: [{ id: "repair", description: "Beer cave door repair", category: "labor", amountMinor: 35000, storeCode: "104", workOrderNumber: "CPS-2026-0104" }, { id: "travel", description: "Shared service call", category: "travel", amountMinor: 10000, storeCode: "104" }],
  };
  if (step === "uncertain") return { ...base, externalInvoiceId: "demo-bill-unknown", invoiceNumber: "DEMO-NEEDS-MATCH", lines: base.lines.map((line) => ({ ...line, storeCode: undefined, workOrderNumber: undefined })) };
  if (step === "correction") return { ...base, revision: 2, totalMinor: 40000, lines: base.lines.map((line) => line.id === "travel" ? { ...line, amountMinor: 5000, description: "Corrected shared service call" } : line) };
  if (step === "payment") return { ...accountingDemoDelivery("correction"), revision: 3, paidMinor: 40000 };
  if (step === "void") return { ...accountingDemoDelivery("payment"), revision: 4, paidMinor: 0, voided: true };
  if (step === "credit") return { ...base, externalInvoiceId: "demo-credit-104", invoiceNumber: "DEMO-CREDIT-104", kind: "credit", relatedExternalInvoiceId: base.externalInvoiceId, totalMinor: 5000, lines: [{ id: "credit", description: "Accounting credit for the shared call", category: "travel", amountMinor: 5000 }] };
  if (step === "merchandise") return { ...base, externalInvoiceId: "demo-merchandise", maintenance: false };
  return base;
}
