import { z } from "zod/v4";
import type { AiClient } from "./ai";
import { AiUnavailableError } from "./ai";
import { CHECKOUT_OUTCOME_IDS, checkoutChoices, type CheckoutMode } from "./checkout-choices";

export interface CheckoutDraftInput {
  mode: CheckoutMode;
  lookAndReport?: boolean;
  problem: string;
  store: string;
  equipment?: string;
}

export const checkoutChatTurnSchema = z.object({
  /** What the AI says next: one short question, or (when ready) a brief summary ending in a yes/no check. */
  reply: z.string(),
  ready: z.boolean(),
  outcome: z.enum(CHECKOUT_OUTCOME_IDS),
  notes: z.string(),
  workingWhenLeft: z.enum(["yes", "no", "not_checked", "unknown"]),
});
export type CheckoutChatTurn = z.infer<typeof checkoutChatTurnSchema>;

const CHAT_SYSTEM = `You are a friendly assistant helping a maintenance technician at a convenience store wrap up a job by chat. Talk like a helpful coworker: short, plain, no jargon, no greetings after the first message, no emojis.

Your job is to collect what the checkout form needs, then confirm it:
- What they did or found.
- The result, chosen from the allowed results you are given.
- Whether it was working when they left (skip this for "Flag a problem").
- If it is not finished: what is still needed (parts with size or part number if they know it, help, or a vendor).
- Use common sense for the equipment: for refrigeration ask the box temperature when they left; for heating or cooling ask whether it was heating or cooling properly; for leaks ask whether the leak stopped; for lights or electrical ask whether it works now. Only ask when they have not already said it.

Rules:
- Ask ONE short question at a time. Never ask for something already said. At most about four questions in total; if they say they don't know or want to skip, accept it and move on.
- Use only what the technician said. Never invent parts, readings, causes or work.
- When you have enough, set "ready" to true and make "reply" a very brief summary of what they said (one or two short sentences), ending with "Is that right?".
- If they correct the summary, update it and confirm again.
- Always fill "outcome", "notes" and "workingWhenLeft" with your best current understanding. "notes" is a short work note in the technician's voice, under 600 characters, keeping numbers and part names exactly as said. "workingWhenLeft" is "unknown" until they say; "it's working", "cooling fine", "runs now" and similar mean "yes", and "still down" or "not working" mean "no".
- Never tell anyone to skip lockout/tagout or bypass a safety control.`;

/** One turn of the checkout chat. Stateless: the whole conversation is sent each time. */
export async function checkoutChatTurn(ai: AiClient, input: CheckoutDraftInput & { messages: { from: "tech" | "ai"; text: string }[] }): Promise<CheckoutChatTurn> {
  if (!input.messages.some(message => message.from === "tech")) throw new AiUnavailableError("Tell me what you did first.");
  const choices = checkoutChoices(input.mode, input.lookAndReport);
  const prompt = [
    `Job: ${input.problem}`,
    `Store: ${input.store}`,
    input.equipment ? `Equipment: ${input.equipment}` : undefined,
    `Form: ${input.mode === "problem" ? "Flag a problem (the job is not finished)" : "Record the result"}`,
    `Allowed results (id = label): ${choices.map(([id, label]) => `${id} = ${label}`).join("; ")}`,
    input.lookAndReport ? "This was a look-and-report visit: repairs may not have been allowed." : undefined,
    "",
    "Conversation so far:",
    ...input.messages.slice(-30).map(message => `${message.from === "tech" ? "Technician" : "You"}: ${message.text.slice(0, 2000)}`),
    "",
    "Reply with your next turn.",
  ].filter(line => line !== undefined).join("\n");
  const turn = await ai.json({ system: CHAT_SYSTEM, prompt, schema: checkoutChatTurnSchema, effort: "low", maxTokens: 2000 });
  const allowed = new Set(choices.map(([id]) => id));
  const outcome = allowed.has(turn.outcome) ? turn.outcome : (allowed.has("return_visit_required") ? "return_visit_required" : choices[0][0]);
  // Never claim "ready" while the form still lacks a required answer.
  const missingWorking = input.mode !== "problem" && turn.workingWhenLeft === "unknown";
  const missingNotes = outcome !== "completed" && !turn.notes.trim();
  const ready = turn.ready && !missingWorking && !missingNotes;
  const reply = turn.ready && !ready ? (missingWorking ? "Was it working when you left?" : "What still needs to be done?") : turn.reply.trim().slice(0, 800);
  return { reply, ready, outcome, notes: turn.notes.trim().slice(0, 2900), workingWhenLeft: turn.workingWhenLeft };
}
