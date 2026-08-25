import type { JobRun, OutboxMessage, PmOccurrence, PmPlan, SavedView, ServiceAppointment, VendorContinuation, VendorResponse } from "./types";
import type { OutboxDeliveryOutcome } from "./repository";
import {
  NORTHLINE_AS_OF,
  NORTHLINE_DEMO_ENTRY_TOKENS,
  NORTHLINE_DEMO_TOKEN_HASHES,
  buildNorthlinePresentationFixture,
} from "./fixtures";
import { OpsDomainError } from "./errors";
import type {
  ExceptionQueueQuery,
  MutableOpsFixtureRepository,
  OpsRepository,
  OpsStatement,
  OrganizationScope,
  PublicTokenLookup,
  WorkOrderListQuery,
} from "./repository";
import type {
  IdempotencyKey,
  IsoDateTime,
  LifecycleRecommendation,
  ApprovalRequest,
  Asset,
  AssetReplacementOverride,
  OpsFixture,
  OpsId,
  Page,
  PageRequest,
  Store,
  StoredFile,
  ReplacementBenchmark,
  ReplacementEvent,
  ReplacementProfile,
  RequestImpactAssessment,
  SiteVisitWorkOrder,
  VisitSession,
  WorkOrder,
  WorkOrderVerification,
  WorkflowTask,
} from "./types";
import type {
  ActiveVisitView,
  AssetDetailView,
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

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function normalize(value: string) { return value.trim().toLocaleLowerCase("en-US"); }
function snakeToCamel(value: string) { return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()); }
function formatAddress(store: Store) { return [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "); }
function inPeriod(value: string, startsAt: string, endsAt: string) { return value >= startsAt && value <= endsAt; }

function page<T extends { id: string }>(rows: T[], request: PageRequest = {}): Page<T> {
  const limit = Math.max(1, Math.min(100, request.limit ?? 25));
  const start = request.cursor ? Math.max(0, rows.findIndex((row) => row.id === request.cursor) + 1) : 0;
  const items = rows.slice(start, start + limit);
  return { items, nextCursor: start + limit < rows.length ? items.at(-1)?.id : undefined };
}

function storeAllowed(fixture: OpsFixture, scope: OrganizationScope, storeId: OpsId) {
  const store = fixture.stores.find((row) => row.organizationId === scope.organizationId && row.id === storeId);
  if (!store) return false;
  if (scope.storeIds !== undefined && !scope.storeIds.includes(store.id)) return false;
  if (scope.regionIds !== undefined && (!store.regionId || !scope.regionIds.includes(store.regionId))) return false;
  return true;
}

function exceptionAllowed(fixture: OpsFixture, scope: OrganizationScope, storeId?: OpsId) {
  if (storeId) return storeAllowed(fixture, scope, storeId);
  return scope.storeIds === undefined && scope.regionIds === undefined;
}

function tokenRecord(fixture: OpsFixture, input: PublicTokenLookup) {
  return fixture.publicTokens.find((row) => row.tokenHash === input.tokenHash && row.purpose === input.purpose && row.expiresAt > input.now && !row.revokedAt) ?? null;
}

function locationResult(fixture: OpsFixture, organizationId: OpsId, visitId: OpsId) {
  return fixture.visitEvidence.find((row) => row.organizationId === organizationId && row.visitId === visitId && row.kind === "check_in")?.location?.result ?? "not_requested";
}

function visitRow(fixture: OpsFixture, visit: VisitSession, siteVisitWorkOrder?: SiteVisitWorkOrder): VisitListRow {
  const store = fixture.stores.find((row) => row.organizationId === visit.organizationId && row.id === visit.storeId)!;
  const linkedWorkOrderId = siteVisitWorkOrder?.workOrderId ?? visit.workOrderId;
  const workOrder = linkedWorkOrderId ? fixture.workOrders.find((row) => row.organizationId === visit.organizationId && row.id === linkedWorkOrderId) : undefined;
  return {
    id: visit.id, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name,
    providerKind: visit.providerKind, vendorId: visit.vendorId, internalMembershipId: visit.internalMembershipId,
    providerName: visit.providerName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number,
    technicianName: visit.technicianName, crewCount: visit.crewCount ?? 1,
    additionalTechnicianNames: visit.additionalTechnicianNames ?? [], vehicleIdentifier: visit.vehicleIdentifier,
    arrivalNote: visit.arrivalNote, purpose: visit.purpose, status: visit.status,
    checkedInAt: visit.checkedInAt, checkedOutAt: visit.checkedOutAt, outcome: visit.outcome,
    workOutcome: siteVisitWorkOrder?.outcome, workOutcomeNotes: siteVisitWorkOrder?.outcomeNotes,
    workFollowUpId: siteVisitWorkOrder?.followUpId,
    locationResult: locationResult(fixture, visit.organizationId, visit.id), approximateObservedSeconds: visit.observedDurationSeconds,
  };
}

function workOrderRow(fixture: OpsFixture, workOrder: WorkOrder): WorkOrderListRow {
  const store = fixture.stores.find((row) => row.organizationId === workOrder.organizationId && row.id === workOrder.storeId)!;
  const assignment = fixture.assignments.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).at(-1);
  const vendor = assignment?.vendorId ? fixture.vendors.find((row) => row.organizationId === workOrder.organizationId && row.id === assignment.vendorId) : undefined;
  return {
    id: workOrder.id, number: workOrder.number, storeId: store.id, storeNumber: store.storeNumber,
    storeName: store.name, problem: workOrder.problem, categoryKey: workOrder.categoryKey,
    priority: workOrder.priority, status: workOrder.status, assignmentKind: assignment?.kind ?? "choose_later",
    assignmentStatus: assignment?.status, vendorId: vendor?.id, vendorName: vendor?.name,
    accountableParty: workOrder.accountableParty, nextAction: workOrder.nextAction, dueAt: workOrder.dueAt,
    createdAt: workOrder.createdAt, visitCount: new Set(fixture.siteVisitWorkOrders.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).map((row) => row.visitId)).size,
    recordedCostMinor: fixture.costLines.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).reduce((sum, row) => sum + row.amount.amountMinor, 0), currency: "USD",
  };
}

function requestRow(fixture: OpsFixture, request: OpsFixture["requests"][number]): RequestListRow {
  const store = fixture.stores.find((row) => row.organizationId === request.organizationId && row.id === request.storeId)!;
  return { id: request.id, reference: request.reference, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, reporterName: request.reporterName, problem: request.problem, priority: request.priority, status: request.status, submittedAt: request.submittedAt, convertedWorkOrderId: request.convertedWorkOrderId };
}

function mapTable(fixture: OpsFixture, table: string): Array<Record<string, unknown>> {
  const mapping: Record<string, keyof OpsFixture> = {
    ops_divisions: "divisions", ops_regions: "regions", ops_taxonomy_nodes: "taxonomyNodes",
    ops_equipment_templates: "equipmentTemplates", ops_component_templates: "componentTemplates",
    ops_stores: "stores", ops_users: "users", ops_memberships: "memberships",
    ops_scope_grants: "scopeGrants", ops_vendors: "vendors", ops_vendor_specialties: "vendorSpecialties",
    ops_vendor_coverage: "vendorCoverage", ops_vendor_qualifications: "vendorQualifications", ops_vendor_compliance_documents: "vendorComplianceDocuments",
    ops_vendor_contracts: "vendorContracts", ops_contract_versions: "contractVersions", ops_contract_scopes: "contractScopes",
    ops_rate_card_lines: "rateCardLines", ops_service_level_policies: "serviceLevelPolicies", ops_scheduling_policies: "schedulingPolicies", ops_vendor_capacity: "vendorCapacity",
    ops_requests: "requests", ops_request_impact_assessments: "requestImpactAssessments", ops_work_orders: "workOrders",
    ops_approval_policies: "approvalPolicies", ops_approval_requests: "approvalRequests", ops_approval_decisions: "approvalDecisions",
    ops_work_order_assignments: "assignments", ops_work_order_issuances: "issuances",
    ops_vendor_responses: "vendorResponses", ops_work_order_estimate_requests: "estimateRequests",
    ops_vendor_estimate_proposals: "estimateProposals", ops_visit_sessions: "visits", ops_site_visit_work_orders: "siteVisitWorkOrders", ops_work_order_verifications: "workOrderVerifications", ops_visit_evidence: "visitEvidence",
    ops_files: "files", ops_entity_files: "entityFiles",
    ops_follow_ups: "followUps", ops_workflow_tasks: "workflowTasks",
    ops_workflow_task_sla_pauses: "workflowTaskSlaPauses", ops_workflow_task_sla_resumes: "workflowTaskSlaResumes",
    ops_exceptions: "exceptions", ops_assets: "assets",
    ops_replacement_profiles: "replacementProfiles", ops_replacement_benchmarks: "replacementBenchmarks",
    ops_asset_replacement_overrides: "assetReplacementOverrides", ops_replacement_events: "replacementEvents", ops_lifecycle_recommendations: "lifecycleRecommendations",
    ops_asset_components: "components", ops_component_lifecycle_events: "componentLifecycleEvents", ops_maintenance_programs: "maintenancePrograms", ops_checklist_templates: "checklistTemplates", ops_pm_plans: "pmPlans", ops_pm_occurrences: "pmOccurrences",
    ops_pm_work_items: "pmWorkItems", ops_checklist_responses: "checklistResponses", ops_service_runs: "serviceRuns", ops_route_stops: "routeStops",
    ops_service_run_work_orders: "serviceRunWorkOrders", ops_service_run_responses: "serviceRunResponses",
    ops_vendor_warranty_profiles: "vendorWarrantyProfiles", ops_warranty_rules: "warrantyRules", ops_warranty_coverage_lines: "warrantyCoverageLines",
    ops_repair_items: "repairItems", ops_applied_warranties: "appliedWarranties", ops_warranty_amendments: "warrantyAmendments",
    ops_manufacturer_warranties: "manufacturerWarranties", ops_warranty_cases: "warrantyCases", ops_quotes: "quotes", ops_authorizations: "authorizations",
    ops_invoices: "invoices", ops_invoice_lines: "invoiceLines", ops_invoice_line_allocations: "invoiceLineAllocations", ops_invoice_exceptions: "invoiceExceptions",
    ops_invoice_adjustments: "invoiceAdjustments", ops_service_discrepancies: "serviceDiscrepancies", ops_value_events: "valueEvents",
    ops_cost_lines: "costLines", ops_invoice_references: "invoiceReferences", ops_invoice_allocations: "invoiceAllocations",
    ops_audit_events: "auditEvents", ops_outbox_messages: "outboxMessages", ops_job_runs: "jobRuns", ops_service_appointments: "serviceAppointments", ops_vendor_continuations: "vendorContinuations", ops_saved_views: "savedViews", ops_public_tokens: "publicTokens",
  };
  const key = mapping[table];
  if (!key) throw new Error(`Fixture repository does not support table ${table}`);
  return fixture[key] as unknown as Array<Record<string, unknown>>;
}

