export const scenarioKeys = ["planTarget", "planAllowance", "planContingency"] as const;

/** Personal planning assumptions; never authorization, incurred cost, or a ledger. */
export function planningScenario(query: URLSearchParams, estimatesMinor: number) {
  const parse = (key: string) => {
    const raw = query.get(key)?.trim() ?? "";
    if (!raw) return undefined;
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return undefined;
    const [whole, decimal = ""] = raw.split(".");
    return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  };
  const target = parse("planTarget");
  const allowance = parse("planAllowance") ?? 0;
  const contingency = parse("planContingency") ?? 0;
  const total = estimatesMinor + allowance + contingency;
  return { target, allowance, contingency, total, gap: target === undefined ? undefined : target - total,
    invalid: scenarioKeys.some((key) => Boolean(query.get(key)) && parse(key) === undefined) };
}
