import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
import { OpsDomainError } from "@/lib/ops/commands";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; requestId: string; proposalId: string; fileId: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"]);
    const { id, requestId, proposalId, fileId } = await params;
    const organizationId = context.session.organizationId;
    const work = await context.repository.getWorkOrder(organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found");
    await assertStoreInSessionScope(context.session, work.storeId);
    const request = await context.repository.getEstimateRequest(organizationId, requestId);
    if (!request || request.workOrderId !== work.id) throw new OpsDomainError("NOT_FOUND", "Quote not found");
    const proposals = await context.repository.listEstimateProposalsForRequest(organizationId, requestId);
    if (!proposals.some((proposal) => proposal.id === proposalId && proposal.workOrderId === work.id)) throw new OpsDomainError("NOT_FOUND", "Quote version not found");
    return await quoteFileResponse((await context.repository.listFilesForEntity(organizationId, "estimate_proposal", proposalId)).find((file) => file.id === fileId) ?? null);
  } catch (error) { return opsApiError(error); }
}
