import { describe, expect, it } from "vitest";
import {
  completeVendorReminder,
  createBulkFollowUps,
  createFollowUp,
  createVendorReminder,
  createWorkOrder,
  updateVendorReminder,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const actor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function harness() {
  const repository = createNorthlineFixtureRepository();
  let now = "2026-08-26T14:00:00.000Z";
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-reminder-test-${++sequence}` },
  };
  return { repository, services, setNow: (value: string) => { now = value; } };
}

describe("multi-obligation follow-up and vendor reminders", () => {
  it("keeps multiple work-order follow-ups independently owned and due", async () => {
    const test = harness();
    const workOrder = await createWorkOrder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-103",
      problem: "Walk-in cooler needs a return visit and a separate warranty confirmation.",
      priority: "routine",
      accountableParty: "Facilities coordinator",
      nextAction: "Coordinate the service plan",
      actor,
    });
    const first = await createFollowUp(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      accountableParty: "ColdLine Refrigeration & HVAC",
      nextAction: "Confirm compressor availability",
      dueAt: "2026-08-28T15:00:00.000Z",
      escalationTo: "Facilities coordinator",
      promoteToPrimary: false,
      actor,
    });
    const second = await createFollowUp(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      accountableParty: "Facilities coordinator",
      nextAction: "Confirm warranty coverage",
      dueAt: "2026-08-27T17:00:00.000Z",
      escalationTo: "Facilities director",
      promoteToPrimary: false,
      actor,
    });

    const detail = await test.repository.getWorkOrderDetail({ organizationId: NORTHLINE_ORGANIZATION_ID }, workOrder.id);
    expect(detail?.followUps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.id, accountableParty: "ColdLine Refrigeration & HVAC", dueAt: "2026-08-28T15:00:00.000Z" }),
      expect.objectContaining({ id: second.id, accountableParty: "Facilities coordinator", dueAt: "2026-08-27T17:00:00.000Z" }),
    ]));
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
      accountableParty: "Facilities coordinator",
      nextAction: "Coordinate the service plan",
    });
    expect(test.repository.snapshot().workflowTasks.filter((task) => task.workOrderId === workOrder.id && task.sourceFollowUpId)).toEqual([
      expect.objectContaining({ sourceFollowUpId: first.id, blocking: false, requiredForProgress: false }),
      expect.objectContaining({ sourceFollowUpId: second.id, blocking: false, requiredForProgress: false }),
    ]);
  });

  it("creates, updates, and completes a vendor-level reminder without creating service work", async () => {
    const test = harness();
    const startingWorkOrderCount = test.repository.snapshot().workOrders.length;
    const reminder = await createVendorReminder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      vendorId: "vendor-northline-summit",
      title: "Confirm winter emergency coverage",
      note: "Review the after-hours escalation chain.",
      accountableParty: "Jordan Lee",
      dueAt: "2026-09-01T15:00:00.000Z",
      escalationTo: "Alex Morgan",
      actor,
    });
    test.setNow("2026-08-27T14:00:00.000Z");
    const updated = await updateVendorReminder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      reminderId: reminder.id,
      title: "Confirm winter emergency coverage and rate",
      note: "Review the after-hours escalation chain and callout rate.",
      accountableParty: "Jordan Lee",
      dueAt: "2026-09-03T15:00:00.000Z",
      escalationTo: "Alex Morgan",
      updateNote: "Summit asked for two more days to confirm the rate.",
      actor,
    });
    expect(updated.dueAt).toBe("2026-09-03T15:00:00.000Z");
    test.setNow("2026-09-02T16:00:00.000Z");
    await completeVendorReminder(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      reminderId: reminder.id,
      completionNote: "Emergency coverage and callout rate confirmed by dispatch.",
      actor,
    });

    expect(await test.repository.getVendorReminder(NORTHLINE_ORGANIZATION_ID, reminder.id)).toMatchObject({
      status: "completed",
      completedByActorName: "Jordan Lee",
      completionNote: "Emergency coverage and callout rate confirmed by dispatch.",
    });
    expect(test.repository.snapshot().workOrders).toHaveLength(startingWorkOrderCount);
    expect(test.repository.snapshot().auditEvents.filter((event) => event.aggregateId === "vendor-northline-summit").map((event) => event.eventType))
      .toEqual(expect.arrayContaining(["vendor.reminder_created", "vendor.reminder_updated", "vendor.reminder_completed"]));
  });

  it("adds a non-blocking follow-up to multiple work orders in one batch", async () => {
    const test = harness();
    const selected = test.repository.snapshot().workOrders
      .filter((workOrder) => !["closed", "cancelled", "resolved"].includes(workOrder.status))
      .slice(0, 2);
    const result = await createBulkFollowUps(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderIds: selected.map((workOrder) => workOrder.id),
      accountableParty: "Facilities coordinator",
      nextAction: "Follow up with provider",
      dueAt: "2026-08-28T15:00:00.000Z",
      escalationTo: "Facilities director",
      actor,
    });

    expect(result.count).toBe(2);
    for (const workOrder of selected) {
      const detail = await test.repository.getWorkOrderDetail({ organizationId: NORTHLINE_ORGANIZATION_ID }, workOrder.id);
      expect(detail?.followUps).toEqual(expect.arrayContaining([
        expect.objectContaining({ nextAction: "Follow up with provider", dueAt: "2026-08-28T15:00:00.000Z" }),
      ]));
      expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrder.id)).toMatchObject({
        nextAction: workOrder.nextAction,
        dueAt: workOrder.dueAt,
      });
    }
  });
});
