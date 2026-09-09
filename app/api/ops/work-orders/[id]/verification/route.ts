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
import type { WorkOrderVerificationBasis, WorkOrderVerificationScope } from "@/lib/ops/types";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const decisions = new Set<WorkOrderVerificationDecision>(["verified", "rejected", "inconclusive"]);
const bases = new Set<WorkOrderVerificationBasis>(["observable_result", "technical_evidence", "operational_review"]);
const scopes = new Set<WorkOrderVerificationScope>(["reported_problem", "pm_task", "technical_work"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "confirm_observable_result");
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
      throw new OpsDomainError("VALIDATION", "Choose fixed, not fixed, or not sure.");
    }
    const basis = formText(formData, "basis", { required: true, max: 40 }) as WorkOrderVerificationBasis;
    const verificationScope = formText(formData, "verificationScope", { required: true, max: 40 }) as WorkOrderVerificationScope;
    if (!bases.has(basis) || !scopes.has(verificationScope)) throw new OpsDomainError("VALIDATION", "Confirmation context is invalid.");
    const expectedWorkOrderVersion = Number(
      formText(formData, "expectedWorkOrderVersion", { required: true, max: 20 }),
    );
    const expectedOutcomeRecordedAt = optionalIsoDate(
      formText(formData, "expectedOutcomeRecordedAt", { required: true, max: 40 }),
    );
    if (!expectedOutcomeRecordedAt) {
      throw new OpsDomainError("VALIDATION", "Expected outcome time is required.");
    }

    const result = await recordWorkOrderVerification(
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
        basis,
        verificationScope,
        avoidedSeparateTripConfirmed: formData.get("avoidedSeparateTripConfirmed") === "true",
        reason: formText(formData, "reason", { max: 2_000 }) || undefined,
        actor: context.actor,
      },
    );

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=visits&updated=${result.autoClosed ? "verified-and-closed" : `verification-${decision}`}#work-verification`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
