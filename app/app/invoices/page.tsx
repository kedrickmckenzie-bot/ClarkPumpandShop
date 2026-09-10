import Link from "next/link";
import type { Metadata } from "next";
import { InvoiceQueueWorkspace } from "@/components/ops/warranty-finance-workspace";
import { ReceiveInvoiceLink } from "@/components/ops/invoice-receive-workspace";
import { loadWarrantyFinanceWorkspace } from "../_data/warranty-finance-loader";

export const metadata: Metadata = { title: "Invoice references" };
export default async function InvoiceReferencesPage() { const {fixture,invoices,session}=await loadWarrantyFinanceWorkspace(); return <>{["executive","facilities","finance"].includes(session.role)?<><ReceiveInvoiceLink/><p><Link href="/app/invoices/accounting">Review invoices from accounting</Link></p></>:null}<InvoiceQueueWorkspace fixture={fixture} invoices={invoices} /></>; }
