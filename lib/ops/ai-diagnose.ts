import { z } from "zod/v4";
import { AiUnavailableError, type AiClient } from "./ai";
import type { AiChatMessage } from "./ai-conversations";

/** Where a statement in the answer came from, so the technician can judge how much to trust it. */
export const diagnoseTurnSchema = z.object({
  reply: z.string(),
  sources: z.array(z.object({
    kind: z.enum(["history", "note", "document", "general"]),
    /** Short label: a date and job for history/notes, a document title, or the topic for general knowledge. */
    label: z.string(),
  })),
});
export type DiagnoseTurn = z.infer<typeof diagnoseTurnSchema>;

export interface DiagnoseContext {
  problem?: string;
  store?: string;
  /** Make, model, serial, age and warranty, as known. */
  equipment: string;
  /** Past jobs on this unit, newest first, one per line. */
  history: string;
  /** AI repair notes from earlier chats (notesForAi). */
  notes: string;
  /** Titles of manuals and diagrams on file for this unit. */
  documents: string[];
}

const SYSTEM = `You are a troubleshooting helper for maintenance technicians at convenience stores (refrigeration, HVAC, ice machines, fuel dispensers, plumbing, electrical, lighting). Talk like an experienced coworker: short, plain, practical.

How to use this unit's history and notes:
- History is a clue, never a rule. Something that did not fix it before can still be the cause now: the symptoms may differ, the new part may be bad, or it is a different fault that looks similar. Never say something is "ruled out" because of history.
- Compare today's symptoms with each past one. Say whether it looks the same or different, and why.
- Use history to suggest an ORDER to check things: what fixed a similar problem before goes first; what was recently replaced is less likely but still possible.
- Recent and repeated events count more than old or one-off ones.
- Always say the date when you use history or a note, e.g. "On Mar 3 a dirty coil caused the same 48°F box."
- Never mention or guess who did past work. Never judge past work.

Honesty:
- Use only the facts given here or general trade knowledge. Never invent readings, past repairs, part numbers or what a manual says.
- You cannot read inside the documents yet; you only know their titles. You may suggest which one to open.
- When you use general knowledge (not this unit's records), say so plainly, e.g. "Generally, …".
- If you don't know, say so and suggest what to check or measure next.
- Safety first: always assume lockout/tagout before electrical work; never suggest bypassing a safety control, jumping a pressure switch, or venting refrigerant. Gas, high-voltage and refrigerant handling need a qualified, certified technician.

Answer format:
- "reply": at most about 8 short lines. Lead with what to check first. Ask one question if you need a symptom or reading to narrow it down.
- "sources": one entry for each kind of source you actually used: "history" or "note" (label with the date), "document" (label with its title), "general" (label with the topic). Empty if none.`;

/** One turn of the diagnostic chat. Stateless: the whole conversation is sent each time. */
export async function diagnoseTurn(ai: AiClient, context: DiagnoseContext, messages: AiChatMessage[]): Promise<DiagnoseTurn> {
  if (!messages.some(message => message.from === "tech")) throw new AiUnavailableError("Describe what the equipment is doing first.");
  const prompt = [
    context.problem ? `Job: ${context.problem}` : undefined,
    context.store ? `Store: ${context.store}` : undefined,
    `Equipment: ${context.equipment}`,
    "",
    "Past jobs on this unit (newest first):",
    context.history || "None recorded.",
    "",
    "Repair notes from earlier chats (newest first):",
    context.notes || "None yet.",
    "",
    `Documents on file: ${context.documents.length ? context.documents.join("; ") : "none"}`,
    "",
    "Conversation:",
    ...messages.slice(-30).map(message => `${message.from === "tech" ? "Technician" : "You"}: ${message.text.slice(0, 2000)}`),
    "",
    "Reply with your next turn.",
  ].filter(line => line !== undefined).join("\n");
  const turn = await ai.json({ system: SYSTEM, prompt, schema: diagnoseTurnSchema, effort: "medium", maxTokens: 4000 });
  const seen = new Set<string>();
  return {
    reply: turn.reply.trim().slice(0, 2000),
    sources: turn.sources
      .map(source => ({ kind: source.kind, label: source.label.trim().slice(0, 120) }))
      .filter(source => source.label && !seen.has(`${source.kind}:${source.label}`) && seen.add(`${source.kind}:${source.label}`))
      .slice(0, 8),
  };
}
