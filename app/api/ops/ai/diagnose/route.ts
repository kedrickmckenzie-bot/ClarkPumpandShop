import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { aiDiagnoseContext } from "@/lib/server/ai-diagnose-context";
import { getAiClient } from "@/lib/server/ai-provider";
import { diagnoseTurn } from "@/lib/ops/ai-diagnose";
import { cleanChatMessages } from "@/lib/ops/ai-conversations";
import { AiUnavailableError } from "@/lib/ops/ai";
import { OpsDomainError } from "@/lib/ops/errors";

/** One turn of the troubleshooting chat for a job or a unit. Nothing is saved here; the job's chat is saved at checkout. */
export async function POST(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(["technician", "facilities", "regional"], undefined, request);
    const ai = getAiClient();
    if (!ai) return Response.json({ error: "AI help is not turned on." }, { status: 503 });
    const body = await request.json().catch(() => null) as { workOrderId?: unknown; assetId?: unknown; messages?: unknown } | null;
    const workOrderId = typeof body?.workOrderId === "string" ? body.workOrderId : undefined, assetId = typeof body?.assetId === "string" ? body.assetId : undefined;
    if (!workOrderId && !assetId) throw new OpsDomainError("VALIDATION", "Choose a job or equipment.");
    const context = await aiDiagnoseContext(repository, session, { workOrderId, assetId });
    const turn = await diagnoseTurn(ai, context, cleanChatMessages(body?.messages, 40));
    return Response.json({ turn });
  } catch (error) {
    if (error instanceof AiUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    return opsApiError(error);
  }
}
