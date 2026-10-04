import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InternalResultFields } from "@/components/workspace/internal-result-fields";
import { readdirSync, readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { Pool } from "pg";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { seedOpsRepository } from "@/lib/ops/seed";
import { recordInternalWorkResult, markInternalWorkReady, handoffInternalWorkToVendor } from "@/lib/ops/internal-execution";
import { checkInVisit, checkOutVisit, addHeldWorkToActiveVisit, assignWorkOrder, createFollowUp } from "@/lib/ops/commands";
import { recordWorkOrderVerification, correctWorkOrderOutcome } from "@/lib/ops/work-order-verification-commands";
import { configureMaintenanceResponsibilities } from "@/lib/ops/maintenance-policy-commands";
import { latestRecordedWorkOutcome, applicableOutcomeVerification, applicableVisitWorkOutcomes } from "@/lib/ops/work-order-outcome";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { resolveWorkOrderWorkspace } from "@/lib/ops/work-order-workspace";
import { dispatchActor, dispatchChange, dispatchJob, dispatchManager, dispatchNow, dispatchOrg, dispatchServices, dispatchTech } from "./helpers/internal-dispatch-regression";
import { insertDispatchRecord } from "@/lib/ops/internal-dispatch";
import type { OpsRepository } from "@/lib/ops/repository";

const postgresUrl=process.env.OPS_DISPATCH_TEST_DATABASE_URL;
it("offers only authorized outcomes for look-and-report job and checkout forms", () => {
  for (const visit of [false, true]) {
    const html = renderToStaticMarkup(createElement(InternalResultFields, { visit, lookAndReport: true }));
    expect(html).not.toContain('value="completed"');
    expect(html).toContain('value="return_visit_required" selected');
  }
});
for(const adapter of ["fixture","D1","PostgreSQL"] as const)describe.skipIf(adapter==="PostgreSQL"&&!postgresUrl)(`P2 internal execution on ${adapter}`,()=>{
  let r:OpsRepository, runtime:Miniflare|undefined,pool:Pool|undefined,databaseName:string|undefined;
  beforeAll(async()=>{
    const fixture=buildShowcaseFixture(dispatchNow);fixture.outboxMessages=[];
    if(adapter==="fixture")r=createOpsFixtureRepository(fixture);
    if(adapter==="D1"){
      runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:["DB"]});const db=await runtime.getD1Database("DB");
      const migrations=readdirSync("drizzle").filter(f=>/^\d.*\.sql$/.test(f)).sort();
      for(const file of migrations.filter(f=>f<"0068"))for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
      r=createOpsD1Repository(db as unknown as D1Database);await seedOpsRepository(r,fixture);
      for(const file of migrations.filter(f=>f>="0068"))for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    }
    if(adapter==="PostgreSQL"){
      const url=new URL(postgresUrl!);if(!["127.0.0.1","localhost"].includes(url.hostname)||!/^\/dispatch_.*test$/.test(url.pathname))throw Error("Use an isolated localhost dispatch_*test database.");
      databaseName=`dispatch_${crypto.randomUUID().replaceAll("-","")}_test`;const admin=new Pool({connectionString:postgresUrl});try{await admin.query(`CREATE DATABASE ${databaseName}`);}finally{await admin.end();}
      url.pathname=`/${databaseName}`;pool=new Pool({connectionString:url.toString()});
      const migrations=readdirSync("drizzle-postgres").filter(f=>/^\d.*\.sql$/.test(f)).sort();
      for(const file of migrations.filter(f=>f<"0068"))for(const sql of readFileSync(`drizzle-postgres/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await pool.query(sql);
      r=createOpsPostgresRepository(pool);await seedOpsRepository(r,fixture);
      for(const file of migrations.filter(f=>f>="0068"))for(const sql of readFileSync(`drizzle-postgres/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await pool.query(sql);
    }
    for(const decision of fixture.workOrderVerifications)expect(await r.listWorkOrderVerifications(dispatchOrg,decision.workOrderId)).toContainEqual(expect.objectContaining({id:decision.id,siteVisitWorkOrderId:decision.siteVisitWorkOrderId,decision:decision.decision}));
  },120000);
  afterAll(async()=>{await runtime?.dispose();await pool?.end();if(databaseName){const admin=new Pool({connectionString:postgresUrl});try{await admin.query(`DROP DATABASE ${databaseName}`);}finally{await admin.end();}}});
  const svc=()=>dispatchServices(r);
  const current=async(id:string)=>({organizationId:dispatchOrg,workOrderId:id,actor:dispatchActor(dispatchTech[0]),expectedVersion:(await r.getWorkOrder(dispatchOrg,id))!.version??0,expectedAssignmentId:(await r.getActiveAssignment(dispatchOrg,id))!.id,key:crypto.randomUUID()});
  const location={result:"not_requested" as const,capturedAt:dispatchNow};

  function simultaneousRepository() {
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    return new Proxy(r, { get(target, property) {
      if (property === "atomicWrite") return async (statements: Parameters<OpsRepository["atomicWrite"]>[0]) => { if (++arrivals === 2) release(); await gate; return target.atomicWrite(statements); };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
  }

  it("rejects generic inspection completion and revalidates access inside the result transaction", async () => {
    const inspection = (await r.getWorkOrder(dispatchOrg, "showcase-work-walk-101"))!;
    const assignment = await r.getActiveAssignment(dispatchOrg, inspection.id);
    await expect(recordInternalWorkResult(svc(), { organizationId: dispatchOrg, workOrderId: inspection.id, actor: dispatchActor(dispatchManager), expectedVersion: inspection.version ?? 0, expectedAssignmentId: assignment!.id, key: crypto.randomUUID(), outcome: "completed", source: "phone", performerName: "Maria Santos" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await r.listWorkResults(dispatchOrg, inspection.id)).toHaveLength(0);
    const job = await dispatchJob(r, "person"), input = { ...await current(job.id), outcome: "completed" as const };
    const revoked = new Proxy(r, { get(target, property) {
      if (property === "atomicWrite") return async (statements: Parameters<OpsRepository["atomicWrite"]>[0]) => {
        await target.atomicWrite([{ sql: "UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?", params: ["suspended", dispatchOrg, dispatchTech[0]] }]);
        return target.atomicWrite(statements);
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    try {
      await expect(recordInternalWorkResult(dispatchServices(revoked), input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0); expect((await r.getWorkOrder(dispatchOrg, job.id))?.version).toBe(0);
    } finally { await r.atomicWrite([{ sql: "UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?", params: ["active", dispatchOrg, dispatchTech[0]] }]); }
  });

  for (const contender of ["result", "reassignment", "return"] as const) it.skipIf(adapter !== "PostgreSQL")(`serializes result versus ${contender} on real PostgreSQL clients`, async () => {
    const job = await dispatchJob(r, "person"), input = { ...await current(job.id), outcome: "completed" as const }, concurrent = simultaneousRepository(), services = dispatchServices(concurrent);
    const operations = [recordInternalWorkResult(services, input), contender === "result" ? recordInternalWorkResult(services, { ...input, key: crypto.randomUUID() }) : dispatchChange(concurrent, job.id, contender === "return" ? "return" : "assign", contender === "return" ? dispatchTech[0] : undefined, contender === "return" ? {} : { target: "person", membershipId: dispatchTech[1] })];
    const settled = await Promise.allSettled(operations); expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((settled.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });
    const results = await r.listWorkResults(dispatchOrg, job.id); expect(results.length).toBeLessThanOrEqual(1);
    const assignment = await r.getActiveAssignment(dispatchOrg, job.id);
    if (results.length) { expect(assignment?.internalMembershipId).toBe(dispatchTech[0]); expect(results[0].assignmentId).toBe(input.expectedAssignmentId); }
    else expect(assignment?.internalMembershipId).toBe(contender === "return" ? undefined : dispatchTech[1]);
    expect((await r.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).filter(task => task.status === "open")).toHaveLength(1);
  }, 30000);

  it.skipIf(adapter !== "PostgreSQL")("serializes adding a job versus checkout without stranded claims or omitted results", async () => {
    const primary = await dispatchJob(r, "person"), extra = await dispatchJob(r, "pool", { holdForVisit: { posture: "complete_using_professional_judgment", deadlineAt: "2026-10-20T18:00:00.000Z" } });
    const visit = await checkInVisit(svc(), { organizationId: dispatchOrg, storeId: primary.storeId, internalMembershipId: dispatchTech[0], technicianName: "Maria Santos", workOrderIds: [primary.id], purpose: "Internal maintenance", channel: "internal_web", location, actor: dispatchActor(dispatchTech[0]) });
    const concurrent = simultaneousRepository(), services = dispatchServices(concurrent);
    const settled = await Promise.allSettled([
      addHeldWorkToActiveVisit(services, { organizationId: dispatchOrg, visitId: visit.id, heldWorkOrderIds: [extra.id], actor: dispatchActor(dispatchTech[0]) }),
      checkOutVisit(services, { organizationId: dispatchOrg, visitId: visit.id, channel: "internal_web", location, actor: dispatchActor(dispatchTech[0]), perWorkOrderOutcomes: [{ workOrderId: primary.id, outcome: "completed" }] }),
    ]);
    expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((settled.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });
    const links = await r.listSiteVisitWorkOrders(dispatchOrg, visit.id), saved = await r.getVisit(dispatchOrg, visit.id);
    if (saved?.status === "checked_out") {
      expect(links).toHaveLength(1); expect((await r.getWorkOrderVisitHold(dispatchOrg, extra.id))?.status).toBe("active"); expect((await r.getActiveAssignment(dispatchOrg, extra.id))?.internalTarget).toBe("pool");
    } else {
      expect(links).toHaveLength(2); expect(await r.listWorkResults(dispatchOrg, primary.id)).toHaveLength(0);
      await checkOutVisit(svc(), { organizationId: dispatchOrg, visitId: visit.id, channel: "internal_web", location, actor: dispatchActor(dispatchTech[0]), perWorkOrderOutcomes: links.map(link => ({ workOrderId: link.workOrderId, outcome: "completed" })) });
      expect((await r.getWorkOrderVisitHold(dispatchOrg, extra.id))?.status).toBe("completed");
    }
  }, 30000);

  it("preserves an independent safety obligation through a parts report and readiness", async () => {
    const job = await dispatchJob(r, "person");
    const safety = await createFollowUp(svc(), { organizationId: dispatchOrg, workOrderId: job.id,
      nextAction: "Confirm safe access before work continues", accountableParty: "Facilities coordination",
      dueAt: "2026-10-04T17:00:00.000Z", escalationTo: "Facilities leadership", actor: dispatchActor() });
    const safetyTask = (await r.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).find(task => task.sourceFollowUpId === safety.id)!;
    await recordInternalWorkResult(svc(), { ...await current(job.id), outcome: "parts_required", blocker: "parts", notes: "Replacement latch needed" });
    expect(await r.getFollowUp(dispatchOrg, safety.id)).toEqual(safety);
    expect((await r.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).find(task => task.id === safetyTask.id)).toEqual(safetyTask);
    await markInternalWorkReady(svc(), { ...await current(job.id), actor: dispatchActor(dispatchManager), notes: "Replacement latch arrived" });
    expect(await r.getFollowUp(dispatchOrg, safety.id)).toEqual(safety);
    expect((await r.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).find(task => task.id === safetyTask.id)).toEqual(safetyTask);
    expect(await r.getWorkOrder(dispatchOrg, job.id)).toMatchObject({ nextAction: safety.nextAction, dueAt: safety.dueAt });
    const notices = (await r.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).filter(message => message.aggregateId === job.id && message.topic === "ops.internal_dispatch.notification").map(message => JSON.parse(message.payloadJson));
    expect(notices).toContainEqual(expect.objectContaining({ headline: "Return work reviewed; required actions remain" }));
    expect(notices.some(notice => notice.headline === "Job ready for return work")).toBe(false);
    await expect(recordInternalWorkResult(svc(), { ...await current(job.id), outcome: "completed" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("resumes overdue parts work while preserving its elapsed action deadline", async () => {
    const job = await dispatchJob(r, "person");
    await recordInternalWorkResult(svc(), { ...await current(job.id), outcome: "parts_required", blocker: "parts", notes: "Replacement ordered" });
    const blocked = (await r.getWorkOrder(dispatchOrg, job.id))!;
    const late = { ...svc(), clock: { now: () => "2026-10-06T18:00:00.000Z" } };
    const input = { ...await current(job.id), actor: dispatchActor(dispatchManager), notes: "Replacement arrived after the review deadline" };
    await markInternalWorkReady(late, input);
    await markInternalWorkReady(late, input);
    expect(await r.getWorkOrder(dispatchOrg, job.id)).toMatchObject({ status: "approved", nextAction: "Begin internal work", dueAt: blocked.dueAt, version: blocked.version! + 1 });
    const ready = (await r.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).filter(task => task.status === "open");
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ title: "Begin internal work", dueAt: blocked.dueAt, createdAt: late.clock.now() });
    expect(ready[0].dueAt! < ready[0].createdAt).toBe(true);
  });

  it("retains visit and performer attribution through successive internal checkout corrections", async () => {
    const job = await dispatchJob(r, "person");
    const visit = await checkInVisit(svc(), { organizationId: dispatchOrg, storeId: job.storeId, internalMembershipId: dispatchTech[0],
      technicianName: "Maria Santos", workOrderIds: [job.id], purpose: "Repair", channel: "internal_web", location, actor: dispatchActor(dispatchTech[0]) });
    await checkOutVisit(svc(), { organizationId: dispatchOrg, visitId: visit.id, channel: "store_device", location, actor: dispatchActor(dispatchTech[0]), perWorkOrderOutcomes: [{ workOrderId: job.id, outcome: "completed" }] });
    const original = (await r.listWorkResults(dispatchOrg, job.id))[0];
    for (const outcome of ["return_visit_required", "completed"] as const) {
      const previous = latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg, job.id))!;
      await correctWorkOrderOutcome(svc(), { organizationId: dispatchOrg, workOrderId: job.id, expectedVersion: (await r.getWorkOrder(dispatchOrg, job.id))!.version!,
        expectedOutcomeId: previous.id, outcome, reason: `Corrected finding: ${outcome}`, actor: dispatchActor() });
      const results = await r.listWorkResults(dispatchOrg, job.id), corrected = results[0];
      expect(corrected).toMatchObject({ siteVisitWorkOrderId: original.siteVisitWorkOrderId, performerMembershipId: original.performerMembershipId,
        performerName: original.performerName, assignmentId: original.assignmentId, supersedesResultId: previous.workResultId });
      const currentOutcome = latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg, job.id))!;
      expect(currentOutcome).toMatchObject({ id: corrected.id, visitId: visit.id, outcome });
      expect(applicableVisitWorkOutcomes(await r.listSiteVisitWorkOrders(dispatchOrg, visit.id), results)).toEqual([expect.objectContaining({ id: corrected.id, visitId: visit.id, outcome })]);
      expect(results.find(result => result.id === original.id)).toEqual(original);
    }
  });

  it("rejects visitless completion of look-and-report work without mutating any records", async () => {
    const job = await dispatchJob(r, "person", { holdForVisit: { posture: "look_and_report", deadlineAt: "2026-10-20T18:00:00.000Z" } });
    const before = await r.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id), hold = await r.getWorkOrderVisitHold(dispatchOrg, job.id);
    const notices = (await r.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).filter(message => message.aggregateId === job.id);
    const input = { ...await current(job.id), outcome: "completed" as const };
    await expect(recordInternalWorkResult(svc(), input)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await r.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id)).toEqual(before);
    expect(await r.getWorkOrderVisitHold(dispatchOrg, job.id)).toEqual(hold);
    expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0);
    expect(await r.getIdempotencyKey(dispatchOrg, `internal-result:${dispatchTech[0]}:${input.key}`)).toBeNull();
    expect((await r.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).filter(message => message.aggregateId === job.id)).toEqual(notices);
    await recordInternalWorkResult(svc(), { ...input, outcome: "return_visit_required", notes: "Inspected only; repair still needs authorization" });
    expect(await r.getWorkOrderVisitHold(dispatchOrg, job.id)).toMatchObject({ status: "review_required" });
  });

  it("binds a corrected vendor confirmation submitted with its parent visit to the canonical result", async () => {
    const workId = "wo-recent-aug-111-plumbing";
    const previous = latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg, workId))!;
    await correctWorkOrderOutcome(svc(), { organizationId: dispatchOrg, workOrderId: workId, expectedVersion: (await r.getWorkOrder(dispatchOrg, workId))!.version ?? 0,
      expectedOutcomeId: previous.id, outcome: "no_issue_found", reason: "Repair history reviewed; no issue found at the visit", actor: dispatchActor() });
    const corrected = latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg, workId))!;
    const decision = await recordWorkOrderVerification(svc(), { organizationId: dispatchOrg, workOrderId: workId,
      expectedWorkOrderVersion: (await r.getWorkOrder(dispatchOrg, workId))!.version!, expectedSiteVisitWorkOrderId: corrected.siteVisitWorkOrderId!,
      expectedOutcomeRecordedAt: corrected.outcomeRecordedAt!, decision: "verified", actor: dispatchActor() });
    expect(decision.workResultId).toBe(corrected.workResultId);
    expect(applicableOutcomeVerification(await r.listWorkOrderVerifications(dispatchOrg, workId), corrected)?.id).toBe(decision.id);
    expect(await r.getWorkOrder(dispatchOrg, workId)).toMatchObject({ status: "resolved", nextAction: "Close verified work" });
    expect(applicableOutcomeVerification(await r.listWorkOrderVerifications(dispatchOrg, workId), previous)?.id).not.toBe(decision.id);
  });

  it("records a truthful visitless result, replays it, confirms exactly that source, and appends a correction",async()=>{
    const job=await dispatchJob(r,"person");const input={...await current(job.id),outcome:"completed" as const,notes:"Door latch adjusted"};
    await expect(recordInternalWorkResult(svc(),{...input,actor:dispatchActor(dispatchTech[1])})).rejects.toMatchObject({code:"FORBIDDEN"});
    const result=await recordInternalWorkResult(svc(),input);expect(await recordInternalWorkResult(svc(),input)).toMatchObject({id:result.id});
    await expect(recordInternalWorkResult(svc(),{...input,notes:"Different intent"})).rejects.toMatchObject({code:"CONFLICT"});
    expect((await r.getWorkOrderDetail({organizationId:dispatchOrg},job.id))!.visits).toHaveLength(0);
    expect((await r.listWorkResults(dispatchOrg,job.id))).toHaveLength(1);
    const outcome=latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg,job.id))!;expect(outcome.workResultId).toBe(result.id);
    const decision={organizationId:dispatchOrg,workOrderId:job.id,expectedWorkOrderVersion:1,expectedSiteVisitWorkOrderId:result.id,expectedOutcomeRecordedAt:dispatchNow,decision:"verified" as const,actor:dispatchActor("membership-northline-store-101")};
    await expect(recordWorkOrderVerification(svc(),{...decision,actor:dispatchActor(dispatchTech[0])})).rejects.toMatchObject({code:"FORBIDDEN"});
    const verified=await recordWorkOrderVerification(svc(),decision);expect(verified.workResultId).toBe(result.id);expect(verified.siteVisitWorkOrderId).toBeUndefined();
    expect(applicableOutcomeVerification(await r.listWorkOrderVerifications(dispatchOrg,job.id),outcome)?.id).toBe(verified.id);
    await correctWorkOrderOutcome(svc(),{organizationId:dispatchOrg,workOrderId:job.id,expectedVersion:2,expectedOutcomeId:result.id,outcome:"return_visit_required",reason:"Latch still sticks",actor:dispatchActor(dispatchManager)});
    const records=await r.listWorkResults(dispatchOrg,job.id);expect(records).toHaveLength(2);expect(records.find(item=>item.id===result.id)?.outcome).toBe("completed");expect(records[0].supersedesResultId).toBe(result.id);
    expect(applicableOutcomeVerification(await r.listWorkOrderVerifications(dispatchOrg,job.id),latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg,job.id)))).toBeUndefined();
    await markInternalWorkReady(svc(),{...await current(job.id),actor:dispatchActor(dispatchManager),notes:"Return work reviewed"});
    const visit=await checkInVisit(svc(),{organizationId:dispatchOrg,storeId:job.storeId,internalMembershipId:dispatchTech[0],technicianName:"Maria Santos",workOrderIds:[job.id],purpose:"Return repair",channel:"internal_web",location,actor:dispatchActor(dispatchTech[0])});
    // Same frozen clock: a newer pending service cycle must suppress the older confirmed result.
    expect(latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg,job.id))).toBeUndefined();
    await expect(recordWorkOrderVerification(svc(),{...decision,expectedWorkOrderVersion:(await r.getWorkOrder(dispatchOrg,job.id))!.version??0})).rejects.toMatchObject({code:"CONFLICT"});
    await checkOutVisit(svc(),{organizationId:dispatchOrg,visitId:visit.id,channel:"internal_web",location,actor:dispatchActor(dispatchTech[0]),perWorkOrderOutcomes:[{workOrderId:job.id,outcome:"completed"}]});
    const returned=latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg,job.id))!;
    expect(returned.visitId).toBe(visit.id);expect(returned.workResultId).not.toBe(result.id);
    expect(applicableOutcomeVerification(await r.listWorkOrderVerifications(dispatchOrg,job.id),returned)).toBeUndefined();
    expect((await r.getWorkOrder(dispatchOrg,job.id))!.number).toBe(job.number);

  });

  it("keeps blockers accountable, explicitly makes parts ready, returns on the same job, and rolls back failures",async()=>{
    const job=await dispatchJob(r,"person",{requireConfirmation:false});
    const input={...await current(job.id),outcome:"parts_required" as const,blocker:"parts" as const,notes:"Replacement latch needed"};
    const parts=await recordInternalWorkResult(svc(),input);await recordInternalWorkResult(svc(),input);
    expect((await r.getWorkOrderDetail({organizationId:dispatchOrg},job.id))!.followUps.filter(f=>f.status==="open")).toHaveLength(1);
    expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalAccountableId).toBe(dispatchManager);
    await expect(recordInternalWorkResult(svc(),{...await current(job.id),outcome:"completed"})).rejects.toMatchObject({code:"CONFLICT"});
    await markInternalWorkReady(svc(),{...await current(job.id),actor:dispatchActor(dispatchManager),notes:"Replacement latch arrived"});
    await recordInternalWorkResult(svc(),{...await current(job.id),outcome:"completed",notes:"Replacement fitted"});
    expect((await r.getWorkOrder(dispatchOrg,job.id))?.status).toBe("closed");expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalMembershipId).toBe(dispatchTech[0]);expect(parts.followUpId).toBeTruthy();
    const vendorJob=await dispatchJob(r,"person");await recordInternalWorkResult(svc(),{...await current(vendorJob.id),outcome:"quote_required",blocker:"vendor",notes:"Refrigeration specialist needed"});
    await assignWorkOrder(svc(),{organizationId:dispatchOrg,workOrderId:vendorJob.id,kind:"outside_vendor",vendorId:"vendor-northline-summit",actor:dispatchActor()});
    expect((await r.getWorkOrder(dispatchOrg,vendorJob.id))?.number).toBe(vendorJob.number);expect((await r.getActiveAssignment(dispatchOrg,vendorJob.id))?.kind).toBe("outside_vendor");expect(await r.listWorkResults(dispatchOrg,vendorJob.id)).toHaveLength(1);
    const rollback=await dispatchJob(r,"person"),rollbackInput={...await current(rollback.id),outcome:"completed" as const};
    const broken=new Proxy(r,{get(target,key){if(key==="atomicWrite")return (statements:Parameters<OpsRepository["atomicWrite"]>[0])=>target.atomicWrite([...statements,insertDispatchRecord("ops_work_order_assignments",{id:crypto.randomUUID(),organization_id:dispatchOrg,work_order_id:rollback.id,kind:"internal",status:"pending",assigned_at:dispatchNow})]);const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
    await expect(recordInternalWorkResult({repository:broken,clock:{now:()=>dispatchNow}},rollbackInput)).rejects.toThrow();expect(await r.listWorkResults(dispatchOrg,rollback.id)).toHaveLength(0);expect((await r.getWorkOrder(dispatchOrg,rollback.id))?.version).toBe(0);
    await recordInternalWorkResult(svc(),rollbackInput);expect(await r.listWorkResults(dispatchOrg,rollback.id)).toHaveLength(1);
  });

  it("enforces required check-in, allows an attributed manager exception, and handles additional held work with mixed checkout",async()=>{
    await configureMaintenanceResponsibilities({repository:r,organizationId:dispatchOrg,role:"facilities_admin",enabledCapabilities:["create_work_order","issue_work_order","confirm_observable_result"],internalCheckInRequired:true,autoCloseRoutineAfterVerification:false,appliesToActiveWork:true,actor:dispatchActor(),occurredAt:dispatchNow});
    const phone=await dispatchJob(r,"person");await expect(recordInternalWorkResult(svc(),{...await current(phone.id),outcome:"completed"})).rejects.toMatchObject({code:"CONFLICT"});
    const reported=await recordInternalWorkResult(svc(),{...await current(phone.id),actor:dispatchActor(dispatchManager),outcome:"completed",source:"phone",performerName:"Maria Santos",exceptionReason:"Check-in unavailable; called manager"});expect(reported.source).toBe("phone");expect(reported.outcomeRecordedByActorId).toBe(dispatchManager);
    const primary=await dispatchJob(r,"person"),held=await dispatchJob(r,"pool",{holdForVisit:{posture:"complete_using_professional_judgment",deadlineAt:"2026-10-20T18:00:00.000Z"}}),extra=await dispatchJob(r,"pool",{holdForVisit:{posture:"complete_using_professional_judgment",deadlineAt:"2026-10-20T18:00:00.000Z"}});
    const checkin={organizationId:dispatchOrg,storeId:primary.storeId,internalMembershipId:dispatchTech[0],technicianName:"Maria Santos",workOrderIds:[primary.id],heldWorkOrderIds:[held.id],purpose:"Internal maintenance",channel:"internal_web" as const,location,actor:dispatchActor(dispatchTech[0]),idempotency:{key:crypto.randomUUID(),command:"test.checkin",requestHash:"a".repeat(64),expiresAt:"9999-12-31T23:59:59.999Z"}};
    const visit=await checkInVisit(svc(),checkin);await addHeldWorkToActiveVisit(svc(),{organizationId:dispatchOrg,visitId:visit.id,heldWorkOrderIds:[extra.id],actor:dispatchActor(dispatchTech[0])});
    expect((await checkInVisit(svc(),checkin)).id).toBe(visit.id);expect(await r.listSiteVisitWorkOrders(dispatchOrg,visit.id)).toHaveLength(3);
    expect((await r.getActiveAssignment(dispatchOrg,extra.id))?.internalMembershipId).toBe(dispatchTech[0]);
    const checkout={organizationId:dispatchOrg,visitId:visit.id,channel:"store_device" as const,location,actor:dispatchActor(dispatchTech[0]),idempotency:{key:crypto.randomUUID(),command:"test.checkout",requestHash:"b".repeat(64),expiresAt:"9999-12-31T23:59:59.999Z"},perWorkOrderOutcomes:[{workOrderId:primary.id,outcome:"completed"},{workOrderId:held.id,outcome:"parts_required",outcomeNotes:"Need a latch"},{workOrderId:extra.id,outcome:"quote_required",outcomeNotes:"Specialist needed"}] as const};
    await expect(checkOutVisit(svc(),{...checkout,actor:dispatchActor(dispatchTech[1])})).rejects.toMatchObject({code:"FORBIDDEN"});
    await checkOutVisit(svc(),checkout);await checkOutVisit(svc(),checkout);
    const blocked=await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,internalMembershipId:dispatchTech[0],excludeHeld:true});expect(blocked.items.map(item=>item.id)).toContain(held.id);
    expect((await r.getVisit(dispatchOrg,visit.id))?.endedChannel).toBe("store_device");expect((await r.listWorkResults(dispatchOrg,primary.id))[0].source).toBe("visit_checkout");expect((await r.getWorkOrder(dispatchOrg,held.id))?.status).toBe("waiting_on_parts");expect((await r.getWorkOrderDetail({organizationId:dispatchOrg},extra.id))?.followUps.filter(f=>f.status==="open")).toHaveLength(1);
    expect(latestRecordedWorkOutcome(await r.listWorkOutcomesForWorkOrder(dispatchOrg,primary.id))?.workResultId).toBeTruthy();
    const handoff={...await current(extra.id),actor:dispatchActor(dispatchManager),vendorId:"vendor-northline-summit"};
    await expect(handoffInternalWorkToVendor(svc(),{...handoff,actor:dispatchActor(dispatchTech[0])})).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(handoffInternalWorkToVendor(svc(),{...handoff,expectedVersion:handoff.expectedVersion-1})).rejects.toMatchObject({code:"CONFLICT"});
    const failedHandoff=new Proxy(r,{get(target,key){if(key==="atomicWrite")return(statements:Parameters<OpsRepository["atomicWrite"]>[0])=>target.atomicWrite([...statements,insertDispatchRecord("ops_work_order_assignments",{id:crypto.randomUUID(),organization_id:dispatchOrg,work_order_id:extra.id,kind:"internal",status:"pending",assigned_at:dispatchNow})]);const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
    await expect(handoffInternalWorkToVendor({...svc(),repository:failedHandoff},handoff)).rejects.toThrow();
    expect((await r.getWorkOrderVisitHold(dispatchOrg,extra.id))?.status).toBe("review_required");
    expect((await r.getActiveAssignment(dispatchOrg,extra.id))?.id).toBe(handoff.expectedAssignmentId);
    expect(await r.getIdempotencyKey(dispatchOrg,`internal-vendor:${dispatchManager}:${handoff.key}`)).toBeNull();
    const chosen=await handoffInternalWorkToVendor(svc(),handoff);expect((await handoffInternalWorkToVendor(svc(),handoff))?.id).toBe(chosen.id);
    await expect(handoffInternalWorkToVendor(svc(),{...handoff,vendorId:"vendor-northline-pump"})).rejects.toMatchObject({code:"CONFLICT"});
    expect((await r.getWorkOrderVisitHold(dispatchOrg,extra.id))?.status).toBe("cancelled");
    expect((await r.getWorkOrder(dispatchOrg,extra.id))?.status).toBe("approved");
    expect((await r.getWorkOrder(dispatchOrg,extra.id))?.number).toBe(extra.number);
    expect((await r.getActiveAssignment(dispatchOrg,extra.id))?.kind).toBe("outside_vendor");
    expect((await r.getAssignment(dispatchOrg,(await r.listWorkResults(dispatchOrg,extra.id))[0].assignmentId!))?.internalMembershipId).toBe(dispatchTech[0]);
    expect((await r.getWorkOrderDetail({organizationId:dispatchOrg},extra.id))?.followUps.filter(f=>f.status==="open")).toHaveLength(0);
    const results=await r.listWorkResults(dispatchOrg,extra.id);
    const caseInput={now:dispatchNow,workOrder:(await r.getWorkOrder(dispatchOrg,extra.id))!,workResults:results,
      assignments:[chosen,(await r.getAssignment(dispatchOrg,results[0].assignmentId!))!],
      siteVisitWorkOrders:await r.listSiteVisitWorkOrdersForWorkOrder(dispatchOrg,extra.id),visits:[(await r.getVisit(dispatchOrg,visit.id))!]};
    const caseView=buildWorkOrderCase(caseInput);
    expect(caseView).toMatchObject({stage:"authorization_or_bidding",plainLanguageState:"Ready to send to selected provider"});
    expect(caseView.primaryNextAction.href).toContain("path=direct#issue-work");
    expect(resolveWorkOrderWorkspace({stage:caseView.stage,serviceSubStage:caseView.serviceSubStage?.id,heldStatus:(await r.getWorkOrderVisitHold(dispatchOrg,extra.id))?.status,activeBidRequestCount:0,proposalCount:0,requestedPath:"direct"})).toBe("direct_service");
    const issuedCase=buildWorkOrderCase({...caseInput,issuances:[{id:"issued-handoff",assignmentId:chosen.id,revision:1,issuedAt:dispatchNow}]});
    expect(issuedCase).toMatchObject({stage:"vendor_response_scheduling",serviceSubStage:{id:"waiting_on_vendor"},plainLanguageState:"Waiting on vendor"});
    await configureMaintenanceResponsibilities({repository:r,organizationId:dispatchOrg,role:"facilities_admin",enabledCapabilities:["create_work_order","issue_work_order","confirm_observable_result"],internalCheckInRequired:false,autoCloseRoutineAfterVerification:false,appliesToActiveWork:true,actor:dispatchActor(),occurredAt:dispatchNow});
  });
});
