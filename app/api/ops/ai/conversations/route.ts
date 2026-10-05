import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { aiJobContext } from "@/lib/server/ai-job-context";
import { cleanChatMessages, saveAiConversation } from "@/lib/ops/ai-conversations";
import { getAiClient } from "@/lib/server/ai-provider";
import { OpsDomainError } from "@/lib/ops/errors";
import { saveEquipmentNote, writeEquipmentNote } from "@/lib/ops/equipment-notes";

/** Saves a finished AI conversation with its job, for history and later diagnostics. */
export async function POST(request: Request) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["technician", "facilities", "regional"], undefined, request);
    const body = await request.json().catch(() => null) as { workOrderId?: unknown; kind?: unknown; messages?: unknown; summary?: unknown; diagnostic?: unknown } | null;
    const workOrderId = typeof body?.workOrderId === "string" ? body.workOrderId : "";
    if (!workOrderId || body?.kind !== "checkout") throw new OpsDomainError("VALIDATION", "Choose a job and conversation type.");
    const context = await aiJobContext(repository, session, workOrderId);
    const messages = cleanChatMessages(body.messages, 40), diagnostic = Array.isArray(body.diagnostic) ? cleanChatMessages(body.diagnostic.slice(-40), 40) : [];
    const ai = getAiClient();
    // The troubleshooting chat from this job is kept with it too, so the note and future help can use it.
    if (diagnostic.length) await saveAiConversation({ repository }, { organizationId: session.organizationId, actor, workOrderId, kind: "diagnostic", messages: diagnostic, provider: ai?.provider, model: ai?.model });
    const saved = await saveAiConversation({ repository }, {
      organizationId: session.organizationId, actor, workOrderId, kind: "checkout", messages,
      summary: typeof body.summary === "string" ? body.summary : undefined, provider: ai?.provider, model: ai?.model,
    });
    // The detailed equipment note is written from the whole chat. It is extra: if the AI can't write it, the job and chat are still saved.
    if (ai) {
      try {
        const note = await writeEquipmentNote(ai, { ...context, messages: diagnostic.length ? [...diagnostic, { from: "ai", text: "(Troubleshooting chat ends. Checkout chat starts.)" }, ...messages] : messages });
        await saveEquipmentNote({ repository }, { organizationId: session.organizationId, actor, workOrderId, conversationId: saved.id, note, provider: ai.provider, model: ai.model });
      } catch (error) {
        console.warn("Equipment note not written", error instanceof Error ? error.message : error);
      }
    }
    return Response.json(saved);
  } catch (error) {
    return opsApiError(error);
  }
}
