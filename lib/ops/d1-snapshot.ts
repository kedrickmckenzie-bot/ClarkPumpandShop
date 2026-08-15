import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  opsAssetComponents,
  opsAssets,
  opsAssetReplacementOverrides,
  opsAuditEvents,
  opsCostLines,
  opsComponentTemplates,
  opsDivisions,
  opsEntityFiles,
  opsExceptions,
  opsEquipmentTemplates,
  opsFiles,
  opsFollowUps,
  opsInvoiceAllocations,
  opsInvoiceReferences,
  opsMemberships,
  opsOrganizations,
  opsOutboxMessages,
  opsPmOccurrences,
  opsPmPlans,
  opsPublicTokens,
  opsRegions,
  opsRequests,
  opsReplacementBenchmarks,
  opsReplacementEvents,
  opsReplacementProfiles,
  opsScopeGrants,
  opsStores,
  opsTaxonomyNodes,
  opsUsers,
  opsVendorCoverage,
  opsVendorEstimateProposals,
  opsVendorResponses,
  opsVendorSpecialties,
  opsVendors,
  opsVisitEvidence,
  opsVisitSessions,
  opsWorkOrderAssignments,
  opsWorkOrderEstimateRequests,
  opsWorkOrderIssuances,
  opsWorkOrders,
} from "../../db/ops-schema";
import type { IsoDateTime, OpsFixture, OpsId } from "./types";

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseStringRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch { return {}; }
}

