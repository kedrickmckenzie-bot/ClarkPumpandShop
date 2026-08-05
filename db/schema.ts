import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const tenantId = () => text("organization_id").notNull();
const id = () => text("id").primaryKey();
const timestamp = (name: string) => text(name).notNull();

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  workOrderPrefix: text("work_order_prefix").notNull(),
  timeZone: text("time_zone").notNull().default("America/New_York"),
  reviewPolicy: text("review_policy").notNull().default("required_store_manager"),
  settingsJson: text("settings_json").notNull().default("{}"),
  createdAt: timestamp("created_at"),
});

export const people = sqliteTable("people", {
  id: id(), organizationId: tenantId(), name: text("name").notNull(), email: text("email"), kind: text("kind").notNull(), createdAt: timestamp("created_at"),
}, (table) => [index("idx_people_org_email").on(table.organizationId, table.email)]);

export const memberships = sqliteTable("memberships", {
  organizationId: tenantId(), personId: text("person_id").notNull(), status: text("status").notNull(), createdAt: timestamp("created_at"),
}, (table) => [primaryKey({ columns: [table.organizationId, table.personId] })]);

export const regions = sqliteTable("regions", {
  id: id(), organizationId: tenantId(), name: text("name").notNull(), createdAt: timestamp("created_at"),
}, (table) => [index("idx_regions_org").on(table.organizationId)]);

