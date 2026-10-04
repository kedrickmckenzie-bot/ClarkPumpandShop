import {beforeEach,describe,it,expect,vi} from "vitest";
import {POST} from "@/app/api/ops/work-orders/[id]/internal-dispatch/route";
import {GET} from "@/app/api/ops/internal-dispatch/people/route";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {internalDispatchScope} from "@/lib/server/internal-dispatch-context";
import type {OperatorSession} from "@/components/ops/data-contract";
import {dispatchJob,dispatchNow,dispatchOrg,dispatchTech} from "./helpers/internal-dispatch-regression";

const mocks=vi.hoisted(()=>({session:vi.fn(),repository:vi.fn()}));
vi.mock("@/app/app/_data/operator-loader",()=>({loadOperatorSession:mocks.session}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repository}));

describe("actual internal dispatch API boundary",()=>{
  let r:ReturnType<typeof createOpsFixtureRepository>;
  let session:OperatorSession;
  beforeEach(()=>{
    r=createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));
    session={accessMode:"authenticated",role:"technician",userId:"user-northline-tech-1",membershipId:dispatchTech[0],organizationId:dispatchOrg,organizationName:"Fictional demo",displayName:"Maria",email:"qa@example.test",scopeLabel:"Test scope",companywide:true,permissions:["ops:write"]};
    mocks.session.mockImplementation(async()=>session);mocks.repository.mockResolvedValue(r);
  });
  async function submit(overrides:Record<string,string>={},origin="http://localhost") {
    const job=await dispatchJob(r);
    const data=new FormData();
    Object.entries({action:"claim",expectedVersion:"0",expectedAssignmentId:job.initialAssignment!.id,submissionKey:crypto.randomUUID(),...overrides}).forEach(([k,v])=>data.set(k,v));
    const response=await POST(new Request(`http://localhost/api/ops/work-orders/${job.id}/internal-dispatch`,{method:"POST",headers:{Origin:origin},body:data}),{params:Promise.resolve({id:job.id})});
    return {response,job};
  }
  it("uses authenticated identity and persists the same job after redirect",async()=>{
    const {response,job}=await submit();expect(response.status).toBe(303);
    expect((await r.getActiveAssignment(dispatchOrg,job.id))?.internalMembershipId).toBe(dispatchTech[0]);
  });
  for(const role of ["finance","executive","store_manager"] as const) it(`rejects ${role} take and manager actions`,async()=>{
    session={...session,role};
    expect((await submit()).response.status).toBe(403);
    expect((await submit({action:"assign",internalTarget:"pool"})).response.status).toBe(403);
  });
  it("rejects technician identity substitution, cross-origin requests, empty scope and read-only grants",async()=>{
    expect((await submit({internalMembershipId:dispatchTech[1]})).response.status).toBe(422);
    expect((await submit({},"https://other.example")).response.status).toBe(403);
    session={...session,storeIds:[]};expect((await submit()).response.status).toBe(403);
    session={...session,storeIds:undefined,permissions:["ops:read"]};expect((await submit()).response.status).toBe(403);
  });
  it("does not expose people pickers to technicians",async()=>{
    const response=await GET(new Request("http://localhost/api/ops/internal-dispatch/people?store=store-northline-101"));
    expect(response.status).toBe(403);
  });
  it("respects current technician access after a saved session",async()=>{
    await r.atomicWrite([{sql:"UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?",params:["suspended",dispatchOrg,dispatchTech[0]]}]);
    expect((await submit()).response.status).toBe(403);
  });
  it("keeps field-manager reads and mutation targets within confirmed scope",async()=>{
    session={...session,role:"regional",persona:"field_manager",userId:"user-northline-field-manager",membershipId:"membership-northline-field-manager"};
    expect((await internalDispatchScope(r,session)).storeIds).toHaveLength(15);
    expect((await submit({action:"assign",internalTarget:"pool"})).response.status).toBe(303);
    session={...session,companywide:false,storeIds:["store-northline-102"]};
    expect((await internalDispatchScope(r,session)).storeIds).toEqual(["store-northline-102"]);
    expect((await submit({action:"assign",internalTarget:"pool"})).response.status).toBe(403);
    for(const storeIds of [[],undefined]) {
      session={...session,storeIds};
      expect((await internalDispatchScope(r,session)).storeIds).toEqual([]);
      expect((await submit({action:"assign",internalTarget:"pool"})).response.status).toBe(403);
    }
  });
});
