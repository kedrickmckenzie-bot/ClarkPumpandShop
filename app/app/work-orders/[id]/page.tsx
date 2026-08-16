import type { Metadata } from "next";
import { WorkOrderCase } from "@/components/workspace/work-order-case";
import { loadDetailModel, loadEstimateComparisonModel, loadVendorIssuanceModel, loadWorkOrderControlModel, loadWorkOrderRecordingModel } from "../../_data/operator-loader";
import { loadWorkOrderReplacementIntelligenceModel } from "../../_data/replacement-loader";

export const metadata: Metadata = { title: "Work order" };

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const [model, control, recording, estimateComparison, issuance, replacement] = await Promise.all([
    loadDetailModel("work-order", id),
    loadWorkOrderControlModel(id),
    loadWorkOrderRecordingModel(id),
    loadEstimateComparisonModel(id),
    loadVendorIssuanceModel(id),
    loadWorkOrderReplacementIntelligenceModel(id),
  ]);
  const hasServiceAuthorization = Boolean(issuance.currentRevision);
  const bidPathIsNext = estimateComparison.permitted
    && !estimateComparison.workflowBlocked
    && !estimateComparison.selectedVendorName
    && (estimateComparison.activeRequestCount > 0 || control.nextAction.toLowerCase().includes("bid"));

  model.page.eyebrow = hasServiceAuthorization ? "Work Order / Service Authorization" : "Operator work order";
  if (bidPathIsNext) {
    model.page.primaryAction = {
      label: estimateComparison.proposalCount > 0
        ? "Review vendor bids"
        : estimateComparison.activeRequestCount > 0
          ? "Track vendor bids"
          : "Request vendor bids",
      href: "#bid-requests",
    };
  }
  return (
    <WorkOrderCase
      model={model}
      control={control}
      recording={recording}
      estimateComparison={estimateComparison}
      issuance={issuance}
      replacement={replacement}
      updated={updated}
    />
  );
}
