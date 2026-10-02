import { vendorSearchTerm } from "./store-vendors";

/**
 * The words a search box matches: what the person typed plus the platform's
 * term for an everyday phrase ("ac" also finds "hvac"). Global search and the
 * list pages its "Review matching…" links open use the same terms, so a
 * drill-through shows the records that were counted.
 */
export function searchTerms(value: string | undefined | null): string[] {
  const typed = (value ?? "").trim().toLocaleLowerCase("en-US");
  if (!typed) return [];
  const platform = vendorSearchTerm(typed);
  return platform && platform !== typed ? [typed, platform] : [typed];
}

export function matchesSearchTerms(text: string, terms: readonly string[]): boolean {
  if (!terms.length) return true;
  const haystack = text.toLocaleLowerCase("en-US");
  return terms.some((term) => haystack.includes(term));
}

/** One `LIKE` per term, combined with OR; the caller supplies a lower-cased expression. */
export function likeAnySearchTerm(expression: string, terms: readonly string[], params: unknown[]): string {
  params.push(...terms.map((term) => `%${term}%`));
  return `(${terms.map(() => `${expression} LIKE ?`).join(" OR ")})`;
}
