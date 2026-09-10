import type {
  CostLine,
  FollowUp,
  InvoiceAdjustment,
  InvoiceException,
  InvoiceLine,
  InvoiceLineAllocation,
  RequestImpactAssessment,
  ServiceAppointment,
  SiteVisitWorkOrder,
  VendorResponse,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderIssuance,
  WorkOrderVerification,
  WorkflowTask,
  ValueEvent,
} from "./types";
import { selectWorkflowTaskProjection } from "./workflow-task-commands";
import { applicableOutcomeVerification, latestRecordedWorkOutcome } from "./work-order-outcome";

/**
 * The canonical stage rail: one computed plain-language service stage for every
 * open work order, projected from persisted domain records. Nothing here is
 * user-editable state; routine accountability is derived, and manual overrides
 * live in audited domain commands.
 *
 * Intake -> Approval -> Provider decision -> Authorization or bidding ->
 * Vendor response and scheduling -> Onsite service -> Follow-up and closeout ->
 * Cost and invoice evidence -> Closed
 */

export type WorkOrderCanonicalStageId =
  | "intake"
  | "approval"
  | "provider_decision"
  | "authorization_or_bidding"
  | "vendor_response_scheduling"
  | "onsite_service"
  | "followup_closeout"
  | "cost_invoice_evidence"
  | "closed";

export type WorkOrderServiceSubStage =
  | "authorization_ready"
  | "waiting_on_vendor"
  | "question_pending"
  | "date_proposed"
  | "counterproposal_pending"
  | "accepted"
  | "scheduled"
  | "onsite"
  | "followup_required"
  | "closeout_review";

export interface WorkOrderCaseStageView {
  id: WorkOrderCanonicalStageId;
  label: string;
  state: "complete" | "current" | "upcoming";
}

export interface WorkOrderCaseAction {
  label: string;
  href: string;
}

export interface WorkOrderCaseDimension {
  id: string;
  label: string;
  detail: string;
  certainty?: "verified" | "reported" | "uncertain" | "unknown";
  sourceLabel?: string;
  observedAt?: string;
  facts?: Array<{ label: string; value: string }>;
  href?: string;
}

export interface WorkOrderCaseObligation {
  id: string;
  label: string;
  owner: string;
  dueAt?: string;
  deadlinePolicy: string;
  href: string;
}

export interface WorkOrderCaseView {
  workOrderId: string;
  workOrderNumber: string;
  storeName?: string;
  problem: string;
  priority: string;
  timeZone: string;
  stage: WorkOrderCanonicalStageId;
  stageLabel: string;
  stageIndex: number;
  stages: WorkOrderCaseStageView[];
  serviceSubStage?: { id: WorkOrderServiceSubStage; label: string };
  /** Prominent conclusion derived from service evidence, not a manually selected lifecycle code. */
  plainLanguageState: string;
  internalAccountableParty: string;
  internalAccountableType?: "membership" | "team";
  internalAccountableId?: string;
  internalAccountabilityStructured: boolean;
  nextActionOwner: string;
  /** Compatibility alias for the primary next-action owner. */
  accountableParty: string;
  primaryNextAction: WorkOrderCaseAction;
  dueAt?: string;
  deadlinePolicy: string;
  escalationDestination: string;
  escalationTrigger: string;
  blockingReason?: string;
  alternativeActions: WorkOrderCaseAction[];
  serviceProgress: WorkOrderCaseDimension;
  operatingCondition: WorkOrderCaseDimension;
  financialReview: WorkOrderCaseDimension;
  additionalObligations: WorkOrderCaseObligation[];
  /** True when the projected due time has passed (input.now vs dueAt). */
  primaryActionOverdue: boolean;
}

export const CANONICAL_STAGE_LABELS: Record<WorkOrderCanonicalStageId, string> = {
  intake: "Intake",
  approval: "Approval",
  provider_decision: "Provider decision",
  authorization_or_bidding: "Authorization or quotes",
  vendor_response_scheduling: "Vendor response and scheduling",
  onsite_service: "Onsite service",
  followup_closeout: "Follow-up and closeout",
  cost_invoice_evidence: "Cost and invoice evidence",
  closed: "Closed",
};

export const SERVICE_SUB_STAGE_LABELS: Record<WorkOrderServiceSubStage, string> = {
  authorization_ready: "Authorization ready",
  waiting_on_vendor: "Waiting on vendor",
  question_pending: "Question pending",
  date_proposed: "Date proposed",
  counterproposal_pending: "Waiting for vendor response to counterproposal",
  accepted: "Accepted",
  scheduled: "Scheduled",
  onsite: "Onsite",
  followup_required: "Follow-up required",
  closeout_review: "Closeout review",
};

