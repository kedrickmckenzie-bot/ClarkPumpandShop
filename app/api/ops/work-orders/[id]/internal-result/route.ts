import { dispatchIdentity, internalManagerRoles } from "@/lib/ops/internal-dispatch";
import { recordInternalWorkResult, markInternalWorkReady, internalResultRequestHash, handoffInternalWorkToVendor } from "@/lib/ops/internal-execution";
import { assertStoreInSessionScope, getOpsRequestContext, formText, opsApiError } from "@/lib/server/ops-request-context";
import { storeCompletionFiles, completionFileIntent } from "@/lib/server/work-completion-files";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import type { WorkResult } from "@/lib/ops/types";
import { OpsDomainError } from "@/lib/ops/errors";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params, form=await request.formData(), action=formText(form,"action",{required:true,max:20});
    if(!["result","problem","ready","vendor"].includes(action))throw new OpsDomainError("VALIDATION","Choose a job action.");
    const c=await getOpsRequestContext(["ready","vendor"].includes(action)?["facilities","regional"]:["technician","facilities","regional"],action==="vendor"?"assign_internal_work":undefined,request);
    const work=await c.repository.getWorkOrder(c.session.organizationId,id);if(!work)throw new OpsDomainError("NOT_FOUND","Job not found.");
    await assertStoreInSessionScope(c.session,work.storeId);
    const input={organizationId:c.session.organizationId,workOrderId:id,actor:c.actor,expectedVersion:Number(formText(form,"expectedVersion",{required:true,max:16})),expectedAssignmentId:formText(form,"expectedAssignmentId",{required:true,max:120}),key:formText(form,"submissionKey",{required:true,max:120}),notes:formText(form,"notes",{max:3000})||undefined};
    if(action==="vendor"){
      await handoffInternalWorkToVendor({repository:c.repository},{organizationId:input.organizationId,workOrderId:id,actor:input.actor,expectedVersion:input.expectedVersion,expectedAssignmentId:input.expectedAssignmentId,key:input.key,vendorId:formText(form,"vendorId",{required:true,max:120})});
      return relativeRedirect303(`/app/work-orders/${encodeURIComponent(id)}?view=service&path=direct#issue-work`);
    }
    else if(action==="ready")await markInternalWorkReady({repository:c.repository},input);
    else {
      const resultInput={...input,outcome:formText(form,"outcome",{required:true,max:40}) as WorkResult["outcome"],blocker:formText(form,"blocker",{max:30}) as WorkResult["blocker"]||undefined,source:formText(form,"source",{max:20}) as "phone"|"email"|"in_person"||undefined,performerName:formText(form,"performerName",{max:200})||undefined,exceptionReason:formText(form,"exceptionReason",{max:1000})||undefined};
      await dispatchIdentity(c.repository,c.session.organizationId,c.session.membershipId!,work.storeId,c.session.role === "technician"?["internal_technician"]:internalManagerRoles);
      const receipt=await c.repository.getIdempotencyKey(c.session.organizationId,`internal-result:${c.session.membershipId}:${input.key}`);
      if(receipt){if(receipt.requestHash!==await internalResultRequestHash({...resultInput,files:await completionFileIntent(form)}))throw new OpsDomainError("CONFLICT","This submission key was already used for different details.");}
      else await recordInternalWorkResult({repository:c.repository},{...resultInput,files:await storeCompletionFiles(form,c.session.organizationId,id,c.session.accessMode==="preview",input.key)});
    }
    return relativeRedirect303(`/app/my-work/${encodeURIComponent(id)}`);
  }catch(error){return opsApiError(error);}
}
