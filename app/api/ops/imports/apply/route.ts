import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { applyImport } from "@/lib/ops/import-apply";
import { OpsDomainError } from "@/lib/ops/commands";
import type { ImportEntity } from "@/lib/ops/import-preview";
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"], undefined, request, true);
    const form = await request.formData(), entity = String(form.get("entity")) as ImportEntity, file = form.get("file");
    if (!["stores", "vendors", "equipment", "work"].includes(entity) || !(file instanceof File) || file.size > 2_000_000) throw new OpsDomainError("VALIDATION", "Choose a CSV file up to 2 MB.");
    return Response.json(await applyImport({ repository: context.repository }, { organizationId: context.session.organizationId, entity, text: await file.text(), actor: context.actor }));
  } catch (error) { return opsApiError(error); }
}
