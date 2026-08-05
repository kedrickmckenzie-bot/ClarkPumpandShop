"use client";

import {
  ArrowRight,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Gauge,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "@/components/site-link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, MetricCard, PageHeader, PanelTitle, StatusBadge } from "@/components/ui";
import {
  classificationCoverage,
  commandCenterMetrics,
  formatCurrency,
  formatDate,
  formatPercent,
  isOpenWorkOrder,
  pmCompliance,
  replacementWatchlist,
  spendForPeriod,
  storeComparison,
  trailingPeriods,
} from "@/lib/domain/analytics";
import type { DemoData } from "@/lib/domain/types";
import { demoData, DEMO_NOW, STORY_ASSET_ID } from "@/lib/demo/data";
import { priorityLabel, statusTone, workOrderStatusLabel } from "@/lib/presentation";

type FilterState = { regionId: string; storeId: string; categoryId: string; vendorId: string };

function scopedData(source: DemoData, filters: FilterState): DemoData {
  const selectedStores = source.stores.filter((store) => (!filters.regionId || store.regionId === filters.regionId) && (!filters.storeId || store.id === filters.storeId));
  const storeIds = new Set(selectedStores.map((store) => store.id));
  const workOrders = source.workOrders.filter((workOrder) => storeIds.has(workOrder.storeId) && (!filters.categoryId || workOrder.categoryId === filters.categoryId) && (!filters.vendorId || workOrder.vendorId === filters.vendorId));
  const workOrderIds = new Set(workOrders.map((workOrder) => workOrder.id));
  const selectedSystems = source.systems.filter((system) => storeIds.has(system.storeId) && (!filters.categoryId || system.categoryId === filters.categoryId));
  const systemIds = new Set(selectedSystems.map((system) => system.id));
  const selectedAssets = source.assets.filter((asset) => systemIds.has(asset.storeSystemId));
  const assetIds = new Set(selectedAssets.map((asset) => asset.id));
  const invoiceIds = new Set(source.invoices.filter((invoice) => workOrderIds.has(invoice.workOrderId)).map((invoice) => invoice.id));
  const plans = source.pmPlans.filter((plan) => (!filters.categoryId || plan.categoryId === filters.categoryId) && (!filters.vendorId || plan.vendorId === filters.vendorId));
  const planIds = new Set(plans.map((plan) => plan.id));
  return {
    ...source,
    stores: selectedStores,
    systems: selectedSystems,
    assets: selectedAssets,
    components: source.components.filter((component) => assetIds.has(component.assetId)),
    workOrders,
    vendorResponses: source.vendorResponses.filter((response) => workOrderIds.has(response.workOrderId)),
    visits: source.visits.filter((visit) => workOrderIds.has(visit.workOrderId)),
    followUps: source.followUps.filter((followUp) => workOrderIds.has(followUp.workOrderId)),
    pmPlans: plans,
    pmOccurrences: source.pmOccurrences.filter((occurrence) => storeIds.has(occurrence.storeId) && planIds.has(occurrence.planId)),
    quotes: source.quotes.filter((quote) => workOrderIds.has(quote.workOrderId)),
    authorizations: source.authorizations.filter((authorization) => workOrderIds.has(authorization.workOrderId)),
    invoices: source.invoices.filter((invoice) => invoiceIds.has(invoice.id)),
    credits: source.credits.filter((credit) => invoiceIds.has(credit.invoiceId)),
    allocations: source.allocations.filter((allocation) => invoiceIds.has(allocation.invoiceId)),
    reports: source.reports.filter((report) => storeIds.has(report.storeId)),
    reportReviews: source.reportReviews,
    documents: source.documents.filter((document) => !document.workOrderId || workOrderIds.has(document.workOrderId)),
    auditEvents: source.auditEvents,
  };
}

export function CommandCenter() {
  const [filters, setFilters] = useState<FilterState>({ regionId: "", storeId: "", categoryId: "", vendorId: "" });
  const data = useMemo(() => scopedData(demoData, filters), [filters]);
  const metrics = commandCenterMetrics(data, DEMO_NOW);
  const coverage = classificationCoverage(data);
  const stores = storeComparison(data, DEMO_NOW).sort((a, b) => Number(b.isOutlier) - Number(a.isOutlier) || b.spend - a.spend);
  const watchlist = replacementWatchlist(data, DEMO_NOW);
  const { now, ttmStart, priorStart } = trailingPeriods(DEMO_NOW);
  const openWork = data.workOrders
    .filter(isOpenWorkOrder)
    .sort((a, b) => (a.priority === "critical" ? -1 : 1) - (b.priority === "critical" ? -1 : 1) || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, 6);
  const storeOptions = demoData.stores.filter((store) => !filters.regionId || store.regionId === filters.regionId);
  const store45 = stores.find((row) => row.store.id === "store-45");

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "regionId" ? { storeId: "" } : {}) }));
  }

  return (
    <AppShell>
      <div className="page">
        <Breadcrumbs items={[{ label: "Company" }, { label: "Command Center" }]} />
        <PageHeader
          eyebrow="Owner command center"
          title="Operational control, not activity noise."
          description="Exceptions, commitments and asset signals derived from 128 internal work orders across the demonstration period. Every number opens the records behind it."
        >
          <span className="period-chip"><CalendarCheck2 size={14} />Trailing 12 months · Aug 5, 2026</span>
        </PageHeader>

        <div className="filter-bar" aria-label="Command center filters">
          <div className="filter-field"><label htmlFor="region-filter">Region</label><select id="region-filter" value={filters.regionId} onChange={(event) => updateFilter("regionId", event.target.value)}><option value="">All regions</option>{demoData.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="store-filter">Store</label><select id="store-filter" value={filters.storeId} onChange={(event) => updateFilter("storeId", event.target.value)}><option value="">All stores</option>{storeOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="category-filter">Service category</label><select id="category-filter" value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)}><option value="">All categories</option>{demoData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="vendor-filter">Vendor</label><select id="vendor-filter" value={filters.vendorId} onChange={(event) => updateFilter("vendorId", event.target.value)}><option value="">All vendors</option>{demoData.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shortName}</option>)}</select></div>
          <div className="filter-summary">{data.stores.length} stores · {data.workOrders.length} work orders in scope</div>
        </div>

        <section className="brief-grid" aria-label="Control brief">
          <div className="control-brief">
            <div className="control-kicker"><span className="signal" />Today&apos;s control brief · Wednesday, August 5</div>
            <h2>{metrics.openCritical + metrics.overdueFollowUps + metrics.awaitingVendor} exceptions need an accountable next move.</h2>
            <p>Critical work, overdue follow-through and vendor acceptance are separated from routine volume so leadership can see what could be lost, late or left unresolved.</p>
            <div className="brief-actions">
              <Link className="brief-action" href="/work-orders?priority=critical"><strong>{metrics.openCritical}</strong> critical work orders <ArrowRight size={13} /></Link>
              <Link className="brief-action" href="/work-orders?queue=overdue"><strong>{metrics.overdueFollowUps}</strong> overdue follow-ups <ArrowRight size={13} /></Link>
              <Link className="brief-action" href="/work-orders?acceptance=pending"><strong>{metrics.awaitingVendor}</strong> awaiting vendor <ArrowRight size={13} /></Link>
              <Link className="brief-action" href="/work-orders?queue=missing-action"><strong>{metrics.missingNextAction}</strong> without a next action <ArrowRight size={13} /></Link>
            </div>
          </div>
          <div className="panel panel-pad spend-panel">
            <PanelTitle title="Maintenance spend" description="Paid cost and open commitments, kept distinct." />
            <div className="spend-total">
              <span className="spend-label">Trailing 12 months · paid</span>
              <strong>{formatCurrency(metrics.ttmSpend)}</strong>
              <div className="spend-delta"><StatusBadge tone={metrics.ttmSpend >= metrics.priorTtmSpend ? "warning" : "good"}>{metrics.ttmSpend >= metrics.priorTtmSpend ? "+" : ""}{formatPercent(metrics.priorTtmSpend ? (metrics.ttmSpend - metrics.priorTtmSpend) / metrics.priorTtmSpend : 0)}</StatusBadge><span>vs {formatCurrency(metrics.priorTtmSpend)} prior TTM</span></div>
            </div>
            <div className="spend-breakdown">
              <div className="spend-item"><span>Year to date</span><strong>{formatCurrency(metrics.currentYear)}</strong><small className={metrics.yearChange > 0 ? "trend-up" : "trend-down"}>{metrics.yearChange >= 0 ? "+" : ""}{formatPercent(metrics.yearChange)} vs prior YTD</small></div>
              <div className="spend-item commitment"><span>Approved, not invoiced</span><strong>{formatCurrency(metrics.approvedNotInvoiced)}</strong><small>Commitment · excluded from paid spend</small></div>
            </div>
            <Link className="spend-footer" href="/files">Review {metrics.invoicesReview} invoices waiting for review <ArrowRight size={13} /></Link>
          </div>
        </section>

        <section className="metric-grid" aria-label="Company metrics">
          <MetricCard label="Open critical work" value={String(metrics.openCritical)} note="non-terminal company records" icon={ShieldAlert} href="/work-orders?priority=critical" tone="critical" />
          <MetricCard label="Overdue follow-ups" value={String(metrics.overdueFollowUps)} note="past the retained due date" icon={Clock3} href="/work-orders?queue=overdue" tone="warning" />
          <MetricCard label="PM compliance" value={formatPercent(metrics.pm.value)} note={`${metrics.pm.numerator} of ${metrics.pm.denominator} eligible occurrences`} icon={ClipboardCheck} href="/pm" tone={metrics.pm.value >= .9 ? "good" : "warning"} />
          <MetricCard label="Awaiting vendor" value={String(metrics.awaitingVendor)} note="issued, no acceptance yet" icon={Wrench} href="/work-orders?acceptance=pending" tone="warning" />
          <MetricCard label="TTM maintenance spend" value={formatCurrency(metrics.ttmSpend, true)} note={`prior ${formatCurrency(metrics.priorTtmSpend, true)}`} icon={CircleDollarSign} href="/files" trend={{ label: `${metrics.ttmSpend >= metrics.priorTtmSpend ? "+" : ""}${formatPercent(metrics.priorTtmSpend ? (metrics.ttmSpend - metrics.priorTtmSpend) / metrics.priorTtmSpend : 0)}`, direction: metrics.ttmSpend >= metrics.priorTtmSpend ? "up" : "down" }} />
          <MetricCard label="Invoices in review" value={String(metrics.invoicesReview)} note="not included in paid spend" icon={ReceiptText} href="/files?status=review" />
          <MetricCard label="Replacement watchlist" value={String(metrics.replacementCandidates)} note="rule-based capital review" icon={Gauge} href={`/assets/${STORY_ASSET_ID}`} tone="warning" />
          <MetricCard label="Store cost outliers" value={String(metrics.outlierStores)} note="median / percentile rule" icon={TrendingUp} href="/stores" tone="critical" />
        </section>

        <section className="split-grid">
          <div className="panel">
            <div className="panel-pad" style={{ paddingBottom: 8 }}><PanelTitle title="Operational exception queue" description="Sorted by criticality and next-action due date." href="/work-orders" linkLabel="Open command view" /></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Work order</th><th>Store / category</th><th>Priority</th><th>Status</th><th>Accountable now</th><th>Next action due</th></tr></thead>
                <tbody>{openWork.map((workOrder) => {
                  const store = demoData.stores.find((candidate) => candidate.id === workOrder.storeId);
                  const category = demoData.categories.find((candidate) => candidate.id === workOrder.categoryId);
                  return <tr key={workOrder.id}><td><Link className="row-link mono" href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><span className="subtext">{workOrder.title}</span></td><td><Link className="row-link" href={`/stores/${workOrder.storeId}`}>{store?.name}</Link><span className="subtext">{category?.name}</span></td><td><StatusBadge tone={workOrder.priority === "critical" ? "critical" : workOrder.priority === "high" ? "warning" : "neutral"}>{priorityLabel[workOrder.priority]}</StatusBadge></td><td><StatusBadge tone={statusTone(workOrder.status)}>{workOrderStatusLabel[workOrder.status]}</StatusBadge></td><td>{workOrder.accountableParty}<span className="subtext">{workOrder.nextAction}</span></td><td className="mono">{workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "—"}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </div>
          <div className="stack">
            <div className="panel panel-pad">
              <PanelTitle title="Category posture" description="TTM posted spend and on-time PM." href="/systems/refrigeration" linkLabel="Open explorer" />
              {demoData.categories.map((category) => {
                const current = spendForPeriod(data, ttmStart, now, { categoryId: category.id });
                const prior = spendForPeriod(data, priorStart, ttmStart, { categoryId: category.id });
                const compliance = pmCompliance(data, { categoryId: category.id }, DEMO_NOW);
                return <Link key={category.id} href={`/systems/${category.id}`} className="exception-row"><span className={`exception-bar ${category.id === "refrigeration" && store45?.isOutlier ? "red" : ""}`} /><span className="exception-copy"><strong>{category.name}</strong><span>{formatCurrency(current)} TTM · {prior ? `${formatPercent((current - prior) / prior)} vs prior` : "no prior"} · {formatPercent(compliance.value)} PM</span></span><ArrowRight size={14} /></Link>;
              })}
            </div>
            <div className="panel panel-pad">
              <PanelTitle title="Data coverage" description="Useful now; deeper asset insight grows with classification." />
              <div className="coverage-grid">
                <div className="coverage-item"><strong>{formatPercent(coverage.categorized)}</strong><span>work orders categorized</span></div>
                <div className="coverage-item"><strong>{formatPercent(coverage.systemMapped)}</strong><span>mapped to a store system</span></div>
                <div className="coverage-item"><strong>{formatPercent(coverage.assetSpend)}</strong><span>paid spend mapped to assets</span></div>
                <div className="coverage-item"><strong>{formatPercent(coverage.componentSpend)}</strong><span>paid spend mapped to components</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="split-grid">
          <div className="panel">
            <div className="panel-pad" style={{ paddingBottom: 8 }}><PanelTitle title="Store comparison" description="TTM spend, on-time PM and explainable outlier state." href="/stores" linkLabel="Compare all stores" /></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Store</th><th className="numeric">Open</th><th className="numeric">TTM spend</th><th>PM compliance</th><th className="numeric">Repeat visits</th><th>Signal</th></tr></thead>
                <tbody>{stores.slice(0, 6).map((row) => <tr key={row.store.id}><td><Link className="row-link" href={`/stores/${row.store.id}`}>{row.store.name}</Link><span className="subtext">{demoData.regions.find((region) => region.id === row.store.regionId)?.name}</span></td><td className="numeric">{row.openCount}</td><td className="numeric"><strong>{formatCurrency(row.spend)}</strong><span className="subtext">{row.change >= 0 ? "+" : ""}{formatPercent(row.change)} vs prior TTM</span></td><td><div className="progress-row" style={{ gridTemplateColumns: "1fr 36px", margin: 0 }}><div className="progress-track"><div className="progress-fill" style={{ width: formatPercent(row.pm.value) }} /></div><strong>{formatPercent(row.pm.value)}</strong></div></td><td className="numeric">{row.repeatVisits}</td><td>{row.isOutlier ? <StatusBadge tone="critical">{row.outlierRatio.toFixed(1)}× median</StatusBadge> : <StatusBadge tone="good">Within range</StatusBadge>}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="panel panel-pad">
            <PanelTitle title="Capital review" description="Recommendations show reasons, never a hidden score." />
            {watchlist.length ? watchlist.slice(0, 2).map(({ asset, analysis }) => {
              const system = demoData.systems.find((candidate) => candidate.id === asset.storeSystemId);
              const store = demoData.stores.find((candidate) => candidate.id === system?.storeId);
              return <Link key={asset.id} href={`/assets/${asset.id}`} className="exception-row"><span className="exception-bar red" /><span className="exception-copy"><strong>{store?.name} · {asset.name}</strong><span>{formatCurrency(analysis.currentReactive)} reactive repairs · {formatPercent(analysis.burden)} of replacement · {analysis.reasons.length} reasons</span></span><ArrowRight size={14} /></Link>;
            }) : <div className="empty-state">No assets in the selected scope meet the review rule.</div>}
            {watchlist.length > 0 && <div className="callout warning" style={{ marginTop: 10 }}><strong>Recommendation: capital review, not automatic replacement</strong><p>Open the asset to see age, repair trend, visits, failures, PM and each rule threshold.</p></div>}
          </div>
        </section>

        {store45?.isOutlier && !filters.storeId && !filters.vendorId && (!filters.categoryId || filters.categoryId === "refrigeration") && (
          <section className="panel panel-pad" aria-label="Featured outlier">
            <PanelTitle title="Explainable outlier · Store 45 Refrigeration" description="Correlation in the records; no claim that one factor caused the total." />
            <div className="triple-grid" style={{ marginBottom: 0 }}>
              <Link className="callout danger" href={`/assets/${STORY_ASSET_ID}`}><strong>Beer Cave CU-1</strong><p>{formatCurrency(store45.refrigerationSpend)} TTM store refrigeration spend; CU-1 carries the principal classified burden.</p></Link>
              <Link className="callout warning" href="/work-orders/wo-0245"><strong>Repeat visits and emergency premium</strong><p>Six verified visits on the candidate asset and multiple emergency-class allocations in the period.</p></Link>
              <Link className="callout" href="/pm"><strong>Missed preventive maintenance</strong><p>The April occurrence remains missed and reduces Store 45 / Beer Cave compliance.</p></Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
