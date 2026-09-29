import {expect,it} from "vitest";
import {uniqueExposureTotal} from "@/lib/ops/value-exposure";
import {buildNorthlinePresentationFixture} from "@/lib/ops/fixtures";
import {buildWorkOrderCase} from "@/lib/ops/work-order-case";
import {operatingRisksFromFixture} from "@/lib/ops/operating-risks";
it("counts overlapping invoice line flags once while retaining distinct lines and currencies",()=>{
 const a={id:"a",organizationId:"org",invoiceLineId:"line",amount:{amountMinor:1200,currency:"USD"}};
 expect(uniqueExposureTotal([a,{...a,id:"b"}])).toBe(1200);
 expect(uniqueExposureTotal([a,{...a,id:"b",amount:{amountMinor:500,currency:"USD"}},{...a,id:"c",invoiceLineId:"other"}])).toBe(2400);
});
it("uses the latest operating assessment and respects store scope",()=>{
 const f=buildNorthlinePresentationFixture(),scope={organizationId:f.organizations[0].id},risk=operatingRisksFromFixture(f,scope).items[0];expect(risk).toBeTruthy();
 const assessment=f.requestImpactAssessments.find(a=>a.requestId===risk.id)!;
 f.requestImpactAssessments.push({...assessment,id:"new-assessment",assessedAt:"2026-09-28T12:00:00Z",storeOperatingState:"open"});
 expect(operatingRisksFromFixture(f,scope).items.some(r=>r.id===risk.id)).toBe(false);
 expect(operatingRisksFromFixture(f,{...scope,storeIds:[]})).toEqual({items:[],totalCount:0});
});
it("routes completed repair verification to the operator and flags stale open visits",()=>{
 const f=buildNorthlinePresentationFixture(),work=f.workOrders.find(w=>w.id==="wo-recent-aug-101-refrigeration")!;
 const tasks=f.workflowTasks.filter(t=>t.workOrderId===work.id);
 const model=buildWorkOrderCase({now:"2026-09-28T12:00:00Z",workOrder:work,workflowTasks:tasks,assignments:f.assignments.filter(a=>a.workOrderId===work.id)});
 expect(model.nextActionOwner).toBe("Store team");expect(model.primaryNextAction.href).toContain("#work-verification");
 const stale=buildWorkOrderCase({now:"2026-09-28T12:00:00Z",workOrder:{...work,status:"in_progress"},visits:[{id:"stale",workOrderId:work.id,status:"active",checkedInAt:"2026-08-25T12:00:00Z"}]});
 expect(stale.plainLanguageState).toContain("Missing checkout");
});