function hydrateInserted(table: string, raw: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => { row[snakeToCamel(key)] = value; });
  if (table === "ops_taxonomy_nodes") { row.aliases = JSON.parse(String(row.aliasesJson ?? "[]")); row.active = Boolean(row.active); delete row.aliasesJson; }
  if (table === "ops_equipment_templates") row.active = Boolean(row.active);
  if (table === "ops_lifecycle_recommendations") { row.missingData = JSON.parse(String(row.missingDataJson ?? "[]")); delete row.missingDataJson; }
  if (table === "ops_component_lifecycle_events") { row.laborCost = { amountMinor: row.laborCostMinor, currency: row.currency }; row.partCost = { amountMinor: row.partCostMinor, currency: row.currency }; delete row.laborCostMinor; delete row.partCostMinor; delete row.currency; }
  if (table === "ops_stores") { row.aliases = JSON.parse(String(row.aliasesJson ?? "[]")); row.locationPolicyEnabled = Boolean(row.locationPolicyEnabled); delete row.aliasesJson; delete row.searchText; }
  if (table === "ops_vendors") { row.preferred = Boolean(row.preferred); delete row.searchText; }
  if (table === "ops_vendor_specialties") { row.searchAliases = JSON.parse(String(row.searchAliasesJson ?? "[]")); delete row.searchAliasesJson; }
  if (table === "ops_vendor_qualifications") { row.pmWork = Boolean(row.pmWork); row.emergencyResponse = Boolean(row.emergencyResponse); row.warrantyWork = Boolean(row.warrantyWork); row.afterHours = Boolean(row.afterHours); if (row.maximumJobAmountMinor !== undefined) row.maximumJobAmount = { amountMinor: row.maximumJobAmountMinor, currency: row.currency ?? "USD" }; delete row.maximumJobAmountMinor; delete row.currency; }
  if (table === "ops_vendor_compliance_documents") row.blocking = Boolean(row.blocking);
  if (table === "ops_contract_versions") { row.preferredProvider = Boolean(row.preferredProvider); row.exclusiveProvider = Boolean(row.exclusiveProvider); row.reactiveWorkAllowed = Boolean(row.reactiveWorkAllowed); row.emergencyWorkAllowed = Boolean(row.emergencyWorkAllowed); row.pmWorkAllowed = Boolean(row.pmWorkAllowed); row.evidenceRequirements = JSON.parse(String(row.evidenceRequirementsJson ?? "[]")); row.complianceRequirements = JSON.parse(String(row.complianceRequirementsJson ?? "[]")); if (row.nteAmountMinor !== undefined) row.nteAmount = { amountMinor: row.nteAmountMinor, currency: row.currency }; delete row.evidenceRequirementsJson; delete row.complianceRequirementsJson; delete row.nteAmountMinor; }
  if (table === "ops_contract_scopes") row.included = Boolean(row.included);
  if (table === "ops_rate_card_lines") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_vendor_capacity") { row.blackout = Boolean(row.blackout); row.specialEquipment = JSON.parse(String(row.specialEquipmentJson ?? "[]")); delete row.specialEquipmentJson; }
  if (table === "ops_maintenance_programs") { row.applicableAssetTypes = JSON.parse(String(row.applicableAssetTypesJson ?? "[]")); row.requiredEvidenceKinds = JSON.parse(String(row.requiredEvidenceKindsJson ?? "[]")); delete row.applicableAssetTypesJson; delete row.requiredEvidenceKindsJson; }
  if (table === "ops_checklist_templates") { row.items = JSON.parse(String(row.itemsJson ?? "[]")); delete row.itemsJson; }
  if (table === "ops_pm_work_items") { /* scalar row already matches the domain record */ }
  if (table === "ops_checklist_responses") { row.evidenceFileIds = JSON.parse(String(row.evidenceFileIdsJson ?? "[]")); delete row.evidenceFileIdsJson; }
  if (table === "ops_service_runs") { row.expectedWorkValue = { amountMinor: row.expectedWorkValueMinor, currency: row.currency }; row.estimatedOpportunity = { amountMinor: row.estimatedOpportunityMinor, currency: row.currency }; row.requiredQualifications = JSON.parse(String(row.requiredQualificationsJson ?? "[]")); delete row.expectedWorkValueMinor; delete row.estimatedOpportunityMinor; delete row.requiredQualificationsJson; delete row.currency; }
  if (table === "ops_route_stops") { /* scalar row already matches the domain record */ }
  if (table === "ops_service_run_work_orders") { row.planned = Boolean(row.planned); row.addressed = Boolean(row.addressed); }
  if (table === "ops_service_run_responses") { row.economicImpact = { amountMinor: row.economicImpactMinor, currency: row.currency }; delete row.economicImpactMinor; delete row.currency; }
  if (table === "ops_warranty_coverage_lines") { row.deductible = { amountMinor: row.deductibleMinor, currency: row.currency }; if (row.maximumCoverageMinor !== undefined) row.maximumCoverage = { amountMinor: row.maximumCoverageMinor, currency: row.currency }; delete row.deductibleMinor; delete row.maximumCoverageMinor; delete row.currency; }
  if (table === "ops_repair_items") { row.laborCost = { amountMinor: row.laborCostMinor, currency: row.currency }; row.partCost = { amountMinor: row.partCostMinor, currency: row.currency }; row.vendorSupplied = Boolean(row.vendorSupplied); delete row.laborCostMinor; delete row.partCostMinor; delete row.currency; }
  if (table === "ops_applied_warranties") { row.coveredCharges = JSON.parse(String(row.coveredChargesJson ?? "[]")); delete row.coveredChargesJson; }
  if (table === "ops_warranty_amendments") row.appliesToRepairOnly = Boolean(row.appliesToRepairOnly);
  if (table === "ops_warranty_cases") { row.diagnosisRequired = Boolean(row.diagnosisRequired); row.invoiceHold = Boolean(row.invoiceHold); }
  if (table === "ops_quotes") { for (const key of ["subtotal", "tax", "fees", "total"]) { row[key] = { amountMinor: row[`${key}Minor`], currency: row.currency }; delete row[`${key}Minor`]; } delete row.currency; }
  if (table === "ops_authorizations") { row.authorizedAmount = { amountMinor: row.authorizedAmountMinor, currency: row.currency }; delete row.authorizedAmountMinor; delete row.currency; }
  if (table === "ops_invoices") { for (const key of ["subtotal", "tax", "fees", "total", "approvedForPayment", "paidAmount"]) { row[key] = { amountMinor: row[`${key}Minor`], currency: row.currency }; delete row[`${key}Minor`]; } delete row.currency; }
  if (table === "ops_invoice_lines") { row.unitAmount = { amountMinor: row.unitAmountMinor, currency: row.currency }; row.lineAmount = { amountMinor: row.lineAmountMinor, currency: row.currency }; delete row.unitAmountMinor; delete row.lineAmountMinor; delete row.currency; }
  if (table === "ops_invoice_line_allocations" || table === "ops_invoice_exceptions" || table === "ops_invoice_adjustments" || table === "ops_value_events") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_work_orders") {
    if (row.nteAmountMinor !== undefined) row.nte = { amountMinor: row.nteAmountMinor, currency: row.nteCurrency ?? "USD" };
    if (row.repairEstimateAmountMinor !== undefined) row.repairEstimate = { amountMinor: row.repairEstimateAmountMinor, currency: row.repairEstimateCurrency ?? "USD" };
    delete row.nteAmountMinor;
    delete row.nteCurrency;
    delete row.repairEstimateAmountMinor;
    delete row.repairEstimateCurrency;
  }
  if (table === "ops_visit_sessions") {
    row.crewCount = Number(row.crewCount ?? 1);
    row.additionalTechnicianNames = JSON.parse(String(row.additionalTechnicianNamesJson ?? "[]"));
    delete row.additionalTechnicianNamesJson;
  }
  if (table === "ops_visit_evidence") { row.location = { result: row.locationResult ?? "not_requested", latitudeE6: row.latitudeE6, longitudeE6: row.longitudeE6, accuracyM: row.accuracyM, distanceM: row.distanceM, capturedAt: row.observedAt }; delete row.locationResult; delete row.latitudeE6; delete row.longitudeE6; delete row.accuracyM; delete row.distanceM; }
  if (table === "ops_cost_lines") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_vendor_estimate_proposals") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_invoice_references") { row.grossAmount = { amountMinor: row.grossAmountMinor, currency: row.currency }; delete row.grossAmountMinor; delete row.currency; }
  if (table === "ops_invoice_allocations") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_assets") {
    row.groupPath = JSON.parse(String(row.groupPathJson ?? "[]"));
    row.replacementAttributes = JSON.parse(String(row.replacementAttributesJson ?? "{}"));
    delete row.groupPathJson;
    delete row.replacementAttributesJson;
    if (row.replacementEstimateMinor !== undefined) row.replacementEstimate = { amountMinor: row.replacementEstimateMinor, currency: row.replacementCurrency ?? "USD" };
    delete row.replacementEstimateMinor;
    delete row.replacementCurrency;
  }
  if (table === "ops_request_impact_assessments") {
    if (row.productInventoryValueMinor !== undefined) row.productInventoryValue = { amountMinor: row.productInventoryValueMinor, currency: row.productInventoryCurrency ?? "USD" };
    if (row.estimatedDailyRevenueExposureMinor !== undefined) row.estimatedDailyRevenueExposure = { amountMinor: row.estimatedDailyRevenueExposureMinor, currency: row.estimatedDailyRevenueExposureCurrency ?? "USD" };
    delete row.productInventoryValueMinor;
    delete row.productInventoryCurrency;
    delete row.estimatedDailyRevenueExposureMinor;
    delete row.estimatedDailyRevenueExposureCurrency;
  }
  if (table === "ops_approval_requests") {
    row.amount = { amountMinor: row.amountMinor, currency: row.currency ?? "USD" };
    delete row.amountMinor;
    delete row.currency;
  }
  if (table === "ops_workflow_tasks") {
    row.blocking = Boolean(row.blocking);
    row.requiredForProgress = Boolean(row.requiredForProgress);
  }
  if (table === "ops_workflow_task_sla_pauses") {
    row.affectedClocks = JSON.parse(String(row.affectedClocksJson ?? "[]"));
    delete row.affectedClocksJson;
  }
  if (table === "ops_replacement_profiles") {
    row.matchKeys = JSON.parse(String(row.matchKeysJson ?? "[]"));
    row.attributes = JSON.parse(String(row.attributesJson ?? "{}"));
    row.active = Boolean(row.active);
    delete row.matchKeysJson;
    delete row.attributesJson;
  }
  if (table === "ops_replacement_benchmarks") {
    const currency = String(row.currency ?? "USD");
    row.equipmentAmount = { amountMinor: row.equipmentAmountMinor, currency };
    row.installationAmount = { amountMinor: row.installationAmountMinor, currency };
    row.otherAmount = { amountMinor: row.otherAmountMinor, currency };
    row.totalAmount = { amountMinor: row.totalAmountMinor, currency };
    delete row.equipmentAmountMinor; delete row.installationAmountMinor; delete row.otherAmountMinor; delete row.totalAmountMinor; delete row.currency;
  }
  if (table === "ops_asset_replacement_overrides") {
    row.amount = { amountMinor: row.amountMinor, currency: row.currency ?? "USD" };
    delete row.amountMinor; delete row.currency;
  }
  if (table === "ops_replacement_events") {
    row.approvedAmount = { amountMinor: row.approvedAmountMinor, currency: row.currency ?? "USD" };
    if (row.finalAmountMinor !== undefined) row.finalAmount = { amountMinor: row.finalAmountMinor, currency: row.currency ?? "USD" };
    delete row.approvedAmountMinor; delete row.finalAmountMinor; delete row.currency;
  }
  if (table === "ops_pm_plans") row.active = Boolean(row.active);
  return row;
}

