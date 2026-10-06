import { markOverviewSeen } from "@/lib/ops/since-last-looked";
import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

/** "Mark as seen" on the Overview: saves now as this person's last look, on the server. */
export async function POST(request: Request) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager"], undefined, request);
    await markOverviewSeen({ repository }, { organizationId: session.organizationId, actor });
    return relativeRedirect303("/app/overview#since-last-looked");
  } catch (error) {
    return opsApiError(error);
  }
}
