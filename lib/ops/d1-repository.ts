import { hasWorkCostFilter, workCostSql } from "./work-cost-query";
import type {
  ExceptionQueueQuery,
  OpsRepository,
  OpsStatement,
  OrganizationScope,
  OutboxDeliveryOutcome,
  PublicTokenLookup,
  WorkOrderListQuery,
} from "./repository";
import type {
  Asset,
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  AssetReplacementOverride,
  AssetComponent,
  ComponentTemplate,
  Division,
  EquipmentTemplate,
  FollowUp,
  IdempotencyKey,
  IsoDateTime,
  LifecycleRecommendation,
  Membership,
  OpsException,
  OpsId,
  PageRequest,
  RequestImpactAssessment,
  ScopeGrant,
  ServiceAppointment,
  ServiceRequest,
  SiteVisitWorkOrder,
  Store,
  StoredFile,
  ReplacementBenchmark,
  ReplacementEvent,
  ReplacementProfile,
  TaxonomyNode,
  Vendor,
  VendorSpecialty,
  VendorReminder,
  VendorEstimateProposal,
  VendorContinuation,
  VendorResponse,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderEstimateRequest,
  WorkOrderIssuance,
  WorkOrderVerification,
  WorkflowTask,
  WorkflowTaskSlaPause,
  WorkflowTaskSlaResume,
  VendorQualification,
  VendorComplianceDocument,
  VendorComplianceAlert,
  WorkOrderVisitHold,
  ContractVersion,
  ContractScope,
  RateCardLine,
  SchedulingPolicy,
  VendorCapacity,
  MaintenanceProgram,
  PmPlan,
  PmOccurrence,
  PmWorkItem,
  ServiceRun,
  RouteStop,
  ServiceRunWorkOrder,
  ServiceRunResponse,
  VendorWarrantyProfile,
  WarrantyRule,
  WarrantyCoverageLine,
  RepairItem,
  AppliedWarranty,
  WarrantyCase,
  Quote,
  Authorization,
  Invoice,
  InvoiceLine,
  InvoiceLineAllocation,
  InvoiceException,
  InvoiceAdjustment,
  ValueEvent,
  OutboxMessage,
  NotificationRecipient,
  NotificationRule,
  OrganizationWorkflowPolicy,
  RoleCapabilityOverride,
  JobRun,
  SavedView,
} from "./types";
import type {
  ActiveVisitView,
  AssetDetailView,
  AssetSearchRow,
  ExceptionQueueRow,
  ExecutiveSnapshotView,
  PmOccurrenceRow,
  PublicStoreGatewayView,
  RequestListRow,
  ServiceAuthorizationView,
  StoreDetailView,
  StoreSearchRow,
  StoreVisitContextView,
  TrustedStoreActiveVisitRow,
  TrustedStoreDeviceView,
  VendorDirectoryRow,
  VisitListRow,
  WorkOrderDetailView,
  WorkOrderListRow,
} from "./view-models";
import { OpsDomainError } from "./errors";

type Row = Record<string, unknown>;

function requestConversionUniquenessError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: unknown; constraint?: unknown; cause?: unknown };
  if (record.constraint === "uidx_ops_work_orders_org_request") return true;
  const message = [
    typeof record.message === "string" ? record.message : "",
    record.cause && typeof record.cause === "object" && "message" in record.cause
      ? String((record.cause as { message?: unknown }).message ?? "")
      : "",
  ].join(" ");
  return message.includes("uidx_ops_work_orders_org_request")
    || message.includes("ops_work_orders.organization_id, ops_work_orders.request_id");
}

function scalarText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function text(row: Row, key: string) { return scalarText(row[key]); }
function maybeText(row: Row, key: string) { return row[key] == null ? undefined : scalarText(row[key]); }
function maybeNumber(row: Row, key: string) { return row[key] == null ? undefined : Number(row[key]); }
function bool(row: Row, key: string) { return Boolean(Number(row[key] ?? 0)); }
function jsonArray(row: Row, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try { return JSON.parse(text(row, key) || "[]") as string[]; } catch { return []; }
}
function jsonObject(row: Row, key: string) {
  const value = row[key];
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  try {
    const parsed = JSON.parse(text(row, key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch { return {}; }
}
function limit(input?: number) { return Math.max(1, Math.min(100, input ?? 25)); }
function offset(input?: number) { return Math.max(0, Math.floor(input ?? 0)); }
function formatAddress(row: Pick<Store, "address1" | "address2" | "city" | "state" | "postalCode">) { return [row.address1, row.address2, `${row.city}, ${row.state} ${row.postalCode}`].filter(Boolean).join(", "); }
function notificationRuleFrom(row: Row): NotificationRule { return { id: text(row, "id"), organizationId: text(row, "organization_id"), eventKey: text(row, "event_key") as NotificationRule["eventKey"], emailEnabled: bool(row, "email_enabled"), recipientRole: text(row, "recipient_role") as NotificationRule["recipientRole"], updatedByMembershipId: maybeText(row, "updated_by_membership_id"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at") }; }
function roleCapabilityOverrideFrom(row: Row): RoleCapabilityOverride { return { id: text(row, "id"), organizationId: text(row, "organization_id"), role: text(row, "role") as RoleCapabilityOverride["role"], capability: text(row, "capability") as RoleCapabilityOverride["capability"], enabled: bool(row, "enabled"), updatedByMembershipId: text(row, "updated_by_membership_id"), updatedByName: text(row, "updated_by_name"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at") }; }
function workflowPolicyFrom(row: Row): OrganizationWorkflowPolicy { return { id: text(row, "id"), organizationId: text(row, "organization_id"), version: Number(row.version), status: text(row, "status") as OrganizationWorkflowPolicy["status"], autoCloseRoutineAfterVerification: bool(row, "auto_close_routine_after_verification"), appliesToActiveWork: bool(row, "applies_to_active_work"), createdByMembershipId: text(row, "created_by_membership_id"), createdByName: text(row, "created_by_name"), createdAt: text(row, "created_at") }; }

function encodeCursor(sortValue: string, id: string) {
  return `${encodeURIComponent(sortValue)}|${encodeURIComponent(id)}`;
}

function decodeCursor(cursor: string | undefined) {
  if (cursor === undefined) return undefined;
  const parts = cursor.split("|");
  if (parts.length !== 2) return null;
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    return decoded.every(Boolean) ? decoded as [string, string] : null;
  } catch {
    return null;
  }
}

function addKeysetCursor(
  clauses: string[],
  params: unknown[],
  cursor: string | undefined,
  sortColumn: string,
  idColumn: string,
  direction: "asc" | "desc",
) {
  const decoded = decodeCursor(cursor);
  if (decoded === undefined) return;
  if (decoded === null) {
    clauses.push("1 = 0");
    return;
  }
  const [sortValue, id] = decoded;
  const comparison = direction === "asc" ? ">" : "<";
  clauses.push(`(${sortColumn} ${comparison} ? OR (${sortColumn} = ? AND ${idColumn} ${comparison} ?))`);
  params.push(sortValue, sortValue, id);
}

function storeAllowed(scope: OrganizationScope, store: Store) {
  if (scope.storeIds !== undefined && !scope.storeIds.includes(store.id)) return false;
  if (scope.regionIds !== undefined && (!store.regionId || !scope.regionIds.includes(store.regionId))) return false;
  return true;
}

function storeFrom(row: Row): Store {
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), divisionId: maybeText(row, "division_id"), regionId: maybeText(row, "region_id"), storeNumber: text(row, "store_number"), name: text(row, "name"), address1: text(row, "address_1"), address2: maybeText(row, "address_2"), city: text(row, "city"), state: text(row, "state"), postalCode: text(row, "postal_code"), aliases: jsonArray(row, "aliases_json"), latitudeE6: maybeNumber(row, "latitude_e6"), longitudeE6: maybeNumber(row, "longitude_e6"), geofenceRadiusM: Number(row.geofence_radius_m ?? 200), locationPolicyEnabled: bool(row, "location_policy_enabled"), timeZone: maybeText(row, "time_zone"), status: text(row, "status") as Store["status"], createdAt: text(row, "created_at") };
}

function workOrderFrom(row: Row): WorkOrder {
  const amount = maybeNumber(row, "nte_amount_minor");
  const repairEstimateAmount = maybeNumber(row, "repair_estimate_amount_minor");
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), number: text(row, "number"), storeId: text(row, "store_id"), requestId: maybeText(row, "request_id"), problem: text(row, "problem"), authorizedScope: maybeText(row, "authorized_scope"), categoryKey: maybeText(row, "category_key"), taxonomyNodeId: maybeText(row, "taxonomy_node_id"), assetId: maybeText(row, "asset_id"), componentId: maybeText(row, "component_id"), priority: text(row, "priority") as WorkOrder["priority"], status: text(row, "status") as WorkOrder["status"], version: Number(row.version ?? 0), internalAccountableParty: maybeText(row, "internal_accountable_party") ?? "Facilities coordinator", internalAccountableType: maybeText(row, "internal_accountable_type") as WorkOrder["internalAccountableType"], internalAccountableId: maybeText(row, "internal_accountable_id"), accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: maybeText(row, "due_at"), escalationTo: maybeText(row, "escalation_to"), nte: amount == null ? undefined : { amountMinor: amount, currency: text(row, "nte_currency") || "USD" }, repairEstimate: repairEstimateAmount == null ? undefined : { amountMinor: repairEstimateAmount, currency: text(row, "repair_estimate_currency") || "USD" }, estimatedServiceExtensionMonths: maybeNumber(row, "estimated_service_extension_months"), vendorServiceTicketNumber: maybeText(row, "vendor_service_ticket_number"), vendorInvoiceNumber: maybeText(row, "vendor_invoice_number"), externalAccountingPo: maybeText(row, "external_accounting_po"), createdAt: text(row, "created_at"), resolvedAt: maybeText(row, "resolved_at"), closedAt: maybeText(row, "closed_at") };
}

function approvalPolicyFrom(row: Row): ApprovalPolicy {
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), policyKey: text(row, "policy_key"), version: Number(row.version), name: text(row, "name"), scopeKind: text(row, "scope_kind") as ApprovalPolicy["scopeKind"], scopeId: text(row, "scope_id"), categoryKey: maybeText(row, "category_key"), minAmountMinor: Number(row.min_amount_minor), maxAmountMinor: maybeNumber(row, "max_amount_minor"), currency: text(row, "currency"), requiredRole: text(row, "required_role") as ApprovalPolicy["requiredRole"], escalationRole: maybeText(row, "escalation_role") as ApprovalPolicy["escalationRole"], status: text(row, "status") as ApprovalPolicy["status"], supersedesPolicyId: maybeText(row, "supersedes_policy_id"), createdByMembershipId: maybeText(row, "created_by_membership_id"), createdAt: text(row, "created_at") };
}

function approvalRequestFrom(row: Row): ApprovalRequest {
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), subjectType: text(row, "subject_type") as ApprovalRequest["subjectType"], subjectId: text(row, "subject_id"), storeId: text(row, "store_id"), categoryKey: maybeText(row, "category_key"), amount: { amountMinor: Number(row.amount_minor), currency: text(row, "currency") }, policyId: text(row, "policy_id"), policyKey: text(row, "policy_key"), policyVersion: Number(row.policy_version), policyName: text(row, "policy_name"), policyScopeKind: text(row, "policy_scope_kind") as ApprovalRequest["policyScopeKind"], policyScopeId: text(row, "policy_scope_id"), requiredRole: text(row, "required_role") as ApprovalRequest["requiredRole"], escalationRole: maybeText(row, "escalation_role") as ApprovalRequest["escalationRole"], requestedByMembershipId: maybeText(row, "requested_by_membership_id"), requestedByName: text(row, "requested_by_name"), reason: maybeText(row, "reason"), requestedAt: text(row, "requested_at"), dueAt: maybeText(row, "due_at"), parentApprovalRequestId: maybeText(row, "parent_approval_request_id") };
}

function approvalDecisionFrom(row: Row): ApprovalDecision {
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), approvalRequestId: text(row, "approval_request_id"), decision: text(row, "decision") as ApprovalDecision["decision"], decidedByMembershipId: maybeText(row, "decided_by_membership_id"), decidedByName: text(row, "decided_by_name"), decidedByRole: text(row, "decided_by_role") as ApprovalDecision["decidedByRole"], reason: maybeText(row, "reason"), escalatedToRole: maybeText(row, "escalated_to_role") as ApprovalDecision["escalatedToRole"], decidedAt: text(row, "decided_at") };
}