function assertEstimateRequestUniqueness(rows: Array<Record<string, unknown>>) {
  const active = new Set<string>();
  const selected = new Set<string>();
  for (const row of rows) {
    if (["requested", "opened", "submitted"].includes(String(row.status))) {
      const key = `${String(row.organizationId)}:${String(row.workOrderId)}:${String(row.vendorId)}`;
      if (active.has(key)) throw new Error("Duplicate active vendor-estimate request");
      active.add(key);
    }
    if (row.status === "selected") {
      const key = `${String(row.organizationId)}:${String(row.workOrderId)}`;
      if (selected.has(key)) throw new Error("Work order already has a selected vendor bid");
      selected.add(key);
    }
  }
}

function assertActiveAssignmentUniqueness(rows: Array<Record<string, unknown>>) {
  const active = new Set<string>();
  for (const row of rows) {
    if (!["pending", "issued", "opened", "accepted"].includes(String(row.status))) continue;
    const key = `${String(row.organizationId)}:${String(row.workOrderId)}`;
    if (active.has(key)) throw new Error("Work order already has an active assignment");
    active.add(key);
  }
}

function assertReplacementUniqueness(table: string, rows: Array<Record<string, unknown>>) {
  const keys = new Set<string>();
  for (const row of rows) {
    if (table === "ops_replacement_benchmarks" && row.status === "published") {
      const key = `${String(row.organizationId)}:${String(row.profileId)}`;
      if (keys.has(key)) throw new Error("Replacement profile already has a published benchmark");
      keys.add(key);
    }
    if (table === "ops_asset_replacement_overrides" && row.status === "active") {
      const key = `${String(row.organizationId)}:${String(row.assetId)}`;
      if (keys.has(key)) throw new Error("Equipment already has an active replacement override");
      keys.add(key);
    }
  }
}

function applyStatement(fixture: OpsFixture, idempotencyKeys: IdempotencyKey[], statement: OpsStatement) {
  const insertMatch = statement.sql.match(/^INSERT INTO ([a-z0-9_]+) \((.+)\) VALUES \((.+)\)$/i);
  if (insertMatch) {
    const table = insertMatch[1]; const columns = insertMatch[2].split(",").map((item) => item.trim());
    const raw = Object.fromEntries(columns.map((column, index) => [column, statement.params[index]]));
    const rows = table === "ops_idempotency_keys"
      ? idempotencyKeys as unknown as Array<Record<string, unknown>>
      : mapTable(fixture, table);
    const row = hydrateInserted(table, raw);
    if (row.id && rows.some((item) => item.id === row.id)) throw new Error(`Duplicate fixture id ${String(row.id)}`);
    if (table === "ops_idempotency_keys" && rows.some((item) => item.organizationId === row.organizationId && item.key === row.key)) throw new Error(`Duplicate idempotency key ${String(row.key)}`);
    if (table === "ops_idempotency_keys" && row.command === "request.version_fence") {
      const [guardOrganizationId, guardRequestId, guardVersion, guardStatus, guardConvertedWorkOrderId] = statement.params.slice(7);
      const request = fixture.requests.find((item) => item.organizationId === guardOrganizationId && item.id === guardRequestId);
      if (!request
        || (request.version ?? 0) !== guardVersion
        || request.status !== guardStatus
        || (request.convertedWorkOrderId ?? "") !== guardConvertedWorkOrderId) {
        throw new OpsDomainError("CONFLICT", "This request changed. Refresh before trying again.");
      }
    }
    if (table === "ops_work_order_issuances" && rows.some((item) => item.organizationId === row.organizationId && item.workOrderId === row.workOrderId && item.revision === row.revision)) throw new Error(`Duplicate work-order issuance revision ${String(row.revision)}`);
    if (table === "ops_vendor_estimate_proposals" && rows.some((item) => item.organizationId === row.organizationId && item.requestId === row.requestId && item.revision === row.revision)) throw new Error(`Duplicate vendor-estimate proposal revision ${String(row.revision)}`);
    if (table === "ops_public_tokens" && rows.some((item) => item.tokenHash === row.tokenHash)) throw new Error("Duplicate public token hash");
    if (table === "ops_work_orders" && row.requestId != null && rows.some((item) => item.organizationId === row.organizationId && item.requestId === row.requestId)) {
      throw new OpsDomainError("CONFLICT", "Request already has a canonical work order");
    }
    if (table === "ops_approval_decisions" && rows.some((item) => item.organizationId === row.organizationId && item.approvalRequestId === row.approvalRequestId)) throw new Error("Approval request already has an immutable decision");
    if (table === "ops_workflow_tasks" && row.sourceFollowUpId != null && rows.some((item) => item.organizationId === row.organizationId && item.sourceFollowUpId === row.sourceFollowUpId)) throw new Error("Follow-up already has a workflow task");
    if (table === "ops_workflow_tasks" && row.sourceApprovalRequestId != null && rows.some((item) => item.organizationId === row.organizationId && item.sourceApprovalRequestId === row.sourceApprovalRequestId)) throw new Error("Approval request already has a workflow task");
    if (table === "ops_workflow_task_sla_pauses") {
      const resumes = mapTable(fixture, "ops_workflow_task_sla_resumes");
      const activePause = rows.find((item) => item.organizationId === row.organizationId && item.workflowTaskId === row.workflowTaskId && !resumes.some((resume) => resume.organizationId === item.organizationId && resume.pauseId === item.id));
      if (activePause) throw new Error("Workflow task already has an active SLA pause");
    }
    if (table === "ops_workflow_task_sla_resumes" && rows.some((item) => item.organizationId === row.organizationId && item.pauseId === row.pauseId)) throw new Error("SLA pause already has an immutable resume");
    if (table === "ops_site_visit_work_orders" && rows.some((item) => item.organizationId === row.organizationId && (item.visitId === row.visitId && item.workOrderId === row.workOrderId || item.visitId === row.visitId && item.ordinal === row.ordinal))) throw new Error("Visit work selection is duplicated");
    if (table === "ops_work_order_verifications" && rows.some((item) => item.organizationId === row.organizationId && (item.siteVisitWorkOrderId === row.siteVisitWorkOrderId || item.workOrderId === row.workOrderId && item.cycle === row.cycle))) throw new Error("Work-order verification decision is duplicated");
    if (table === "ops_visit_evidence" && ["check_in", "check_out"].includes(String(row.kind)) && rows.some((item) => item.organizationId === row.organizationId && item.visitId === row.visitId && item.kind === row.kind)) throw new Error(`Visit already has ${String(row.kind)} evidence`);
    rows.push(row);
    if (table === "ops_work_order_estimate_requests") assertEstimateRequestUniqueness(rows);
    if (table === "ops_work_order_assignments") assertActiveAssignmentUniqueness(rows);
    if (table.startsWith("ops_replacement_") || table === "ops_asset_replacement_overrides") assertReplacementUniqueness(table, rows);
    return;
  }
  const updateMatch = statement.sql.match(/^UPDATE ([a-z0-9_]+) SET (.+) WHERE (.+)$/i);
  if (updateMatch) {
    const table = updateMatch[1]; const setColumns = [...updateMatch[2].matchAll(/([a-z0-9_]+) = \?/gi)].map((match) => match[1]);
    const whereColumns = [...updateMatch[3].matchAll(/([a-z0-9_]+) = \?/gi)].map((match) => match[1]);
    const setValues = statement.params.slice(0, setColumns.length); const whereValues = statement.params.slice(setColumns.length);
    const rows = mapTable(fixture, table);
    rows.filter((row) => whereColumns.every((column, index) => row[snakeToCamel(column)] === whereValues[index])).forEach((row) => setColumns.forEach((column, index) => {
      if (table === "ops_assets" && column === "replacement_attributes_json") row.replacementAttributes = JSON.parse(String(setValues[index] ?? "{}"));
      else if (table === "ops_replacement_events" && column === "final_amount_minor") row.finalAmount = { amountMinor: setValues[index], currency: (row.approvedAmount as { currency?: string } | undefined)?.currency ?? "USD" };
      else if (table === "ops_invoices" && column === "approved_for_payment_minor") row.approvedForPayment = { amountMinor: setValues[index], currency: (row.total as { currency?: string } | undefined)?.currency ?? "USD" };
      else if (table === "ops_site_visit_work_orders" && setValues[index] === null) row[snakeToCamel(column)] = undefined;
      else row[snakeToCamel(column)] = setValues[index];
    }));
    if (table === "ops_work_order_estimate_requests") assertEstimateRequestUniqueness(rows);
    if (table === "ops_work_order_assignments") assertActiveAssignmentUniqueness(rows);
    if (table.startsWith("ops_replacement_") || table === "ops_asset_replacement_overrides") assertReplacementUniqueness(table, rows);
    return;
  }
  throw new Error(`Fixture repository cannot execute statement: ${statement.sql}`);
}

class FixtureOpsRepository implements MutableOpsFixtureRepository {
  readonly kind = "fixture" as const;
  private counters = new Map<string, number>();
  private idempotencyKeys: IdempotencyKey[] = [];
  constructor(private fixture: OpsFixture) {
    this.fixture.requests.forEach((request) => { request.version ??= 0; });
    this.fixture.workOrders.forEach((workOrder) => { workOrder.version ??= 0; });
    for (const organization of fixture.organizations) {
      const max = fixture.workOrders.filter((row) => row.organizationId === organization.id).map((row) => Number(row.number.match(/(\d+)$/)?.[1] ?? 0)).reduce((highest, value) => Math.max(highest, value), 0);
      this.counters.set(`${organization.id}:2026`, max + 1);
    }
  }
  snapshot() { return clone(this.fixture); }

