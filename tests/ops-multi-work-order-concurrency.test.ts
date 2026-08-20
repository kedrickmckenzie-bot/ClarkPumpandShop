import { describe, expect, it } from "vitest";
import { checkInVisit, type OpsCommandServices } from "@/lib/ops/commands";
import { atomicWorkOrderSetMutation } from "@/lib/ops/concurrency";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const NOW = "2026-08-14T16:00:00.000Z";

describe("multi-work-order transaction fence", () => {
  it("advances every observed version together and rejects a stale replay", async () => {
    const repository = createNorthlineFixtureRepository();
    const selected = repository.snapshot().workOrders
      .filter((workOrder) => workOrder.organizationId === NORTHLINE_ORGANIZATION_ID)
      .slice(0, 2);
    expect(selected).toHaveLength(2);

    const statements = selected.map((workOrder, index) => ({
      sql: "UPDATE ops_work_orders SET next_action = ? WHERE organization_id = ? AND id = ?",
      params: [`Shared visit action ${index + 1}`, NORTHLINE_ORGANIZATION_ID, workOrder.id],
    }));

    await atomicWorkOrderSetMutation({ repository, workOrders: selected, now: NOW, statements });

    const updated = await Promise.all(selected.map((workOrder) =>
      repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)));
    expect(updated.map((workOrder) => workOrder?.version)).toEqual(
      selected.map((workOrder) => (workOrder.version ?? 0) + 1),
    );
    expect(updated.map((workOrder) => workOrder?.nextAction)).toEqual([
      "Shared visit action 1",
      "Shared visit action 2",
    ]);

    await expect(atomicWorkOrderSetMutation({
      repository,
      workOrders: selected,
      now: NOW,
      statements,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "One of these work orders changed. Refresh before trying again.",
    });
  });

  it("allows only one active visit to claim a work order across different technicians", async () => {
    const repository = createNorthlineFixtureRepository();
    const workOrderId = "wo-current-113-freezer-service";
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => NOW },
      ids: { next: (prefix) => `${prefix}-active-visit-race-${++sequence}` },
    };
    const checkIn = (technicianName: string) => checkInVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-113",
      workOrderIds: [workOrderId],
      technicianName,
      purpose: "Begin assigned freezer service",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: NOW },
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "technician",
        actorName: technicianName,
      },
    });

    const results = await Promise.allSettled([
      checkIn("Taylor First"),
      checkIn("Morgan Second"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    const snapshot = repository.snapshot();
    const links = snapshot.siteVisitWorkOrders.filter((link) => link.workOrderId === workOrderId);
    const activeVisitIds = new Set(snapshot.visits
      .filter((visit) => visit.status === "active")
      .map((visit) => visit.id));
    expect(links.filter((link) => activeVisitIds.has(link.visitId))).toHaveLength(1);
  });
});