function assignmentFrom(row: Row): WorkOrderAssignment { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), kind: text(row, "kind") as WorkOrderAssignment["kind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), status: text(row, "status") as WorkOrderAssignment["status"], assignedAt: text(row, "assigned_at"), supersedesAssignmentId: maybeText(row, "supersedes_assignment_id") }; }
function issuanceFrom(row: Row): WorkOrderIssuance { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), revision: Number(row.revision), immutablePayloadJson: text(row, "immutable_payload_json"), channel: text(row, "channel") as WorkOrderIssuance["channel"], issuedAt: text(row, "issued_at") }; }
function estimateRequestFrom(row: Row): WorkOrderEstimateRequest { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), vendorId: text(row, "vendor_id"), kind: text(row, "kind") as WorkOrderEstimateRequest["kind"], decisionKind: (maybeText(row, "decision_kind") ?? "service_bid") as WorkOrderEstimateRequest["decisionKind"], requestedScope: text(row, "requested_scope"), status: text(row, "status") as WorkOrderEstimateRequest["status"], channel: text(row, "channel") as WorkOrderEstimateRequest["channel"], requestedAt: text(row, "requested_at"), dueAt: maybeText(row, "due_at"), openedAt: maybeText(row, "opened_at"), respondedAt: maybeText(row, "responded_at"), decisionAt: maybeText(row, "decision_at") }; }
function estimateProposalFrom(row: Row): VendorEstimateProposal { return { id: text(row, "id"), organizationId: text(row, "organization_id"), requestId: text(row, "request_id"), workOrderId: text(row, "work_order_id"), vendorId: text(row, "vendor_id"), revision: Number(row.revision), amount: { amountMinor: Number(row.amount_minor), currency: text(row, "currency") || "USD" }, scope: text(row, "scope"), exclusions: maybeText(row, "exclusions"), leadTimeDays: maybeNumber(row, "lead_time_days"), validUntil: maybeText(row, "valid_until"), submittedAt: text(row, "submitted_at") }; }
function replacementProfileFrom(row: Row): ReplacementProfile { return { id: text(row, "id"), organizationId: text(row, "organization_id"), code: text(row, "code"), name: text(row, "name"), description: text(row, "description"), categoryKey: text(row, "category_key"), taxonomyNodeId: maybeText(row, "taxonomy_node_id"), matchKeys: jsonArray(row, "match_keys_json"), attributes: jsonObject(row, "attributes_json"), expectedLifeYears: maybeNumber(row, "expected_life_years"), annualEscalationBps: Number(row.annual_escalation_bps ?? 300), lowVarianceBps: Number(row.low_variance_bps ?? 1000), highVarianceBps: Number(row.high_variance_bps ?? 2000), active: bool(row, "active"), createdAt: text(row, "created_at") }; }
function replacementBenchmarkFrom(row: Row): ReplacementBenchmark { const currency = text(row, "currency") || "USD"; return { id: text(row, "id"), organizationId: text(row, "organization_id"), profileId: text(row, "profile_id"), sourceType: text(row, "source_type") as ReplacementBenchmark["sourceType"], sourceWorkOrderId: maybeText(row, "source_work_order_id"), sourceEstimateProposalId: maybeText(row, "source_estimate_proposal_id"), sourceAssetId: maybeText(row, "source_asset_id"), sourceVendorId: maybeText(row, "source_vendor_id"), equipmentAmount: { amountMinor: Number(row.equipment_amount_minor), currency }, installationAmount: { amountMinor: Number(row.installation_amount_minor), currency }, otherAmount: { amountMinor: Number(row.other_amount_minor), currency }, totalAmount: { amountMinor: Number(row.total_amount_minor), currency }, effectiveAt: text(row, "effective_at"), status: text(row, "status") as ReplacementBenchmark["status"], supersededAt: maybeText(row, "superseded_at"), notes: maybeText(row, "notes"), createdAt: text(row, "created_at") }; }
function assetReplacementOverrideFrom(row: Row): AssetReplacementOverride { return { id: text(row, "id"), organizationId: text(row, "organization_id"), assetId: text(row, "asset_id"), sourceBenchmarkId: maybeText(row, "source_benchmark_id"), amount: { amountMinor: Number(row.amount_minor), currency: text(row, "currency") || "USD" }, effectiveAt: text(row, "effective_at"), reason: text(row, "reason"), status: text(row, "status") as AssetReplacementOverride["status"], supersededAt: maybeText(row, "superseded_at"), createdAt: text(row, "created_at") }; }
function replacementEventFrom(row: Row): ReplacementEvent { const currency = text(row, "currency") || "USD"; const final = maybeNumber(row, "final_amount_minor"); return { id: text(row, "id"), organizationId: text(row, "organization_id"), assetId: text(row, "asset_id"), workOrderId: text(row, "work_order_id"), profileId: text(row, "profile_id"), sourceEstimateProposalId: text(row, "source_estimate_proposal_id"), status: text(row, "status") as ReplacementEvent["status"], approvedAmount: { amountMinor: Number(row.approved_amount_minor), currency }, approvedAt: text(row, "approved_at"), completedAt: maybeText(row, "completed_at"), finalAmount: final == null ? undefined : { amountMinor: final, currency }, replacementAssetId: maybeText(row, "replacement_asset_id"), createdAt: text(row, "created_at") }; }
function lifecycleRecommendationFrom(row: Row): LifecycleRecommendation { return { id: text(row, "id"), organizationId: text(row, "organization_id"), assetId: text(row, "asset_id"), workOrderId: maybeText(row, "work_order_id"), version: Number(row.version), modelVersion: text(row, "model_version"), recommendation: text(row, "recommendation") as LifecycleRecommendation["recommendation"], confidence: text(row, "confidence") as LifecycleRecommendation["confidence"], inputsJson: text(row, "inputs_json"), explanation: text(row, "explanation"), missingData: jsonArray(row, "missing_data_json"), userDecision: text(row, "user_decision") as LifecycleRecommendation["userDecision"], userReason: text(row, "user_reason"), plannedForYear: maybeNumber(row, "planned_for_year"), decidedByMembershipId: text(row, "decided_by_membership_id"), decidedAt: text(row, "decided_at"), actualOutcome: maybeText(row, "actual_outcome") as LifecycleRecommendation["actualOutcome"], actualOutcomeAt: maybeText(row, "actual_outcome_at"), replacementEventId: maybeText(row, "replacement_event_id"), createdAt: text(row, "created_at") }; }
function vendorQualificationFrom(row: Row): VendorQualification { const amount = maybeNumber(row, "maximum_job_amount_minor"); return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), tradeKey: text(row,"trade_key"), workType: maybeText(row,"work_type"), serviceType: maybeText(row,"service_type"), assetType: maybeText(row,"asset_type"), componentType: maybeText(row,"component_type"), pmWork: bool(row,"pm_work"), emergencyResponse: bool(row,"emergency_response"), warrantyWork: bool(row,"warranty_work"), manufacturerAuthorization: maybeText(row,"manufacturer_authorization"), regionId: maybeText(row,"region_id"), storeId: maybeText(row,"store_id"), afterHours: bool(row,"after_hours"), maximumJobAmount: amount == null ? undefined : { amountMinor: amount, currency: text(row,"currency") || "USD" }, requiredLicense: maybeText(row,"required_license"), requiredCertification: maybeText(row,"required_certification"), effectiveAt: text(row,"effective_at"), expiresAt: maybeText(row,"expires_at"), status: text(row,"status") as VendorQualification["status"], createdAt: text(row,"created_at") }; }
function vendorComplianceFrom(row: Row): VendorComplianceDocument { return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), documentType: text(row,"document_type") as VendorComplianceDocument["documentType"], issuer: maybeText(row,"issuer"), reference: maybeText(row,"reference"), effectiveAt: maybeText(row,"effective_at"), expiresAt: maybeText(row,"expires_at"), reviewStatus: text(row,"review_status") as VendorComplianceDocument["reviewStatus"], blocking: bool(row,"blocking"), storedFileId: maybeText(row,"stored_file_id"), createdAt: text(row,"created_at") }; }
function vendorSpecialtyFrom(row: Row): VendorSpecialty { return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), canonicalKey: text(row,"canonical_key"), displayName: text(row,"display_name"), searchAliases: jsonArray(row,"search_aliases_json") }; }
function vendorComplianceAlertFrom(row: Row): VendorComplianceAlert { return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), documentId: text(row,"document_id"), stage: text(row,"stage") as VendorComplianceAlert["stage"], expiresAt: text(row,"expires_at"), reminderId: maybeText(row,"reminder_id"), createdAt: text(row,"created_at") }; }
function workOrderVisitHoldFrom(row: Row): WorkOrderVisitHold { const threshold = maybeNumber(row,"internal_review_threshold_minor"); return { id: text(row,"id"), organizationId: text(row,"organization_id"), workOrderId: text(row,"work_order_id"), posture: text(row,"posture") as WorkOrderVisitHold["posture"], status: text(row,"status") as WorkOrderVisitHold["status"], internalReviewThreshold: threshold == null ? undefined : { amountMinor: threshold, currency: text(row,"currency") || "USD" }, deadlineAt: text(row,"deadline_at"), version: Number(row.version ?? 0), claimedVisitId: maybeText(row,"claimed_visit_id"), claimedVendorId: maybeText(row,"claimed_vendor_id"), claimedAt: maybeText(row,"claimed_at"), plannedReviewAppointmentId: maybeText(row,"planned_review_appointment_id"), plannedReviewSelectedAt: maybeText(row,"planned_review_selected_at"), plannedReviewSelectedByMembershipId: maybeText(row,"planned_review_selected_by_membership_id"), createdByMembershipId: maybeText(row,"created_by_membership_id"), createdByName: text(row,"created_by_name"), createdAt: text(row,"created_at"), updatedAt: text(row,"updated_at") }; }
function contractVersionFrom(row: Row): ContractVersion { const currency = text(row,"currency") || "USD"; const nte = maybeNumber(row,"nte_amount_minor"); return { id: text(row,"id"), organizationId: text(row,"organization_id"), contractId: text(row,"contract_id"), vendorId: text(row,"vendor_id"), version: Number(row.version), sourceAgreementReference: text(row,"source_agreement_reference"), status: text(row,"status") as ContractVersion["status"], effectiveStartsAt: text(row,"effective_starts_at"), effectiveEndsAt: maybeText(row,"effective_ends_at"), renewalAt: maybeText(row,"renewal_at"), noticeDays: maybeNumber(row,"notice_days"), priceEscalationAt: maybeText(row,"price_escalation_at"), supersedesContractVersionId: maybeText(row,"supersedes_contract_version_id"), currency, preferredProvider: bool(row,"preferred_provider"), exclusiveProvider: bool(row,"exclusive_provider"), reactiveWorkAllowed: bool(row,"reactive_work_allowed"), emergencyWorkAllowed: bool(row,"emergency_work_allowed"), pmWorkAllowed: bool(row,"pm_work_allowed"), subcontractorPolicy: text(row,"subcontractor_policy") as ContractVersion["subcontractorPolicy"], schedulingMode: text(row,"scheduling_mode") as ContractVersion["schedulingMode"], reservedCapacityMinutes: Number(row.reserved_capacity_minutes), nteAmount: nte == null ? undefined : { amountMinor: nte, currency }, materialsMarkupBps: Number(row.materials_markup_bps), routeDiscountBps: Number(row.route_discount_bps), evidenceRequirements: jsonArray(row,"evidence_requirements_json"), complianceRequirements: jsonArray(row,"compliance_requirements_json"), warrantyLaborDays: maybeNumber(row,"warranty_labor_days"), warrantyPartsDays: maybeNumber(row,"warranty_parts_days"), warrantyTravelDays: maybeNumber(row,"warranty_travel_days"), createdByMembershipId: text(row,"created_by_membership_id"), createdAt: text(row,"created_at") }; }
function contractScopeFrom(row: Row): ContractScope { return { id: text(row,"id"), organizationId: text(row,"organization_id"), contractVersionId: text(row,"contract_version_id"), scopeKind: text(row,"scope_kind") as ContractScope["scopeKind"], scopeId: text(row,"scope_id"), included: bool(row,"included") }; }
function rateCardFrom(row: Row): RateCardLine { return { id: text(row,"id"), organizationId: text(row,"organization_id"), contractVersionId: text(row,"contract_version_id"), chargeType: text(row,"charge_type") as RateCardLine["chargeType"], description: text(row,"description"), unit: text(row,"unit") as RateCardLine["unit"], amount: { amountMinor: Number(row.amount_minor), currency: text(row,"currency") || "USD" }, effectiveStartsAt: text(row,"effective_starts_at"), effectiveEndsAt: maybeText(row,"effective_ends_at") }; }
function schedulingPolicyFrom(row: Row): SchedulingPolicy { return { id: text(row,"id"), organizationId: text(row,"organization_id"), contractVersionId: text(row,"contract_version_id"), maximumRouteMinutes: Number(row.maximum_route_minutes), maximumStores: Number(row.maximum_stores), maximumTravelMinutes: Number(row.maximum_travel_minutes), maximumUtilizationBps: Number(row.maximum_utilization_bps), perStopBufferMinutes: Number(row.per_stop_buffer_minutes), travelBufferBps: Number(row.travel_buffer_bps), documentationBufferMinutes: Number(row.documentation_buffer_minutes), uncertaintyBufferBps: Number(row.uncertainty_buffer_bps), emergencyReserveMinutes: Number(row.emergency_reserve_minutes) }; }
function vendorCapacityFrom(row: Row): VendorCapacity { return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), regionId: text(row,"region_id"), tradeKey: text(row,"trade_key"), startsAt: text(row,"starts_at"), endsAt: text(row,"ends_at"), crewMinutes: Number(row.crew_minutes), committedMinutes: Number(row.committed_minutes), maximumRouteMinutes: Number(row.maximum_route_minutes), maximumStores: Number(row.maximum_stores), maximumTravelMinutes: Number(row.maximum_travel_minutes), blackout: bool(row,"blackout"), emergencyReserveMinutes: Number(row.emergency_reserve_minutes), variableWorkLimitMinutes: Number(row.variable_work_limit_minutes), specialEquipment: jsonArray(row,"special_equipment_json"), createdAt: text(row,"created_at") }; }
function maintenanceProgramFrom(row: Row): MaintenanceProgram { return { id: text(row,"id"), organizationId: text(row,"organization_id"), programKey: text(row,"program_key"), version: Number(row.version), name: text(row,"name"), tradeKey: text(row,"trade_key"), workType: text(row,"work_type"), applicableAssetTypes: jsonArray(row,"applicable_asset_types_json"), frequencyDays: Number(row.frequency_days), recurrenceKind: text(row,"recurrence_kind") as MaintenanceProgram["recurrenceKind"], dueWindowDays: Number(row.due_window_days), scheduleAnchorAt: maybeText(row,"schedule_anchor_at"), seasonalStartMonth: maybeNumber(row,"seasonal_start_month"), seasonalEndMonth: maybeNumber(row,"seasonal_end_month"), checklistTemplateId: text(row,"checklist_template_id"), requiredEvidenceKinds: jsonArray(row,"required_evidence_kinds_json") as MaintenanceProgram["requiredEvidenceKinds"], expectedDurationMinutes: Number(row.expected_duration_minutes), completionCriteria: text(row,"completion_criteria"), correctiveWorkAuthorityMinor: Number(row.corrective_work_authority_minor), currency: text(row,"currency") || "USD", deficiencyHandling: text(row,"deficiency_handling") as MaintenanceProgram["deficiencyHandling"], status: text(row,"status") as MaintenanceProgram["status"], supersedesProgramId: maybeText(row,"supersedes_program_id"), createdAt: text(row,"created_at") }; }
function pmPlanFrom(row: Row): PmPlan { return { id: text(row,"id"), organizationId: text(row,"organization_id"), name: text(row,"name"), programId: maybeText(row,"program_id"), programVersion: maybeNumber(row,"program_version"), storeId: maybeText(row,"store_id"), assetId: maybeText(row,"asset_id"), assetSelectionRule: maybeText(row,"asset_selection_rule"), categoryKey: maybeText(row,"category_key"), cadenceDays: Number(row.cadence_days), completionWindowDays: Number(row.completion_window_days), preferredVendorId: maybeText(row,"preferred_vendor_id"), backupVendorId: maybeText(row,"backup_vendor_id"), contractVersionId: maybeText(row,"contract_version_id"), effectiveStartsAt: maybeText(row,"effective_starts_at"), effectiveEndsAt: maybeText(row,"effective_ends_at"), accessRequirements: maybeText(row,"access_requirements"), programAuthorizationMinor: maybeNumber(row,"program_authorization_minor"), budgetMinor: maybeNumber(row,"budget_minor"), currency: maybeText(row,"currency"), serviceLevelPolicyId: maybeText(row,"service_level_policy_id"), schedulingMode: maybeText(row,"scheduling_mode") as PmPlan["schedulingMode"], escalationRules: maybeText(row,"escalation_rules"), cadenceOverrideReason: maybeText(row,"cadence_override_reason"), cadenceOverriddenAt: maybeText(row,"cadence_overridden_at"), cadenceOverriddenByMembershipId: maybeText(row,"cadence_overridden_by_membership_id"), active: bool(row,"active"), createdAt: text(row,"created_at") }; }
function pmOccurrenceFrom(row: Row): PmOccurrence { return { id: text(row,"id"), organizationId: text(row,"organization_id"), planId: text(row,"plan_id"), storeId: text(row,"store_id"), assetId: maybeText(row,"asset_id"), workOrderId: maybeText(row,"work_order_id"), programId: maybeText(row,"program_id"), programVersion: maybeNumber(row,"program_version"), planVersion: maybeNumber(row,"plan_version"), dueAt: text(row,"due_at"), windowStartsAt: text(row,"window_starts_at"), windowEndsAt: text(row,"window_ends_at"), proposedAt: maybeText(row,"proposed_at"), committedAt: maybeText(row,"committed_at"), status: text(row,"status") as PmOccurrence["status"], completedAt: maybeText(row,"completed_at"), result: maybeText(row,"result"), exceptionReason: maybeText(row,"exception_reason"), recurrenceKey: maybeText(row,"recurrence_key"), createdAt: maybeText(row,"created_at") }; }
function pmWorkItemFrom(row: Row): PmWorkItem { return { id: text(row,"id"), organizationId: text(row,"organization_id"), occurrenceId: text(row,"occurrence_id"), workOrderId: text(row,"work_order_id"), assetId: text(row,"asset_id"), componentId: maybeText(row,"component_id"), requiredTask: text(row,"required_task"), checklistTemplateId: text(row,"checklist_template_id"), status: text(row,"status") as PmWorkItem["status"], result: maybeText(row,"result"), deficiency: maybeText(row,"deficiency"), followUpId: maybeText(row,"follow_up_id"), correctiveWorkOrderId: maybeText(row,"corrective_work_order_id"), costAllocationMinor: maybeNumber(row,"cost_allocation_minor"), currency: text(row,"currency") || "USD", createdAt: text(row,"created_at"), completedAt: maybeText(row,"completed_at") }; }
function serviceRunFrom(row: Row): ServiceRun { const currency = text(row,"currency") || "USD"; return { id: text(row,"id"), organizationId: text(row,"organization_id"), vendorId: text(row,"vendor_id"), contractVersionId: text(row,"contract_version_id"), schedulingMode: text(row,"scheduling_mode") as ServiceRun["schedulingMode"], status: text(row,"status") as ServiceRun["status"], neededByAt: maybeText(row,"needed_by_at"), proposedStartsAt: text(row,"proposed_starts_at"), proposedEndsAt: text(row,"proposed_ends_at"), responseDueAt: text(row,"response_due_at"), committedStartsAt: maybeText(row,"committed_starts_at"), committedEndsAt: maybeText(row,"committed_ends_at"), estimatedDriveMinutes: Number(row.estimated_drive_minutes), estimatedServiceMinutes: Number(row.estimated_service_minutes), capacityUsedMinutes: Number(row.capacity_used_minutes), expectedWorkValue: { amountMinor: Number(row.expected_work_value_minor), currency }, estimatedTripReduction: Number(row.estimated_trip_reduction), estimatedOpportunity: { amountMinor: Number(row.estimated_opportunity_minor), currency }, recommendationExplanation: text(row,"recommendation_explanation"), requiredQualifications: jsonArray(row,"required_qualifications_json"), constraintsJson: scalarText(row.constraints_json), confidence: text(row,"confidence") as ServiceRun["confidence"], schedulerVersion: text(row,"scheduler_version"), originalRecommendationJson: scalarText(row.original_recommendation_json), createdByActorType: text(row,"created_by_actor_type") as ServiceRun["createdByActorType"], createdByActorId: maybeText(row,"created_by_actor_id"), createdByActorName: text(row,"created_by_actor_name"), createdAt: text(row,"created_at"), acceptedAt: maybeText(row,"accepted_at"), completedAt: maybeText(row,"completed_at") }; }
function routeStopFrom(row: Row): RouteStop { return { id: text(row,"id"), organizationId: text(row,"organization_id"), serviceRunId: text(row,"service_run_id"), storeId: text(row,"store_id"), sequence: Number(row.sequence), proposedArrivalAt: text(row,"proposed_arrival_at"), committedArrivalAt: maybeText(row,"committed_arrival_at"), estimatedDriveMinutes: Number(row.estimated_drive_minutes), estimatedServiceMinutes: Number(row.estimated_service_minutes), accessRequirements: maybeText(row,"access_requirements"), status: text(row,"status") as RouteStop["status"], siteVisitId: maybeText(row,"site_visit_id") }; }
function serviceRunWorkOrderFrom(row: Row): ServiceRunWorkOrder { return { id: text(row,"id"), organizationId: text(row,"organization_id"), serviceRunId: text(row,"service_run_id"), routeStopId: text(row,"route_stop_id"), workOrderId: text(row,"work_order_id"), occurrenceId: maybeText(row,"occurrence_id"), planned: bool(row,"planned"), estimatedDurationMinutes: Number(row.estimated_duration_minutes), addressed: bool(row,"addressed"), removalReason: maybeText(row,"removal_reason") }; }
function serviceRunResponseFrom(row: Row): ServiceRunResponse { return { id: text(row,"id"), organizationId: text(row,"organization_id"), serviceRunId: text(row,"service_run_id"), response: text(row,"response") as ServiceRunResponse["response"], requestedStartsAt: maybeText(row,"requested_starts_at"), requestedStopChangesJson: maybeText(row,"requested_stop_changes_json"), requestedWorkOrderChangesJson: maybeText(row,"requested_work_order_changes_json"), reasonCode: maybeText(row,"reason_code"), reasonDetail: maybeText(row,"reason_detail"), travelImpactMinutes: Number(row.travel_impact_minutes), dueWindowImpactCount: Number(row.due_window_impact_count), economicImpact: { amountMinor: Number(row.economic_impact_minor), currency: text(row,"currency") || "USD" }, responderName: text(row,"responder_name"), respondedAt: text(row,"responded_at"), resultingPlanJson: maybeText(row,"resulting_plan_json") }; }
function warrantyProfileFrom(row: Row): VendorWarrantyProfile { return { id:text(row,"id"), organizationId:text(row,"organization_id"), vendorId:text(row,"vendor_id"), baseLaborDays:Number(row.base_labor_days), basePartsDays:Number(row.base_parts_days), baseTravelDays:Number(row.base_travel_days), baseDiagnosticDays:Number(row.base_diagnostic_days), effectiveStartsAt:text(row,"effective_starts_at"), effectiveEndsAt:maybeText(row,"effective_ends_at"), status:text(row,"status") as VendorWarrantyProfile["status"], createdAt:text(row,"created_at") }; }
function warrantyRuleFrom(row: Row): WarrantyRule { return { id:text(row,"id"), organizationId:text(row,"organization_id"), vendorWarrantyProfileId:text(row,"vendor_warranty_profile_id"), vendorId:text(row,"vendor_id"), contractVersionId:maybeText(row,"contract_version_id"), quoteId:maybeText(row,"quote_id"), authorizationId:maybeText(row,"authorization_id"), tradeKey:maybeText(row,"trade_key"), workType:maybeText(row,"work_type"), serviceType:maybeText(row,"service_type"), assetType:maybeText(row,"asset_type"), componentType:maybeText(row,"component_type"), manufacturer:maybeText(row,"manufacturer"), model:maybeText(row,"model"), vendorSuppliedPart:row.vendor_supplied_part==null?undefined:bool(row,"vendor_supplied_part"), customerSuppliedPart:row.customer_supplied_part==null?undefined:bool(row,"customer_supplied_part"), regionId:maybeText(row,"region_id"), storeId:maybeText(row,"store_id"), priority:Number(row.priority), effectiveStartsAt:text(row,"effective_starts_at"), effectiveEndsAt:maybeText(row,"effective_ends_at"), status:text(row,"status") as WarrantyRule["status"], createdAt:text(row,"created_at") }; }
function warrantyCoverageFrom(row: Row): WarrantyCoverageLine { const currency=text(row,"currency")||"USD"; return { id:text(row,"id"), organizationId:text(row,"organization_id"), warrantyRuleId:maybeText(row,"warranty_rule_id"), vendorWarrantyProfileId:maybeText(row,"vendor_warranty_profile_id"), coverageType:text(row,"coverage_type") as WarrantyCoverageLine["coverageType"], duration:Number(row.duration), durationUnit:text(row,"duration_unit") as WarrantyCoverageLine["durationUnit"], startEvent:text(row,"start_event") as WarrantyCoverageLine["startEvent"], startDate:maybeText(row,"start_date"), endDate:maybeText(row,"end_date"), provider:text(row,"provider") as WarrantyCoverageLine["provider"], obligatedVendorId:maybeText(row,"obligated_vendor_id"), routingRule:text(row,"routing_rule") as WarrantyCoverageLine["routingRule"], deductible:{amountMinor:Number(row.deductible_minor),currency}, maximumCoverage:row.maximum_coverage_minor==null?undefined:{amountMinor:Number(row.maximum_coverage_minor),currency}, conditions:maybeText(row,"conditions"), exclusions:maybeText(row,"exclusions") }; }
function repairItemFrom(row: Row): RepairItem { const currency=text(row,"currency")||"USD"; return { id:text(row,"id"), organizationId:text(row,"organization_id"), workOrderId:text(row,"work_order_id"), siteVisitWorkOrderId:text(row,"site_visit_work_order_id"), vendorId:text(row,"vendor_id"), contractVersionId:maybeText(row,"contract_version_id"), assetId:text(row,"asset_id"), componentId:maybeText(row,"component_id"), failureCode:text(row,"failure_code"), repairAction:text(row,"repair_action"), repairSeverity:text(row,"repair_severity") as RepairItem["repairSeverity"], removedComponentId:maybeText(row,"removed_component_id"), installedComponentId:maybeText(row,"installed_component_id"), partManufacturer:maybeText(row,"part_manufacturer"), partModel:maybeText(row,"part_model"), serialNumber:maybeText(row,"serial_number"), vendorSupplied:bool(row,"vendor_supplied"), completionDate:text(row,"completion_date"), verificationDate:maybeText(row,"verification_date"), laborCost:{amountMinor:Number(row.labor_cost_minor),currency}, partCost:{amountMinor:Number(row.part_cost_minor),currency}, rootCause:maybeText(row,"root_cause"), createdAt:text(row,"created_at") }; }
function appliedWarrantyFrom(row: Row): AppliedWarranty { return { id:text(row,"id"), organizationId:text(row,"organization_id"), repairItemId:text(row,"repair_item_id"), coverageType:text(row,"coverage_type") as AppliedWarranty["coverageType"], provider:text(row,"provider") as AppliedWarranty["provider"], obligatedVendorId:maybeText(row,"obligated_vendor_id"), startDate:text(row,"start_date"), endDate:text(row,"end_date"), coveredCharges:jsonArray(row,"covered_charges_json"), routingRule:text(row,"routing_rule") as AppliedWarranty["routingRule"], contractVersionId:maybeText(row,"contract_version_id"), policySource:text(row,"policy_source"), ruleSource:maybeText(row,"rule_source"), originalCalculatedTermsJson:scalarText(row.original_calculated_terms_json), createdAt:text(row,"created_at") }; }
function warrantyCaseFrom(row: Row): WarrantyCase { return { id:text(row,"id"), organizationId:text(row,"organization_id"), requestId:maybeText(row,"request_id"), workOrderId:text(row,"work_order_id"), assetId:text(row,"asset_id"), componentId:maybeText(row,"component_id"), priorRepairItemId:maybeText(row,"prior_repair_item_id"), appliedWarrantyId:maybeText(row,"applied_warranty_id"), manufacturerWarrantyId:maybeText(row,"manufacturer_warranty_id"), status:text(row,"status") as WarrantyCase["status"], confidence:text(row,"confidence") as WarrantyCase["confidence"], detectionExplanation:text(row,"detection_explanation"), diagnosisRequired:bool(row,"diagnosis_required"), coverageDecision:text(row,"coverage_decision") as WarrantyCase["coverageDecision"], customerChargeStatus:text(row,"customer_charge_status") as WarrantyCase["customerChargeStatus"], invoiceHold:bool(row,"invoice_hold"), routingRule:text(row,"routing_rule") as WarrantyCase["routingRule"], obligatedVendorId:maybeText(row,"obligated_vendor_id"), vendorResponseDueAt:maybeText(row,"vendor_response_due_at"), createdAt:text(row,"created_at"), closedAt:maybeText(row,"closed_at") }; }
function quoteFrom(row:Row):Quote{const currency=text(row,"currency")||"USD";return{id:text(row,"id"),organizationId:text(row,"organization_id"),workOrderId:text(row,"work_order_id"),vendorId:text(row,"vendor_id"),contractVersionId:maybeText(row,"contract_version_id"),quoteNumber:text(row,"quote_number"),version:Number(row.version),scope:text(row,"scope"),subtotal:{amountMinor:Number(row.subtotal_minor),currency},tax:{amountMinor:Number(row.tax_minor),currency},fees:{amountMinor:Number(row.fees_minor),currency},total:{amountMinor:Number(row.total_minor),currency},submittedAt:text(row,"submitted_at"),expiresAt:maybeText(row,"expires_at"),supersedesQuoteId:maybeText(row,"supersedes_quote_id")}}
function authorizationFrom(row:Row):Authorization{const currency=text(row,"currency")||"USD";return{id:text(row,"id"),organizationId:text(row,"organization_id"),workOrderId:text(row,"work_order_id"),authorizationType:text(row,"authorization_type") as Authorization["authorizationType"],authorizedAmount:{amountMinor:Number(row.authorized_amount_minor),currency},authorizedScope:text(row,"authorized_scope"),approverMembershipId:text(row,"approver_membership_id"),approverName:text(row,"approver_name"),approvalAuthority:text(row,"approval_authority"),authorizedAt:text(row,"authorized_at"),reason:text(row,"reason"),contractVersionId:maybeText(row,"contract_version_id"),supersedesAuthorizationId:maybeText(row,"supersedes_authorization_id")}}
function invoiceFrom(row: Row): Invoice { const currency=text(row,"currency")||"USD"; return { version:Number(row.version ?? 0), id:text(row,"id"), organizationId:text(row,"organization_id"), vendorId:text(row,"vendor_id"), contractVersionId:maybeText(row,"contract_version_id"), vendorInvoiceNumber:text(row,"vendor_invoice_number"), invoiceDate:text(row,"invoice_date").slice(0,10), subtotal:{amountMinor:Number(row.subtotal_minor),currency}, tax:{amountMinor:Number(row.tax_minor),currency}, fees:{amountMinor:Number(row.fees_minor),currency}, total:{amountMinor:Number(row.total_minor),currency}, approvedForPayment:{amountMinor:Number(row.approved_for_payment_minor),currency}, paidAmount:{amountMinor:Number(row.paid_amount_minor),currency}, status:text(row,"status") as Invoice["status"], exceptionReason:maybeText(row,"exception_reason"), supportingFileId:maybeText(row,"supporting_file_id"), submittedByMembershipId:maybeText(row,"submitted_by_membership_id"), createdAt:text(row,"created_at") }; }
function invoiceLineFrom(row: Row): InvoiceLine { const currency=text(row,"currency")||"USD"; return { id:text(row,"id"), organizationId:text(row,"organization_id"), invoiceId:text(row,"invoice_id"), lineNumber:Number(row.line_number), category:text(row,"category") as InvoiceLine["category"], description:text(row,"description"), quantityThousandths:Number(row.quantity_thousandths), unitAmount:{amountMinor:Number(row.unit_amount_minor),currency}, lineAmount:{amountMinor:Number(row.line_amount_minor),currency}, contractRateCardLineId:maybeText(row,"contract_rate_card_line_id"), createdAt:text(row,"created_at") }; }
function invoiceAllocationFrom(row: Row): InvoiceLineAllocation { return { id:text(row,"id"), organizationId:text(row,"organization_id"), invoiceLineId:text(row,"invoice_line_id"), workOrderId:text(row,"work_order_id"), workItemId:maybeText(row,"work_item_id"), repairItemId:maybeText(row,"repair_item_id"), siteVisitWorkOrderId:maybeText(row,"site_visit_work_order_id"), assetId:maybeText(row,"asset_id"), componentId:maybeText(row,"component_id"), storeId:text(row,"store_id"), tradeKey:maybeText(row,"trade_key"), amount:{amountMinor:Number(row.amount_minor),currency:text(row,"currency")||"USD"}, method:text(row,"method") as InvoiceLineAllocation["method"], confirmedByMembershipId:maybeText(row,"confirmed_by_membership_id"), confirmedAt:maybeText(row,"confirmed_at") }; }
function invoiceExceptionFrom(row: Row): InvoiceException { return { id:text(row,"id"), organizationId:text(row,"organization_id"), invoiceId:text(row,"invoice_id"), invoiceLineId:maybeText(row,"invoice_line_id"), kind:text(row,"kind") as InvoiceException["kind"], status:text(row,"status") as InvoiceException["status"], summary:text(row,"summary"), amount:{amountMinor:Number(row.amount_minor),currency:text(row,"currency")||"USD"}, detectedAt:text(row,"detected_at"), resolvedAt:maybeText(row,"resolved_at"), resolutionReason:maybeText(row,"resolution_reason") }; }
function invoiceAdjustmentFrom(row: Row): InvoiceAdjustment { return { id:text(row,"id"), organizationId:text(row,"organization_id"), invoiceId:text(row,"invoice_id"), kind:text(row,"kind") as InvoiceAdjustment["kind"], amount:{amountMinor:Number(row.amount_minor),currency:text(row,"currency")||"USD"}, reason:text(row,"reason"), createdByMembershipId:text(row,"created_by_membership_id"), createdAt:text(row,"created_at") }; }
function valueEventFrom(row: Row): ValueEvent { return { id:text(row,"id"), organizationId:text(row,"organization_id"), category:text(row,"category") as ValueEvent["category"], eventType:text(row,"event_type"), amount:{amountMinor:Number(row.amount_minor),currency:text(row,"currency")||"USD"}, workOrderId:maybeText(row,"work_order_id"), invoiceLineId:maybeText(row,"invoice_line_id"), serviceRunId:maybeText(row,"service_run_id"), contractVersionId:maybeText(row,"contract_version_id"), warrantyCaseId:maybeText(row,"warranty_case_id"), assetId:maybeText(row,"asset_id"), approvalDecisionId:maybeText(row,"approval_decision_id"), sourceDecision:text(row,"source_decision"), deduplicationKey:text(row,"deduplication_key"), occurredAt:text(row,"occurred_at") }; }
function visitFrom(row: Row): VisitSession { return { id: text(row, "id"), organizationId: text(row, "organization_id"), storeId: text(row, "store_id"), providerKind: text(row, "provider_kind") as VisitSession["providerKind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), workOrderId: maybeText(row, "work_order_id"), unmatchedReason: maybeText(row, "unmatched_reason"), technicianName: text(row, "technician_name"), technicianPhoneOrPin: maybeText(row, "technician_phone_or_pin"), crewCount: Number(row.crew_count ?? 1), additionalTechnicianNames: jsonArray(row, "additional_technician_names_json"), vehicleIdentifier: maybeText(row, "vehicle_identifier"), arrivalNote: maybeText(row, "arrival_note"), providerName: text(row, "provider_name"), purpose: text(row, "purpose"), status: text(row, "status") as VisitSession["status"], startedChannel: text(row, "started_channel") as VisitSession["startedChannel"], endedChannel: maybeText(row, "ended_channel") as VisitSession["endedChannel"], checkedInAt: text(row, "checked_in_at"), checkedOutAt: maybeText(row, "checked_out_at"), outcome: maybeText(row, "outcome") as VisitSession["outcome"], outcomeNotes: maybeText(row, "outcome_notes"), observedDurationSeconds: maybeNumber(row, "observed_duration_seconds") }; }
function siteVisitWorkOrderFrom(row: Row): SiteVisitWorkOrder { return { id: text(row, "id"), organizationId: text(row, "organization_id"), visitId: text(row, "visit_id"), workOrderId: text(row, "work_order_id"), ordinal: Number(row.ordinal), linkedByActorType: text(row, "linked_by_actor_type") as SiteVisitWorkOrder["linkedByActorType"], linkedByActorId: maybeText(row, "linked_by_actor_id"), linkedByActorName: text(row, "linked_by_actor_name"), linkedAt: text(row, "linked_at"), selectionSource: (maybeText(row, "selection_source") ?? "assigned_work") as SiteVisitWorkOrder["selectionSource"], workOrderHoldId: maybeText(row, "work_order_hold_id"), outcome: maybeText(row, "outcome") as SiteVisitWorkOrder["outcome"], outcomeNotes: maybeText(row, "outcome_notes"), outcomeRecordedByActorType: maybeText(row, "outcome_recorded_by_actor_type") as SiteVisitWorkOrder["outcomeRecordedByActorType"], outcomeRecordedByActorId: maybeText(row, "outcome_recorded_by_actor_id"), outcomeRecordedByActorName: maybeText(row, "outcome_recorded_by_actor_name"), outcomeRecordedAt: maybeText(row, "outcome_recorded_at"), followUpId: maybeText(row, "follow_up_id"), vendorFollowUpTiming: maybeText(row, "vendor_follow_up_timing") as SiteVisitWorkOrder["vendorFollowUpTiming"] }; }
function workOrderVerificationFrom(row: Row): WorkOrderVerification { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), siteVisitWorkOrderId: text(row, "site_visit_work_order_id"), outcome: text(row, "outcome") as WorkOrderVerification["outcome"], outcomeRecordedAt: text(row, "outcome_recorded_at"), cycle: Number(row.cycle), decision: text(row, "decision") as WorkOrderVerification["decision"], basis: maybeText(row, "basis") as WorkOrderVerification["basis"], verificationScope: maybeText(row, "verification_scope") as WorkOrderVerification["verificationScope"], reason: maybeText(row, "reason"), decidedByMembershipId: text(row, "decided_by_membership_id"), decidedByName: text(row, "decided_by_name"), decidedAt: text(row, "decided_at") }; }
function requestImpactAssessmentFrom(row: Row): RequestImpactAssessment { const inventoryValue = maybeNumber(row, "product_inventory_value_minor"); const revenueExposure = maybeNumber(row, "estimated_daily_revenue_exposure_minor"); return { id: text(row, "id"), organizationId: text(row, "organization_id"), requestId: text(row, "request_id"), storeId: text(row, "store_id"), assessmentKind: text(row, "assessment_kind") as RequestImpactAssessment["assessmentKind"], reviewDisposition: maybeText(row, "review_disposition") as RequestImpactAssessment["reviewDisposition"], storeOperatingState: text(row, "store_operating_state") as RequestImpactAssessment["storeOperatingState"], safetyConcern: text(row, "safety_concern") as RequestImpactAssessment["safetyConcern"], productInventoryRisk: text(row, "product_inventory_risk") as RequestImpactAssessment["productInventoryRisk"], productInventoryValue: inventoryValue === undefined ? undefined : { amountMinor: inventoryValue, currency: text(row, "product_inventory_currency") || "USD" }, customersAffected: text(row, "customers_affected") as RequestImpactAssessment["customersAffected"], complianceImpact: text(row, "compliance_impact") as RequestImpactAssessment["complianceImpact"], capacityUnavailableBps: maybeNumber(row, "capacity_unavailable_bps"), redundantEquipment: text(row, "redundant_equipment") as RequestImpactAssessment["redundantEquipment"], revenueFunctionImpact: maybeText(row, "revenue_function_impact") as RequestImpactAssessment["revenueFunctionImpact"], estimatedDailyRevenueExposure: revenueExposure === undefined ? undefined : { amountMinor: revenueExposure, currency: text(row, "estimated_daily_revenue_exposure_currency") || "USD" }, estimatedDowntimeMinutes: maybeNumber(row, "estimated_downtime_minutes"), confidence: text(row, "confidence") as RequestImpactAssessment["confidence"], source: text(row, "source") as RequestImpactAssessment["source"], notes: maybeText(row, "notes"), assessedByActorType: text(row, "assessed_by_actor_type") as RequestImpactAssessment["assessedByActorType"], assessedByActorId: maybeText(row, "assessed_by_actor_id"), assessedByActorName: text(row, "assessed_by_actor_name"), assessedAt: text(row, "assessed_at") }; }
function followUpFrom(row: Row): FollowUp { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), sourceVisitId: maybeText(row, "source_visit_id"), accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: text(row, "due_at"), escalationTo: text(row, "escalation_to"), status: text(row, "status") as FollowUp["status"], createdAt: text(row, "created_at"), completedAt: maybeText(row, "completed_at") }; }
function vendorReminderFrom(row: Row): VendorReminder { return { id: text(row, "id"), organizationId: text(row, "organization_id"), vendorId: text(row, "vendor_id"), title: text(row, "title"), note: maybeText(row, "note"), accountableParty: text(row, "accountable_party"), dueAt: text(row, "due_at"), escalationTo: text(row, "escalation_to"), status: text(row, "status") as VendorReminder["status"], createdByActorType: text(row, "created_by_actor_type") as VendorReminder["createdByActorType"], createdByActorId: maybeText(row, "created_by_actor_id"), createdByActorName: text(row, "created_by_actor_name"), createdAt: text(row, "created_at"), completedByActorType: maybeText(row, "completed_by_actor_type") as VendorReminder["completedByActorType"], completedByActorId: maybeText(row, "completed_by_actor_id"), completedByActorName: maybeText(row, "completed_by_actor_name"), completedAt: maybeText(row, "completed_at"), completionNote: maybeText(row, "completion_note") }; }
function workflowTaskFrom(row: Row): WorkflowTask { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: maybeText(row, "work_order_id"), serviceRequestId: maybeText(row, "service_request_id"), taskType: text(row, "task_type") as WorkflowTask["taskType"], title: text(row, "title"), reason: text(row, "reason"), assigneeType: text(row, "assignee_type") as WorkflowTask["assigneeType"], assigneeId: maybeText(row, "assignee_id"), assigneeRole: maybeText(row, "assignee_role") as WorkflowTask["assigneeRole"], assigneeName: text(row, "assignee_name"), priority: text(row, "priority") as WorkflowTask["priority"], status: text(row, "status") as WorkflowTask["status"], blocking: bool(row, "blocking"), requiredForProgress: bool(row, "required_for_progress"), dueAt: maybeText(row, "due_at"), noSlaReason: maybeText(row, "no_sla_reason"), applicableSlaClock: maybeText(row, "applicable_sla_clock") as WorkflowTask["applicableSlaClock"], completionCriteria: text(row, "completion_criteria"), escalationDestination: text(row, "escalation_destination"), escalationLevel: Number(row.escalation_level ?? 0), sourceFollowUpId: maybeText(row, "source_follow_up_id"), sourceApprovalRequestId: maybeText(row, "source_approval_request_id"), createdByActorType: text(row, "created_by_actor_type") as WorkflowTask["createdByActorType"], createdByActorId: maybeText(row, "created_by_actor_id"), createdByActorName: text(row, "created_by_actor_name"), createdAt: text(row, "created_at"), startedByActorType: maybeText(row, "started_by_actor_type") as WorkflowTask["startedByActorType"], startedByActorId: maybeText(row, "started_by_actor_id"), startedByActorName: maybeText(row, "started_by_actor_name"), startedAt: maybeText(row, "started_at"), completedByActorType: maybeText(row, "completed_by_actor_type") as WorkflowTask["completedByActorType"], completedByActorId: maybeText(row, "completed_by_actor_id"), completedByActorName: maybeText(row, "completed_by_actor_name"), completedAt: maybeText(row, "completed_at"), cancelledByActorType: maybeText(row, "cancelled_by_actor_type") as WorkflowTask["cancelledByActorType"], cancelledByActorId: maybeText(row, "cancelled_by_actor_id"), cancelledByActorName: maybeText(row, "cancelled_by_actor_name"), cancelledAt: maybeText(row, "cancelled_at"), resolutionNote: maybeText(row, "resolution_note") }; }
function workflowTaskSlaPauseFrom(row: Row): WorkflowTaskSlaPause { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workflowTaskId: text(row, "workflow_task_id"), workOrderId: text(row, "work_order_id"), reasonCode: text(row, "reason_code") as WorkflowTaskSlaPause["reasonCode"], reasonDetail: text(row, "reason_detail"), ownerType: text(row, "owner_type") as WorkflowTaskSlaPause["ownerType"], ownerId: maybeText(row, "owner_id"), ownerName: text(row, "owner_name"), affectedClocks: jsonArray(row, "affected_clocks_json") as WorkflowTaskSlaPause["affectedClocks"], expectedResumeAt: maybeText(row, "expected_resume_at"), pausedByActorType: text(row, "paused_by_actor_type") as WorkflowTaskSlaPause["pausedByActorType"], pausedByActorId: maybeText(row, "paused_by_actor_id"), pausedByActorName: text(row, "paused_by_actor_name"), pausedAt: text(row, "paused_at") }; }
function workflowTaskSlaResumeFrom(row: Row): WorkflowTaskSlaResume { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workflowTaskId: text(row, "workflow_task_id"), workOrderId: text(row, "work_order_id"), pauseId: text(row, "pause_id"), resumedByActorType: text(row, "resumed_by_actor_type") as WorkflowTaskSlaResume["resumedByActorType"], resumedByActorId: maybeText(row, "resumed_by_actor_id"), resumedByActorName: text(row, "resumed_by_actor_name"), resumedAt: text(row, "resumed_at"), note: maybeText(row, "note") }; }
function exceptionFrom(row: Row): OpsException { return { id: text(row, "id"), organizationId: text(row, "organization_id"), kind: text(row, "kind") as OpsException["kind"], storeId: maybeText(row, "store_id"), workOrderId: maybeText(row, "work_order_id"), visitId: maybeText(row, "visit_id"), vendorId: maybeText(row, "vendor_id"), severity: text(row, "severity") as OpsException["severity"], status: text(row, "status") as OpsException["status"], summary: text(row, "summary"), detectedAt: text(row, "detected_at"), resolvedAt: maybeText(row, "resolved_at") }; }

