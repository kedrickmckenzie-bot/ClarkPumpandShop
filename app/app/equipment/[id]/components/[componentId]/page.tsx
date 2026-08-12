import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { loadComponentDetailModel } from "../../../../_data/setup-loader";

export const metadata: Metadata = { title: "Component detail" };

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string; componentId: string }>;
}) {
  const { id, componentId } = await params;
  return <DetailView model={await loadComponentDetailModel(id, componentId)} />;
}
