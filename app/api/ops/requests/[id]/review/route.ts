import { OpsDomainError, reviewServiceRequest } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const reviewStatuses = new Set(["submitted", "under_review"]);
const reviewDecisions = new Set(["escalate", "close"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const { id: requestId } = await params;
    const serviceRequest = await context.repository.getRequest(context.session.organizationId, requestId);
    if (!serviceRequest) throw new OpsDomainError("NOT_FOUND", "Service request was not found in your organization.");
    await assertStoreInSessionScope(context.session, serviceRequest.storeId);

    const formData = await request.formData();
    const expectedStatus = formText(formData, "expectedStatus", { required: true, max: 30 });
    const decision = formText(formData, "decision", { required: true, max: 30 });
    if (!reviewStatuses.has(expectedStatus) || !reviewDecisions.has(decision)) {
      throw new OpsDomainError("VALIDATION", "Choose a valid request-review decision.");
    }

    await reviewServiceRequest(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        requestId,
        expectedStatus: expectedStatus as "submitted" | "under_review",
        decision: decision as "escalate" | "close",
        note: formText(formData, "note", { max: 2_000 }) || undefined,
        actor: context.actor,
      },
    );

    return relativeRedirect303(`/app/requests/${encodeURIComponent(requestId)}?updated=review`);
  } catch (error) {
    return opsApiError(error);
  }
}
