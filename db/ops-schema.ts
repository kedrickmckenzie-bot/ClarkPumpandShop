import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const organizationId = () => text("organization_id").notNull();
const createdAt = () => text("created_at").notNull();
const bool = (name: string) => integer(name, { mode: "boolean" }).notNull().default(false);

export const opsOrganizations = sqliteTable("ops_organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timeZone: text("time_zone").notNull().default("America/New_York"),
  workOrderPrefix: text("work_order_prefix").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_org_slug").on(table.slug)]);

export const opsRegions = sqliteTable("ops_regions", {
  id: id(), organizationId: organizationId(), divisionId: text("division_id"), code: text("code").notNull(), name: text("name").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_regions_org_code").on(table.organizationId, table.code), index("idx_ops_regions_org_name").on(table.organizationId, table.name)]);

export const opsDivisions = sqliteTable("ops_divisions", {
  id: id(), organizationId: organizationId(), code: text("code").notNull(), name: text("name").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_divisions_org_code").on(table.organizationId, table.code), index("idx_ops_divisions_org_name").on(table.organizationId, table.name)]);

export const opsTaxonomyNodes = sqliteTable("ops_taxonomy_nodes", {
  id: id(), organizationId: organizationId(), parentNodeId: text("parent_node_id"), nodeKind: text("node_kind").notNull(), canonicalKey: text("canonical_key"), name: text("name").notNull(), aliasesJson: text("aliases_json").notNull().default("[]"), depth: integer("depth").notNull(), sortOrder: integer("sort_order").notNull().default(0), active: bool("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_taxonomy_org_parent_name").on(table.organizationId, table.parentNodeId, table.name), index("idx_ops_taxonomy_org_parent_sort").on(table.organizationId, table.parentNodeId, table.sortOrder), index("idx_ops_taxonomy_org_kind_active").on(table.organizationId, table.nodeKind, table.active)]);

export const opsEquipmentTemplates = sqliteTable("ops_equipment_templates", {
  id: id(), organizationId: organizationId(), taxonomyNodeId: text("taxonomy_node_id").notNull(), name: text("name").notNull(), defaultExpectedLifeYears: integer("default_expected_life_years"), active: bool("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_equipment_templates_org_group_name").on(table.organizationId, table.taxonomyNodeId, table.name), index("idx_ops_equipment_templates_org_group_active").on(table.organizationId, table.taxonomyNodeId, table.active)]);

export const opsComponentTemplates = sqliteTable("ops_component_templates", {
  id: id(), organizationId: organizationId(), equipmentTemplateId: text("equipment_template_id").notNull(), parentComponentTemplateId: text("parent_component_template_id"), name: text("name").notNull(), sortOrder: integer("sort_order").notNull().default(0), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_component_templates_org_equipment_parent_name").on(table.organizationId, table.equipmentTemplateId, table.parentComponentTemplateId, table.name), index("idx_ops_component_templates_org_equipment_sort").on(table.organizationId, table.equipmentTemplateId, table.sortOrder)]);

export const opsStores = sqliteTable("ops_stores", {
  id: id(), organizationId: organizationId(), divisionId: text("division_id"), regionId: text("region_id"), storeNumber: text("store_number").notNull(), name: text("name").notNull(),
  address1: text("address_1").notNull(), address2: text("address_2"), city: text("city").notNull(), state: text("state").notNull(), postalCode: text("postal_code").notNull(),
  aliasesJson: text("aliases_json").notNull().default("[]"), searchText: text("search_text").notNull(), latitudeE6: integer("latitude_e6"), longitudeE6: integer("longitude_e6"),
  geofenceRadiusM: integer("geofence_radius_m").notNull().default(200), locationPolicyEnabled: bool("location_policy_enabled"), timeZone: text("time_zone"), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_stores_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_stores_org_number").on(table.organizationId, table.storeNumber),
  index("idx_ops_stores_org_region_number").on(table.organizationId, table.regionId, table.storeNumber),
  index("idx_ops_stores_org_status_number").on(table.organizationId, table.status, table.storeNumber),
]);

export const opsUsers = sqliteTable("ops_users", {
  id: id(), email: text("email").notNull(), displayName: text("display_name").notNull(), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_users_email").on(table.email)]);

export const opsMemberships = sqliteTable("ops_memberships", {
  id: id(), organizationId: organizationId(), userId: text("user_id").notNull(), role: text("role").notNull(), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_memberships_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_memberships_org_user_role").on(table.organizationId, table.userId, table.role), index("idx_ops_memberships_org_status").on(table.organizationId, table.status)]);

export const opsScopeGrants = sqliteTable("ops_scope_grants", {
  id: id(), organizationId: organizationId(), membershipId: text("membership_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), permission: text("permission").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_scopes_org_member_scope_perm").on(table.organizationId, table.membershipId, table.scopeKind, table.scopeId, table.permission), index("idx_ops_scopes_org_kind_id").on(table.organizationId, table.scopeKind, table.scopeId)]);

export const opsVendors = sqliteTable("ops_vendors", {
  id: id(), organizationId: organizationId(), code: text("code").notNull(), name: text("name").notNull(), dispatchEmail: text("dispatch_email").notNull(), dispatchPhone: text("dispatch_phone"), status: text("status").notNull().default("approved"), preferred: bool("preferred"), searchText: text("search_text").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_vendors_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_vendors_org_code").on(table.organizationId, table.code), index("idx_ops_vendors_org_status_name").on(table.organizationId, table.status, table.name)]);

export const opsVendorReminders = sqliteTable("ops_vendor_reminders", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), title: text("title").notNull(), note: text("note"), accountableParty: text("accountable_party").notNull(), dueAt: text("due_at").notNull(), escalationTo: text("escalation_to").notNull(), status: text("status").notNull(), createdByActorType: text("created_by_actor_type").notNull(), createdByActorId: text("created_by_actor_id"), createdByActorName: text("created_by_actor_name").notNull(), createdAt: createdAt(), completedByActorType: text("completed_by_actor_type"), completedByActorId: text("completed_by_actor_id"), completedByActorName: text("completed_by_actor_name"), completedAt: text("completed_at"), completionNote: text("completion_note"),
}, (table) => [uniqueIndex("uidx_ops_vendor_reminders_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_reminders_org_vendor_status_due").on(table.organizationId, table.vendorId, table.status, table.dueAt), index("idx_ops_vendor_reminders_org_status_due").on(table.organizationId, table.status, table.dueAt)]);

export const opsVendorSpecialties = sqliteTable("ops_vendor_specialties", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), canonicalKey: text("canonical_key").notNull(), displayName: text("display_name").notNull(), searchAliasesJson: text("search_aliases_json").notNull().default("[]"),
}, (table) => [uniqueIndex("uidx_ops_vendor_specialties_org_vendor_key").on(table.organizationId, table.vendorId, table.canonicalKey), index("idx_ops_vendor_specialties_org_key").on(table.organizationId, table.canonicalKey)]);

export const opsVendorCoverage = sqliteTable("ops_vendor_coverage", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), preferredRank: integer("preferred_rank"),
}, (table) => [uniqueIndex("uidx_ops_vendor_coverage_org_vendor_scope").on(table.organizationId, table.vendorId, table.scopeKind, table.scopeId), index("idx_ops_vendor_coverage_org_scope").on(table.organizationId, table.scopeKind, table.scopeId)]);

export const opsVendorQualifications = sqliteTable("ops_vendor_qualifications", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), tradeKey: text("trade_key").notNull(), workType: text("work_type"), serviceType: text("service_type"), assetType: text("asset_type"), componentType: text("component_type"), pmWork: bool("pm_work"), emergencyResponse: bool("emergency_response"), warrantyWork: bool("warranty_work"), manufacturerAuthorization: text("manufacturer_authorization"), regionId: text("region_id"), storeId: text("store_id"), afterHours: bool("after_hours"), maximumJobAmountMinor: integer("maximum_job_amount_minor"), currency: text("currency"), requiredLicense: text("required_license"), requiredCertification: text("required_certification"), effectiveAt: text("effective_at").notNull(), expiresAt: text("expires_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [index("idx_ops_vendor_qualifications_org_vendor_trade").on(table.organizationId, table.vendorId, table.tradeKey, table.status), index("idx_ops_vendor_qualifications_org_scope").on(table.organizationId, table.regionId, table.storeId)]);

export const opsVendorComplianceDocuments = sqliteTable("ops_vendor_compliance_documents", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), documentType: text("document_type").notNull(), issuer: text("issuer"), reference: text("reference"), effectiveAt: text("effective_at"), expiresAt: text("expires_at"), reviewStatus: text("review_status").notNull(), blocking: bool("blocking"), storedFileId: text("stored_file_id"), createdAt: createdAt(),
}, (table) => [index("idx_ops_vendor_compliance_org_vendor_status_expiry").on(table.organizationId, table.vendorId, table.reviewStatus, table.expiresAt)]);

export const opsVendorContracts = sqliteTable("ops_vendor_contracts", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), name: text("name").notNull(), ownerMembershipId: text("owner_membership_id").notNull(), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [index("idx_ops_vendor_contracts_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsContractVersions = sqliteTable("ops_contract_versions", {
  id: id(), organizationId: organizationId(), contractId: text("contract_id").notNull(), vendorId: text("vendor_id").notNull(), version: integer("version").notNull(), sourceAgreementReference: text("source_agreement_reference").notNull(), status: text("status").notNull(), effectiveStartsAt: text("effective_starts_at").notNull(), effectiveEndsAt: text("effective_ends_at"), renewalAt: text("renewal_at"), noticeDays: integer("notice_days"), priceEscalationAt: text("price_escalation_at"), supersedesContractVersionId: text("supersedes_contract_version_id"), currency: text("currency").notNull(), preferredProvider: bool("preferred_provider"), exclusiveProvider: bool("exclusive_provider"), reactiveWorkAllowed: bool("reactive_work_allowed"), emergencyWorkAllowed: bool("emergency_work_allowed"), pmWorkAllowed: bool("pm_work_allowed"), subcontractorPolicy: text("subcontractor_policy").notNull(), schedulingMode: text("scheduling_mode").notNull(), reservedCapacityMinutes: integer("reserved_capacity_minutes").notNull(), nteAmountMinor: integer("nte_amount_minor"), materialsMarkupBps: integer("materials_markup_bps").notNull(), routeDiscountBps: integer("route_discount_bps").notNull(), evidenceRequirementsJson: text("evidence_requirements_json").notNull().default("[]"), complianceRequirementsJson: text("compliance_requirements_json").notNull().default("[]"), warrantyLaborDays: integer("warranty_labor_days"), warrantyPartsDays: integer("warranty_parts_days"), warrantyTravelDays: integer("warranty_travel_days"), createdByMembershipId: text("created_by_membership_id").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_contract_versions_org_contract_version").on(table.organizationId, table.contractId, table.version), index("idx_ops_contract_versions_org_vendor_effective").on(table.organizationId, table.vendorId, table.status, table.effectiveStartsAt)]);

export const opsContractScopes = sqliteTable("ops_contract_scopes", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), included: bool("included"),
}, (table) => [uniqueIndex("uidx_ops_contract_scopes_org_version_scope").on(table.organizationId, table.contractVersionId, table.scopeKind, table.scopeId)]);

export const opsRateCardLines = sqliteTable("ops_rate_card_lines", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), chargeType: text("charge_type").notNull(), description: text("description").notNull(), unit: text("unit").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), effectiveStartsAt: text("effective_starts_at").notNull(), effectiveEndsAt: text("effective_ends_at"),
}, (table) => [index("idx_ops_rate_card_org_contract_type").on(table.organizationId, table.contractVersionId, table.chargeType)]);

export const opsServiceLevelPolicies = sqliteTable("ops_service_level_policies", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), priority: text("priority").notNull(), responseMinutes: integer("response_minutes").notNull(), arrivalMinutes: integer("arrival_minutes").notNull(), completionMinutes: integer("completion_minutes").notNull(), calendar: text("calendar").notNull(),
}, (table) => [uniqueIndex("uidx_ops_service_level_org_contract_priority").on(table.organizationId, table.contractVersionId, table.priority)]);

export const opsSchedulingPolicies = sqliteTable("ops_scheduling_policies", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), maximumRouteMinutes: integer("maximum_route_minutes").notNull(), maximumStores: integer("maximum_stores").notNull(), maximumTravelMinutes: integer("maximum_travel_minutes").notNull(), maximumUtilizationBps: integer("maximum_utilization_bps").notNull(), perStopBufferMinutes: integer("per_stop_buffer_minutes").notNull(), travelBufferBps: integer("travel_buffer_bps").notNull(), documentationBufferMinutes: integer("documentation_buffer_minutes").notNull(), uncertaintyBufferBps: integer("uncertainty_buffer_bps").notNull(), emergencyReserveMinutes: integer("emergency_reserve_minutes").notNull(),
}, (table) => [uniqueIndex("uidx_ops_scheduling_policy_org_contract").on(table.organizationId, table.contractVersionId)]);

