import { describe, expect, it } from "vitest";
import {
  assignWorkOrder,
  checkInVisit,
  checkInVisitWithCheckoutToken,
  checkOutVisit,
  createServiceRequest,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import {
  NORTHLINE_AS_OF,
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_DEMO_TOKEN_HASHES,
  NORTHLINE_ORGANIZATION_ID,
  assertOpsFixture,
  buildNorthlinePresentationFixture,
  buildSyntheticScaleFixture,
} from "@/lib/ops/fixtures";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  reviewRequestImpactAssessment,
  type RequestImpactAssessmentDraft,
} from "@/lib/ops/request-impact-assessment";
import type { RequestImpactAssessment, ServiceRequest } from "@/lib/ops/types";

function commandServices(): OpsCommandServices {
  let id = 0;
  return {
    repository: createNorthlineFixtureRepository(),
    clock: { now: () => "2026-08-10T19:00:00.000Z" },
    ids: { next: (prefix) => `${prefix}-test-${String(++id).padStart(3, "0")}` },
  };
}

const actor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function impactDraft(assessment: RequestImpactAssessment): RequestImpactAssessmentDraft {
  return {
    storeOperatingState: assessment.storeOperatingState,
    safetyConcern: assessment.safetyConcern,
    productInventoryRisk: assessment.productInventoryRisk,
    productInventoryValueMinor: assessment.productInventoryValue?.amountMinor,
    productInventoryCurrency: assessment.productInventoryValue?.currency,
    customersAffected: assessment.customersAffected,
    complianceImpact: assessment.complianceImpact,
    capacityUnavailableBps: assessment.capacityUnavailableBps,
    redundantEquipment: assessment.redundantEquipment,
    revenueFunctionImpact: assessment.revenueFunctionImpact,
    estimatedDailyRevenueExposureMinor: assessment.estimatedDailyRevenueExposure?.amountMinor,
    estimatedDailyRevenueExposureCurrency: assessment.estimatedDailyRevenueExposure?.currency,
    estimatedDowntimeMinutes: assessment.estimatedDowntimeMinutes,
    confidence: assessment.confidence,
    source: assessment.source,
    notes: assessment.notes,
  };
}

async function reviewRequestImpact(services: OpsCommandServices, request: ServiceRequest) {
  const latest = (await services.repository.listRequestImpactAssessments(request.organizationId, request.id)).at(-1);
  if (!latest) throw new Error("Request impact fixture is missing");
  return reviewRequestImpactAssessment(services, {
    organizationId: request.organizationId,
    requestId: request.id,
    expectedRequestStatus: "submitted",
    expectedLatestAssessmentId: latest.id,
    disposition: "confirmed",
    assessment: impactDraft(latest),
    actor,
  });
}

