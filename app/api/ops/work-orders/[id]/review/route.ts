import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { loadWorkReview } from "@/lib/ops/work-review";
import { getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repository, session } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"]);
    const model = await loadWorkReview(repository, session, (await params).id, getServerOpsReportingAsOf());
    return Response.json(model ?? { error: "This work order is unavailable in your current scope." }, { status: model ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return opsApiError(error); }
}
