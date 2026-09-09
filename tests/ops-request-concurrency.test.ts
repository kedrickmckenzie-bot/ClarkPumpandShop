import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acknowledgeServiceRequest,
  createServiceRequest,
  createWorkOrder,
  linkServiceRequestToWorkOrder,
  unlinkServiceRequestFromWorkOrder,
  requestAcknowledgedServiceRequestFollowUp,
  reviewServiceRequest,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { requestSubjectApproval } from "@/lib/ops/approval-governance";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import {
  reviewRequestImpactAssessment,
  type RequestImpactAssessmentDraft,
} from "@/lib/ops/request-impact-assessment";
import type { OpsRepository, OpsStatement } from "@/lib/ops/repository";
import type { ActorContext, RequestImpactAssessment } from "@/lib/ops/types";

const NOW = "2026-08-20T14:00:00.000Z";

const facilitiesActor: ActorContext = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user",
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const regionalActor: ActorContext = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user",
  actorId: "membership-northline-regional-east",
  actorName: "Riley Chen",
};

function harness() {
  const repository = createNorthlineFixtureRepository();
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: {
      next(prefix) {
        sequence += 1;
        return `${prefix}-request-race-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services };
}

/** Hold both writes until both commands have completed their optimistic reads. */
function withTwoPartyAtomicWriteBarrier(repository: OpsRepository): OpsRepository {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return new Proxy(repository, {
    get(target, property, receiver) {
      if (property === "atomicWrite") {
        return async (statements: readonly OpsStatement[]) => {
          arrivals += 1;
          if (arrivals === 2) release();
          await gate;
          return target.atomicWrite(statements);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function racingServices(test: ReturnType<typeof harness>): OpsCommandServices {
  return { ...test.services, repository: withTwoPartyAtomicWriteBarrier(test.repository) };
}

function expectExactlyOneConflict(results: readonly PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({ code: "CONFLICT" });
}

const reportedImpact: RequestImpactAssessmentDraft = {
  storeOperatingState: "partially_operational",
  safetyConcern: "potential",
  productInventoryRisk: "at_risk",
  productInventoryValueMinor: 125_000,
  productInventoryCurrency: "USD",
  customersAffected: "yes",
  complianceImpact: "potential",
  capacityUnavailableBps: 2_500,
  redundantEquipment: "no",
  revenueFunctionImpact: "refrigerated_merchandise",
  estimatedDailyRevenueExposureMinor: 240_000,
  estimatedDailyRevenueExposureCurrency: "USD",
  estimatedDowntimeMinutes: 180,
  confidence: "medium",
  source: "store_report",
  notes: "Store report awaiting manager review.",
};

function draftFrom(assessment: RequestImpactAssessment): RequestImpactAssessmentDraft {
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

async function createReviewedIssue(test: ReturnType<typeof harness>) {
  const request = await createServiceRequest(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-101",
    reporterName: "Taylor Brooks",
    problem: "The east beverage cooler is warm and product is at risk.",
    priority: "urgent",
    impact: reportedImpact,
    actor: facilitiesActor,
  });
  await reviewRequestImpactAssessment(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    requestId: request.id,
    expectedRequestStatus: "submitted",
    expectedLatestAssessmentId: request.impactAssessment.id,
    disposition: "confirmed",
    assessment: draftFrom(request.impactAssessment),
    actor: facilitiesActor,
  });
  return request;
}

describe("service-request concurrency fences", () => {
  it("enforces one canonical work order per request in both durable engines", () => {
    for (const migration of [
      readFileSync("drizzle/0020_talented_bishop.sql", "utf8"),
      readFileSync("drizzle-postgres/0014_loving_changeling.sql", "utf8"),
    ]) {
      expect(migration).toContain("uidx_ops_work_orders_org_request");
      expect(migration).toMatch(/organization_id[^\n]+request_id/i);
      expect(migration).toMatch(/request_id[^\n]+IS NOT NULL/i);
    }
  });

  it("allows only one manager review to succeed from the same observed impact revision", async () => {
    const test = harness();
    const request = await createServiceRequest(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Taylor Brooks",
      problem: "The east beverage cooler is warm and product is at risk.",
      priority: "urgent",
      impact: reportedImpact,
      actor: facilitiesActor,
    });
    const services = racingServices(test);
    const baseInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedRequestStatus: "submitted" as const,
      expectedLatestAssessmentId: request.impactAssessment.id,
      disposition: "confirmed" as const,
      assessment: draftFrom(request.impactAssessment),
    };

    const results = await Promise.allSettled([
      reviewRequestImpactAssessment(services, { ...baseInput, actor: facilitiesActor }),
      reviewRequestImpactAssessment(services, { ...baseInput, actor: regionalActor }),
    ]);

    expectExactlyOneConflict(results);
    const snapshot = test.repository.snapshot();
    expect(snapshot.requestImpactAssessments.filter((item) => item.requestId === request.id)).toHaveLength(2);
    expect(snapshot.requests.find((item) => item.id === request.id)?.status).toBe("under_review");
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === request.id && event.eventType === "request.impact_reviewed")).toHaveLength(1);
  });

  it("allows only one canonical work order to be created for a reviewed request", async () => {
    const test = harness();
    const request = await createReviewedIssue(test);
    const services = racingServices(test);
    const baseInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: request.storeId,
      requestId: request.id,
      problem: request.problem,
      priority: "urgent" as const,
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      escalationTo: "Facilities director",
      initialAssignment: { kind: "choose_later" as const },
    };

    const results = await Promise.allSettled([
      createWorkOrder(services, { ...baseInput, actor: facilitiesActor }),
      createWorkOrder(services, { ...baseInput, actor: regionalActor }),
    ]);

    expectExactlyOneConflict(results);
    const snapshot = test.repository.snapshot();
    const workOrders = snapshot.workOrders.filter((workOrder) => workOrder.requestId === request.id);
    expect(workOrders).toHaveLength(1);
    expect(snapshot.requests.find((item) => item.id === request.id)).toMatchObject({
      status: "converted",
      convertedWorkOrderId: workOrders[0].id,
    });
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === workOrders[0].id && event.eventType === "work_order.created")).toHaveLength(1);
  });

  it("serializes request closure against conversion without contradictory state or audit", async () => {
    const test = harness();
    const request = await createReviewedIssue(test);
    const services = racingServices(test);
    const results = await Promise.allSettled([
      createWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: request.storeId,
        requestId: request.id,
        problem: request.problem,
        priority: "urgent",
        accountableParty: "Facilities coordinator",
        nextAction: "Choose service provider",
        escalationTo: "Facilities director",
        initialAssignment: { kind: "choose_later" },
        actor: facilitiesActor,
      }),
      reviewServiceRequest(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        requestId: request.id,
        expectedStatus: "under_review",
        decision: "close",
        note: "Duplicate issue already covered by active work.",
        actor: regionalActor,
      }),
    ]);

    expectExactlyOneConflict(results);
    const snapshot = test.repository.snapshot();
    const storedRequest = snapshot.requests.find((candidate) => candidate.id === request.id)!;
    const workOrders = snapshot.workOrders.filter((workOrder) => workOrder.requestId === request.id);
    const closeEvents = snapshot.auditEvents.filter((event) => event.aggregateId === request.id && event.eventType === "request.closed");
    if (storedRequest.status === "converted") {
      expect(workOrders).toHaveLength(1);
      expect(storedRequest.convertedWorkOrderId).toBe(workOrders[0]!.id);
      expect(closeEvents).toHaveLength(0);
    } else {
      expect(storedRequest.status).toBe("closed");
      expect(storedRequest.convertedWorkOrderId).toBeUndefined();
      expect(workOrders).toHaveLength(0);
      expect(closeEvents).toHaveLength(1);
    }
  });

  it("fences same-state review escalations by affected request version", async () => {
    const test = harness();
    const request = await createReviewedIssue(test);
    const services = racingServices(test);
    const results = await Promise.allSettled([
      reviewServiceRequest(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        requestId: request.id,
        expectedStatus: "under_review",
        decision: "escalate",
        note: "Escalate to regional operations for product-risk review.",
        actor: facilitiesActor,
      }),
      reviewServiceRequest(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        requestId: request.id,
        expectedStatus: "under_review",
        decision: "escalate",
        note: "Escalate to facilities leadership for product-risk review.",
        actor: regionalActor,
      }),
    ]);

    expectExactlyOneConflict(results);
    const snapshot = test.repository.snapshot();
    expect(snapshot.requests.find((candidate) => candidate.id === request.id)).toMatchObject({
      status: "under_review",
      version: 2,
    });
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === request.id && event.eventType === "request.escalated")).toHaveLength(1);
  });

  it("allows only one manager to link a report when two different work orders are chosen concurrently", async () => {
    const test = harness();
    const request = await createServiceRequest(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Taylor Brooks",
      problem: "The east beverage cooler display is dark.",
      priority: "routine",
      actor: facilitiesActor,
    });
    const firstWork = await createWorkOrder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID, storeId: request.storeId,
      problem: "Inspect beverage cooler power.", accountableParty: "Facilities coordinator",
      nextAction: "Choose provider", initialAssignment: { kind: "choose_later" }, actor: facilitiesActor,
    });
    const secondWork = await createWorkOrder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID, storeId: request.storeId,
      problem: "Repair beverage cooler lighting.", accountableParty: "Facilities coordinator",
      nextAction: "Choose provider", initialAssignment: { kind: "choose_later" }, actor: facilitiesActor,
    });
    const services = racingServices(test);
    const results = await Promise.allSettled([
      linkServiceRequestToWorkOrder(services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: firstWork.id, expectedStatus: "submitted", actor: facilitiesActor }),
      linkServiceRequestToWorkOrder(services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: secondWork.id, expectedStatus: "submitted", actor: regionalActor }),
    ]);

    expectExactlyOneConflict(results);
    const stored = await test.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id);
    expect(stored).toMatchObject({ status: "acknowledged", linkedWorkOrderId: expect.stringMatching(new RegExp(`${firstWork.id}|${secondWork.id}`)) });
    expect(test.repository.snapshot().auditEvents.filter((event) => event.aggregateId === request.id && event.eventType === "request.linked_to_existing_work_order")).toHaveLength(1);
  });

  it("creates exactly one follow-up task when two managers reactivate the same acknowledgment", async () => {
    const test = harness();
    const request = await createServiceRequest(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Taylor Brooks",
      problem: "The stockroom door latch is loose.",
      priority: "routine",
      actor: facilitiesActor,
    });
    await acknowledgeServiceRequest(test.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedStatus: "submitted", actor: facilitiesActor });
    const services = racingServices(test);
    const results = await Promise.allSettled([
      requestAcknowledgedServiceRequestFollowUp(services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, explanation: "The latch has detached.", actor: facilitiesActor }),
      requestAcknowledgedServiceRequestFollowUp(services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, explanation: "The door can no longer secure.", actor: regionalActor }),
    ]);

    expectExactlyOneConflict(results);
    const activeTasks = test.repository.snapshot().workflowTasks.filter((task) => task.serviceRequestId === request.id && ["open", "in_progress"].includes(task.status));
    expect(activeTasks).toHaveLength(1);
    expect(await test.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id)).toMatchObject({ status: "under_review", version: 2 });
  });

  it("serializes a new request approval against conversion so neither can bypass the other", async () => {
    const test = harness();
    const request = await createReviewedIssue(test);
    const services = racingServices(test);
    const results = await Promise.allSettled([
      createWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: request.storeId,
        requestId: request.id,
        problem: request.problem,
        priority: "urgent",
        accountableParty: "Facilities coordinator",
        nextAction: "Choose service provider",
        escalationTo: "Facilities director",
        initialAssignment: { kind: "choose_later" },
        actor: facilitiesActor,
      }),
      requestSubjectApproval(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        subjectType: "service_request",
        subjectId: request.id,
        amountMinor: 65_000,
        categoryKey: "refrigeration",
        reason: "Authorize the diagnostic allowance before conversion.",
        actor: facilitiesActor,
      }),
    ]);

    expectExactlyOneConflict(results);
    const snapshot = test.repository.snapshot();
    const workOrders = snapshot.workOrders.filter((workOrder) => workOrder.requestId === request.id);
    const approvals = snapshot.approvalRequests.filter((approval) => approval.subjectType === "service_request" && approval.subjectId === request.id);
    expect(workOrders.length + approvals.length).toBe(1);
    expect(workOrders.length === 1 ? approvals : workOrders).toHaveLength(0);
  });
});


it("version-fences unlink against a concurrent replacement link", async () => {
  const h = harness();
  const storeId = "store-northline-101";
  const request = await createServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId, reporterName: "Test reporter", problem: "Separate light", actor: facilitiesActor });
  const workInput = { organizationId: NORTHLINE_ORGANIZATION_ID, storeId, problem: "Existing work", priority: "routine" as const, accountableParty: "Facilities", nextAction: "Review", initialAssignment: { kind: "choose_later" as const }, actor: facilitiesActor };
  const first = await createWorkOrder(h.services, workInput); const second = await createWorkOrder(h.services, workInput);
  const linked = await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: first.id, expectedStatus: "submitted", actor: facilitiesActor });
  const race = racingServices(h);
  const results = await Promise.allSettled([
    unlinkServiceRequestFromWorkOrder(race, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedWorkOrderId: first.id, expectedVersion: linked.version!, correctionReason: "Unrelated work", actor: facilitiesActor }),
    linkServiceRequestToWorkOrder(race, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: second.id, expectedStatus: "acknowledged", correctionReason: "Correct work", actor: regionalActor }),
  ]);
  expectExactlyOneConflict(results);
  expect(h.repository.snapshot().auditEvents.filter((event) => event.aggregateId === request.id && ["request.work_order_unlinked", "request.work_order_link_corrected"].includes(event.eventType))).toHaveLength(1);
});
