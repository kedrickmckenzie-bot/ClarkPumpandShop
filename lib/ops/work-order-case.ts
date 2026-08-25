import type {
  CostLine,
  FollowUp,
  Invoice,
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
  | "link_generated"
  | "delivery_queued"
  | "delivery_failed"
  | "sent"
  | "opened_by_vendor"
  | "question_pending"
  | "date_proposed"
  | "accepted"
  | "scheduled"
  | "onsite"
  | "followup_required"
  | "closeout_review"
  | "closed";

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
  link_generated: "Link generated",
  delivery_queued: "Delivery queued",
  delivery_failed: "Delivery failed",
  sent: "Sent",
  opened_by_vendor: "Opened by vendor",
  question_pending: "Question pending",
  date_proposed: "Date proposed",
  accepted: "Accepted",
  scheduled: "Scheduled",
  onsite: "Onsite",
  followup_required: "Follow-up required",
  closeout_review: "Closeout review",
  closed: "Closed",
};

const OPEN_TASK_STATUSES = new Set(["open", "in_progress"]);
const TERMINAL_WORK_ORDER_STATUSES = new Set(["resolved", "closed", "cancelled"]);
const OPEN_FOLLOWUP_STATUSES = new Set(["open"]);

/**
 * Projects one work order's canonical case state. Every input array must
 * already be bounded to the organization and this work order by the caller.
 */
