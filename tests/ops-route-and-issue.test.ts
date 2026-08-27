import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  checkInVisit,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  routeAndIssueWorkOrder,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import {
  createNorthlineFixtureRepository,
  createOpsFixtureRepository,
} from "@/lib/ops/fixture-repository";
import {
  buildNorthlinePresentationFixture,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import { requestEstimate } from "@/lib/ops/estimate-commands";
import { recordApprovalDecision } from "@/lib/ops/approval-governance";
import type { MutableOpsFixtureRepository } from "@/lib/ops/repository";
import type { OpsFixture, WorkOrder } from "@/lib/ops/types";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";

const NOW = "2026-08-14T12:00:00.000Z";
const TOKEN_EXPIRY = "2026-09-14T12:00:00.000Z";
const SUMMIT = "vendor-northline-summit";
const CEDAR = "vendor-northline-cedar";

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function tokenHash(character: string) {
  return character.repeat(64);
}

function harness(input?: {
  fixture?: OpsFixture;
  collisions?: Partial<Record<string, string[]>>;
}) {
  const repository = input?.fixture
    ? createOpsFixtureRepository(input.fixture)
    : createNorthlineFixtureRepository();
  const collisions = Object.fromEntries(
    Object.entries(input?.collisions ?? {}).map(([prefix, values]) => [prefix, [...(values ?? [])]]),
  ) as Record<string, string[]>;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: {
      next(prefix) {
        const collision = collisions[prefix]?.shift();
        if (collision) return collision;
        sequence += 1;
        return `${prefix}-route-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services };
}

async function createRoutingWorkOrder(
  services: OpsCommandServices,
  initialAssignment: { kind: "choose_later" } | { kind: "outside_vendor"; vendorId: string },
) {
  const workOrder = await createWorkOrder(services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-101",
    problem: "Beer cave temperature is above its safe operating range.",
    authorizedScope: "Diagnose the refrigeration fault and report before exceeding the authorization limit.",
    categoryKey: "refrigeration",
    assetId: "asset-101-beer-cave",
    priority: "urgent",
    nteAmountMinor: 175_000,
    currency: "USD",
    accountableParty: "Facilities coordinator",
    nextAction: "Choose service provider",
    initialAssignment,
    actor: facilitiesActor,
  });
  if (workOrder.approvalRequest) {
    await recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: workOrder.approvalRequest.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-regional-1",
      reason: "Routing test authorization approved before provider selection.",
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "user",
        actorId: "membership-northline-regional-1",
        actorName: "Avery Brooks",
      },
    });
  }
  return workOrder;
}

async function authorizationSnapshot(
  repository: MutableOpsFixtureRepository,
  workOrder: Pick<WorkOrder, "id" | "number" | "storeId" | "problem" | "priority" | "authorizedScope" | "categoryKey" | "assetId" | "dueAt" | "nte">,
  vendorId: string,
): Promise<ServiceAuthorizationSnapshot> {
  const [store, vendor, asset] = await Promise.all([
    repository.getStore(NORTHLINE_ORGANIZATION_ID, workOrder.storeId),
    repository.getVendor(NORTHLINE_ORGANIZATION_ID, vendorId),
    workOrder.assetId ? repository.getAsset(NORTHLINE_ORGANIZATION_ID, workOrder.assetId) : null,
  ]);
  if (!store || !vendor) throw new Error("Test fixture is missing routing records");
  return {
    organizationName: "Clark Pump and Shop",
    workOrderNumber: workOrder.number,
    store: {
      id: store.id,
      storeNumber: store.storeNumber,
      name: store.name,
      formattedAddress: [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "),
    },
    vendor: { id: vendor.id, name: vendor.name },
    problem: workOrder.problem,
    priority: workOrder.priority,
    authorizedScope: workOrder.authorizedScope,
    categoryKey: workOrder.categoryKey,
    asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined,
    requestedTiming: workOrder.dueAt,
    nte: workOrder.nte,
    billingInstruction: `Include operator work-order number ${workOrder.number} on service paperwork and invoices.`,
  };
}

async function routeInput(
  repository: MutableOpsFixtureRepository,
  workOrder: Awaited<ReturnType<typeof createRoutingWorkOrder>>,
  vendorId: string,
  expectedRevision: number,
  hashCharacter: string,
) {
  const currentWorkOrder = await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id);
  if (!currentWorkOrder) throw new Error("Routing test work order disappeared");
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    workOrderId: workOrder.id,
    vendorId,
    expectedRevision,
    channel: "email" as const,
    authorizationSnapshot: await authorizationSnapshot(repository, currentWorkOrder, vendorId),
    publicToken: { tokenHash: tokenHash(hashCharacter), expiresAt: TOKEN_EXPIRY },
    actor: facilitiesActor,
  };
}

describe("atomic vendor routing and issuance", () => {
  it("blocks both issuance seams while vendor bids remain open without mutation", async () => {
    const routed = harness();
    const routedWork = await createRoutingWorkOrder(routed.services, { kind: "choose_later" });
    await requestEstimate(routed.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: routedWork.id,
      vendorId: CEDAR,
      kind: "estimate_only",
      requestedScope: "Return a complete price for the requested refrigeration repair.",
      channel: "email",
      dueAt: "2026-08-20T16:00:00.000Z",
      publicToken: { tokenHash: tokenHash("a"), expiresAt: TOKEN_EXPIRY },
      actor: facilitiesActor,
    });
    const beforeRoutedIssue = routed.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      routed.services,
      await routeInput(routed.repository, routedWork, SUMMIT, 0, "b"),
    )).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Open bid requests must be selected or withdrawn before service work can be issued",
    });
    expect(routed.repository.snapshot()).toEqual(beforeRoutedIssue);

    const direct = harness();
    const directWork = await createRoutingWorkOrder(direct.services, { kind: "outside_vendor", vendorId: SUMMIT });
    await requestEstimate(direct.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: directWork.id,
      vendorId: CEDAR,
      kind: "estimate_only",
      requestedScope: "Return a complete price for the requested refrigeration repair.",
      channel: "email",
      dueAt: "2026-08-20T16:00:00.000Z",
      publicToken: { tokenHash: tokenHash("c"), expiresAt: TOKEN_EXPIRY },
      actor: facilitiesActor,
    });
    const assignment = await direct.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, directWork.id);
    if (!assignment) throw new Error("Direct issuance fixture is missing its assignment");
    const beforeDirectIssue = direct.repository.snapshot();

    await expect(issueWorkOrder(direct.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: directWork.id,
      assignmentId: assignment.id,
      revision: 1,
      channel: "email",
      authorizationSnapshot: await authorizationSnapshot(direct.repository, directWork, SUMMIT),
      publicToken: { tokenHash: tokenHash("d"), expiresAt: TOKEN_EXPIRY },
      actor: facilitiesActor,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Open bid requests must be selected or withdrawn before service work can be issued",
    });
    expect(direct.repository.snapshot()).toEqual(beforeDirectIssue);
  });

  it("supersedes a choose-later assignment and commits the vendor assignment with its issuance", async () => {
    const test = harness();
    const vendorId = SUMMIT;
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "choose_later" });
    const prior = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    const before = test.repository.snapshot();

    const result = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, vendorId, 0, vendorId === SUMMIT ? "1" : "2"),
    );
    const after = test.repository.snapshot();

    expect(prior).not.toBeNull();
    expect(result.assignment).toMatchObject({
      workOrderId: workOrder.id,
      kind: "outside_vendor",
      vendorId,
      status: "issued",
      supersedesAssignmentId: prior?.id,
    });
    expect(result.assignment.id).not.toBe(prior?.id);
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, prior!.id)).toMatchObject({ status: "superseded" });
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, result.assignment.id)).toMatchObject({ status: "issued" });
    expect(await test.repository.getIssuance(NORTHLINE_ORGANIZATION_ID, result.issuance.id)).toMatchObject({
      assignmentId: result.assignment.id,
      revision: 1,
    });
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      status: "issued",
      accountableParty: "Outside vendor",
      nextAction: "Acknowledge service authorization",
    });
    expect(after.publicTokens.slice(before.publicTokens.length)).toContainEqual(expect.objectContaining({
      subjectType: "work_order_issuance",
      subjectId: result.issuance.id,
      purpose: "service_authorization",
    }));
    expect(after.auditEvents.slice(before.auditEvents.length).map((event) => event.eventType))
      .toEqual(["work_order.assigned", "work_order.issued", "workflow_task.completed", "workflow_task.created"]);
    expect(after.outboxMessages.slice(before.outboxMessages.length).map((message) => message.topic))
      .toEqual(["ops.work_order.assigned", "ops.work_order.issued", "ops.workflow_task.completed", "ops.workflow_task.created"]);
  });

  it("requires an explicit reassignment before issuing a different active vendor", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const before = test.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, CEDAR, 0, "2"),
    )).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("reuses one active vendor assignment across immutable issuance revisions", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const initialAssignment = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    const assignmentCount = test.repository.snapshot().assignments.length;

    const first = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "3"),
    );
    const second = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 1, "4"),
    );
    const after = test.repository.snapshot();

    expect(first.assignment.id).toBe(initialAssignment?.id);
    expect(second.assignment.id).toBe(initialAssignment?.id);
    expect(after.assignments).toHaveLength(assignmentCount);
    expect(after.issuances.filter((issuance) => issuance.workOrderId === workOrder.id).map((issuance) => issuance.revision))
      .toEqual([1, 2]);
    expect(after.auditEvents.filter((event) => event.aggregateId === workOrder.id && event.eventType === "work_order.assigned"))
      .toHaveLength(1);
    expect(after.auditEvents.filter((event) => event.aggregateId === workOrder.id && event.eventType === "work_order.issued"))
      .toHaveLength(2);

    const firstToken = after.publicTokens.find((token) => token.subjectId === first.issuance.id && token.purpose === "service_authorization");
    const secondToken = after.publicTokens.find((token) => token.subjectId === second.issuance.id && token.purpose === "service_authorization");
    expect(firstToken).toMatchObject({ tokenHash: tokenHash("3"), revokedAt: NOW });
    expect(secondToken).toMatchObject({ tokenHash: tokenHash("4"), expiresAt: TOKEN_EXPIRY });
    expect(secondToken?.revokedAt).toBeUndefined();
    expect(await test.repository.getServiceAuthorizationByToken({
      tokenHash: tokenHash("3"),
      purpose: "service_authorization",
      now: NOW,
    })).toBeNull();
    expect(await test.repository.getServiceAuthorizationByToken({
      tokenHash: tokenHash("4"),
      purpose: "service_authorization",
      now: NOW,
    })).toMatchObject({ issuanceId: second.issuance.id, revision: 2 });
  });

  it("revokes every older public authorization when the direct issuance command creates a new revision", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const first = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "a"),
    );
    const revisionTwo = await routeInput(test.repository, workOrder, SUMMIT, 1, "b");
    const second = await issueWorkOrder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: first.assignment.id,
      revision: 2,
      channel: revisionTwo.channel,
      authorizationSnapshot: revisionTwo.authorizationSnapshot,
      publicToken: revisionTwo.publicToken,
      actor: facilitiesActor,
    });

    const tokens = test.repository.snapshot().publicTokens.filter((token) => token.purpose === "service_authorization" && [first.issuance.id, second.id].includes(token.subjectId));
    expect(tokens.find((token) => token.subjectId === first.issuance.id)).toMatchObject({ revokedAt: NOW });
    expect(tokens.find((token) => token.subjectId === second.id)?.revokedAt).toBeUndefined();
    expect(await test.repository.getServiceAuthorizationByToken({ tokenHash: tokenHash("a"), purpose: "service_authorization", now: NOW })).toBeNull();
    expect(await test.repository.getServiceAuthorizationByToken({ tokenHash: tokenHash("b"), purpose: "service_authorization", now: NOW })).toMatchObject({ issuanceId: second.id, revision: 2 });
  });

  it("keeps terminal vendor responses scoped to an issuance revision", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const first = await routeAndIssueWorkOrder(test.services, await routeInput(test.repository, workOrder, SUMMIT, 0, "c"));
    await recordVendorResponse(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: first.assignment.id,
      issuanceId: first.issuance.id,
      response: "accepted",
      responderName: "Summit Dispatch",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit Dispatch" },
    });
    const second = await routeAndIssueWorkOrder(test.services, await routeInput(test.repository, workOrder, SUMMIT, 1, "d"));
    await recordVendorResponse(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: second.assignment.id,
      issuanceId: second.issuance.id,
      response: "accepted",
      responderName: "Summit Dispatch",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit Dispatch" },
    });
    await expect(recordVendorResponse(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: second.assignment.id,
      issuanceId: second.issuance.id,
      response: "declined",
      responderName: "Summit Dispatch",
      message: "Duplicate terminal response should not be accepted.",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit Dispatch" },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot().vendorResponses.filter((response) => response.workOrderId === workOrder.id).map((response) => response.issuanceId)).toEqual([first.issuance.id, second.issuance.id]);
  });

  it("does not let a late vendor decline regress work after an onsite visit starts", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const issued = await routeAndIssueWorkOrder(test.services, await routeInput(test.repository, workOrder, SUMMIT, 0, "e"));
    const visit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: workOrder.storeId,
      vendorId: SUMMIT,
      workOrderId: workOrder.id,
      technicianName: "Morgan Ellis",
      purpose: workOrder.problem,
      channel: "qr",
      location: { result: "verified", accuracyM: 12, distanceM: 18, capturedAt: NOW },
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" },
    });
    await expect(recordVendorResponse(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: issued.assignment.id,
      issuanceId: issued.issuance.id,
      response: "declined",
      responderName: "Summit Dispatch",
      message: "Late dispatch correction.",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link", actorName: "Summit Dispatch" },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({ status: "in_progress" });
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, issued.assignment.id)).toMatchObject({ status: "issued" });
    expect(await test.repository.getVisit(NORTHLINE_ORGANIZATION_ID, visit.id)).toMatchObject({ status: "active" });
  });

  it("revokes the live vendor authorization when the canonical work order is cancelled", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const issued = await routeAndIssueWorkOrder(test.services, await routeInput(test.repository, workOrder, SUMMIT, 0, "f"));
    await updateWorkOrderControl(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      expectedStatus: "issued",
      status: "cancelled",
      note: "Store resolved the issue before the vendor arrived.",
      actor: facilitiesActor,
    });

    expect(test.repository.snapshot().publicTokens.find((token) => token.subjectId === issued.issuance.id)).toMatchObject({ revokedAt: NOW });
    expect(await test.repository.getServiceAuthorizationByToken({ tokenHash: tokenHash("f"), purpose: "service_authorization", now: NOW })).toBeNull();
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({ status: "cancelled" });
  });

  it("keeps the revision-one capability active when revision-two token persistence fails", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const first = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "f"),
    );
    const before = test.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 1, "f"),
    )).rejects.toThrow("Duplicate public token hash");

    expect(test.repository.snapshot()).toEqual(before);
    const firstToken = test.repository.snapshot().publicTokens.find((token) => token.subjectId === first.issuance.id);
    expect(firstToken).toMatchObject({ tokenHash: tokenHash("f") });
    expect(firstToken?.revokedAt).toBeUndefined();
    expect(await test.repository.getServiceAuthorizationByToken({
      tokenHash: tokenHash("f"),
      purpose: "service_authorization",
      now: NOW,
    })).toMatchObject({ issuanceId: first.issuance.id, revision: 1 });
  });

  it("chains reassignment from a declined vendor to the next issuance revision", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    const first = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "5"),
    );
    await recordVendorResponse(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: first.assignment.id,
      issuanceId: first.issuance.id,
      response: "declined",
      responderName: "Summit Dispatch",
      message: "No refrigeration technician is available within the requested window.",
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "vendor_link",
        actorName: "Summit Dispatch",
      },
    });
    expect(await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toBeNull();

    const replacement = await routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, CEDAR, 1, "6"),
    );

    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, first.assignment.id)).toMatchObject({ status: "declined" });
    expect(replacement.assignment).toMatchObject({
      vendorId: CEDAR,
      status: "issued",
      supersedesAssignmentId: first.assignment.id,
    });
    expect(replacement.issuance).toMatchObject({
      assignmentId: replacement.assignment.id,
      revision: 2,
    });
    expect(await test.repository.getLatestIssuanceForWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id))
      .toMatchObject({ id: replacement.issuance.id, revision: 2 });
  });

  it("rejects a stale expected revision without mutating assignments, issuances, tokens, audit, or outbox", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "outside_vendor", vendorId: SUMMIT });
    await routeAndIssueWorkOrder(test.services, await routeInput(test.repository, workOrder, SUMMIT, 0, "7"));
    const before = test.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "8"),
    )).rejects.toMatchObject({ code: "CONFLICT" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects invalid snapshot and token inputs before any routing mutation", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "choose_later" });

    const mismatched = await routeInput(test.repository, workOrder, SUMMIT, 0, "9");
    mismatched.authorizationSnapshot.problem = "A stale problem copied from another work order.";
    const beforeSnapshot = test.repository.snapshot();
    await expect(routeAndIssueWorkOrder(test.services, mismatched)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(beforeSnapshot);

    const invalidToken = await routeInput(test.repository, workOrder, SUMMIT, 0, "a");
    invalidToken.publicToken.tokenHash = "not-a-sha256";
    const beforeToken = test.repository.snapshot();
    await expect(routeAndIssueWorkOrder(test.services, invalidToken)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(beforeToken);

    const expiredToken = await routeInput(test.repository, workOrder, SUMMIT, 0, "d");
    expiredToken.publicToken.expiresAt = NOW;
    const beforeExpiry = test.repository.snapshot();
    await expect(routeAndIssueWorkOrder(test.services, expiredToken)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(beforeExpiry);
  });

  it("rejects every stale immutable display or authorization term without routing mutation", async () => {
    const test = harness();
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "choose_later" });
    const cases: Array<{
      label: string;
      mutate(snapshot: ServiceAuthorizationSnapshot): void;
    }> = [
      { label: "organization name", mutate: (snapshot) => { snapshot.organizationName = "Stale Operator Name"; } },
      { label: "store number", mutate: (snapshot) => { snapshot.store.storeNumber = "999"; } },
      { label: "store name", mutate: (snapshot) => { snapshot.store.name = "Stale Store Name"; } },
      { label: "formatted address", mutate: (snapshot) => { snapshot.store.formattedAddress = "999 Stale Address"; } },
      { label: "vendor name", mutate: (snapshot) => { snapshot.vendor.name = "Stale Vendor Name"; } },
      { label: "authorized scope", mutate: (snapshot) => { snapshot.authorizedScope = "An outdated scope of work"; } },
      { label: "requested timing", mutate: (snapshot) => { snapshot.requestedTiming = "2026-08-30T12:00:00.000Z"; } },
      { label: "NTE amount", mutate: (snapshot) => { snapshot.nte = { amountMinor: 999_999, currency: snapshot.nte!.currency }; } },
      { label: "NTE currency", mutate: (snapshot) => { snapshot.nte = { amountMinor: snapshot.nte!.amountMinor, currency: "CAD" }; } },
      { label: "asset name", mutate: (snapshot) => { snapshot.asset = { ...snapshot.asset!, name: "Stale asset display" }; } },
      { label: "asset tag", mutate: (snapshot) => { snapshot.asset = { ...snapshot.asset!, assetTag: "STALE-TAG" }; } },
    ];

    for (const testCase of cases) {
      const input = await routeInput(test.repository, workOrder, SUMMIT, 0, "e");
      testCase.mutate(input.authorizationSnapshot);
      const before = test.repository.snapshot();

      await expect(
        routeAndIssueWorkOrder(test.services, input),
        `${testCase.label} should be rejected`,
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(test.repository.snapshot(), `${testCase.label} must not mutate records`).toEqual(before);
    }
  });

  it("rejects a vendor outside store coverage without changing the choose-later assignment", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.vendorCoverage = fixture.vendorCoverage.filter((coverage) => coverage.vendorId !== CEDAR);
    const test = harness({ fixture });
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "choose_later" });
    const before = test.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, CEDAR, 0, "b"),
    )).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rolls back the replacement assignment, audit, and outbox when issuance persistence fails", async () => {
    const existingIssuanceId = createNorthlineFixtureRepository().snapshot().issuances[0]!.id;
    const test = harness({ collisions: { issuance: [existingIssuanceId] } });
    const workOrder = await createRoutingWorkOrder(test.services, { kind: "choose_later" });
    const before = test.repository.snapshot();

    await expect(routeAndIssueWorkOrder(
      test.services,
      await routeInput(test.repository, workOrder, SUMMIT, 0, "c"),
    )).rejects.toThrow(`Duplicate fixture id ${existingIssuanceId}`);

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("enforces the database's organization/work-order/revision uniqueness in the fixture adapter", async () => {
    const test = harness();
    const existing = test.repository.snapshot().issuances[0]!;
    const before = test.repository.snapshot();

    await expect(test.repository.atomicWrite([{
      sql: "INSERT INTO ops_work_order_issuances (id, organization_id, work_order_id, assignment_id, revision, immutable_payload_json, channel, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      params: [
        "issuance-different-id-same-revision",
        existing.organizationId,
        existing.workOrderId,
        existing.assignmentId,
        existing.revision,
        existing.immutablePayloadJson,
        existing.channel,
        NOW,
      ],
    }])).rejects.toThrow(`Duplicate work-order issuance revision ${existing.revision}`);

    expect(test.repository.snapshot()).toEqual(before);
  });
});

describe("operator issuance route composition", () => {
  it("calls the atomic composite instead of separate assignment and issuance commands", async () => {
    const source = await readFile(
      new URL("../app/api/ops/work-orders/[id]/issue/route.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("issueWorkOrderToVendor");
    expect(source).toMatch(/await\s+issueWorkOrderToVendor\s*\(/);
    expect(source).not.toMatch(/\bassignWorkOrder\s*\(/);
    expect(source).not.toMatch(/\bissueWorkOrder\s*\(/);
  });
});
