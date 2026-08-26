import {
  completeFollowUp,
  OpsDomainError,
  reconcileUnmatchedVisit,
  rescheduleFollowUp,
  reviewException,
} from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import type { OpsException } from "@/lib/ops/types";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

async function assertExceptionInScope(
  context: Awaited<ReturnType<typeof getOpsRequestContext>>,
  exception: OpsException,
) {
  let storeId = exception.storeId;
  if (!storeId && exception.visitId) {
    storeId = (await context.repository.getVisit(context.session.organizationId, exception.visitId))?.storeId;
  }
  if (!storeId && exception.workOrderId) {
    storeId = (await context.repository.getWorkOrder(context.session.organizationId, exception.workOrderId))?.storeId;
  }
  if (storeId) return assertStoreInSessionScope(context.session, storeId);
  if (context.session.storeIds?.length || context.session.regionIds?.length) {
    throw new OpsDomainError("FORBIDDEN", "This review item's location is outside your assigned operating scope.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: itemId } = await params;
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    const exception = await context.repository.getException(context.session.organizationId, itemId);

    if (exception) {
      await assertExceptionInScope(context, exception);
      if (operation === "reconcile") {
        const workOrderId = formText(formData, "workOrderId", { required: true, max: 120 });
        const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
        if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Selected work order was not found in your organization.");
        await assertStoreInSessionScope(context.session, workOrder.storeId);
        await reconcileUnmatchedVisit(
          { repository: context.repository },
          {
            organizationId: context.session.organizationId,
            exceptionId: itemId,
            workOrderId,
            note: formText(formData, "note", { required: true, max: 2_000 }),
            actor: context.actor,
          },
        );
      } else if (operation === "acknowledge" || operation === "resolve" || operation === "resolve_non_work_service") {
        if (operation === "resolve_non_work_service" && exception.kind !== "no_work_order") {
          throw new OpsDomainError("VALIDATION", "Only an unmatched visit can be classified as non-work service.");
        }
        const note = formText(formData, "note", { required: true, max: 2_000 });
        await reviewException(
          { repository: context.repository },
          {
            organizationId: context.session.organizationId,
            exceptionId: itemId,
            decision: operation === "acknowledge" ? "acknowledge" : "resolve",
            note: operation === "resolve_non_work_service" ? `Classified as authorized non-work service: ${note}` : note,
            actor: context.actor,
          },
        );
      } else {
        throw new OpsDomainError("VALIDATION", "Choose a supported exception-review action.");
      }
    } else {
      const followUp = await context.repository.getFollowUp(context.session.organizationId, itemId);
      if (!followUp) throw new OpsDomainError("NOT_FOUND", "Attention item was not found in your organization.");
      const workOrder = await context.repository.getWorkOrder(context.session.organizationId, followUp.workOrderId);
      if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Linked work order was not found in your organization.");
      await assertStoreInSessionScope(context.session, workOrder.storeId);

      if (operation === "update") {
        const [store, organization] = await Promise.all([
          context.repository.getStore(context.session.organizationId, workOrder.storeId),
          context.repository.getOrganization(context.session.organizationId),
        ]);
        const dueAt = localDateTimeToIso(
          formText(formData, "dueAt", { required: true, max: 40 }),
          store?.timeZone ?? organization?.timeZone ?? "UTC",
        );
        await rescheduleFollowUp(
          { repository: context.repository },
          {
            organizationId: context.session.organizationId,
            followUpId: itemId,
            accountableParty: formText(formData, "accountableParty", { required: true, max: 200 }),
            nextAction: formText(formData, "nextAction", { required: true, max: 500 }),
            dueAt,
            escalationTo: formText(formData, "escalationTo", { required: true, max: 200 }),
            note: formText(formData, "note", { required: true, max: 2_000 }),
            actor: context.actor,
          },
        );
      } else if (operation === "complete") {
        await completeFollowUp(
          { repository: context.repository },
          {
            organizationId: context.session.organizationId,
            followUpId: itemId,
            resolution: formText(formData, "resolution", { required: true, max: 2_000 }),
            actor: context.actor,
          },
        );
      } else {
        throw new OpsDomainError("VALIDATION", "Choose a supported follow-up action.");
      }
    }

    return relativeRedirect303(
      `/app/action-center/${encodeURIComponent(itemId)}?updated=${encodeURIComponent(operation)}#attention-control-heading`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
