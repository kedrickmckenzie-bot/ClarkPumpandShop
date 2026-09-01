import type {
  CostLine,
  FollowUp,
  ServiceAppointment,
  VendorResponse,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderIssuance,
  WorkflowTask,
} from "./types";

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
  accountableParty: string;
  primaryNextAction: WorkOrderCaseAction;
  dueAt?: string;
  escalationDestination: string;
  blockingReason?: string;
  alternativeActions: WorkOrderCaseAction[];
  /** True when the projected due time has passed (input.now vs dueAt). */
  primaryActionOverdue: boolean;
}

export const CANONICAL_STAGE_LABELS: Record<WorkOrderCanonicalStageId, string> = {
  intake: "Intake",
  approval: "Approval",
  provider_decision: "Provider decision",
  authorization_or_bidding: "Authorization or bidding",
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
  const blockingTask = openTasks.find((row) => row.blocking)
    ?? openTasks.filter((row) => row.requiredForProgress).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))[0];
  const openFollowUps = (input.followUps ?? []).filter((row) => OPEN_FOLLOWUP_STATUSES.has(row.status));
  const closeoutFollowUps = openFollowUps.filter((row) => Boolean(row.sourceVisitId));
  const visits = (input.visits ?? []).filter((row) => row.workOrderId === workOrder.id);
  const activeVisit = visits.find((row) => !row.checkedOutAt)
    ?? [...visits].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))[0];
  const hasCost = (input.costLines ?? []).some((row) => row.workOrderId === workOrder.id);
  const hasInvoices = (input.invoices ?? []).length > 0;
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
  } else if (workOrder.status === "awaiting_approval" || (blockingTask?.taskType ?? "").includes("approval")) {
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
  } else if (closeoutFollowUps.length > 0 || closeoutTask || workOrder.status === "completed_pending_review" || workOrder.status === "resolved") {
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
  } else if (closeoutFollowUps.length > 0 || closeoutTask || unresolvedCheckout || workOrder.status === "completed_pending_review" || workOrder.status === "resolved") {
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
    intake: { label: "Review the request", href: blockingTask ? `/app/action-center/${blockingTask.id}` : `${base}?view=overview` },
    approval: { label: blockingTask ? `Record the ${blockingTask.title.toLowerCase()}` : "Record the approval decision", href: blockingTask ? `/app/action-center/${blockingTask.id}` : `${base}?view=activity` },
    provider_decision: { label: activeAssignment?.kind === "choose_later" ? "Choose a provider" : "Choose internal maintenance, direct authorization, or bids", href: `${base}?view=service` },
    authorization_or_bidding:
      selectedEstimateRequest?.decisionKind === "replacement_quote"
        ? { label: "Advance the selected replacement quote to capital review", href: `${base}?view=service#bid-requests` }
      : estimateRequests.length > 0 && !selectedEstimateRequest
        ? { label: estimateProposals.length > 0 ? "Review vendor bids" : "Track vendor bid requests", href: `${base}?view=service#bid-requests` }
        : { label: "Issue the service authorization", href: `${base}?view=service#issue-work` },
    vendor_response_scheduling:
      approvedReplacement ? { label: "Coordinate installation with the selected replacement vendor", href: `${base}?view=service#bid-requests` }
      :
      liveAppointment?.status === "confirmed" ? { label: "Track the confirmed service appointment", href: `${base}?view=visits` }
      : liveAppointment?.status === "counter_proposed" ? { label: "Track the counterproposal with the vendor", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "proposed_date" && !hasContinuation("accept_date", latestResponse.id) && !hasContinuation("counter_date", latestResponse.id) ? { label: "Accept or counter the proposed date", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "question" && !hasContinuation("reply", latestResponse.id) ? { label: "Reply to the vendor question", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "declined" ? { label: "Select another provider or convert to bids", href: `${base}?view=service` }
      : { label: "Track the vendor response", href: `${base}?view=service#vendor-response` },
    onsite_service: activeVisit
      ? { label: "Follow the onsite visit", href: `/app/visits/${activeVisit.id}` }
      : blockingTask
        ? { label: blockingTask.title, href: `/app/action-center/${blockingTask.id}` }
        : { label: activeAssignment?.kind === "internal" ? "Start internal service" : "Open visit activity", href: `${base}?view=visits` },
    followup_closeout: closeoutFollowUps.length > 0
      ? { label: "Complete or transfer the required follow-up", href: `${base}?view=activity` }
      : closeoutTask
        ? { label: closeoutTask.title, href: `${base}?view=activity#work-control` }
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
    blockingReason = `${accountableParty || "The vendor"} and the operator confirmed the service appointment.`;
  } else if (blockingTask) blockingReason = blockingTask.reason;
  else if (latestResponse?.response === "declined") blockingReason = "The vendor declined this authorization.";
  else if (stage === "authorization_or_bidding" && selectedEstimateRequest?.decisionKind === "replacement_quote") blockingReason = "The selected replacement quote routes to capital review before any service authorization.";

  const alternativeActions: WorkOrderCaseAction[] = [];
  if (stage !== "closed") {
    if (!approvedReplacement && !currentIssuance && activeAssignment?.kind !== "internal" && visits.length === 0) alternativeActions.push({ label: "Request vendor bids instead", href: `${base}?view=service#bid-requests` });
    if (currentIssuance) alternativeActions.push({ label: "Reissue or revise the authorization", href: `${base}?view=service#issue-work` });
    if (estimateRequests.length > 0 && !selectedEstimateRequest) alternativeActions.push({ label: "Compare received proposals", href: `${base}?view=service#bid-requests` });
    if (visits.some((visit) => visit.checkedOutAt)) alternativeActions.push({ label: "Create a follow-up", href: `${base}?view=activity` });
    if (hasCost || hasInvoices) alternativeActions.push({ label: "Open cost and invoice evidence", href: `${base}?view=cost` });
    alternativeActions.push({ label: "View full activity history", href: `${base}?view=activity` });
  }

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
    accountableParty: accountableParty || "Facilities",
    primaryNextAction: stageActions[stage] ?? { label: "Open the work order", href: base },
    dueAt,
    escalationDestination,
    blockingReason,
    alternativeActions: alternativeActions.slice(0, 4),
    primaryActionOverdue: !fullyClosed && Boolean(dueAt && Date.parse(input.now) > Date.parse(dueAt)),
  };
}


function latest<T>(rows: T[], key: (row: T) => string): T | undefined {
  return [...rows].sort((a, b) => key(b).localeCompare(key(a)))[0];
}
export interface WorkOrderCaseInput {
  now: string;
  timeZone?: string;
  workOrder: Pick<WorkOrder, "id" | "organizationId" | "number" | "storeId" | "problem" | "priority" | "status" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo" | "createdAt" | "closedAt">;
  storeName?: string;
  assignments?: Pick<WorkOrderAssignment, "id" | "kind" | "status" | "assignedAt" | "supersedesAssignmentId">[];
  issuances?: Pick<WorkOrderIssuance, "id" | "assignmentId" | "revision" | "issuedAt">[];
  vendorResponses?: Pick<VendorResponse, "id" | "issuanceId" | "response" | "respondedAt" | "proposedAt">[];
  appointments?: Pick<ServiceAppointment, "id" | "status" | "startsAt" | "createdAt" | "sourceVendorResponseId" | "workOrderId" | "assignmentId" | "proposedBy">[];
  visits?: Pick<VisitSession, "id" | "workOrderId" | "status" | "checkedInAt" | "checkedOutAt" | "outcome">[];
  /** Immutable operator follow-up facts on vendor responses (accept/counter/reply/decline recovery). */
  continuations?: Pick<import("./types").VendorContinuation, "id" | "vendorResponseId" | "workOrderId" | "action" | "createdAt">[];
  workflowTasks?: Pick<WorkflowTask, "id" | "workOrderId" | "serviceRequestId" | "taskType" | "title" | "assigneeName" | "status" | "dueAt" | "escalationDestination" | "blocking" | "requiredForProgress" | "reason">[];
  followUps?: Pick<FollowUp, "id" | "workOrderId" | "sourceVisitId" | "status" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo">[];
  costLines?: Pick<CostLine, "workOrderId">[];
  /** Invoice evidence linked to THIS work order (already scoped by the caller). */
  invoices?: { id: string; status?: string }[];
  /** Estimate (bid) requests and proposals attached to this work order. */
  estimateRequests?: { id: string; workOrderId: string; status?: string; decisionKind?: "service_bid" | "replacement_quote" }[];
  estimateProposals?: { id: string; requestId: string; kind?: string; status?: string }[];
  /** Approved/completed replacement facts tied to this canonical work order. */
  replacementEvents?: Pick<import("./types").ReplacementEvent, "id" | "workOrderId" | "status" | "approvedAt" | "completedAt">[];
}
