import { OpsDomainError } from "@/lib/ops/commands";
import { createAsset } from "@/lib/ops/setup-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function optionalWholeNumber(value: string, label: string) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new OpsDomainError("VALIDATION", `${label} must be a whole number.`);
  return number;
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], undefined, request);
    const formData = await request.formData();
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    await assertStoreInSessionScope(context.session, storeId);
    const groupPath = formText(formData, "groupPath", { max: 700 })
      .split(/\s*(?:>|\/|,)\s*/)
      .map((value) => value.trim())
      .filter(Boolean);
    const result = await createAsset(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        storeId,
        categoryKey: formText(formData, "categoryKey", { required: true, max: 80 }),
        groupPath,
        assetTag: formText(formData, "assetTag", { required: true, max: 80 }),
        name: formText(formData, "name", { required: true, max: 180 }),
        manufacturer: formText(formData, "manufacturer", { max: 180 }) || undefined,
        model: formText(formData, "model", { max: 180 }) || undefined,
        serialNumber: formText(formData, "serialNumber", { max: 180 }) || undefined,
        supplier: formText(formData, "supplier", { max: 180 }) || undefined,
        installedAt: optionalIsoDate(formText(formData, "installedAt", { max: 40 })),
        expectedLifeYears: optionalWholeNumber(
          formText(formData, "expectedLifeYears", { max: 4 }),
          "Expected life",
        ),
        warrantyEndsAt: optionalIsoDate(formText(formData, "warrantyEndsAt", { max: 40 })),
        replacementEstimateMinor: optionalMoneyMinor(
          formText(formData, "replacementEstimate", { max: 20 }),
        ),
        currency: "USD",
        status: formText(formData, "status", { required: true, max: 30 }) as
          | "operational"
          | "watch"
          | "out_of_service"
          | "retired",
        manufacturerWarranty: ["warrantyProvider","warrantyStart","warrantyParts","warrantyLabor","warrantyTerms"].some(key=>formText(formData,key)) ? {
          provider:formText(formData,"warrantyProvider",{required:true,max:180}),startDate:formText(formData,"warrantyStart",{required:true,max:10}),endDate:formText(formData,"warrantyEndsAt",{required:true,max:10}),parts:formText(formData,"warrantyParts",{required:true,max:2000}),labor:formText(formData,"warrantyLabor",{required:true,max:2000}),terms:formText(formData,"warrantyTerms",{max:3000})||undefined,
        }:undefined,
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/equipment/${encodeURIComponent(result.id)}?created=true`);
  } catch (error) {
    return opsApiError(error);
  }
}
