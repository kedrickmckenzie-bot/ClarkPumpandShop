import type { Metadata } from "next";
import { InvoiceDetailWorkspace } from "@/components/ops/warranty-finance-workspace";
import { loadWarrantyFinanceWorkspace } from "../../_data/warranty-finance-loader";

export const metadata: Metadata = { title: "Invoice reference" };

export default async function InvoiceReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {fixture,selectedInvoice,canDecideInvoice}=await loadWarrantyFinanceWorkspace({invoiceId:id});
  return <InvoiceDetailWorkspace fixture={fixture} invoice={selectedInvoice!} canDecide={canDecideInvoice} />;
}