export const stores = sqliteTable("stores", {
  id: id(), organizationId: tenantId(), regionId: text("region_id"), code: text("code").notNull(), name: text("name").notNull(), city: text("city"), state: text("state"), latitude: integer("latitude_e6"), longitude: integer("longitude_e6"), geofenceRadiusM: integer("geofence_radius_m").notNull().default(200), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_stores_org_code").on(table.organizationId, table.code), index("idx_stores_org_region").on(table.organizationId, table.regionId)]);

export const storeAreas = sqliteTable("store_areas", {
  id: id(), organizationId: tenantId(), storeId: text("store_id").notNull(), name: text("name").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_store_areas_org_store").on(table.organizationId, table.storeId)]);

export const roleAssignments = sqliteTable("role_assignments", {
  id: id(), organizationId: tenantId(), personId: text("person_id").notNull(), role: text("role").notNull(), regionId: text("region_id"), storeId: text("store_id"), vendorId: text("vendor_id"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_roles_org_person").on(table.organizationId, table.personId), index("idx_roles_scope").on(table.organizationId, table.role, table.regionId, table.storeId)]);

export const vendors = sqliteTable("vendors", {
  id: id(), organizationId: tenantId(), name: text("name").notNull(), trade: text("trade").notNull(), dispatchEmail: text("dispatch_email").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"),
}, (table) => [index("idx_vendors_org_active").on(table.organizationId, table.active)]);

export const vendorContacts = sqliteTable("vendor_contacts", {
  id: id(), organizationId: tenantId(), vendorId: text("vendor_id").notNull(), name: text("name").notNull(), email: text("email").notNull(), phone: text("phone"), role: text("role"),
}, (table) => [index("idx_vendor_contacts_org_vendor").on(table.organizationId, table.vendorId)]);

export const serviceCategories = sqliteTable("service_categories", {
  id: id(), organizationId: tenantId(), name: text("name").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("uidx_categories_org_name").on(table.organizationId, table.name)]);

export const systemTypes = sqliteTable("system_types", {
  id: id(), organizationId: tenantId(), serviceCategoryId: text("service_category_id").notNull(), name: text("name").notNull(),
}, (table) => [index("idx_system_types_org_category").on(table.organizationId, table.serviceCategoryId)]);

export const storeSystems = sqliteTable("store_systems", {
  id: id(), organizationId: tenantId(), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), systemTypeId: text("system_type_id"), name: text("name").notNull(), state: text("state").notNull().default("normal"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_store_systems_org_store_category").on(table.organizationId, table.storeId, table.serviceCategoryId)]);

export const assetClasses = sqliteTable("asset_classes", {
  id: id(), organizationId: tenantId(), serviceCategoryId: text("service_category_id").notNull(), name: text("name").notNull(), expectedLifeYears: integer("expected_life_years"),
}, (table) => [index("idx_asset_classes_org_category").on(table.organizationId, table.serviceCategoryId)]);

export const assets = sqliteTable("assets", {
  id: id(), organizationId: tenantId(), storeSystemId: text("store_system_id").notNull(), assetClassId: text("asset_class_id").notNull(), name: text("name").notNull(), manufacturer: text("manufacturer"), model: text("model"), serial: text("serial"), installedAt: text("installed_at"), expectedLifeYears: integer("expected_life_years"), replacementCostCents: integer("replacement_cost_cents"), warrantyEndsAt: text("warranty_ends_at"), criticality: text("criticality").notNull().default("standard"), state: text("state").notNull().default("operational"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_assets_org_system").on(table.organizationId, table.storeSystemId), index("idx_assets_org_class").on(table.organizationId, table.assetClassId)]);

export const componentTypes = sqliteTable("component_types", {
  id: id(), organizationId: tenantId(), serviceCategoryId: text("service_category_id").notNull(), name: text("name").notNull(),
}, (table) => [index("idx_component_types_org_category").on(table.organizationId, table.serviceCategoryId)]);

export const components = sqliteTable("components", {
  id: id(), organizationId: tenantId(), assetId: text("asset_id").notNull(), componentTypeId: text("component_type_id").notNull(), name: text("name").notNull(), partNumber: text("part_number"), installedAt: text("installed_at"), warrantyEndsAt: text("warranty_ends_at"), vendorId: text("vendor_id"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_components_org_asset").on(table.organizationId, table.assetId)]);

export const employeeReports = sqliteTable("employee_reports", {
  id: id(), organizationId: tenantId(), reference: text("reference").notNull(), storeId: text("store_id").notNull(), storeAreaId: text("store_area_id"), reporterId: text("reporter_id"), reporterName: text("reporter_name").notNull(), originalDescription: text("original_description").notNull(), urgency: text("urgency").notNull(), status: text("status").notNull(), submittedAt: timestamp("submitted_at"),
}, (table) => [uniqueIndex("uidx_reports_org_reference").on(table.organizationId, table.reference), index("idx_reports_org_store_status").on(table.organizationId, table.storeId, table.status, table.submittedAt)]);

export const reportReviews = sqliteTable("report_reviews", {
  id: id(), organizationId: tenantId(), reportId: text("report_id").notNull(), reviewerId: text("reviewer_id"), reviewerName: text("reviewer_name").notNull(), decision: text("decision").notNull(), context: text("context").notNull(), createdAt: timestamp("created_at"),
}, (table) => [index("idx_report_reviews_org_report").on(table.organizationId, table.reportId, table.createdAt)]);

export const workOrders = sqliteTable("work_orders", {
  id: id(), organizationId: tenantId(), number: text("number").notNull(), title: text("title").notNull(), description: text("description").notNull(), origin: text("origin").notNull(), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), storeSystemId: text("store_system_id"), assetId: text("asset_id"), componentId: text("component_id"), priority: text("priority").notNull(), workType: text("work_type").notNull(), status: text("status").notNull(), accountableParty: text("accountable_party").notNull(), nextAction: text("next_action").notNull(), dueAt: text("due_at"), escalation: text("escalation").notNull(), vendorId: text("vendor_id"), vendorAcceptance: text("vendor_acceptance").notNull(), requestedServiceAt: text("requested_service_at"), nteCents: integer("nte_cents").notNull().default(0), costExposureCents: integer("cost_exposure_cents").notNull().default(0), createdAt: timestamp("created_at"), closedAt: text("closed_at"),
}, (table) => [uniqueIndex("uidx_work_orders_org_number").on(table.organizationId, table.number), index("idx_wo_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_wo_org_store_category_created").on(table.organizationId, table.storeId, table.serviceCategoryId, table.createdAt), index("idx_wo_org_vendor_acceptance").on(table.organizationId, table.vendorId, table.vendorAcceptance)]);

export const workOrderReports = sqliteTable("work_order_reports", {
  organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), reportId: text("report_id").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.workOrderId, table.reportId] })]);

export const workOrderClassificationEvents = sqliteTable("work_order_classification_events", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), priorSystemId: text("prior_system_id"), priorAssetId: text("prior_asset_id"), priorComponentId: text("prior_component_id"), newSystemId: text("new_system_id"), newAssetId: text("new_asset_id"), newComponentId: text("new_component_id"), actorId: text("actor_id"), reason: text("reason").notNull(), occurredAt: timestamp("occurred_at"),
}, (table) => [index("idx_classification_events_org_wo").on(table.organizationId, table.workOrderId, table.occurredAt)]);

export const vendorResponses = sqliteTable("vendor_responses", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), response: text("response").notNull(), responder: text("responder").notNull(), tokenId: text("token_id"), issuedAt: timestamp("issued_at"), respondedAt: timestamp("responded_at"),
}, (table) => [index("idx_vendor_responses_org_wo").on(table.organizationId, table.workOrderId, table.respondedAt)]);

export const serviceVisits = sqliteTable("service_visits", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), technicianEnteredName: text("technician_entered_name").notNull(), sessionHash: text("session_hash").notNull(), checkedInAt: timestamp("checked_in_at"), checkedOutAt: text("checked_out_at"), checkInState: text("check_in_state").notNull(), checkInLatitudeE6: integer("check_in_latitude_e6"), checkInLongitudeE6: integer("check_in_longitude_e6"), checkInAccuracyM: integer("check_in_accuracy_m"), checkInDistanceM: integer("check_in_distance_m"), checkOutState: text("check_out_state"), checkOutLatitudeE6: integer("check_out_latitude_e6"), checkOutLongitudeE6: integer("check_out_longitude_e6"), checkOutAccuracyM: integer("check_out_accuracy_m"), checkOutDistanceM: integer("check_out_distance_m"), outcome: text("outcome"), simulated: integer("simulated", { mode: "boolean" }).notNull().default(false),
}, (table) => [index("idx_visits_org_wo").on(table.organizationId, table.workOrderId, table.checkedInAt), index("idx_visits_org_session").on(table.organizationId, table.sessionHash, table.checkedOutAt)]);

export const followUps = sqliteTable("follow_ups", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), sourceVisitId: text("source_visit_id"), accountableParty: text("accountable_party").notNull(), nextAction: text("next_action").notNull(), dueAt: timestamp("due_at"), escalation: text("escalation").notNull(), status: text("status").notNull(), createdAt: timestamp("created_at"), completedAt: text("completed_at"),
}, (table) => [index("idx_followups_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_followups_org_wo").on(table.organizationId, table.workOrderId)]);

export const pmPlans = sqliteTable("pm_plans", {
  id: id(), organizationId: tenantId(), name: text("name").notNull(), description: text("description"), serviceCategoryId: text("service_category_id").notNull(), scopeType: text("scope_type").notNull(), frequency: text("frequency").notNull(), startAt: timestamp("start_at"), earlyWindowDays: integer("early_window_days").notNull(), lateWindowDays: integer("late_window_days").notNull(), vendorId: text("vendor_id"), requiredDocument: text("required_document"), authorizationPolicy: text("authorization_policy"), escalationRule: text("escalation_rule"), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_pm_plans_org_category_active").on(table.organizationId, table.serviceCategoryId, table.active)]);

export const pmPlanTargets = sqliteTable("pm_plan_targets", {
  organizationId: tenantId(), pmPlanId: text("pm_plan_id").notNull(), targetType: text("target_type").notNull(), targetId: text("target_id").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.pmPlanId, table.targetType, table.targetId] })]);

export const pmOccurrences = sqliteTable("pm_occurrences", {
  id: id(), organizationId: tenantId(), pmPlanId: text("pm_plan_id").notNull(), targetType: text("target_type").notNull(), targetId: text("target_id").notNull(), storeId: text("store_id").notNull(), workOrderId: text("work_order_id"), dueAt: timestamp("due_at"), windowStart: timestamp("window_start"), windowEnd: timestamp("window_end"), status: text("status").notNull(), completedAt: text("completed_at"), verified: integer("verified", { mode: "boolean" }).notNull().default(false), waiverReason: text("waiver_reason"), waiverApproverId: text("waiver_approver_id"), waiverAt: text("waiver_at"),
}, (table) => [uniqueIndex("uidx_pm_occurrence_target_due").on(table.organizationId, table.pmPlanId, table.targetType, table.targetId, table.dueAt), index("idx_pm_occurrences_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_pm_occurrences_org_store_due").on(table.organizationId, table.storeId, table.dueAt)]);

export const quotes = sqliteTable("quotes", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), number: text("number").notNull(), amountCents: integer("amount_cents").notNull(), status: text("status").notNull(), submittedAt: timestamp("submitted_at"),
}, (table) => [index("idx_quotes_org_wo_status").on(table.organizationId, table.workOrderId, table.status)]);

