import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Service visit" };

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView model={await loadDetailModel("visit", id)} />;
}
