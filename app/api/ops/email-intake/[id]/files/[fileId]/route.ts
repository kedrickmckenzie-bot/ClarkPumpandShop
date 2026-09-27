import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
import { OpsDomainError } from "@/lib/ops/commands";
export async function GET(_request: Request,{params}:{params:Promise<{id:string;fileId:string}>}) {
  try {
    const {repository,session} = await getOpsRequestContext(["facilities","executive","regional","store_manager","finance"]);
    const {id,fileId} = await params;
    const email = await repository.getInboundEmail(session.organizationId,id);
    if (!email) throw new OpsDomainError("NOT_FOUND","Email not found");
    if (email.workOrderId) {
      const work = await repository.getWorkOrder(session.organizationId,email.workOrderId);
      if (!work) throw new OpsDomainError("NOT_FOUND","Work order not found");
      await assertStoreInSessionScope(session,work.storeId);
    } else if (session.role !== "facilities" || session.storeIds !== undefined || session.regionIds !== undefined) throw new OpsDomainError("FORBIDDEN","Companywide inbox access is required.");
    return quoteFileResponse((await repository.listFilesForEntity(session.organizationId,"inbound_email",id)).find(file => file.id === fileId) ?? null);
  } catch (error) { return opsApiError(error); }
}
