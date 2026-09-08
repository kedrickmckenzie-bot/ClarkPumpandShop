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
  | "resolved"
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
export type SiteVisitWorkOrderOutcome =
  | "completed"
  | "temporary_repair"
  | "diagnosis_only"
  | "quote_required"
  | "parts_required"
  | "return_visit_required"
  | "no_issue_found"
  | "store_access_unavailable"
  | "work_not_authorized"
  | "not_addressed";
export type SiteVisitWorkSelectionSource = "assigned_work" | "service_run" | "held_work" | "after_the_fact";
export type HeldWorkPosture = "complete_using_professional_judgment" | "look_and_report";
export type HeldWorkStatus = "active" | "claimed" | "review_required" | "completed" | "cancelled";
export type VendorFollowUpTiming = "within_7_days" | "within_30_days" | "within_90_days" | "next_pm" | "unknown";
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
export type WorkflowTaskType =
  | "review_issue"
  | "approve_quote"
  | "vendor_response_required"
  | "confirm_store_access"
  | "submit_quote"
  | "choose_service_provider"
  | "schedule_service"
  | "record_service_outcome"
  | "schedule_return_visit"
  | "verify_repair"
  | "close_verified_work"
  | "review_warranty"
  | "resolve_invoice_exception"
  | "respond_service_discrepancy"
  | "other";
export type WorkflowTaskAssigneeType = "user" | "team" | "vendor" | "role";
export type WorkflowTaskPriority = "critical" | "high" | "normal" | "low";
export type WorkflowTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type WorkflowTaskSlaClock =
  | "intake_review"
  | "approval"
  | "vendor_response"
  | "scheduling"
  | "arrival"
  | "operational_restoration"
  | "completion"
  | "verification"
  | "invoice_submission"
  | "warranty_response"
  | "service_discrepancy_response";
export type WorkflowTaskSlaPauseReason =
  | "awaiting_vendor"
  | "awaiting_parts"
  | "awaiting_approval"
  | "awaiting_store_access"
  | "awaiting_customer"
  | "weather_or_site_condition"
  | "scheduled_future_event"
  | "external_dependency"
  | "other";
export type WorkflowTaskSlaOwnerType =
  | "membership"
  | "team"
  | "vendor"
  | "store"
  | "external_party"
  | "system";
export type ExceptionStatus = "open" | "acknowledged" | "resolved";
export type ExceptionKind =
  | "no_work_order"
  | "unexpected_visit"
  | "missing_checkout"
  | "outside_geofence"
  | "low_accuracy_location"
  | "duplicate_active_visit"
  | "unmatched_invoice"
  | "amount_above_authorization"
  | "overdue_pm";
export type PmOccurrenceStatus =
  | "upcoming"
  | "unscheduled"
  | "proposed"
  | "scheduled"
  | "due"
  | "completed"
  | "completed_early"
  | "completed_on_time"
  | "completed_late"
  | "missed"
  | "waived"
  | "cancelled";
export type CostLineKind = "labor" | "parts" | "travel" | "materials" | "other";
export type InvoiceMatchStatus = "unmatched" | "suggested" | "confirmed" | "rejected";
export type SchedulingMode = "platform_directed" | "platform_proposed_vendor_confirmed" | "vendor_planned";
export type ServiceRunStatus = "recommended" | "proposed" | "countered" | "accepted" | "committed" | "in_progress" | "completed" | "declined" | "cancelled";
export type ServiceRunResponseKind = "accepted" | "countered" | "stop_change_requested" | "work_order_change_requested" | "insufficient_capacity" | "declined";
export type PmWorkItemStatus = "pending" | "in_progress" | "completed" | "deficient" | "waived" | "cancelled";
export type ChecklistResponseKind = "pass" | "fail" | "not_applicable" | "measurement" | "text";
export type WarrantyCoverageType = "labor" | "part" | "travel" | "diagnostic" | "refrigerant_consumable" | "replacement_equipment" | "other_material";
export type WarrantyRoutingRule = "original_vendor_mandatory" | "original_vendor_first_right_to_cure" | "manufacturer_authorized_provider" | "any_approved_provider" | "manual_review";
export type WarrantyCaseStatus = "potential" | "diagnosis_required" | "confirmed" | "not_covered" | "routed" | "completed" | "closed";
export type CustomerChargeStatus = "undetermined" | "customer_responsible" | "warranty_covered" | "split";
export type InvoiceStatus = "received" | "matching" | "exception" | "warranty_hold" | "discrepancy_hold" | "approved_for_payment" | "partially_paid" | "paid" | "void";
export type InvoiceLineCategory = "labor" | "part" | "travel" | "diagnostic" | "equipment_rental" | "disposal" | "permit" | "tax" | "other_fee";
export type InvoiceAllocationMethod = "equal" | "labor" | "work_order_value" | "manual" | "contract_rule";
export type ValueEventCategory = "realized_verified" | "identified_exposure" | "estimated_opportunity";
export type ActorType = "user" | "vendor_link" | "technician" | "store_device" | "system" | "support";

export type ApprovalPolicyScopeKind = "organization" | "region" | "store";
export type ApprovalPolicyStatus = "active" | "superseded" | "inactive";
export type ApprovalSubjectType = "service_request" | "work_order";
export type ApprovalDecisionKind = "approved" | "rejected" | "escalated" | "cancelled";
export type ApprovalRequiredRole = Extract<
  OrganizationRole,
  "executive" | "facilities_admin" | "regional_manager" | "store_manager" | "finance_reviewer"
>;

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
  /** Monotonic optimistic-concurrency token for request lifecycle mutations. */
  version?: number;
  submittedAt: IsoDateTime;
  convertedWorkOrderId?: OpsId;
}

/** Company-level capability evidence. Technician-level qualification is never inferred from this record. */
export interface VendorQualification {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  tradeKey: string;
  workType?: string;
  serviceType?: string;
  assetType?: string;
  componentType?: string;
  pmWork: boolean;
  emergencyResponse: boolean;
  warrantyWork: boolean;
  manufacturerAuthorization?: string;
  regionId?: OpsId;
  storeId?: OpsId;
  afterHours: boolean;
  maximumJobAmount?: Money;
  requiredLicense?: string;
  requiredCertification?: string;
  effectiveAt: IsoDateTime;
  expiresAt?: IsoDateTime;
  status: "active" | "expired" | "suspended";
  createdAt: IsoDateTime;
}

