export type OpsId = string;
export type IsoDateTime = string;
export type CurrencyCode = "USD" | string;

export type OrganizationRole =
  | "executive"
  | "facilities_admin"
  | "regional_manager"
  | "store_manager"
  | "store_employee"
  | "internal_technician"
  | "finance_reviewer"
  | "vendor_user"
  | "support";

export type ScopeKind = "organization" | "division" | "region" | "store" | "vendor";
export type RequestStatus = "submitted" | "under_review" | "converted" | "closed";
export type WorkOrderPriority = "emergency" | "urgent" | "routine" | "planned";
export type WorkOrderStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "issued"
  | "accepted"
  | "scheduled"
  | "in_progress"
  | "waiting_on_vendor"
  | "waiting_on_parts"
  | "completed_pending_review"
  | "closed"
  | "cancelled";
export type AssignmentKind = "internal" | "outside_vendor" | "choose_later";
export type AssignmentStatus =
  | "pending"
  | "issued"
  | "opened"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled"
  | "superseded";
export type VendorResponseKind = "accepted" | "declined" | "proposed_date" | "question";
export type EstimateRequestKind = "estimate_only" | "diagnostic_and_estimate";
export type EstimateRequestStatus =
  | "requested"
  | "opened"
  | "submitted"
  | "declined"
  | "expired"
  | "withdrawn"
  | "selected"
  | "not_selected";
export type EstimateRequestChannel = "email" | "sms" | "manual";
export type VisitChannel = "qr" | "secure_link" | "store_device" | "vendor_portal" | "future_app";
export type VisitStatus = "active" | "checked_out" | "amended";
export type VisitOutcome =
  | "resolved"
  | "temporary_repair"
  | "diagnosed_waiting_parts"
  | "return_required"
  | "unable_to_complete"
  | "unable_to_reproduce"
  | "no_issue_found"
  | "inspection_complete"
  | "pm_complete"
  | "other";
export type LocationResult =
  | "verified"
  | "outside_geofence"
  | "low_accuracy"
  | "permission_denied"
  | "unavailable"
  | "not_requested"
  | "trusted_store_device";
export type EvidenceKind =
  | "check_in"
  | "check_out"
  | "reported_arrival"
  | "identity_assertion"
  | "photo"
  | "file"
  | "store_confirmation"
  | "amendment";
export type FollowUpStatus = "open" | "completed" | "cancelled";
export type ExceptionStatus = "open" | "acknowledged" | "resolved";
export type ExceptionKind =
  | "no_work_order"
  | "unexpected_visit"
  | "missing_checkout"
  | "outside_geofence"
  | "low_accuracy_location"
  | "duplicate_active_visit"
  | "high_risk_service"
  | "unmatched_invoice"
  | "amount_above_authorization"
  | "overdue_pm";
export type PmOccurrenceStatus = "due" | "scheduled" | "completed" | "missed" | "waived";
export type CostLineKind = "labor" | "parts" | "travel" | "materials" | "other";
export type InvoiceMatchStatus = "unmatched" | "suggested" | "confirmed" | "rejected";
export type ActorType = "user" | "vendor_link" | "technician" | "store_device" | "system" | "support";

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface ActorContext {
  actorType: ActorType;
  actorId?: OpsId;
  actorName: string;
  organizationId: OpsId;
  requestId?: string;
}

export interface Organization {
  id: OpsId;
  name: string;
  slug: string;
  timeZone: string;
  workOrderPrefix: string;
  createdAt: IsoDateTime;
}

export interface Region {
  id: OpsId;
  organizationId: OpsId;
  divisionId?: OpsId;
  code: string;
  name: string;
  createdAt: IsoDateTime;
}

export interface Division {
  id: OpsId;
  organizationId: OpsId;
  code: string;
  name: string;
  createdAt: IsoDateTime;
}

