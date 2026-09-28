import { createStoreAccess } from "@/lib/ops/store-access";
import { assertStoreInSessionScope, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "issue_work_order", request);
    const { id } = await params;
    await assertStoreInSessionScope(context.session, id);
    const result = await createStoreAccess({ repository: context.repository }, { organizationId: context.session.organizationId, storeId: id, actor: context.actor });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