export type VendorReminderStatus = "open" | "completed" | "cancelled";

/** Relationship work that is not service work and must not become a fake work order. */
export interface VendorReminder {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  title: string;
  note?: string;
  accountableParty: string;
  dueAt: IsoDateTime;
  escalationTo: string;
  status: VendorReminderStatus;
  createdByActorType: ActorType;
  createdByActorId?: OpsId;
  createdByActorName: string;
  createdAt: IsoDateTime;
  completedByActorType?: ActorType;
  completedByActorId?: OpsId;
  completedByActorName?: string;
  completedAt?: IsoDateTime;
  completionNote?: string;
}

export interface VendorComplianceDocument {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  documentType: "insurance" | "license" | "certification" | "tax" | "safety" | "other";
  issuer?: string;
  reference?: string;
  effectiveAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
  reviewStatus: "pending" | "approved" | "rejected" | "expired";
  blocking: boolean;
  storedFileId?: OpsId;
  createdAt: IsoDateTime;
}

export type VendorComplianceAlertStage = "60_day" | "30_day" | "14_day" | "7_day" | "expired";

/** One idempotent escalation fact for the current version of a vendor document. */
export interface VendorComplianceAlert {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  documentId: OpsId;
  stage: VendorComplianceAlertStage;
  expiresAt: IsoDateTime;
  reminderId?: OpsId;
  createdAt: IsoDateTime;
}

export interface VendorContract {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  name: string;
  ownerMembershipId: OpsId;
  status: "active" | "inactive" | "terminated";
  createdAt: IsoDateTime;
}

export interface ContractVersion {
  id: OpsId;
  organizationId: OpsId;
  contractId: OpsId;
  vendorId: OpsId;
  version: number;
  sourceAgreementReference: string;
  status: "draft" | "active" | "superseded" | "expired";
  effectiveStartsAt: IsoDateTime;
  effectiveEndsAt?: IsoDateTime;
  renewalAt?: IsoDateTime;
  noticeDays?: number;
  priceEscalationAt?: IsoDateTime;
  supersedesContractVersionId?: OpsId;
  currency: CurrencyCode;
  preferredProvider: boolean;
  exclusiveProvider: boolean;
  reactiveWorkAllowed: boolean;
  emergencyWorkAllowed: boolean;
  pmWorkAllowed: boolean;
  subcontractorPolicy: "prohibited" | "approval_required" | "allowed";
  schedulingMode: SchedulingMode;
  reservedCapacityMinutes: number;
  nteAmount?: Money;
  materialsMarkupBps: number;
  routeDiscountBps: number;
  evidenceRequirements: string[];
  complianceRequirements: string[];
  warrantyLaborDays?: number;
  warrantyPartsDays?: number;
  warrantyTravelDays?: number;
  createdByMembershipId: OpsId;
  createdAt: IsoDateTime;
}

export interface ContractScope {
  id: OpsId;
  organizationId: OpsId;
  contractVersionId: OpsId;
  scopeKind: "organization" | "region" | "store" | "trade" | "asset_type" | "pm_program";
  scopeId: OpsId | string;
  included: boolean;
}

export interface RateCardLine {
  id: OpsId;
  organizationId: OpsId;
  contractVersionId: OpsId;
  chargeType: "labor" | "trip" | "diagnostic" | "pm" | "material_markup" | "other";
  description: string;
  unit: "hour" | "visit" | "occurrence" | "flat" | "percent";
  amount: Money;
  effectiveStartsAt: IsoDateTime;
  effectiveEndsAt?: IsoDateTime;
}

export interface ServiceLevelPolicy {
  id: OpsId;
  organizationId: OpsId;
  contractVersionId: OpsId;
  priority: WorkOrderPriority;
  responseMinutes: number;
  arrivalMinutes: number;
  completionMinutes: number;
  calendar: "business_hours" | "24x7";
}

export interface SchedulingPolicy {
  id: OpsId;
  organizationId: OpsId;
  contractVersionId: OpsId;
  maximumRouteMinutes: number;
  maximumStores: number;
  maximumTravelMinutes: number;
  maximumUtilizationBps: number;
  perStopBufferMinutes: number;
  travelBufferBps: number;
  documentationBufferMinutes: number;
  uncertaintyBufferBps: number;
  emergencyReserveMinutes: number;
}

export interface VendorCapacity {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  regionId: OpsId;
  tradeKey: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  crewMinutes: number;
  committedMinutes: number;
  maximumRouteMinutes: number;
  maximumStores: number;
  maximumTravelMinutes: number;
  blackout: boolean;
  emergencyReserveMinutes: number;
  variableWorkLimitMinutes: number;
  specialEquipment: string[];
  createdAt: IsoDateTime;
}

export type StoreOperatingState = "open" | "partially_operational" | "unable_to_operate" | "unknown";
export type ImpactSafetyConcern = "none_reported" | "potential" | "immediate" | "unknown";
export type ProductInventoryRisk = "none_reported" | "at_risk" | "loss_reported" | "unknown";
export type ImpactAnswer = "yes" | "no" | "unknown";
export type ComplianceImpact = "none_reported" | "potential" | "confirmed" | "unknown";
export type RevenueFunctionImpact = "fuel" | "foodservice" | "refrigerated_merchandise" | "beverages" | "lottery" | "car_wash" | "other";
export type ImpactConfidence = "low" | "medium" | "high";
export type ImpactSource = "store_report" | "manager_review" | "imported" | "not_assessed";

/**
 * Append-only assessment of the operating impact reported for a store issue.
 * Monetary values are reported exposure estimates, never verified revenue loss.
 */
