import type { OpsRepository, OpsStatement } from "./repository";
import type { OpsFixture } from "./types";
import { assertOpsFixture } from "./fixtures";

function insert(table: string, value: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return { sql: `INSERT OR IGNORE INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, item]) => item) };
}

export function buildOpsSeedStatements(fixture: OpsFixture): OpsStatement[] {
  assertOpsFixture(fixture);
  const statements: OpsStatement[] = [];
  const push = (table: string, rows: Record<string, unknown>[]) => rows.forEach((row) => statements.push(insert(table, row)));
  push("ops_organizations", fixture.organizations.map((row) => ({ id: row.id, name: row.name, slug: row.slug, time_zone: row.timeZone, work_order_prefix: row.workOrderPrefix, created_at: row.createdAt })));
  push("ops_divisions", fixture.divisions.map((row) => ({ id: row.id, organization_id: row.organizationId, code: row.code, name: row.name, created_at: row.createdAt })));
  push("ops_regions", fixture.regions.map((row) => ({ id: row.id, organization_id: row.organizationId, division_id: row.divisionId, code: row.code, name: row.name, created_at: row.createdAt })));
  push("ops_taxonomy_nodes", fixture.taxonomyNodes.map((row) => ({ id: row.id, organization_id: row.organizationId, parent_node_id: row.parentNodeId, node_kind: row.nodeKind, canonical_key: row.canonicalKey, name: row.name, aliases_json: JSON.stringify(row.aliases), depth: row.depth, sort_order: row.sortOrder, active: row.active ? 1 : 0, created_at: row.createdAt })));
  push("ops_stores", fixture.stores.map((row) => ({ id: row.id, organization_id: row.organizationId, division_id: row.divisionId, region_id: row.regionId, store_number: row.storeNumber, name: row.name, address_1: row.address1, address_2: row.address2, city: row.city, state: row.state, postal_code: row.postalCode, aliases_json: JSON.stringify(row.aliases), search_text: [row.storeNumber,row.name,row.address1,row.address2,row.city,row.state,row.postalCode,...row.aliases].filter(Boolean).join(" ").toLocaleLowerCase("en-US"), latitude_e6: row.latitudeE6, longitude_e6: row.longitudeE6, geofence_radius_m: row.geofenceRadiusM, location_policy_enabled: row.locationPolicyEnabled ? 1 : 0, time_zone: row.timeZone, status: row.status, created_at: row.createdAt })));
  push("ops_users", fixture.users.map((row) => ({ id: row.id, email: row.email, display_name: row.displayName, status: row.status, created_at: row.createdAt })));
  push("ops_memberships", fixture.memberships.map((row) => ({ id: row.id, organization_id: row.organizationId, user_id: row.userId, role: row.role, status: row.status, created_at: row.createdAt })));
  push("ops_scope_grants", fixture.scopeGrants.map((row) => ({ id: row.id, organization_id: row.organizationId, membership_id: row.membershipId, scope_kind: row.scopeKind, scope_id: row.scopeId, permission: row.permission, created_at: row.createdAt })));
  push("ops_vendors", fixture.vendors.map((row) => ({ id: row.id, organization_id: row.organizationId, code: row.code, name: row.name, dispatch_email: row.dispatchEmail, dispatch_phone: row.dispatchPhone, status: row.status, preferred: row.preferred ? 1 : 0, search_text: [row.name,...fixture.vendorSpecialties.filter((item) => item.organizationId === row.organizationId && item.vendorId === row.id).flatMap((item) => [item.displayName,...item.searchAliases])].join(" ").toLocaleLowerCase("en-US"), created_at: row.createdAt })));
  push("ops_vendor_specialties", fixture.vendorSpecialties.map((row) => ({ id: row.id, organization_id: row.organizationId, vendor_id: row.vendorId, canonical_key: row.canonicalKey, display_name: row.displayName, search_aliases_json: JSON.stringify(row.searchAliases) })));
  push("ops_vendor_coverage", fixture.vendorCoverage.map((row) => ({ id: row.id, organization_id: row.organizationId, vendor_id: row.vendorId, scope_kind: row.scopeKind, scope_id: row.scopeId, preferred_rank: row.preferredRank })));
  push("ops_requests", fixture.requests.map((row) => ({ id: row.id, organization_id: row.organizationId, reference: row.reference, store_id: row.storeId, reporter_name: row.reporterName, reporter_employee_id: row.reporterEmployeeId, problem: row.problem, priority: row.priority, status: row.status, submitted_at: row.submittedAt, converted_work_order_id: row.convertedWorkOrderId })));
  push("ops_work_orders", fixture.workOrders.map((row) => ({ id: row.id, organization_id: row.organizationId, number: row.number, store_id: row.storeId, request_id: row.requestId, problem: row.problem, authorized_scope: row.authorizedScope, category_key: row.categoryKey, taxonomy_node_id: row.taxonomyNodeId, asset_id: row.assetId, component_id: row.componentId, priority: row.priority, status: row.status, accountable_party: row.accountableParty, next_action: row.nextAction, due_at: row.dueAt, escalation_to: row.escalationTo, nte_amount_minor: row.nte?.amountMinor, nte_currency: row.nte?.currency, vendor_service_ticket_number: row.vendorServiceTicketNumber, vendor_invoice_number: row.vendorInvoiceNumber, external_accounting_po: row.externalAccountingPo, created_at: row.createdAt, closed_at: row.closedAt })));
  push("ops_work_order_assignments", fixture.assignments.map((row) => ({ id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, kind: row.kind, vendor_id: row.vendorId, internal_membership_id: row.internalMembershipId, status: row.status, assigned_at: row.assignedAt, supersedes_assignment_id: row.supersedesAssignmentId })));
  push("ops_work_order_issuances", fixture.issuances.map((row) => ({ id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, assignment_id: row.assignmentId, revision: row.revision, immutable_payload_json: row.immutablePayloadJson, channel: row.channel, issued_at: row.issuedAt })));
  push("ops_vendor_responses", fixture.vendorResponses.map((row) => ({ id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, assignment_id: row.assignmentId, issuance_id: row.issuanceId, response: row.response, responder_name: row.responderName, proposed_at: row.proposedAt, message: row.message, responded_at: row.respondedAt })));
  push("ops_visit_sessions", fixture.visits.map((row) => ({ id: row.id, organization_id: row.organizationId, store_id: row.storeId, provider_kind: row.providerKind, vendor_id: row.vendorId, internal_membership_id: row.internalMembershipId, work_order_id: row.workOrderId, unmatched_reason: row.unmatchedReason, technician_name: row.technicianName, provider_name: row.providerName, purpose: row.purpose, status: row.status, started_channel: row.startedChannel, ended_channel: row.endedChannel, checked_in_at: row.checkedInAt, checked_out_at: row.checkedOutAt, outcome: row.outcome, outcome_notes: row.outcomeNotes, observed_duration_seconds: row.observedDurationSeconds })));
  push("ops_visit_evidence", fixture.visitEvidence.map((row) => ({ id: row.id, organization_id: row.organizationId, visit_id: row.visitId, kind: row.kind, channel: row.channel, observed_at: row.observedAt, location_result: row.location?.result, latitude_e6: row.location?.latitudeE6, longitude_e6: row.location?.longitudeE6, accuracy_m: row.location?.accuracyM, distance_m: row.location?.distanceM, payload_json: row.payloadJson })));
  push("ops_files", fixture.files.map((row) => ({ id: row.id, organization_id: row.organizationId, storage_key: row.storageKey, sha256: row.sha256, original_name: row.originalName, content_type: row.contentType, byte_length: row.byteLength, status: row.status, created_at: row.createdAt })));
  push("ops_entity_files", fixture.entityFiles.map((row) => ({ id: row.id, organization_id: row.organizationId, file_id: row.fileId, entity_type: row.entityType, entity_id: row.entityId, purpose: row.purpose, visibility: row.visibility, created_at: row.createdAt })));
  push("ops_follow_ups", fixture.followUps.map((row) => ({ id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, source_visit_id: row.sourceVisitId, accountable_party: row.accountableParty, next_action: row.nextAction, due_at: row.dueAt, escalation_to: row.escalationTo, status: row.status, created_at: row.createdAt, completed_at: row.completedAt })));
  push("ops_exceptions", fixture.exceptions.map((row) => ({ id: row.id, organization_id: row.organizationId, kind: row.kind, store_id: row.storeId, work_order_id: row.workOrderId, visit_id: row.visitId, vendor_id: row.vendorId, severity: row.severity, status: row.status, summary: row.summary, detected_at: row.detectedAt })));
  push("ops_assets", fixture.assets.map((row) => ({ id: row.id, organization_id: row.organizationId, store_id: row.storeId, category_key: row.categoryKey, taxonomy_node_id: row.taxonomyNodeId, group_path_json: JSON.stringify(row.groupPath), asset_tag: row.assetTag, name: row.name, manufacturer: row.manufacturer, model: row.model, serial_number: row.serialNumber, supplier: row.supplier, installed_at: row.installedAt, expected_life_years: row.expectedLifeYears, warranty_ends_at: row.warrantyEndsAt, replacement_estimate_minor: row.replacementEstimate?.amountMinor, replacement_currency: row.replacementEstimate?.currency, status: row.status, created_at: row.createdAt })));
  push("ops_asset_components", fixture.components.map((row) => ({ id: row.id, organization_id: row.organizationId, asset_id: row.assetId, parent_component_id: row.parentComponentId, name: row.name, part_number: row.partNumber, serial_number: row.serialNumber, installed_at: row.installedAt, warranty_ends_at: row.warrantyEndsAt, created_at: row.createdAt })));
  push("ops_pm_plans", fixture.pmPlans.map((row) => ({ id: row.id, organization_id: row.organizationId, name: row.name, store_id: row.storeId, asset_id: row.assetId, category_key: row.categoryKey, cadence_days: row.cadenceDays, completion_window_days: row.completionWindowDays, active: row.active ? 1 : 0, created_at: row.createdAt })));
  push("ops_pm_occurrences", fixture.pmOccurrences.map((row) => ({ id: row.id, organization_id: row.organizationId, plan_id: row.planId, store_id: row.storeId, asset_id: row.assetId, work_order_id: row.workOrderId, due_at: row.dueAt, window_starts_at: row.windowStartsAt, window_ends_at: row.windowEndsAt, status: row.status, completed_at: row.completedAt })));
  push("ops_cost_lines", fixture.costLines.map((row) => ({ id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, kind: row.kind, description: row.description, amount_minor: row.amount.amountMinor, currency: row.amount.currency, service_date: row.serviceDate, recorded_at: row.recordedAt })));
  push("ops_invoice_references", fixture.invoiceReferences.map((row) => ({ id: row.id, organization_id: row.organizationId, vendor_id: row.vendorId, invoice_number: row.invoiceNumber, invoice_date: row.invoiceDate, gross_amount_minor: row.grossAmount.amountMinor, currency: row.grossAmount.currency, operator_work_order_number: row.operatorWorkOrderNumber, match_status: row.matchStatus, created_at: row.createdAt })));
  push("ops_invoice_allocations", fixture.invoiceAllocations.map((row) => ({ id: row.id, organization_id: row.organizationId, invoice_reference_id: row.invoiceReferenceId, work_order_id: row.workOrderId, amount_minor: row.amount.amountMinor, currency: row.amount.currency, confirmed_by_membership_id: row.confirmedByMembershipId, confirmed_at: row.confirmedAt })));
  push("ops_audit_events", fixture.auditEvents.map((row) => ({ id: row.id, organization_id: row.organizationId, aggregate_type: row.aggregateType, aggregate_id: row.aggregateId, event_type: row.eventType, actor_type: row.actorType, actor_id: row.actorId, actor_name: row.actorName, occurred_at: row.occurredAt, payload_json: row.payloadJson })));
  push("ops_outbox_messages", fixture.outboxMessages.map((row) => ({ id: row.id, organization_id: row.organizationId, topic: row.topic, aggregate_type: row.aggregateType, aggregate_id: row.aggregateId, payload_json: row.payloadJson, status: row.status, available_at: row.availableAt, created_at: row.createdAt })));
  push("ops_public_tokens", fixture.publicTokens.map((row) => ({ id: row.id, organization_id: row.organizationId, purpose: row.purpose, subject_type: row.subjectType, subject_id: row.subjectId, token_hash: row.tokenHash, expires_at: row.expiresAt, created_at: row.createdAt, used_at: row.usedAt, revoked_at: row.revokedAt })));
  for (const organization of fixture.organizations) {
    const counters = new Map<number, number>();
    for (const workOrder of fixture.workOrders.filter((row) => row.organizationId === organization.id)) {
      const match = workOrder.number.match(new RegExp(`^${organization.workOrderPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d{4})-(\\d+)$`));
      if (!match) continue;
      const year = Number(match[1]);
      const sequence = Number(match[2]);
      if (Number.isInteger(year) && Number.isInteger(sequence)) counters.set(year, Math.max(counters.get(year) ?? 0, sequence));
    }
    for (const [year, highest] of counters) {
      statements.push(insert("ops_work_order_counters", { organization_id: organization.id, counter_year: year, next_value: highest + 1 }));
    }
  }
  return statements;
}

export async function seedOpsRepository(
  repository: OpsRepository,
  fixture: OpsFixture,
  finalStatements: readonly OpsStatement[] = [],
) {
  const statements = [...buildOpsSeedStatements(fixture), ...finalStatements];
  const chunkSize = repository.kind === "d1" ? 75 : statements.length;
  for (let index = 0; index < statements.length; index += chunkSize) await repository.atomicWrite(statements.slice(index, index + chunkSize));
  return { statements: statements.length, organizations: fixture.organizations.length, stores: fixture.stores.length, vendors: fixture.vendors.length };
}