  async getOrganization(organizationId: OpsId) { return clone(this.fixture.organizations.find((row) => row.id === organizationId) ?? null); }
  async getDivision(organizationId: OpsId, divisionId: OpsId) { return clone(this.fixture.divisions.find((row) => row.organizationId === organizationId && row.id === divisionId) ?? null); }
  async getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId) { return clone(this.fixture.taxonomyNodes.find((row) => row.organizationId === organizationId && row.id === taxonomyNodeId) ?? null); }
  async listTaxonomyNodes(organizationId: OpsId) { return clone(this.fixture.taxonomyNodes.filter((row) => row.organizationId === organizationId).sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))); }
  async getEquipmentTemplate(organizationId: OpsId, templateId: OpsId) { return clone(this.fixture.equipmentTemplates.find((row) => row.organizationId === organizationId && row.id === templateId) ?? null); }
  async listEquipmentTemplates(organizationId: OpsId) { return clone(this.fixture.equipmentTemplates.filter((row) => row.organizationId === organizationId).sort((a, b) => a.taxonomyNodeId.localeCompare(b.taxonomyNodeId) || a.name.localeCompare(b.name))); }
  async listComponentTemplates(organizationId: OpsId, equipmentTemplateId: OpsId) { return clone(this.fixture.componentTemplates.filter((row) => row.organizationId === organizationId && row.equipmentTemplateId === equipmentTemplateId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))); }
  async getStore(organizationId: OpsId, storeId: OpsId) { return clone(this.fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId) ?? null); }
  async getVendor(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendors.find((row) => row.organizationId === organizationId && row.id === vendorId) ?? null); }
  async getMembership(organizationId: OpsId, membershipId: OpsId) { return clone(this.fixture.memberships.find((row) => row.organizationId === organizationId && row.id === membershipId) ?? null); }
  async listScopeGrantsForMembership(organizationId: OpsId, membershipId: OpsId) { return clone(this.fixture.scopeGrants.filter((row) => row.organizationId === organizationId && row.membershipId === membershipId).sort((left, right) => left.scopeKind.localeCompare(right.scopeKind) || left.scopeId.localeCompare(right.scopeId) || left.id.localeCompare(right.id))); }
  async getRequest(organizationId: OpsId, requestId: OpsId) { return clone(this.fixture.requests.find((row) => row.organizationId === organizationId && row.id === requestId) ?? null); }
  async listRequestImpactAssessments(organizationId: OpsId, requestId: OpsId): Promise<RequestImpactAssessment[]> { return clone(this.fixture.requestImpactAssessments.filter((row) => row.organizationId === organizationId && row.requestId === requestId).sort((left, right) => left.assessedAt.localeCompare(right.assessedAt) || left.id.localeCompare(right.id))); }
  async getWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === workOrderId) ?? null); }
  async getApprovalPolicy(organizationId: OpsId, policyId: OpsId) { return clone(this.fixture.approvalPolicies.find((row) => row.organizationId === organizationId && row.id === policyId) ?? null); }
  async listApprovalPolicies(organizationId: OpsId) { return clone(this.fixture.approvalPolicies.filter((row) => row.organizationId === organizationId).sort((a, b) => a.policyKey.localeCompare(b.policyKey) || b.version - a.version || a.id.localeCompare(b.id))); }
  async getApprovalRequest(organizationId: OpsId, approvalRequestId: OpsId) { return clone(this.fixture.approvalRequests.find((row) => row.organizationId === organizationId && row.id === approvalRequestId) ?? null); }
  async listApprovalRequests(organizationId: OpsId) { return clone(this.fixture.approvalRequests.filter((row) => row.organizationId === organizationId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))); }
  async listApprovalRequestsForSubject(organizationId: OpsId, subjectType: ApprovalRequest["subjectType"], subjectId: OpsId) { return clone(this.fixture.approvalRequests.filter((row) => row.organizationId === organizationId && row.subjectType === subjectType && row.subjectId === subjectId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))); }
  async listApprovalDecisionsForRequest(organizationId: OpsId, approvalRequestId: OpsId) { return clone(this.fixture.approvalDecisions.filter((row) => row.organizationId === organizationId && row.approvalRequestId === approvalRequestId).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || b.id.localeCompare(a.id))); }
  async getAsset(organizationId: OpsId, assetId: OpsId) { return clone(this.fixture.assets.find((row) => row.organizationId === organizationId && row.id === assetId) ?? null); }
  async getReplacementProfile(organizationId: OpsId, profileId: OpsId): Promise<ReplacementProfile | null> { return clone(this.fixture.replacementProfiles.find((row) => row.organizationId === organizationId && row.id === profileId) ?? null); }
  async listReplacementProfiles(organizationId: OpsId): Promise<ReplacementProfile[]> { return clone(this.fixture.replacementProfiles.filter((row) => row.organizationId === organizationId).sort((a, b) => a.categoryKey.localeCompare(b.categoryKey) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))); }
  async getPublishedReplacementBenchmark(organizationId: OpsId, profileId: OpsId): Promise<ReplacementBenchmark | null> { return clone(this.fixture.replacementBenchmarks.filter((row) => row.organizationId === organizationId && row.profileId === profileId && row.status === "published").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async listReplacementBenchmarks(organizationId: OpsId, profileId: OpsId): Promise<ReplacementBenchmark[]> { return clone(this.fixture.replacementBenchmarks.filter((row) => row.organizationId === organizationId && row.profileId === profileId).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))); }
  async getActiveAssetReplacementOverride(organizationId: OpsId, assetId: OpsId): Promise<AssetReplacementOverride | null> { return clone(this.fixture.assetReplacementOverrides.filter((row) => row.organizationId === organizationId && row.assetId === assetId && row.status === "active").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async getReplacementEventForProposal(organizationId: OpsId, proposalId: OpsId): Promise<ReplacementEvent | null> { return clone(this.fixture.replacementEvents.find((row) => row.organizationId === organizationId && row.sourceEstimateProposalId === proposalId) ?? null); }
  async getActiveReplacementEventForAsset(organizationId: OpsId, assetId: OpsId): Promise<ReplacementEvent | null> { return clone(this.fixture.replacementEvents.filter((row) => row.organizationId === organizationId && row.assetId === assetId && row.status === "approved").sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async listLifecycleRecommendationsForAsset(organizationId: OpsId, assetId: OpsId): Promise<LifecycleRecommendation[]> { return clone(this.fixture.lifecycleRecommendations.filter((row) => row.organizationId === organizationId && row.assetId === assetId).sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))); }
  async listAssetsForReplacementProfile(organizationId: OpsId, profileId: OpsId): Promise<Asset[]> { return clone(this.fixture.assets.filter((row) => row.organizationId === organizationId && row.replacementProfileId === profileId).sort((a, b) => a.storeId.localeCompare(b.storeId) || a.assetTag.localeCompare(b.assetTag) || a.id.localeCompare(b.id))); }
  async getComponent(organizationId: OpsId, componentId: OpsId) { return clone(this.fixture.components.find((row) => row.organizationId === organizationId && row.id === componentId) ?? null); }
  async getMaintenanceProgram(organizationId: OpsId, programId: OpsId) { return clone(this.fixture.maintenancePrograms.find((row) => row.organizationId === organizationId && row.id === programId) ?? null); }
  async getPmPlan(organizationId: OpsId, planId: OpsId) { return clone(this.fixture.pmPlans.find((row) => row.organizationId === organizationId && row.id === planId) ?? null); }
  async getPmOccurrence(organizationId: OpsId, occurrenceId: OpsId) { return clone(this.fixture.pmOccurrences.find((row) => row.organizationId === organizationId && row.id === occurrenceId) ?? null); }
  async listPmWorkItemsForOccurrence(organizationId: OpsId, occurrenceId: OpsId) { return clone(this.fixture.pmWorkItems.filter((row) => row.organizationId === organizationId && row.occurrenceId === occurrenceId)); }
  async listVendorQualifications(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendorQualifications.filter((row) => row.organizationId === organizationId && row.vendorId === vendorId)); }
  async listVendorComplianceDocuments(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendorComplianceDocuments.filter((row) => row.organizationId === organizationId && row.vendorId === vendorId)); }
  async getContractVersion(organizationId: OpsId, contractVersionId: OpsId) { return clone(this.fixture.contractVersions.find((row) => row.organizationId === organizationId && row.id === contractVersionId) ?? null); }
  async listContractScopes(organizationId: OpsId, contractVersionId: OpsId) { return clone(this.fixture.contractScopes.filter((row) => row.organizationId === organizationId && row.contractVersionId === contractVersionId)); }
  async listRateCardLines(organizationId: OpsId, contractVersionId: OpsId) { return clone(this.fixture.rateCardLines.filter((row) => row.organizationId === organizationId && row.contractVersionId === contractVersionId)); }
  async getSchedulingPolicy(organizationId: OpsId, contractVersionId: OpsId) { return clone(this.fixture.schedulingPolicies.find((row) => row.organizationId === organizationId && row.contractVersionId === contractVersionId) ?? null); }
  async listVendorCapacity(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendorCapacity.filter((row) => row.organizationId === organizationId && row.vendorId === vendorId)); }
  async getServiceRun(organizationId: OpsId, serviceRunId: OpsId) { return clone(this.fixture.serviceRuns.find((row) => row.organizationId === organizationId && row.id === serviceRunId) ?? null); }
  async listRouteStops(organizationId: OpsId, serviceRunId: OpsId) { return clone(this.fixture.routeStops.filter((row) => row.organizationId === organizationId && row.serviceRunId === serviceRunId).sort((a, b) => a.sequence - b.sequence)); }
  async listServiceRunWorkOrders(organizationId: OpsId, serviceRunId: OpsId) { return clone(this.fixture.serviceRunWorkOrders.filter((row) => row.organizationId === organizationId && row.serviceRunId === serviceRunId)); }
  async listServiceRunResponses(organizationId: OpsId, serviceRunId: OpsId) { return clone(this.fixture.serviceRunResponses.filter((row) => row.organizationId === organizationId && row.serviceRunId === serviceRunId).sort((a, b) => a.respondedAt.localeCompare(b.respondedAt))); }
  async listVendorWarrantyProfiles(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendorWarrantyProfiles.filter((row) => row.organizationId===organizationId&&row.vendorId===vendorId).sort((a,b)=>b.effectiveStartsAt.localeCompare(a.effectiveStartsAt))); }
  async getVendorWarrantyProfile(organizationId:OpsId,profileId:OpsId){return clone(this.fixture.vendorWarrantyProfiles.find((row)=>row.organizationId===organizationId&&row.id===profileId)??null)}
  async listWarrantyRules(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.warrantyRules.filter((row)=>row.organizationId===organizationId&&row.vendorId===vendorId).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))); }
  async listWarrantyCoverageLines(organizationId: OpsId, profileId: OpsId) { const ruleIds=new Set(this.fixture.warrantyRules.filter((row)=>row.organizationId===organizationId&&row.vendorWarrantyProfileId===profileId).map((row)=>row.id)); return clone(this.fixture.warrantyCoverageLines.filter((row)=>row.organizationId===organizationId&&(row.vendorWarrantyProfileId===profileId||(row.warrantyRuleId&&ruleIds.has(row.warrantyRuleId))))); }
  async getRepairItem(organizationId: OpsId, repairItemId: OpsId) { return clone(this.fixture.repairItems.find((row)=>row.organizationId===organizationId&&row.id===repairItemId)??null); }
  async listRepairItemsForAsset(organizationId: OpsId, assetId: OpsId) { return clone(this.fixture.repairItems.filter((row)=>row.organizationId===organizationId&&row.assetId===assetId).sort((a,b)=>b.completionDate.localeCompare(a.completionDate)||b.id.localeCompare(a.id))); }
  async listAppliedWarrantiesForRepair(organizationId: OpsId, repairItemId: OpsId) { return clone(this.fixture.appliedWarranties.filter((row)=>row.organizationId===organizationId&&row.repairItemId===repairItemId)); }
  async getAppliedWarranty(organizationId: OpsId, appliedWarrantyId: OpsId) { return clone(this.fixture.appliedWarranties.find((row)=>row.organizationId===organizationId&&row.id===appliedWarrantyId)??null); }
  async listActiveAppliedWarrantiesForAsset(organizationId: OpsId, assetId: OpsId, onDate: string) { const ids=new Set(this.fixture.repairItems.filter((row)=>row.organizationId===organizationId&&row.assetId===assetId).map((row)=>row.id)); return clone(this.fixture.appliedWarranties.filter((row)=>row.organizationId===organizationId&&ids.has(row.repairItemId)&&row.startDate<=onDate&&row.endDate>=onDate)); }
  async getWarrantyCase(organizationId: OpsId, warrantyCaseId: OpsId) { return clone(this.fixture.warrantyCases.find((row)=>row.organizationId===organizationId&&row.id===warrantyCaseId)??null); }
  async listWarrantyCases(organizationId: OpsId) { return clone(this.fixture.warrantyCases.filter((row)=>row.organizationId===organizationId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))); }
  async listQuotesForWorkOrder(organizationId:OpsId,workOrderId:OpsId){return clone(this.fixture.quotes.filter((row)=>row.organizationId===organizationId&&row.workOrderId===workOrderId).sort((a,b)=>b.version-a.version||b.submittedAt.localeCompare(a.submittedAt)))}
  async listAuthorizationsForWorkOrder(organizationId:OpsId,workOrderId:OpsId){return clone(this.fixture.authorizations.filter((row)=>row.organizationId===organizationId&&row.workOrderId===workOrderId).sort((a,b)=>b.authorizedAt.localeCompare(a.authorizedAt)))}
  async getInvoice(organizationId: OpsId, invoiceId: OpsId) { return clone(this.fixture.invoices.find((row)=>row.organizationId===organizationId&&row.id===invoiceId)??null); }
  async listInvoices(organizationId: OpsId) { return clone(this.fixture.invoices.filter((row)=>row.organizationId===organizationId).sort((a,b)=>b.invoiceDate.localeCompare(a.invoiceDate))); }
  async listInvoiceLines(organizationId: OpsId, invoiceId: OpsId) { return clone(this.fixture.invoiceLines.filter((row)=>row.organizationId===organizationId&&row.invoiceId===invoiceId).sort((a,b)=>a.lineNumber-b.lineNumber)); }
  async listInvoiceLineAllocations(organizationId: OpsId, invoiceLineId: OpsId) { return clone(this.fixture.invoiceLineAllocations.filter((row)=>row.organizationId===organizationId&&row.invoiceLineId===invoiceLineId)); }
  async listInvoiceExceptions(organizationId: OpsId, invoiceId: OpsId) { return clone(this.fixture.invoiceExceptions.filter((row)=>row.organizationId===organizationId&&row.invoiceId===invoiceId)); }
  async listInvoiceAdjustments(organizationId: OpsId, invoiceId: OpsId) { return clone(this.fixture.invoiceAdjustments.filter((row)=>row.organizationId===organizationId&&row.invoiceId===invoiceId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))); }
  async listValueEvents(organizationId: OpsId) { return clone(this.fixture.valueEvents.filter((row)=>row.organizationId===organizationId).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))); }
  async listServiceRunsForStoreVendor(organizationId: OpsId, storeId: OpsId, vendorId: OpsId) { const runIds = new Set(this.fixture.routeStops.filter((row) => row.organizationId === organizationId && row.storeId === storeId).map((row) => row.serviceRunId)); return clone(this.fixture.serviceRuns.filter((row) => row.organizationId === organizationId && row.vendorId === vendorId && runIds.has(row.id)).sort((a, b) => a.proposedStartsAt.localeCompare(b.proposedStartsAt))); }
  async getRouteStopForVisit(organizationId: OpsId, visitId: OpsId) { return clone(this.fixture.routeStops.find((row) => row.organizationId === organizationId && row.siteVisitId === visitId) ?? null); }
  async getAssignment(organizationId: OpsId, assignmentId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.id === assignmentId) ?? null); }
  async getIssuance(organizationId: OpsId, issuanceId: OpsId) { return clone(this.fixture.issuances.find((row) => row.organizationId === organizationId && row.id === issuanceId) ?? null); }
  async getEstimateRequest(organizationId: OpsId, estimateRequestId: OpsId) { return clone(this.fixture.estimateRequests.find((row) => row.organizationId === organizationId && row.id === estimateRequestId) ?? null); }
  async getLatestEstimateProposal(organizationId: OpsId, estimateRequestId: OpsId) { return clone(this.fixture.estimateProposals.filter((row) => row.organizationId === organizationId && row.requestId === estimateRequestId).sort((a, b) => b.revision - a.revision || b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async listEstimateRequestsForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.estimateRequests.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))); }
  async getVisit(organizationId: OpsId, visitId: OpsId) { return clone(this.fixture.visits.find((row) => row.organizationId === organizationId && row.id === visitId) ?? null); }
  async getSiteVisitWorkOrderById(organizationId: OpsId, siteVisitWorkOrderId: OpsId): Promise<SiteVisitWorkOrder | null> { return clone(this.fixture.siteVisitWorkOrders.find((row) => row.organizationId === organizationId && row.id === siteVisitWorkOrderId) ?? null); }
  async getSiteVisitWorkOrder(organizationId: OpsId, visitId: OpsId, workOrderId: OpsId): Promise<SiteVisitWorkOrder | null> { return clone(this.fixture.siteVisitWorkOrders.find((row) => row.organizationId === organizationId && row.visitId === visitId && row.workOrderId === workOrderId) ?? null); }
  async listSiteVisitWorkOrders(organizationId: OpsId, visitId: OpsId): Promise<SiteVisitWorkOrder[]> { return clone(this.fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId && row.visitId === visitId).sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id))); }
  async listSiteVisitWorkOrdersForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<SiteVisitWorkOrder[]> { return clone(this.fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((left, right) => right.linkedAt.localeCompare(left.linkedAt) || right.id.localeCompare(left.id))); }
  async listWorkOrderVerifications(organizationId: OpsId, workOrderId: OpsId): Promise<WorkOrderVerification[]> { return clone(this.fixture.workOrderVerifications.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((left, right) => left.cycle - right.cycle || left.decidedAt.localeCompare(right.decidedAt) || left.id.localeCompare(right.id))); }
  async getFollowUp(organizationId: OpsId, followUpId: OpsId) { return clone(this.fixture.followUps.find((row) => row.organizationId === organizationId && row.id === followUpId) ?? null); }
  async getWorkflowTask(organizationId: OpsId, workflowTaskId: OpsId) { return clone(this.fixture.workflowTasks.find((row) => row.organizationId === organizationId && row.id === workflowTaskId) ?? null); }
  async listWorkflowTasksForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<WorkflowTask[]> { return clone(this.fixture.workflowTasks.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))); }
  async listWorkflowTasksForRequest(organizationId: OpsId, requestId: OpsId): Promise<WorkflowTask[]> { return clone(this.fixture.workflowTasks.filter((row) => row.organizationId === organizationId && row.serviceRequestId === requestId).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))); }
  async listWorkflowTaskSlaPauses(organizationId: OpsId, workflowTaskId: OpsId) { return clone(this.fixture.workflowTaskSlaPauses.filter((row) => row.organizationId === organizationId && row.workflowTaskId === workflowTaskId).sort((left, right) => left.pausedAt.localeCompare(right.pausedAt) || left.id.localeCompare(right.id))); }
  async listWorkflowTaskSlaResumes(organizationId: OpsId, workflowTaskId: OpsId) { return clone(this.fixture.workflowTaskSlaResumes.filter((row) => row.organizationId === organizationId && row.workflowTaskId === workflowTaskId).sort((left, right) => left.resumedAt.localeCompare(right.resumedAt) || left.id.localeCompare(right.id))); }
  async getActiveWorkflowTaskSlaPause(organizationId: OpsId, workflowTaskId: OpsId) { const resumes = new Set(this.fixture.workflowTaskSlaResumes.filter((row) => row.organizationId === organizationId && row.workflowTaskId === workflowTaskId).map((row) => row.pauseId)); return clone(this.fixture.workflowTaskSlaPauses.filter((row) => row.organizationId === organizationId && row.workflowTaskId === workflowTaskId && !resumes.has(row.id)).sort((left, right) => right.pausedAt.localeCompare(left.pausedAt) || right.id.localeCompare(left.id)).at(0) ?? null); }
  async getException(organizationId: OpsId, exceptionId: OpsId) { return clone(this.fixture.exceptions.find((row) => row.organizationId === organizationId && row.id === exceptionId) ?? null); }
  async getIdempotencyKey(organizationId: OpsId, key: string) { return clone(this.idempotencyKeys.find((row) => row.organizationId === organizationId && row.key === key) ?? null); }
  async getStoredFileByStorageKey(organizationId: OpsId, storageKey: string): Promise<StoredFile | null> { return clone(this.fixture.files.find((row) => row.organizationId === organizationId && row.storageKey === storageKey) ?? null); }
  async getActiveAssignment(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.assignments.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && !["cancelled", "declined", "completed", "superseded"].includes(row.status)).at(-1) ?? null); }
  async getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.issuances.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => b.revision - a.revision).at(0) ?? null); }
  async listIssuancesForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.issuances.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => a.revision - b.revision || a.id.localeCompare(b.id))); }
  async getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId) { return clone(this.fixture.vendorResponses.filter((row) => row.organizationId === organizationId && row.assignmentId === assignmentId).sort((a, b) => b.respondedAt.localeCompare(a.respondedAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async getLatestVendorResponseForIssuance(organizationId: OpsId, issuanceId: OpsId) { return clone(this.fixture.vendorResponses.filter((row) => row.organizationId === organizationId && row.issuanceId === issuanceId).sort((a, b) => b.respondedAt.localeCompare(a.respondedAt) || b.id.localeCompare(a.id)).at(0) ?? null); }
  async getVendorResponse(organizationId: OpsId, vendorResponseId: OpsId): Promise<VendorResponse | null> { return clone(this.fixture.vendorResponses.find((row) => row.organizationId === organizationId && row.id === vendorResponseId) ?? null); }
  async listServiceAppointmentsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<ServiceAppointment[]> { return clone((this.fixture.serviceAppointments ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))); }
  async listVendorContinuationsForWorkOrder(organizationId: OpsId, workOrderId: OpsId): Promise<VendorContinuation[]> { return clone((this.fixture.vendorContinuations ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))); }
  async findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && row.vendorId === vendorId && ["issued", "opened", "accepted"].includes(row.status)) ?? null); }
  async findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && row.internalMembershipId === membershipId && !["cancelled", "declined", "completed", "superseded"].includes(row.status)) ?? null); }
  async vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId) { const store = this.fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId); if (!store) return false; return this.fixture.vendorCoverage.some((row) => row.organizationId === organizationId && row.vendorId === vendorId && (row.scopeKind === "organization" && row.scopeId === organizationId || row.scopeKind === "region" && row.scopeId === store.regionId || row.scopeKind === "store" && row.scopeId === store.id)); }
  async findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }) { return clone(this.fixture.visits.find((row) => row.organizationId === organizationId && row.storeId === storeId && row.status === "active" && row.vendorId === provider.vendorId && row.internalMembershipId === provider.internalMembershipId && normalize(row.technicianName) === normalize(provider.technicianName)) ?? null); }
  async listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]> { return clone(this.fixture.visits.filter((row) => row.organizationId === organizationId && row.storeId === storeId && row.status === "active").sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id)).map((visit) => { const workOrder = visit.workOrderId ? this.fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === visit.workOrderId) : undefined; return { id: visit.id, providerKind: visit.providerKind, vendorId: visit.vendorId, internalMembershipId: visit.internalMembershipId, providerName: visit.providerName, technicianName: visit.technicianName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number, unmatchedReason: visit.unmatchedReason, purpose: visit.purpose, checkedInAt: visit.checkedInAt, startedChannel: visit.startedChannel }; })); }
  async allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number) { if (!this.fixture.organizations.some((row) => row.id === organizationId)) throw new Error("Organization not found"); const key = `${organizationId}:${year}`; const next = this.counters.get(key) ?? 1; this.counters.set(key, next + 1); return `${prefix}-${year}-${String(next).padStart(4, "0")}`; }

  async searchStores(scope: OrganizationScope, search: string, request?: PageRequest) {
    const query = normalize(search);
    const rows = this.fixture.stores.filter((store) => storeAllowed(this.fixture, scope, store.id)).filter((store) => !query || normalize([store.storeNumber, store.name, store.address1, store.address2, store.city, store.state, store.postalCode, ...store.aliases].filter(Boolean).join(" ")).includes(query)).sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true })).map((store): StoreSearchRow => ({
      id: store.id,
      storeNumber: store.storeNumber,
      name: store.name,
      regionName: this.fixture.regions.find((row) => row.organizationId === scope.organizationId && row.id === store.regionId)?.name,
      formattedAddress: formatAddress(store),
      openWorkCount: this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.storeId === store.id && !["closed", "cancelled"].includes(row.status)).length,
      activeVisitCount: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.storeId === store.id && row.status === "active").length,
      recordedCostMinor: this.fixture.costLines.filter((cost) => cost.organizationId === scope.organizationId && this.fixture.workOrders.some((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === cost.workOrderId && workOrder.storeId === store.id)).reduce((sum, row) => sum + row.amount.amountMinor, 0),
      currency: "USD",
    }));
    return page(rows, request);
  }

  async getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null> {
    if (!storeAllowed(this.fixture, scope, storeId)) return null;
    const store = this.fixture.stores.find((row) => row.organizationId === scope.organizationId && row.id === storeId)!;
    const base = (await this.searchStores(scope, store.storeNumber, { limit: 100 })).items.find((row) => row.id === storeId)!;
    const openWorkOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId && !["closed", "cancelled"].includes(row.status)).map((row) => workOrderRow(this.fixture, row));
    return { ...base, regionId: store.regionId, status: store.status, activeVisits: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId && row.status === "active").map((row) => visitRow(this.fixture, row)), openWorkOrders, assets: this.fixture.assets.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId).map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, status: asset.status, recordedCostMinor: this.fixture.costLines.filter((cost) => cost.organizationId === scope.organizationId && this.fixture.workOrders.some((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === cost.workOrderId && workOrder.assetId === asset.id)).reduce((sum, cost) => sum + cost.amount.amountMinor, 0) })) };
  }

  async listRequests(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) {
    const rows = this.fixture.requests.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((row) => requestRow(this.fixture, row));
    return page(rows, query);
  }

  async listWorkOrders(scope: OrganizationScope, query: WorkOrderListQuery = {}) {
    const search = normalize(query.search ?? "");
    const rows = this.fixture.workOrders.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.statuses?.length || query.statuses.includes(row.status)) && (!query.priorities?.length || query.priorities.includes(row.priority)) && (!query.storeId || row.storeId === query.storeId) && (!query.regionId || this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)?.regionId === query.regionId) && (!query.vendorId || this.fixture.assignments.some((assignment) => assignment.organizationId === scope.organizationId && assignment.workOrderId === row.id && assignment.vendorId === query.vendorId)) && (!query.createdFrom || row.createdAt >= query.createdFrom) && (!query.createdTo || row.createdAt <= query.createdTo)).map((row) => workOrderRow(this.fixture, row)).filter((row) => !search || normalize([row.number, row.problem, row.storeNumber, row.storeName, row.vendorName].filter(Boolean).join(" ")).includes(search)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.number.localeCompare(b.number));
    return page(rows, query);
  }

  async getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null> {
    const workOrder = this.fixture.workOrders.find((row) => row.organizationId === scope.organizationId && row.id === workOrderId);
    if (!workOrder || !storeAllowed(this.fixture, scope, workOrder.storeId)) return null;
    const base = workOrderRow(this.fixture, workOrder);
    const asset = workOrder.assetId ? this.fixture.assets.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.assetId) : undefined;
    const component = workOrder.componentId ? this.fixture.components.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.componentId) : undefined;
    const request = workOrder.requestId ? this.fixture.requests.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.requestId) : undefined;
    const visits = this.fixture.siteVisitWorkOrders
      .filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id)
      .flatMap((link) => {
        const visit = this.fixture.visits.find((row) => row.organizationId === scope.organizationId && row.id === link.visitId);
        return visit ? [visitRow(this.fixture, visit, link)] : [];
      })
      .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt) || right.id.localeCompare(left.id));
    return { ...base, request: request ? requestRow(this.fixture, request) : undefined, authorizedScope: workOrder.authorizedScope, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, component: component ? { id: component.id, name: component.name } : undefined, nte: workOrder.nte, vendorServiceTicketNumber: workOrder.vendorServiceTicketNumber, vendorInvoiceNumber: workOrder.vendorInvoiceNumber, externalAccountingPo: workOrder.externalAccountingPo, visits, followUps: this.fixture.followUps.filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id).map((row) => ({ id: row.id, nextAction: row.nextAction, accountableParty: row.accountableParty, dueAt: row.dueAt, status: row.status })), costs: this.fixture.costLines.filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id).map((row) => ({ id: row.id, kind: row.kind, description: row.description, amountMinor: row.amount.amountMinor, currency: row.amount.currency, serviceDate: row.serviceDate })) };
  }

  async listVendors(scope: OrganizationScope, search = "", request?: PageRequest) {
    const query = normalize(search);
    const rows = this.fixture.vendors.filter((row) => row.organizationId === scope.organizationId).filter((vendor) => !query || normalize([vendor.name, ...this.fixture.vendorSpecialties.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).flatMap((row) => [row.displayName, ...row.searchAliases])].join(" ")).includes(query)).sort((a, b) => a.name.localeCompare(b.name)).map((vendor): VendorDirectoryRow => { const workOrderIds = new Set(this.fixture.assignments.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.workOrderId)); const visitCounts = new Map<string, number>(); this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id && row.workOrderId && storeAllowed(this.fixture, scope, row.storeId)).forEach((row) => visitCounts.set(row.workOrderId!, (visitCounts.get(row.workOrderId!) ?? 0) + 1)); return { id: vendor.id, name: vendor.name, status: vendor.status, preferred: vendor.preferred, specialties: this.fixture.vendorSpecialties.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.displayName), coverageLabels: this.fixture.vendorCoverage.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.scopeKind === "organization" ? "All stores" : row.scopeId), openWorkOrders: this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && workOrderIds.has(row.id) && !["closed", "cancelled"].includes(row.status)).length, activeVisits: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && row.vendorId === vendor.id && row.status === "active").length, returnVisitWorkOrders: [...visitCounts.values()].filter((count) => count > 1).length }; });
    return page(rows, request);
  }

  async listVisits(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId; vendorId?: OpsId } = {}) { const rows = this.fixture.visits.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId) && (!query.vendorId || row.vendorId === query.vendorId)).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)).map((row) => visitRow(this.fixture, row)); return page(rows, query); }

  async listExceptions(scope: OrganizationScope, query: ExceptionQueueQuery = {}) { const rows = this.fixture.exceptions.filter((row) => row.organizationId === scope.organizationId && exceptionAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.statuses?.length || query.statuses.includes(row.status)) && (!query.kinds?.length || query.kinds.includes(row.kind)) && (!query.storeId || row.storeId === query.storeId) && (!query.vendorId || row.vendorId === query.vendorId)).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).map((row): ExceptionQueueRow => ({ id: row.id, kind: row.kind, status: row.status, severity: row.severity, summary: row.summary, storeId: row.storeId, storeNumber: this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)?.storeNumber, workOrderId: row.workOrderId, workOrderNumber: this.fixture.workOrders.find((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === row.workOrderId)?.number, visitId: row.visitId, detectedAt: row.detectedAt })); return page(rows, query); }

  async getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null> { const asset = this.fixture.assets.find((row) => row.organizationId === scope.organizationId && row.id === assetId); if (!asset || !storeAllowed(this.fixture, scope, asset.storeId)) return null; const workOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.assetId === asset.id).map((row) => workOrderRow(this.fixture, row)); return { id: asset.id, storeId: asset.storeId, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, groupPath: asset.groupPath, manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber, installedAt: asset.installedAt, expectedLifeYears: asset.expectedLifeYears, warrantyEndsAt: asset.warrantyEndsAt, replacementEstimateMinor: asset.replacementEstimate?.amountMinor, currency: asset.replacementEstimate?.currency ?? "USD", status: asset.status, components: this.fixture.components.filter((row) => row.organizationId === scope.organizationId && row.assetId === asset.id).map((row) => ({ id: row.id, parentComponentId: row.parentComponentId, name: row.name, partNumber: row.partNumber, serialNumber: row.serialNumber })), workOrders, recordedCostMinor: workOrders.reduce((sum, row) => sum + row.recordedCostMinor, 0) }; }

  async listPmOccurrences(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) { const rows = this.fixture.pmOccurrences.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((row): PmOccurrenceRow => ({ id: row.id, planId: row.planId, planName: this.fixture.pmPlans.find((plan) => plan.organizationId === scope.organizationId && plan.id === row.planId)?.name ?? "PM plan", storeId: row.storeId, storeNumber: this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)!.storeNumber, assetId: row.assetId, assetName: this.fixture.assets.find((asset) => asset.organizationId === scope.organizationId && asset.id === row.assetId)?.name, dueAt: row.dueAt, windowStartsAt: row.windowStartsAt, windowEndsAt: row.windowEndsAt, status: row.status, workOrderId: row.workOrderId })); return page(rows, query); }

  async getExecutiveSnapshot(scope: OrganizationScope, period: { startsAt: IsoDateTime; endsAt: IsoDateTime }): Promise<ExecutiveSnapshotView> { const workOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && inPeriod(row.createdAt, period.startsAt, period.endsAt)); const visits = this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && inPeriod(row.checkedInAt, period.startsAt, period.endsAt)); const exceptions = this.fixture.exceptions.filter((row) => row.organizationId === scope.organizationId && exceptionAllowed(this.fixture, scope, row.storeId) && inPeriod(row.detectedAt, period.startsAt, period.endsAt)); const followUps = this.fixture.followUps.filter((row) => { if (row.organizationId !== scope.organizationId) return false; const workOrder = this.fixture.workOrders.find((item) => item.organizationId === scope.organizationId && item.id === row.workOrderId); return workOrder && storeAllowed(this.fixture, scope, workOrder.storeId); }); const costLines = this.fixture.costLines.filter((row) => { if (row.organizationId !== scope.organizationId) return false; const workOrder = this.fixture.workOrders.find((item) => item.organizationId === scope.organizationId && item.id === row.workOrderId); return workOrder && storeAllowed(this.fixture, scope, workOrder.storeId) && row.serviceDate >= period.startsAt.slice(0, 10) && row.serviceDate <= period.endsAt.slice(0, 10); }); return { organizationId: scope.organizationId, period, scope: { regionId: scope.regionIds?.length === 1 ? scope.regionIds[0] : undefined, storeId: scope.storeIds?.length === 1 ? scope.storeIds[0] : undefined }, activeVisits: visits.filter((row) => row.status === "active").length, unexpectedVisits: exceptions.filter((row) => row.kind === "unexpected_visit" || row.kind === "high_risk_service").length, openExceptions: exceptions.filter((row) => row.status !== "resolved").length, noWorkOrderVisits: visits.filter((row) => !row.workOrderId).length, missingCheckouts: exceptions.filter((row) => row.kind === "missing_checkout" && row.status !== "resolved").length, openWorkOrders: workOrders.filter((row) => !["closed", "cancelled"].includes(row.status)).length, overdueFollowUps: followUps.filter((row) => row.status === "open" && row.dueAt < period.endsAt).length, recordedCost: { amountMinor: costLines.reduce((sum, row) => sum + row.amount.amountMinor, 0), currency: "USD" }, sourceCounts: { visits: visits.length, workOrders: workOrders.length, followUps: followUps.length, exceptions: exceptions.length, costLines: costLines.length } }; }

  async getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "store") return null; const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId); const organization = this.fixture.organizations.find((row) => row.id === token.organizationId); if (!store || !organization) return null; const vendorIds = new Set(this.fixture.vendorCoverage.filter((row) => row.organizationId === token.organizationId && (row.scopeKind === "organization" || (row.scopeKind === "region" && row.scopeId === store.regionId) || (row.scopeKind === "store" && row.scopeId === store.id))).map((row) => row.vendorId)); return { organizationId: organization.id, organizationName: organization.name, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store), locationPolicyEnabled: store.locationPolicyEnabled }, approvedVendors: this.fixture.vendors.filter((row) => row.organizationId === organization.id && row.status === "approved" && vendorIds.has(row.id)).map((vendor) => ({ id: vendor.id, name: vendor.name, specialties: this.fixture.vendorSpecialties.filter((row) => row.organizationId === organization.id && row.vendorId === vendor.id).map((row) => row.displayName) })), actions: ["report_issue", "vendor_sign_in", "current_visits"] }; }

  async getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView | null> {
    const token = tokenRecord(this.fixture, input);
    if (!token || token.subjectType !== "work_order_issuance") return null;
    const issuance = this.fixture.issuances.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId);
    if (!issuance) return null;
    const assignment = this.fixture.assignments.find((row) => row.organizationId === token.organizationId && row.id === issuance.assignmentId && row.workOrderId === issuance.workOrderId && row.kind === "outside_vendor");
    const workOrder = this.fixture.workOrders.find((row) => row.organizationId === token.organizationId && row.id === issuance.workOrderId);
    const vendor = assignment?.vendorId ? this.fixture.vendors.find((row) => row.organizationId === token.organizationId && row.id === assignment.vendorId) : undefined;
    if (!assignment || !workOrder || !vendor || !["issued", "opened", "accepted"].includes(assignment.status) || ["completed_pending_review", "resolved", "closed", "cancelled"].includes(workOrder.status)) return null;
    const [latestIssuance, activeAssignment] = await Promise.all([
      this.getLatestIssuanceForWorkOrder(token.organizationId, workOrder.id),
      this.getActiveAssignment(token.organizationId, workOrder.id),
    ]);
    if (latestIssuance?.id !== issuance.id || activeAssignment?.id !== assignment.id) return null;
    const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === workOrder.storeId)!;
    const response = this.fixture.vendorResponses
      .filter((row) => row.organizationId === token.organizationId && row.issuanceId === issuance.id)
      .sort((a, b) => b.respondedAt.localeCompare(a.respondedAt) || b.id.localeCompare(a.id))
      .at(0);
    const asset = workOrder.assetId ? this.fixture.assets.find((row) => row.organizationId === token.organizationId && row.id === workOrder.assetId) : undefined;
    let snapshot: Partial<ServiceAuthorizationView> & { store?: ServiceAuthorizationView["store"]; vendor?: ServiceAuthorizationView["vendor"] } = {};
    try { snapshot = JSON.parse(issuance.immutablePayloadJson) as typeof snapshot; } catch { return null; }
    return {
      organizationId: token.organizationId,
      organizationName: snapshot.organizationName ?? this.fixture.organizations.find((row) => row.id === token.organizationId)!.name,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      issuanceId: issuance.id,
      workOrderNumber: snapshot.workOrderNumber ?? workOrder.number,
      revision: issuance.revision,
      status: workOrder.status,
      assignmentStatus: assignment.status,
      store: snapshot.store ?? { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store) },
      vendor: snapshot.vendor ?? { id: vendor.id, name: vendor.name },
      problem: snapshot.problem ?? workOrder.problem,
      priority: snapshot.priority ?? workOrder.priority,
      authorizedScope: snapshot.authorizedScope,
      categoryKey: snapshot.categoryKey,
      asset: snapshot.asset ?? (asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined),
      requestedTiming: snapshot.requestedTiming,
      nte: snapshot.nte,
      billingInstruction: snapshot.billingInstruction ?? `Reference operator work order ${snapshot.workOrderNumber ?? workOrder.number} on all service tickets and invoices.`,
      issuedAt: issuance.issuedAt,
      latestResponse: response ? { response: response.response, responderName: response.responderName, proposedAt: response.proposedAt, message: response.message, respondedAt: response.respondedAt } : undefined,
    };
  }

  async getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView | null> { const gateway = await this.getPublicStoreGatewayByToken(input); if (!gateway || !input.vendorId || !gateway.approvedVendors.some((row) => row.id === input.vendorId)) return null; const vendor = this.fixture.vendors.find((row) => row.organizationId === gateway.organizationId && row.id === input.vendorId)!; const eligibleIds = new Set(this.fixture.assignments.filter((row) => row.organizationId === gateway.organizationId && row.vendorId === vendor.id && ["issued", "opened", "accepted"].includes(row.status)).map((row) => row.workOrderId)); return { organizationName: gateway.organizationName, store: gateway.store, vendor: { id: vendor.id, name: vendor.name }, eligibleWorkOrders: this.fixture.workOrders.filter((row) => row.organizationId === gateway.organizationId && row.storeId === gateway.store.id && eligibleIds.has(row.id) && !["completed_pending_review", "resolved", "closed", "cancelled"].includes(row.status)).map((row) => ({ id: row.id, number: row.number, problem: row.problem, categoryKey: row.categoryKey, status: row.status })), allowsNoWorkOrder: true }; }

  async getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "visit") return null; const visit = this.fixture.visits.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId && row.status === "active" && row.vendorId); if (!visit) return null; const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === visit.storeId)!; const workOrder = visit.workOrderId ? this.fixture.workOrders.find((row) => row.organizationId === token.organizationId && row.id === visit.workOrderId) : undefined; return { organizationId: token.organizationId, id: visit.id, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, vendorId: visit.vendorId!, vendorName: visit.providerName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number, unmatchedReason: visit.unmatchedReason, technicianName: visit.technicianName, purpose: visit.purpose, checkedInAt: visit.checkedInAt, startedChannel: visit.startedChannel, checkInLocationResult: locationResult(this.fixture, token.organizationId, visit.id), approximateObservedSeconds: Math.max(0, Math.floor((Date.parse(input.now) - Date.parse(visit.checkedInAt)) / 1000)) }; }

  async getEstimateRequestByPublicToken(input: PublicTokenLookup) { const token = tokenRecord(this.fixture, input); if (!token || token.usedAt || token.subjectType !== "work_order_estimate_request") return null; const request = await this.getEstimateRequest(token.organizationId, token.subjectId); return request && (input.vendorId === undefined || request.vendorId === input.vendorId) ? { request, tokenId: token.id, expiresAt: token.expiresAt } : null; }
  async getServiceRunByPublicToken(input: PublicTokenLookup) { const token = tokenRecord(this.fixture, input); if (!token || token.usedAt || token.subjectType !== "service_run") return null; const run = await this.getServiceRun(token.organizationId, token.subjectId); return run && (input.vendorId === undefined || run.vendorId === input.vendorId) ? { run, tokenId: token.id, expiresAt: token.expiresAt } : null; }

  async getVisitByCheckoutToken(input: PublicTokenLookup) { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "visit") return null; const visit = await this.getVisit(token.organizationId, token.subjectId); return visit ? { visit, expiresAt: token.expiresAt } : null; }

  async getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "store") return null; const organization = this.fixture.organizations.find((row) => row.id === token.organizationId); const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId); if (!organization || !store) return null; return { organizationId: organization.id, organizationName: organization.name, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store) }, activeVisits: await this.listActiveVisitsForStore(organization.id, store.id) }; }

  async listDueOutboxMessages(now: string, limit: number): Promise<OutboxMessage[]> { return clone(this.fixture.outboxMessages.filter((row) => row.status === "pending" && row.availableAt <= now).sort((a, b) => a.availableAt.localeCompare(b.availableAt) || a.id.localeCompare(b.id)).slice(0, Math.max(1, Math.min(100, limit)))); }

  async listStaleProcessingOutboxMessages(staleBefore: string, limit: number): Promise<OutboxMessage[]> { return clone(this.fixture.outboxMessages.filter((row) => row.status === "processing" && (row.claimedAt == null || row.claimedAt <= staleBefore)).sort((a, b) => (a.claimedAt ?? "").localeCompare(b.claimedAt ?? "") || a.id.localeCompare(b.id)).slice(0, Math.max(1, Math.min(100, limit)))); }

  async claimOutboxMessage(organizationId: OpsId, id: OpsId, claimedAt: string): Promise<boolean> { const candidate = clone(this.fixture); const row = candidate.outboxMessages.find((item) => item.organizationId === organizationId && item.id === id); if (!row || row.status !== "pending") return false; row.status = "processing"; row.claimedAt = claimedAt; row.attemptCount = (row.attemptCount ?? 0) + 1; this.fixture = candidate; return true; }

  async recordOutboxDeliveryOutcome(input: OutboxDeliveryOutcome): Promise<void> { if (input.outcome === "delivered") { await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, delivered_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["delivered", input.deliveredAt, input.organizationId, input.id, "processing"] }]); return; } if (input.outcome === "retry") { await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, available_at = ?, last_error = ?, claimed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["pending", input.retryAt, input.lastError.slice(0, 2000), null, input.organizationId, input.id, "processing"] }]); return; } await this.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ?, last_error = ?, claimed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["failed", input.lastError.slice(0, 2000), null, input.organizationId, input.id, "processing"] }]); }

  async listOverdueEscalationCandidates(now: string, limit: number): Promise<WorkflowTask[]> { return clone((this.fixture.workflowTasks ?? []).filter((row) => (row.status === "open" || row.status === "in_progress") && row.dueAt != null && row.dueAt <= now).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.id.localeCompare(b.id)).slice(0, Math.max(1, Math.min(100, limit)))); }

  async tryBeginJobRun(input: { organizationId: OpsId; jobRunId: OpsId; jobType: string; slotKey: string; startedAt: string }): Promise<boolean> { const candidate = clone(this.fixture); const runs = candidate.jobRuns ?? []; if (runs.some((row) => row.organizationId === input.organizationId && row.jobType === input.jobType && row.slotKey === input.slotKey)) return false; runs.push({ id: input.jobRunId, organizationId: input.organizationId, jobType: input.jobType, slotKey: input.slotKey, status: "running", startedAt: input.startedAt, finishedAt: null, processedCount: 0, failedCount: 0, detailsJson: "{}", createdAt: input.startedAt }); candidate.jobRuns = runs; this.fixture = candidate; return true; }

  async finishJobRun(input: { organizationId: OpsId; jobRunId: OpsId; status: "succeeded" | "failed"; finishedAt: string; processedCount: number; failedCount: number }): Promise<void> { await this.atomicWrite([{ sql: "UPDATE ops_job_runs SET status = ?, finished_at = ?, processed_count = ?, failed_count = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [input.status, input.finishedAt, input.processedCount, input.failedCount, input.organizationId, input.jobRunId, "running"] }]); }

  async listPmPlans(): Promise<PmPlan[]> { return clone(this.fixture.pmPlans.slice().sort((a, b) => (a.storeId ?? "").localeCompare(b.storeId ?? "") || a.id.localeCompare(b.id))); }

  async listPmOccurrencesForPlan(organizationId: OpsId, planId: OpsId): Promise<PmOccurrence[]> { return clone(this.fixture.pmOccurrences.filter((row) => row.organizationId === organizationId && row.planId === planId).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id))); }

  async listRecentJobRuns(organizationId: OpsId, limit: number): Promise<JobRun[]> { return clone((this.fixture.jobRuns ?? []).filter((row) => row.organizationId === organizationId).sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id)).slice(0, Math.max(1, Math.min(100, limit)))); }

  async outboxStatusCounts(organizationId: OpsId): Promise<Array<{ status: string; count: number }>> { const counts = new Map<string, number>(); for (const row of this.fixture.outboxMessages) if (row.organizationId === organizationId) counts.set(row.status, (counts.get(row.status) ?? 0) + 1); return [...counts.entries()].map(([status, count]) => ({ status, count })); }

  async listSavedViews(organizationId: OpsId, ownerMembershipId: OpsId, surface: string): Promise<SavedView[]> { return clone((this.fixture.savedViews ?? []).filter((row) => row.organizationId === organizationId && row.ownerMembershipId === ownerMembershipId && row.surface === surface).sort((a, b) => a.name.localeCompare(b.name))); }

  async putSavedView(input: { organizationId: OpsId; id: OpsId; ownerMembershipId: OpsId; surface: string; name: string; queryString: string; createdAt: string }): Promise<void> { await this.atomicWrite([{ sql: "DELETE FROM ops_saved_views WHERE organization_id = ? AND owner_membership_id = ? AND surface = ? AND name = ?", params: [input.organizationId, input.ownerMembershipId, input.surface, input.name] }, { sql: "INSERT INTO ops_saved_views (id, organization_id, owner_membership_id, surface, name, query_string, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", params: [input.id, input.organizationId, input.ownerMembershipId, input.surface, input.name, input.queryString, input.createdAt] }]); }

  async deleteSavedView(organizationId: OpsId, ownerMembershipId: OpsId, id: OpsId): Promise<boolean> { const candidate = clone(this.fixture); const before = (candidate.savedViews ?? []).length; candidate.savedViews = (candidate.savedViews ?? []).filter((row) => !(row.organizationId === organizationId && row.ownerMembershipId === ownerMembershipId && row.id === id)); if ((candidate.savedViews ?? []).length === before) return false; this.fixture = candidate; return true; }

  async atomicWrite(statements: readonly OpsStatement[]) { const candidate = clone(this.fixture); const candidateIdempotencyKeys = clone(this.idempotencyKeys); statements.forEach((statement) => applyStatement(candidate, candidateIdempotencyKeys, statement)); this.fixture = candidate; this.idempotencyKeys = candidateIdempotencyKeys; }
}

