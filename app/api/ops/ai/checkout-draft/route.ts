import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { getAiClient } from "@/lib/server/ai-provider";
import { draftCheckout } from "@/lib/ops/ai-checkout";
import { AiUnavailableError } from "@/lib/ops/ai";
import { OpsDomainError } from "@/lib/ops/errors";

/**
 * Turns a technician's own description into a checkout draft for the form.
 * It only returns suggestions; the person reviews them and submits the normal form.
 */
export async function POST(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(["technician", "facilities", "regional"], undefined, request);
    const ai = getAiClient();
    if (!ai) return Response.json({ error: "AI help isn't turned on yet. Fill the form in yourself." }, { status: 503 });
    const body = await request.json().catch(() => null) as { workOrderId?: unknown; description?: unknown; mode?: unknown; lookAndReport?: unknown } | null;
    const workOrderId = typeof body?.workOrderId === "string" ? body.workOrderId : "";
    const description = typeof body?.description === "string" ? body.description : "";
    const mode = body?.mode === "visit" || body?.mode === "problem" ? body.mode : "job";
    if (!workOrderId || description.length > 4000) throw new OpsDomainError("VALIDATION", "Describe the work in up to 4,000 characters.");
    const scope = await internalDispatchScope(repository, session);
    const work = await repository.getWorkOrderDetail(scope, workOrderId);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
    const asset = work.asset ? await repository.getAsset(scope.organizationId, work.asset.id) : null;
    const equipment = asset ? [asset.name, asset.manufacturer, asset.model].filter(Boolean).join(" · ") : undefined;
    try {
      const draft = await draftCheckout(ai, { mode, lookAndReport: body?.lookAndReport === true, problem: work.problem, store: `${work.storeNumber} ${work.storeName}`, equipment, description });
      return Response.json({ draft }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof AiUnavailableError) return Response.json({ error: error.message }, { status: 503 });
      throw error;
    }
  } catch (error) {
    return opsApiError(error);
  }
}
