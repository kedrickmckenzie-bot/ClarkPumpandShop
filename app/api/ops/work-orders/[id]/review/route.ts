import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { loadWorkReview } from "@/lib/ops/work-review";
import { NORTHLINE_AS_OF, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repository, session } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"]);
    const model = await loadWorkReview(repository, session, (await params).id, session.organizationId === NORTHLINE_ORGANIZATION_ID ? NORTHLINE_AS_OF : new Date().toISOString());
    return Response.json(model ?? { error: "This work order is unavailable in your current scope." }, { status: model ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return opsApiError(error); }
}
