import { OpsDomainError } from "@/lib/ops/commands";
import { reviewRequestImpactAssessment } from "@/lib/ops/request-impact-assessment";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { parseRequestImpactForm } from "@/lib/server/request-impact-form";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const requestStatuses = new Set(["submitted", "under_review"]);
const dispositions = new Set(["confirmed", "revised"]);

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
    const expectedRequestStatus = formText(formData, "expectedRequestStatus", { required: true, max: 30 });
    const disposition = formText(formData, "disposition", { required: true, max: 20 });
    if (!requestStatuses.has(expectedRequestStatus) || !dispositions.has(disposition)) {
      throw new OpsDomainError("VALIDATION", "Choose a valid impact-review action.");
    }
    const assessment = parseRequestImpactForm(formData, { source: "manager_review", required: true });
    if (!assessment) throw new OpsDomainError("VALIDATION", "Complete the business-impact review.");

    await reviewRequestImpactAssessment(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        requestId,
        expectedRequestStatus: expectedRequestStatus as "submitted" | "under_review",
        expectedLatestAssessmentId: formText(formData, "expectedLatestAssessmentId", { max: 120 }) || undefined,
        disposition: disposition as "confirmed" | "revised",
        assessment,
        actor: context.actor,
      },
    );

    const continueTo = formText(formData, "continueTo", { max: 300 });
    const workOrderHref = `/app/work-orders/new?request=${encodeURIComponent(requestId)}`;
    return relativeRedirect303(continueTo === workOrderHref
      ? workOrderHref
      : `/app/requests/${encodeURIComponent(requestId)}?updated=impact-review`);
  } catch (error) {
    return opsApiError(error);
  }
}
