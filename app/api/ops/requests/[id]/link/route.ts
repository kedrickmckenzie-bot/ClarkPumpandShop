import { linkServiceRequestToWorkOrder, OpsDomainError } from "@/lib/ops/commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const { id: requestId } = await params;
    const serviceRequest = await context.repository.getRequest(context.session.organizationId, requestId);
    if (!serviceRequest) throw new OpsDomainError("NOT_FOUND", "Service request was not found in your organization.");
    await assertStoreInSessionScope(context.session, serviceRequest.storeId);
    const formData = await request.formData();
    const expectedStatus = formText(formData, "expectedStatus", { required: true, max: 30 });
    if (expectedStatus !== "under_review") throw new OpsDomainError("VALIDATION", "Confirm the report before linking it.");
    const workOrderId = formText(formData, "workOrderId", { required: true, max: 160 });
    await linkServiceRequestToWorkOrder({ repository: context.repository }, {
      organizationId: context.session.organizationId,
      requestId,
      workOrderId,
      expectedStatus,
      actor: context.actor,
    });
    return relativeRedirect303(`/app/requests/${encodeURIComponent(requestId)}?updated=linked-existing-work`);
  } catch (error) {
    return opsApiError(error);
  }
}