function visitListRow(row: Row): VisitListRow {
  return {
    id: text(row, "id"),
    storeId: text(row, "store_id"),
    storeNumber: text(row, "store_number"),
    storeName: text(row, "store_name"),
    storeTimeZone: maybeText(row, "store_time_zone"),
    providerKind: text(row, "provider_kind") as VisitListRow["providerKind"],
    vendorId: maybeText(row, "vendor_id"),
    internalMembershipId: maybeText(row, "internal_membership_id"),
    providerName: text(row, "provider_name"),
    workOrderId: maybeText(row, "linked_work_order_id") ?? maybeText(row, "work_order_id"),
    workOrderNumber: maybeText(row, "work_order_number"),
    technicianName: text(row, "technician_name"),
    crewCount: Number(row.crew_count ?? 1),
    additionalTechnicianNames: jsonArray(row, "additional_technician_names_json"),
    vehicleIdentifier: maybeText(row, "vehicle_identifier"),
    arrivalNote: maybeText(row, "arrival_note"),
    purpose: text(row, "purpose"),
    status: text(row, "status"),
    checkedInAt: text(row, "checked_in_at"),
    checkedOutAt: maybeText(row, "checked_out_at"),
    outcome: maybeText(row, "outcome") as VisitListRow["outcome"],
    workOutcome: maybeText(row, "work_outcome") as VisitListRow["workOutcome"],
    workOutcomeNotes: maybeText(row, "work_outcome_notes"),
    workFollowUpId: maybeText(row, "work_follow_up_id"),
    locationResult: (maybeText(row, "location_result") ?? "not_requested") as VisitListRow["locationResult"],
    approximateObservedSeconds: maybeNumber(row, "observed_duration_seconds"),
  };
}

function scopeWhere(scope: OrganizationScope, alias: string, params: unknown[]) {
  const clauses = [`${alias}.organization_id = ?`];
  params.push(scope.organizationId);
  if (scope.storeIds !== undefined) {
    if (scope.storeIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.id IN (${scope.storeIds.map(() => "?").join(",")})`); params.push(...scope.storeIds); }
  }
  if (scope.regionIds !== undefined) {
    if (scope.regionIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.region_id IN (${scope.regionIds.map(() => "?").join(",")})`); params.push(...scope.regionIds); }
  }
  return clauses.join(" AND ");
}

function outboxMessageFrom(row: Row): OutboxMessage {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    topic: text(row, "topic"),
    aggregateType: text(row, "aggregate_type"),
    aggregateId: text(row, "aggregate_id"),
    payloadJson: text(row, "payload_json"),
    status: text(row, "status") as OutboxMessage["status"],
    availableAt: text(row, "available_at"),
    createdAt: text(row, "created_at"),
    attemptCount: maybeNumber(row, "attempt_count") ?? 0,
    claimedAt: maybeText(row, "claimed_at") ?? null,
    deliveredAt: maybeText(row, "delivered_at") ?? null,
    lastError: maybeText(row, "last_error") ?? null,
  };
}

