import { createBulkFollowUps, OpsDomainError } from "@/lib/ops/commands";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function safeReturnTo(value: string) {
  return value.startsWith("/app/work-orders") && !value.startsWith("//") ? value : "/app/work-orders";
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const formData = await request.formData();
    const workOrderIds = formData.getAll("workOrderId").map(String);
    if (!workOrderIds.length) throw new OpsDomainError("VALIDATION", "Select at least one work order before adding a follow-up.");
    for (const workOrderId of workOrderIds) {
      const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
      if (!workOrder) throw new OpsDomainError("FORBIDDEN", "One or more selected work orders are outside your current scope.");
      await assertStoreInSessionScope(context.session, workOrder.storeId);
    }
    const organization = await context.repository.getOrganization(context.session.organizationId);
    const result = await createBulkFollowUps(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderIds,
        accountableParty: "Facilities coordinator",
        nextAction: formText(formData, "nextAction", { required: true, max: 240 }),
        dueAt: localDateTimeToIso(formText(formData, "dueAt", { required: true, max: 40 }), organization?.timeZone ?? "UTC"),
        escalationTo: "Facilities director",
        actor: context.actor,
      },
    );
    const destination = safeReturnTo(formText(formData, "returnTo", { max: 1_000 }));
    return relativeRedirect303(`${destination}${destination.includes("?") ? "&" : "?"}notice=${encodeURIComponent(`${result.count} follow-up${result.count === 1 ? "" : "s"} added`)}`);
  } catch (error) {
    return opsApiError(error);
  }
}
