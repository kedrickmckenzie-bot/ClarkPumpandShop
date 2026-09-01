import { describe, expect, it } from "vitest";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import { resolveVendorResponse } from "@/lib/ops/vendor-response-continuation";

const NOW = "2026-08-20T12:00:00.000Z";
const CONTINUATION_NOW = "2026-08-25T15:00:00.000Z";

function testIds(label: string) {
  let sequence = 0;
  return { next: (prefix: string) => `${prefix}-${label}-${++sequence}` };
}

function wo(id: string, status: "draft" | "issued" | "accepted" | "closed") {
  return {
    id, organizationId: "org-northline-demo", number: `WO-TEST-${id}`, storeId: "store-1", problem: "Test problem",
    priority: "routine" as const, status, accountableParty: "Facilities", nextAction: "", createdAt: "2026-08-01T00:00:00.000Z",
    ...(status === "closed" ? { closedAt: NOW } : {}),
  };
}

describe("work-order case stage projector", () => {
  it("projects intake with accountability from the open blocking task", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-1", "draft"),
      workflowTasks: [{
        id: "task-1", workOrderId: "wo-1", serviceRequestId: "req-1", taskType: "intake_review" as never,
        title: "Review request", assigneeName: "Facilities desk", status: "open", dueAt: "2026-08-21T00:00:00.000Z",
        escalationDestination: "Facilities director", blocking: true, requiredForProgress: true, reason: "New request",
      }],
    });
    expect(view.stage).toBe("intake");
    expect(view.accountableParty).toBe("Facilities desk");
    expect(view.primaryNextAction.label).toBe("Review the request");
    expect(view.dueAt).toBe("2026-08-21T00:00:00.000Z");
    expect(view.stages.filter((stage) => stage.state === "current")).toHaveLength(1);
  });

  it("routes outside-vendor fulfillment through response sub-stages and closed terminal state", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-2", "issued"),
      assignments: [{ id: "a-1", kind: "outside_vendor" as const, status: "issued" as const, assignedAt: "2026-08-02T00:00:00.000Z" }],
      issuances: [{ id: "i-1", assignmentId: "a-1", revision: 2, issuedAt: "2026-08-03T00:00:00.000Z" }],
      vendorResponses: [{ id: "r-1", issuanceId: "i-1", response: "proposed_date" as const, proposedAt: "2026-08-25T09:00:00.000Z", respondedAt: "2026-08-04T00:00:00.000Z" }],
    });
    expect(view.stage).toBe("vendor_response_scheduling");
    expect(view.serviceSubStage?.id).toBe("date_proposed");
    expect(view.primaryNextAction.label).toContain("proposed date");

    const closed = buildWorkOrderCase({ now: NOW, workOrder: wo("wo-2", "closed") });
    expect(closed.stage).toBe("closed");
    expect(closed.serviceSubStage).toBeUndefined();
    expect(closed).toMatchObject({ accountableParty: "No active owner", dueAt: undefined, escalationDestination: "None", primaryActionOverdue: false });
  });

  it("moves a confirmed vendor appointment into scheduled with the appointment as due time", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-3", "accepted"),
      assignments: [{ id: "a-3", kind: "outside_vendor" as const, status: "accepted" as const, assignedAt: "2026-08-02T00:00:00.000Z" }],
      issuances: [{ id: "i-3", assignmentId: "a-3", revision: 1, issuedAt: "2026-08-03T00:00:00.000Z" }],
      appointments: [{ id: "appt-1", status: "confirmed" as const, startsAt: "2026-08-25T09:00:00.000Z", createdAt: NOW, sourceVendorResponseId: "r-9", workOrderId: "wo-3", assignmentId: "a-3", proposedBy: "vendor" as const }],
    });
    expect(view.stage).toBe("vendor_response_scheduling");
    expect(view.serviceSubStage?.id).toBe("scheduled");
    expect(view.dueAt).toBe("2026-08-25T09:00:00.000Z");
    expect(view.primaryNextAction.label).toBe("Track the confirmed service appointment");
  });
});
describe("vendor response continuation", () => {
  it("persists a confirmed appointment with audit and outbox intent when accepting a proposed date", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    const workOrderId = "wo-current-113-freezer-service";
    const responseId = "response-current-113-proposed-date";
    const repository = createOpsFixtureRepository(fixture);
    const before = repository.snapshot().auditEvents.length;
    const result = await resolveVendorResponse(
      { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("accept") },
      {
        organizationId: "org-northline-demo", vendorResponseId: responseId, decision: "accept_proposed_date",
        actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Facilities lead" },
      },
    );
    expect(result.appointment?.status).toBe("confirmed");
    expect(result.appointment?.startsAt).toBe("2026-08-28T14:00:00.000Z");
    expect(await repository.listServiceAppointmentsForWorkOrder("org-northline-demo", workOrderId)).toHaveLength(1);
    const after = repository.snapshot();
    expect(after.auditEvents.length).toBeGreaterThanOrEqual(before + 3);
    expect(after.outboxMessages.some((row) => row.topic === "ops.vendor_response.date_accepted")).toBe(true);
    expect(after.workOrders.find((row) => row.id === workOrderId)).toMatchObject({
      status: "scheduled",
      accountableParty: "ColdLine Refrigeration & HVAC",
      nextAction: "Arrive for the confirmed service window and check in",
    });
    expect(after.workflowTasks.find((row) => row.workOrderId === workOrderId && row.status === "open")).toMatchObject({
      taskType: "confirm_store_access",
      assigneeType: "vendor",
      assigneeName: "ColdLine Refrigeration & HVAC",
    });
  });

  it("rejects unauthorized operators and responses that cannot be continued", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    fixture.vendorResponses.push({
      id: "resp-acc-1", organizationId: "org-northline-demo", workOrderId: "wo-current-113-freezer-service",
      assignmentId: "assignment-current-113-freezer-service", issuanceId: "issuance-current-113-freezer-service-r1", response: "accepted",
      responderName: "Tech", respondedAt: "2026-08-25T16:00:00.000Z",
    });
    const repository = createOpsFixtureRepository(fixture);
    const services = { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("reject") };
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-acc-1", decision: "invalid_action" as never,
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Lead" },
    })).rejects.toThrow(/valid vendor-response action/i);
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-acc-1", decision: "accept_proposed_date",
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Lead" },
    })).rejects.toThrow(/Only a proposed-date response/);
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-nonexistent", decision: "reply_to_question", message: "hello",
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Lead" },
    })).rejects.toThrow(/not found/i);
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-acc-1", decision: "reply_to_question", message: "No lift is needed.",
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-executive", actorName: "Executive" },
    })).rejects.toThrow(/Facilities or regional authority/);
  });

  it("hands accountability back to the vendor after answering a current question", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const response = fixture.vendorResponses.find((row) => row.id === "response-current-113-proposed-date")!;
    response.response = "question";
    response.proposedAt = undefined;
    response.message = "Can the store provide rear mechanical-room access?";
    const repository = createOpsFixtureRepository(fixture);

    await resolveVendorResponse(
      { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("reply") },
      {
        organizationId: "org-northline-demo",
        vendorResponseId: response.id,
        decision: "reply_to_question",
        message: "Yes. The manager will meet the technician at the rear entrance.",
        actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Regional" },
      },
    );

    expect(await repository.getWorkOrder("org-northline-demo", response.workOrderId)).toMatchObject({
      status: "waiting_on_vendor",
      accountableParty: "ColdLine Refrigeration & HVAC",
      nextAction: "Confirm the service plan after the operator reply",
    });
  });
});

