import { workflowRedesignRegression } from "./helpers/workflow-redesign-regression";
import {boardReadRegression,storeNotesRegression} from "./helpers/dispatch-redesign-regression";
import { afterAll,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { readdirSync,readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { Pool } from "pg";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { seedOpsRepository } from "@/lib/ops/seed";
import { buildSyntheticScaleFixture } from "@/lib/ops/fixtures";
import { buildWorkflowTaskRecord,buildCreateTaskStatements,buildWorkflowTaskProjectionStatement } from "@/lib/ops/workflow-task-commands";
import { saveInternalSchedule,setInternalCompletionTarget,type ScheduleInput } from "@/lib/ops/internal-scheduling";
import { calendarDate,exactStoreInstant,mondayOf } from "@/lib/ops/dispatch-calendar";
import { insertDispatchRecord } from "@/lib/ops/internal-dispatch";
import { createNotificationEmailTransport,type TransactionalEmail } from "@/lib/ops/email-delivery";
import { recordInternalWorkResult,markInternalWorkReady } from "@/lib/ops/internal-execution";
import { createFollowUp } from "@/lib/ops/commands";
import { dispatchActor,dispatchChange,dispatchJob,dispatchNow,dispatchOrg,dispatchServices,dispatchTech,dispatchManager } from "./helpers/internal-dispatch-regression";
import type { OpsRepository } from "@/lib/ops/repository";
import { bulkSeedD1 } from "./helpers/d1-bulk-seed";

it("validates civil dates, cross-year Monday weeks and DST gap/fold input",()=>{
  expect(mondayOf("2027-01-03")).toBe("2026-12-28");
  expect(mondayOf("2026-10-04")).toBe("2026-09-28");
  expect(()=>calendarDate("2026-02-30")).toThrow();
  expect(()=>exactStoreInstant("2026-03-08T02:30","America/New_York")).toThrow(/does not exist/);
  expect(()=>exactStoreInstant("2026-11-01T01:30","America/New_York")).toThrow(/occurs twice/);
  expect(exactStoreInstant("2026-11-01T01:30","America/New_York","earlier")).toBe("2026-11-01T05:30:00.000Z");
  expect(exactStoreInstant("2026-11-01T01:30","America/New_York","later")).toBe("2026-11-01T06:30:00.000Z");
});
const postgresUrl=process.env.OPS_DISPATCH_TEST_DATABASE_URL;
for(const adapter of ["fixture","D1","PostgreSQL"] as const)describe.skipIf(adapter==="PostgreSQL"&&!postgresUrl)("P3 live planning on "+adapter,()=>{
 let r:OpsRepository,runtime:Miniflare|undefined,pool:Pool|undefined,databaseName:string|undefined;
 beforeAll(async()=>{
  const fixture=buildShowcaseFixture(dispatchNow);fixture.outboxMessages=[];
  if(adapter==="fixture")r=createOpsFixtureRepository(fixture);
  else {
   const folder=adapter==="D1"?"drizzle":"drizzle-postgres",boundary=adapter==="D1"?"0069":"0070",files=readdirSync(folder).filter(f=>/^\d.*\.sql$/.test(f)).sort();
   let execute:(sql:string)=>Promise<unknown>,d1:D1Database|undefined;
   if(adapter==="D1"){runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:["DB"]});const db=await runtime.getD1Database("DB");d1=db as unknown as D1Database;r=createOpsD1Repository(d1);execute=sql=>db.prepare(sql).run();}
   else{const url=new URL(postgresUrl!);if(!["localhost","127.0.0.1"].includes(url.hostname)||!/^\/dispatch_.*test$/.test(url.pathname))throw Error("Disposable localhost database required.");databaseName="dispatch_"+crypto.randomUUID().replaceAll("-","")+"_test";const admin=new Pool({connectionString:postgresUrl});try{await admin.query("CREATE DATABASE "+databaseName);}finally{await admin.end();}url.pathname="/"+databaseName;pool=new Pool({connectionString:url.toString(),max:8});r=createOpsPostgresRepository(pool);execute=sql=>pool!.query(sql);}
   for(const file of files.filter(f=>f<boundary))for(const sql of readFileSync(folder+"/"+file,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await execute(sql);
   const oldFixture=structuredClone(fixture); oldFixture.technicianProfiles=[];oldFixture.internalSchedules=[];for(const job of oldFixture.workOrders){delete job.internalScheduleId;delete job.shortName;}
   if(d1)await bulkSeedD1(d1,oldFixture,{omitStoreContacts:true});else await seedOpsRepository(r,oldFixture,[],{omitStoreContacts:true});
   for(const file of files.filter(f=>f>=boundary))for(const sql of readFileSync(folder+"/"+file,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await execute(sql);
   await seedOpsRepository(r,fixture);
  }
 },120000);
 afterAll(async()=>{await runtime?.dispose();await pool?.end();if(databaseName){const admin=new Pool({connectionString:postgresUrl});try{await admin.query("DROP DATABASE "+databaseName);}finally{await admin.end();}}});
 beforeEach(async()=>{await r.atomicWrite([{sql:"UPDATE ops_outbox_messages SET status = ? WHERE organization_id = ?",params:["delivered",dispatchOrg]}]);});
 async function input(workId:string,extra:Partial<ScheduleInput>={}):Promise<ScheduleInput> {const w=(await r.getWorkOrder(dispatchOrg,workId))!,a=(await r.getActiveAssignment(dispatchOrg,workId))!;return {organizationId:dispatchOrg,workOrderId:workId,actor:dispatchActor(),expectedVersion:w.version??0,expectedAssignmentId:a.id,expectedScheduleId:w.internalScheduleId??null,key:crypto.randomUUID(),precision:"day",date:"2026-10-08",...extra};}
 const save=async(id:string,extra:Partial<ScheduleInput>={})=>saveInternalSchedule(dispatchServices(r),await input(id,extra));
 it("preserves shared preparation, atomic bulk planning, status revisions and delayed confirmation",async()=>{await workflowRedesignRegression(r);});
 it("upgrades existing populated data without inferred plans or repair targets",async()=>{
  const w=await r.getWorkOrder(dispatchOrg,"showcase-work-walk-101");
  expect(w?.internalScheduleId).toBeUndefined();expect(w?.targetCompletionAt).toBeUndefined();
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,scheduleView:"backlog"})).totalCount).toBeGreaterThan(0);
 });
 it("keeps week, weekend day and exact commitments distinct, with bounded matching lists",async()=>{
  const job=await dispatchJob(r,"person"),due=job.dueAt;
  const week=await save(job.id,{precision:"week",date:"2027-01-03"});
  expect(week.schedule).toMatchObject({week:"2026-12-28",precision:"week",planningZone:"America/New_York"});
  expect(week.schedule.day).toBeUndefined();expect(week.schedule.startsAt).toBeUndefined();
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,scheduleView:"today",scheduleFrom:"2026-12-28",search:job.problem})).items).toHaveLength(0);
  await save(job.id,{precision:"day",date:"2027-01-03"});
  const exact=await save(job.id,{precision:"appointment",localStart:"2027-01-03T10:00",durationMinutes:60});
  expect(exact.schedule.startsAt).toBe("2027-01-03T15:00:00.000Z");expect(exact.schedule.endsAt).toBe("2027-01-03T16:00:00.000Z");
  const page=await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,scheduleView:"week",scheduleFrom:"2026-12-28",scheduleTo:"2027-01-03",search:job.problem});
  expect(page.items).toHaveLength(1);expect(page.totalCount).toBe(1);expect(page.items[0].schedule?.id).toBe(exact.schedule.id);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(due);
  expect(await r.listServiceAppointmentsForWorkOrder(dispatchOrg,job.id)).toHaveLength(0);
  expect(await r.listInternalSchedules("other-org",job.id)).toEqual([]);
 });
 it("allows week planning before allocation and preserves manager-owned isolation",async()=>{
  for(const target of ["pool","awaiting_allocation"] as const){const job=await dispatchJob(r,target);await save(job.id,{precision:"week",date:"2026-10-05"});expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalTarget).toBe(target);expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,scheduleView:"week",scheduleFrom:"2026-10-05",scheduleTo:"2026-10-11",search:job.problem})).totalCount).toBe(1);}
 });
 it("carries a team's calendar commitment through pickup without moving its date",async()=>{
  const job=await dispatchJob(r,"pool"),first=await save(job.id,{precision:"week",date:"2026-10-05"});
  await dispatchChange(r,job.id,"claim",dispatchTech[0]);
  const work=(await r.getWorkOrder(dispatchOrg,job.id))!,plan=await r.getInternalSchedule(dispatchOrg,work.internalScheduleId!);
  expect(plan).toMatchObject({week:first.schedule.week,attempt:1,revision:2,assignmentId:(await r.getActiveAssignment(dispatchOrg,job.id))!.id});
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,search:job.problem,internalMembershipId:dispatchTech[0],scheduleView:"week",scheduleFrom:"2026-10-05",scheduleTo:"2026-10-11"})).totalCount).toBe(1);
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,search:job.problem,internalTarget:"pool"})).items).toHaveLength(0);
 });
 it("fulfills only a real scheduling task and preserves the existing deadline while preserving other obligations",async()=>{
  const job=await dispatchJob(r,"person");
  const ids={next:(p:string)=>p+"-"+crypto.randomUUID()};
  const original=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  const scheduling=buildWorkflowTaskRecord({id:ids.next("task"),organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),createdAt:dispatchNow,draft:{taskType:"schedule_service",priority:"normal",title:"Schedule service",reason:"Arrange service date",assigneeType:"user",assigneeId:dispatchManager,assigneeName:"Chris Delgado",dueAt:"2026-10-04T18:00:00.000Z",completionCriteria:"Save a real schedule",escalationDestination:"Facilities"}});
  await r.atomicWrite([...buildCreateTaskStatements({task:scheduling,actor:dispatchActor(),ids}),buildWorkflowTaskProjectionStatement(dispatchOrg,job.id,[...original,scheduling])]);
  await save(job.id);
  const after=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  expect(after.find(t=>t.id===scheduling.id)?.status).toBe("completed");
  expect(after.filter(t=>original.some(o=>o.id===t.id))).toEqual(original);
  expect(after.find(t=>t.title==="Complete planned internal work")?.dueAt).toBe("2026-10-04T18:00:00.000Z");
 });
 it("preserves optional target and next-action deadline through moves and explicit conflict acknowledgement",async()=>{
  const job=await dispatchJob(r,"person");
  await setInternalCompletionTarget(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,key:crypto.randomUUID(),localTarget:"2026-10-07T17:00",reason:"Store reopening"});
  await expect(save(job.id,{precision:"week",date:"2026-10-05"})).rejects.toThrow(/finish-by date/);
  await expect(save(job.id,{date:"2026-10-08"})).rejects.toThrow(/After the finish-by date/);
  await save(job.id,{date:"2026-10-08",keepConflicts:true});
  expect((await r.getWorkOrder(dispatchOrg,job.id))).toMatchObject({dueAt:job.dueAt,targetCompletionAt:"2026-10-07T21:00:00.000Z",targetCompletionSource:"manager:membership-northline-facilities"});
  await expect(setInternalCompletionTarget(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(dispatchTech[0]),expectedVersion:2,key:crypto.randomUUID(),reason:"Forged"})).rejects.toMatchObject({code:"FORBIDDEN"});
 });
 it("supports own flexible moves but rejects other work, appointment changes and stale access",async()=>{
  const job=await dispatchJob(r,"person");
  await save(job.id,{actor:dispatchActor(dispatchTech[0])});
  await expect(save(job.id,{actor:dispatchActor(dispatchTech[1])})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(save(job.id,{actor:dispatchActor(dispatchTech[0]),precision:"appointment",localStart:"2026-10-08T10:00"})).rejects.toMatchObject({code:"FORBIDDEN"});
  await save(job.id,{precision:"appointment",localStart:"2026-10-08T10:00"});
  await expect(save(job.id,{actor:dispatchActor(dispatchTech[0]),precision:"removed"})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(save(job.id,{actor:dispatchActor("membership-northline-store-101")})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(saveInternalSchedule(dispatchServices(r),{...await input(job.id),organizationId:"another-org"})).rejects.toMatchObject({code:"FORBIDDEN"});
 });
 it("removal leaves assignment, obligations and append-only history intact",async()=>{
  const job=await dispatchJob(r,"person"),before=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  const plan=await save(job.id),removed=await save(job.id,{precision:"removed"});
  expect(removed.schedule.supersedesId).toBe(plan.schedule.id);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalScheduleId).toBeUndefined();
  expect((await r.getActiveAssignment(dispatchOrg,job.id))?.id).toBe(job.initialAssignment?.id);
  expect(await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id)).toEqual(before);
  expect((await r.listInternalSchedules(dispatchOrg,job.id)).map(p=>p.precision)).toEqual(["removed","day"]);
 });
 it("schedules a new performer while completing the real scheduling obligation exactly once",async()=>{
  const job=await dispatchJob(r,"person"),ids={next:(p:string)=>p+"-"+crypto.randomUUID()};
  const tasks=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  const task=buildWorkflowTaskRecord({id:ids.next("schedule"),organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),createdAt:dispatchNow,draft:{taskType:"schedule_service",priority:"normal",title:"Schedule service",reason:"Arrange actual service",assigneeType:"user",assigneeId:dispatchManager,assigneeName:"Chris Delgado",dueAt:"2026-10-04T18:00:00.000Z",completionCriteria:"Save plan",escalationDestination:"Facilities"}});
  await r.atomicWrite([...buildCreateTaskStatements({task,actor:dispatchActor(),ids}),buildWorkflowTaskProjectionStatement(dispatchOrg,job.id,[...tasks,task])]);
  const saved=await save(job.id,{target:"person",membershipId:dispatchTech[1]});
  const current=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id),open=current.filter(t=>["open","in_progress"].includes(t.status));
  expect(current.find(t=>t.id===task.id)?.status).toBe("completed");
  expect(open).toEqual([expect.objectContaining({taskType:"record_service_outcome",assigneeId:dispatchTech[1],dueAt:"2026-10-04T18:00:00.000Z"})]);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalScheduleId).toBe(saved.schedule.id);
 });
 it.each(["schedule_service","schedule_return_visit"] as const)("preserves %s through tentative reassignment until a ready plan satisfies it",async(taskType)=>{
  await r.atomicWrite([{sql:"UPDATE ops_outbox_messages SET status = ? WHERE organization_id = ?",params:["delivered",dispatchOrg]}]);
  const job=await dispatchJob(r,"person"),ids={next:(p:string)=>p+"-"+crypto.randomUUID()};
  const original=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  const required=buildWorkflowTaskRecord({id:ids.next("schedule"),organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),createdAt:dispatchNow,draft:{taskType,priority:"normal",title:taskType==="schedule_service"?"Schedule service":"Schedule return visit",reason:"Arrange actual service",assigneeType:"user",assigneeId:dispatchManager,assigneeName:"Chris Delgado",dueAt:"2026-10-04T18:00:00.000Z",completionCriteria:"Save a ready plan",escalationDestination:"Facilities"}});
  await r.atomicWrite([...buildCreateTaskStatements({task:required,actor:dispatchActor(),ids}),buildWorkflowTaskProjectionStatement(dispatchOrg,job.id,[...original,required])]);
  const before=(await r.getWorkOrder(dispatchOrg,job.id))!,request=await input(job.id,{target:"person",membershipId:dispatchTech[1],tentative:true,reviewReason:"Date still needs store confirmation"});
  const tentative=await saveInternalSchedule(dispatchServices(r),request);
  expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalMembershipId).toBe(dispatchTech[1]);
  expect(tentative.schedule.tentative).toBe(true);
  const tasks=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  expect(tasks.find(t=>t.id===required.id)).toEqual(required);
  expect(tasks.filter(t=>["open","in_progress"].includes(t.status))).toEqual([required]);
  expect(await r.getWorkOrder(dispatchOrg,job.id)).toMatchObject({nextAction:before.nextAction,dueAt:before.dueAt});
  const notices=(await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id);
  const material=notices.map(m=>JSON.parse(m.payloadJson)).filter(p=>p.scheduleId===tentative.schedule.id);
  expect(material).toEqual([expect.objectContaining({headline:"Tentative internal plan saved",recipientMembershipIds:expect.arrayContaining([...dispatchTech]),notifyCoordinationTeam:false})]);
  expect(await saveInternalSchedule(dispatchServices(r),request)).toMatchObject({replayed:true,schedule:{id:tentative.schedule.id}});
  expect(await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id)).toEqual(tasks);
  expect((await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id)).toEqual(notices);
  await save(job.id,{tentative:false});
  const ready=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  expect(ready.find(t=>t.id===required.id)?.status).toBe("completed");
  expect(ready.filter(t=>["open","in_progress"].includes(t.status))).toEqual([expect.objectContaining({taskType:"record_service_outcome",assigneeId:dispatchTech[1],dueAt:"2026-10-04T18:00:00.000Z"})]);
 });
 it("deduplicates replay, rejects changed intent and stale saves without new facts",async()=>{
  const job=await dispatchJob(r,"person"),request=await input(job.id);
  const result=await saveInternalSchedule(dispatchServices(r),request),retry=await saveInternalSchedule(dispatchServices(r),request);
  expect(retry).toMatchObject({replayed:true,schedule:{id:result.schedule.id}});
  await expect(saveInternalSchedule(dispatchServices(r),{...request,date:"2026-10-09"})).rejects.toMatchObject({code:"CONFLICT"});
  await expect(saveInternalSchedule(dispatchServices(r),{...request,key:crypto.randomUUID()})).rejects.toMatchObject({code:"CONFLICT"});
  expect(await r.listInternalSchedules(dispatchOrg,job.id)).toHaveLength(1);
 });
 it.each([false,true])("reassigns and schedules once, with complete rollback on an invalid transactional write (tentative=%s)",async(tentative)=>{
  // Isolate this worker batch from the presentation seed; the worker is intentionally capped at 100.
  await r.atomicWrite([{sql:"UPDATE ops_outbox_messages SET status = ? WHERE organization_id = ?",params:["delivered",dispatchOrg]}]);
  const job=await dispatchJob(r,"person"),ids={next:(p:string)=>p+"-"+crypto.randomUUID()},initial=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  const scheduling=buildWorkflowTaskRecord({id:ids.next("schedule"),organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),createdAt:dispatchNow,draft:{taskType:"schedule_service",priority:"normal",title:"Schedule service",reason:"Arrange actual service",assigneeType:"user",assigneeId:dispatchManager,assigneeName:"Chris Delgado",dueAt:"2026-10-04T18:00:00.000Z",completionCriteria:"Save a ready plan",escalationDestination:"Facilities"}});
  await r.atomicWrite([...buildCreateTaskStatements({task:scheduling,actor:dispatchActor(),ids}),buildWorkflowTaskProjectionStatement(dispatchOrg,job.id,[...initial,scheduling])]);
  const before=await r.getWorkOrder(dispatchOrg,job.id),tasks=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id),notices=(await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id),request=await input(job.id,{membershipId:dispatchTech[1],target:"person",tentative,reviewReason:tentative?"Await store confirmation":undefined});
  const broken=new Proxy(r,{get(target,p){if(p==="atomicWrite")return (s:Parameters<OpsRepository["atomicWrite"]>[0])=>target.atomicWrite([...s,insertDispatchRecord("ops_internal_schedules",{id:"broken-"+crypto.randomUUID(),organization_id:dispatchOrg,work_order_id:job.id,assignment_id:"missing",revision:99,precision:"bad",planning_zone:"UTC",week:"2026-10-05",tentative:0,recorded_by:dispatchManager,recorded_by_name:"Test",recorded_at:dispatchNow})]);const v=Reflect.get(target,p);return typeof v==="function"?v.bind(target):v;}});
  await expect(saveInternalSchedule(dispatchServices(broken),request)).rejects.toThrow();
  expect(await r.getWorkOrder(dispatchOrg,job.id)).toEqual(before);expect((await r.getActiveAssignment(dispatchOrg,job.id))?.id).toBe(job.initialAssignment?.id);expect(await r.listInternalSchedules(dispatchOrg,job.id)).toHaveLength(0);
  expect(await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id)).toEqual(tasks);expect((await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id)).toEqual(notices);
  const saved=await saveInternalSchedule(dispatchServices(r),request);
  expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalMembershipId).toBe(dispatchTech[1]);
  expect(saved.schedule.assignmentId).not.toBe(job.initialAssignment?.id);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.version).toBe(1);
  expect((await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id&&JSON.parse(m.payloadJson).scheduleId)).toHaveLength(1);
 });
 it("retains required follow-ups when a manager reviews tentative waiting work",async()=>{
  const job=await dispatchJob(r,"person");await createFollowUp(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),accountableParty:"Chris Delgado",nextAction:"Confirm safe access",dueAt:"2026-10-06T18:00:00.000Z",escalationTo:"Facilities"});
  const tasks=await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id),before=await r.getWorkOrder(dispatchOrg,job.id);
  await expect(save(job.id)).rejects.toThrow(/Review what is needed/);
  await save(job.id,{tentative:true,reviewReason:"Tentative until safe access is confirmed"});
  expect(await r.listWorkflowTasksForWorkOrder(dispatchOrg,job.id)).toEqual(tasks);expect((await r.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(before?.dueAt);
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,search:job.problem,dispatchReadiness:"ready"})).items).toHaveLength(0);
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,search:job.problem,dispatchReadiness:"waiting"})).totalCount).toBe(1);
 });
 it("keeps unfinished work in needs-replanning and ends execution plans on results",async()=>{
  const job=await dispatchJob(r,"person");await save(job.id,{date:"2026-10-02"});
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,search:job.problem,scheduleView:"replan",scheduleFrom:"2026-10-03"})).totalCount).toBe(1);
  let w=(await r.getWorkOrder(dispatchOrg,job.id))!;
  await recordInternalWorkResult(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(dispatchTech[0]),expectedVersion:w.version!,expectedAssignmentId:job.initialAssignment!.id,key:crypto.randomUUID(),outcome:"parts_required",blocker:"parts",notes:"Await replacement"});
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalScheduleId).toBeUndefined();
  w=(await r.getWorkOrder(dispatchOrg,job.id))!;
  await markInternalWorkReady(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:w.version!,expectedAssignmentId:job.initialAssignment!.id,key:crypto.randomUUID(),notes:"Parts ready"});
  const returned=await save(job.id);expect(returned.schedule.revision).toBe(2);expect(returned.schedule.attempt).toBe(2);expect(await r.listWorkResults(dispatchOrg,job.id)).toHaveLength(1);
  expect(await r.listInternalSchedules(dispatchOrg,job.id)).toHaveLength(2);
 });
 it("drops the old performer's live agenda when returning or reassigning",async()=>{
  const job=await dispatchJob(r,"person"),planned=await save(job.id);
  let written:Parameters<OpsRepository["atomicWrite"]>[0]=[];
  const observed=new Proxy(r,{get(target,p){if(p==="atomicWrite")return (statements:typeof written)=>{written=statements;return target.atomicWrite(statements);};const value=Reflect.get(target,p);return typeof value==="function"?value.bind(target):value;}});
  await dispatchChange(observed,job.id,"return",dispatchTech[0]);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalScheduleId).toBeUndefined();expect(await r.listInternalSchedules(dispatchOrg,job.id)).toHaveLength(1);
  expect((await r.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,internalMembershipId:dispatchTech[0],search:job.problem})).items).toHaveLength(0);
  const audit=written.find(s=>s.sql.startsWith("INSERT INTO ops_audit_events")&&s.params.includes("internal_dispatch.return"));
  const payload=audit!.params.find(p=>typeof p==="string"&&p.startsWith('{"assignmentId"'));
  expect(JSON.parse(String(payload))).toMatchObject({priorScheduleId:planned.schedule.id,scheduleConsequence:"removed_for_new_assignment"});
 });
 it("retains zone snapshots and the exact store instant after organization zone changes",async()=>{
  const job=await dispatchJob(r,"person");
  try{
   await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/Chicago",dispatchOrg]}]);
   const plan=await save(job.id,{precision:"appointment",localStart:"2026-10-08T00:30",keepConflicts:true});
   expect(plan.schedule).toMatchObject({planningZone:"America/Chicago",entryZone:"America/New_York",day:"2026-10-07",startsAt:"2026-10-08T04:30:00.000Z"});
   await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["UTC",dispatchOrg]}]);
   expect(await r.getInternalSchedule(dispatchOrg,plan.schedule.id)).toMatchObject({planningZone:"America/Chicago",day:"2026-10-07",startsAt:"2026-10-08T04:30:00.000Z"});
  }finally{await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/New_York",dispatchOrg]}]);}
 });
 it.each(["day","appointment"] as const)("keeps saved-zone %s work in Today after an organization timezone change",async(precision)=>{
  const job=await dispatchJob(r,"person");
  try{
   const plan=await save(job.id,{precision,date:"2026-10-04",localStart:"2026-10-04T00:30",durationMinutes:30,keepConflicts:true});
   await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/Chicago",dispatchOrg]}]);
   const query={internalOnly:true,internalMembershipId:dispatchTech[0],search:job.problem,scheduleFrom:"2026-10-03",scheduleAt:"2026-10-04T04:30:00.000Z"};
   expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"today"})).totalCount).toBe(1);
   for(const scheduleView of ["upcoming","replan"] as const)expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView})).totalCount).toBe(0);
   expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"replan",scheduleFrom:"2026-10-04",scheduleAt:"2026-10-05T04:30:00.000Z"})).totalCount).toBe(1);
   expect((await r.listWorkOrders({organizationId:dispatchOrg,storeIds:[]},{...query,scheduleView:"today"})).totalCount).toBe(0);
   expect((await r.listWorkOrders({organizationId:"other-org"},{...query,scheduleView:"today"})).totalCount).toBe(0);
   expect(await r.getInternalSchedule(dispatchOrg,plan.schedule.id)).toEqual(plan.schedule);
  }finally{await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/New_York",dispatchOrg]}]);}
 });
 it("uses each saved zone before pagination and across a Sunday-to-Monday year boundary",async()=>{
  const prefix="P3 zone-page "+crypto.randomUUID(),jobs=[];
  try{
   for(let i=0;i<3;i++){const job=await dispatchJob(r,"person",{problem:prefix+" "+i});jobs.push(job);await save(job.id,{precision:i===0?"week":"day",date:i===0?"2027-01-03":"2027-01-04"});}
   await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/Chicago",dispatchOrg]}]);
   const central=await dispatchJob(r,"person",{problem:prefix+" central"});await save(central.id,{date:"2027-01-03"});
   const query={internalOnly:true,internalMembershipId:dispatchTech[0],search:prefix,scheduleFrom:"2027-01-03",scheduleAt:"2027-01-04T05:30:00.000Z",limit:1};
   const ids:string[]=[];let cursor:string|undefined;
   do{const page=await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"today",cursor});expect(page.totalCount).toBe(3);ids.push(...page.items.map(w=>w.id));cursor=page.nextCursor;}while(cursor);
   expect(ids.sort()).toEqual([jobs[1].id,jobs[2].id,central.id].sort());
   expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"replan"})).items.map(w=>w.id)).toEqual([jobs[0].id]);
   expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"upcoming"})).totalCount).toBe(0);
   expect((await r.listWorkOrders({organizationId:dispatchOrg},{...query,scheduleView:"week",scheduleFrom:"2026-12-28",scheduleTo:"2027-01-03",limit:10})).items.map(w=>w.id).sort()).toEqual([jobs[0].id,central.id].sort());
  }finally{await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/New_York",dispatchOrg]}]);}
 });
 it("warns for exact overlap or unknown duration without claiming free capacity",async()=>{
  const one=await dispatchJob(r,"person"),two=await dispatchJob(r,"person");
  await save(one.id,{precision:"appointment",localStart:"2026-10-09T10:00",durationMinutes:60,keepConflicts:true});
  await expect(save(two.id,{precision:"appointment",localStart:"2026-10-09T10:30",durationMinutes:30})).rejects.toThrow(/Overlaps/);
  await expect(save(two.id,{precision:"appointment",localStart:"2026-10-09T11:30"})).rejects.toThrow(/no time estimate/);
  await save(two.id,{precision:"appointment",localStart:"2026-10-09T11:30",keepConflicts:true});
 });
 it("queues targeted updates and suppresses obsolete schedule notices before delivery",async()=>{
  // Drain prior disposable-test work so the bounded worker page contains this case.
  await r.atomicWrite([{sql:"UPDATE ops_outbox_messages SET status = ? WHERE organization_id = ?",params:["failed",dispatchOrg]}]);
  const job=await dispatchJob(r,"person"),first=await save(job.id),second=await save(job.id,{date:"2026-10-09"});
  await r.upsertNotificationRule({organizationId:dispatchOrg,id:"p3-rule-"+crypto.randomUUID(),eventKey:"internal_dispatch_changed",recipientRole:"internal_technician",emailEnabled:true,occurredAt:dispatchNow});
  const messages=(await r.listDueOutboxMessages("9999-01-01T00:00:00Z",10000)).filter(m=>m.aggregateId===job.id&&JSON.parse(m.payloadJson).scheduleId),sent:TransactionalEmail[]=[];
  const transport=createNotificationEmailTransport({repository:r,baseUrl:"https://example.test",provider:{name:"fake",async send(email){sent.push(email);return {messageId:"fake-"+sent.length};}},sink:()=>{}});
  await transport.deliver({...messages.find(m=>JSON.parse(m.payloadJson).scheduleId===first.schedule.id)!,attemptCount:0});expect(sent).toHaveLength(0);
  await transport.deliver({...messages.find(m=>JSON.parse(m.payloadJson).scheduleId===second.schedule.id)!,attemptCount:0});expect(sent).toHaveLength(1);
 });
 it("keeps filter choices tenant-scoped and empty-scope reads empty",async()=>{
  expect((await r.getDispatchFilters({organizationId:dispatchOrg})).people.map(p=>p.id).sort()).toEqual(Array.from({length:6},(_,i)=>`membership-northline-tech-${i+1}`).sort());
  expect(await r.getDispatchFilters({organizationId:dispatchOrg,storeIds:[]})).toEqual({people:[],regions:[]});
  expect((await r.listWorkOrders({organizationId:dispatchOrg,storeIds:[]},{internalOnly:true,scheduleView:"week",scheduleFrom:"2026-10-05",scheduleTo:"2026-10-11"})).items).toEqual([]);
 });
 it("replays target changes once and rejects a changed target intent",async()=>{
  const job=await dispatchJob(r,"person"),request={organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,key:crypto.randomUUID(),localTarget:"2026-10-10T17:00",reason:"Operator service target"};
  await setInternalCompletionTarget(dispatchServices(r),request);
  expect(await setInternalCompletionTarget(dispatchServices(r),request)).toMatchObject({replayed:true,version:1});
  await expect(setInternalCompletionTarget(dispatchServices(r),{...request,localTarget:"2026-10-12T17:00"})).rejects.toMatchObject({code:"CONFLICT"});
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(job.dueAt);
 });
 it("rolls back a plan if the actor's writable access is revoked before commit",async()=>{
  const job=await dispatchJob(r,"person"),request=await input(job.id,{actor:dispatchActor(dispatchTech[0])});
  const revoked=new Proxy(r,{get(target,p){if(p==="atomicWrite")return async(statements:Parameters<OpsRepository["atomicWrite"]>[0])=>{await target.atomicWrite([{sql:"UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?",params:["suspended",dispatchOrg,dispatchTech[0]]}]);return target.atomicWrite(statements);};const value=Reflect.get(target,p);return typeof value==="function"?value.bind(target):value;}});
  try{await expect(saveInternalSchedule(dispatchServices(revoked),request)).rejects.toMatchObject({code:"FORBIDDEN"});expect((await r.getWorkOrder(dispatchOrg,job.id))?.version).toBe(0);expect(await r.listInternalSchedules(dispatchOrg,job.id)).toHaveLength(0);}
  finally{await r.atomicWrite([{sql:"UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?",params:["active",dispatchOrg,dispatchTech[0]]}]);}
 });
 it.skipIf(adapter==="fixture")("pages 1-store and 65-store synthetic plans through native tenant queries",async()=>{
  for(const count of [1,65]) {
    const fixture=buildSyntheticScaleFixture(count);
    const foundation=new Set(["organizations","divisions","regions","stores","users","memberships","scopeGrants","vendors","vendorSpecialties","vendorCoverage","taxonomyNodes","equipmentTemplates","componentTemplates"]);
    for(const key of Object.keys(fixture))if(Array.isArray(fixture[key as keyof typeof fixture])&&!foundation.has(key))(fixture as unknown as Record<string,unknown>)[key]=[];
    fixture.workOrders=fixture.stores.flatMap((store,index)=>[0,1].map(n=>({id:"p3-scale-work-"+index+"-"+n,organizationId:store.organizationId,number:"SCALE-"+count+"-"+index+"-"+n,storeId:store.id,problem:"Synthetic planning job "+index+"-"+n,priority:"routine" as const,status:"approved" as const,version:0,internalAccountableParty:"Chris Delgado",internalAccountableType:"membership" as const,internalAccountableId:dispatchManager,accountableParty:"Chris Delgado",nextAction:"Arrange team pickup",dueAt:"2026-10-06T18:00:00.000Z",escalationTo:"Facilities",createdAt:dispatchNow})));
    const selected=fixture.workOrders;
    fixture.assignments=fixture.assignments.filter(a=>!selected.some(w=>w.id===a.workOrderId));
    fixture.internalSchedules=[];
    for(const [index,work] of selected.entries()){
      work.status="approved";const assignment={id:"scale-p3-assignment-"+index,organizationId:work.organizationId,workOrderId:work.id,kind:"internal" as const,internalTarget:"pool" as const,status:"pending" as const,assignedAt:dispatchNow};fixture.assignments.push(assignment);
      fixture.workflowTasks!.push(buildWorkflowTaskRecord({id:"scale-p3-task-"+index,organizationId:work.organizationId,workOrderId:work.id,actor:dispatchActor(),createdAt:dispatchNow,draft:{taskType:"other",title:work.nextAction,reason:work.problem,priority:"normal",assigneeType:"user",assigneeId:dispatchManager,assigneeName:work.accountableParty,dueAt:work.dueAt,escalationDestination:work.escalationTo!,completionCriteria:"Allocate a technician",requiredForProgress:true}}));
      const plan={id:"scale-p3-plan-"+index,organizationId:work.organizationId,workOrderId:work.id,assignmentId:assignment.id,revision:1,attempt:1,precision:"week" as const,planningZone:"America/New_York",week:"2026-10-05",tentative:false,recordedBy:dispatchManager,recordedByName:"Scale manager",recordedAt:dispatchNow};work.internalScheduleId=plan.id;fixture.internalSchedules.push(plan);
    }
    const idMap=new Map<string,string>();for(const values of Object.values(fixture))if(Array.isArray(values))for(const row of values)if(row&&typeof row==="object"&&"id" in row)idMap.set(String(row.id),"p3-scale-"+count+"-"+row.id);
    const remap=(value:unknown):unknown=>typeof value==="string"?idMap.get(value)??value:Array.isArray(value)?value.map(remap):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([key,value])=>[key,remap(value)])):value;
    const scaled=remap(fixture) as typeof fixture;scaled.organizations[0].slug="p3-scale-"+count;for(const user of scaled.users)user.email="p3-scale-"+count+"-"+user.id+"@example.test";
    await seedOpsRepository(r,scaled);const comparison=createOpsFixtureRepository(scaled),org=scaled.organizations[0].id;
    const q={internalOnly:true,scheduleView:"week" as const,scheduleFrom:"2026-10-05",scheduleTo:"2026-10-11",limit:7};
    const expected=await comparison.listWorkOrders({organizationId:org},q),seen:string[]=[];let cursor:string|undefined;
    do{const page=await r.listWorkOrders({organizationId:org},{...q,cursor});expect(page.items.length).toBeLessThanOrEqual(7);expect(page.totalCount).toBe(expected.totalCount);seen.push(...page.items.map(w=>w.id));cursor=page.nextCursor;}while(cursor);
    expect(new Set(seen).size).toBe(selected.length);expect(seen).toHaveLength(selected.length);
    expect((await r.listWorkOrders({organizationId:org,storeIds:[scaled.stores[0].id]},q)).totalCount).toBe(selected.filter(w=>w.storeId===fixture.stores[0].id).length);
  }
 },60000);
 for(const contender of ["move","result","return"] as const)it.skipIf(adapter!=="PostgreSQL")("serializes concurrent schedule / "+contender+" on real PostgreSQL",async()=>{
  const job=await dispatchJob(r,"person"),request=await input(job.id);let arrivals=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const racing=new Proxy(r,{get(target,p){if(p==="atomicWrite")return async(s:Parameters<OpsRepository["atomicWrite"]>[0])=>{if(++arrivals===2)release();await gate;return target.atomicWrite(s);};const v=Reflect.get(target,p);return typeof v==="function"?v.bind(target):v;}});
  const other=contender==="move"?saveInternalSchedule(dispatchServices(racing),{...request,key:crypto.randomUUID(),date:"2026-10-09"}):contender==="result"?recordInternalWorkResult(dispatchServices(racing),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,key:crypto.randomUUID(),outcome:"completed"}):dispatchChange(racing,job.id,"return",dispatchTech[0]);
  const results=await Promise.allSettled([saveInternalSchedule(dispatchServices(racing),request),other]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.version).toBe(1);
  expect((await r.listInternalSchedules(dispatchOrg,job.id)).length).toBeLessThanOrEqual(1);
 });
 it("counts and pages the new board and operational history without crossing scope",async()=>boardReadRegression(r),30000);
 it("saves store access notes with scoped permission, retries, races and rollback",async()=>storeNotesRegression(r),30000);
});
