import type { DashboardPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import type { DashboardActivitySummary, DashboardWindow } from "@/lib/ops/dashboard-query";
import type { DashboardContext } from "@/lib/ops/dashboard-context";
import type { DashboardLifecycleSummary } from "@/lib/ops/lifecycle-summary";
import type { AttentionPage } from "@/lib/ops/attention-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import { recordedMoneyLabel } from "@/lib/ops/work-review";
import { presentDashboard, presentDashboardJourney } from "./dashboard-presenter";
import { presentAttentionRow } from "./attention-presenter";
import { presentDashboardCharts, type DashboardChartPages } from "./dashboard-charts";
import { presentInvoiceSpotlight } from "./dashboard-context-presenter";

export interface DashboardQueryInputs {
  activity: DashboardActivitySummary; attention: AttentionPage; charts: DashboardChartPages;
  context: DashboardContext; lifecycle: DashboardLifecycleSummary;
}
export function presentQueryDashboard(data: DashboardQueryInputs, session: OperatorSession, window: DashboardWindow): DashboardPageViewModel {
  const candidate = data.lifecycle.spotlight;
  const spotlight: DashboardPageViewModel["spotlight"] = candidate ? {
    eyebrow: "Equipment review", title: `${candidate.workNumber} · ${candidate.stateLabel}`, description: candidate.assetName,
    facts: [
      { label: "Repair estimate", value: priceLabel(candidate.repairEstimate) },
      { label: candidate.replacementBasis, value: priceLabel(candidate.replacement) },
      { label: "Recorded cost · 12 months", value: recordedMoneyLabel(candidate.recordedCosts) },
    ],
    link: { href: `/app/lifecycle?${new URLSearchParams({ asset: candidate.assetId, decision: candidate.assetId, work: candidate.workId, view: "review", history: "12" })}`, label: "View costs and history" },
  } : undefined;
  // Multiple currencies stay separate. A single USD total keeps the familiar concise display.
  const estimates = data.lifecycle.replacementEstimates;
  const replacementEstimateLabel = estimates.length === 1 && estimates[0].currency === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(estimates[0].amountMinor / 100)
    : estimates.length ? estimates.map(amount => `${amount.currency} ${priceLabel(amount)}`).join(" · ") : "No estimates entered";
  return presentDashboard({
    activity: data.activity, costFrom: window.costFrom, costTo: window.costTo,
    pageBase: { scopeLabel: session.scopeLabel, periodLabel: `Rolling 12 months from ${formatOperationsDate(window.costFrom)}`, updatedLabel: `Source data through ${formatOperationsDate(window.asOf)}` },
    journey: presentDashboardJourney(data.activity, data.attention.followUpCount),
    review: { items: data.attention.items.map(item => presentAttentionRow(item, window.asOf)), totalCount: data.attention.totalCount, mineCount: data.attention.mineCount },
    repairComparisonCount: data.lifecycle.repairComparisonCount, replacementEstimateLabel,
    store: data.context.store, ...presentDashboardCharts(data.charts, data.activity, window, session.organizationName), spotlight,
    invoiceSpotlight: presentInvoiceSpotlight(data.context.invoice),
  }, session);
}
