export type ReportCatalogSource =
  | { kind: "list"; route: "visits" | "work-orders" | "stores" | "vendors" | "invoices"; query?: Record<string, string> }
  | { kind: "program"; route: "spend" | "pm" | "lifecycle"; query?: Record<string, string> };

export interface ReportCatalogEntry {
  id: string;
  title: string;
  description: string;
  definition: string;
  liveHref: string;
  source: ReportCatalogSource;
}

/**
 * Stable, brand-neutral report identifiers shared by the operator UI and
 * server-side export route. A display-name change must never invalidate a
 * saved report link or exported record definition.
 */
export const reportCatalog: readonly ReportCatalogEntry[] = [
  {
    id: "vendor-visit-accountability",
    title: "Vendor visit accountability",
    description: "Observed arrivals, departures, outcomes, location evidence, and unmatched-visit exceptions.",
    definition: "Observed presence and exception evidence; duration is approximate and is not certified labor.",
    liveHref: "/app/visits",
    source: { kind: "list", route: "visits" },
  },
  {
    id: "open-maintenance-obligations",
    title: "Open maintenance obligations",
    description: "Every unresolved work order with owner, next action, deadline, escalation, and service state.",
    definition: "Canonical work orders that have not reached closed or cancelled status.",
    liveHref: "/app/work-orders?status=open",
    source: { kind: "list", route: "work-orders", query: { status: "open" } },
  },
  {
    id: "store-cost-comparison",
    title: "Store cost comparison",
    description: "Compare store-level recorded work cost and continue into exact service-area and work-order evidence.",
    definition: "Recorded work-cost lines only; proposals, NTE amounts, and invoices are not silently combined.",
    liveHref: "/app/stores?sort=cost",
    source: { kind: "list", route: "stores", query: { sort: "cost" } },
  },
  {
    id: "recorded-maintenance-cost",
    title: "Recorded maintenance cost",
    description: "Cost trends and category rollups with the same scope, period, and cost basis carried into source work.",
    definition: "Entered work-cost lines grouped by their classified store and maintenance hierarchy.",
    liveHref: "/app/spend",
    source: { kind: "program", route: "spend" },
  },
  {
    id: "preventive-maintenance-compliance",
    title: "Preventive maintenance compliance",
    description: "Dated PM occurrences, completion windows, exceptions, and canonical work-order links.",
    definition: "Completed eligible occurrences divided by eligible occurrences whose compliance window has closed.",
    liveHref: "/app/pm",
    source: { kind: "program", route: "pm" },
  },
  {
    id: "lifecycle-capital-evidence",
    title: "Lifecycle and capital evidence",
    description: "Age, expected life, warranty, current repair, replacement outlook, repeat work, and source history.",
    definition: "Transparent human-review evidence; no opaque score or automatic replacement decision.",
    liveHref: "/app/lifecycle",
    source: { kind: "program", route: "lifecycle" },
  },
  {
    id: "invoice-reference-safeguards",
    title: "Invoice reference safeguards",
    description: "Optional invoice references, work-order matches, allocations, and unresolved balances for review.",
    definition: "Evidence review only; the platform does not approve or execute payment.",
    liveHref: "/app/invoices",
    source: { kind: "list", route: "invoices" },
  },
] as const;

export function reportCatalogEntry(id: string) {
  return reportCatalog.find((entry) => entry.id === id);
}
