import { changeInternalDispatch, type InternalTarget } from "@/lib/ops/internal-dispatch";
import { OpsDomainError } from "@/lib/ops/errors";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await request.formData();
    const action = formText(data, "action", { required: true, max: 20 });
    if (!["assign", "claim", "return"].includes(action)) throw new OpsDomainError("VALIDATION", "Choose an internal work action.");
    const context = await getOpsRequestContext(action === "assign" ? ["facilities", "regional"] : ["technician"], action === "assign" ? "assign_internal_work" : action === "claim" ? "claim_internal_work" : "return_internal_work", request);
    const { id } = await params;
    const work = await context.repository.getWorkOrder(context.session.organizationId, id);
    if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
    await assertStoreInSessionScope(context.session, work.storeId);
    const version = formText(data, "expectedVersion", { required: true, max: 16 });
    await changeInternalDispatch({ repository: context.repository }, {
      organizationId: context.session.organizationId, workOrderId: id, actor: context.actor, action: action as "assign" | "claim" | "return",
      target: formText(data, "internalTarget", { max: 30 }) as InternalTarget || undefined,
      membershipId: formText(data, "internalMembershipId", { max: 120 }) || undefined,
      managerId: formText(data, "managerId", { max: 120 }) || undefined,
      expectedVersion: Number(version), expectedAssignmentId: formText(data, "expectedAssignmentId", { max: 120 }) || null,
      key: formText(data, "submissionKey", { required: true, max: 120 }), reason: formText(data, "reason", { max: 1000 }) || undefined,
    });
    const destination = formText(data, "returnTo", { max: 1500 });
    if (request.headers.get("accept")?.includes("application/json")) return Response.json({ saved: true, number: work.number });
    // Retain scoped filters, without permitting an external/open redirect.
    const path = destination === `/app/my-work/${encodeURIComponent(id)}` || destination === "/app/my-work" || destination.startsWith("/app/my-work?") || destination === "/app/dispatch" || destination.startsWith("/app/dispatch?") ? destination : `/app/work-orders/${encodeURIComponent(id)}?view=service#internal-assignment`;
    const next=new URL(path,"http://local.invalid");next.searchParams.set(next.pathname.startsWith("/app/work-orders/")?"updated":"saved",next.pathname.startsWith("/app/work-orders/")?"1":work.number);
    return relativeRedirect303(next.pathname+next.search+next.hash);
  } catch (error) { return opsApiError(error); }
}
