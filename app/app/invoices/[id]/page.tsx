import { RecordFiles } from "@/components/workspace/record-files";
import type { Metadata } from "next";
import { InvoiceRecordWorkspace } from "@/components/workspace/invoice-record-workspace";
import { loadInvoiceRecord } from "../../_data/invoice-record-loader";

export const metadata: Metadata = { title: "Invoice review" };

export default async function InvoiceReferenceDetailPage({ params, searchParams = Promise.resolve({}) }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const model = await loadInvoiceRecord(id, query);
  return <InvoiceRecordWorkspace {...model} documents={<RecordFiles kind="invoice" id={id} />} />;
}
