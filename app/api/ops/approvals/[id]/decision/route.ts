import { recordApprovalDecision } from "@/lib/ops/approval-governance";
import { OpsDomainError } from "@/lib/ops/commands";
import type { ApprovalDecisionKind } from "@/lib/ops/types";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const operatorRoles = ["executive", "facilities", "regional", "store_manager", "finance"] as const;
const operatorDecisions = new Set<ApprovalDecisionKind>(["approved", "rejected", "escalated"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(operatorRoles);
    const membershipId = context.session.membershipId;
    if (!membershipId) {
      throw new OpsDomainError("FORBIDDEN", "An active preview membership is required to record an approval decision.");
    }

    const { id: approvalRequestId } = await params;
    const organizationId = context.session.organizationId;
    const approvalRequest = await context.repository.getApprovalRequest(organizationId, approvalRequestId);
    if (!approvalRequest) {
      throw new OpsDomainError("NOT_FOUND", "Approval request was not found in your organization.");
    }
    await assertStoreInSessionScope(context.session, approvalRequest.storeId);

    const formData = await request.formData();
    const decision = formText(formData, "decision", { required: true, max: 20 });
    if (!operatorDecisions.has(decision as ApprovalDecisionKind)) {
      throw new OpsDomainError("VALIDATION", "Choose approve, reject, or escalate.");
    }

    await recordApprovalDecision(
      { repository: context.repository },
      {
        organizationId,
        approvalRequestId: approvalRequest.id,
        decision: decision as ApprovalDecisionKind,
        deciderMembershipId: membershipId,
        reason: formText(formData, "reason", { max: 2_000 }) || undefined,
        actor: context.actor,
      },
    );

    const subjectPath = approvalRequest.subjectType === "work_order"
      ? `/app/work-orders/${encodeURIComponent(approvalRequest.subjectId)}`
      : `/app/requests/${encodeURIComponent(approvalRequest.subjectId)}`;
    const anchor = approvalRequest.subjectType === "work_order" ? "work-control" : "approval-governance";
    return relativeRedirect303(`${subjectPath}?view=activity&updated=approval-${decision}#${anchor}`);
  } catch (error) {
    return opsApiError(error);
  }
}