export interface TaxonomyNode {
  id: OpsId;
  organizationId: OpsId;
  parentNodeId?: OpsId;
  nodeKind: "category" | "group";
  canonicalKey?: string;
  name: string;
  aliases: string[];
  depth: number;
  sortOrder: number;
  active: boolean;
  createdAt: IsoDateTime;
}

export interface Store {
  id: OpsId;
  organizationId: OpsId;
  divisionId?: OpsId;
  regionId?: OpsId;
  storeNumber: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  aliases: string[];
  latitudeE6?: number;
  longitudeE6?: number;
  geofenceRadiusM: number;
  locationPolicyEnabled: boolean;
  timeZone?: string;
  status: "active" | "inactive";
  createdAt: IsoDateTime;
}

export interface User {
  id: OpsId;
  email: string;
  displayName: string;
  status: "invited" | "active" | "suspended";
  createdAt: IsoDateTime;
}

export interface Membership {
  id: OpsId;
  organizationId: OpsId;
  userId: OpsId;
  role: OrganizationRole;
  status: "invited" | "active" | "suspended";
  createdAt: IsoDateTime;
}

export interface ScopeGrant {
  id: OpsId;
  organizationId: OpsId;
  membershipId: OpsId;
  scopeKind: ScopeKind;
  scopeId: OpsId;
  permission: string;
  createdAt: IsoDateTime;
}

export interface Vendor {
  id: OpsId;
  organizationId: OpsId;
  code: string;
  name: string;
  dispatchEmail: string;
  dispatchPhone?: string;
  status: "approved" | "restricted" | "inactive";
  preferred: boolean;
  createdAt: IsoDateTime;
}

export interface VendorSpecialty {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  canonicalKey: string;
  displayName: string;
  searchAliases: string[];
}

export interface VendorCoverage {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  scopeKind: "organization" | "region" | "store";
  scopeId: OpsId;
  preferredRank?: number;
}

export interface ServiceRequest {
  id: OpsId;
  organizationId: OpsId;
  reference: string;
  storeId: OpsId;
  reporterName: string;
  reporterEmployeeId?: string;
  problem: string;
  priority: WorkOrderPriority;
  status: RequestStatus;
  submittedAt: IsoDateTime;
  convertedWorkOrderId?: OpsId;
}

export interface WorkOrder {
  id: OpsId;
  organizationId: OpsId;
  number: string;
  storeId: OpsId;
  requestId?: OpsId;
  problem: string;
  authorizedScope?: string;
  categoryKey?: string;
  taxonomyNodeId?: OpsId;
  assetId?: OpsId;
  componentId?: OpsId;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  /** Monotonic concurrency token for canonical work-order mutations. */
  version?: number;
  accountableParty: string;
  nextAction: string;
  dueAt?: IsoDateTime;
  escalationTo?: string;
  nte?: Money;
  /** Optional current repair proposal used for capital planning; never an authorization limit. */
  repairEstimate?: Money;
  /** Optional planning estimate of how much useful service the proposed repair is expected to buy. */
  estimatedServiceExtensionMonths?: number;
  vendorServiceTicketNumber?: string;
  vendorInvoiceNumber?: string;
  externalAccountingPo?: string;
  createdAt: IsoDateTime;
  closedAt?: IsoDateTime;
}

export interface WorkOrderAssignment {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  kind: AssignmentKind;
  vendorId?: OpsId;
  internalMembershipId?: OpsId;
  status: AssignmentStatus;
  assignedAt: IsoDateTime;
  supersedesAssignmentId?: OpsId;
}

export interface WorkOrderIssuance {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  assignmentId: OpsId;
  revision: number;
  immutablePayloadJson: string;
  channel: "email" | "sms" | "print" | "manual";
  issuedAt: IsoDateTime;
}

export interface VendorResponse {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  assignmentId: OpsId;
  issuanceId: OpsId;
  response: VendorResponseKind;
  responderName: string;
  proposedAt?: IsoDateTime;
  message?: string;
  respondedAt: IsoDateTime;
}

/**
 * A vendor-specific request for pricing evidence attached to one canonical
 * operator work order. This is deliberately separate from service assignment:
 * asking two vendors to price one scope must not create two work orders.
 */
