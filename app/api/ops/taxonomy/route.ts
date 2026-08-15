import { NextResponse } from "next/server";
import { OpsDomainError } from "@/lib/ops/commands";
import { createEquipmentTemplate, createTaxonomyNode, updateTaxonomyNode } from "@/lib/ops/taxonomy-commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function success(request: Request) { const redirectTo = "/app/admin/service-areas?updated=1"; return request.headers.get("x-traceops-client") === "taxonomy-manager" ? NextResponse.json({ ok: true, redirectTo }) : relativeRedirect303(redirectTo); }

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    if (operation === "create") {
      const nodeKind = formText(formData, "nodeKind", { required: true, max: 20 });
      if (nodeKind !== "category" && nodeKind !== "group") throw new OpsDomainError("VALIDATION", "Choose service area or equipment group.");
      await createTaxonomyNode({ repository: context.repository }, { organizationId: context.session.organizationId, nodeKind, name: formText(formData, "name", { required: true, max: 120 }), parentNodeId: formText(formData, "parentNodeId", { max: 120 }) || undefined, actor: context.actor });
      return success(request);
    }
    if (operation === "update") {
      await updateTaxonomyNode({ repository: context.repository }, { organizationId: context.session.organizationId, nodeId: formText(formData, "nodeId", { required: true, max: 120 }), name: formText(formData, "name", { required: true, max: 120 }), parentNodeId: formText(formData, "parentNodeId", { max: 120 }) || undefined, active: formText(formData, "active", { max: 10 }) === "true", actor: context.actor });
      return success(request);
    }
    if (operation === "create-equipment-template") {
      const lifeRaw = formText(formData, "defaultExpectedLifeYears", { max: 4 });
      const life = lifeRaw ? Number(lifeRaw) : undefined;
      await createEquipmentTemplate({ repository: context.repository }, { organizationId: context.session.organizationId, taxonomyNodeId: formText(formData, "taxonomyNodeId", { required: true, max: 120 }), name: formText(formData, "name", { required: true, max: 120 }), defaultExpectedLifeYears: life, components: formText(formData, "components", { max: 4_000 }).split(/\r?\n/).map((value) => value.trim()).filter(Boolean), actor: context.actor });
      return success(request);
    }
    throw new OpsDomainError("VALIDATION", "Choose a supported setup action.");
  } catch (error) { return opsApiError(error); }
}
