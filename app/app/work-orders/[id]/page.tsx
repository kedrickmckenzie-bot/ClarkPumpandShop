import type { Metadata } from "next";
import { WorkOrderCase } from "@/components/workspace/work-order-case";
import { loadDetailModel, loadEstimateComparisonModel, loadHeldWorkActionsModel, loadOperatorSession, loadVendorIssuanceModel, loadWorkOrderCaseModel, loadWorkOrderControlModel, loadWorkOrderRecordingModel, loadVendorResponseActionsModel } from "../../_data/operator-loader";
import { loadWorkOrderReplacementIntelligenceModel } from "../../_data/replacement-loader";
import { loadWorkOrderVerificationModel } from "../../_data/work-order-verification-presenter";
import caseStyles from "@/components/workspace/owner-brief.module.css";
import type { WorkOrderServicePath } from "@/lib/ops/work-order-workspace";

export const metadata: Metadata = { title: "Work order" };

const workOrderViews = ["overview", "service", "visits", "cost", "equipment", "activity"] as const;

type WorkOrderView = (typeof workOrderViews)[number];

function selectedView(value: string | string[] | undefined): WorkOrderView {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "accountability") return "activity";
  return workOrderViews.includes(candidate as WorkOrderView) ? candidate as WorkOrderView : "overview";
}

function selectedServicePath(value: string | string[] | undefined): WorkOrderServicePath | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "direct" || candidate === "bids" ? candidate : undefined;
}

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[]; view?: string | string[]; path?: string | string[]; notice?: string | string[]; error?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const requestedView = selectedView(query.view);
  const requestedServicePath = selectedServicePath(query.path);
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
    && (estimateComparison.activeRequestCount > 0 || control.nextAction.toLowerCase().includes("bid") || control.nextAction.toLowerCase().includes("quote"));
  const heldStatus = heldWork.hold?.status;
  const heldCase = heldStatus && ["active", "claimed", "review_required"].includes(heldStatus)
    ? {
        ...stageCase,
        stageLabel: heldStatus === "claimed" ? "Being reviewed onsite" : heldStatus === "review_required" ? "Vendor findings need review" : "Approved for a future visit",
        accountableParty: heldStatus === "claimed" ? heldWork.hold?.claimedVendorName ?? "Onsite vendor" : stageCase.internalAccountableParty,
        primaryNextAction: {
          label: heldStatus === "claimed" ? "Track the active visit" : heldStatus === "review_required" ? "Review the vendor findings" : "Wait for a suitable vendor visit",
          href: `/app/work-orders/${id}?view=service#future-visit-hold`,
        },
        blockingReason: heldStatus === "active" ? "This work is approved and waiting to be offered during a suitable vendor visit." : stageCase.blockingReason,
      }
    : stageCase;

  model.page.eyebrow = hasServiceAuthorization ? "Work Order / Service Authorization" : "Operator work order";
  if (accountabilityOnly) model.page.secondaryAction = undefined;
  if (model.page.primaryAction?.href === "#issue-work") {
    model.page.primaryAction = hasServiceAuthorization
      ? { label: "Review service authorization", href: `/app/work-orders/${id}?view=service#service-authorization-history` }
      : { ...model.page.primaryAction, href: `/app/work-orders/${id}?view=service&path=direct#issue-work` };
  }
  if (bidPathIsNext) {
    model.page.primaryAction = {
      label: estimateComparison.proposalCount > 0
        ? "Review vendor quotes"
        : estimateComparison.activeRequestCount > 0
          ? "Track vendor quotes"
          : "Request vendor quotes",
      href: `/app/work-orders/${id}?view=service&path=bids#bid-requests`,
    };
  }
  const viewerAction = verification.canDecide
    ? { label: "Confirm whether the problem is resolved", href: `/app/work-orders/${id}?view=visits#work-verification` }
    : responseActions
      ? { label: responseActions.kind === "question" ? "Answer the vendor question" : responseActions.kind === "proposed_date" ? "Review the proposed visit time" : responseActions.kind === "declined" ? "Choose another provider" : "Review vendor response", href: `/app/work-orders/${id}?view=service#vendor-response` }
      : heldStatus && ["active", "claimed", "review_required"].includes(heldStatus)
        ? heldCase.primaryNextAction
        : model.page.primaryAction
          ?? (session.role === "finance"
            ? { label: "Review financial evidence", href: `/app/work-orders/${id}?view=cost` }
            : { label: "Review current status", href: `/app/work-orders/${id}?view=overview` });
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
    <WorkOrderCase
      model={model}
      control={control}
      recording={recording}
      estimateComparison={estimateComparison}
      issuance={issuance}
      replacement={replacement}
      verification={verification}
      canonicalCase={heldCase}
      viewerAction={viewerAction}
      heldWork={heldWork}
      vendorResponse={responseActions ? { ...responseActions, workOrderId: id } : undefined}
      activeView={view}
      activeServicePath={requestedServicePath}
      edition={session.demoEdition}
      updated={updated}
    />
    </>
  );
}
