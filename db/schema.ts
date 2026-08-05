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
  id: id(), organizationId: tenantId(), regionId: text("region_id"), code: text("code").notNull(), name: text("name").notNull(), address1: text("address_1"), address2: text("address_2"), city: text("city"), state: text("state"), postalCode: text("postal_code"), phone: text("phone"), managerName: text("manager_name"), district: text("district"), status: text("status").notNull().default("active"), openedAt: text("opened_at"), squareFeet: integer("square_feet"), latitude: integer("latitude_e6"), longitude: integer("longitude_e6"), geofenceRadiusM: integer("geofence_radius_m").notNull().default(200), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_stores_org_code").on(table.organizationId, table.code), index("idx_stores_org_region").on(table.organizationId, table.regionId), index("idx_stores_org_address").on(table.organizationId, table.city, table.postalCode)]);

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
  id: id(), organizationId: tenantId(), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), systemTypeId: text("system_type_id"), code: text("code"), name: text("name").notNull(), description: text("description"), location: text("location"), glCode: text("gl_code"), annualBudgetCents: integer("annual_budget_cents"), ownerName: text("owner_name"), maintenanceStrategy: text("maintenance_strategy"), state: text("state").notNull().default("normal"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_store_systems_org_store_category").on(table.organizationId, table.storeId, table.serviceCategoryId)]);

export const assetClasses = sqliteTable("asset_classes", {
  id: id(), organizationId: tenantId(), serviceCategoryId: text("service_category_id").notNull(), name: text("name").notNull(), expectedLifeYears: integer("expected_life_years"),
}, (table) => [index("idx_asset_classes_org_category").on(table.organizationId, table.serviceCategoryId)]);

export const assets = sqliteTable("assets", {
  id: id(), organizationId: tenantId(), storeSystemId: text("store_system_id").notNull(), assetClassId: text("asset_class_id").notNull(), assetTag: text("asset_tag"), name: text("name").notNull(), manufacturer: text("manufacturer"), model: text("model"), serial: text("serial"), location: text("location"), condition: text("condition"), purchaseCostCents: integer("purchase_cost_cents"), purchaseDate: text("purchase_date"), supplierName: text("supplier_name"), supplierContact: text("supplier_contact"), installedAt: text("installed_at"), lastServiceAt: text("last_service_at"), maintenanceStrategy: text("maintenance_strategy"), meterType: text("meter_type"), meterReading: integer("meter_reading"), expectedLifeYears: integer("expected_life_years"), replacementCostCents: integer("replacement_cost_cents"), warrantyProvider: text("warranty_provider"), warrantyReference: text("warranty_reference"), warrantySummary: text("warranty_summary"), warrantyEndsAt: text("warranty_ends_at"), criticality: text("criticality").notNull().default("standard"), state: text("state").notNull().default("operational"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_assets_org_system").on(table.organizationId, table.storeSystemId), index("idx_assets_org_class").on(table.organizationId, table.assetClassId)]);

export const componentTypes = sqliteTable("component_types", {
  id: id(), organizationId: tenantId(), serviceCategoryId: text("service_category_id").notNull(), name: text("name").notNull(),
}, (table) => [index("idx_component_types_org_category").on(table.organizationId, table.serviceCategoryId)]);

export const components = sqliteTable("components", {
  id: id(), organizationId: tenantId(), assetId: text("asset_id").notNull(), componentTypeId: text("component_type_id").notNull(), name: text("name").notNull(), partNumber: text("part_number"), serial: text("serial"), quantity: integer("quantity").notNull().default(1), unitCostCents: integer("unit_cost_cents").notNull().default(0), criticalSpare: integer("critical_spare", { mode: "boolean" }).notNull().default(false), installedAt: text("installed_at"), warrantyEndsAt: text("warranty_ends_at"), vendorId: text("vendor_id"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_components_org_asset").on(table.organizationId, table.assetId)]);

export const employeeReports = sqliteTable("employee_reports", {
  id: id(), organizationId: tenantId(), reference: text("reference").notNull(), storeId: text("store_id").notNull(), storeAreaId: text("store_area_id"), reporterId: text("reporter_id"), reporterName: text("reporter_name").notNull(), originalDescription: text("original_description").notNull(), urgency: text("urgency").notNull(), status: text("status").notNull(), submittedAt: timestamp("submitted_at"),
}, (table) => [uniqueIndex("uidx_reports_org_reference").on(table.organizationId, table.reference), index("idx_reports_org_store_status").on(table.organizationId, table.storeId, table.status, table.submittedAt)]);

export const reportReviews = sqliteTable("report_reviews", {
  id: id(), organizationId: tenantId(), reportId: text("report_id").notNull(), reviewerId: text("reviewer_id"), reviewerName: text("reviewer_name").notNull(), decision: text("decision").notNull(), context: text("context").notNull(), createdAt: timestamp("created_at"),
}, (table) => [index("idx_report_reviews_org_report").on(table.organizationId, table.reportId, table.createdAt)]);

export const workOrders = sqliteTable("work_orders", {
  id: id(), organizationId: tenantId(), number: text("number").notNull(), title: text("title").notNull(), description: text("description").notNull(), location: text("location"), problemCode: text("problem_code"), failureCode: text("failure_code"), requestedBy: text("requested_by"), origin: text("origin").notNull(), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), storeSystemId: text("store_system_id"), assetId: text("asset_id"), componentId: text("component_id"), priority: text("priority").notNull(), workType: text("work_type").notNull(), status: text("status").notNull(), accountableParty: text("accountable_party").notNull(), assignmentType: text("assignment_type").notNull().default("unassigned"), assignedToId: text("assigned_to_id"), assignedToName: text("assigned_to_name"), nextAction: text("next_action").notNull(), dueAt: text("due_at"), targetResponseAt: text("target_response_at"), targetCompletionAt: text("target_completion_at"), scheduledStartAt: text("scheduled_start_at"), estimatedMinutes: integer("estimated_minutes"), actualMinutes: integer("actual_minutes"), downtimeMinutes: integer("downtime_minutes"), safetyRisk: text("safety_risk"), accessInstructions: text("access_instructions"), resolutionSummary: text("resolution_summary"), escalation: text("escalation").notNull(), vendorId: text("vendor_id"), vendorAcceptance: text("vendor_acceptance").notNull(), requestedServiceAt: text("requested_service_at"), laborCostCents: integer("labor_cost_cents").notNull().default(0), partsCostCents: integer("parts_cost_cents").notNull().default(0), travelCostCents: integer("travel_cost_cents").notNull().default(0), purchaseOrderNumber: text("purchase_order_number"), tagsJson: text("tags_json").notNull().default("[]"), nteCents: integer("nte_cents").notNull().default(0), costExposureCents: integer("cost_exposure_cents").notNull().default(0), createdAt: timestamp("created_at"), closedAt: text("closed_at"),
}, (table) => [uniqueIndex("uidx_work_orders_org_number").on(table.organizationId, table.number), index("idx_wo_org_status_due").on(table.organizationId, table.status, table.dueAt), index("idx_wo_org_store_category_created").on(table.organizationId, table.storeId, table.serviceCategoryId, table.createdAt), index("idx_wo_org_vendor_acceptance").on(table.organizationId, table.vendorId, table.vendorAcceptance)]);

export const workOrderNotes = sqliteTable("work_order_notes", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), authorId: text("author_id"), authorName: text("author_name").notNull(), authorRole: text("author_role"), body: text("body").notNull(), visibility: text("visibility").notNull().default("internal"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_wo_notes_org_work_created").on(table.organizationId, table.workOrderId, table.createdAt)]);

export const workOrderChecklistItems = sqliteTable("work_order_checklist_items", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), sequence: integer("sequence").notNull(), label: text("label").notNull(), required: integer("required", { mode: "boolean" }).notNull().default(true), completed: integer("completed", { mode: "boolean" }).notNull().default(false), completedAt: text("completed_at"), completedById: text("completed_by_id"), completedByName: text("completed_by_name"),
}, (table) => [index("idx_wo_checklist_org_work_sequence").on(table.organizationId, table.workOrderId, table.sequence)]);

export const laborEntries = sqliteTable("labor_entries", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), technicianId: text("technician_id").notNull(), technicianName: text("technician_name").notNull(), startedAt: timestamp("started_at"), endedAt: timestamp("ended_at"), regularMinutes: integer("regular_minutes").notNull().default(0), overtimeMinutes: integer("overtime_minutes").notNull().default(0), hourlyRateCents: integer("hourly_rate_cents").notNull().default(0), notes: text("notes"), createdAt: timestamp("created_at"),
}, (table) => [index("idx_labor_org_work_started").on(table.organizationId, table.workOrderId, table.startedAt), index("idx_labor_org_tech_started").on(table.organizationId, table.technicianId, table.startedAt)]);

export const partsUsed = sqliteTable("parts_used", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), partNumber: text("part_number"), description: text("description").notNull(), quantityMilli: integer("quantity_milli").notNull().default(1000), unitCostCents: integer("unit_cost_cents").notNull().default(0), source: text("source").notNull(), recordedById: text("recorded_by_id"), recordedByName: text("recorded_by_name").notNull(), recordedAt: timestamp("recorded_at"),
}, (table) => [index("idx_parts_used_org_work_recorded").on(table.organizationId, table.workOrderId, table.recordedAt), index("idx_parts_used_org_part").on(table.organizationId, table.partNumber)]);

export const workOrderStatusEvents = sqliteTable("work_order_status_events", {
  id: id(), organizationId: tenantId(), workOrderId: text("work_order_id").notNull(), priorStatus: text("prior_status"), newStatus: text("new_status").notNull(), reason: text("reason"), actorId: text("actor_id"), actorName: text("actor_name").notNull(), occurredAt: timestamp("occurred_at"),
}, (table) => [index("idx_wo_status_events_org_work_occurred").on(table.organizationId, table.workOrderId, table.occurredAt)]);

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
  id: id(), organizationId: tenantId(), financialType: text("financial_type").notNull(), financialId: text("financial_id").notNull(), sourceLineKey: text("source_line_key"), financialStage: text("financial_stage").notNull().default("invoiced"), entryType: text("entry_type").notNull().default("original"), reversesAllocationId: text("reverses_allocation_id"), providerId: text("provider_id"), workOrderId: text("work_order_id").notNull(), regionId: text("region_id"), storeId: text("store_id").notNull(), serviceCategoryId: text("service_category_id").notNull(), storeSystemId: text("store_system_id"), assetId: text("asset_id"), componentId: text("component_id"), glAccountId: text("gl_account_id"), accountingCostCenterId: text("accounting_cost_center_id"), budgetId: text("budget_id"), budgetLineId: text("budget_line_id"), proposalId: text("proposal_id"), purchaseOrderId: text("purchase_order_id"), purchaseOrderLineId: text("purchase_order_line_id"), invoiceId: text("invoice_id"), invoiceLineId: text("invoice_line_id"), creditId: text("credit_id"), paymentRecordId: text("payment_record_id"), accrualId: text("accrual_id"), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("USD"), workClass: text("work_class").notNull(), costCategory: text("cost_category").notNull(), dimensionsJson: text("dimensions_json").notNull().default("{}"), effectiveAt: text("effective_at"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_alloc_org_financial_line").on(table.organizationId, table.financialType, table.financialId, table.sourceLineKey), index("idx_alloc_org_financial").on(table.organizationId, table.financialType, table.financialId), index("idx_alloc_org_stage_effective").on(table.organizationId, table.financialStage, table.effectiveAt), index("idx_alloc_org_provider_stage").on(table.organizationId, table.providerId, table.financialStage), index("idx_alloc_org_accounting_dims").on(table.organizationId, table.accountingCostCenterId, table.glAccountId, table.financialStage), index("idx_alloc_org_budget_stage").on(table.organizationId, table.budgetId, table.budgetLineId, table.financialStage), index("idx_alloc_org_region_store_stage").on(table.organizationId, table.regionId, table.storeId, table.financialStage), index("idx_alloc_org_po_line").on(table.organizationId, table.purchaseOrderId, table.purchaseOrderLineId), index("idx_alloc_org_invoice_line").on(table.organizationId, table.invoiceId, table.invoiceLineId), index("idx_alloc_org_store_category").on(table.organizationId, table.storeId, table.serviceCategoryId), index("idx_alloc_org_system").on(table.organizationId, table.storeSystemId), index("idx_alloc_org_asset").on(table.organizationId, table.assetId), index("idx_alloc_org_component").on(table.organizationId, table.componentId)]);

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

export const canonicalTaxonomyConcepts = sqliteTable("canonical_taxonomy_concepts", {
  id: id(), organizationId: tenantId(), conceptType: text("concept_type").notNull(), canonicalKey: text("canonical_key").notNull(), canonicalName: text("canonical_name").notNull(), parentConceptId: text("parent_concept_id"), description: text("description"), sortOrder: integer("sort_order").notNull().default(0), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"), retiredAt: text("retired_at"),
}, (table) => [uniqueIndex("uidx_taxonomy_concepts_org_type_key").on(table.organizationId, table.conceptType, table.canonicalKey), index("idx_taxonomy_concepts_org_parent").on(table.organizationId, table.conceptType, table.parentConceptId), index("idx_taxonomy_concepts_org_active").on(table.organizationId, table.conceptType, table.active)]);

export const taxonomyConceptAliases = sqliteTable("taxonomy_concept_aliases", {
  id: id(), organizationId: tenantId(), conceptId: text("concept_id").notNull(), conceptType: text("concept_type").notNull(), alias: text("alias").notNull(), normalizedAlias: text("normalized_alias").notNull(), locale: text("locale").notNull().default("en-US"), source: text("source").notNull().default("manual"), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"), retiredAt: text("retired_at"),
}, (table) => [uniqueIndex("uidx_taxonomy_aliases_org_type_alias").on(table.organizationId, table.conceptType, table.normalizedAlias), index("idx_taxonomy_aliases_org_concept").on(table.organizationId, table.conceptId, table.active)]);

export const organizationLabels = sqliteTable("organization_labels", {
  id: id(), organizationId: tenantId(), semanticKey: text("semantic_key").notNull(), singularLabel: text("singular_label").notNull(), pluralLabel: text("plural_label").notNull(), shortLabel: text("short_label"), effectiveFrom: timestamp("effective_from"), effectiveTo: text("effective_to"), createdById: text("created_by_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_org_labels_semantic_effective").on(table.organizationId, table.semanticKey, table.effectiveFrom), index("idx_org_labels_org_current").on(table.organizationId, table.semanticKey, table.effectiveTo)]);

export const serviceProviders = sqliteTable("service_providers", {
  id: id(), organizationId: tenantId(), code: text("code").notNull(), name: text("name").notNull(), providerType: text("provider_type").notNull(), vendorId: text("vendor_id"), personId: text("person_id"), internalTeamKey: text("internal_team_key"), defaultCurrency: text("default_currency").notNull().default("USD"), status: text("status").notNull().default("active"), createdAt: timestamp("created_at"), retiredAt: text("retired_at"),
}, (table) => [uniqueIndex("uidx_service_providers_org_code").on(table.organizationId, table.code), index("idx_service_providers_org_type_status").on(table.organizationId, table.providerType, table.status), index("idx_service_providers_org_vendor").on(table.organizationId, table.vendorId), index("idx_service_providers_org_person").on(table.organizationId, table.personId)]);

export const serviceAssignments = sqliteTable("service_assignments", {
  id: id(), organizationId: tenantId(), assignmentNumber: text("assignment_number").notNull(), workOrderId: text("work_order_id").notNull(), providerId: text("provider_id").notNull(), assignmentRole: text("assignment_role").notNull().default("primary"), fulfillmentMode: text("fulfillment_mode").notNull(), status: text("status").notNull(), requestedStartAt: text("requested_start_at"), requestedEndAt: text("requested_end_at"), assignedAt: timestamp("assigned_at"), acknowledgedAt: text("acknowledged_at"), completedAt: text("completed_at"), cancelledAt: text("cancelled_at"), supersedesAssignmentId: text("supersedes_assignment_id"), createdById: text("created_by_id"), contextJson: text("context_json").notNull().default("{}"),
}, (table) => [uniqueIndex("uidx_service_assignments_org_number").on(table.organizationId, table.assignmentNumber), index("idx_service_assignments_org_work_status").on(table.organizationId, table.workOrderId, table.status), index("idx_service_assignments_org_provider_status").on(table.organizationId, table.providerId, table.status), index("idx_service_assignments_org_status_start").on(table.organizationId, table.status, table.requestedStartAt)]);

export const serviceChannelEvents = sqliteTable("service_channel_events", {
  id: id(), organizationId: tenantId(), eventKey: text("event_key").notNull(), assignmentId: text("assignment_id"), workOrderId: text("work_order_id").notNull(), providerId: text("provider_id"), channel: text("channel").notNull(), eventType: text("event_type").notNull(), actorType: text("actor_type").notNull(), actorId: text("actor_id"), actorName: text("actor_name").notNull(), tokenId: text("token_id"), externalMessageId: text("external_message_id"), occurredAt: timestamp("occurred_at"), payloadJson: text("payload_json").notNull().default("{}"),
}, (table) => [uniqueIndex("uidx_service_channel_events_org_key").on(table.organizationId, table.eventKey), index("idx_service_channel_events_org_assignment").on(table.organizationId, table.assignmentId, table.occurredAt), index("idx_service_channel_events_org_work").on(table.organizationId, table.workOrderId, table.occurredAt), index("idx_service_channel_events_org_provider").on(table.organizationId, table.providerId, table.occurredAt)]);

export const glAccounts = sqliteTable("gl_accounts", {
  id: id(), organizationId: tenantId(), code: text("code").notNull(), name: text("name").notNull(), accountType: text("account_type").notNull(), parentGlAccountId: text("parent_gl_account_id"), externalReference: text("external_reference"), effectiveFrom: timestamp("effective_from"), effectiveTo: text("effective_to"), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_gl_accounts_org_code_effective").on(table.organizationId, table.code, table.effectiveFrom), index("idx_gl_accounts_org_active_code").on(table.organizationId, table.active, table.code), index("idx_gl_accounts_org_parent").on(table.organizationId, table.parentGlAccountId)]);

export const accountingCostCenters = sqliteTable("accounting_cost_centers", {
  id: id(), organizationId: tenantId(), code: text("code").notNull(), name: text("name").notNull(), scopeType: text("scope_type").notNull(), parentCostCenterId: text("parent_cost_center_id"), regionId: text("region_id"), storeId: text("store_id"), externalReference: text("external_reference"), effectiveFrom: timestamp("effective_from"), effectiveTo: text("effective_to"), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_cost_centers_org_code_effective").on(table.organizationId, table.code, table.effectiveFrom), index("idx_cost_centers_org_active_code").on(table.organizationId, table.active, table.code), index("idx_cost_centers_org_parent").on(table.organizationId, table.parentCostCenterId), index("idx_cost_centers_org_store").on(table.organizationId, table.storeId), index("idx_cost_centers_org_region").on(table.organizationId, table.regionId)]);

export const budgets = sqliteTable("budgets", {
  id: id(), organizationId: tenantId(), code: text("code").notNull(), version: integer("version").notNull().default(1), name: text("name").notNull(), fiscalYear: integer("fiscal_year").notNull(), status: text("status").notNull(), currency: text("currency").notNull().default("USD"), approvedCents: integer("approved_cents").notNull().default(0), periodStart: timestamp("period_start"), periodEnd: timestamp("period_end"), approvedById: text("approved_by_id"), approvedAt: text("approved_at"), supersedesBudgetId: text("supersedes_budget_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_budgets_org_year_code_version").on(table.organizationId, table.fiscalYear, table.code, table.version), index("idx_budgets_org_year_status").on(table.organizationId, table.fiscalYear, table.status)]);

export const budgetLines = sqliteTable("budget_lines", {
  id: id(), organizationId: tenantId(), budgetId: text("budget_id").notNull(), lineNumber: integer("line_number").notNull(), description: text("description"), regionId: text("region_id"), storeId: text("store_id"), serviceCategoryId: text("service_category_id"), glAccountId: text("gl_account_id").notNull(), accountingCostCenterId: text("accounting_cost_center_id").notNull(), approvedCents: integer("approved_cents").notNull().default(0), revisedCents: integer("revised_cents").notNull().default(0), dimensionsJson: text("dimensions_json").notNull().default("{}"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_budget_lines_org_budget_line").on(table.organizationId, table.budgetId, table.lineNumber), index("idx_budget_lines_org_accounting").on(table.organizationId, table.accountingCostCenterId, table.glAccountId), index("idx_budget_lines_org_store_category").on(table.organizationId, table.storeId, table.serviceCategoryId)]);

export const proposals = sqliteTable("proposals", {
  id: id(), organizationId: tenantId(), proposalNumber: text("proposal_number").notNull(), revision: integer("revision").notNull().default(1), workOrderId: text("work_order_id").notNull(), providerId: text("provider_id").notNull(), status: text("status").notNull(), currency: text("currency").notNull().default("USD"), requestedEstimateCents: integer("requested_estimate_cents").notNull().default(0), quotedCents: integer("quoted_cents").notNull().default(0), approvedCents: integer("approved_cents").notNull().default(0), submittedAt: text("submitted_at"), validThrough: text("valid_through"), decidedAt: text("decided_at"), supersedesProposalId: text("supersedes_proposal_id"), documentId: text("document_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_proposals_org_provider_number_rev").on(table.organizationId, table.providerId, table.proposalNumber, table.revision), index("idx_proposals_org_work_status").on(table.organizationId, table.workOrderId, table.status), index("idx_proposals_org_provider_status").on(table.organizationId, table.providerId, table.status), index("idx_proposals_org_valid").on(table.organizationId, table.status, table.validThrough)]);

export const approvalDecisions = sqliteTable("approval_decisions", {
  id: id(), organizationId: tenantId(), decisionKey: text("decision_key").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), policyKey: text("policy_key"), stepSequence: integer("step_sequence").notNull().default(1), decision: text("decision").notNull(), amountCents: integer("amount_cents").notNull().default(0), currency: text("currency").notNull().default("USD"), decidedById: text("decided_by_id"), decidedByName: text("decided_by_name").notNull(), reason: text("reason"), supersedesDecisionId: text("supersedes_decision_id"), decidedAt: timestamp("decided_at"), contextJson: text("context_json").notNull().default("{}"),
}, (table) => [uniqueIndex("uidx_approval_decisions_org_key").on(table.organizationId, table.decisionKey), index("idx_approval_decisions_org_subject").on(table.organizationId, table.subjectType, table.subjectId, table.decidedAt), index("idx_approval_decisions_org_decision").on(table.organizationId, table.decision, table.decidedAt)]);

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: id(), organizationId: tenantId(), number: text("number").notNull(), workOrderId: text("work_order_id"), providerId: text("provider_id").notNull(), proposalId: text("proposal_id"), status: text("status").notNull(), currency: text("currency").notNull().default("USD"), committedCents: integer("committed_cents").notNull().default(0), issuedAt: text("issued_at"), expectedCompletionAt: text("expected_completion_at"), closedAt: text("closed_at"), createdById: text("created_by_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_purchase_orders_org_number").on(table.organizationId, table.number), index("idx_purchase_orders_org_provider_status").on(table.organizationId, table.providerId, table.status), index("idx_purchase_orders_org_work_status").on(table.organizationId, table.workOrderId, table.status)]);

export const purchaseOrderLines = sqliteTable("purchase_order_lines", {
  id: id(), organizationId: tenantId(), purchaseOrderId: text("purchase_order_id").notNull(), lineNumber: integer("line_number").notNull(), description: text("description").notNull(), quantityMilli: integer("quantity_milli").notNull().default(1000), unitCostCents: integer("unit_cost_cents").notNull().default(0), lineTotalCents: integer("line_total_cents").notNull().default(0), costCategory: text("cost_category").notNull(), workOrderId: text("work_order_id"), storeId: text("store_id"), glAccountId: text("gl_account_id"), accountingCostCenterId: text("accounting_cost_center_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_po_lines_org_order_line").on(table.organizationId, table.purchaseOrderId, table.lineNumber), index("idx_po_lines_org_work").on(table.organizationId, table.workOrderId), index("idx_po_lines_org_accounting").on(table.organizationId, table.accountingCostCenterId, table.glAccountId)]);

export const invoiceLines = sqliteTable("invoice_lines", {
  id: id(), organizationId: tenantId(), invoiceId: text("invoice_id").notNull(), lineNumber: integer("line_number").notNull(), purchaseOrderLineId: text("purchase_order_line_id"), description: text("description").notNull(), quantityMilli: integer("quantity_milli").notNull().default(1000), unitCostCents: integer("unit_cost_cents").notNull().default(0), lineTotalCents: integer("line_total_cents").notNull().default(0), costCategory: text("cost_category").notNull(), serviceStartedAt: text("service_started_at"), serviceEndedAt: text("service_ended_at"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_invoice_lines_org_invoice_line").on(table.organizationId, table.invoiceId, table.lineNumber), index("idx_invoice_lines_org_po_line").on(table.organizationId, table.purchaseOrderLineId)]);

export const paymentRecords = sqliteTable("payment_records", {
  id: id(), organizationId: tenantId(), sourceSystem: text("source_system").notNull(), externalReference: text("external_reference").notNull(), invoiceId: text("invoice_id"), providerId: text("provider_id").notNull(), status: text("status").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("USD"), paymentDate: text("payment_date"), observedAt: timestamp("observed_at"), reversesPaymentRecordId: text("reverses_payment_record_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_payment_records_org_source_ref").on(table.organizationId, table.sourceSystem, table.externalReference), index("idx_payment_records_org_invoice_status").on(table.organizationId, table.invoiceId, table.status), index("idx_payment_records_org_provider_date").on(table.organizationId, table.providerId, table.paymentDate)]);

export const accruals = sqliteTable("accruals", {
  id: id(), organizationId: tenantId(), accrualNumber: text("accrual_number").notNull(), accountingPeriod: text("accounting_period").notNull(), workOrderId: text("work_order_id").notNull(), providerId: text("provider_id"), basis: text("basis").notNull(), status: text("status").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("USD"), glAccountId: text("gl_account_id"), accountingCostCenterId: text("accounting_cost_center_id"), serviceThroughAt: text("service_through_at").notNull(), recordedAt: timestamp("recorded_at"), reversesAccrualId: text("reverses_accrual_id"), reversalInvoiceId: text("reversal_invoice_id"), recordedById: text("recorded_by_id"), createdAt: timestamp("created_at"),
}, (table) => [uniqueIndex("uidx_accruals_org_number").on(table.organizationId, table.accrualNumber), index("idx_accruals_org_period_status").on(table.organizationId, table.accountingPeriod, table.status), index("idx_accruals_org_work").on(table.organizationId, table.workOrderId), index("idx_accruals_org_provider").on(table.organizationId, table.providerId, table.accountingPeriod)]);
