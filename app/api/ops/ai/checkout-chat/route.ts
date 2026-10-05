import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { getAiClient } from "@/lib/server/ai-provider";
import { aiJobContext } from "@/lib/server/ai-job-context";
import { checkoutChatTurn } from "@/lib/ops/ai-checkout";
import { cleanChatMessages } from "@/lib/ops/ai-conversations";
import { AiUnavailableError } from "@/lib/ops/ai";
import { OpsDomainError } from "@/lib/ops/errors";

/** One turn of the checkout chat. Returns the AI's next message and its current form draft; nothing is saved. */
export async function POST(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(["technician", "facilities", "regional"], undefined, request);
    const ai = getAiClient();
    if (!ai) return Response.json({ error: "AI help isn't turned on yet. Use the form below." }, { status: 503 });
    const body = await request.json().catch(() => null) as { workOrderId?: unknown; mode?: unknown; lookAndReport?: unknown; messages?: unknown } | null;
    const workOrderId = typeof body?.workOrderId === "string" ? body.workOrderId : "";
    if (!workOrderId) throw new OpsDomainError("VALIDATION", "Choose a job.");
    const mode = body?.mode === "visit" || body?.mode === "problem" ? body.mode : "job";
    const messages = cleanChatMessages(body?.messages);
    const job = await aiJobContext(repository, session, workOrderId);
    try {
      const turn = await checkoutChatTurn(ai, { mode, lookAndReport: body?.lookAndReport === true, problem: job.problem, store: job.store, equipment: job.equipment, messages });
      return Response.json({ turn, provider: ai.provider, model: ai.model }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof AiUnavailableError) return Response.json({ error: error.message }, { status: 503 });
      throw error;
    }
  } catch (error) {
    return opsApiError(error);
  }
}
