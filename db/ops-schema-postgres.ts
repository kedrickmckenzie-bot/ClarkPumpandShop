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

export const opsAssets = pgTable("ops_assets", {
  id: id(),
  organizationId: organizationId(),
  storeId: text("store_id").notNull(),
  categoryKey: text("category_key").notNull(),
  taxonomyNodeId: text("taxonomy_node_id"),
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
  replacementEstimateMinor: bigint("replacement_estimate_minor", { mode: "number" }),
  replacementCurrency: text("replacement_currency"),
  status: text("status").notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_assets_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_assets_org_store_tag").on(table.organizationId, table.storeId, table.assetTag),
  index("idx_ops_assets_org_store_category").on(table.organizationId, table.storeId, table.categoryKey),
  index("idx_ops_assets_org_status").on(table.organizationId, table.status),
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
  check("chk_ops_assets_status", sql`${table.status} IN ('operational', 'watch', 'out_of_service', 'retired')`),
  check("chk_ops_assets_life", sql`${table.expectedLifeYears} IS NULL OR ${table.expectedLifeYears} > 0`),
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
  closedAt: instant("closed_at"),
}, (table): PgTableExtraConfigValue[] => [
  unique("uq_ops_work_orders_org_id").on(table.organizationId, table.id),
  uniqueIndex("uidx_ops_work_orders_org_number").on(table.organizationId, table.number),
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
  check("chk_ops_work_orders_status", sql`${table.status} IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'closed', 'cancelled')`),
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
  check("chk_ops_assignments_status", sql`${table.status} IN ('pending', 'issued', 'accepted', 'declined', 'completed', 'cancelled', 'superseded')`),
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
  check("chk_ops_visits_work_or_reason", sql`${table.workOrderId} IS NOT NULL OR nullif(btrim(${table.unmatchedReason}), '') IS NOT NULL`),
  check("chk_ops_visits_status", sql`${table.status} IN ('active', 'checked_out', 'amended')`),
  check("chk_ops_visits_started_channel", sql`${table.startedChannel} IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')`),
  check("chk_ops_visits_ended_channel", sql`${table.endedChannel} IS NULL OR ${table.endedChannel} IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')`),
  check("chk_ops_visits_outcome", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('resolved', 'temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'no_issue_found', 'inspection_complete', 'pm_complete', 'other')`),
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
  check("chk_ops_entity_files_type", sql`${table.entityType} IN ('request', 'work_order', 'visit', 'asset', 'invoice_reference')`),
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

export const opsPmPlans = pgTable("ops_pm_plans", {
  id: id(),
  organizationId: organizationId(),
  name: text("name").notNull(),
  storeId: text("store_id"),
  assetId: text("asset_id"),
  categoryKey: text("category_key"),
  cadenceDays: integer("cadence_days").notNull(),
  completionWindowDays: integer("completion_window_days").notNull(),
  active: boolean("active").notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  unique("uq_ops_pm_plans_org_id").on(table.organizationId, table.id),
  index("idx_ops_pm_plans_org_active_store").on(table.organizationId, table.active, table.storeId),
  index("idx_ops_pm_plans_org_asset").on(table.organizationId, table.assetId),
  foreignKey({
    name: "fk_ops_pm_plans_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_pm_plans_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_pm_plans_asset",
    columns: [table.organizationId, table.assetId],
    foreignColumns: [opsAssets.organizationId, opsAssets.id],
  }),
  check("chk_ops_pm_plans_cadence", sql`${table.cadenceDays} > 0`),
  check("chk_ops_pm_plans_window", sql`${table.completionWindowDays} >= 0`),
  check("chk_ops_pm_plans_target", sql`${table.storeId} IS NOT NULL OR ${table.assetId} IS NOT NULL OR nullif(btrim(${table.categoryKey}), '') IS NOT NULL`),
]);

export const opsPmOccurrences = pgTable("ops_pm_occurrences", {
  id: id(),
  organizationId: organizationId(),
  planId: text("plan_id").notNull(),
  storeId: text("store_id").notNull(),
  assetId: text("asset_id"),
  workOrderId: text("work_order_id"),
  dueAt: instant("due_at").notNull(),
  windowStartsAt: instant("window_starts_at").notNull(),
  windowEndsAt: instant("window_ends_at").notNull(),
  status: text("status").notNull(),
  completedAt: instant("completed_at"),
}, (table) => [
  unique("uq_ops_pm_occurrences_org_id").on(table.organizationId, table.id),
  index("idx_ops_pm_occurrences_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_ops_pm_occurrences_org_store_due").on(table.organizationId, table.storeId, table.dueAt),
  index("idx_ops_pm_occurrences_org_asset_due").on(table.organizationId, table.assetId, table.dueAt),
  foreignKey({
    name: "fk_ops_pm_occurrences_org",
    columns: [table.organizationId],
    foreignColumns: [opsOrganizations.id],
  }),
  foreignKey({
    name: "fk_ops_pm_occurrences_plan",
    columns: [table.organizationId, table.planId],
    foreignColumns: [opsPmPlans.organizationId, opsPmPlans.id],
  }),
  foreignKey({
    name: "fk_ops_pm_occurrences_store",
    columns: [table.organizationId, table.storeId],
    foreignColumns: [opsStores.organizationId, opsStores.id],
  }),
  foreignKey({
    name: "fk_ops_pm_occurrences_asset",
    columns: [table.organizationId, table.assetId],
    foreignColumns: [opsAssets.organizationId, opsAssets.id],
  }),
  foreignKey({
    name: "fk_ops_pm_occurrences_work",
    columns: [table.organizationId, table.workOrderId],
    foreignColumns: [opsWorkOrders.organizationId, opsWorkOrders.id],
  }),
  check("chk_ops_pm_occurrences_status", sql`${table.status} IN ('due', 'scheduled', 'completed', 'missed', 'waived')`),
  check("chk_ops_pm_occurrences_window", sql`${table.windowStartsAt} <= ${table.dueAt} AND ${table.dueAt} <= ${table.windowEndsAt}`),
  check("chk_ops_pm_occurrences_completion", sql`${table.status} <> 'completed' OR ${table.completedAt} IS NOT NULL`),
]);

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
  opsStores,
  opsUsers,
  opsMemberships,
  opsScopeGrants,
  opsVendors,
  opsVendorSpecialties,
  opsVendorCoverage,
  opsRequests,
  opsWorkOrders,
  opsWorkOrderAssignments,
  opsWorkOrderIssuances,
  opsVendorResponses,
  opsVisitSessions,
  opsVisitEvidence,
  opsFiles,
  opsEntityFiles,
  opsFollowUps,
  opsExceptions,
  opsAssets,
  opsAssetComponents,
  opsPmPlans,
  opsPmOccurrences,
  opsCostLines,
  opsInvoiceReferences,
  opsInvoiceAllocations,
  opsAuditEvents,
  opsOutboxMessages,
  opsPublicTokens,
  opsIdempotencyKeys,
  opsWorkOrderCounters,
} as const;
