import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  allowedWorkOrderControlTransitions,
  canRouteAndIssueWorkOrder,
  createFollowUp,
  issueWorkOrder,
  rescheduleFollowUp,
  routeAndIssueWorkOrder,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  buildNorthlinePresentationFixture,
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import type { OpsFixture, WorkOrderStatus } from "@/lib/ops/types";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";

vi.mock("server-only", () => ({}));

const NOW = "2026-08-14T12:00:00.000Z";
const PUBLIC_WORK_ORDER_ID = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
const PUBLIC_ASSIGNMENT_ID = "assignment-northline-104-issued";
const PUBLIC_ISSUANCE_ID = "issuance-northline-104-issued-r1";
const OPEN_FOLLOW_UP_ID = "follow-up-recent-aug-102-hvac";
const OPEN_FOLLOW_UP_WORK_ID = "wo-recent-aug-102-hvac";

let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;
let buildVendorIssuanceModel: typeof import("@/app/app/_data/operator-presenter").buildVendorIssuanceModel;
let buildWorkOrderControlModel: typeof import("@/app/app/_data/operator-presenter").buildWorkOrderControlModel;

beforeAll(async () => {
  ({ buildDetailModel, buildVendorIssuanceModel, buildWorkOrderControlModel } = await import("@/app/app/_data/operator-presenter"));
});

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const facilitiesSession: OperatorSession = {
  userId: "user-work-order-truth",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide - 15 stores",
};

