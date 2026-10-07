import { z } from "zod/v4";
import { AiUnavailableError, type AiClient } from "./ai";
import type { AiChatMessage } from "./ai-conversations";

/** Where a statement in the answer came from, so the technician can judge how much to trust it. */
export const diagnoseTurnSchema = z.object({
  reply: z.string(),
  /** A web search to run before answering, or "" when this unit's records and trade knowledge are enough. */
  webQuery: z.string(),
  sources: z.array(z.object({
    kind: z.enum(["history", "note", "document", "general", "web"]),
    /** Short label: a date and job for history/notes, a document title, or the topic for general knowledge. */
    label: z.string(),
  })),
});
export type DiagnoseSource = { kind: "history" | "note" | "document" | "general" | "web"; label: string; url?: string };
export type DiagnoseTurn = { reply: string; webQuery: string; sources: DiagnoseSource[] };

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
  /** The few document pages that best match the question, with their page labels. */
  excerpts: { title: string; pageLabel: string; text: string }[];
  /** Results of a web search already run for this question. */
  web?: { text: string; sources: { title: string; url: string }[] };
}

const SYSTEM = `You are a troubleshooting helper for maintenance technicians at convenience stores (refrigeration, HVAC, ice machines, fuel dispensers, plumbing, electrical, lighting). Talk like an experienced coworker: short, plain, practical.

Who said what:
- "Job report" is what was written when the job was opened, often by store staff. It can be out of date or wrong. The technician's messages are what is happening now and win when they differ.
- Never say the technician told you something unless they wrote it in this chat. When you use the job report, say "The job report says …" and, if it matters, ask whether that is still happening.
- Build on the technician's own words first. Bring in other symptoms from the job report only as a question.

Which equipment:
- If the equipment line says the job is not linked to equipment, say plainly that you can't see this unit's history because the job isn't linked to it. Never say the unit has "no history". If units that could fit are listed, ask which one it is.
- If the equipment line says the unit was matched from the job report, say once that the job isn't linked and you are using that unit's records.

How to use this unit's history and notes:
- "Close-out" lines under a past job are what was recorded when it was finished: the result and the notes. Use them like repair notes.
- History is a clue, never a rule. Something that did not fix it before can still be the cause now: the symptoms may differ, the new part may be bad, or it is a different fault that looks similar. Never say something is "ruled out" because of history.
- Compare today's symptoms with each past one. Say whether it looks the same or different, and why. When it looks different, lead with the causes that fit today's symptoms (for example frost only near a door points to door, gasket or closer air leaks), not the past fix.
- Use history to suggest an ORDER to check things: what fixed a similar problem before goes first; what was recently replaced is less likely but still possible.
- Recent and repeated events count more than old or one-off ones.
- Always say the date when you use history or a note, e.g. "On Mar 3 a dirty coil caused the same 48°F box."
- Never mention or guess who did past work. Never judge past work.

Honesty:
- Use only the facts given here or general trade knowledge. Never invent readings, past repairs, part numbers or what a manual says.
- Document pages: you are given only the few pages that best match the question. Quote or follow them when they apply, and always name the title and page in the reply itself, e.g. "Beer cave guide, Page 10". Never claim a document says something that is not in the pages given. If the pages don't cover it, say which document to open instead.
- Document pages describe the equipment family in general. This unit's own history and notes describe what actually happened here; when they differ, say so.
- When you use general knowledge (not this unit's records), say so plainly, e.g. "Generally, …".
- If you don't know, say so and suggest what to check or measure next.
- Safety first: always assume lockout/tagout before electrical work; never suggest bypassing a safety control, jumping a pressure switch, or venting refrigerant. When you refuse an unsafe shortcut, offer a safe way to protect the product or equipment meanwhile. Gas, high-voltage and refrigerant handling need a qualified, certified technician.

Web search:
- Ask for one when the technician asks about something specific to this make and model that the records and document pages given here don't contain: an error or fault code, a part number, a factory spec or setting, or a service bulletin. If you would otherwise have to say you don't know the exact meaning or number, search instead. Put a short search in "webQuery" (make, model and the specific thing).
- Don't search for general troubleshooting you already know, or when the records or document pages answer it. Otherwise leave "webQuery" empty.
- When web results are given, use them, say they came from the web, and treat them as less certain than this unit's records and documents. Do not ask for another search.

Answer format:
- Answer directly. Don't open by restating or summarizing what the technician just said ("Okay, so the box is warm and…"), and don't ask them to confirm what they already told you.
- "reply": at most about 8 short lines. Lead with what to check first. Ask one question if you need a symptom or reading to narrow it down.
- When the description is vague or short ("it's broken", "not working", "I don't think the compressor is turning on"), ask one short question about what it is doing first, with at most one quick first check. Don't list many guesses. Keep that first answer to about 4 short lines.
- "sources": one entry for each kind of source you actually used: "history" or "note" (label with the date), "document" (label with its title and page), "general" (label with the topic), "web" (label with the site). Empty if none.`;

