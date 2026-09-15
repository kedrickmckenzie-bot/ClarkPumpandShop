import type { Metadata } from "next";
import { InvoiceRecordWorkspace } from "@/components/workspace/invoice-record-workspace";
import { loadInvoiceRecord } from "../../_data/invoice-record-loader";

export const metadata: Metadata = { title: "Invoice review" };

export default async function InvoiceReferenceDetailPage({ params, searchParams = Promise.resolve({}) }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <InvoiceRecordWorkspace {...await loadInvoiceRecord(id, query)} />;
}
