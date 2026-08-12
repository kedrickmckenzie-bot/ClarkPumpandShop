import { NextResponse } from "next/server";
import { onboardVendor, OpsDomainError } from "@/lib/ops/commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";

function vendorCode(name: string) {
  return name.toLocaleUpperCase("en-US").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "VENDOR";
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const formData = await request.formData();
    const snapshot = await getServerOpsFixtureSnapshot(context.session.organizationId);
    const name = formText(formData, "name", { required: true, max: 160 });
    const keys = formText(formData, "specialtyKeys", { required: true, max: 500 }).split(",").map((value) => value.trim()).filter(Boolean);
    const aliases = formText(formData, "searchAliases", { max: 500 }).split(",").map((value) => value.trim()).filter(Boolean);
    const knownSpecialties = new Map(snapshot.vendorSpecialties.filter((item) => item.organizationId === context.session.organizationId).map((item) => [item.canonicalKey, item.displayName]));
    const specialties = keys.map((key) => ({ canonicalKey: key, displayName: knownSpecialties.get(key) ?? key.replaceAll("_", " "), searchAliases: aliases }));
    const coverageIds = formText(formData, "coverageScopeIds", { required: true, max: 500 }).split(",").map((value) => value.trim()).filter(Boolean);
    const coverage = coverageIds.map((scopeId) => {
      if (scopeId === context.session.organizationId) return { scopeKind: "organization" as const, scopeId };
      if (snapshot.regions.some((region) => region.organizationId === context.session.organizationId && region.id === scopeId)) return { scopeKind: "region" as const, scopeId };
      if (snapshot.stores.some((store) => store.organizationId === context.session.organizationId && store.id === scopeId)) return { scopeKind: "store" as const, scopeId };
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
    return NextResponse.redirect(new URL(`/app/vendors/${encodeURIComponent(result.id)}?created=true`, request.url), 303);
  } catch (error) {
    return opsApiError(error);
  }
}