export function createOpsFixtureRepository(fixture: OpsFixture): MutableOpsFixtureRepository {
  const normalized = clone(fixture);
  if (!Array.isArray(normalized.jobRuns)) normalized.jobRuns = [];
  if (!Array.isArray(normalized.savedViews)) normalized.savedViews = [];
  if (!Array.isArray(normalized.serviceAppointments)) normalized.serviceAppointments = [];
  if (!Array.isArray(normalized.vendorContinuations)) normalized.vendorContinuations = [];
  return new FixtureOpsRepository(normalized);
}
export function createNorthlineFixtureRepository(): MutableOpsFixtureRepository { return createOpsFixtureRepository(buildNorthlinePresentationFixture()); }

const OPS_PRESENTATION_RUNTIME_KEY = "__opsPresentationRuntimeRepository";
const LEGACY_PRESENTATION_RUNTIME_KEY = "__traceOpsNorthlineRuntimeRepository";
const fixtureGlobal = globalThis as typeof globalThis & Partial<Record<
  typeof OPS_PRESENTATION_RUNTIME_KEY | typeof LEGACY_PRESENTATION_RUNTIME_KEY,
  MutableOpsFixtureRepository
>>;

function setPresentationRuntimeRepository(repository: MutableOpsFixtureRepository) {
  fixtureGlobal[OPS_PRESENTATION_RUNTIME_KEY] = repository;
  // Keep the old global pointing at the same object while old and new module
  // graphs can coexist during local HMR or a rolling preview deployment.
  fixtureGlobal[LEGACY_PRESENTATION_RUNTIME_KEY] = repository;
  return repository;
}

