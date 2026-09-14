import { expect } from "vitest";
import { addHeldWorkToActiveVisit, checkInVisit, checkOutVisit, createWorkOrder } from "@/lib/ops/commands";
import type { OpsRepository } from "@/lib/ops/repository";
import { createWorkflowTask } from "@/lib/ops/workflow-task-commands";

export async function heldWorkAccountabilityRegression(repository: OpsRepository, now: string, addDuringVisit = false, higherPriorityUnrelatedTask = false) {
  const organizationId = "org-northline-demo";
  const manager = { organizationId, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
  const workOrder = await createWorkOrder({ repository, clock: { now: () => "2026-08-27T12:00:00.000Z" } }, {
    organizationId, storeId: "store-northline-104", categoryKey: "electrical",
    problem: "Canopy light driver needs inspection", accountableParty: "Jordan Lee", nextAction: "Wait for a matching vendor visit",
    holdForVisit: { posture: "look_and_report", deadlineAt: "2026-09-12T17:00:00.000Z" }, actor: manager,
  });
  const workOrderId = workOrder.id;
  const actor = { organizationId, actorType: "technician" as const, actorName: "Accountability regression technician" };
  const services = { repository, clock: { now: () => now } };
  const priorTasks = await repository.listWorkflowTasksForWorkOrder(organizationId, workOrderId);
  const holdTask = priorTasks.find((task) => task.taskType === "choose_service_provider" && task.status === "open")!;
  expect(holdTask).toBeTruthy();
  const unrelated = await createWorkflowTask(services, {
    organizationId, workOrderId,
    taskType: "other", title: "Collect equipment documentation", reason: "Independent administrative follow-up",
    assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities documentation owner",
    priority: higherPriorityUnrelatedTask ? "critical" : "low", blocking: higherPriorityUnrelatedTask, requiredForProgress: higherPriorityUnrelatedTask,
    dueAt: new Date(Date.parse(now) + 48 * 3600_000).toISOString(),
    completionCriteria: "Attach equipment documentation", escalationDestination: "Facilities director",
    actor: manager,
  });
  const visit = await checkInVisit(services, {
    organizationId, storeId: "store-northline-104", vendorId: "vendor-northline-brightpath",
    heldWorkOrderIds: addDuringVisit ? [] : [workOrderId],
    unmatchedReason: "Technician arrived to inspect approved lighting work.",
    technicianName: actor.actorName, purpose: "Inspect lighting", channel: "qr",
    location: { result: "permission_denied", capturedAt: now }, actor,
  });
  if (addDuringVisit) await addHeldWorkToActiveVisit(services, { organizationId, visitId: visit.id, heldWorkOrderIds: [workOrderId], actor });
  let tasks = await repository.listWorkflowTasksForWorkOrder(organizationId, workOrderId);
  expect(tasks.find((task) => task.id === holdTask.id)).toMatchObject({ status: "completed", completedByActorName: actor.actorName });
  expect(tasks.find((task) => task.id === unrelated.id)).toMatchObject({ status: "open" });
  expect(await repository.getWorkOrder(organizationId, workOrderId)).toMatchObject({ status: "in_progress", nextAction: higherPriorityUnrelatedTask ? unrelated.title : "Record service outcome" });
  await checkOutVisit(services, {
    organizationId, visitId: visit.id, channel: "secure_link",
    perWorkOrderOutcomes: [{ workOrderId, outcome: "diagnosis_only", outcomeNotes: "Failed driver; manager needs to review replacement options." }],
    location: { result: "permission_denied", capturedAt: now }, actor,
  });
  expect(await repository.getWorkOrderVisitHold(organizationId, workOrderId)).toMatchObject({ status: "review_required" });
  expect(await repository.getWorkOrder(organizationId, workOrderId)).toMatchObject(higherPriorityUnrelatedTask ? {
    status: "approved", accountableParty: unrelated.assigneeName, nextAction: unrelated.title,
  } : {
    status: "approved", accountableParty: "Facilities coordination team", nextAction: "Review the onsite findings and choose the next step",
    dueAt: new Date(Date.parse(now) + 4 * 3600_000).toISOString(),
  });
  tasks = await repository.listWorkflowTasksForWorkOrder(organizationId, workOrderId);
  expect(tasks).toEqual(expect.arrayContaining([expect.objectContaining({ status: "open", title: "Review the onsite findings and choose the next step" })]));
  expect(tasks.find((task) => task.id === unrelated.id)).toMatchObject({ status: "open" });
  expect(tasks.filter((task) => task.taskType === "record_service_outcome").every((task) => task.status === "completed")).toBe(true);
}
