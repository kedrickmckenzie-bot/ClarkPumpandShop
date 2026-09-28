import { invoiceReaderConfigured } from "@/lib/server/invoice-extractor";
import type { Metadata } from "next";
import { InvoiceIntakeWorkspace } from "@/components/workspace/invoice-intake-workspace";
import { InvoiceUploadWorkspace } from "@/components/workspace/invoice-upload-workspace";
import { loadInvoiceIntake } from "../../_data/invoice-intake-loader";
export const metadata: Metadata = { title: "Upload invoices" };
export default async function ReceiveInvoicePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){const query=await searchParams??{},model=await loadInvoiceIntake(query);return query.manual||query.upload||query.work?<InvoiceIntakeWorkspace {...model}/>:<InvoiceUploadWorkspace readerEnabled={invoiceReaderConfigured()}/>;}
