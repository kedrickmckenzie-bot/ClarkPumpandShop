import { addEquipmentWarranty } from "@/lib/ops/warranty-commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional"], undefined, request);
    const { id } = await params; const form = await request.formData();
    await addEquipmentWarranty({ organizationId: context.session.organizationId, actor: context.actor, assetId: id,
      componentId: formText(form, "componentId", { max: 180 }) || undefined,
      workOrderId: formText(form, "workOrderId", { max: 180 }) || undefined,
      providerKind: formText(form, "providerKind", { required: true, max: 30 }) as "manufacturer" | "vendor",
      providerName: formText(form, "providerName", { required: true, max: 200 }), title: formText(form, "title", { required: true, max: 200 }),
      startDate: formText(form, "startDate", { required: true, max: 10 }), expirationDate: formText(form, "expirationDate", { required: true, max: 10 }),
      partsCoverage: formText(form, "partsCoverage", { required: true, max: 1000 }), laborCoverage: formText(form, "laborCoverage", { required: true, max: 1000 }),
      claimRequirements: formText(form, "claimRequirements", { max: 2000 }) || undefined,
    }, { repository: context.repository });
    return relativeRedirect303(`/app/equipment/${encodeURIComponent(id)}?updated=warranty#equipment-warranties`);
  } catch (error) { return opsApiError(error); }
}
