import {OpsDomainError} from "@/lib/ops/errors";
import { addEquipmentWarranty } from "@/lib/ops/warranty-commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional"], undefined, request);
    const { id } = await params; if(!await context.repository.getAssetDetail(context.session,id))throw new OpsDomainError("NOT_FOUND","Equipment not found"); const form = await request.formData();
    const coveredCharges=form.getAll("coveredCharges").map(String);
    if(!coveredCharges.length || coveredCharges.some(c=>!["part","labor","travel","diagnostic"].includes(c))) throw new OpsDomainError("VALIDATION","Select the costs this warranty covers");
    const saved=await addEquipmentWarranty({ organizationId: context.session.organizationId, actor: context.actor, assetId: id,
      vendorId:formText(form,"vendorId",{max:200})||undefined,
      componentId: formText(form, "componentId", { max: 180 }) || undefined,
      workOrderId: formText(form, "workOrderId", { max: 180 }) || undefined,
      providerKind: formText(form, "providerKind", { required: true, max: 30 }) as "manufacturer" | "vendor",
      providerName: formText(form, "providerName", { required: true, max: 200 }), title: formText(form, "title", { required: true, max: 200 }),
      startDate: formText(form, "startDate", { required: true, max: 10 }), expirationDate: formText(form, "expirationDate", { required: true, max: 10 }),
      coveredCharges:coveredCharges as import("@/lib/ops/types").WarrantyCoverageType[],
      partsCoverage:coveredCharges.includes("part")?"Covered":"Not covered", laborCoverage:coveredCharges.includes("labor")?"Covered":"Not covered",
      travelCoverage:coveredCharges.includes("travel")?"Covered":"Not covered", administrator:formText(form,"administrator",{max:500})||undefined, authorizedProviderRule:formText(form,"authorizedProviderRule",{max:1000})||undefined,
      claimRequirements: formText(form, "claimRequirements", { max: 2000 }) || undefined,
    }, { repository: context.repository });
    return relativeRedirect303(`/app/warranties/coverage/${encodeURIComponent(saved.id)}?saved=1`);
  } catch (error) { return opsApiError(error); }
}