describe("operations fixtures", () => {
  it("keeps the showcase fictional, deterministic, deep, and separate from scale proof", () => {
    const presentation = buildNorthlinePresentationFixture();
    expect(assertOpsFixture(presentation)).toBe(true);
    expect(presentation.organizations[0].name).toBe("Northline Fuel & Market");
    expect(presentation.stores).toHaveLength(15);
    expect(presentation.regions).toHaveLength(3);
    expect(presentation.divisions).toHaveLength(1);
    expect(presentation.taxonomyNodes.some((row) => row.canonicalKey === "beer_caves" && row.depth === 3)).toBe(true);
    expect(presentation.vendors).toHaveLength(5);
    expect(presentation.memberships.filter((row) => row.role === "internal_technician")).toHaveLength(2);
    expect(buildSyntheticScaleFixture()).toMatchObject({ stores: expect.any(Array) });
    expect(buildSyntheticScaleFixture().stores).toHaveLength(65);
  });

  it("contains real component-level repeat history and a separate open public authorization", () => {
    const fixture = buildNorthlinePresentationFixture();
    const story = fixture.workOrders.find((row) => row.id === NORTHLINE_DEMO_HANDLES.storyWorkOrderId)!;
    expect(story.assetId).toBe(NORTHLINE_DEMO_HANDLES.storyAssetId);
    expect(story.componentId).toBe("component-104-compressor");
    expect(new Set(fixture.siteVisitWorkOrders.filter((row) => row.workOrderId === story.id).map((row) => row.visitId)).size).toBe(2);
    const publicWork = fixture.workOrders.find((row) => row.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)!;
    expect(publicWork.status).toBe("issued");
    expect(publicWork.componentId).toBe("component-104-evaporator-fan");
    expect(publicWork.repairEstimate).toEqual({ amountMinor: 125_000, currency: "USD" });
    expect(publicWork.estimatedServiceExtensionMonths).toBe(12);
    const capitalReview = fixture.workOrders.find((row) => row.id === "wo-northline-115")!;
    expect(capitalReview.nte).toBeUndefined();
    expect(capitalReview.repairEstimate).toEqual({ amountMinor: 1_800_000, currency: "USD" });
    expect(capitalReview.estimatedServiceExtensionMonths).toBe(60);
    expect(fixture.vendorResponses.some((row) => row.workOrderId === publicWork.id)).toBe(false);
  });

  it("keeps the highlighted Store 109 return visit on one coherent forecourt service record", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrder = fixture.workOrders.find((row) => row.id === "wo-northline-109")!;
    const linkedAssignments = fixture.assignments.filter((row) => row.workOrderId === workOrder.id);
    const linkedVisits = fixture.visits.filter((row) => row.workOrderId === workOrder.id);

    expect(workOrder).toMatchObject({
      categoryKey: "forecourt",
      assetId: "asset-109-dispenser-4",
      accountableParty: "Forecourt Systems Group",
    });
    expect(linkedAssignments).not.toHaveLength(0);
    expect(linkedAssignments.every((row) => row.vendorId === "vendor-northline-forecourt")).toBe(true);
    expect(linkedVisits).not.toHaveLength(0);
    expect(linkedVisits.every((row) => row.vendorId === "vendor-northline-forecourt")).toBe(true);
    expect(fixture.exceptions.some((row) => row.id === "exception-invoice-northline-109-above-authorization")).toBe(false);
  });

  it("keeps PM completion evidence independent of unrelated reactive work", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(fixture.pmOccurrences.some((row) => row.status === "completed" && row.workOrderId)).toBe(true);
    expect(fixture.pmOccurrences.some((row) => row.status === "completed" && !row.workOrderId)).toBe(true);
    expect(fixture.pmOccurrences.filter((row) => row.status === "completed").every((row) => row.completedAt && row.completedAt >= row.windowStartsAt && row.completedAt <= row.windowEndsAt)).toBe(true);
  });
});

