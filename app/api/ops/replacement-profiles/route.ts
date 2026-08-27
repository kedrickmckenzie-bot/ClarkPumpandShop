import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { isOpsClientRequest } from "@/lib/ops/http-contract";
import { bulkClassifyReplacementPlanning, createReplacementProfile, publishManualReplacementBenchmark } from "@/lib/ops/replacement-commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError, optionalIsoDate, optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function requiredMoney(formData: FormData, field: string, label: string) { const value = optionalMoneyMinor(formText(formData, field, { max: 20 })); if (value === undefined) throw new OpsDomainError("VALIDATION", `${label} is required.`); return value; }
function whole(formData: FormData, field: string, fallback: number) { const raw = formText(formData, field, { max: 12 }); const value = raw ? Number(raw) : fallback; if (!Number.isSafeInteger(value)) throw new OpsDomainError("VALIDATION", `${field} must be a whole number.`); return value; }
function requiredCount(formData: FormData, field: string, label: string) { const value = Number(formText(formData, field, { required: true, max: 8 })); if (!Number.isSafeInteger(value) || value < 0) throw new OpsDomainError("VALIDATION", `${label} is invalid.`); return value; }
function success(request: Request, redirectTo: string) { return isOpsClientRequest(request, "replacement-intelligence") ? NextResponse.json({ ok: true, redirectTo }) : relativeRedirect303(redirectTo); }

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    if (operation === "create-profile") {
      if (context.session.role !== "facilities") throw new OpsDomainError("FORBIDDEN", "Facilities access is required to create company planning groups.");
      const attributes = Object.fromEntries(formText(formData, "attributes", { max: 2_000 }).split(/\r?\n/).map((line) => line.split("=").map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]).map(([key, value]) => [key, value]));
      const matchKeys = formText(formData, "matchKeys", { max: 600 }).split(",").map((value) => value.trim()).filter(Boolean);
      await createReplacementProfile({ repository: context.repository }, { organizationId: context.session.organizationId, code: formText(formData, "code", { required: true, max: 60 }), name: formText(formData, "name", { required: true, max: 200 }), description: formText(formData, "description", { required: true, max: 1_000 }), categoryKey: formText(formData, "categoryKey", { required: true, max: 80 }), taxonomyNodeId: formText(formData, "taxonomyNodeId", { max: 120 }) || undefined, matchKeys, attributes, expectedLifeYears: whole(formData, "expectedLifeYears", 15), annualEscalationBps: whole(formData, "annualEscalationBps", 300), lowVarianceBps: whole(formData, "lowVarianceBps", 1_000), highVarianceBps: whole(formData, "highVarianceBps", 2_000), actor: context.actor });
      return success(request, "/app/lifecycle?updated=profile-created#replacement-profiles");
    }
    if (operation === "publish-benchmark") {
      if (context.session.role !== "facilities") throw new OpsDomainError("FORBIDDEN", "Facilities access is required to publish companywide planning estimates.");
      const effectiveAt = optionalIsoDate(formText(formData, "effectiveAt", { max: 40 }));
      if (!effectiveAt) throw new OpsDomainError("VALIDATION", "Effective date is required.");
      if (formText(formData, "impactConfirmed", { max: 10 }) !== "yes") throw new OpsDomainError("VALIDATION", "Review and confirm the portfolio impact before publishing this planning estimate.");
      await publishManualReplacementBenchmark({ repository: context.repository }, { organizationId: context.session.organizationId, profileId: formText(formData, "profileId", { required: true, max: 120 }), equipmentAmountMinor: requiredMoney(formData, "equipmentAmount", "Equipment amount"), installationAmountMinor: requiredMoney(formData, "installationAmount", "Installation amount"), otherAmountMinor: requiredMoney(formData, "otherAmount", "Other amount"), currency: "USD", effectiveAt, notes: formText(formData, "notes", { required: true, max: 2_000 }), confirmedAffectedAssetCount: requiredCount(formData, "confirmedAffectedAssetCount", "Affected-equipment count"), confirmedOverrideCount: requiredCount(formData, "confirmedOverrideCount", "Equipment-specific estimate count"), actor: context.actor });
      return success(request, "/app/lifecycle?updated=benchmark-published#replacement-profiles");
    }
    if (operation === "bulk-classify") {
      const decisions: Array<{ assetId: string; action: "assign" | "exclude"; profileId?: string }> = [];
      for (const [key, entryValue] of formData.entries()) {
        if (!key.startsWith("assetDecision.") || typeof entryValue !== "string" || entryValue === "leave") continue;
        const assetId = key.slice("assetDecision.".length);
        if (!assetId || assetId.length > 120) throw new OpsDomainError("VALIDATION", "An equipment selection is invalid.");
        if (entryValue === "exclude") decisions.push({ assetId, action: "exclude" });
        else if (entryValue.startsWith("profile:") && entryValue.length > "profile:".length) decisions.push({ assetId, action: "assign", profileId: entryValue.slice("profile:".length) });
        else throw new OpsDomainError("VALIDATION", "Choose a supported planning action.");
      }
      for (const decision of decisions) {
        const asset = await context.repository.getAsset(context.session.organizationId, decision.assetId);
        if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment was not found.");
        await assertStoreInSessionScope(context.session, asset.storeId);
      }
      await bulkClassifyReplacementPlanning({ repository: context.repository }, { organizationId: context.session.organizationId, decisions, exclusionReason: formText(formData, "exclusionReason", { max: 1_000 }) || undefined, actor: context.actor });
      return success(request, "/app/lifecycle?updated=planning-coverage#replacement-coverage");
    }
    throw new OpsDomainError("VALIDATION", "Choose a supported replacement-profile update.");
  } catch (error) { return opsApiError(error); }
}
