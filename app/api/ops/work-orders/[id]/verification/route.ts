import { OpsDomainError } from "@/lib/ops/errors";
import {
  recordWorkOrderVerification,
  type WorkOrderVerificationDecision,
} from "@/lib/ops/work-order-verification-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const decisions = new Set<WorkOrderVerificationDecision>(["verified", "rejected"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const { id: workOrderId } = await params;
    const organizationId = context.session.organizationId;
    const workOrder = await context.repository.getWorkOrder(organizationId, workOrderId);
    if (!workOrder) {
      throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    }
    await assertStoreInSessionScope(context.session, workOrder.storeId);

    const formData = await request.formData();
    const decision = formText(formData, "decision", { required: true, max: 20 });
    if (!decisions.has(decision as WorkOrderVerificationDecision)) {
      throw new OpsDomainError("VALIDATION", "Choose verify or reject.");
    }
    const expectedWorkOrderVersion = Number(
      formText(formData, "expectedWorkOrderVersion", { required: true, max: 20 }),
    );
    const expectedOutcomeRecordedAt = optionalIsoDate(
      formText(formData, "expectedOutcomeRecordedAt", { required: true, max: 40 }),
    );
    if (!expectedOutcomeRecordedAt) {
      throw new OpsDomainError("VALIDATION", "Expected outcome time is required.");
    }

    await recordWorkOrderVerification(
      { repository: context.repository },
      {
        organizationId,
        workOrderId: workOrder.id,
        expectedWorkOrderVersion,
        expectedSiteVisitWorkOrderId: formText(
          formData,
          "expectedSiteVisitWorkOrderId",
          { required: true, max: 120 },
        ),
        expectedOutcomeRecordedAt,
        decision: decision as WorkOrderVerificationDecision,
        reason: formText(formData, "reason", { max: 2_000 }) || undefined,
        actor: context.actor,
      },
    );

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=visits&updated=verification-${decision}#work-verification`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