export const authorizations = sqliteTable("authorizations", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), quoteId: text("quote_id"), type: text("type").notNull(), amountCents: integer("amount_cents").notNull(), status: text("status").notNull(), approvedAt: timestamp("approved_at"), approverId: text("approver_id"),
}, (table) => [index("idx_authorizations_org_wo_status").on(table.organizationId, table.workOrderId, table.status)]);

export const invoices = sqliteTable("invoices", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), vendorId: text("vendor_id").notNull(), number: text("number").notNull(), totalCents: integer("total_cents").notNull(), status: text("status").notNull(), issuedAt: timestamp("issued_at"), paidAt: text("paid_at"),
}, (table) => [uniqueIndex("uidx_invoices_org_vendor_number").on(table.organizationId, table.vendorId, table.number), index("idx_invoices_org_status_issued").on(table.organizationId, table.status, table.issuedAt)]);

export const credits = sqliteTable("credits", {
  id: id(), organizationId: tenantId(), invoiceId: text("invoice_id").notNull(), amountCents: integer("amount_cents").notNull(), status: text("status").notNull(), issuedAt: timestamp("issued_at"),
}, (table) => [index("idx_credits_org_invoice_status").on(table.organizationId, table.invoiceId, table.status)]);

export const costAllocations = sqliteTable("cost_allocations", {
  id: id(), organizationId: tenantId(), financialType: text("financial_type").notNull(), financialId: text("financial_id").notNull(), workOrderId: text("work_order_id").notNull(), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), storeSystemId: text("store_system_id"), assetId: text("asset_id"), componentId: text("component_id"), amountCents: integer("amount_cents").notNull(), workClass: text("work_class").notNull(), costCategory: text("cost_category").notNull(), createdAt: timestamp("created_at"),
}, (table) => [index("idx_alloc_org_financial").on(table.organizationId, table.financialType, table.financialId), index("idx_alloc_org_store_category").on(table.organizationId, table.storeId, table.serviceCategoryId), index("idx_alloc_org_system").on(table.organizationId, table.storeSystemId), index("idx_alloc_org_asset").on(table.organizationId, table.assetId), index("idx_alloc_org_component").on(table.organizationId, table.componentId)]);

