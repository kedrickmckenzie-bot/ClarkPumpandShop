import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { createSentWorkLink } from "@/lib/ops/sent-work-orders";
import { OpsDomainError } from "@/lib/ops/errors";
export async function POST(request: Request, {params}:{params:Promise<{id:string;issuanceId:string}>}) {
  try {
    const context = await getOpsRequestContext(["facilities","regional"], "issue_work_order", request);
    const {id,issuanceId} = await params;
    const work = await context.repository.getWorkOrder(context.session.organizationId,id);
    if (!work) throw new OpsDomainError("NOT_FOUND","Work order not found.");
    await assertStoreInSessionScope(context.session, work.storeId);
    const result = await createSentWorkLink({repository:context.repository},{organizationId:context.session.organizationId,workOrderId:id,issuanceId,actor:context.actor});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return opsApiError(error);}
}
