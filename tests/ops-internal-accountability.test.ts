import { describe, expect, it } from "vitest";
import {
  reassignWorkOrderInternalAccountability,
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
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => "2026-09-08T15:00:00.000Z" },
    ids: { next: (prefix) => `${prefix}-internal-owner-${++sequence}` },
  };
  return { repository, services };
}

describe("persisted internal work-order accountability", () => {
  it("reassigns facilities-owned tasks to an in-scope membership and records one audit/outbox transaction", async () => {
    const { repository, services } = harness();
    const workOrderId = "wo-northline-115";
    const before = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId))!;

    const result = await reassignWorkOrderInternalAccountability(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedVersion: before.version ?? 0,
      target: { type: "membership", id: "membership-northline-facilities-approver" },
      reason: "Samir is covering facilities decisions this week.",
      actor,
    });

    const snapshot = repository.snapshot();
    const work = snapshot.workOrders.find((candidate) => candidate.id === workOrderId)!;
    const changedTasks = snapshot.workflowTasks.filter((task) => result.changedTaskIds.includes(task.id));
    expect(work).toMatchObject({
      internalAccountableType: "membership",
      internalAccountableId: "membership-northline-facilities-approver",
      internalAccountableParty: "Samir Patel",
      version: (before.version ?? 0) + 1,
    });
    expect(changedTasks.length).toBeGreaterThan(0);
    expect(changedTasks.every((task) => task.assigneeType === "user" && task.assigneeId === "membership-northline-facilities-approver" && task.assigneeName === "Samir Patel")).toBe(true);
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === workOrderId && event.eventType === "work_order.internal_accountability_reassigned")).toHaveLength(1);
    expect(snapshot.outboxMessages.filter((message) => message.aggregateId === workOrderId && message.topic === "ops.work_order.internal_accountability_reassigned")).toHaveLength(1);
  });

  it("keeps a vendor-owned next action with the vendor while moving its escalation to the new internal team", async () => {
    const { repository, services } = harness();
    const workOrderId = "wo-northline-104-issued";
    const beforeWork = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId))!;
    const beforeTask = (await repository.listWorkflowTasksForWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId)).find((task) => task.assigneeType === "vendor")!;

    await reassignWorkOrderInternalAccountability(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      expectedVersion: beforeWork.version ?? 0,
      target: { type: "team", id: "facilities-coordination" },
      reason: "Use the shared coordination queue for after-hours coverage.",
      actor,
    });

    const afterWork = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId))!;
    const afterTask = (await repository.getWorkflowTask(NORTHLINE_ORGANIZATION_ID, beforeTask.id))!;
    expect(afterWork).toMatchObject({
      internalAccountableType: "team",
      internalAccountableId: "facilities-coordination",
      internalAccountableParty: "Facilities coordination team",
      accountableParty: beforeWork.accountableParty,
      nextAction: beforeWork.nextAction,
    });
    expect(afterTask).toMatchObject({
      assigneeType: "vendor",
      assigneeId: beforeTask.assigneeId,
      assigneeName: beforeTask.assigneeName,
      title: beforeTask.title,
      escalationDestination: "Facilities coordination team",
    });
  });

  it("rejects stale versions, unauthorized roles, and out-of-scope regional actors", async () => {
    const { repository, services } = harness();
    const work = (await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, "wo-northline-115"))!;
    const command = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: work.id,
      expectedVersion: (work.version ?? 0) + 1,
      target: { type: "team" as const, id: "facilities-coordination" as const },
      reason: "Coverage change",
      actor,
    };
    await expect(reassignWorkOrderInternalAccountability(services, command)).rejects.toThrow("changed");
    await expect(reassignWorkOrderInternalAccountability(services, {
      ...command,
      expectedVersion: work.version ?? 0,
      actor: { ...actor, actorId: "membership-northline-finance", actorName: "Parker Shaw" },
    })).rejects.toThrow("Facilities or regional access");
    await expect(reassignWorkOrderInternalAccountability(services, {
      ...command,
      expectedVersion: work.version ?? 0,
      actor: { ...actor, actorId: "membership-northline-regional-1", actorName: "North regional manager" },
    })).rejects.toThrow("outside the actor's operating scope");
  });
});
