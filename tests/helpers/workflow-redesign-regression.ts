import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { updateJobPreparation } from "@/lib/ops/job-preparation";
import { saveInternalPlanBatch } from "@/lib/ops/internal-plan-batch";
import { recordTechnicianStatus } from "@/lib/ops/technician-status";
import { recordInternalWorkResult, markInternalWorkReady } from "@/lib/ops/internal-execution";
import { runSlaEscalationCycle } from "@/lib/ops/job-workers";
import { createServiceRequest, createWorkOrder, checkInVisit, checkOutVisit } from "@/lib/ops/commands";
import { routeReviewItem } from "@/lib/ops/review-routing";
import { insertDispatchRecord } from "@/lib/ops/internal-dispatch";
import { recordWorkOrderVerification } from "@/lib/ops/work-order-verification-commands";
import {
  dispatchActor,
  dispatchJob,
  dispatchNow,
  dispatchOrg,
  dispatchServices,
  dispatchTech,
} from "./internal-dispatch-regression";

export async function workflowRedesignRegression(r: OpsRepository) {
  await reviewRoutingRegression(r);
  await visitBlockerDeadlineRegression(r);
  const first = await dispatchJob(r, "person"),
    second = await dispatchJob(r, "person"),
    third = await dispatchJob(r, "person");
  const actor = dispatchActor(),
    svc = dispatchServices(r);
  await updateJobPreparation(svc, {
    organizationId: dispatchOrg,
    workOrderId: first.id,
    actor,
    expectedVersion: 0,
    technicianNotes: "Bring the meter. Counter has the back door code.",
    estimatedMinutes: 120,
    confirmationDelay: "four_hours",
  });
  expect(await r.getWorkOrder(dispatchOrg, first.id)).toMatchObject({
    technicianNotes: "Bring the meter. Counter has the back door code.",
    estimatedMinutes: 120,
    confirmationDelay: "four_hours",
  });
  await expect(
    updateJobPreparation(svc, {
      organizationId: dispatchOrg,
      workOrderId: first.id,
      actor,
      expectedVersion: 0,
      estimatedMinutes: 60,
    }),
  ).rejects.toThrow(/changed/);
  const make = async (id: string) => {
    const w = (await r.getWorkOrder(dispatchOrg, id))!,
      a = (await r.getActiveAssignment(dispatchOrg, id))!;
    return {
      organizationId: dispatchOrg,
      workOrderId: id,
      actor,
      expectedVersion: w.version ?? 0,
      expectedAssignmentId: a.id,
      expectedScheduleId: w.internalScheduleId ?? null,
      key: crypto.randomUUID(),
      precision: "day" as const,
      date: "2026-10-06",
      stopOrder: 0,
    };
  };
  const inputs = await Promise.all(
    [first, second, third].map((j) => make(j.id)),
  );
  await expect(
    saveInternalPlanBatch(svc, [
      inputs[0],
      { ...inputs[1], expectedVersion: 999 },
      inputs[2],
    ]),
  ).rejects.toThrow(/changed/);
  expect(
    (await r.getWorkOrder(dispatchOrg, first.id))?.internalScheduleId,
  ).toBeUndefined();
  const before = await Promise.all(
    [first, second, third].map((j) => r.getWorkOrder(dispatchOrg, j.id)),
  );
  const broken = new Proxy(r, {
    get(target, key) {
      if (key === "atomicWrite")
        return (statements: Parameters<OpsRepository["atomicWrite"]>[0]) =>
          target.atomicWrite([
            ...statements,
            insertDispatchRecord("ops_internal_schedules", {
              id: crypto.randomUUID(),
              organization_id: dispatchOrg,
              work_order_id: first.id,
              assignment_id: "missing",
              revision: 99,
              precision: "bad",
              planning_zone: "UTC",
              week: "2026-10-05",
              tentative: 0,
              recorded_by: actor.actorId,
              recorded_by_name: "Test",
              recorded_at: dispatchNow,
            }),
          ]);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await expect(
    saveInternalPlanBatch({ ...svc, repository: broken }, inputs),
  ).rejects.toThrow();
  expect(
    await Promise.all(
      [first, second, third].map((j) => r.getWorkOrder(dispatchOrg, j.id)),
    ),
  ).toEqual(before);
  await saveInternalPlanBatch(
    svc,
    inputs.map((i, n) => ({ ...i, stopOrder: n })),
  );
  const page = await r.listWorkOrders(
    { organizationId: dispatchOrg },
    {
      internalOnly: true,
      scheduleView: "today",
      scheduleFrom: "2026-10-06",
      limit: 100,
    },
  );
  expect(page.items.find((j) => j.id === first.id)).toMatchObject({
    estimatedMinutes: 120,
    technicianNotes: "Bring the meter. Counter has the back door code.",
    schedule: { stopOrder: 0, durationMinutes: 120 },
  });
  expect(
    page.items.find((j) => j.id === second.id)?.schedule?.durationMinutes,
  ).toBeUndefined();
  expect((await r.getWorkOrder(dispatchOrg, first.id))?.dueAt).toBe(
    first.dueAt,
  );
  const moveInputs = await Promise.all(
    [first, second, third].map((j) => make(j.id)),
  );
  await saveInternalPlanBatch(
    svc,
    moveInputs.map((i, n) => ({ ...i, date: "2026-10-07", stopOrder: n })),
  );
  const undoInputs = await Promise.all(
    [first, second, third].map((j) => make(j.id)),
  );
  await saveInternalPlanBatch(
    svc,
    undoInputs.map((i, n) => ({ ...i, date: "2026-10-06", stopOrder: n })),
  );
  for (const j of [first, second, third]) {
    const w = (await r.getWorkOrder(dispatchOrg, j.id))!;
    expect(
      (await r.getInternalSchedule(dispatchOrg, w.internalScheduleId!))?.day,
    ).toBe("2026-10-06");
    expect(w.dueAt).toBe(j.dueAt);
  }
  const current = await r.getTechnicianStatus(dispatchOrg, dispatchTech[0]);
  await recordTechnicianStatus(svc, {
    organizationId: dispatchOrg,
    actor: dispatchActor(dispatchTech[0]),
    storeId: first.storeId,
    status: "heading",
    workOrderId: first.id,
    expectedRevision: current?.revision ?? 0,
  });
  expect(
    await r.getTechnicianStatus(dispatchOrg, dispatchTech[0]),
  ).toMatchObject({ status: "heading", workOrderId: first.id });
  expect(await r.getTechnicianStatus("other-org", dispatchTech[0])).toBeNull();
  await expect(
    recordTechnicianStatus(svc, {
      organizationId: dispatchOrg,
      actor: dispatchActor(dispatchTech[0]),
      storeId: first.storeId,
      status: "break",
      expectedRevision: current?.revision ?? 0,
    }),
  ).rejects.toThrow(/changed/);
  const work = (await r.getWorkOrder(dispatchOrg, first.id))!,
    assignment = (await r.getActiveAssignment(dispatchOrg, first.id))!;
  const recorded = await recordInternalWorkResult(svc, {
    organizationId: dispatchOrg,
    workOrderId: work.id,
    actor: dispatchActor(dispatchTech[0]),
    expectedVersion: work.version ?? 0,
    expectedAssignmentId: assignment.id,
    key: crypto.randomUUID(),
    outcome: "completed",
    notes: "Quick check — working when I left: Yes.",
  });
  const task = (
    await r.listWorkflowTasksForWorkOrder(dispatchOrg, work.id)
  ).find((t) => t.taskType === "verify_repair" && t.status === "open")!;
  expect(task.availableAt).toBe(
    new Date(Date.parse(dispatchNow) + 4 * 3600000).toISOString(),
  );
  const verification = {
    organizationId: dispatchOrg,
    workOrderId: work.id,
    actor: dispatchActor(),
    expectedWorkOrderVersion:
      (await r.getWorkOrder(dispatchOrg, work.id))!.version ?? 0,
    expectedSiteVisitWorkOrderId: recorded.id,
    expectedOutcomeRecordedAt: dispatchNow,
    decision: "rejected" as const,
    reason: "Still warm",
  };
  await expect(recordWorkOrderVerification(svc, verification)).rejects.toThrow(
    /opens at/,
  );
  const overdue = new Date(Date.parse(task.dueAt!) + 1000).toISOString();
  const workerRepository = new Proxy(r, {
    get(target, key) {
      if (key === "listOverdueEscalationCandidates")
        return async () => [
          (await target.getWorkflowTask(dispatchOrg, task.id))!,
        ];
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const run = (at: string) =>
    runSlaEscalationCycle(
      { ...svc, repository: workerRepository, clock: { now: () => at } },
      { slotKey: crypto.randomUUID() },
    );
  expect(await run(overdue)).toMatchObject({
    escalatedCount: 0,
    failedCount: 0,
  });
  const reminded = (await r.getWorkflowTask(dispatchOrg, task.id))!;
  expect(reminded.remindedAt).toBe(overdue);
  expect(
    await run(new Date(Date.parse(overdue) + 3600000).toISOString()),
  ).toMatchObject({ escalatedCount: 0, failedCount: 0 });
  expect(
    await run(new Date(Date.parse(overdue) + 25 * 3600000).toISOString()),
  ).toMatchObject({ escalatedCount: 1, failedCount: 0 });
  expect((await r.getWorkflowTask(dispatchOrg, task.id))?.escalationLevel).toBe(
    1,
  );
  await recordWorkOrderVerification(
    { ...svc, clock: { now: () => overdue } },
    {
      ...verification,
      expectedWorkOrderVersion:
        (await r.getWorkOrder(dispatchOrg, work.id))!.version ?? 0,
    },
  );
  expect((await r.getWorkOrder(dispatchOrg, work.id))?.status).toBe(
    "in_progress",
  );
}

async function reviewRoutingRegression(r: OpsRepository) {
  const svc = dispatchServices(r),
    actor = dispatchActor(),
    manager = dispatchActor("membership-northline-store-101");
  const request = await createServiceRequest(svc, {
    organizationId: dispatchOrg,
    storeId: "store-northline-101",
    reporterName: "Store manager",
    problem: "Manager reports a real issue",
    actor: manager,
  });
  expect(request.status).toBe("under_review");
  expect(
    (await r.listRequestImpactAssessments(dispatchOrg, request.id)).at(-1)
      ?.assessmentKind,
  ).toBe("review");
  expect(request.workflowTask.assigneeType).toBe("role");
  const routed = await routeReviewItem(svc, {
    organizationId: dispatchOrg,
    actor,
    id: request.id,
    kind: "request",
    expectedVersion: 0,
    decision: "internal",
    priority: "routine",
    estimatedMinutes: 120,
    technicianNotes: "Bring meter",
    key: crypto.randomUUID(),
  });
  expect(await r.getWorkOrder(dispatchOrg, routed.id)).toMatchObject({
    requestId: request.id,
    estimatedMinutes: 120,
    technicianNotes: "Bring meter",
  });
  await expect(
    routeReviewItem(svc, {
      organizationId: dispatchOrg,
      actor,
      id: request.id,
      kind: "request",
      expectedVersion: 0,
      decision: "internal",
      priority: "routine",
      key: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  const deferred = await createWorkOrder(svc, {
    organizationId: dispatchOrg,
    storeId: "store-northline-101",
    problem: "Shelf can wait for next visit",
    accountableParty: "Facilities",
    nextAction: "Review",
    actor,
    initialAssignment: { kind: "choose_later" },
  });
  await routeReviewItem(svc, {
    organizationId: dispatchOrg,
    actor,
    id: deferred.id,
    kind: "work",
    expectedVersion: 0,
    decision: "next_visit",
    priority: "routine",
    holdDeadlineAt: "2026-10-20T21:00:00.000Z",
    key: crypto.randomUUID(),
  });
  expect(
    (await r.getWorkOrderVisitHold(dispatchOrg, deferred.id))?.status,
  ).toBe("active");
  expect((await r.getActiveAssignment(dispatchOrg, deferred.id))?.kind).toBe(
    "internal",
  );
  const cancelled = await dispatchJob(r, "pool", {
    technicianNotes: "Preserve the report",
    estimatedMinutes: 30,
  });
  await routeReviewItem(svc, {
    organizationId: dispatchOrg,
    actor,
    id: cancelled.id,
    kind: "work",
    expectedVersion: 0,
    decision: "not_needed",
    priority: "routine",
    reason: "Duplicate; original work is complete",
    key: crypto.randomUUID(),
  });
  expect(await r.getWorkOrder(dispatchOrg, cancelled.id)).toMatchObject({
    status: "cancelled",
    technicianNotes: "Preserve the report",
    estimatedMinutes: 30,
  });
}

async function visitBlockerDeadlineRegression(r:OpsRepository){
 const svc=dispatchServices(r),actor=dispatchActor(dispatchTech[0]);
 const job=await dispatchJob(r,"person",{dueAt:"2026-10-07T16:00:00.000Z"});
 await saveInternalPlanBatch(svc,[{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:null,key:crypto.randomUUID(),precision:"day",date:"2026-10-06",durationMinutes:90}]);
 const location={result:"not_requested" as const,capturedAt:dispatchNow};
 const visit=await checkInVisit(svc,{organizationId:dispatchOrg,storeId:job.storeId,internalMembershipId:dispatchTech[0],technicianName:"Maria Santos",workOrderIds:[job.id],purpose:"Repair",channel:"internal_web",location,actor});
 expect((await r.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(job.dueAt);
 await checkOutVisit(svc,{organizationId:dispatchOrg,visitId:visit.id,channel:"store_device",location,actor,perWorkOrderOutcomes:[{workOrderId:job.id,outcome:"parts_required",outcomeNotes:"Replacement hinge needed"}]});
 const blocked=(await r.getWorkOrder(dispatchOrg,job.id))!,assignment=(await r.getActiveAssignment(dispatchOrg,job.id))!;
 await markInternalWorkReady(svc,{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:blocked.version??0,expectedAssignmentId:assignment.id,key:crypto.randomUUID(),notes:"Replacement arrived"});
 expect(await r.getWorkOrder(dispatchOrg,job.id)).toMatchObject({dueAt:job.dueAt,estimatedMinutes:90,status:"approved"});
 expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalTarget).toBe("pool");
}
