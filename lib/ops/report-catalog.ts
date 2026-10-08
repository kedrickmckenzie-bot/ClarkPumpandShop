import type { ReportAudience } from "./reports/options";
import type { PeriodKey } from "./reports/period";

export type ReportCatalogSource =
  | { kind: "list"; route: "visits" | "work-orders" | "stores" | "vendors" | "invoices"; query?: Record<string, string> }
  | { kind: "program"; route: "spend" | "pm" | "lifecycle"; query?: Record<string, string> }
  /** Purpose-built reports with periods, comparisons and summary/all-records choices. */
  | { kind: "built"; defaultPeriod: PeriodKey };

export type ReportGroup = "leadership" | "vendors" | "team" | "operations";
export const REPORT_GROUPS: Record<ReportGroup, { title: string; description: string }> = {
  leadership: { title: "Owners and leadership", description: "Where the money went, what changed, and what needs a decision." },
  vendors: { title: "Vendors and accounts payable", description: "Vendor results and cross-checking vendor invoices against work orders." },
  team: { title: "In-house team", description: "What your own maintenance team got done." },
  operations: { title: "Day-to-day operations", description: "Open work, planned maintenance and detailed spending." },
};

/** Roles that may open a report when it names them; otherwise anyone who can open Reports. */
export type ReportRole = "executive" | "facilities" | "regional" | "finance" | "store_manager";

export interface ReportCatalogEntry {
  id: string;
  title: string;
  description: string;
  definition: string;
  liveHref: string;
  source: ReportCatalogSource;
  group: ReportGroup;
  /** Which side of the work it covers: outside vendors, the in-house team, or both. */
  audience: ReportAudience;
  roles?: readonly ReportRole[];
}

/**
 * Stable, brand-neutral report identifiers shared by the operator UI and
 * server-side export route. A display-name change must never invalidate a
 * saved report link or exported record definition.
 */
export const reportCatalog: readonly ReportCatalogEntry[] = [
  {
    id: "owner-summary",
    title: "Owner summary",
    description: "Two pages for owners and senior leaders: spending and what changed, vendors vs in-house, repeat problems, and decisions waiting.",
    definition: "Recorded work cost by service date, completed repairs, planned maintenance and open work, compared with the period before and last year.",
    liveHref: "/app/overview",
    source: { kind: "built", defaultPeriod: "last_month" },
    group: "leadership", audience: "both", roles: ["executive", "facilities", "regional", "finance"],
  },
  {
    id: "store-report",
    title: "Store report",
    description: "One store's work, spending and open items against the average store, or every store side by side.",
    definition: "Recorded work cost, repairs, open work and planned maintenance for the chosen stores.",
    liveHref: "/app/stores",
    source: { kind: "built", defaultPeriod: "last_month" },
    group: "leadership", audience: "both",
  },
  {
    id: "vendor-ap",
    title: "Vendor work for accounts payable",
    description: "Every vendor work order with our number, the vendor's ticket, recorded cost and linked invoices, plus the ones worth a second look.",
    definition: "Outside-vendor work orders finished, costed or invoiced in the period. Cross-reference only; nothing is approved or paid here.",
    liveHref: "/app/invoices",
    source: { kind: "built", defaultPeriod: "last_month" },
    group: "vendors", audience: "vendor", roles: ["executive", "facilities", "finance"],
  },
  {
    id: "vendor-performance",
    title: "Vendor performance",
    description: "Each vendor's jobs, spending, reply time, on-time arrival, first-visit fixes and repeat repairs.",
    definition: "Jobs first sent to each vendor in the period, using the same rules as Vendor scorecards.",
    liveHref: "/app/vendors/scorecards",
    source: { kind: "built", defaultPeriod: "last_quarter" },
    group: "vendors", audience: "vendor", roles: ["executive", "facilities", "regional", "finance"],
  },
  {
    id: "in-house-team",
    title: "In-house maintenance team",
    description: "What the team completed, store visits and onsite time, return visits, and work waiting on parts.",
    definition: "Jobs assigned to the in-house team. A workload view, not a performance rating.",
    liveHref: "/app/dispatch",
    source: { kind: "built", defaultPeriod: "last_month" },
    group: "team", audience: "in_house", roles: ["executive", "facilities", "regional"],
  },
  {
    id: "vendor-visit-accountability",
    title: "Store visit log",
    description: "Recorded check-ins, checkouts, outcomes, location evidence, and visits that need review.",
    definition: "Recorded visit and exception evidence. Time onsite is approximate and is not certified labor.",
    liveHref: "/app/visits",
    source: { kind: "list", route: "visits" },
    group: "vendors", audience: "both",
  },
  {
    id: "open-maintenance-obligations",
    title: "Open maintenance work",
    description: "Every unresolved work order with its owner, next step, due time, escalation, and status.",
    definition: "Canonical work orders that have not reached closed or cancelled status.",
    liveHref: "/app/work-orders?status=open",
    source: { kind: "list", route: "work-orders", query: { status: "open" } },
    group: "operations", audience: "both",
  },
  {
    id: "store-cost-comparison",
    title: "Spending by store",
    description: "Compare store-level recorded work cost and continue into exact service-area and work-order evidence.",
    definition: "Recorded work-cost lines for the rolling 12 months through the reporting date; proposals, NTE amounts, and invoices are not combined.",
    liveHref: "/app/stores?sort=cost",
    source: { kind: "list", route: "stores", query: { sort: "cost" } },
    group: "leadership", audience: "both",
  },
  {
    id: "recorded-maintenance-cost",
    title: "Spending detail",
    description: "Cost trends and category rollups with the same scope, period, and cost basis carried into source work.",
    definition: "Entered work-cost lines grouped by their classified store and maintenance hierarchy.",
    liveHref: "/app/spend",
    source: { kind: "program", route: "spend" },
    group: "operations", audience: "both",
  },
  {
    id: "preventive-maintenance-compliance",
    title: "Preventive maintenance",
    description: "Dated PM occurrences, completion windows, exceptions, and canonical work-order links.",
    definition: "Completed eligible occurrences divided by eligible occurrences whose compliance window has closed.",
    liveHref: "/app/pm",
    source: { kind: "program", route: "pm" },
    group: "operations", audience: "both",
  },
  {
    id: "lifecycle-capital-evidence",
    title: "Repair or replace planning",
    description: "Age, expected life, warranty, current repair, replacement outlook, repeat work, and history.",
    definition: "Transparent human-review evidence; no opaque score or automatic replacement decision.",
    liveHref: "/app/lifecycle",
    source: { kind: "program", route: "lifecycle" },
    group: "leadership", audience: "both",
  },
  {
    id: "invoice-reference-safeguards",
    title: "Invoice review",
    description: "Optional invoice references, work-order matches, allocations, and unresolved balances for review.",
    definition: "Evidence review only; the platform does not approve or execute payment.",
    liveHref: "/app/invoices",
    source: { kind: "list", route: "invoices" },
    group: "vendors", audience: "vendor",
  },
] as const;

export function reportCatalogEntry(id: string) {
  return reportCatalog.find((entry) => entry.id === id);
}
