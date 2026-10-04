import { expect } from "vitest";
import { saveStoreAccessNotes } from "@/lib/ops/store-access-notes";
import { saveInternalSchedule } from "@/lib/ops/internal-scheduling";
import {canPlanJob,dispatchJob as boardJob} from "@/lib/ops/dispatch-board";
import type { OpsRepository } from "@/lib/ops/repository";
import { dispatchActor,dispatchJob,dispatchOrg,dispatchServices,dispatchTech } from "./internal-dispatch-regression";

export async function boardReadRegression(r:OpsRepository) {
  const corrective=await r.getWorkOrderDetail({organizationId:dispatchOrg},"showcase-work-exit-light");
  expect(corrective).not.toBeNull();
  expect(corrective?.inspectionId).toBeUndefined();
  expect(canPlanJob(boardJob(corrective!))).toBe(true);
  const inspectionBefore=await r.inspectionForWork(dispatchOrg,corrective!.id);
  expect(inspectionBefore?.correctiveWorkOrderId).toBe(corrective!.id);
  const correctivePlan=await saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:corrective!.id,actor:dispatchActor(),expectedVersion:corrective!.version??0,expectedAssignmentId:corrective!.assignmentId!,expectedScheduleId:corrective!.schedule?.id??null,key:crypto.randomUUID(),precision:"day",date:"2026-10-05"});
  expect(correctivePlan.schedule.day).toBe("2026-10-05");
  expect(await r.inspectionForWork(dispatchOrg,corrective!.id)).toEqual(inspectionBefore);
  expect((await r.getWorkOrder(dispatchOrg,corrective!.id))?.dueAt).toBe(corrective!.dueAt);
  const checklist=await r.getWorkOrderDetail({organizationId:dispatchOrg},"showcase-work-walk-101");
  expect(checklist?.inspectionId).toBeTruthy();
  const checklistBefore=await r.getWorkOrder(dispatchOrg,checklist!.id);
  await expect(saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:checklist!.id,actor:dispatchActor(),expectedVersion:checklist!.version??0,expectedAssignmentId:checklist!.assignmentId!,expectedScheduleId:checklist!.schedule?.id??null,key:crypto.randomUUID(),precision:"day",date:"2026-10-05"})).rejects.toThrow("inspection record");
  expect(await r.getWorkOrder(dispatchOrg,checklist!.id)).toEqual(checklistBefore);
  const equipmentPage=await r.searchAssets({organizationId:dispatchOrg,storeIds:["store-northline-104"]},"",{limit:2});
  expect(equipmentPage.items).toHaveLength(2);expect(equipmentPage.totalCount).toBe(10);
  expect((await r.searchAssets({organizationId:dispatchOrg,storeIds:["store-northline-104"]},"",{limit:2,cursor:equipmentPage.nextCursor})).totalCount).toBe(10);

  const search=`Board native ${crypto.randomUUID()}`,scope={organizationId:dispatchOrg,storeIds:["store-northline-101"]};
  const jobs=[];
  for(let index=0;index<7;index++) {
    const job=await dispatchJob(r,index===5?"pool":"person",{problem:`${search} ${index}`,priority:index===6?"urgent":"routine"});jobs.push(job);
    if(index===6)continue;
    await saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:null,key:crypto.randomUUID(),precision:index===4?"week":"day",date:"2026-10-08"});
  }
  const query={internalOnly:true,maintenanceTeamOnly:true,search,scheduleView:"week" as const,scheduleFrom:"2026-10-05",scheduleTo:"2026-10-11"};
  const first=await r.listWorkOrders(scope,{...query,limit:3});
  expect(first.items).toHaveLength(3);expect(first.totalCount).toBe(6);expect(first.nextCursor).toBeTruthy();
  const counts=await r.getDispatchDayCounts(scope,query);
  expect(counts.find(row=>row.membershipId===dispatchTech[0]&&row.day==="2026-10-08")).toMatchObject({count:4,name:"Maria Santos"});
  const queue=await r.listWorkOrders(scope,{internalOnly:true,maintenanceTeamOnly:true,search,dispatchQueue:true,limit:1});
  expect(queue.totalCount).toBe(3);expect(queue.items[0]?.id).toBe(jobs[6]!.id);
  const unassigned=await r.listWorkOrders(scope,{...query,dispatchUnassigned:true});expect(unassigned.items.map(row=>row.id)).toEqual([jobs[5]!.id]);
  expect((await r.getDispatchDayCounts({...scope,storeIds:[]},query))).toEqual([]);
  expect((await r.getDispatchDayCounts({organizationId:"another-tenant"},query))).toEqual([]);
  const seen=new Set(first.items.map(row=>row.id));let cursor=first.nextCursor;
  while(cursor){const page=await r.listWorkOrders(scope,{...query,limit:2,cursor});for(const row of page.items){expect(seen.has(row.id)).toBe(false);seen.add(row.id);}cursor=page.nextCursor;}
  expect(seen.size).toBe(6);
  // Recently changed work is ordered and paged by its current audit, even when creation order differs.
  const old=jobs[0]!,later="2026-10-09T17:00:00.000Z";
  await r.atomicWrite([{sql:"INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",params:[crypto.randomUUID(),dispatchOrg,"work_order",old.id,"test.operational_update","user","Test",later,"{}"]}]);
  const recent=await r.listWorkOrders(scope,{internalOnly:true,activityOrder:true,search,limit:1});expect(recent.items[0]?.id).toBe(old.id);
  const next=await r.listWorkOrders(scope,{internalOnly:true,activityOrder:true,search,limit:1,cursor:recent.nextCursor});expect(next.items[0]?.id).not.toBe(old.id);expect(next.totalCount).toBe(7);
}

