import { POST as storeVendorPost, GET as storeVendorGet } from "@/app/api/ops/stores/[id]/vendors/route";
import { beforeEach,expect,it,vi } from "vitest";
import { POST } from "@/app/api/ops/vendors/[id]/relationship/route";
import { GET } from "@/app/api/ops/vendors/[id]/documents/[documentId]/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OperatorSession } from "@/components/ops/data-contract";
const mocks=vi.hoisted(()=>({session:vi.fn(),repository:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/app/app/_data/operator-loader",()=>({loadOperatorSession:mocks.session}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repository}));
let repository:ReturnType<typeof createOpsFixtureRepository>,session:OperatorSession;
const fixture=buildNorthlinePresentationFixture(),vendor=fixture.vendors[0];
beforeEach(()=>{
 repository=createOpsFixtureRepository(fixture);
 session={accessMode:"preview",organizationId:NORTHLINE_ORGANIZATION_ID,organizationName:"Example",userId:"user-northline-facilities",membershipId:"membership-northline-facilities",displayName:"Jordan",email:"test@example.test",role:"facilities",scopeLabel:"Company"};
 mocks.session.mockImplementation(async()=>session);mocks.repository.mockImplementation(async()=>repository);
});
it("saves an uploaded vendor document and supports inline viewing and download",async()=>{
 const form=new FormData();form.set("operation","record_compliance");form.set("documentType","insurance");form.set("reviewStatus","pending");form.set("reference","FILE-TEST");form.append("attachment",new File(["Fictional insurance document"],"insurance.txt",{type:"text/plain"}));
 expect((await POST(new Request("http://localhost:3000/api/ops/vendors/relationship",{method:"POST",body:form}),{params:Promise.resolve({id:vendor.id})})).status).toBe(303);
 const document=(await repository.listVendorComplianceDocuments(session.organizationId,vendor.id)).find(d=>d.reference==="FILE-TEST")!;
 expect(document.storedFileId).toBeTruthy();
 const params=Promise.resolve({id:vendor.id,documentId:document.id});
 const opened=await GET(new Request("http://localhost:3000/file"),{params});expect(opened.status).toBe(200);expect(opened.headers.get("content-disposition")).toContain("inline;");expect(await opened.text()).toBe("Fictional insurance document");
 const downloaded=await GET(new Request("http://localhost:3000/file?download=1"),{params});expect(downloaded.headers.get("content-disposition")).toContain("attachment;");
 expect((await GET(new Request("http://localhost:3000/file"),{params:Promise.resolve({id:fixture.vendors[1].id,documentId:document.id})})).status).toBe(404);
 session.storeIds=["store-northline-104"];expect((await GET(new Request("http://localhost:3000/file"),{params})).status).toBe(403);
 session.storeIds=undefined;session.membershipId="revoked";expect((await GET(new Request("http://localhost:3000/file"),{params})).status).toBe(403);
});
it("returns a clear missing-file response for metadata-only records",async()=>{
 const document=(await repository.listVendorComplianceDocuments(session.organizationId,vendor.id))[0];
 expect((await GET(new Request("http://localhost:3000/file"),{params:Promise.resolve({id:vendor.id,documentId:document.id})})).status).toBe(404);
});

it("restricts coverage editing to company facilities and rejects stale or foreign scopes",async()=>{
 const before=await repository.listVendorCoverage(session.organizationId,vendor.id);
 const form=new FormData();form.set("operation","update_coverage");form.set("coverageVersion",before.map(r=>r.id).sort().join(","));form.append("coverageScopeIds",fixture.stores[0].id);
 const post=()=>POST(new Request("http://localhost:3000/api/ops/vendors/relationship",{method:"POST",body:form}),{params:Promise.resolve({id:vendor.id})});
 session.storeIds=[fixture.stores[0].id];expect((await post()).status).toBe(403);
 session.storeIds=undefined;expect((await post()).status).toBe(303);
 expect((await repository.listVendorCoverage(session.organizationId,vendor.id)).map(r=>r.scopeId)).toEqual([fixture.stores[0].id]);
 expect((await post()).status).toBe(409);
 expect(repository.snapshot().auditEvents.some(event=>event.eventType==="vendor.coverage_updated"&&event.aggregateId===vendor.id)).toBe(true);
});

it("enforces store scope when reading and setting store vendor preferences",async()=>{
 const storeId=fixture.stores[0].id,params=Promise.resolve({id:storeId});
 const form=new FormData();form.set("vendorId",vendor.id);form.set("version","0");form.set("tradeKeys","*");
 const post=()=>storeVendorPost(new Request("http://localhost:3000/api/ops/stores/vendors",{method:"POST",body:form}),{params});
 session.storeIds=[fixture.stores[1].id];expect((await post()).status).toBe(403);
 expect((await storeVendorGet(new Request("http://localhost:3000/api/ops/stores/vendors"),{params})).status).toBe(403);
 session.storeIds=[storeId];expect((await post()).status).toBe(303);
 expect((await repository.getStoreVendorPreference(session.organizationId,storeId,vendor.id))?.tradeKeysJson).toBe('["*"]');
 expect((await post()).status).toBe(409);
});
