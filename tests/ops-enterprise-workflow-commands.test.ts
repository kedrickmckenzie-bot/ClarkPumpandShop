import { describe, expect, it } from "vitest";
import {
  checkInVisit,
  checkOutVisit,
  completeFollowUp,
  createFollowUp,
  createServiceRequest,
  createWorkOrder,
  issueWorkOrder,
  linkServiceRequestToWorkOrder,
  reconcileUnmatchedVisit,
  rescheduleFollowUp,
  reviewException,
  reviewServiceRequest,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import {
  reviewRequestImpactAssessment,
  type RequestImpactAssessmentDraft,
} from "@/lib/ops/request-impact-assessment";
import type { RequestImpactAssessment, ServiceRequest } from "@/lib/ops/types";
import { recordWorkOrderVerification } from "@/lib/ops/work-order-verification-commands";

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const technicianActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "technician" as const,
  actorName: "Morgan Ellis",
};

type FixtureRepository = ReturnType<typeof createNorthlineFixtureRepository>;

function commandHarness(options?: { assignmentIdCollision?: string }) {
  const repository = createNorthlineFixtureRepository();
  let now = "2026-08-14T12:00:00.000Z";
  let sequence = 0;
  let assignmentCollision = options?.assignmentIdCollision;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: {
      next: (prefix) => {
        if (prefix === "assignment" && assignmentCollision) {
          const collision = assignmentCollision;
          assignmentCollision = undefined;
          return collision;
        }
        sequence += 1;
        return `${prefix}-enterprise-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return {
    repository,
    services,
    setNow(value: string) { now = value; },
  };
}

function snapshot(repository: FixtureRepository) {
  return repository.snapshot();
}

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

async function reviewImpact(
  harness: ReturnType<typeof commandHarness>,
  request: ServiceRequest & { impactAssessment: RequestImpactAssessment },
) {
  return reviewRequestImpactAssessment(harness.services, {
    organizationId: request.organizationId,
    requestId: request.id,
    expectedRequestStatus: "submitted",
    expectedLatestAssessmentId: request.impactAssessment.id,
    disposition: "confirmed",
    assessment: impactDraft(request.impactAssessment),
    actor: facilitiesActor,
  });
}

async function createRoutedWorkOrder(
  harness: ReturnType<typeof commandHarness>,
  input?: { priority?: "emergency" | "urgent" | "routine" | "planned"; storeId?: string },
) {
  return createWorkOrder(harness.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: input?.storeId ?? "store-northline-101",
    problem: "Beer cave temperature is above its safe operating range.",
    priority: input?.priority ?? "urgent",
    accountableParty: "Facilities coordinator",
    nextAction: "Choose service provider",
    initialAssignment: {
      kind: "outside_vendor",
      vendorId: "vendor-northline-summit",
    },
    actor: facilitiesActor,
  });
}

describe("atomic work-order creation and control defaults", () => {
  it("rolls back the work order, request conversion, audit, and outbox when the initial assignment cannot persist", async () => {
    const existingAssignmentId = createNorthlineFixtureRepository().snapshot().assignments[0].id;
    const harness = commandHarness({ assignmentIdCollision: existingAssignmentId });
    const request = await createServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Avery Clerk",
      problem: "The beer cave is warm.",
      priority: "urgent",
      actor: facilitiesActor,
    });
    await reviewImpact(harness, request);
    const before = snapshot(harness.repository);

    await expect(createWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: request.storeId,
      requestId: request.id,
      problem: request.problem,
      priority: "urgent",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      initialAssignment: { kind: "choose_later" },
      actor: facilitiesActor,
    })).rejects.toThrow(`Duplicate fixture id ${existingAssignmentId}`);

    expect(snapshot(harness.repository)).toEqual(before);
    const persistedRequest = await harness.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id);
    expect(persistedRequest).toMatchObject({ status: "under_review" });
    expect(persistedRequest?.convertedWorkOrderId).toBeUndefined();
  });

  it("persists initial assignment, accountable next action, priority due date, and escalation in one command", async () => {
    const harness = commandHarness();
    const workOrder = await createRoutedWorkOrder(harness, { priority: "urgent" });

    expect(workOrder).toMatchObject({
      status: "approved",
      priority: "urgent",
      accountableParty: "Facilities coordinator",
      nextAction: "Issue service authorization",
      dueAt: "2026-08-15T12:00:00.000Z",
      escalationTo: "Facilities director",
      initialAssignment: {
        kind: "outside_vendor",
        vendorId: "vendor-northline-summit",
        status: "pending",
      },
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      dueAt: "2026-08-15T12:00:00.000Z",
      escalationTo: "Facilities director",
    });
    expect(await harness.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      id: workOrder.initialAssignment?.id,
      vendorId: "vendor-northline-summit",
    });
    expect(snapshot(harness.repository).auditEvents.filter((event) => event.aggregateId === workOrder.id).map((event) => event.eventType))
      .toEqual(["work_order.created", "work_order.assigned"]);
  });

  it("preserves an explicit bid-path next action on a choose-later assignment", async () => {
    const harness = commandHarness();
    const workOrder = await createWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      problem: "The walk-in freezer requires comparable repair pricing.",
      priority: "routine",
      accountableParty: "Facilities coordinator",
      nextAction: "Send bid requests and compare responses",
      initialAssignment: { kind: "choose_later" },
      actor: facilitiesActor,
    });

    expect(workOrder).toMatchObject({
      accountableParty: "Facilities coordinator",
      nextAction: "Send bid requests and compare responses",
      initialAssignment: { kind: "choose_later", status: "pending" },
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      nextAction: "Send bid requests and compare responses",
    });
  });
});

describe("service-request review decisions", () => {
  it("records start, escalation, and closure as auditable decisions and requires reasons for material decisions", async () => {
    const harness = commandHarness();
    const request = await createServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-102",
      reporterName: "Casey Store Associate",
      problem: "The rooftop unit is making a loud vibration.",
      actor: facilitiesActor,
    });

    const started = await reviewImpact(harness, request);
    expect(started.requestStatus).toBe("under_review");
    expect(await harness.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id)).toMatchObject({ status: "under_review" });

    const beforeMissingReason = snapshot(harness.repository);
    await expect(reviewServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "under_review",
      decision: "close",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(snapshot(harness.repository)).toEqual(beforeMissingReason);

    await reviewServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "under_review",
      decision: "escalate",
      note: "Store manager approval is required because foodservice is affected.",
      actor: facilitiesActor,
    });
    const closed = await reviewServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "under_review",
      decision: "close",
      note: "Duplicate of a request already under active repair.",
      actor: facilitiesActor,
    });

    expect(closed.status).toBe("closed");
    expect(await harness.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id)).toMatchObject({ status: "closed" });
    expect(snapshot(harness.repository).workflowTasks.find((task) => (
      task.serviceRequestId === request.id && task.taskType === "review_issue"
    ))).toMatchObject({
      status: "completed",
      resolutionNote: "Duplicate of a request already under active repair.",
    });
    expect(snapshot(harness.repository).auditEvents.filter((event) => event.aggregateId === request.id).map((event) => event.eventType))
      .toEqual(["request.submitted", "request.impact_assessed", "request.impact_reviewed", "request.review_started", "request.escalated", "request.closed"]);

    await expect(reviewServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "under_review",
      decision: "close",
      note: "Stale browser retry",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("links an additional reviewed report to existing open work without another dispatch and makes retries harmless", async () => {
    const harness = commandHarness();
    const existingWork = await createRoutedWorkOrder(harness, { storeId: "store-northline-101" });
    const request = await createServiceRequest(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Taylor Store Manager",
      problem: "The beer cave is still above the safe temperature range.",
      actor: facilitiesActor,
    });
    await reviewImpact(harness, request);
    const before = snapshot(harness.repository);
    const linked = await linkServiceRequestToWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      workOrderId: existingWork.id,
      expectedStatus: "under_review",
      actor: facilitiesActor,
    });
    expect(linked).toMatchObject({ status: "converted", convertedWorkOrderId: existingWork.id });
    expect(snapshot(harness.repository).workOrders).toHaveLength(before.workOrders.length);
    expect(snapshot(harness.repository).assignments).toHaveLength(before.assignments.length);
    expect(snapshot(harness.repository).workflowTasks.find((task) => task.serviceRequestId === request.id)).toMatchObject({ status: "completed" });
    expect(snapshot(harness.repository).auditEvents.some((event) => event.aggregateId === request.id && event.eventType === "request.linked_to_existing_work_order")).toBe(true);

    const retried = await linkServiceRequestToWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      workOrderId: existingWork.id,
      expectedStatus: "under_review",
      actor: facilitiesActor,
    });
    expect(retried).toMatchObject({ replayed: true });
    expect(snapshot(harness.repository).workOrders).toHaveLength(before.workOrders.length);
  });
});

describe("work-order transition controls", () => {
  it("rejects invalid jumps and blocks terminal transitions while a technician is actively onsite", async () => {
    const harness = commandHarness();
    const workOrder = await createRoutedWorkOrder(harness);

    await expect(updateWorkOrderControl(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedStatus: "approved",
      status: "closed",
      note: "Attempt to bypass service review",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    await issueWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: workOrder.initialAssignment!.id,
      revision: 1,
      channel: "manual",
      authorizationSnapshot: {
        organizationName: "Clark Pump and Shop",
        workOrderNumber: workOrder.number,
        store: { id: workOrder.storeId, storeNumber: "101", name: "Clark Pump and Shop - Cedar Grove", formattedAddress: "101 Market Way, Cedar Grove, MI 49001" },
        vendor: { id: "vendor-northline-summit", name: "ColdLine Refrigeration & HVAC" },
        problem: workOrder.problem,
        priority: workOrder.priority,
        billingInstruction: `Reference operator work order ${workOrder.number} on all service tickets and invoices.`,
      },
      actor: facilitiesActor,
    });

    const visit = await checkInVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: workOrder.storeId,
      vendorId: "vendor-northline-summit",
      workOrderId: workOrder.id,
      technicianName: "Morgan Ellis",
      purpose: "Diagnose the beer cave temperature problem.",
      channel: "qr",
      location: { result: "verified", accuracyM: 12, distanceM: 18, capturedAt: "2026-08-14T12:00:00.000Z" },
      actor: technicianActor,
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({ status: "in_progress" });

    await expect(updateWorkOrderControl(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedStatus: "in_progress",
      status: "cancelled",
      note: "Cancel while service is underway",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({ status: "in_progress" });

    harness.setNow("2026-08-14T13:15:00.000Z");
    const checkout = await checkOutVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "store_device",
      outcome: "resolved",
      outcomeNotes: "Reset controls and confirmed normal temperature pull-down.",
      location: { result: "verified", accuracyM: 15, distanceM: 16, capturedAt: "2026-08-14T13:15:00.000Z" },
      actor: technicianActor,
    });
    const awaitingVerification = await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    const outcome = checkout.siteVisitWorkOrders[0]!;
    harness.setNow("2026-08-14T13:20:00.000Z");
    await recordWorkOrderVerification(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedWorkOrderVersion: awaitingVerification?.version ?? 0,
      expectedSiteVisitWorkOrderId: outcome.id,
      expectedOutcomeRecordedAt: outcome.outcomeRecordedAt!,
      decision: "verified",
      reason: "Facilities confirmed normal temperature after service.",
      actor: facilitiesActor,
    });

    const closed = await updateWorkOrderControl(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedStatus: "resolved",
      status: "closed",
      note: "Facilities reviewed the completed visit and outcome evidence.",
      actor: facilitiesActor,
    });

    expect(closed).toMatchObject({
      status: "closed",
      accountableParty: "No active owner",
      nextAction: "No further action",
      dueAt: undefined,
      escalationTo: undefined,
      closedAt: "2026-08-14T13:20:00.000Z",
    });
    expect(await harness.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toBeNull();
    expect(snapshot(harness.repository).assignments.find((assignment) => assignment.id === workOrder.initialAssignment?.id)?.status).toBe("completed");
  });
});

describe("follow-up accountability", () => {
  it("reschedules an open follow-up with its work-order projection and moves the final completion to manager review", async () => {
    const harness = commandHarness();
    const workOrder = await createWorkOrder(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-103",
      problem: "Dispenser payment terminal intermittently restarts.",
      priority: "routine",
      accountableParty: "Facilities coordinator",
      nextAction: "Coordinate diagnosis",
      actor: facilitiesActor,
    });
    const followUp = await createFollowUp(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      accountableParty: "PumpPro Fuel & Dispenser Repair",
      nextAction: "Confirm replacement terminal availability",
      dueAt: "2026-08-16T15:00:00.000Z",
      escalationTo: "Facilities director",
      actor: facilitiesActor,
    });

    const rescheduled = await rescheduleFollowUp(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      followUpId: followUp.id,
      accountableParty: "Facilities coordinator",
      nextAction: "Confirm vendor return date and replacement terminal",
      dueAt: "2026-08-18T17:00:00.000Z",
      escalationTo: "Regional operations manager",
      note: "Vendor is waiting for the replacement terminal shipment.",
      actor: facilitiesActor,
    });
    expect(rescheduled).toMatchObject({
      status: "open",
      accountableParty: "Facilities coordinator",
      dueAt: "2026-08-18T17:00:00.000Z",
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      accountableParty: "Facilities coordinator",
      nextAction: "Confirm vendor return date and replacement terminal",
      dueAt: "2026-08-18T17:00:00.000Z",
      escalationTo: "Regional operations manager",
    });

    harness.setNow("2026-08-18T16:00:00.000Z");
    const completed = await completeFollowUp(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      followUpId: followUp.id,
      resolution: "Replacement terminal arrived and the return visit is complete.",
      actor: facilitiesActor,
    });
    expect(completed).toMatchObject({
      status: "completed",
      completedAt: "2026-08-18T16:00:00.000Z",
      nextProjection: {
        status: "completed_pending_review",
        accountableParty: "Facilities coordinator",
        nextAction: "Verify current service outcome",
        dueAt: "2026-08-19T16:00:00.000Z",
        escalationTo: "Facilities director",
      },
    });
    expect(await harness.repository.getFollowUp(NORTHLINE_ORGANIZATION_ID, followUp.id)).toMatchObject({
      status: "completed",
      completedAt: "2026-08-18T16:00:00.000Z",
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject(completed.nextProjection);
    expect(snapshot(harness.repository).auditEvents.filter((event) => event.aggregateId === workOrder.id).map((event) => event.eventType))
      .toEqual(expect.arrayContaining(["follow_up.created", "follow_up.updated", "follow_up.completed"]));

    await expect(completeFollowUp(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      followUpId: followUp.id,
      resolution: "Duplicate completion",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("unmatched visit review", () => {
  it("reconciles a checked-out unresolved visit to same-store work and atomically creates the required follow-up", async () => {
    const harness = commandHarness();
    const workOrder = await createRoutedWorkOrder(harness);
    const visit = await checkInVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: workOrder.storeId,
      vendorId: "vendor-northline-summit",
      unmatchedReason: "Dispatch called the store but did not provide the operator work-order number.",
      technicianName: "Taylor Brooks",
      purpose: "Investigate high beer cave temperature.",
      channel: "qr",
      location: { result: "verified", accuracyM: 10, distanceM: 13, capturedAt: "2026-08-14T12:00:00.000Z" },
      actor: { ...technicianActor, actorName: "Taylor Brooks" },
    });
    const exception = snapshot(harness.repository).exceptions.find((candidate) => candidate.visitId === visit.id && candidate.kind === "no_work_order");
    expect(exception).toBeDefined();

    harness.setNow("2026-08-14T13:00:00.000Z");
    await checkOutVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "secure_link",
      outcome: "diagnosed_waiting_parts",
      outcomeNotes: "Compressor contactor failed; replacement part is required.",
      location: { result: "verified", accuracyM: 11, distanceM: 14, capturedAt: "2026-08-14T13:00:00.000Z" },
      actor: { ...technicianActor, actorName: "Taylor Brooks" },
    });
    expect(snapshot(harness.repository).followUps.some((candidate) => candidate.sourceVisitId === visit.id)).toBe(false);

    harness.setNow("2026-08-14T14:00:00.000Z");
    const reconciled = await reconcileUnmatchedVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      exceptionId: exception!.id,
      workOrderId: workOrder.id,
      note: "Confirmed with Summit dispatch that this visit was for the warm beer cave request.",
      actor: facilitiesActor,
    });

    expect(reconciled.followUpId).toBeDefined();
    expect(await harness.repository.getVisit(NORTHLINE_ORGANIZATION_ID, visit.id)).toMatchObject({
      workOrderId: workOrder.id,
      unmatchedReason: visit.unmatchedReason,
      status: "checked_out",
    });
    expect(await harness.repository.getException(NORTHLINE_ORGANIZATION_ID, exception!.id)).toMatchObject({
      status: "resolved",
      workOrderId: workOrder.id,
      resolvedAt: "2026-08-14T14:00:00.000Z",
    });
    expect(await harness.repository.getFollowUp(NORTHLINE_ORGANIZATION_ID, reconciled.followUpId!)).toMatchObject({
      workOrderId: workOrder.id,
      sourceVisitId: visit.id,
      status: "open",
      nextAction: "Confirm parts and return date",
    });
    expect(await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      status: "waiting_on_parts",
      accountableParty: "Facilities coordinator",
      nextAction: "Confirm parts and return date",
    });
    const after = snapshot(harness.repository);
    expect(after.visitEvidence).toContainEqual(expect.objectContaining({
      visitId: visit.id,
      kind: "amendment",
    }));
    expect(after.auditEvents.filter((event) => [visit.id, workOrder.id].includes(event.aggregateId)).map((event) => event.eventType))
      .toEqual(expect.arrayContaining(["visit.reconciled", "work_order.visit_reconciled"]));
  });

  it("can resolve a legitimate no-work-order visit review without inventing a work-order link", async () => {
    const harness = commandHarness();
    const visit = await checkInVisit(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-105",
      vendorId: "vendor-northline-forecourt",
      unmatchedReason: "Emergency dispenser safety inspection requested by phone.",
      technicianName: "Riley Chen",
      purpose: "Inspect dispenser emergency shutoff after a reported fault.",
      channel: "store_device",
      location: { result: "verified", accuracyM: 8, distanceM: 9, capturedAt: "2026-08-14T12:00:00.000Z" },
      actor: { ...technicianActor, actorName: "Riley Chen" },
    });
    const exception = snapshot(harness.repository).exceptions.find((candidate) => candidate.visitId === visit.id && candidate.kind === "no_work_order");
    expect(exception).toBeDefined();

    await reviewException(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      exceptionId: exception!.id,
      decision: "acknowledge",
      note: "Facilities is confirming the emergency phone authorization.",
      actor: facilitiesActor,
    });
    const resolved = await reviewException(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      exceptionId: exception!.id,
      decision: "resolve",
      note: "Emergency safety inspection was legitimate; no operator work order was issued.",
      actor: facilitiesActor,
    });

    expect(resolved).toMatchObject({
      status: "resolved",
      resolvedAt: "2026-08-14T12:00:00.000Z",
    });
    const persistedVisit = await harness.repository.getVisit(NORTHLINE_ORGANIZATION_ID, visit.id);
    expect(persistedVisit).toMatchObject({
      unmatchedReason: "Emergency dispenser safety inspection requested by phone.",
    });
    expect(persistedVisit?.workOrderId).toBeUndefined();
    expect(snapshot(harness.repository).auditEvents.filter((event) => event.aggregateId === exception!.id).map((event) => event.eventType))
      .toEqual(["exception.acknowledged", "exception.resolved"]);
  });
});
