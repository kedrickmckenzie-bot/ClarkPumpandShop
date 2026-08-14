import type { PostgresPoolLike } from "./postgres-repository";
import type { IsoDateTime, OpsFixture, OpsId } from "./types";

type Row = Record<string, unknown>;

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function valueForFixture(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function camelRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [camelKey(key), valueForFixture(value)]),
  );
}

function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function jsonText(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? {});
}

function locationCapturedAt(payload: unknown, fallback: IsoDateTime) {
  try {
    const parsed = (typeof payload === "string" ? JSON.parse(payload) : payload) as {
      capturedAt?: unknown;
      clientCapturedAt?: unknown;
    };
    const capturedAt = parsed.clientCapturedAt ?? parsed.capturedAt;
    return typeof capturedAt === "string" ? capturedAt : fallback;
  } catch {
    return fallback;
  }
}

async function tenantRows(pool: PostgresPoolLike, table: string, organizationId: OpsId) {
  const result = await pool.query(`SELECT * FROM ${table} WHERE organization_id = $1`, [organizationId]);
  return result.rows.map(camelRow);
}

/**
 * Compatibility snapshot for the existing presenter while durable screens move
 * to repository read models. Every table query is explicitly tenant bounded.
 */
export async function loadOpsFixtureSnapshotFromPostgres(
  pool: PostgresPoolLike,
  organizationId: OpsId,
  asOf: IsoDateTime,
): Promise<OpsFixture> {
  const organizationResult = await pool.query("SELECT * FROM ops_organizations WHERE id = $1", [organizationId]);
  const [
    divisions,
    regions,
    taxonomyNodes,
    stores,
    memberships,
    scopeGrants,
    vendors,
    vendorSpecialties,
    vendorCoverage,
    requests,
    workOrders,
    assignments,
    issuances,
    vendorResponses,
    estimateRequests,
    estimateProposals,
    visits,
    visitEvidence,
    files,
    entityFiles,
    followUps,
    exceptions,
    assets,
    components,
    pmPlans,
    pmOccurrences,
    costLines,
    invoiceReferences,
    invoiceAllocations,
    auditEvents,
    outboxMessages,
    publicTokens,
  ] = await Promise.all([
    tenantRows(pool, "ops_divisions", organizationId),
    tenantRows(pool, "ops_regions", organizationId),
    tenantRows(pool, "ops_taxonomy_nodes", organizationId),
    tenantRows(pool, "ops_stores", organizationId),
    tenantRows(pool, "ops_memberships", organizationId),
    tenantRows(pool, "ops_scope_grants", organizationId),
    tenantRows(pool, "ops_vendors", organizationId),
    tenantRows(pool, "ops_vendor_specialties", organizationId),
    tenantRows(pool, "ops_vendor_coverage", organizationId),
    tenantRows(pool, "ops_requests", organizationId),
    tenantRows(pool, "ops_work_orders", organizationId),
    tenantRows(pool, "ops_work_order_assignments", organizationId),
    tenantRows(pool, "ops_work_order_issuances", organizationId),
    tenantRows(pool, "ops_vendor_responses", organizationId),
    tenantRows(pool, "ops_work_order_estimate_requests", organizationId),
    tenantRows(pool, "ops_vendor_estimate_proposals", organizationId),
    tenantRows(pool, "ops_visit_sessions", organizationId),
    tenantRows(pool, "ops_visit_evidence", organizationId),
    tenantRows(pool, "ops_files", organizationId),
    tenantRows(pool, "ops_entity_files", organizationId),
    tenantRows(pool, "ops_follow_ups", organizationId),
    tenantRows(pool, "ops_exceptions", organizationId),
    tenantRows(pool, "ops_assets", organizationId),
    tenantRows(pool, "ops_asset_components", organizationId),
    tenantRows(pool, "ops_pm_plans", organizationId),
    tenantRows(pool, "ops_pm_occurrences", organizationId),
    tenantRows(pool, "ops_cost_lines", organizationId),
    tenantRows(pool, "ops_invoice_references", organizationId),
    tenantRows(pool, "ops_invoice_allocations", organizationId),
    tenantRows(pool, "ops_audit_events", organizationId),
    tenantRows(pool, "ops_outbox_messages", organizationId),
    tenantRows(pool, "ops_public_tokens", organizationId),
  ]);

  const userIds = [...new Set(memberships.map((row) => String(row.userId)))];
  const userResult = userIds.length
    ? await pool.query("SELECT * FROM ops_users WHERE id = ANY($1::text[])", [userIds])
    : { rows: [] };

  return {
    asOf,
    organizations: organizationResult.rows.map(camelRow) as unknown as OpsFixture["organizations"],
    divisions: divisions as unknown as OpsFixture["divisions"],
    regions: regions.map((row) => ({ ...row, divisionId: optional(row.divisionId) })) as unknown as OpsFixture["regions"],
    taxonomyNodes: taxonomyNodes.map((row) => ({ ...row, parentNodeId: optional(row.parentNodeId), canonicalKey: optional(row.canonicalKey), aliases: stringArray(row.aliasesJson) })) as unknown as OpsFixture["taxonomyNodes"],
    stores: stores.map((row) => ({ ...row, divisionId: optional(row.divisionId), regionId: optional(row.regionId), address2: optional(row.address2), aliases: stringArray(row.aliasesJson), latitudeE6: optional(row.latitudeE6), longitudeE6: optional(row.longitudeE6), timeZone: optional(row.timeZone) })) as unknown as OpsFixture["stores"],
    users: userResult.rows.map(camelRow) as unknown as OpsFixture["users"],
    memberships: memberships as unknown as OpsFixture["memberships"],
    scopeGrants: scopeGrants as unknown as OpsFixture["scopeGrants"],
    vendors: vendors.map((row) => ({ ...row, dispatchPhone: optional(row.dispatchPhone) })) as unknown as OpsFixture["vendors"],
    vendorSpecialties: vendorSpecialties.map((row) => ({ ...row, searchAliases: stringArray(row.searchAliasesJson) })) as unknown as OpsFixture["vendorSpecialties"],
    vendorCoverage: vendorCoverage.map((row) => ({ ...row, preferredRank: optional(row.preferredRank) })) as unknown as OpsFixture["vendorCoverage"],
    requests: requests.map((row) => ({ ...row, reporterEmployeeId: optional(row.reporterEmployeeId), convertedWorkOrderId: optional(row.convertedWorkOrderId) })) as unknown as OpsFixture["requests"],
    workOrders: workOrders.map((row) => ({ ...row, version: Number(row.version ?? 0), requestId: optional(row.requestId), authorizedScope: optional(row.authorizedScope), categoryKey: optional(row.categoryKey), taxonomyNodeId: optional(row.taxonomyNodeId), assetId: optional(row.assetId), componentId: optional(row.componentId), dueAt: optional(row.dueAt), escalationTo: optional(row.escalationTo), nte: row.nteAmountMinor == null ? undefined : { amountMinor: Number(row.nteAmountMinor), currency: row.nteCurrency ?? "USD" }, repairEstimate: row.repairEstimateAmountMinor == null ? undefined : { amountMinor: Number(row.repairEstimateAmountMinor), currency: row.repairEstimateCurrency ?? "USD" }, estimatedServiceExtensionMonths: optional(row.estimatedServiceExtensionMonths), vendorServiceTicketNumber: optional(row.vendorServiceTicketNumber), vendorInvoiceNumber: optional(row.vendorInvoiceNumber), externalAccountingPo: optional(row.externalAccountingPo), closedAt: optional(row.closedAt) })) as unknown as OpsFixture["workOrders"],
    assignments: assignments.map((row) => ({ ...row, vendorId: optional(row.vendorId), internalMembershipId: optional(row.internalMembershipId), supersedesAssignmentId: optional(row.supersedesAssignmentId) })) as unknown as OpsFixture["assignments"],
    issuances: issuances.map((row) => ({ ...row, immutablePayloadJson: jsonText(row.immutablePayloadJson) })) as unknown as OpsFixture["issuances"],
    vendorResponses: vendorResponses.map((row) => ({ ...row, proposedAt: optional(row.proposedAt), message: optional(row.message) })) as unknown as OpsFixture["vendorResponses"],
    estimateRequests: estimateRequests.map((row) => ({ ...row, dueAt: optional(row.dueAt), openedAt: optional(row.openedAt), respondedAt: optional(row.respondedAt), decisionAt: optional(row.decisionAt) })) as unknown as OpsFixture["estimateRequests"],
    estimateProposals: estimateProposals.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, exclusions: optional(row.exclusions), leadTimeDays: row.leadTimeDays == null ? undefined : Number(row.leadTimeDays), validUntil: optional(row.validUntil) })) as unknown as OpsFixture["estimateProposals"],
    visits: visits.map((row) => ({ ...row, vendorId: optional(row.vendorId), internalMembershipId: optional(row.internalMembershipId), workOrderId: optional(row.workOrderId), unmatchedReason: optional(row.unmatchedReason), endedChannel: optional(row.endedChannel), checkedOutAt: optional(row.checkedOutAt), outcome: optional(row.outcome), outcomeNotes: optional(row.outcomeNotes), observedDurationSeconds: optional(row.observedDurationSeconds) })) as unknown as OpsFixture["visits"],
    visitEvidence: visitEvidence.map((row) => ({ id: row.id, organizationId: row.organizationId, visitId: row.visitId, kind: row.kind, channel: row.channel, observedAt: row.observedAt, payloadJson: jsonText(row.payloadJson), location: row.locationResult ? { result: row.locationResult, latitudeE6: optional(row.latitudeE6), longitudeE6: optional(row.longitudeE6), accuracyM: optional(row.accuracyM), distanceM: optional(row.distanceM), capturedAt: locationCapturedAt(row.payloadJson, row.observedAt as IsoDateTime) } : undefined })) as unknown as OpsFixture["visitEvidence"],
    files: files as unknown as OpsFixture["files"],
    entityFiles: entityFiles as unknown as OpsFixture["entityFiles"],
    followUps: followUps.map((row) => ({ ...row, sourceVisitId: optional(row.sourceVisitId), completedAt: optional(row.completedAt) })) as unknown as OpsFixture["followUps"],
    exceptions: exceptions.map((row) => ({ ...row, storeId: optional(row.storeId), workOrderId: optional(row.workOrderId), visitId: optional(row.visitId), vendorId: optional(row.vendorId), resolvedAt: optional(row.resolvedAt) })) as unknown as OpsFixture["exceptions"],
    assets: assets.map((row) => ({ ...row, taxonomyNodeId: optional(row.taxonomyNodeId), groupPath: stringArray(row.groupPathJson), manufacturer: optional(row.manufacturer), model: optional(row.model), serialNumber: optional(row.serialNumber), supplier: optional(row.supplier), installedAt: optional(row.installedAt), expectedLifeYears: optional(row.expectedLifeYears), warrantyEndsAt: optional(row.warrantyEndsAt), replacementEstimate: row.replacementEstimateMinor == null ? undefined : { amountMinor: Number(row.replacementEstimateMinor), currency: row.replacementCurrency ?? "USD" } })) as unknown as OpsFixture["assets"],
    components: components.map((row) => ({ ...row, parentComponentId: optional(row.parentComponentId), partNumber: optional(row.partNumber), serialNumber: optional(row.serialNumber), installedAt: optional(row.installedAt), warrantyEndsAt: optional(row.warrantyEndsAt) })) as unknown as OpsFixture["components"],
    pmPlans: pmPlans.map((row) => ({ ...row, storeId: optional(row.storeId), assetId: optional(row.assetId), categoryKey: optional(row.categoryKey) })) as unknown as OpsFixture["pmPlans"],
    pmOccurrences: pmOccurrences.map((row) => ({ ...row, assetId: optional(row.assetId), workOrderId: optional(row.workOrderId), completedAt: optional(row.completedAt) })) as unknown as OpsFixture["pmOccurrences"],
    costLines: costLines.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency } })) as unknown as OpsFixture["costLines"],
    invoiceReferences: invoiceReferences.map((row) => ({ ...row, grossAmount: { amountMinor: Number(row.grossAmountMinor), currency: row.currency }, operatorWorkOrderNumber: optional(row.operatorWorkOrderNumber) })) as unknown as OpsFixture["invoiceReferences"],
    invoiceAllocations: invoiceAllocations.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, confirmedByMembershipId: optional(row.confirmedByMembershipId), confirmedAt: optional(row.confirmedAt) })) as unknown as OpsFixture["invoiceAllocations"],
    auditEvents: auditEvents.map((row) => ({ ...row, actorId: optional(row.actorId), payloadJson: jsonText(row.payloadJson) })) as unknown as OpsFixture["auditEvents"],
    outboxMessages: outboxMessages.map((row) => ({ ...row, payloadJson: jsonText(row.payloadJson) })) as unknown as OpsFixture["outboxMessages"],
    publicTokens: publicTokens.map((row) => ({ ...row, usedAt: optional(row.usedAt), revokedAt: optional(row.revokedAt) })) as unknown as OpsFixture["publicTokens"],
  };
}
