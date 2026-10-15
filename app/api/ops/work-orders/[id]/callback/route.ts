import { OpsDomainError } from "@/lib/ops/errors";
import { answerCallback, resolveCallback } from "@/lib/ops/work-callbacks";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

/**
 * Callback answers on a work order: "yes, it's a callback for that job" / "no, new problem" (anyone who can create
 * work here), and the close-out: no charge, or new billable work (facilities and regional managers). Audited.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const action = formText(form, "action", { required: true, max: 20 });
    const closeOut = action === "no_charge" || action === "new_work";
    const { session, repository, actor } = await getOpsRequestContext(closeOut ? ["facilities", "regional"] : ["facilities", "regional", "store_manager"], undefined, request);
    const work = await repository.getWorkOrder(session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
    await assertStoreInSessionScope(session, work.storeId);
    const svc = { repository };
    const back = (notice: string) => relativeRedirect303(`/app/work-orders/${encodeURIComponent(id)}?${new URLSearchParams({ notice })}#callback`);
    if (action === "link" || action === "not_callback") {
      await answerCallback(svc, { organizationId: session.organizationId, workOrderId: id, originalWorkOrderId: formText(form, "originalWorkOrderId", { required: true, max: 120 }), isCallback: action === "link", actor });
      return back(action === "link" ? "Linked as a callback." : "Noted: not a callback.");
    }
    if (closeOut) {
      await resolveCallback(svc, { organizationId: session.organizationId, workOrderId: id, decision: action, reason: formText(form, "reason", { max: 300 }) || undefined, actor });
      return back(action === "no_charge" ? "Closed out as a no-charge callback." : "Unlinked: this is new billable work.");
    }
    throw new OpsDomainError("VALIDATION", "Unknown action.");
  } catch (error) { return opsApiError(error); }
}
