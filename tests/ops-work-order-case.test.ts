import { describe, expect, it } from "vitest";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import { resolveVendorResponse } from "@/lib/ops/vendor-response-continuation";

const NOW = "2026-08-20T12:00:00.000Z";

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
    expect(closed.serviceSubStage?.id).toBe("closed");
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
  });
});
describe("vendor response continuation", () => {
  it("persists a confirmed appointment with audit and outbox intent when accepting a proposed date", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    const workOrderId = fixture.workOrders[0].id;
    fixture.vendorResponses.push({
      id: "resp-propose-1", organizationId: "org-northline-demo", workOrderId,
      assignmentId: "assign-x", issuanceId: "iss-x", response: "proposed_date",
      responderName: "Summit tech", proposedAt: "2026-08-25T09:00:00.000Z", respondedAt: NOW,
    });
    const repository = createOpsFixtureRepository(fixture);
    const before = repository.snapshot().auditEvents.length;
    const result = await resolveVendorResponse(
      { repository, clock: { now: () => NOW }, ids: { next: (prefix) => `${prefix}-test` } },
      {
        organizationId: "org-northline-demo", vendorResponseId: "resp-propose-1", decision: "accept_proposed_date",
        actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Facilities lead" },
      },
    );
    expect(result.appointment?.status).toBe("confirmed");
    expect(result.appointment?.startsAt).toBe("2026-08-25T09:00:00.000Z");
    expect(await repository.listServiceAppointmentsForWorkOrder("org-northline-demo", workOrderId)).toHaveLength(1);
    const after = repository.snapshot();
    expect(after.auditEvents.length).toBe(before + 1);
    expect(after.outboxMessages.some((row) => row.topic === "ops.vendor_response.date_accepted")).toBe(true);
  });

  it("rejects unauthorized operators and responses that cannot be continued", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    fixture.vendorResponses.push({
      id: "resp-acc-1", organizationId: "org-northline-demo", workOrderId: fixture.workOrders[0].id,
      assignmentId: "assign-y", issuanceId: "iss-y", response: "accepted",
      responderName: "Tech", respondedAt: NOW,
    });
    const repository = createOpsFixtureRepository(fixture);
    const services = { repository, clock: { now: () => NOW }, ids: { next: (p: string) => `${p}-t` } };
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-acc-1", decision: "accept_proposed_date",
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Lead" },
    })).rejects.toThrow(/Only a proposed-date response/);
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-nonexistent", decision: "reply_to_question", message: "hello",
      actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Lead" },
    })).rejects.toThrow(/not found/i);
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

  it("keeps recorded cost from pulling a completed job back into vendor scheduling", () => {
    const view = buildWorkOrderCase({
      now: NOW,
      workOrder: { ...wo("wo-7", "issued"), status: "resolved" as never },
      assignments: [assignment],
      costLines: [{ workOrderId: "wo-7" }],
    });
    expect(view.stage).toBe("cost_invoice_evidence");
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

  it("shows counterproposal pending after an operator counters, and sent after replying to a question", () => {
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
    expect(replied.serviceSubStage?.id).toBe("sent");
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
    const workOrderId = fixture.workOrders[0].id;
    fixture.vendorResponses.push({
      id: "resp-dup-1", organizationId: "org-northline-demo", workOrderId,
      assignmentId: "assign-z", issuanceId: "iss-z", response: "proposed_date",
      responderName: "Tech", proposedAt: "2026-08-25T09:00:00.000Z", respondedAt: NOW,
    });
    const repository = createOpsFixtureRepository(fixture);
    const services = { repository, clock: { now: () => NOW }, ids: { next: (p: string) => `${p}-dup` } };
    const actor = { organizationId: "org-northline-demo", actorType: "user" as const, actorId: "membership-northline-regional-1", actorName: "Regional" };
    await resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-dup-1", decision: "accept_proposed_date", actor,
    });
    await expect(resolveVendorResponse(services, {
      organizationId: "org-northline-demo", vendorResponseId: "resp-dup-1", decision: "accept_proposed_date", actor,
    })).rejects.toThrow(/already been handled/);
    expect(await repository.listServiceAppointmentsForWorkOrder("org-northline-demo", workOrderId)).toHaveLength(1);
  });

  it("persists a counterproposal appointment with its continuation fact", async () => {
    const fixture: OpsFixture = buildNorthlinePresentationFixture();
    fixture.vendorResponses.push({
      id: "resp-counter-1", organizationId: "org-northline-demo", workOrderId: fixture.workOrders[0].id,
      assignmentId: "assign-w", issuanceId: "iss-w", response: "proposed_date",
      responderName: "Tech", proposedAt: "2026-08-25T09:00:00.000Z", respondedAt: NOW,
    });
    const repository = createOpsFixtureRepository(fixture);
    const result = await resolveVendorResponse(
      { repository, clock: { now: () => NOW }, ids: { next: (p: string) => `${p}-c` } },
      {
        organizationId: "org-northline-demo", vendorResponseId: "resp-counter-1", decision: "counter_proposed_date",
        scheduledFor: "2026-08-28T14:00:00.000Z",
        actor: { organizationId: "org-northline-demo", actorType: "user", actorId: "membership-northline-regional-1", actorName: "Regional" },
      },
    );
    expect(result.appointment?.status).toBe("counter_proposed");
    expect(result.appointment?.proposedBy).toBe("operator");
    expect((await repository.listVendorContinuationsForWorkOrder("org-northline-demo", fixture.workOrders[0].id)).map((row) => row.action)).toContain("counter_date");
  });
});