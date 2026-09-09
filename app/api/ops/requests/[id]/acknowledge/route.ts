import { acknowledgeServiceRequest, OpsDomainError } from "@/lib/ops/commands";
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
    const expectedStatus = formText(formData, "expectedStatus", { required: true, max: 30 });
    if (expectedStatus !== "submitted" && expectedStatus !== "under_review") throw new OpsDomainError("VALIDATION", "Refresh before acknowledging this request.");
    await acknowledgeServiceRequest({ repository: context.repository }, { organizationId: context.session.organizationId, requestId, expectedStatus, actor: context.actor });
    return relativeRedirect303(`/app/requests/${encodeURIComponent(requestId)}?updated=request-acknowledged`);
  } catch (error) {
    return opsApiError(error);
  }
}