export interface RequestImpactAssessment {
  id: OpsId;
  organizationId: OpsId;
  requestId: OpsId;
  storeId: OpsId;
  assessmentKind: "initial_report" | "review";
  reviewDisposition?: "confirmed" | "revised";
  storeOperatingState: StoreOperatingState;
  safetyConcern: ImpactSafetyConcern;
  productInventoryRisk: ProductInventoryRisk;
  productInventoryValue?: Money;
  customersAffected: ImpactAnswer;
  complianceImpact: ComplianceImpact;
  capacityUnavailableBps?: number;
  redundantEquipment: ImpactAnswer;
  revenueFunctionImpact?: RevenueFunctionImpact;
  estimatedDailyRevenueExposure?: Money;
  estimatedDowntimeMinutes?: number;
  confidence: ImpactConfidence;
  source: ImpactSource;
  notes?: string;
  assessedByActorType: ActorType;
  assessedByActorId?: OpsId;
  assessedByActorName: string;
  assessedAt: IsoDateTime;
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
  /** Stable operator-side owner for the unresolved case. This is not replaced when a vendor is expected to act next. */
  internalAccountableParty?: string;
  /** Legacy denormalized projection of the primary next-action owner. */
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
  resolvedAt?: IsoDateTime;
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

/**
 * One persisted scheduling fact between operator and provider. A proposed date
 * becomes an appointment record at proposal time or acceptance time - never
 * free-form evidence inside a response message.
 */
export type ServiceAppointmentStatus = "proposed_by_vendor" | "confirmed" | "counter_proposed" | "cancelled";

/** One immutable operator follow-up fact on a vendor response (accept/counter/reply). */
export interface VendorContinuation {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorResponseId: OpsId;
  action: "accept_date" | "counter_date" | "reply" | "decline_recovery";
  message?: string;
  createdByMembershipId?: OpsId;
  createdAt: IsoDateTime;
}
export interface ServiceAppointment {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  assignmentId: OpsId;
  issuanceId?: OpsId;
  sourceVendorResponseId?: OpsId;
  status: ServiceAppointmentStatus;
  proposedBy: "vendor" | "operator";
  startsAt: IsoDateTime;
  note?: string;
  createdByMembershipId?: OpsId;
  createdAt: IsoDateTime;
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
 * Effective-dated policy versions are never edited in place. A change creates
 * another row with the same policy key and a higher version, preserving the
 * exact rule that governed every historical approval request.
 */
export interface ApprovalPolicy {
  id: OpsId;
  organizationId: OpsId;
  policyKey: string;
  version: number;
  name: string;
  scopeKind: ApprovalPolicyScopeKind;
  scopeId: OpsId;
  categoryKey?: string;
  minAmountMinor: number;
  maxAmountMinor?: number;
  currency: CurrencyCode;
  requiredRole: ApprovalRequiredRole;
  escalationRole?: ApprovalRequiredRole;
  status: ApprovalPolicyStatus;
  supersedesPolicyId?: OpsId;
  createdByMembershipId?: OpsId;
  createdAt: IsoDateTime;
}

/**
 * Immutable snapshot of the policy and commercial context presented for a
 * decision. Current status is derived from append-only decisions.
 */
export interface ApprovalRequest {
  id: OpsId;
  organizationId: OpsId;
  subjectType: ApprovalSubjectType;
  subjectId: OpsId;
  storeId: OpsId;
  categoryKey?: string;
  amount: Money;
  policyId: OpsId;
  policyKey: string;
  policyVersion: number;
  policyName: string;
  policyScopeKind: ApprovalPolicyScopeKind;
  policyScopeId: OpsId;
  requiredRole: ApprovalRequiredRole;
  escalationRole?: ApprovalRequiredRole;
  requestedByMembershipId?: OpsId;
  requestedByName: string;
  reason?: string;
  requestedAt: IsoDateTime;
  dueAt?: IsoDateTime;
  parentApprovalRequestId?: OpsId;
}

/** Append-only human decision. Corrections require a new approval request. */
export interface ApprovalDecision {
  id: OpsId;
  organizationId: OpsId;
  approvalRequestId: OpsId;
  decision: ApprovalDecisionKind;
  decidedByMembershipId?: OpsId;
  decidedByName: string;
  decidedByRole: ApprovalRequiredRole;
  reason?: string;
  escalatedToRole?: ApprovalRequiredRole;
  decidedAt: IsoDateTime;
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
  decisionKind?: "service_bid" | "replacement_quote";
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
  technicianPhoneOrPin?: string;
  crewCount?: number;
  additionalTechnicianNames?: string[];
  vehicleIdentifier?: string;
  arrivalNote?: string;
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

/**
 * One immutable work selection within a site visit. A visit owns the shared
 * presence evidence, while this record owns the outcome and next obligation
 * for exactly one selected operator work order.
 */
export interface SiteVisitWorkOrder {
  id: OpsId;
  organizationId: OpsId;
  visitId: OpsId;
  workOrderId: OpsId;
  ordinal: number;
  linkedByActorType: ActorType;
  linkedByActorId?: OpsId;
  linkedByActorName: string;
  linkedAt: IsoDateTime;
  selectionSource?: SiteVisitWorkSelectionSource;
  workOrderHoldId?: OpsId;
  outcome?: SiteVisitWorkOrderOutcome;
  outcomeNotes?: string;
  outcomeRecordedByActorType?: ActorType;
  outcomeRecordedByActorId?: OpsId;
  outcomeRecordedByActorName?: string;
  outcomeRecordedAt?: IsoDateTime;
  followUpId?: OpsId;
  vendorFollowUpTiming?: VendorFollowUpTiming;
}

/** Manager-approved work that may be offered when an appropriate vendor is already onsite. */
export interface WorkOrderVisitHold {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  posture: HeldWorkPosture;
  status: HeldWorkStatus;
  internalReviewThreshold?: Money;
  deadlineAt: IsoDateTime;
  version: number;
  claimedVisitId?: OpsId;
  claimedVendorId?: OpsId;
  claimedAt?: IsoDateTime;
  /** Operator intent only; the vendor has not accepted this additional work. */
  plannedReviewAppointmentId?: OpsId;
  plannedReviewSelectedAt?: IsoDateTime;
  plannedReviewSelectedByMembershipId?: OpsId;
  createdByMembershipId?: OpsId;
  createdByName: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type WorkOrderVerificationDecision = "verified" | "rejected";

/** Append-only internal decision over one exact per-work-order visit outcome. */
export interface WorkOrderVerification {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  siteVisitWorkOrderId: OpsId;
  outcome: SiteVisitWorkOrderOutcome;
  outcomeRecordedAt: IsoDateTime;
  cycle: number;
  decision: WorkOrderVerificationDecision;
  reason?: string;
  decidedByMembershipId: OpsId;
  decidedByName: string;
  decidedAt: IsoDateTime;
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
  entityType: "request" | "work_order" | "visit" | "asset" | "invoice_reference" | "invoice";
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

/**
 * A first-class obligation for the active reactive loop. Most tasks attach to
 * one canonical work order; intake review tasks attach to the source request
 * until a work order is created. Exactly one subject id is present.
 */
export interface WorkflowTask {
  id: OpsId;
  organizationId: OpsId;
  workOrderId?: OpsId;
  serviceRequestId?: OpsId;
  taskType: WorkflowTaskType;
  title: string;
  reason: string;
  assigneeType: WorkflowTaskAssigneeType;
  /** Membership, team, or vendor id. Role assignees use assigneeRole. */
  assigneeId?: OpsId;
  assigneeRole?: OrganizationRole;
  assigneeName: string;
  priority: WorkflowTaskPriority;
  status: WorkflowTaskStatus;
  blocking: boolean;
  requiredForProgress: boolean;
  dueAt?: IsoDateTime;
  /** Required instead of dueAt when an explicit policy excludes this task from an SLA. */
  noSlaReason?: string;
  applicableSlaClock?: WorkflowTaskSlaClock;
  completionCriteria: string;
  escalationDestination: string;
  escalationLevel: number;
  sourceFollowUpId?: OpsId;
  sourceApprovalRequestId?: OpsId;
  createdByActorType: ActorType;
  createdByActorId?: OpsId;
  createdByActorName: string;
  createdAt: IsoDateTime;
  startedByActorType?: ActorType;
  startedByActorId?: OpsId;
  startedByActorName?: string;
  startedAt?: IsoDateTime;
  completedByActorType?: ActorType;
  completedByActorId?: OpsId;
  completedByActorName?: string;
  completedAt?: IsoDateTime;
  cancelledByActorType?: ActorType;
  cancelledByActorId?: OpsId;
  cancelledByActorName?: string;
  cancelledAt?: IsoDateTime;
  resolutionNote?: string;
}

/** Immutable beginning of an SLA hold. Resumption appends a separate row. */
export interface WorkflowTaskSlaPause {
  id: OpsId;
  organizationId: OpsId;
  workflowTaskId: OpsId;
  workOrderId: OpsId;
  reasonCode: WorkflowTaskSlaPauseReason;
  reasonDetail: string;
  ownerType: WorkflowTaskSlaOwnerType;
  ownerId?: OpsId;
  ownerName: string;
  affectedClocks: WorkflowTaskSlaClock[];
  expectedResumeAt?: IsoDateTime;
  pausedByActorType: ActorType;
  pausedByActorId?: OpsId;
  pausedByActorName: string;
  pausedAt: IsoDateTime;
}

/** Immutable closure of one SLA pause; the referenced pause is never edited. */
export interface WorkflowTaskSlaResume {
  id: OpsId;
  organizationId: OpsId;
  workflowTaskId: OpsId;
  workOrderId: OpsId;
  pauseId: OpsId;
  resumedByActorType: ActorType;
  resumedByActorId?: OpsId;
  resumedByActorName: string;
  resumedAt: IsoDateTime;
  note?: string;
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
  /** Durable company equipment type used for setup defaults and PM enrollment. */
  equipmentTemplateId?: OpsId;
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
  replacementProfileId?: OpsId;
  replacementAttributes?: Record<string, string>;
  replacementAdjustmentBps?: number;
  /** Explicitly removes this equipment from shared lifecycle planning without retiring it. */
  replacementPlanningExcludedAt?: IsoDateTime;
  replacementPlanningExclusionReason?: string;
  replacementEstimate?: Money;
  status: "operational" | "watch" | "out_of_service" | "retired";
  retiredAt?: IsoDateTime;
  replacedByAssetId?: OpsId;
  createdAt: IsoDateTime;
}

export interface EquipmentTemplate {
  id: OpsId;
  organizationId: OpsId;
  taxonomyNodeId: OpsId;
  name: string;
  defaultExpectedLifeYears?: number;
  active: boolean;
  createdAt: IsoDateTime;
}

export interface ComponentTemplate {
  id: OpsId;
  organizationId: OpsId;
  equipmentTemplateId: OpsId;
  parentComponentTemplateId?: OpsId;
  name: string;
  sortOrder: number;
  createdAt: IsoDateTime;
}

export interface ReplacementProfile {
  id: OpsId;
  organizationId: OpsId;
  code: string;
  name: string;
  description: string;
  categoryKey: string;
  taxonomyNodeId?: OpsId;
  matchKeys: string[];
  attributes: Record<string, string>;
  expectedLifeYears?: number;
  annualEscalationBps: number;
  lowVarianceBps: number;
  highVarianceBps: number;
  active: boolean;
  createdAt: IsoDateTime;
}

export type ReplacementBenchmarkSource = "approved_quote" | "final_cost" | "manual" | "catalog";

export interface ReplacementBenchmark {
  id: OpsId;
  organizationId: OpsId;
  profileId: OpsId;
  sourceType: ReplacementBenchmarkSource;
  sourceWorkOrderId?: OpsId;
  sourceEstimateProposalId?: OpsId;
  sourceAssetId?: OpsId;
  sourceVendorId?: OpsId;
  equipmentAmount: Money;
  installationAmount: Money;
  otherAmount: Money;
  totalAmount: Money;
  effectiveAt: IsoDateTime;
  status: "published" | "superseded";
  supersededAt?: IsoDateTime;
  notes?: string;
  createdAt: IsoDateTime;
}

export interface AssetReplacementOverride {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  sourceBenchmarkId?: OpsId;
  amount: Money;
  effectiveAt: IsoDateTime;
  reason: string;
  status: "active" | "superseded";
  supersededAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface ReplacementEvent {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  workOrderId: OpsId;
  profileId: OpsId;
  sourceEstimateProposalId: OpsId;
  status: "approved" | "completed" | "cancelled";
  approvedAmount: Money;
  approvedAt: IsoDateTime;
  completedAt?: IsoDateTime;
  finalAmount?: Money;
  replacementAssetId?: OpsId;
  createdAt: IsoDateTime;
}

export type LifecycleRecommendationKind = "repair" | "replace" | "capital_review";
export type LifecycleDecisionKind = "repair" | "replace" | "defer" | "investigate";

export interface LifecycleRecommendation {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  workOrderId?: OpsId;
  version: number;
  modelVersion: string;
  recommendation: LifecycleRecommendationKind;
  confidence: "low" | "medium" | "high";
  inputsJson: string;
  explanation: string;
  missingData: string[];
  userDecision: LifecycleDecisionKind;
  userReason: string;
  /** Optional management-selected capital-planning year; required for replace/defer decisions. */
  plannedForYear?: number;
  decidedByMembershipId: OpsId;
  decidedAt: IsoDateTime;
  actualOutcome?: "repaired" | "replaced" | "retired_without_replacement" | "still_in_service";
  actualOutcomeAt?: IsoDateTime;
  replacementEventId?: OpsId;
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
  removedAt?: IsoDateTime;
  replacedByComponentId?: OpsId;
  createdAt: IsoDateTime;
}

export interface ComponentLifecycleEvent {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  removedComponentId: OpsId;
  installedComponentId: OpsId;
  repairItemId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  partManufacturer: string;
  partModel: string;
  serialNumber?: string;
  removedAt: string;
  installedAt: string;
  failureMode: string;
  rootCause?: string;
  laborCost: Money;
  partCost: Money;
  replacementKind: "planned" | "reactive";
  expectedLifeMonths?: number;
  warrantyEndsAt?: string;
  createdAt: IsoDateTime;
}

export interface MaintenanceProgram {
  id: OpsId;
  organizationId: OpsId;
  programKey: string;
  version: number;
  name: string;
  tradeKey: string;
  workType: string;
  applicableAssetTypes: string[];
  frequencyDays: number;
  recurrenceKind: "fixed_calendar" | "completion_based";
  dueWindowDays: number;
  /** Company calendar anchor used when newly commissioned equipment auto-enrolls. */
  scheduleAnchorAt?: IsoDateTime;
  seasonalStartMonth?: number;
  seasonalEndMonth?: number;
  checklistTemplateId: OpsId;
  requiredEvidenceKinds: EvidenceKind[];
  expectedDurationMinutes: number;
  completionCriteria: string;
  correctiveWorkAuthorityMinor: number;
  currency: CurrencyCode;
  deficiencyHandling: "corrective_work_order" | "quote_and_approval" | "review";
  status: "active" | "superseded" | "inactive";
  supersedesProgramId?: OpsId;
  createdAt: IsoDateTime;
}

export interface ChecklistTemplate {
  id: OpsId;
  organizationId: OpsId;
  name: string;
  version: number;
  items: Array<{
    key: string;
    label: string;
    responseKind: ChecklistResponseKind;
    required: boolean;
    measurementUnit?: string;
    minimumValue?: number;
    maximumValue?: number;
    evidenceRequired?: boolean;
  }>;
  status: "active" | "superseded" | "inactive";
  createdAt: IsoDateTime;
}

export interface PmPlan {
  id: OpsId;
  organizationId: OpsId;
  name: string;
  programId?: OpsId;
  programVersion?: number;
  storeId?: OpsId;
  assetId?: OpsId;
  assetSelectionRule?: string;
  categoryKey?: string;
  cadenceDays: number;
  completionWindowDays: number;
  preferredVendorId?: OpsId;
  backupVendorId?: OpsId;
  contractVersionId?: OpsId;
  effectiveStartsAt?: IsoDateTime;
  effectiveEndsAt?: IsoDateTime;
  accessRequirements?: string;
  programAuthorizationMinor?: number;
  budgetMinor?: number;
  currency?: CurrencyCode;
  serviceLevelPolicyId?: OpsId;
  schedulingMode?: SchedulingMode;
  escalationRules?: string;
  cadenceOverrideReason?: string;
  cadenceOverriddenAt?: IsoDateTime;
  cadenceOverriddenByMembershipId?: OpsId;
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
  programId?: OpsId;
  programVersion?: number;
  planVersion?: number;
  dueAt: IsoDateTime;
  windowStartsAt: IsoDateTime;
  windowEndsAt: IsoDateTime;
  proposedAt?: IsoDateTime;
  committedAt?: IsoDateTime;
  status: PmOccurrenceStatus;
  completedAt?: IsoDateTime;
  result?: string;
  exceptionReason?: string;
  recurrenceKey?: string;
  createdAt?: IsoDateTime;
}

export interface PmWorkItem {
  id: OpsId;
  organizationId: OpsId;
  occurrenceId: OpsId;
  workOrderId: OpsId;
  assetId: OpsId;
  componentId?: OpsId;
  requiredTask: string;
  checklistTemplateId: OpsId;
  status: PmWorkItemStatus;
  result?: string;
  deficiency?: string;
  followUpId?: OpsId;
  correctiveWorkOrderId?: OpsId;
  costAllocationMinor?: number;
  currency: CurrencyCode;
  createdAt: IsoDateTime;
  completedAt?: IsoDateTime;
}

export interface ChecklistResponse {
  id: OpsId;
  organizationId: OpsId;
  workItemId: OpsId;
  checklistTemplateId: OpsId;
  itemKey: string;
  responseKind: ChecklistResponseKind;
  passed?: boolean;
  numericValue?: number;
  textValue?: string;
  measurementUnit?: string;
  evidenceFileIds: OpsId[];
  recordedByActorType: ActorType;
  recordedByActorId?: OpsId;
  recordedByActorName: string;
  recordedAt: IsoDateTime;
}

export interface ServiceRun {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  contractVersionId: OpsId;
  schedulingMode: SchedulingMode;
  status: ServiceRunStatus;
  /** Customer-requested completion boundary. The vendor owns the actual visit schedule. */
  neededByAt?: IsoDateTime;
  proposedStartsAt: IsoDateTime;
  proposedEndsAt: IsoDateTime;
  responseDueAt: IsoDateTime;
  committedStartsAt?: IsoDateTime;
  committedEndsAt?: IsoDateTime;
  estimatedDriveMinutes: number;
  estimatedServiceMinutes: number;
  capacityUsedMinutes: number;
  expectedWorkValue: Money;
  estimatedTripReduction: number;
  estimatedOpportunity: Money;
  recommendationExplanation: string;
  requiredQualifications: string[];
  constraintsJson: string;
  confidence: "low" | "medium" | "high";
  schedulerVersion: string;
  originalRecommendationJson: string;
  createdByActorType: ActorType;
  createdByActorId?: OpsId;
  createdByActorName: string;
  createdAt: IsoDateTime;
  acceptedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
}

export interface RouteStop {
  id: OpsId;
  organizationId: OpsId;
  serviceRunId: OpsId;
  storeId: OpsId;
  sequence: number;
  proposedArrivalAt: IsoDateTime;
  committedArrivalAt?: IsoDateTime;
  estimatedDriveMinutes: number;
  estimatedServiceMinutes: number;
  accessRequirements?: string;
  status: "planned" | "arrived" | "completed" | "skipped";
  siteVisitId?: OpsId;
}

export interface ServiceRunWorkOrder {
  id: OpsId;
  organizationId: OpsId;
  serviceRunId: OpsId;
  routeStopId: OpsId;
  workOrderId: OpsId;
  occurrenceId?: OpsId;
  planned: boolean;
  estimatedDurationMinutes: number;
  addressed: boolean;
  removalReason?: string;
}

export interface ServiceRunResponse {
  id: OpsId;
  organizationId: OpsId;
  serviceRunId: OpsId;
  response: ServiceRunResponseKind;
  requestedStartsAt?: IsoDateTime;
  requestedStopChangesJson?: string;
  requestedWorkOrderChangesJson?: string;
  reasonCode?: string;
  reasonDetail?: string;
  travelImpactMinutes: number;
  dueWindowImpactCount: number;
  economicImpact: Money;
  responderName: string;
  respondedAt: IsoDateTime;
  resultingPlanJson?: string;
}

export interface VendorWarrantyProfile {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  baseLaborDays: number;
  basePartsDays: number;
  baseTravelDays: number;
  baseDiagnosticDays: number;
  effectiveStartsAt: IsoDateTime;
  effectiveEndsAt?: IsoDateTime;
  status: "active" | "superseded" | "inactive";
  createdAt: IsoDateTime;
}

export interface WarrantyRule {
  id: OpsId;
  organizationId: OpsId;
  vendorWarrantyProfileId: OpsId;
  vendorId: OpsId;
  contractVersionId?: OpsId;
  quoteId?: OpsId;
  authorizationId?: OpsId;
  tradeKey?: string;
  workType?: string;
  serviceType?: string;
  assetType?: string;
  componentType?: string;
  manufacturer?: string;
  model?: string;
  vendorSuppliedPart?: boolean;
  customerSuppliedPart?: boolean;
  regionId?: OpsId;
  storeId?: OpsId;
  priority: number;
  effectiveStartsAt: IsoDateTime;
  effectiveEndsAt?: IsoDateTime;
  status: "active" | "superseded" | "inactive";
  createdAt: IsoDateTime;
}

export interface WarrantyCoverageLine {
  id: OpsId;
  organizationId: OpsId;
  warrantyRuleId?: OpsId;
  vendorWarrantyProfileId?: OpsId;
  coverageType: WarrantyCoverageType;
  duration: number;
  durationUnit: "days" | "months" | "years";
  startEvent: "repair_completion" | "store_verification" | "installation" | "commissioning" | "fixed_date";
  startDate?: string;
  endDate?: string;
  provider: "vendor" | "manufacturer" | "other";
  obligatedVendorId?: OpsId;
  routingRule: WarrantyRoutingRule;
  deductible: Money;
  maximumCoverage?: Money;
  conditions?: string;
  exclusions?: string;
}

export interface RepairItem {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  siteVisitWorkOrderId: OpsId;
  vendorId: OpsId;
  contractVersionId?: OpsId;
  assetId: OpsId;
  componentId?: OpsId;
  failureCode: string;
  repairAction: string;
  repairSeverity: "minor" | "moderate" | "major" | "critical";
  removedComponentId?: OpsId;
  installedComponentId?: OpsId;
  partManufacturer?: string;
  partModel?: string;
  serialNumber?: string;
  vendorSupplied: boolean;
  completionDate: string;
  verificationDate?: string;
  laborCost: Money;
  partCost: Money;
  rootCause?: string;
  createdAt: IsoDateTime;
}

export interface AppliedWarranty {
  id: OpsId;
  organizationId: OpsId;
  repairItemId: OpsId;
  coverageType: WarrantyCoverageType;
  provider: "vendor" | "manufacturer" | "other";
  obligatedVendorId?: OpsId;
  startDate: string;
  endDate: string;
  coveredCharges: string[];
  routingRule: WarrantyRoutingRule;
  contractVersionId?: OpsId;
  policySource: string;
  ruleSource?: OpsId;
  originalCalculatedTermsJson: string;
  createdAt: IsoDateTime;
}

export interface WarrantyAmendment {
  id: OpsId;
  organizationId: OpsId;
  appliedWarrantyId: OpsId;
  amendmentKind: "accept_calculated" | "override_coverage" | "add_manufacturer" | "add_other" | "mark_unavailable" | "correct_repair_item";
  appliesToRepairOnly: boolean;
  amendedTermsJson: string;
  reason: string;
  decidedByMembershipId: OpsId;
  decidedByName: string;
  decidedAt: IsoDateTime;
}

export interface ManufacturerWarranty {
  id: OpsId;
  organizationId: OpsId;
  assetId: OpsId;
  componentId?: OpsId;
  manufacturer: string;
  model?: string;
  serialNumber?: string;
  partsCoverage: string;
  laborCoverage: string;
  startDate: string;
  expirationDate: string;
  authorizedProviderRule?: string;
  claimRequirements?: string;
  installingVendorId?: OpsId;
  administrator?: string;
  supportingFileId?: OpsId;
  createdAt: IsoDateTime;
}

export interface WarrantyCase {
  id: OpsId;
  organizationId: OpsId;
  requestId?: OpsId;
  workOrderId: OpsId;
  assetId: OpsId;
  componentId?: OpsId;
  priorRepairItemId?: OpsId;
  appliedWarrantyId?: OpsId;
  manufacturerWarrantyId?: OpsId;
  status: WarrantyCaseStatus;
  confidence: "low" | "medium" | "high";
  detectionExplanation: string;
  diagnosisRequired: boolean;
  coverageDecision: "pending_diagnosis" | "covered" | "not_covered" | "split";
  customerChargeStatus: CustomerChargeStatus;
  invoiceHold: boolean;
  routingRule: WarrantyRoutingRule;
  obligatedVendorId?: OpsId;
  vendorResponseDueAt?: IsoDateTime;
  createdAt: IsoDateTime;
  closedAt?: IsoDateTime;
}

export interface Quote {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  contractVersionId?: OpsId;
  quoteNumber: string;
  version: number;
  scope: string;
  subtotal: Money;
  tax: Money;
  fees: Money;
  total: Money;
  submittedAt: IsoDateTime;
  expiresAt?: IsoDateTime;
  supersedesQuoteId?: OpsId;
}

export interface Authorization {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  authorizationType: "base" | "change_order" | "emergency" | "exception";
  authorizedAmount: Money;
  authorizedScope: string;
  approverMembershipId: OpsId;
  approverName: string;
  approvalAuthority: string;
  authorizedAt: IsoDateTime;
  reason: string;
  contractVersionId?: OpsId;
  supersedesAuthorizationId?: OpsId;
}

export interface Invoice {
  id: OpsId;
  organizationId: OpsId;
  vendorId: OpsId;
  contractVersionId?: OpsId;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  subtotal: Money;
  tax: Money;
  fees: Money;
  total: Money;
  approvedForPayment: Money;
  paidAmount: Money;
  status: InvoiceStatus;
  exceptionReason?: string;
  supportingFileId?: OpsId;
  submittedByMembershipId?: OpsId;
  createdAt: IsoDateTime;
}

export interface InvoiceLine {
  id: OpsId;
  organizationId: OpsId;
  invoiceId: OpsId;
  lineNumber: number;
  category: InvoiceLineCategory;
  description: string;
  quantityThousandths: number;
  unitAmount: Money;
  lineAmount: Money;
  contractRateCardLineId?: OpsId;
  createdAt: IsoDateTime;
}

export interface InvoiceLineAllocation {
  id: OpsId;
  organizationId: OpsId;
  invoiceLineId: OpsId;
  workOrderId: OpsId;
  workItemId?: OpsId;
  repairItemId?: OpsId;
  siteVisitWorkOrderId?: OpsId;
  assetId?: OpsId;
  componentId?: OpsId;
  storeId: OpsId;
  tradeKey?: string;
  amount: Money;
  method: InvoiceAllocationMethod;
  confirmedByMembershipId?: OpsId;
  confirmedAt?: IsoDateTime;
}

export interface InvoiceException {
  id: OpsId;
  organizationId: OpsId;
  invoiceId: OpsId;
  invoiceLineId?: OpsId;
  kind: "duplicate_invoice" | "contract_rate" | "authorization" | "unsupported_trip_charge" | "warranty_hold" | "service_discrepancy_hold" | "allocation_mismatch";
  status: "open" | "resolved" | "waived";
  summary: string;
  amount: Money;
  detectedAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
  resolutionReason?: string;
}

export interface InvoiceAdjustment {
  id: OpsId;
  organizationId: OpsId;
  invoiceId: OpsId;
  kind: "credit" | "void" | "deduction" | "refund";
  amount: Money;
  reason: string;
  createdByMembershipId: OpsId;
  createdAt: IsoDateTime;
}

export interface ServiceDiscrepancy {
  id: OpsId;
  organizationId: OpsId;
  workOrderId: OpsId;
  invoiceId?: OpsId;
  siteVisitWorkOrderId?: OpsId;
  discrepancyType: "amount" | "visit_count" | "duration" | "evidence" | "scope" | "other";
  status: "open" | "vendor_response_pending" | "resolved" | "closed";
  factsJson: string;
  vendorResponse?: string;
  resolution?: string;
  createdAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
}

export interface ValueEvent {
  id: OpsId;
  organizationId: OpsId;
  category: ValueEventCategory;
  eventType: string;
  amount: Money;
  workOrderId?: OpsId;
  invoiceLineId?: OpsId;
  serviceRunId?: OpsId;
  contractVersionId?: OpsId;
  warrantyCaseId?: OpsId;
  assetId?: OpsId;
  approvalDecisionId?: OpsId;
  sourceDecision: string;
  deduplicationKey: string;
  occurredAt: IsoDateTime;
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
  /** Absent on rows written before the delivery-worker slice; treated as 0. */
  attemptCount?: number;
  /** Delivery-lease timestamp set when a worker claims the message. */
  claimedAt?: IsoDateTime | null;
  deliveredAt?: IsoDateTime | null;
  lastError?: string | null;
}

export type NotificationEventKey =
  | "vendor_response_received"
  | "vendor_commitment_received"
  | "workflow_task_escalated"
  | "follow_up_created"
  | "vendor_reminder_created"
  | "held_work_claimed"
  | "held_work_outcomes_recorded"
  | "vendor_compliance_due";

export type NotificationRecipientRole =
  | "facilities_admin"
  | "store_manager"
  | "regional_manager"
  | "executive"
  | "finance_reviewer";

/** Tenant-owned internal notification preference. Vendor service
 * authorizations follow the explicit delivery method selected on the work
 * order and do not depend on these internal-recipient rules. */
export interface NotificationRule {
  id: OpsId;
  organizationId: OpsId;
  eventKey: NotificationEventKey;
  emailEnabled: boolean;
  recipientRole: NotificationRecipientRole;
  updatedByMembershipId?: OpsId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface NotificationRecipient {
  membershipId: OpsId;
  userId: OpsId;
  email: string;
  displayName: string;
  role: NotificationRecipientRole;
}

export interface SavedView {
  id: OpsId;
  organizationId: OpsId;
  ownerMembershipId: OpsId;
  /** Which list surface this view belongs to, e.g. "work-orders". */
  surface: string;
  name: string;
  /** URLSearchParams-encoded filter state, e.g. "status=open&store=store-104". */
  queryString: string;
  createdAt: IsoDateTime;
}

export interface JobRun {
  id: OpsId;
  organizationId: OpsId;
  jobType: string;
  /** Idempotency slot, e.g. the UTC hour a recurring worker executes in. */
  slotKey: string;
  status: "running" | "succeeded" | "failed";
  startedAt: IsoDateTime;
  finishedAt?: IsoDateTime | null;
  processedCount: number;
  failedCount: number;
  detailsJson: string;
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
  /** Stable zero-based offset for operator pages that expose numbered pagination. */
  offset?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  /** Total rows after tenant, role-scope, and user filters are applied. */
  totalCount?: number;
}

export interface OpsFixture {
  asOf: IsoDateTime;
  organizations: Organization[];
  divisions: Division[];
  regions: Region[];
  taxonomyNodes: TaxonomyNode[];
  equipmentTemplates: EquipmentTemplate[];
  componentTemplates: ComponentTemplate[];
  stores: Store[];
  users: User[];
  memberships: Membership[];
  scopeGrants: ScopeGrant[];
  vendors: Vendor[];
  vendorReminders: VendorReminder[];
  vendorSpecialties: VendorSpecialty[];
  vendorCoverage: VendorCoverage[];
  vendorQualifications: VendorQualification[];
  vendorComplianceDocuments: VendorComplianceDocument[];
  vendorComplianceAlerts?: VendorComplianceAlert[];
  vendorContracts: VendorContract[];
  contractVersions: ContractVersion[];
  contractScopes: ContractScope[];
  rateCardLines: RateCardLine[];
  serviceLevelPolicies: ServiceLevelPolicy[];
  schedulingPolicies: SchedulingPolicy[];
  vendorCapacity: VendorCapacity[];
  requests: ServiceRequest[];
  requestImpactAssessments: RequestImpactAssessment[];
  workOrders: WorkOrder[];
  workOrderVisitHolds?: WorkOrderVisitHold[];
  approvalPolicies: ApprovalPolicy[];
  approvalRequests: ApprovalRequest[];
  approvalDecisions: ApprovalDecision[];
  assignments: WorkOrderAssignment[];
  issuances: WorkOrderIssuance[];
  vendorResponses: VendorResponse[];
  estimateRequests: WorkOrderEstimateRequest[];
  estimateProposals: VendorEstimateProposal[];
  visits: VisitSession[];
  siteVisitWorkOrders: SiteVisitWorkOrder[];
  workOrderVerifications: WorkOrderVerification[];
  visitEvidence: VisitEvidence[];
  files: StoredFile[];
  entityFiles: EntityFileLink[];
  followUps: FollowUp[];
  workflowTasks: WorkflowTask[];
  workflowTaskSlaPauses: WorkflowTaskSlaPause[];
  workflowTaskSlaResumes: WorkflowTaskSlaResume[];
  exceptions: OpsException[];
  assets: Asset[];
  replacementProfiles: ReplacementProfile[];
  replacementBenchmarks: ReplacementBenchmark[];
  assetReplacementOverrides: AssetReplacementOverride[];
  replacementEvents: ReplacementEvent[];
  lifecycleRecommendations: LifecycleRecommendation[];
  components: AssetComponent[];
  componentLifecycleEvents: ComponentLifecycleEvent[];
  maintenancePrograms: MaintenanceProgram[];
  checklistTemplates: ChecklistTemplate[];
  pmPlans: PmPlan[];
  pmOccurrences: PmOccurrence[];
  pmWorkItems: PmWorkItem[];
  checklistResponses: ChecklistResponse[];
  serviceRuns: ServiceRun[];
  routeStops: RouteStop[];
  serviceRunWorkOrders: ServiceRunWorkOrder[];
  serviceRunResponses: ServiceRunResponse[];
  vendorWarrantyProfiles: VendorWarrantyProfile[];
  warrantyRules: WarrantyRule[];
  warrantyCoverageLines: WarrantyCoverageLine[];
  repairItems: RepairItem[];
  appliedWarranties: AppliedWarranty[];
  warrantyAmendments: WarrantyAmendment[];
  manufacturerWarranties: ManufacturerWarranty[];
  warrantyCases: WarrantyCase[];
  quotes: Quote[];
  authorizations: Authorization[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  invoiceLineAllocations: InvoiceLineAllocation[];
  invoiceExceptions: InvoiceException[];
  invoiceAdjustments: InvoiceAdjustment[];
  serviceDiscrepancies: ServiceDiscrepancy[];
  valueEvents: ValueEvent[];
  costLines: CostLine[];
  invoiceReferences: InvoiceReference[];
  invoiceAllocations: InvoiceAllocation[];
  auditEvents: AuditEvent[];
  notificationRules?: NotificationRule[];
  savedViews?: SavedView[];
  serviceAppointments?: ServiceAppointment[];
  vendorContinuations?: VendorContinuation[];
  outboxMessages: OutboxMessage[];
  jobRuns?: JobRun[];
  publicTokens: PublicActionToken[];
}
