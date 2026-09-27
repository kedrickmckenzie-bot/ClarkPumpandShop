import { assertStoreInSessionScope, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";

export async function GET(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager"], "create_request", request);
    const storeId = new URL(request.url).searchParams.get("store") ?? "";
    await assertStoreInSessionScope(session, storeId);
    const page = await repository.listWorkOrders(session, {
      storeId, limit: 5,
      statuses: ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"],
    });
    return Response.json({ items: page.items.map(work => ({ id: work.id, number: work.number, problem: work.problem, nextAction: work.nextAction, owner: work.accountableParty })), hasMore: Boolean(page.nextCursor) });
  } catch (error) { return opsApiError(error); }
}
