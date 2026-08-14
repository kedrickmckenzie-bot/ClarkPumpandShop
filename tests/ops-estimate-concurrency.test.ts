import { describe, expect, it } from "vitest";
import {
  checkInVisit,
  checkInVisitWithCheckoutToken,
  createWorkOrder,
  markServiceAuthorizationOpened,
  routeAndIssueWorkOrder,
  type CreateWorkOrderInput,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { workOrderMutationFence } from "@/lib/ops/concurrency";
import {
  markEstimateOpened,
  requestEstimate,
  selectEstimate,
  submitEstimate,
} from "@/lib/ops/estimate-commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type {
  MutableOpsFixtureRepository,
  OpsRepository,
  OpsStatement,
} from "@/lib/ops/repository";
import type { ActorContext, WorkOrder } from "@/lib/ops/types";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";

const NOW = "2026-08-14T12:00:00.000Z";
const TOKEN_EXPIRY = "2026-09-14T12:00:00.000Z";
const STORE_ID = "store-northline-101";
const CEDAR = "vendor-northline-cedar";
const SUMMIT = "vendor-northline-summit";

const facilitiesActor: ActorContext = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user",
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

const cedarActor: ActorContext = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "vendor_link",
  actorName: "Cedar Mechanical estimating desk",
};

function tokenHash(character: string) {
  return character.repeat(64);
}