const OPEN_TASK_STATUSES = new Set(["open", "in_progress"]);
const OPEN_FOLLOWUP_STATUSES = new Set(["open"]);

/**
 * Projects one work order's canonical case state. Every input array must
 * already be bounded to the organization and this work order by the caller.
 */
export function buildWorkOrderCase(input: WorkOrderCaseInput): WorkOrderCaseView {
  const { workOrder } = input;
  const allAssignments = [...(input.assignments ?? [])].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  const activeAssignment = allAssignments.find((row) => ["pending", "issued", "opened", "accepted"].includes(row.status));
  const openTasks = (input.workflowTasks ?? []).filter((row) => row.workOrderId === workOrder.id && OPEN_TASK_STATUSES.has(row.status));
  const projectionTasks: WorkflowTask[] = openTasks.map((task) => ({
    ...task,
    organizationId: task.organizationId ?? workOrder.organizationId,
    assigneeType: task.assigneeType ?? "team",
    assigneeId: task.assigneeId ?? "facilities-team",
    priority: task.priority ?? "normal",
    noSlaReason: task.noSlaReason,
    completionCriteria: task.completionCriteria ?? task.title,
    escalationLevel: task.escalationLevel ?? 0,
    createdByActorType: task.createdByActorType ?? "system",
    createdByActorName: task.createdByActorName ?? "Workflow policy",
    createdAt: task.createdAt ?? workOrder.createdAt,
  }));
  const blockingTask = selectWorkflowTaskProjection(projectionTasks);
  const openFollowUps = (input.followUps ?? []).filter((row) => OPEN_FOLLOWUP_STATUSES.has(row.status));
  const closeoutFollowUps = openFollowUps.filter((row) => Boolean(row.sourceVisitId));
  const linkedVisitIds = new Set((input.siteVisitWorkOrders ?? []).filter((row) => row.workOrderId === workOrder.id).map((row) => row.visitId));
  const visits = (input.visits ?? []).filter((row) => row.workOrderId === workOrder.id || linkedVisitIds.has(row.id));
  const activeVisit = visits.find((row) => !row.checkedOutAt)
    ?? [...visits].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))[0];
  const hasCost = (input.costLines ?? []).some((row) => row.workOrderId === workOrder.id);
  const hasInvoices = (input.invoices ?? []).length > 0;
  const workCycles = (input.siteVisitWorkOrders ?? []).filter((row) => row.workOrderId === workOrder.id);
  const latestWorkOutcome = latestRecordedWorkOutcome(workCycles);
  const verifications = (input.verifications ?? []).filter((row) => row.workOrderId === workOrder.id);
  const latestVerification = applicableOutcomeVerification(verifications, latestWorkOutcome);
  const verificationNeedsOperationalReview = latestVerification?.decision === "rejected" || latestVerification?.decision === "inconclusive";
  const latestImpact = latest(input.impactAssessments ?? [], (row) => row.assessedAt);
  const estimateRequests = (input.estimateRequests ?? []).filter((row) => row.workOrderId === workOrder.id);
  const estimateProposals = (input.estimateProposals ?? []).filter((proposal) => estimateRequests.some((request) => request.id === proposal.requestId));
  const selectedEstimateRequest = estimateRequests.find((request) => request.status === "selected");
  const issuances = (input.issuances ?? []).filter((row) => !activeAssignment || row.assignmentId === activeAssignment.id);
  const currentIssuance = [...issuances].sort((a, b) => b.revision - a.revision)[0];
  const responses = (input.vendorResponses ?? []).filter((row) => !currentIssuance || row.issuanceId === currentIssuance.id);
  const latestResponse = latest(responses, (row) => row.respondedAt);
  const appointments = (input.appointments ?? []).filter((row) =>
    row.workOrderId === workOrder.id && (!activeAssignment || row.assignmentId === activeAssignment.id));
  const liveAppointment = [...appointments]
    .filter((row) => row.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const appointmentStartsNewCycle = Boolean(
    liveAppointment?.status === "confirmed"
    && latestWorkOutcome
    && liveAppointment.createdAt > (latestWorkOutcome.outcomeRecordedAt ?? latestWorkOutcome.linkedAt),
  );
  const continuations = (input.continuations ?? []).filter((row) => row.workOrderId === workOrder.id);
  const replacementEvent = latest((input.replacementEvents ?? []).filter((row) => row.workOrderId === workOrder.id), (row) => row.completedAt ?? row.approvedAt);
  const approvedReplacement = replacementEvent?.status === "approved";
  const completedReplacement = replacementEvent?.status === "completed";
  const hasContinuation = (action: string, responseId?: string) =>
    continuations.some((row) => row.action === action && (!responseId || row.vendorResponseId === responseId));
  const closeoutTask = openTasks.find((row) => row.taskType === "close_verified_work" || row.taskType === "verify_repair");

  // --- Canonical stage -----------------------------------------------------
  let stage: WorkOrderCanonicalStageId;
  const fullyClosed = workOrder.status === "closed" || workOrder.status === "cancelled";
  if (fullyClosed) {
    stage = "closed";
  } else if (completedReplacement) {
    stage = "cost_invoice_evidence";
  } else if (input.hasPendingApproval ?? (workOrder.status === "awaiting_approval" || (blockingTask?.taskType ?? "").includes("approval"))) {
    stage = "approval";
  } else if (!activeAssignment && blockingTask && blockingTask.serviceRequestId) {
    stage = "intake";
  } else if (approvedReplacement) {
    stage = "vendor_response_scheduling";
  } else if (!activeAssignment && estimateRequests.length > 0 && (!selectedEstimateRequest || selectedEstimateRequest.decisionKind === "replacement_quote")) {
    stage = "authorization_or_bidding";
  } else if (!activeAssignment || activeAssignment.kind === "choose_later") {
    stage = "provider_decision";
  } else if (activeVisit && !activeVisit.checkedOutAt) {
    stage = "onsite_service";
  } else if (appointmentStartsNewCycle) {
    stage = "vendor_response_scheduling";
  } else if (closeoutFollowUps.length > 0 || closeoutTask || verificationNeedsOperationalReview || workOrder.status === "completed_pending_review" || workOrder.status === "resolved") {
    stage = "followup_closeout";
  } else if (!currentIssuance && activeAssignment.kind === "outside_vendor" && visits.length === 0 && !hasCost) {
    stage = "authorization_or_bidding";
  } else if (visits.length > 0 || hasCost || hasInvoices) {
    // Post-visit: the case sits in cost and optional invoice evidence until
    // the manager closes it. Recorded cost never pulls it backward.
    stage = "cost_invoice_evidence";
  } else if (activeAssignment.kind === "internal") {
    stage = "onsite_service";
  } else {
    stage = "vendor_response_scheduling";
  }

  // --- Service sub-stage (external fulfillment detail) --------------------
  // Precedence: terminal > onsite presence > unresolved checkout / closeout >
  // appointment & correspondence > authorization state. A recorded cost never
  // pulls a completed job backward into vendor scheduling, and declined or
  // superseded assignments are not active fulfillment.
  let serviceSubStage: WorkOrderServiceSubStage | undefined;
  const onsiteNow = Boolean(activeVisit && !activeVisit.checkedOutAt && activeVisit.workOrderId === workOrder.id);
  const unresolvedCheckout = visits.some((row) => row.checkedOutAt && !row.outcome);
  if (fullyClosed) {
    stage = "closed";
    serviceSubStage = undefined;
  } else if (onsiteNow) {
    stage = "onsite_service";
    serviceSubStage = activeAssignment?.kind === "outside_vendor" ? "onsite" : undefined;
  } else if (appointmentStartsNewCycle) {
    stage = "vendor_response_scheduling";
    serviceSubStage = "scheduled";
  } else if (closeoutFollowUps.length > 0 || closeoutTask || verificationNeedsOperationalReview || unresolvedCheckout || workOrder.status === "completed_pending_review" || workOrder.status === "resolved") {
    stage = "followup_closeout";
    serviceSubStage = closeoutFollowUps.length > 0 || unresolvedCheckout || closeoutTask?.taskType === "verify_repair" ? "followup_required" : "closeout_review";
  } else if (stage === "cost_invoice_evidence") {
    serviceSubStage = undefined;
  } else if (stage === "vendor_response_scheduling" && activeAssignment?.kind === "outside_vendor") {
    if (liveAppointment?.status === "confirmed") serviceSubStage = "scheduled";
    else if (liveAppointment?.status === "counter_proposed") serviceSubStage = "counterproposal_pending";
    else if (latestResponse?.response === "question") serviceSubStage = hasContinuation("reply", latestResponse.id) ? "waiting_on_vendor" : "question_pending";
    else if (latestResponse?.response === "proposed_date") serviceSubStage = "date_proposed";
    else if (latestResponse?.response === "declined") serviceSubStage = "authorization_ready";
    else if (latestResponse?.response === "accepted") serviceSubStage = "accepted";
    else if (currentIssuance) serviceSubStage = "waiting_on_vendor";
    else serviceSubStage = "authorization_ready";
  }

  const base = `/app/work-orders/${workOrder.id}`;
  const stageActions: Partial<Record<WorkOrderCanonicalStageId, WorkOrderCaseAction>> = {
    intake: { label: "Review the request", href: blockingTask ? `${base}?view=activity#workflow-tasks` : `${base}?view=overview` },
    approval: { label: blockingTask?.title ?? "Review the approval decision", href: blockingTask ? `${base}?view=activity#workflow-tasks` : `${base}?view=activity` },
    provider_decision: { label: activeAssignment?.kind === "choose_later" ? "Choose a provider" : "Choose internal maintenance, direct authorization, or vendor quotes", href: `${base}?view=service` },
    authorization_or_bidding:
      selectedEstimateRequest?.decisionKind === "replacement_quote"
        ? { label: "Advance the selected replacement quote to capital review", href: `${base}?view=service&path=bids#bid-requests` }
      : estimateRequests.length > 0 && !selectedEstimateRequest
        ? { label: estimateProposals.length > 0 ? "Review vendor quotes" : "Track vendor quote requests", href: `${base}?view=service&path=bids#bid-requests` }
        : { label: "Issue the service authorization", href: `${base}?view=service&path=direct#issue-work` },
    vendor_response_scheduling:
      approvedReplacement ? { label: "Coordinate installation with the selected replacement vendor", href: `${base}?view=service&path=bids#bid-requests` }
      :
      liveAppointment?.status === "confirmed" ? { label: "Track the confirmed service appointment", href: `${base}?view=visits` }
      : liveAppointment?.status === "counter_proposed" ? { label: "Track the counterproposal with the vendor", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "proposed_date" && !hasContinuation("accept_date", latestResponse.id) && !hasContinuation("counter_date", latestResponse.id) ? { label: "Accept or counter the proposed date", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "question" && !hasContinuation("reply", latestResponse.id) ? { label: "Reply to the vendor question", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "declined" ? { label: "Select another provider or request quotes", href: `${base}?view=service` }
      : { label: "Track the vendor response", href: `${base}?view=service#vendor-response` },
    onsite_service: activeVisit
      ? { label: "Follow the onsite visit", href: `/app/visits/${activeVisit.id}` }
      : blockingTask
        ? { label: blockingTask.title, href: `${base}?view=activity#workflow-tasks` }
        : { label: activeAssignment?.kind === "internal" ? "Start internal service" : "Open visit activity", href: `${base}?view=visits` },
    followup_closeout: closeoutFollowUps.length > 0
      ? { label: "Complete or transfer the required follow-up", href: `/app/action-center/${closeoutFollowUps[0].id}` }
      : closeoutTask
        ? { label: closeoutTask.title, href: `${base}?view=activity#work-control` }
      : verificationNeedsOperationalReview && blockingTask
        ? { label: blockingTask.title, href: `${base}?view=activity#workflow-tasks` }
      : { label: "Complete the manager closeout review", href: `${base}?view=visits` },
    cost_invoice_evidence: { label: hasCost ? "Review recorded costs and optional invoice evidence" : "Record the work cost", href: `${base}?view=cost` },
    closed: { label: "Review the service record", href: `${base}?view=overview` },
  };

  // --- Accountability ------------------------------------------------------
  let accountableParty = workOrder.accountableParty;
  if (blockingTask) accountableParty = blockingTask.assigneeName;
  if (stage === "followup_closeout" && closeoutFollowUps[0]) accountableParty = closeoutFollowUps[0].accountableParty;
  if (fullyClosed) accountableParty = "No active owner";

  let dueAt: string | undefined = blockingTask?.dueAt ?? closeoutFollowUps[0]?.dueAt ?? workOrder.dueAt;
  if (stage === "vendor_response_scheduling" && liveAppointment?.status === "confirmed") dueAt = liveAppointment.startsAt;
  if (fullyClosed) dueAt = undefined;

  const escalationDestination = fullyClosed
    ? "None"
    : blockingTask?.escalationDestination ?? closeoutFollowUps[0]?.escalationTo ?? workOrder.escalationTo ?? "Facilities";

  let blockingReason: string | undefined;
  if (approvedReplacement) {
    blockingReason = "The replacement quote is approved; installation and final installed cost are not yet recorded.";
  } else if (stage === "vendor_response_scheduling" && liveAppointment?.status === "confirmed") {
    const priorBlocker = appointmentStartsNewCycle && latestWorkOutcome?.outcome === "parts_required"
      ? " Parts delivery still needs confirmation."
      : appointmentStartsNewCycle && latestWorkOutcome?.outcome === "return_visit_required"
        ? " The earlier return-visit requirement remains in the history until the visit occurs."
        : "";
    blockingReason = `${accountableParty || "The vendor"} and the operator confirmed the service appointment.${priorBlocker}`;
  } else if (blockingTask) blockingReason = blockingTask.reason;
  else if (latestResponse?.response === "declined") blockingReason = "The vendor declined this authorization.";
  else if (stage === "authorization_or_bidding" && selectedEstimateRequest?.decisionKind === "replacement_quote") blockingReason = "The selected replacement quote routes to capital review before any service authorization.";

  const alternativeActions: WorkOrderCaseAction[] = [];
  if (stage !== "closed") {
    if (!approvedReplacement && !currentIssuance && activeAssignment?.kind !== "internal" && visits.length === 0) alternativeActions.push({ label: "Request vendor quotes instead", href: `${base}?view=service&path=bids#bid-requests` });
    if (currentIssuance) alternativeActions.push({ label: "Review the issued authorization", href: `${base}?view=service` });
    if (estimateRequests.length > 0 && !selectedEstimateRequest) alternativeActions.push({ label: "Compare received proposals", href: `${base}?view=service&path=bids#bid-requests` });
    if (visits.some((visit) => visit.checkedOutAt)) alternativeActions.push({ label: "Create a follow-up", href: `${base}?view=activity` });
    if (hasCost || hasInvoices) alternativeActions.push({ label: "Open cost and invoice evidence", href: `${base}?view=cost` });
    alternativeActions.push({ label: "View full activity history", href: `${base}?view=activity` });
  }

  const plainLanguageState = fullyClosed
    ? workOrder.status === "cancelled" ? "Cancelled" : "Closed"
    : activeVisit && !activeVisit.checkedOutAt ? "Technician onsite"
    : appointmentStartsNewCycle ? "Return visit scheduled"
    : latestWorkOutcome?.outcome === "completed"
      ? latestVerification?.siteVisitWorkOrderId === latestWorkOutcome.id
        ? latestVerification.decision === "verified"
          ? "Work verified complete"
          : latestVerification.decision === "rejected"
            ? "Completion rejected; corrective work required"
            : "Result could not be confirmed; review required"
        : "Work reported complete; confirmation needed"
    : latestWorkOutcome?.outcome === "temporary_repair" ? "Temporary repair completed; permanent repair pending"
    : latestWorkOutcome?.outcome === "parts_required" ? "Waiting on parts"
    : latestWorkOutcome?.outcome === "quote_required" ? "Quote or approval needed"
    : latestWorkOutcome?.outcome === "return_visit_required" ? "Return visit required"
    : latestWorkOutcome?.outcome === "diagnosis_only" ? "Diagnosis recorded; next step needed"
    : latestWorkOutcome?.outcome === "no_issue_found" ? "Issue could not be reproduced; review needed"
    : latestWorkOutcome?.outcome === "store_access_unavailable" ? "Store access needed"
    : latestWorkOutcome?.outcome === "work_not_authorized" ? "Authorization needed"
    : latestWorkOutcome?.outcome === "not_addressed" ? "Work was not attempted"
    : liveAppointment?.status === "confirmed" ? "Service appointment scheduled"
    : latestResponse?.response === "question" && !hasContinuation("reply", latestResponse.id) ? "Vendor asked a question"
    : currentIssuance && !latestResponse ? "Waiting for vendor acceptance"
    : activeAssignment?.kind === "outside_vendor" && !currentIssuance ? "Ready to send to selected provider"
    : !activeAssignment || activeAssignment.kind === "choose_later" ? "Needs a provider"
    : activeAssignment.kind === "internal" ? "Internal maintenance assigned"
    : CANONICAL_STAGE_LABELS[stage];

  const latestOutcomeVisit = latestWorkOutcome ? visits.find((visit) => visit.id === latestWorkOutcome.visitId) : undefined;
  const technicalPmWithoutOperatingObservation = latestOutcomeVisit?.outcome === "pm_complete" && !latestImpact;
  const operatingCondition: WorkOrderCaseDimension = technicalPmWithoutOperatingObservation
    ? { id: "unknown", label: "Operating condition not assessed", detail: "The preventive-maintenance checklist was completed, but no operating-condition observation was recorded.", certainty: "unknown", sourceLabel: "Technical PM completion only" }
    : latestVerification?.decision === "verified" && latestWorkOutcome?.outcome === "completed"
    ? { id: "verified_operating", label: "Operating result verified", detail: latestVerification.reason ?? "An authorized reviewer confirmed the reported result.", certainty: "verified", sourceLabel: `Verification by ${latestVerification.decidedByName}`, observedAt: latestVerification.decidedAt }
    : latestVerification?.decision === "rejected"
      ? { id: "result_rejected", label: "Current result not confirmed", detail: latestVerification.reason ?? "The completion claim was rejected and remains preserved in the record.", certainty: "uncertain", sourceLabel: `Verification by ${latestVerification.decidedByName}`, observedAt: latestVerification.decidedAt }
      : latestVerification?.decision === "inconclusive"
        ? { id: "result_inconclusive", label: "Operating result could not be confirmed", detail: latestVerification.reason ?? "The observable result was inconclusive and requires an operational review.", certainty: "uncertain", sourceLabel: `Verification by ${latestVerification.decidedByName}`, observedAt: latestVerification.decidedAt }
      : latestWorkOutcome?.outcome === "completed"
        ? { id: "provider_reported_complete", label: "Provider reports the problem corrected", detail: latestWorkOutcome.outcomeNotes ?? "Confirmation is still required under the applicable verification policy.", certainty: "reported", sourceLabel: latestWorkOutcome.outcomeRecordedByActorName ?? input.providerName ?? "Service provider", observedAt: latestWorkOutcome.outcomeRecordedAt }
        : latestWorkOutcome?.outcome === "temporary_repair"
          ? { id: "temporary_operation", label: "Provider reports temporary operation", detail: latestWorkOutcome.outcomeNotes ?? "A permanent repair obligation remains open.", certainty: "reported", sourceLabel: latestWorkOutcome.outcomeRecordedByActorName ?? input.providerName ?? "Service provider", observedAt: latestWorkOutcome.outcomeRecordedAt }
          : latestImpact
            ? {
                id: latestImpact.storeOperatingState,
                label: latestImpact.storeOperatingState === "open" ? "Store reported operating" : latestImpact.storeOperatingState === "partially_operational" ? "Store reported partially operational" : latestImpact.storeOperatingState === "unable_to_operate" ? "Store reported unable to operate" : "Operating condition unknown",
                detail: latestImpact.notes ?? `Assessment confidence: ${latestImpact.confidence}. This is an operating-impact observation, not a conclusion inferred from work status.`,
                certainty: latestImpact.storeOperatingState === "unknown" ? "unknown" : latestImpact.confidence === "high" ? "reported" : "uncertain",
                sourceLabel: `${latestImpact.source.replaceAll("_", " ")} · ${latestImpact.assessedByActorName}`,
                observedAt: latestImpact.assessedAt,
              }
            : { id: "unknown", label: "Operating condition not assessed", detail: "No operating-condition observation is recorded. Work status is not used as a substitute.", certainty: "unknown", sourceLabel: "No source observation" };

  const invoiceStatuses = new Set((input.invoices ?? []).map((invoice) => invoice.status).filter(Boolean));
  const invoiceLineIds = new Set((input.invoiceLines ?? []).map((line) => line.id));
  const allocations = (input.invoiceLineAllocations ?? []).filter((allocation) => allocation.workOrderId === workOrder.id);
  const allocatedLineIds = new Set(allocations.map((allocation) => allocation.invoiceLineId));
  const linkedInvoiceIds = new Set((input.invoiceLines ?? []).filter((line) => allocatedLineIds.has(line.id)).map((line) => line.invoiceId));
  const linkedAmountMinor = allocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0);
  const linkedCurrency = allocations[0]?.amount.currency ?? "USD";
  const linkedExceptions = (input.invoiceExceptions ?? []).filter((exception) => linkedInvoiceIds.has(exception.invoiceId));
  const attributedOpenExceptions = linkedExceptions.filter((exception) => exception.status === "open" && Boolean(exception.invoiceLineId && allocatedLineIds.has(exception.invoiceLineId)));
  const otherLineOpenExceptions = linkedExceptions.filter((exception) => exception.status === "open" && Boolean(exception.invoiceLineId && invoiceLineIds.has(exception.invoiceLineId) && !allocatedLineIds.has(exception.invoiceLineId)));
  const invoiceLevelOpenExceptions = linkedExceptions.filter((exception) => exception.status === "open" && !exception.invoiceLineId);
  const attributedDisputedMinor = attributedOpenExceptions.reduce((sum, exception) => sum + exception.amount.amountMinor, 0);
  const linkedAdjustments = (input.invoiceAdjustments ?? []).filter((adjustment) => linkedInvoiceIds.has(adjustment.invoiceId));
  const sharedAdjustmentMinor = linkedAdjustments.reduce((sum, adjustment) => sum + adjustment.amount.amountMinor, 0);
  const realizedMinor = (input.valueEvents ?? []).filter((event) => event.category === "realized_verified" && (
    event.workOrderId === workOrder.id || Boolean(event.invoiceLineId && allocatedLineIds.has(event.invoiceLineId))
  )).reduce((sum, event) => sum + event.amount.amountMinor, 0);
  const hasOpenReview = attributedOpenExceptions.length > 0 || otherLineOpenExceptions.length > 0 || invoiceLevelOpenExceptions.length > 0 || invoiceStatuses.has("unmatched") || invoiceStatuses.has("suggested");
  const moneyLabel = (amountMinor: number, currency = linkedCurrency) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
  const financialFacts = hasInvoices ? [
    { label: "Linked invoice allocation", value: moneyLabel(linkedAmountMinor) },
    { label: "Open attributed dispute", value: moneyLabel(attributedDisputedMinor) },
    { label: "Shared invoice adjustments", value: sharedAdjustmentMinor ? `${moneyLabel(sharedAdjustmentMinor)} · invoice-level, not attributed to this job` : moneyLabel(0) },
    { label: "Realized verified value", value: moneyLabel(realizedMinor) },
  ] : undefined;
  const financialReview: WorkOrderCaseDimension = hasInvoices && hasOpenReview
    ? {
        id: "invoice_review", label: "Invoice evidence needs review",
        detail: `${attributedOpenExceptions.length} review flag${attributedOpenExceptions.length === 1 ? " is" : "s are"} attributed to this work order.${otherLineOpenExceptions.length ? ` ${otherLineOpenExceptions.length} open flag${otherLineOpenExceptions.length === 1 ? " belongs" : "s belong"} to another invoice line or job and is not attributed to this work order.` : ""}${invoiceLevelOpenExceptions.length ? ` ${invoiceLevelOpenExceptions.length} invoice-level flag${invoiceLevelOpenExceptions.length === 1 ? " is" : "s are"} shared context and not attributed to this work order.` : ""} Matching does not clear review decisions.`,
        facts: financialFacts, href: `${base}?view=cost`,
      }
    : hasInvoices
      ? { id: "invoice_linked", label: "Invoice evidence linked", detail: "Only confirmed line allocations are counted here. Invoice totals are not multiplied across work orders.", facts: financialFacts, href: `${base}?view=cost` }
      : hasCost
        ? { id: "recorded_cost", label: "Recorded work cost available", detail: "Entered cost is available even though no invoice evidence is required." }
        : { id: "no_financial_evidence", label: "No financial evidence recorded", detail: "Service may proceed or close without an invoice; recorded costs remain a separate fact." };

  const internalAccountableParty = fullyClosed ? "No active internal owner" : workOrder.internalAccountableParty ?? "Facilities coordinator";
  const internalAccountabilityStructured = Boolean(workOrder.internalAccountableType && workOrder.internalAccountableId);
  const nextActionOwner = fullyClosed ? "No active next action" : accountableParty || input.providerName || internalAccountableParty;
  const deadlinePolicy = dueAt
    ? "Deadline set by the current primary obligation."
    : blockingTask?.noSlaReason ?? (fullyClosed ? "No deadline applies to a terminal record." : "No deadline applies under the current workflow policy.");
  const primaryActionOverdue = !fullyClosed && Boolean(dueAt && Date.parse(input.now) > Date.parse(dueAt));
  const escalationTrigger = fullyClosed
    ? "No escalation applies to a terminal record."
    : primaryActionOverdue
      ? `Escalate now: the primary obligation passed its ${dueAt} deadline.`
      : dueAt
        ? "Escalate if the primary obligation is not completed by its due time."
        : "Escalation follows the stated no-SLA policy or a material change in impact.";
  const additionalObligations = openTasks
    .filter((task) => task.id !== blockingTask?.id)
    .map((task): WorkOrderCaseObligation => ({
      id: task.id,
      label: task.title,
      owner: task.assigneeName,
      dueAt: task.dueAt,
      deadlinePolicy: task.dueAt ? "Task deadline" : task.noSlaReason ?? "No SLA applies",
      href: `${base}?view=activity#workflow-tasks`,
    }));

  const stageIds: WorkOrderCanonicalStageId[] = [
    "intake", "approval", "provider_decision", "authorization_or_bidding", "vendor_response_scheduling",
    "onsite_service", "followup_closeout", "cost_invoice_evidence", "closed",
  ];
  const currentIndex = stageIds.indexOf(stage);

  return {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.number,
    storeName: input.storeName,
    problem: workOrder.problem,
    priority: workOrder.priority,
    timeZone: input.timeZone ?? "UTC",
    stage,
    stageLabel: CANONICAL_STAGE_LABELS[stage],
    stageIndex: currentIndex,
    stages: stageIds.map((id, index) => ({
      id,
      label: CANONICAL_STAGE_LABELS[id],
      state: index < currentIndex ? "complete" as const : index === currentIndex ? "current" as const : "upcoming" as const,
    })),
    serviceSubStage: serviceSubStage ? { id: serviceSubStage, label: SERVICE_SUB_STAGE_LABELS[serviceSubStage] } : undefined,
    plainLanguageState,
    internalAccountableParty,
    internalAccountableType: workOrder.internalAccountableType,
    internalAccountableId: workOrder.internalAccountableId,
    internalAccountabilityStructured,
    nextActionOwner,
    accountableParty: fullyClosed ? "No active owner" : nextActionOwner,
    primaryNextAction: stageActions[stage] ?? { label: "Open the work order", href: base },
    dueAt,
    deadlinePolicy,
    escalationDestination,
    escalationTrigger,
    blockingReason,
    alternativeActions: alternativeActions.slice(0, 4),
    serviceProgress: { id: serviceSubStage ?? stage, label: plainLanguageState, detail: serviceSubStage ? `Service workflow: ${SERVICE_SUB_STAGE_LABELS[serviceSubStage]}.` : `Service workflow: ${CANONICAL_STAGE_LABELS[stage]}.` },
    operatingCondition,
    financialReview,
    additionalObligations,
    primaryActionOverdue,
  };
}


function latest<T>(rows: T[], key: (row: T) => string): T | undefined {
  return [...rows].sort((a, b) => key(b).localeCompare(key(a)))[0];
}
type CaseWorkflowTask = Pick<WorkflowTask, "id" | "workOrderId" | "serviceRequestId" | "taskType" | "title" | "assigneeName" | "status" | "dueAt" | "escalationDestination" | "blocking" | "requiredForProgress" | "reason">
  & Partial<Pick<WorkflowTask, "organizationId" | "assigneeType" | "assigneeId" | "assigneeRole" | "priority" | "noSlaReason" | "completionCriteria" | "escalationLevel" | "createdByActorType" | "createdByActorId" | "createdByActorName" | "createdAt">>;

export interface WorkOrderCaseInput {
  /** Explicit current approval evidence; omitted only by compatibility callers. */
  hasPendingApproval?: boolean;
  now: string;
  timeZone?: string;
  workOrder: Pick<WorkOrder, "id" | "organizationId" | "number" | "storeId" | "problem" | "priority" | "status" | "internalAccountableParty" | "internalAccountableType" | "internalAccountableId" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo" | "createdAt" | "closedAt">;
  storeName?: string;
  providerName?: string;
  assignments?: Pick<WorkOrderAssignment, "id" | "kind" | "status" | "assignedAt" | "supersedesAssignmentId">[];
  issuances?: Pick<WorkOrderIssuance, "id" | "assignmentId" | "revision" | "issuedAt">[];
  vendorResponses?: Pick<VendorResponse, "id" | "issuanceId" | "response" | "respondedAt" | "proposedAt">[];
  appointments?: Pick<ServiceAppointment, "id" | "status" | "startsAt" | "createdAt" | "sourceVendorResponseId" | "workOrderId" | "assignmentId" | "proposedBy">[];
  visits?: Pick<VisitSession, "id" | "workOrderId" | "status" | "checkedInAt" | "checkedOutAt" | "outcome">[];
  /** Immutable operator follow-up facts on vendor responses (accept/counter/reply/decline recovery). */
  continuations?: Pick<import("./types").VendorContinuation, "id" | "vendorResponseId" | "workOrderId" | "action" | "createdAt">[];
  workflowTasks?: CaseWorkflowTask[];
  followUps?: Pick<FollowUp, "id" | "workOrderId" | "sourceVisitId" | "status" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo">[];
  costLines?: Pick<CostLine, "workOrderId">[];
  impactAssessments?: Pick<RequestImpactAssessment, "id" | "storeOperatingState" | "confidence" | "source" | "notes" | "assessedByActorName" | "assessedAt">[];
  siteVisitWorkOrders?: Pick<SiteVisitWorkOrder, "id" | "visitId" | "workOrderId" | "outcome" | "outcomeNotes" | "outcomeRecordedByActorName" | "outcomeRecordedAt" | "linkedAt">[];
  verifications?: Pick<WorkOrderVerification, "id" | "workOrderId" | "siteVisitWorkOrderId" | "outcome" | "decision" | "reason" | "decidedByName" | "decidedAt">[];
  /** Invoice evidence linked to THIS work order (already scoped by the caller). */
  invoices?: { id: string; status?: string }[];
  invoiceLines?: Pick<InvoiceLine, "id" | "invoiceId">[];
  invoiceLineAllocations?: Pick<InvoiceLineAllocation, "invoiceLineId" | "workOrderId" | "amount">[];
  invoiceExceptions?: Pick<InvoiceException, "invoiceId" | "invoiceLineId" | "status" | "amount">[];
  invoiceAdjustments?: Pick<InvoiceAdjustment, "invoiceId" | "amount">[];
  valueEvents?: Pick<ValueEvent, "category" | "workOrderId" | "invoiceLineId" | "amount">[];
  /** Estimate (bid) requests and proposals attached to this work order. */
  estimateRequests?: { id: string; workOrderId: string; status?: string; decisionKind?: "service_bid" | "replacement_quote" }[];
  estimateProposals?: { id: string; requestId: string; kind?: string; status?: string }[];
  /** Approved/completed replacement facts tied to this canonical work order. */
  replacementEvents?: Pick<import("./types").ReplacementEvent, "id" | "workOrderId" | "status" | "approvedAt" | "completedAt">[];
}
