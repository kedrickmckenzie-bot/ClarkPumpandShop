import { expect } from "vitest";
import { assignWorkOrder, createWorkOrder, placeWorkOrderOnVisitHold, releaseWorkOrderVisitHold, updateWorkOrderControl } from "@/lib/ops/commands";
import { changeInternalDispatch, insertDispatchRecord, type InternalTarget } from "@/lib/ops/internal-dispatch";
import { heldWorkInternalEligibility, heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { createNotificationEmailTransport, type TransactionalEmail } from "@/lib/ops/email-delivery";
import type { OpsRepository } from "@/lib/ops/repository";

export const dispatchOrg = "org-northline-demo";
export const dispatchNow = "2026-10-03T18:00:00.000Z";
export const dispatchManager = "membership-northline-field-manager";
export const dispatchTech = ["membership-northline-tech-1", "membership-northline-tech-2"];
export const dispatchActor = (id = "membership-northline-facilities") => ({organizationId:dispatchOrg,actorType:"user" as const,actorId:id,actorName:id});
export const dispatchServices = (repository: OpsRepository) => ({repository,clock:{now:()=>dispatchNow}});

export async function dispatchJob(repository:OpsRepository,target:InternalTarget="pool",extra: Partial<Parameters<typeof createWorkOrder>[1]>={}) {
  return createWorkOrder(dispatchServices(repository), {organizationId:dispatchOrg,storeId:"store-northline-101",accountableParty:"Facilities coordination",nextAction:"Arrange internal work",problem:`Dispatch regression ${crypto.randomUUID()}`,actor:dispatchActor(), initialAssignment:{kind:"internal",internalTarget:target,internalMembershipId:target==="person"?dispatchTech[0]:undefined,managerId:dispatchManager}, ...extra});
}

export async function dispatchChange(repository:OpsRepository,workId:string,action:"assign"|"claim"|"return",actorId?:string,extra: Partial<Parameters<typeof changeInternalDispatch>[1]>={}) {
  const work = (await repository.getWorkOrder(dispatchOrg,workId))!;
  const assignment = await repository.getActiveAssignment(dispatchOrg,workId);
  return changeInternalDispatch(dispatchServices(repository),{organizationId:dispatchOrg,workOrderId:workId,action,actor:dispatchActor(actorId),expectedVersion:work.version??0,expectedAssignmentId:assignment?.id??null,key:crypto.randomUUID(),...extra});
}

/** Shared assertions run unchanged on fixture, Miniflare D1 and actual PostgreSQL. */
export async function internalDispatchRegression(repository:OpsRepository) {
  const job = await dispatchJob(repository);
  const due = job.dueAt;
  expect(job.initialAssignment?.internalTarget).toBe("pool");
  expect(job.accountableParty).toBe("Chris Delgado");
  for (const shape of [{internal_target:null,internal_membership_id:null},{internal_target:"person",internal_membership_id:null},{internal_target:"pool",internal_membership_id:dispatchTech[0]},{internal_target:"awaiting_allocation",internal_membership_id:dispatchTech[0]}]) {
    await expect(repository.atomicWrite([insertDispatchRecord("ops_work_order_assignments",{id:crypto.randomUUID(),organization_id:dispatchOrg,work_order_id:job.id,kind:"internal",status:"pending",assigned_at:dispatchNow,...shape})])).rejects.toThrow();
  }
  await expect(dispatchChange(repository,job.id,"claim",dispatchManager)).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(dispatchChange(repository,job.id,"claim","membership-northline-store-101")).rejects.toMatchObject({code:"FORBIDDEN"});
  const request = {organizationId:dispatchOrg,workOrderId:job.id,action:"claim" as const,actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,key:crypto.randomUUID()};
  const claimed = await changeInternalDispatch(dispatchServices(repository),request);
  expect(claimed.assignment.internalMembershipId).toBe(dispatchTech[0]);
  expect((await repository.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(due);
  expect((await repository.listWorkOrders({organizationId:dispatchOrg},{internalMembershipId:dispatchTech[0],search:job.problem})).items.map(w=>w.id)).toEqual([job.id]);
  expect((await repository.listWorkOrders({organizationId:dispatchOrg},{internalTarget:"pool",search:job.problem})).items).toEqual([]);
  const retry = await changeInternalDispatch(dispatchServices(repository),request);
  expect(retry).toMatchObject({replayed:true,assignment:{id:claimed.assignment.id}});
  await expect(changeInternalDispatch(dispatchServices(repository),{...request,reason:"Different retry"})).rejects.toMatchObject({code:"CONFLICT"});
  await expect(dispatchChange(repository,job.id,"return",dispatchTech[1])).rejects.toMatchObject({code:"FORBIDDEN"});
  await dispatchChange(repository,job.id,"assign",undefined,{target:"person",membershipId:dispatchTech[1]});
  expect((await repository.listWorkOrders({organizationId:dispatchOrg},{internalMembershipId:dispatchTech[0],search:job.problem})).items).toHaveLength(0);
  const direct = (await repository.getWorkOrder(dispatchOrg,job.id))!;
  expect(direct.nextAction).toBe("Begin internal work");
  expect(direct.internalAccountableId).toBe(dispatchManager);
  expect(direct.dueAt).toBe(due);
  const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg,job.id);
  expect(tasks.filter(t=>t.status==="open")).toEqual([expect.objectContaining({assigneeId:dispatchTech[1],dueAt:due,title:"Begin internal work"})]);
  await dispatchChange(repository,job.id,"return",dispatchTech[1]);
  expect((await repository.getActiveAssignment(dispatchOrg,job.id))?.internalTarget).toBe("pool");
  expect((await repository.getWorkOrder(dispatchOrg,job.id))?.dueAt).toBe(due);
  expect((await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z",10000)).filter(m=>m.aggregateId===job.id&&m.topic==="ops.internal_dispatch.notification"&&!JSON.parse(m.payloadJson).initialAssignment)).toHaveLength(1);

  const pending = await dispatchJob(repository,"awaiting_allocation");
  await expect(dispatchChange(repository,pending.id,"claim",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});
  await dispatchChange(repository,pending.id,"assign",dispatchManager,{target:"pool"});
  await dispatchChange(repository,pending.id,"claim",dispatchTech[0]);
  const deferred = await createWorkOrder(dispatchServices(repository),{organizationId:dispatchOrg,storeId:job.storeId,accountableParty:"Facilities coordination",nextAction:"Choose service provider",problem:"Choose later stays separate",actor:dispatchActor(),initialAssignment:{kind:"choose_later"}});
  await expect(dispatchChange(repository,deferred.id,"claim",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});
  await assignWorkOrder(dispatchServices(repository),{organizationId:dispatchOrg,workOrderId:job.id,kind:"choose_later",actor:dispatchActor()});
  await expect(dispatchChange(repository,job.id,"claim",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});

  const held = await dispatchJob(repository,"pool",{holdForVisit:{posture:"complete_using_professional_judgment",deadlineAt:"2026-10-20T18:00:00.000Z"}});
  expect(held.categoryKey).toBeUndefined();
  expect((await repository.getWorkOrder(dispatchOrg,held.id))?.nextAction).toBe("Wait for a suitable internal visit");
  expect(await heldWorkInternalEligibility({repository,organizationId:dispatchOrg,workOrder:held,membershipId:dispatchTech[0]})).toEqual({allowed:true});
  expect((await heldWorkVendorEligibility({repository,organizationId:dispatchOrg,vendorId:"vendor-northline-summit",workOrder:held,now:dispatchNow})).allowed).toBe(false);
  await dispatchChange(repository,held.id,"claim",dispatchTech[0]);
  expect((await repository.listWorkflowTasksForWorkOrder(dispatchOrg,held.id)).filter(t=>t.status==="open")[0].assigneeId).toBe(dispatchManager);
  await releaseWorkOrderVisitHold(dispatchServices(repository),{organizationId:dispatchOrg,workOrderId:held.id,actor:dispatchActor()});
  expect((await repository.getWorkOrder(dispatchOrg,held.id))?.nextAction).toBe("Begin internal work");
  await placeWorkOrderOnVisitHold(dispatchServices(repository),{organizationId:dispatchOrg,workOrderId:held.id,posture:"look_and_report",deadlineAt:"2026-10-22T18:00:00.000Z",actor:dispatchActor()});
  const beforeCancel=(await repository.getWorkOrder(dispatchOrg,held.id))!;
  await updateWorkOrderControl(dispatchServices(repository),{organizationId:dispatchOrg,workOrderId:held.id,expectedVersion:beforeCancel.version,expectedStatus:beforeCancel.status,status:"cancelled",note:"Not needed; shelf replaced",actor:dispatchActor()});
  expect((await repository.getWorkOrderVisitHold(dispatchOrg,held.id))?.status).toBe("cancelled");
  await expect(dispatchChange(repository,held.id,"claim",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});

  const urgent = await dispatchJob(repository,"person",{priority:"urgent"});
  await repository.atomicWrite([{sql:"UPDATE ops_work_orders SET due_at = ? WHERE organization_id = ? AND id = ?",params:["2026-10-01T18:00:00.000Z",dispatchOrg,urgent.id]}]);
  const urgentReturn = {organizationId:dispatchOrg,workOrderId:urgent.id,action:"return" as const,actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:urgent.initialAssignment!.id,key:crypto.randomUUID()};
  await changeInternalDispatch(dispatchServices(repository),urgentReturn);
  await changeInternalDispatch(dispatchServices(repository),urgentReturn);
  expect((await repository.getWorkOrder(dispatchOrg,urgent.id))?.dueAt).toBe("2026-10-01T18:00:00.000Z");
  const notices=(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z",10000)).filter(m=>m.aggregateId===urgent.id&&m.topic==="ops.internal_dispatch.notification"&&!JSON.parse(m.payloadJson).initialAssignment);
  expect(notices).toHaveLength(1);
  expect(JSON.parse(notices[0].payloadJson).recipientMembershipIds).toEqual([dispatchManager]);
  await repository.upsertNotificationRule({organizationId:dispatchOrg,id:`dispatch-rule-${crypto.randomUUID()}`,eventKey:"internal_dispatch_changed",recipientRole:"field_manager",emailEnabled:true,occurredAt:dispatchNow});
  const sent:TransactionalEmail[]=[];
  const transport=createNotificationEmailTransport({repository,baseUrl:"https://example.test",provider:{name:"test",async send(email){sent.push(email);return {messageId:"mock-delivery"};}},sink:()=>{}});
  await transport.deliver({...notices[0],attemptCount:notices[0].attemptCount??0});
  expect(sent).toHaveLength(1);
  expect(sent[0].text).toContain(urgent.id);
  await dispatchChange(repository,urgent.id,"claim",dispatchTech[1]);
  await transport.deliver({...notices[0],attemptCount:notices[0].attemptCount??0});
  expect(sent).toHaveLength(1); // obsolete notice does not tell a manager that a now-taken job is available
  expect((await repository.listWorkOrders({organizationId:"another-org"},{internalOnly:true})).items).toEqual([]);
  expect((await repository.listDispatchPeople({organizationId:dispatchOrg,storeIds:[]},job.storeId)).items).toEqual([]);
  for (const status of ["waiting_on_parts","waiting_on_vendor"] as const) {
    const blocked=await dispatchJob(repository,"person");
    const before=await repository.listWorkflowTasksForWorkOrder(dispatchOrg,blocked.id);
    await repository.atomicWrite([{sql:"UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",params:[status,dispatchOrg,blocked.id]}]);
    await expect(dispatchChange(repository,blocked.id,"return",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});
    await expect(dispatchChange(repository,blocked.id,"assign",undefined,{target:"pool"})).rejects.toMatchObject({code:"CONFLICT"});
    expect(await repository.listWorkflowTasksForWorkOrder(dispatchOrg,blocked.id)).toEqual(before);
    expect((await repository.getWorkOrder(dispatchOrg,blocked.id))?.version).toBe(0);
  }
  const onsite=await dispatchJob(repository,"person");
  const visitId=crypto.randomUUID();
  await repository.atomicWrite([
    insertDispatchRecord("ops_visit_sessions",{id:visitId,organization_id:dispatchOrg,store_id:onsite.storeId,provider_kind:"internal",internal_membership_id:dispatchTech[0],technician_name:"Maria Santos",provider_name:"Maria Santos",purpose:"Repair",status:"active",started_channel:"store_device",checked_in_at:dispatchNow,crew_count:1,additional_technician_names_json:"[]"}),
    insertDispatchRecord("ops_site_visit_work_orders",{id:crypto.randomUUID(),organization_id:dispatchOrg,visit_id:visitId,work_order_id:onsite.id,selection_source:"assigned_work",ordinal:1,linked_by_actor_type:"user",linked_by_actor_name:"Maria Santos",linked_at:dispatchNow,outcome:"completed",outcome_recorded_by_actor_type:"user",outcome_recorded_by_actor_name:"Maria Santos",outcome_recorded_at:dispatchNow}),
  ]);
  await expect(dispatchChange(repository,onsite.id,"return",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});
  await expect(dispatchChange(repository,onsite.id,"assign",undefined,{target:"person",membershipId:dispatchTech[1]})).rejects.toMatchObject({code:"CONFLICT"});
  expect((await repository.getVisit(dispatchOrg,visitId))?.internalMembershipId).toBe(dispatchTech[0]);

  const rollback=await dispatchJob(repository);
  const broken=new Proxy(repository,{get(target,property){
    if(property==="atomicWrite") return (statements:Parameters<OpsRepository["atomicWrite"]>[0])=>target.atomicWrite([...statements,insertDispatchRecord("ops_work_order_assignments",{id:crypto.randomUUID(),organization_id:dispatchOrg,work_order_id:rollback.id,kind:"internal",status:"pending",assigned_at:dispatchNow,internal_target:"person",internal_membership_id:null})]);
    const value=Reflect.get(target,property);return typeof value==="function"?value.bind(target):value;
  }});
  await expect(dispatchChange(broken,rollback.id,"assign",undefined,{target:"person",membershipId:dispatchTech[0]})).rejects.toThrow();
  expect((await repository.getWorkOrder(dispatchOrg,rollback.id))?.version).toBe(0);
  expect((await repository.getActiveAssignment(dispatchOrg,rollback.id))?.id).toBe(rollback.initialAssignment!.id);
  expect((await repository.getWorkOrderDetail({organizationId:dispatchOrg},rollback.id))?.nextAction).toBe("Arrange team pickup");
  expect((await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z",10000)).filter(m=>m.aggregateId===rollback.id&&m.topic==="ops.internal_dispatch.notification"&&!JSON.parse(m.payloadJson).initialAssignment)).toHaveLength(0);
}
