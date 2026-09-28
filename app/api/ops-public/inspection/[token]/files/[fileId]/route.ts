import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {resolveInspectionLink,inspectionSubmissionFiles} from "@/lib/ops/inspection-access";
import {masterDocuments} from "@/lib/ops/compliance-documents";
import {quoteFileResponse} from "@/lib/server/quote-file-response";
import {opsApiError} from "@/lib/server/ops-request-context";
export async function GET(request:Request,{params}:{params:Promise<{token:string;fileId:string}>}) {try{
 const {token,fileId}=await params,r=await getServerOpsRepository(),c=await resolveInspectionLink(r,token);
 const evidence=await inspectionSubmissionFiles(r,c.inspection.organizationId,c.inspection.id,c.work.id);
 return quoteFileResponse([...masterDocuments(c.inspection),...evidence].find(f=>f.id===fileId)??null,request);
 }catch(error){return opsApiError(error);}}
