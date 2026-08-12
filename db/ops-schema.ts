import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const opsStores = sqliteTable("ops_stores", {
  id: id(), organizationId: organizationId(), divisionId: text("division_id"), regionId: text("region_id"), storeNumber: text("store_number").notNull(), name: text("name").notNull(),
  address1: text("address_1").notNull(), address2: text("address_2"), city: text("city").notNull(), state: text("state").notNull(), postalCode: text("postal_code").notNull(),
  aliasesJson: text("aliases_json").notNull().default("[]"), searchText: text("search_text").notNull(), latitudeE6: integer("latitude_e6"), longitudeE6: integer("longitude_e6"),
  geofenceRadiusM: integer("geofence_radius_m").notNull().default(200), locationPolicyEnabled: bool("location_policy_enabled"), timeZone: text("time_zone"), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uidx_ops_stores_org_number").on(table.organizationId, table.storeNumber),
  index("idx_ops_stores_org_region_number").on(table.organizationId, table.regionId, table.storeNumber),
  index("idx_ops_stores_org_status_number").on(table.organizationId, table.status, table.storeNumber),
]);

export const opsUsers = sqliteTable("ops_users", {
  id: id(), email: text("email").notNull(), displayName: text("display_name").notNull(), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_users_email").on(table.email)]);

export const opsMemberships = sqliteTable("ops_memberships", {
  id: id(), organizationId: organizationId(), userId: text("user_id").notNull(), role: text("role").notNull(), status: text("status").notNull().default("active"), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_memberships_org_user_role").on(table.organizationId, table.userId, table.role), index("idx_ops_memberships_org_status").on(table.organizationId, table.status)]);

export const opsScopeGrants = sqliteTable("ops_scope_grants", {
  id: id(), organizationId: organizationId(), membershipId: text("membership_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), permission: text("permission").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_scopes_org_member_scope_perm").on(table.organizationId, table.membershipId, table.scopeKind, table.scopeId, table.permission), index("idx_ops_scopes_org_kind_id").on(table.organizationId, table.scopeKind, table.scopeId)]);

export const opsVendors = sqliteTable("ops_vendors", {
  id: id(), organizationId: organizationId(), code: text("code").notNull(), name: text("name").notNull(), dispatchEmail: text("dispatch_email").notNull(), dispatchPhone: text("dispatch_phone"), status: text("status").notNull().default("approved"), preferred: bool("preferred"), searchText: text("search_text").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_vendors_org_code").on(table.organizationId, table.code), index("idx_ops_vendors_org_status_name").on(table.organizationId, table.status, table.name)]);

export const opsVendorSpecialties = sqliteTable("ops_vendor_specialties", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), canonicalKey: text("canonical_key").notNull(), displayName: text("display_name").notNull(), searchAliasesJson: text("search_aliases_json").notNull().default("[]"),
}, (table) => [uniqueIndex("uidx_ops_vendor_specialties_org_vendor_key").on(table.organizationId, table.vendorId, table.canonicalKey), index("idx_ops_vendor_specialties_org_key").on(table.organizationId, table.canonicalKey)]);

export const opsVendorCoverage = sqliteTable("ops_vendor_coverage", {
  id: id(), organizationId: organizationId(), vendorId: text("vendor_id").notNull(), scopeKind: text("scope_kind").notNull(), scopeId: text("scope_id").notNull(), preferredRank: integer("preferred_rank"),
}, (table) => [uniqueIndex("uidx_ops_vendor_coverage_org_vendor_scope").on(table.organizationId, table.vendorId, table.scopeKind, table.scopeId), index("idx_ops_vendor_coverage_org_scope").on(table.organizationId, table.scopeKind, table.scopeId)]);

export const opsRequests = sqliteTable("ops_requests", {
  id: id(), organizationId: organizationId(), reference: text("reference").notNull(), storeId: text("store_id").notNull(), reporterName: text("reporter_name").notNull(), reporterEmployeeId: text("reporter_employee_id"), problem: text("problem").notNull(), priority: text("priority").notNull(), status: text("status").notNull(), submittedAt: text("submitted_at").notNull(), convertedWorkOrderId: text("converted_work_order_id"),
}, (table) => [uniqueIndex("uidx_ops_requests_org_reference").on(table.organizationId, table.reference), index("idx_ops_requests_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.submittedAt)]);

export const opsWorkOrders = sqliteTable("ops_work_orders", {
  id: id(), organizationId: organizationId(), number: text("number").notNull(), storeId: text("store_id").notNull(), requestId: text("request_id"), problem: text("problem").notNull(), authorizedScope: text("authorized_scope"), categoryKey: text("category_key"), taxonomyNodeId: text("taxonomy_node_id"), assetId: text("asset_id"), componentId: text("component_id"),
  priority: text("priority").notNull(), status: text("status").notNull(), accountableParty: text("accountable_party").notNull(), nextAction: text("next_action").notNull(), dueAt: text("due_at"), escalationTo: text("escalation_to"),
  nteAmountMinor: integer("nte_amount_minor"), nteCurrency: text("nte_currency"), vendorServiceTicketNumber: text("vendor_service_ticket_number"), vendorInvoiceNumber: text("vendor_invoice_number"), externalAccountingPo: text("external_accounting_po"), createdAt: createdAt(), closedAt: text("closed_at"),
}, (table) => [
  uniqueIndex("uidx_ops_work_orders_org_number").on(table.organizationId, table.number),
  index("idx_ops_work_orders_org_status_due").on(table.organizationId, table.status, table.dueAt),
  index("idx_ops_work_orders_org_store_created").on(table.organizationId, table.storeId, table.createdAt),
  index("idx_ops_work_orders_org_category_created").on(table.organizationId, table.categoryKey, table.createdAt),
]);

export const opsWorkOrderAssignments = sqliteTable("ops_work_order_assignments", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), kind: text("kind").notNull(), vendorId: text("vendor_id"), internalMembershipId: text("internal_membership_id"), status: text("status").notNull(), assignedAt: text("assigned_at").notNull(), supersedesAssignmentId: text("supersedes_assignment_id"),
}, (table) => [index("idx_ops_assignments_org_work_status").on(table.organizationId, table.workOrderId, table.status), index("idx_ops_assignments_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsWorkOrderIssuances = sqliteTable("ops_work_order_issuances", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), assignmentId: text("assignment_id").notNull(), revision: integer("revision").notNull(), immutablePayloadJson: text("immutable_payload_json").notNull(), channel: text("channel").notNull(), issuedAt: text("issued_at").notNull(),
}, (table) => [uniqueIndex("uidx_ops_issuances_org_work_revision").on(table.organizationId, table.workOrderId, table.revision), index("idx_ops_issuances_org_assignment").on(table.organizationId, table.assignmentId, table.issuedAt)]);

export const opsVendorResponses = sqliteTable("ops_vendor_responses", {
  id: id(), organizationId: organizationId(), workOrderId: text("work_order_id").notNull(), assignmentId: text("assignment_id").notNull(), issuanceId: text("issuance_id").notNull(), response: text("response").notNull(), responderName: text("responder_name").notNull(), proposedAt: text("proposed_at"), message: text("message"), respondedAt: text("responded_at").notNull(),
}, (table) => [index("idx_ops_vendor_responses_org_assignment_time").on(table.organizationId, table.assignmentId, table.respondedAt), index("idx_ops_vendor_responses_org_work_time").on(table.organizationId, table.workOrderId, table.respondedAt)]);

export const opsVisitSessions = sqliteTable("ops_visit_sessions", {
  id: id(), organizationId: organizationId(), storeId: text("store_id").notNull(), providerKind: text("provider_kind").notNull(), vendorId: text("vendor_id"), internalMembershipId: text("internal_membership_id"), workOrderId: text("work_order_id"), unmatchedReason: text("unmatched_reason"), technicianName: text("technician_name").notNull(), providerName: text("provider_name").notNull(), purpose: text("purpose").notNull(), status: text("status").notNull(), startedChannel: text("started_channel").notNull(), endedChannel: text("ended_channel"), checkedInAt: text("checked_in_at").notNull(), checkedOutAt: text("checked_out_at"), outcome: text("outcome"), outcomeNotes: text("outcome_notes"), observedDurationSeconds: integer("observed_duration_seconds"),
}, (table) => [index("idx_ops_visits_org_store_status_time").on(table.organizationId, table.storeId, table.status, table.checkedInAt), index("idx_ops_visits_org_vendor_status_time").on(table.organizationId, table.vendorId, table.status, table.checkedInAt), index("idx_ops_visits_org_work_time").on(table.organizationId, table.workOrderId, table.checkedInAt)]);

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
}, (table) => [index("idx_ops_followups_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_ops_followups_org_work").on(table.organizationId, table.workOrderId, table.createdAt)]);

export const opsExceptions = sqliteTable("ops_exceptions", {
  id: id(), organizationId: organizationId(), kind: text("kind").notNull(), storeId: text("store_id"), workOrderId: text("work_order_id"), visitId: text("visit_id"), vendorId: text("vendor_id"), severity: text("severity").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), detectedAt: text("detected_at").notNull(), resolvedAt: text("resolved_at"),
}, (table) => [index("idx_ops_exceptions_org_status_time").on(table.organizationId, table.status, table.detectedAt), index("idx_ops_exceptions_org_store_status").on(table.organizationId, table.storeId, table.status), index("idx_ops_exceptions_org_vendor_status").on(table.organizationId, table.vendorId, table.status)]);

export const opsAssets = sqliteTable("ops_assets", {
  id: id(), organizationId: organizationId(), storeId: text("store_id").notNull(), categoryKey: text("category_key").notNull(), taxonomyNodeId: text("taxonomy_node_id"), groupPathJson: text("group_path_json").notNull().default("[]"), assetTag: text("asset_tag").notNull(), name: text("name").notNull(), manufacturer: text("manufacturer"), model: text("model"), serialNumber: text("serial_number"), supplier: text("supplier"), installedAt: text("installed_at"), expectedLifeYears: integer("expected_life_years"), warrantyEndsAt: text("warranty_ends_at"), replacementEstimateMinor: integer("replacement_estimate_minor"), replacementCurrency: text("replacement_currency"), status: text("status").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uidx_ops_assets_org_store_tag").on(table.organizationId, table.storeId, table.assetTag), index("idx_ops_assets_org_store_category").on(table.organizationId, table.storeId, table.categoryKey), index("idx_ops_assets_org_status").on(table.organizationId, table.status)]);

export const opsAssetComponents = sqliteTable("ops_asset_components", {
  id: id(), organizationId: organizationId(), assetId: text("asset_id").notNull(), parentComponentId: text("parent_component_id"), name: text("name").notNull(), partNumber: text("part_number"), serialNumber: text("serial_number"), installedAt: text("installed_at"), warrantyEndsAt: text("warranty_ends_at"), createdAt: createdAt(),
}, (table) => [index("idx_ops_components_org_asset_parent").on(table.organizationId, table.assetId, table.parentComponentId)]);

export const opsPmPlans = sqliteTable("ops_pm_plans", {
  id: id(), organizationId: organizationId(), name: text("name").notNull(), storeId: text("store_id"), assetId: text("asset_id"), categoryKey: text("category_key"), cadenceDays: integer("cadence_days").notNull(), completionWindowDays: integer("completion_window_days").notNull(), active: bool("active"), createdAt: createdAt(),
}, (table) => [index("idx_ops_pm_plans_org_active_store").on(table.organizationId, table.active, table.storeId), index("idx_ops_pm_plans_org_asset").on(table.organizationId, table.assetId)]);

export const opsPmOccurrences = sqliteTable("ops_pm_occurrences", {
  id: id(), organizationId: organizationId(), planId: text("plan_id").notNull(), storeId: text("store_id").notNull(), assetId: text("asset_id"), workOrderId: text("work_order_id"), dueAt: text("due_at").notNull(), windowStartsAt: text("window_starts_at").notNull(), windowEndsAt: text("window_ends_at").notNull(), status: text("status").notNull(), completedAt: text("completed_at"),
}, (table) => [index("idx_ops_pm_occurrences_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_ops_pm_occurrences_org_store_due").on(table.organizationId, table.storeId, table.dueAt), index("idx_ops_pm_occurrences_org_asset_due").on(table.organizationId, table.assetId, table.dueAt)]);

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
  id: id(), organizationId: organizationId(), topic: text("topic").notNull(), aggregateType: text("aggregate_type").notNull(), aggregateId: text("aggregate_id").notNull(), payloadJson: text("payload_json").notNull(), status: text("status").notNull().default("pending"), availableAt: text("available_at").notNull(), createdAt: createdAt(), attemptCount: integer("attempt_count").notNull().default(0), deliveredAt: text("delivered_at"), lastError: text("last_error"),
}, (table) => [index("idx_ops_outbox_org_status_available").on(table.organizationId, table.status, table.availableAt)]);

export const opsPublicTokens = sqliteTable("ops_public_tokens", {
  id: id(), organizationId: organizationId(), purpose: text("purpose").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), createdAt: createdAt(), usedAt: text("used_at"), revokedAt: text("revoked_at"),
}, (table) => [uniqueIndex("uidx_ops_public_tokens_hash").on(table.tokenHash), index("idx_ops_public_tokens_org_subject").on(table.organizationId, table.subjectType, table.subjectId), index("idx_ops_public_tokens_org_purpose_expiry").on(table.organizationId, table.purpose, table.expiresAt)]);

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