function jobRunFrom(row: Row): JobRun { return { id: text(row, "id"), organizationId: text(row, "organization_id"), jobType: text(row, "job_type"), slotKey: text(row, "slot_key"), status: text(row, "status") as JobRun["status"], startedAt: text(row, "started_at"), finishedAt: maybeText(row, "finished_at") ?? null, processedCount: maybeNumber(row, "processed_count") ?? 0, failedCount: maybeNumber(row, "failed_count") ?? 0, detailsJson: text(row, "details_json"), createdAt: text(row, "created_at") }; }

function vendorResponseFrom(row: Row): VendorResponse { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: text(row, "issuance_id"), response: text(row, "response") as VendorResponse["response"], responderName: text(row, "responder_name"), proposedAt: maybeText(row, "proposed_at"), message: maybeText(row, "message"), respondedAt: text(row, "responded_at") }; }
function vendorContinuationFrom(row: Row): VendorContinuation { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), vendorResponseId: text(row, "vendor_response_id"), action: text(row, "action") as VendorContinuation["action"], message: maybeText(row, "message"), createdByMembershipId: maybeText(row, "created_by_membership_id"), createdAt: text(row, "created_at") }; }
function serviceAppointmentFrom(row: Row): ServiceAppointment { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: maybeText(row, "issuance_id"), sourceVendorResponseId: maybeText(row, "source_vendor_response_id"), status: text(row, "status") as ServiceAppointment["status"], proposedBy: text(row, "proposed_by") as ServiceAppointment["proposedBy"], startsAt: text(row, "starts_at"), note: maybeText(row, "note"), createdByMembershipId: maybeText(row, "created_by_membership_id"), createdAt: text(row, "created_at") }; }

function savedViewFrom(row: Row): SavedView { return { id: text(row, "id"), organizationId: text(row, "organization_id"), ownerMembershipId: text(row, "owner_membership_id"), surface: text(row, "surface"), name: text(row, "name"), queryString: text(row, "query_string"), createdAt: text(row, "created_at") }; }

class D1OpsRepository implements OpsRepository {
  constructor(
    private readonly db: D1Database,
    readonly kind: "d1" | "postgres" = "d1",
  ) {}

  private async first(sql: string, params: readonly unknown[] = []) { return await this.db.prepare(sql).bind(...params).first<Row>(); }
  private async all(sql: string, params: readonly unknown[] = []) { const result = await this.db.prepare(sql).bind(...params).all<Row>(); return result.results ?? []; }

