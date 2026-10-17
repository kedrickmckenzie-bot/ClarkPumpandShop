import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { getAiClient } from "@/lib/server/ai-provider";
import { AiUnavailableError } from "@/lib/ops/ai";
import { OpsDomainError } from "@/lib/ops/errors";
import { ASK_ROLES, answerAsk, type AskTurn } from "@/lib/server/ask";

/** One Ask question. Answers come only from scoped lookups; nothing is saved. */
export async function POST(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(ASK_ROLES, undefined, request);
    const ai = getAiClient();
    if (!ai?.toolChat) return Response.json({ error: "Ask isn't turned on yet." }, { status: 503 });
    const body = await request.json().catch(() => null) as { messages?: unknown } | null;
    const messages: AskTurn[] = (Array.isArray(body?.messages) ? body.messages : []).slice(-10).flatMap((m: unknown) => {
      const turn = m as { role?: unknown; content?: unknown };
      return (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.trim()
        ? [{ role: turn.role, content: turn.content.trim().slice(0, 2000) }] : [];
    });
    if (!messages.length || messages.at(-1)!.role !== "user") throw new OpsDomainError("VALIDATION", "Type a question.");
    try {
      const { answer } = await answerAsk(ai, repository, session, messages);
      return Response.json({ answer }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof AiUnavailableError) return Response.json({ error: error.message }, { status: 503 });
      throw error;
    }
  } catch (error) {
    return opsApiError(error);
  }
}
