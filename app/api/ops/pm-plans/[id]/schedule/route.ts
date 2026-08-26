import { OpsDomainError } from "@/lib/ops/commands";
import { overridePmPlanCadence } from "@/lib/ops/setup-commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function wholeNumber(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new OpsDomainError("VALIDATION", `${label} must be a whole number.`);
  return number;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager"]);
    const { id } = await params;
    const plan = await context.repository.getPmPlan(context.session.organizationId, id);
    if (!plan) throw new OpsDomainError("NOT_FOUND", "PM plan was not found in this organization.");
    if (!plan.storeId) throw new OpsDomainError("VALIDATION", "This PM plan is not assigned to a store.");
    await assertStoreInSessionScope(context.session, plan.storeId);
    const formData = await request.formData();
    await overridePmPlanCadence(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        planId: plan.id,
        cadenceDays: wholeNumber(formText(formData, "cadenceDays", { required: true, max: 5 }), "Cadence"),
        completionWindowDays: wholeNumber(formText(formData, "completionWindowDays", { required: true, max: 4 }), "Completion window"),
        reason: formText(formData, "reason", { required: true, max: 500 }),
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/pm?store=${encodeURIComponent(plan.storeId)}&scheduleUpdated=true`);
  } catch (error) {
    return opsApiError(error);
  }
}
