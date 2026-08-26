import { createFollowUp, OpsDomainError } from "@/lib/ops/commands";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const organizationId = context.session.organizationId;
    const workOrder = await context.repository.getWorkOrder(organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const [store, organization] = await Promise.all([
      context.repository.getStore(organizationId, workOrder.storeId),
      context.repository.getOrganization(organizationId),
    ]);
    const formData = await request.formData();
    const dueAt = localDateTimeToIso(
      formText(formData, "dueAt", { required: true, max: 40 }),
      store?.timeZone ?? organization?.timeZone ?? "UTC",
    );
    await createFollowUp({ repository: context.repository }, {
      organizationId,
      workOrderId,
      accountableParty: formText(formData, "accountableParty", { required: true, max: 200 }),
      nextAction: formText(formData, "nextAction", { required: true, max: 500 }),
      dueAt,
      escalationTo: formText(formData, "escalationTo", { required: true, max: 200 }),
      promoteToPrimary: false,
      actor: context.actor,
    });
    return relativeRedirect303(`/app/work-orders/${encodeURIComponent(workOrderId)}?view=activity&notice=Follow-up+added#follow-up-control`);
  } catch (error) {
    return opsApiError(error);
  }
}
