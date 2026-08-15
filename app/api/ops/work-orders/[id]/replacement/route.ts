import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { approveReplacementFromSelectedQuote } from "@/lib/ops/replacement-commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError, optionalIsoDate, optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function requiredMoney(formData: FormData, field: string, label: string) { const value = optionalMoneyMinor(formText(formData, field, { max: 20 })); if (value === undefined) throw new OpsDomainError("VALIDATION", `${label} is required.`); return value; }
function success(request: Request, redirectTo: string) { return request.headers.get("x-traceops-client") === "replacement-intelligence" ? NextResponse.json({ ok: true, redirectTo }) : relativeRedirect303(redirectTo); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, id);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const effectiveAt = optionalIsoDate(formText(formData, "effectiveAt", { max: 40 }));
    if (!effectiveAt) throw new OpsDomainError("VALIDATION", "Quote effective date is required.");
    const planningApplication = formText(formData, "planningApplication", { required: true, max: 30 });
    if (planningApplication !== "asset_only" && planningApplication !== "planning_group") throw new OpsDomainError("VALIDATION", "Choose where this planning reference should apply.");
    await approveReplacementFromSelectedQuote({ repository: context.repository }, { organizationId: context.session.organizationId, workOrderId: workOrder.id, profileId: formText(formData, "profileId", { required: true, max: 120 }), equipmentAmountMinor: requiredMoney(formData, "equipmentAmount", "Equipment amount"), installationAmountMinor: requiredMoney(formData, "installationAmount", "Installation amount"), otherAmountMinor: requiredMoney(formData, "otherAmount", "Other amount"), currency: "USD", effectiveAt, planningApplication, notes: formText(formData, "notes", { max: 2_000 }) || undefined, actor: context.actor });
    return success(request, `/app/work-orders/${encodeURIComponent(workOrder.id)}?updated=replacement-approved#replacement-intelligence`);
  } catch (error) { return opsApiError(error); }
}