function locationCapturedAt(payloadJson: string, fallback: IsoDateTime) {
  try {
    const parsed = JSON.parse(payloadJson) as { capturedAt?: unknown; clientCapturedAt?: unknown };
    const capturedAt = parsed.clientCapturedAt ?? parsed.capturedAt;
    return typeof capturedAt === "string" ? capturedAt : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Compatibility projection for the current presentation layer.
 *
 * The durable source remains D1 and every query is tenant-bounded. New
 * production views should use OpsRepository read models instead of expanding
 * this snapshot facade; it exists so the current presenter can move off the
 * process-local fixture without making writes disappear across isolates.
 */
export async function loadOpsFixtureSnapshotFromD1(
  binding: D1Database,
  organizationId: OpsId,
  asOf: IsoDateTime,
): Promise<OpsFixture> {
  const db = drizzle(binding);
  const tenant = <TColumn extends { _: { data: string } }>(column: TColumn) => eq(column as never, organizationId);

  const [
    organizations,
    divisionRows,
    regionRows,
    taxonomyRows,
    equipmentTemplateRows,
    componentTemplateRows,
    storeRows,
    userRows,
    membershipRows,
    scopeGrantRows,
    vendorRows,
    specialtyRows,
    coverageRows,
    requestRows,
    workOrderRows,
    assignmentRows,
    issuanceRows,
    responseRows,
    estimateRequestRows,
    estimateProposalRows,
    visitRows,
    evidenceRows,
    fileRows,
    entityFileRows,
    followUpRows,
    exceptionRows,
    replacementProfileRows,
    assetRows,
    replacementBenchmarkRows,
    replacementOverrideRows,
    replacementEventRows,
    componentRows,
    pmPlanRows,
    pmOccurrenceRows,
    costRows,
    invoiceRows,
    allocationRows,
    auditRows,
    outboxRows,
    tokenRows,
  ] = await Promise.all([
    db.select().from(opsOrganizations).where(eq(opsOrganizations.id, organizationId)),
    db.select().from(opsDivisions).where(tenant(opsDivisions.organizationId)),
    db.select().from(opsRegions).where(tenant(opsRegions.organizationId)),
    db.select().from(opsTaxonomyNodes).where(tenant(opsTaxonomyNodes.organizationId)),
    db.select().from(opsEquipmentTemplates).where(tenant(opsEquipmentTemplates.organizationId)),
    db.select().from(opsComponentTemplates).where(tenant(opsComponentTemplates.organizationId)),
    db.select().from(opsStores).where(tenant(opsStores.organizationId)),
    db.select({ id: opsUsers.id, email: opsUsers.email, displayName: opsUsers.displayName, status: opsUsers.status, createdAt: opsUsers.createdAt })
      .from(opsUsers)
      .innerJoin(opsMemberships, and(eq(opsMemberships.userId, opsUsers.id), eq(opsMemberships.organizationId, organizationId))),
    db.select().from(opsMemberships).where(tenant(opsMemberships.organizationId)),
    db.select().from(opsScopeGrants).where(tenant(opsScopeGrants.organizationId)),
    db.select().from(opsVendors).where(tenant(opsVendors.organizationId)),
    db.select().from(opsVendorSpecialties).where(tenant(opsVendorSpecialties.organizationId)),
    db.select().from(opsVendorCoverage).where(tenant(opsVendorCoverage.organizationId)),
    db.select().from(opsRequests).where(tenant(opsRequests.organizationId)),
    db.select().from(opsWorkOrders).where(tenant(opsWorkOrders.organizationId)),
    db.select().from(opsWorkOrderAssignments).where(tenant(opsWorkOrderAssignments.organizationId)),
    db.select().from(opsWorkOrderIssuances).where(tenant(opsWorkOrderIssuances.organizationId)),
    db.select().from(opsVendorResponses).where(tenant(opsVendorResponses.organizationId)),
    db.select().from(opsWorkOrderEstimateRequests).where(tenant(opsWorkOrderEstimateRequests.organizationId)),
    db.select().from(opsVendorEstimateProposals).where(tenant(opsVendorEstimateProposals.organizationId)),
    db.select().from(opsVisitSessions).where(tenant(opsVisitSessions.organizationId)),
    db.select().from(opsVisitEvidence).where(tenant(opsVisitEvidence.organizationId)),
    db.select().from(opsFiles).where(tenant(opsFiles.organizationId)),
    db.select().from(opsEntityFiles).where(tenant(opsEntityFiles.organizationId)),
    db.select().from(opsFollowUps).where(tenant(opsFollowUps.organizationId)),
    db.select().from(opsExceptions).where(tenant(opsExceptions.organizationId)),
    db.select().from(opsReplacementProfiles).where(tenant(opsReplacementProfiles.organizationId)),
    db.select().from(opsAssets).where(tenant(opsAssets.organizationId)),
    db.select().from(opsReplacementBenchmarks).where(tenant(opsReplacementBenchmarks.organizationId)),
    db.select().from(opsAssetReplacementOverrides).where(tenant(opsAssetReplacementOverrides.organizationId)),
    db.select().from(opsReplacementEvents).where(tenant(opsReplacementEvents.organizationId)),
    db.select().from(opsAssetComponents).where(tenant(opsAssetComponents.organizationId)),
    db.select().from(opsPmPlans).where(tenant(opsPmPlans.organizationId)),
    db.select().from(opsPmOccurrences).where(tenant(opsPmOccurrences.organizationId)),
    db.select().from(opsCostLines).where(tenant(opsCostLines.organizationId)),
    db.select().from(opsInvoiceReferences).where(tenant(opsInvoiceReferences.organizationId)),
    db.select().from(opsInvoiceAllocations).where(tenant(opsInvoiceAllocations.organizationId)),
    db.select().from(opsAuditEvents).where(tenant(opsAuditEvents.organizationId)),
    db.select().from(opsOutboxMessages).where(tenant(opsOutboxMessages.organizationId)),
    db.select().from(opsPublicTokens).where(tenant(opsPublicTokens.organizationId)),
  ]);

  const users = [...new Map(userRows.map((row) => [row.id, row])).values()];
  return {
    asOf,
    organizations: organizations as OpsFixture["organizations"],
    divisions: divisionRows as OpsFixture["divisions"],
    regions: regionRows.map((row) => ({ ...row, divisionId: optional(row.divisionId) })) as OpsFixture["regions"],
    taxonomyNodes: taxonomyRows.map((row) => ({ ...row, parentNodeId: optional(row.parentNodeId), canonicalKey: optional(row.canonicalKey), aliases: parseStringArray(row.aliasesJson) })) as OpsFixture["taxonomyNodes"],
    equipmentTemplates: equipmentTemplateRows.map((row) => ({ ...row, defaultExpectedLifeYears: optional(row.defaultExpectedLifeYears) })) as OpsFixture["equipmentTemplates"],
    componentTemplates: componentTemplateRows.map((row) => ({ ...row, parentComponentTemplateId: optional(row.parentComponentTemplateId) })) as OpsFixture["componentTemplates"],
    stores: storeRows.map((row) => ({
      ...row,
      divisionId: optional(row.divisionId),
      regionId: optional(row.regionId),
      address2: optional(row.address2),
      aliases: parseStringArray(row.aliasesJson),
      latitudeE6: optional(row.latitudeE6),
      longitudeE6: optional(row.longitudeE6),
      timeZone: optional(row.timeZone),
    })) as OpsFixture["stores"],
    users: users as OpsFixture["users"],
    memberships: membershipRows as OpsFixture["memberships"],
    scopeGrants: scopeGrantRows as OpsFixture["scopeGrants"],
    vendors: vendorRows.map((row) => ({ ...row, dispatchPhone: optional(row.dispatchPhone) })) as OpsFixture["vendors"],
    vendorSpecialties: specialtyRows.map((row) => ({ ...row, searchAliases: parseStringArray(row.searchAliasesJson) })) as OpsFixture["vendorSpecialties"],
    vendorCoverage: coverageRows.map((row) => ({ ...row, preferredRank: optional(row.preferredRank) })) as OpsFixture["vendorCoverage"],
    requests: requestRows.map((row) => ({ ...row, reporterEmployeeId: optional(row.reporterEmployeeId), convertedWorkOrderId: optional(row.convertedWorkOrderId) })) as OpsFixture["requests"],
    workOrders: workOrderRows.map((row) => ({
      ...row,
      version: Number(row.version ?? 0),
      requestId: optional(row.requestId),
      authorizedScope: optional(row.authorizedScope),
      categoryKey: optional(row.categoryKey),
      taxonomyNodeId: optional(row.taxonomyNodeId),
      assetId: optional(row.assetId),
      componentId: optional(row.componentId),
      dueAt: optional(row.dueAt),
      escalationTo: optional(row.escalationTo),
      nte: row.nteAmountMinor == null ? undefined : { amountMinor: row.nteAmountMinor, currency: row.nteCurrency ?? "USD" },
      repairEstimate: row.repairEstimateAmountMinor == null ? undefined : { amountMinor: row.repairEstimateAmountMinor, currency: row.repairEstimateCurrency ?? "USD" },
      estimatedServiceExtensionMonths: optional(row.estimatedServiceExtensionMonths),
      vendorServiceTicketNumber: optional(row.vendorServiceTicketNumber),
      vendorInvoiceNumber: optional(row.vendorInvoiceNumber),
      externalAccountingPo: optional(row.externalAccountingPo),
      closedAt: optional(row.closedAt),
    })) as OpsFixture["workOrders"],
    assignments: assignmentRows.map((row) => ({ ...row, vendorId: optional(row.vendorId), internalMembershipId: optional(row.internalMembershipId), supersedesAssignmentId: optional(row.supersedesAssignmentId) })) as OpsFixture["assignments"],
    issuances: issuanceRows as OpsFixture["issuances"],
    vendorResponses: responseRows.map((row) => ({ ...row, proposedAt: optional(row.proposedAt), message: optional(row.message) })) as OpsFixture["vendorResponses"],
    estimateRequests: estimateRequestRows.map((row) => ({ ...row, dueAt: optional(row.dueAt), openedAt: optional(row.openedAt), respondedAt: optional(row.respondedAt), decisionAt: optional(row.decisionAt) })) as OpsFixture["estimateRequests"],
    estimateProposals: estimateProposalRows.map((row) => ({ ...row, amount: { amountMinor: row.amountMinor, currency: row.currency }, exclusions: optional(row.exclusions), leadTimeDays: optional(row.leadTimeDays), validUntil: optional(row.validUntil) })) as OpsFixture["estimateProposals"],
    visits: visitRows.map((row) => ({
      ...row,
      vendorId: optional(row.vendorId),
      internalMembershipId: optional(row.internalMembershipId),
      workOrderId: optional(row.workOrderId),
      unmatchedReason: optional(row.unmatchedReason),
      endedChannel: optional(row.endedChannel),
      checkedOutAt: optional(row.checkedOutAt),
      outcome: optional(row.outcome),
      outcomeNotes: optional(row.outcomeNotes),
      observedDurationSeconds: optional(row.observedDurationSeconds),
    })) as OpsFixture["visits"],
    visitEvidence: evidenceRows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      visitId: row.visitId,
      kind: row.kind,
      channel: row.channel,
      observedAt: row.observedAt,
      payloadJson: row.payloadJson,
      location: row.locationResult ? {
        result: row.locationResult,
        latitudeE6: optional(row.latitudeE6),
        longitudeE6: optional(row.longitudeE6),
        accuracyM: optional(row.accuracyM),
        distanceM: optional(row.distanceM),
        capturedAt: locationCapturedAt(row.payloadJson, row.observedAt),
      } : undefined,
    })) as OpsFixture["visitEvidence"],
    files: fileRows as OpsFixture["files"],
    entityFiles: entityFileRows as OpsFixture["entityFiles"],
    followUps: followUpRows.map((row) => ({ ...row, sourceVisitId: optional(row.sourceVisitId), completedAt: optional(row.completedAt) })) as OpsFixture["followUps"],
    exceptions: exceptionRows.map((row) => ({ ...row, storeId: optional(row.storeId), workOrderId: optional(row.workOrderId), visitId: optional(row.visitId), vendorId: optional(row.vendorId) })) as OpsFixture["exceptions"],
    replacementProfiles: replacementProfileRows.map((row) => ({ ...row, taxonomyNodeId: optional(row.taxonomyNodeId), matchKeys: parseStringArray(row.matchKeysJson), attributes: parseStringRecord(row.attributesJson), expectedLifeYears: optional(row.expectedLifeYears) })) as OpsFixture["replacementProfiles"],
    assets: assetRows.map((row) => ({
      ...row,
      taxonomyNodeId: optional(row.taxonomyNodeId),
      groupPath: parseStringArray(row.groupPathJson),
      manufacturer: optional(row.manufacturer),
      model: optional(row.model),
      serialNumber: optional(row.serialNumber),
      supplier: optional(row.supplier),
      installedAt: optional(row.installedAt),
      expectedLifeYears: optional(row.expectedLifeYears),
      warrantyEndsAt: optional(row.warrantyEndsAt),
      replacementProfileId: optional(row.replacementProfileId),
      replacementAttributes: parseStringRecord(row.replacementAttributesJson),
      replacementAdjustmentBps: optional(row.replacementAdjustmentBps),
      replacementEstimate: row.replacementEstimateMinor == null ? undefined : { amountMinor: row.replacementEstimateMinor, currency: row.replacementCurrency ?? "USD" },
      retiredAt: optional(row.retiredAt),
      replacedByAssetId: optional(row.replacedByAssetId),
    })) as OpsFixture["assets"],
    replacementBenchmarks: replacementBenchmarkRows.map((row) => ({ ...row, sourceWorkOrderId: optional(row.sourceWorkOrderId), sourceEstimateProposalId: optional(row.sourceEstimateProposalId), sourceAssetId: optional(row.sourceAssetId), sourceVendorId: optional(row.sourceVendorId), equipmentAmount: { amountMinor: row.equipmentAmountMinor, currency: row.currency }, installationAmount: { amountMinor: row.installationAmountMinor, currency: row.currency }, otherAmount: { amountMinor: row.otherAmountMinor, currency: row.currency }, totalAmount: { amountMinor: row.totalAmountMinor, currency: row.currency }, supersededAt: optional(row.supersededAt), notes: optional(row.notes) })) as OpsFixture["replacementBenchmarks"],
    assetReplacementOverrides: replacementOverrideRows.map((row) => ({ ...row, sourceBenchmarkId: optional(row.sourceBenchmarkId), amount: { amountMinor: row.amountMinor, currency: row.currency }, supersededAt: optional(row.supersededAt) })) as OpsFixture["assetReplacementOverrides"],
    replacementEvents: replacementEventRows.map((row) => ({ ...row, approvedAmount: { amountMinor: row.approvedAmountMinor, currency: row.currency }, completedAt: optional(row.completedAt), finalAmount: row.finalAmountMinor == null ? undefined : { amountMinor: row.finalAmountMinor, currency: row.currency }, replacementAssetId: optional(row.replacementAssetId) })) as OpsFixture["replacementEvents"],
    components: componentRows.map((row) => ({ ...row, parentComponentId: optional(row.parentComponentId), partNumber: optional(row.partNumber), serialNumber: optional(row.serialNumber), installedAt: optional(row.installedAt), warrantyEndsAt: optional(row.warrantyEndsAt) })) as OpsFixture["components"],
    pmPlans: pmPlanRows.map((row) => ({ ...row, storeId: optional(row.storeId), assetId: optional(row.assetId), categoryKey: optional(row.categoryKey) })) as OpsFixture["pmPlans"],
    pmOccurrences: pmOccurrenceRows.map((row) => ({ ...row, assetId: optional(row.assetId), workOrderId: optional(row.workOrderId), completedAt: optional(row.completedAt) })) as OpsFixture["pmOccurrences"],
    costLines: costRows.map((row) => ({ ...row, amount: { amountMinor: row.amountMinor, currency: row.currency } })) as OpsFixture["costLines"],
    invoiceReferences: invoiceRows.map((row) => ({ ...row, grossAmount: { amountMinor: row.grossAmountMinor, currency: row.currency }, operatorWorkOrderNumber: optional(row.operatorWorkOrderNumber) })) as OpsFixture["invoiceReferences"],
    invoiceAllocations: allocationRows.map((row) => ({ ...row, amount: { amountMinor: row.amountMinor, currency: row.currency }, confirmedByMembershipId: optional(row.confirmedByMembershipId), confirmedAt: optional(row.confirmedAt) })) as OpsFixture["invoiceAllocations"],
    auditEvents: auditRows.map((row) => ({ ...row, actorId: optional(row.actorId) })) as OpsFixture["auditEvents"],
    outboxMessages: outboxRows as OpsFixture["outboxMessages"],
    publicTokens: tokenRows.map((row) => ({ ...row, usedAt: optional(row.usedAt), revokedAt: optional(row.revokedAt) })) as OpsFixture["publicTokens"],
  };
}