describe("canonical work and provider commands", () => {
  it("creates store-only work, allocates a safe number, and commits source + audit + outbox", async () => {
    const svc = commandServices();
    const request = await createServiceRequest(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", reporterName: "Casey Clerk", problem: "Unknown equipment is making a loud vibration", actor });
    await reviewRequestImpact(svc, request);
    const workOrder = await createWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", requestId: request.id, problem: request.problem, accountableParty: "Facilities coordinator", nextAction: "Choose service provider", actor });
    expect(workOrder.number).toMatch(/^NL-2026-\d{4}$/);
    expect(workOrder.categoryKey).toBeUndefined();
    expect(workOrder.assetId).toBeUndefined();
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.workOrders.some((row) => row.id === workOrder.id)).toBe(true);
    expect(snapshot.auditEvents.some((row) => row.aggregateId === workOrder.id && row.eventType === "work_order.created")).toBe(true);
    expect(snapshot.outboxMessages.some((row) => row.aggregateId === workOrder.id && row.topic === "ops.work_order.created")).toBe(true);
  });

  it("rejects cross-store asset classification and repeat request conversion", async () => {
    const svc = commandServices();
    const request = await createServiceRequest(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", reporterName: "Casey Clerk", problem: "Cooler alarm", actor });
    await reviewRequestImpact(svc, request);
    await expect(createWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", requestId: request.id, problem: request.problem, categoryKey: "refrigeration", assetId: "asset-104-beer-cave", accountableParty: "Facilities", nextAction: "Review", actor })).rejects.toMatchObject({ code: "VALIDATION" });
    await createWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", requestId: request.id, problem: request.problem, accountableParty: "Facilities", nextAction: "Review", actor });
    await expect(createWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", requestId: request.id, problem: request.problem, accountableParty: "Facilities", nextAction: "Review", actor })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("persists optional repair planning separately from the authorization limit", async () => {
    const svc = commandServices();
    const workOrder = await createWorkOrder(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      problem: "Beer cave repair proposal needs review",
      categoryKey: "refrigeration",
      assetId: "asset-101-beer-cave",
      accountableParty: "Facilities",
      nextAction: "Review repair proposal",
      nteAmountMinor: 250_000,
      repairEstimateAmountMinor: 180_000,
      estimatedServiceExtensionMonths: 24,
      actor,
    });
    expect(workOrder.nte).toEqual({ amountMinor: 250_000, currency: "USD" });
    expect(workOrder.repairEstimate).toEqual({ amountMinor: 180_000, currency: "USD" });
    expect(workOrder.estimatedServiceExtensionMonths).toBe(24);
    expect(await svc.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      nte: { amountMinor: 250_000 },
      repairEstimate: { amountMinor: 180_000 },
      estimatedServiceExtensionMonths: 24,
    });
    await expect(createWorkOrder(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      problem: "Unclassified repair proposal",
      accountableParty: "Facilities",
      nextAction: "Classify asset",
      repairEstimateAmountMinor: 100_000,
      estimatedServiceExtensionMonths: 12,
      actor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("binds issued links to one immutable revision and keeps proposed dates pending facilities review", async () => {
    const svc = commandServices();
    const request = await createServiceRequest(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", reporterName: "Casey Clerk", problem: "Beer cave fan noise", priority: "urgent", actor });
    await reviewRequestImpact(svc, request);
    const workOrder = await createWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: request.storeId, requestId: request.id, problem: request.problem, categoryKey: "refrigeration", assetId: "asset-101-beer-cave", accountableParty: "Facilities", nextAction: "Assign", actor });
    const assignment = await assignWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: workOrder.id, kind: "outside_vendor", vendorId: "vendor-northline-summit", actor });
    const issuance = await issueWorkOrder(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: workOrder.id, assignmentId: assignment.id, revision: 1, channel: "email", authorizationSnapshot: { organizationName: "Northline Fuel & Market", workOrderNumber: workOrder.number, store: { id: workOrder.storeId, storeNumber: "101", name: "Northline Cedar Grove", formattedAddress: "101 Market Way, Cedar Grove, MI 49001" }, vendor: { id: "vendor-northline-summit", name: "Summit Refrigeration" }, problem: workOrder.problem, priority: "urgent", billingInstruction: `Reference operator work order ${workOrder.number} on all service tickets and invoices.` }, publicToken: { tokenHash: "a".repeat(64), expiresAt: "2026-08-17T19:00:00.000Z" }, actor });
    const response = await recordVendorResponse(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: workOrder.id, assignmentId: assignment.id, issuanceId: issuance.id, response: "proposed_date", responderName: "Summit Dispatch", proposedAt: "2026-08-11T14:00:00.000Z", actor: { ...actor, actorType: "vendor_link" } });
    expect(response.response).toBe("proposed_date");
    const updated = await svc.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    expect(updated?.accountableParty).toBe("Facilities coordinator");
    expect((await svc.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, assignment.id))?.status).toBe("issued");
  });
});

