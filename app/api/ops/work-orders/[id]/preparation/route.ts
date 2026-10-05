import { updateJobPreparation } from "@/lib/ops/job-preparation";
import { getOpsRequestContext, assertStoreInSessionScope, formText, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { OpsDomainError } from "@/lib/ops/errors";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  const c=await getOpsRequestContext(["facilities","regional","technician"],undefined,request),{id}=await params;
  const work=await c.repository.getWorkOrder(c.session.organizationId,id);if(!work)throw new OpsDomainError("NOT_FOUND","Job not found.");
  await assertStoreInSessionScope(c.session,work.storeId);
  const form=await request.formData(),text=(name:string,max=3000)=>formText(form,name,{max});
  const result=await updateJobPreparation({repository:c.repository},{organizationId:work.organizationId,workOrderId:id,actor:c.actor,expectedVersion:Number(text("expectedVersion",16)),shortName:form.has("shortName")?text("shortName",40):undefined,technicianNotes:form.has("technicianNotes")?text("technicianNotes"):work.technicianNotes,estimatedMinutes:form.has("estimatedMinutes")?(text("estimatedMinutes",10)?Number(text("estimatedMinutes",10)):undefined):work.estimatedMinutes,confirmationDelay:c.session.role==="technician"?work.confirmationDelay:text("confirmationDelay",30) as "next_morning"|"four_hours"||undefined,remainingMinutes:text("remainingMinutes",10)?Number(text("remainingMinutes",10)):undefined});
  if(request.headers.get("accept")?.includes("application/json"))return Response.json({saved:true,...result});
  return relativeRedirect303(`/app/my-work/${encodeURIComponent(id)}?saved=1`);
}catch(error){return opsApiError(error);}}
