import { releaseWorkOrderVisitHold } from "@/lib/ops/commands";
import { dispatchJob } from "@/lib/ops/dispatch-board";
import { OpsDomainError } from "@/lib/ops/errors";
import { assertStoreInSessionScope, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";

/**
 * Takes a small job off "do on next visit" so a manager can put it on a tech's day.
 * Returns the job as the board sees it; the board then plans it with its normal save.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"], "schedule_internal_work", request);
    const { id } = await params;
    const work = await context.repository.getWorkOrder(context.session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
    const store = await assertStoreInSessionScope(context.session, work.storeId);
    await releaseWorkOrderVisitHold({ repository: context.repository }, { organizationId: context.session.organizationId, workOrderId: id, actor: context.actor });
    const detail = await context.repository.getWorkOrderDetail(await internalDispatchScope(context.repository, context.session), id);
    if (!detail) throw new OpsDomainError("NOT_FOUND", "Job not found.");
    return Response.json({ job: dispatchJob(detail, store.timeZone, store.regionId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return opsApiError(error);
  }
}
