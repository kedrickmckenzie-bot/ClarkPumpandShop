import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";

export async function GET(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"], "assign_internal_work", request);
    const q = new URL(request.url).searchParams;
    const store = q.get("store") ?? "";
    await assertStoreInSessionScope(context.session, store);
    const page = await context.repository.listDispatchPeople(await internalDispatchScope(context.repository, context.session), store, (q.get("q") ?? "").slice(0, 120), q.get("cursor") ?? undefined, q.get("kind") === "manager" ? "manager" : q.get("kind") === "technician" ? "technician" : undefined);
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
