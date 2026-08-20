import { describe, expect, it } from "vitest";
import { createServiceRequest, createWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { reviewRequestImpactAssessment, type RequestImpactAssessmentDraft } from "@/lib/ops/request-impact-assessment";
import type { RequestImpactAssessment } from "@/lib/ops/types";

const actor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function harness() {
  const repository = createNorthlineFixtureRepository();
  let sequence = 0;
  let now = "2026-08-20T14:00:00.000Z";
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-impact-test-${++sequence}` },
  };
  return { repository, services, setNow: (value: string) => { now = value; } };
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
  source: "imported",
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

async function createIssue(services: OpsCommandServices) {
  return createServiceRequest(services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-101",
    reporterName: "Taylor Brooks",
    reporterEmployeeId: "EMP-101",
    problem: "The east beverage cooler is warm and product is at risk.",
    priority: "urgent",
    impact: reportedImpact,
    actor,
  });
}

describe("request business-impact assessment loop", () => {
  it("creates the request, initial impact, review Workflow Task, and audit facts atomically", async () => {
    const { repository, services } = harness();
    const before = repository.snapshot();
    const created = await createIssue(services);
    const snapshot = repository.snapshot();

    expect(snapshot.requests).toHaveLength(before.requests.length + 1);
    expect(snapshot.requestImpactAssessments.filter((item) => item.requestId === created.id)).toEqual([
      expect.objectContaining({ id: created.impactAssessment.id, assessmentKind: "initial_report", source: "store_report", storeId: created.storeId }),
    ]);
    expect(snapshot.workflowTasks.filter((task) => task.serviceRequestId === created.id)).toEqual([
      expect.objectContaining({ id: created.workflowTask.id, taskType: "review_issue", status: "open" }),
    ]);
    expect(snapshot.workflowTasks.find((task) => task.id === created.workflowTask.id)?.workOrderId).toBeUndefined();
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === created.id).map((event) => event.eventType)).toEqual(expect.arrayContaining(["request.submitted", "request.impact_assessed"]));
  });

  it("confirms impact and starts request review in one transaction, then gates conversion on that review", async () => {
    const { repository, services, setNow } = harness();
    const created = await createIssue(services);
    setNow("2026-08-20T14:20:00.000Z");
    const reviewed = await reviewRequestImpactAssessment(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: created.id,
      expectedRequestStatus: "submitted",
      expectedLatestAssessmentId: created.impactAssessment.id,
      disposition: "confirmed",
      assessment: { ...draftFrom(created.impactAssessment), confidence: "high", notes: "Manager confirmed; estimates remain unverified." },
      actor,
    });

    let snapshot = repository.snapshot();
    expect(snapshot.requests.find((request) => request.id === created.id)?.status).toBe("under_review");
    expect(snapshot.requestImpactAssessments.filter((item) => item.requestId === created.id)).toHaveLength(2);
    expect(snapshot.workflowTasks.find((task) => task.id === reviewed.workflowTaskId)).toMatchObject({ status: "in_progress", serviceRequestId: created.id });
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === created.id).map((event) => event.eventType)).toEqual(expect.arrayContaining(["request.impact_reviewed", "request.review_started"]));

    setNow("2026-08-20T14:30:00.000Z");
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: created.storeId,
      requestId: created.id,
      problem: created.problem,
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      escalationTo: "Facilities director",
      initialAssignment: { kind: "choose_later" },
      actor,
    });
    snapshot = repository.snapshot();
    expect(snapshot.requests.find((request) => request.id === created.id)).toMatchObject({ status: "converted", convertedWorkOrderId: workOrder.id });
    expect(snapshot.workflowTasks.find((task) => task.id === reviewed.workflowTaskId)).toMatchObject({ status: "completed" });
  });

  it("rejects conversion before manager review and still permits standalone work orders", async () => {
    const { repository, services } = harness();
    const created = await createIssue(services);
    const workInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: created.storeId,
      problem: created.problem,
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      escalationTo: "Facilities director",
      actor,
    };
    await expect(createWorkOrder(services, { ...workInput, requestId: created.id })).rejects.toThrow("Review and confirm the request impact");
    const standalone = await createWorkOrder(services, workInput);
    expect(repository.snapshot().workOrders.find((workOrder) => workOrder.id === standalone.id)?.requestId).toBeUndefined();
  });

  it("uses optimistic assessment identity and leaves no partial review on stale input", async () => {
    const { repository, services } = harness();
    const created = await createIssue(services);
    const before = repository.snapshot();
    await expect(reviewRequestImpactAssessment(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: created.id,
      expectedRequestStatus: "submitted",
      expectedLatestAssessmentId: "stale-impact-id",
      disposition: "confirmed",
      assessment: draftFrom(created.impactAssessment),
      actor,
    })).rejects.toThrow("impact assessment changed");
    const after = repository.snapshot();
    expect(after.requestImpactAssessments).toHaveLength(before.requestImpactAssessments.length);
    expect(after.requests.find((request) => request.id === created.id)?.status).toBe("submitted");
  });

  it("bounds review lookup by organization", async () => {
    const { services } = harness();
    const created = await createIssue(services);
    await expect(reviewRequestImpactAssessment(services, {
      organizationId: "org-other",
      requestId: created.id,
      expectedRequestStatus: "submitted",
      expectedLatestAssessmentId: created.impactAssessment.id,
      disposition: "confirmed",
      assessment: draftFrom(created.impactAssessment),
      actor: { ...actor, organizationId: "org-other" },
    })).rejects.toThrow("Service request not found");
  });
});
