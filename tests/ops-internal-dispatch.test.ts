import {describe,it,expect} from "vitest";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {changeInternalDispatch} from "@/lib/ops/internal-dispatch";
import {dispatchActor,dispatchChange,dispatchJob,dispatchNow,dispatchOrg,dispatchServices,dispatchTech,internalDispatchRegression} from "./helpers/internal-dispatch-regression";

describe("internal dispatch",()=>{
  it("keeps inspection assignments and primary tasks on their specialized workflow",async()=>{
    const fixture=buildShowcaseFixture(dispatchNow);
    const inspection=fixture.inspections!.find(i=>i.workOrderId)!;
    const r=createOpsFixtureRepository(fixture);
    const before=await r.listWorkflowTasksForWorkOrder(dispatchOrg,inspection.workOrderId!);
    await expect(dispatchChange(r,inspection.workOrderId!,"assign",undefined,{target:"pool"})).rejects.toMatchObject({code:"CONFLICT"});
    expect(await r.listWorkflowTasksForWorkOrder(dispatchOrg,inspection.workOrderId!)).toEqual(before);
  });
  it("preserves ownership, deadlines, replay, held work and configured notifications",async()=>{
    const fixture=buildShowcaseFixture(dispatchNow);fixture.outboxMessages=[];
    await internalDispatchRegression(createOpsFixtureRepository(fixture));
  });
  it("allows only one winner and rejects access revoked inside the transaction",async()=>{
    const r=createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));
    const work=await dispatchJob(r);
    const results=await Promise.allSettled(dispatchTech.map(id=>dispatchChange(r,work.id,"claim",id)));
    expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);
    expect(r.snapshot().auditEvents.filter(e=>e.aggregateId===work.id&&e.eventType==="internal_dispatch.claim")).toHaveLength(1);
    const next=await dispatchJob(r);
    const atomic=r.atomicWrite.bind(r);
    r.atomicWrite=async statements=>{
      if(statements.some(s=>s.dispatchAccess)) {
        await atomic([{sql:"UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?",params:["suspended",dispatchOrg,dispatchTech[0]]}]);
      }
      return atomic(statements);
    };
    await expect(changeInternalDispatch(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:next.id,action:"claim",actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:next.initialAssignment!.id,key:"revoked"})).rejects.toMatchObject({code:"FORBIDDEN"});
    expect((await r.getWorkOrder(dispatchOrg,next.id))?.version).toBe(0);
    expect((await r.getActiveAssignment(dispatchOrg,next.id))?.internalTarget).toBe("pool");
    expect(r.snapshot().auditEvents.filter(e=>e.aggregateId===next.id&&e.eventType==="internal_dispatch.claim")).toHaveLength(0);
  });
  it("blocks linked active visits even when a job outcome already exists",async()=>{
    const r=createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));
    const work=await dispatchJob(r,"person");
    const snapshot=r.snapshot();
    const visit={...snapshot.visits[0],id:"dispatch-active-visit",storeId:work.storeId,workOrderId:work.id,providerKind:"internal" as const,vendorId:undefined,internalMembershipId:dispatchTech[0],status:"active" as const};
    snapshot.visits.push(visit);
    snapshot.siteVisitWorkOrders.push({id:"dispatch-active-link",organizationId:dispatchOrg,visitId:visit.id,workOrderId:work.id,selectionSource:"assigned_work",ordinal:1,linkedByActorType:"user",linkedByActorName:"Maria",linkedAt:dispatchNow,outcome:"completed"});
    const active=createOpsFixtureRepository(snapshot);
    await expect(dispatchChange(active,work.id,"return",dispatchTech[0])).rejects.toMatchObject({code:"CONFLICT"});
    await expect(dispatchChange(active,work.id,"assign",undefined,{target:"person",membershipId:dispatchTech[1]})).rejects.toMatchObject({code:"CONFLICT"});
    expect((await active.getVisit(dispatchOrg,visit.id))?.internalMembershipId).toBe(dispatchTech[0]);
  });
});
