import type { Metadata } from "next";
import { WorkOrderCase } from "@/components/workspace/work-order-case";
import { WorkOrderStageRail } from "@/components/workspace/work-order-case-stage-rail";
import { loadDetailModel, loadEstimateComparisonModel, loadVendorIssuanceModel, loadWorkOrderCaseModel, loadWorkOrderControlModel, loadWorkOrderRecordingModel } from "../../_data/operator-loader";
import { loadWorkOrderReplacementIntelligenceModel } from "../../_data/replacement-loader";
import { loadWorkOrderVerificationModel } from "../../_data/work-order-verification-presenter";

export const metadata: Metadata = { title: "Work order" };

const workOrderViews = ["overview", "service", "visits", "cost", "equipment", "activity"] as const;

type WorkOrderView = (typeof workOrderViews)[number];

function selectedView(value: string | string[] | undefined): WorkOrderView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return workOrderViews.includes(candidate as WorkOrderView) ? candidate as WorkOrderView : "overview";
}

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[]; view?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const view = selectedView(query.view);
  const [model, control, recording, estimateComparison, issuance, replacement, verification, stageCase] = await Promise.all([
    loadDetailModel("work-order", id),
    loadWorkOrderControlModel(id),
    loadWorkOrderRecordingModel(id),
    loadEstimateComparisonModel(id),
    loadVendorIssuanceModel(id),
    loadWorkOrderReplacementIntelligenceModel(id),
    loadWorkOrderVerificationModel(id),
    loadWorkOrderCaseModel(id),
  ]);
  const hasServiceAuthorization = Boolean(issuance.currentRevision);
  const bidPathIsNext = estimateComparison.permitted
    && !estimateComparison.workflowBlocked
    && !estimateComparison.selectedVendorName
    && (estimateComparison.activeRequestCount > 0 || control.nextAction.toLowerCase().includes("bid"));

  model.page.eyebrow = hasServiceAuthorization ? "Work Order / Service Authorization" : "Operator work order";
  if (model.page.primaryAction?.href === "#issue-work") {
    model.page.primaryAction = { ...model.page.primaryAction, href: `/app/work-orders/${id}?view=service#issue-work` };
  }
  if (bidPathIsNext) {
    model.page.primaryAction = {
      label: estimateComparison.proposalCount > 0
        ? "Review vendor bids"
        : estimateComparison.activeRequestCount > 0
          ? "Track vendor bids"
          : "Request vendor bids",
      href: `/app/work-orders/${id}?view=service#bid-requests`,
    };
  }
  return (
    <>
    <WorkOrderStageRail model={stageCase} />
    <WorkOrderCase
      model={model}
      control={control}
      recording={recording}
      estimateComparison={estimateComparison}
      issuance={issuance}
      replacement={replacement}
      verification={verification}
      activeView={view}
      updated={updated}
    />
    </>
  );
}
