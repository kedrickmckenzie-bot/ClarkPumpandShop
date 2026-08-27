import type { Metadata } from "next";
import { WorkOrderCase } from "@/components/workspace/work-order-case";
import { WorkOrderStageRail } from "@/components/workspace/work-order-case-stage-rail";
import { VendorResponseActions } from "@/components/workspace/vendor-response-actions";
import { HeldWorkActions } from "@/components/workspace/held-work-actions";
import { loadDetailModel, loadEstimateComparisonModel, loadHeldWorkActionsModel, loadOperatorSession, loadVendorIssuanceModel, loadWorkOrderCaseModel, loadWorkOrderControlModel, loadWorkOrderRecordingModel, loadVendorResponseActionsModel } from "../../_data/operator-loader";
import { loadWorkOrderReplacementIntelligenceModel } from "../../_data/replacement-loader";
import { loadWorkOrderVerificationModel } from "../../_data/work-order-verification-presenter";
import caseStyles from "@/components/workspace/owner-brief.module.css";

export const metadata: Metadata = { title: "Work order" };

const workOrderViews = ["overview", "service", "visits", "cost", "equipment", "activity"] as const;

type WorkOrderView = (typeof workOrderViews)[number];

function selectedView(value: string | string[] | undefined): WorkOrderView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return workOrderViews.includes(candidate as WorkOrderView) ? candidate as WorkOrderView : "overview";
}

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[]; view?: string | string[]; notice?: string | string[]; error?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const requestedView = selectedView(query.view);
  const noticeRaw = query.notice;
  const notice = Array.isArray(noticeRaw) ? noticeRaw[0] : noticeRaw;
  const errorRaw = query.error;
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;
  const [model, control, recording, estimateComparison, issuance, replacement, verification, stageCase, responseActions, heldWork, session] = await Promise.all([
    loadDetailModel("work-order", id),
    loadWorkOrderControlModel(id),
    loadWorkOrderRecordingModel(id),
    loadEstimateComparisonModel(id),
    loadVendorIssuanceModel(id),
    loadWorkOrderReplacementIntelligenceModel(id),
    loadWorkOrderVerificationModel(id),
    loadWorkOrderCaseModel(id),
    loadVendorResponseActionsModel(id),
    loadHeldWorkActionsModel(id),
    loadOperatorSession(),
  ]);
  const accountabilityOnly = session.demoEdition === "accountability";
  const view = accountabilityOnly && !["overview", "service", "visits"].includes(requestedView)
    ? "overview"
    : requestedView;
  const hasServiceAuthorization = Boolean(issuance.currentRevision);
  const bidPathIsNext = !accountabilityOnly && estimateComparison.permitted
    && !estimateComparison.workflowBlocked
    && !estimateComparison.selectedVendorName
    && (estimateComparison.activeRequestCount > 0 || control.nextAction.toLowerCase().includes("bid"));

  model.page.eyebrow = hasServiceAuthorization ? "Work Order / Service Authorization" : "Operator work order";
  if (accountabilityOnly) model.page.secondaryAction = undefined;
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
    {notice ? (
      <p role="status" className={caseStyles.statusNotice}>
        {notice}
      </p>
    ) : null}
    {error ? (
      <p role="alert" className={caseStyles.errorNotice}>
        {error}
      </p>
    ) : null}
    {!accountabilityOnly ? <WorkOrderStageRail model={stageCase} /> : null}
    {view === "service" && responseActions ? (
      <VendorResponseActions model={{ ...responseActions, workOrderId: id }} />
    ) : null}
    {view === "service" && !accountabilityOnly ? <HeldWorkActions model={heldWork} /> : null}
    <WorkOrderCase
      model={model}
      control={control}
      recording={recording}
      estimateComparison={estimateComparison}
      issuance={issuance}
      replacement={replacement}
      verification={verification}
      canonicalCase={stageCase}
      activeView={view}
      edition={session.demoEdition}
      updated={updated}
    />
    </>
  );
}
