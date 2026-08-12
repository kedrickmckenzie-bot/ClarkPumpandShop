import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Invoice reference" };

export default async function InvoiceReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadDetailModel("invoice", id);
  return <DetailView model={model} />;
}
