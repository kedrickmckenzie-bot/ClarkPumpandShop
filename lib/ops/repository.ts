import type {
  IsoDateTime,
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  Asset,
  AssetReplacementOverride,
  AssetComponent,
  ComponentTemplate,
  Division,
  EquipmentTemplate,
  FollowUp,
  IdempotencyKey,
  LifecycleRecommendation,
  OpsFixture,
  OpsId,
  Membership,
  ScopeGrant,
  OpsException,
  PageRequest,
  RequestImpactAssessment,
  ServiceRequest,
  SiteVisitWorkOrder,
  Store,
  StoredFile,
  TaxonomyNode,
  Organization,
  ReplacementBenchmark,
  ReplacementEvent,
  ReplacementProfile,
  Vendor,
  VendorSpecialty,
  VendorEstimateProposal,
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
  NotificationEventKey,
  NotificationRecipient,
  NotificationRecipientRole,
  NotificationRule,
  RoleCapabilityOverride,
  OrganizationWorkflowPolicy,
  ConfigurableMaintenanceCapability,
  JobRun,
  SavedView,
} from "./types";
import type {
  ActiveVisitView,
  AssetSearchPage,
  AssetDetailView,
  ExceptionQueuePage,
  ExecutiveSnapshotView,
  PmOccurrencePage,
  PublicStoreGatewayView,
  RequestListPage,
  ServiceAuthorizationView,
  StoreSearchPage,
  StoreDetailView,
  StoreVisitContextView,
  TrustedStoreActiveVisitRow,
  TrustedStoreDeviceView,
  VendorDirectoryPage,
  VisitListPage,
  WorkOrderDetailView,
  WorkOrderListPage,
} from "./view-models";

export interface OrganizationScope {
  organizationId: OpsId;
  regionIds?: readonly OpsId[];
  storeIds?: readonly OpsId[];
}

export interface WorkOrderListQuery extends PageRequest {
  search?: string;
  statuses?: readonly string[];
  priorities?: readonly string[];
  vendorId?: OpsId;
  storeId?: OpsId;
  regionId?: OpsId;
  categoryKey?: string;
  assetId?: OpsId | "unlinked";
  componentId?: OpsId | "unlinked";
  hasCost?: boolean;
  costFrom?: string;
  costTo?: string;
  costMonth?: string;
  currency?: string;
  categoryPath?: readonly string[];
  createdFrom?: IsoDateTime;
  createdTo?: IsoDateTime;
  heldOnly?: boolean;
  heldStoreGroup?: "multiple";
  upcomingAppointmentAfter?: IsoDateTime;
  heldReviewDeadlineTo?: IsoDateTime;
  heldConfirmedOpportunityAfter?: IsoDateTime;
}

export interface HeldWorkPortfolioSummary {
  approvedWorkOrders: number;
  storesWithApprovedWork: number;
  storesWithMultipleApprovedJobs: number;
}

export interface VisitPortfolioSummary {
  upcoming: number;
  active: number;
  completed: number;
  needsReview: number;
  withoutWorkOrder: number;
}

export interface StorePortfolioSummary {
  stores: number;
  openWorkOrders: number;
  activeVisits: number;
  recordedCostMinor: number;
  currency: string;
}

export interface ExceptionQueueQuery extends PageRequest {
  statuses?: readonly string[];
  kinds?: readonly string[];
  storeId?: OpsId;
  vendorId?: OpsId;
}

export interface PublicTokenLookup {
  tokenHash: string;
  purpose: string;
  now: IsoDateTime;
  vendorId?: OpsId;
}

export interface ServiceRunPublicCapability {
  run: ServiceRun;
  tokenId: OpsId;
  expiresAt: IsoDateTime;
}

export interface VisitCheckoutCapability {
  visit: VisitSession;
  expiresAt: IsoDateTime;
}

export interface EstimateRequestPublicCapability {
  request: WorkOrderEstimateRequest;
  tokenId: OpsId;
  expiresAt: IsoDateTime;
}

export interface OpsStatement {
  sql: string;
  params: readonly unknown[];
}

export interface OpsRepository {
  readonly kind: "d1" | "postgres" | "fixture";