export interface WorkOrderEstimateRequest {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  kind: EstimateRequestKind;
  requestedScope: string;
  status: EstimateRequestStatus;
  channel: EstimateRequestChannel;
  requestedAt: IsoDateTime;
  dueAt?: IsoDateTime;
  openedAt?: IsoDateTime;
  respondedAt?: IsoDateTime;
  decisionAt?: IsoDateTime;
}

/**
 * Immutable vendor-submitted estimate evidence. Corrections append a higher
 * revision; they never overwrite an earlier amount or scope.
 */
export interface VendorEstimateProposal {
  id: OpsId;
  organizationId: OpsId;
  requestId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  revision: number;
  amount: Money;
  scope: string;
  exclusions?: string;
  leadTimeDays?: number;
  validUntil?: IsoDateTime;
  submittedAt: IsoDateTime;
}

export interface LocationObservation {
  result: LocationResult;
  latitudeE6?: number;
  longitudeE6?: number;
  accuracyM?: number;
  distanceM?: number;
  capturedAt: IsoDateTime;
}

export interface VisitSession {
  id: OpsId;
  organizationId: OpsId;
  storeId: OpsId;
  providerKind: "outside_vendor" | "internal";
  vendorId?: OpsId;
  internalMembershipId?: OpsId;
  workOrderId?: OpsId;
  unmatchedReason?: string;
  technicianName: string;
  providerName: string;
  purpose: string;
  status: VisitStatus;
  startedChannel: VisitChannel;
  endedChannel?: VisitChannel;
  checkedInAt: IsoDateTime;
  checkedOutAt?: IsoDateTime;
  outcome?: VisitOutcome;
  outcomeNotes?: string;
  observedDurationSeconds?: number;
}

export interface VisitEvidence {
  id: OpsId;
  organizationId: OpsId;
  visitId: OpsId;
  kind: EvidenceKind;
  channel: VisitChannel;
  observedAt: IsoDateTime;
  location?: LocationObservation;
  payloadJson: string;
}

export interface StoredFile {
  id: OpsId;
  organizationId: OpsId;
  storageKey: string;
  sha256: string;
  originalName: string;
  contentType: string;
  byteLength: number;
  status: "pending" | "available" | "quarantined" | "deleted";
  createdAt: IsoDateTime;
}

export interface EntityFileLink {
  id: OpsId;
  organizationId: OpsId;
  fileId: OpsId;
  entityType: "request" | "work_order" | "visit" | "asset" | "invoice_reference";
  entityId: OpsId;
  purpose: "photo" | "service_document" | "invoice" | "warranty" | "other";
  visibility: "internal" | "vendor_shared" | "public_receipt";
  createdAt: IsoDateTime;
}

export interface FollowUp {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  sourceVisitId?: OpsId;
  accountableParty: string;
  nextAction: string;
  dueAt: IsoDateTime;
  escalationTo: string;
  status: FollowUpStatus;
  createdAt: IsoDateTime;
  completedAt?: IsoDateTime;
}

export interface OpsException {
  id: OpsId;
  organizationId: OpsId;
  kind: ExceptionKind;
  storeId?: OpsId;
  workOrderId?: OpsId;
  visitId?: OpsId;
  vendorId?: OpsId;
  severity: "info" | "attention" | "urgent";
  status: ExceptionStatus;
  summary: string;
  detectedAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
}

export interface Asset {
  id: OpsId;
  organizationId: OpsId;
  storeId: OpsId;
  categoryKey: string;
  taxonomyNodeId?: OpsId;
  groupPath: string[];
  assetTag: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supplier?: string;
  installedAt?: IsoDateTime;
  expectedLifeYears?: number;
  warrantyEndsAt?: IsoDateTime;
  replacementEstimate?: Money;
  status: "operational" | "watch" | "out_of_service" | "retired";
  createdAt: IsoDateTime;
}

