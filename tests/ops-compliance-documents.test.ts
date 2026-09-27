import { beforeEach,expect,it } from "vitest";
import { getNorthlineFixtureRepository,resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID,NORTHLINE_DEMO_HANDLES } from "@/lib/ops/fixtures";
import { PUBLIC_DEMO_LINKS,resolveInspectionMasterFiles } from "@/components/ops-public/server-gateway";
import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { GET } from "@/app/api/ops-public/service/[token]/files/[fileId]/route";

beforeEach(()=>resetNorthlineFixtureRepository());
it("serves only the saved master forms through the matching vendor capability",async()=>{
 const repository=getNorthlineFixtureRepository(),org=NORTHLINE_ORGANIZATION_ID;
 const bytes=new TextEncoder().encode("Blank checklist").buffer;
 const [upload]=await getQuoteUploadStore(true).store({organizationId:org,subjectType:"inspection",subjectId:"test-master",uploads:[{name:"checklist.txt",mediaType:"text/plain",size:bytes.byteLength,bytes}]});
 const file={id:"template-download",organizationId:org,storageKey:upload.key,sha256:upload.sha256,originalName:upload.originalName,contentType:upload.mediaType,byteLength:upload.size,status:"available",createdAt:"2026-09-27T12:00:00Z"};
 await repository.atomicWrite([{sql:"UPDATE ops_inspections SET work_order_id = ?, master_documents_json = ? WHERE organization_id = ? AND id = ?",params:[NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,JSON.stringify([file]),org,"inspection-compliance-demo-extinguisher-2026-09-24"]}]);
 expect(await resolveInspectionMasterFiles(PUBLIC_DEMO_LINKS.serviceToken)).toEqual([file]);
 expect(await resolveInspectionMasterFiles("invalid-token".repeat(4))).toEqual([]);
 const request=new Request("http://localhost:3000/api/ops-public/service/files");
 const allowed=await GET(request,{params:Promise.resolve({token:PUBLIC_DEMO_LINKS.serviceToken,fileId:file.id})});
 expect(allowed.status).toBe(200);expect(await allowed.text()).toBe("Blank checklist");expect(allowed.headers.get("content-disposition")).toContain("attachment;");
 expect((await GET(request,{params:Promise.resolve({token:PUBLIC_DEMO_LINKS.serviceToken,fileId:"completed-evidence"})})).status).toBe(404);
 expect((await GET(request,{params:Promise.resolve({token:"invalid-token".repeat(4),fileId:file.id})})).status).toBe(404);
});
