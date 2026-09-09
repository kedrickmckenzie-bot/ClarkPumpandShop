import { describe, expect, it } from "vitest";
import {
  checkInVisit,
  checkOutVisit,
  completeFollowUp,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import {
  CLOSE_VERIFIED_WORK_TASK_TITLE,
  RETURN_REJECTED_WORK_TASK_TITLE,
  recordWorkOrderVerification,
  type WorkOrderVerificationRecord,
} from "@/lib/ops/work-order-verification-commands";
import { completeWorkflowTask } from "@/lib/ops/workflow-task-commands";
import type {
  OpsFixture,
  SiteVisitWorkOrder,
  WorkOrderStatus,
  WorkflowTask,
} from "@/lib/ops/types";

const NOW = "2026-08-20T16:00:00.000Z";
const workOrderId = "wo-recent-aug-111-plumbing";
const visitId = "visit-recent-aug-111-plumbing";
const outcomeId = "site-visit-work-order-verification-command";
const outcomeRecordedAt = "2026-08-10T13:37:00.000Z";

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

type VerificationFixture = OpsFixture & {
  workOrderVerifications: WorkOrderVerificationRecord[];
};

function verificationFixture(): VerificationFixture {
  const fixture = buildNorthlinePresentationFixture() as VerificationFixture;
  fixture.siteVisitWorkOrders ??= [];
  fixture.workOrderVerifications ??= [];
  fixture.workOrderVerifications = fixture.workOrderVerifications.filter((record) => record.workOrderId !== workOrderId);
  fixture.siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter((record) => record.workOrderId !== workOrderId);
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === workOrderId)!;
  workOrder.status = "completed_pending_review";
  workOrder.version = 7;
  workOrder.closedAt = undefined;
  Object.assign(workOrder, { resolvedAt: undefined });
  const visit = fixture.visits.find((candidate) => candidate.id === visitId)!;
  visit.status = "checked_out";
  visit.checkedOutAt = outcomeRecordedAt;
  const outcome: SiteVisitWorkOrder = {
    id: outcomeId,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    visitId,
    workOrderId,
    ordinal: 1,
    linkedByActorType: "technician",
    linkedByActorName: "Imani Lewis",
    linkedAt: visit.checkedInAt,
    outcome: "completed",
    outcomeNotes: "Supply connection replaced; no leak observed during repeated use.",
    outcomeRecordedByActorType: "technician",
    outcomeRecordedByActorName: "Imani Lewis",
    outcomeRecordedAt,
  };
  fixture.siteVisitWorkOrders.push(outcome);

  const verifyTask = fixture.workflowTasks.find((task) => (
    task.workOrderId === workOrderId && task.taskType === "verify_repair"
  ));
  if (!verifyTask) throw new Error("Verification test fixture requires a repair-verification task");
  Object.assign(verifyTask, {
    status: "open",
    createdAt: outcomeRecordedAt,
    completedAt: undefined,
    completedByActorType: undefined,
    completedByActorId: undefined,
    completedByActorName: undefined,
    resolutionNote: undefined,
  });
  fixture.workflowTasks = fixture.workflowTasks.filter((task) => (
    task.workOrderId !== workOrderId || task.id === verifyTask.id
  ));
  const sourceFollowUp = fixture.followUps.find((followUp) => followUp.workOrderId === workOrderId);
  if (sourceFollowUp) {
    sourceFollowUp.status = "open";
    sourceFollowUp.completedAt = undefined;
  }
  const currentAssignment = fixture.assignments
    .filter((assignment) => assignment.workOrderId === workOrderId)
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0];
  if (currentAssignment) currentAssignment.status = "accepted";
  return fixture;
}

