import { masterDocuments } from "@/lib/ops/compliance-documents";
import { getOpsRequestContext,assertStoreInSessionScope,opsApiError } from "@/lib/server/ops-request-context";
import { OpsDomainError } from "@/lib/ops/commands";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(request:Request,{params}:{params:Promise<{id:string;fileId:string}>}) {
 try{const {session,repository}=await getOpsRequestContext(["facilities","regional","store_manager","executive","finance"]);const {id,fileId}=await params;const i=await repository.getInspection(session.organizationId,id);if(!i)throw new OpsDomainError("NOT_FOUND","Inspection not found");await assertStoreInSessionScope(session,i.storeId);const files=i.workOrderId?await repository.listFilesForEntity(session.organizationId,"work_order",i.workOrderId):[];const schedule=new URL(request.url).searchParams.get("source")==="schedule"?await repository.getComplianceSchedule(session.organizationId,i.scheduleId):null;return quoteFileResponse((schedule?masterDocuments(schedule):[...files,...masterDocuments(i)]).find(f=>f.id===fileId)??null,request);}catch(error){return opsApiError(error);}
}
