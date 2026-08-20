import { describe, expect, it } from "vitest";
import { recordApprovalDecision } from "@/lib/ops/approval-governance";
import {
  assignWorkOrder,
  checkInVisit,
  checkOutVisit,
  createServiceRequest,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import {
  reviewRequestImpactAssessment,
  type RequestImpactAssessmentDraft,
} from "@/lib/ops/request-impact-assessment";
import { recordWorkOrderVerification } from "@/lib/ops/work-order-verification-commands";
import type { ServiceRequest, WorkOrder, WorkOrderAssignment } from "@/lib/ops/types";

const SUMMIT = "vendor-northline-summit";
const STORE_ID = "store-northline-101";

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const regionalActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-regional-1",
  actorName: "Avery Brooks",
};

const technicianActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "technician" as const,
  actorName: "Morgan Ellis",
};

const reportedImpact: RequestImpactAssessmentDraft = {
  storeOperatingState: "partially_operational",
  safetyConcern: "none_reported",
  productInventoryRisk: "at_risk",
  productInventoryValueMinor: 425_000,
  productInventoryCurrency: "USD",
  customersAffected: "yes",
  complianceImpact: "potential",
  capacityUnavailableBps: 5_000,
  redundantEquipment: "no",
  revenueFunctionImpact: "refrigerated_merchandise",
  estimatedDailyRevenueExposureMinor: 275_000,
  estimatedDailyRevenueExposureCurrency: "USD",
  estimatedDowntimeMinutes: 240,
  confidence: "medium",
  source: "store_report",
  notes: "Store-reported operating exposure; estimates require manager review and are not verified losses.",
};

