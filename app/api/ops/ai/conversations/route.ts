import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { aiJobContext } from "@/lib/server/ai-job-context";
import { cleanChatMessages, saveAiConversation } from "@/lib/ops/ai-conversations";
import { getAiClient } from "@/lib/server/ai-provider";
import { OpsDomainError } from "@/lib/ops/errors";

/** Saves a finished AI conversation with its job, for history and later diagnostics. */
export async function POST(request: Request) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["technician", "facilities", "regional"], undefined, request);
    const body = await request.json().catch(() => null) as { workOrderId?: unknown; kind?: unknown; messages?: unknown; summary?: unknown } | null;
    const workOrderId = typeof body?.workOrderId === "string" ? body.workOrderId : "";
    if (!workOrderId || body?.kind !== "checkout") throw new OpsDomainError("VALIDATION", "Choose a job and conversation type.");
    await aiJobContext(repository, session, workOrderId);
    const ai = getAiClient();
    const saved = await saveAiConversation({ repository }, {
      organizationId: session.organizationId, actor, workOrderId, kind: "checkout", messages: cleanChatMessages(body.messages, 40),
      summary: typeof body.summary === "string" ? body.summary : undefined, provider: ai?.provider, model: ai?.model,
    });
    return Response.json(saved);
  } catch (error) {
    return opsApiError(error);
  }
}
