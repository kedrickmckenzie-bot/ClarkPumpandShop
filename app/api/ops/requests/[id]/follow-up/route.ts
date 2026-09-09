import { OpsDomainError, requestAcknowledgedServiceRequestFollowUp } from "@/lib/ops/commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "review_request");
    const { id: requestId } = await params;
    const serviceRequest = await context.repository.getRequest(context.session.organizationId, requestId);
    if (!serviceRequest) throw new OpsDomainError("NOT_FOUND", "Service request was not found in your organization.");
    await assertStoreInSessionScope(context.session, serviceRequest.storeId);
    const formData = await request.formData();
    await requestAcknowledgedServiceRequestFollowUp({ repository: context.repository }, {
      organizationId: context.session.organizationId, requestId,
      explanation: formText(formData, "explanation", { required: true, max: 1_000 }), actor: context.actor,
    });
    return relativeRedirect303(`/app/requests/${encodeURIComponent(requestId)}?updated=request-follow-up`);
  } catch (error) {
    return opsApiError(error);
  }
}
