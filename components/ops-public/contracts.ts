import type {
  VendorResponseKind as OpsVendorResponseKind,
  VisitChannel,
  VisitOutcome as OpsVisitOutcome,
} from "@/lib/ops/types";

export type PublicRuntimeMode = "demo" | "live";

export type LocationCaptureResult =
  | "captured"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unsupported"
  | "not_requested";

export type LocationVerificationState =
  | "verified_near_store"
  | "outside_store_area"
  | "accuracy_too_low"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unsupported"
  | "not_requested";

export interface LocationEvidenceInput {
  captureResult: LocationCaptureResult;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  capturedAt?: string;
}

export interface LocationEvidenceReceipt {
  state: LocationVerificationState;
  label: string;
  accuracyM?: number;
  distanceM?: number;
  capturedAt?: string;
}

export interface PublicActionReceipt {
  receiptId: string;
  receivedAt: string;
  mode: PublicRuntimeMode;
  heading: string;
  message: string;
  replayed?: boolean;
}

export interface ServiceAuthorizationView {
  organizationName: string;
  organizationSupport: string;
  vendorName: string;
  operatorWorkOrderNumber: string;
  revision: number;
  issuedAt: string;
  opened: boolean;
  status: "awaiting_response" | "accepted" | "declined" | "date_proposed" | "question_received";
  priority: "Routine" | "Priority" | "Emergency";
  store: {
    number: string;
    name: string;
    address: string;
    phone?: string;
  };
  service: {
    problem: string;
    requestedWork: string;
    category?: string;
    asset?: string;
    accessNotes?: string;
  };
  authorization: {
    notToExceedLabel?: string;
    requestedBy: string;
    billingInstruction: string;
  };
  priorResponse?: {
    label: string;
    receivedAt: string;
    detail?: string;
  };
  technicianVisitUrl?: string;
  mode: PublicRuntimeMode;
}

export interface VendorEstimateView {
  organizationName: string;
  organizationSupport: string;
  vendorName: string;
  operatorWorkOrderNumber: string;
  status: "requested" | "opened" | "submitted" | "declined" | "expired" | "withdrawn" | "selected" | "not_selected";
  statusLabel: string;
  requestKindLabel: string;
  requestedAt: string;
  dueAt?: string;
  store: {
    number: string;
    name: string;
    address: string;
  };
  problem: string;
  requestedScope: string;
  latestProposal?: {
    revision: number;
    amountLabel: string;
    scope: string;
    exclusions?: string;
    leadTimeDays?: number;
    validUntil?: string;
    submittedAt: string;
  };
  canRespond: boolean;
  mode: PublicRuntimeMode;
}

export interface VendorEstimateSubmissionCommand {
  responderName: string;
  expectedRevision: number;
  amount: string;
  currency?: string;
  scope: string;
  exclusions?: string;
  leadTimeDays?: number;
  validUntil?: string;
}

export interface VendorEstimateDeclineCommand {
  responderName: string;
  expectedRevision: number;
  reason: string;
}

export type PublicVendorResponseKind = OpsVendorResponseKind;

export interface VendorResponseCommand {
  response: PublicVendorResponseKind;
  responderName: string;
  proposedArrival?: string;
  detail?: string;
}

export interface StorePortalView {
  organizationName: string;
  trustedStoreDevice: boolean;
  store: {
    number: string;
    name: string;
    address: string;
  };
  vendors: Array<{
    id: string;
    name: string;
    specialties: string;
  }>;
  locationPolicy: {
    enabled: boolean;
    explanation: string;
  };
  capabilities: {
    reportIssue: boolean;
    startVisit: boolean;
    finishVisit: boolean;
  };
  visitChannel: VisitChannel;
  mode: PublicRuntimeMode;
}

export interface EligibleWorkOrderView {
  id: string;
  number: string;
  priority: "Routine" | "Priority" | "Emergency";
  problem: string;
  category?: string;
  asset?: string;
  issuedAt: string;
}

