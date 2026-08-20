import { OpsDomainError } from "@/lib/ops/errors";
import { recordRepairAndApplyWarranty } from "@/lib/ops/warranty-commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError, optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const severities = new Set(["minor", "moderate", "major", "critical"]);
const kinds = new Set(["planned", "reactive"]);

function requiredMoney(form: FormData, name: string) {
  const value = optionalMoneyMinor(formText(form, name, { required: true, max: 24 }));
  if (value === undefined) throw new OpsDomainError("VALIDATION", `${name} is required`);
  return value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; componentId: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional"]);
    const { id: assetId, componentId } = await params;
    const [asset, component] = await Promise.all([
      context.repository.getAsset(context.session.organizationId, assetId),
      context.repository.getComponent(context.session.organizationId, componentId),
    ]);
    if (!asset || !component || component.assetId !== asset.id) throw new OpsDomainError("NOT_FOUND", "Component was not found on this Equipment record");
    await assertStoreInSessionScope(context.session, asset.storeId);

    const form = await request.formData();
    const siteVisitWorkOrderId = formText(form, "siteVisitWorkOrderId", { required: true, max: 180 });
    const visitWork = await context.repository.getSiteVisitWorkOrderById(context.session.organizationId, siteVisitWorkOrderId);
    const workOrder = visitWork ? await context.repository.getWorkOrder(context.session.organizationId, visitWork.workOrderId) : null;
    const visit = visitWork ? await context.repository.getVisit(context.session.organizationId, visitWork.visitId) : null;
    if (!visitWork || !workOrder || !visit || workOrder.assetId !== asset.id || !visit.vendorId) throw new OpsDomainError("CONFLICT", "Choose a verified outside-Vendor outcome for this Equipment record");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const replacementKind = formText(form, "replacementKind", { required: true });
    const repairSeverity = formText(form, "repairSeverity", { required: true });
    if (!kinds.has(replacementKind) || !severities.has(repairSeverity)) throw new OpsDomainError("VALIDATION", "Replacement kind or repair severity is invalid");
    const expectedLifeRaw = formText(form, "expectedLifeMonths", { max: 8 });
    const expectedLifeMonths = expectedLifeRaw ? Number(expectedLifeRaw) : undefined;
    const currency = formText(form, "currency", { required: true, max: 3 }).toUpperCase();
    const removedAt = formText(form, "removedAt", { required: true, max: 10 });
    const installedAt = formText(form, "installedAt", { required: true, max: 10 });

    const result = await recordRepairAndApplyWarranty({
      organizationId: context.session.organizationId,
      actor: context.actor,
      workOrderId: workOrder.id,
      siteVisitWorkOrderId: visitWork.id,
      vendorId: visit.vendorId,
      assetId: asset.id,
      componentId,
      failureCode: formText(form, "failureMode", { required: true, max: 240 }),
      repairAction: formText(form, "repairAction", { required: true, max: 2000 }),
      repairSeverity: repairSeverity as "minor" | "moderate" | "major" | "critical",
      removedComponentId: componentId,
      partManufacturer: formText(form, "partManufacturer", { required: true, max: 200 }),
      partModel: formText(form, "partModel", { required: true, max: 200 }),
      serialNumber: formText(form, "serialNumber", { max: 200 }) || undefined,
      vendorSupplied: formText(form, "vendorSupplied") === "yes",
      completionDate: installedAt,
      verificationDate: installedAt,
      laborCost: { amountMinor: requiredMoney(form, "laborCost"), currency },
      partCost: { amountMinor: requiredMoney(form, "partCost"), currency },
      rootCause: formText(form, "rootCause", { max: 1000 }) || undefined,
      componentType: component.name,
      componentReplacement: {
        installedComponentName: formText(form, "installedComponentName", { max: 200 }) || component.name,
        partNumber: formText(form, "partNumber", { max: 200 }) || undefined,
        removedAt,
        installedAt,
        warrantyEndsAt: formText(form, "warrantyEndsAt", { max: 10 }) || undefined,
        replacementKind: replacementKind as "planned" | "reactive",
        expectedLifeMonths,
      },
    }, { repository: context.repository });
    return relativeRedirect303(`/app/equipment/${encodeURIComponent(asset.id)}/components/${encodeURIComponent(result.installedComponent!.id)}?updated=replacement`);
  } catch (error) {
    return opsApiError(error);
  }
}
