import { beforeEach,expect,it,vi } from "vitest";
import { POST } from "@/app/api/ops/capital-plans/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OperatorSession } from "@/components/ops/data-contract";
const mocks=vi.hoisted(()=>({session:vi.fn(),repository:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/app/app/_data/operator-loader",()=>({loadOperatorSession:mocks.session}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repository}));
let repository:ReturnType<typeof createOpsFixtureRepository>,session:OperatorSession;
const fixture=buildNorthlinePresentationFixture();
beforeEach(()=>{
 repository=createOpsFixtureRepository(fixture);
 session={accessMode:"preview",organizationId:NORTHLINE_ORGANIZATION_ID,organizationName:"Example",userId:"user-northline-facilities",membershipId:"membership-northline-facilities",displayName:"Jordan",email:"test@example.test",role:"facilities",scopeLabel:"Company"};
 mocks.session.mockImplementation(async()=>session);mocks.repository.mockImplementation(async()=>repository);
});
it("requires current membership and scope, persists audit, rejects stale changes",async()=>{
 const asset=fixture.assets.find(a=>a.status!=="retired")!,form=new FormData();
 for(const [k,v] of Object.entries({assetId:asset.id,version:"0",owner:"Facilities",currency:"USD",priority:"flexible",status:"planned",amount:"18000",targetMonth:"2027-03",reason:"Proactive refresh"}))form.set(k,v);
 const post=()=>POST(new Request("http://localhost:3000/api/ops/capital-plans",{method:"POST",body:form}));
 session.storeIds=[];expect((await post()).status).toBe(403);session.storeIds=undefined;
 session.membershipId="revoked";expect((await post()).status).toBe(403);session.membershipId="membership-northline-facilities";
 expect((await post()).status).toBe(200);expect((await post()).status).toBe(409);
 expect(repository.snapshot().capitalPlans).toHaveLength(1);
 expect(repository.snapshot().auditEvents.filter(a=>a.eventType==="asset.capital_plan_saved")).toHaveLength(1);
 form.set("version","1");form.set("amount","-1");expect((await post()).status).toBe(422);
 session.role="executive";expect((await post()).status).toBe(403);
});
