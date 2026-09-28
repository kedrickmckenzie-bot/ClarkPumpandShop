import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { OpsDomainError } from "@/lib/ops/errors";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { session, repository } = await getOpsRequestContext(["facilities", "regional", "store_manager", "executive", "finance"], undefined, request);
    const { id, fileId } = await params;
    const work = await repository.getWorkOrder(session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found");
    await assertStoreInSessionScope(session, work.storeId);
    const files = await repository.listFilesForEntity(session.organizationId, "work_order", id);
    return quoteFileResponse(files.find(file => file.id === fileId) ?? null, request);
  } catch (error) { return opsApiError(error); }
}
