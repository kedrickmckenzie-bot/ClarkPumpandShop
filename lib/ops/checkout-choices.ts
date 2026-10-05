/** The result choices a checkout form offers; shared by the form and the AI draft so they always agree. */
export type CheckoutMode = "job" | "visit" | "problem";
export const CHECKOUT_OUTCOME_IDS = ["completed", "return_visit_required", "parts_required", "diagnosis_only", "quote_required", "not_addressed"] as const;
export type CheckoutOutcomeId = (typeof CHECKOUT_OUTCOME_IDS)[number];

export function checkoutChoices(mode: CheckoutMode, lookAndReport = false): [CheckoutOutcomeId, string][] {
  const all: [CheckoutOutcomeId, string][] = mode === "visit"
    ? [["completed", "Fixed"], ["return_visit_required", "Needs more work"], ["parts_required", "Need parts"], ["diagnosis_only", "Need help"], ["quote_required", "Needs an outside vendor"], ["not_addressed", "Cannot get to it today"]]
    : mode === "problem"
      ? [["parts_required", "Need parts"], ["diagnosis_only", "Need help"], ["quote_required", "Need a vendor"], ["not_addressed", "Cannot get to it today"]]
      : [["completed", "Fixed"], ["return_visit_required", "Needs more work"], ["quote_required", "Needs an outside vendor"]];
  return all.filter(([id]) => !lookAndReport || id !== "completed");
}
