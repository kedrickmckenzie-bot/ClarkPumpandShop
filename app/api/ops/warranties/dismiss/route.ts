import { getOpsRequestContext, opsApiError, formText, assertStoreInSessionScope } from "@/lib/server/ops-request-context";
import { dismissWorkWarranty } from "@/lib/ops/warranty-commands";
import { OpsDomainError } from "@/lib/ops/errors";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request) {
  try {
    const {session,repository,actor}=await getOpsRequestContext(["executive","facilities","regional"],undefined,request);
    const form=await request.formData(), workId=formText(form,"workId",{required:true,max:200});
    const work=await repository.getWorkOrder(session.organizationId,workId);
    if(!work) throw new OpsDomainError("NOT_FOUND","Work order not found");
    await assertStoreInSessionScope(session,work.storeId);
    await dismissWorkWarranty({organizationId:session.organizationId,workId,actor,reason:formText(form,"reason",{required:true,max:2000}),signature:formText(form,"signature",{required:true,max:50000})},{repository});
    return relativeRedirect303(`/app/work-orders/${encodeURIComponent(workId)}?notice=${encodeURIComponent("Warranty decision saved.")}`);
  } catch(error) { return opsApiError(error); }
}