export const documents = sqliteTable("documents", {
  id: id(), organizationId: tenantId(), objectKey: text("object_key").notNull(), name: text("name").notNull(), classification: text("classification").notNull(), mimeType: text("mime_type").notNull(), bytes: integer("bytes").notNull(), uploadedById: text("uploaded_by_id"), uploadedByName: text("uploaded_by_name").notNull(), uploadedAt: timestamp("uploaded_at"), visibility: text("visibility").notNull(),
}, (table) => [uniqueIndex("uidx_documents_org_object_key").on(table.organizationId, table.objectKey), index("idx_documents_org_class_uploaded").on(table.organizationId, table.classification, table.uploadedAt)]);

export const documentLinks = sqliteTable("document_links", {
  organizationId: tenantId(), documentId: text("document_id").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
}, (table) => [primaryKey({ columns: [table.organizationId, table.documentId, table.entityType, table.entityId] }), index("idx_document_links_org_entity").on(table.organizationId, table.entityType, table.entityId)]);

export const communications = sqliteTable("communications", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id"), channel: text("channel").notNull(), direction: text("direction").notNull(), visibility: text("visibility").notNull(), subject: text("subject"), body: text("body").notNull(), deliveryState: text("delivery_state"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_communications_org_wo_created").on(table.organizationId, table.workOrderId, table.createdAt)]);

export const outboxMessages = sqliteTable("outbox_messages", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id"), recipient: text("recipient").notNull(), subject: text("subject").notNull(), textBody: text("text_body").notNull(), htmlBody: text("html_body").notNull(), deliveryState: text("delivery_state").notNull(), providerMessageId: text("provider_message_id"), createdAt: timestamp("created_at"), deliveredAt: text("delivered_at"),
}, (table) => [index("idx_outbox_org_state_created").on(table.organizationId, table.deliveryState, table.createdAt)]);

export const publicTokens = sqliteTable("public_tokens", {
  id: id(), organizationId: tenantId(), purpose: text("purpose").notNull(), tokenHash: text("token_hash").notNull(), recordType: text("record_type").notNull(), recordId: text("record_id").notNull(), expiresAt: text("expires_at"), usedAt: text("used_at"), revokedAt: text("revoked_at"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_public_tokens_hash").on(table.tokenHash), index("idx_public_tokens_org_record").on(table.organizationId, table.recordType, table.recordId)]);

export const auditEvents = sqliteTable("audit_events", {
  id: id(), organizationId: tenantId(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), eventType: text("event_type").notNull(), actorType: text("actor_type").notNull(), actorId: text("actor_id"), actorName: text("actor_name").notNull(), occurredAt: timestamp("occurred_at"), visibility: text("visibility").notNull(), detailsJson: text("details_json").notNull().default("{}"),
}, (table) => [index("idx_audit_org_entity_occurred").on(table.organizationId, table.entityType, table.entityId, table.occurredAt), index("idx_audit_org_event_occurred").on(table.organizationId, table.eventType, table.occurredAt)]);
