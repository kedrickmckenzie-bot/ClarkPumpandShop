import {isWorkspaceOrigin} from "@/lib/server/request-origin";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {resolveInspectionLink} from "@/lib/ops/inspection-access";
import {recordInspectionResult} from "@/lib/ops/compliance";
import {uploadInspectionFiles} from "@/lib/server/inspection-uploads";
import {formText,opsApiError} from "@/lib/server/ops-request-context";
import {OpsDomainError} from "@/lib/ops/errors";
import {isFictionalPreview} from "@/lib/server/operator-access";
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}) {try{
 if(!isWorkspaceOrigin(request))throw new OpsDomainError("FORBIDDEN","Open the inspection link before submitting.");
 if(Number(request.headers.get("content-length"))>9*1024*1024)throw new OpsDomainError("VALIDATION","Attach up to 8 MB of files.");
 const r=await getServerOpsRepository(),{token}=await params,c=await resolveInspectionLink(r,token),form=await request.formData();
 const status=formText(form,"status");if(!["performed","action_needed"].includes(status))throw new OpsDomainError("FORBIDDEN","Submit the result for maintenance review.");
 if(c.inspection.status==="passed"||c.inspection.version!==Number(form.get("version")))throw new OpsDomainError("CONFLICT","This inspection changed. Refresh the link before submitting.");
 const files=await uploadInspectionFiles(form,"attachments",c.inspection.organizationId,c.inspection.id,isFictionalPreview());
 await recordInspectionResult({repository:r},{organizationId:c.inspection.organizationId,inspectionId:c.inspection.id,version:c.inspection.version,status:status as "performed"|"action_needed",note:formText(form,"note",{required:true,max:4000}),performedDate:formText(form,"performedDate",{required:true,max:10}),documentExpiresOn:formText(form,"documentExpiresOn",{max:10})||undefined,files},c.assignee.actor);
 return Response.json({saved:true},{headers:{"cache-control":"no-store"}});
 }catch(error){return opsApiError(error);}}
