import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { isOpsClientRequest } from "@/lib/ops/http-contract";
import { assignReplacementProfile, completeReplacement, setAssetReplacementOverride } from "@/lib/ops/replacement-commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError, optionalIsoDate, optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function success(request: Request, redirectTo: string) {
  return isOpsClientRequest(request, "replacement-intelligence")
    ? NextResponse.json({ ok: true, redirectTo })
    : relativeRedirect303(redirectTo);
}

function requiredMoney(formData: FormData, field: string, label: string) {
  const value = optionalMoneyMinor(formText(formData, field, { max: 20 }));
  if (value === undefined) throw new OpsDomainError("VALIDATION", `${label} is required.`);
  return value;
}

function requiredDate(formData: FormData, field: string, label: string) {
  const value = optionalIsoDate(formText(formData, field, { max: 40 }));
  if (!value) throw new OpsDomainError("VALIDATION", `${label} is required.`);
  return value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id } = await params;
    const asset = await context.repository.getAsset(context.session.organizationId, id);
    if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment was not found.");
    await assertStoreInSessionScope(context.session, asset.storeId);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    if (operation === "assign-profile") {
      const adjustment = formText(formData, "adjustmentPercent", { max: 12 });
      const adjustmentBps = adjustment ? Math.round(Number(adjustment) * 100) : undefined;
      if (adjustment && !Number.isFinite(adjustmentBps)) throw new OpsDomainError("VALIDATION", "Equipment adjustment is invalid.");
      await assignReplacementProfile({ repository: context.repository }, { organizationId: context.session.organizationId, assetId: asset.id, profileId: formText(formData, "profileId", { required: true, max: 120 }), adjustmentBps, actor: context.actor });
      return success(request, `/app/equipment/${encodeURIComponent(asset.id)}?updated=replacement-profile#replacement-intelligence`);
    }
    if (operation === "set-override") {
      await setAssetReplacementOverride({ repository: context.repository }, { organizationId: context.session.organizationId, assetId: asset.id, amountMinor: requiredMoney(formData, "amount", "Replacement estimate"), currency: "USD", effectiveAt: requiredDate(formData, "effectiveAt", "Effective date"), reason: formText(formData, "reason", { required: true, max: 1_000 }), actor: context.actor });
      return success(request, `/app/equipment/${encodeURIComponent(asset.id)}?updated=replacement-override#replacement-intelligence`);
    }
    if (operation === "complete-replacement") {
      await completeReplacement({ repository: context.repository }, { organizationId: context.session.organizationId, assetId: asset.id, eventId: formText(formData, "eventId", { required: true, max: 120 }), finalAmountMinor: requiredMoney(formData, "finalAmount", "Final installed cost"), currency: "USD", newAssetTag: formText(formData, "newAssetTag", { required: true, max: 80 }), newAssetName: formText(formData, "newAssetName", { required: true, max: 180 }), manufacturer: formText(formData, "manufacturer", { max: 180 }) || undefined, model: formText(formData, "model", { max: 180 }) || undefined, serialNumber: formText(formData, "serialNumber", { max: 180 }) || undefined, supplier: formText(formData, "supplier", { max: 180 }) || undefined, installedAt: requiredDate(formData, "installedAt", "Install date"), warrantyEndsAt: optionalIsoDate(formText(formData, "warrantyEndsAt", { max: 40 })), actor: context.actor });
      return success(request, `/app/equipment/${encodeURIComponent(asset.id)}?updated=replacement-completed#replacement-intelligence`);
    }
    throw new OpsDomainError("VALIDATION", "Choose a supported replacement update.");
  } catch (error) { return opsApiError(error); }
}