export async function storeNotesRegression(r:OpsRepository) {
  const storeId="store-northline-101",current=(await r.getStore(dispatchOrg,storeId))!;
  const input={organizationId:dispatchOrg,storeId,actor:dispatchActor(),expectedVersion:current.accessNotesVersion??0,notes:"Use the rear service door. Ask the manager for the key.",key:crypto.randomUUID()};
  await expect(saveStoreAccessNotes(r,{...input,actor:dispatchActor(dispatchTech[0])})).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(saveStoreAccessNotes(r,{...input,organizationId:"another-tenant"})).rejects.toMatchObject({code:"VALIDATION"});
  await saveStoreAccessNotes(r,input);await saveStoreAccessNotes(r,input);
  expect(await r.getStore(dispatchOrg,storeId)).toMatchObject({accessNotes:input.notes,accessNotesVersion:input.expectedVersion+1});
  await expect(saveStoreAccessNotes(r,{...input,notes:"Different retry"})).rejects.toMatchObject({code:"CONFLICT"});
  await expect(saveStoreAccessNotes(r,{...input,key:crypto.randomUUID()})).rejects.toMatchObject({code:"CONFLICT"});
  const race={...input,expectedVersion:input.expectedVersion+1};
  const outcomes=await Promise.allSettled([saveStoreAccessNotes(r,{...race,key:crypto.randomUUID(),notes:"First new instruction"}),saveStoreAccessNotes(r,{...race,key:crypto.randomUUID(),notes:"Second new instruction"})]);
  expect(outcomes.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  expect((await r.getStore(dispatchOrg,storeId))?.accessNotesVersion).toBe(input.expectedVersion+2);
  const before=await r.getStore(dispatchOrg,storeId),failing=new Proxy(r,{get(target,property){if(property==="atomicWrite")return async(statements:Parameters<OpsRepository["atomicWrite"]>[0])=>target.atomicWrite([...statements,{sql:"INSERT INTO missing_redesign_table (id) VALUES (?)",params:["rollback"]}]);const value=Reflect.get(target,property);return typeof value==="function"?value.bind(target):value;}});
  await expect(saveStoreAccessNotes(failing,{...race,expectedVersion:before!.accessNotesVersion!,key:crypto.randomUUID(),notes:"Must roll back"})).rejects.toThrow();
  expect(await r.getStore(dispatchOrg,storeId)).toEqual(before);
}
