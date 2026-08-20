import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID, buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import {
  completeWorkflowTask,
  createWorkflowTask,
  escalateWorkflowTask,
  pauseWorkflowTaskSla,
  resumeWorkflowTaskSla,
  selectPrimaryWorkflowTask,
} from "@/lib/ops/workflow-task-commands";

const actor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function harness(initialNow = "2026-08-10T18:30:00.000Z") {
  const repository = createNorthlineFixtureRepository();
  let now = initialNow;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-workflow-test-${++sequence}` },
  };
  return { repository, services, setNow: (value: string) => { now = value; } };
}

describe("workflow task and SLA foundation", () => {
  it("seeds every nonterminal work order with a required open task and links open follow-ups", () => {
    const fixture = buildNorthlinePresentationFixture();
    const nonterminal = fixture.workOrders.filter((workOrder) => !["closed", "cancelled"].includes(workOrder.status));

    for (const workOrder of nonterminal) {
      const tasks = fixture.workflowTasks.filter((task) => task.workOrderId === workOrder.id && ["open", "in_progress"].includes(task.status));
      expect(tasks.some((task) => task.requiredForProgress), workOrder.id).toBe(true);
      expect(selectPrimaryWorkflowTask(tasks)).toMatchObject({
        assigneeName: workOrder.accountableParty,
        title: workOrder.nextAction,
        dueAt: workOrder.dueAt,
        escalationDestination: workOrder.escalationTo,
      });
    }

    for (const followUp of fixture.followUps.filter((candidate) => candidate.status === "open")) {
      expect(fixture.workflowTasks.some((task) => task.sourceFollowUpId === followUp.id && task.workOrderId === followUp.workOrderId), followUp.id).toBe(true);
    }
  });

  it("keeps simultaneous obligations without overwriting either source record", async () => {
    const { repository, services } = harness();
    const before = await repository.listWorkflowTasksForWorkOrder(NORTHLINE_ORGANIZATION_ID, "wo-northline-112");
    expect(before.filter((task) => ["open", "in_progress"].includes(task.status))).toHaveLength(2);

    const created = await createWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: "wo-northline-112",
      taskType: "confirm_store_access",
      title: "Confirm manager access for a possible return visit",
      reason: "A return visit may need roof access after diagnosis",
      assigneeType: "role",
      assigneeRole: "store_manager",
      assigneeName: "Store manager",
      priority: "normal",
      blocking: false,
      requiredForProgress: true,
      dueAt: "2026-08-12T16:00:00.000Z",
      applicableSlaClock: "scheduling",
      completionCriteria: "Store access window and contact are recorded",
      escalationDestination: "Regional manager",
      actor,
    });

    const after = await repository.listWorkflowTasksForWorkOrder(NORTHLINE_ORGANIZATION_ID, "wo-northline-112");
    expect(after).toHaveLength(before.length + 1);
    expect(after.some((task) => task.id === created.id)).toBe(true);
    expect(after.filter((task) => ["open", "in_progress"].includes(task.status))).toHaveLength(3);
  });

  it("bounds every task lookup and command by organization before record id", async () => {
    const { repository, services } = harness();
    const task = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId === "wo-northline-115")!;
    expect(await repository.getWorkflowTask("org-other", task.id)).toBeNull();
    await expect(createWorkflowTask(services, {
      organizationId: "org-other",
      workOrderId: task.workOrderId!,
      taskType: "review_issue",
      title: "Cross-tenant attempt",
      reason: "Must not resolve by id alone",
      assigneeType: "role",
      assigneeRole: "facilities_admin",
      assigneeName: "Facilities",
      priority: "normal",
      dueAt: "2026-08-12T16:00:00.000Z",
      completionCriteria: "Never created",
      escalationDestination: "Executive",
      actor: { ...actor, organizationId: "org-other" },
    })).rejects.toThrow("Work order not found in this organization");
  });

  it("appends pause and resume history without changing the work-order lifecycle", async () => {
    const { repository, services, setNow } = harness();
    const task = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId === "wo-northline-115")!;
    const beforeStatus = repository.snapshot().workOrders.find((workOrder) => workOrder.id === task.workOrderId)!.status;

    const pause = await pauseWorkflowTaskSla(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      reasonCode: "awaiting_vendor",
      reasonDetail: "Vendor is confirming crew availability",
      ownerType: "vendor",
      ownerId: "vendor-northline-summit",
      ownerName: "Summit Refrigeration",
      affectedClocks: ["vendor_response", "scheduling"],
      expectedResumeAt: "2026-08-11T16:00:00.000Z",
      actor,
    });
    setNow("2026-08-10T20:00:00.000Z");
    const resume = await resumeWorkflowTaskSla(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      pauseId: pause.id,
      note: "Crew window confirmed",
      actor,
    });

    const snapshot = repository.snapshot();
    expect(snapshot.workflowTaskSlaPauses.find((row) => row.id === pause.id)).toMatchObject({ reasonCode: "awaiting_vendor", affectedClocks: ["vendor_response", "scheduling"] });
    expect(snapshot.workflowTaskSlaResumes.find((row) => row.id === resume.id)).toMatchObject({ pauseId: pause.id, resumedByActorName: actor.actorName });
    expect(await repository.getActiveWorkflowTaskSlaPause(NORTHLINE_ORGANIZATION_ID, task.id)).toBeNull();
    expect(snapshot.workOrders.find((workOrder) => workOrder.id === task.workOrderId)!.status).toBe(beforeStatus);
  });

  it("makes the same explicit escalation idempotent and emits one audit/outbox pair", async () => {
    const { repository, services } = harness();
    const task = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId === "wo-northline-115")!;
    const command = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      escalationDestination: "Regional facilities lead",
      escalationLevel: 1,
      reason: "Provider selection is approaching its response target",
      actor,
    };

    await escalateWorkflowTask(services, command);
    await escalateWorkflowTask(services, command);
    const snapshot = repository.snapshot();
    expect(snapshot.workflowTasks.find((candidate) => candidate.id === task.id)).toMatchObject({ escalationDestination: "Regional facilities lead", escalationLevel: 1 });
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === task.id && event.eventType === "workflow_task.escalated")).toHaveLength(1);
    expect(snapshot.outboxMessages.filter((message) => message.aggregateId === task.id && message.topic === "ops.workflow_task.escalated")).toHaveLength(1);
  });

  it("rejects open tasks on terminal work and protects the last required task unless replacement is atomic", async () => {
    const { repository, services } = harness();
    await expect(createWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: "wo-northline-101",
      taskType: "verify_repair",
      title: "Invalid terminal obligation",
      reason: "Closed work must not regain open tasks",
      assigneeType: "role",
      assigneeRole: "facilities_admin",
      assigneeName: "Facilities",
      priority: "normal",
      dueAt: "2026-08-12T16:00:00.000Z",
      completionCriteria: "Never created",
      escalationDestination: "Facilities director",
      actor,
    })).rejects.toThrow("Closed or cancelled work cannot receive an open workflow task");

    const sourceTask = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId === "wo-northline-115")!;
    await repository.atomicWrite([{
      sql: "UPDATE ops_workflow_tasks SET task_type = ? WHERE organization_id = ? AND id = ?",
      params: ["other", NORTHLINE_ORGANIZATION_ID, sourceTask.id],
    }]);
    const task = (await repository.getWorkflowTask(NORTHLINE_ORGANIZATION_ID, sourceTask.id))!;
    const before = repository.snapshot();
    await expect(completeWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      resolutionNote: "Provider was selected",
      actor,
    })).rejects.toThrow("create its replacement atomically");
    expect(repository.snapshot().workflowTasks).toEqual(before.workflowTasks);

    const completed = await completeWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      resolutionNote: "Provider was selected",
      replacementTask: {
        taskType: "vendor_response_required",
        title: "Obtain vendor acceptance",
        reason: "Selected provider must accept the service authorization",
        assigneeType: "vendor",
        assigneeId: "vendor-northline-summit",
        assigneeName: "Summit Refrigeration",
        priority: "high",
        blocking: true,
        requiredForProgress: true,
        dueAt: "2026-08-11T18:30:00.000Z",
        applicableSlaClock: "vendor_response",
        completionCriteria: "Vendor acceptance or an attributed response is recorded",
        escalationDestination: "Facilities director",
      },
      actor,
    });
    expect(completed.status).toBe("completed");
    expect(completed.replacementTask).toMatchObject({ status: "open", taskType: "vendor_response_required" });
    expect(repository.snapshot().workflowTasks.filter((candidate) => candidate.workOrderId === task.workOrderId && ["open", "in_progress"].includes(candidate.status))).toHaveLength(1);
  });

  it("requires source-governed reactive tasks to resolve through their evidence command even when another task remains", async () => {
    const { repository, services } = harness();
    const task = repository.snapshot().workflowTasks.find((candidate) => (
      candidate.workOrderId === "wo-northline-112" && candidate.taskType === "record_service_outcome"
    ))!;
    const before = repository.snapshot();

    await expect(completeWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workflowTaskId: task.id,
      resolutionNote: "Attempted to bypass visit checkout evidence",
      actor,
    })).rejects.toThrow("evidence-bearing workflow action");

    expect(repository.snapshot()).toEqual(before);
  });

  it("accepts an explicit no-SLA policy instead of inventing a due date", async () => {
    const { services } = harness();
    const task = await createWorkflowTask(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: "wo-northline-112",
      taskType: "review_warranty",
      title: "Review possible warranty coverage",
      reason: "Coverage review is useful but does not block active service",
      assigneeType: "role",
      assigneeRole: "facilities_admin",
      assigneeName: "Facilities coordinator",
      priority: "low",
      blocking: false,
      requiredForProgress: false,
      noSlaReason: "Advisory coverage review has no contractual response target",
      applicableSlaClock: "warranty_response",
      completionCriteria: "Coverage position and supporting evidence are recorded",
      escalationDestination: "Facilities director",
      actor,
    });
    expect(task.dueAt).toBeUndefined();
    expect(task.noSlaReason).toContain("no contractual response target");
  });
});