  // Internal record lookups used by domain commands. Organization is always
  // the first filter and is never inferred from a record id.
  getOrganization(organizationId: OpsId): Promise<Organization | null>;
  getDivision(organizationId: OpsId, divisionId: OpsId): Promise<Division | null>;
  getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId): Promise<TaxonomyNode | null>;
  listTaxonomyNodes(organizationId: OpsId): Promise<TaxonomyNode[]>;
  getEquipmentTemplate(organizationId: OpsId, templateId: OpsId): Promise<EquipmentTemplate | null>;
  listEquipmentTemplates(organizationId: OpsId): Promise<EquipmentTemplate[]>;
  listComponentTemplates(organizationId: OpsId, equipmentTemplateId: OpsId): Promise<ComponentTemplate[]>;
  getStore(organizationId: OpsId, storeId: OpsId): Promise<Store | null>;
  getVendor(organizationId: OpsId, vendorId: OpsId): Promise<Vendor | null>;
  listVendorSpecialties(organizationId: OpsId, vendorId: OpsId): Promise<VendorSpecialty[]>;
  listNotificationRules(organizationId: OpsId): Promise<NotificationRule[]>;
  upsertNotificationRule(input: { organizationId: OpsId; id: OpsId; eventKey: NotificationEventKey; emailEnabled: boolean; recipientRole: NotificationRecipientRole; updatedByMembershipId?: OpsId; occurredAt: IsoDateTime }): Promise<void>;
  listNotificationRecipients(
    organizationId: OpsId,
    role: NotificationRecipientRole,
    scope?: { storeId: OpsId; regionId?: OpsId },
  ): Promise<NotificationRecipient[]>;
  getVendorReminder(organizationId: OpsId, reminderId: OpsId): Promise<import("./types").VendorReminder | null>;
  listVendorReminders(organizationId: OpsId, vendorId: OpsId): Promise<import("./types").VendorReminder[]>;
  getMembership(organizationId: OpsId, membershipId: OpsId): Promise<Membership | null>;
  listScopeGrantsForMembership(organizationId: OpsId, membershipId: OpsId): Promise<ScopeGrant[]>;
  listRoleCapabilityOverrides(organizationId: OpsId): Promise<RoleCapabilityOverride[]>;
  upsertRoleCapabilityOverride(input: { organizationId: OpsId; id: OpsId; role: RoleCapabilityOverride["role"]; capability: ConfigurableMaintenanceCapability; enabled: boolean; updatedByMembershipId: OpsId; updatedByName: string; occurredAt: IsoDateTime }): Promise<void>;
  getActiveWorkflowPolicy(organizationId: OpsId): Promise<OrganizationWorkflowPolicy | null>;
  listWorkflowPolicies(organizationId: OpsId): Promise<OrganizationWorkflowPolicy[]>;
  getRequest(organizationId: OpsId, requestId: OpsId): Promise<ServiceRequest | null>;
  listRequestImpactAssessments(organizationId: OpsId, requestId: OpsId): Promise<RequestImpactAssessment[]>;
  getWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrder | null>;
  getWorkOrderVisitHold(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderVisitHold | null>;
  listActiveWorkOrderVisitHoldsForStore(organizationId: OpsId, storeId: OpsId): Promise<WorkOrderVisitHold[]>;
  getApprovalPolicy(organizationId: OpsId, policyId: OpsId): Promise<ApprovalPolicy | null>;
  listApprovalPolicies(organizationId: OpsId): Promise<ApprovalPolicy[]>;
  getApprovalRequest(organizationId: OpsId, approvalRequestId: OpsId): Promise<ApprovalRequest | null>;
  listApprovalRequests(organizationId: OpsId): Promise<ApprovalRequest[]>;
  listApprovalRequestsForSubject(organizationId: OpsId, subjectType: ApprovalRequest["subjectType"], subjectId: OpsId): Promise<ApprovalRequest[]>;
  listApprovalDecisionsForRequest(organizationId: OpsId, approvalRequestId: OpsId): Promise<ApprovalDecision[]>;
  getAsset(organizationId: OpsId, assetId: OpsId): Promise<Asset | null>;
  getReplacementProfile(organizationId: OpsId, profileId: OpsId): Promise<ReplacementProfile | null>;
  listReplacementProfiles(organizationId: OpsId): Promise<ReplacementProfile[]>;
  getPublishedReplacementBenchmark(organizationId: OpsId, profileId: OpsId): Promise<ReplacementBenchmark | null>;
  listReplacementBenchmarks(organizationId: OpsId, profileId: OpsId): Promise<ReplacementBenchmark[]>;
  getActiveAssetReplacementOverride(organizationId: OpsId, assetId: OpsId): Promise<AssetReplacementOverride | null>;
  getReplacementEventForProposal(organizationId: OpsId, proposalId: OpsId): Promise<ReplacementEvent | null>;
  getActiveReplacementEventForAsset(organizationId: OpsId, assetId: OpsId): Promise<ReplacementEvent | null>;
  listLifecycleRecommendationsForAsset(organizationId: OpsId, assetId: OpsId): Promise<LifecycleRecommendation[]>;
  listAssetsForReplacementProfile(organizationId: OpsId, profileId: OpsId): Promise<Asset[]>;
  getComponent(organizationId: OpsId, componentId: OpsId): Promise<AssetComponent | null>;
  getMaintenanceProgram(organizationId: OpsId, programId: OpsId): Promise<MaintenanceProgram | null>;
  listMaintenancePrograms(organizationId: OpsId): Promise<MaintenanceProgram[]>;
  listAssetsForEquipmentTemplates(organizationId: OpsId, equipmentTemplateIds: OpsId[]): Promise<Asset[]>;
  getPmPlan(organizationId: OpsId, planId: OpsId): Promise<PmPlan | null>;
  getPmOccurrence(organizationId: OpsId, occurrenceId: OpsId): Promise<PmOccurrence | null>;
  listPmWorkItemsForOccurrence(organizationId: OpsId, occurrenceId: OpsId): Promise<PmWorkItem[]>;
  listVendorQualifications(organizationId: OpsId, vendorId: OpsId): Promise<VendorQualification[]>;
  listVendorComplianceDocuments(organizationId: OpsId, vendorId: OpsId): Promise<VendorComplianceDocument[]>;
  listVendorComplianceAlerts(organizationId: OpsId, vendorId: OpsId): Promise<VendorComplianceAlert[]>;
  getContractVersion(organizationId: OpsId, contractVersionId: OpsId): Promise<ContractVersion | null>;
  listContractScopes(organizationId: OpsId, contractVersionId: OpsId): Promise<ContractScope[]>;
  listRateCardLines(organizationId: OpsId, contractVersionId: OpsId): Promise<RateCardLine[]>;
  getSchedulingPolicy(organizationId: OpsId, contractVersionId: OpsId): Promise<SchedulingPolicy | null>;
  listVendorCapacity(organizationId: OpsId, vendorId: OpsId): Promise<VendorCapacity[]>;
  getServiceRun(organizationId: OpsId, serviceRunId: OpsId): Promise<ServiceRun | null>;
  listRouteStops(organizationId: OpsId, serviceRunId: OpsId): Promise<RouteStop[]>;
  listServiceRunWorkOrders(organizationId: OpsId, serviceRunId: OpsId): Promise<ServiceRunWorkOrder[]>;
  listServiceRunResponses(organizationId: OpsId, serviceRunId: OpsId): Promise<ServiceRunResponse[]>;
  listVendorWarrantyProfiles(organizationId: OpsId, vendorId: OpsId): Promise<VendorWarrantyProfile[]>;
  getVendorWarrantyProfile(organizationId: OpsId, profileId: OpsId): Promise<VendorWarrantyProfile | null>;
  listWarrantyRules(organizationId: OpsId, vendorId: OpsId): Promise<WarrantyRule[]>;
  listWarrantyCoverageLines(organizationId: OpsId, profileId: OpsId): Promise<WarrantyCoverageLine[]>;
  getRepairItem(organizationId: OpsId, repairItemId: OpsId): Promise<RepairItem | null>;
  listRepairItemsForAsset(organizationId: OpsId, assetId: OpsId): Promise<RepairItem[]>;
  listAppliedWarrantiesForRepair(organizationId: OpsId, repairItemId: OpsId): Promise<AppliedWarranty[]>;
  getAppliedWarranty(organizationId: OpsId, appliedWarrantyId: OpsId): Promise<AppliedWarranty | null>;
  listActiveAppliedWarrantiesForAsset(organizationId: OpsId, assetId: OpsId, onDate: string): Promise<AppliedWarranty[]>;
  getWarrantyCase(organizationId: OpsId, warrantyCaseId: OpsId): Promise<WarrantyCase | null>;
  listWarrantyCases(organizationId: OpsId): Promise<WarrantyCase[]>;
  listQuotesForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<Quote[]>;
  listAuthorizationsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<Authorization[]>;
  listAccountingInvoiceHistory(organizationId: OpsId, sourceId: OpsId): Promise<import("./types").AuditEvent[]>;
  listAccountingSourcesForInvoice(organizationId: OpsId, invoiceId: OpsId): Promise<import("./types").AccountingInvoiceSource[]>;
  getAccountingInvoiceSource(organizationId: OpsId, id: OpsId): Promise<import("./types").AccountingInvoiceSource | null>;
  listAccountingInvoiceSources(organizationId: OpsId, limit: number, offset: number): Promise<import("./types").AccountingInvoiceSource[]>;
  getInvoice(organizationId: OpsId, invoiceId: OpsId): Promise<Invoice | null>;
  findInvoicesByVendorReference(organizationId: OpsId, vendorId: OpsId, number: string): Promise<Invoice[]>;
  listInvoices(organizationId: OpsId): Promise<Invoice[]>;
  listInvoiceLines(organizationId: OpsId, invoiceId: OpsId): Promise<InvoiceLine[]>;
  listInvoiceLineAllocations(organizationId: OpsId, invoiceLineId: OpsId): Promise<InvoiceLineAllocation[]>;
  listInvoiceExceptions(organizationId: OpsId, invoiceId: OpsId): Promise<InvoiceException[]>;
  listInvoiceAdjustments(organizationId: OpsId, invoiceId: OpsId): Promise<InvoiceAdjustment[]>;
  listValueEvents(organizationId: OpsId): Promise<ValueEvent[]>;
  listServiceRunsForStoreVendor(organizationId: OpsId, storeId: OpsId, vendorId: OpsId): Promise<ServiceRun[]>;
  getRouteStopForVisit(organizationId: OpsId, visitId: OpsId): Promise<RouteStop | null>;
  getAssignment(organizationId: OpsId, assignmentId: OpsId): Promise<WorkOrderAssignment | null>;
  getIssuance(organizationId: OpsId, issuanceId: OpsId): Promise<WorkOrderIssuance | null>;
  getEstimateRequest(organizationId: OpsId, estimateRequestId: OpsId): Promise<WorkOrderEstimateRequest | null>;
  getLatestEstimateProposal(organizationId: OpsId, estimateRequestId: OpsId): Promise<VendorEstimateProposal | null>;
  listEstimateProposalsForRequest(organizationId: OpsId, estimateRequestId: OpsId): Promise<VendorEstimateProposal[]>;
  listEstimateRequestsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderEstimateRequest[]>;
  getVisit(organizationId: OpsId, visitId: OpsId): Promise<VisitSession | null>;
  getSiteVisitWorkOrderById(organizationId: OpsId, siteVisitWorkOrderId: OpsId): Promise<SiteVisitWorkOrder | null>;
  getSiteVisitWorkOrder(organizationId: OpsId, visitId: OpsId, workOrderId: OpsId): Promise<SiteVisitWorkOrder | null>;
  listSiteVisitWorkOrders(organizationId: OpsId, visitId: OpsId): Promise<SiteVisitWorkOrder[]>;
  listSiteVisitWorkOrdersForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<SiteVisitWorkOrder[]>;
  listWorkOrderVerifications(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderVerification[]>;
  getFollowUp(organizationId: OpsId, followUpId: OpsId): Promise<FollowUp | null>;
  getWorkflowTask(organizationId: OpsId, workflowTaskId: OpsId): Promise<WorkflowTask | null>;
  listWorkflowTasksForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkflowTask[]>;
  listWorkflowTasksForRequest(organizationId: OpsId, requestId: OpsId): Promise<WorkflowTask[]>;
  getHeldWorkPortfolioSummary(scope: OrganizationScope): Promise<HeldWorkPortfolioSummary>;
  getVisitPortfolioSummary(scope: OrganizationScope, query: { storeId?: OpsId; vendorId?: OpsId; now: IsoDateTime }): Promise<VisitPortfolioSummary>;
  getStorePortfolioSummary(scope: OrganizationScope): Promise<StorePortfolioSummary>;
  listWorkflowTaskSlaPauses(organizationId: OpsId, workflowTaskId: OpsId): Promise<WorkflowTaskSlaPause[]>;
  listWorkflowTaskSlaResumes(organizationId: OpsId, workflowTaskId: OpsId): Promise<WorkflowTaskSlaResume[]>;
  getActiveWorkflowTaskSlaPause(organizationId: OpsId, workflowTaskId: OpsId): Promise<WorkflowTaskSlaPause | null>;
  getException(organizationId: OpsId, exceptionId: OpsId): Promise<OpsException | null>;
  getIdempotencyKey(organizationId: OpsId, key: string): Promise<IdempotencyKey | null>;
  listFilesForEntity(organizationId: OpsId, entityType: string, entityId: OpsId, visibility?: "vendor_shared"): Promise<StoredFile[]>;
  getStoredFileByStorageKey(organizationId: OpsId, storageKey: string): Promise<StoredFile | null>;
  getActiveAssignment(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderAssignment | null>;
  getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderIssuance | null>;
  listIssuancesForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderIssuance[]>;
  getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId): Promise<import("./types").VendorResponse | null>;
  getLatestVendorResponseForIssuance(organizationId: OpsId, issuanceId: OpsId): Promise<import("./types").VendorResponse | null>;
  getVendorResponse(organizationId: OpsId, vendorResponseId: OpsId): Promise<import("./types").VendorResponse | null>;
  getServiceAppointment(organizationId: OpsId, appointmentId: OpsId): Promise<import("./types").ServiceAppointment | null>;
  listServiceAppointmentsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<import("./types").ServiceAppointment[]>;
  listVendorContinuationsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<import("./types").VendorContinuation[]>;
  findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId): Promise<WorkOrderAssignment | null>;
  findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId): Promise<WorkOrderAssignment | null>;
  vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId): Promise<boolean>;
  findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }): Promise<VisitSession | null>;
  listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]>;
  allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number): Promise<string>;

  // Manager-first, server-scoped read models.
  searchStores(scope: OrganizationScope, search: string, page?: PageRequest): Promise<StoreSearchPage>;
  searchAssets(scope: OrganizationScope, search: string, page?: PageRequest): Promise<AssetSearchPage>;
  getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null>;
  listRequests(scope: OrganizationScope, query?: PageRequest & { search?: string; status?: string; storeId?: OpsId }): Promise<RequestListPage>;
  listWorkOrders(scope: OrganizationScope, query?: WorkOrderListQuery): Promise<WorkOrderListPage>;
  getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null>;
  /** Only invoices associated with this work; includes sibling lines/splits to verify reconciliation. */
  getWorkOrderInvoiceSources(organizationId: OpsId, workOrderId: OpsId): Promise<import("./invoice-reporting").InvoiceReportingSources>;
  getAssetWarrantySources(organizationId: OpsId, assetId: OpsId): Promise<Pick<OpsFixture, "repairItems" | "appliedWarranties" | "warrantyAmendments" | "manufacturerWarranties" | "warrantyCases">>;
  listVendors(scope: OrganizationScope, search?: string, page?: PageRequest): Promise<VendorDirectoryPage>;
  listVisits(scope: OrganizationScope, query?: PageRequest & { search?: string; status?: string; storeId?: OpsId; vendorId?: OpsId; review?: boolean }): Promise<VisitListPage>;
  listExceptions(scope: OrganizationScope, query?: ExceptionQueueQuery): Promise<ExceptionQueuePage>;
  getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null>;
  listPmOccurrences(scope: OrganizationScope, query?: PageRequest & { status?: string; storeId?: OpsId }): Promise<PmOccurrencePage>;
  getExecutiveSnapshot(
    scope: OrganizationScope,
    period: { startsAt: IsoDateTime; endsAt: IsoDateTime },
  ): Promise<ExecutiveSnapshotView>;

  // Public workflows resolve an opaque token first, then return a deliberately
  // narrow projection. A public token never grants arbitrary repository reads.
  getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView | null>;
  getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView | null>;
  getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView | null>;
  getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView | null>;
  getEstimateRequestByPublicToken(input: PublicTokenLookup): Promise<EstimateRequestPublicCapability | null>;
  getServiceRunByPublicToken(input: PublicTokenLookup): Promise<ServiceRunPublicCapability | null>;
  getVisitByCheckoutToken(input: PublicTokenLookup): Promise<VisitCheckoutCapability | null>;
  getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView | null>;

  // Durable adapters execute the statement list in one database transaction.
  // Fixture repositories apply it to a cloned fixture before committing it.
  atomicWrite(statements: readonly OpsStatement[]): Promise<void>;

  // Outbox delivery-worker support. These run in a platform job context with
  // no user session; every method remains organization-keyed so a message can
  // never be settled against the wrong tenant.
  listDueOutboxMessages(now: IsoDateTime, limit: number): Promise<OutboxMessage[]>;
  listStaleProcessingOutboxMessages(staleBefore: IsoDateTime, limit: number): Promise<OutboxMessage[]>;
  /** Conditionally transitions one pending message to processing. Returns false when another worker holds it. */
  claimOutboxMessage(organizationId: OpsId, id: OpsId, claimedAt: IsoDateTime): Promise<boolean>;
  recordOutboxDeliveryOutcome(input: OutboxDeliveryOutcome): Promise<void>;

  // SLA escalation worker support (same platform job context as the outbox).
  /** Open tasks whose due time has passed, oldest due first, across tenants. */
  listOverdueEscalationCandidates(now: IsoDateTime, limit: number): Promise<WorkflowTask[]>;
  /** Claims one org+job+slot combination; returns false when the slot already ran. */
  tryBeginJobRun(input: { organizationId: OpsId; jobRunId: OpsId; jobType: string; slotKey: string; startedAt: IsoDateTime }): Promise<boolean>;
  finishJobRun(input: { organizationId: OpsId; jobRunId: OpsId; status: "succeeded" | "failed"; finishedAt: IsoDateTime; processedCount: number; failedCount: number }): Promise<void>;

  // PM recurrence + job-health support (same platform job/admin context).
  listPmPlans(organizationId: OpsId): Promise<PmPlan[]>;
  /** Deliberately cross-tenant read reserved for the platform recurrence worker. */
  listAllPmPlansForWorker(): Promise<PmPlan[]>;
  /** Deliberately cross-tenant read reserved for the compliance worker. */
  listAllVendorComplianceDocumentsForWorker(): Promise<VendorComplianceDocument[]>;
  listPmOccurrencesForPlan(organizationId: OpsId, planId: OpsId): Promise<PmOccurrence[]>;
  listRecentJobRuns(organizationId: OpsId, limit: number): Promise<JobRun[]>;
  outboxStatusCounts(organizationId: OpsId): Promise<Array<{ status: string; count: number }>>;
  listSavedViews(organizationId: OpsId, ownerMembershipId: OpsId, surface: string): Promise<SavedView[]>;
  putSavedView(input: { organizationId: OpsId; id: OpsId; ownerMembershipId: OpsId; surface: string; name: string; queryString: string; createdAt: IsoDateTime }): Promise<void>;
  deleteSavedView(organizationId: OpsId, ownerMembershipId: OpsId, id: OpsId): Promise<boolean>;}

export type OutboxDeliveryOutcome =
  | { outcome: "delivered"; organizationId: OpsId; id: OpsId; deliveredAt: IsoDateTime }
  | { outcome: "retry"; organizationId: OpsId; id: OpsId; retryAt: IsoDateTime; lastError: string }
  | { outcome: "failed"; organizationId: OpsId; id: OpsId; lastError: string };

export interface MutableOpsFixtureRepository extends OpsRepository {
  readonly kind: "fixture";
  snapshot(): OpsFixture;
}
