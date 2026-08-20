import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createTask } from "@/app/api/ops/work-orders/[id]/tasks/route";
import { POST as actOnTask } from "@/app/api/ops/work-orders/[id]/tasks/[taskId]/route";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

const contextMocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, ...contextMocks };
});

const facilitiesSession: OperatorSession = {
  userId: "user-route-task",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide · 15 stores",
};

function configure() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  contextMocks.getOpsRequestContext.mockResolvedValue({
    session: facilitiesSession,
    repository,
    actor: {
      actorType: "user",
      actorId: facilitiesSession.membershipId,
      actorName: facilitiesSession.displayName,
      organizationId: NORTHLINE_ORGANIZATION_ID,
    },
  });
  contextMocks.assertStoreInSessionScope.mockResolvedValue(undefined);
  return repository;
}

function request(path: string, values: Record<string, string | string[]>) {
  const formData = new FormData();
  Object.entries(values).forEach(([name, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((entry) => formData.append(name, entry));
  });
  return new Request(`https://operations.test${path}`, { method: "POST", body: formData });
}

describe("Workflow Task operator routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a tenant- and store-scoped simultaneous obligation through the domain command", async () => {
    const repository = configure();
    const workOrderId = "wo-northline-112";
    const before = repository.snapshot();
    const response = await createTask(request(`/api/ops/work-orders/${workOrderId}/tasks`, {
      taskType: "confirm_store_access",
      priority: "high",
      title: "Confirm after-hours store access",
      reason: "The technician cannot begin without a named store contact",
      completionCriteria: "The store contact and access window are recorded",
      assigneeType: "role",
      assigneeRole: "store_manager",
      dueAt: "2099-08-22T17:00",
      applicableSlaClock: "scheduling",
      escalationDestination: "Regional manager",
      requiredForProgress: "true",
      blocking: "true",
    }), { params: Promise.resolve({ id: workOrderId }) });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("updated=workflow-task-created#workflow-tasks");
    const after = repository.snapshot();
    expect(after.workflowTasks).toHaveLength(before.workflowTasks.length + 1);
    expect(after.workflowTasks.at(-1)).toMatchObject({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      title: "Confirm after-hours store access",
      assigneeType: "role",
      assigneeRole: "store_manager",
      blocking: true,
    });
    expect(contextMocks.getOpsRequestContext).toHaveBeenCalledWith(["facilities", "regional"]);
    expect(contextMocks.assertStoreInSessionScope).toHaveBeenCalledOnce();
  });

  it("records an append-only SLA pause and resume against the exact current task", async () => {
    const repository = configure();
    const workOrderId = "wo-northline-112";
    const task = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId === workOrderId)!;
    const taskPath = `/api/ops/work-orders/${workOrderId}/tasks/${task.id}`;

    const paused = await actOnTask(request(taskPath, {
      operation: "pause",
      expectedStatus: task.status,
      reasonCode: "awaiting_store_access",
      reasonDetail: "Store leadership is confirming the after-hours keyholder",
      ownerType: "external_party",
      ownerName: "Store leadership",
      affectedClocks: ["scheduling", "arrival"],
      expectedResumeAt: "2099-08-22T18:00",
    }), { params: Promise.resolve({ id: workOrderId, taskId: task.id }) });
    expect(paused.status).toBe(303);

    const pause = repository.snapshot().workflowTaskSlaPauses.at(-1)!;
    expect(pause).toMatchObject({ workflowTaskId: task.id, affectedClocks: ["scheduling", "arrival"] });

    const resumed = await actOnTask(request(taskPath, {
      operation: "resume",
      expectedStatus: task.status,
      expectedPauseId: pause.id,
      note: "Keyholder and access window confirmed",
    }), { params: Promise.resolve({ id: workOrderId, taskId: task.id }) });
    expect(resumed.status).toBe(303);
    expect(repository.snapshot().workflowTaskSlaResumes.at(-1)).toMatchObject({
      workflowTaskId: task.id,
      pauseId: pause.id,
      note: "Keyholder and access window confirmed",
    });
    expect(repository.snapshot().workflowTaskSlaPauses).toContainEqual(pause);
  });

  it("rejects a task from another work order without mutating either record", async () => {
    const repository = configure();
    const workOrderId = "wo-northline-112";
    const foreignTask = repository.snapshot().workflowTasks.find((candidate) => candidate.workOrderId !== workOrderId)!;
    const before = repository.snapshot();
    const response = await actOnTask(request(`/api/ops/work-orders/${workOrderId}/tasks/${foreignTask.id}`, {
      operation: "start",
      expectedStatus: foreignTask.status,
    }), { params: Promise.resolve({ id: workOrderId, taskId: foreignTask.id }) });

    expect(response.status).toBe(404);
    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects generic completion or cancellation of the guarded close obligation", async () => {
    const repository = configure();
    const workOrderId = "wo-recent-aug-111-plumbing";
    const task = repository.snapshot().workflowTasks.find((candidate) => (
      candidate.workOrderId === workOrderId && candidate.taskType === "close_verified_work"
    ))!;
    const before = repository.snapshot();

    for (const operation of ["complete", "cancel"] as const) {
      const response = await actOnTask(request(`/api/ops/work-orders/${workOrderId}/tasks/${task.id}`, {
        operation,
        expectedStatus: task.status,
        resolutionNote: "Attempted generic close-task resolution",
      }), { params: Promise.resolve({ id: workOrderId, taskId: task.id }) });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "Close verified work through the guarded work-order closure action",
      });
      expect(repository.snapshot()).toEqual(before);
    }
  });
});