function serviceReadyFixture(): VerificationFixture {
  const fixture = verificationFixture();
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === workOrderId)!;
  Object.assign(workOrder, {
    status: "accepted",
    accountableParty: "ClearFlow HVAC, Plumbing & Kitchen Repair",
    nextAction: "Begin assigned service",
    dueAt: "2026-08-21T16:00:00.000Z",
    escalationTo: "Facilities director",
    resolvedAt: undefined,
    closedAt: undefined,
  });
  fixture.siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter((record) => record.workOrderId !== workOrderId);
  fixture.followUps = fixture.followUps.filter((followUp) => followUp.workOrderId !== workOrderId);
  const task = fixture.workflowTasks.find((candidate) => candidate.workOrderId === workOrderId)!;
  Object.assign(task, {
    taskType: "confirm_store_access",
    title: "Confirm store access",
    reason: "The assigned technician needs a confirmed service window",
    assigneeType: "vendor",
    assigneeId: "vendor-northline-cedar",
    assigneeRole: undefined,
    assigneeName: "ClearFlow HVAC, Plumbing & Kitchen Repair",
    status: "open",
    blocking: true,
    requiredForProgress: true,
    dueAt: "2026-08-21T16:00:00.000Z",
    noSlaReason: undefined,
    applicableSlaClock: "scheduling",
    completionCriteria: "Begin assigned onsite service",
    escalationDestination: "Facilities director",
    escalationLevel: 0,
    sourceFollowUpId: undefined,
    startedByActorType: undefined,
    startedByActorId: undefined,
    startedByActorName: undefined,
    startedAt: undefined,
    completedByActorType: undefined,
    completedByActorId: undefined,
    completedByActorName: undefined,
    completedAt: undefined,
    cancelledByActorType: undefined,
    cancelledByActorId: undefined,
    cancelledByActorName: undefined,
    cancelledAt: undefined,
    resolutionNote: undefined,
  });
  fixture.workflowTasks = fixture.workflowTasks.filter((candidate) => (
    candidate.workOrderId !== workOrderId || candidate.id === task.id
  ));
  return fixture;
}