/** One turn of the diagnostic chat. Stateless: the whole conversation is sent each time. */
export async function diagnoseTurn(ai: AiClient, context: DiagnoseContext, messages: AiChatMessage[], options: { canSearch?: boolean } = {}): Promise<DiagnoseTurn> {
  if (!messages.some(message => message.from === "tech")) throw new AiUnavailableError("Describe what the equipment is doing first.");
  const prompt = [
    context.problem ? `Job report (written when the job was opened; may be out of date): ${context.problem}` : undefined,
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
    "Most relevant document pages:",
    ...(context.excerpts.length ? context.excerpts.map(page => `[${page.title}, ${page.pageLabel}]\n${page.text}`) : ["None matched."]),
    ...(context.web ? ["", "Web search results (less certain than this unit's records):", context.web.text, ...context.web.sources.map(source => `- ${source.title}: ${source.url}`)] : []),
    ...(options.canSearch && !context.web ? [] : ["", "Web search is not available for this answer; leave webQuery empty."]),
    "",
    "Conversation:",
    ...messages.slice(-30).map(message => `${message.from === "tech" ? "Technician" : "You"}: ${message.text.slice(0, 2000)}`),
    "",
    "Reply with your next turn.",
  ].filter(line => line !== undefined).join("\n");
  const turn = await ai.json({ system: SYSTEM, prompt, schema: diagnoseTurnSchema, effort: "low", maxTokens: 4000, tier: "smart" });
  const seen = new Set<string>();
  // Web tags come only from searches that really ran, with their links, never from the AI's own labels.
  const webSources: DiagnoseSource[] = (context.web?.sources ?? []).filter(source => /^https?:\/\//i.test(source.url)).map(source => ({ kind: "web", label: siteName(source.url), url: source.url }));
  return {
    reply: turn.reply.trim().slice(0, 2000),
    webQuery: options.canSearch && !context.web ? turn.webQuery.trim().slice(0, 200) : "",
    sources: [...turn.sources.filter(source => source.kind !== "web").map(source => ({ kind: source.kind, label: source.label.trim().slice(0, 120) })), ...webSources]
      .filter(source => source.label && !seen.has(`${source.kind}:${source.label}`) && seen.add(`${source.kind}:${source.label}`))
      .slice(0, 10),
  };
}

function siteName(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web page"; }
}

const WEB_SYSTEM = `You look things up on the web for a maintenance technician at a convenience store. Search for the question, preferring the manufacturer's service documents and bulletins, then reputable trade sources. Answer in at most 6 short bullet points: facts only, numbers with units, model numbers exactly. Say when sources disagree or when nothing specific to this model was found. Never give advice to bypass safety controls.`;

/** Runs one capped web search for a troubleshooting question. Returns undefined when search is off or fails. */
export async function searchWebForDiagnosis(ai: AiClient, query: string, equipment: string) {
  if (!ai.webSearch || !query.trim()) return undefined;
  try {
    const result = await ai.webSearch({ system: WEB_SYSTEM, prompt: `Equipment: ${equipment}\nQuestion: ${query}`, maxSearches: 2 });
    return result.text ? result : undefined;
  } catch (error) {
    if (error instanceof AiUnavailableError) return undefined;
    throw error;
  }
}
