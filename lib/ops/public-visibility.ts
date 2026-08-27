const PUBLIC_FINANCIAL_CONTROL_PATTERN = /\b(?:not[- ]?to[- ]?exceed|NTE|authorization limit|authorization ceiling)\b/iu;

/**
 * Keeps internal review thresholds out of vendor-facing scope text, including
 * older immutable issuances that predate the public-boundary rule.
 */
export function vendorFacingScope(value?: string | null): string {
  const fallback = "Diagnose the reported problem, complete the listed work, and document any additional recommended work separately.";
  if (!value?.trim()) return fallback;

  const visible = value
    .trim()
    .replace(/\s*(?:call|contact(?:\s+the\s+customer)?)\s+before\s+exceeding\s+(?:the\s+)?(?:authorization(?:\s+limit)?|not[- ]?to[- ]?exceed(?:\s+amount)?|NTE)\.?/giu, "")
    .replace(/\s+within\s+(?:the\s+)?(?:existing\s+)?authorization(?:\s+limit)?/giu, "")
    .replace(/\s+before\s+exceeding\s+(?:the\s+)?(?:authorization(?:\s+limit)?|not[- ]?to[- ]?exceed(?:\s+amount)?|NTE)/giu, "")
    .replace(/\s+under\s+(?:the\s+)?(?:existing\s+)?(?:authorization(?:\s+limit)?|not[- ]?to[- ]?exceed(?:\s+amount)?|NTE)/giu, "")
    .replace(/\s{2,}/gu, " ")
    .replace(/\s+([,.;:])/gu, "$1")
    .replace(/([.!?])\s*([.!?])+/gu, "$1")
    .trim();

  return visible && !PUBLIC_FINANCIAL_CONTROL_PATTERN.test(visible) ? visible : fallback;
}
