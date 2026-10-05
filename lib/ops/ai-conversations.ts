import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { ActorContext } from "./types";

export interface AiChatMessage { from: "tech" | "ai"; text: string }

/** A saved AI conversation about a job, kept exactly as it happened. */
export interface AiConversation {
  id: string;
  organizationId: string;
  workOrderId: string;
  kind: "checkout" | "diagnostic";
  messages: AiChatMessage[];
  summary?: string;
  provider?: string;
  model?: string;
  createdByMembershipId?: string;
  createdByName: string;
  createdAt: string;
}

/** Checks a chat sent from the browser: alternating plain text, limited in size. */
export function cleanChatMessages(value: unknown, max = 30): AiChatMessage[] {
  if (!Array.isArray(value) || value.length > max) throw new OpsDomainError("VALIDATION", "That conversation is too long. Finish with the form instead.");
  return value.map(item => {
    const message = item as Partial<AiChatMessage>;
    if ((message.from !== "tech" && message.from !== "ai") || typeof message.text !== "string" || message.text.length > 2000)
      throw new OpsDomainError("VALIDATION", "Messages must be plain text under 2,000 characters.");
    return { from: message.from, text: message.text.trim() };
  }).filter(message => message.text);
}

/** Saves a finished conversation with its job. It is evidence of what was said, not a change to the job. */
export async function saveAiConversation(dependencies: OpsCommandServices, input: {
  organizationId: string;
  actor: ActorContext;
  workOrderId: string;
  kind: AiConversation["kind"];
  messages: AiChatMessage[];
  summary?: string;
  provider?: string;
  model?: string;
}) {
  const repository = dependencies.repository, now = dependencies.clock?.now() ?? new Date().toISOString();
  const ids = dependencies.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user") throw new OpsDomainError("FORBIDDEN", "Sign in to save this conversation.");
  const work = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  if (!input.messages.length) throw new OpsDomainError("VALIDATION", "There is nothing to save.");
  const id = ids.next("ai-conversation");
  await repository.atomicWrite([{
    sql: "INSERT INTO ops_ai_conversations (id, organization_id, work_order_id, kind, messages_json, summary, provider, model, created_by_membership_id, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    params: [id, input.organizationId, work.id, input.kind, JSON.stringify(input.messages), input.summary?.slice(0, 2000) ?? null, input.provider ?? null, input.model ?? null, input.actor.actorId ?? null, input.actor.actorName ?? "Technician", now],
  }]);
  return { id };
}
