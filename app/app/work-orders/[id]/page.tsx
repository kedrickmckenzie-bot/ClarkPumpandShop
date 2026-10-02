import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { SentWorkOrders } from "@/components/workspace/sent-work-orders";
import { workWarrantyReview } from "@/lib/ops/work-warranty-review";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import {LinkedStoreTasks} from "@/components/workspace/linked-store-tasks";
import { WorkFiles } from "@/components/workspace/work-files";
import {WorkWarrantyContext} from "@/components/workspace/work-warranty-context";
import { WorkInspectionContext } from "@/components/workspace/work-inspection-context";
import { WorkEmailHistory } from "@/components/workspace/work-email-history";
import { WorkCostPrompts } from "@/components/workspace/work-cost-prompts";
import { safeDecisionReturn } from "@/lib/ops/review-navigation";
import Link from "next/link";
import { redirect } from "next/navigation";
import { nextActionRedirect } from "@/lib/ops/workflow-task-destination";
import type { Metadata } from "next";
import { WorkPricePanel } from "@/components/workspace/work-price-panel";
import { WorkOrderCase } from "@/components/workspace/work-order-case";
import { loadConnectedWorkReview, loadDetailModel, loadEstimateComparisonModel, loadHeldWorkActionsModel, loadOperatorSession, loadVendorIssuanceModel, loadWorkOrderCaseModel, loadWorkOrderControlModel, loadWorkOrderRecordingModel, loadVendorResponseActionsModel } from "../../_data/operator-loader";
import { loadWorkOrderReplacementIntelligenceModel } from "../../_data/replacement-loader";
import { loadWorkOrderVerificationModel } from "../../_data/work-order-verification-presenter";
import caseStyles from "@/components/workspace/owner-brief.module.css";
import type { WorkOrderServicePath } from "@/lib/ops/work-order-workspace";

export const metadata: Metadata = { title: "Work order" };

const workOrderViews = ["overview", "service", "visits", "confirmation", "cost", "equipment", "activity"] as const;

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

