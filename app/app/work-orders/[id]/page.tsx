import type { Metadata } from "next";
import { VendorIssuancePanel } from "@/components/ops/forms";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel, loadVendorIssuanceModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Work order" };

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, issuance] = await Promise.all([loadDetailModel("work-order", id), loadVendorIssuanceModel(id)]);
  return <DetailView model={model} after={<VendorIssuancePanel model={issuance} />} />;
}
