import { setJobPhotoSharing } from "@/lib/ops/commands";
import { getOpsRequestContext, assertStoreInSessionScope, formText, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { OpsDomainError } from "@/lib/ops/errors";

/** Show or hide one photo on the outside vendor's job link. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const c = await getOpsRequestContext(["facilities", "regional", "store_manager", "executive"], undefined, request), { id, fileId } = await params;
    const work = await c.repository.getWorkOrder(c.session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
    await assertStoreInSessionScope(c.session, work.storeId);
    const form = await request.formData(), shared = formText(form, "shared", { max: 5 });
    if (shared !== "true" && shared !== "false") throw new OpsDomainError("VALIDATION", "Choose whether to share the photo.");
    const result = await setJobPhotoSharing({ repository: c.repository }, { organizationId: work.organizationId, workOrderId: id, fileId, shared: shared === "true", actor: c.actor });
    if (request.headers.get("accept")?.includes("application/json")) return Response.json(result);
    return relativeRedirect303(`/app/work-orders/${encodeURIComponent(id)}?files=${result.shared ? "shared" : "hidden"}#job-files`);
  } catch (error) { return opsApiError(error); }
}