function harness(fixture = buildNorthlinePresentationFixture()) {
  const repository = createOpsFixtureRepository(fixture);
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: {
      next(prefix) {
        sequence += 1;
        return `${prefix}-truth-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services };
}

function fixtureWithPublicWorkStatus(status: WorkOrderStatus) {
  const fixture = buildNorthlinePresentationFixture();
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === PUBLIC_WORK_ORDER_ID);
  if (!workOrder) throw new Error("Public work-order fixture is missing");
  workOrder.status = status;
  workOrder.closedAt = status === "closed" || status === "cancelled" ? NOW : undefined;
  return fixture;
}

function publicAuthorizationSnapshot(fixture: OpsFixture): ServiceAuthorizationSnapshot {
  const issuance = fixture.issuances.find((candidate) => candidate.id === PUBLIC_ISSUANCE_ID);
  if (!issuance) throw new Error("Public issuance fixture is missing");
  return JSON.parse(issuance.immutablePayloadJson) as ServiceAuthorizationSnapshot;
}

function controlInput(status: WorkOrderStatus, nextStatus: WorkOrderStatus) {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    workOrderId: PUBLIC_WORK_ORDER_ID,
    expectedStatus: status,
    status: nextStatus,
    note: "Regression-test control update",
    actor: facilitiesActor,
  };
}

describe("work-order control truth boundary", () => {
  it("exposes only the current state and defensible cancellation or closeout transitions", () => {
    const evidenceBearingStatuses = new Set<WorkOrderStatus>([
      "awaiting_approval",
      "approved",
      "issued",
      "accepted",
      "scheduled",
      "in_progress",
      "waiting_on_vendor",
      "waiting_on_parts",
      "completed_pending_review",
    ]);
    const allStatuses: WorkOrderStatus[] = [
      "draft",
      "awaiting_approval",
      "approved",
      "issued",
      "accepted",
      "scheduled",
      "in_progress",
      "waiting_on_vendor",
      "waiting_on_parts",
      "completed_pending_review",
      "closed",
      "cancelled",
    ];

    for (const status of allStatuses) {
      const transitions = allowedWorkOrderControlTransitions(status);
      expect(transitions.every((candidate) => !evidenceBearingStatuses.has(candidate))).toBe(true);
      expect(transitions.every((candidate) => candidate === "closed" || candidate === "cancelled")).toBe(true);
    }
    expect(allowedWorkOrderControlTransitions("issued")).toEqual(["cancelled"]);
    expect(allowedWorkOrderControlTransitions("completed_pending_review")).toEqual(["closed", "cancelled"]);
    expect(allowedWorkOrderControlTransitions("closed")).toEqual([]);
  });

  it("keeps priority, owner, next action, due date, and escalation editable without creating service evidence", async () => {
    const test = harness();
    const before = test.repository.snapshot();

    await updateWorkOrderControl(test.services, {
      ...controlInput("issued", "issued"),
      priority: "planned",
      accountableParty: "Regional facilities lead",
      nextAction: "Confirm revised access window",
      dueAt: "2026-08-20T16:00:00.000Z",
      escalationTo: "Facilities director",
      note: "Store requested a quieter service window; no service event occurred.",
    });

    const after = test.repository.snapshot();
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      status: "issued",
      priority: "planned",
      accountableParty: "Regional facilities lead",
      nextAction: "Confirm revised access window",
      dueAt: "2026-08-20T16:00:00.000Z",
      escalationTo: "Facilities director",
    });
    expect(after.issuances).toEqual(before.issuances);
    expect(after.vendorResponses).toEqual(before.vendorResponses);
    expect(after.visits).toEqual(before.visits);
    expect(after.followUps).toEqual(before.followUps);
    expect(after.auditEvents.slice(before.auditEvents.length)).toContainEqual(expect.objectContaining({
      aggregateId: PUBLIC_WORK_ORDER_ID,
      eventType: "work_order.control_updated",
    }));
  });

  it.each([
    ["draft", "awaiting_approval"],
    ["awaiting_approval", "approved"],
    ["approved", "issued"],
    ["issued", "accepted"],
    ["accepted", "scheduled"],
    ["scheduled", "in_progress"],
    ["in_progress", "waiting_on_parts"],
    ["waiting_on_parts", "completed_pending_review"],
  ] as const)("rejects generic evidence fabrication from %s to %s with no mutation", async (status, nextStatus) => {
    const test = harness(fixtureWithPublicWorkStatus(status));
    const before = test.repository.snapshot();

    await expect(updateWorkOrderControl(test.services, controlInput(status, nextStatus))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("allows cancellation as an attributable administrative action when no visit or follow-up is open", async () => {
    const test = harness();
    const before = test.repository.snapshot();

    await updateWorkOrderControl(test.services, {
      ...controlInput("issued", "cancelled"),
      note: "Duplicate service request confirmed by facilities.",
    });

    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      status: "cancelled",
      accountableParty: "No active owner",
      nextAction: "No further action",
      closedAt: NOW,
    });
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, PUBLIC_ASSIGNMENT_ID)).toMatchObject({ status: "cancelled" });
    expect(test.repository.snapshot().auditEvents.slice(before.auditEvents.length)).toContainEqual(expect.objectContaining({
      eventType: "work_order.cancelled",
    }));
  });

  it.each(["cancelled", "closed"] as const)("rejects %s while an accountable follow-up remains open", async (nextStatus) => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrder = fixture.workOrders.find((candidate) => candidate.id === OPEN_FOLLOW_UP_WORK_ID);
    if (!workOrder) throw new Error("Open follow-up work fixture is missing");
    workOrder.status = nextStatus === "closed" ? "completed_pending_review" : "waiting_on_parts";
    workOrder.closedAt = undefined;
    const test = harness(fixture);
    const before = test.repository.snapshot();

    await expect(updateWorkOrderControl(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedStatus: workOrder.status,
      status: nextStatus,
      note: "Attempted terminal transition with unresolved follow-up",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects follow-up rescheduling when the linked work is terminal", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrder = fixture.workOrders.find((candidate) => candidate.id === OPEN_FOLLOW_UP_WORK_ID);
    if (!workOrder) throw new Error("Open follow-up work fixture is missing");
    workOrder.status = "closed";
    workOrder.closedAt = NOW;
    const test = harness(fixture);
    const before = test.repository.snapshot();

    await expect(rescheduleFollowUp(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      followUpId: OPEN_FOLLOW_UP_ID,
      accountableParty: "Facilities coordinator",
      nextAction: "Attempted terminal reschedule",
      dueAt: "2026-08-21T16:00:00.000Z",
      escalationTo: "Facilities director",
      note: "This must not alter terminal work.",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects creation of a new follow-up on terminal work", async () => {
    const test = harness(fixtureWithPublicWorkStatus("closed"));
    const before = test.repository.snapshot();

    await expect(createFollowUp(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      accountableParty: "Facilities coordinator",
      nextAction: "Attempted post-close action",
      dueAt: "2026-08-21T16:00:00.000Z",
      escalationTo: "Facilities director",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });
});

describe("shared route-and-issue eligibility", () => {
  it("requires approved work and excludes draft, awaiting-approval, in-progress, closeout, and terminal states", () => {
    const eligible: WorkOrderStatus[] = [
      "approved",
      "issued",
      "accepted",
      "scheduled",
      "waiting_on_vendor",
      "waiting_on_parts",
    ];
    const ineligible: WorkOrderStatus[] = [
      "draft",
      "awaiting_approval",
      "in_progress",
      "completed_pending_review",
      "closed",
      "cancelled",
    ];

    for (const status of eligible) expect(canRouteAndIssueWorkOrder(status), status).toBe(true);
    for (const status of ineligible) expect(canRouteAndIssueWorkOrder(status), status).toBe(false);
  });

  it.each(["draft", "awaiting_approval", "in_progress"] as const)("keeps both issuance commands read-only for %s work", async (status) => {
    const fixture = fixtureWithPublicWorkStatus(status);
    const snapshot = publicAuthorizationSnapshot(fixture);
    const direct = harness(fixture);
    const beforeDirect = direct.repository.snapshot();

    await expect(issueWorkOrder(direct.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      assignmentId: PUBLIC_ASSIGNMENT_ID,
      revision: 2,
      channel: "email",
      authorizationSnapshot: snapshot,
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(direct.repository.snapshot()).toEqual(beforeDirect);

    const routedFixture = fixtureWithPublicWorkStatus(status);
    const routed = harness(routedFixture);
    const beforeRouted = routed.repository.snapshot();
    await expect(routeAndIssueWorkOrder(routed.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      vendorId: "vendor-northline-summit",
      expectedRevision: 1,
      channel: "email",
      authorizationSnapshot: publicAuthorizationSnapshot(routedFixture),
      publicToken: {
        tokenHash: "a".repeat(64),
        expiresAt: "2026-09-14T12:00:00.000Z",
      },
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(routed.repository.snapshot()).toEqual(beforeRouted);
  });

  it.each(["draft", "awaiting_approval", "in_progress", "completed_pending_review", "closed", "cancelled"] as const)(
    "uses the same predicate to hide route-and-issue controls for %s work",
    (status) => {
      const fixture = fixtureWithPublicWorkStatus(status);
      expect(buildVendorIssuanceModel(fixture, facilitiesSession, PUBLIC_WORK_ORDER_ID).available).toBe(false);
      expect(buildDetailModel(fixture, facilitiesSession, "work-order", PUBLIC_WORK_ORDER_ID).page.primaryAction).toBeUndefined();
    },
  );

  it("allows an approved, not-yet-assigned work order to enter the vendor-routing flow", () => {
    const fixture = fixtureWithPublicWorkStatus("approved");
    fixture.assignments = fixture.assignments.filter((assignment) => assignment.workOrderId !== PUBLIC_WORK_ORDER_ID);
    fixture.issuances = fixture.issuances.filter((issuance) => issuance.workOrderId !== PUBLIC_WORK_ORDER_ID);

    expect(buildVendorIssuanceModel(fixture, facilitiesSession, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      available: true,
      permitted: true,
      assignmentKind: "choose_later",
    });
    expect(buildDetailModel(fixture, facilitiesSession, "work-order", PUBLIC_WORK_ORDER_ID).page.primaryAction).toMatchObject({
      label: "Choose vendor & generate handoff",
      href: "#issue-work",
    });
  });

  it("renders only administrative transition targets in the generic control editor", () => {
    const issuedFixture = fixtureWithPublicWorkStatus("issued");
    const issued = buildWorkOrderControlModel(issuedFixture, facilitiesSession, PUBLIC_WORK_ORDER_ID);
    expect(issued.statusOptions.map((option) => option.value)).toEqual(["issued", "cancelled"]);
    expect(issued.statusOptions[1]?.description).toBe("Administrative closeout");

    const closeoutFixture = fixtureWithPublicWorkStatus("completed_pending_review");
    const closeout = buildWorkOrderControlModel(closeoutFixture, facilitiesSession, PUBLIC_WORK_ORDER_ID);
    expect(closeout.statusOptions.map((option) => option.value)).toEqual([
      "completed_pending_review",
      "closed",
      "cancelled",
    ]);
  });
});
