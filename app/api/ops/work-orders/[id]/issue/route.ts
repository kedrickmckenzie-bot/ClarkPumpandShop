import { OpsDomainError } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { issueWorkOrderToVendor } from "@/lib/server/work-order-issuance";

const channels = new Set(["email", "sms", "print", "manual"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const formData = await request.formData();
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    if (["closed", "cancelled", "completed_pending_review", "resolved"].includes(workOrder.status)) {
      throw new OpsDomainError("CONFLICT", "Closed or completed work cannot be issued again.");
    }

    const vendorId = formText(formData, "vendorId", { required: true, max: 120 });
    const channel = formText(formData, "channel", { required: true, max: 20 });
    if (!channels.has(channel)) throw new OpsDomainError("VALIDATION", "Choose a supported delivery method.");
    const expectedRevisionText = formText(formData, "expectedRevision", { required: true, max: 12 });
    const expectedRevision = Number(expectedRevisionText);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new OpsDomainError("VALIDATION", "Expected issuance revision is invalid.");
    }

    const result = await issueWorkOrderToVendor({
      repository: context.repository,
      organizationId: context.session.organizationId,
      organizationName: context.session.organizationName,
      workOrderId: workOrder.id,
      vendorId,
      expectedRevision,
      channel: channel as "email" | "sms" | "print" | "manual",
      message: formText(formData, "message", { max: 1_000 }) || undefined,
      actor: context.actor,
    });
    return channel === "email"
      ? relativeRedirect303(`/app/work-orders/${encodeURIComponent(workOrder.id)}?view=service&notice=${encodeURIComponent(result.notice)}`)
      : relativeRedirect303(result.publicPath);
  } catch (error) {
    return opsApiError(error);
  }
}
