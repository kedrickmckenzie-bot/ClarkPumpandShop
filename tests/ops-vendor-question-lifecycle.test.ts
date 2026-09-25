import { describe, expect, it } from "vitest";
import { recordVendorResponse } from "@/lib/ops/commands";
import { resolveVendorResponse } from "@/lib/ops/vendor-response-continuation";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import type { WorkOrderStatus } from "@/lib/ops/types";

describe("vendor questions remain correspondence", () => {
  it.each<WorkOrderStatus>(["accepted", "in_progress", "waiting_on_parts", "completed_pending_review", "resolved", "closed"])("keeps %s service and existing tasks unchanged through question and reply", async status => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find(row => row.id === "wo-northline-104-issued")!;
    const assignment = fixture.assignments.find(row => row.workOrderId === work.id)!;
    const issuance = fixture.issuances.find(row => row.assignmentId === assignment.id)!;
    work.status = status;
    assignment.status = status === "closed" ? "completed" : "accepted";
    const repository = createOpsFixtureRepository(fixture);
    let sequence = 0;
    const svc = { repository, clock: { now: () => "2026-08-25T18:00:00.000Z" }, ids: { next: (prefix: string) => `${prefix}-question-${++sequence}` } };
    const before = await repository.getWorkOrder(work.organizationId, work.id);
    const tasksBefore = await repository.listWorkflowTasksForWorkOrder(work.organizationId, work.id);
    const response = await recordVendorResponse(svc, { organizationId: work.organizationId, workOrderId: work.id, assignmentId: assignment.id, issuanceId: issuance.id, response: "question", responderName: "Vendor technician", message: "Which document do you need?", actor: { organizationId: work.organizationId, actorType: "vendor_link", actorName: "Vendor technician" } });
    expect(await repository.getWorkOrder(work.organizationId, work.id)).toMatchObject({ status, nextAction: before!.nextAction, accountableParty: before!.accountableParty });
    const questionTasks = (await repository.listWorkflowTasksForWorkOrder(work.organizationId, work.id)).filter(task => !tasksBefore.some(old => old.id === task.id));
    expect(questionTasks).toHaveLength(1);
    expect(questionTasks[0]).toMatchObject({ blocking: false, requiredForProgress: false, title: "Answer vendor question" });
    await resolveVendorResponse(svc, { organizationId: work.organizationId, vendorResponseId: response.id, decision: "reply_to_question", message: "Please attach the service report.", actor: { organizationId: work.organizationId, actorType: "user", actorId: "membership-northline-facilities", actorName: "Facilities" } });
    expect(await repository.getWorkOrder(work.organizationId, work.id)).toMatchObject({ status, nextAction: before!.nextAction, accountableParty: before!.accountableParty });
    expect((await repository.listWorkflowTasksForWorkOrder(work.organizationId, work.id)).filter(task => tasksBefore.some(old => old.id === task.id))).toEqual(tasksBefore);
    expect((await repository.listWorkflowTasksForWorkOrder(work.organizationId, work.id)).find(task => task.id === questionTasks[0].id)?.status).toBe("completed");
    expect(repository.snapshot().workOrders).toHaveLength(fixture.workOrders.length);
    await expect(recordVendorResponse(svc, { organizationId: work.organizationId, workOrderId: work.id, assignmentId: assignment.id, issuanceId: issuance.id, response: "declined", responderName: "Vendor", actor: { organizationId: work.organizationId, actorType: "vendor_link", actorName: "Vendor" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
