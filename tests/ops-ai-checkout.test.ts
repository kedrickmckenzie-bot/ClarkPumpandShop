import { expect, it } from "vitest";
import { draftCheckout, type CheckoutDraft } from "@/lib/ops/ai-checkout";
import { AiUnavailableError, type AiClient } from "@/lib/ops/ai";
import { checkoutChoices } from "@/lib/ops/checkout-choices";

/** A stand-in AI that returns a fixed answer and records what it was asked. */
function fakeAi(answer: CheckoutDraft) {
  const calls: { system: string; prompt: string; effort?: string }[] = [];
  const ai: AiClient = { provider: "test", model: "test", async json(request) { calls.push(request); return request.schema.parse(answer); } };
  return { ai, calls };
}
const base = { problem: "Restroom faucet drips", store: "101 Cedar Grove", description: "swapped the cartridge, no more drip" };

it("passes the job, store, equipment and allowed results to the AI and keeps its answer", async () => {
  const { ai, calls } = fakeAi({ outcome: "completed", notes: " Swapped the cartridge. ", workingWhenLeft: "yes", question: "" });
  const draft = await draftCheckout(ai, { ...base, mode: "job", equipment: "Faucet · Delta" });
  expect(draft).toEqual({ outcome: "completed", notes: "Swapped the cartridge.", workingWhenLeft: "yes", question: "" });
  expect(calls[0].prompt).toContain("Restroom faucet drips");
  expect(calls[0].prompt).toContain("Faucet · Delta");
  expect(calls[0].prompt).toContain("completed = Fixed");
  expect(calls[0].effort).toBe("low");
  expect(calls[0].system).toContain("Never invent parts");
});

it("never returns a result the form cannot show", async () => {
  // A job form has no "Need parts" choice; a parts answer becomes "Needs more work".
  expect((await draftCheckout(fakeAi({ outcome: "parts_required", notes: "Need a cartridge", workingWhenLeft: "no", question: "" }).ai, { ...base, mode: "job" })).outcome).toBe("return_visit_required");
  // Look-and-report visits cannot be marked fixed.
  expect((await draftCheckout(fakeAi({ outcome: "completed", notes: "Looked", workingWhenLeft: "yes", question: "" }).ai, { ...base, mode: "visit", lookAndReport: true })).outcome).toBe("return_visit_required");
  // The problem form only offers blockers; anything else becomes its first choice.
  expect((await draftCheckout(fakeAi({ outcome: "completed", notes: "x", workingWhenLeft: "yes", question: "" }).ai, { ...base, mode: "problem" })).outcome).toBe(checkoutChoices("problem")[0][0]);
});

it("asks for a description before calling the AI and passes the AI's question through", async () => {
  const { ai, calls } = fakeAi({ outcome: "diagnosis_only", notes: "Looked at it.", workingWhenLeft: "unknown", question: "What did you find?" });
  await expect(draftCheckout(ai, { ...base, mode: "visit", description: " " })).rejects.toBeInstanceOf(AiUnavailableError);
  expect(calls).toHaveLength(0);
  expect((await draftCheckout(ai, { ...base, mode: "visit", description: "looked at it" })).question).toBe("What did you find?");
});

it("keeps the form's choices in one place", () => {
  expect(checkoutChoices("job").map(([id]) => id)).toEqual(["completed", "return_visit_required", "quote_required"]);
  expect(checkoutChoices("visit", true).map(([id]) => id)).not.toContain("completed");
});
