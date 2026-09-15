import type { ActionItemViewModel, BreakdownViewModel, DashboardPageViewModel, OperatorSession, Tone, TrendViewModel } from "@/components/ops/data-contract";
import type { DashboardActivitySummary } from "@/lib/ops/dashboard-query";

/** Presentation accepts aggregate values and a bounded queue, never tenant source records. */
export interface DashboardPresentationData {
  activity: Pick<DashboardActivitySummary, "openWork" | "awaitingVendor" | "activeVisits" | "completedVisits" | "totalVisits" | "recordedCostMinor" | "costWorkOrders" | "invoiceRecords" | "watchAssets" | "upcomingAppointments">;
  pageBase: Pick<DashboardPageViewModel["page"], "scopeLabel" | "periodLabel" | "updatedLabel">;
  costFrom: string;
  costTo: string;
  journey: DashboardPageViewModel["journey"];
  review: { items: ActionItemViewModel[]; totalCount: number; mineCount: number };
  repairComparisonCount: number;
  replacementEstimateTotal: number;
  store?: { id: string; storeNumber: string };
  highestCostStore?: { id: string; label: string; value: number };
  storeBreakdown: BreakdownViewModel;
  categoryBreakdown: BreakdownViewModel;
  vendorAccountabilityBreakdown: BreakdownViewModel;
  workStatusBreakdown: BreakdownViewModel;
  activeVendorBreakdown: BreakdownViewModel;
  trend: TrendViewModel;
  spotlight?: DashboardPageViewModel["spotlight"];
  invoiceSpotlight?: DashboardPageViewModel["spotlight"];
}

function money(amountMinor: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amountMinor / 100); }
function hrefWithQuery(path: string, values: Record<string, string | undefined>) { const params = new URLSearchParams(Object.entries(values).filter((entry): entry is [string,string] => Boolean(entry[1]))); return params.size ? path + "?" + params.toString() : path; }

function dashboardShortcut(options: {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  dueLabel: string;
  ownerLabel: string;
  tone?: Tone;
  href: string;
  linkLabel: string;
}): ActionItemViewModel {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    categoryLabel: options.categoryLabel,
    dueLabel: options.dueLabel,
    ownerLabel: options.ownerLabel,
    tone: options.tone ?? "neutral",
    link: { href: options.href, label: options.linkLabel },
  };
}