describe("Wave 1 reactive maintenance loop", () => {
  it("runs issue, impact review, approval, inferred multi-work visit, verification/rejection, resolution, and closure", async () => {
    const repository = createNorthlineFixtureRepository();
    let now = "2026-08-20T12:00:00.000Z";
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => now },
      ids: { next: (prefix) => `${prefix}-wave1-e2e-${String(++sequence).padStart(4, "0")}` },
    };

    async function createReviewedIssue(problem: string, reporterName: string) {
      const request = await createServiceRequest(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: STORE_ID,
        reporterName,
        problem,
        priority: "urgent",
        impact: reportedImpact,
        actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "store_device", actorName: reporterName },
      });
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      await reviewRequestImpactAssessment(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        requestId: request.id,
        expectedRequestStatus: "submitted",
        expectedLatestAssessmentId: request.impactAssessment.id,
        disposition: "confirmed",
        assessment: { ...reportedImpact, confidence: "high", source: "manager_review", notes: "Facilities confirmed the operating facts; estimates remain unverified." },
        actor: facilitiesActor,
      });
      return request;
    }

    async function createAndApproveWork(request: ServiceRequest, authorizedScope: string) {
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      const created = await createWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: request.storeId,
        requestId: request.id,
        problem: request.problem,
        authorizedScope,
        categoryKey: "refrigeration",
        priority: "urgent",
        accountableParty: "Facilities coordinator",
        nextAction: "Assign the approved service provider",
        nteAmountMinor: 125_000,
        currency: "USD",
        actor: facilitiesActor,
      });
      expect(created).toMatchObject({ status: "awaiting_approval", approvalRequest: { requiredRole: "regional_manager" } });
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      await recordApprovalDecision(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        approvalRequestId: created.approvalRequest!.id,
        decision: "approved",
        deciderMembershipId: regionalActor.actorId,
        reason: "Urgent refrigeration scope and authorization limit reviewed.",
        actor: regionalActor,
      });
      return (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, created.id))!;
    }

    async function assignIssueAndAccept(workOrder: WorkOrder): Promise<WorkOrderAssignment> {
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      const assignment = await assignWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: workOrder.id,
        kind: "outside_vendor",
        vendorId: SUMMIT,
        actor: facilitiesActor,
      });
      const current = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id))!;
      const store = (await repository.getStore(NORTHLINE_ORGANIZATION_ID, current.storeId))!;
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      const issuance = await issueWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: current.id,
        assignmentId: assignment.id,
        revision: 1,
        channel: "email",
        authorizationSnapshot: {
          organizationName: "Northline Fuel & Market",
          workOrderNumber: current.number,
          store: {
            id: store.id,
            storeNumber: store.storeNumber,
            name: store.name,
            formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", "),
          },
          vendor: { id: SUMMIT, name: "Summit Refrigeration" },
          problem: current.problem,
          priority: current.priority,
          authorizedScope: current.authorizedScope,
          categoryKey: current.categoryKey,
          requestedTiming: current.dueAt,
          nte: current.nte,
          billingInstruction: `Reference operator work order ${current.number} on service paperwork and invoices.`,
        },
        publicToken: { tokenHash: sequence.toString(16).padStart(64, "0"), expiresAt: "2026-09-20T12:00:00.000Z" },
        actor: facilitiesActor,
      });
      now = new Date(Date.parse(now) + 5 * 60_000).toISOString();
      await recordVendorResponse(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: current.id,
        assignmentId: assignment.id,
        issuanceId: issuance.id,
        response: "accepted",
        responderName: "Summit Dispatch",
        actor: { ...technicianActor, actorType: "vendor_link", actorName: "Summit Dispatch" },
      });
      return assignment;
    }

    const requestOne = await createReviewedIssue("The beer cave is warm and the evaporator fan is grinding.", "Avery Clerk");
    const requestTwo = await createReviewedIssue("The walk-in freezer door heater is icing and the door will not seal.", "Casey Clerk");
    const workOne = await createAndApproveWork(requestOne, "Restore the beer-cave evaporator fan and verify temperature pull-down.");
    const workTwo = await createAndApproveWork(requestTwo, "Repair the freezer door-heater circuit and confirm a complete seal.");
    await assignIssueAndAccept(workOne);
    await assignIssueAndAccept(workTwo);

    now = "2026-08-21T13:00:00.000Z";
    const visit = await checkInVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_ID,
      workOrderIds: [workOne.id, workTwo.id],
      technicianName: "Morgan Ellis",
      technicianPhoneOrPin: "TECH-417",
      crewCount: 2,
      additionalTechnicianNames: ["Riley Chen"],
      vehicleIdentifier: "SUMMIT-12",
      arrivalNote: "Store manager provided access to both refrigeration areas.",
      purpose: "Complete both assigned refrigeration repairs during one observed store visit.",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: now },
      actor: technicianActor,
    });
    expect(visit).toMatchObject({ vendorId: SUMMIT, workOrderId: undefined, crewCount: 2 });

    now = "2026-08-21T15:00:00.000Z";
    const checkout = await checkOutVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [
        { workOrderId: workOne.id, outcome: "completed", outcomeNotes: "Replaced the failed fan motor and confirmed temperature pull-down." },
        { workOrderId: workTwo.id, outcome: "completed", outcomeNotes: "Replaced the door-heater relay and observed a complete seal." },
      ],
      location: { result: "trusted_store_device", capturedAt: now },
      actor: technicianActor,
    });
    expect(checkout.siteVisitWorkOrders).toHaveLength(2);
    expect(new Set(checkout.siteVisitWorkOrders.map((record) => record.workOrderId))).toEqual(new Set([workOne.id, workTwo.id]));

    const outcomeOne = checkout.siteVisitWorkOrders.find((record) => record.workOrderId === workOne.id)!;
    const outcomeTwo = checkout.siteVisitWorkOrders.find((record) => record.workOrderId === workTwo.id)!;
    let currentOne = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOne.id))!;
    let currentTwo = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workTwo.id))!;

    now = "2026-08-21T15:20:00.000Z";
    await recordWorkOrderVerification(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOne.id,
      expectedWorkOrderVersion: currentOne.version ?? 0,
      expectedSiteVisitWorkOrderId: outcomeOne.id,
      expectedOutcomeRecordedAt: outcomeOne.outcomeRecordedAt!,
      decision: "verified",
      reason: "Store operations observed stable beer-cave temperature.",
      actor: facilitiesActor,
    });
    await recordWorkOrderVerification(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workTwo.id,
      expectedWorkOrderVersion: currentTwo.version ?? 0,
      expectedSiteVisitWorkOrderId: outcomeTwo.id,
      expectedOutcomeRecordedAt: outcomeTwo.outcomeRecordedAt!,
      decision: "rejected",
      reason: "The freezer door iced again during normal use.",
      actor: facilitiesActor,
    });

    currentOne = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOne.id))!;
    currentTwo = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workTwo.id))!;
    expect(currentOne.status).toBe("resolved");
    expect(currentTwo.status).toBe("in_progress");

    now = "2026-08-21T15:30:00.000Z";
    await updateWorkOrderControl(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOne.id,
      expectedStatus: "resolved",
      status: "closed",
      note: "Verified repair is resolved with no remaining obligation.",
      actor: facilitiesActor,
    });

    now = "2026-08-22T13:00:00.000Z";
    const returnVisit = await checkInVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_ID,
      workOrderIds: [workTwo.id],
      technicianName: "Morgan Ellis",
      crewCount: 1,
      arrivalNote: "Return visit after store verification rejection.",
      purpose: "Correct the recurring freezer door icing.",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: now },
      actor: technicianActor,
    });
    now = "2026-08-22T14:00:00.000Z";
    const returnCheckout = await checkOutVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: returnVisit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{ workOrderId: workTwo.id, outcome: "completed", outcomeNotes: "Replaced the heater termination and confirmed the door remained clear and sealed." }],
      location: { result: "trusted_store_device", capturedAt: now },
      actor: technicianActor,
    });
    currentTwo = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workTwo.id))!;
    const returnOutcome = returnCheckout.siteVisitWorkOrders[0]!;

    now = "2026-08-22T14:20:00.000Z";
    const acceptedCycle = await recordWorkOrderVerification(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workTwo.id,
      expectedWorkOrderVersion: currentTwo.version ?? 0,
      expectedSiteVisitWorkOrderId: returnOutcome.id,
      expectedOutcomeRecordedAt: returnOutcome.outcomeRecordedAt!,
      decision: "verified",
      reason: "Store operations confirmed the corrected door remained clear during normal use.",
      actor: facilitiesActor,
    });
    expect(acceptedCycle.cycle).toBe(2);

    now = "2026-08-22T14:30:00.000Z";
    await updateWorkOrderControl(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workTwo.id,
      expectedStatus: "resolved",
      status: "closed",
      note: "Return repair verified and all accountable work completed.",
      actor: facilitiesActor,
    });

    const snapshot = repository.snapshot();
    expect(snapshot.requests.filter((request) => [requestOne.id, requestTwo.id].includes(request.id)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ status: "converted", convertedWorkOrderId: workOne.id }),
        expect.objectContaining({ status: "converted", convertedWorkOrderId: workTwo.id }),
      ]));
    expect(snapshot.approvalDecisions.filter((decision) => [workOne.id, workTwo.id].some((id) => (
      snapshot.approvalRequests.find((request) => request.id === decision.approvalRequestId)?.subjectId === id
    )))).toHaveLength(2);
    expect(snapshot.workOrderVerifications.filter((record) => record.workOrderId === workTwo.id).map((record) => [record.cycle, record.decision]))
      .toEqual([[1, "rejected"], [2, "verified"]]);
    expect(snapshot.workOrders.filter((work) => [workOne.id, workTwo.id].includes(work.id)).map((work) => work.status))
      .toEqual(["closed", "closed"]);
    expect(snapshot.visitEvidence.filter((evidence) => evidence.visitId === visit.id).map((evidence) => evidence.kind).sort())
      .toEqual(["check_in", "check_out"]);
    expect(snapshot.workflowTasks.filter((task) => [workOne.id, workTwo.id].includes(task.workOrderId ?? "") && ["open", "in_progress"].includes(task.status)))
      .toEqual([]);
    expect(snapshot.auditEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "request.impact_reviewed",
      "approval.approved",
      "work_order.assigned",
      "work_order.issued",
      "vendor.accepted",
      "visit.checked_in",
      "visit.checked_out",
      "work_order.verification_rejected",
      "work_order.verified_and_resolved",
      "work_order.closed",
    ]));
  });
});
