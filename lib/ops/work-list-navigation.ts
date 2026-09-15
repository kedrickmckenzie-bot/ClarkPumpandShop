type Query = Record<string, string | string[] | undefined>;
const first = (value: Query[string]) => Array.isArray(value) ? value[0] : value;

/** Switching queues keeps the user's evidence scope, not incompatible workflow filters. */
export function workListNavigation(query: Query) {
  const status = first(query.status);
  const selected = status === "history" || status === "closed" || status === "cancelled"
    ? "history" : status === "all" ? "all" : status || first(query.stage) || first(query.visitPlan) || first(query.appointment) ? "open" : "all";
  return [
    { value: "open", label: "Active" },
    { value: "history", label: "History" },
    { value: "all", label: "All work" },
  ].map((view) => {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      if (["status", "stage", "visitPlan", "reviewWindow", "opportunity", "matchStore", "storeGroup", "appointment", "page", "selected"].includes(key)) continue;
      const value = first(raw);
      if (value) params.set(key, value);
    }
    params.set("status", view.value);
    return { ...view, selected: selected === view.value, href: `/app/work-orders${params.size ? `?${params}` : ""}` };
  });
}
