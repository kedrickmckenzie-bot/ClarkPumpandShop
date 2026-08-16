import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { isOpsClientRequest } from "@/lib/ops/http-contract";
import { createReplacementProfile, publishManualReplacementBenchmark } from "@/lib/ops/replacement-commands";
import { formText, getOpsRequestContext, opsApiError, optionalIsoDate, optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function requiredMoney(formData: FormData, field: string, label: string) { const value = optionalMoneyMinor(formText(formData, field, { max: 20 })); if (value === undefined) throw new OpsDomainError("VALIDATION", `${label} is required.`); return value; }
function whole(formData: FormData, field: string, fallback: number) { const raw = formText(formData, field, { max: 12 }); const value = raw ? Number(raw) : fallback; if (!Number.isSafeInteger(value)) throw new OpsDomainError("VALIDATION", `${field} must be a whole number.`); return value; }
function success(request: Request, redirectTo: string) { return isOpsClientRequest(request, "replacement-intelligence") ? NextResponse.json({ ok: true, redirectTo }) : relativeRedirect303(redirectTo); }

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    if (operation === "create-profile") {
      const attributes = Object.fromEntries(formText(formData, "attributes", { max: 2_000 }).split(/\r?\n/).map((line) => line.split("=").map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]).map(([key, value]) => [key, value]));
      const matchKeys = formText(formData, "matchKeys", { max: 600 }).split(",").map((value) => value.trim()).filter(Boolean);
      await createReplacementProfile({ repository: context.repository }, { organizationId: context.session.organizationId, code: formText(formData, "code", { required: true, max: 60 }), name: formText(formData, "name", { required: true, max: 200 }), description: formText(formData, "description", { required: true, max: 1_000 }), categoryKey: formText(formData, "categoryKey", { required: true, max: 80 }), taxonomyNodeId: formText(formData, "taxonomyNodeId", { max: 120 }) || undefined, matchKeys, attributes, expectedLifeYears: whole(formData, "expectedLifeYears", 15), annualEscalationBps: whole(formData, "annualEscalationBps", 300), lowVarianceBps: whole(formData, "lowVarianceBps", 1_000), highVarianceBps: whole(formData, "highVarianceBps", 2_000), actor: context.actor });
      return success(request, "/app/lifecycle?updated=profile-created#replacement-profiles");
    }
    if (operation === "publish-benchmark") {
      const effectiveAt = optionalIsoDate(formText(formData, "effectiveAt", { max: 40 }));
      if (!effectiveAt) throw new OpsDomainError("VALIDATION", "Effective date is required.");
      await publishManualReplacementBenchmark({ repository: context.repository }, { organizationId: context.session.organizationId, profileId: formText(formData, "profileId", { required: true, max: 120 }), equipmentAmountMinor: requiredMoney(formData, "equipmentAmount", "Equipment amount"), installationAmountMinor: requiredMoney(formData, "installationAmount", "Installation amount"), otherAmountMinor: requiredMoney(formData, "otherAmount", "Other amount"), currency: "USD", effectiveAt, notes: formText(formData, "notes", { required: true, max: 2_000 }), actor: context.actor });
      return success(request, "/app/lifecycle?updated=benchmark-published#replacement-profiles");
    }
    throw new OpsDomainError("VALIDATION", "Choose a supported replacement-profile update.");
  } catch (error) { return opsApiError(error); }
}
