import { describe, expect, it } from "vitest";
import {
  assignWorkOrder,
  checkInVisit,
  checkOutVisit,
  createServiceRequest,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

describe("Northline request-to-accountability journey", () => {
  it("preserves one source chain from employee report through vendor checkout", async () => {
    const repository = createNorthlineFixtureRepository();
    let now = "2026-08-11T12:00:00.000Z";
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => now },
      ids: { next: (prefix) => `${prefix}-e2e-${String(++sequence).padStart(3, "0")}` },
    };
    const facilitiesActor = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      actorType: "user" as const,
      actorId: "membership-northline-facilities",
      actorName: "Jordan Lee",
    };

    const request = await createServiceRequest(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      reporterName: "Avery Clerk",
      reporterEmployeeId: "NFM-4102",
      problem: "The beer cave is warm and the evaporator fan is making a grinding sound.",
      priority: "urgent",
      actor: facilitiesActor,
    });
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: request.storeId,
      requestId: request.id,
      problem: request.problem,
      authorizedScope: "Inspect the evaporator fan and restore normal temperature. Call before exceeding authorization.",
      categoryKey: "refrigeration",
      assetId: "asset-101-beer-cave",
      priority: "urgent",
      accountableParty: "Facilities coordinator",
      nextAction: "Select provider",
      nteAmountMinor: 175_000,
      actor: facilitiesActor,
    });
    const assignment = await assignWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      kind: "outside_vendor",
      vendorId: "vendor-northline-summit",
      actor: facilitiesActor,
    });
    const issuance = await issueWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      revision: 1,
      channel: "email",
      authorizationSnapshot: {
        organizationName: "Northline Fuel & Market",
        workOrderNumber: workOrder.number,
        store: { id: workOrder.storeId, storeNumber: "104", name: "Northline Ridgeview", formattedAddress: "104 Ridgeview Drive, Ridgeview, MI 49031" },
        vendor: { id: "vendor-northline-summit", name: "Summit Refrigeration" },
        problem: workOrder.problem,
        priority: workOrder.priority,
        authorizedScope: workOrder.authorizedScope,
        nte: workOrder.nte,
        billingInstruction: `Reference operator work order ${workOrder.number} on all service tickets and invoices.`,
      },
      publicToken: { tokenHash: "c".repeat(64), expiresAt: "2026-08-18T12:00:00.000Z" },
      actor: facilitiesActor,
    });

    now = "2026-08-11T12:15:00.000Z";
    await recordVendorResponse(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      issuanceId: issuance.id,
      response: "accepted",
      responderName: "Summit Dispatch",
      actor: { ...facilitiesActor, actorType: "vendor_link", actorId: undefined, actorName: "Summit Dispatch" },
    });

    now = "2026-08-12T13:00:00.000Z";
    const visit = await checkInVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: request.storeId,
      vendorId: "vendor-northline-summit",
      workOrderId: workOrder.id,
      technicianName: "Morgan Ellis",
      purpose: "Inspect and repair beer cave evaporator fan",
      channel: "qr",
      location: { result: "verified", accuracyM: 14, distanceM: 18, capturedAt: now },
      actor: { ...facilitiesActor, actorType: "technician", actorId: undefined, actorName: "Morgan Ellis" },
    });
    now = "2026-08-12T14:32:00.000Z";
    await checkOutVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "qr",
      outcome: "resolved",
      outcomeNotes: "Replaced the failed fan motor and confirmed normal airflow and temperature pull-down.",
      location: { result: "verified", accuracyM: 12, distanceM: 16, capturedAt: now },
      actor: { ...facilitiesActor, actorType: "technician", actorId: undefined, actorName: "Morgan Ellis" },
    });

    const snapshot = repository.snapshot();
    expect(snapshot.requests.find((item) => item.id === request.id)).toMatchObject({
      status: "converted",
      convertedWorkOrderId: workOrder.id,
    });
    expect(snapshot.workOrders.find((item) => item.id === workOrder.id)).toMatchObject({
      requestId: request.id,
      status: "completed_pending_review",
      accountableParty: "Facilities coordinator",
      nextAction: "Review completed service",
    });
    expect(snapshot.assignments.find((item) => item.id === assignment.id)?.status).toBe("accepted");
    expect(snapshot.vendorResponses.find((item) => item.issuanceId === issuance.id)?.response).toBe("accepted");
    expect(snapshot.visits.find((item) => item.id === visit.id)).toMatchObject({
      status: "checked_out",
      outcome: "resolved",
      observedDurationSeconds: 5_520,
    });
    expect(snapshot.auditEvents.filter((event) => [workOrder.id, visit.id].includes(event.aggregateId)).map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["work_order.created", "work_order.assigned", "work_order.issued", "vendor.accepted", "visit.checked_in", "visit.checked_out"]),
    );
    expect(snapshot.outboxMessages.some((message) => message.aggregateId === visit.id && message.topic === "ops.visit.checked_out")).toBe(true);
  });
});