// Next compiles API routes and React Server Components into separate module
// graphs. Process-global storage keeps the local development fixture coherent
// across those graphs, so a mutation made by an API route is immediately
// visible to the redirected detail page. Production Render never uses this
// fallback; it requires PostgreSQL.
export function getNorthlineFixtureRepository(): MutableOpsFixtureRepository {
  const repository = fixtureGlobal[OPS_PRESENTATION_RUNTIME_KEY]
    ?? fixtureGlobal[LEGACY_PRESENTATION_RUNTIME_KEY]
    ?? setPresentationRuntimeRepository(createNorthlineFixtureRepository());
  setPresentationRuntimeRepository(repository);
  const snapshot = repository.snapshot() as Partial<OpsFixture>;
  if (!Array.isArray(snapshot.equipmentTemplates) || !Array.isArray(snapshot.componentTemplates) || !Array.isArray(snapshot.replacementProfiles) || !Array.isArray(snapshot.requestImpactAssessments) || !Array.isArray(snapshot.siteVisitWorkOrders)) {
    return setPresentationRuntimeRepository(createNorthlineFixtureRepository());
  }
  return repository;
}

export function resetNorthlineFixtureRepository() {
  return setPresentationRuntimeRepository(createNorthlineFixtureRepository());
}

export function getNorthlineDemoRuntime() {
  return {
    repository: getNorthlineFixtureRepository() as OpsRepository,
    asOf: NORTHLINE_AS_OF,
    entryTokens: NORTHLINE_DEMO_ENTRY_TOKENS,
    tokenHashes: NORTHLINE_DEMO_TOKEN_HASHES,
  } as const;
}
