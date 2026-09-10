/** Navigation hints only. The destination must reload its scoped queue before selecting a record. */
export function safeReviewQueue(value?: string | null) {
  try {
    const url = new URL(value || "/app/action-center", "https://ops.invalid");
    return url.origin === "https://ops.invalid" && url.pathname === "/app/action-center" ? `${url.pathname}${url.search}` : "/app/action-center";
  } catch { return "/app/action-center"; }
}

export function reviewItemHref(href: string, queue: string, item: string, following: string[]) {
  const url = new URL(href, "https://ops.invalid");
  url.searchParams.set("reviewQueue", safeReviewQueue(queue));
  url.searchParams.set("reviewItem", item);
  url.searchParams.set("reviewAfter", following.slice(0, 25).join(","));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function savedReviewHref(currentHref: string) {
  const current = new URL(currentHref);
  return `/app/action-center/next?${new URLSearchParams({ queue: safeReviewQueue(current.searchParams.get("reviewQueue")), previous: current.searchParams.get("reviewItem") ?? "", following: current.searchParams.get("reviewAfter") ?? current.searchParams.get("reviewNext") ?? "" })}`;
}

export function selectNextReview<T extends { id: string }>(rows: T[], previous: string | undefined, following: string | undefined) {
  const eligible = new Map(rows.filter((row) => row.id !== previous).map((row) => [row.id, row]));
  return (following ?? "").split(",").slice(0, 25).map((id) => eligible.get(id)).find(Boolean);
}

/** A return path to an equipment decision, never an external redirect or arbitrary route. */
export function safeDecisionReturn(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, "https://ops.invalid");
    if (url.origin !== "https://ops.invalid" || url.pathname !== "/app/lifecycle" || !url.searchParams.get("decision") || url.searchParams.get("asset") !== url.searchParams.get("decision")) return undefined;
    const params = new URLSearchParams();
    for (const key of ["asset", "decision", "view", "component", "history", "historyPage", "costPage"]) { const part = url.searchParams.get(key); if (part) params.set(key, part); }
    return `/app/lifecycle?${params}#decision-context`;
  } catch { return undefined; }
}