describe("stage precedence transition matrix", () => {
  const assignment = { id: "a-9", kind: "outside_vendor" as const, status: "accepted" as const, assignedAt: "2026-08-02T00:00:00.000Z" };

  it("projects Onsite over a confirmed appointment while the visit is open", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-9", "accepted"),
      assignments: [assignment],
      appointments: [{ id: "appt-1", status: "confirmed", startsAt: "2026-08-19T09:00:00.000Z", createdAt: NOW, workOrderId: "wo-9", assignmentId: "a-9", proposedBy: "vendor" }],
      visits: [{ id: "v-1", workOrderId: "wo-9", status: "active", checkedInAt: NOW }],
    });
    expect(view.stage).toBe("onsite_service");
    expect(view.serviceSubStage?.id).toBe("onsite");
    expect(view.alternativeActions.map((action) => action.label)).not.toContain("Request vendor bids instead");
  });

  it("projects Follow-up required for an unresolved checkout and Closeout review once resolved", () => {
    const unresolved = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-9", "accepted"),
      assignments: [assignment],
      visits: [{ id: "v-2", workOrderId: "wo-9", status: "checked_out", checkedInAt: NOW, checkedOutAt: NOW }],
    });
    expect(unresolved.stage).toBe("followup_closeout");
    expect(unresolved.serviceSubStage?.id).toBe("followup_required");

    const resolvedVisit = buildWorkOrderCase({
      now: NOW,
      workOrder: { ...wo("wo-9", "accepted"), status: "completed_pending_review" },
      assignments: [assignment],
      visits: [{ id: "v-3", workOrderId: "wo-9", status: "checked_out", checkedInAt: NOW, checkedOutAt: NOW, outcome: "resolved" as never }],
    });
    expect(resolvedVisit.stage).toBe("followup_closeout");
    expect(resolvedVisit.serviceSubStage?.id).toBe("closeout_review");
  });

  it("keeps an auxiliary reminder visible without letting it replace the current service stage", () => {
    const auxiliary = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-reminder", "issued"),
      assignments: [{ ...assignment, id: "assignment-reminder", status: "issued" }],
      issuances: [{ id: "issuance-reminder", assignmentId: "assignment-reminder", revision: 1, issuedAt: NOW }],
      vendorResponses: [{ id: "response-reminder", issuanceId: "issuance-reminder", response: "proposed_date", respondedAt: NOW, proposedAt: "2026-08-27T15:00:00.000Z" }],
      followUps: [{
        id: "follow-up-reminder", workOrderId: "wo-reminder", status: "open",
        accountableParty: "Parts coordinator", nextAction: "Confirm controller shipment",
        dueAt: "2026-08-28T15:00:00.000Z", escalationTo: "Facilities director",
      }],
    });
    expect(auxiliary.stage).toBe("vendor_response_scheduling");
    expect(auxiliary.serviceSubStage?.id).toBe("date_proposed");
    expect(auxiliary.primaryNextAction.label).toMatch(/proposed date/i);

    const serviceFollowUp = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-return", "accepted"),
      assignments: [{ ...assignment, id: "assignment-return" }],
      visits: [{ id: "visit-return", workOrderId: "wo-return", status: "checked_out", checkedInAt: NOW, checkedOutAt: NOW, outcome: "parts_required" as never }],
      followUps: [{
        id: "follow-up-return", workOrderId: "wo-return", sourceVisitId: "visit-return", status: "open",
        accountableParty: "Facilities coordinator", nextAction: "Confirm parts and return date",
        dueAt: "2026-08-28T15:00:00.000Z", escalationTo: "Facilities director",
      }],
    });
    expect(serviceFollowUp.stage).toBe("followup_closeout");
    expect(serviceFollowUp.serviceSubStage?.id).toBe("followup_required");
  });

  it("keeps recorded cost from pulling a completed job back into vendor scheduling", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: { ...wo("wo-7", "issued"), status: "resolved" as never },
      assignments: [assignment],
      costLines: [{ workOrderId: "wo-7" }],
    });
    expect(view.stage).toBe("followup_closeout");
    expect(view.serviceSubStage?.id).toBe("closeout_review");
  });

  it("treats declined and superseded assignments as inactive fulfillment", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-8", "accepted"),
      assignments: [
        { id: "a-old", kind: "outside_vendor", status: "declined", assignedAt: "2026-08-01T00:00:00.000Z" },
        { id: "a-new", kind: "choose_later", status: "pending", assignedAt: "2026-08-05T00:00:00.000Z" },
      ],
    });
    expect(view.stage).toBe("provider_decision");
  });

  it("moves a selected service bid to authorization and a replacement quote to capital review", () => {
    const service = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-bid-service", "issued"),
      assignments: [{ ...assignment, id: "assignment-selected-service", status: "pending" }],
      estimateRequests: [{ id: "request-selected-service", workOrderId: "wo-bid-service", status: "selected", decisionKind: "service_bid" }],
      estimateProposals: [{ id: "proposal-selected-service", requestId: "request-selected-service", status: "received" }],
    });
    expect(service.stage).toBe("authorization_or_bidding");
    expect(service.primaryNextAction.label).toBe("Issue the service authorization");

    const replacement = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-bid-replacement", "issued"),
      estimateRequests: [{ id: "request-selected-replacement", workOrderId: "wo-bid-replacement", status: "selected", decisionKind: "replacement_quote" }],
      estimateProposals: [{ id: "proposal-selected-replacement", requestId: "request-selected-replacement", kind: "replacement", status: "received" }],
    });
    expect(replacement.stage).toBe("authorization_or_bidding");
    expect(replacement.primaryNextAction.label).toMatch(/capital review/i);
    expect(replacement.blockingReason).toMatch(/replacement quote routes to capital review/i);
  });

  it("moves an approved replacement out of provider selection and into installation coordination", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-approved-replacement", "issued"),
      estimateRequests: [{ id: "request-approved-replacement", workOrderId: "wo-approved-replacement", status: "selected", decisionKind: "replacement_quote" }],
      estimateProposals: [{ id: "proposal-approved-replacement", requestId: "request-approved-replacement", kind: "replacement", status: "received" }],
      replacementEvents: [{ id: "replacement-approved", workOrderId: "wo-approved-replacement", status: "approved", approvedAt: "2026-08-08T00:00:00.000Z" }],
    });
    expect(view.stage).toBe("vendor_response_scheduling");
    expect(view.primaryNextAction.label).toMatch(/coordinate installation/i);
    expect(view.blockingReason).toMatch(/replacement quote is approved/i);
    expect(view.alternativeActions.map((action) => action.label)).not.toContain("Request vendor bids instead");
  });

  it("shows counterproposal pending after an operator counters, and vendor ownership after replying to a question", () => {
    const countered = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-11", "accepted"),
      assignments: [assignment],
      issuances: [{ id: "i-11", assignmentId: "a-9", revision: 1, issuedAt: NOW }],
      appointments: [{ id: "appt-2", status: "counter_proposed", startsAt: "2026-08-27T09:00:00.000Z", createdAt: NOW, workOrderId: "wo-11", assignmentId: "a-9", proposedBy: "operator" }],
    });
    expect(countered.serviceSubStage?.id).toBe("counterproposal_pending");

    const replied = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-12", "accepted"),
      assignments: [assignment],
      issuances: [{ id: "i-12", assignmentId: "a-9", revision: 1, issuedAt: NOW }],
      vendorResponses: [{ id: "r-q1", issuanceId: "i-12", response: "question", respondedAt: NOW }],
      continuations: [{ id: "cont-1", vendorResponseId: "r-q1", workOrderId: "wo-12", action: "reply", createdAt: NOW }],
    });
    expect(replied.serviceSubStage?.id).toBe("waiting_on_vendor");
  });

  it("does not resurrect a declined assignment or attach its issuance to a choose-later route", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-declined", "issued"),
      assignments: [
        { id: "a-declined", kind: "outside_vendor", status: "declined", assignedAt: "2026-08-03T00:00:00.000Z" },
        { id: "a-later", kind: "choose_later", status: "pending", assignedAt: "2026-08-04T00:00:00.000Z", supersedesAssignmentId: "a-declined" },
      ],
      issuances: [{ id: "i-declined", assignmentId: "a-declined", revision: 1, issuedAt: "2026-08-03T01:00:00.000Z" }],
      vendorResponses: [{ id: "r-declined", issuanceId: "i-declined", response: "declined", respondedAt: "2026-08-03T02:00:00.000Z" }],
    });
    expect(view.stage).toBe("provider_decision");
    expect(view.serviceSubStage).toBeUndefined();
  });

  it("routes an assigned internal job to service instead of vendor-response scheduling", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-internal", "accepted"),
      assignments: [{ id: "a-internal", kind: "internal", status: "accepted", assignedAt: "2026-08-04T00:00:00.000Z" }],
      workflowTasks: [{
        id: "task-internal", workOrderId: "wo-internal", taskType: "record_service_outcome",
        title: "Complete the internal repair", assigneeName: "Internal maintenance", status: "open",
        dueAt: "2026-08-21T00:00:00.000Z", escalationDestination: "Facilities director",
        blocking: true, requiredForProgress: true, reason: "Internal assignment",
      }],
    });
    expect(view.stage).toBe("onsite_service");
    expect(view.primaryNextAction.label).toBe("Complete the internal repair");
  });

  it("uses the latest response rather than the oldest response on an issuance", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: wo("wo-latest", "issued"),
      assignments: [{ id: "a-latest", kind: "outside_vendor", status: "issued", assignedAt: "2026-08-02T00:00:00.000Z" }],
      issuances: [{ id: "i-latest", assignmentId: "a-latest", revision: 1, issuedAt: "2026-08-03T00:00:00.000Z" }],
      vendorResponses: [
        { id: "r-old", issuanceId: "i-latest", response: "question", respondedAt: "2026-08-04T00:00:00.000Z" },
        { id: "r-new", issuanceId: "i-latest", response: "proposed_date", proposedAt: "2026-08-26T14:00:00.000Z", respondedAt: "2026-08-05T00:00:00.000Z" },
      ],
    });
    expect(view.serviceSubStage?.id).toBe("date_proposed");
  });

  it("flags overdue primary actions using now versus dueAt", () => {
    const view = buildWorkOrderCase({
      now: "2026-08-30T00:00:00.000Z",
      workOrder: wo("wo-13", "draft"),
      workflowTasks: [{
        id: "task-13", workOrderId: "wo-13", taskType: "intake_review" as never,
        title: "Review request", assigneeName: "Facilities desk", status: "open", dueAt: "2026-08-21T00:00:00.000Z",
        escalationDestination: "Facilities director", blocking: true, requiredForProgress: true, reason: "New request",
      }],
    });
    expect(view.primaryActionOverdue).toBe(true);
  });
});
describe("continuation idempotency", () => {
  it("rejects handling the same response twice and keeps one appointment", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    const workOrderId = "wo-current-113-freezer-service";
    const repository = createOpsFixtureRepository(fixture);
    const services = { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("duplicate") };
    const actor = { organizationId: "org-northline-demo", actorType: "user" as const, actorId: "membership-northline-regional-1", actorName: "Regional" };
    await resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "response-current-113-proposed-date", decision: "accept_proposed_date", actor,
    });
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "response-current-113-proposed-date", decision: "counter_proposed_date", scheduledFor: "2026-08-29T14:00:00.000Z", actor,
    })).rejects.toThrow(/already been handled/);
    expect(await repository.listServiceAppointmentsForWorkOrder("org-northline-demo", workOrderId)).toHaveLength(1);
  });

  it("persists a counterproposal appointment with its continuation fact", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const result = await resolveVendorResponse(
      { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("counter") },
      {
        organizationId: "org-northline-demo", vendorResponseId: "response-current-113-proposed-date", decision: "counter_proposed_date",
        scheduledFor: "2026-08-29T14:00:00.000Z",
        actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Regional" },
      },
    );
    expect(result.appointment?.status).toBe("counter_proposed");
    expect(result.appointment?.proposedBy).toBe("operator");
    expect((await repository.listVendorContinuationsForWorkOrder("org-northline-demo", "wo-current-113-freezer-service")).map((row) => row.action)).toContain("counter_date");
    expect(await repository.getWorkOrder("org-northline-demo", "wo-current-113-freezer-service")).toMatchObject({
      status: "waiting_on_vendor",
      accountableParty: "ColdLine Refrigeration & HVAC",
      nextAction: "Respond to the operator counterproposal",
    });
  });

  it("allows only one of two conflicting operator decisions to commit", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const actor = { organizationId: "org-northline-demo", actorType: "user" as const, actorId: "membership-northline-regional-1", actorName: "Regional" };
    const accept = resolveVendorResponse(
      { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("race-accept") },
      { organizationId: "org-northline-demo", vendorResponseId: "response-current-113-proposed-date", decision: "accept_proposed_date", actor },
    );
    const counter = resolveVendorResponse(
      { repository, clock: { now: () => CONTINUATION_NOW }, ids: testIds("race-counter") },
      { organizationId: "org-northline-demo", vendorResponseId: "response-current-113-proposed-date", decision: "counter_proposed_date", scheduledFor: "2026-08-29T14:00:00.000Z", actor },
    );

    const results = await Promise.allSettled([accept, counter]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    expect(await repository.listVendorContinuationsForWorkOrder("org-northline-demo", "wo-current-113-freezer-service")).toHaveLength(1);
    expect(await repository.listServiceAppointmentsForWorkOrder("org-northline-demo", "wo-current-113-freezer-service")).toHaveLength(1);
  });
});