export interface AssetComponent {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  parentComponentId?: OpsId;
  name: string;
  partNumber?: string;
  serialNumber?: string;
  installedAt?: IsoDateTime;
  warrantyEndsAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface PmPlan {
  id: OpsId;
  organizationId: OpsId;
  name: string;
  storeId?: OpsId;
  assetId?: OpsId;
  categoryKey?: string;
  cadenceDays: number;
  completionWindowDays: number;
  active: boolean;
  createdAt: IsoDateTime;
}

export interface PmOccurrence {
  id: OpsId;
  organizationId: OpsId;
  planId: OpsId;
  storeId: OpsId;
  assetId?: OpsId;
  workOrderId?: OpsId;
  dueAt: IsoDateTime;
  windowStartsAt: IsoDateTime;
  windowEndsAt: IsoDateTime;
  status: PmOccurrenceStatus;
  completedAt?: IsoDateTime;
}

export interface CostLine {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  kind: CostLineKind;
  description: string;
  amount: Money;
  serviceDate: string;
  recordedAt: IsoDateTime;
}

export interface InvoiceReference {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  invoiceNumber: string;
  invoiceDate: string;
  grossAmount: Money;
  operatorWorkOrderNumber?: string;
  matchStatus: InvoiceMatchStatus;
  createdAt: IsoDateTime;
}

export interface InvoiceAllocation {
  id: OpsId;
  organizationId: OpsId;
  invoiceReferenceId: OpsId;
  workOrderId: OpsId;
  amount: Money;
  confirmedByMembershipId?: OpsId;
  confirmedAt?: IsoDateTime;
}

export interface AuditEvent {
  id: OpsId;
  organizationId: OpsId;
  aggregateType: string;
  aggregateId: OpsId;
  eventType: string;
  actorType: ActorType;
  actorId?: OpsId;
  actorName: string;
  occurredAt: IsoDateTime;
  payloadJson: string;
}

export interface OutboxMessage {
  id: OpsId;
  organizationId: OpsId;
  topic: string;
  aggregateType: string;
  aggregateId: OpsId;
  payloadJson: string;
  status: "pending" | "processing" | "delivered" | "failed";
  availableAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface PublicActionToken {
  id: OpsId;
  organizationId: OpsId;
  purpose: string;
  subjectType: string;
  subjectId: OpsId;
  tokenHash: string;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
  usedAt?: IsoDateTime;
  revokedAt?: IsoDateTime;
}

export interface IdempotencyKey {
  organizationId: OpsId;
  key: string;
  command: string;
  resultId: OpsId;
  requestHash: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
}

export interface PageRequest {
  limit?: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface OpsFixture {
  asOf: IsoDateTime;
  organizations: Organization[];
  divisions: Division[];
  regions: Region[];
  taxonomyNodes: TaxonomyNode[];
  stores: Store[];
  users: User[];
  memberships: Membership[];
  scopeGrants: ScopeGrant[];
  vendors: Vendor[];
  vendorSpecialties: VendorSpecialty[];
  vendorCoverage: VendorCoverage[];
  requests: ServiceRequest[];
  workOrders: WorkOrder[];
  assignments: WorkOrderAssignment[];
  issuances: WorkOrderIssuance[];
  vendorResponses: VendorResponse[];
  estimateRequests: WorkOrderEstimateRequest[];
  estimateProposals: VendorEstimateProposal[];
  visits: VisitSession[];
  visitEvidence: VisitEvidence[];
  files: StoredFile[];
  entityFiles: EntityFileLink[];
  followUps: FollowUp[];
  exceptions: OpsException[];
  assets: Asset[];
  components: AssetComponent[];
  pmPlans: PmPlan[];
  pmOccurrences: PmOccurrence[];
  costLines: CostLine[];
  invoiceReferences: InvoiceReference[];
  invoiceAllocations: InvoiceAllocation[];
  auditEvents: AuditEvent[];
  outboxMessages: OutboxMessage[];
  publicTokens: PublicActionToken[];
}