export function presentDashboard(data: DashboardPresentationData, session: OperatorSession): DashboardPageViewModel {
  const { activity, pageBase, costFrom, costTo, journey, review, repairComparisonCount, replacementEstimateTotal, store, highestCostStore, storeBreakdown, categoryBreakdown, vendorAccountabilityBreakdown, workStatusBreakdown, activeVendorBreakdown, trend, spotlight, invoiceSpotlight } = data;
  if (session.role === "executive") {
    return {
      state: { kind: "ready" },
      layout: "executive",
      page: {
        ...pageBase,
        title: "Your company at a glance",
        eyebrow: "Owner overview",
        description: "See spending, open work, vendor activity, and upcoming equipment decisions across the company.",
        primaryAction: { label: "View spending", href: "/app/spend" },
        secondaryAction: { label: "Open reports", href: "/app/reports" },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(activity.recordedCostMinor), supportingText: "Entered work costs for the last 12 months", link: { href: "/app/spend", label: "See the costs" } },
        { id: "open-work", label: "Open work", value: String(activity.openWork), supportingText: "Every item has an owner and next step", tone: activity.openWork ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "See open work" } },
        { id: "open-exceptions", label: "Items to review", value: String(review.totalCount), supportingText: "Open the queue for source records and next steps", tone: review.totalCount ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
        { id: "watch-assets", label: "Equipment to review", value: String(activity.watchAssets), supportingText: "Equipment flagged for a closer look", tone: "warning", link: { href: "/app/equipment?status=watch", label: "Review equipment" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "executive-attention", title: `Review ${review.totalCount} item${review.totalCount === 1 ? "" : "s"}`, description: "Open the complete queue for source records, owners, and next steps.", categoryLabel: "Company overview", dueLabel: "Current", ownerLabel: "Maintenance leadership", tone: review.totalCount ? "warning" : "positive", href: "/app/action-center", linkLabel: "Open review queue" }),
        dashboardShortcut({ id: "executive-store-cost", title: highestCostStore ? `${highestCostStore.label} has the highest recorded cost` : "Compare store costs", description: highestCostStore ? `${money(highestCostStore.value)} of rolling recorded work cost; open the hierarchy and source work before drawing a conclusion.` : "No store cost is recorded in this period.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Operations leadership", tone: "info", href: highestCostStore ? hrefWithQuery("/app/spend", { store: highestCostStore.id }) : "/app/spend", linkLabel: "Explain the store total" }),
        dashboardShortcut({ id: "executive-capital", title: `${repairComparisonCount} repair comparison${repairComparisonCount === 1 ? "" : "s"} to review`, description: "Compare larger repairs with age, expected life, replacement cost, and service history.", categoryLabel: "Equipment planning", dueLabel: "Planning view", ownerLabel: "Maintenance and finance", tone: repairComparisonCount ? "warning" : "positive", href: "/app/lifecycle?reason=compare+alternatives", linkLabel: "Open equipment planning" }),
        dashboardShortcut({ id: "executive-reports", title: "Open reports", description: "Share or archive reports for open work, costs, vendors, preventive maintenance, and invoice review.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Leadership", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Owner decisions", description: "The company-level items most likely to need your attention.", link: { href: "/app/action-center", label: "See all" } },
      breakdowns: [storeBreakdown, vendorAccountabilityBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight,
    };
  }

  if (session.role === "finance") {
    return {
      state: { kind: "ready" },
      layout: "finance",
      page: {
        ...pageBase,
        title: "Maintenance cost and evidence",
        eyebrow: "Finance overview",
        description: "Review work costs, invoices, and equipment plans.",
        primaryAction: { label: "Explore recorded cost", href: "/app/spend" },
        secondaryAction: { label: "Review invoice safeguards", href: "/app/invoices" },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(activity.recordedCostMinor), supportingText: "Recorded costs for the last 12 months", link: { href: "/app/spend", label: "Explain the total" } },
        { id: "cost-work", label: "Cost-bearing work orders", value: String(activity.costWorkOrders), supportingText: "Work orders with entered cost in the rolling period", link: { href: hrefWithQuery("/app/work-orders", { hasCost: "true", costFrom, costTo: costTo }), label: "Open supporting work" } },
        { id: "invoice-references", label: "Invoice records", value: String(activity.invoiceRecords), supportingText: "All dates · available in your scope", tone: invoiceSpotlight ? "warning" : "neutral", link: { href: "/app/invoices", label: "Review invoices" } },
        { id: "replacement-estimates", label: "Current replacement outlook", value: money(replacementEstimateTotal), supportingText: "Current equipment planning estimates", tone: "info", link: { href: "/app/lifecycle?replacement=entered", label: "Open capital outlook" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "finance-invoices", title: `Review ${activity.invoiceRecords} invoice${activity.invoiceRecords === 1 ? "" : "s"}`, description: "Use operator work-order references and confirmed allocations as an optional safeguard; the platform does not approve or pay invoices.", categoryLabel: "Invoice safeguard", dueLabel: "Optional review", ownerLabel: "Finance", tone: invoiceSpotlight ? "warning" : "positive", href: "/app/invoices", linkLabel: "Open invoices" }),
        dashboardShortcut({ id: "finance-store-cost", title: "Compare recorded cost by store", description: "Move from each store total through service area, equipment, component, work order, and entered cost lines.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Finance and operations", tone: "info", href: "/app/stores?sort=cost", linkLabel: "Open store ranking" }),
        dashboardShortcut({ id: "finance-capital", title: "Review replacement planning evidence", description: `${money(replacementEstimateTotal)} is the current benchmark-based outlook, not an approved budget.`, categoryLabel: "Lifecycle & CapEx", dueLabel: "Planning view", ownerLabel: "Finance and facilities", href: "/app/lifecycle?replacement=entered", linkLabel: "Open capital outlook" }),
        dashboardShortcut({ id: "finance-reports", title: "View financial reports", description: "Recorded cost, work obligations, invoice references, and lifecycle evidence remain separate and traceable.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Finance", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Financial review paths", description: "Cost and evidence stay distinct so no amount is silently combined or treated as approved.", link: { href: "/app/reports", label: "Open source reports" } },
      breakdowns: [storeBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight: invoiceSpotlight ?? spotlight,
    };
  }

  if (session.role === "store_manager") {
    return {
      state: { kind: "ready" },
      layout: "store",
      page: {
        ...pageBase,
        title: store ? `Store ${store.storeNumber} at a glance` : "Your store at a glance",
        eyebrow: "Store manager home",
        description: "Report problems and follow work at your store.",
        primaryAction: { label: "Report an issue", href: "/app/requests/new" },
        secondaryAction: { label: "Review current work", href: "/app/work-orders?status=open" },
      },
      journey: journey,
      metrics: [
        { id: "open-work", label: "Open work", value: String(activity.openWork), supportingText: "Open work orders at this store", tone: activity.openWork ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open current work" } },
        { id: "vendor-response", label: "Waiting on vendor", value: String(activity.awaitingVendor), supportingText: "Sent work needing a response", tone: activity.awaitingVendor ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
        { id: "recorded-visits", label: "Recorded service visits", value: String(activity.totalVisits), supportingText: `${activity.activeVisits} onsite now · ${activity.completedVisits} completed`, tone: activity.activeVisits ? "info" : "neutral", link: { href: "/app/visits", label: "Open visit history" } },
        { id: "recorded-cost", label: "Recorded work cost", value: money(activity.recordedCostMinor), supportingText: "Rolling source cost for this store", link: { href: "/app/spend", label: "Explain the total" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "store-report", title: "Report a new store issue", description: "Describe what needs attention.", categoryLabel: "Issue intake", dueLabel: "When needed", ownerLabel: "Store team", tone: "info", href: "/app/requests/new", linkLabel: "Report an issue" }),
        dashboardShortcut({ id: "store-response", title: `${review.mineCount} need${review.mineCount === 1 ? "s" : ""} your response`, description: review.mineCount ? "These are decisions or confirmations assigned to the store-manager role, not every item facilities is handling." : "Nothing needs your response.", categoryLabel: "Needs your response", dueLabel: review.mineCount ? "Review now" : "Nothing waiting", ownerLabel: "Store manager", tone: review.mineCount ? "warning" : "positive", href: "/app/action-center?lane=mine", linkLabel: "Open your actions" }),
        dashboardShortcut({ id: "store-work", title: `${activity.openWork} work order${activity.openWork === 1 ? " is" : "s are"} being handled`, description: "See the next action and who owns it.", categoryLabel: "Being handled", dueLabel: "Current", ownerLabel: "Store and maintenance", tone: activity.openWork ? "info" : "positive", href: "/app/work-orders?status=open", linkLabel: "Open current work" }),
        dashboardShortcut({ id: "store-upcoming", title: `${activity.upcomingAppointments} upcoming confirmed appointment${activity.upcomingAppointments === 1 ? "" : "s"}`, description: "See confirmed vendor visits.", categoryLabel: "Upcoming visits", dueLabel: activity.upcomingAppointments ? "Scheduled" : "None scheduled", ownerLabel: "Vendor and facilities", href: "/app/visits?status=upcoming", linkLabel: "Open upcoming visits" }),
      ],
      prioritySection: { title: "Your store workflow", description: "Your store’s next steps.", link: { href: store ? `/app/stores/${store.id}` : "/app/stores", label: "Open complete store record" } },
      breakdowns: [categoryBreakdown],
      trends: [trend],
    };
  }

  const isFacilities = session.role === "facilities";
  return {
    state: { kind: "ready" },
    layout: isFacilities ? "operations" : "regional",
    page: {
      ...pageBase,
      title: isFacilities ? "Maintenance overview" : "Your region at a glance",
      eyebrow: isFacilities ? "Daily maintenance" : "Regional overview",
      description: isFacilities
        ? "Review work, visits, and costs across your stores."
        : "See stores, open work, vendor activity, and recorded costs across your region.",
      primaryAction: { label: "Review queue", href: "/app/action-center" },
      secondaryAction: { label: "Create work order", href: "/app/work-orders/new" },
    },
    journey: journey,
    metrics: isFacilities
      ? [
          { id: "open-exceptions", label: "Items to review", value: String(review.totalCount), supportingText: "Open the queue for records, owners, and next steps", tone: review.totalCount ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
          { id: "vendor-response", label: "Waiting on vendor", value: String(activity.awaitingVendor), supportingText: "Sent work needing a response", tone: activity.awaitingVendor ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
          { id: "active-visits", label: "Onsite visits", value: String(activity.activeVisits), supportingText: `${activity.totalVisits} total visits recorded`, tone: activity.activeVisits ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(activity.recordedCostMinor), supportingText: "Entered work costs for the last 12 months", link: { href: "/app/spend", label: "See the costs" } },
        ]
      : [
          { id: "open-work", label: "Open work", value: String(activity.openWork), supportingText: "Each item has an owner, next step, and due date", tone: activity.openWork ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "Open regional work" } },
          { id: "open-exceptions", label: "Items to review", value: String(review.totalCount), supportingText: "Open the regional queue for records and next steps", tone: review.totalCount ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
          { id: "active-visits", label: "Onsite visits", value: String(activity.activeVisits), supportingText: `${activity.totalVisits} recorded visits in regional scope`, tone: activity.activeVisits ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(activity.recordedCostMinor), supportingText: "Rolling source cost inside your region", link: { href: "/app/spend", label: "Explain the total" } },
        ],
    priorityActions: review.items,
    prioritySection: { title: "Review queue", description: isFacilities ? "Items waiting for a decision, update, or owner." : "Items waiting for action across stores in your region.", link: { href: "/app/action-center", label: "Open review queue" } },
    breakdowns: isFacilities ? [workStatusBreakdown, activeVendorBreakdown] : [storeBreakdown, categoryBreakdown],
    trends: [trend],
    spotlight,
  };
}
