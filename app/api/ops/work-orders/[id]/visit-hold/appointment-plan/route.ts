import { OpsDomainError, planHeldWorkForConfirmedAppointment } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function safeReturnTo(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/work-orders?visitPlan=ready";
  const target = new URL(value, "https://operations.invalid");
  if (target.pathname !== "/app/work-orders") return "/app/work-orders?visitPlan=ready";
  return `${target.pathname}${target.search}${target.hash}`;
}

function withNotice(destination: string, notice: string) {
  const target = new URL(destination, "https://operations.invalid");
  target.searchParams.set("notice", notice);
  return `${target.pathname}${target.search}${target.hash}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Approved work was not found.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const appointmentId = formText(formData, "appointmentId", { required: true, max: 160 });
    const expectedVersionText = formText(formData, "expectedHoldVersion", { required: true, max: 20 });
    const expectedHoldVersion = Number(expectedVersionText);
    if (!Number.isInteger(expectedHoldVersion) || expectedHoldVersion < 0) {
      throw new OpsDomainError("VALIDATION", "The approved-job version is invalid.");
    }
    const returnTo = safeReturnTo(formText(formData, "returnTo", { max: 1_000 }));
    const result = await planHeldWorkForConfirmedAppointment(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId,
        appointmentId,
        expectedHoldVersion,
        actor: context.actor,
      },
    );
    return relativeRedirect303(withNotice(
      returnTo,
      result.changed
        ? "This job is planned for vendor review at the confirmed visit. The technician still decides onsite whether to add it."
        : "This job is already planned for vendor review at that confirmed visit.",
    ));
  } catch (error) {
    return opsApiError(error);
  }
}