export function buildWorkOrderCase(input: WorkOrderCaseInput): WorkOrderCaseView {
  const { workOrder } = input;
  const allAssignments = [...(input.assignments ?? [])].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  const activeAssignment = allAssignments.find((row) => row.status !== "cancelled" && row.status !== "superseded") ?? allAssignments[0];
  const openTasks = (input.workflowTasks ?? []).filter((row) => row.workOrderId === workOrder.id && OPEN_TASK_STATUSES.has(row.status));
  const blockingTask = openTasks.find((row) => row.blocking)
    ?? openTasks.filter((row) => row.requiredForProgress).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))[0]
    ?? openTasks.sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))[0];
  const openFollowUps = (input.followUps ?? []).filter((row) => OPEN_FOLLOWUP_STATUSES.has(row.status));
  const visits = (input.visits ?? []).filter((row) => row.workOrderId === workOrder.id);
  const activeVisit = visits.find((row) => !row.checkedOutAt)
    ?? [...visits].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))[0];
  const hasCost = (input.costLines ?? []).some((row) => row.workOrderId === workOrder.id);
  const hasInvoices = (input.invoices ?? []).length > 0;
  const estimateRequests = (input.estimateRequests ?? []).filter((row) => row.workOrderId === workOrder.id);
  const estimateProposals = (input.estimateProposals ?? []).filter((proposal) => estimateRequests.some((request) => request.id === proposal.requestId));
  const selectedProposal = estimateProposals.find((proposal) => proposal.status === "selected" || proposal.status === "accepted");
  const replacementProposal = estimateProposals.find((proposal) => proposal.kind === "replacement");
  void replacementProposal;
  const issuances = input.issuances ?? [];
  const currentIssuance = [...issuances].sort((a, b) => b.revision - a.revision)[0];
  const responses = (input.vendorResponses ?? []).filter((row) => !currentIssuance || row.issuanceId === currentIssuance.id);
  const latestResponse = latest(responses, (row) => row.respondedAt);
  const appointments = (input.appointments ?? []).filter((row) => row.workOrderId === workOrder.id);
  const liveAppointment = [...appointments]
    .filter((row) => row.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  // --- Canonical stage -----------------------------------------------------
  let stage: WorkOrderCanonicalStageId;
  if (TERMINAL_WORK_ORDER_STATUSES.has(workOrder.status)) {
    stage = "closed";
  } else if (workOrder.status === "awaiting_approval" || (blockingTask?.taskType ?? "").includes("approval")) {
    stage = "approval";
  } else if (!activeAssignment && blockingTask && blockingTask.serviceRequestId) {
    stage = "intake";
  } else if (!activeAssignment && estimateRequests.length > 0 && !selectedProposal) {
    stage = "authorization_or_bidding";
  } else if (!activeAssignment || activeAssignment.kind === "choose_later") {
    stage = "provider_decision";
  } else if (activeVisit && !activeVisit.checkedOutAt) {
    stage = "onsite_service";
  } else if (openFollowUps.length > 0 || workOrder.status === "completed_pending_review") {
    stage = "followup_closeout";
  } else if (visits.length > 0 && !hasCost) {
    stage = "cost_invoice_evidence";
  } else if (!currentIssuance && activeAssignment.kind === "outside_vendor") {
    stage = "authorization_or_bidding";
  } else {
    stage = "vendor_response_scheduling";
  }

  // --- Service sub-stage (external fulfillment detail) --------------------
  let serviceSubStage: WorkOrderServiceSubStage | undefined;
  if (!TERMINAL_WORK_ORDER_STATUSES.has(workOrder.status) && activeAssignment?.kind === "outside_vendor") {
    if (liveAppointment?.status === "confirmed") serviceSubStage = "scheduled";
    else if (latestResponse?.response === "question") serviceSubStage = "question_pending";
    else if (latestResponse?.response === "proposed_date") serviceSubStage = "date_proposed";
    else if (latestResponse?.response === "declined") serviceSubStage = "authorization_ready";
    else if (latestResponse?.response === "accepted") serviceSubStage = "accepted";
    else if (activeVisit && !activeVisit.checkedOutAt) serviceSubStage = "onsite";
    else if (currentIssuance) serviceSubStage = "sent";
    else serviceSubStage = "authorization_ready";
  } else if (!TERMINAL_WORK_ORDER_STATUSES.has(workOrder.status) && stage === "followup_closeout" && openFollowUps.length === 0) {
    serviceSubStage = "closeout_review";
  } else if (!TERMINAL_WORK_ORDER_STATUSES.has(workOrder.status) && stage === "followup_closeout") {
    serviceSubStage = "followup_required";
  }

  const base = `/app/work-orders/${workOrder.id}`;
  const stageActions: Partial<Record<WorkOrderCanonicalStageId, WorkOrderCaseAction>> = {
    intake: { label: "Review the request", href: blockingTask ? `/app/action-center/${blockingTask.id}` : `${base}?view=overview` },
    approval: { label: blockingTask ? `Record the ${blockingTask.title.toLowerCase()}` : "Record the approval decision", href: blockingTask ? `/app/action-center/${blockingTask.id}` : `${base}?view=activity` },
    provider_decision: { label: activeAssignment?.kind === "choose_later" ? "Choose a provider" : "Choose internal maintenance, direct authorization, or bids", href: `${base}?view=service` },
    authorization_or_bidding:
      estimateRequests.length > 0 && !selectedProposal
        ? { label: estimateProposals.length > 0 ? "Review vendor bids" : "Track vendor bid requests", href: `${base}?view=service#bid-requests` }
        : { label: "Issue the service authorization", href: `${base}?view=service#issue-work` },
    vendor_response_scheduling:
      latestResponse?.response === "proposed_date" ? { label: "Accept or counter the proposed date", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "question" ? { label: "Reply to the vendor question", href: `${base}?view=service#vendor-response` }
      : latestResponse?.response === "declined" ? { label: "Select another provider or convert to bids", href: `${base}?view=service` }
      : { label: "Track the vendor response", href: `${base}?view=service#vendor-response` },
    onsite_service: { label: "Follow the onsite visit", href: activeVisit ? `/app/visits/${activeVisit.id}` : `${base}?view=visits` },
    followup_closeout: openFollowUps.length > 0
      ? { label: "Complete or transfer the required follow-up", href: `${base}?view=activity` }
      : { label: "Complete the manager closeout review", href: `${base}?view=visits` },
    cost_invoice_evidence: { label: hasCost ? "Review recorded costs and optional invoice evidence" : "Record the work cost", href: `${base}?view=cost` },
    closed: { label: "Open the closed record", href: `${base}?view=overview` },
  };

  // --- Accountability ------------------------------------------------------
  let accountableParty = workOrder.accountableParty;
  if (blockingTask) accountableParty = blockingTask.assigneeName;
  if (stage === "followup_closeout" && openFollowUps[0]) accountableParty = openFollowUps[0].accountableParty;

  let dueAt = blockingTask?.dueAt ?? openFollowUps[0]?.dueAt ?? workOrder.dueAt;
  if (stage === "vendor_response_scheduling" && liveAppointment?.status === "confirmed") dueAt = liveAppointment.startsAt;

  const escalationDestination = blockingTask?.escalationDestination ?? openFollowUps[0]?.escalationTo ?? workOrder.escalationTo ?? "Facilities";

  let blockingReason: string | undefined;
  if (blockingTask) blockingReason = blockingTask.reason;
  else if (latestResponse?.response === "declined") blockingReason = "The vendor declined this authorization.";
  else if (stage === "authorization_or_bidding" && replacementProposal && estimateRequests.length === 0) blockingReason = "A replacement quote routes to capital review before any service authorization.";

  const alternativeActions: WorkOrderCaseAction[] = [];
  if (stage !== "closed") {
    if (!currentIssuance) alternativeActions.push({ label: "Request vendor bids instead", href: `${base}?view=service#bid-requests` });
    if (currentIssuance) alternativeActions.push({ label: "Reissue or revise the authorization", href: `${base}?view=service#issue-work` });
    if (estimateRequests.length > 0 && !selectedProposal) alternativeActions.push({ label: "Compare received proposals", href: `${base}?view=service#bid-requests` });
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
  };
}


function latest<T>(rows: T[], key: (row: T) => string): T | undefined {
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)))[0];
}
export interface WorkOrderCaseInput {
  now: string;
  workOrder: Pick<WorkOrder, "id" | "organizationId" | "number" | "storeId" | "problem" | "priority" | "status" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo" | "createdAt" | "closedAt">;
  storeName?: string;
  assignments?: Pick<WorkOrderAssignment, "id" | "kind" | "status" | "assignedAt" | "supersedesAssignmentId">[];
  issuances?: Pick<WorkOrderIssuance, "id" | "assignmentId" | "revision" | "issuedAt">[];
  vendorResponses?: Pick<VendorResponse, "id" | "issuanceId" | "response" | "respondedAt" | "proposedAt">[];
  appointments?: Pick<ServiceAppointment, "id" | "status" | "startsAt" | "createdAt" | "sourceVendorResponseId" | "workOrderId" | "assignmentId" | "proposedBy">[];
  visits?: Pick<VisitSession, "id" | "workOrderId" | "status" | "checkedInAt" | "checkedOutAt">[];
  workflowTasks?: Pick<WorkflowTask, "id" | "workOrderId" | "serviceRequestId" | "taskType" | "title" | "assigneeName" | "status" | "dueAt" | "escalationDestination" | "blocking" | "requiredForProgress" | "reason">[];
  followUps?: Pick<FollowUp, "id" | "workOrderId" | "status" | "accountableParty" | "nextAction" | "dueAt" | "escalationTo">[];
  costLines?: Pick<CostLine, "workOrderId">[];
  invoices?: Pick<Invoice, "id" | "status">[];
  /** Estimate (bid) requests and proposals attached to this work order. */
  estimateRequests?: { id: string; workOrderId: string; status?: string }[];
  estimateProposals?: { id: string; requestId: string; kind?: string; status?: string }[];
}