export default async function WorkOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnDecision?: string | string[]; updated?: string | string[]; view?: string | string[]; path?: string | string[]; notice?: string | string[]; error?: string | string[]; reconcile?: string | string[]; next?: string | string[]; reviewQueue?: string | string[]; reviewItem?: string | string[]; reviewAfter?: string | string[]; reviewNext?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const returnDecision = safeDecisionReturn(Array.isArray(query.returnDecision) ? query.returnDecision[0] : query.returnDecision);
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const requestedView = selectedView(query.view);
  const requestedServicePath = selectedServicePath(query.path);
  const noticeRaw = query.notice;
  const notice = Array.isArray(noticeRaw) ? noticeRaw[0] : noticeRaw;
  const reconcileId = Array.isArray(query.reconcile) ? query.reconcile[0] : query.reconcile;
  const errorRaw = query.error;
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;
  const [model, control, recording, estimateComparison, issuance, replacement, verification, stageCase, responseActions, heldWork, session, connectedReview] = await Promise.all([
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
    ["overview", "equipment"].includes(requestedView) ? loadConnectedWorkReview(id) : null,
  ]);
  const accountabilityOnly = session.demoEdition === "accountability";
  const warrantyReview = await workWarrantyReview(await getServerOpsRepository(),session,id,new Date().toISOString().slice(0,10));
  issuance.possibleWarranty = warrantyReview?.possible ?? false;
  const view = accountabilityOnly && !["overview", "service", "visits", "confirmation"].includes(requestedView)
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

  model.page.eyebrow = hasServiceAuthorization ? "Work order · sent to vendor" : "Work order";
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
  if (estimateComparison.replacementApproved && issuance.permitted) model.page.primaryAction = stageCase.primaryNextAction;
  const viewerAction = verification.canDecide
    ? { label: "Confirm work", href: `/app/work-orders/${id}?view=confirmation#work-verification` }
    : verification.canCorrect
      ? { label: "View confirmation", href: `/app/work-orders/${id}?view=confirmation#work-verification` }
    : responseActions
      ? { label: responseActions.kind === "question" ? "Answer the vendor question" : responseActions.kind === "proposed_date" ? "Review the proposed visit time" : responseActions.kind === "declined" ? "Choose another provider" : "Review vendor response", href: `/app/work-orders/${id}?view=service#vendor-response` }
      : heldStatus && ["active", "claimed", "review_required"].includes(heldStatus)
        ? heldCase.primaryNextAction
        : (model.page.primaryAction && session.role !== "finance" ? heldCase.primaryNextAction : model.page.primaryAction)
          ?? (session.role === "finance"
            ? { label: "Review financial evidence", href: `/app/work-orders/${id}?view=cost` }
            : heldCase.primaryNextAction);
  if (warrantyReview?.possible && viewerAction?.href?.includes("#issue-work")) {
    // Before sending work that may be covered, the next step is checking coverage; sending stays one click away.
    const providers = [...new Set(warrantyReview.coverage.items.map((term) => term.provider).filter(Boolean))];
    model.page.secondaryAction = { label: "Send anyway", href: viewerAction.href };
    viewerAction.label = providers.length === 1 ? `Check warranty with ${providers[0]}` : "Review warranty coverage";
    viewerAction.href = `/app/work-orders/${id}#work-warranty`;
  }
  // Queue links ask for the current action; send them where that action is actually done.
  if ((Array.isArray(query.next) ? query.next[0] : query.next) === "action") {
    let target = viewerAction?.href;
    // Inspection work is done on the inspection itself, not on the work order's task list.
    if (!target || target.includes("#workflow-tasks")) {
      const inspection = await (await getServerOpsRepository()).inspectionForWork(session.organizationId, id);
      if (inspection && inspection.correctiveWorkOrderId !== id && inspection.status !== "passed") target = `/app/compliance/${encodeURIComponent(inspection.id)}`;
    }
    if (target?.startsWith("/app/")) redirect(nextActionRedirect(target, query));
  }
  // Header facts that explain the job on every tab: equipment, and the confirmed visit (distinct from the due date).
  const headerRepository = await getServerOpsRepository();
  const [headerDetail, headerAppointments] = await Promise.all([
    headerRepository.getWorkOrderDetail(session, id),
    headerRepository.listServiceAppointmentsForWorkOrder(session.organizationId, id),
  ]);
  const headerStore = headerDetail ? await headerRepository.getStore(session.organizationId, headerDetail.storeId) : null;
  const nextVisit = headerAppointments.filter((row) => row.status === "confirmed" && row.startsAt >= new Date().toISOString()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const headerFacts = [
    ...(headerDetail?.asset ? [{ label: "Equipment", value: [headerDetail.asset.name, headerDetail.component?.name].filter(Boolean).join(" · "), href: `/app/equipment/${encodeURIComponent(headerDetail.asset.id)}` }] : []),
    ...(nextVisit ? [{ label: "Scheduled visit", value: formatOperationsDateTime(nextVisit.startsAt, headerStore?.timeZone) }] : []),
  ];
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
        {reconcileId ? <Link href={`/app/action-center/${encodeURIComponent(reconcileId)}?workOrder=${encodeURIComponent(id)}`}>Link the saved work order</Link> : null}
      </p>
    ) : null}
    {returnDecision ? <Link href={returnDecision}>← Back to equipment review</Link> : null}
    <WorkOrderCase
      headerFacts={headerFacts}
      warrantyContext={<WorkWarrantyContext workOrderId={id}/>}
      sentWork={view === "service" ? <SentWorkOrders workOrderId={id}/> : undefined}
      emailHistory={["overview","activity"].includes(view) ? <><LinkedStoreTasks kind="work" id={id} hideEmpty/><WorkFiles workOrderId={id}/><WorkInspectionContext workOrderId={id}/><WorkEmailHistory workOrderId={id}/></> : undefined}
      costPrompts={["overview", "service"].includes(view) ? <WorkCostPrompts workOrderId={id}/> : undefined}
      prices={!accountabilityOnly && view === "cost" ? <WorkPricePanel workOrderId={id} /> : undefined}
      connectedReview={connectedReview}
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
      canAttachInvoice={!accountabilityOnly && control.status !== "cancelled" && ["executive", "facilities", "finance"].includes(session.role) && session.storeIds === undefined && session.regionIds === undefined && (session.accessMode === "preview" || Boolean(session.permissions?.length) && session.permissions!.every(p => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(p)))}
      activeServicePath={requestedServicePath}
      edition={session.demoEdition}
      updated={updated}
    />
    </>
  );
}
