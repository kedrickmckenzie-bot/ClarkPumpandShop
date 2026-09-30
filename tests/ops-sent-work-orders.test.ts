import {describe,it,expect} from "vitest";
import {buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID,NORTHLINE_DEMO_HANDLES} from "@/lib/ops/fixtures";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {createSentWorkLink,sentWorkSnapshot} from "@/lib/ops/sent-work-orders";
const actor={organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
function setup() {
  const fixture=buildNorthlinePresentationFixture();
  const work=fixture.workOrders.find(w=>w.id===NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)!;
  const issuance=fixture.issuances.filter(i=>i.workOrderId===work.id).sort((a,b)=>b.revision-a.revision)[0];
  const snapshot=JSON.parse(issuance.immutablePayloadJson);snapshot.dispatchMessage="Use the rear entrance.";
  issuance.immutablePayloadJson=JSON.stringify(snapshot);
  return {fixture,work,issuance};
}
function harness() {
  const data=setup();const repository=createOpsFixtureRepository(data.fixture);
  return {...data,repository,svc:{repository,clock:{now:()=>"2026-09-30T12:00:00.000Z"}},input:{organizationId:NORTHLINE_ORGANIZATION_ID,workOrderId:data.work.id,issuanceId:data.issuance.id,actor}};
}
async function hash(raw:string) {return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))),byte=>byte.toString(16).padStart(2,"0")).join("");}
describe("saved sent work orders",()=>{
  it("creates a working link to unchanged sent content after later edits without a new issuance",async()=>{
    const t=harness();
    await t.repository.atomicWrite([{sql:"UPDATE ops_work_orders SET problem = ? WHERE organization_id = ? AND id = ?",params:["Changed after sending",NORTHLINE_ORGANIZATION_ID,t.work.id]}]);
    const before=await t.repository.listIssuancesForWorkOrder(NORTHLINE_ORGANIZATION_ID,t.work.id);
    const result=await createSentWorkLink(t.svc,t.input);
    const raw=result.publicPath.split("/").at(-1)!;
    const view=await t.repository.getServiceAuthorizationByToken({tokenHash:await hash(raw),purpose:"service_authorization",now:"2026-09-30T12:00:00.000Z"});
    expect(view?.problem).toBe(sentWorkSnapshot(t.issuance)?.problem);
    expect(view?.problem).not.toBe("Changed after sending");
    expect(view?.dispatchMessage).toBe("Use the rear entrance.");
    expect(await t.repository.listIssuancesForWorkOrder(NORTHLINE_ORGANIZATION_ID,t.work.id)).toEqual(before);
    const saved=t.repository.snapshot();
    expect(JSON.stringify(saved)).not.toContain(raw);
    expect(saved.auditEvents.some(e=>e.eventType==="work_order.vendor_link_created")).toBe(true);
    expect(result.expiresAt).toBe("2026-10-30T12:00:00.000Z");
  });
  it("retains the internal snapshot when vendor tokens expire",async()=>{
    const t=harness();const result=await createSentWorkLink(t.svc,t.input);
    expect(await t.repository.getServiceAuthorizationByToken({tokenHash:await hash(result.publicPath.split("/").at(-1)!),purpose:"service_authorization",now:"2026-12-01T00:00:00.000Z"})).toBeNull();
    expect(sentWorkSnapshot((await t.repository.getIssuance(NORTHLINE_ORGANIZATION_ID,t.issuance.id))!)?.dispatchMessage).toBe("Use the rear entrance.");
  });
  it.each(["cancelled","superseded","declined"])("does not revive a %s assignment",async status=>{
    const t=harness();await t.repository.atomicWrite([{sql:"UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",params:[status,NORTHLINE_ORGANIZATION_ID,t.issuance.assignmentId]}]);
    await expect(createSentWorkLink(t.svc,t.input)).rejects.toMatchObject({code:"CONFLICT"});
  });
  it("rejects a superseded revision and leaves its saved copy intact",async()=>{
    const t=harness();await t.repository.atomicWrite([{sql:"INSERT INTO ops_work_order_issuances (id, organization_id, work_order_id, assignment_id, revision, immutable_payload_json, channel, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",params:["newer-version",NORTHLINE_ORGANIZATION_ID,t.work.id,t.issuance.assignmentId,t.issuance.revision+1,t.issuance.immutablePayloadJson,"manual","2026-09-30T11:00:00Z"]}]);
    await expect(createSentWorkLink(t.svc,t.input)).rejects.toMatchObject({code:"CONFLICT"});
    expect(sentWorkSnapshot(t.issuance)).not.toBeNull();
  });
  it("rejects cross-tenant and unauthorized sharing",async()=>{
    const t=harness();
    await expect(createSentWorkLink(t.svc,{...t.input,organizationId:"another-org"})).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(createSentWorkLink(t.svc,{...t.input,actor:{...actor,actorId:"membership-northline-store-104"}})).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(createSentWorkLink(t.svc,{...t.input,actor:{...actor,actorId:"membership-northline-regional-3"}})).rejects.toMatchObject({code:"FORBIDDEN"});
  });
  it("does not substitute current data for an unreadable snapshot",()=>{
    const t=setup();expect(sentWorkSnapshot({...t.issuance,immutablePayloadJson:"broken"})).toBeNull();
  });
});