describe("visit evidence", () => {
  it("permits a no-WO visit, makes it reviewable, and never calls observed time labor", async () => {
    const svc = commandServices();
    const checkIn = await checkInVisitWithCheckoutToken(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", vendorId: "vendor-northline-summit", unmatchedReason: "Dispatch did not provide a Northline work-order number", technicianName: "Pat Morgan", purpose: "Emergency cooler inspection", channel: "qr", location: { result: "verified", accuracyM: 18, distanceM: 22, capturedAt: "2026-08-10T19:00:00.000Z" }, checkoutToken: { tokenHash: "b".repeat(64), expiresAt: "2026-08-11T19:00:00.000Z" }, actor: { ...actor, actorType: "technician" } });
    const visit = checkIn.visit;
    expect(visit.workOrderId).toBeUndefined();
    expect(checkIn.tokenId).toMatch(/^public-token-test-/);
    const receipt = await checkOutVisit(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, visitId: visit.id, channel: "store_device", outcome: "no_issue_found", location: { result: "trusted_store_device", capturedAt: "2026-08-10T19:00:00.000Z" }, actor: { ...actor, actorType: "store_device" } });
    expect(receipt).toHaveProperty("observedDurationSeconds");
    expect(receipt).not.toHaveProperty("laborMinutes");
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.exceptions.some((row) => row.visitId === visit.id && row.kind === "no_work_order")).toBe(true);
  });

  it("requires an owned atomic follow-up for unresolved linked checkout", async () => {
    const svc = commandServices();
    const capturedAt = "2026-08-10T19:00:00.000Z";
    const visit = await checkInVisit(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-104", vendorId: "vendor-northline-summit", workOrderId: NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId, technicianName: "Pat Morgan", purpose: "Inspect evaporator fan", channel: "secure_link", location: { result: "verified", capturedAt, accuracyM: 16, distanceM: 20 }, actor: { ...actor, actorType: "technician" } });
    await expect(checkOutVisit(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, visitId: visit.id, channel: "qr", outcome: "diagnosed_waiting_parts", location: { result: "verified", capturedAt }, actor: { ...actor, actorType: "technician" } })).rejects.toMatchObject({ code: "VALIDATION" });
    const checkedOut = await checkOutVisit(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, visitId: visit.id, channel: "qr", outcome: "diagnosed_waiting_parts", location: { result: "verified", capturedAt }, followUp: { accountableParty: "Summit Refrigeration", nextAction: "Return with fan motor", dueAt: "2026-08-12T18:00:00.000Z", escalationTo: "Northline Facilities" }, actor: { ...actor, actorType: "technician" } });
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.followUps.some((row) => row.id === checkedOut.followUpId && row.sourceVisitId === visit.id)).toBe(true);
    expect(snapshot.auditEvents.find((row) => row.aggregateId === visit.id && row.eventType === "visit.checked_out")?.payloadJson).toContain("approximate_presence_not_labor");
  });

  it("rejects stale client location evidence while keeping server time authoritative", async () => {
    const svc = commandServices();
    await expect(checkInVisit(svc, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", vendorId: "vendor-northline-summit", unmatchedReason: "No operator work order", technicianName: "Pat Morgan", purpose: "Cooler inspection", channel: "qr", location: { result: "verified", capturedAt: "2026-08-10T18:30:00.000Z" }, actor: { ...actor, actorType: "technician" } })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("resolves demo public tokens to narrow immutable views", async () => {
    const repo = createNorthlineFixtureRepository();
    const service = await repo.getServiceAuthorizationByToken({ tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104, purpose: "service_authorization", now: NORTHLINE_AS_OF });
    expect(service).toMatchObject({ workOrderNumber: "NL-2026-0116", priority: "urgent", revision: 1, latestResponse: undefined });
    const active = await repo.getActiveVisitByToken({ tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.activeVisit112, purpose: "active_visit", now: NORTHLINE_AS_OF });
    expect(active).toMatchObject({ organizationId: NORTHLINE_ORGANIZATION_ID, id: NORTHLINE_DEMO_HANDLES.activeVisitId });
    const trusted = await repo.getTrustedStoreDeviceByToken({ tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.trustedStore104, purpose: "trusted_store_device", now: NORTHLINE_AS_OF });
    expect(trusted).toMatchObject({ organizationId: NORTHLINE_ORGANIZATION_ID, store: { id: "store-northline-104" }, activeVisits: expect.any(Array) });
    expect(await repo.getPublicStoreGatewayByToken({ tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.trustedStore104, purpose: "store_gateway", now: NORTHLINE_AS_OF })).toBeNull();
  });
});
