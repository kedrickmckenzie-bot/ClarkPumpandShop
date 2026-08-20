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

function stringRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch { return {}; }
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
    equipmentTemplates,
    componentTemplates,
    stores,
    memberships,
    scopeGrants,
    vendors,
    vendorSpecialties,
    vendorCoverage,
    vendorQualifications,
    vendorComplianceDocuments,
    vendorContracts,
    contractVersions,
    contractScopes,
    rateCardLines,
    serviceLevelPolicies,
    schedulingPolicies,
    vendorCapacity,
    requests,
    requestImpactAssessments,
    workOrders,
    approvalPolicies,
    approvalRequests,
    approvalDecisions,
    assignments,
    issuances,
    vendorResponses,
    estimateRequests,
    estimateProposals,
    visits,
    siteVisitWorkOrders,
    workOrderVerifications,
    visitEvidence,
    files,
    entityFiles,
    followUps,
    workflowTasks,
    workflowTaskSlaPauses,
    workflowTaskSlaResumes,
    exceptions,
    replacementProfiles,
    assets,
    replacementBenchmarks,
    assetReplacementOverrides,
    replacementEvents,
    lifecycleRecommendations,
    components,
    maintenancePrograms,
    checklistTemplates,
    pmPlans,
    pmOccurrences,
    pmWorkItems,
    checklistResponses,
    serviceRuns,
    routeStops,
    serviceRunWorkOrders,
    serviceRunResponses,
    vendorWarrantyProfiles,
    warrantyRules,
    warrantyCoverageLines,
    repairItems,
    appliedWarranties,
    warrantyAmendments,
    manufacturerWarranties,
    warrantyCases,
    quotes,
    authorizations,
    invoices,
    invoiceLines,
    invoiceLineAllocations,
    invoiceExceptions,
    invoiceAdjustments,
    serviceDiscrepancies,
    valueEvents,
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
    tenantRows(pool, "ops_equipment_templates", organizationId),
    tenantRows(pool, "ops_component_templates", organizationId),
    tenantRows(pool, "ops_stores", organizationId),
    tenantRows(pool, "ops_memberships", organizationId),
    tenantRows(pool, "ops_scope_grants", organizationId),
    tenantRows(pool, "ops_vendors", organizationId),
    tenantRows(pool, "ops_vendor_specialties", organizationId),
    tenantRows(pool, "ops_vendor_coverage", organizationId),
    tenantRows(pool, "ops_vendor_qualifications", organizationId),
    tenantRows(pool, "ops_vendor_compliance_documents", organizationId),
    tenantRows(pool, "ops_vendor_contracts", organizationId),
    tenantRows(pool, "ops_contract_versions", organizationId),
    tenantRows(pool, "ops_contract_scopes", organizationId),
    tenantRows(pool, "ops_rate_card_lines", organizationId),
    tenantRows(pool, "ops_service_level_policies", organizationId),
    tenantRows(pool, "ops_scheduling_policies", organizationId),
    tenantRows(pool, "ops_vendor_capacity", organizationId),
    tenantRows(pool, "ops_requests", organizationId),
    tenantRows(pool, "ops_request_impact_assessments", organizationId),
    tenantRows(pool, "ops_work_orders", organizationId),
    tenantRows(pool, "ops_approval_policies", organizationId),
    tenantRows(pool, "ops_approval_requests", organizationId),
    tenantRows(pool, "ops_approval_decisions", organizationId),
    tenantRows(pool, "ops_work_order_assignments", organizationId),
    tenantRows(pool, "ops_work_order_issuances", organizationId),
    tenantRows(pool, "ops_vendor_responses", organizationId),
    tenantRows(pool, "ops_work_order_estimate_requests", organizationId),
    tenantRows(pool, "ops_vendor_estimate_proposals", organizationId),
    tenantRows(pool, "ops_visit_sessions", organizationId),
    tenantRows(pool, "ops_site_visit_work_orders", organizationId),
    tenantRows(pool, "ops_work_order_verifications", organizationId),
    tenantRows(pool, "ops_visit_evidence", organizationId),
    tenantRows(pool, "ops_files", organizationId),
    tenantRows(pool, "ops_entity_files", organizationId),
    tenantRows(pool, "ops_follow_ups", organizationId),
    tenantRows(pool, "ops_workflow_tasks", organizationId),
    tenantRows(pool, "ops_workflow_task_sla_pauses", organizationId),
    tenantRows(pool, "ops_workflow_task_sla_resumes", organizationId),
    tenantRows(pool, "ops_exceptions", organizationId),
    tenantRows(pool, "ops_replacement_profiles", organizationId),
    tenantRows(pool, "ops_assets", organizationId),
    tenantRows(pool, "ops_replacement_benchmarks", organizationId),
    tenantRows(pool, "ops_asset_replacement_overrides", organizationId),
    tenantRows(pool, "ops_replacement_events", organizationId),
    tenantRows(pool, "ops_lifecycle_recommendations", organizationId),
    tenantRows(pool, "ops_asset_components", organizationId),
    tenantRows(pool, "ops_maintenance_programs", organizationId),
    tenantRows(pool, "ops_checklist_templates", organizationId),
    tenantRows(pool, "ops_pm_plans", organizationId),
    tenantRows(pool, "ops_pm_occurrences", organizationId),
    tenantRows(pool, "ops_pm_work_items", organizationId),
    tenantRows(pool, "ops_checklist_responses", organizationId),
    tenantRows(pool, "ops_service_runs", organizationId),
    tenantRows(pool, "ops_route_stops", organizationId),
    tenantRows(pool, "ops_service_run_work_orders", organizationId),
    tenantRows(pool, "ops_service_run_responses", organizationId),
    tenantRows(pool, "ops_vendor_warranty_profiles", organizationId),
    tenantRows(pool, "ops_warranty_rules", organizationId),
    tenantRows(pool, "ops_warranty_coverage_lines", organizationId),
    tenantRows(pool, "ops_repair_items", organizationId),
    tenantRows(pool, "ops_applied_warranties", organizationId),
    tenantRows(pool, "ops_warranty_amendments", organizationId),
    tenantRows(pool, "ops_manufacturer_warranties", organizationId),
    tenantRows(pool, "ops_warranty_cases", organizationId),
    tenantRows(pool, "ops_quotes", organizationId),
    tenantRows(pool, "ops_authorizations", organizationId),
    tenantRows(pool, "ops_invoices", organizationId),
    tenantRows(pool, "ops_invoice_lines", organizationId),
    tenantRows(pool, "ops_invoice_line_allocations", organizationId),
    tenantRows(pool, "ops_invoice_exceptions", organizationId),
    tenantRows(pool, "ops_invoice_adjustments", organizationId),
    tenantRows(pool, "ops_service_discrepancies", organizationId),
    tenantRows(pool, "ops_value_events", organizationId),
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
    equipmentTemplates: equipmentTemplates.map((row) => ({ ...row, defaultExpectedLifeYears: optional(row.defaultExpectedLifeYears) })) as unknown as OpsFixture["equipmentTemplates"],
    componentTemplates: componentTemplates.map((row) => ({ ...row, parentComponentTemplateId: optional(row.parentComponentTemplateId) })) as unknown as OpsFixture["componentTemplates"],
    stores: stores.map((row) => ({ ...row, divisionId: optional(row.divisionId), regionId: optional(row.regionId), address2: optional(row.address2), aliases: stringArray(row.aliasesJson), latitudeE6: optional(row.latitudeE6), longitudeE6: optional(row.longitudeE6), timeZone: optional(row.timeZone) })) as unknown as OpsFixture["stores"],
    users: userResult.rows.map(camelRow) as unknown as OpsFixture["users"],
    memberships: memberships as unknown as OpsFixture["memberships"],
    scopeGrants: scopeGrants as unknown as OpsFixture["scopeGrants"],
    vendors: vendors.map((row) => ({ ...row, dispatchPhone: optional(row.dispatchPhone) })) as unknown as OpsFixture["vendors"],
    vendorSpecialties: vendorSpecialties.map((row) => ({ ...row, searchAliases: stringArray(row.searchAliasesJson) })) as unknown as OpsFixture["vendorSpecialties"],
    vendorCoverage: vendorCoverage.map((row) => ({ ...row, preferredRank: optional(row.preferredRank) })) as unknown as OpsFixture["vendorCoverage"],
    vendorQualifications: vendorQualifications.map((row) => ({ ...row, workType: optional(row.workType), serviceType: optional(row.serviceType), assetType: optional(row.assetType), componentType: optional(row.componentType), manufacturerAuthorization: optional(row.manufacturerAuthorization), regionId: optional(row.regionId), storeId: optional(row.storeId), maximumJobAmount: row.maximumJobAmountMinor == null ? undefined : { amountMinor: Number(row.maximumJobAmountMinor), currency: row.currency ?? "USD" }, requiredLicense: optional(row.requiredLicense), requiredCertification: optional(row.requiredCertification), expiresAt: optional(row.expiresAt) })) as unknown as OpsFixture["vendorQualifications"],
    vendorComplianceDocuments: vendorComplianceDocuments.map((row) => ({ ...row, issuer: optional(row.issuer), reference: optional(row.reference), effectiveAt: optional(row.effectiveAt), expiresAt: optional(row.expiresAt), storedFileId: optional(row.storedFileId) })) as unknown as OpsFixture["vendorComplianceDocuments"],
    vendorContracts: vendorContracts as unknown as OpsFixture["vendorContracts"],
    contractVersions: contractVersions.map((row) => ({ ...row, effectiveEndsAt: optional(row.effectiveEndsAt), renewalAt: optional(row.renewalAt), noticeDays: optional(row.noticeDays), priceEscalationAt: optional(row.priceEscalationAt), supersedesContractVersionId: optional(row.supersedesContractVersionId), nteAmount: row.nteAmountMinor == null ? undefined : { amountMinor: Number(row.nteAmountMinor), currency: row.currency }, evidenceRequirements: stringArray(row.evidenceRequirementsJson), complianceRequirements: stringArray(row.complianceRequirementsJson), warrantyLaborDays: optional(row.warrantyLaborDays), warrantyPartsDays: optional(row.warrantyPartsDays), warrantyTravelDays: optional(row.warrantyTravelDays) })) as unknown as OpsFixture["contractVersions"],
    contractScopes: contractScopes as unknown as OpsFixture["contractScopes"],
    rateCardLines: rateCardLines.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, effectiveEndsAt: optional(row.effectiveEndsAt) })) as unknown as OpsFixture["rateCardLines"],
    serviceLevelPolicies: serviceLevelPolicies as unknown as OpsFixture["serviceLevelPolicies"],
    schedulingPolicies: schedulingPolicies as unknown as OpsFixture["schedulingPolicies"],
    vendorCapacity: vendorCapacity.map((row) => ({ ...row, specialEquipment: stringArray(row.specialEquipmentJson) })) as unknown as OpsFixture["vendorCapacity"],
    requests: requests.map((row) => ({ ...row, version: Number(row.version ?? 0), reporterEmployeeId: optional(row.reporterEmployeeId), convertedWorkOrderId: optional(row.convertedWorkOrderId) })) as unknown as OpsFixture["requests"],
    requestImpactAssessments: requestImpactAssessments.map((row) => ({ ...row, reviewDisposition: optional(row.reviewDisposition), productInventoryValue: row.productInventoryValueMinor == null ? undefined : { amountMinor: Number(row.productInventoryValueMinor), currency: row.productInventoryCurrency ?? "USD" }, capacityUnavailableBps: row.capacityUnavailableBps == null ? undefined : Number(row.capacityUnavailableBps), revenueFunctionImpact: optional(row.revenueFunctionImpact), estimatedDailyRevenueExposure: row.estimatedDailyRevenueExposureMinor == null ? undefined : { amountMinor: Number(row.estimatedDailyRevenueExposureMinor), currency: row.estimatedDailyRevenueExposureCurrency ?? "USD" }, estimatedDowntimeMinutes: row.estimatedDowntimeMinutes == null ? undefined : Number(row.estimatedDowntimeMinutes), notes: optional(row.notes), assessedByActorId: optional(row.assessedByActorId) })) as unknown as OpsFixture["requestImpactAssessments"],
    workOrders: workOrders.map((row) => ({ ...row, version: Number(row.version ?? 0), requestId: optional(row.requestId), authorizedScope: optional(row.authorizedScope), categoryKey: optional(row.categoryKey), taxonomyNodeId: optional(row.taxonomyNodeId), assetId: optional(row.assetId), componentId: optional(row.componentId), dueAt: optional(row.dueAt), escalationTo: optional(row.escalationTo), nte: row.nteAmountMinor == null ? undefined : { amountMinor: Number(row.nteAmountMinor), currency: row.nteCurrency ?? "USD" }, repairEstimate: row.repairEstimateAmountMinor == null ? undefined : { amountMinor: Number(row.repairEstimateAmountMinor), currency: row.repairEstimateCurrency ?? "USD" }, estimatedServiceExtensionMonths: optional(row.estimatedServiceExtensionMonths), vendorServiceTicketNumber: optional(row.vendorServiceTicketNumber), vendorInvoiceNumber: optional(row.vendorInvoiceNumber), externalAccountingPo: optional(row.externalAccountingPo), resolvedAt: optional(row.resolvedAt), closedAt: optional(row.closedAt) })) as unknown as OpsFixture["workOrders"],
    approvalPolicies: approvalPolicies.map((row) => ({ ...row, version: Number(row.version), minAmountMinor: Number(row.minAmountMinor), maxAmountMinor: row.maxAmountMinor == null ? undefined : Number(row.maxAmountMinor), categoryKey: optional(row.categoryKey), escalationRole: optional(row.escalationRole), supersedesPolicyId: optional(row.supersedesPolicyId), createdByMembershipId: optional(row.createdByMembershipId) })) as unknown as OpsFixture["approvalPolicies"],
    approvalRequests: approvalRequests.map((row) => ({ ...row, policyVersion: Number(row.policyVersion), categoryKey: optional(row.categoryKey), amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, escalationRole: optional(row.escalationRole), requestedByMembershipId: optional(row.requestedByMembershipId), reason: optional(row.reason), dueAt: optional(row.dueAt), parentApprovalRequestId: optional(row.parentApprovalRequestId) })) as unknown as OpsFixture["approvalRequests"],
    approvalDecisions: approvalDecisions.map((row) => ({ ...row, decidedByMembershipId: optional(row.decidedByMembershipId), reason: optional(row.reason), escalatedToRole: optional(row.escalatedToRole) })) as unknown as OpsFixture["approvalDecisions"],
    assignments: assignments.map((row) => ({ ...row, vendorId: optional(row.vendorId), internalMembershipId: optional(row.internalMembershipId), supersedesAssignmentId: optional(row.supersedesAssignmentId) })) as unknown as OpsFixture["assignments"],
    issuances: issuances.map((row) => ({ ...row, immutablePayloadJson: jsonText(row.immutablePayloadJson) })) as unknown as OpsFixture["issuances"],
    vendorResponses: vendorResponses.map((row) => ({ ...row, proposedAt: optional(row.proposedAt), message: optional(row.message) })) as unknown as OpsFixture["vendorResponses"],
    estimateRequests: estimateRequests.map((row) => ({ ...row, dueAt: optional(row.dueAt), openedAt: optional(row.openedAt), respondedAt: optional(row.respondedAt), decisionAt: optional(row.decisionAt) })) as unknown as OpsFixture["estimateRequests"],
    estimateProposals: estimateProposals.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, exclusions: optional(row.exclusions), leadTimeDays: row.leadTimeDays == null ? undefined : Number(row.leadTimeDays), validUntil: optional(row.validUntil) })) as unknown as OpsFixture["estimateProposals"],
    visits: visits.map((row) => ({ ...row, vendorId: optional(row.vendorId), internalMembershipId: optional(row.internalMembershipId), workOrderId: optional(row.workOrderId), unmatchedReason: optional(row.unmatchedReason), technicianPhoneOrPin: optional(row.technicianPhoneOrPin), crewCount: Number(row.crewCount ?? 1), additionalTechnicianNames: stringArray(row.additionalTechnicianNamesJson), vehicleIdentifier: optional(row.vehicleIdentifier), arrivalNote: optional(row.arrivalNote), endedChannel: optional(row.endedChannel), checkedOutAt: optional(row.checkedOutAt), outcome: optional(row.outcome), outcomeNotes: optional(row.outcomeNotes), observedDurationSeconds: optional(row.observedDurationSeconds) })) as unknown as OpsFixture["visits"],
    siteVisitWorkOrders: siteVisitWorkOrders.map((row) => ({ ...row, ordinal: Number(row.ordinal), linkedByActorId: optional(row.linkedByActorId), outcome: optional(row.outcome), outcomeNotes: optional(row.outcomeNotes), outcomeRecordedByActorType: optional(row.outcomeRecordedByActorType), outcomeRecordedByActorId: optional(row.outcomeRecordedByActorId), outcomeRecordedByActorName: optional(row.outcomeRecordedByActorName), outcomeRecordedAt: optional(row.outcomeRecordedAt), followUpId: optional(row.followUpId) })) as unknown as OpsFixture["siteVisitWorkOrders"],
    workOrderVerifications: workOrderVerifications.map((row) => ({ ...row, cycle: Number(row.cycle), reason: optional(row.reason) })) as unknown as OpsFixture["workOrderVerifications"],
    visitEvidence: visitEvidence.map((row) => ({ id: row.id, organizationId: row.organizationId, visitId: row.visitId, kind: row.kind, channel: row.channel, observedAt: row.observedAt, payloadJson: jsonText(row.payloadJson), location: row.locationResult ? { result: row.locationResult, latitudeE6: optional(row.latitudeE6), longitudeE6: optional(row.longitudeE6), accuracyM: optional(row.accuracyM), distanceM: optional(row.distanceM), capturedAt: locationCapturedAt(row.payloadJson, row.observedAt as IsoDateTime) } : undefined })) as unknown as OpsFixture["visitEvidence"],
    files: files as unknown as OpsFixture["files"],
    entityFiles: entityFiles as unknown as OpsFixture["entityFiles"],
    followUps: followUps.map((row) => ({ ...row, sourceVisitId: optional(row.sourceVisitId), completedAt: optional(row.completedAt) })) as unknown as OpsFixture["followUps"],
    workflowTasks: workflowTasks.map((row) => ({ ...row, workOrderId: optional(row.workOrderId), serviceRequestId: optional(row.serviceRequestId), escalationLevel: Number(row.escalationLevel ?? 0), assigneeId: optional(row.assigneeId), assigneeRole: optional(row.assigneeRole), dueAt: optional(row.dueAt), noSlaReason: optional(row.noSlaReason), applicableSlaClock: optional(row.applicableSlaClock), sourceFollowUpId: optional(row.sourceFollowUpId), sourceApprovalRequestId: optional(row.sourceApprovalRequestId), createdByActorId: optional(row.createdByActorId), startedByActorType: optional(row.startedByActorType), startedByActorId: optional(row.startedByActorId), startedByActorName: optional(row.startedByActorName), startedAt: optional(row.startedAt), completedByActorType: optional(row.completedByActorType), completedByActorId: optional(row.completedByActorId), completedByActorName: optional(row.completedByActorName), completedAt: optional(row.completedAt), cancelledByActorType: optional(row.cancelledByActorType), cancelledByActorId: optional(row.cancelledByActorId), cancelledByActorName: optional(row.cancelledByActorName), cancelledAt: optional(row.cancelledAt), resolutionNote: optional(row.resolutionNote) })) as unknown as OpsFixture["workflowTasks"],
    workflowTaskSlaPauses: workflowTaskSlaPauses.map((row) => ({ ...row, ownerId: optional(row.ownerId), affectedClocks: stringArray(row.affectedClocksJson), expectedResumeAt: optional(row.expectedResumeAt), pausedByActorId: optional(row.pausedByActorId) })) as unknown as OpsFixture["workflowTaskSlaPauses"],
    workflowTaskSlaResumes: workflowTaskSlaResumes.map((row) => ({ ...row, resumedByActorId: optional(row.resumedByActorId), note: optional(row.note) })) as unknown as OpsFixture["workflowTaskSlaResumes"],
    exceptions: exceptions.map((row) => ({ ...row, storeId: optional(row.storeId), workOrderId: optional(row.workOrderId), visitId: optional(row.visitId), vendorId: optional(row.vendorId), resolvedAt: optional(row.resolvedAt) })) as unknown as OpsFixture["exceptions"],
    replacementProfiles: replacementProfiles.map((row) => ({ ...row, taxonomyNodeId: optional(row.taxonomyNodeId), matchKeys: stringArray(row.matchKeysJson), attributes: stringRecord(row.attributesJson), expectedLifeYears: optional(row.expectedLifeYears), annualEscalationBps: Number(row.annualEscalationBps), lowVarianceBps: Number(row.lowVarianceBps), highVarianceBps: Number(row.highVarianceBps) })) as unknown as OpsFixture["replacementProfiles"],
    assets: assets.map((row) => ({ ...row, taxonomyNodeId: optional(row.taxonomyNodeId), groupPath: stringArray(row.groupPathJson), manufacturer: optional(row.manufacturer), model: optional(row.model), serialNumber: optional(row.serialNumber), supplier: optional(row.supplier), installedAt: optional(row.installedAt), expectedLifeYears: optional(row.expectedLifeYears), warrantyEndsAt: optional(row.warrantyEndsAt), replacementProfileId: optional(row.replacementProfileId), replacementAttributes: stringRecord(row.replacementAttributesJson), replacementAdjustmentBps: optional(row.replacementAdjustmentBps), replacementEstimate: row.replacementEstimateMinor == null ? undefined : { amountMinor: Number(row.replacementEstimateMinor), currency: row.replacementCurrency ?? "USD" }, retiredAt: optional(row.retiredAt), replacedByAssetId: optional(row.replacedByAssetId) })) as unknown as OpsFixture["assets"],
    replacementBenchmarks: replacementBenchmarks.map((row) => ({ ...row, sourceWorkOrderId: optional(row.sourceWorkOrderId), sourceEstimateProposalId: optional(row.sourceEstimateProposalId), sourceAssetId: optional(row.sourceAssetId), sourceVendorId: optional(row.sourceVendorId), equipmentAmount: { amountMinor: Number(row.equipmentAmountMinor), currency: row.currency }, installationAmount: { amountMinor: Number(row.installationAmountMinor), currency: row.currency }, otherAmount: { amountMinor: Number(row.otherAmountMinor), currency: row.currency }, totalAmount: { amountMinor: Number(row.totalAmountMinor), currency: row.currency }, supersededAt: optional(row.supersededAt), notes: optional(row.notes) })) as unknown as OpsFixture["replacementBenchmarks"],
    assetReplacementOverrides: assetReplacementOverrides.map((row) => ({ ...row, sourceBenchmarkId: optional(row.sourceBenchmarkId), amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, supersededAt: optional(row.supersededAt) })) as unknown as OpsFixture["assetReplacementOverrides"],
    replacementEvents: replacementEvents.map((row) => ({ ...row, approvedAmount: { amountMinor: Number(row.approvedAmountMinor), currency: row.currency }, completedAt: optional(row.completedAt), finalAmount: row.finalAmountMinor == null ? undefined : { amountMinor: Number(row.finalAmountMinor), currency: row.currency }, replacementAssetId: optional(row.replacementAssetId) })) as unknown as OpsFixture["replacementEvents"],
    lifecycleRecommendations: lifecycleRecommendations.map((row) => ({ ...row, workOrderId: optional(row.workOrderId), inputsJson: jsonText(row.inputsJson), missingData: stringArray(row.missingDataJson), actualOutcome: optional(row.actualOutcome), actualOutcomeAt: optional(row.actualOutcomeAt), replacementEventId: optional(row.replacementEventId) })) as unknown as OpsFixture["lifecycleRecommendations"],
    components: components.map((row) => ({ ...row, parentComponentId: optional(row.parentComponentId), partNumber: optional(row.partNumber), serialNumber: optional(row.serialNumber), installedAt: optional(row.installedAt), warrantyEndsAt: optional(row.warrantyEndsAt) })) as unknown as OpsFixture["components"],
    maintenancePrograms: maintenancePrograms.map((row) => ({ ...row, applicableAssetTypes: stringArray(row.applicableAssetTypesJson), seasonalStartMonth: optional(row.seasonalStartMonth), seasonalEndMonth: optional(row.seasonalEndMonth), requiredEvidenceKinds: stringArray(row.requiredEvidenceKindsJson), supersedesProgramId: optional(row.supersedesProgramId) })) as unknown as OpsFixture["maintenancePrograms"],
    checklistTemplates: checklistTemplates.map((row) => ({ ...row, items: Array.isArray(row.itemsJson) ? row.itemsJson : [] })) as unknown as OpsFixture["checklistTemplates"],
    pmPlans: pmPlans.map((row) => ({ ...row, programId: optional(row.programId), programVersion: optional(row.programVersion), storeId: optional(row.storeId), assetId: optional(row.assetId), assetSelectionRule: optional(row.assetSelectionRule), categoryKey: optional(row.categoryKey), preferredVendorId: optional(row.preferredVendorId), backupVendorId: optional(row.backupVendorId), contractVersionId: optional(row.contractVersionId), effectiveStartsAt: optional(row.effectiveStartsAt), effectiveEndsAt: optional(row.effectiveEndsAt), accessRequirements: optional(row.accessRequirements), programAuthorizationMinor: optional(row.programAuthorizationMinor), budgetMinor: optional(row.budgetMinor), currency: optional(row.currency), serviceLevelPolicyId: optional(row.serviceLevelPolicyId), schedulingMode: optional(row.schedulingMode), escalationRules: optional(row.escalationRules) })) as unknown as OpsFixture["pmPlans"],
    pmOccurrences: pmOccurrences.map((row) => ({ ...row, assetId: optional(row.assetId), workOrderId: optional(row.workOrderId), programId: optional(row.programId), programVersion: optional(row.programVersion), planVersion: optional(row.planVersion), proposedAt: optional(row.proposedAt), committedAt: optional(row.committedAt), completedAt: optional(row.completedAt), result: optional(row.result), exceptionReason: optional(row.exceptionReason), recurrenceKey: optional(row.recurrenceKey), createdAt: optional(row.createdAt) })) as unknown as OpsFixture["pmOccurrences"],
    pmWorkItems: pmWorkItems.map((row) => ({ ...row, componentId: optional(row.componentId), result: optional(row.result), deficiency: optional(row.deficiency), followUpId: optional(row.followUpId), correctiveWorkOrderId: optional(row.correctiveWorkOrderId), costAllocationMinor: optional(row.costAllocationMinor), completedAt: optional(row.completedAt) })) as unknown as OpsFixture["pmWorkItems"],
    checklistResponses: checklistResponses.map((row) => ({ ...row, passed: optional(row.passed), numericValue: optional(row.numericValue), textValue: optional(row.textValue), measurementUnit: optional(row.measurementUnit), evidenceFileIds: stringArray(row.evidenceFileIdsJson), recordedByActorId: optional(row.recordedByActorId) })) as unknown as OpsFixture["checklistResponses"],
    serviceRuns: serviceRuns.map((row) => ({ ...row, expectedWorkValue: { amountMinor: Number(row.expectedWorkValueMinor), currency: row.currency }, estimatedOpportunity: { amountMinor: Number(row.estimatedOpportunityMinor), currency: row.currency }, requiredQualifications: stringArray(row.requiredQualificationsJson), constraintsJson: jsonText(row.constraintsJson), originalRecommendationJson: jsonText(row.originalRecommendationJson), createdByActorId: optional(row.createdByActorId), committedStartsAt: optional(row.committedStartsAt), committedEndsAt: optional(row.committedEndsAt), acceptedAt: optional(row.acceptedAt), completedAt: optional(row.completedAt) })) as unknown as OpsFixture["serviceRuns"],
    routeStops: routeStops.map((row) => ({ ...row, committedArrivalAt: optional(row.committedArrivalAt), accessRequirements: optional(row.accessRequirements), siteVisitId: optional(row.siteVisitId) })) as unknown as OpsFixture["routeStops"],
    serviceRunWorkOrders: serviceRunWorkOrders.map((row) => ({ ...row, occurrenceId: optional(row.occurrenceId), removalReason: optional(row.removalReason) })) as unknown as OpsFixture["serviceRunWorkOrders"],
    serviceRunResponses: serviceRunResponses.map((row) => ({ ...row, requestedStartsAt: optional(row.requestedStartsAt), requestedStopChangesJson: row.requestedStopChangesJson == null ? undefined : jsonText(row.requestedStopChangesJson), requestedWorkOrderChangesJson: row.requestedWorkOrderChangesJson == null ? undefined : jsonText(row.requestedWorkOrderChangesJson), reasonCode: optional(row.reasonCode), reasonDetail: optional(row.reasonDetail), economicImpact: { amountMinor: Number(row.economicImpactMinor), currency: row.currency }, resultingPlanJson: row.resultingPlanJson == null ? undefined : jsonText(row.resultingPlanJson) })) as unknown as OpsFixture["serviceRunResponses"],
    vendorWarrantyProfiles: vendorWarrantyProfiles.map((row) => ({ ...row, effectiveEndsAt: optional(row.effectiveEndsAt) })) as unknown as OpsFixture["vendorWarrantyProfiles"],
    warrantyRules: warrantyRules.map((row) => ({ ...row, contractVersionId: optional(row.contractVersionId), quoteId: optional(row.quoteId), authorizationId: optional(row.authorizationId), tradeKey: optional(row.tradeKey), workType: optional(row.workType), serviceType: optional(row.serviceType), assetType: optional(row.assetType), componentType: optional(row.componentType), manufacturer: optional(row.manufacturer), model: optional(row.model), vendorSuppliedPart: optional(row.vendorSuppliedPart), customerSuppliedPart: optional(row.customerSuppliedPart), regionId: optional(row.regionId), storeId: optional(row.storeId), effectiveEndsAt: optional(row.effectiveEndsAt) })) as unknown as OpsFixture["warrantyRules"],
    warrantyCoverageLines: warrantyCoverageLines.map((row) => ({ ...row, warrantyRuleId: optional(row.warrantyRuleId), vendorWarrantyProfileId: optional(row.vendorWarrantyProfileId), startDate: optional(row.startDate), endDate: optional(row.endDate), obligatedVendorId: optional(row.obligatedVendorId), deductible: { amountMinor: Number(row.deductibleMinor), currency: row.currency }, maximumCoverage: row.maximumCoverageMinor == null ? undefined : { amountMinor: Number(row.maximumCoverageMinor), currency: row.currency }, conditions: optional(row.conditions), exclusions: optional(row.exclusions) })) as unknown as OpsFixture["warrantyCoverageLines"],
    repairItems: repairItems.map((row) => ({ ...row, contractVersionId: optional(row.contractVersionId), componentId: optional(row.componentId), removedComponentId: optional(row.removedComponentId), installedComponentId: optional(row.installedComponentId), partManufacturer: optional(row.partManufacturer), partModel: optional(row.partModel), serialNumber: optional(row.serialNumber), verificationDate: optional(row.verificationDate), laborCost: { amountMinor: Number(row.laborCostMinor), currency: row.currency }, partCost: { amountMinor: Number(row.partCostMinor), currency: row.currency }, rootCause: optional(row.rootCause) })) as unknown as OpsFixture["repairItems"],
    appliedWarranties: appliedWarranties.map((row) => ({ ...row, obligatedVendorId: optional(row.obligatedVendorId), coveredCharges: stringArray(row.coveredChargesJson), contractVersionId: optional(row.contractVersionId), ruleSource: optional(row.ruleSource), originalCalculatedTermsJson: jsonText(row.originalCalculatedTermsJson) })) as unknown as OpsFixture["appliedWarranties"],
    warrantyAmendments: warrantyAmendments.map((row) => ({ ...row, amendedTermsJson: jsonText(row.amendedTermsJson) })) as unknown as OpsFixture["warrantyAmendments"],
    manufacturerWarranties: manufacturerWarranties.map((row) => ({ ...row, componentId: optional(row.componentId), model: optional(row.model), serialNumber: optional(row.serialNumber), authorizedProviderRule: optional(row.authorizedProviderRule), claimRequirements: optional(row.claimRequirements), installingVendorId: optional(row.installingVendorId), administrator: optional(row.administrator), supportingFileId: optional(row.supportingFileId) })) as unknown as OpsFixture["manufacturerWarranties"],
    warrantyCases: warrantyCases.map((row) => ({ ...row, requestId: optional(row.requestId), componentId: optional(row.componentId), priorRepairItemId: optional(row.priorRepairItemId), appliedWarrantyId: optional(row.appliedWarrantyId), manufacturerWarrantyId: optional(row.manufacturerWarrantyId), obligatedVendorId: optional(row.obligatedVendorId), vendorResponseDueAt: optional(row.vendorResponseDueAt), closedAt: optional(row.closedAt) })) as unknown as OpsFixture["warrantyCases"],
    quotes: quotes.map((row) => ({ ...row, contractVersionId: optional(row.contractVersionId), subtotal: { amountMinor: Number(row.subtotalMinor), currency: row.currency }, tax: { amountMinor: Number(row.taxMinor), currency: row.currency }, fees: { amountMinor: Number(row.feesMinor), currency: row.currency }, total: { amountMinor: Number(row.totalMinor), currency: row.currency }, expiresAt: optional(row.expiresAt), supersedesQuoteId: optional(row.supersedesQuoteId) })) as unknown as OpsFixture["quotes"],
    authorizations: authorizations.map((row) => ({ ...row, authorizedAmount: { amountMinor: Number(row.authorizedAmountMinor), currency: row.currency }, contractVersionId: optional(row.contractVersionId), supersedesAuthorizationId: optional(row.supersedesAuthorizationId) })) as unknown as OpsFixture["authorizations"],
    invoices: invoices.map((row) => ({ ...row, contractVersionId: optional(row.contractVersionId), subtotal: { amountMinor: Number(row.subtotalMinor), currency: row.currency }, tax: { amountMinor: Number(row.taxMinor), currency: row.currency }, fees: { amountMinor: Number(row.feesMinor), currency: row.currency }, total: { amountMinor: Number(row.totalMinor), currency: row.currency }, approvedForPayment: { amountMinor: Number(row.approvedForPaymentMinor), currency: row.currency }, paidAmount: { amountMinor: Number(row.paidAmountMinor), currency: row.currency }, exceptionReason: optional(row.exceptionReason), supportingFileId: optional(row.supportingFileId), submittedByMembershipId: optional(row.submittedByMembershipId) })) as unknown as OpsFixture["invoices"],
    invoiceLines: invoiceLines.map((row) => ({ ...row, unitAmount: { amountMinor: Number(row.unitAmountMinor), currency: row.currency }, lineAmount: { amountMinor: Number(row.lineAmountMinor), currency: row.currency }, contractRateCardLineId: optional(row.contractRateCardLineId) })) as unknown as OpsFixture["invoiceLines"],
    invoiceLineAllocations: invoiceLineAllocations.map((row) => ({ ...row, workItemId: optional(row.workItemId), repairItemId: optional(row.repairItemId), siteVisitWorkOrderId: optional(row.siteVisitWorkOrderId), assetId: optional(row.assetId), componentId: optional(row.componentId), tradeKey: optional(row.tradeKey), amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, confirmedByMembershipId: optional(row.confirmedByMembershipId), confirmedAt: optional(row.confirmedAt) })) as unknown as OpsFixture["invoiceLineAllocations"],
    invoiceExceptions: invoiceExceptions.map((row) => ({ ...row, invoiceLineId: optional(row.invoiceLineId), amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, resolvedAt: optional(row.resolvedAt), resolutionReason: optional(row.resolutionReason) })) as unknown as OpsFixture["invoiceExceptions"],
    invoiceAdjustments: invoiceAdjustments.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency } })) as unknown as OpsFixture["invoiceAdjustments"],
    serviceDiscrepancies: serviceDiscrepancies.map((row) => ({ ...row, invoiceId: optional(row.invoiceId), siteVisitWorkOrderId: optional(row.siteVisitWorkOrderId), factsJson: jsonText(row.factsJson), vendorResponse: optional(row.vendorResponse), resolution: optional(row.resolution), resolvedAt: optional(row.resolvedAt) })) as unknown as OpsFixture["serviceDiscrepancies"],
    valueEvents: valueEvents.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, workOrderId: optional(row.workOrderId), invoiceLineId: optional(row.invoiceLineId), serviceRunId: optional(row.serviceRunId), contractVersionId: optional(row.contractVersionId), warrantyCaseId: optional(row.warrantyCaseId), assetId: optional(row.assetId), approvalDecisionId: optional(row.approvalDecisionId) })) as unknown as OpsFixture["valueEvents"],
    costLines: costLines.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency } })) as unknown as OpsFixture["costLines"],
    invoiceReferences: invoiceReferences.map((row) => ({ ...row, grossAmount: { amountMinor: Number(row.grossAmountMinor), currency: row.currency }, operatorWorkOrderNumber: optional(row.operatorWorkOrderNumber) })) as unknown as OpsFixture["invoiceReferences"],
    invoiceAllocations: invoiceAllocations.map((row) => ({ ...row, amount: { amountMinor: Number(row.amountMinor), currency: row.currency }, confirmedByMembershipId: optional(row.confirmedByMembershipId), confirmedAt: optional(row.confirmedAt) })) as unknown as OpsFixture["invoiceAllocations"],
    auditEvents: auditEvents.map((row) => ({ ...row, actorId: optional(row.actorId), payloadJson: jsonText(row.payloadJson) })) as unknown as OpsFixture["auditEvents"],
    outboxMessages: outboxMessages.map((row) => ({ ...row, payloadJson: jsonText(row.payloadJson) })) as unknown as OpsFixture["outboxMessages"],
    publicTokens: publicTokens.map((row) => ({ ...row, usedAt: optional(row.usedAt), revokedAt: optional(row.revokedAt) })) as unknown as OpsFixture["publicTokens"],
  };
}
