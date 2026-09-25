import {getPublicOperationsGateway} from "@/components/ops-public/server-gateway";
import {describe,it,expect,vi} from "vitest";
import {buildNorthlinePresentationFixture} from "@/lib/ops/fixtures";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {issueWorkOrderToVendor} from "@/lib/server/work-order-issuance";
const mocks=vi.hoisted(()=>({repo:vi.fn()}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repo,getServerOpsRepositoryProxy:()=>mocks.repo()}));
import {GET,POST} from "@/app/api/public/service-optional-work/route";
async function setup(){
 const f=buildNorthlinePresentationFixture();const org=f.organizations[0];
 const vendor=f.vendors.find(v=>v.name.startsWith("ClearFlow"))!;
 const first=f.workOrders.find(w=>w.id==="wo-held-104-restroom-door")!,second=f.workOrders.find(w=>w.id==="wo-held-104-faucet") ?? f.workOrders.find(w=>w.id!==first.id&&w.storeId===first.storeId&&w.categoryKey==="plumbing"&&f.workOrderVisitHolds?.some(h=>h.workOrderId===w.id&&h.status==="active"))!;
 f.workOrders.push({...first,id:"main-optional-test",number:"CPS-OPTIONAL-TEST",problem:"Main plumbing visit",version:0});
 const repository=createOpsFixtureRepository(f);mocks.repo.mockReturnValue(repository);
 const actor={organizationId:org.id,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
 const sent=await issueWorkOrderToVendor({repository,organizationId:org.id,organizationName:org.name,workOrderId:"main-optional-test",vendorId:vendor.id,expectedRevision:0,channel:"manual",actor,offeredWorkIds:[first.id,second.id]});
 const token=sent.publicPath.split("/").at(-1)!;
 const respond=(workId:string,decision:string)=>POST(new Request("https://ops.test/api/public/service-optional-work",{method:"POST",headers:{Origin:"https://ops.test","Content-Type":"application/json"},body:JSON.stringify({token,workId,decision,name:"Alex Technician"})}));
 return {repository,org,vendor,first,second,token,respond,sent,actor};
}
describe("one authorization with optional saved jobs",()=>{
 it("keeps one service link scoped to the main job and accepted extras through check-in",async()=>{
  const t=await setup(); const gateway=getPublicOperationsGateway();
  await t.respond(t.first.id,"accepted"); await t.respond(t.second.id,"skipped");
  const context=await gateway.lookupVendorVisitContext(t.token,t.vendor.id);
  expect(context.eligibleWorkOrders.map(w=>w.id).sort()).toEqual(["main-optional-test",t.first.id].sort());
  await expect(gateway.checkIn(t.token,{submissionKey:"optional-bad-job",workOrderIds:["main-optional-test",t.second.id],technicianName:"Alex",location:{captureResult:"permission_denied"}})).rejects.toThrow(/main work order and accepted extras/);
  const visit=await gateway.checkIn(t.token,{submissionKey:"optional-accepted-visit",workOrderIds:["main-optional-test",t.first.id],technicianName:"Alex",location:{captureResult:"permission_denied"}});
  expect((await t.repository.listSiteVisitWorkOrders(t.org.id,visit.visitId)).map(w=>w.workOrderId).sort()).toEqual(["main-optional-test",t.first.id].sort());
 });

 it("offers extras without assigning them; accepts one atomically and leaves skipped work saved",async()=>{
  const t=await setup();
  expect((await t.repository.getWorkOrderVisitHold(t.org.id,t.first.id))?.status).toBe("active");
  expect(await t.repository.getActiveAssignment(t.org.id,t.first.id)).toBeNull();
  const page=await (await GET(new Request(`https://ops.test/api/public/service-optional-work?token=${t.token}`))).json() as {rows:unknown[]};expect(page.rows).toHaveLength(2);
  const accepted=await t.respond(t.first.id,"accepted");expect(await accepted.json()).toMatchObject({status:"accepted"});
  expect((await t.repository.getWorkOrder(t.org.id,t.first.id))?.status).toBe("accepted");
  expect((await t.repository.getActiveAssignment(t.org.id,t.first.id))?.vendorId).toBe(t.vendor.id);
  expect((await t.repository.getWorkOrderVisitHold(t.org.id,t.first.id))?.status).toBe("cancelled");
  expect(await (await t.respond(t.second.id,"skipped")).json()).toMatchObject({status:"skipped"});
  expect((await t.repository.getWorkOrderVisitHold(t.org.id,t.second.id))?.status).toBe("active");
  expect(await t.repository.getActiveAssignment(t.org.id,t.second.id)).toBeNull();
  await t.respond(t.first.id,"accepted");expect(await t.repository.listIssuancesForWorkOrder(t.org.id,t.first.id)).toHaveLength(1);
  const events=t.repository.snapshot().auditEvents.filter(e=>e.aggregateId==="main-optional-test");expect(events.some(e=>e.eventType==="optional_work.accepted")).toBe(true);expect(events.some(e=>e.eventType==="optional_work.skipped")).toBe(true);
 });
 it("rejects unoffered jobs and stale main authorization tokens",async()=>{
  const t=await setup();expect((await t.respond("wo-held-104-canopy-light","accepted")).status).toBe(403);
  await issueWorkOrderToVendor({repository:t.repository,organizationId:t.org.id,organizationName:t.org.name,workOrderId:"main-optional-test",vendorId:t.vendor.id,expectedRevision:1,channel:"manual",actor:t.actor});
  expect((await t.respond(t.first.id,"accepted")).status).toBe(404);
  expect((await t.repository.getWorkOrderVisitHold(t.org.id,t.first.id))?.status).toBe("active");
 });
 it("rolls back acceptance when a selected job changes",async()=>{
  const t=await setup();await t.repository.atomicWrite([{sql:"UPDATE ops_work_orders SET version = version + 1 WHERE organization_id = ? AND id = ?",params:[t.org.id,t.first.id]}]);
  expect((await t.respond(t.first.id,"accepted")).status).toBe(409);expect(await t.repository.getActiveAssignment(t.org.id,t.first.id)).toBeNull();
 });
});
