import { onboardVendor, OpsDomainError } from "@/lib/ops/commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function vendorCode(name: string) {
  return name.toLocaleUpperCase("en-US").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "VENDOR";
}

function selectedValues(form: FormData, field: string, label: string) {
  const entries = form.getAll(field);
  if (entries.some(value => typeof value !== "string") || entries.join(",").length > 4000) throw new OpsDomainError("VALIDATION", `Choose valid ${label}.`);
  const values = [...new Set(entries.flatMap(value => String(value).split(",")).map(value => value.trim()).filter(Boolean))];
  if (!values.length || values.length > 100) throw new OpsDomainError("VALIDATION", `Choose at least one ${label}.`);
  return values;
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"], undefined, request, true);
    const formData = await request.formData();
    const name = formText(formData, "name", { required: true, max: 160 });
    const keys = selectedValues(formData, "specialtyKeys", "specialty");
    const aliases = formText(formData, "searchAliases", { max: 500 }).split(",").map((value) => value.trim()).filter(Boolean);
    const coverageIds = selectedValues(formData, "coverageScopeIds", "coverage area");
    const selection = await context.repository.readVendorOnboardingSelection(context.session.organizationId,coverageIds,keys);
    const knownSpecialties = new Map(selection.specialties.map(s=>[s.canonicalKey,s.displayName]));
    const specialties = keys.map((key) => ({ canonicalKey: key, displayName: knownSpecialties.get(key) ?? key.replaceAll("_", " "), searchAliases: aliases }));
    const coverage = coverageIds.map((scopeId) => {
      if (scopeId === context.session.organizationId) return { scopeKind: "organization" as const, scopeId };
      if (selection.regions.includes(scopeId)) return { scopeKind: "region" as const, scopeId };
      if (selection.stores.includes(scopeId)) return { scopeKind: "store" as const, scopeId };
      throw new OpsDomainError("VALIDATION", "Choose coverage from the organization directory.");
    });
    const result = await onboardVendor(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        code: formText(formData, "code", { max: 40 }) || vendorCode(name),
        name,
        dispatchEmail: formText(formData, "dispatchEmail", { required: true, max: 160 }),
        dispatchPhone: formText(formData, "dispatchPhone", { max: 40 }) || undefined,
        preferred: formData.get("preferred") === "true",
        specialties,
        coverage,
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/vendors/${encodeURIComponent(result.id)}?created=true`);
  } catch (error) {
    return opsApiError(error);
  }
}
