import { beforeEach, expect, it, vi } from "vitest";
import { POST as publicSubmit } from "@/app/api/ops-public/inspection/[token]/route";
import { GET as publicFile } from "@/app/api/ops-public/inspection/[token]/files/[fileId]/route";
import { createInspectionLink,resolveInspectionLink } from "@/lib/ops/inspection-access";
import { ensureInspectionWork } from "@/lib/ops/compliance";
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

it("opens current master forms without changing an inspection's saved forms", async () => {
  session = { ...session, role: "facilities", userId: "user-northline-facilities", membershipId: "membership-northline-facilities", storeIds: undefined };
  const id = "inspection-compliance-demo-extinguisher-2026-09-24";
  const form = new FormData(); form.set("action", "templates"); form.set("inspectionId", id); form.set("version", "0");
  form.append("templates", new File(["Current blank inspection instructions"], "instructions.txt", { type: "text/plain" }));
  expect((await POST(new Request("http://localhost:3000/api/ops/compliance", { method: "POST", body: form }))).status).toBe(303);
  const inspection = (await repository.getInspection(session.organizationId, id))!;
  const schedule = (await repository.getComplianceSchedule(session.organizationId, inspection.scheduleId))!;
  const fileId = JSON.parse(schedule.masterDocumentsJson!)[0].id;
  const params = Promise.resolve({ id, fileId });
  expect((await GET(new Request("http://localhost:3000/files"), { params })).status).toBe(404);
  const opened = await GET(new Request("http://localhost:3000/files?source=schedule"), { params });
  expect(opened.status).toBe(200); expect(await opened.text()).toBe("Current blank inspection instructions");
  expect(opened.headers.get("content-disposition")).toContain("inline;");
  expect((await GET(new Request("http://localhost:3000/files?source=schedule&download=1"), { params })).headers.get("content-disposition")).toContain("attachment;");
  session.storeIds = ["store-northline-105"];
  expect((await GET(new Request("http://localhost:3000/files?source=schedule"), { params })).status).toBe(403);
});

it("submits paperwork by secure link and app to the same inspection, without public approval",async()=>{
 const org=session.organizationId,id="inspection-compliance-demo-extinguisher-2026-09-24";
 const inspection=(await repository.getInspection(org,id))!,schedule=(await repository.getComplianceSchedule(org,inspection.scheduleId))!;
 await ensureInspectionWork({repository},schedule,inspection);
 const path=await createInspectionLink(repository,org,id,{organizationId:org,actorType:"user",actorName:"Manager",actorId:"membership-northline-facilities"});const token=path.split("/").at(-1)!;
 const send=(version:string,status="performed",cross=false)=>{const form=new FormData();form.set("version",version);form.set("status",status);form.set("note","Inspection through secure link");form.set("performedDate","2026-09-24");form.append("attachments",new File(["Completed checklist"],"completed.txt",{type:"text/plain"}));return publicSubmit(new Request(`http://localhost:3000/api/ops-public/inspection/${token}`,{method:"POST",body:form,headers:cross?{origin:"https://unrelated.test"}:{}}),{params:Promise.resolve({token})});};
 expect((await send("0","passed")).status).toBe(403);expect((await send("0","performed",true)).status).toBe(403);
 expect((await send("0")).status).toBe(200);expect((await send("0")).status).toBe(409);
 const updated=(await repository.getInspection(org,id))!;expect(updated.status).toBe("performed");
 const files=await repository.listFilesForEntity(org,"work_order",updated.workOrderId!);expect(files).toHaveLength(1);
 const download=await publicFile(new Request("http://localhost:3000/file"),{params:Promise.resolve({token,fileId:files[0].id})});expect(download.status).toBe(200);expect(await download.text()).toBe("Completed checklist");
 expect((await publicFile(new Request("http://localhost:3000/file"),{params:Promise.resolve({token,fileId:"unrelated"})})).status).toBe(404);
 const form=new FormData();form.set("action","result");form.set("inspectionId",id);form.set("version","1");form.set("status","performed");form.set("note","Added photo in app");form.set("performedDate","2026-09-24");form.append("attachments",new File(["png"],"inspection.png",{type:"image/png"}));
 expect((await POST(new Request("http://localhost:3000/api/ops/compliance",{method:"POST",body:form}))).headers.get("location")).not.toContain("error=");expect(await repository.listFilesForEntity(org,"work_order",updated.workOrderId!)).toHaveLength(2);
 await repository.atomicWrite([{sql:"UPDATE ops_compliance_schedules SET status = ? WHERE organization_id = ? AND id = ?",params:["paused",org,schedule.id]}]);await expect(resolveInspectionLink(repository,token)).rejects.toMatchObject({code:"NOT_FOUND"});
});
