import type { Metadata } from "next";
import Link from "next/link";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { accountingPayload } from "@/lib/ops/accounting-import";
import { InvoiceDetailWorkspace } from "@/components/ops/warranty-finance-workspace";
import { loadWarrantyFinanceWorkspace } from "../../_data/warranty-finance-loader";

export const metadata: Metadata = { title: "Invoice reference" };

export default async function InvoiceReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {fixture,session,selectedInvoice,canDecideInvoice}=await loadWarrantyFinanceWorkspace({invoiceId:id});
  const sources = ["executive", "facilities", "finance"].includes(session.role) && !session.storeIds?.length && !session.regionIds?.length ? await (await getServerOpsRepository()).listAccountingSourcesForInvoice(session.organizationId, id) : [];
  return <>{sources.length ? <nav aria-label="Accounting source records">{sources.map((source) => { const delivery = accountingPayload(source).delivery; return <p key={source.id}><Link href={`/app/invoices/accounting?source=${source.id}`}>{delivery.kind === "credit" ? "Review related accounting credit" : "Review accounting updates and original document"}: {delivery.invoiceNumber}</Link></p>; })}</nav> : null}<InvoiceDetailWorkspace fixture={fixture} invoice={selectedInvoice!} canDecide={canDecideInvoice} /></>;
}
