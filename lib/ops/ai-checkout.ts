import { z } from "zod/v4";
import type { AiClient } from "./ai";
import { AiUnavailableError } from "./ai";
import { CHECKOUT_OUTCOME_IDS, checkoutChoices, type CheckoutMode } from "./checkout-choices";

export const checkoutDraftSchema = z.object({
  outcome: z.enum(CHECKOUT_OUTCOME_IDS),
  notes: z.string(),
  workingWhenLeft: z.enum(["yes", "no", "not_checked", "unknown"]),
  question: z.string(),
});
export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>;

export interface CheckoutDraftInput {
  mode: CheckoutMode;
  lookAndReport?: boolean;
  problem: string;
  store: string;
  equipment?: string;
  /** What the technician typed or dictated. */
  description: string;
}

const SYSTEM = `You help maintenance technicians at convenience stores finish a job record. The technician describes what happened in their own words. Fill in the checkout form from that description.

Rules:
- Use only what the technician said. Never invent parts, readings, model numbers, causes or work that was not mentioned.
- Pick the result that best matches what they said. If the problem is fixed and working, choose the fixed result. If they need parts, choose the parts result. If you cannot tell, choose the closest result and ask about it in "question".
- "notes": a short, plain work note in the technician's voice (no greeting, no headings, under 600 characters). Keep part names, numbers and readings exactly as said. Include what still needs doing when the job is not finished.
- "workingWhenLeft": "yes" or "no" only when the technician said so or it is clearly implied; "not_checked" if they said they could not check; otherwise "unknown".
- "question": one short question only when something the form needs is missing or unclear; otherwise an empty string.
- Never tell anyone to skip lockout/tagout or bypass a safety control.`;

/** Turns the technician's own words into a checkout draft. The technician reviews it; nothing is saved here. */
export async function draftCheckout(ai: AiClient, input: CheckoutDraftInput): Promise<CheckoutDraft> {
  const description = input.description.trim();
  if (description.length < 3) throw new AiUnavailableError("Tell me a little about what you did first.");
  const choices = checkoutChoices(input.mode, input.lookAndReport);
  const prompt = [
    `Job: ${input.problem}`,
    `Store: ${input.store}`,
    input.equipment ? `Equipment: ${input.equipment}` : undefined,
    `Allowed results (id = label): ${choices.map(([id, label]) => `${id} = ${label}`).join("; ")}`,
    input.lookAndReport ? "This was a look-and-report visit: the technician may not have done repairs." : undefined,
    "",
    "Technician's description:",
    description.slice(0, 2000),
  ].filter(line => line !== undefined).join("\n");
  const draft = await ai.json({ system: SYSTEM, prompt, schema: checkoutDraftSchema, effort: "low", maxTokens: 2000 });
  // The form only offers some results in each situation; never return one it cannot show.
  const allowed = new Set(choices.map(([id]) => id));
  const outcome = allowed.has(draft.outcome) ? draft.outcome : (allowed.has("return_visit_required") ? "return_visit_required" : choices[0][0]);
  return { ...draft, outcome, notes: draft.notes.trim().slice(0, 2900), question: draft.question.trim().slice(0, 300) };
}