function harness() {
  const repository = createNorthlineFixtureRepository();
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: {
      next(prefix) {
        sequence += 1;
        return `${prefix}-estimate-race-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services };
}

/**
 * Hold the first two transactions until both commands have completed their
 * optimistic reads. The fixture adapter then executes each transaction
 * synchronously, reproducing the same stale-read window as two server calls.
 */
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
  return {
    ...test.services,
    repository: withTwoPartyAtomicWriteBarrier(test.repository),
  };
}

function expectExactlyOneConflict(results: readonly PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({ code: "CONFLICT" });
  return results[0].status === "fulfilled" ? 0 : 1;
}

async function createRaceWorkOrder(
  test: ReturnType<typeof harness>,
  initialAssignment: NonNullable<CreateWorkOrderInput["initialAssignment"]>,
) {
  return createWorkOrder(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: STORE_ID,
    problem: "Beer-cave temperature is above its safe operating range.",
    authorizedScope: "Diagnose the refrigeration fault and report before expanding repair scope.",
    categoryKey: "refrigeration",
    priority: "urgent",
    accountableParty: "Facilities coordinator",
    nextAction: "Compare service options",
    initialAssignment,
    actor: facilitiesActor,
  });
}

async function createSubmittedCedarEstimate(
  test: ReturnType<typeof harness>,
  workOrderId: string,
) {
  const requested = await requestEstimate(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    workOrderId,
    vendorId: CEDAR,
    kind: "estimate_only",
    requestedScope: "Quote the complete evaporator-fan repair, including travel, labor, and materials.",
    channel: "email",
    dueAt: "2026-08-20T16:00:00.000Z",
    publicToken: { tokenHash: tokenHash("a"), expiresAt: TOKEN_EXPIRY },
    actor: facilitiesActor,
  });
  const submitted = await submitEstimate(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    estimateRequestId: requested.request.id,
    vendorId: CEDAR,
    tokenHash: tokenHash("a"),
    expectedRevision: 0,
    amountMinor: 178_000,
    currency: "USD",
    scope: "Replace the failed evaporator-fan assembly and verify operation.",
    exclusions: "Refrigerant-circuit work requires separate authorization.",
    leadTimeDays: 2,
    validUntil: TOKEN_EXPIRY,
    actor: cedarActor,
  });
  return { requested, submitted };
}

function selectionInput(estimate: Awaited<ReturnType<typeof createSubmittedCedarEstimate>>) {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    estimateRequestId: estimate.requested.request.id,
    proposalId: estimate.submitted.proposal.id,
    expectedRevision: 1,
    note: "Cedar supplied the best complete scope and parts availability.",
    actor: facilitiesActor,
  };
}

async function authorizationSnapshot(
  repository: MutableOpsFixtureRepository,
  workOrder: WorkOrder,
  vendorId: string,
): Promise<ServiceAuthorizationSnapshot> {
  const [organization, store, vendor] = await Promise.all([
    repository.getOrganization(NORTHLINE_ORGANIZATION_ID),
    repository.getStore(NORTHLINE_ORGANIZATION_ID, workOrder.storeId),
    repository.getVendor(NORTHLINE_ORGANIZATION_ID, vendorId),
  ]);
  if (!organization || !store || !vendor) throw new Error("Race fixture is missing authorization records");
  return {
    organizationName: organization.name,
    workOrderNumber: workOrder.number,
    store: {
      id: store.id,
      storeNumber: store.storeNumber,
      name: store.name,
      formattedAddress: [
        store.address1,
        store.address2,
        `${store.city}, ${store.state} ${store.postalCode}`,
      ].filter(Boolean).join(", "),
    },
    vendor: { id: vendor.id, name: vendor.name },
    problem: workOrder.problem,
    priority: workOrder.priority,
    authorizedScope: workOrder.authorizedScope,
    categoryKey: workOrder.categoryKey,
    requestedTiming: workOrder.dueAt,
    nte: workOrder.nte,
    billingInstruction: `Reference operator work order ${workOrder.number} on all service paperwork and invoices.`,
  };
}

describe("vendor-estimate concurrency fences", () => {
  it("treats simultaneous opens of one service authorization as one change and one idempotent replay", async () => {
    const test = harness();
    const workOrder = await createRaceWorkOrder(test, { kind: "outside_vendor", vendorId: SUMMIT });
    const issued = await routeAndIssueWorkOrder(
      test.services,
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: workOrder.id,
        vendorId: SUMMIT,
        expectedRevision: 0,
        channel: "email",
        authorizationSnapshot: await authorizationSnapshot(test.repository, workOrder, SUMMIT),
        publicToken: { tokenHash: tokenHash("b"), expiresAt: TOKEN_EXPIRY },
        actor: facilitiesActor,
      },
    );
    const before = test.repository.snapshot();
    const services = racingServices(test);
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: issued.assignment.id,
      issuanceId: issued.issuance.id,
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "vendor_link" as const,
        actorName: "Summit Refrigeration secure link",
      },
    };

    const results = await Promise.all([
      markServiceAuthorizationOpened(services, input),
      markServiceAuthorizationOpened(services, input),
    ]);

    expect(results.filter((result) => result.changed)).toHaveLength(1);
    expect(results.filter((result) => !result.changed)).toHaveLength(1);
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, issued.assignment.id)).toMatchObject({ status: "opened" });
    expect(test.repository.snapshot().auditEvents.slice(before.auditEvents.length).filter((event) => (
      event.eventType === "service_authorization.opened"
    ))).toHaveLength(1);
  });

  it("treats simultaneous opens of one estimate request as one change and one idempotent replay", async () => {
    const test = harness();
    const workOrder = await createRaceWorkOrder(test, { kind: "choose_later" });
    const requested = await requestEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      vendorId: CEDAR,
      kind: "estimate_only",
      requestedScope: "Quote the complete evaporator-fan repair, including travel, labor, and materials.",
      channel: "email",
      dueAt: "2026-08-20T16:00:00.000Z",
      publicToken: { tokenHash: tokenHash("c"), expiresAt: TOKEN_EXPIRY },
      actor: facilitiesActor,
    });
    const before = test.repository.snapshot();
    const services = racingServices(test);
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: requested.request.id,
      vendorId: CEDAR,
      tokenHash: tokenHash("c"),
      actor: cedarActor,
    };

    const results = await Promise.all([
      markEstimateOpened(services, input),
      markEstimateOpened(services, input),
    ]);

    expect(results.filter((result) => result.changed)).toHaveLength(1);
    expect(results.filter((result) => !result.changed)).toHaveLength(1);
    expect(await test.repository.getEstimateRequest(NORTHLINE_ORGANIZATION_ID, requested.request.id)).toMatchObject({ status: "opened" });
    expect(test.repository.snapshot().auditEvents.slice(before.auditEvents.length).filter((event) => (
      event.eventType === "work_order_estimate.opened"
    ))).toHaveLength(1);
  });

  it("commits exactly one assignment when the same estimate is selected concurrently", async () => {
    const test = harness();
    const workOrder = await createRaceWorkOrder(test, { kind: "choose_later" });
    const estimate = await createSubmittedCedarEstimate(test, workOrder.id);
    const before = test.repository.snapshot();
    const services = racingServices(test);

    const results = await Promise.allSettled([
      selectEstimate(services, selectionInput(estimate)),
      selectEstimate(services, selectionInput(estimate)),
    ]);
    expectExactlyOneConflict(results);

    const after = test.repository.snapshot();
    const request = after.estimateRequests.find((row) => row.id === estimate.requested.request.id);
    const activeAssignment = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    expect(request).toMatchObject({ status: "selected", vendorId: CEDAR });
    expect(activeAssignment).toMatchObject({ kind: "outside_vendor", vendorId: CEDAR, status: "pending" });
    expect(after.assignments.slice(before.assignments.length)).toHaveLength(1);
    expect(after.auditEvents.slice(before.auditEvents.length).filter((event) => event.eventType === "work_order_estimate.selected")).toHaveLength(1);
    expect(after.costLines).toEqual(before.costLines);
    expect(after.invoiceReferences).toEqual(before.invoiceReferences);
    expect(after.workOrders.map((row) => row.id)).toEqual(before.workOrders.map((row) => row.id));
  });

  it("commits either selection of revision one or submission of revision two, never both", async () => {
    const test = harness();
    const workOrder = await createRaceWorkOrder(test, { kind: "choose_later" });
    const estimate = await createSubmittedCedarEstimate(test, workOrder.id);
    const before = test.repository.snapshot();
    const services = racingServices(test);

    const results = await Promise.allSettled([
      selectEstimate(services, selectionInput(estimate)),
      submitEstimate(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        estimateRequestId: estimate.requested.request.id,
        vendorId: CEDAR,
        tokenHash: tokenHash("a"),
        expectedRevision: 1,
        amountMinor: 169_000,
        currency: "USD",
        scope: "Revised scope with the confirmed in-stock motor assembly.",
        leadTimeDays: 1,
        validUntil: TOKEN_EXPIRY,
        actor: cedarActor,
      }),
    ]);
    const winner = expectExactlyOneConflict(results);

    const after = test.repository.snapshot();
    const request = after.estimateRequests.find((row) => row.id === estimate.requested.request.id);
    const proposals = after.estimateProposals
      .filter((proposal) => proposal.requestId === estimate.requested.request.id)
      .sort((left, right) => left.revision - right.revision);
    const activeAssignment = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    if (winner === 0) {
      expect(request).toMatchObject({ status: "selected" });
      expect(proposals).toHaveLength(1);
      expect(proposals.at(-1)).toMatchObject({ revision: 1, id: estimate.submitted.proposal.id });
      expect(activeAssignment).toMatchObject({ vendorId: CEDAR, status: "pending" });
    } else {
      expect(request).toMatchObject({ status: "submitted" });
      expect(proposals).toHaveLength(2);
      expect(proposals.at(-1)).toMatchObject({ revision: 2, amount: { amountMinor: 169_000, currency: "USD" } });
      expect(activeAssignment).toMatchObject({ kind: "choose_later", status: "pending" });
    }
    expect(after.costLines).toEqual(before.costLines);
    expect(after.invoiceReferences).toEqual(before.invoiceReferences);
  });

  it("never lets a different vendor issuance race past an open bid decision", async () => {
    const test = harness();
    const created = await createRaceWorkOrder(test, { kind: "choose_later" });
    const estimate = await createSubmittedCedarEstimate(test, created.id);
    const workOrder = await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, created.id);
    if (!workOrder) throw new Error("Race work order was not persisted");
    const snapshot = await authorizationSnapshot(test.repository, workOrder, SUMMIT);
    const before = test.repository.snapshot();
    const services = test.services;

    const results = await Promise.allSettled([
      selectEstimate(services, selectionInput(estimate)),
      routeAndIssueWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: workOrder.id,
        vendorId: SUMMIT,
        expectedRevision: 0,
        channel: "email",
        authorizationSnapshot: snapshot,
        publicToken: { tokenHash: tokenHash("f"), expiresAt: TOKEN_EXPIRY },
        actor: facilitiesActor,
      }),
    ]);
    const winner = expectExactlyOneConflict(results);
    expect(winner).toBe(0);

    const after = test.repository.snapshot();
    const request = after.estimateRequests.find((row) => row.id === estimate.requested.request.id);
    const activeAssignment = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    const newIssuances = after.issuances.slice(before.issuances.length);
    expect(request).toMatchObject({ status: "selected", vendorId: CEDAR });
    expect(activeAssignment).toMatchObject({ vendorId: CEDAR, status: "pending" });
    expect(newIssuances).toHaveLength(0);
    expect(after.assignments.filter((assignment) => assignment.workOrderId === workOrder.id && ["pending", "issued", "opened", "accepted"].includes(assignment.status))).toHaveLength(1);
  });

  it("keeps a live service assignment authoritative when bid selection and vendor check-in overlap", async () => {
    const test = harness();
    const workOrder = await createRaceWorkOrder(test, { kind: "outside_vendor", vendorId: SUMMIT });
    const estimate = await createSubmittedCedarEstimate(test, workOrder.id);
    await test.repository.atomicWrite([{
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", NORTHLINE_ORGANIZATION_ID, workOrder.initialAssignment!.id],
    }]);
    const before = test.repository.snapshot();
    const services = test.services;

    const results = await Promise.allSettled([
      selectEstimate(services, selectionInput(estimate)),
      checkInVisit(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: workOrder.storeId,
        vendorId: SUMMIT,
        workOrderId: workOrder.id,
        technicianName: "Morgan Ellis",
        purpose: "Inspect the beer-cave evaporator fan.",
        channel: "secure_link",
        location: { result: "verified", accuracyM: 12, distanceM: 18, capturedAt: NOW },
        actor: {
          organizationId: NORTHLINE_ORGANIZATION_ID,
          actorType: "technician",
          actorName: "Morgan Ellis",
        },
      }),
    ]);
    const winner = expectExactlyOneConflict(results);
    expect(winner).toBe(1);

    const after = test.repository.snapshot();
    const request = after.estimateRequests.find((row) => row.id === estimate.requested.request.id);
    const activeAssignment = await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    const newVisits = after.visits.slice(before.visits.length).filter((visit) => visit.workOrderId === workOrder.id);
    const persistedWork = await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id);
    expect(request).toMatchObject({ status: "submitted", vendorId: CEDAR });
    expect(activeAssignment).toMatchObject({ vendorId: SUMMIT, status: "issued" });
    expect(newVisits).toHaveLength(1);
    expect(newVisits[0]).toMatchObject({ vendorId: SUMMIT, status: "active" });
    expect(persistedWork).toMatchObject({ status: "in_progress" });
  });

  it("rejects the reserved internal fence namespace as a caller-controlled idempotency key", async () => {
    const test = harness();
    const created = await createRaceWorkOrder(test, { kind: "choose_later" });
    const workOrder = await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, created.id);
    if (!workOrder) throw new Error("Race work order was not persisted");
    const internalFence = await workOrderMutationFence(workOrder, NOW);
    const reservedKey = String(internalFence.params[1]);
    expect(reservedKey).toContain("__traceops_internal__/");
    const before = test.repository.snapshot();

    await expect(checkInVisitWithCheckoutToken(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_ID,
      vendorId: SUMMIT,
      unmatchedReason: "Dispatch did not provide an operator work-order number.",
      technicianName: "Reserved Namespace Probe",
      purpose: "Verify idempotency namespace isolation.",
      channel: "qr",
      location: { result: "verified", accuracyM: 10, distanceM: 14, capturedAt: NOW },
      checkoutToken: { tokenHash: tokenHash("e"), expiresAt: TOKEN_EXPIRY },
      idempotency: {
        key: reservedKey,
        command: "public_technician_check_in",
        requestHash: tokenHash("d"),
        expiresAt: TOKEN_EXPIRY,
      },
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "technician",
        actorName: "Reserved Namespace Probe",
      },
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(before);
  });
});
