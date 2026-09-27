import { OpsDomainError, recordWorkOrderNote } from "@/lib/ops/commands";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "regional", "store_manager"], "create_request", request);
    const { id } = await params;
    const work = await repository.getWorkOrder(session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
    await assertStoreInSessionScope(session, work.storeId);
    const form = await request.formData();
    const expectedVersion = Number(formText(form, "expectedVersion", { required: true, max: 12 }));
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new OpsDomainError("VALIDATION", "Invalid work version.");
    await recordWorkOrderNote({ repository }, { organizationId: session.organizationId, workOrderId: id, expectedVersion, note: formText(form, "note", { required: true, max: 2000 }), actor });
    return relativeRedirect303(`/app/work-orders/${encodeURIComponent(id)}?notice=Update+saved#recent-updates`);
  } catch (error) { return opsApiError(error); }
}
