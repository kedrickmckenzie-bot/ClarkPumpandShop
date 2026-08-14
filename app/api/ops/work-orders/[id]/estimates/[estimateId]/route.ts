import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { reopenEstimateSelection, selectEstimate, withdrawEstimate } from "@/lib/ops/estimate-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function decisionSuccess(request: Request, redirectTo: string) {
  if (request.headers.get("x-traceops-client") === "estimate-comparison") {
    return NextResponse.json({ ok: true, redirectTo });
  }
  return relativeRedirect303(redirectTo);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; estimateId: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId, estimateId } = await params;
    const [workOrder, estimateRequest] = await Promise.all([
      context.repository.getWorkOrder(context.session.organizationId, workOrderId),
      context.repository.getEstimateRequest(context.session.organizationId, estimateId),
    ]);
    if (!workOrder || !estimateRequest || estimateRequest.workOrderId !== workOrder.id) {
      throw new OpsDomainError("NOT_FOUND", "Bid request was not found on this work order.");
    }
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 20 });
    if (operation === "reopen") {
      const expectedRevision = Number(formText(formData, "expectedRevision", { required: true, max: 12 }));
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
        throw new OpsDomainError("VALIDATION", "Bid revision is invalid.");
      }
      await reopenEstimateSelection(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          estimateRequestId: estimateRequest.id,
          expectedRevision,
          note: formText(formData, "note", { required: true, max: 2_000 }),
          actor: context.actor,
        },
      );
      return decisionSuccess(
        request,
        `/app/work-orders/${encodeURIComponent(workOrder.id)}?updated=estimate-reopened#bid-requests`,
      );
    }
    if (operation === "withdraw") {
      const expectedRevision = Number(formText(formData, "expectedRevision", { required: true, max: 12 }));
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new OpsDomainError("VALIDATION", "Bid revision is invalid.");
      }
      await withdrawEstimate(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          estimateRequestId: estimateRequest.id,
          expectedRevision,
          note: formText(formData, "note", { required: true, max: 2_000 }),
          actor: context.actor,
        },
      );
      return decisionSuccess(
        request,
        `/app/work-orders/${encodeURIComponent(workOrder.id)}?updated=estimate-withdrawn#bid-requests`,
      );
    }
    if (operation !== "select") throw new OpsDomainError("VALIDATION", "Choose a supported bid decision.");
    const expectedRevision = Number(formText(formData, "expectedRevision", { required: true, max: 12 }));
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      throw new OpsDomainError("VALIDATION", "Bid revision is invalid.");
    }
    await selectEstimate(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        estimateRequestId: estimateRequest.id,
        proposalId: formText(formData, "proposalId", { required: true, max: 120 }),
        expectedRevision,
        note: formText(formData, "note", { required: true, max: 2_000 }),
        actor: context.actor,
      },
    );
    return decisionSuccess(
      request,
      `/app/work-orders/${encodeURIComponent(workOrder.id)}?updated=estimate-selected#bid-requests`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