  async getOrganization(organizationId: OpsId) { const row = await this.first("SELECT id, name, slug, time_zone, work_order_prefix, created_at FROM ops_organizations WHERE id = ?", [organizationId]); return row ? { id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"), timeZone: text(row, "time_zone"), workOrderPrefix: text(row, "work_order_prefix"), createdAt: text(row, "created_at") } : null; }
  async getDivision(organizationId: OpsId, divisionId: OpsId) { const row = await this.first("SELECT * FROM ops_divisions WHERE organization_id = ? AND id = ?", [organizationId, divisionId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), code: text(row, "code"), name: text(row, "name"), createdAt: text(row, "created_at") } satisfies Division : null; }
  async getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId) { const row = await this.first("SELECT * FROM ops_taxonomy_nodes WHERE organization_id = ? AND id = ?", [organizationId, taxonomyNodeId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), parentNodeId: maybeText(row, "parent_node_id"), nodeKind: text(row, "node_kind") as TaxonomyNode["nodeKind"], canonicalKey: maybeText(row, "canonical_key"), name: text(row, "name"), aliases: jsonArray(row, "aliases_json"), depth: Number(row.depth), sortOrder: Number(row.sort_order), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies TaxonomyNode : null; }
  async listTaxonomyNodes(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_taxonomy_nodes WHERE organization_id = ? ORDER BY depth, sort_order, name, id", [organizationId]); return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), parentNodeId: maybeText(row, "parent_node_id"), nodeKind: text(row, "node_kind") as TaxonomyNode["nodeKind"], canonicalKey: maybeText(row, "canonical_key"), name: text(row, "name"), aliases: jsonArray(row, "aliases_json"), depth: Number(row.depth), sortOrder: Number(row.sort_order), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies TaxonomyNode)); }
  async getEquipmentTemplate(organizationId: OpsId, templateId: OpsId) { const row = await this.first("SELECT * FROM ops_equipment_templates WHERE organization_id = ? AND id = ?", [organizationId, templateId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), taxonomyNodeId: text(row, "taxonomy_node_id"), name: text(row, "name"), defaultExpectedLifeYears: maybeNumber(row, "default_expected_life_years"), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies EquipmentTemplate : null; }
  async listEquipmentTemplates(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_equipment_templates WHERE organization_id = ? ORDER BY taxonomy_node_id, name, id", [organizationId]); return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), taxonomyNodeId: text(row, "taxonomy_node_id"), name: text(row, "name"), defaultExpectedLifeYears: maybeNumber(row, "default_expected_life_years"), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies EquipmentTemplate)); }
  async listComponentTemplates(organizationId: OpsId, equipmentTemplateId: OpsId) { const rows = await this.all("SELECT * FROM ops_component_templates WHERE organization_id = ? AND equipment_template_id = ? ORDER BY sort_order, name, id", [organizationId, equipmentTemplateId]); return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), equipmentTemplateId: text(row, "equipment_template_id"), parentComponentTemplateId: maybeText(row, "parent_component_template_id"), name: text(row, "name"), sortOrder: Number(row.sort_order), createdAt: text(row, "created_at") } satisfies ComponentTemplate)); }
  async getStore(organizationId: OpsId, storeId: OpsId) { const row = await this.first("SELECT * FROM ops_stores WHERE organization_id = ? AND id = ?", [organizationId, storeId]); return row ? storeFrom(row) : null; }
  async getVendor(organizationId: OpsId, vendorId: OpsId) { const row = await this.first("SELECT * FROM ops_vendors WHERE organization_id = ? AND id = ?", [organizationId, vendorId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), code: text(row, "code"), name: text(row, "name"), dispatchEmail: text(row, "dispatch_email"), dispatchPhone: maybeText(row, "dispatch_phone"), status: text(row, "status") as Vendor["status"], preferred: bool(row, "preferred"), createdAt: text(row, "created_at") } : null; }
  async listVendorSpecialties(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_specialties WHERE organization_id = ? AND vendor_id = ? ORDER BY display_name, id", [organizationId, vendorId])).map(vendorSpecialtyFrom); }
  async listNotificationRules(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_notification_rules WHERE organization_id = ? ORDER BY event_key, recipient_role", [organizationId])).map(notificationRuleFrom); }
  async upsertNotificationRule(input: Parameters<OpsRepository["upsertNotificationRule"]>[0]) { await this.atomicWrite([{ sql: "INSERT INTO ops_notification_rules (id, organization_id, event_key, email_enabled, recipient_role, updated_by_membership_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (organization_id, event_key, recipient_role) DO UPDATE SET email_enabled = excluded.email_enabled, updated_by_membership_id = excluded.updated_by_membership_id, updated_at = excluded.updated_at", params: [input.id, input.organizationId, input.eventKey, input.emailEnabled ? 1 : 0, input.recipientRole, input.updatedByMembershipId ?? null, input.occurredAt, input.occurredAt] }]); }
  async listNotificationRecipients(organizationId: OpsId, role: NotificationRule["recipientRole"], scope?: { storeId: OpsId; regionId?: OpsId }): Promise<NotificationRecipient[]> {
    const params: unknown[] = [organizationId, role];
    let scopeFilter = "";
    if (scope) {
      params.push(organizationId, organizationId, scope.storeId);
      const regionFilter = scope.regionId ? " OR (sg.scope_kind = 'region' AND sg.scope_id = ?)" : "";
      if (scope.regionId) params.push(scope.regionId);
      scopeFilter = ` AND EXISTS (SELECT 1 FROM ops_scope_grants sg WHERE sg.organization_id = ? AND sg.membership_id = m.id AND ((sg.scope_kind = 'organization' AND sg.scope_id = ?) OR (sg.scope_kind = 'store' AND sg.scope_id = ?)${regionFilter}))`;
    }
    const rows = await this.all(`SELECT m.id AS membership_id, m.user_id, m.role, u.email, u.display_name FROM ops_memberships m JOIN ops_users u ON u.id = m.user_id WHERE m.organization_id = ? AND m.role = ? AND m.status = 'active' AND u.status = 'active'${scopeFilter} ORDER BY u.display_name, u.email`, params);
    return rows.map((row) => ({ membershipId: text(row, "membership_id"), userId: text(row, "user_id"), role: text(row, "role") as NotificationRecipient["role"], email: text(row, "email"), displayName: text(row, "display_name") }));
  }
  async getMembership(organizationId: OpsId, membershipId: OpsId) { const row = await this.first("SELECT * FROM ops_memberships WHERE organization_id = ? AND id = ?", [organizationId, membershipId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), userId: text(row, "user_id"), role: text(row, "role") as Membership["role"], status: text(row, "status") as Membership["status"], createdAt: text(row, "created_at") } : null; }
  async listScopeGrantsForMembership(organizationId: OpsId, membershipId: OpsId) { const rows = await this.all("SELECT * FROM ops_scope_grants WHERE organization_id = ? AND membership_id = ? ORDER BY scope_kind, scope_id, id", [organizationId, membershipId]); return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), membershipId: text(row, "membership_id"), scopeKind: text(row, "scope_kind") as ScopeGrant["scopeKind"], scopeId: text(row, "scope_id"), permission: text(row, "permission"), createdAt: text(row, "created_at") })); }
  async listRoleCapabilityOverrides(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_role_capability_overrides WHERE organization_id = ? ORDER BY role, capability", [organizationId])).map(roleCapabilityOverrideFrom); }
  async upsertRoleCapabilityOverride(input: Parameters<OpsRepository["upsertRoleCapabilityOverride"]>[0]) { await this.atomicWrite([{ sql: "INSERT INTO ops_role_capability_overrides (id, organization_id, role, capability, enabled, updated_by_membership_id, updated_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (organization_id, role, capability) DO UPDATE SET enabled = excluded.enabled, updated_by_membership_id = excluded.updated_by_membership_id, updated_by_name = excluded.updated_by_name, updated_at = excluded.updated_at", params: [input.id, input.organizationId, input.role, input.capability, input.enabled ? 1 : 0, input.updatedByMembershipId, input.updatedByName, input.occurredAt, input.occurredAt] }]); }
  async getActiveWorkflowPolicy(organizationId: OpsId) { const row = await this.first("SELECT * FROM ops_workflow_policies WHERE organization_id = ? AND status = 'active' ORDER BY version DESC LIMIT 1", [organizationId]); return row ? workflowPolicyFrom(row) : null; }
  async listWorkflowPolicies(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_workflow_policies WHERE organization_id = ? ORDER BY version DESC", [organizationId])).map(workflowPolicyFrom); }
  async getRequest(organizationId: OpsId, requestId: OpsId) { const row = await this.first("SELECT * FROM ops_requests WHERE organization_id = ? AND id = ?", [organizationId, requestId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), reference: text(row, "reference"), storeId: text(row, "store_id"), reporterName: text(row, "reporter_name"), reporterEmployeeId: maybeText(row, "reporter_employee_id"), problem: text(row, "problem"), priority: text(row, "priority") as ServiceRequest["priority"], status: text(row, "status") as ServiceRequest["status"], version: Number(row.version ?? 0), submittedAt: text(row, "submitted_at"), acknowledgedAt: maybeText(row, "acknowledged_at"), acknowledgedByActorType: maybeText(row, "acknowledged_by_actor_type") as ServiceRequest["acknowledgedByActorType"], acknowledgedByActorId: maybeText(row, "acknowledged_by_actor_id"), acknowledgedByActorName: maybeText(row, "acknowledged_by_actor_name"), linkedWorkOrderId: maybeText(row, "linked_work_order_id"), linkedAt: maybeText(row, "linked_at"), linkedByActorType: maybeText(row, "linked_by_actor_type") as ServiceRequest["linkedByActorType"], linkedByActorId: maybeText(row, "linked_by_actor_id"), linkedByActorName: maybeText(row, "linked_by_actor_name"), convertedWorkOrderId: maybeText(row, "converted_work_order_id") } : null; }
  async listRequestImpactAssessments(organizationId: OpsId, requestId: OpsId) { const rows = await this.all("SELECT * FROM ops_request_impact_assessments WHERE organization_id = ? AND request_id = ? ORDER BY assessed_at, id", [organizationId, requestId]); return rows.map(requestImpactAssessmentFrom); }
  async getWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_orders WHERE organization_id = ? AND id = ?", [organizationId, workOrderId]); return row ? workOrderFrom(row) : null; }
  async getWorkOrderVisitHold(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_visit_holds WHERE organization_id = ? AND work_order_id = ? LIMIT 1", [organizationId, workOrderId]); return row ? workOrderVisitHoldFrom(row) : null; }
  async listActiveWorkOrderVisitHoldsForStore(organizationId: OpsId, storeId: OpsId) { const rows = await this.all("SELECT h.* FROM ops_work_order_visit_holds h JOIN ops_work_orders w ON w.organization_id = h.organization_id AND w.id = h.work_order_id WHERE h.organization_id = ? AND w.store_id = ? AND h.status = 'active' ORDER BY h.deadline_at, h.id", [organizationId, storeId]); return rows.map(workOrderVisitHoldFrom); }
  async getApprovalPolicy(organizationId: OpsId, policyId: OpsId) { const row = await this.first("SELECT * FROM ops_approval_policies WHERE organization_id = ? AND id = ?", [organizationId, policyId]); return row ? approvalPolicyFrom(row) : null; }
  async listApprovalPolicies(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_approval_policies WHERE organization_id = ? ORDER BY policy_key, version DESC, id", [organizationId]); return rows.map(approvalPolicyFrom); }
  async getApprovalRequest(organizationId: OpsId, approvalRequestId: OpsId) { const row = await this.first("SELECT * FROM ops_approval_requests WHERE organization_id = ? AND id = ?", [organizationId, approvalRequestId]); return row ? approvalRequestFrom(row) : null; }
  async listApprovalRequests(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_approval_requests WHERE organization_id = ? ORDER BY requested_at DESC, id DESC", [organizationId]); return rows.map(approvalRequestFrom); }
  async listApprovalRequestsForSubject(organizationId: OpsId, subjectType: ApprovalRequest["subjectType"], subjectId: OpsId) { const rows = await this.all("SELECT * FROM ops_approval_requests WHERE organization_id = ? AND subject_type = ? AND subject_id = ? ORDER BY requested_at DESC, id DESC", [organizationId, subjectType, subjectId]); return rows.map(approvalRequestFrom); }
  async listApprovalDecisionsForRequest(organizationId: OpsId, approvalRequestId: OpsId) { const rows = await this.all("SELECT * FROM ops_approval_decisions WHERE organization_id = ? AND approval_request_id = ? ORDER BY decided_at DESC, id DESC", [organizationId, approvalRequestId]); return rows.map(approvalDecisionFrom); }
  async getAsset(organizationId: OpsId, assetId: OpsId) { const row = await this.first("SELECT * FROM ops_assets WHERE organization_id = ? AND id = ?", [organizationId, assetId]); if (!row) return null; const replacement = maybeNumber(row, "replacement_estimate_minor"); return { id: text(row, "id"), organizationId: text(row, "organization_id"), storeId: text(row, "store_id"), categoryKey: text(row, "category_key"), taxonomyNodeId: maybeText(row, "taxonomy_node_id"), equipmentTemplateId: maybeText(row, "equipment_template_id"), groupPath: jsonArray(row, "group_path_json"), assetTag: text(row, "asset_tag"), name: text(row, "name"), manufacturer: maybeText(row, "manufacturer"), model: maybeText(row, "model"), serialNumber: maybeText(row, "serial_number"), supplier: maybeText(row, "supplier"), installedAt: maybeText(row, "installed_at"), expectedLifeYears: maybeNumber(row, "expected_life_years"), warrantyEndsAt: maybeText(row, "warranty_ends_at"), replacementProfileId: maybeText(row, "replacement_profile_id"), replacementAttributes: jsonObject(row, "replacement_attributes_json"), replacementAdjustmentBps: maybeNumber(row, "replacement_adjustment_bps"), replacementPlanningExcludedAt: maybeText(row, "replacement_planning_excluded_at"), replacementPlanningExclusionReason: maybeText(row, "replacement_planning_exclusion_reason"), replacementEstimate: replacement == null ? undefined : { amountMinor: replacement, currency: text(row, "replacement_currency") || "USD" }, status: text(row, "status") as Asset["status"], retiredAt: maybeText(row, "retired_at"), replacedByAssetId: maybeText(row, "replaced_by_asset_id"), createdAt: text(row, "created_at") }; }
  async getReplacementProfile(organizationId: OpsId, profileId: OpsId) { const row = await this.first("SELECT * FROM ops_replacement_profiles WHERE organization_id = ? AND id = ?", [organizationId, profileId]); return row ? replacementProfileFrom(row) : null; }
  async listReplacementProfiles(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_replacement_profiles WHERE organization_id = ? ORDER BY category_key, name, id", [organizationId]); return rows.map(replacementProfileFrom); }
  async getPublishedReplacementBenchmark(organizationId: OpsId, profileId: OpsId) { const row = await this.first("SELECT * FROM ops_replacement_benchmarks WHERE organization_id = ? AND profile_id = ? AND status = 'published' ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1", [organizationId, profileId]); return row ? replacementBenchmarkFrom(row) : null; }
  async listReplacementBenchmarks(organizationId: OpsId, profileId: OpsId) { const rows = await this.all("SELECT * FROM ops_replacement_benchmarks WHERE organization_id = ? AND profile_id = ? ORDER BY effective_at DESC, created_at DESC, id DESC", [organizationId, profileId]); return rows.map(replacementBenchmarkFrom); }
  async getActiveAssetReplacementOverride(organizationId: OpsId, assetId: OpsId) { const row = await this.first("SELECT * FROM ops_asset_replacement_overrides WHERE organization_id = ? AND asset_id = ? AND status = 'active' ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1", [organizationId, assetId]); return row ? assetReplacementOverrideFrom(row) : null; }
  async getReplacementEventForProposal(organizationId: OpsId, proposalId: OpsId) { const row = await this.first("SELECT * FROM ops_replacement_events WHERE organization_id = ? AND source_estimate_proposal_id = ? LIMIT 1", [organizationId, proposalId]); return row ? replacementEventFrom(row) : null; }
  async getActiveReplacementEventForAsset(organizationId: OpsId, assetId: OpsId) { const row = await this.first("SELECT * FROM ops_replacement_events WHERE organization_id = ? AND asset_id = ? AND status = 'approved' ORDER BY approved_at DESC, id DESC LIMIT 1", [organizationId, assetId]); return row ? replacementEventFrom(row) : null; }
  async listLifecycleRecommendationsForAsset(organizationId: OpsId, assetId: OpsId) { return (await this.all("SELECT * FROM ops_lifecycle_recommendations WHERE organization_id = ? AND asset_id = ? ORDER BY version DESC, created_at DESC, id DESC", [organizationId, assetId])).map(lifecycleRecommendationFrom); }
  async listAssetsForReplacementProfile(organizationId: OpsId, profileId: OpsId): Promise<Asset[]> { const rows = await this.all("SELECT * FROM ops_assets WHERE organization_id = ? AND replacement_profile_id = ? ORDER BY store_id, asset_tag, id", [organizationId, profileId]); const assets: Asset[] = []; for (const row of rows) { const asset = await this.getAsset(organizationId, text(row, "id")); if (asset) assets.push(asset); } return assets; }
  async getComponent(organizationId: OpsId, componentId: OpsId) { const row = await this.first("SELECT * FROM ops_asset_components WHERE organization_id = ? AND id = ?", [organizationId, componentId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), assetId: text(row, "asset_id"), parentComponentId: maybeText(row, "parent_component_id"), name: text(row, "name"), partNumber: maybeText(row, "part_number"), serialNumber: maybeText(row, "serial_number"), installedAt: maybeText(row, "installed_at"), warrantyEndsAt: maybeText(row, "warranty_ends_at"), removedAt: maybeText(row, "removed_at"), replacedByComponentId: maybeText(row, "replaced_by_component_id"), createdAt: text(row, "created_at") } satisfies AssetComponent : null; }
  async getMaintenanceProgram(organizationId: OpsId, programId: OpsId) { const row = await this.first("SELECT * FROM ops_maintenance_programs WHERE organization_id = ? AND id = ?", [organizationId, programId]); return row ? maintenanceProgramFrom(row) : null; }
  async listMaintenancePrograms(organizationId: OpsId): Promise<MaintenanceProgram[]> { const rows = await this.all("SELECT * FROM ops_maintenance_programs WHERE organization_id = ? ORDER BY status, name, version DESC", [organizationId]); return rows.map(maintenanceProgramFrom); }
  async listAssetsForEquipmentTemplates(organizationId: OpsId, equipmentTemplateIds: OpsId[]): Promise<Asset[]> { if (!equipmentTemplateIds.length) return []; const rows = await this.all(`SELECT id FROM ops_assets WHERE organization_id = ? AND equipment_template_id IN (${equipmentTemplateIds.map(() => "?").join(",")}) AND status <> ? ORDER BY store_id, name, id`, [organizationId, ...equipmentTemplateIds, "retired"]); const assets: Asset[] = []; for (const row of rows) { const asset = await this.getAsset(organizationId, text(row, "id")); if (asset) assets.push(asset); } return assets; }
  async getPmPlan(organizationId: OpsId, planId: OpsId) { const row = await this.first("SELECT * FROM ops_pm_plans WHERE organization_id = ? AND id = ?", [organizationId, planId]); return row ? pmPlanFrom(row) : null; }
  async getPmOccurrence(organizationId: OpsId, occurrenceId: OpsId) { const row = await this.first("SELECT * FROM ops_pm_occurrences WHERE organization_id = ? AND id = ?", [organizationId, occurrenceId]); return row ? pmOccurrenceFrom(row) : null; }
  async listPmWorkItemsForOccurrence(organizationId: OpsId, occurrenceId: OpsId) { return (await this.all("SELECT * FROM ops_pm_work_items WHERE organization_id = ? AND occurrence_id = ? ORDER BY asset_id, id", [organizationId, occurrenceId])).map(pmWorkItemFrom); }
  async listVendorQualifications(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_qualifications WHERE organization_id = ? AND vendor_id = ? ORDER BY trade_key, id", [organizationId, vendorId])).map(vendorQualificationFrom); }
  async listVendorComplianceDocuments(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_compliance_documents WHERE organization_id = ? AND vendor_id = ? ORDER BY document_type, expires_at, id", [organizationId, vendorId])).map(vendorComplianceFrom); }
  async listVendorComplianceAlerts(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_compliance_alerts WHERE organization_id = ? AND vendor_id = ? ORDER BY created_at DESC, id DESC", [organizationId, vendorId])).map(vendorComplianceAlertFrom); }
  async getContractVersion(organizationId: OpsId, contractVersionId: OpsId) { const row = await this.first("SELECT * FROM ops_contract_versions WHERE organization_id = ? AND id = ?", [organizationId, contractVersionId]); return row ? contractVersionFrom(row) : null; }
  async listContractScopes(organizationId: OpsId, contractVersionId: OpsId) { return (await this.all("SELECT * FROM ops_contract_scopes WHERE organization_id = ? AND contract_version_id = ? ORDER BY scope_kind, scope_id, id", [organizationId, contractVersionId])).map(contractScopeFrom); }
  async listRateCardLines(organizationId: OpsId, contractVersionId: OpsId) { return (await this.all("SELECT * FROM ops_rate_card_lines WHERE organization_id = ? AND contract_version_id = ? ORDER BY charge_type, id", [organizationId, contractVersionId])).map(rateCardFrom); }
  async getSchedulingPolicy(organizationId: OpsId, contractVersionId: OpsId) { const row = await this.first("SELECT * FROM ops_scheduling_policies WHERE organization_id = ? AND contract_version_id = ? LIMIT 1", [organizationId, contractVersionId]); return row ? schedulingPolicyFrom(row) : null; }
  async listVendorCapacity(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_capacity WHERE organization_id = ? AND vendor_id = ? ORDER BY starts_at, id", [organizationId, vendorId])).map(vendorCapacityFrom); }
  async getServiceRun(organizationId: OpsId, serviceRunId: OpsId) { const row = await this.first("SELECT * FROM ops_service_runs WHERE organization_id = ? AND id = ?", [organizationId, serviceRunId]); return row ? serviceRunFrom(row) : null; }
  async listRouteStops(organizationId: OpsId, serviceRunId: OpsId) { return (await this.all("SELECT * FROM ops_route_stops WHERE organization_id = ? AND service_run_id = ? ORDER BY sequence, id", [organizationId, serviceRunId])).map(routeStopFrom); }
  async listServiceRunWorkOrders(organizationId: OpsId, serviceRunId: OpsId) { return (await this.all("SELECT * FROM ops_service_run_work_orders WHERE organization_id = ? AND service_run_id = ? ORDER BY route_stop_id, id", [organizationId, serviceRunId])).map(serviceRunWorkOrderFrom); }
  async listServiceRunResponses(organizationId: OpsId, serviceRunId: OpsId) { return (await this.all("SELECT * FROM ops_service_run_responses WHERE organization_id = ? AND service_run_id = ? ORDER BY responded_at, id", [organizationId, serviceRunId])).map(serviceRunResponseFrom); }
  async listVendorWarrantyProfiles(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_vendor_warranty_profiles WHERE organization_id = ? AND vendor_id = ? ORDER BY effective_starts_at DESC, id", [organizationId, vendorId])).map(warrantyProfileFrom); }
  async getVendorWarrantyProfile(organizationId: OpsId, profileId: OpsId) { const row=await this.first("SELECT * FROM ops_vendor_warranty_profiles WHERE organization_id = ? AND id = ?",[organizationId,profileId]);return row?warrantyProfileFrom(row):null; }
  async listWarrantyRules(organizationId: OpsId, vendorId: OpsId) { return (await this.all("SELECT * FROM ops_warranty_rules WHERE organization_id = ? AND vendor_id = ? ORDER BY priority, id", [organizationId, vendorId])).map(warrantyRuleFrom); }
  async listWarrantyCoverageLines(organizationId: OpsId, profileId: OpsId) { return (await this.all("SELECT * FROM ops_warranty_coverage_lines WHERE organization_id = ? AND (vendor_warranty_profile_id = ? OR warranty_rule_id IN (SELECT id FROM ops_warranty_rules WHERE organization_id = ? AND vendor_warranty_profile_id = ?)) ORDER BY coverage_type, id", [organizationId, profileId, organizationId, profileId])).map(warrantyCoverageFrom); }
  async getRepairItem(organizationId: OpsId, repairItemId: OpsId) { const row=await this.first("SELECT * FROM ops_repair_items WHERE organization_id = ? AND id = ?",[organizationId,repairItemId]); return row?repairItemFrom(row):null; }
  async listRepairItemsForAsset(organizationId: OpsId, assetId: OpsId) { return (await this.all("SELECT * FROM ops_repair_items WHERE organization_id = ? AND asset_id = ? ORDER BY completion_date DESC, id DESC",[organizationId,assetId])).map(repairItemFrom); }
  async listAppliedWarrantiesForRepair(organizationId: OpsId, repairItemId: OpsId) { return (await this.all("SELECT * FROM ops_applied_warranties WHERE organization_id = ? AND repair_item_id = ? ORDER BY coverage_type, id",[organizationId,repairItemId])).map(appliedWarrantyFrom); }
  async getAppliedWarranty(organizationId: OpsId, appliedWarrantyId: OpsId) { const row=await this.first("SELECT * FROM ops_applied_warranties WHERE organization_id=? AND id=?",[organizationId,appliedWarrantyId]); return row?appliedWarrantyFrom(row):null; }
  async listActiveAppliedWarrantiesForAsset(organizationId: OpsId, assetId: OpsId, onDate: string) { return (await this.all("SELECT aw.* FROM ops_applied_warranties aw JOIN ops_repair_items ri ON ri.organization_id=aw.organization_id AND ri.id=aw.repair_item_id WHERE aw.organization_id=? AND ri.asset_id=? AND aw.start_date<=? AND aw.end_date>=? ORDER BY aw.end_date,aw.id",[organizationId,assetId,onDate,onDate])).map(appliedWarrantyFrom); }
  async getWarrantyCase(organizationId: OpsId, warrantyCaseId: OpsId) { const row=await this.first("SELECT * FROM ops_warranty_cases WHERE organization_id=? AND id=?",[organizationId,warrantyCaseId]); return row?warrantyCaseFrom(row):null; }
  async listWarrantyCases(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_warranty_cases WHERE organization_id=? ORDER BY created_at DESC,id DESC",[organizationId])).map(warrantyCaseFrom); }
  async listQuotesForWorkOrder(organizationId:OpsId,workOrderId:OpsId){return(await this.all("SELECT * FROM ops_quotes WHERE organization_id=? AND work_order_id=? ORDER BY version DESC,submitted_at DESC,id DESC",[organizationId,workOrderId])).map(quoteFrom)}
  async listAuthorizationsForWorkOrder(organizationId:OpsId,workOrderId:OpsId){return(await this.all("SELECT * FROM ops_authorizations WHERE organization_id=? AND work_order_id=? ORDER BY authorized_at DESC,id DESC",[organizationId,workOrderId])).map(authorizationFrom)}
  async listAccountingInvoiceHistory(organizationId: OpsId, sourceId: OpsId): Promise<import("./types").AuditEvent[]> {
    return (await this.all("SELECT * FROM ops_audit_events WHERE organization_id = ? AND aggregate_type = ? AND aggregate_id = ? ORDER BY occurred_at DESC, id DESC LIMIT 50", [organizationId, "accounting_invoice_source", sourceId])).map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), aggregateType: text(row, "aggregate_type"), aggregateId: text(row, "aggregate_id"), eventType: text(row, "event_type"), actorType: text(row, "actor_type") as import("./types").ActorType, actorId: maybeText(row, "actor_id"), actorName: text(row, "actor_name"), occurredAt: text(row, "occurred_at"), payloadJson: text(row, "payload_json") }));
  }
  async listAccountingSourcesForInvoice(organizationId: OpsId, invoiceId: OpsId) { return (await this.all("SELECT * FROM ops_accounting_invoice_sources WHERE organization_id = ? AND invoice_id = ? ORDER BY updated_at DESC, id ASC LIMIT 100", [organizationId, invoiceId])).map(accountingSourceFrom); }
  async getAccountingInvoiceSource(organizationId: OpsId, id: OpsId) { const row = await this.first("SELECT * FROM ops_accounting_invoice_sources WHERE organization_id = ? AND id = ?", [organizationId, id]); return row ? accountingSourceFrom(row) : null; }
  async listAccountingInvoiceSources(organizationId: OpsId, limit: number, offset: number) { const rows = await this.all("SELECT * FROM ops_accounting_invoice_sources WHERE organization_id = ? ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?", [organizationId, Math.min(100, Math.max(1, limit)), Math.max(0, offset)]); return rows.map(accountingSourceFrom); }
  async getInvoice(organizationId: OpsId, invoiceId: OpsId) { const row=await this.first("SELECT * FROM ops_invoices WHERE organization_id=? AND id=?",[organizationId,invoiceId]); return row?invoiceFrom(row):null; }
  async findInvoicesByVendorReference(organizationId: OpsId, vendorId: OpsId, number: string) { return (await this.all("SELECT * FROM ops_invoices WHERE organization_id = ? AND vendor_id = ? AND vendor_invoice_number = ? ORDER BY id LIMIT 25", [organizationId, vendorId, number])).map(invoiceFrom); }
  async listInvoices(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_invoices WHERE organization_id=? ORDER BY invoice_date DESC,id DESC",[organizationId])).map(invoiceFrom); }
  async listInvoiceLines(organizationId: OpsId, invoiceId: OpsId) { return (await this.all("SELECT * FROM ops_invoice_lines WHERE organization_id=? AND invoice_id=? ORDER BY line_number,id",[organizationId,invoiceId])).map(invoiceLineFrom); }
  async listInvoiceLineAllocations(organizationId: OpsId, invoiceLineId: OpsId) { return (await this.all("SELECT * FROM ops_invoice_line_allocations WHERE organization_id=? AND invoice_line_id=? ORDER BY id",[organizationId,invoiceLineId])).map(invoiceAllocationFrom); }
  async listInvoiceExceptions(organizationId: OpsId, invoiceId: OpsId) { return (await this.all("SELECT * FROM ops_invoice_exceptions WHERE organization_id=? AND invoice_id=? ORDER BY detected_at,id",[organizationId,invoiceId])).map(invoiceExceptionFrom); }
  async listInvoiceAdjustments(organizationId: OpsId, invoiceId: OpsId) { return (await this.all("SELECT * FROM ops_invoice_adjustments WHERE organization_id=? AND invoice_id=? ORDER BY created_at,id",[organizationId,invoiceId])).map(invoiceAdjustmentFrom); }
  async listValueEvents(organizationId: OpsId) { return (await this.all("SELECT * FROM ops_value_events WHERE organization_id=? ORDER BY occurred_at DESC,id DESC",[organizationId])).map(valueEventFrom); }
  async listServiceRunsForStoreVendor(organizationId: OpsId, storeId: OpsId, vendorId: OpsId) { return (await this.all("SELECT DISTINCT r.* FROM ops_service_runs r JOIN ops_route_stops s ON s.organization_id = r.organization_id AND s.service_run_id = r.id WHERE r.organization_id = ? AND s.store_id = ? AND r.vendor_id = ? ORDER BY r.proposed_starts_at, r.id", [organizationId, storeId, vendorId])).map(serviceRunFrom); }
  async getRouteStopForVisit(organizationId: OpsId, visitId: OpsId) { const row = await this.first("SELECT * FROM ops_route_stops WHERE organization_id = ? AND site_visit_id = ? LIMIT 1", [organizationId, visitId]); return row ? routeStopFrom(row) : null; }
  async getAssignment(organizationId: OpsId, assignmentId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND id = ?", [organizationId, assignmentId]); return row ? assignmentFrom(row) : null; }
  async getIssuance(organizationId: OpsId, issuanceId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND id = ?", [organizationId, issuanceId]); return row ? issuanceFrom(row) : null; }
  async getEstimateRequest(organizationId: OpsId, estimateRequestId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_estimate_requests WHERE organization_id = ? AND id = ? LIMIT 1", [organizationId, estimateRequestId]); return row ? estimateRequestFrom(row) : null; }
  async getLatestEstimateProposal(organizationId: OpsId, estimateRequestId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_estimate_proposals WHERE organization_id = ? AND request_id = ? ORDER BY revision DESC, submitted_at DESC, id DESC LIMIT 1", [organizationId, estimateRequestId]); return row ? estimateProposalFrom(row) : null; }
  async listEstimateProposalsForRequest(organizationId: OpsId, estimateRequestId: OpsId) { const rows = await this.all("SELECT * FROM ops_vendor_estimate_proposals WHERE organization_id = ? AND request_id = ? ORDER BY revision DESC, submitted_at DESC, id DESC", [organizationId, estimateRequestId]); return rows.map(estimateProposalFrom); }
  async listEstimateRequestsForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_work_order_estimate_requests WHERE organization_id = ? AND work_order_id = ? ORDER BY requested_at DESC, id DESC", [organizationId, workOrderId]); return rows.map(estimateRequestFrom); }
  async getVisit(organizationId: OpsId, visitId: OpsId) { const row = await this.first("SELECT * FROM ops_visit_sessions WHERE organization_id = ? AND id = ?", [organizationId, visitId]); return row ? visitFrom(row) : null; }
  async getSiteVisitWorkOrderById(organizationId: OpsId, siteVisitWorkOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_site_visit_work_orders WHERE organization_id = ? AND id = ? LIMIT 1", [organizationId, siteVisitWorkOrderId]); return row ? siteVisitWorkOrderFrom(row) : null; }
  async getSiteVisitWorkOrder(organizationId: OpsId, visitId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_site_visit_work_orders WHERE organization_id = ? AND visit_id = ? AND work_order_id = ? LIMIT 1", [organizationId, visitId, workOrderId]); return row ? siteVisitWorkOrderFrom(row) : null; }
  async listSiteVisitWorkOrders(organizationId: OpsId, visitId: OpsId) { const rows = await this.all("SELECT * FROM ops_site_visit_work_orders WHERE organization_id = ? AND visit_id = ? ORDER BY ordinal, id", [organizationId, visitId]); return rows.map(siteVisitWorkOrderFrom); }
  async listSiteVisitWorkOrdersForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_site_visit_work_orders WHERE organization_id = ? AND work_order_id = ? ORDER BY linked_at DESC, id DESC", [organizationId, workOrderId]); return rows.map(siteVisitWorkOrderFrom); }
  async listWorkOrderVerifications(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_work_order_verifications WHERE organization_id = ? AND work_order_id = ? ORDER BY cycle, decided_at, id", [organizationId, workOrderId]); return rows.map(workOrderVerificationFrom); }
  async getFollowUp(organizationId: OpsId, followUpId: OpsId) { const row = await this.first("SELECT * FROM ops_follow_ups WHERE organization_id = ? AND id = ?", [organizationId, followUpId]); return row ? followUpFrom(row) : null; }
  async getVendorReminder(organizationId: OpsId, reminderId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_reminders WHERE organization_id = ? AND id = ?", [organizationId, reminderId]); return row ? vendorReminderFrom(row) : null; }
  async listVendorReminders(organizationId: OpsId, vendorId: OpsId) { const rows = await this.all("SELECT * FROM ops_vendor_reminders WHERE organization_id = ? AND vendor_id = ? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, due_at, created_at, id", [organizationId, vendorId]); return rows.map(vendorReminderFrom); }
  async getWorkflowTask(organizationId: OpsId, workflowTaskId: OpsId) { const row = await this.first("SELECT * FROM ops_workflow_tasks WHERE organization_id = ? AND id = ?", [organizationId, workflowTaskId]); return row ? workflowTaskFrom(row) : null; }
  async listWorkflowTasksForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_workflow_tasks WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at, id", [organizationId, workOrderId]); return rows.map(workflowTaskFrom); }
  async listWorkflowTasksForRequest(organizationId: OpsId, requestId: OpsId) { const rows = await this.all("SELECT * FROM ops_workflow_tasks WHERE organization_id = ? AND service_request_id = ? ORDER BY created_at, id", [organizationId, requestId]); return rows.map(workflowTaskFrom); }
  async listWorkflowTaskSlaPauses(organizationId: OpsId, workflowTaskId: OpsId) { const rows = await this.all("SELECT * FROM ops_workflow_task_sla_pauses WHERE organization_id = ? AND workflow_task_id = ? ORDER BY paused_at, id", [organizationId, workflowTaskId]); return rows.map(workflowTaskSlaPauseFrom); }
  async listWorkflowTaskSlaResumes(organizationId: OpsId, workflowTaskId: OpsId) { const rows = await this.all("SELECT * FROM ops_workflow_task_sla_resumes WHERE organization_id = ? AND workflow_task_id = ? ORDER BY resumed_at, id", [organizationId, workflowTaskId]); return rows.map(workflowTaskSlaResumeFrom); }
  async getActiveWorkflowTaskSlaPause(organizationId: OpsId, workflowTaskId: OpsId) { const row = await this.first("SELECT p.* FROM ops_workflow_task_sla_pauses p LEFT JOIN ops_workflow_task_sla_resumes r ON r.organization_id = p.organization_id AND r.pause_id = p.id WHERE p.organization_id = ? AND p.workflow_task_id = ? AND r.id IS NULL ORDER BY p.paused_at DESC, p.id DESC LIMIT 1", [organizationId, workflowTaskId]); return row ? workflowTaskSlaPauseFrom(row) : null; }
  async getException(organizationId: OpsId, exceptionId: OpsId) { const row = await this.first("SELECT * FROM ops_exceptions WHERE organization_id = ? AND id = ?", [organizationId, exceptionId]); return row ? exceptionFrom(row) : null; }
  async getIdempotencyKey(organizationId: OpsId, key: string): Promise<IdempotencyKey | null> { const row = await this.first("SELECT * FROM ops_idempotency_keys WHERE organization_id = ? AND key = ? LIMIT 1", [organizationId, key]); return row ? { organizationId: text(row, "organization_id"), key: text(row, "key"), command: text(row, "command"), resultId: text(row, "result_id"), requestHash: text(row, "request_hash"), createdAt: text(row, "created_at"), expiresAt: text(row, "expires_at") } : null; }
  async listFilesForEntity(organizationId: OpsId, entityType: string, entityId: OpsId, visibility?: "vendor_shared"): Promise<StoredFile[]> {
    const rows = await this.all("SELECT f.* FROM ops_files f JOIN ops_entity_files e ON e.organization_id = f.organization_id AND e.file_id = f.id WHERE f.organization_id = ? AND e.entity_type = ? AND e.entity_id = ? AND f.status = 'available'" + (visibility ? " AND e.visibility = ?" : "") + " ORDER BY f.created_at, f.id", [organizationId, entityType, entityId, ...(visibility ? [visibility] : [])]);
    return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), storageKey: text(row, "storage_key"), sha256: text(row, "sha256"), originalName: text(row, "original_name"), contentType: text(row, "content_type"), byteLength: Number(row.byte_length), status: "available" as const, createdAt: text(row, "created_at") }));
  }
  async getStoredFileByStorageKey(organizationId: OpsId, storageKey: string): Promise<StoredFile | null> { const row = await this.first("SELECT * FROM ops_files WHERE organization_id = ? AND storage_key = ? LIMIT 1", [organizationId, storageKey]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), storageKey: text(row, "storage_key"), sha256: text(row, "sha256"), originalName: text(row, "original_name"), contentType: text(row, "content_type"), byteLength: Number(row.byte_length), status: text(row, "status") as StoredFile["status"], createdAt: text(row, "created_at") } : null; }
  async getActiveAssignment(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND status NOT IN ('cancelled','declined','completed','superseded') ORDER BY assigned_at DESC, id DESC LIMIT 1", [organizationId, workOrderId]); return row ? assignmentFrom(row) : null; }
  async getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND work_order_id = ? ORDER BY revision DESC LIMIT 1", [organizationId, workOrderId]); return row ? issuanceFrom(row) : null; }
  async listIssuancesForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND work_order_id = ? ORDER BY revision, id", [organizationId, workOrderId]); return rows.map(issuanceFrom); }
  async getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id = ? AND assignment_id = ? ORDER BY responded_at DESC, id DESC LIMIT 1", [organizationId, assignmentId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: text(row, "issuance_id"), response: text(row, "response") as VendorResponse["response"], responderName: text(row, "responder_name"), proposedAt: maybeText(row, "proposed_at"), message: maybeText(row, "message"), respondedAt: text(row, "responded_at") } : null; }
  async getLatestVendorResponseForIssuance(organizationId: OpsId, issuanceId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id = ? AND issuance_id = ? ORDER BY responded_at DESC, id DESC LIMIT 1", [organizationId, issuanceId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: text(row, "issuance_id"), response: text(row, "response") as VendorResponse["response"], responderName: text(row, "responder_name"), proposedAt: maybeText(row, "proposed_at"), message: maybeText(row, "message"), respondedAt: text(row, "responded_at") } : null; }
  async getVendorResponse(organizationId: OpsId, vendorResponseId: OpsId): Promise<VendorResponse | null> { const row = await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id = ? AND id = ?", [organizationId, vendorResponseId]); return row ? vendorResponseFrom(row) : null; }
  async getServiceAppointment(organizationId: OpsId, appointmentId: OpsId): Promise<ServiceAppointment | null> { const row = await this.first("SELECT * FROM ops_service_appointments WHERE organization_id = ? AND id = ?", [organizationId, appointmentId]); return row ? serviceAppointmentFrom(row) : null; }
  async listServiceAppointmentsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<ServiceAppointment[]> { const rows = await this.all("SELECT * FROM ops_service_appointments WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at DESC, id DESC", [organizationId, workOrderId]); return rows.map(serviceAppointmentFrom); }
  async listVendorContinuationsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<VendorContinuation[]> { const rows = await this.all("SELECT * FROM ops_vendor_continuations WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at DESC, id DESC", [organizationId, workOrderId]); return rows.map(vendorContinuationFrom); }
  async findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND vendor_id = ? AND status IN ('issued','opened','accepted') ORDER BY assigned_at DESC LIMIT 1", [organizationId, workOrderId, vendorId]); return row ? assignmentFrom(row) : null; }
  async findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND internal_membership_id = ? AND status NOT IN ('cancelled','declined','completed','superseded') ORDER BY assigned_at DESC LIMIT 1", [organizationId, workOrderId, membershipId]); return row ? assignmentFrom(row) : null; }
  async vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId) { const row = await this.first("SELECT 1 AS allowed FROM ops_stores s JOIN ops_vendor_coverage c ON c.organization_id = s.organization_id AND c.vendor_id = ? AND (c.scope_kind = 'organization' AND c.scope_id = s.organization_id OR c.scope_kind = 'region' AND c.scope_id = s.region_id OR c.scope_kind = 'store' AND c.scope_id = s.id) WHERE s.organization_id = ? AND s.id = ? LIMIT 1", [vendorId, organizationId, storeId]); return Boolean(row); }
  async findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }) { const row = await this.first("SELECT * FROM ops_visit_sessions WHERE organization_id = ? AND store_id = ? AND status = 'active' AND COALESCE(vendor_id,'') = ? AND COALESCE(internal_membership_id,'') = ? AND lower(technician_name) = lower(?) LIMIT 1", [organizationId, storeId, provider.vendorId ?? "", provider.internalMembershipId ?? "", provider.technicianName]); return row ? visitFrom(row) : null; }
  async listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]> { const rows = await this.all(`SELECT v.*, w.number AS work_order_number FROM ops_visit_sessions v LEFT JOIN ops_work_orders w ON w.organization_id = v.organization_id AND w.id = v.work_order_id WHERE v.organization_id = ? AND v.store_id = ? AND v.status = 'active' ORDER BY v.checked_in_at, v.id`, [organizationId, storeId]); return rows.map((row) => ({ id: text(row, "id"), providerKind: text(row, "provider_kind") as TrustedStoreActiveVisitRow["providerKind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), providerName: text(row, "provider_name"), technicianName: text(row, "technician_name"), workOrderId: maybeText(row, "work_order_id"), workOrderNumber: maybeText(row, "work_order_number"), unmatchedReason: maybeText(row, "unmatched_reason"), purpose: text(row, "purpose"), checkedInAt: text(row, "checked_in_at"), startedChannel: text(row, "started_channel") as TrustedStoreActiveVisitRow["startedChannel"] })); }
  async allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number) { const row = await this.first("INSERT INTO ops_work_order_counters (organization_id, counter_year, next_value) VALUES (?, ?, 2) ON CONFLICT(organization_id, counter_year) DO UPDATE SET next_value = next_value + 1 RETURNING next_value - 1 AS allocated", [organizationId, year]); if (!row) throw new Error("Unable to allocate work-order number"); return `${prefix}-${year}-${String(Number(row.allocated)).padStart(4, "0")}`; }

  async searchStores(scope: OrganizationScope, search: string, request: PageRequest = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    const query = search.trim().toLocaleLowerCase("en-US");
    if (query) {
      clauses.push("s.search_text LIKE ?");
      params.push(`%${query}%`);
    }
    addKeysetCursor(clauses, params, request.cursor, "s.store_number", "s.id", "asc");
    const max = limit(request.limit);
    params.push(max + 1, offset(request.offset));
    const rows = await this.all(`SELECT s.*, r.name AS region_name,
      (SELECT COUNT(*) FROM ops_work_orders w WHERE w.organization_id = s.organization_id AND w.store_id = s.id AND w.status NOT IN ('closed','cancelled')) AS open_work_count,
      (SELECT COUNT(*) FROM ops_visit_sessions v WHERE v.organization_id = s.organization_id AND v.store_id = s.id AND v.status = 'active') AS active_visit_count,
      (SELECT COALESCE(SUM(c.amount_minor),0) FROM ops_cost_lines c JOIN ops_work_orders cw ON cw.organization_id = c.organization_id AND cw.id = c.work_order_id WHERE c.organization_id = s.organization_id AND cw.store_id = s.id) AS recorded_cost_minor
      FROM ops_stores s LEFT JOIN ops_regions r ON r.organization_id = s.organization_id AND r.id = s.region_id
      WHERE ${clauses.join(" AND ")} ORDER BY s.store_number, s.id LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): StoreSearchRow => ({ id: text(row, "id"), storeNumber: text(row, "store_number"), name: text(row, "name"), regionName: maybeText(row, "region_name"), formattedAddress: formatAddress(storeFrom(row)), openWorkCount: Number(row.open_work_count ?? 0), activeVisitCount: Number(row.active_visit_count ?? 0), recordedCostMinor: Number(row.recorded_cost_minor ?? 0), currency: "USD" }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "store_number"), text(last, "id")) : undefined };
  }

  async searchAssets(scope: OrganizationScope, search: string, request: PageRequest = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    const query = search.trim().toLocaleLowerCase("en-US");
    if (query) {
      clauses.push("lower(a.asset_tag || ' ' || a.name || ' ' || a.category_key || ' ' || COALESCE(a.manufacturer,'') || ' ' || COALESCE(a.model,'') || ' ' || COALESCE(a.serial_number,'') || ' ' || s.store_number || ' ' || s.name) LIKE ?");
      params.push(`%${query}%`);
    }
    addKeysetCursor(clauses, params, request.cursor, "a.asset_tag", "a.id", "asc");
    const max = limit(request.limit);
    params.push(max + 1, offset(request.offset));
    const rows = await this.all(`SELECT a.*, s.store_number, s.name AS store_name
      FROM ops_assets a JOIN ops_stores s ON s.organization_id = a.organization_id AND s.id = a.store_id
      WHERE ${clauses.join(" AND ")} ORDER BY a.asset_tag, a.id LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): AssetSearchRow => ({
      id: text(row, "id"),
      storeId: text(row, "store_id"),
      storeNumber: text(row, "store_number"),
      storeName: text(row, "store_name"),
      assetTag: text(row, "asset_tag"),
      name: text(row, "name"),
      categoryKey: text(row, "category_key"),
      groupPath: jsonArray(row, "group_path_json"),
      manufacturer: maybeText(row, "manufacturer"),
      model: maybeText(row, "model"),
      serialNumber: maybeText(row, "serial_number"),
      status: text(row, "status"),
    }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "asset_tag"), text(last, "id")) : undefined };
  }

  private async workOrderRows(scope: OrganizationScope, query: WorkOrderListQuery & { workOrderId?: OpsId; assetId?: OpsId; unbounded?: boolean } = {}) {
    const params: unknown[] = []; const storeScope = scopeWhere(scope, "s", params); const clauses = [storeScope];
    if (query.storeId) { clauses.push("w.store_id = ?"); params.push(query.storeId); }
    if (query.regionId) { clauses.push("s.region_id = ?"); params.push(query.regionId); }
    if (query.vendorId) { clauses.push("a.vendor_id = ?"); params.push(query.vendorId); }
    if (query.categoryKey === "unclassified") clauses.push("w.category_key IS NULL");
    else if (query.categoryKey) { clauses.push("w.category_key = ?"); params.push(query.categoryKey); }
    if (query.categoryPath?.length) {
      const pathConditions = query.categoryPath.map((segment, index) => {
        const category = "lower(replace(wa.category_key, '_', ' '))";
        const groupIncludesCategory = `lower(json_extract(wa.group_path_json, '$[0]')) = ${category}`;
        const fallback = index === 0 ? category : `json_extract(wa.group_path_json, '$[${index - 1}]')`;
        const value = `CASE WHEN ${groupIncludesCategory} THEN json_extract(wa.group_path_json, '$[${index}]') ELSE ${fallback} END`;
        params.push(index === 0 ? segment.toLocaleLowerCase("en-US") : segment);
        return `${index === 0 ? `lower(${value})` : value} = ?`;
      });
      clauses.push(`EXISTS (SELECT 1 FROM ops_assets wa WHERE wa.organization_id = w.organization_id AND wa.id = w.asset_id AND ${pathConditions.join(" AND ")})`);
    }
    if (query.assetId === "unlinked") clauses.push("w.asset_id IS NULL");
    else if (query.assetId) { clauses.push("w.asset_id = ?"); params.push(query.assetId); }
    if (query.componentId === "unlinked") clauses.push("w.component_id IS NULL");
    else if (query.componentId) { clauses.push("w.component_id = ?"); params.push(query.componentId); }
    if (hasWorkCostFilter(query)) {
      const cost = workCostSql("fc", query);
      clauses.push(`EXISTS (SELECT 1 FROM ops_cost_lines fc WHERE fc.organization_id = w.organization_id AND fc.work_order_id = w.id${cost.sql})`);
      params.push(...cost.params);
    }
    if (query.statuses?.length) { clauses.push(`w.status IN (${query.statuses.map(() => "?").join(",")})`); params.push(...query.statuses); }
    if (query.priorities?.length) { clauses.push(`w.priority IN (${query.priorities.map(() => "?").join(",")})`); params.push(...query.priorities); }
    if (query.createdFrom) { clauses.push("w.created_at >= ?"); params.push(query.createdFrom); }
    if (query.createdTo) { clauses.push("w.created_at < ?"); params.push(query.createdTo); }
    if (query.heldOnly) clauses.push("w.status = 'approved' AND EXISTS (SELECT 1 FROM ops_work_order_visit_holds hw WHERE hw.organization_id = w.organization_id AND hw.work_order_id = w.id AND hw.status = 'active')");
    if (query.heldStoreGroup === "multiple") clauses.push("(SELECT COUNT(*) FROM ops_work_order_visit_holds hg JOIN ops_work_orders gw ON gw.organization_id = hg.organization_id AND gw.id = hg.work_order_id WHERE hg.organization_id = w.organization_id AND gw.store_id = w.store_id AND gw.status = 'approved' AND hg.status = 'active') >= 2");
    if (query.upcomingAppointmentAfter) { clauses.push("EXISTS (SELECT 1 FROM ops_service_appointments ua WHERE ua.organization_id = w.organization_id AND ua.work_order_id = w.id AND ua.status = 'confirmed' AND ua.starts_at >= ?)"); params.push(query.upcomingAppointmentAfter); }
    if (query.heldReviewDeadlineTo) { clauses.push("h.deadline_at <= ?"); params.push(query.heldReviewDeadlineTo); }
    if (query.heldConfirmedOpportunityAfter) {
      clauses.push(`EXISTS (SELECT 1 FROM ops_service_appointments hap
        JOIN ops_work_orders haw ON haw.organization_id = hap.organization_id AND haw.id = hap.work_order_id
        JOIN ops_work_order_assignments haa ON haa.organization_id = hap.organization_id AND haa.id = hap.assignment_id
        JOIN ops_vendors hav ON hav.organization_id = haa.organization_id AND hav.id = haa.vendor_id
        WHERE hap.organization_id = w.organization_id AND hap.status = 'confirmed' AND hap.starts_at >= ? AND hap.starts_at <= h.deadline_at
          AND haw.id <> w.id AND haw.store_id = w.store_id AND haw.category_key = w.category_key AND haw.status = 'scheduled'
          AND haa.kind = 'outside_vendor' AND haa.status = 'accepted' AND hav.status = 'approved'
          AND haa.id = (SELECT ca.id FROM ops_work_order_assignments ca WHERE ca.organization_id = haw.organization_id AND ca.work_order_id = haw.id ORDER BY ca.assigned_at DESC, ca.id DESC LIMIT 1)
          AND EXISTS (SELECT 1 FROM ops_vendor_coverage hvc WHERE hvc.organization_id = w.organization_id AND hvc.vendor_id = hav.id AND (hvc.scope_kind = 'organization' AND hvc.scope_id = w.organization_id OR hvc.scope_kind = 'store' AND hvc.scope_id = w.store_id OR hvc.scope_kind = 'region' AND hvc.scope_id = s.region_id))
          AND (EXISTS (SELECT 1 FROM ops_vendor_specialties hvs WHERE hvs.organization_id = w.organization_id AND hvs.vendor_id = hav.id AND lower(hvs.canonical_key) = lower(w.category_key)) OR EXISTS (SELECT 1 FROM ops_vendor_qualifications hvq WHERE hvq.organization_id = w.organization_id AND hvq.vendor_id = hav.id AND hvq.status = 'active' AND (hvq.expires_at IS NULL OR hvq.expires_at > ?) AND (hvq.store_id IS NULL OR hvq.store_id = w.store_id) AND (hvq.region_id IS NULL OR hvq.region_id = s.region_id) AND lower(w.category_key) IN (lower(hvq.trade_key), lower(COALESCE(hvq.work_type,'')), lower(COALESCE(hvq.service_type,'')), lower(COALESCE(hvq.asset_type,'')), lower(COALESCE(hvq.component_type,'')))))
          AND NOT EXISTS (SELECT 1 FROM ops_vendor_compliance_documents hvd WHERE hvd.organization_id = w.organization_id AND hvd.vendor_id = hav.id AND hvd.blocking = 1 AND NOT EXISTS (SELECT 1 FROM ops_vendor_compliance_documents hva WHERE hva.organization_id = hvd.organization_id AND hva.vendor_id = hvd.vendor_id AND hva.document_type = hvd.document_type AND hva.review_status = 'approved' AND (hva.expires_at IS NULL OR hva.expires_at > ?))))`);
      params.push(query.heldConfirmedOpportunityAfter, query.heldConfirmedOpportunityAfter, query.heldConfirmedOpportunityAfter);
    }
    if (query.search?.trim()) { clauses.push("lower(w.number || ' ' || w.problem || ' ' || s.store_number || ' ' || s.name || ' ' || COALESCE(v.name,'')) LIKE ?"); params.push(`%${query.search.trim().toLocaleLowerCase("en-US")}%`); }
    if (query.workOrderId) { clauses.push("w.id = ?"); params.push(query.workOrderId); }
    addKeysetCursor(clauses, params, query.cursor, "w.created_at", "w.id", "desc");
    if (!query.unbounded) params.push(limit(query.limit) + 1, offset(query.offset));
    const costSum = workCostSql("c", query);
    return await this.all(`SELECT w.*, s.store_number, s.name AS store_name, a.kind AS assignment_kind, a.status AS assignment_status, a.vendor_id, v.name AS vendor_name,
      h.posture AS visit_hold_posture, h.deadline_at AS visit_hold_deadline_at,
      (SELECT COUNT(DISTINCT svwo.visit_id) FROM ops_site_visit_work_orders svwo WHERE svwo.organization_id = w.organization_id AND svwo.work_order_id = w.id) AS visit_count,
      (SELECT COALESCE(SUM(c.amount_minor),0) FROM ops_cost_lines c WHERE c.organization_id = w.organization_id AND c.work_order_id = w.id${costSum.sql}) AS recorded_cost_minor
      FROM ops_work_orders w JOIN ops_stores s ON s.organization_id = w.organization_id AND s.id = w.store_id
      LEFT JOIN ops_work_order_assignments a ON a.id = (SELECT aa.id FROM ops_work_order_assignments aa WHERE aa.organization_id = w.organization_id AND aa.work_order_id = w.id ORDER BY aa.assigned_at DESC, aa.id DESC LIMIT 1)
      LEFT JOIN ops_vendors v ON v.organization_id = w.organization_id AND v.id = a.vendor_id
      LEFT JOIN ops_work_order_visit_holds h ON h.id = (SELECT hh.id FROM ops_work_order_visit_holds hh WHERE hh.organization_id = w.organization_id AND hh.work_order_id = w.id AND hh.status = 'active' ORDER BY hh.created_at DESC, hh.id DESC LIMIT 1)
      WHERE ${clauses.join(" AND ")} ORDER BY w.created_at DESC, w.id DESC ${query.unbounded ? "" : "LIMIT ? OFFSET ?"}`, [...costSum.params, ...params]);
  }

  private workListRow(row: Row): WorkOrderListRow { return { id: text(row, "id"), number: text(row, "number"), storeId: text(row, "store_id"), storeNumber: text(row, "store_number"), storeName: text(row, "store_name"), problem: text(row, "problem"), categoryKey: maybeText(row, "category_key"), priority: text(row, "priority") as WorkOrderListRow["priority"], status: text(row, "status") as WorkOrderListRow["status"], assignmentKind: (maybeText(row, "assignment_kind") ?? "choose_later") as WorkOrderListRow["assignmentKind"], assignmentStatus: maybeText(row, "assignment_status") as WorkOrderListRow["assignmentStatus"], vendorId: maybeText(row, "vendor_id"), vendorName: maybeText(row, "vendor_name"), internalAccountableParty: maybeText(row, "internal_accountable_party") ?? "Facilities coordinator", accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: maybeText(row, "due_at"), createdAt: text(row, "created_at"), visitCount: Number(row.visit_count ?? 0), recordedCostMinor: Number(row.recorded_cost_minor ?? 0), currency: "USD", visitHoldPosture: maybeText(row, "visit_hold_posture") as WorkOrderListRow["visitHoldPosture"], visitHoldDeadlineAt: maybeText(row, "visit_hold_deadline_at") }; }

  async listWorkOrders(scope: OrganizationScope, query: WorkOrderListQuery = {}) { const rows = await this.workOrderRows(scope, query); const max = limit(query.limit); const visibleRows = rows.slice(0, max); const items = visibleRows.map((row) => ({ ...this.workListRow(row), currency: query.currency ?? "USD" })); const last = visibleRows.at(-1); return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "created_at"), text(last, "id")) : undefined }; }

  async getHeldWorkPortfolioSummary(scope: OrganizationScope) {
    const params: unknown[] = [];
    const scopedStores = scopeWhere(scope, "s", params);
    const rows = await this.all(`SELECT w.store_id, COUNT(*) AS approved_count
      FROM ops_work_order_visit_holds h
      JOIN ops_work_orders w ON w.organization_id = h.organization_id AND w.id = h.work_order_id
      JOIN ops_stores s ON s.organization_id = w.organization_id AND s.id = w.store_id
      WHERE ${scopedStores} AND h.status = 'active' AND w.status = 'approved'
      GROUP BY w.store_id`, params);
    const counts = rows.map((row) => Number(row.approved_count ?? 0));
    return { approvedWorkOrders: counts.reduce((sum, count) => sum + count, 0), storesWithApprovedWork: counts.length, storesWithMultipleApprovedJobs: counts.filter((count) => count >= 2).length };
  }

  async getVisitPortfolioSummary(scope: OrganizationScope, query: { storeId?: OpsId; vendorId?: OpsId; now: string }) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    if (query.storeId) { clauses.push("v.store_id = ?"); params.push(query.storeId); }
    if (query.vendorId) { clauses.push("v.vendor_id = ?"); params.push(query.vendorId); }
    const visit = await this.first(`SELECT
      SUM(CASE WHEN v.status = 'active' THEN 1 ELSE 0 END) AS active_count,
      SUM(CASE WHEN v.status <> 'active' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN (v.work_order_id IS NULL AND NOT EXISTS (SELECT 1 FROM ops_site_visit_work_orders sw WHERE sw.organization_id = v.organization_id AND sw.visit_id = v.id)) OR EXISTS (SELECT 1 FROM ops_exceptions e WHERE e.organization_id = v.organization_id AND e.visit_id = v.id AND e.status <> 'resolved') THEN 1 ELSE 0 END) AS review_count,
      SUM(CASE WHEN v.work_order_id IS NULL AND NOT EXISTS (SELECT 1 FROM ops_site_visit_work_orders sw WHERE sw.organization_id = v.organization_id AND sw.visit_id = v.id) THEN 1 ELSE 0 END) AS no_work_count
      FROM ops_visit_sessions v JOIN ops_stores s ON s.organization_id = v.organization_id AND s.id = v.store_id
      WHERE ${clauses.join(" AND ")}`, params) ?? {};
    const appointmentParams: unknown[] = [];
    const appointmentClauses = [scopeWhere(scope, "s", appointmentParams), "ap.status = 'confirmed'", "ap.starts_at >= ?"];
    appointmentParams.push(query.now);
    if (query.storeId) { appointmentClauses.push("w.store_id = ?"); appointmentParams.push(query.storeId); }
    if (query.vendorId) { appointmentClauses.push("a.vendor_id = ?"); appointmentParams.push(query.vendorId); }
    const appointment = await this.first(`SELECT COUNT(DISTINCT ap.work_order_id) AS upcoming_count FROM ops_service_appointments ap
      JOIN ops_work_orders w ON w.organization_id = ap.organization_id AND w.id = ap.work_order_id
      JOIN ops_stores s ON s.organization_id = w.organization_id AND s.id = w.store_id
      JOIN ops_work_order_assignments a ON a.organization_id = ap.organization_id AND a.id = ap.assignment_id
      WHERE ${appointmentClauses.join(" AND ")}`, appointmentParams) ?? {};
    return { upcoming: Number(appointment.upcoming_count ?? 0), active: Number(visit.active_count ?? 0), completed: Number(visit.completed_count ?? 0), needsReview: Number(visit.review_count ?? 0), withoutWorkOrder: Number(visit.no_work_count ?? 0) };
  }

  async getStorePortfolioSummary(scope: OrganizationScope) {
    const params: unknown[] = [];
    const storeScope = scopeWhere(scope, "s", params);
    const row = await this.first(`SELECT
      COUNT(*) AS store_count,
      COALESCE(SUM((SELECT COUNT(*) FROM ops_work_orders w WHERE w.organization_id = s.organization_id AND w.store_id = s.id AND w.status NOT IN ('closed','cancelled'))), 0) AS open_work_count,
      COALESCE(SUM((SELECT COUNT(*) FROM ops_visit_sessions v WHERE v.organization_id = s.organization_id AND v.store_id = s.id AND v.status = 'active')), 0) AS active_visit_count,
      COALESCE(SUM((SELECT COALESCE(SUM(c.amount_minor), 0) FROM ops_cost_lines c JOIN ops_work_orders cw ON cw.organization_id = c.organization_id AND cw.id = c.work_order_id WHERE c.organization_id = s.organization_id AND cw.store_id = s.id)), 0) AS recorded_cost_minor
      FROM ops_stores s WHERE ${storeScope}`, params) ?? {};
    return {
      stores: Number(row.store_count ?? 0),
      openWorkOrders: Number(row.open_work_count ?? 0),
      activeVisits: Number(row.active_visit_count ?? 0),
      recordedCostMinor: Number(row.recorded_cost_minor ?? 0),
      currency: "USD",
    };
  }

  async listRequests(scope: OrganizationScope, query: PageRequest & { search?: string; status?: string; storeId?: OpsId } = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    if (query.status === "acknowledged_unlinked") clauses.push("r.status = 'acknowledged' AND r.linked_work_order_id IS NULL");
    else if (query.status) { clauses.push("r.status = ?"); params.push(query.status); }
    if (query.storeId) { clauses.push("r.store_id = ?"); params.push(query.storeId); }
    if (query.search?.trim()) { clauses.push("lower(r.reference || ' ' || r.problem || ' ' || r.reporter_name || ' ' || s.store_number || ' ' || s.name) LIKE ?"); params.push(`%${query.search.trim().toLocaleLowerCase("en-US")}%`); }
    addKeysetCursor(clauses, params, query.cursor, "r.submitted_at", "r.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1, offset(query.offset));
    const rows = await this.all(`SELECT r.*, s.store_number, s.name AS store_name
      FROM ops_requests r JOIN ops_stores s ON s.organization_id = r.organization_id AND s.id = r.store_id
      WHERE ${clauses.join(" AND ")} ORDER BY r.submitted_at DESC, r.id DESC LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): RequestListRow => ({ id: text(row, "id"), reference: text(row, "reference"), storeId: text(row, "store_id"), storeNumber: text(row, "store_number"), storeName: text(row, "store_name"), reporterName: text(row, "reporter_name"), problem: text(row, "problem"), priority: text(row, "priority") as RequestListRow["priority"], status: text(row, "status"), submittedAt: text(row, "submitted_at"), acknowledgedAt: maybeText(row, "acknowledged_at"), acknowledgedByActorName: maybeText(row, "acknowledged_by_actor_name"), linkedWorkOrderId: maybeText(row, "linked_work_order_id"), convertedWorkOrderId: maybeText(row, "converted_work_order_id") }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "submitted_at"), text(last, "id")) : undefined };
  }

  async listVisits(scope: OrganizationScope, query: PageRequest & { search?: string; status?: string; storeId?: OpsId; vendorId?: OpsId; review?: boolean } = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    if (query.status) { clauses.push("vs.status = ?"); params.push(query.status); }
    if (query.storeId) { clauses.push("vs.store_id = ?"); params.push(query.storeId); }
    if (query.vendorId) { clauses.push("vs.vendor_id = ?"); params.push(query.vendorId); }
    if (query.review) { clauses.push("((vs.work_order_id IS NULL AND NOT EXISTS (SELECT 1 FROM ops_site_visit_work_orders rw WHERE rw.organization_id = vs.organization_id AND rw.visit_id = vs.id)) OR EXISTS (SELECT 1 FROM ops_exceptions re WHERE re.organization_id = vs.organization_id AND re.visit_id = vs.id AND re.status <> 'resolved'))"); }
    if (query.search?.trim()) { clauses.push("lower(vs.technician_name || ' ' || vs.provider_name || ' ' || vs.purpose || ' ' || s.store_number || ' ' || s.name || ' ' || COALESCE(w.number,'')) LIKE ?"); params.push(`%${query.search.trim().toLocaleLowerCase("en-US")}%`); }
    addKeysetCursor(clauses, params, query.cursor, "vs.checked_in_at", "vs.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1, offset(query.offset));
    const rows = await this.all(`SELECT vs.*, s.store_number, s.name AS store_name, s.time_zone AS store_time_zone, w.number AS work_order_number, e.location_result
      FROM ops_visit_sessions vs JOIN ops_stores s ON s.organization_id = vs.organization_id AND s.id = vs.store_id
      LEFT JOIN ops_work_orders w ON w.organization_id = vs.organization_id AND w.id = vs.work_order_id
      LEFT JOIN ops_visit_evidence e ON e.organization_id = vs.organization_id AND e.visit_id = vs.id AND e.kind = 'check_in'
      WHERE ${clauses.join(" AND ")} ORDER BY vs.checked_in_at DESC, vs.id DESC LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map(visitListRow);
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "checked_in_at"), text(last, "id")) : undefined };
  }

  async listExceptions(scope: OrganizationScope, query: ExceptionQueueQuery = {}) {
    const params: unknown[] = [];
    const locationScoped = scope.storeIds !== undefined || scope.regionIds !== undefined;
    const clauses = locationScoped
      ? [scopeWhere(scope, "s", params)]
      : ["e.organization_id = ?"];
    if (!locationScoped) params.push(scope.organizationId);
    if (query.statuses?.length) { clauses.push(`e.status IN (${query.statuses.map(() => "?").join(",")})`); params.push(...query.statuses); }
    if (query.kinds?.length) { clauses.push(`e.kind IN (${query.kinds.map(() => "?").join(",")})`); params.push(...query.kinds); }
    if (query.storeId) { clauses.push("e.store_id = ?"); params.push(query.storeId); }
    if (query.vendorId) { clauses.push("e.vendor_id = ?"); params.push(query.vendorId); }
    addKeysetCursor(clauses, params, query.cursor, "e.detected_at", "e.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1, offset(query.offset));
    const rows = await this.all(`SELECT e.*, s.store_number, w.number AS work_order_number
      FROM ops_exceptions e
      LEFT JOIN ops_stores s ON s.organization_id = e.organization_id AND s.id = e.store_id
      LEFT JOIN ops_work_orders w ON w.organization_id = e.organization_id AND w.id = e.work_order_id
      WHERE ${clauses.join(" AND ")} ORDER BY e.detected_at DESC, e.id DESC LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): ExceptionQueueRow => ({ id: text(row, "id"), kind: text(row, "kind") as ExceptionQueueRow["kind"], status: text(row, "status") as ExceptionQueueRow["status"], severity: text(row, "severity") as ExceptionQueueRow["severity"], summary: text(row, "summary"), storeId: maybeText(row, "store_id"), storeNumber: maybeText(row, "store_number"), workOrderId: maybeText(row, "work_order_id"), workOrderNumber: maybeText(row, "work_order_number"), visitId: maybeText(row, "visit_id"), detectedAt: text(row, "detected_at") }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "detected_at"), text(last, "id")) : undefined };
  }

  async listVendors(scope: OrganizationScope, search = "", request: PageRequest = {}) {
    const params: unknown[] = [];
    const scopedStores = scopeWhere(scope, "ss", params);
    const clauses = ["v.organization_id = ?"];
    params.push(scope.organizationId);
    const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
    if (normalizedSearch) { clauses.push("v.search_text LIKE ?"); params.push(`%${normalizedSearch}%`); }
    addKeysetCursor(clauses, params, request.cursor, "v.name", "v.id", "asc");
    const max = limit(request.limit);
    params.push(max + 1, offset(request.offset));
    const rows = await this.all(`WITH scoped_stores AS (
        SELECT ss.id FROM ops_stores ss WHERE ${scopedStores}
      )
      SELECT v.*,
      (SELECT group_concat(display_name, '|') FROM ops_vendor_specialties sp WHERE sp.organization_id = v.organization_id AND sp.vendor_id = v.id) AS specialties,
      (SELECT COUNT(*) FROM ops_work_order_assignments a
        JOIN ops_work_orders w ON w.organization_id = a.organization_id AND w.id = a.work_order_id
        JOIN scoped_stores sw ON sw.id = w.store_id
        WHERE a.organization_id = v.organization_id AND a.vendor_id = v.id AND w.status NOT IN ('closed','cancelled')) AS open_work_orders,
      (SELECT COUNT(*) FROM ops_visit_sessions vs
        JOIN scoped_stores sv ON sv.id = vs.store_id
        WHERE vs.organization_id = v.organization_id AND vs.vendor_id = v.id AND vs.status = 'active') AS active_visits
      FROM ops_vendors v WHERE ${clauses.join(" AND ")} ORDER BY v.name, v.id LIMIT ? OFFSET ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): VendorDirectoryRow => ({ id: text(row, "id"), name: text(row, "name"), status: text(row, "status"), preferred: bool(row, "preferred"), specialties: text(row, "specialties").split("|").filter(Boolean), coverageLabels: [], openWorkOrders: Number(row.open_work_orders ?? 0), activeVisits: Number(row.active_visits ?? 0), returnVisitWorkOrders: 0 }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "name"), text(last, "id")) : undefined };
  }

  async getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null> { const store = await this.getStore(scope.organizationId, storeId); if (!store || !storeAllowed(scope, store)) return null; const base = (await this.searchStores({ ...scope, storeIds: [store.id] }, store.storeNumber, { limit: 1 })).items[0]; if (!base) return null; const openWorkOrders = (await this.listWorkOrders({ ...scope, storeIds: [store.id] }, { statuses: ["draft","awaiting_approval","approved","issued","accepted","scheduled","in_progress","waiting_on_vendor","waiting_on_parts","completed_pending_review","resolved"], limit: 100 })).items; const activeVisits = (await this.listVisits({ ...scope, storeIds: [store.id] }, { status: "active", limit: 100 })).items; const assets = await this.all("SELECT a.id, a.asset_tag, a.name, a.category_key, a.status, COALESCE(SUM(c.amount_minor),0) AS recorded_cost_minor FROM ops_assets a LEFT JOIN ops_work_orders w ON w.organization_id = a.organization_id AND w.asset_id = a.id LEFT JOIN ops_cost_lines c ON c.organization_id = w.organization_id AND c.work_order_id = w.id WHERE a.organization_id = ? AND a.store_id = ? GROUP BY a.id, a.asset_tag, a.name, a.category_key, a.status ORDER BY a.name", [scope.organizationId, store.id]); return { ...base, regionId: store.regionId, status: store.status, activeVisits, openWorkOrders, assets: assets.map((row) => ({ id: text(row,"id"), assetTag: text(row,"asset_tag"), name: text(row,"name"), categoryKey: text(row,"category_key"), status: text(row,"status"), recordedCostMinor: Number(row.recorded_cost_minor ?? 0) })) }; }

  async getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null> {
    const workOrder = await this.getWorkOrder(scope.organizationId, workOrderId);
    if (!workOrder) return null;
    const store = await this.getStore(scope.organizationId, workOrder.storeId);
    if (!store || !storeAllowed(scope, store)) return null;
    const baseRow = (await this.workOrderRows({ ...scope, storeIds: [store.id] }, { workOrderId: workOrder.id, limit: 1 }))[0];
    if (!baseRow) return null;
    const requestRow = workOrder.requestId
      ? await this.first(`SELECT r.*, s.store_number, s.name AS store_name
          FROM ops_requests r JOIN ops_stores s ON s.organization_id = r.organization_id AND s.id = r.store_id
          WHERE r.organization_id = ? AND r.id = ? AND r.store_id = ?`, [scope.organizationId, workOrder.requestId, store.id])
      : null;
    const request = requestRow ? ({ id: text(requestRow, "id"), reference: text(requestRow, "reference"), storeId: text(requestRow, "store_id"), storeNumber: text(requestRow, "store_number"), storeName: text(requestRow, "store_name"), reporterName: text(requestRow, "reporter_name"), problem: text(requestRow, "problem"), priority: text(requestRow, "priority") as RequestListRow["priority"], status: text(requestRow, "status"), submittedAt: text(requestRow, "submitted_at"), acknowledgedAt: maybeText(requestRow, "acknowledged_at"), acknowledgedByActorName: maybeText(requestRow, "acknowledged_by_actor_name"), linkedWorkOrderId: maybeText(requestRow, "linked_work_order_id"), convertedWorkOrderId: maybeText(requestRow, "converted_work_order_id") } satisfies RequestListRow) : undefined;
    const visitRows = await this.all(`SELECT vs.*, s.store_number, s.name AS store_name, s.time_zone AS store_time_zone, w.number AS work_order_number, e.location_result,
        svwo.work_order_id AS linked_work_order_id, svwo.outcome AS work_outcome,
        svwo.outcome_notes AS work_outcome_notes, svwo.follow_up_id AS work_follow_up_id
      FROM ops_site_visit_work_orders svwo
      JOIN ops_visit_sessions vs ON vs.organization_id = svwo.organization_id AND vs.id = svwo.visit_id
      JOIN ops_stores s ON s.organization_id = vs.organization_id AND s.id = vs.store_id
      JOIN ops_work_orders w ON w.organization_id = svwo.organization_id AND w.id = svwo.work_order_id
      LEFT JOIN ops_visit_evidence e ON e.organization_id = vs.organization_id AND e.visit_id = vs.id AND e.kind = 'check_in'
      WHERE svwo.organization_id = ? AND svwo.work_order_id = ? AND vs.store_id = ?
      ORDER BY vs.checked_in_at DESC, vs.id DESC`, [scope.organizationId, workOrder.id, store.id]);
    const visits = visitRows.map(visitListRow);
    const followUps = await this.all("SELECT id, next_action, accountable_party, due_at, status FROM ops_follow_ups WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at", [scope.organizationId, workOrder.id]);
    const costs = await this.all("SELECT * FROM ops_cost_lines WHERE organization_id = ? AND work_order_id = ? ORDER BY service_date, id", [scope.organizationId, workOrder.id]);
    const asset = workOrder.assetId ? await this.getAsset(scope.organizationId, workOrder.assetId) : null;
    const component = workOrder.componentId ? await this.getComponent(scope.organizationId, workOrder.componentId) : null;
    return { ...this.workListRow(baseRow), request, authorizedScope: workOrder.authorizedScope, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag, warrantyEndsAt: asset.warrantyEndsAt } : undefined, component: component ? { id: component.id, name: component.name } : undefined, nte: workOrder.nte, vendorServiceTicketNumber: workOrder.vendorServiceTicketNumber, vendorInvoiceNumber: workOrder.vendorInvoiceNumber, externalAccountingPo: workOrder.externalAccountingPo, visits, followUps: followUps.map((row) => ({ id: text(row,"id"), nextAction: text(row,"next_action"), accountableParty: text(row,"accountable_party"), dueAt: text(row,"due_at"), status: text(row,"status") })), costs: costs.map((row) => ({ id: text(row,"id"), kind: text(row,"kind"), description: text(row,"description"), amountMinor: Number(row.amount_minor), currency: text(row,"currency"), serviceDate: text(row,"service_date") })) };
  }

  async getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null> { const asset = await this.getAsset(scope.organizationId, assetId); if (!asset) return null; const store = await this.getStore(scope.organizationId, asset.storeId); if (!store || !storeAllowed(scope, store)) return null; const components = await this.all("SELECT * FROM ops_asset_components WHERE organization_id = ? AND asset_id = ? ORDER BY name", [scope.organizationId, asset.id]); const workOrders = (await this.workOrderRows({ ...scope, storeIds: [store.id] }, { assetId: asset.id, unbounded: true })).map((row) => this.workListRow(row)); return { id: asset.id, storeId: asset.storeId, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, groupPath: asset.groupPath, manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber, installedAt: asset.installedAt, expectedLifeYears: asset.expectedLifeYears, warrantyEndsAt: asset.warrantyEndsAt, replacementEstimateMinor: asset.replacementEstimate?.amountMinor, currency: asset.replacementEstimate?.currency ?? "USD", status: asset.status, components: components.map((row) => ({ id: text(row,"id"), parentComponentId: maybeText(row,"parent_component_id"), name: text(row,"name"), partNumber: maybeText(row,"part_number"), serialNumber: maybeText(row,"serial_number") })), workOrders, recordedCostMinor: workOrders.reduce((sum,row) => sum + row.recordedCostMinor,0) }; }

  async listPmOccurrences(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) { const params: unknown[] = []; const clauses = [scopeWhere(scope,"s",params)]; if (query.status) { clauses.push("o.status = ?"); params.push(query.status); } if (query.storeId) { clauses.push("o.store_id = ?"); params.push(query.storeId); } addKeysetCursor(clauses, params, query.cursor, "o.due_at", "o.id", "asc"); const max=limit(query.limit); params.push(max+1); const rows = await this.all(`SELECT o.*, p.name AS plan_name, s.store_number, a.name AS asset_name FROM ops_pm_occurrences o JOIN ops_stores s ON s.organization_id = o.organization_id AND s.id = o.store_id JOIN ops_pm_plans p ON p.organization_id = o.organization_id AND p.id = o.plan_id LEFT JOIN ops_assets a ON a.organization_id = o.organization_id AND a.id = o.asset_id WHERE ${clauses.join(" AND ")} ORDER BY o.due_at, o.id LIMIT ?`,params); const visibleRows=rows.slice(0,max); const items=visibleRows.map((row):PmOccurrenceRow=>({id:text(row,"id"),planId:text(row,"plan_id"),planName:text(row,"plan_name"),storeId:text(row,"store_id"),storeNumber:text(row,"store_number"),assetId:maybeText(row,"asset_id"),assetName:maybeText(row,"asset_name"),dueAt:text(row,"due_at"),windowStartsAt:text(row,"window_starts_at"),windowEndsAt:text(row,"window_ends_at"),status:text(row,"status"),workOrderId:maybeText(row,"work_order_id")})); const last=visibleRows.at(-1); return {items,nextCursor:rows.length>max&&last?encodeCursor(text(last,"due_at"),text(last,"id")):undefined}; }

  async getExecutiveSnapshot(scope: OrganizationScope, period: { startsAt: IsoDateTime; endsAt: IsoDateTime }): Promise<ExecutiveSnapshotView> {
    const scoped = (alias: string) => { const params: unknown[] = []; return { where: scopeWhere(scope, alias, params), params }; };
    const visitScope = scoped("s");
    const visit = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN v.status='active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN v.work_order_id IS NULL THEN 1 ELSE 0 END) AS no_wo FROM ops_visit_sessions v JOIN ops_stores s ON s.organization_id=v.organization_id AND s.id=v.store_id WHERE ${visitScope.where} AND v.checked_in_at >= ? AND v.checked_in_at < ?`, [...visitScope.params, period.startsAt, period.endsAt]);
    const workScope = scoped("s");
    const work = await this.first(`SELECT SUM(CASE WHEN w.created_at >= ? AND w.created_at < ? THEN 1 ELSE 0 END) AS total, SUM(CASE WHEN w.status NOT IN ('closed','cancelled') THEN 1 ELSE 0 END) AS open FROM ops_work_orders w JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${workScope.where}`, [period.startsAt, period.endsAt, ...workScope.params]);
    const exceptionScope = scoped("s");
    const exceptions = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN e.status!='resolved' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN e.kind='unexpected_visit' THEN 1 ELSE 0 END) AS unexpected, SUM(CASE WHEN e.kind='missing_checkout' AND e.status!='resolved' THEN 1 ELSE 0 END) AS missing FROM ops_exceptions e JOIN ops_stores s ON s.organization_id=e.organization_id AND s.id=e.store_id WHERE ${exceptionScope.where} AND e.detected_at >= ? AND e.detected_at < ?`, [...exceptionScope.params, period.startsAt, period.endsAt]);
    const followScope = scoped("s");
    const followUps = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN f.status='open' AND f.due_at<? THEN 1 ELSE 0 END) AS overdue FROM ops_follow_ups f JOIN ops_work_orders w ON w.organization_id=f.organization_id AND w.id=f.work_order_id JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${followScope.where}`, [period.endsAt, ...followScope.params]);
    const costScope = scoped("s");
    const costs = await this.first(`SELECT COUNT(*) AS total, COALESCE(SUM(c.amount_minor),0) AS amount FROM ops_cost_lines c JOIN ops_work_orders w ON w.organization_id=c.organization_id AND w.id=c.work_order_id JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${costScope.where} AND c.service_date BETWEEN ? AND ?`, [...costScope.params, period.startsAt.slice(0,10), period.endsAt.slice(0,10)]);
    return { organizationId: scope.organizationId, period, scope: { regionId: scope.regionIds?.length===1 ? scope.regionIds[0] : undefined, storeId: scope.storeIds?.length===1 ? scope.storeIds[0] : undefined }, activeVisits: Number(visit?.active ?? 0), unexpectedVisits: Number(exceptions?.unexpected ?? 0), openExceptions: Number(exceptions?.open ?? 0), noWorkOrderVisits: Number(visit?.no_wo ?? 0), missingCheckouts: Number(exceptions?.missing ?? 0), openWorkOrders: Number(work?.open ?? 0), overdueFollowUps: Number(followUps?.overdue ?? 0), recordedCost: { amountMinor: Number(costs?.amount ?? 0), currency: "USD" }, sourceCounts: { visits: Number(visit?.total ?? 0), workOrders: Number(work?.total ?? 0), followUps: Number(followUps?.total ?? 0), exceptions: Number(exceptions?.total ?? 0), costLines: Number(costs?.total ?? 0) } };
  }

  private async publicToken(input: PublicTokenLookup) { return await this.first("SELECT * FROM ops_public_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ? AND revoked_at IS NULL LIMIT 1", [input.tokenHash,input.purpose,input.now]); }
  async getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="store")return null; const org=text(token,"organization_id"); const store=await this.getStore(org,text(token,"subject_id")); const organization=await this.getOrganization(org); if(!store||!organization)return null; const vendors=await this.all("SELECT DISTINCT v.id,v.name,(SELECT group_concat(display_name,'|') FROM ops_vendor_specialties sp WHERE sp.organization_id=v.organization_id AND sp.vendor_id=v.id) AS specialties FROM ops_vendors v JOIN ops_vendor_coverage c ON c.organization_id=v.organization_id AND c.vendor_id=v.id WHERE v.organization_id=? AND v.status='approved' AND (c.scope_kind='organization' AND c.scope_id=? OR c.scope_kind='region' AND c.scope_id=? OR c.scope_kind='store' AND c.scope_id=?) ORDER BY v.name",[org,org,store.regionId??"",store.id]); return {organizationId:org,organizationName:organization.name,store:{id:store.id,storeNumber:store.storeNumber,name:store.name,formattedAddress:formatAddress(store),timeZone:store.timeZone,locationPolicyEnabled:store.locationPolicyEnabled},approvedVendors:vendors.map(row=>({id:text(row,"id"),name:text(row,"name"),specialties:text(row,"specialties").split("|").filter(Boolean)})),actions:["report_issue","vendor_sign_in","current_visits"]}; }
  async getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView|null> { const gateway=await this.getPublicStoreGatewayByToken(input); if(!gateway||!input.vendorId||!gateway.approvedVendors.some(row=>row.id===input.vendorId))return null; const vendor=await this.getVendor(gateway.organizationId,input.vendorId); if(!vendor)return null; const rows=await this.all("SELECT w.id,w.number,w.problem,w.category_key,w.status FROM ops_work_orders w JOIN ops_work_order_assignments a ON a.organization_id=w.organization_id AND a.work_order_id=w.id WHERE w.organization_id=? AND w.store_id=? AND a.vendor_id=? AND a.status IN ('issued','opened','accepted') AND w.status NOT IN ('completed_pending_review','resolved','closed','cancelled') ORDER BY w.created_at DESC",[gateway.organizationId,gateway.store.id,vendor.id]); return {organizationName:gateway.organizationName,store:gateway.store,vendor:{id:vendor.id,name:vendor.name},eligibleWorkOrders:rows.map(row=>({id:text(row,"id"),number:text(row,"number"),problem:text(row,"problem"),categoryKey:maybeText(row,"category_key"),status:text(row,"status") as WorkOrder["status"]})),allowsNoWorkOrder:true}; }
  async getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView|null> {
    const token=await this.publicToken(input);
    if(!token||text(token,"subject_type")!=="work_order_issuance")return null;
    const org=text(token,"organization_id");
    const issuance=await this.getIssuance(org,text(token,"subject_id"));
    if(!issuance)return null;
    const [assignment,workOrder,latestIssuance]=await Promise.all([
      this.getAssignment(org,issuance.assignmentId),
      this.getWorkOrder(org,issuance.workOrderId),
      this.getLatestIssuanceForWorkOrder(org,issuance.workOrderId),
    ]);
    if(!assignment||!workOrder||latestIssuance?.id!==issuance.id||assignment.kind!=="outside_vendor"||assignment.workOrderId!==workOrder.id||!assignment.vendorId||!["issued","opened","accepted"].includes(assignment.status)||["completed_pending_review","resolved","closed","cancelled"].includes(workOrder.status))return null;
    const activeAssignment=await this.getActiveAssignment(org,workOrder.id);
    if(activeAssignment?.id!==assignment.id)return null;
    const [vendor,store,organization]=await Promise.all([
      this.getVendor(org,assignment.vendorId),
      this.getStore(org,workOrder.storeId),
      this.getOrganization(org),
    ]);
    if(!vendor||!store||!organization)return null;
    let snapshot:Partial<ServiceAuthorizationView>={};
    try{snapshot=JSON.parse(issuance.immutablePayloadJson) as Partial<ServiceAuthorizationView>;}catch{return null;}
    const response=await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id=? AND issuance_id=? ORDER BY responded_at DESC, id DESC LIMIT 1",[org,issuance.id]);
    return {organizationId:org,organizationName:snapshot.organizationName??organization.name,workOrderId:workOrder.id,assignmentId:assignment.id,issuanceId:issuance.id,workOrderNumber:snapshot.workOrderNumber??workOrder.number,revision:issuance.revision,status:workOrder.status,assignmentStatus:assignment.status,store:snapshot.store??{id:store.id,storeNumber:store.storeNumber,name:store.name,formattedAddress:formatAddress(store)},vendor:snapshot.vendor??{id:vendor.id,name:vendor.name},problem:snapshot.problem??workOrder.problem,priority:snapshot.priority??workOrder.priority,authorizedScope:snapshot.authorizedScope,categoryKey:snapshot.categoryKey,asset:snapshot.asset,requestedTiming:snapshot.requestedTiming,nte:snapshot.nte,billingInstruction:snapshot.billingInstruction??`Reference operator work order ${workOrder.number} on all service tickets and invoices.`,issuedAt:issuance.issuedAt,latestResponse:response?{id:text(response,"id"),response:text(response,"response") as VendorResponse["response"],responderName:text(response,"responder_name"),proposedAt:maybeText(response,"proposed_at"),message:maybeText(response,"message"),respondedAt:text(response,"responded_at")}:undefined};
  }
  async getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="visit")return null; const org=text(token,"organization_id"); const visit=await this.getVisit(org,text(token,"subject_id")); if(!visit||visit.status!=="active"||!visit.vendorId)return null; const store=await this.getStore(org,visit.storeId); const workOrder=visit.workOrderId?await this.getWorkOrder(org,visit.workOrderId):null; const evidence=await this.first("SELECT location_result FROM ops_visit_evidence WHERE organization_id=? AND visit_id=? AND kind='check_in'",[org,visit.id]); if(!store)return null; return {organizationId:org,id:visit.id,storeId:store.id,storeNumber:store.storeNumber,storeName:store.name,vendorId:visit.vendorId,vendorName:visit.providerName,workOrderId:workOrder?.id,workOrderNumber:workOrder?.number,unmatchedReason:visit.unmatchedReason,technicianName:visit.technicianName,purpose:visit.purpose,checkedInAt:visit.checkedInAt,startedChannel:visit.startedChannel,checkInLocationResult:(maybeText(evidence??{},"location_result")??"not_requested") as ActiveVisitView["checkInLocationResult"],approximateObservedSeconds:Math.max(0,Math.floor((Date.parse(input.now)-Date.parse(visit.checkedInAt))/1000))}; }
  async getEstimateRequestByPublicToken(input: PublicTokenLookup) { const token=await this.publicToken(input); if(!token||token.used_at!=null||text(token,"subject_type")!=="work_order_estimate_request")return null; const request=await this.getEstimateRequest(text(token,"organization_id"),text(token,"subject_id")); return request&&(input.vendorId===undefined||request.vendorId===input.vendorId)?{request,tokenId:text(token,"id"),expiresAt:text(token,"expires_at")}:null; }
  async getServiceRunByPublicToken(input: PublicTokenLookup) { const token=await this.publicToken(input); if(!token||token.used_at!=null||text(token,"subject_type")!=="service_run")return null; const run=await this.getServiceRun(text(token,"organization_id"),text(token,"subject_id")); return run&&(input.vendorId===undefined||run.vendorId===input.vendorId)?{run,tokenId:text(token,"id"),expiresAt:text(token,"expires_at")}:null; }
  async getVisitByCheckoutToken(input: PublicTokenLookup) { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="visit")return null; const visit=await this.getVisit(text(token,"organization_id"),text(token,"subject_id")); return visit ? { visit, expiresAt:text(token,"expires_at") } : null; }
  async getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="store")return null; const org=text(token,"organization_id"); const store=await this.getStore(org,text(token,"subject_id")); const organization=await this.getOrganization(org); if(!store||!organization)return null; return { organizationId:org, organizationName:organization.name, store:{ id:store.id, storeNumber:store.storeNumber, name:store.name, formattedAddress:formatAddress(store) }, activeVisits:await this.listActiveVisitsForStore(org,store.id) }; }

  async listDueOutboxMessages(now: string, limit: number): Promise<OutboxMessage[]> {
    const rows = await this.all("SELECT * FROM ops_outbox_messages WHERE status = ? AND available_at <= ? ORDER BY available_at, id LIMIT ?", ["pending", now, Math.max(1, Math.min(100, limit))]);
    return rows.map(outboxMessageFrom);
  }

  async listStaleProcessingOutboxMessages(staleBefore: string, limit: number): Promise<OutboxMessage[]> {
    const rows = await this.all("SELECT * FROM ops_outbox_messages WHERE status = ? AND (claimed_at IS NULL OR claimed_at <= ?) ORDER BY claimed_at, id LIMIT ?", ["processing", staleBefore, Math.max(1, Math.min(100, limit))]);
    return rows.map(outboxMessageFrom);
  }

  async claimOutboxMessage(organizationId: OpsId, id: OpsId, claimedAt: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE ops_outbox_messages SET status = ?, claimed_at = ?, attempt_count = attempt_count + 1 WHERE organization_id = ? AND id = ? AND status = ? RETURNING id").bind("processing", claimedAt, organizationId, id, "pending").run();
    const meta = (result as { meta?: { changes?: number } }).meta;
    const returned = ((result as { results?: unknown[] }).results ?? (result as { rows?: unknown[] }).rows ?? []) as unknown[];
    return Number(meta?.changes ?? 0) > 0 || returned.length > 0;
  }

  async listOverdueEscalationCandidates(now: string, limit: number): Promise<WorkflowTask[]> {
    const rows = await this.all("SELECT * FROM ops_workflow_tasks WHERE status IN ('open', 'in_progress') AND due_at IS NOT NULL AND due_at <= ? ORDER BY due_at, id LIMIT ?", [now, Math.max(1, Math.min(100, limit))]);
    return rows.map(workflowTaskFrom);
  }

  async tryBeginJobRun(input: { organizationId: OpsId; jobRunId: OpsId; jobType: string; slotKey: string; startedAt: string }): Promise<boolean> {
    const result = await this.db.prepare("INSERT OR IGNORE INTO ops_job_runs (id, organization_id, job_type, slot_key, status, started_at, processed_count, failed_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?) RETURNING id").bind(input.jobRunId, input.organizationId, input.jobType, input.slotKey, "running", input.startedAt, input.startedAt).run();
    const meta = (result as { meta?: { changes?: number } }).meta;
    const returned = ((result as { results?: unknown[] }).results ?? (result as { rows?: unknown[] }).rows ?? []) as unknown[];
    return Number(meta?.changes ?? 0) > 0 || returned.length > 0;
  }

  async finishJobRun(input: { organizationId: OpsId; jobRunId: OpsId; status: "succeeded" | "failed"; finishedAt: string; processedCount: number; failedCount: number }): Promise<void> {
    await this.atomicWrite([{ sql: "UPDATE ops_job_runs SET status = ?, finished_at = ?, processed_count = ?, failed_count = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [input.status, input.finishedAt, input.processedCount, input.failedCount, input.organizationId, input.jobRunId, "running"] }]);
  }

  async listPmPlans(organizationId: OpsId): Promise<PmPlan[]> { const rows = await this.all("SELECT * FROM ops_pm_plans WHERE organization_id = ? ORDER BY store_id, id", [organizationId]); return rows.map(pmPlanFrom); }

  async listAllPmPlansForWorker(): Promise<PmPlan[]> { const rows = await this.all("SELECT * FROM ops_pm_plans ORDER BY organization_id, store_id, id"); return rows.map(pmPlanFrom); }

  async listAllVendorComplianceDocumentsForWorker(): Promise<VendorComplianceDocument[]> { const rows = await this.all("SELECT * FROM ops_vendor_compliance_documents ORDER BY organization_id, vendor_id, document_type, created_at DESC, id DESC"); return rows.map(vendorComplianceFrom); }

  async listPmOccurrencesForPlan(organizationId: OpsId, planId: OpsId): Promise<PmOccurrence[]> { const rows = await this.all("SELECT * FROM ops_pm_occurrences WHERE organization_id = ? AND plan_id = ? ORDER BY due_at, id", [organizationId, planId]); return rows.map(pmOccurrenceFrom); }

  async listRecentJobRuns(organizationId: OpsId, limit: number): Promise<JobRun[]> { const rows = await this.all("SELECT * FROM ops_job_runs WHERE organization_id = ? ORDER BY started_at DESC, id DESC LIMIT ?", [organizationId, Math.max(1, Math.min(100, limit))]); return rows.map(jobRunFrom); }

  async outboxStatusCounts(organizationId: OpsId): Promise<Array<{ status: string; count: number }>> { const rows = await this.all("SELECT status, COUNT(*) AS count FROM ops_outbox_messages WHERE organization_id = ? GROUP BY status", [organizationId]); return rows.map((row) => ({ status: text(row, "status"), count: Number(row.count) })); }
  async listSavedViews(organizationId: OpsId, ownerMembershipId: OpsId, surface: string): Promise<SavedView[]> { const rows = await this.all("SELECT * FROM ops_saved_views WHERE organization_id = ? AND owner_membership_id = ? AND surface = ? ORDER BY name", [organizationId, ownerMembershipId, surface]); return rows.map(savedViewFrom); }
  async putSavedView(input: { organizationId: OpsId; id: OpsId; ownerMembershipId: OpsId; surface: string; name: string; queryString: string; createdAt: string }): Promise<void> { await this.atomicWrite([{ sql: "DELETE FROM ops_saved_views WHERE organization_id = ? AND owner_membership_id = ? AND surface = ? AND name = ?", params: [input.organizationId, input.ownerMembershipId, input.surface, input.name] }, { sql: "INSERT INTO ops_saved_views (id, organization_id, owner_membership_id, surface, name, query_string, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", params: [input.id, input.organizationId, input.ownerMembershipId, input.surface, input.name, input.queryString, input.createdAt] }]); }
  async deleteSavedView(organizationId: OpsId, ownerMembershipId: OpsId, id: OpsId): Promise<boolean> { const result = await this.db.prepare("DELETE FROM ops_saved_views WHERE organization_id = ? AND owner_membership_id = ? AND id = ?").bind(organizationId, ownerMembershipId, id).run(); const meta = (result as { meta?: { changes?: number } }).meta; return Number(meta?.changes ?? 0) > 0; }

  async recordOutboxDeliveryOutcome(input: OutboxDeliveryOutcome): Promise<void> {
    if (input.outcome === "delivered") {
      await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, delivered_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["delivered", input.deliveredAt, input.organizationId, input.id, "processing"] }]);
      return;
    }
    if (input.outcome === "retry") {
      await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, available_at = ?, last_error = ?, claimed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["pending", input.retryAt, input.lastError.slice(0, 2000), null, input.organizationId, input.id, "processing"] }]);
      return;
    }
    await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, last_error = ?, claimed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["failed", input.lastError.slice(0, 2000), null, input.organizationId, input.id, "processing"] }]);
  }

  async atomicWrite(statements: readonly OpsStatement[]) {
    try {
      await this.db.batch(statements.map((statement) => this.db.prepare(statement.sql).bind(...statement.params)));
    } catch (error) {
      if (requestConversionUniquenessError(error)) {
        throw new OpsDomainError("CONFLICT", "Request already has a canonical work order");
      }
      throw error;
    }
  }
}

export function createOpsSqlRepository(
  db: D1Database,
  kind: "d1" | "postgres",
): OpsRepository {
  return new D1OpsRepository(db, kind);
}

export function createOpsD1Repository(db: D1Database): OpsRepository {
  return createOpsSqlRepository(db, "d1");
}

function accountingSourceFrom(row: Row): import("./types").AccountingInvoiceSource { return { id: text(row, "id"), organizationId: text(row, "organization_id"), connectionKey: text(row, "connection_key"), companyKey: text(row, "company_key"), externalInvoiceId: text(row, "external_invoice_id"), sourceRevision: Number(row.source_revision), version: Number(row.version), payloadJson: text(row, "payload_json"), invoiceId: maybeText(row, "invoice_id"), matchState: text(row, "match_state") as import("./types").AccountingInvoiceSource["matchState"], updatedAt: text(row, "updated_at") }; }
