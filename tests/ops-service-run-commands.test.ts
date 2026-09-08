import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { checkInVisit, checkOutVisit } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import {
  acceptServiceRunCounter,
  createServiceRunRecommendation,
  respondToServiceRun,
} from "@/lib/ops/service-run-commands";

const SUMMIT = "vendor-northline-summit";
const CONTRACT = "contract-version-summit-1";
const TOKEN_HASH = "f".repeat(64);
const START = "2026-08-24T13:00:00.000Z";

const schedulerActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function harness() {
  const fixture = buildNorthlinePresentationFixture();
  const createdAt = "2026-08-20T12:00:00.000Z";
  fixture.workOrders.push(
    { id: "wo-run-104", organizationId: NORTHLINE_ORGANIZATION_ID, number: "CPS-2026-R104", storeId: "store-northline-104", problem: "Beer cave door seal inspection", categoryKey: "refrigeration", priority: "planned", status: "accepted", version: 0, accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Schedule accepted service", dueAt: "2026-08-26T15:00:00.000Z", escalationTo: "Facilities coordinator", nte: { amountMinor: 75_000, currency: "USD" }, createdAt },
    { id: "wo-run-105", organizationId: NORTHLINE_ORGANIZATION_ID, number: "CPS-2026-R105", storeId: "store-northline-105", problem: "Walk-in evaporator inspection", categoryKey: "refrigeration", priority: "planned", status: "accepted", version: 0, accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Schedule accepted service", dueAt: "2026-08-26T15:00:00.000Z", escalationTo: "Facilities coordinator", nte: { amountMinor: 95_000, currency: "USD" }, createdAt },
  );
  fixture.assignments.push(
    { id: "assignment-run-104", organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-run-104", kind: "outside_vendor", vendorId: SUMMIT, status: "accepted", assignedAt: createdAt },
    { id: "assignment-run-105", organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-run-105", kind: "outside_vendor", vendorId: SUMMIT, status: "accepted", assignedAt: createdAt },
  );
  fixture.pmPlans.push({
    id: "pm-plan-run-105",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    name: "Run test refrigeration PM",
    programId: "maintenance-program-quarterly-refrigeration-v1",
    programVersion: 1,
    storeId: "store-northline-105",
    assetId: "asset-105-beer-cave",
    categoryKey: "refrigeration",
    cadenceDays: 90,
    completionWindowDays: 7,
    preferredVendorId: SUMMIT,
    contractVersionId: CONTRACT,
    effectiveStartsAt: "2026-01-01T00:00:00.000Z",
    effectiveEndsAt: "2026-12-31T23:59:59.999Z",
    accessRequirements: "Roof hatch key at manager office",
    programAuthorizationMinor: 95_000,
    currency: "USD",
    schedulingMode: "platform_proposed_vendor_confirmed",
    active: true,
    createdAt,
  });
  fixture.pmOccurrences.push({
    id: "pm-occurrence-run-105",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    planId: "pm-plan-run-105",
    storeId: "store-northline-105",
    assetId: "asset-105-beer-cave",
    workOrderId: "wo-run-105",
    programId: "maintenance-program-quarterly-refrigeration-v1",
    programVersion: 1,
    planVersion: 1,
    dueAt: "2026-08-24T15:30:00.000Z",
    windowStartsAt: "2026-08-24T13:00:00.000Z",
    windowEndsAt: "2026-08-24T18:00:00.000Z",
    status: "proposed",
    createdAt,
  });
  fixture.vendorContracts.push({ id: "contract-summit", organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: SUMMIT, name: "Northline refrigeration services", ownerMembershipId: schedulerActor.actorId, status: "active", createdAt });
  fixture.contractVersions.push({
    id: CONTRACT, organizationId: NORTHLINE_ORGANIZATION_ID, contractId: "contract-summit", vendorId: SUMMIT,
    version: 1, sourceAgreementReference: "MSA-SUMMIT-2026", status: "active",
    effectiveStartsAt: "2026-01-01T00:00:00.000Z", effectiveEndsAt: "2026-12-31T23:59:59.999Z",
    currency: "USD", preferredProvider: true, exclusiveProvider: false, reactiveWorkAllowed: true,
    emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required",
    schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 0,
    nteAmount: { amountMinor: 500_000, currency: "USD" }, materialsMarkupBps: 1500, routeDiscountBps: 1000,
    evidenceRequirements: ["check_in", "check_out", "photo"], complianceRequirements: ["insurance", "license"],
    warrantyLaborDays: 90, warrantyPartsDays: 365, warrantyTravelDays: 30,
    createdByMembershipId: schedulerActor.actorId, createdAt,
  });
  fixture.contractScopes.push(
    { id: "scope-contract-org", organizationId: NORTHLINE_ORGANIZATION_ID, contractVersionId: CONTRACT, scopeKind: "organization", scopeId: NORTHLINE_ORGANIZATION_ID, included: true },
    { id: "scope-contract-trade", organizationId: NORTHLINE_ORGANIZATION_ID, contractVersionId: CONTRACT, scopeKind: "trade", scopeId: "refrigeration", included: true },
  );
  fixture.rateCardLines.push({ id: "rate-trip-summit", organizationId: NORTHLINE_ORGANIZATION_ID, contractVersionId: CONTRACT, chargeType: "trip", description: "Refrigeration dispatch", unit: "visit", amount: { amountMinor: 12_500, currency: "USD" }, effectiveStartsAt: "2026-01-01T00:00:00.000Z" });
  fixture.schedulingPolicies.push({ id: "schedule-policy-summit", organizationId: NORTHLINE_ORGANIZATION_ID, contractVersionId: CONTRACT, maximumRouteMinutes: 600, maximumStores: 5, maximumTravelMinutes: 180, maximumUtilizationBps: 8000, perStopBufferMinutes: 15, travelBufferBps: 2000, documentationBufferMinutes: 10, uncertaintyBufferBps: 3000, emergencyReserveMinutes: 60 });
  fixture.vendorQualifications.push({ id: "qualification-summit-refrigeration", organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: SUMMIT, tradeKey: "refrigeration", pmWork: true, emergencyResponse: true, warrantyWork: true, regionId: "region-northline-north", afterHours: true, effectiveAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z", status: "active", createdAt });
  fixture.vendorComplianceDocuments.push(
    { id: "compliance-summit-insurance", organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: SUMMIT, documentType: "insurance", reviewStatus: "approved", blocking: true, effectiveAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z", createdAt },
    { id: "compliance-summit-license", organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: SUMMIT, documentType: "license", reviewStatus: "approved", blocking: true, effectiveAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z", createdAt },
  );
  fixture.vendorCapacity.push({ id: "capacity-summit-north-refrigeration", organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: SUMMIT, regionId: "region-northline-north", tradeKey: "refrigeration", startsAt: "2026-08-24T00:00:00.000Z", endsAt: "2026-08-24T23:59:59.999Z", crewMinutes: 600, committedMinutes: 0, maximumRouteMinutes: 600, maximumStores: 5, maximumTravelMinutes: 180, blackout: false, emergencyReserveMinutes: 60, variableWorkLimitMinutes: 180, specialEquipment: ["refrigerant-recovery"], createdAt });
  const repository = createOpsFixtureRepository(fixture);
  let now = "2026-08-20T13:00:00.000Z";
  let sequence = 0;
  const services: OpsCommandServices = { repository, clock: { now: () => now }, ids: { next: (prefix) => `${prefix}-run-test-${++sequence}` } };
  return { repository, services, setNow(value: string) { now = value; } };
}

function recommendationInput() {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    vendorId: SUMMIT,
    contractVersionId: CONTRACT,
    schedulingMode: "platform_proposed_vendor_confirmed" as const,
    proposedStartsAt: START,
    responseDueAt: "2026-08-22T13:00:00.000Z",
    stops: [
      { storeId: "store-northline-104", sequence: 1, estimatedDriveMinutes: 30, accessRequirements: "Meet store manager at service entrance" },
      { storeId: "store-northline-105", sequence: 2, estimatedDriveMinutes: 25, accessRequirements: "Roof hatch key at manager office" },
    ],
    work: [
      { workOrderId: "wo-run-104", estimatedDurationMinutes: 60, confidence: "high" as const, requiredEquipment: ["refrigerant-recovery"] },
      { workOrderId: "wo-run-105", occurrenceId: "pm-occurrence-run-105", estimatedDurationMinutes: 90, confidence: "medium" as const, requiredEquipment: ["refrigerant-recovery"] },
    ],
    publicToken: { tokenHash: TOKEN_HASH, expiresAt: "2026-08-22T13:00:00.000Z" },
    actor: schedulerActor,
  };
}

describe("directive-complete Service Run scheduling contract", () => {
  it("persists an explained protected recommendation, response obligations, and estimated—not realized—value", async () => {
    const test = harness();
    const result = await createServiceRunRecommendation(recommendationInput(), test.services);
    const snapshot = test.repository.snapshot();

    expect(result.run).toMatchObject({ status: "proposed", estimatedTripReduction: 1, confidence: "medium", schedulerVersion: "directive-11.8-v1" });
    expect(result.run.capacityUsedMinutes).toBeGreaterThan(205);
    expect(result.run.estimatedOpportunity).toEqual({ amountMinor: 11_250, currency: "USD" });
    expect(result.run.recommendationExplanation).toContain("protects");
    expect(JSON.parse(result.run.constraintsJson)).toMatchObject({ qualifications: true, compliance: true, dueWindows: true, capacity: true });
    expect(result.stops.map((row) => row.storeId)).toEqual(["store-northline-104", "store-northline-105"]);
    expect(result.work).toHaveLength(2);
    expect(snapshot.workflowTasks.filter((task) => task.reason.includes(result.run.id) && task.taskType === "schedule_service")).toHaveLength(2);
    expect(snapshot.auditEvents.some((event) => event.aggregateId === result.run.id && event.eventType === "service_run.proposed" && event.payloadJson.includes("estimated_opportunity"))).toBe(true);
  });

  it("records an immutable counter with derived impacts and commits only after internal acceptance", async () => {
    const test = harness();
    const result = await createServiceRunRecommendation(recommendationInput(), test.services);
    test.setNow("2026-08-21T13:00:00.000Z");
    const response = await respondToServiceRun({
      tokenHash: TOKEN_HASH, response: "countered", responderName: "Morgan Ellis",
      requestedStartsAt: "2026-08-24T14:00:00.000Z", requestedStopOrder: ["store-northline-105", "store-northline-104"],
      reasonCode: "crew_start_window", reasonDetail: "Crew completes an emergency call before this route.",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit secure link" },
    }, test.services);
    expect(test.repository.snapshot().serviceRuns.find((run) => run.id === result.run.id)?.status).toBe("countered");
    expect(JSON.parse(result.run.originalRecommendationJson).proposedStartsAt).toBe(START);
    expect(response.resultingPlanJson).toContain("2026-08-24T14:00:00.000Z");

    test.setNow("2026-08-21T14:00:00.000Z");
    const committed = await acceptServiceRunCounter({ organizationId: NORTHLINE_ORGANIZATION_ID, serviceRunId: result.run.id, responseId: response.id, actor: schedulerActor }, test.services);
    expect(committed).toMatchObject({ status: "committed", committedStartsAt: "2026-08-24T14:00:00.000Z" });
    const snapshot = test.repository.snapshot();
    expect(snapshot.serviceRunResponses).toHaveLength(1);
    expect(snapshot.serviceRuns.find((run) => run.id === result.run.id)?.originalRecommendationJson).toBe(result.run.originalRecommendationJson);
    expect(snapshot.workOrders.filter((workOrder) => ["wo-run-104", "wo-run-105"].includes(workOrder.id)).every((workOrder) => workOrder.status === "scheduled")).toBe(true);
    expect(snapshot.workflowTasks.filter((task) => task.reason.includes(result.run.id) && task.taskType === "confirm_store_access")).toHaveLength(2);
    const committedStops = snapshot.routeStops.filter((stop) => stop.serviceRunId === result.run.id).sort((left, right) => left.sequence - right.sequence);
    expect(committedStops.map((stop) => [stop.storeId, stop.committedArrivalAt])).toEqual([
      ["store-northline-105", "2026-08-24T14:36:00.000Z"],
      ["store-northline-104", "2026-08-24T16:40:00.000Z"],
    ]);
    expect(snapshot.pmOccurrences.find((occurrence) => occurrence.id === "pm-occurrence-run-105")?.committedAt).toBe("2026-08-24T14:36:00.000Z");
    expect(response.travelImpactMinutes).toBe(0);
    expect(JSON.parse(response.resultingPlanJson!).travelImpactStatus).toBe("not_calculated");
  });

  it("validates a counter against each shifted stop arrival rather than the run start", async () => {
    const test = harness();
    const result = await createServiceRunRecommendation(recommendationInput(), test.services);
    await test.repository.atomicWrite([{
      sql: "UPDATE ops_pm_occurrences SET window_starts_at = ?, window_ends_at = ? WHERE organization_id = ? AND id = ?",
      params: ["2026-08-24T16:45:00.000Z", "2026-08-24T17:15:00.000Z", NORTHLINE_ORGANIZATION_ID, "pm-occurrence-run-105"],
    }]);
    test.setNow("2026-08-21T13:00:00.000Z");
    const response = await respondToServiceRun({
      tokenHash: TOKEN_HASH,
      response: "countered",
      responderName: "Morgan Ellis",
      requestedStartsAt: "2026-08-24T14:30:00.000Z",
      reasonCode: "crew_start_window",
      reasonDetail: "Crew can start ninety minutes later.",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit secure link" },
    }, test.services);
    expect(response.dueWindowImpactCount).toBe(0);

    test.setNow("2026-08-21T14:00:00.000Z");
    await expect(acceptServiceRunCounter({ organizationId: NORTHLINE_ORGANIZATION_ID, serviceRunId: result.run.id, responseId: response.id, actor: schedulerActor }, test.services)).resolves.toMatchObject({ status: "committed" });
    expect(test.repository.snapshot().pmOccurrences.find((occurrence) => occurrence.id === "pm-occurrence-run-105")?.committedAt).toBe("2026-08-24T17:10:00.000Z");
  });

  it("rejects a counter that moves only the PM stop outside its immutable window", async () => {
    const test = harness();
    await createServiceRunRecommendation(recommendationInput(), test.services);
    await test.repository.atomicWrite([{
      sql: "UPDATE ops_pm_occurrences SET window_starts_at = ?, window_ends_at = ? WHERE organization_id = ? AND id = ?",
      params: ["2026-08-24T15:15:00.000Z", "2026-08-24T15:45:00.000Z", NORTHLINE_ORGANIZATION_ID, "pm-occurrence-run-105"],
    }]);
    test.setNow("2026-08-21T13:00:00.000Z");
    const response = await respondToServiceRun({
      tokenHash: TOKEN_HASH,
      response: "countered",
      responderName: "Morgan Ellis",
      requestedStopOrder: ["store-northline-105", "store-northline-104"],
      reasonCode: "stop_order",
      reasonDetail: "Crew requested the reverse store order.",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit secure link" },
    }, test.services);
    expect(response.dueWindowImpactCount).toBe(1);

    test.setNow("2026-08-21T14:00:00.000Z");
    await expect(acceptServiceRunCounter({ organizationId: NORTHLINE_ORGANIZATION_ID, serviceRunId: response.serviceRunId, responseId: response.id, actor: schedulerActor }, test.services)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("outside its due window"),
    });
  });

  it("blocks expired mandatory compliance before a recommendation can become a dead control", async () => {
    const test = harness();
    const before = test.repository.snapshot().serviceRuns.length;
    await test.repository.atomicWrite([{ sql: "UPDATE ops_vendor_compliance_documents SET expires_at = ? WHERE organization_id = ? AND id = ?", params: ["2026-08-23T00:00:00.000Z", NORTHLINE_ORGANIZATION_ID, "compliance-summit-insurance"] }]);
    await expect(createServiceRunRecommendation(recommendationInput(), test.services)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("insurance") });
    expect(test.repository.snapshot().serviceRuns).toHaveLength(before);
  });

  it("carries an accepted Run through Store visits and marks each exact Work Order addressed", async () => {
    const test = harness();
    const result = await createServiceRunRecommendation(recommendationInput(), test.services);
    test.setNow("2026-08-21T13:00:00.000Z");
    await respondToServiceRun({ tokenHash: TOKEN_HASH, response: "accepted", responderName: "Morgan Ellis", actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit secure link" } }, test.services);
    const committedStops = test.repository.snapshot().routeStops.filter((stop) => stop.serviceRunId === result.run.id).sort((left, right) => left.sequence - right.sequence);
    expect(committedStops.map((stop) => stop.committedArrivalAt)).toEqual(committedStops.map((stop) => stop.proposedArrivalAt));
    expect(new Set(committedStops.map((stop) => stop.committedArrivalAt)).size).toBe(2);
    test.setNow("2026-08-24T13:30:00.000Z");
    const first = await checkInVisit(test.services, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-104", serviceRunId: result.run.id, workOrderIds: ["wo-run-104"], technicianName: "Morgan Ellis", purpose: "Complete the first committed route stop", channel: "secure_link", location: { result: "verified", capturedAt: "2026-08-24T13:30:00.000Z" }, actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" } });
    expect(first.siteVisitWorkOrders).toContainEqual(expect.objectContaining({
      workOrderId: "wo-run-104",
      selectionSource: "service_run",
      workOrderHoldId: undefined,
    }));
    test.setNow("2026-08-24T14:30:00.000Z");
    await checkOutVisit(test.services, { organizationId: NORTHLINE_ORGANIZATION_ID, visitId: first.id, channel: "secure_link", perWorkOrderOutcomes: [{ workOrderId: "wo-run-104", outcome: "completed", outcomeNotes: "Seal aligned and verified." }], location: { result: "verified", capturedAt: "2026-08-24T14:30:00.000Z" }, actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" } });
    expect(test.repository.snapshot().serviceRuns.find((run) => run.id === result.run.id)?.status).toBe("in_progress");
    test.setNow("2026-08-24T15:20:00.000Z");
    const second = await checkInVisit(test.services, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-105", serviceRunId: result.run.id, workOrderIds: ["wo-run-105"], technicianName: "Morgan Ellis", purpose: "Complete the PM route stop", channel: "secure_link", location: { result: "verified", capturedAt: "2026-08-24T15:20:00.000Z" }, actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" } });
    test.setNow("2026-08-24T16:50:00.000Z");
    await checkOutVisit(test.services, { organizationId: NORTHLINE_ORGANIZATION_ID, visitId: second.id, channel: "secure_link", perWorkOrderOutcomes: [{ workOrderId: "wo-run-105", outcome: "completed", outcomeNotes: "PM checklist and readings captured." }], location: { result: "verified", capturedAt: "2026-08-24T16:50:00.000Z" }, actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" } });
    const snapshot = test.repository.snapshot();
    expect(snapshot.serviceRuns.find((run) => run.id === result.run.id)).toMatchObject({ status: "completed", completedAt: "2026-08-24T16:50:00.000Z" });
    expect(snapshot.routeStops.filter((stop) => stop.serviceRunId === result.run.id).every((stop) => stop.status === "completed" && stop.siteVisitId)).toBe(true);
    expect(snapshot.serviceRunWorkOrders.filter((link) => link.serviceRunId === result.run.id).every((link) => link.addressed)).toBe(true);
  });
});
