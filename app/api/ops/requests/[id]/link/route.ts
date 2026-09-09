import { linkServiceRequestToWorkOrder, OpsDomainError } from "@/lib/ops/commands";
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
    if (!["submitted", "under_review", "acknowledged"].includes(expectedStatus)) throw new OpsDomainError("VALIDATION", "Refresh before linking this report.");
    const workOrderId = formText(formData, "workOrderId", { required: true, max: 160 });
    await linkServiceRequestToWorkOrder({ repository: context.repository }, {
      organizationId: context.session.organizationId,
      requestId,
      workOrderId,
      expectedStatus: expectedStatus as "submitted" | "under_review" | "acknowledged",
      correctionReason: formText(formData, "correctionReason", { max: 1_000 }) || undefined,
      actor: context.actor,
    });
    const returnTo = formText(formData, "returnTo", { max: 500 });
    const allowedPrefix = `/app/requests/${encodeURIComponent(requestId)}`;
    const destination = returnTo.startsWith(allowedPrefix) && !returnTo.startsWith("//") ? returnTo : allowedPrefix;
    const parsed = new URL(destination, "https://operations.invalid");
    parsed.searchParams.set("updated", serviceRequest.linkedWorkOrderId ? "request-link-corrected" : "linked-existing-work");
    return relativeRedirect303(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch (error) {
    return opsApiError(error);
  }
}