export const opsVendorCapacity = sqliteTable("ops_vendor_capacity", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), regionId: text("region_id").notNull(), tradeKey: text("trade_key").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), crewMinutes: integer("crew_minutes").notNull(), committedMinutes: integer("committed_minutes").notNull(), maximumRouteMinutes: integer("maximum_route_minutes").notNull(), maximumStores: integer("maximum_stores").notNull(), maximumTravelMinutes: integer("maximum_travel_minutes").notNull(), blackout: bool("blackout"), emergencyReserveMinutes: integer("emergency_reserve_minutes").notNull(), variableWorkLimitMinutes: integer("variable_work_limit_minutes").notNull(), specialEquipmentJson: text("special_equipment_json").notNull().default("[]"), createdAt: createdAt(),
}, (table) => [index("idx_ops_vendor_capacity_org_vendor_window").on(table.organizationId, table.vendorId, table.startsAt, table.endsAt), index("idx_ops_vendor_capacity_org_region_trade").on(table.organizationId, table.regionId, table.tradeKey, table.startsAt)]);

export const opsRequests = sqliteTable("ops_requests", {
  id: id(), organizationId: organizationId(), reference: text("reference").notNull(), storeId: text("store_id").notNull(), reporterName: text("reporter_name").notNull(), reporterEmployeeId: text("reporter_employee_id"), problem: text("problem").notNull(), priority: text("priority").notNull(), status: text("status").notNull(), version: integer("version").notNull().default(0), submittedAt: text("submitted_at").notNull(), convertedWorkOrderId: text("converted_work_order_id"),
}, (table) => [uniqueIndex("uidx_ops_requests_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_requests_org_reference").on(table.organizationId, table.reference), index("idx_ops_requests_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.submittedAt)]);

export const opsRequestImpactAssessments = sqliteTable("ops_request_impact_assessments", {
  id: id(),
  organizationId: organizationId(),
  requestId: text("request_id").notNull(),
  storeId: text("store_id").notNull(),
  assessmentKind: text("assessment_kind").notNull(),
  reviewDisposition: text("review_disposition"),
  storeOperatingState: text("store_operating_state").notNull(),
  safetyConcern: text("safety_concern").notNull(),
  productInventoryRisk: text("product_inventory_risk").notNull(),
  productInventoryValueMinor: integer("product_inventory_value_minor"),
  productInventoryCurrency: text("product_inventory_currency"),
  customersAffected: text("customers_affected").notNull(),
  complianceImpact: text("compliance_impact").notNull(),
  capacityUnavailableBps: integer("capacity_unavailable_bps"),
  redundantEquipment: text("redundant_equipment").notNull(),
  revenueFunctionImpact: text("revenue_function_impact"),
  estimatedDailyRevenueExposureMinor: integer("estimated_daily_revenue_exposure_minor"),
  estimatedDailyRevenueExposureCurrency: text("estimated_daily_revenue_exposure_currency"),
  estimatedDowntimeMinutes: integer("estimated_downtime_minutes"),
  confidence: text("confidence").notNull(),
  source: text("source").notNull(),
  notes: text("notes"),
  assessedByActorType: text("assessed_by_actor_type").notNull(),
  assessedByActorId: text("assessed_by_actor_id"),
  assessedByActorName: text("assessed_by_actor_name").notNull(),
  assessedAt: text("assessed_at").notNull(),
}, (table) => [
  index("idx_ops_request_impact_org_request_time").on(table.organizationId, table.requestId, table.assessedAt),
  index("idx_ops_request_impact_org_store_time").on(table.organizationId, table.storeId, table.assessedAt),
  foreignKey({ name: "fk_ops_request_impact_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_request_impact_request", columns: [table.organizationId, table.requestId], foreignColumns: [opsRequests.organizationId, opsRequests.id] }),
  foreignKey({ name: "fk_ops_request_impact_store", columns: [table.organizationId, table.storeId], foreignColumns: [opsStores.organizationId, opsStores.id] }),
  check("chk_ops_request_impact_kind", sql`${table.assessmentKind} IN ('initial_report', 'review')`),
  check("chk_ops_request_impact_disposition", sql`${table.reviewDisposition} IS NULL OR ${table.reviewDisposition} IN ('confirmed', 'revised')`),
  check("chk_ops_request_impact_review_disposition", sql`(${table.assessmentKind} = 'initial_report' AND ${table.reviewDisposition} IS NULL) OR (${table.assessmentKind} = 'review' AND ${table.reviewDisposition} IS NOT NULL)`),
  check("chk_ops_request_impact_operating_state", sql`${table.storeOperatingState} IN ('open', 'partially_operational', 'unable_to_operate', 'unknown')`),
  check("chk_ops_request_impact_safety", sql`${table.safetyConcern} IN ('none_reported', 'potential', 'immediate', 'unknown')`),
  check("chk_ops_request_impact_inventory", sql`${table.productInventoryRisk} IN ('none_reported', 'at_risk', 'loss_reported', 'unknown')`),
  check("chk_ops_request_impact_inventory_value", sql`(${table.productInventoryValueMinor} IS NULL AND ${table.productInventoryCurrency} IS NULL) OR (${table.productInventoryValueMinor} >= 0 AND length(trim(${table.productInventoryCurrency})) > 0)`),
  check("chk_ops_request_impact_customers", sql`${table.customersAffected} IN ('yes', 'no', 'unknown')`),
  check("chk_ops_request_impact_compliance", sql`${table.complianceImpact} IN ('none_reported', 'potential', 'confirmed', 'unknown')`),
  check("chk_ops_request_impact_capacity", sql`${table.capacityUnavailableBps} IS NULL OR ${table.capacityUnavailableBps} BETWEEN 0 AND 10000`),
  check("chk_ops_request_impact_redundancy", sql`${table.redundantEquipment} IN ('yes', 'no', 'unknown')`),
  check("chk_ops_request_impact_revenue", sql`${table.revenueFunctionImpact} IS NULL OR ${table.revenueFunctionImpact} IN ('fuel', 'foodservice', 'refrigerated_merchandise', 'beverages', 'lottery', 'car_wash', 'other')`),
  check("chk_ops_request_impact_revenue_exposure", sql`(${table.estimatedDailyRevenueExposureMinor} IS NULL AND ${table.estimatedDailyRevenueExposureCurrency} IS NULL) OR (${table.estimatedDailyRevenueExposureMinor} >= 0 AND length(trim(${table.estimatedDailyRevenueExposureCurrency})) > 0)`),
  check("chk_ops_request_impact_downtime", sql`${table.estimatedDowntimeMinutes} IS NULL OR ${table.estimatedDowntimeMinutes} BETWEEN 0 AND 525600`),
  check("chk_ops_request_impact_confidence", sql`${table.confidence} IN ('low', 'medium', 'high')`),
  check("chk_ops_request_impact_source", sql`${table.source} IN ('store_report', 'manager_review', 'imported', 'not_assessed')`),
  check("chk_ops_request_impact_actor_type", sql`${table.assessedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')`),
]);

export const opsWorkOrders = sqliteTable("ops_work_orders", {
  id: id(), organizationId: organizationId(), number: text("number").notNull(), storeId: text("store_id").notNull(), requestId: text("request_id"), problem: text("problem").notNull(), authorizedScope: text("authorized_scope"), categoryKey: text("category_key"), taxonomyNodeId: text("taxonomy_node_id"), assetId: text("asset_id"), componentId: text("component_id"),
  priority: text("priority").notNull(), status: text("status").notNull(), version: integer("version").notNull().default(0), accountableParty: text("accountable_party").notNull(), nextAction: text("next_action").notNull(), dueAt: text("due_at"), escalationTo: text("escalation_to"),
  nteAmountMinor: integer("nte_amount_minor"), nteCurrency: text("nte_currency"), repairEstimateAmountMinor: integer("repair_estimate_amount_minor"), repairEstimateCurrency: text("repair_estimate_currency"), estimatedServiceExtensionMonths: integer("estimated_service_extension_months"), vendorServiceTicketNumber: text("vendor_service_ticket_number"), vendorInvoiceNumber: text("vendor_invoice_number"), externalAccountingPo: text("external_accounting_po"), createdAt: createdAt(), resolvedAt: text("resolved_at"), closedAt: text("closed_at"),
}, (table) => [
  uniqueIndex("uidx_ops_work_orders_org_number").on(table.organizationId, table.number),
  uniqueIndex("uidx_ops_work_orders_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_work_orders_org_request").on(table.organizationId, table.requestId).where(sql`${table.requestId} IS NOT NULL`),
  index("idx_ops_work_orders_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_ops_work_orders_org_store_created").on(table.organizationId, table.storeId, table.createdAt),
  index("idx_ops_work_orders_org_category_created").on(table.organizationId, table.categoryKey, table.createdAt),
  check("chk_ops_work_orders_status", sql`${table.status} IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'resolved', 'closed', 'cancelled')`),
  check("chk_ops_work_orders_resolution_time", sql`${table.resolvedAt} IS NULL OR ${table.resolvedAt} >= ${table.createdAt}`),
]);

export const opsWorkOrderAssignments = sqliteTable("ops_work_order_assignments", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), kind: text("kind").notNull(), vendorId: text("vendor_id"), internalMembershipId: text("internal_membership_id"), status: text("status").notNull(), assignedAt: text("assigned_at").notNull(), supersedesAssignmentId: text("supersedes_assignment_id"),
}, (table) => [
  uniqueIndex("uidx_ops_assignments_org_work_active").on(table.organizationId, table.workOrderId).where(sql`${table.status} IN ('pending', 'issued', 'opened', 'accepted')`),
  index("idx_ops_assignments_org_work_status").on(table.organizationId, table.workOrderId, table.status),
  index("idx_ops_assignments_org_vendor_status").on(table.organizationId, table.vendorId, table.status),
]);

export const opsApprovalPolicies = sqliteTable("ops_approval_policies", {
  id: id(), organizationId: organizationId(), policyKey: text("policy_key").notNull(), version: integer("version").notNull(), name: text("name").notNull(),
  scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), categoryKey: text("category_key"),
  minAmountMinor: integer("min_amount_minor").notNull(), maxAmountMinor: integer("max_amount_minor"), currency: text("currency").notNull(),
  requiredRole: text("required_role").notNull(), escalationRole: text("escalation_role"), status: text("status").notNull(),
  supersedesPolicyId: text("supersedes_policy_id"), createdByMembershipId: text("created_by_membership_id"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_approval_policies_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_approval_policies_org_key_version").on(table.organizationId, table.policyKey, table.version),
  index("idx_ops_approval_policies_org_status_scope").on(table.organizationId, table.status, table.scopeKind, table.scopeId),
  index("idx_ops_approval_policies_org_category_amount").on(table.organizationId, table.categoryKey, table.minAmountMinor),
  foreignKey({ name: "fk_ops_approval_policies_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_approval_policies_supersedes", columns: [table.organizationId, table.supersedesPolicyId], foreignColumns: [table.organizationId, table.id] }),
  check("chk_ops_approval_policies_version", sql`${table.version} > 0`),
  check("chk_ops_approval_policies_scope", sql`${table.scopeKind} IN ('organization', 'region', 'store')`),
  check("chk_ops_approval_policies_amount", sql`${table.minAmountMinor} BETWEEN 0 AND 9007199254740991 AND (${table.maxAmountMinor} IS NULL OR ${table.maxAmountMinor} BETWEEN ${table.minAmountMinor} AND 9007199254740991)`),
  check("chk_ops_approval_policies_currency", sql`length(trim(${table.currency})) > 0`),
  check("chk_ops_approval_policies_required_role", sql`${table.requiredRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_policies_escalation_role", sql`${table.escalationRole} IS NULL OR ${table.escalationRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_policies_status", sql`${table.status} IN ('active', 'superseded', 'inactive')`),
]);

export const opsApprovalRequests = sqliteTable("ops_approval_requests", {
  id: id(), organizationId: organizationId(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), storeId: text("store_id").notNull(), categoryKey: text("category_key"),
  amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), policyId: text("policy_id").notNull(), policyKey: text("policy_key").notNull(), policyVersion: integer("policy_version").notNull(), policyName: text("policy_name").notNull(),
  policyScopeKind: text("policy_scope_kind").notNull(), policyScopeId: text("policy_scope_id").notNull(), requiredRole: text("required_role").notNull(), escalationRole: text("escalation_role"),
  requestedByMembershipId: text("requested_by_membership_id"), requestedByName: text("requested_by_name").notNull(), reason: text("reason"), requestedAt: text("requested_at").notNull(), dueAt: text("due_at"), parentApprovalRequestId: text("parent_approval_request_id"),
}, (table) => [
  uniqueIndex("uidx_ops_approval_requests_org_id").on(table.organizationId, table.id),
  index("idx_ops_approval_requests_org_subject_time").on(table.organizationId, table.subjectType, table.subjectId, table.requestedAt),
  index("idx_ops_approval_requests_org_role_due").on(table.organizationId, table.requiredRole, table.dueAt),
  foreignKey({ name: "fk_ops_approval_requests_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_approval_requests_policy", columns: [table.organizationId, table.policyId], foreignColumns: [opsApprovalPolicies.organizationId, opsApprovalPolicies.id] }),
  foreignKey({ name: "fk_ops_approval_requests_store", columns: [table.organizationId, table.storeId], foreignColumns: [opsStores.organizationId, opsStores.id] }),
  foreignKey({ name: "fk_ops_approval_requests_parent", columns: [table.organizationId, table.parentApprovalRequestId], foreignColumns: [table.organizationId, table.id] }),
  check("chk_ops_approval_requests_subject", sql`${table.subjectType} IN ('service_request', 'work_order')`),
  check("chk_ops_approval_requests_amount", sql`${table.amountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_approval_requests_policy_version", sql`${table.policyVersion} > 0`),
  check("chk_ops_approval_requests_scope", sql`${table.policyScopeKind} IN ('organization', 'region', 'store')`),
  check("chk_ops_approval_requests_required_role", sql`${table.requiredRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_requests_due", sql`${table.dueAt} IS NULL OR ${table.dueAt} >= ${table.requestedAt}`),
]);

export const opsApprovalDecisions = sqliteTable("ops_approval_decisions", {
  id: id(), organizationId: organizationId(), approvalRequestId: text("approval_request_id").notNull(), decision: text("decision").notNull(),
  decidedByMembershipId: text("decided_by_membership_id"), decidedByName: text("decided_by_name").notNull(), decidedByRole: text("decided_by_role").notNull(), reason: text("reason"), escalatedToRole: text("escalated_to_role"), decidedAt: text("decided_at").notNull(),
}, (table) => [
  uniqueIndex("uidx_ops_approval_decisions_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_approval_decisions_org_request").on(table.organizationId, table.approvalRequestId),
  index("idx_ops_approval_decisions_org_time").on(table.organizationId, table.decidedAt),
  foreignKey({ name: "fk_ops_approval_decisions_request", columns: [table.organizationId, table.approvalRequestId], foreignColumns: [opsApprovalRequests.organizationId, opsApprovalRequests.id] }),
  check("chk_ops_approval_decisions_kind", sql`${table.decision} IN ('approved', 'rejected', 'escalated', 'cancelled')`),
  check("chk_ops_approval_decisions_role", sql`${table.decidedByRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_decisions_escalated", sql`(${table.decision} = 'escalated' AND ${table.escalatedToRole} IS NOT NULL) OR (${table.decision} <> 'escalated' AND ${table.escalatedToRole} IS NULL)`),
]);

export const opsWorkOrderIssuances = sqliteTable("ops_work_order_issuances", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), assignmentId: text("assignment_id").notNull(), revision: integer("revision").notNull(), immutablePayloadJson: text("immutable_payload_json").notNull(), channel: text("channel").notNull(), issuedAt: text("issued_at").notNull(),
}, (table) => [uniqueIndex("uidx_ops_issuances_org_work_revision").on(table.organizationId, table.workOrderId, table.revision), index("idx_ops_issuances_org_assignment").on(table.organizationId, table.assignmentId, table.issuedAt)]);

export const opsVendorResponses = sqliteTable("ops_vendor_responses", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), assignmentId: text("assignment_id").notNull(), issuanceId: text("issuance_id").notNull(), response: text("response").notNull(), responderName: text("responder_name").notNull(), proposedAt: text("proposed_at"), message: text("message"), respondedAt: text("responded_at").notNull(),
}, (table) => [index("idx_ops_vendor_responses_org_assignment_time").on(table.organizationId, table.assignmentId, table.respondedAt), index("idx_ops_vendor_responses_org_work_time").on(table.organizationId, table.workOrderId, table.respondedAt)]);

export const opsWorkOrderEstimateRequests = sqliteTable("ops_work_order_estimate_requests", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), kind: text("kind").notNull(), decisionKind: text("decision_kind").notNull().default("service_bid"), requestedScope: text("requested_scope").notNull(), status: text("status").notNull(), channel: text("channel").notNull(), requestedAt: text("requested_at").notNull(), dueAt: text("due_at"), openedAt: text("opened_at"), respondedAt: text("responded_at"), decisionAt: text("decision_at"),
}, (table) => [
  uniqueIndex("uidx_ops_estimate_requests_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_estimate_requests_org_context").on(table.organizationId, table.id, table.workOrderId, table.vendorId),
  uniqueIndex("uidx_ops_estimate_requests_org_work_vendor_active").on(table.organizationId, table.workOrderId, table.vendorId).where(sql`${table.status} IN ('requested', 'opened', 'submitted')`),
  uniqueIndex("uidx_ops_estimate_requests_org_work_selected").on(table.organizationId, table.workOrderId).where(sql`${table.status} = 'selected'`),
  index("idx_ops_estimate_requests_org_work_status_requested").on(table.organizationId, table.workOrderId, table.status, table.requestedAt),
  index("idx_ops_estimate_requests_org_vendor_status_due").on(table.organizationId, table.vendorId, table.status, table.dueAt),
  index("idx_ops_estimate_requests_org_status_due").on(table.organizationId, table.status, table.dueAt),
  foreignKey({ name: "fk_ops_estimate_requests_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_estimate_requests_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_estimate_requests_vendor", columns: [table.organizationId, table.vendorId], foreignColumns: [opsVendors.organizationId, opsVendors.id] }),
  check("chk_ops_estimate_requests_kind", sql`${table.kind} IN ('estimate_only', 'diagnostic_and_estimate')`),
  check("chk_ops_estimate_requests_decision_kind", sql`${table.decisionKind} IN ('service_bid', 'replacement_quote')`),
  check("chk_ops_estimate_requests_status", sql`${table.status} IN ('requested', 'opened', 'submitted', 'declined', 'expired', 'withdrawn', 'selected', 'not_selected')`),
  check("chk_ops_estimate_requests_channel", sql`${table.channel} IN ('email', 'sms', 'manual')`),
  check("chk_ops_estimate_requests_scope", sql`length(trim(${table.requestedScope})) > 0`),
  check("chk_ops_estimate_requests_due", sql`${table.dueAt} IS NULL OR ${table.dueAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_opened", sql`${table.openedAt} IS NULL OR ${table.openedAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_responded", sql`${table.respondedAt} IS NULL OR ${table.respondedAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_decision", sql`${table.decisionAt} IS NULL OR ${table.decisionAt} >= ${table.requestedAt}`),
]);

export const opsVendorEstimateProposals = sqliteTable("ops_vendor_estimate_proposals", {
  id: id(), organizationId: organizationId(), requestId: text("request_id").notNull(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), revision: integer("revision").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), scope: text("scope").notNull(), exclusions: text("exclusions"), leadTimeDays: integer("lead_time_days"), validUntil: text("valid_until"), submittedAt: text("submitted_at").notNull(),
}, (table) => [
  uniqueIndex("uidx_ops_estimate_proposals_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_estimate_proposals_org_request_revision").on(table.organizationId, table.requestId, table.revision),
  index("idx_ops_estimate_proposals_org_work_submitted").on(table.organizationId, table.workOrderId, table.submittedAt),
  index("idx_ops_estimate_proposals_org_vendor_submitted").on(table.organizationId, table.vendorId, table.submittedAt),
  foreignKey({ name: "fk_ops_estimate_proposals_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_estimate_proposals_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_estimate_proposals_vendor", columns: [table.organizationId, table.vendorId], foreignColumns: [opsVendors.organizationId, opsVendors.id] }),
  foreignKey({ name: "fk_ops_estimate_proposals_request_context", columns: [table.organizationId, table.requestId, table.workOrderId, table.vendorId], foreignColumns: [opsWorkOrderEstimateRequests.organizationId, opsWorkOrderEstimateRequests.id, opsWorkOrderEstimateRequests.workOrderId, opsWorkOrderEstimateRequests.vendorId] }),
  check("chk_ops_estimate_proposals_revision", sql`${table.revision} > 0`),
  check("chk_ops_estimate_proposals_amount", sql`${table.amountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_estimate_proposals_currency", sql`length(trim(${table.currency})) > 0`),
  check("chk_ops_estimate_proposals_scope", sql`length(trim(${table.scope})) > 0`),
  check("chk_ops_estimate_proposals_lead_time", sql`${table.leadTimeDays} IS NULL OR ${table.leadTimeDays} BETWEEN 0 AND 3650`),
  check("chk_ops_estimate_proposals_valid_until", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.submittedAt}`),
]);

export const opsVisitSessions = sqliteTable("ops_visit_sessions", {
  id: id(), organizationId: organizationId(), storeId: text("store_id").notNull(), providerKind: text("provider_kind").notNull(), vendorId: text("vendor_id"), internalMembershipId: text("internal_membership_id"), workOrderId: text("work_order_id"), unmatchedReason: text("unmatched_reason"), technicianName: text("technician_name").notNull(), technicianPhoneOrPin: text("technician_phone_or_pin"), crewCount: integer("crew_count").notNull().default(1), additionalTechnicianNamesJson: text("additional_technician_names_json").notNull().default("[]"), vehicleIdentifier: text("vehicle_identifier"), arrivalNote: text("arrival_note"), providerName: text("provider_name").notNull(), purpose: text("purpose").notNull(), status: text("status").notNull(), startedChannel: text("started_channel").notNull(), endedChannel: text("ended_channel"), checkedInAt: text("checked_in_at").notNull(), checkedOutAt: text("checked_out_at"), outcome: text("outcome"), outcomeNotes: text("outcome_notes"), observedDurationSeconds: integer("observed_duration_seconds"),
}, (table) => [
  uniqueIndex("uidx_ops_visits_org_id").on(table.organizationId, table.id),
  index("idx_ops_visits_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.checkedInAt),
  index("idx_ops_visits_org_vendor_status_time").on(table.organizationId, table.vendorId, table.status, table.checkedInAt),
  index("idx_ops_visits_org_work_time").on(table.organizationId, table.workOrderId, table.checkedInAt),
  check("chk_ops_visits_crew_count", sql`${table.crewCount} BETWEEN 1 AND 100`),
  check("chk_ops_visits_additional_technicians", sql`json_valid(${table.additionalTechnicianNamesJson}) AND json_type(${table.additionalTechnicianNamesJson}) = 'array' AND json_array_length(${table.additionalTechnicianNamesJson}) < ${table.crewCount}`),
]);

export const opsVisitEvidence = sqliteTable("ops_visit_evidence", {
  id: id(), organizationId: organizationId(), visitId: text("visit_id").notNull(), kind: text("kind").notNull(), channel: text("channel").notNull(), observedAt: text("observed_at").notNull(), locationResult: text("location_result"), latitudeE6: integer("latitude_e6"), longitudeE6: integer("longitude_e6"), accuracyM: integer("accuracy_m"), distanceM: integer("distance_m"), payloadJson: text("payload_json").notNull().default("{}"),
}, (table) => [index("idx_ops_visit_evidence_org_visit_time").on(table.organizationId, table.visitId, table.observedAt), index("idx_ops_visit_evidence_org_kind_time").on(table.organizationId, table.kind, table.observedAt), uniqueIndex("uidx_ops_visit_boundary_evidence").on(table.organizationId, table.visitId, table.kind).where(sql`${table.kind} IN ('check_in', 'check_out')`)]);

export const opsFiles = sqliteTable("ops_files", {
  id: id(), organizationId: organizationId(), storageKey: text("storage_key").notNull(), sha256: text("sha256").notNull(), originalName: text("original_name").notNull(), contentType: text("content_type").notNull(), byteLength: integer("byte_length").notNull(), status: text("status").notNull().default("available"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_files_org_storage_key").on(table.organizationId, table.storageKey), index("idx_ops_files_org_sha256").on(table.organizationId, table.sha256)]);

export const opsEntityFiles = sqliteTable("ops_entity_files", {
  id: id(), organizationId: organizationId(), fileId: text("file_id").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), purpose: text("purpose").notNull(), visibility: text("visibility").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_entity_files_org_file_entity").on(table.organizationId, table.fileId, table.entityType, table.entityId, table.purpose), index("idx_ops_entity_files_org_entity").on(table.organizationId, table.entityType, table.entityId)]);

export const opsFollowUps = sqliteTable("ops_follow_ups", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), sourceVisitId: text("source_visit_id"), accountableParty: text("accountable_party").notNull(), nextAction: text("next_action").notNull(), dueAt: text("due_at").notNull(), escalationTo: text("escalation_to").notNull(), status: text("status").notNull(), createdAt: createdAt(), completedAt: text("completed_at"),
}, (table) => [uniqueIndex("uidx_ops_followups_org_id").on(table.organizationId, table.id), index("idx_ops_followups_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_ops_followups_org_work").on(table.organizationId, table.workOrderId, table.createdAt)]);

export const opsSiteVisitWorkOrders = sqliteTable("ops_site_visit_work_orders", {
  id: id(),
  organizationId: organizationId(),
  visitId: text("visit_id").notNull(),
  workOrderId: text("work_order_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  linkedByActorType: text("linked_by_actor_type").notNull(),
  linkedByActorId: text("linked_by_actor_id"),
  linkedByActorName: text("linked_by_actor_name").notNull(),
  linkedAt: text("linked_at").notNull(),
  outcome: text("outcome"),
  outcomeNotes: text("outcome_notes"),
  outcomeRecordedByActorType: text("outcome_recorded_by_actor_type"),
  outcomeRecordedByActorId: text("outcome_recorded_by_actor_id"),
  outcomeRecordedByActorName: text("outcome_recorded_by_actor_name"),
  outcomeRecordedAt: text("outcome_recorded_at"),
  followUpId: text("follow_up_id"),
}, (table) => [
  uniqueIndex("uidx_ops_site_visit_work_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_site_visit_work_org_id_work").on(table.organizationId, table.id, table.workOrderId),
  uniqueIndex("uidx_ops_site_visit_work_org_visit_work").on(table.organizationId, table.visitId, table.workOrderId),
  uniqueIndex("uidx_ops_site_visit_work_org_visit_ordinal").on(table.organizationId, table.visitId, table.ordinal),
  index("idx_ops_site_visit_work_org_work_time").on(table.organizationId, table.workOrderId, table.linkedAt),
  index("idx_ops_site_visit_work_org_outcome_time").on(table.organizationId, table.outcome, table.outcomeRecordedAt),
  foreignKey({ name: "fk_ops_site_visit_work_visit", columns: [table.organizationId, table.visitId], foreignColumns: [opsVisitSessions.organizationId, opsVisitSessions.id] }),
  foreignKey({ name: "fk_ops_site_visit_work_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_site_visit_work_followup", columns: [table.organizationId, table.followUpId], foreignColumns: [opsFollowUps.organizationId, opsFollowUps.id] }),
  check("chk_ops_site_visit_work_ordinal", sql`${table.ordinal} > 0`),
  check("chk_ops_site_visit_work_link_actor", sql`${table.linkedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support') AND length(trim(${table.linkedByActorName})) > 0`),
  check("chk_ops_site_visit_work_outcome", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')`),
  check("chk_ops_site_visit_work_outcome_actor", sql`${table.outcomeRecordedByActorType} IS NULL OR ${table.outcomeRecordedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')`),
  check("chk_ops_site_visit_work_outcome_state", sql`(${table.outcome} IS NULL AND ${table.outcomeNotes} IS NULL AND ${table.outcomeRecordedByActorType} IS NULL AND ${table.outcomeRecordedByActorId} IS NULL AND ${table.outcomeRecordedByActorName} IS NULL AND ${table.outcomeRecordedAt} IS NULL AND ${table.followUpId} IS NULL) OR (${table.outcome} IS NOT NULL AND ${table.outcomeRecordedByActorType} IS NOT NULL AND length(trim(${table.outcomeRecordedByActorName})) > 0 AND ${table.outcomeRecordedAt} IS NOT NULL)`),
  check("chk_ops_site_visit_work_followup_outcome", sql`${table.followUpId} IS NULL OR ${table.outcome} NOT IN ('completed', 'no_issue_found')`),
]);

export const opsWorkOrderVerifications = sqliteTable("ops_work_order_verifications", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  siteVisitWorkOrderId: text("site_visit_work_order_id").notNull(),
  outcome: text("outcome").notNull(),
  outcomeRecordedAt: text("outcome_recorded_at").notNull(),
  cycle: integer("cycle").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason"),
  decidedByMembershipId: text("decided_by_membership_id").notNull(),
  decidedByName: text("decided_by_name").notNull(),
  decidedAt: text("decided_at").notNull(),
}, (table) => [
  uniqueIndex("uidx_ops_work_verifications_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_work_verifications_org_cycle").on(table.organizationId, table.workOrderId, table.cycle),
  uniqueIndex("uidx_ops_work_verifications_org_outcome").on(table.organizationId, table.siteVisitWorkOrderId),
  index("idx_ops_work_verifications_org_work_time").on(table.organizationId, table.workOrderId, table.decidedAt),
  foreignKey({ name: "fk_ops_work_verifications_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_work_verifications_outcome", columns: [table.organizationId, table.siteVisitWorkOrderId, table.workOrderId], foreignColumns: [opsSiteVisitWorkOrders.organizationId, opsSiteVisitWorkOrders.id, opsSiteVisitWorkOrders.workOrderId] }),
  foreignKey({ name: "fk_ops_work_verifications_member", columns: [table.organizationId, table.decidedByMembershipId], foreignColumns: [opsMemberships.organizationId, opsMemberships.id] }),
  check("chk_ops_work_verifications_outcome", sql`${table.outcome} IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')`),
  check("chk_ops_work_verifications_cycle", sql`${table.cycle} > 0`),
  check("chk_ops_work_verifications_decision", sql`${table.decision} IN ('verified', 'rejected')`),
  check("chk_ops_work_verifications_reason", sql`${table.decision} <> 'rejected' OR (${table.reason} IS NOT NULL AND length(trim(${table.reason})) > 0)`),
  check("chk_ops_work_verifications_actor", sql`length(trim(${table.decidedByName})) > 0`),
  check("chk_ops_work_verifications_time", sql`${table.decidedAt} >= ${table.outcomeRecordedAt}`),
]);

export const opsWorkflowTasks = sqliteTable("ops_workflow_tasks", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id"),
  serviceRequestId: text("service_request_id"),
  taskType: text("task_type").notNull(),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  assigneeType: text("assignee_type").notNull(),
  assigneeId: text("assignee_id"),
  assigneeRole: text("assignee_role"),
  assigneeName: text("assignee_name").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  blocking: bool("blocking"),
  requiredForProgress: bool("required_for_progress"),
  dueAt: text("due_at"),
  noSlaReason: text("no_sla_reason"),
  applicableSlaClock: text("applicable_sla_clock"),
  completionCriteria: text("completion_criteria").notNull(),
  escalationDestination: text("escalation_destination").notNull(),
  escalationLevel: integer("escalation_level").notNull().default(0),
  sourceFollowUpId: text("source_follow_up_id"),
  sourceApprovalRequestId: text("source_approval_request_id"),
  createdByActorType: text("created_by_actor_type").notNull(),
  createdByActorId: text("created_by_actor_id"),
  createdByActorName: text("created_by_actor_name").notNull(),
  createdAt: createdAt(),
  startedByActorType: text("started_by_actor_type"),
  startedByActorId: text("started_by_actor_id"),
  startedByActorName: text("started_by_actor_name"),
  startedAt: text("started_at"),
  completedByActorType: text("completed_by_actor_type"),
  completedByActorId: text("completed_by_actor_id"),
  completedByActorName: text("completed_by_actor_name"),
  completedAt: text("completed_at"),
  cancelledByActorType: text("cancelled_by_actor_type"),
  cancelledByActorId: text("cancelled_by_actor_id"),
  cancelledByActorName: text("cancelled_by_actor_name"),
  cancelledAt: text("cancelled_at"),
  resolutionNote: text("resolution_note"),
}, (table) => [
  uniqueIndex("uidx_ops_workflow_tasks_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_workflow_tasks_org_followup").on(table.organizationId, table.sourceFollowUpId),
  uniqueIndex("uidx_ops_workflow_tasks_org_approval").on(table.organizationId, table.sourceApprovalRequestId),
  index("idx_ops_workflow_tasks_org_work_status_due").on(table.organizationId, table.workOrderId, table.status, table.dueAt),
  index("idx_ops_workflow_tasks_org_request_status_due").on(table.organizationId, table.serviceRequestId, table.status, table.dueAt),
  index("idx_ops_workflow_tasks_org_assignee_status_due").on(table.organizationId, table.assigneeType, table.assigneeId, table.status, table.dueAt),
  foreignKey({ name: "fk_ops_workflow_tasks_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_workflow_tasks_request", columns: [table.organizationId, table.serviceRequestId], foreignColumns: [opsRequests.organizationId, opsRequests.id] }),
  check("chk_ops_workflow_tasks_subject", sql`(${table.workOrderId} IS NOT NULL AND ${table.serviceRequestId} IS NULL) OR (${table.workOrderId} IS NULL AND ${table.serviceRequestId} IS NOT NULL)`),
  check("chk_ops_workflow_tasks_type", sql`${table.taskType} IN ('review_issue', 'approve_quote', 'vendor_response_required', 'confirm_store_access', 'submit_quote', 'choose_service_provider', 'schedule_service', 'record_service_outcome', 'schedule_return_visit', 'verify_repair', 'close_verified_work', 'review_warranty', 'resolve_invoice_exception', 'respond_service_discrepancy', 'other')`),
  check("chk_ops_workflow_tasks_assignee_type", sql`${table.assigneeType} IN ('user', 'team', 'vendor', 'role')`),
  check("chk_ops_workflow_tasks_assignee_shape", sql`(${table.assigneeType} = 'role' AND ${table.assigneeId} IS NULL AND ${table.assigneeRole} IS NOT NULL) OR (${table.assigneeType} <> 'role' AND ${table.assigneeId} IS NOT NULL AND ${table.assigneeRole} IS NULL)`),
  check("chk_ops_workflow_tasks_priority", sql`${table.priority} IN ('critical', 'high', 'normal', 'low')`),
  check("chk_ops_workflow_tasks_status", sql`${table.status} IN ('open', 'in_progress', 'completed', 'cancelled')`),
  check("chk_ops_workflow_tasks_sla_target", sql`(${table.dueAt} IS NOT NULL AND ${table.noSlaReason} IS NULL) OR (${table.dueAt} IS NULL AND length(trim(${table.noSlaReason})) > 0)`),
  check("chk_ops_workflow_tasks_escalation", sql`${table.escalationLevel} >= 0 AND length(trim(${table.escalationDestination})) > 0`),
  check("chk_ops_workflow_tasks_required_text", sql`length(trim(${table.title})) > 0 AND length(trim(${table.reason})) > 0 AND length(trim(${table.assigneeName})) > 0 AND length(trim(${table.completionCriteria})) > 0 AND length(trim(${table.createdByActorName})) > 0`),
  check("chk_ops_workflow_tasks_terminal_shape", sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL AND ${table.completedByActorType} IS NOT NULL AND ${table.completedByActorName} IS NOT NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL AND ${table.cancelledByActorType} IS NOT NULL AND ${table.cancelledByActorName} IS NOT NULL AND ${table.completedAt} IS NULL) OR (${table.status} IN ('open', 'in_progress') AND ${table.completedAt} IS NULL AND ${table.cancelledAt} IS NULL)`),
]);

export const opsWorkflowTaskSlaPauses = sqliteTable("ops_workflow_task_sla_pauses", {
  id: id(), organizationId: organizationId(), workflowTaskId: text("workflow_task_id").notNull(), workOrderId: text("work_order_id").notNull(),
  reasonCode: text("reason_code").notNull(), reasonDetail: text("reason_detail").notNull(), ownerType: text("owner_type").notNull(), ownerId: text("owner_id"), ownerName: text("owner_name").notNull(),
  affectedClocksJson: text("affected_clocks_json").notNull(), expectedResumeAt: text("expected_resume_at"), pausedByActorType: text("paused_by_actor_type").notNull(), pausedByActorId: text("paused_by_actor_id"), pausedByActorName: text("paused_by_actor_name").notNull(), pausedAt: text("paused_at").notNull(),
}, (table) => [
  uniqueIndex("uidx_ops_workflow_task_pauses_org_id").on(table.organizationId, table.id),
  index("idx_ops_workflow_task_pauses_org_task_time").on(table.organizationId, table.workflowTaskId, table.pausedAt),
  foreignKey({ name: "fk_ops_workflow_task_pauses_task", columns: [table.organizationId, table.workflowTaskId], foreignColumns: [opsWorkflowTasks.organizationId, opsWorkflowTasks.id] }),
  foreignKey({ name: "fk_ops_workflow_task_pauses_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  check("chk_ops_workflow_task_pauses_reason", sql`${table.reasonCode} IN ('awaiting_vendor', 'awaiting_parts', 'awaiting_approval', 'awaiting_store_access', 'awaiting_customer', 'weather_or_site_condition', 'scheduled_future_event', 'external_dependency', 'other')`),
  check("chk_ops_workflow_task_pauses_owner", sql`${table.ownerType} IN ('membership', 'team', 'vendor', 'store', 'external_party', 'system')`),
  check("chk_ops_workflow_task_pauses_text", sql`length(trim(${table.reasonDetail})) > 0 AND length(trim(${table.ownerName})) > 0 AND length(trim(${table.pausedByActorName})) > 0 AND length(trim(${table.affectedClocksJson})) > 2`),
  check("chk_ops_workflow_task_pauses_expected", sql`${table.expectedResumeAt} IS NULL OR ${table.expectedResumeAt} > ${table.pausedAt}`),
]);

export const opsWorkflowTaskSlaResumes = sqliteTable("ops_workflow_task_sla_resumes", {
  id: id(), organizationId: organizationId(), workflowTaskId: text("workflow_task_id").notNull(), workOrderId: text("work_order_id").notNull(), pauseId: text("pause_id").notNull(),
  resumedByActorType: text("resumed_by_actor_type").notNull(), resumedByActorId: text("resumed_by_actor_id"), resumedByActorName: text("resumed_by_actor_name").notNull(), resumedAt: text("resumed_at").notNull(), note: text("note"),
}, (table) => [
  uniqueIndex("uidx_ops_workflow_task_resumes_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_workflow_task_resumes_org_pause").on(table.organizationId, table.pauseId),
  index("idx_ops_workflow_task_resumes_org_task_time").on(table.organizationId, table.workflowTaskId, table.resumedAt),
  foreignKey({ name: "fk_ops_workflow_task_resumes_task", columns: [table.organizationId, table.workflowTaskId], foreignColumns: [opsWorkflowTasks.organizationId, opsWorkflowTasks.id] }),
  foreignKey({ name: "fk_ops_workflow_task_resumes_pause", columns: [table.organizationId, table.pauseId], foreignColumns: [opsWorkflowTaskSlaPauses.organizationId, opsWorkflowTaskSlaPauses.id] }),
  foreignKey({ name: "fk_ops_workflow_task_resumes_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  check("chk_ops_workflow_task_resumes_actor", sql`length(trim(${table.resumedByActorName})) > 0`),
]);

export const opsExceptions = sqliteTable("ops_exceptions", {
  id: id(), organizationId: organizationId(), kind: text("kind").notNull(), storeId: text("store_id"), workOrderId: text("work_order_id"), visitId: text("visit_id"), vendorId: text("vendor_id"), severity: text("severity").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), detectedAt: text("detected_at").notNull(), resolvedAt: text("resolved_at"),
}, (table) => [index("idx_ops_exceptions_org_status_time").on(table.organizationId, table.status, table.detectedAt), index("idx_ops_exceptions_org_store_status").on(table.organizationId, table.storeId, table.status), index("idx_ops_exceptions_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsReplacementProfiles = sqliteTable("ops_replacement_profiles", {
  id: id(), organizationId: organizationId(), code: text("code").notNull(), name: text("name").notNull(), description: text("description").notNull(), categoryKey: text("category_key").notNull(), taxonomyNodeId: text("taxonomy_node_id"), matchKeysJson: text("match_keys_json").notNull().default("[]"), attributesJson: text("attributes_json").notNull().default("{}"), expectedLifeYears: integer("expected_life_years"), annualEscalationBps: integer("annual_escalation_bps").notNull().default(300), lowVarianceBps: integer("low_variance_bps").notNull().default(1000), highVarianceBps: integer("high_variance_bps").notNull().default(2000), active: bool("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_replacement_profiles_org_code").on(table.organizationId, table.code), index("idx_ops_replacement_profiles_org_category_active").on(table.organizationId, table.categoryKey, table.active)]);

export const opsAssets = sqliteTable("ops_assets", {
  id: id(), organizationId: organizationId(), storeId: text("store_id").notNull(), categoryKey: text("category_key").notNull(), taxonomyNodeId: text("taxonomy_node_id"), equipmentTemplateId: text("equipment_template_id"), groupPathJson: text("group_path_json").notNull().default("[]"), assetTag: text("asset_tag").notNull(), name: text("name").notNull(), manufacturer: text("manufacturer"), model: text("model"), serialNumber: text("serial_number"), supplier: text("supplier"), installedAt: text("installed_at"), expectedLifeYears: integer("expected_life_years"), warrantyEndsAt: text("warranty_ends_at"), replacementProfileId: text("replacement_profile_id"), replacementAttributesJson: text("replacement_attributes_json").notNull().default("{}"), replacementAdjustmentBps: integer("replacement_adjustment_bps"), replacementEstimateMinor: integer("replacement_estimate_minor"), replacementCurrency: text("replacement_currency"), status: text("status").notNull(), retiredAt: text("retired_at"), replacedByAssetId: text("replaced_by_asset_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_assets_org_store_tag").on(table.organizationId, table.storeId, table.assetTag), index("idx_ops_assets_org_store_category").on(table.organizationId, table.storeId, table.categoryKey), index("idx_ops_assets_org_status").on(table.organizationId, table.status), index("idx_ops_assets_org_equipment_template").on(table.organizationId, table.equipmentTemplateId, table.status), index("idx_ops_assets_org_replacement_profile").on(table.organizationId, table.replacementProfileId, table.status)]);

export const opsReplacementBenchmarks = sqliteTable("ops_replacement_benchmarks", {
  id: id(), organizationId: organizationId(), profileId: text("profile_id").notNull(), sourceType: text("source_type").notNull(), sourceWorkOrderId: text("source_work_order_id"), sourceEstimateProposalId: text("source_estimate_proposal_id"), sourceAssetId: text("source_asset_id"), sourceVendorId: text("source_vendor_id"), equipmentAmountMinor: integer("equipment_amount_minor").notNull(), installationAmountMinor: integer("installation_amount_minor").notNull(), otherAmountMinor: integer("other_amount_minor").notNull(), totalAmountMinor: integer("total_amount_minor").notNull(), currency: text("currency").notNull(), effectiveAt: text("effective_at").notNull(), status: text("status").notNull(), supersededAt: text("superseded_at"), notes: text("notes"), createdAt: createdAt(),
}, (table) => [index("idx_ops_replacement_benchmarks_org_profile_status_effective").on(table.organizationId, table.profileId, table.status, table.effectiveAt), uniqueIndex("uidx_ops_replacement_benchmarks_org_profile_published").on(table.organizationId, table.profileId).where(sql`${table.status} = 'published'`), uniqueIndex("uidx_ops_replacement_benchmarks_org_source_proposal").on(table.organizationId, table.sourceEstimateProposalId)]);

export const opsAssetReplacementOverrides = sqliteTable("ops_asset_replacement_overrides", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), sourceBenchmarkId: text("source_benchmark_id"), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), effectiveAt: text("effective_at").notNull(), reason: text("reason").notNull(), status: text("status").notNull(), supersededAt: text("superseded_at"), createdAt: createdAt(),
}, (table) => [index("idx_ops_asset_replacement_overrides_org_asset_status_effective").on(table.organizationId, table.assetId, table.status, table.effectiveAt), uniqueIndex("uidx_ops_asset_replacement_overrides_org_asset_active").on(table.organizationId, table.assetId).where(sql`${table.status} = 'active'`)]);

export const opsReplacementEvents = sqliteTable("ops_replacement_events", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), workOrderId: text("work_order_id").notNull(), profileId: text("profile_id").notNull(), sourceEstimateProposalId: text("source_estimate_proposal_id").notNull(), status: text("status").notNull(), approvedAmountMinor: integer("approved_amount_minor").notNull(), currency: text("currency").notNull(), approvedAt: text("approved_at").notNull(), completedAt: text("completed_at"), finalAmountMinor: integer("final_amount_minor"), replacementAssetId: text("replacement_asset_id"), createdAt: createdAt(),
}, (table) => [index("idx_ops_replacement_events_org_asset_status").on(table.organizationId, table.assetId, table.status), index("idx_ops_replacement_events_org_work").on(table.organizationId, table.workOrderId, table.createdAt), uniqueIndex("uidx_ops_replacement_events_org_proposal").on(table.organizationId, table.sourceEstimateProposalId)]);

export const opsLifecycleRecommendations = sqliteTable("ops_lifecycle_recommendations", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), workOrderId: text("work_order_id"), version: integer("version").notNull(), modelVersion: text("model_version").notNull(), recommendation: text("recommendation").notNull(), confidence: text("confidence").notNull(), inputsJson: text("inputs_json").notNull(), explanation: text("explanation").notNull(), missingDataJson: text("missing_data_json").notNull().default("[]"), userDecision: text("user_decision").notNull(), userReason: text("user_reason").notNull(), plannedForYear: integer("planned_for_year"), decidedByMembershipId: text("decided_by_membership_id").notNull(), decidedAt: text("decided_at").notNull(), actualOutcome: text("actual_outcome"), actualOutcomeAt: text("actual_outcome_at"), replacementEventId: text("replacement_event_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_lifecycle_recommendations_org_asset_version").on(table.organizationId, table.assetId, table.version), index("idx_ops_lifecycle_recommendations_org_asset_created").on(table.organizationId, table.assetId, table.createdAt)]);

export const opsAssetComponents = sqliteTable("ops_asset_components", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), parentComponentId: text("parent_component_id"), name: text("name").notNull(), partNumber: text("part_number"), serialNumber: text("serial_number"), installedAt: text("installed_at"), warrantyEndsAt: text("warranty_ends_at"), removedAt: text("removed_at"), replacedByComponentId: text("replaced_by_component_id"), createdAt: createdAt(),
}, (table) => [index("idx_ops_components_org_asset_parent").on(table.organizationId, table.assetId, table.parentComponentId)]);

export const opsComponentLifecycleEvents = sqliteTable("ops_component_lifecycle_events", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), removedComponentId: text("removed_component_id").notNull(), installedComponentId: text("installed_component_id").notNull(), repairItemId: text("repair_item_id").notNull(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), partManufacturer: text("part_manufacturer").notNull(), partModel: text("part_model").notNull(), serialNumber: text("serial_number"), removedAt: text("removed_at").notNull(), installedAt: text("installed_at").notNull(), failureMode: text("failure_mode").notNull(), rootCause: text("root_cause"), laborCostMinor: integer("labor_cost_minor").notNull(), partCostMinor: integer("part_cost_minor").notNull(), currency: text("currency").notNull(), replacementKind: text("replacement_kind").notNull(), expectedLifeMonths: integer("expected_life_months"), warrantyEndsAt: text("warranty_ends_at"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_component_lifecycle_org_removed").on(table.organizationId, table.removedComponentId), uniqueIndex("uidx_ops_component_lifecycle_org_repair").on(table.organizationId, table.repairItemId), index("idx_ops_component_lifecycle_org_model_removed").on(table.organizationId, table.partManufacturer, table.partModel, table.removedAt), index("idx_ops_component_lifecycle_org_vendor_removed").on(table.organizationId, table.vendorId, table.removedAt)]);

export const opsMaintenancePrograms = sqliteTable("ops_maintenance_programs", {
  id: id(), organizationId: organizationId(), programKey: text("program_key").notNull(), version: integer("version").notNull(), name: text("name").notNull(), tradeKey: text("trade_key").notNull(), workType: text("work_type").notNull(), applicableAssetTypesJson: text("applicable_asset_types_json").notNull().default("[]"), frequencyDays: integer("frequency_days").notNull(), recurrenceKind: text("recurrence_kind").notNull(), dueWindowDays: integer("due_window_days").notNull(), scheduleAnchorAt: text("schedule_anchor_at"), seasonalStartMonth: integer("seasonal_start_month"), seasonalEndMonth: integer("seasonal_end_month"), checklistTemplateId: text("checklist_template_id").notNull(), requiredEvidenceKindsJson: text("required_evidence_kinds_json").notNull().default("[]"), expectedDurationMinutes: integer("expected_duration_minutes").notNull(), completionCriteria: text("completion_criteria").notNull(), correctiveWorkAuthorityMinor: integer("corrective_work_authority_minor").notNull(), currency: text("currency").notNull(), deficiencyHandling: text("deficiency_handling").notNull(), status: text("status").notNull(), supersedesProgramId: text("supersedes_program_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_maintenance_program_org_key_version").on(table.organizationId, table.programKey, table.version), index("idx_ops_maintenance_program_org_status_trade").on(table.organizationId, table.status, table.tradeKey)]);

export const opsChecklistTemplates = sqliteTable("ops_checklist_templates", {
  id: id(), organizationId: organizationId(), name: text("name").notNull(), version: integer("version").notNull(), itemsJson: text("items_json").notNull().default("[]"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_checklist_templates_org_name_version").on(table.organizationId, table.name, table.version)]);

export const opsPmPlans = sqliteTable("ops_pm_plans", {
  id: id(), organizationId: organizationId(), name: text("name").notNull(), programId: text("program_id"), programVersion: integer("program_version"), storeId: text("store_id"), assetId: text("asset_id"), assetSelectionRule: text("asset_selection_rule"), categoryKey: text("category_key"), cadenceDays: integer("cadence_days").notNull(), completionWindowDays: integer("completion_window_days").notNull(), preferredVendorId: text("preferred_vendor_id"), backupVendorId: text("backup_vendor_id"), contractVersionId: text("contract_version_id"), effectiveStartsAt: text("effective_starts_at"), effectiveEndsAt: text("effective_ends_at"), accessRequirements: text("access_requirements"), programAuthorizationMinor: integer("program_authorization_minor"), budgetMinor: integer("budget_minor"), currency: text("currency"), serviceLevelPolicyId: text("service_level_policy_id"), schedulingMode: text("scheduling_mode"), escalationRules: text("escalation_rules"), cadenceOverrideReason: text("cadence_override_reason"), cadenceOverriddenAt: text("cadence_overridden_at"), cadenceOverriddenByMembershipId: text("cadence_overridden_by_membership_id"), active: bool("active"), createdAt: createdAt(),
}, (table) => [index("idx_ops_pm_plans_org_active_store").on(table.organizationId, table.active, table.storeId), index("idx_ops_pm_plans_org_asset").on(table.organizationId, table.assetId), uniqueIndex("uidx_ops_pm_plans_org_program_asset").on(table.organizationId, table.programId, table.assetId)]);

export const opsPmOccurrences = sqliteTable("ops_pm_occurrences", {
  id: id(), organizationId: organizationId(), planId: text("plan_id").notNull(), storeId: text("store_id").notNull(), assetId: text("asset_id"), workOrderId: text("work_order_id"), programId: text("program_id"), programVersion: integer("program_version"), planVersion: integer("plan_version"), dueAt: text("due_at").notNull(), windowStartsAt: text("window_starts_at").notNull(), windowEndsAt: text("window_ends_at").notNull(), proposedAt: text("proposed_at"), committedAt: text("committed_at"), status: text("status").notNull(), completedAt: text("completed_at"), result: text("result"), exceptionReason: text("exception_reason"), recurrenceKey: text("recurrence_key"), createdAt: text("created_at"),
}, (table) => [uniqueIndex("uidx_ops_pm_occurrences_org_plan_recurrence").on(table.organizationId, table.planId, table.recurrenceKey), index("idx_ops_pm_occurrences_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_ops_pm_occurrences_org_store_due").on(table.organizationId, table.storeId, table.dueAt), index("idx_ops_pm_occurrences_org_asset_due").on(table.organizationId, table.assetId, table.dueAt)]);

export const opsPmWorkItems = sqliteTable("ops_pm_work_items", {
  id: id(), organizationId: organizationId(), occurrenceId: text("occurrence_id").notNull(), workOrderId: text("work_order_id").notNull(), assetId: text("asset_id").notNull(), componentId: text("component_id"), requiredTask: text("required_task").notNull(), checklistTemplateId: text("checklist_template_id").notNull(), status: text("status").notNull(), result: text("result"), deficiency: text("deficiency"), followUpId: text("follow_up_id"), correctiveWorkOrderId: text("corrective_work_order_id"), costAllocationMinor: integer("cost_allocation_minor"), currency: text("currency").notNull(), createdAt: createdAt(), completedAt: text("completed_at"),
}, (table) => [index("idx_ops_pm_work_items_org_occurrence").on(table.organizationId, table.occurrenceId, table.assetId), index("idx_ops_pm_work_items_org_work").on(table.organizationId, table.workOrderId)]);

export const opsChecklistResponses = sqliteTable("ops_checklist_responses", {
  id: id(), organizationId: organizationId(), workItemId: text("work_item_id").notNull(), checklistTemplateId: text("checklist_template_id").notNull(), itemKey: text("item_key").notNull(), responseKind: text("response_kind").notNull(), passed: integer("passed", { mode: "boolean" }), numericValue: integer("numeric_value"), textValue: text("text_value"), measurementUnit: text("measurement_unit"), evidenceFileIdsJson: text("evidence_file_ids_json").notNull().default("[]"), recordedByActorType: text("recorded_by_actor_type").notNull(), recordedByActorId: text("recorded_by_actor_id"), recordedByActorName: text("recorded_by_actor_name").notNull(), recordedAt: text("recorded_at").notNull(),
}, (table) => [uniqueIndex("uidx_ops_checklist_responses_org_work_item_key").on(table.organizationId, table.workItemId, table.itemKey)]);

export const opsServiceRuns = sqliteTable("ops_service_runs", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id").notNull(), schedulingMode: text("scheduling_mode").notNull(), status: text("status").notNull(), proposedStartsAt: text("proposed_starts_at").notNull(), proposedEndsAt: text("proposed_ends_at").notNull(), responseDueAt: text("response_due_at").notNull(), committedStartsAt: text("committed_starts_at"), committedEndsAt: text("committed_ends_at"), estimatedDriveMinutes: integer("estimated_drive_minutes").notNull(), estimatedServiceMinutes: integer("estimated_service_minutes").notNull(), capacityUsedMinutes: integer("capacity_used_minutes").notNull(), expectedWorkValueMinor: integer("expected_work_value_minor").notNull(), currency: text("currency").notNull(), estimatedTripReduction: integer("estimated_trip_reduction").notNull(), estimatedOpportunityMinor: integer("estimated_opportunity_minor").notNull(), recommendationExplanation: text("recommendation_explanation").notNull(), requiredQualificationsJson: text("required_qualifications_json").notNull().default("[]"), constraintsJson: text("constraints_json").notNull(), confidence: text("confidence").notNull(), schedulerVersion: text("scheduler_version").notNull(), originalRecommendationJson: text("original_recommendation_json").notNull(), createdByActorType: text("created_by_actor_type").notNull(), createdByActorId: text("created_by_actor_id"), createdByActorName: text("created_by_actor_name").notNull(), createdAt: createdAt(), acceptedAt: text("accepted_at"), completedAt: text("completed_at"),
}, (table) => [index("idx_ops_service_runs_org_vendor_status_start").on(table.organizationId, table.vendorId, table.status, table.proposedStartsAt)]);

export const opsRouteStops = sqliteTable("ops_route_stops", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), storeId: text("store_id").notNull(), sequence: integer("sequence").notNull(), proposedArrivalAt: text("proposed_arrival_at").notNull(), committedArrivalAt: text("committed_arrival_at"), estimatedDriveMinutes: integer("estimated_drive_minutes").notNull(), estimatedServiceMinutes: integer("estimated_service_minutes").notNull(), accessRequirements: text("access_requirements"), status: text("status").notNull(), siteVisitId: text("site_visit_id"),
}, (table) => [uniqueIndex("uidx_ops_route_stops_org_run_sequence").on(table.organizationId, table.serviceRunId, table.sequence), uniqueIndex("uidx_ops_route_stops_org_run_store").on(table.organizationId, table.serviceRunId, table.storeId)]);

export const opsServiceRunWorkOrders = sqliteTable("ops_service_run_work_orders", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), routeStopId: text("route_stop_id").notNull(), workOrderId: text("work_order_id").notNull(), occurrenceId: text("occurrence_id"), planned: bool("planned"), estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(), addressed: bool("addressed"), removalReason: text("removal_reason"),
}, (table) => [uniqueIndex("uidx_ops_service_run_work_org_run_work").on(table.organizationId, table.serviceRunId, table.workOrderId), index("idx_ops_service_run_work_org_work").on(table.organizationId, table.workOrderId)]);

export const opsServiceRunResponses = sqliteTable("ops_service_run_responses", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), response: text("response").notNull(), requestedStartsAt: text("requested_starts_at"), requestedStopChangesJson: text("requested_stop_changes_json"), requestedWorkOrderChangesJson: text("requested_work_order_changes_json"), reasonCode: text("reason_code"), reasonDetail: text("reason_detail"), travelImpactMinutes: integer("travel_impact_minutes").notNull(), dueWindowImpactCount: integer("due_window_impact_count").notNull(), economicImpactMinor: integer("economic_impact_minor").notNull(), currency: text("currency").notNull(), responderName: text("responder_name").notNull(), respondedAt: text("responded_at").notNull(), resultingPlanJson: text("resulting_plan_json"),
}, (table) => [index("idx_ops_service_run_responses_org_run_time").on(table.organizationId, table.serviceRunId, table.respondedAt)]);

export const opsVendorWarrantyProfiles = sqliteTable("ops_vendor_warranty_profiles", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), baseLaborDays: integer("base_labor_days").notNull(), basePartsDays: integer("base_parts_days").notNull(), baseTravelDays: integer("base_travel_days").notNull(), baseDiagnosticDays: integer("base_diagnostic_days").notNull(), effectiveStartsAt: text("effective_starts_at").notNull(), effectiveEndsAt: text("effective_ends_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [index("idx_ops_vendor_warranty_profiles_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsWarrantyRules = sqliteTable("ops_warranty_rules", {
  id: id(), organizationId: organizationId(), vendorWarrantyProfileId: text("vendor_warranty_profile_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), quoteId: text("quote_id"), authorizationId: text("authorization_id"), tradeKey: text("trade_key"), workType: text("work_type"), serviceType: text("service_type"), assetType: text("asset_type"), componentType: text("component_type"), manufacturer: text("manufacturer"), model: text("model"), vendorSuppliedPart: integer("vendor_supplied_part", { mode: "boolean" }), customerSuppliedPart: integer("customer_supplied_part", { mode: "boolean" }), regionId: text("region_id"), storeId: text("store_id"), priority: integer("priority").notNull(), effectiveStartsAt: text("effective_starts_at").notNull(), effectiveEndsAt: text("effective_ends_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [index("idx_ops_warranty_rules_org_vendor_status_priority").on(table.organizationId, table.vendorId, table.status, table.priority)]);

export const opsWarrantyCoverageLines = sqliteTable("ops_warranty_coverage_lines", {
  id: id(), organizationId: organizationId(), warrantyRuleId: text("warranty_rule_id"), vendorWarrantyProfileId: text("vendor_warranty_profile_id"), coverageType: text("coverage_type").notNull(), duration: integer("duration").notNull(), durationUnit: text("duration_unit").notNull(), startEvent: text("start_event").notNull(), startDate: text("start_date"), endDate: text("end_date"), provider: text("provider").notNull(), obligatedVendorId: text("obligated_vendor_id"), routingRule: text("routing_rule").notNull(), deductibleMinor: integer("deductible_minor").notNull(), maximumCoverageMinor: integer("maximum_coverage_minor"), currency: text("currency").notNull(), conditions: text("conditions"), exclusions: text("exclusions"),
}, (table) => [index("idx_ops_warranty_coverage_org_rule_type").on(table.organizationId, table.warrantyRuleId, table.coverageType)]);

export const opsRepairItems = sqliteTable("ops_repair_items", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), siteVisitWorkOrderId: text("site_visit_work_order_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), assetId: text("asset_id").notNull(), componentId: text("component_id"), failureCode: text("failure_code").notNull(), repairAction: text("repair_action").notNull(), repairSeverity: text("repair_severity").notNull(), removedComponentId: text("removed_component_id"), installedComponentId: text("installed_component_id"), partManufacturer: text("part_manufacturer"), partModel: text("part_model"), serialNumber: text("serial_number"), vendorSupplied: bool("vendor_supplied"), completionDate: text("completion_date").notNull(), verificationDate: text("verification_date"), laborCostMinor: integer("labor_cost_minor").notNull(), partCostMinor: integer("part_cost_minor").notNull(), currency: text("currency").notNull(), rootCause: text("root_cause"), createdAt: createdAt(),
}, (table) => [index("idx_ops_repair_items_org_work").on(table.organizationId, table.workOrderId), index("idx_ops_repair_items_org_asset_component_date").on(table.organizationId, table.assetId, table.componentId, table.completionDate)]);

export const opsAppliedWarranties = sqliteTable("ops_applied_warranties", {
  id: id(), organizationId: organizationId(), repairItemId: text("repair_item_id").notNull(), coverageType: text("coverage_type").notNull(), provider: text("provider").notNull(), obligatedVendorId: text("obligated_vendor_id"), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), coveredChargesJson: text("covered_charges_json").notNull(), routingRule: text("routing_rule").notNull(), contractVersionId: text("contract_version_id"), policySource: text("policy_source").notNull(), ruleSource: text("rule_source"), originalCalculatedTermsJson: text("original_calculated_terms_json").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_applied_warranty_repair_type").on(table.organizationId, table.repairItemId, table.coverageType), index("idx_ops_applied_warranty_org_end").on(table.organizationId, table.endDate)]);

export const opsWarrantyAmendments = sqliteTable("ops_warranty_amendments", {
  id: id(), organizationId: organizationId(), appliedWarrantyId: text("applied_warranty_id").notNull(), amendmentKind: text("amendment_kind").notNull(), appliesToRepairOnly: bool("applies_to_repair_only"), amendedTermsJson: text("amended_terms_json").notNull(), reason: text("reason").notNull(), decidedByMembershipId: text("decided_by_membership_id").notNull(), decidedByName: text("decided_by_name").notNull(), decidedAt: text("decided_at").notNull(),
}, (table) => [index("idx_ops_warranty_amendments_org_applied_time").on(table.organizationId, table.appliedWarrantyId, table.decidedAt)]);

export const opsManufacturerWarranties = sqliteTable("ops_manufacturer_warranties", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), componentId: text("component_id"), manufacturer: text("manufacturer").notNull(), model: text("model"), serialNumber: text("serial_number"), partsCoverage: text("parts_coverage").notNull(), laborCoverage: text("labor_coverage").notNull(), startDate: text("start_date").notNull(), expirationDate: text("expiration_date").notNull(), authorizedProviderRule: text("authorized_provider_rule"), claimRequirements: text("claim_requirements"), installingVendorId: text("installing_vendor_id"), administrator: text("administrator"), supportingFileId: text("supporting_file_id"), createdAt: createdAt(),
}, (table) => [index("idx_ops_manufacturer_warranty_org_asset_expiry").on(table.organizationId, table.assetId, table.expirationDate)]);

export const opsWarrantyCases = sqliteTable("ops_warranty_cases", {
  id: id(), organizationId: organizationId(), requestId: text("request_id"), workOrderId: text("work_order_id").notNull(), assetId: text("asset_id").notNull(), componentId: text("component_id"), priorRepairItemId: text("prior_repair_item_id"), appliedWarrantyId: text("applied_warranty_id"), manufacturerWarrantyId: text("manufacturer_warranty_id"), status: text("status").notNull(), confidence: text("confidence").notNull(), detectionExplanation: text("detection_explanation").notNull(), diagnosisRequired: bool("diagnosis_required"), coverageDecision: text("coverage_decision").notNull(), customerChargeStatus: text("customer_charge_status").notNull(), invoiceHold: bool("invoice_hold"), routingRule: text("routing_rule").notNull(), obligatedVendorId: text("obligated_vendor_id"), vendorResponseDueAt: text("vendor_response_due_at"), createdAt: createdAt(), closedAt: text("closed_at"),
}, (table) => [index("idx_ops_warranty_cases_org_status_vendor_due").on(table.organizationId, table.status, table.obligatedVendorId, table.vendorResponseDueAt), index("idx_ops_warranty_cases_org_asset").on(table.organizationId, table.assetId)]);

export const opsQuotes = sqliteTable("ops_quotes", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), quoteNumber: text("quote_number").notNull(), version: integer("version").notNull(), scope: text("scope").notNull(), subtotalMinor: integer("subtotal_minor").notNull(), taxMinor: integer("tax_minor").notNull(), feesMinor: integer("fees_minor").notNull(), totalMinor: integer("total_minor").notNull(), currency: text("currency").notNull(), submittedAt: text("submitted_at").notNull(), expiresAt: text("expires_at"), supersedesQuoteId: text("supersedes_quote_id"),
}, (table) => [uniqueIndex("uidx_ops_quotes_org_vendor_number_version").on(table.organizationId, table.vendorId, table.quoteNumber, table.version)]);

export const opsAuthorizations = sqliteTable("ops_authorizations", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), authorizationType: text("authorization_type").notNull(), authorizedAmountMinor: integer("authorized_amount_minor").notNull(), currency: text("currency").notNull(), authorizedScope: text("authorized_scope").notNull(), approverMembershipId: text("approver_membership_id").notNull(), approverName: text("approver_name").notNull(), approvalAuthority: text("approval_authority").notNull(), authorizedAt: text("authorized_at").notNull(), reason: text("reason").notNull(), contractVersionId: text("contract_version_id"), supersedesAuthorizationId: text("supersedes_authorization_id"),
}, (table) => [index("idx_ops_authorizations_org_work_time").on(table.organizationId, table.workOrderId, table.authorizedAt)]);

export const opsInvoices = sqliteTable("ops_invoices", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), vendorInvoiceNumber: text("vendor_invoice_number").notNull(), invoiceDate: text("invoice_date").notNull(), subtotalMinor: integer("subtotal_minor").notNull(), taxMinor: integer("tax_minor").notNull(), feesMinor: integer("fees_minor").notNull(), totalMinor: integer("total_minor").notNull(), approvedForPaymentMinor: integer("approved_for_payment_minor").notNull(), paidAmountMinor: integer("paid_amount_minor").notNull(), currency: text("currency").notNull(), status: text("status").notNull(), exceptionReason: text("exception_reason"), supportingFileId: text("supporting_file_id"), submittedByMembershipId: text("submitted_by_membership_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_invoice_records_org_vendor_number").on(table.organizationId, table.vendorId, table.vendorInvoiceNumber), index("idx_ops_invoices_org_status_date").on(table.organizationId, table.status, table.invoiceDate)]);

export const opsInvoiceLines = sqliteTable("ops_invoice_lines", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), lineNumber: integer("line_number").notNull(), category: text("category").notNull(), description: text("description").notNull(), quantityThousandths: integer("quantity_thousandths").notNull(), unitAmountMinor: integer("unit_amount_minor").notNull(), lineAmountMinor: integer("line_amount_minor").notNull(), currency: text("currency").notNull(), contractRateCardLineId: text("contract_rate_card_line_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_invoice_lines_org_invoice_line").on(table.organizationId, table.invoiceId, table.lineNumber)]);

export const opsInvoiceLineAllocations = sqliteTable("ops_invoice_line_allocations", {
  id: id(), organizationId: organizationId(), invoiceLineId: text("invoice_line_id").notNull(), workOrderId: text("work_order_id").notNull(), workItemId: text("work_item_id"), repairItemId: text("repair_item_id"), siteVisitWorkOrderId: text("site_visit_work_order_id"), assetId: text("asset_id"), componentId: text("component_id"), storeId: text("store_id").notNull(), tradeKey: text("trade_key"), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), method: text("method").notNull(), confirmedByMembershipId: text("confirmed_by_membership_id"), confirmedAt: text("confirmed_at"),
}, (table) => [index("idx_ops_invoice_line_allocations_org_line").on(table.organizationId, table.invoiceLineId), index("idx_ops_invoice_line_allocations_org_work").on(table.organizationId, table.workOrderId)]);

export const opsInvoiceExceptions = sqliteTable("ops_invoice_exceptions", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), invoiceLineId: text("invoice_line_id"), kind: text("kind").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), detectedAt: text("detected_at").notNull(), resolvedAt: text("resolved_at"), resolutionReason: text("resolution_reason"),
}, (table) => [index("idx_ops_invoice_exceptions_org_status_kind").on(table.organizationId, table.status, table.kind)]);

export const opsInvoiceAdjustments = sqliteTable("ops_invoice_adjustments", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), kind: text("kind").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), reason: text("reason").notNull(), createdByMembershipId: text("created_by_membership_id").notNull(), createdAt: createdAt(),
}, (table) => [index("idx_ops_invoice_adjustments_org_invoice_time").on(table.organizationId, table.invoiceId, table.createdAt)]);

export const opsServiceDiscrepancies = sqliteTable("ops_service_discrepancies", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), invoiceId: text("invoice_id"), siteVisitWorkOrderId: text("site_visit_work_order_id"), discrepancyType: text("discrepancy_type").notNull(), status: text("status").notNull(), factsJson: text("facts_json").notNull(), vendorResponse: text("vendor_response"), resolution: text("resolution"), createdAt: createdAt(), resolvedAt: text("resolved_at"),
}, (table) => [index("idx_ops_service_discrepancies_org_status").on(table.organizationId, table.status), index("idx_ops_service_discrepancies_org_work").on(table.organizationId, table.workOrderId)]);

export const opsValueEvents = sqliteTable("ops_value_events", {
  id: id(), organizationId: organizationId(), category: text("category").notNull(), eventType: text("event_type").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), workOrderId: text("work_order_id"), invoiceLineId: text("invoice_line_id"), serviceRunId: text("service_run_id"), contractVersionId: text("contract_version_id"), warrantyCaseId: text("warranty_case_id"), assetId: text("asset_id"), approvalDecisionId: text("approval_decision_id"), sourceDecision: text("source_decision").notNull(), deduplicationKey: text("deduplication_key").notNull(), occurredAt: text("occurred_at").notNull(),
}, (table) => [uniqueIndex("uidx_ops_value_events_org_dedup").on(table.organizationId, table.deduplicationKey), index("idx_ops_value_events_org_category_time").on(table.organizationId, table.category, table.occurredAt)]);

export const opsCostLines = sqliteTable("ops_cost_lines", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), kind: text("kind").notNull(), description: text("description").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), serviceDate: text("service_date").notNull(), recordedAt: text("recorded_at").notNull(),
}, (table) => [index("idx_ops_cost_lines_org_work_date").on(table.organizationId, table.workOrderId, table.serviceDate), index("idx_ops_cost_lines_org_date_kind").on(table.organizationId, table.serviceDate, table.kind)]);

export const opsInvoiceReferences = sqliteTable("ops_invoice_references", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), invoiceNumber: text("invoice_number").notNull(), invoiceDate: text("invoice_date").notNull(), grossAmountMinor: integer("gross_amount_minor").notNull(), currency: text("currency").notNull(), operatorWorkOrderNumber: text("operator_work_order_number"), matchStatus: text("match_status").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_invoices_org_vendor_number").on(table.organizationId, table.vendorId, table.invoiceNumber), index("idx_ops_invoices_org_match_date").on(table.organizationId, table.matchStatus, table.invoiceDate), index("idx_ops_invoices_org_wo_number").on(table.organizationId, table.operatorWorkOrderNumber)]);

export const opsInvoiceAllocations = sqliteTable("ops_invoice_allocations", {
  id: id(), organizationId: organizationId(), invoiceReferenceId: text("invoice_reference_id").notNull(), workOrderId: text("work_order_id").notNull(), amountMinor: integer("amount_minor").notNull(), currency: text("currency").notNull(), confirmedByMembershipId: text("confirmed_by_membership_id"), confirmedAt: text("confirmed_at"),
}, (table) => [uniqueIndex("uidx_ops_invoice_allocations_org_invoice_work").on(table.organizationId, table.invoiceReferenceId, table.workOrderId), index("idx_ops_invoice_allocations_org_work").on(table.organizationId, table.workOrderId)]);

export const opsAuditEvents = sqliteTable("ops_audit_events", {
  id: id(), organizationId: organizationId(), aggregateType: text("aggregate_type").notNull(), aggregateId: text("aggregate_id").notNull(), eventType: text("event_type").notNull(), actorType: text("actor_type").notNull(), actorId: text("actor_id"), actorName: text("actor_name").notNull(), occurredAt: text("occurred_at").notNull(), payloadJson: text("payload_json").notNull().default("{}"),
}, (table) => [index("idx_ops_audit_org_aggregate_time").on(table.organizationId, table.aggregateType, table.aggregateId, table.occurredAt), index("idx_ops_audit_org_event_time").on(table.organizationId, table.eventType, table.occurredAt)]);

export const opsOutboxMessages = sqliteTable("ops_outbox_messages", {
  id: id(), organizationId: organizationId(), topic: text("topic").notNull(), aggregateType: text("aggregate_type").notNull(), aggregateId: text("aggregate_id").notNull(), payloadJson: text("payload_json").notNull(), status: text("status").notNull().default("pending"), availableAt: text("available_at").notNull(), createdAt: createdAt(), attemptCount: integer("attempt_count").notNull().default(0), claimedAt: text("claimed_at"), deliveredAt: text("delivered_at"), lastError: text("last_error"),
}, (table) => [index("idx_ops_outbox_org_status_available").on(table.organizationId, table.status, table.availableAt)]);

export const opsNotificationRules = sqliteTable("ops_notification_rules", {
  id: id(), organizationId: organizationId(), eventKey: text("event_key").notNull(), emailEnabled: bool("email_enabled"), recipientRole: text("recipient_role").notNull(), updatedByMembershipId: text("updated_by_membership_id"), createdAt: createdAt(), updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("uidx_ops_notification_rules_org_event").on(table.organizationId, table.eventKey),
  index("idx_ops_notification_rules_org_role").on(table.organizationId, table.recipientRole),
]);

export const opsPublicTokens = sqliteTable("ops_public_tokens", {
  id: id(), organizationId: organizationId(), purpose: text("purpose").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), createdAt: createdAt(), usedAt: text("used_at"), revokedAt: text("revoked_at"),
}, (table) => [uniqueIndex("uidx_ops_public_tokens_hash").on(table.tokenHash), index("idx_ops_public_tokens_org_subject").on(table.organizationId, table.subjectType, table.subjectId), index("idx_ops_public_tokens_org_purpose_expiry").on(table.organizationId, table.purpose, table.expiresAt)]);

export const opsVendorContinuations = sqliteTable("ops_vendor_continuations", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), vendorResponseId: text("vendor_response_id").notNull(), action: text("action").notNull(), message: text("message"), createdByMembershipId: text("created_by_membership_id"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_vendor_continuations_resp_action").on(table.organizationId, table.vendorResponseId, table.action)]);
export const opsServiceAppointments = sqliteTable("ops_service_appointments", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), assignmentId: text("assignment_id").notNull(), issuanceId: text("issuance_id"), sourceVendorResponseId: text("source_vendor_response_id"), status: text("status").notNull(), proposedBy: text("proposed_by").notNull(), startsAt: text("starts_at").notNull(), note: text("note"), createdByMembershipId: text("created_by_membership_id"), createdAt: createdAt(),
}, (table) => [index("idx_ops_service_appointments_org_work").on(table.organizationId, table.workOrderId, table.startsAt)]);
export const opsSavedViews = sqliteTable("ops_saved_views", {
  id: id(), organizationId: organizationId(), ownerMembershipId: text("owner_membership_id").notNull(), surface: text("surface").notNull(), name: text("name").notNull(), queryString: text("query_string").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_saved_views_org_owner_surface_name").on(table.organizationId, table.ownerMembershipId, table.surface, table.name), index("idx_ops_saved_views_org_owner_surface").on(table.organizationId, table.ownerMembershipId, table.surface)]);

export const opsJobRuns = sqliteTable("ops_job_runs", {
  id: id(), organizationId: organizationId(), jobType: text("job_type").notNull(), slotKey: text("slot_key").notNull(), status: text("status").notNull().default("running"), startedAt: text("started_at").notNull(), finishedAt: text("finished_at"), processedCount: integer("processed_count").notNull().default(0), failedCount: integer("failed_count").notNull().default(0), detailsJson: text("details_json").notNull().default("{}"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_job_runs_org_type_slot").on(table.organizationId, table.jobType, table.slotKey), index("idx_ops_job_runs_org_type_started").on(table.organizationId, table.jobType, table.startedAt)]);

export const opsIdempotencyKeys = sqliteTable("ops_idempotency_keys", {
  organizationId: organizationId(), key: text("key").notNull(), command: text("command").notNull(), resultId: text("result_id").notNull(), requestHash: text("request_hash").notNull(), createdAt: createdAt(), expiresAt: text("expires_at").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.key] }), index("idx_ops_idempotency_org_expiry").on(table.organizationId, table.expiresAt)]);

export const opsWorkOrderCounters = sqliteTable("ops_work_order_counters", {
  organizationId: organizationId(), counterYear: integer("counter_year").notNull(), nextValue: integer("next_value").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.counterYear] })]);

export const opsSchema = {
  opsOrganizations,
  opsDivisions,
  opsRegions,
  opsTaxonomyNodes,
  opsEquipmentTemplates,
  opsComponentTemplates,
  opsStores,
  opsUsers,
  opsMemberships,
  opsScopeGrants,
  opsVendors,
  opsVendorReminders,
  opsVendorSpecialties,
  opsVendorCoverage,
  opsVendorQualifications,
  opsVendorComplianceDocuments,
  opsVendorContracts,
  opsContractVersions,
  opsContractScopes,
  opsRateCardLines,
  opsServiceLevelPolicies,
  opsSchedulingPolicies,
  opsVendorCapacity,
  opsRequests,
  opsRequestImpactAssessments,
  opsWorkOrders,
  opsApprovalPolicies,
  opsApprovalRequests,
  opsApprovalDecisions,
  opsWorkOrderAssignments,
  opsWorkOrderIssuances,
  opsVendorResponses,
  opsWorkOrderEstimateRequests,
  opsVendorEstimateProposals,
  opsVisitSessions,
  opsVisitEvidence,
  opsFiles,
  opsEntityFiles,
  opsFollowUps,
  opsSiteVisitWorkOrders,
  opsWorkOrderVerifications,
  opsWorkflowTasks,
  opsWorkflowTaskSlaPauses,
  opsWorkflowTaskSlaResumes,
  opsExceptions,
  opsReplacementProfiles,
  opsAssets,
  opsReplacementBenchmarks,
  opsAssetReplacementOverrides,
  opsReplacementEvents,
  opsLifecycleRecommendations,
  opsAssetComponents,
  opsComponentLifecycleEvents,
  opsMaintenancePrograms,
  opsChecklistTemplates,
  opsPmPlans,
  opsPmOccurrences,
  opsPmWorkItems,
  opsChecklistResponses,
  opsServiceRuns,
  opsRouteStops,
  opsServiceRunWorkOrders,
  opsServiceRunResponses,
  opsVendorWarrantyProfiles,
  opsWarrantyRules,
  opsWarrantyCoverageLines,
  opsRepairItems,
  opsAppliedWarranties,
  opsWarrantyAmendments,
  opsManufacturerWarranties,
  opsWarrantyCases,
  opsQuotes,
  opsAuthorizations,
  opsInvoices,
  opsInvoiceLines,
  opsInvoiceLineAllocations,
  opsInvoiceExceptions,
  opsInvoiceAdjustments,
  opsServiceDiscrepancies,
  opsValueEvents,
  opsCostLines,
  opsInvoiceReferences,
  opsInvoiceAllocations,
  opsAuditEvents,
  opsOutboxMessages,
  opsNotificationRules,
  opsJobRuns,
  opsPublicTokens,
  opsIdempotencyKeys,
  opsWorkOrderCounters,
} as const;