function harness(fixture = verificationFixture()) {
  const repository = createOpsFixtureRepository(fixture);
  let now = NOW;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: {
      next(prefix) {
        sequence += 1;
        return `${prefix}-verification-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services, setNow(value: string) { now = value; } };
}

function decisionInput(decision: "verified" | "rejected", reason?: string) {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    workOrderId,
    expectedWorkOrderVersion: 7,
    expectedSiteVisitWorkOrderId: outcomeId,
    expectedOutcomeRecordedAt: outcomeRecordedAt,
    decision,
    reason,
    actor: facilitiesActor,
  };
}

describe("append-only work-order verification and closure", () => {
  it("accepts the exact current outcome, marks work resolved, and creates a separate close obligation", async () => {
    const test = harness();
    const before = test.repository.snapshot();
    const sourceOutcome = before.siteVisitWorkOrders.find((record) => record.id === outcomeId)!;
    const sourceFollowUp = before.followUps.find((record) => record.workOrderId === workOrderId);

    const verification = await recordWorkOrderVerification(
      test.services,
      decisionInput("verified", "Store operations observed normal use with no further leak."),
    );

    expect(verification).toMatchObject({
      workOrderId,
      siteVisitWorkOrderId: outcomeId,
      outcome: "completed",
      cycle: 1,
      decision: "verified",
      decidedByMembershipId: facilitiesActor.actorId,
      decidedAt: NOW,
    });
    const after = test.repository.snapshot() as VerificationFixture;
    expect(after.workOrderVerifications).toContainEqual(expect.objectContaining({
      id: verification.id,
      decision: verification.decision,
      basis: verification.basis,
      verificationScope: verification.verificationScope,
    }));
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "resolved",
      resolvedAt: NOW,
      version: 8,
    });
    expect(after.siteVisitWorkOrders.find((record) => record.id === outcomeId)).toEqual(sourceOutcome);
    expect(after.workflowTasks.find((task) => task.workOrderId === workOrderId && task.taskType === "verify_repair"))
      .toMatchObject({ status: "completed" });
    expect(after.workflowTasks.find((task) => (
      task.workOrderId === workOrderId && (task.taskType as string) === "close_verified_work"
    ))).toMatchObject({
      title: CLOSE_VERIFIED_WORK_TASK_TITLE,
      status: "open",
      blocking: true,
      requiredForProgress: true,
    });
    if (sourceFollowUp) {
      expect(after.followUps.find((record) => record.id === sourceFollowUp.id)).toMatchObject({
        status: "completed",
        completedAt: NOW,
      });
    }
    expect(after.auditEvents.filter((event) => event.aggregateId === workOrderId).map((event) => event.eventType))
      .toContain("work_order.verified_and_resolved");
  });

  it("automatically closes eligible routine work while preserving an open financial review", async () => {
    const fixture = verificationFixture();
    fixture.workflowPolicies = fixture.workflowPolicies?.map((policy) => ({
      ...policy,
      autoCloseRoutineAfterVerification: true,
      appliesToActiveWork: true,
    }));
    const sourceTask = fixture.workflowTasks.find((task) => task.workOrderId === workOrderId)!;
    fixture.workflowTasks.push({
      ...sourceTask,
      id: "workflow-task-finance-after-service-close",
      taskType: "resolve_invoice_exception",
      title: "Review the linked invoice exception",
      assigneeType: "role",
      assigneeId: undefined,
      assigneeRole: "finance_reviewer",
      assigneeName: "Finance review",
      blocking: true,
      requiredForProgress: true,
      sourceFollowUpId: undefined,
      createdAt: "2026-08-20T15:00:00.000Z",
      status: "open",
    });
    const test = harness(fixture);

    const result = await recordWorkOrderVerification(test.services, decisionInput("verified", "The reported leak has stopped during normal use."));

    expect(result).toMatchObject({ autoClosed: true, resultingStatus: "closed" });
    const after = test.repository.snapshot();
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "closed",
      resolvedAt: NOW,
      closedAt: NOW,
    });
    expect(after.workflowTasks.find((task) => task.id === "workflow-task-finance-after-service-close"))
      .toMatchObject({ status: "open", taskType: "resolve_invoice_exception" });
    expect(after.workflowTasks.some((task) => task.workOrderId === workOrderId && task.taskType === "close_verified_work" && task.status === "open"))
      .toBe(false);
    const event = after.auditEvents.find((candidate) => candidate.aggregateId === workOrderId && candidate.eventType === "work_order.verified_and_closed");
    expect(JSON.parse(event!.payloadJson)).toMatchObject({
      autoClosed: true,
      workflowPolicyId: "workflow-policy-northline-v1",
      workflowPolicyVersion: 1,
    });
  });

  it("re-evaluates automatic closure when the final required operational task is completed", async () => {
    const fixture = verificationFixture();
    fixture.workflowPolicies = fixture.workflowPolicies?.map((policy) => ({
      ...policy,
      autoCloseRoutineAfterVerification: true,
      appliesToActiveWork: true,
    }));
    const sourceTask = fixture.workflowTasks.find((task) => task.workOrderId === workOrderId)!;
    fixture.workflowTasks.push({
      ...sourceTask,
      id: "workflow-task-final-operational-review",
      taskType: "other",
      title: "Confirm the final operational note",
      reason: "A required operational note remains after observable verification.",
      sourceFollowUpId: undefined,
      createdAt: "2026-08-20T15:00:00.000Z",
      status: "open",
    });
    const test = harness(fixture);

    const verification = await recordWorkOrderVerification(
      test.services,
      decisionInput("verified", "The reported leak has stopped during normal use."),
    );
    expect(verification).toMatchObject({ autoClosed: false, resultingStatus: "resolved" });

    const completion = await completeWorkflowTask(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: "workflow-task-final-operational-review",
      resolutionNote: "The final operational note is recorded.",
      actor: facilitiesActor,
    });

    expect(completion).toMatchObject({ status: "completed", autoClosed: true });
    const after = test.repository.snapshot();
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "closed",
      closedAt: NOW,
      accountableParty: "No active owner",
      nextAction: "No further operational action",
    });
    expect(after.workflowTasks.filter((task) => task.workOrderId === workOrderId && task.taskType === "close_verified_work"))
      .toEqual([expect.objectContaining({ status: "completed" })]);
    const event = after.auditEvents.find((candidate) => candidate.aggregateId === workOrderId && candidate.eventType === "work_order.auto_closed_after_operational_task");
    expect(JSON.parse(event!.payloadJson)).toMatchObject({
      triggeringWorkflowTaskId: "workflow-task-final-operational-review",
      workflowPolicyId: "workflow-policy-northline-v1",
      workflowPolicyVersion: 1,
    });
  });

  it("records an avoided trip only when a manager explicitly confirms held work completed during planned service", async () => {
    const fixture = verificationFixture();
    const heldOutcome = fixture.siteVisitWorkOrders.find((record) => record.id === outcomeId)!;
    heldOutcome.selectionSource = "held_work";
    heldOutcome.workOrderHoldId = "hold-verification-command";
    const workOrder = fixture.workOrders.find((record) => record.id === workOrderId)!;
    const companion = fixture.workOrders.find((record) => record.storeId === workOrder.storeId && record.id !== workOrderId)!;
    fixture.siteVisitWorkOrders.push({
      id: "site-visit-work-order-planned-command",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId,
      workOrderId: companion.id,
      ordinal: 2,
      linkedByActorType: "technician",
      linkedByActorName: "Imani Lewis",
      linkedAt: heldOutcome.linkedAt,
      selectionSource: "assigned_work",
    });
    const test = harness(fixture);

    const verification = await recordWorkOrderVerification(test.services, {
      ...decisionInput("verified", "The item would otherwise have required its own vendor visit."),
      avoidedSeparateTripConfirmed: true,
    });

    const event = test.repository.snapshot().auditEvents.find((candidate) => (
      candidate.aggregateId === workOrderId
      && candidate.eventType === "work_order.held_work_avoided_trip_verified"
    ));
    expect(JSON.parse(event!.payloadJson)).toMatchObject({
      verificationId: verification.id,
      evidenceCategory: "verified_avoided_trip",
      amountMeaning: "no_dollar_value_inferred",
    });
  });

  it("rejects an avoided-trip claim when held work was picked up on an unplanned visit", async () => {
    const fixture = verificationFixture();
    const heldOutcome = fixture.siteVisitWorkOrders.find((record) => record.id === outcomeId)!;
    heldOutcome.selectionSource = "held_work";
    heldOutcome.workOrderHoldId = "hold-verification-unplanned";
    const test = harness(fixture);

    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      avoidedSeparateTripConfirmed: true,
    })).rejects.toMatchObject({ code: "VALIDATION", message: expect.stringContaining("was not already planned") });
  });

  it("requires a reason to reject and leaves every fact unchanged on validation failure", async () => {
    const test = harness();
    const before = test.repository.snapshot();

    await expect(recordWorkOrderVerification(test.services, decisionInput("rejected")))
      .rejects.toMatchObject({ code: "VALIDATION" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("records an inconclusive observation without treating it as success or rejection and routes review to the current internal owner", async () => {
    const test = harness();

    const result = await recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      decision: "inconclusive",
      reason: "The sink was not available for a normal-use test during the shift change.",
      basis: "observable_result",
      verificationScope: "reported_problem",
    });

    expect(result).toMatchObject({ decision: "inconclusive", autoClosed: false, resultingStatus: "in_progress" });
    const after = test.repository.snapshot();
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "in_progress",
      accountableParty: "Jordan Lee",
    });
    expect(after.workflowTasks.find((task) => task.workOrderId === workOrderId && task.status === "open"))
      .toMatchObject({
        title: "Review an inconclusive store confirmation",
        assigneeType: "user",
        assigneeId: "membership-northline-facilities",
        assigneeName: "Jordan Lee",
      });
    expect(after.auditEvents.map((event) => event.eventType)).toContain("work_order.verification_inconclusive");
  });

  it("rejects completion into a new active cycle without rewriting the prior visit or outcome", async () => {
    const test = harness();
    const beforeOutcome = test.repository.snapshot().siteVisitWorkOrders.find((record) => record.id === outcomeId)!;

    const verification = await recordWorkOrderVerification(
      test.services,
      decisionInput("rejected", "The cabinet is wet again during normal sink use."),
    );

    const after = test.repository.snapshot() as VerificationFixture;
    expect(verification).toMatchObject({ decision: "rejected", cycle: 1 });
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "in_progress",
      resolvedAt: null,
      version: 8,
    });
    expect(after.siteVisitWorkOrders.find((record) => record.id === outcomeId)).toEqual(beforeOutcome);
    expect(after.workflowTasks.find((task) => task.workOrderId === workOrderId && task.status === "open"))
      .toMatchObject({
        taskType: "schedule_return_visit",
        title: RETURN_REJECTED_WORK_TASK_TITLE,
        blocking: true,
      });
    expect(after.auditEvents.filter((event) => event.aggregateId === workOrderId).map((event) => event.eventType))
      .toContain("work_order.verification_rejected");
  });

  it("rejects a stale work-order version or outcome timestamp without partial writes", async () => {
    const test = harness();
    const before = test.repository.snapshot();

    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      expectedOutcomeRecordedAt: "2026-08-10T13:36:59.000Z",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      expectedWorkOrderVersion: 6,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects the prior outcome after a newer return visit has started", async () => {
    const fixture = verificationFixture();
    const sourceVisit = fixture.visits.find((visit) => visit.id === visitId)!;
    fixture.visits.push({
      ...sourceVisit,
      id: "visit-verification-newer-active-cycle",
      status: "active",
      checkedInAt: "2026-08-20T15:00:00.000Z",
      checkedOutAt: undefined,
      outcome: undefined,
      outcomeNotes: undefined,
      observedDurationSeconds: undefined,
    });
    fixture.siteVisitWorkOrders.push({
      id: "site-visit-work-verification-newer-active-cycle",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: "visit-verification-newer-active-cycle",
      workOrderId,
      ordinal: 1,
      linkedByActorType: "technician",
      linkedByActorName: "Imani Lewis",
      linkedAt: "2026-08-20T15:00:00.000Z",
    });
    const test = harness(fixture);
    const before = test.repository.snapshot();

    await expect(recordWorkOrderVerification(test.services, decisionInput("verified")))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("cannot verify with a cross-tenant actor or a cross-tenant outcome id", async () => {
    const fixture = verificationFixture();
    fixture.siteVisitWorkOrders.push({
      ...fixture.siteVisitWorkOrders.find((record) => record.id === outcomeId)!,
      id: "site-visit-work-order-other-tenant",
      organizationId: "org-other-tenant",
    });
    const test = harness(fixture);
    const before = test.repository.snapshot();

    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      actor: { ...facilitiesActor, organizationId: "org-other-tenant" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      expectedSiteVisitWorkOrderId: "site-visit-work-order-other-tenant",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("keeps store-manager confirmation observable and inside the assigned store", async () => {
    const test = harness();
    const before = test.repository.snapshot();
    const store111Actor = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      actorType: "user" as const,
      actorId: "membership-northline-store-111",
      actorName: "Store 111 manager",
    };

    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      basis: "technical_evidence",
      verificationScope: "technical_work",
      actor: store111Actor,
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("observable result") });
    await expect(recordWorkOrderVerification(test.services, {
      ...decisionInput("verified"),
      actor: {
        ...store111Actor,
        actorId: "membership-northline-store-104",
        actorName: "Casey Morgan",
      },
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("assigned operating scope") });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("preserves rejection cycle one through observed return work and accepted cycle two", async () => {
    const test = harness();
    await recordWorkOrderVerification(
      test.services,
      decisionInput("rejected", "The connection still leaks when the basin drains."),
    );

    test.setNow("2026-08-20T17:00:00.000Z");
    const returnVisit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-111",
      workOrderIds: [workOrderId],
      technicianName: "Imani Lewis",
      purpose: "Return work after rejected operational verification",
      channel: "store_device",
      location: {
        result: "trusted_store_device",
        capturedAt: "2026-08-20T17:00:00.000Z",
      },
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "technician",
        actorName: "Imani Lewis",
      },
    });
    expect(returnVisit.vendorId).toBe("vendor-northline-cedar");

    test.setNow("2026-08-20T18:00:00.000Z");
    const checkout = await checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: returnVisit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{
        workOrderId,
        outcome: "completed",
        outcomeNotes: "Replaced the compression fitting and confirmed a dry cabinet through repeated drain cycles.",
      }],
      location: {
        result: "trusted_store_device",
        capturedAt: "2026-08-20T18:00:00.000Z",
      },
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "technician",
        actorName: "Imani Lewis",
      },
    });
    const returnOutcome = checkout.siteVisitWorkOrders[0]!;
    const awaitingVerification = await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId);
    expect(awaitingVerification).toMatchObject({ status: "completed_pending_review", version: 10 });

    test.setNow("2026-08-20T19:00:00.000Z");
    const accepted = await recordWorkOrderVerification(test.services, {
      ...decisionInput("verified", "Store operations confirmed the return repair under normal use."),
      expectedWorkOrderVersion: awaitingVerification!.version ?? 0,
      expectedSiteVisitWorkOrderId: returnOutcome.id,
      expectedOutcomeRecordedAt: returnOutcome.outcomeRecordedAt!,
    });

    const after = test.repository.snapshot() as VerificationFixture;
    expect(accepted.cycle).toBe(2);
    expect(after.workOrderVerifications.filter((verification) => verification.workOrderId === workOrderId).map((verification) => ({
      cycle: verification.cycle,
      decision: verification.decision,
      siteVisitWorkOrderId: verification.siteVisitWorkOrderId,
    }))).toEqual([
      { cycle: 1, decision: "rejected", siteVisitWorkOrderId: outcomeId },
      { cycle: 2, decision: "verified", siteVisitWorkOrderId: returnOutcome.id },
    ]);
    expect(after.siteVisitWorkOrders.filter((record) => record.workOrderId === workOrderId)).toHaveLength(2);
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "resolved",
      resolvedAt: "2026-08-20T19:00:00.000Z",
    });
  });

  it("settles the originating unresolved follow-up through return work before verify and close", async () => {
    const test = harness(serviceReadyFixture());
    const technicianActor = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      actorType: "technician" as const,
      actorName: "Imani Lewis",
    };

    const firstVisit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-111",
      workOrderIds: [workOrderId],
      technicianName: "Imani Lewis",
      purpose: "Diagnose and repair the reported leak",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: NOW },
      actor: technicianActor,
    });
    test.setNow("2026-08-20T17:00:00.000Z");
    const unresolvedCheckout = await checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: firstVisit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{
        workOrderId,
        outcome: "return_visit_required",
        outcomeNotes: "A replacement fitting is required to finish the repair.",
        followUp: {
          accountableParty: "ClearFlow HVAC, Plumbing & Kitchen Repair",
          nextAction: "Return with the replacement fitting",
          dueAt: "2026-08-21T18:00:00.000Z",
          escalationTo: "Facilities director",
        },
      }],
      location: { result: "trusted_store_device", capturedAt: "2026-08-20T17:00:00.000Z" },
      actor: technicianActor,
    });
    const originatingFollowUpId = unresolvedCheckout.siteVisitWorkOrders[0]!.followUpId!;
    expect(test.repository.snapshot().followUps.find((followUp) => followUp.id === originatingFollowUpId))
      .toMatchObject({ status: "open" });

    test.setNow("2026-08-20T18:00:00.000Z");
    const returnVisit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-111",
      workOrderIds: [workOrderId],
      technicianName: "Imani Lewis",
      purpose: "Complete the required return repair",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: "2026-08-20T18:00:00.000Z" },
      actor: technicianActor,
    });
    expect(test.repository.snapshot().workflowTasks.find((task) => task.sourceFollowUpId === originatingFollowUpId))
      .toMatchObject({ taskType: "schedule_return_visit", status: "in_progress" });
    expect(test.repository.snapshot().followUps.find((followUp) => followUp.id === originatingFollowUpId))
      .toMatchObject({ status: "open" });

    test.setNow("2026-08-20T19:00:00.000Z");
    const resolvedCheckout = await checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: returnVisit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{
        workOrderId,
        outcome: "completed",
        outcomeNotes: "Replacement fitting installed and cabinet remained dry through repeated drain cycles.",
      }],
      location: { result: "trusted_store_device", capturedAt: "2026-08-20T19:00:00.000Z" },
      actor: technicianActor,
    });
    const currentOutcome = resolvedCheckout.siteVisitWorkOrders[0]!;
    const afterReturn = test.repository.snapshot();
    expect(afterReturn.followUps.find((followUp) => followUp.id === originatingFollowUpId)).toMatchObject({
      status: "completed",
      completedAt: "2026-08-20T19:00:00.000Z",
    });
    expect(afterReturn.workflowTasks.find((task) => task.sourceFollowUpId === originatingFollowUpId))
      .toMatchObject({ status: "completed" });
    expect(afterReturn.siteVisitWorkOrders.find((link) => link.id === unresolvedCheckout.siteVisitWorkOrders[0]!.id))
      .toMatchObject({ outcome: "return_visit_required", followUpId: originatingFollowUpId });

    const awaitingVerification = await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId);
    test.setNow("2026-08-20T19:20:00.000Z");
    await recordWorkOrderVerification(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedWorkOrderVersion: awaitingVerification!.version ?? 0,
      expectedSiteVisitWorkOrderId: currentOutcome.id,
      expectedOutcomeRecordedAt: currentOutcome.outcomeRecordedAt!,
      decision: "verified",
      reason: "Store operations confirmed the return repair under normal use.",
      actor: facilitiesActor,
    });
    test.setNow("2026-08-20T19:30:00.000Z");
    const closed = await updateWorkOrderControl(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedStatus: "resolved",
      status: "closed",
      note: "Return repair verified and all active obligations settled.",
      actor: facilitiesActor,
    });

    expect(closed.status).toBe("closed");
    expect(test.repository.snapshot().followUps.filter((followUp) => (
      followUp.workOrderId === workOrderId && followUp.status === "open"
    ))).toEqual([]);
  });

  it("keeps return service accountable when an unresolved follow-up is manually completed", async () => {
    const test = harness(serviceReadyFixture());
    const technicianActor = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      actorType: "technician" as const,
      actorName: "Imani Lewis",
    };
    const visit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-111",
      workOrderIds: [workOrderId],
      technicianName: "Imani Lewis",
      purpose: "Diagnose the reported leak",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: NOW },
      actor: technicianActor,
    });
    test.setNow("2026-08-20T17:00:00.000Z");
    const checkout = await checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{
        workOrderId,
        outcome: "parts_required",
        outcomeNotes: "Replacement fitting must be sourced before return service.",
        followUp: {
          accountableParty: "ClearFlow HVAC, Plumbing & Kitchen Repair",
          nextAction: "Confirm replacement fitting availability",
          dueAt: "2026-08-21T18:00:00.000Z",
          escalationTo: "Facilities director",
        },
      }],
      location: { result: "trusted_store_device", capturedAt: "2026-08-20T17:00:00.000Z" },
      actor: technicianActor,
    });
    const sourceOutcome = checkout.siteVisitWorkOrders[0]!;
    test.setNow("2026-08-20T18:00:00.000Z");
    await completeFollowUp(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      followUpId: sourceOutcome.followUpId!,
      resolution: "Replacement fitting is available for the return appointment.",
      actor: facilitiesActor,
    });

    const snapshot = test.repository.snapshot();
    expect(snapshot.siteVisitWorkOrders.find((link) => link.id === sourceOutcome.id)).toEqual(sourceOutcome);
    expect(snapshot.workOrders.find((workOrder) => workOrder.id === workOrderId)).toMatchObject({
      status: "waiting_on_vendor",
      nextAction: "Complete return service and record a new onsite outcome",
    });
    expect(snapshot.workflowTasks.some((task) => (
      task.workOrderId === workOrderId && task.taskType === "verify_repair" && ["open", "in_progress"].includes(task.status)
    ))).toBe(false);
    expect(snapshot.workflowTasks.find((task) => (
      task.workOrderId === workOrderId && task.taskType === "schedule_return_visit" && ["open", "in_progress"].includes(task.status)
    ))).toMatchObject({
      title: "Complete return service and record a new onsite outcome",
      requiredForProgress: true,
    });
  });

  it("allows facilities to close only after accepted verification and all closure gates pass", async () => {
    const test = harness();
    await recordWorkOrderVerification(test.services, decisionInput("verified"));

    const closed = await updateWorkOrderControl(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedStatus: "resolved" as WorkOrderStatus,
      status: "closed",
      note: "Operational result verified; no active service obligations remain.",
      actor: facilitiesActor,
    });

    expect(closed.status).toBe("closed");
    const after = test.repository.snapshot();
    expect(after.workOrders.find((record) => record.id === workOrderId)).toMatchObject({
      status: "closed",
      resolvedAt: NOW,
      closedAt: NOW,
    });
    expect(after.workflowTasks.filter((task) => task.workOrderId === workOrderId && task.status === "open"))
      .toEqual([]);
  });

  it("blocks closure when another required task remains and forbids store-manager closure", async () => {
    const fixture = verificationFixture();
    const source = fixture.workflowTasks.find((task) => task.workOrderId === workOrderId)!;
    fixture.workflowTasks.push({
      ...source,
      id: "workflow-task-other-required-before-close",
      taskType: "other",
      title: "Record final service evidence",
      status: "open",
      sourceFollowUpId: undefined,
      createdAt: "2026-08-20T15:00:00.000Z",
    } satisfies WorkflowTask);
    const test = harness(fixture);
    await recordWorkOrderVerification(test.services, decisionInput("verified"));
    const closeInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedStatus: "resolved" as WorkOrderStatus,
      status: "closed" as const,
      note: "Attempted closeout",
      actor: facilitiesActor,
    };

    await expect(updateWorkOrderControl(test.services, closeInput)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateWorkOrderControl(test.services, {
      ...closeInput,
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "user" as const,
        actorId: "membership-northline-store-104",
        actorName: "Casey Morgan",
      },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId))?.status)
      .toBe("resolved");
  });
});
