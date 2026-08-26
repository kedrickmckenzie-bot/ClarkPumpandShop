import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PgTableExtraConfigValue } from "drizzle-orm/pg-core";

// Render/PostgreSQL production schema. The D1 adapter continues to use
// db/ops-schema.ts; this file intentionally shares only logical table names.
const id = () => text("id").primaryKey();
const organizationId = () => text("organization_id").notNull();
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const createdAt = () => instant("created_at").notNull();

export const opsOrganizations = pgTable("ops_organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timeZone: text("time_zone").notNull().default("America/New_York"),
  workOrderPrefix: text("work_order_prefix").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_org_slug").on(table.slug),
]);

export const opsUsers = pgTable("ops_users", {
  id: id(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_users_email").on(table.email),
  check("chk_ops_users_status", sql`${table.status} IN ('invited', 'active', 'suspended')`),
]);

export const opsDivisions = pgTable("ops_divisions", {
  id: id(),
  organizationId: organizationId(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_divisions_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_divisions_org_code").on(table.organizationId, table.code),
  index("idx_ops_divisions_org_name").on(table.organizationId, table.name),
  foreignKey({
    name: "fk_ops_divisions_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
]);

export const opsRegions = pgTable("ops_regions", {
  id: id(),
  organizationId: organizationId(),
  divisionId: text("division_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_regions_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_regions_org_code").on(table.organizationId, table.code),
  index("idx_ops_regions_org_name").on(table.organizationId, table.name),
  foreignKey({
    name: "fk_ops_regions_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_regions_division",
    columns: [table.organizationId, table.divisionId],
    foreignColumns: [opsDivisions.organizationId, opsDivisions.id],
  }),
]);

export const opsTaxonomyNodes = pgTable("ops_taxonomy_nodes", {
  id: id(),
  organizationId: organizationId(),
  parentNodeId: text("parent_node_id"),
  nodeKind: text("node_kind").notNull(),
  canonicalKey: text("canonical_key"),
  name: text("name").notNull(),
  aliasesJson: jsonb("aliases_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  depth: integer("depth").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(false),
  createdAt: createdAt(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_taxonomy_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_taxonomy_org_parent_name").on(table.organizationId, table.parentNodeId, table.name),
  index("idx_ops_taxonomy_org_parent_sort").on(table.organizationId, table.parentNodeId, table.sortOrder),
  index("idx_ops_taxonomy_org_kind_active").on(table.organizationId, table.nodeKind, table.active),
  foreignKey({
    name: "fk_ops_taxonomy_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_taxonomy_parent",
    columns: [table.organizationId, table.parentNodeId],
    foreignColumns: [opsTaxonomyNodes.organizationId, opsTaxonomyNodes.id],
  }),
  check("chk_ops_taxonomy_kind", sql`${table.nodeKind} IN ('category', 'group')`),
  check("chk_ops_taxonomy_depth", sql`${table.depth} >= 0`),
]);

export const opsStores = pgTable("ops_stores", {
  id: id(),
  organizationId: organizationId(),
  divisionId: text("division_id"),
  regionId: text("region_id"),
  storeNumber: text("store_number").notNull(),
  name: text("name").notNull(),
  address1: text("address_1").notNull(),
  address2: text("address_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  aliasesJson: jsonb("aliases_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  searchText: text("search_text").notNull(),
  latitudeE6: integer("latitude_e6"),
  longitudeE6: integer("longitude_e6"),
  geofenceRadiusM: integer("geofence_radius_m").notNull().default(200),
  locationPolicyEnabled: boolean("location_policy_enabled").notNull().default(false),
  timeZone: text("time_zone"),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_stores_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_stores_org_number").on(table.organizationId, table.storeNumber),
  index("idx_ops_stores_org_region_number").on(table.organizationId, table.regionId, table.storeNumber),
  index("idx_ops_stores_org_status_number").on(table.organizationId, table.status, table.storeNumber),
  // The PostgreSQL baseline installs pg_trgm before creating these search indexes.
  index("idx_ops_stores_search_trgm").using("gin", table.searchText.op("gin_trgm_ops")),
  foreignKey({
    name: "fk_ops_stores_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_stores_division",
    columns: [table.organizationId, table.divisionId],
    foreignColumns: [opsDivisions.organizationId, opsDivisions.id],
  }),
  foreignKey({
    name: "fk_ops_stores_region",
    columns: [table.organizationId, table.regionId],
    foreignColumns: [opsRegions.organizationId, opsRegions.id],
  }),
  check("chk_ops_stores_status", sql`${table.status} IN ('active', 'inactive')`),
  check("chk_ops_stores_latitude", sql`${table.latitudeE6} IS NULL OR ${table.latitudeE6} BETWEEN -90000000 AND 90000000`),
  check("chk_ops_stores_longitude", sql`${table.longitudeE6} IS NULL OR ${table.longitudeE6} BETWEEN -180000000 AND 180000000`),
  check("chk_ops_stores_geofence", sql`${table.geofenceRadiusM} > 0`),
]);

export const opsMemberships = pgTable("ops_memberships", {
  id: id(),
  organizationId: organizationId(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_memberships_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_memberships_org_user_role").on(table.organizationId, table.userId, table.role),
  index("idx_ops_memberships_org_status").on(table.organizationId, table.status),
  foreignKey({
    name: "fk_ops_memberships_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_memberships_user",
    columns: [table.userId],
    foreignColumns: [opsUsers.id],
  }),
  check("chk_ops_memberships_status", sql`${table.status} IN ('invited', 'active', 'suspended')`),
  check("chk_ops_memberships_role", sql`${table.role} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'store_employee', 'internal_technician', 'finance_reviewer', 'vendor_user', 'support')`),
]);

export const opsScopeGrants = pgTable("ops_scope_grants", {
  id: id(),
  organizationId: organizationId(),
  membershipId: text("membership_id").notNull(),
  scopeKind: text("scope_kind").notNull(),
  scopeId: text("scope_id").notNull(),
  permission: text("permission").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_scope_grants_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_scopes_org_member_scope_perm").on(table.organizationId, table.membershipId, table.scopeKind, table.scopeId, table.permission),
  index("idx_ops_scopes_org_kind_id").on(table.organizationId, table.scopeKind, table.scopeId),
  foreignKey({
    name: "fk_ops_scopes_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_scopes_membership",
    columns: [table.organizationId, table.membershipId],
    foreignColumns: [opsMemberships.organizationId, opsMemberships.id],
  }),
  check("chk_ops_scopes_kind", sql`${table.scopeKind} IN ('organization', 'division', 'region', 'store', 'vendor')`),
]);

export const opsVendors = pgTable("ops_vendors", {
  id: id(),
  organizationId: organizationId(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  dispatchEmail: text("dispatch_email").notNull(),
  dispatchPhone: text("dispatch_phone"),
  status: text("status").notNull().default("approved"),
  preferred: boolean("preferred").notNull().default(false),
  searchText: text("search_text").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_vendors_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_vendors_org_code").on(table.organizationId, table.code),
  index("idx_ops_vendors_org_status_name").on(table.organizationId, table.status, table.name),
  index("idx_ops_vendors_search_trgm").using("gin", table.searchText.op("gin_trgm_ops")),
  foreignKey({
    name: "fk_ops_vendors_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_vendors_status", sql`${table.status} IN ('approved', 'restricted', 'inactive')`),
]);

export const opsVendorReminders = pgTable("ops_vendor_reminders", {
  id: id(),
  organizationId: organizationId(),
  vendorId: text("vendor_id").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  accountableParty: text("accountable_party").notNull(),
  dueAt: instant("due_at").notNull(),
  escalationTo: text("escalation_to").notNull(),
  status: text("status").notNull(),
  createdByActorType: text("created_by_actor_type").notNull(),
  createdByActorId: text("created_by_actor_id"),
  createdByActorName: text("created_by_actor_name").notNull(),
  createdAt: createdAt(),
  completedByActorType: text("completed_by_actor_type"),
  completedByActorId: text("completed_by_actor_id"),
  completedByActorName: text("completed_by_actor_name"),
  completedAt: instant("completed_at"),
  completionNote: text("completion_note"),
}, (table) => [
  unique("uq_ops_vendor_reminders_org_id").on(table.organizationId, table.id),
  index("idx_ops_vendor_reminders_org_vendor_status_due").on(table.organizationId, table.vendorId, table.status, table.dueAt),
  index("idx_ops_vendor_reminders_org_status_due").on(table.organizationId, table.status, table.dueAt),
  foreignKey({ name: "fk_ops_vendor_reminders_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_vendor_reminders_vendor", columns: [table.organizationId, table.vendorId], foreignColumns: [opsVendors.organizationId, opsVendors.id] }),
  check("chk_ops_vendor_reminders_status", sql`${table.status} IN ('open', 'completed', 'cancelled')`),
  check("chk_ops_vendor_reminders_completion", sql`(${table.status} = 'completed') = (${table.completedAt} IS NOT NULL)`),
]);

export const opsVendorSpecialties = pgTable("ops_vendor_specialties", {
  id: id(),
  organizationId: organizationId(),
  vendorId: text("vendor_id").notNull(),
  canonicalKey: text("canonical_key").notNull(),
  displayName: text("display_name").notNull(),
  searchAliasesJson: jsonb("search_aliases_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
}, (table) => [
  unique("uq_ops_vendor_specialties_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_vendor_specialties_org_vendor_key").on(table.organizationId, table.vendorId, table.canonicalKey),
  index("idx_ops_vendor_specialties_org_key").on(table.organizationId, table.canonicalKey),
  foreignKey({
    name: "fk_ops_vendor_specialties_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_vendor_specialties_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
]);

export const opsVendorCoverage = pgTable("ops_vendor_coverage", {
  id: id(),
  organizationId: organizationId(),
  vendorId: text("vendor_id").notNull(),
  scopeKind: text("scope_kind").notNull(),
  scopeId: text("scope_id").notNull(),
  preferredRank: integer("preferred_rank"),
}, (table) => [
  unique("uq_ops_vendor_coverage_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_vendor_coverage_org_vendor_scope").on(table.organizationId, table.vendorId, table.scopeKind, table.scopeId),
  index("idx_ops_vendor_coverage_org_scope").on(table.organizationId, table.scopeKind, table.scopeId),
  foreignKey({
    name: "fk_ops_vendor_coverage_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_vendor_coverage_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  check("chk_ops_vendor_coverage_kind", sql`${table.scopeKind} IN ('organization', 'region', 'store')`),
  check("chk_ops_vendor_coverage_rank", sql`${table.preferredRank} IS NULL OR ${table.preferredRank} > 0`),
]);

export const opsVendorQualifications = pgTable("ops_vendor_qualifications", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), tradeKey: text("trade_key").notNull(), workType: text("work_type"), serviceType: text("service_type"), assetType: text("asset_type"), componentType: text("component_type"), pmWork: boolean("pm_work").notNull().default(false), emergencyResponse: boolean("emergency_response").notNull().default(false), warrantyWork: boolean("warranty_work").notNull().default(false), manufacturerAuthorization: text("manufacturer_authorization"), regionId: text("region_id"), storeId: text("store_id"), afterHours: boolean("after_hours").notNull().default(false), maximumJobAmountMinor: bigint("maximum_job_amount_minor", { mode: "number" }), currency: text("currency"), requiredLicense: text("required_license"), requiredCertification: text("required_certification"), effectiveAt: instant("effective_at").notNull(), expiresAt: instant("expires_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_vendor_qualifications_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_qualifications_org_vendor_trade").on(table.organizationId, table.vendorId, table.tradeKey, table.status), index("idx_ops_vendor_qualifications_org_scope").on(table.organizationId, table.regionId, table.storeId)]);

export const opsVendorComplianceDocuments = pgTable("ops_vendor_compliance_documents", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), documentType: text("document_type").notNull(), issuer: text("issuer"), reference: text("reference"), effectiveAt: instant("effective_at"), expiresAt: instant("expires_at"), reviewStatus: text("review_status").notNull(), blocking: boolean("blocking").notNull().default(false), storedFileId: text("stored_file_id"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_vendor_compliance_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_compliance_org_vendor_status_expiry").on(table.organizationId, table.vendorId, table.reviewStatus, table.expiresAt)]);

export const opsVendorContracts = pgTable("ops_vendor_contracts", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), name: text("name").notNull(), ownerMembershipId: text("owner_membership_id").notNull(), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_vendor_contracts_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_contracts_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsContractVersions = pgTable("ops_contract_versions", {
  id: id(), organizationId: organizationId(), contractId: text("contract_id").notNull(), vendorId: text("vendor_id").notNull(), version: integer("version").notNull(), sourceAgreementReference: text("source_agreement_reference").notNull(), status: text("status").notNull(), effectiveStartsAt: instant("effective_starts_at").notNull(), effectiveEndsAt: instant("effective_ends_at"), renewalAt: instant("renewal_at"), noticeDays: integer("notice_days"), priceEscalationAt: instant("price_escalation_at"), supersedesContractVersionId: text("supersedes_contract_version_id"), currency: text("currency").notNull(), preferredProvider: boolean("preferred_provider").notNull().default(false), exclusiveProvider: boolean("exclusive_provider").notNull().default(false), reactiveWorkAllowed: boolean("reactive_work_allowed").notNull().default(false), emergencyWorkAllowed: boolean("emergency_work_allowed").notNull().default(false), pmWorkAllowed: boolean("pm_work_allowed").notNull().default(false), subcontractorPolicy: text("subcontractor_policy").notNull(), schedulingMode: text("scheduling_mode").notNull(), reservedCapacityMinutes: integer("reserved_capacity_minutes").notNull(), nteAmountMinor: bigint("nte_amount_minor", { mode: "number" }), materialsMarkupBps: integer("materials_markup_bps").notNull(), routeDiscountBps: integer("route_discount_bps").notNull(), evidenceRequirementsJson: jsonb("evidence_requirements_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), complianceRequirementsJson: jsonb("compliance_requirements_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), warrantyLaborDays: integer("warranty_labor_days"), warrantyPartsDays: integer("warranty_parts_days"), warrantyTravelDays: integer("warranty_travel_days"), createdByMembershipId: text("created_by_membership_id").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_contract_versions_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_contract_versions_org_contract_version").on(table.organizationId, table.contractId, table.version), index("idx_ops_contract_versions_org_vendor_effective").on(table.organizationId, table.vendorId, table.status, table.effectiveStartsAt)]);

export const opsContractScopes = pgTable("ops_contract_scopes", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), included: boolean("included").notNull().default(true),
}, (table) => [unique("uq_ops_contract_scopes_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_contract_scopes_org_version_scope").on(table.organizationId, table.contractVersionId, table.scopeKind, table.scopeId)]);

export const opsRateCardLines = pgTable("ops_rate_card_lines", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), chargeType: text("charge_type").notNull(), description: text("description").notNull(), unit: text("unit").notNull(), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), effectiveStartsAt: instant("effective_starts_at").notNull(), effectiveEndsAt: instant("effective_ends_at"),
}, (table) => [unique("uq_ops_rate_card_org_id").on(table.organizationId, table.id), index("idx_ops_rate_card_org_contract_type").on(table.organizationId, table.contractVersionId, table.chargeType)]);

export const opsServiceLevelPolicies = pgTable("ops_service_level_policies", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), priority: text("priority").notNull(), responseMinutes: integer("response_minutes").notNull(), arrivalMinutes: integer("arrival_minutes").notNull(), completionMinutes: integer("completion_minutes").notNull(), calendar: text("calendar").notNull(),
}, (table) => [unique("uq_ops_service_level_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_service_level_org_contract_priority").on(table.organizationId, table.contractVersionId, table.priority)]);

export const opsSchedulingPolicies = pgTable("ops_scheduling_policies", {
  id: id(), organizationId: organizationId(), contractVersionId: text("contract_version_id").notNull(), maximumRouteMinutes: integer("maximum_route_minutes").notNull(), maximumStores: integer("maximum_stores").notNull(), maximumTravelMinutes: integer("maximum_travel_minutes").notNull(), maximumUtilizationBps: integer("maximum_utilization_bps").notNull(), perStopBufferMinutes: integer("per_stop_buffer_minutes").notNull(), travelBufferBps: integer("travel_buffer_bps").notNull(), documentationBufferMinutes: integer("documentation_buffer_minutes").notNull(), uncertaintyBufferBps: integer("uncertainty_buffer_bps").notNull(), emergencyReserveMinutes: integer("emergency_reserve_minutes").notNull(),
}, (table) => [unique("uq_ops_scheduling_policy_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_scheduling_policy_org_contract").on(table.organizationId, table.contractVersionId)]);

export const opsVendorCapacity = pgTable("ops_vendor_capacity", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), regionId: text("region_id").notNull(), tradeKey: text("trade_key").notNull(), startsAt: instant("starts_at").notNull(), endsAt: instant("ends_at").notNull(), crewMinutes: integer("crew_minutes").notNull(), committedMinutes: integer("committed_minutes").notNull(), maximumRouteMinutes: integer("maximum_route_minutes").notNull(), maximumStores: integer("maximum_stores").notNull(), maximumTravelMinutes: integer("maximum_travel_minutes").notNull(), blackout: boolean("blackout").notNull().default(false), emergencyReserveMinutes: integer("emergency_reserve_minutes").notNull(), variableWorkLimitMinutes: integer("variable_work_limit_minutes").notNull(), specialEquipmentJson: jsonb("special_equipment_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), createdAt: createdAt(),
}, (table) => [unique("uq_ops_vendor_capacity_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_capacity_org_vendor_window").on(table.organizationId, table.vendorId, table.startsAt, table.endsAt), index("idx_ops_vendor_capacity_org_region_trade").on(table.organizationId, table.regionId, table.tradeKey, table.startsAt)]);

export const opsRequests = pgTable("ops_requests", {
  id: id(),
  organizationId: organizationId(),
  reference: text("reference").notNull(),
  storeId: text("store_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  reporterEmployeeId: text("reporter_employee_id"),
  problem: text("problem").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(0),
  submittedAt: instant("submitted_at").notNull(),
  convertedWorkOrderId: text("converted_work_order_id"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_requests_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_requests_org_reference").on(table.organizationId, table.reference),
  index("idx_ops_requests_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.submittedAt),
  foreignKey({
    name: "fk_ops_requests_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_requests_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  // The generated baseline defers request/work-order and work-order/equipment
  // forward references during atomic fixture seeding; Drizzle's PG schema DSL
  // does not currently expose PostgreSQL's DEFERRABLE option.
  foreignKey({
    name: "fk_ops_requests_converted_work",
    columns: [table.organizationId, table.convertedWorkOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  check("chk_ops_requests_priority", sql`${table.priority} IN ('emergency', 'urgent', 'routine', 'planned')`),
  check("chk_ops_requests_status", sql`${table.status} IN ('submitted', 'under_review', 'converted', 'closed')`),
]);

export const opsRequestImpactAssessments = pgTable("ops_request_impact_assessments", {
  id: id(),
  organizationId: organizationId(),
  requestId: text("request_id").notNull(),
  storeId: text("store_id").notNull(),
  assessmentKind: text("assessment_kind").notNull(),
  reviewDisposition: text("review_disposition"),
  storeOperatingState: text("store_operating_state").notNull(),
  safetyConcern: text("safety_concern").notNull(),
  productInventoryRisk: text("product_inventory_risk").notNull(),
  productInventoryValueMinor: bigint("product_inventory_value_minor", { mode: "number" }),
  productInventoryCurrency: text("product_inventory_currency"),
  customersAffected: text("customers_affected").notNull(),
  complianceImpact: text("compliance_impact").notNull(),
  capacityUnavailableBps: integer("capacity_unavailable_bps"),
  redundantEquipment: text("redundant_equipment").notNull(),
  revenueFunctionImpact: text("revenue_function_impact"),
  estimatedDailyRevenueExposureMinor: bigint("estimated_daily_revenue_exposure_minor", { mode: "number" }),
  estimatedDailyRevenueExposureCurrency: text("estimated_daily_revenue_exposure_currency"),
  estimatedDowntimeMinutes: integer("estimated_downtime_minutes"),
  confidence: text("confidence").notNull(),
  source: text("source").notNull(),
  notes: text("notes"),
  assessedByActorType: text("assessed_by_actor_type").notNull(),
  assessedByActorId: text("assessed_by_actor_id"),
  assessedByActorName: text("assessed_by_actor_name").notNull(),
  assessedAt: instant("assessed_at").notNull(),
}, (table) => [
  unique("uq_ops_request_impact_org_id").on(table.organizationId, table.id),
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
  check("chk_ops_request_impact_inventory_value", sql`(${table.productInventoryValueMinor} IS NULL AND ${table.productInventoryCurrency} IS NULL) OR (${table.productInventoryValueMinor} >= 0 AND char_length(btrim(${table.productInventoryCurrency})) > 0)`),
  check("chk_ops_request_impact_customers", sql`${table.customersAffected} IN ('yes', 'no', 'unknown')`),
  check("chk_ops_request_impact_compliance", sql`${table.complianceImpact} IN ('none_reported', 'potential', 'confirmed', 'unknown')`),
  check("chk_ops_request_impact_capacity", sql`${table.capacityUnavailableBps} IS NULL OR ${table.capacityUnavailableBps} BETWEEN 0 AND 10000`),
  check("chk_ops_request_impact_redundancy", sql`${table.redundantEquipment} IN ('yes', 'no', 'unknown')`),
  check("chk_ops_request_impact_revenue", sql`${table.revenueFunctionImpact} IS NULL OR ${table.revenueFunctionImpact} IN ('fuel', 'foodservice', 'refrigerated_merchandise', 'beverages', 'lottery', 'car_wash', 'other')`),
  check("chk_ops_request_impact_revenue_exposure", sql`(${table.estimatedDailyRevenueExposureMinor} IS NULL AND ${table.estimatedDailyRevenueExposureCurrency} IS NULL) OR (${table.estimatedDailyRevenueExposureMinor} >= 0 AND char_length(btrim(${table.estimatedDailyRevenueExposureCurrency})) > 0)`),
  check("chk_ops_request_impact_downtime", sql`${table.estimatedDowntimeMinutes} IS NULL OR ${table.estimatedDowntimeMinutes} BETWEEN 0 AND 525600`),
  check("chk_ops_request_impact_confidence", sql`${table.confidence} IN ('low', 'medium', 'high')`),
  check("chk_ops_request_impact_source", sql`${table.source} IN ('store_report', 'manager_review', 'imported', 'not_assessed')`),
  check("chk_ops_request_impact_actor_type", sql`${table.assessedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')`),
]);

export const opsReplacementProfiles = pgTable("ops_replacement_profiles", {
  id: id(),
  organizationId: organizationId(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  categoryKey: text("category_key").notNull(),
  taxonomyNodeId: text("taxonomy_node_id"),
  matchKeysJson: jsonb("match_keys_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  attributesJson: jsonb("attributes_json").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  expectedLifeYears: integer("expected_life_years"),
  annualEscalationBps: integer("annual_escalation_bps").notNull().default(300),
  lowVarianceBps: integer("low_variance_bps").notNull().default(1000),
  highVarianceBps: integer("high_variance_bps").notNull().default(2000),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_replacement_profiles_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_replacement_profiles_org_code").on(table.organizationId, table.code),
  index("idx_ops_replacement_profiles_org_category_active").on(table.organizationId, table.categoryKey, table.active),
  foreignKey({ name: "fk_ops_replacement_profiles_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_replacement_profiles_taxonomy", columns: [table.organizationId, table.taxonomyNodeId], foreignColumns: [opsTaxonomyNodes.organizationId, opsTaxonomyNodes.id] }),
  check("chk_ops_replacement_profiles_life", sql`${table.expectedLifeYears} IS NULL OR ${table.expectedLifeYears} > 0`),
  check("chk_ops_replacement_profiles_escalation", sql`${table.annualEscalationBps} BETWEEN -9000 AND 50000`),
  check("chk_ops_replacement_profiles_variance", sql`${table.lowVarianceBps} BETWEEN 0 AND 10000 AND ${table.highVarianceBps} BETWEEN 0 AND 50000`),
]);

export const opsEquipmentTemplates = pgTable("ops_equipment_templates", {
  id: id(), organizationId: organizationId(), taxonomyNodeId: text("taxonomy_node_id").notNull(), name: text("name").notNull(), defaultExpectedLifeYears: integer("default_expected_life_years"), active: boolean("active").notNull().default(true), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_equipment_templates_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_equipment_templates_org_group_name").on(table.organizationId, table.taxonomyNodeId, table.name),
  index("idx_ops_equipment_templates_org_group_active").on(table.organizationId, table.taxonomyNodeId, table.active),
  foreignKey({ name: "fk_ops_equipment_templates_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_equipment_templates_taxonomy", columns: [table.organizationId, table.taxonomyNodeId], foreignColumns: [opsTaxonomyNodes.organizationId, opsTaxonomyNodes.id] }),
  check("chk_ops_equipment_templates_life", sql`${table.defaultExpectedLifeYears} IS NULL OR ${table.defaultExpectedLifeYears} > 0`),
]);

export const opsComponentTemplates = pgTable("ops_component_templates", {
  id: id(), organizationId: organizationId(), equipmentTemplateId: text("equipment_template_id").notNull(), parentComponentTemplateId: text("parent_component_template_id"), name: text("name").notNull(), sortOrder: integer("sort_order").notNull().default(0), createdAt: createdAt(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_component_templates_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_component_templates_org_equipment_parent_name").on(table.organizationId, table.equipmentTemplateId, table.parentComponentTemplateId, table.name),
  index("idx_ops_component_templates_org_equipment_sort").on(table.organizationId, table.equipmentTemplateId, table.sortOrder),
  foreignKey({ name: "fk_ops_component_templates_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_component_templates_equipment", columns: [table.organizationId, table.equipmentTemplateId], foreignColumns: [opsEquipmentTemplates.organizationId, opsEquipmentTemplates.id] }),
  foreignKey({ name: "fk_ops_component_templates_parent", columns: [table.organizationId, table.parentComponentTemplateId], foreignColumns: [opsComponentTemplates.organizationId, opsComponentTemplates.id] }),
]);

export const opsAssets = pgTable("ops_assets", {
  id: id(),
  organizationId: organizationId(),
  storeId: text("store_id").notNull(),
  categoryKey: text("category_key").notNull(),
  taxonomyNodeId: text("taxonomy_node_id"),
  equipmentTemplateId: text("equipment_template_id"),
  groupPathJson: jsonb("group_path_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  assetTag: text("asset_tag").notNull(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  supplier: text("supplier"),
  installedAt: instant("installed_at"),
  expectedLifeYears: integer("expected_life_years"),
  warrantyEndsAt: instant("warranty_ends_at"),
  replacementProfileId: text("replacement_profile_id"),
  replacementAttributesJson: jsonb("replacement_attributes_json").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  replacementAdjustmentBps: integer("replacement_adjustment_bps"),
  replacementEstimateMinor: bigint("replacement_estimate_minor", { mode: "number" }),
  replacementCurrency: text("replacement_currency"),
  status: text("status").notNull(),
  retiredAt: instant("retired_at"),
  replacedByAssetId: text("replaced_by_asset_id"),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_assets_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_assets_org_store_tag").on(table.organizationId, table.storeId, table.assetTag),
  index("idx_ops_assets_org_store_category").on(table.organizationId, table.storeId, table.categoryKey),
  index("idx_ops_assets_org_status").on(table.organizationId, table.status),
  index("idx_ops_assets_org_equipment_template").on(table.organizationId, table.equipmentTemplateId, table.status),
  index("idx_ops_assets_org_replacement_profile").on(table.organizationId, table.replacementProfileId, table.status),
  foreignKey({
    name: "fk_ops_assets_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_assets_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_assets_taxonomy",
    columns: [table.organizationId, table.taxonomyNodeId],
    foreignColumns: [opsTaxonomyNodes.organizationId, opsTaxonomyNodes.id],
  }),
  foreignKey({ name: "fk_ops_assets_equipment_template", columns: [table.organizationId, table.equipmentTemplateId], foreignColumns: [opsEquipmentTemplates.organizationId, opsEquipmentTemplates.id] }),
  foreignKey({ name: "fk_ops_assets_replacement_profile", columns: [table.organizationId, table.replacementProfileId], foreignColumns: [opsReplacementProfiles.organizationId, opsReplacementProfiles.id] }),
  foreignKey({ name: "fk_ops_assets_successor", columns: [table.organizationId, table.replacedByAssetId], foreignColumns: [table.organizationId, table.id] }),
  check("chk_ops_assets_status", sql`${table.status} IN ('operational', 'watch', 'out_of_service', 'retired')`),
  check("chk_ops_assets_life", sql`${table.expectedLifeYears} IS NULL OR ${table.expectedLifeYears} > 0`),
  check("chk_ops_assets_replacement_adjustment", sql`${table.replacementAdjustmentBps} IS NULL OR ${table.replacementAdjustmentBps} BETWEEN -9000 AND 50000`),
  check("chk_ops_assets_replacement", sql`${table.replacementEstimateMinor} IS NULL OR ${table.replacementEstimateMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_assets_replacement_money", sql`(${table.replacementEstimateMinor} IS NULL) = (${table.replacementCurrency} IS NULL)`),
]);

export const opsAssetComponents = pgTable("ops_asset_components", {
  id: id(),
  organizationId: organizationId(),
  assetId: text("asset_id").notNull(),
  parentComponentId: text("parent_component_id"),
  name: text("name").notNull(),
  partNumber: text("part_number"),
  serialNumber: text("serial_number"),
  installedAt: instant("installed_at"),
  warrantyEndsAt: instant("warranty_ends_at"),
  removedAt: instant("removed_at"),
  replacedByComponentId: text("replaced_by_component_id"),
  createdAt: createdAt(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_components_org_id").on(table.organizationId, table.id),
  index("idx_ops_components_org_asset_parent").on(table.organizationId, table.assetId, table.parentComponentId),
  foreignKey({
    name: "fk_ops_components_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_components_asset",
    columns: [table.organizationId, table.assetId],
    foreignColumns: [opsAssets.organizationId, opsAssets.id],
  }),
  foreignKey({
    name: "fk_ops_components_parent",
    columns: [table.organizationId, table.parentComponentId],
    foreignColumns: [opsAssetComponents.organizationId, opsAssetComponents.id],
  }),
  foreignKey({
    name: "fk_ops_components_replacement",
    columns: [table.organizationId, table.replacedByComponentId],
    foreignColumns: [opsAssetComponents.organizationId, opsAssetComponents.id],
  }),
]);

export const opsWorkOrders = pgTable("ops_work_orders", {
  id: id(),
  organizationId: organizationId(),
  number: text("number").notNull(),
  storeId: text("store_id").notNull(),
  requestId: text("request_id"),
  problem: text("problem").notNull(),
  authorizedScope: text("authorized_scope"),
  categoryKey: text("category_key"),
  taxonomyNodeId: text("taxonomy_node_id"),
  assetId: text("asset_id"),
  componentId: text("component_id"),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  version: integer("version").notNull().default(0),
  accountableParty: text("accountable_party").notNull(),
  nextAction: text("next_action").notNull(),
  dueAt: instant("due_at"),
  escalationTo: text("escalation_to"),
  nteAmountMinor: bigint("nte_amount_minor", { mode: "number" }),
  nteCurrency: text("nte_currency"),
  repairEstimateAmountMinor: bigint("repair_estimate_amount_minor", { mode: "number" }),
  repairEstimateCurrency: text("repair_estimate_currency"),
  estimatedServiceExtensionMonths: integer("estimated_service_extension_months"),
  vendorServiceTicketNumber: text("vendor_service_ticket_number"),
  vendorInvoiceNumber: text("vendor_invoice_number"),
  externalAccountingPo: text("external_accounting_po"),
  createdAt: createdAt(),
  resolvedAt: instant("resolved_at"),
  closedAt: instant("closed_at"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_work_orders_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_work_orders_org_number").on(table.organizationId, table.number),
  uniqueIndex("uidx_ops_work_orders_org_request").on(table.organizationId, table.requestId).where(sql`${table.requestId} IS NOT NULL`),
  index("idx_ops_work_orders_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_ops_work_orders_org_store_created").on(table.organizationId, table.storeId, table.createdAt),
  index("idx_ops_work_orders_org_category_created").on(table.organizationId, table.categoryKey, table.createdAt),
  foreignKey({
    name: "fk_ops_work_orders_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_work_orders_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_work_orders_request",
    columns: [table.organizationId, table.requestId],
    foreignColumns: [opsRequests.organizationId, opsRequests.id],
  }),
  foreignKey({
    name: "fk_ops_work_orders_taxonomy",
    columns: [table.organizationId, table.taxonomyNodeId],
    foreignColumns: [opsTaxonomyNodes.organizationId, opsTaxonomyNodes.id],
  }),
  foreignKey({
    name: "fk_ops_work_orders_asset",
    columns: [table.organizationId, table.assetId],
    foreignColumns: [opsAssets.organizationId, opsAssets.id],
  }),
  foreignKey({
    name: "fk_ops_work_orders_component",
    columns: [table.organizationId, table.componentId],
    foreignColumns: [opsAssetComponents.organizationId, opsAssetComponents.id],
  }),
  check("chk_ops_work_orders_priority", sql`${table.priority} IN ('emergency', 'urgent', 'routine', 'planned')`),
  check("chk_ops_work_orders_status", sql`${table.status} IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'resolved', 'closed', 'cancelled')`),
  check("chk_ops_work_orders_resolution_time", sql`${table.resolvedAt} IS NULL OR ${table.resolvedAt} >= ${table.createdAt}`),
  check("chk_ops_work_orders_nte", sql`${table.nteAmountMinor} IS NULL OR ${table.nteAmountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_work_orders_nte_money", sql`(${table.nteAmountMinor} IS NULL) = (${table.nteCurrency} IS NULL)`),
  check("chk_ops_work_orders_repair_estimate", sql`${table.repairEstimateAmountMinor} IS NULL OR ${table.repairEstimateAmountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_work_orders_repair_estimate_money", sql`(${table.repairEstimateAmountMinor} IS NULL) = (${table.repairEstimateCurrency} IS NULL)`),
  check("chk_ops_work_orders_service_extension", sql`${table.estimatedServiceExtensionMonths} IS NULL OR ${table.estimatedServiceExtensionMonths} BETWEEN 1 AND 1200`),
]);

export const opsWorkOrderAssignments = pgTable("ops_work_order_assignments", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  kind: text("kind").notNull(),
  vendorId: text("vendor_id"),
  internalMembershipId: text("internal_membership_id"),
  status: text("status").notNull(),
  assignedAt: instant("assigned_at").notNull(),
  supersedesAssignmentId: text("supersedes_assignment_id"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_assignments_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_assignments_org_work_active").on(table.organizationId, table.workOrderId).where(sql`${table.status} IN ('pending', 'issued', 'opened', 'accepted')`),
  index("idx_ops_assignments_org_work_status").on(table.organizationId, table.workOrderId, table.status),
  index("idx_ops_assignments_org_vendor_status").on(table.organizationId, table.vendorId, table.status),
  foreignKey({
    name: "fk_ops_assignments_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_assignments_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_assignments_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  foreignKey({
    name: "fk_ops_assignments_membership",
    columns: [table.organizationId, table.internalMembershipId],
    foreignColumns: [opsMemberships.organizationId, opsMemberships.id],
  }),
  foreignKey({
    name: "fk_ops_assignments_supersedes",
    columns: [table.organizationId, table.supersedesAssignmentId],
    foreignColumns: [opsWorkOrderAssignments.organizationId, opsWorkOrderAssignments.id],
  }),
  check("chk_ops_assignments_kind", sql`${table.kind} IN ('internal', 'outside_vendor', 'choose_later')`),
  check("chk_ops_assignments_status", sql`${table.status} IN ('pending', 'issued', 'opened', 'accepted', 'declined', 'completed', 'cancelled', 'superseded')`),
  check("chk_ops_assignments_provider", sql`
    (${table.kind} = 'outside_vendor' AND ${table.vendorId} IS NOT NULL AND ${table.internalMembershipId} IS NULL)
    OR (${table.kind} = 'internal' AND ${table.vendorId} IS NULL AND ${table.internalMembershipId} IS NOT NULL)
    OR (${table.kind} = 'choose_later' AND ${table.vendorId} IS NULL AND ${table.internalMembershipId} IS NULL)
  `),
]);

export const opsWorkOrderIssuances = pgTable("ops_work_order_issuances", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  assignmentId: text("assignment_id").notNull(),
  revision: integer("revision").notNull(),
  immutablePayloadJson: jsonb("immutable_payload_json").$type<Record<string, unknown>>().notNull(),
  channel: text("channel").notNull(),
  issuedAt: instant("issued_at").notNull(),
}, (table) => [
  unique("uq_ops_issuances_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_issuances_org_work_revision").on(table.organizationId, table.workOrderId, table.revision),
  index("idx_ops_issuances_org_assignment").on(table.organizationId, table.assignmentId, table.issuedAt),
  foreignKey({
    name: "fk_ops_issuances_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_issuances_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_issuances_assignment",
    columns: [table.organizationId, table.assignmentId],
    foreignColumns: [opsWorkOrderAssignments.organizationId, opsWorkOrderAssignments.id],
  }),
  check("chk_ops_issuances_revision", sql`${table.revision} > 0`),
  check("chk_ops_issuances_channel", sql`${table.channel} IN ('email', 'sms', 'print', 'manual')`),
]);

export const opsVendorResponses = pgTable("ops_vendor_responses", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  assignmentId: text("assignment_id").notNull(),
  issuanceId: text("issuance_id").notNull(),
  response: text("response").notNull(),
  responderName: text("responder_name").notNull(),
  proposedAt: instant("proposed_at"),
  message: text("message"),
  respondedAt: instant("responded_at").notNull(),
}, (table) => [
  unique("uq_ops_vendor_responses_org_id").on(table.organizationId, table.id),
  index("idx_ops_vendor_responses_org_assignment_time").on(table.organizationId, table.assignmentId, table.respondedAt),
  index("idx_ops_vendor_responses_org_work_time").on(table.organizationId, table.workOrderId, table.respondedAt),
  foreignKey({
    name: "fk_ops_vendor_responses_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_vendor_responses_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_vendor_responses_assignment",
    columns: [table.organizationId, table.assignmentId],
    foreignColumns: [opsWorkOrderAssignments.organizationId, opsWorkOrderAssignments.id],
  }),
  foreignKey({
    name: "fk_ops_vendor_responses_issuance",
    columns: [table.organizationId, table.issuanceId],
    foreignColumns: [opsWorkOrderIssuances.organizationId, opsWorkOrderIssuances.id],
  }),
  check("chk_ops_vendor_responses_response", sql`${table.response} IN ('accepted', 'declined', 'proposed_date', 'question')`),
  check("chk_ops_vendor_responses_proposal", sql`${table.response} <> 'proposed_date' OR ${table.proposedAt} IS NOT NULL`),
]);

export const opsApprovalPolicies = pgTable("ops_approval_policies", {
  id: id(), organizationId: organizationId(), policyKey: text("policy_key").notNull(), version: integer("version").notNull(), name: text("name").notNull(),
  scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), categoryKey: text("category_key"),
  minAmountMinor: bigint("min_amount_minor", { mode: "number" }).notNull(), maxAmountMinor: bigint("max_amount_minor", { mode: "number" }), currency: text("currency").notNull(),
  requiredRole: text("required_role").notNull(), escalationRole: text("escalation_role"), status: text("status").notNull(),
  supersedesPolicyId: text("supersedes_policy_id"), createdByMembershipId: text("created_by_membership_id"), createdAt: createdAt(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_approval_policies_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_approval_policies_org_key_version").on(table.organizationId, table.policyKey, table.version),
  index("idx_ops_approval_policies_org_status_scope").on(table.organizationId, table.status, table.scopeKind, table.scopeId),
  index("idx_ops_approval_policies_org_category_amount").on(table.organizationId, table.categoryKey, table.minAmountMinor),
  foreignKey({ name: "fk_ops_approval_policies_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_approval_policies_supersedes", columns: [table.organizationId, table.supersedesPolicyId], foreignColumns: [table.organizationId, table.id] }),
  check("chk_ops_approval_policies_version", sql`${table.version} > 0`),
  check("chk_ops_approval_policies_scope", sql`${table.scopeKind} IN ('organization', 'region', 'store')`),
  check("chk_ops_approval_policies_amount", sql`${table.minAmountMinor} BETWEEN 0 AND 9007199254740991 AND (${table.maxAmountMinor} IS NULL OR ${table.maxAmountMinor} BETWEEN ${table.minAmountMinor} AND 9007199254740991)`),
  check("chk_ops_approval_policies_currency", sql`nullif(btrim(${table.currency}), '') IS NOT NULL`),
  check("chk_ops_approval_policies_required_role", sql`${table.requiredRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_policies_escalation_role", sql`${table.escalationRole} IS NULL OR ${table.escalationRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_policies_status", sql`${table.status} IN ('active', 'superseded', 'inactive')`),
]);

export const opsApprovalRequests = pgTable("ops_approval_requests", {
  id: id(), organizationId: organizationId(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), storeId: text("store_id").notNull(), categoryKey: text("category_key"),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), policyId: text("policy_id").notNull(), policyKey: text("policy_key").notNull(), policyVersion: integer("policy_version").notNull(), policyName: text("policy_name").notNull(),
  policyScopeKind: text("policy_scope_kind").notNull(), policyScopeId: text("policy_scope_id").notNull(), requiredRole: text("required_role").notNull(), escalationRole: text("escalation_role"),
  requestedByMembershipId: text("requested_by_membership_id"), requestedByName: text("requested_by_name").notNull(), reason: text("reason"), requestedAt: instant("requested_at").notNull(), dueAt: instant("due_at"), parentApprovalRequestId: text("parent_approval_request_id"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_approval_requests_org_id").on(table.organizationId, table.id),
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

export const opsApprovalDecisions = pgTable("ops_approval_decisions", {
  id: id(), organizationId: organizationId(), approvalRequestId: text("approval_request_id").notNull(), decision: text("decision").notNull(),
  decidedByMembershipId: text("decided_by_membership_id"), decidedByName: text("decided_by_name").notNull(), decidedByRole: text("decided_by_role").notNull(), reason: text("reason"), escalatedToRole: text("escalated_to_role"), decidedAt: instant("decided_at").notNull(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_approval_decisions_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_approval_decisions_org_request").on(table.organizationId, table.approvalRequestId),
  index("idx_ops_approval_decisions_org_time").on(table.organizationId, table.decidedAt),
  foreignKey({ name: "fk_ops_approval_decisions_request", columns: [table.organizationId, table.approvalRequestId], foreignColumns: [opsApprovalRequests.organizationId, opsApprovalRequests.id] }),
  check("chk_ops_approval_decisions_kind", sql`${table.decision} IN ('approved', 'rejected', 'escalated', 'cancelled')`),
  check("chk_ops_approval_decisions_role", sql`${table.decidedByRole} IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')`),
  check("chk_ops_approval_decisions_escalated", sql`(${table.decision} = 'escalated' AND ${table.escalatedToRole} IS NOT NULL) OR (${table.decision} <> 'escalated' AND ${table.escalatedToRole} IS NULL)`),
]);

export const opsWorkOrderEstimateRequests = pgTable("ops_work_order_estimate_requests", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  kind: text("kind").notNull(),
  decisionKind: text("decision_kind").notNull().default("service_bid"),
  requestedScope: text("requested_scope").notNull(),
  status: text("status").notNull(),
  channel: text("channel").notNull(),
  requestedAt: instant("requested_at").notNull(),
  dueAt: instant("due_at"),
  openedAt: instant("opened_at"),
  respondedAt: instant("responded_at"),
  decisionAt: instant("decision_at"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_estimate_requests_org_id").on(table.organizationId, table.id),
  unique("uq_ops_estimate_requests_org_context").on(table.organizationId, table.id, table.workOrderId, table.vendorId),
  uniqueIndex("uidx_ops_estimate_requests_org_work_vendor_active").on(table.organizationId, table.workOrderId, table.vendorId).where(sql`${table.status} IN ('requested', 'opened', 'submitted')`),
  uniqueIndex("uidx_ops_estimate_requests_org_work_selected").on(table.organizationId, table.workOrderId).where(sql`${table.status} = 'selected'`),
  index("idx_ops_estimate_requests_org_work_status_requested").on(table.organizationId, table.workOrderId, table.status, table.requestedAt),
  index("idx_ops_estimate_requests_org_vendor_status_due").on(table.organizationId, table.vendorId, table.status, table.dueAt),
  index("idx_ops_estimate_requests_org_status_due").on(table.organizationId, table.status, table.dueAt),
  foreignKey({
    name: "fk_ops_estimate_requests_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_estimate_requests_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_estimate_requests_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  check("chk_ops_estimate_requests_kind", sql`${table.kind} IN ('estimate_only', 'diagnostic_and_estimate')`),
  check("chk_ops_estimate_requests_decision_kind", sql`${table.decisionKind} IN ('service_bid', 'replacement_quote')`),
  check("chk_ops_estimate_requests_status", sql`${table.status} IN ('requested', 'opened', 'submitted', 'declined', 'expired', 'withdrawn', 'selected', 'not_selected')`),
  check("chk_ops_estimate_requests_channel", sql`${table.channel} IN ('email', 'sms', 'manual')`),
  check("chk_ops_estimate_requests_scope", sql`nullif(btrim(${table.requestedScope}), '') IS NOT NULL`),
  check("chk_ops_estimate_requests_due", sql`${table.dueAt} IS NULL OR ${table.dueAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_opened", sql`${table.openedAt} IS NULL OR ${table.openedAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_responded", sql`${table.respondedAt} IS NULL OR ${table.respondedAt} >= ${table.requestedAt}`),
  check("chk_ops_estimate_requests_decision", sql`${table.decisionAt} IS NULL OR ${table.decisionAt} >= ${table.requestedAt}`),
]);

export const opsVendorEstimateProposals = pgTable("ops_vendor_estimate_proposals", {
  id: id(),
  organizationId: organizationId(),
  requestId: text("request_id").notNull(),
  workOrderId: text("work_order_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  revision: integer("revision").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  scope: text("scope").notNull(),
  exclusions: text("exclusions"),
  leadTimeDays: integer("lead_time_days"),
  validUntil: instant("valid_until"),
  submittedAt: instant("submitted_at").notNull(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_estimate_proposals_org_id").on(table.organizationId, table.id),
  unique("uq_ops_estimate_proposals_org_request_revision").on(table.organizationId, table.requestId, table.revision),
  index("idx_ops_estimate_proposals_org_work_submitted").on(table.organizationId, table.workOrderId, table.submittedAt),
  index("idx_ops_estimate_proposals_org_vendor_submitted").on(table.organizationId, table.vendorId, table.submittedAt),
  foreignKey({
    name: "fk_ops_estimate_proposals_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_estimate_proposals_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_estimate_proposals_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  foreignKey({
    name: "fk_ops_estimate_proposals_request_context",
    columns: [table.organizationId, table.requestId, table.workOrderId, table.vendorId],
    foreignColumns: [opsWorkOrderEstimateRequests.organizationId, opsWorkOrderEstimateRequests.id, opsWorkOrderEstimateRequests.workOrderId, opsWorkOrderEstimateRequests.vendorId],
  }),
  check("chk_ops_estimate_proposals_revision", sql`${table.revision} > 0`),
  check("chk_ops_estimate_proposals_amount", sql`${table.amountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_estimate_proposals_currency", sql`nullif(btrim(${table.currency}), '') IS NOT NULL`),
  check("chk_ops_estimate_proposals_scope", sql`nullif(btrim(${table.scope}), '') IS NOT NULL`),
  check("chk_ops_estimate_proposals_lead_time", sql`${table.leadTimeDays} IS NULL OR ${table.leadTimeDays} BETWEEN 0 AND 3650`),
  check("chk_ops_estimate_proposals_valid_until", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.submittedAt}`),
]);

export const opsReplacementBenchmarks = pgTable("ops_replacement_benchmarks", {
  id: id(), organizationId: organizationId(), profileId: text("profile_id").notNull(), sourceType: text("source_type").notNull(), sourceWorkOrderId: text("source_work_order_id"), sourceEstimateProposalId: text("source_estimate_proposal_id"), sourceAssetId: text("source_asset_id"), sourceVendorId: text("source_vendor_id"), equipmentAmountMinor: bigint("equipment_amount_minor", { mode: "number" }).notNull(), installationAmountMinor: bigint("installation_amount_minor", { mode: "number" }).notNull(), otherAmountMinor: bigint("other_amount_minor", { mode: "number" }).notNull(), totalAmountMinor: bigint("total_amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), effectiveAt: instant("effective_at").notNull(), status: text("status").notNull(), supersededAt: instant("superseded_at"), notes: text("notes"), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_replacement_benchmarks_org_id").on(table.organizationId, table.id),
  index("idx_ops_replacement_benchmarks_org_profile_status_effective").on(table.organizationId, table.profileId, table.status, table.effectiveAt),
  uniqueIndex("uidx_ops_replacement_benchmarks_org_profile_published").on(table.organizationId, table.profileId).where(sql`${table.status} = 'published'`),
  uniqueIndex("uidx_ops_replacement_benchmarks_org_source_proposal").on(table.organizationId, table.sourceEstimateProposalId),
  foreignKey({ name: "fk_ops_replacement_benchmarks_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_replacement_benchmarks_profile", columns: [table.organizationId, table.profileId], foreignColumns: [opsReplacementProfiles.organizationId, opsReplacementProfiles.id] }),
  foreignKey({ name: "fk_ops_replacement_benchmarks_work", columns: [table.organizationId, table.sourceWorkOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_replacement_benchmarks_proposal", columns: [table.organizationId, table.sourceEstimateProposalId], foreignColumns: [opsVendorEstimateProposals.organizationId, opsVendorEstimateProposals.id] }),
  foreignKey({ name: "fk_ops_replacement_benchmarks_asset", columns: [table.organizationId, table.sourceAssetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_replacement_benchmarks_vendor", columns: [table.organizationId, table.sourceVendorId], foreignColumns: [opsVendors.organizationId, opsVendors.id] }),
  check("chk_ops_replacement_benchmarks_source", sql`${table.sourceType} IN ('approved_quote', 'final_cost', 'manual', 'catalog')`),
  check("chk_ops_replacement_benchmarks_status", sql`${table.status} IN ('published', 'superseded')`),
  check("chk_ops_replacement_benchmarks_amounts", sql`${table.equipmentAmountMinor} >= 0 AND ${table.installationAmountMinor} >= 0 AND ${table.otherAmountMinor} >= 0 AND ${table.totalAmountMinor} = ${table.equipmentAmountMinor} + ${table.installationAmountMinor} + ${table.otherAmountMinor}`),
]);

export const opsAssetReplacementOverrides = pgTable("ops_asset_replacement_overrides", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), sourceBenchmarkId: text("source_benchmark_id"), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), effectiveAt: instant("effective_at").notNull(), reason: text("reason").notNull(), status: text("status").notNull(), supersededAt: instant("superseded_at"), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_asset_replacement_overrides_org_id").on(table.organizationId, table.id),
  index("idx_ops_asset_replacement_overrides_org_asset_status_effective").on(table.organizationId, table.assetId, table.status, table.effectiveAt),
  uniqueIndex("uidx_ops_asset_replacement_overrides_org_asset_active").on(table.organizationId, table.assetId).where(sql`${table.status} = 'active'`),
  foreignKey({ name: "fk_ops_asset_replacement_overrides_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_asset_replacement_overrides_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_asset_replacement_overrides_benchmark", columns: [table.organizationId, table.sourceBenchmarkId], foreignColumns: [opsReplacementBenchmarks.organizationId, opsReplacementBenchmarks.id] }),
  check("chk_ops_asset_replacement_overrides_status", sql`${table.status} IN ('active', 'superseded')`),
  check("chk_ops_asset_replacement_overrides_amount", sql`${table.amountMinor} >= 0`),
]);

export const opsReplacementEvents = pgTable("ops_replacement_events", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), workOrderId: text("work_order_id").notNull(), profileId: text("profile_id").notNull(), sourceEstimateProposalId: text("source_estimate_proposal_id").notNull(), status: text("status").notNull(), approvedAmountMinor: bigint("approved_amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), approvedAt: instant("approved_at").notNull(), completedAt: instant("completed_at"), finalAmountMinor: bigint("final_amount_minor", { mode: "number" }), replacementAssetId: text("replacement_asset_id"), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_replacement_events_org_id").on(table.organizationId, table.id),
  index("idx_ops_replacement_events_org_asset_status").on(table.organizationId, table.assetId, table.status),
  index("idx_ops_replacement_events_org_work").on(table.organizationId, table.workOrderId, table.createdAt),
  uniqueIndex("uidx_ops_replacement_events_org_proposal").on(table.organizationId, table.sourceEstimateProposalId),
  foreignKey({ name: "fk_ops_replacement_events_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_replacement_events_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_replacement_events_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_replacement_events_profile", columns: [table.organizationId, table.profileId], foreignColumns: [opsReplacementProfiles.organizationId, opsReplacementProfiles.id] }),
  foreignKey({ name: "fk_ops_replacement_events_proposal", columns: [table.organizationId, table.sourceEstimateProposalId], foreignColumns: [opsVendorEstimateProposals.organizationId, opsVendorEstimateProposals.id] }),
  foreignKey({ name: "fk_ops_replacement_events_successor", columns: [table.organizationId, table.replacementAssetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  check("chk_ops_replacement_events_status", sql`${table.status} IN ('approved', 'completed', 'cancelled')`),
  check("chk_ops_replacement_events_amounts", sql`${table.approvedAmountMinor} > 0 AND (${table.finalAmountMinor} IS NULL OR ${table.finalAmountMinor} > 0)`),
]);

export const opsLifecycleRecommendations = pgTable("ops_lifecycle_recommendations", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), workOrderId: text("work_order_id"), version: integer("version").notNull(), modelVersion: text("model_version").notNull(), recommendation: text("recommendation").notNull(), confidence: text("confidence").notNull(), inputsJson: jsonb("inputs_json").$type<Record<string, unknown>>().notNull(), explanation: text("explanation").notNull(), missingDataJson: jsonb("missing_data_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), userDecision: text("user_decision").notNull(), userReason: text("user_reason").notNull(), plannedForYear: integer("planned_for_year"), decidedByMembershipId: text("decided_by_membership_id").notNull(), decidedAt: instant("decided_at").notNull(), actualOutcome: text("actual_outcome"), actualOutcomeAt: instant("actual_outcome_at"), replacementEventId: text("replacement_event_id"), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_lifecycle_recommendations_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_lifecycle_recommendations_org_asset_version").on(table.organizationId, table.assetId, table.version),
  index("idx_ops_lifecycle_recommendations_org_asset_created").on(table.organizationId, table.assetId, table.createdAt),
  foreignKey({ name: "fk_ops_lifecycle_recommendations_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_lifecycle_recommendations_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_lifecycle_recommendations_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_lifecycle_recommendations_membership", columns: [table.organizationId, table.decidedByMembershipId], foreignColumns: [opsMemberships.organizationId, opsMemberships.id] }),
  foreignKey({ name: "fk_ops_lifecycle_recommendations_event", columns: [table.organizationId, table.replacementEventId], foreignColumns: [opsReplacementEvents.organizationId, opsReplacementEvents.id] }),
  check("chk_ops_lifecycle_recommendations_version", sql`${table.version} > 0`),
  check("chk_ops_lifecycle_recommendations_recommendation", sql`${table.recommendation} IN ('repair', 'replace', 'capital_review')`),
  check("chk_ops_lifecycle_recommendations_confidence", sql`${table.confidence} IN ('low', 'medium', 'high')`),
  check("chk_ops_lifecycle_recommendations_decision", sql`${table.userDecision} IN ('repair', 'replace', 'defer', 'investigate')`),
  check("chk_ops_lifecycle_recommendations_plan_year", sql`${table.plannedForYear} IS NULL OR ${table.plannedForYear} BETWEEN 2000 AND 2200`),
  check("chk_ops_lifecycle_recommendations_outcome", sql`${table.actualOutcome} IS NULL OR ${table.actualOutcome} IN ('repaired', 'replaced', 'retired_without_replacement', 'still_in_service')`),
]);

export const opsVisitSessions = pgTable("ops_visit_sessions", {
  id: id(),
  organizationId: organizationId(),
  storeId: text("store_id").notNull(),
  providerKind: text("provider_kind").notNull(),
  vendorId: text("vendor_id"),
  internalMembershipId: text("internal_membership_id"),
  workOrderId: text("work_order_id"),
  unmatchedReason: text("unmatched_reason"),
  technicianName: text("technician_name").notNull(),
  technicianPhoneOrPin: text("technician_phone_or_pin"),
  crewCount: integer("crew_count").notNull().default(1),
  additionalTechnicianNamesJson: jsonb("additional_technician_names_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  vehicleIdentifier: text("vehicle_identifier"),
  arrivalNote: text("arrival_note"),
  providerName: text("provider_name").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull(),
  startedChannel: text("started_channel").notNull(),
  endedChannel: text("ended_channel"),
  checkedInAt: instant("checked_in_at").notNull(),
  checkedOutAt: instant("checked_out_at"),
  outcome: text("outcome"),
  outcomeNotes: text("outcome_notes"),
  observedDurationSeconds: integer("observed_duration_seconds"),
}, (table) => [
  unique("uq_ops_visits_org_id").on(table.organizationId, table.id),
  index("idx_ops_visits_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.checkedInAt),
  index("idx_ops_visits_org_vendor_status_time").on(table.organizationId, table.vendorId, table.status, table.checkedInAt),
  index("idx_ops_visits_org_work_time").on(table.organizationId, table.workOrderId, table.checkedInAt),
  foreignKey({
    name: "fk_ops_visits_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_visits_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_visits_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  foreignKey({
    name: "fk_ops_visits_membership",
    columns: [table.organizationId, table.internalMembershipId],
    foreignColumns: [opsMemberships.organizationId, opsMemberships.id],
  }),
  foreignKey({
    name: "fk_ops_visits_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  check("chk_ops_visits_provider_kind", sql`${table.providerKind} IN ('outside_vendor', 'internal')`),
  check("chk_ops_visits_provider", sql`
    (${table.providerKind} = 'outside_vendor' AND ${table.vendorId} IS NOT NULL AND ${table.internalMembershipId} IS NULL)
    OR (${table.providerKind} = 'internal' AND ${table.vendorId} IS NULL AND ${table.internalMembershipId} IS NOT NULL)
  `),
  check("chk_ops_visits_crew_count", sql`${table.crewCount} BETWEEN 1 AND 100`),
  check("chk_ops_visits_additional_technicians", sql`jsonb_typeof(${table.additionalTechnicianNamesJson}) = 'array' AND jsonb_array_length(${table.additionalTechnicianNamesJson}) < ${table.crewCount}`),
  check("chk_ops_visits_status", sql`${table.status} IN ('active', 'checked_out', 'amended')`),
  check("chk_ops_visits_started_channel", sql`${table.startedChannel} IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')`),
  check("chk_ops_visits_ended_channel", sql`${table.endedChannel} IS NULL OR ${table.endedChannel} IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')`),
  check("chk_ops_visits_outcome", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('resolved', 'temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'unable_to_reproduce', 'no_issue_found', 'inspection_complete', 'pm_complete', 'other')`),
  check("chk_ops_visits_chronology", sql`${table.checkedOutAt} IS NULL OR ${table.checkedOutAt} >= ${table.checkedInAt}`),
  check("chk_ops_visits_duration", sql`${table.observedDurationSeconds} IS NULL OR ${table.observedDurationSeconds} >= 0`),
  check("chk_ops_visits_checkout_state", sql`
    (${table.status} = 'active' AND ${table.checkedOutAt} IS NULL)
    OR (${table.status} <> 'active' AND ${table.checkedOutAt} IS NOT NULL)
  `),
]);

export const opsVisitEvidence = pgTable("ops_visit_evidence", {
  id: id(),
  organizationId: organizationId(),
  visitId: text("visit_id").notNull(),
  kind: text("kind").notNull(),
  channel: text("channel").notNull(),
  observedAt: instant("observed_at").notNull(),
  locationResult: text("location_result"),
  latitudeE6: integer("latitude_e6"),
  longitudeE6: integer("longitude_e6"),
  accuracyM: integer("accuracy_m"),
  distanceM: integer("distance_m"),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  unique("uq_ops_visit_evidence_org_id").on(table.organizationId, table.id),
  index("idx_ops_visit_evidence_org_visit_time").on(table.organizationId, table.visitId, table.observedAt),
  index("idx_ops_visit_evidence_org_kind_time").on(table.organizationId, table.kind, table.observedAt),
  uniqueIndex("uidx_ops_visit_boundary_evidence").on(table.organizationId, table.visitId, table.kind).where(sql`${table.kind} IN ('check_in', 'check_out')`),
  foreignKey({
    name: "fk_ops_visit_evidence_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_visit_evidence_visit",
    columns: [table.organizationId, table.visitId],
    foreignColumns: [opsVisitSessions.organizationId, opsVisitSessions.id],
  }),
  check("chk_ops_visit_evidence_kind", sql`${table.kind} IN ('check_in', 'check_out', 'reported_arrival', 'identity_assertion', 'photo', 'file', 'store_confirmation', 'amendment')`),
  check("chk_ops_visit_evidence_channel", sql`${table.channel} IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')`),
  check("chk_ops_visit_evidence_location", sql`${table.locationResult} IS NULL OR ${table.locationResult} IN ('verified', 'outside_geofence', 'low_accuracy', 'permission_denied', 'unavailable', 'not_requested', 'trusted_store_device')`),
  check("chk_ops_visit_evidence_latitude", sql`${table.latitudeE6} IS NULL OR ${table.latitudeE6} BETWEEN -90000000 AND 90000000`),
  check("chk_ops_visit_evidence_longitude", sql`${table.longitudeE6} IS NULL OR ${table.longitudeE6} BETWEEN -180000000 AND 180000000`),
  check("chk_ops_visit_evidence_accuracy", sql`${table.accuracyM} IS NULL OR ${table.accuracyM} >= 0`),
  check("chk_ops_visit_evidence_distance", sql`${table.distanceM} IS NULL OR ${table.distanceM} >= 0`),
]);

export const opsFiles = pgTable("ops_files", {
  id: id(),
  organizationId: organizationId(),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  status: text("status").notNull().default("available"),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_files_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_files_org_storage_key").on(table.organizationId, table.storageKey),
  index("idx_ops_files_org_sha256").on(table.organizationId, table.sha256),
  foreignKey({
    name: "fk_ops_files_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_files_status", sql`${table.status} IN ('pending', 'available', 'quarantined', 'deleted')`),
  check("chk_ops_files_byte_length", sql`${table.byteLength} >= 0`),
  check("chk_ops_files_sha256", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
]);

export const opsEntityFiles = pgTable("ops_entity_files", {
  id: id(),
  organizationId: organizationId(),
  fileId: text("file_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  purpose: text("purpose").notNull(),
  visibility: text("visibility").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_entity_files_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_entity_files_org_file_entity").on(table.organizationId, table.fileId, table.entityType, table.entityId, table.purpose),
  index("idx_ops_entity_files_org_entity").on(table.organizationId, table.entityType, table.entityId),
  foreignKey({
    name: "fk_ops_entity_files_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_entity_files_file",
    columns: [table.organizationId, table.fileId],
    foreignColumns: [opsFiles.organizationId, opsFiles.id],
  }),
  check("chk_ops_entity_files_type", sql`${table.entityType} IN ('request', 'work_order', 'visit', 'asset', 'invoice_reference', 'invoice')`),
  check("chk_ops_entity_files_purpose", sql`${table.purpose} IN ('photo', 'service_document', 'invoice', 'warranty', 'other')`),
  check("chk_ops_entity_files_visibility", sql`${table.visibility} IN ('internal', 'vendor_shared', 'public_receipt')`),
]);

export const opsFollowUps = pgTable("ops_follow_ups", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  sourceVisitId: text("source_visit_id"),
  accountableParty: text("accountable_party").notNull(),
  nextAction: text("next_action").notNull(),
  dueAt: instant("due_at").notNull(),
  escalationTo: text("escalation_to").notNull(),
  status: text("status").notNull(),
  createdAt: createdAt(),
  completedAt: instant("completed_at"),
}, (table) => [
  unique("uq_ops_followups_org_id").on(table.organizationId, table.id),
  index("idx_ops_followups_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_ops_followups_org_work").on(table.organizationId, table.workOrderId, table.createdAt),
  foreignKey({
    name: "fk_ops_followups_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_followups_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_followups_visit",
    columns: [table.organizationId, table.sourceVisitId],
    foreignColumns: [opsVisitSessions.organizationId, opsVisitSessions.id],
  }),
  check("chk_ops_followups_status", sql`${table.status} IN ('open', 'completed', 'cancelled')`),
  check("chk_ops_followups_completion", sql`(${table.status} = 'completed') = (${table.completedAt} IS NOT NULL)`),
]);

export const opsSiteVisitWorkOrders = pgTable("ops_site_visit_work_orders", {
  id: id(),
  organizationId: organizationId(),
  visitId: text("visit_id").notNull(),
  workOrderId: text("work_order_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  linkedByActorType: text("linked_by_actor_type").notNull(),
  linkedByActorId: text("linked_by_actor_id"),
  linkedByActorName: text("linked_by_actor_name").notNull(),
  linkedAt: instant("linked_at").notNull(),
  outcome: text("outcome"),
  outcomeNotes: text("outcome_notes"),
  outcomeRecordedByActorType: text("outcome_recorded_by_actor_type"),
  outcomeRecordedByActorId: text("outcome_recorded_by_actor_id"),
  outcomeRecordedByActorName: text("outcome_recorded_by_actor_name"),
  outcomeRecordedAt: instant("outcome_recorded_at"),
  followUpId: text("follow_up_id"),
}, (table) => [
  unique("uq_ops_site_visit_work_org_id").on(table.organizationId, table.id),
  unique("uq_ops_site_visit_work_org_id_work").on(table.organizationId, table.id, table.workOrderId),
  unique("uq_ops_site_visit_work_org_visit_work").on(table.organizationId, table.visitId, table.workOrderId),
  unique("uq_ops_site_visit_work_org_visit_ordinal").on(table.organizationId, table.visitId, table.ordinal),
  index("idx_ops_site_visit_work_org_work_time").on(table.organizationId, table.workOrderId, table.linkedAt),
  index("idx_ops_site_visit_work_org_outcome_time").on(table.organizationId, table.outcome, table.outcomeRecordedAt),
  foreignKey({ name: "fk_ops_site_visit_work_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_site_visit_work_visit", columns: [table.organizationId, table.visitId], foreignColumns: [opsVisitSessions.organizationId, opsVisitSessions.id] }),
  foreignKey({ name: "fk_ops_site_visit_work_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_site_visit_work_followup", columns: [table.organizationId, table.followUpId], foreignColumns: [opsFollowUps.organizationId, opsFollowUps.id] }),
  check("chk_ops_site_visit_work_ordinal", sql`${table.ordinal} > 0`),
  check("chk_ops_site_visit_work_link_actor", sql`${table.linkedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support') AND length(btrim(${table.linkedByActorName})) > 0`),
  check("chk_ops_site_visit_work_outcome", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')`),
  check("chk_ops_site_visit_work_outcome_actor", sql`${table.outcomeRecordedByActorType} IS NULL OR ${table.outcomeRecordedByActorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')`),
  check("chk_ops_site_visit_work_outcome_state", sql`(${table.outcome} IS NULL AND ${table.outcomeNotes} IS NULL AND ${table.outcomeRecordedByActorType} IS NULL AND ${table.outcomeRecordedByActorId} IS NULL AND ${table.outcomeRecordedByActorName} IS NULL AND ${table.outcomeRecordedAt} IS NULL AND ${table.followUpId} IS NULL) OR (${table.outcome} IS NOT NULL AND ${table.outcomeRecordedByActorType} IS NOT NULL AND length(btrim(${table.outcomeRecordedByActorName})) > 0 AND ${table.outcomeRecordedAt} IS NOT NULL)`),
  check("chk_ops_site_visit_work_followup_outcome", sql`${table.followUpId} IS NULL OR ${table.outcome} NOT IN ('completed', 'no_issue_found')`),
]);

export const opsWorkOrderVerifications = pgTable("ops_work_order_verifications", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  siteVisitWorkOrderId: text("site_visit_work_order_id").notNull(),
  outcome: text("outcome").notNull(),
  outcomeRecordedAt: instant("outcome_recorded_at").notNull(),
  cycle: integer("cycle").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason"),
  decidedByMembershipId: text("decided_by_membership_id").notNull(),
  decidedByName: text("decided_by_name").notNull(),
  decidedAt: instant("decided_at").notNull(),
}, (table) => [
  unique("uq_ops_work_verifications_org_id").on(table.organizationId, table.id),
  unique("uq_ops_work_verifications_org_cycle").on(table.organizationId, table.workOrderId, table.cycle),
  unique("uq_ops_work_verifications_org_outcome").on(table.organizationId, table.siteVisitWorkOrderId),
  index("idx_ops_work_verifications_org_work_time").on(table.organizationId, table.workOrderId, table.decidedAt),
  foreignKey({ name: "fk_ops_work_verifications_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_work_verifications_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_work_verifications_outcome", columns: [table.organizationId, table.siteVisitWorkOrderId, table.workOrderId], foreignColumns: [opsSiteVisitWorkOrders.organizationId, opsSiteVisitWorkOrders.id, opsSiteVisitWorkOrders.workOrderId] }),
  foreignKey({ name: "fk_ops_work_verifications_member", columns: [table.organizationId, table.decidedByMembershipId], foreignColumns: [opsMemberships.organizationId, opsMemberships.id] }),
  check("chk_ops_work_verifications_outcome", sql`${table.outcome} IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')`),
  check("chk_ops_work_verifications_cycle", sql`${table.cycle} > 0`),
  check("chk_ops_work_verifications_decision", sql`${table.decision} IN ('verified', 'rejected')`),
  check("chk_ops_work_verifications_reason", sql`${table.decision} <> 'rejected' OR (${table.reason} IS NOT NULL AND length(btrim(${table.reason})) > 0)`),
  check("chk_ops_work_verifications_actor", sql`length(btrim(${table.decidedByName})) > 0`),
  check("chk_ops_work_verifications_time", sql`${table.decidedAt} >= ${table.outcomeRecordedAt}`),
]);

export const opsWorkflowTasks = pgTable("ops_workflow_tasks", {
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
  blocking: boolean("blocking").notNull().default(false),
  requiredForProgress: boolean("required_for_progress").notNull().default(true),
  dueAt: instant("due_at"),
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
  startedAt: instant("started_at"),
  completedByActorType: text("completed_by_actor_type"),
  completedByActorId: text("completed_by_actor_id"),
  completedByActorName: text("completed_by_actor_name"),
  completedAt: instant("completed_at"),
  cancelledByActorType: text("cancelled_by_actor_type"),
  cancelledByActorId: text("cancelled_by_actor_id"),
  cancelledByActorName: text("cancelled_by_actor_name"),
  cancelledAt: instant("cancelled_at"),
  resolutionNote: text("resolution_note"),
}, (table) => [
  unique("uq_ops_workflow_tasks_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_workflow_tasks_org_followup").on(table.organizationId, table.sourceFollowUpId),
  uniqueIndex("uidx_ops_workflow_tasks_org_approval").on(table.organizationId, table.sourceApprovalRequestId),
  index("idx_ops_workflow_tasks_org_work_status_due").on(table.organizationId, table.workOrderId, table.status, table.dueAt),
  index("idx_ops_workflow_tasks_org_request_status_due").on(table.organizationId, table.serviceRequestId, table.status, table.dueAt),
  index("idx_ops_workflow_tasks_org_assignee_status_due").on(table.organizationId, table.assigneeType, table.assigneeId, table.status, table.dueAt),
  foreignKey({ name: "fk_ops_workflow_tasks_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_workflow_tasks_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_workflow_tasks_request", columns: [table.organizationId, table.serviceRequestId], foreignColumns: [opsRequests.organizationId, opsRequests.id] }),
  foreignKey({ name: "fk_ops_workflow_tasks_followup", columns: [table.organizationId, table.sourceFollowUpId], foreignColumns: [opsFollowUps.organizationId, opsFollowUps.id] }),
  foreignKey({ name: "fk_ops_workflow_tasks_approval", columns: [table.organizationId, table.sourceApprovalRequestId], foreignColumns: [opsApprovalRequests.organizationId, opsApprovalRequests.id] }),
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

export const opsWorkflowTaskSlaPauses = pgTable("ops_workflow_task_sla_pauses", {
  id: id(), organizationId: organizationId(), workflowTaskId: text("workflow_task_id").notNull(), workOrderId: text("work_order_id").notNull(),
  reasonCode: text("reason_code").notNull(), reasonDetail: text("reason_detail").notNull(), ownerType: text("owner_type").notNull(), ownerId: text("owner_id"), ownerName: text("owner_name").notNull(),
  affectedClocksJson: jsonb("affected_clocks_json").$type<string[]>().notNull(), expectedResumeAt: instant("expected_resume_at"), pausedByActorType: text("paused_by_actor_type").notNull(), pausedByActorId: text("paused_by_actor_id"), pausedByActorName: text("paused_by_actor_name").notNull(), pausedAt: instant("paused_at").notNull(),
}, (table) => [
  unique("uq_ops_workflow_task_pauses_org_id").on(table.organizationId, table.id),
  index("idx_ops_workflow_task_pauses_org_task_time").on(table.organizationId, table.workflowTaskId, table.pausedAt),
  foreignKey({ name: "fk_ops_workflow_task_pauses_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_workflow_task_pauses_task", columns: [table.organizationId, table.workflowTaskId], foreignColumns: [opsWorkflowTasks.organizationId, opsWorkflowTasks.id] }),
  foreignKey({ name: "fk_ops_workflow_task_pauses_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  check("chk_ops_workflow_task_pauses_reason", sql`${table.reasonCode} IN ('awaiting_vendor', 'awaiting_parts', 'awaiting_approval', 'awaiting_store_access', 'awaiting_customer', 'weather_or_site_condition', 'scheduled_future_event', 'external_dependency', 'other')`),
  check("chk_ops_workflow_task_pauses_owner", sql`${table.ownerType} IN ('membership', 'team', 'vendor', 'store', 'external_party', 'system')`),
  check("chk_ops_workflow_task_pauses_text", sql`length(trim(${table.reasonDetail})) > 0 AND length(trim(${table.ownerName})) > 0 AND length(trim(${table.pausedByActorName})) > 0 AND jsonb_array_length(${table.affectedClocksJson}) > 0`),
  check("chk_ops_workflow_task_pauses_expected", sql`${table.expectedResumeAt} IS NULL OR ${table.expectedResumeAt} > ${table.pausedAt}`),
]);

export const opsWorkflowTaskSlaResumes = pgTable("ops_workflow_task_sla_resumes", {
  id: id(), organizationId: organizationId(), workflowTaskId: text("workflow_task_id").notNull(), workOrderId: text("work_order_id").notNull(), pauseId: text("pause_id").notNull(),
  resumedByActorType: text("resumed_by_actor_type").notNull(), resumedByActorId: text("resumed_by_actor_id"), resumedByActorName: text("resumed_by_actor_name").notNull(), resumedAt: instant("resumed_at").notNull(), note: text("note"),
}, (table) => [
  unique("uq_ops_workflow_task_resumes_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_workflow_task_resumes_org_pause").on(table.organizationId, table.pauseId),
  index("idx_ops_workflow_task_resumes_org_task_time").on(table.organizationId, table.workflowTaskId, table.resumedAt),
  foreignKey({ name: "fk_ops_workflow_task_resumes_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_workflow_task_resumes_task", columns: [table.organizationId, table.workflowTaskId], foreignColumns: [opsWorkflowTasks.organizationId, opsWorkflowTasks.id] }),
  foreignKey({ name: "fk_ops_workflow_task_resumes_pause", columns: [table.organizationId, table.pauseId], foreignColumns: [opsWorkflowTaskSlaPauses.organizationId, opsWorkflowTaskSlaPauses.id] }),
  foreignKey({ name: "fk_ops_workflow_task_resumes_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  check("chk_ops_workflow_task_resumes_actor", sql`length(trim(${table.resumedByActorName})) > 0`),
]);

export const opsExceptions = pgTable("ops_exceptions", {
  id: id(),
  organizationId: organizationId(),
  kind: text("kind").notNull(),
  storeId: text("store_id"),
  workOrderId: text("work_order_id"),
  visitId: text("visit_id"),
  vendorId: text("vendor_id"),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  detectedAt: instant("detected_at").notNull(),
  resolvedAt: instant("resolved_at"),
}, (table) => [
  unique("uq_ops_exceptions_org_id").on(table.organizationId, table.id),
  index("idx_ops_exceptions_org_status_time").on(table.organizationId, table.status, table.detectedAt),
  index("idx_ops_exceptions_org_store_status").on(table.organizationId, table.storeId, table.status),
  index("idx_ops_exceptions_org_vendor_status").on(table.organizationId, table.vendorId, table.status),
  foreignKey({
    name: "fk_ops_exceptions_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_exceptions_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_exceptions_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_exceptions_visit",
    columns: [table.organizationId, table.visitId],
    foreignColumns: [opsVisitSessions.organizationId, opsVisitSessions.id],
  }),
  foreignKey({
    name: "fk_ops_exceptions_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  check("chk_ops_exceptions_kind", sql`${table.kind} IN ('no_work_order', 'unexpected_visit', 'missing_checkout', 'outside_geofence', 'low_accuracy_location', 'duplicate_active_visit', 'high_risk_service', 'unmatched_invoice', 'amount_above_authorization', 'overdue_pm')`),
  check("chk_ops_exceptions_severity", sql`${table.severity} IN ('info', 'attention', 'urgent')`),
  check("chk_ops_exceptions_status", sql`${table.status} IN ('open', 'acknowledged', 'resolved')`),
]);

export const opsMaintenancePrograms = pgTable("ops_maintenance_programs", {
  id: id(), organizationId: organizationId(), programKey: text("program_key").notNull(), version: integer("version").notNull(), name: text("name").notNull(), tradeKey: text("trade_key").notNull(), workType: text("work_type").notNull(), applicableAssetTypesJson: jsonb("applicable_asset_types_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), frequencyDays: integer("frequency_days").notNull(), recurrenceKind: text("recurrence_kind").notNull(), dueWindowDays: integer("due_window_days").notNull(), scheduleAnchorAt: instant("schedule_anchor_at"), seasonalStartMonth: integer("seasonal_start_month"), seasonalEndMonth: integer("seasonal_end_month"), checklistTemplateId: text("checklist_template_id").notNull(), requiredEvidenceKindsJson: jsonb("required_evidence_kinds_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), expectedDurationMinutes: integer("expected_duration_minutes").notNull(), completionCriteria: text("completion_criteria").notNull(), correctiveWorkAuthorityMinor: bigint("corrective_work_authority_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), deficiencyHandling: text("deficiency_handling").notNull(), status: text("status").notNull(), supersedesProgramId: text("supersedes_program_id"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_maintenance_program_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_maintenance_program_org_key_version").on(table.organizationId, table.programKey, table.version), index("idx_ops_maintenance_program_org_status_trade").on(table.organizationId, table.status, table.tradeKey)]);

export const opsChecklistTemplates = pgTable("ops_checklist_templates", {
  id: id(), organizationId: organizationId(), name: text("name").notNull(), version: integer("version").notNull(), itemsJson: jsonb("items_json").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_checklist_templates_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_checklist_templates_org_name_version").on(table.organizationId, table.name, table.version)]);

export const opsPmPlans = pgTable("ops_pm_plans", {
  id: id(), organizationId: organizationId(), name: text("name").notNull(), programId: text("program_id"), programVersion: integer("program_version"), storeId: text("store_id"), assetId: text("asset_id"), assetSelectionRule: text("asset_selection_rule"), categoryKey: text("category_key"), cadenceDays: integer("cadence_days").notNull(), completionWindowDays: integer("completion_window_days").notNull(), preferredVendorId: text("preferred_vendor_id"), backupVendorId: text("backup_vendor_id"), contractVersionId: text("contract_version_id"), effectiveStartsAt: instant("effective_starts_at"), effectiveEndsAt: instant("effective_ends_at"), accessRequirements: text("access_requirements"), programAuthorizationMinor: bigint("program_authorization_minor", { mode: "number" }), budgetMinor: bigint("budget_minor", { mode: "number" }), currency: text("currency"), serviceLevelPolicyId: text("service_level_policy_id"), schedulingMode: text("scheduling_mode"), escalationRules: text("escalation_rules"), cadenceOverrideReason: text("cadence_override_reason"), cadenceOverriddenAt: instant("cadence_overridden_at"), cadenceOverriddenByMembershipId: text("cadence_overridden_by_membership_id"), active: boolean("active").notNull().default(false), createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_pm_plans_org_id").on(table.organizationId, table.id), index("idx_ops_pm_plans_org_active_store").on(table.organizationId, table.active, table.storeId), index("idx_ops_pm_plans_org_asset").on(table.organizationId, table.assetId), uniqueIndex("uidx_ops_pm_plans_org_program_asset").on(table.organizationId, table.programId, table.assetId),
  foreignKey({ name: "fk_ops_pm_plans_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_pm_plans_store", columns: [table.organizationId, table.storeId], foreignColumns: [opsStores.organizationId, opsStores.id] }),
  foreignKey({ name: "fk_ops_pm_plans_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  check("chk_ops_pm_plans_cadence", sql`${table.cadenceDays} > 0`), check("chk_ops_pm_plans_window", sql`${table.completionWindowDays} >= 0`),
  check("chk_ops_pm_plans_target", sql`${table.storeId} IS NOT NULL OR ${table.assetId} IS NOT NULL OR nullif(btrim(${table.categoryKey}), '') IS NOT NULL`),
]);

export const opsPmOccurrences = pgTable("ops_pm_occurrences", {
  id: id(), organizationId: organizationId(), planId: text("plan_id").notNull(), storeId: text("store_id").notNull(), assetId: text("asset_id"), workOrderId: text("work_order_id"), programId: text("program_id"), programVersion: integer("program_version"), planVersion: integer("plan_version"), dueAt: instant("due_at").notNull(), windowStartsAt: instant("window_starts_at").notNull(), windowEndsAt: instant("window_ends_at").notNull(), proposedAt: instant("proposed_at"), committedAt: instant("committed_at"), status: text("status").notNull(), completedAt: instant("completed_at"), result: text("result"), exceptionReason: text("exception_reason"), recurrenceKey: text("recurrence_key"), createdAt: instant("created_at"),
}, (table) => [
  unique("uq_ops_pm_occurrences_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_pm_occurrences_org_plan_recurrence").on(table.organizationId, table.planId, table.recurrenceKey), index("idx_ops_pm_occurrences_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_ops_pm_occurrences_org_store_due").on(table.organizationId, table.storeId, table.dueAt), index("idx_ops_pm_occurrences_org_asset_due").on(table.organizationId, table.assetId, table.dueAt),
  foreignKey({ name: "fk_ops_pm_occurrences_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_pm_occurrences_plan", columns: [table.organizationId, table.planId], foreignColumns: [opsPmPlans.organizationId, opsPmPlans.id] }),
  foreignKey({ name: "fk_ops_pm_occurrences_store", columns: [table.organizationId, table.storeId], foreignColumns: [opsStores.organizationId, opsStores.id] }),
  foreignKey({ name: "fk_ops_pm_occurrences_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_pm_occurrences_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  check("chk_ops_pm_occurrences_status", sql`${table.status} IN ('upcoming', 'unscheduled', 'proposed', 'scheduled', 'due', 'completed', 'completed_early', 'completed_on_time', 'completed_late', 'missed', 'waived', 'cancelled')`),
  check("chk_ops_pm_occurrences_window", sql`${table.windowStartsAt} <= ${table.dueAt} AND ${table.dueAt} <= ${table.windowEndsAt}`),
  check("chk_ops_pm_occurrences_completion", sql`${table.status} NOT IN ('completed', 'completed_early', 'completed_on_time', 'completed_late') OR ${table.completedAt} IS NOT NULL`),
]);

export const opsPmWorkItems = pgTable("ops_pm_work_items", {
  id: id(), organizationId: organizationId(), occurrenceId: text("occurrence_id").notNull(), workOrderId: text("work_order_id").notNull(), assetId: text("asset_id").notNull(), componentId: text("component_id"), requiredTask: text("required_task").notNull(), checklistTemplateId: text("checklist_template_id").notNull(), status: text("status").notNull(), result: text("result"), deficiency: text("deficiency"), followUpId: text("follow_up_id"), correctiveWorkOrderId: text("corrective_work_order_id"), costAllocationMinor: bigint("cost_allocation_minor", { mode: "number" }), currency: text("currency").notNull(), createdAt: createdAt(), completedAt: instant("completed_at"),
}, (table) => [unique("uq_ops_pm_work_items_org_id").on(table.organizationId, table.id), index("idx_ops_pm_work_items_org_occurrence").on(table.organizationId, table.occurrenceId, table.assetId), index("idx_ops_pm_work_items_org_work").on(table.organizationId, table.workOrderId)]);

export const opsChecklistResponses = pgTable("ops_checklist_responses", {
  id: id(), organizationId: organizationId(), workItemId: text("work_item_id").notNull(), checklistTemplateId: text("checklist_template_id").notNull(), itemKey: text("item_key").notNull(), responseKind: text("response_kind").notNull(), passed: boolean("passed"), numericValue: integer("numeric_value"), textValue: text("text_value"), measurementUnit: text("measurement_unit"), evidenceFileIdsJson: jsonb("evidence_file_ids_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), recordedByActorType: text("recorded_by_actor_type").notNull(), recordedByActorId: text("recorded_by_actor_id"), recordedByActorName: text("recorded_by_actor_name").notNull(), recordedAt: instant("recorded_at").notNull(),
}, (table) => [unique("uq_ops_checklist_responses_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_checklist_responses_org_work_item_key").on(table.organizationId, table.workItemId, table.itemKey)]);

export const opsServiceRuns = pgTable("ops_service_runs", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id").notNull(), schedulingMode: text("scheduling_mode").notNull(), status: text("status").notNull(), proposedStartsAt: instant("proposed_starts_at").notNull(), proposedEndsAt: instant("proposed_ends_at").notNull(), responseDueAt: instant("response_due_at").notNull(), committedStartsAt: instant("committed_starts_at"), committedEndsAt: instant("committed_ends_at"), estimatedDriveMinutes: integer("estimated_drive_minutes").notNull(), estimatedServiceMinutes: integer("estimated_service_minutes").notNull(), capacityUsedMinutes: integer("capacity_used_minutes").notNull(), expectedWorkValueMinor: bigint("expected_work_value_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), estimatedTripReduction: integer("estimated_trip_reduction").notNull(), estimatedOpportunityMinor: bigint("estimated_opportunity_minor", { mode: "number" }).notNull(), recommendationExplanation: text("recommendation_explanation").notNull(), requiredQualificationsJson: jsonb("required_qualifications_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), constraintsJson: jsonb("constraints_json").$type<Record<string, unknown>>().notNull(), confidence: text("confidence").notNull(), schedulerVersion: text("scheduler_version").notNull(), originalRecommendationJson: jsonb("original_recommendation_json").$type<Record<string, unknown>>().notNull(), createdByActorType: text("created_by_actor_type").notNull(), createdByActorId: text("created_by_actor_id"), createdByActorName: text("created_by_actor_name").notNull(), createdAt: createdAt(), acceptedAt: instant("accepted_at"), completedAt: instant("completed_at"),
}, (table) => [unique("uq_ops_service_runs_org_id").on(table.organizationId, table.id), index("idx_ops_service_runs_org_vendor_status_start").on(table.organizationId, table.vendorId, table.status, table.proposedStartsAt)]);

export const opsRouteStops = pgTable("ops_route_stops", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), storeId: text("store_id").notNull(), sequence: integer("sequence").notNull(), proposedArrivalAt: instant("proposed_arrival_at").notNull(), committedArrivalAt: instant("committed_arrival_at"), estimatedDriveMinutes: integer("estimated_drive_minutes").notNull(), estimatedServiceMinutes: integer("estimated_service_minutes").notNull(), accessRequirements: text("access_requirements"), status: text("status").notNull(), siteVisitId: text("site_visit_id"),
}, (table) => [unique("uq_ops_route_stops_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_route_stops_org_run_sequence").on(table.organizationId, table.serviceRunId, table.sequence), uniqueIndex("uidx_ops_route_stops_org_run_store").on(table.organizationId, table.serviceRunId, table.storeId)]);

export const opsServiceRunWorkOrders = pgTable("ops_service_run_work_orders", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), routeStopId: text("route_stop_id").notNull(), workOrderId: text("work_order_id").notNull(), occurrenceId: text("occurrence_id"), planned: boolean("planned").notNull().default(true), estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(), addressed: boolean("addressed").notNull().default(false), removalReason: text("removal_reason"),
}, (table) => [unique("uq_ops_service_run_work_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_service_run_work_org_run_work").on(table.organizationId, table.serviceRunId, table.workOrderId), index("idx_ops_service_run_work_org_work").on(table.organizationId, table.workOrderId)]);

export const opsServiceRunResponses = pgTable("ops_service_run_responses", {
  id: id(), organizationId: organizationId(), serviceRunId: text("service_run_id").notNull(), response: text("response").notNull(), requestedStartsAt: instant("requested_starts_at"), requestedStopChangesJson: jsonb("requested_stop_changes_json"), requestedWorkOrderChangesJson: jsonb("requested_work_order_changes_json"), reasonCode: text("reason_code"), reasonDetail: text("reason_detail"), travelImpactMinutes: integer("travel_impact_minutes").notNull(), dueWindowImpactCount: integer("due_window_impact_count").notNull(), economicImpactMinor: bigint("economic_impact_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), responderName: text("responder_name").notNull(), respondedAt: instant("responded_at").notNull(), resultingPlanJson: jsonb("resulting_plan_json"),
}, (table) => [unique("uq_ops_service_run_responses_org_id").on(table.organizationId, table.id), index("idx_ops_service_run_responses_org_run_time").on(table.organizationId, table.serviceRunId, table.respondedAt)]);

export const opsVendorWarrantyProfiles = pgTable("ops_vendor_warranty_profiles", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), baseLaborDays: integer("base_labor_days").notNull(), basePartsDays: integer("base_parts_days").notNull(), baseTravelDays: integer("base_travel_days").notNull(), baseDiagnosticDays: integer("base_diagnostic_days").notNull(), effectiveStartsAt: instant("effective_starts_at").notNull(), effectiveEndsAt: instant("effective_ends_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_vendor_warranty_profiles_org_id").on(table.organizationId, table.id), index("idx_ops_vendor_warranty_profiles_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsWarrantyRules = pgTable("ops_warranty_rules", {
  id: id(), organizationId: organizationId(), vendorWarrantyProfileId: text("vendor_warranty_profile_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), quoteId: text("quote_id"), authorizationId: text("authorization_id"), tradeKey: text("trade_key"), workType: text("work_type"), serviceType: text("service_type"), assetType: text("asset_type"), componentType: text("component_type"), manufacturer: text("manufacturer"), model: text("model"), vendorSuppliedPart: boolean("vendor_supplied_part"), customerSuppliedPart: boolean("customer_supplied_part"), regionId: text("region_id"), storeId: text("store_id"), priority: integer("priority").notNull(), effectiveStartsAt: instant("effective_starts_at").notNull(), effectiveEndsAt: instant("effective_ends_at"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_warranty_rules_org_id").on(table.organizationId, table.id), index("idx_ops_warranty_rules_org_vendor_status_priority").on(table.organizationId, table.vendorId, table.status, table.priority)]);

export const opsWarrantyCoverageLines = pgTable("ops_warranty_coverage_lines", {
  id: id(), organizationId: organizationId(), warrantyRuleId: text("warranty_rule_id"), vendorWarrantyProfileId: text("vendor_warranty_profile_id"), coverageType: text("coverage_type").notNull(), duration: integer("duration").notNull(), durationUnit: text("duration_unit").notNull(), startEvent: text("start_event").notNull(), startDate: date("start_date", { mode: "string" }), endDate: date("end_date", { mode: "string" }), provider: text("provider").notNull(), obligatedVendorId: text("obligated_vendor_id"), routingRule: text("routing_rule").notNull(), deductibleMinor: bigint("deductible_minor", { mode: "number" }).notNull(), maximumCoverageMinor: bigint("maximum_coverage_minor", { mode: "number" }), currency: text("currency").notNull(), conditions: text("conditions"), exclusions: text("exclusions"),
}, (table) => [unique("uq_ops_warranty_coverage_lines_org_id").on(table.organizationId, table.id), index("idx_ops_warranty_coverage_org_rule_type").on(table.organizationId, table.warrantyRuleId, table.coverageType)]);

export const opsRepairItems = pgTable("ops_repair_items", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), siteVisitWorkOrderId: text("site_visit_work_order_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), assetId: text("asset_id").notNull(), componentId: text("component_id"), failureCode: text("failure_code").notNull(), repairAction: text("repair_action").notNull(), repairSeverity: text("repair_severity").notNull(), removedComponentId: text("removed_component_id"), installedComponentId: text("installed_component_id"), partManufacturer: text("part_manufacturer"), partModel: text("part_model"), serialNumber: text("serial_number"), vendorSupplied: boolean("vendor_supplied").notNull().default(false), completionDate: date("completion_date", { mode: "string" }).notNull(), verificationDate: date("verification_date", { mode: "string" }), laborCostMinor: bigint("labor_cost_minor", { mode: "number" }).notNull(), partCostMinor: bigint("part_cost_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), rootCause: text("root_cause"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_repair_items_org_id").on(table.organizationId, table.id), index("idx_ops_repair_items_org_work").on(table.organizationId, table.workOrderId), index("idx_ops_repair_items_org_asset_component_date").on(table.organizationId, table.assetId, table.componentId, table.completionDate)]);

export const opsComponentLifecycleEvents = pgTable("ops_component_lifecycle_events", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), removedComponentId: text("removed_component_id").notNull(), installedComponentId: text("installed_component_id").notNull(), repairItemId: text("repair_item_id").notNull(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), partManufacturer: text("part_manufacturer").notNull(), partModel: text("part_model").notNull(), serialNumber: text("serial_number"), removedAt: instant("removed_at").notNull(), installedAt: instant("installed_at").notNull(), failureMode: text("failure_mode").notNull(), rootCause: text("root_cause"), laborCostMinor: bigint("labor_cost_minor", { mode: "number" }).notNull(), partCostMinor: bigint("part_cost_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), replacementKind: text("replacement_kind").notNull(), expectedLifeMonths: integer("expected_life_months"), warrantyEndsAt: instant("warranty_ends_at"), createdAt: createdAt(),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_component_lifecycle_org_id").on(table.organizationId, table.id),
  unique("uq_ops_component_lifecycle_org_removed").on(table.organizationId, table.removedComponentId),
  unique("uq_ops_component_lifecycle_org_repair").on(table.organizationId, table.repairItemId),
  index("idx_ops_component_lifecycle_org_model_removed").on(table.organizationId, table.partManufacturer, table.partModel, table.removedAt),
  index("idx_ops_component_lifecycle_org_vendor_removed").on(table.organizationId, table.vendorId, table.removedAt),
  foreignKey({ name: "fk_ops_component_lifecycle_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_asset", columns: [table.organizationId, table.assetId], foreignColumns: [opsAssets.organizationId, opsAssets.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_removed", columns: [table.organizationId, table.removedComponentId], foreignColumns: [opsAssetComponents.organizationId, opsAssetComponents.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_installed", columns: [table.organizationId, table.installedComponentId], foreignColumns: [opsAssetComponents.organizationId, opsAssetComponents.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_repair", columns: [table.organizationId, table.repairItemId], foreignColumns: [opsRepairItems.organizationId, opsRepairItems.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_work", columns: [table.organizationId, table.workOrderId], foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id] }),
  foreignKey({ name: "fk_ops_component_lifecycle_vendor", columns: [table.organizationId, table.vendorId], foreignColumns: [opsVendors.organizationId, opsVendors.id] }),
  check("chk_ops_component_lifecycle_costs", sql`${table.laborCostMinor} >= 0 AND ${table.partCostMinor} >= 0`),
  check("chk_ops_component_lifecycle_kind", sql`${table.replacementKind} IN ('planned', 'reactive')`),
  check("chk_ops_component_lifecycle_life", sql`${table.expectedLifeMonths} IS NULL OR ${table.expectedLifeMonths} > 0`),
  check("chk_ops_component_lifecycle_dates", sql`${table.installedAt} >= ${table.removedAt}`),
]);

export const opsAppliedWarranties = pgTable("ops_applied_warranties", {
  id: id(), organizationId: organizationId(), repairItemId: text("repair_item_id").notNull(), coverageType: text("coverage_type").notNull(), provider: text("provider").notNull(), obligatedVendorId: text("obligated_vendor_id"), startDate: date("start_date", { mode: "string" }).notNull(), endDate: date("end_date", { mode: "string" }).notNull(), coveredChargesJson: jsonb("covered_charges_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`), routingRule: text("routing_rule").notNull(), contractVersionId: text("contract_version_id"), policySource: text("policy_source").notNull(), ruleSource: text("rule_source"), originalCalculatedTermsJson: jsonb("original_calculated_terms_json").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_applied_warranties_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_applied_warranty_repair_type").on(table.organizationId, table.repairItemId, table.coverageType), index("idx_ops_applied_warranty_org_end").on(table.organizationId, table.endDate)]);

export const opsWarrantyAmendments = pgTable("ops_warranty_amendments", {
  id: id(), organizationId: organizationId(), appliedWarrantyId: text("applied_warranty_id").notNull(), amendmentKind: text("amendment_kind").notNull(), appliesToRepairOnly: boolean("applies_to_repair_only").notNull().default(true), amendedTermsJson: jsonb("amended_terms_json").notNull(), reason: text("reason").notNull(), decidedByMembershipId: text("decided_by_membership_id").notNull(), decidedByName: text("decided_by_name").notNull(), decidedAt: instant("decided_at").notNull(),
}, (table) => [unique("uq_ops_warranty_amendments_org_id").on(table.organizationId, table.id), index("idx_ops_warranty_amendments_org_applied_time").on(table.organizationId, table.appliedWarrantyId, table.decidedAt)]);

export const opsManufacturerWarranties = pgTable("ops_manufacturer_warranties", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), componentId: text("component_id"), manufacturer: text("manufacturer").notNull(), model: text("model"), serialNumber: text("serial_number"), partsCoverage: text("parts_coverage").notNull(), laborCoverage: text("labor_coverage").notNull(), startDate: date("start_date", { mode: "string" }).notNull(), expirationDate: date("expiration_date", { mode: "string" }).notNull(), authorizedProviderRule: text("authorized_provider_rule"), claimRequirements: text("claim_requirements"), installingVendorId: text("installing_vendor_id"), administrator: text("administrator"), supportingFileId: text("supporting_file_id"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_manufacturer_warranties_org_id").on(table.organizationId, table.id), index("idx_ops_manufacturer_warranty_org_asset_expiry").on(table.organizationId, table.assetId, table.expirationDate)]);

export const opsWarrantyCases = pgTable("ops_warranty_cases", {
  id: id(), organizationId: organizationId(), requestId: text("request_id"), workOrderId: text("work_order_id").notNull(), assetId: text("asset_id").notNull(), componentId: text("component_id"), priorRepairItemId: text("prior_repair_item_id"), appliedWarrantyId: text("applied_warranty_id"), manufacturerWarrantyId: text("manufacturer_warranty_id"), status: text("status").notNull(), confidence: text("confidence").notNull(), detectionExplanation: text("detection_explanation").notNull(), diagnosisRequired: boolean("diagnosis_required").notNull().default(true), coverageDecision: text("coverage_decision").notNull(), customerChargeStatus: text("customer_charge_status").notNull(), invoiceHold: boolean("invoice_hold").notNull().default(true), routingRule: text("routing_rule").notNull(), obligatedVendorId: text("obligated_vendor_id"), vendorResponseDueAt: instant("vendor_response_due_at"), createdAt: createdAt(), closedAt: instant("closed_at"),
}, (table) => [unique("uq_ops_warranty_cases_org_id").on(table.organizationId, table.id), index("idx_ops_warranty_cases_org_status_vendor_due").on(table.organizationId, table.status, table.obligatedVendorId, table.vendorResponseDueAt), index("idx_ops_warranty_cases_org_asset").on(table.organizationId, table.assetId)]);

export const opsQuotes = pgTable("ops_quotes", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), quoteNumber: text("quote_number").notNull(), version: integer("version").notNull(), scope: text("scope").notNull(), subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(), taxMinor: bigint("tax_minor", { mode: "number" }).notNull(), feesMinor: bigint("fees_minor", { mode: "number" }).notNull(), totalMinor: bigint("total_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), submittedAt: instant("submitted_at").notNull(), expiresAt: instant("expires_at"), supersedesQuoteId: text("supersedes_quote_id"),
}, (table) => [unique("uq_ops_quotes_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_quotes_org_vendor_number_version").on(table.organizationId, table.vendorId, table.quoteNumber, table.version)]);

export const opsAuthorizations = pgTable("ops_authorizations", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), authorizationType: text("authorization_type").notNull(), authorizedAmountMinor: bigint("authorized_amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), authorizedScope: text("authorized_scope").notNull(), approverMembershipId: text("approver_membership_id").notNull(), approverName: text("approver_name").notNull(), approvalAuthority: text("approval_authority").notNull(), authorizedAt: instant("authorized_at").notNull(), reason: text("reason").notNull(), contractVersionId: text("contract_version_id"), supersedesAuthorizationId: text("supersedes_authorization_id"),
}, (table) => [unique("uq_ops_authorizations_org_id").on(table.organizationId, table.id), index("idx_ops_authorizations_org_work_time").on(table.organizationId, table.workOrderId, table.authorizedAt)]);

export const opsInvoices = pgTable("ops_invoices", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), contractVersionId: text("contract_version_id"), vendorInvoiceNumber: text("vendor_invoice_number").notNull(), invoiceDate: date("invoice_date", { mode: "string" }).notNull(), subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(), taxMinor: bigint("tax_minor", { mode: "number" }).notNull(), feesMinor: bigint("fees_minor", { mode: "number" }).notNull(), totalMinor: bigint("total_minor", { mode: "number" }).notNull(), approvedForPaymentMinor: bigint("approved_for_payment_minor", { mode: "number" }).notNull(), paidAmountMinor: bigint("paid_amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), status: text("status").notNull(), exceptionReason: text("exception_reason"), supportingFileId: text("supporting_file_id"), submittedByMembershipId: text("submitted_by_membership_id"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_invoices_v2_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_invoices_v2_org_vendor_number").on(table.organizationId, table.vendorId, table.vendorInvoiceNumber), index("idx_ops_invoices_v2_org_status_date").on(table.organizationId, table.status, table.invoiceDate)]);

export const opsInvoiceLines = pgTable("ops_invoice_lines", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), lineNumber: integer("line_number").notNull(), category: text("category").notNull(), description: text("description").notNull(), quantityThousandths: integer("quantity_thousandths").notNull(), unitAmountMinor: bigint("unit_amount_minor", { mode: "number" }).notNull(), lineAmountMinor: bigint("line_amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), contractRateCardLineId: text("contract_rate_card_line_id"), createdAt: createdAt(),
}, (table) => [unique("uq_ops_invoice_lines_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_invoice_lines_org_invoice_line").on(table.organizationId, table.invoiceId, table.lineNumber)]);

export const opsInvoiceLineAllocations = pgTable("ops_invoice_line_allocations", {
  id: id(), organizationId: organizationId(), invoiceLineId: text("invoice_line_id").notNull(), workOrderId: text("work_order_id").notNull(), workItemId: text("work_item_id"), repairItemId: text("repair_item_id"), siteVisitWorkOrderId: text("site_visit_work_order_id"), assetId: text("asset_id"), componentId: text("component_id"), storeId: text("store_id").notNull(), tradeKey: text("trade_key"), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), method: text("method").notNull(), confirmedByMembershipId: text("confirmed_by_membership_id"), confirmedAt: instant("confirmed_at"),
}, (table) => [unique("uq_ops_invoice_line_allocations_org_id").on(table.organizationId, table.id), index("idx_ops_invoice_line_allocations_org_line").on(table.organizationId, table.invoiceLineId), index("idx_ops_invoice_line_allocations_org_work").on(table.organizationId, table.workOrderId)]);

export const opsInvoiceExceptions = pgTable("ops_invoice_exceptions", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), invoiceLineId: text("invoice_line_id"), kind: text("kind").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), detectedAt: instant("detected_at").notNull(), resolvedAt: instant("resolved_at"), resolutionReason: text("resolution_reason"),
}, (table) => [unique("uq_ops_invoice_exceptions_org_id").on(table.organizationId, table.id), index("idx_ops_invoice_exceptions_org_status_kind").on(table.organizationId, table.status, table.kind)]);

export const opsInvoiceAdjustments = pgTable("ops_invoice_adjustments", {
  id: id(), organizationId: organizationId(), invoiceId: text("invoice_id").notNull(), kind: text("kind").notNull(), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), reason: text("reason").notNull(), createdByMembershipId: text("created_by_membership_id").notNull(), createdAt: createdAt(),
}, (table) => [unique("uq_ops_invoice_adjustments_org_id").on(table.organizationId, table.id), index("idx_ops_invoice_adjustments_org_invoice_time").on(table.organizationId, table.invoiceId, table.createdAt)]);

export const opsServiceDiscrepancies = pgTable("ops_service_discrepancies", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), invoiceId: text("invoice_id"), siteVisitWorkOrderId: text("site_visit_work_order_id"), discrepancyType: text("discrepancy_type").notNull(), status: text("status").notNull(), factsJson: jsonb("facts_json").notNull(), vendorResponse: text("vendor_response"), resolution: text("resolution"), createdAt: createdAt(), resolvedAt: instant("resolved_at"),
}, (table) => [unique("uq_ops_service_discrepancies_org_id").on(table.organizationId, table.id), index("idx_ops_service_discrepancies_org_status").on(table.organizationId, table.status), index("idx_ops_service_discrepancies_org_work").on(table.organizationId, table.workOrderId)]);

export const opsValueEvents = pgTable("ops_value_events", {
  id: id(), organizationId: organizationId(), category: text("category").notNull(), eventType: text("event_type").notNull(), amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), workOrderId: text("work_order_id"), invoiceLineId: text("invoice_line_id"), serviceRunId: text("service_run_id"), contractVersionId: text("contract_version_id"), warrantyCaseId: text("warranty_case_id"), assetId: text("asset_id"), approvalDecisionId: text("approval_decision_id"), sourceDecision: text("source_decision").notNull(), deduplicationKey: text("deduplication_key").notNull(), occurredAt: instant("occurred_at").notNull(),
}, (table) => [unique("uq_ops_value_events_org_id").on(table.organizationId, table.id), uniqueIndex("uidx_ops_value_events_org_dedup").on(table.organizationId, table.deduplicationKey), index("idx_ops_value_events_org_category_time").on(table.organizationId, table.category, table.occurredAt)]);

export const opsCostLines = pgTable("ops_cost_lines", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  serviceDate: date("service_date", { mode: "string" }).notNull(),
  recordedAt: instant("recorded_at").notNull(),
}, (table) => [
  unique("uq_ops_cost_lines_org_id").on(table.organizationId, table.id),
  index("idx_ops_cost_lines_org_work_date").on(table.organizationId, table.workOrderId, table.serviceDate),
  index("idx_ops_cost_lines_org_date_kind").on(table.organizationId, table.serviceDate, table.kind),
  foreignKey({
    name: "fk_ops_cost_lines_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_cost_lines_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  check("chk_ops_cost_lines_kind", sql`${table.kind} IN ('labor', 'parts', 'travel', 'materials', 'other')`),
  check("chk_ops_cost_lines_amount", sql`${table.amountMinor} BETWEEN -9007199254740991 AND 9007199254740991`),
]);

export const opsInvoiceReferences = pgTable("ops_invoice_references", {
  id: id(),
  organizationId: organizationId(),
  vendorId: text("vendor_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
  grossAmountMinor: bigint("gross_amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  operatorWorkOrderNumber: text("operator_work_order_number"),
  matchStatus: text("match_status").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_invoices_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_invoices_org_vendor_number").on(table.organizationId, table.vendorId, table.invoiceNumber),
  index("idx_ops_invoices_org_match_date").on(table.organizationId, table.matchStatus, table.invoiceDate),
  index("idx_ops_invoices_org_wo_number").on(table.organizationId, table.operatorWorkOrderNumber),
  foreignKey({
    name: "fk_ops_invoices_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_invoices_vendor",
    columns: [table.organizationId, table.vendorId],
    foreignColumns: [opsVendors.organizationId, opsVendors.id],
  }),
  check("chk_ops_invoices_gross", sql`${table.grossAmountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_invoices_match_status", sql`${table.matchStatus} IN ('unmatched', 'suggested', 'confirmed', 'rejected')`),
]);

export const opsInvoiceAllocations = pgTable("ops_invoice_allocations", {
  id: id(),
  organizationId: organizationId(),
  invoiceReferenceId: text("invoice_reference_id").notNull(),
  workOrderId: text("work_order_id").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  confirmedByMembershipId: text("confirmed_by_membership_id"),
  confirmedAt: instant("confirmed_at"),
}, (table) => [
  unique("uq_ops_invoice_allocations_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_invoice_allocations_org_invoice_work").on(table.organizationId, table.invoiceReferenceId, table.workOrderId),
  index("idx_ops_invoice_allocations_org_work").on(table.organizationId, table.workOrderId),
  foreignKey({
    name: "fk_ops_invoice_allocations_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_invoice_allocations_invoice",
    columns: [table.organizationId, table.invoiceReferenceId],
    foreignColumns: [opsInvoiceReferences.organizationId, opsInvoiceReferences.id],
  }),
  foreignKey({
    name: "fk_ops_invoice_allocations_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  foreignKey({
    name: "fk_ops_invoice_allocations_confirmer",
    columns: [table.organizationId, table.confirmedByMembershipId],
    foreignColumns: [opsMemberships.organizationId, opsMemberships.id],
  }),
  check("chk_ops_invoice_allocations_amount", sql`${table.amountMinor} BETWEEN 0 AND 9007199254740991`),
  check("chk_ops_invoice_allocations_confirmation", sql`(${table.confirmedByMembershipId} IS NULL) = (${table.confirmedAt} IS NULL)`),
]);

export const opsAuditEvents = pgTable("ops_audit_events", {
  id: id(),
  organizationId: organizationId(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  actorName: text("actor_name").notNull(),
  occurredAt: instant("occurred_at").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  unique("uq_ops_audit_org_id").on(table.organizationId, table.id),
  index("idx_ops_audit_org_aggregate_time").on(table.organizationId, table.aggregateType, table.aggregateId, table.occurredAt),
  index("idx_ops_audit_org_event_time").on(table.organizationId, table.eventType, table.occurredAt),
  foreignKey({
    name: "fk_ops_audit_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_audit_actor_type", sql`${table.actorType} IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')`),
]);

export const opsOutboxMessages = pgTable("ops_outbox_messages", {
  id: id(),
  organizationId: organizationId(),
  topic: text("topic").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  availableAt: instant("available_at").notNull(),
  createdAt: createdAt(),
  attemptCount: integer("attempt_count").notNull().default(0),
  claimedAt: instant("claimed_at"),
  deliveredAt: instant("delivered_at"),
  lastError: text("last_error"),
}, (table) => [
  unique("uq_ops_outbox_org_id").on(table.organizationId, table.id),
  index("idx_ops_outbox_org_status_available").on(table.organizationId, table.status, table.availableAt),
  foreignKey({
    name: "fk_ops_outbox_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_outbox_status", sql`${table.status} IN ('pending', 'processing', 'delivered', 'failed')`),
  check("chk_ops_outbox_attempt_count", sql`${table.attemptCount} >= 0`),
]);

export const opsNotificationRules = pgTable("ops_notification_rules", {
  id: id(),
  organizationId: organizationId(),
  eventKey: text("event_key").notNull(),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  recipientRole: text("recipient_role").notNull(),
  updatedByMembershipId: text("updated_by_membership_id"),
  createdAt: createdAt(),
  updatedAt: instant("updated_at").notNull(),
}, (table) => [
  unique("uq_ops_notification_rules_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_notification_rules_org_event").on(table.organizationId, table.eventKey),
  index("idx_ops_notification_rules_org_role").on(table.organizationId, table.recipientRole),
  foreignKey({
    name: "fk_ops_notification_rules_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_notification_rules_event", sql`${table.eventKey} IN ('vendor_response_received', 'workflow_task_escalated', 'follow_up_created', 'vendor_reminder_created')`),
  check("chk_ops_notification_rules_role", sql`${table.recipientRole} IN ('facilities_admin', 'regional_manager', 'executive', 'finance_reviewer')`),
]);

export const opsJobRuns = pgTable("ops_job_runs", {
  id: id(),
  organizationId: organizationId(),
  jobType: text("job_type").notNull(),
  slotKey: text("slot_key").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: instant("started_at").notNull(),
  finishedAt: instant("finished_at"),
  processedCount: integer("processed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  detailsJson: jsonb("details_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_job_runs_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_job_runs_org_type_slot").on(table.organizationId, table.jobType, table.slotKey),
  index("idx_ops_job_runs_org_type_started").on(table.organizationId, table.jobType, table.startedAt),
  foreignKey({
    name: "fk_ops_job_runs_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_job_runs_status", sql`${table.status} IN ('running', 'succeeded', 'failed')`),
  check("chk_ops_job_runs_counts", sql`${table.processedCount} >= 0 AND ${table.failedCount} >= 0`),
]);

export const opsVendorContinuations = pgTable("ops_vendor_continuations", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  vendorResponseId: text("vendor_response_id").notNull(),
  action: text("action").notNull(),
  message: text("message"),
  createdByMembershipId: text("created_by_membership_id"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_vendor_continuations_resp_action").on(table.organizationId, table.vendorResponseId, table.action),
  foreignKey({ name: "fk_ops_vendor_continuations_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
]);
export const opsServiceAppointments = pgTable("ops_service_appointments", {
  id: id(),
  organizationId: organizationId(),
  workOrderId: text("work_order_id").notNull(),
  assignmentId: text("assignment_id").notNull(),
  issuanceId: text("issuance_id"),
  sourceVendorResponseId: text("source_vendor_response_id"),
  status: text("status").notNull(),
  proposedBy: text("proposed_by").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  note: text("note"),
  createdByMembershipId: text("created_by_membership_id"),
  createdAt: createdAt(),
}, (table) => [
  index("idx_ops_service_appointments_org_work").on(table.organizationId, table.workOrderId, table.startsAt),
  foreignKey({ name: "fk_ops_service_appointments_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
]);
export const opsSavedViews = pgTable("ops_saved_views", {
  id: id(),
  organizationId: organizationId(),
  ownerMembershipId: text("owner_membership_id").notNull(),
  surface: text("surface").notNull(),
  name: text("name").notNull(),
  queryString: text("query_string").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_saved_views_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_saved_views_org_owner_surface_name").on(table.organizationId, table.ownerMembershipId, table.surface, table.name),
  index("idx_ops_saved_views_org_owner_surface").on(table.organizationId, table.ownerMembershipId, table.surface),
  foreignKey({ name: "fk_ops_saved_views_org", columns: [table.organizationId], foreignColumns: [opsOrganizations.id] }),
]);

export const opsPublicTokens = pgTable("ops_public_tokens", {
  id: id(),
  organizationId: organizationId(),
  purpose: text("purpose").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: instant("expires_at").notNull(),
  createdAt: createdAt(),
  usedAt: instant("used_at"),
  revokedAt: instant("revoked_at"),
}, (table) => [
  unique("uq_ops_public_tokens_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_public_tokens_hash").on(table.tokenHash),
  index("idx_ops_public_tokens_org_subject").on(table.organizationId, table.subjectType, table.subjectId),
  index("idx_ops_public_tokens_org_purpose_expiry").on(table.organizationId, table.purpose, table.expiresAt),
  foreignKey({
    name: "fk_ops_public_tokens_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_public_tokens_hash", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  check("chk_ops_public_tokens_expiry", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const opsIdempotencyKeys = pgTable("ops_idempotency_keys", {
  organizationId: organizationId(),
  key: text("key").notNull(),
  command: text("command").notNull(),
  resultId: text("result_id").notNull(),
  requestHash: text("request_hash").notNull(),
  createdAt: createdAt(),
  expiresAt: instant("expires_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.key] }),
  index("idx_ops_idempotency_org_expiry").on(table.organizationId, table.expiresAt),
  foreignKey({
    name: "fk_ops_idempotency_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_idempotency_expiry", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const opsWorkOrderCounters = pgTable("ops_work_order_counters", {
  organizationId: organizationId(),
  counterYear: integer("counter_year").notNull(),
  nextValue: integer("next_value").notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.counterYear] }),
  foreignKey({
    name: "fk_ops_work_order_counters_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  check("chk_ops_work_order_counters_year", sql`${table.counterYear} BETWEEN 2000 AND 9999`),
  check("chk_ops_work_order_counters_next", sql`${table.nextValue} > 0`),
]);

export const opsPostgresSchema = {
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
  opsComponentLifecycleEvents,
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
  opsSavedViews,
  opsPublicTokens,
  opsIdempotencyKeys,
  opsWorkOrderCounters,
} as const;
