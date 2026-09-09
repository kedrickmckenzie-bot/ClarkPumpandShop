import { reviewRequestImpactAssessment } from "@/lib/ops/request-impact-assessment";
import { describe, expect, it } from "vitest";
import {
  acknowledgeServiceRequest,
  createServiceRequest,
  createWorkOrder,
  linkServiceRequestToWorkOrder,
  unlinkServiceRequestFromWorkOrder,
  requestAcknowledgedServiceRequestFollowUp,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildRequestReviewModel } from "@/app/app/_data/operator-presenter";
import type { OperatorSession } from "@/components/ops/data-contract";

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const facilitiesSession: OperatorSession = {
  userId: "user-northline-facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  membershipId: facilitiesActor.actorId,
  displayName: facilitiesActor.actorName,
  email: "jordan.lee@clark-demo.example",
  role: "facilities" as const,
  organizationName: "Clark Pump and Shop",
  scopeLabel: "Clark Pump and Shop companywide · 15 stores",
};

function harness() {
  const fixture = buildNorthlinePresentationFixture();
  const repository = createOpsFixtureRepository(fixture);
  let sequence = 0;
  let now = "2026-09-09T14:00:00.000Z";
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-request-ack-${++sequence}` },
  };
  return { fixture, repository, services, setNow(value: string) { now = value; } };
}

async function report(h: ReturnType<typeof harness>, problem: string, priority: "emergency" | "urgent" | "routine" | "planned" = "routine") {
  return createServiceRequest(h.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-101",
    reporterName: "Avery Johnson",
    reporterEmployeeId: "E3101",
    problem,
    priority,
    actor: facilitiesActor,
  });
}

async function openWork(h: ReturnType<typeof harness>, problem: string) {
  return createWorkOrder(h.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-101",
    problem,
    priority: "routine",
    accountableParty: "Facilities coordinator",
    nextAction: "Choose service provider",
    initialAssignment: { kind: "choose_later" },
    actor: facilitiesActor,
  });
}

describe("simple request acknowledgment", () => {
  it("acknowledges a routine report without creating or linking service work and makes a retry harmless", async () => {
    const h = harness();
    const request = await report(h, "Sales-floor ceiling tile is stained near the beverage aisle.");
    const before = h.repository.snapshot();

    const acknowledged = await acknowledgeServiceRequest(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "submitted",
      actor: facilitiesActor,
    });

    expect(acknowledged).toMatchObject({
      status: "acknowledged",
      acknowledgedAt: "2026-09-09T14:00:00.000Z",
      acknowledgedByActorId: facilitiesActor.actorId,
      acknowledgedByActorName: facilitiesActor.actorName,
    });
    expect(acknowledged.linkedWorkOrderId).toBeUndefined();
    expect(acknowledged.convertedWorkOrderId).toBeUndefined();
    const after = h.repository.snapshot();
    expect(after.workOrders).toHaveLength(before.workOrders.length);
    expect(after.assignments).toHaveLength(before.assignments.length);
    expect(after.visits).toHaveLength(before.visits.length);
    expect(after.costLines).toHaveLength(before.costLines.length);
    expect(after.followUps).toHaveLength(before.followUps.length);
    expect(after.vendorReminders).toHaveLength(before.vendorReminders.length);
    expect(after.workflowTasks).toHaveLength(before.workflowTasks.length);
    expect(after.workflowTasks.find((task) => task.serviceRequestId === request.id)).toMatchObject({
      status: "completed",
      resolutionNote: "Acknowledged — being handled",
    });
    expect(after.auditEvents.find((event) => event.aggregateId === request.id && event.eventType === "request.acknowledged")).toMatchObject({
      actorId: facilitiesActor.actorId,
      actorName: facilitiesActor.actorName,
    });

    const replay = await acknowledgeServiceRequest(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      expectedStatus: "submitted",
      actor: facilitiesActor,
    });
    expect(replay).toMatchObject({ replayed: true, status: "acknowledged" });
    expect(h.repository.snapshot().auditEvents.filter((event) => event.aggregateId === request.id && event.eventType === "request.acknowledged")).toHaveLength(1);
  });

  it("keeps repeated reports separate and exposes only acknowledged unlinked intake in the exact list filter", async () => {
    const h = harness();
    const first = await report(h, "Front entry door is sticking at the threshold.");
    const second = await report(h, "Front entry door is sticking at the threshold.");
    await acknowledgeServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: first.id, expectedStatus: "submitted", actor: facilitiesActor });
    await acknowledgeServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: second.id, expectedStatus: "submitted", actor: facilitiesActor });
    const work = await openWork(h, "Adjust the front entry door closer and threshold.");
    await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: second.id, workOrderId: work.id, expectedStatus: "acknowledged", actor: facilitiesActor });

    const list = await h.repository.listRequests(
      { organizationId: NORTHLINE_ORGANIZATION_ID },
      { status: "acknowledged_unlinked", limit: 100 },
    );
    expect(list.items.map((item) => item.id)).toContain(first.id);
    expect(list.items.map((item) => item.id)).not.toContain(second.id);
    expect(h.repository.snapshot().requests.filter((item) => [first.id, second.id].includes(item.id))).toHaveLength(2);
  });

  it("acknowledges and links existing same-store work without changing service, authorization, visit, or cost facts", async () => {
    const h = harness();
    const work = await openWork(h, "Inspect the sales-floor beverage cooler circuit.");
    const request = await report(h, "The beverage cooler display is intermittently dark.");
    const before = h.repository.snapshot();

    const linked = await linkServiceRequestToWorkOrder(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      workOrderId: work.id,
      expectedStatus: "submitted",
      actor: facilitiesActor,
    });
    expect(linked).toMatchObject({
      status: "acknowledged",
      linkedWorkOrderId: work.id,
      linkedByActorName: facilitiesActor.actorName,
    });
    expect(linked.convertedWorkOrderId).toBeUndefined();
    const after = h.repository.snapshot();
    expect(after.workOrders).toHaveLength(before.workOrders.length);
    expect(after.assignments).toEqual(before.assignments);
    expect(after.issuances).toEqual(before.issuances);
    expect(after.visits).toEqual(before.visits);
    expect(after.costLines).toEqual(before.costLines);
    expect(after.approvalRequests).toEqual(before.approvalRequests);

    const reviewModel = buildRequestReviewModel(after, facilitiesSession, request.id);
    expect(reviewModel).toMatchObject({
      statusLabel: "Acknowledged — being handled",
      acknowledgedBy: facilitiesActor.actorName,
      linkedWorkOrder: { id: work.id, number: work.number },
      canPrepareWorkOrder: false,
      canCreateWorkOrder: false,
    });
  });

  it("requires an audited reason to correct a link and blocks a second canonical work order", async () => {
    const h = harness();
    const firstWork = await openWork(h, "Inspect the entry door hardware.");
    const secondWork = await openWork(h, "Repair the entry door threshold.");
    const request = await report(h, "Front entrance is difficult to open.");
    await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: firstWork.id, expectedStatus: "submitted", actor: facilitiesActor });
    const beforeInvalidCorrection = h.repository.snapshot();

    await expect(linkServiceRequestToWorkOrder(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      workOrderId: secondWork.id,
      expectedStatus: "acknowledged",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(h.repository.snapshot()).toEqual(beforeInvalidCorrection);

    await linkServiceRequestToWorkOrder(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      workOrderId: secondWork.id,
      expectedStatus: "acknowledged",
      correctionReason: "The follow-up photo shows the threshold, not the closer assembly.",
      actor: facilitiesActor,
    });
    expect(await h.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id)).toMatchObject({ linkedWorkOrderId: secondWork.id });
    expect(h.repository.snapshot().auditEvents.find((event) => event.aggregateId === request.id && event.eventType === "request.work_order_link_corrected")?.payloadJson).toContain(firstWork.id);

    await expect(createWorkOrder(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: request.storeId,
      requestId: request.id,
      problem: request.problem,
      priority: "routine",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose provider",
      initialAssignment: { kind: "choose_later" },
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns acknowledged work to follow-up with exactly one reasoned due task", async () => {
    const h = harness();
    const request = await report(h, "Exterior trash enclosure gate latch is loose.");
    await acknowledgeServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedStatus: "submitted", actor: facilitiesActor });
    const beforeMissingReason = h.repository.snapshot();
    await expect(requestAcknowledgedServiceRequestFollowUp(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      explanation: "  ",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(h.repository.snapshot()).toEqual(beforeMissingReason);

    h.setNow("2026-09-10T09:00:00.000Z");
    const followUp = await requestAcknowledgedServiceRequestFollowUp(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      explanation: "The latch has now detached and needs a facilities decision.",
      actor: facilitiesActor,
    });
    expect(followUp.request).toMatchObject({ status: "under_review", acknowledgedAt: "2026-09-09T14:00:00.000Z" });
    expect(followUp.task).toMatchObject({
      taskType: "review_issue",
      status: "open",
      reason: "The latch has now detached and needs a facilities decision.",
      dueAt: "2026-09-11T09:00:00.000Z",
    });
    const replay = await requestAcknowledgedServiceRequestFollowUp(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: request.id,
      explanation: "The latch has now detached and needs a facilities decision.",
      actor: facilitiesActor,
    });
    expect(replay).toMatchObject({ replayed: true, task: { id: followUp.task.id } });
    expect(h.repository.snapshot().workflowTasks.filter((task) => task.serviceRequestId === request.id && ["open", "in_progress"].includes(task.status))).toHaveLength(1);
  });

  it("preserves emergency and reported safety review obligations after acknowledgment", async () => {
    const h = harness();
    const emergency = await report(h, "Fuel-island emergency stop cover is damaged.", "emergency");
    await acknowledgeServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: emergency.id, expectedStatus: "submitted", actor: facilitiesActor });
    expect(await h.repository.getRequest(NORTHLINE_ORGANIZATION_ID, emergency.id)).toMatchObject({ status: "acknowledged", priority: "emergency" });
    expect(h.repository.snapshot().workflowTasks.find((task) => task.serviceRequestId === emergency.id)).toMatchObject({ status: "open" });

    const safety = await createServiceRequest(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Avery Johnson",
      problem: "Loose ceiling fixture above the customer queue.",
      priority: "urgent",
      impact: {
        storeOperatingState: "open",
        safetyConcern: "potential",
        productInventoryRisk: "none_reported",
        customersAffected: "yes",
        complianceImpact: "none_reported",
        redundantEquipment: "unknown",
        confidence: "medium",
        source: "store_report",
      },
      actor: facilitiesActor,
    });
    await acknowledgeServiceRequest(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: safety.id, expectedStatus: "submitted", actor: facilitiesActor });
    expect(h.repository.snapshot().workflowTasks.find((task) => task.serviceRequestId === safety.id)).toMatchObject({ status: "open" });
  });
});


describe("acknowledgment completion corrections", () => {
  it.each([false, true])("uses the effective impact assessment when linking=%s", async (linking) => {
    const h = harness();
    const request = await report(h, "Routine fixture concern awaiting review");
    const initial = (await h.repository.listRequestImpactAssessments(NORTHLINE_ORGANIZATION_ID, request.id)).at(-1)!;
    h.setNow("2026-09-09T14:30:00.000Z");
    const concern = await reviewRequestImpactAssessment(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedRequestStatus: "submitted", expectedLatestAssessmentId: initial.id,
      disposition: "revised", assessment: { ...initial, safetyConcern: "potential", complianceImpact: "none_reported", storeOperatingState: "open" }, actor: facilitiesActor,
    });
    h.setNow("2026-09-09T15:00:00.000Z");
    await reviewRequestImpactAssessment(h.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedRequestStatus: "under_review", expectedLatestAssessmentId: concern.id,
      disposition: "revised", assessment: { ...concern, safetyConcern: "none_reported" }, actor: facilitiesActor,
    });
    const history = await h.repository.listRequestImpactAssessments(NORTHLINE_ORGANIZATION_ID, request.id);
    const input = { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedStatus: "under_review" as const, actor: facilitiesActor };
    if (linking) await linkServiceRequestToWorkOrder(h.services, { ...input, workOrderId: (await openWork(h, "Related routine job")).id });
    else await acknowledgeServiceRequest(h.services, input);
    expect(h.repository.snapshot().workflowTasks.filter((task) => task.serviceRequestId === request.id && task.taskType === "review_issue").every((task) => task.status === "completed")).toBe(true);
    expect(await h.repository.listRequestImpactAssessments(NORTHLINE_ORGANIZATION_ID, request.id)).toEqual(history);
  });

  it("removes an incorrect link with provenance and audit intact, then permits explicit follow-up and work creation", async () => {
    const h = harness();
    const request = await report(h, "Wrongly linked light report");
    const work = await openWork(h, "Unrelated active work");
    const linked = await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: work.id, expectedStatus: "submitted", actor: facilitiesActor });
    const input = { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedWorkOrderId: work.id, expectedVersion: linked.version!, correctionReason: "This report concerns a different fixture", actor: facilitiesActor };
    const before = h.repository.snapshot();
    await expect(unlinkServiceRequestFromWorkOrder(h.services, { ...input, correctionReason: " " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(unlinkServiceRequestFromWorkOrder(h.services, { ...input, expectedWorkOrderId: "wrong-work" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(unlinkServiceRequestFromWorkOrder(h.services, { ...input, organizationId: "other-tenant" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.repository.snapshot()).toEqual(before);
    const result = await unlinkServiceRequestFromWorkOrder(h.services, input);
    expect(result).toMatchObject({ status: "acknowledged", acknowledgedAt: linked.acknowledgedAt, acknowledgedByActorId: linked.acknowledgedByActorId, version: linked.version! + 1 });
    const after = h.repository.snapshot();
    expect(after.requests.find((row) => row.id === request.id)?.linkedWorkOrderId).toBeFalsy();
    expect(after.workOrders).toEqual(before.workOrders);
    expect(after.workflowTasks).toEqual(before.workflowTasks);
    expect(after.assignments).toEqual(before.assignments);
    expect(after.issuances).toEqual(before.issuances);
    expect(after.auditEvents.slice(0, before.auditEvents.length)).toEqual(before.auditEvents);
    const event = after.auditEvents.find((row) => row.eventType === "request.work_order_unlinked")!;
    expect(JSON.parse(event.payloadJson)).toMatchObject({ previousWorkOrderId: work.id, workOrderId: null, correctionReason: input.correctionReason });
    expect(await unlinkServiceRequestFromWorkOrder(h.services, input)).toMatchObject({ replayed: true });
    expect(h.repository.snapshot()).toEqual(after);
    const model = buildRequestReviewModel(after, facilitiesSession, request.id);
    expect(model.followUpAction).toBeTruthy();
    expect(model.linkedWorkOrder).toBeUndefined();
    await requestAcknowledgedServiceRequestFollowUp(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, explanation: "Inspect the separate light", actor: facilitiesActor });
    const initial = (await h.repository.listRequestImpactAssessments(NORTHLINE_ORGANIZATION_ID, request.id)).at(-1)!;
    h.setNow("2026-09-09T16:00:00.000Z");
    await reviewRequestImpactAssessment(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedRequestStatus: "under_review", expectedLatestAssessmentId: initial.id, disposition: "confirmed", assessment: initial, actor: facilitiesActor });
    const created = await createWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: request.storeId, requestId: request.id, problem: request.problem, priority: "routine", accountableParty: "Facilities", nextAction: "Choose provider", initialAssignment: { kind: "choose_later" }, actor: facilitiesActor });
    expect(created.requestId).toBe(request.id);
    expect(await h.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, work.id)).toEqual(before.workOrders.find((row) => row.id === work.id));
  });

  it("rejects a stale unlink after correction or a new association", async () => {
    const h = harness(); const request = await report(h, "Association race");
    const first = await openWork(h, "First work"); const second = await openWork(h, "Second work");
    const linked = await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: first.id, expectedStatus: "submitted", actor: facilitiesActor });
    await linkServiceRequestToWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, workOrderId: second.id, expectedStatus: "acknowledged", correctionReason: "Correct association", actor: facilitiesActor });
    await expect(unlinkServiceRequestFromWorkOrder(h.services, { organizationId: NORTHLINE_ORGANIZATION_ID, requestId: request.id, expectedWorkOrderId: first.id, expectedVersion: linked.version!, correctionReason: "Stale removal", actor: facilitiesActor })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await h.repository.getRequest(NORTHLINE_ORGANIZATION_ID, request.id))?.linkedWorkOrderId).toBe(second.id);
  });
});