export interface ActiveVisitView {
  id: string;
  technicianName: string;
  vendorName: string;
  workOrderNumber?: string;
  noWorkOrderReason?: string;
  checkedInAt: string;
  startedVia: VisitChannel;
  checkInLocationLabel: string;
}

export interface VendorVisitContextView {
  vendorId: string;
  vendorName: string;
  eligibleWorkOrders: EligibleWorkOrderView[];
  activeVisits: ActiveVisitView[];
}

export interface TechnicianCheckInCommand {
  submissionKey: string;
  vendorId: string;
  workOrderId?: string;
  noWorkOrderReason?: string;
  technicianName: string;
  location: LocationEvidenceInput;
}

export interface TechnicianCheckInReceipt extends PublicActionReceipt {
  visitId: string;
  vendorName: string;
  technicianName: string;
  workOrderNumber?: string;
  checkedInAt: string;
  checkoutUrl: string;
  checkoutExpiresAt: string;
  location: LocationEvidenceReceipt;
}

export type VisitOutcome = Extract<
  OpsVisitOutcome,
  "resolved" | "temporary_repair" | "diagnosed_waiting_parts" | "return_required" | "unable_to_complete" | "unable_to_reproduce" | "other"
>;

export interface PublicUpload {
  name: string;
  mediaType: string;
  size: number;
  bytes: ArrayBuffer;
}

export interface TechnicianCheckOutCommand {
  submissionKey: string;
  vendorId: string;
  visitId: string;
  outcome: VisitOutcome;
  outcomeNotes?: string;
  location: LocationEvidenceInput;
  evidence: PublicUpload[];
}

export interface TechnicianCheckOutReceipt extends PublicActionReceipt {
  visitId: string;
  checkedOutAt: string;
  observedDurationMinutes?: number;
  observedDurationLabel: string;
  outcomeLabel: string;
  evidenceReceived: number;
  evidenceStorageLabel?: string;
  location: LocationEvidenceReceipt;
  followUpLabel?: string;
}

export interface StoreIssueCommand {
  reporterName: string;
  employeeId?: string;
  problem: string;
  urgency: "routine" | "priority" | "urgent_safety";
  area?: string;
  evidence: PublicUpload[];
}

export interface StoreIssueReceipt extends PublicActionReceipt {
  requestNumber: string;
  storeNumber: string;
  evidenceReceived: number;
  evidenceStorageLabel?: string;
  nextStep: string;
}

export interface PublicOperationsGateway {
  loadServiceAuthorization(token: string): Promise<ServiceAuthorizationView | null>;
  openServiceAuthorization(token: string): Promise<PublicActionReceipt>;
  respondToServiceAuthorization(token: string, command: VendorResponseCommand): Promise<PublicActionReceipt>;
  loadVendorEstimate(token: string): Promise<VendorEstimateView | null>;
  openVendorEstimate(token: string): Promise<PublicActionReceipt>;
  submitVendorEstimate(token: string, command: VendorEstimateSubmissionCommand): Promise<PublicActionReceipt>;
  declineVendorEstimate(token: string, command: VendorEstimateDeclineCommand): Promise<PublicActionReceipt>;
  loadStorePortal(token: string): Promise<StorePortalView | null>;
  lookupVendorVisitContext(token: string, vendorId: string): Promise<VendorVisitContextView>;
  checkIn(token: string, command: TechnicianCheckInCommand): Promise<TechnicianCheckInReceipt>;
  checkOut(token: string, command: TechnicianCheckOutCommand): Promise<TechnicianCheckOutReceipt>;
  reportStoreIssue(token: string, command: StoreIssueCommand): Promise<StoreIssueReceipt>;
}

export class PublicWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 422 = 400,
    readonly code = "public_workflow_error",
  ) {
    super(message);
    this.name = "PublicWorkflowError";
  }
}
