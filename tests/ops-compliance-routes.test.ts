import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/compliance/route";
import { GET } from "@/app/api/ops/compliance/[id]/files/[fileId]/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

import type { OperatorSession } from "@/components/ops/data-contract";
const mocks = vi.hoisted(() => ({ session: vi.fn(), repository: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: mocks.session }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocks.repository }));
let repository: ReturnType<typeof createOpsFixtureRepository>;
let session: OperatorSession;
beforeEach(() => {
  repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  session = { accessMode: "preview", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Fictional company", userId: "user-northline-store-104", membershipId: "membership-northline-store-104", displayName: "Store manager", email: "store@example.test", role: "store_manager", scopeLabel: "Store 104", storeIds: ["store-northline-104"] };
  mocks.session.mockImplementation(async () => session); mocks.repository.mockImplementation(async () => repository);
});

function request(action:string,id="inspection-compliance-demo-extinguisher-2026-09-24") {const form=new FormData();form.set("action",action);form.set("inspectionId",id);form.set("version","0");form.set("status","passed");form.set("note","Reviewed");form.set("performedDate","2026-09-24");return new Request("http://localhost:3000/api/ops/compliance",{method:"POST",body:form});}
it("prevents store users from managing schedules or approving their own inspection",async()=>{
 expect((await POST(request("create"))).status).toBe(403);
 expect((await POST(request("cycle"))).status).toBe(403);
 expect((await POST(request("result"))).status).toBe(403);
 expect((await repository.getInspection(session.organizationId,"inspection-compliance-demo-extinguisher-2026-09-24"))?.status).toBe("pending");
});
it("checks store scope before inspection mutation or file retrieval",async()=>{
 const id="inspection-compliance-demo-food-2026-09-25";
 expect((await POST(request("result",id))).status).toBe(403);
 expect((await GET(new Request("http://localhost:3000/api/ops/compliance/files"),{params:Promise.resolve({id,fileId:"any"})})).status).toBe(403);
});
it("rejects revoked membership and foreign inspection ids",async()=>{
 expect((await GET(new Request("http://localhost:3000/api/ops/compliance/files"),{params:Promise.resolve({id:"foreign",fileId:"any"})})).status).toBe(404);
 session.membershipId="revoked";expect((await POST(request("result"))).status).toBe(403);
});

it("uploads a photo as evidence and serves it privately",async()=>{
 const id="inspection-compliance-demo-extinguisher-2026-09-24";
 const form=new FormData();form.set("action","result");form.set("inspectionId",id);form.set("version","0");form.set("status","performed");form.set("note","Photo of completed check");form.set("performedDate","2026-09-24");
 form.append("attachments",new File([Uint8Array.from([137,80,78,71,13,10,26,10])],"inspection.png",{type:"image/png"}));
 const response=await POST(new Request("http://localhost:3000/api/ops/compliance",{method:"POST",body:form}));expect(response.status).toBe(303);expect(response.headers.get("location")).not.toContain("error=");
 const i=(await repository.getInspection(session.organizationId,id))!;
 const files=await repository.listFilesForEntity(session.organizationId,"work_order",i.workOrderId!);expect(files).toHaveLength(1);expect(files[0].contentType).toBe("image/png");
 const download=await GET(new Request("http://localhost:3000/api/ops/compliance/files"),{params:Promise.resolve({id,fileId:files[0].id})});expect(download.status).toBe(200);expect(download.headers.get("content-disposition")).toContain("inspection.png");
});
