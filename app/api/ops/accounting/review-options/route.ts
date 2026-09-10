import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { loadAccountingReviewModel } from "@/lib/ops/accounting-review-model";
export async function GET(request: Request) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "finance"]);
    const query = new URL(request.url).searchParams;
    return Response.json(await loadAccountingReviewModel(context.repository, context.actor, (query.get("source") ?? "").slice(0, 180), (query.get("q") ?? "").slice(0, 200), query.get("vendor") || undefined), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return opsApiError(error); }
}
