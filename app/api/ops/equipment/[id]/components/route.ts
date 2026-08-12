import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { addAssetComponent } from "@/lib/ops/setup-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const { id: assetId } = await params;
    const asset = await context.repository.getAsset(context.session.organizationId, assetId);
    if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment was not found in your organization.");
    await assertStoreInSessionScope(context.session, asset.storeId);
    const formData = await request.formData();
    await addAssetComponent(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        assetId,
        parentComponentId: formText(formData, "parentComponentId", { max: 120 }) || undefined,
        name: formText(formData, "name", { required: true, max: 180 }),
        partNumber: formText(formData, "partNumber", { max: 180 }) || undefined,
        serialNumber: formText(formData, "serialNumber", { max: 180 }) || undefined,
        installedAt: optionalIsoDate(formText(formData, "installedAt", { max: 40 })),
        warrantyEndsAt: optionalIsoDate(formText(formData, "warrantyEndsAt", { max: 40 })),
        actor: context.actor,
      },
    );
    return NextResponse.redirect(
      new URL(`/app/equipment/${encodeURIComponent(asset.id)}?componentAdded=true#components`, request.url),
      303,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
