import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  CircleGauge,
  Download,
  Info,
  TableProperties,
} from "lucide-react";
import type { MetricViewModel, Tone, TrendAnalysisPageViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import { TrendsFilterForm } from "./trends-filter-form";
import styles from "./trends-workspace.module.css";

function toneClass(tone: Tone = "neutral") {
  return styles[tone];
}

function SummaryCard({ metric }: { metric: MetricViewModel }) {
  return (
    <Link className={`${styles.summaryCard} ${toneClass(metric.tone)}`} href={metric.link.href}>
      <span>{metric.label}<ChevronRight size={16} aria-hidden="true" /></span>
      <strong>{metric.value}</strong>
      <p>{metric.supportingText}</p>
    </Link>
  );
}

function ComparisonChart({ model }: { model: TrendAnalysisPageViewModel }) {
  const values = model.series.flatMap((point) => [point.currentHasData ? point.currentValue : 0, point.comparisonHasData ? point.comparisonValue ?? 0 : 0]);
  const max = Math.max(...values, 1);
  return (
    <section className={styles.chartPanel} aria-labelledby="trend-chart-title">
      <header>
        <div>
          <p>Monthly trend</p>
          <h2 id="trend-chart-title">{model.metricLabel} by month</h2>
          <span>{model.metricDefinition}</span>
        </div>
        <div className={styles.legend} aria-label="Chart legend">
          <span><i className={styles.currentKey} /><span><strong>Selected {model.series.length} months</strong><small>{model.currentPeriodLabel}</small></span></span>
          {model.comparisonPeriodLabel ? <span><i className={styles.comparisonKey} /><span><strong>{model.comparisonLabel}</strong><small>{model.comparisonPeriodLabel}</small></span></span> : null}
        </div>
      </header>
      <div className={styles.chartScroller}>
        <div className={styles.chart}>
          {model.series.map((point) => {
            const tooltipId = `trend-tooltip-${point.id}`;
            return (
            <div className={`${styles.chartColumn} ${point.isPartialPeriod ? styles.partialColumn : ""}`} key={point.id}>
              <div className={styles.barValueRow}>
                <span>{point.currentFormattedValue}</span>
                {point.comparisonFormattedValue ? <span>{point.comparisonFormattedValue}</span> : null}
              </div>
              <div className={styles.barArea}>
                {point.currentHasData ? <Link
                  className={`${styles.currentBar} ${point.currentValue === 0 ? styles.zeroBar : ""}`}
                  href={point.currentLink.href}
                  aria-describedby={tooltipId}
                  aria-label={`${point.currentMonthLabel}: ${point.currentFormattedValue}. ${point.currentLink.label}`}
                  title={`${point.currentMonthLabel}: ${point.currentFormattedValue}`}
                  style={{ height: point.currentValue === 0 ? undefined : `${(point.currentValue / max) * 100}%` }}
                /> : <span className={styles.noDataBar} aria-label={`${point.currentMonthLabel}: no observations`} />}
                {point.comparisonLink && point.comparisonValue !== undefined && point.comparisonHasData ? (
                  <Link
                    className={`${styles.comparisonBar} ${point.comparisonValue === 0 ? styles.zeroBar : ""}`}
                    href={point.comparisonLink.href}
                    aria-describedby={tooltipId}
                    aria-label={`${point.comparisonMonthLabel}: ${point.comparisonFormattedValue}. ${point.comparisonLink.label}`}
                    title={`${point.comparisonMonthLabel}: ${point.comparisonFormattedValue}`}
                    style={{ height: point.comparisonValue === 0 ? undefined : `${(point.comparisonValue / max) * 100}%` }}
                  />
                ) : point.comparisonMonthLabel ? <span className={`${styles.noDataBar} ${styles.comparisonNoData}`} aria-label={`${point.comparisonMonthLabel}: no observations`} /> : null}
              </div>
              <strong>{point.label}{point.isPartialPeriod ? <small>MTD</small> : null}</strong>
              <span className={styles.chartTooltip} id={tooltipId} role="tooltip">
                <strong>{point.currentMonthLabel}{point.isPartialPeriod ? " · month to date" : ""}</strong>
                <span><i className={styles.currentKey} /><b>Selected dates</b><em>{point.currentFormattedValue}</em><small>{point.currentSourceCount} record{point.currentSourceCount === 1 ? "" : "s"}</small></span>
                {point.comparisonMonthLabel ? <span><i className={styles.comparisonKey} /><b>{point.comparisonMonthLabel}</b><em>{point.comparisonFormattedValue ?? "No data"}</em><small>{point.comparisonSourceCount ?? 0} record{point.comparisonSourceCount === 1 ? "" : "s"}</small></span> : null}
                {point.changeLabel ? <footer>Change · {point.changeLabel}</footer> : null}
              </span>
            </div>
          );})}
        </div>
      </div>
      <ol className={styles.mobileChartList} aria-label="Monthly trend values">
        {model.series.map((point) => <li key={`mobile-${point.id}`}><strong>{point.currentMonthLabel}{point.isPartialPeriod ? " · MTD" : ""}</strong><Link href={point.currentLink.href}>{point.currentFormattedValue}</Link>{point.comparisonMonthLabel ? <span>{point.comparisonMonthLabel}: {point.comparisonFormattedValue ?? "No data"}</span> : null}</li>)}
      </ol>
      <footer><Info size={16} aria-hidden="true" />{model.comparisonNote ? `${model.comparisonNote} ` : ""}Select a month to see its source records. Exact values remain available without hover.</footer>
    </section>
  );
}

function ExecutiveResults({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.executiveResults} aria-label="Trend results">
      <Link className={`${styles.mainResult} ${toneClass(model.mainResult.tone)}`} href={model.mainResult.link.href}>
        <span>Main result<ChevronRight size={16} aria-hidden="true" /></span>
        <strong>{model.mainResult.value}</strong>
        <p>{model.mainResult.absoluteChangeLabel}{model.mainResult.relativeChangeLabel ? ` · ${model.mainResult.relativeChangeLabel}` : ""}</p>
        <small>{model.mainResult.comparisonBasis} · {model.mainResult.evidenceLabel}</small>
      </Link>
      {model.insights.slice(0, 3).map((insight) => <Link className={`${styles.resultCard} ${toneClass(insight.tone)}`} href={insight.link.href} key={insight.id}><span>{insight.eyebrow}<ChevronRight size={16} aria-hidden="true" /></span><strong>{insight.title}</strong><p>{insight.detail}</p>{insight.evidenceLimit ? <small>{insight.evidenceLimit}</small> : null}<b>{insight.actionLabel ?? insight.link.label}</b></Link>)}
    </section>
  );
}

function Investigation({ model }: { model: TrendAnalysisPageViewModel }) {
  return <section className={styles.investigation} aria-labelledby="investigation-title">
    <header><Info size={17} aria-hidden="true" /><div><strong id="investigation-title">Investigation path</strong><span>Location, maintenance, and vendor filters stay visible as you move from a finding to its evidence.</span></div></header>
    <div className={styles.trails}>{model.investigation.trails.map((trail) => <div className={styles.trail} key={trail.id}><small>{trail.label}</small><nav aria-label={`${trail.label} filters`}>{trail.crumbs.map((crumb, index) => <span key={crumb.id}>{index ? <ChevronRight size={13} aria-hidden="true" /> : null}{crumb.link ? <Link href={crumb.link.href}>{crumb.label}</Link> : <strong>{crumb.label}</strong>}</span>)}</nav></div>)}</div>
    {model.investigation.evidence ? <aside><Info size={16} aria-hidden="true" /><div><strong>{model.investigation.evidence.label}</strong><span>{model.investigation.evidence.description}</span></div><Link href={model.investigation.evidence.clearLink.href}>{model.investigation.evidence.clearLink.label}</Link></aside> : null}
  </section>;
}

function VendorAccountability({ model }: { model: TrendAnalysisPageViewModel }) {
  const vendor = model.vendorAccountability;
  return <section className={styles.vendorPanel} aria-labelledby="vendor-accountability-title">
    <header><div><p>Vendor follow-through</p><h2 id="vendor-accountability-title">{vendor.title}</h2><span>{vendor.description}</span></div><Link href={vendor.outstandingLink.href}>{vendor.outstandingLink.label}<ArrowRight size={16} aria-hidden="true" /></Link></header>
    <div className={styles.vendorSummary}><span><small>Issuance cohort</small><strong>{vendor.cohortLabel}</strong></span><span><small>Response coverage</small><strong>{vendor.responseCoverageLabel}</strong></span><span><small>Awaiting response</small><strong>{vendor.awaitingCount}</strong></span><span><small>Overdue</small><strong>{vendor.overdueCount}</strong></span><span><small>Oldest outstanding</small><strong>{vendor.oldestOutstandingLabel}</strong></span></div>
    <div className={styles.responseMix}>{vendor.responseMix.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong><p>{item.description}</p></span>)}</div>
    <footer><Info size={16} aria-hidden="true" />{vendor.methodology}</footer>
  </section>;
}

function OutlookPanel({ model }: { model: TrendAnalysisPageViewModel }) {
  return <section className={`${styles.outlookPanel} ${styles[model.outlook.kind]}`}>
    <span><CircleGauge size={23} aria-hidden="true" /></span>
    <div><p>{model.outlook.eyebrow}</p><h2>{model.outlook.label}</h2><small>{model.outlook.description}</small></div>
    <strong>{model.outlook.value}</strong>
    <div className={styles.outlookMeta}>{model.outlook.facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></span>)}</div>
    <aside><Info size={16} aria-hidden="true" />{model.outlook.caution}</aside>
    {model.outlook.evidenceLink ? <Link className={styles.outlookEvidenceLink} href={model.outlook.evidenceLink.href}>{model.outlook.evidenceLink.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
  </section>;
}

function AnalysisViews({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <nav className={styles.analysisViews} aria-label="Trend analysis views">
      {model.views.map((view) => <Link className={view.id === model.activeView ? styles.activeView : undefined} href={view.link.href} key={view.id} aria-current={view.id === model.activeView ? "page" : undefined}><strong>{view.label}</strong><span>{view.description}</span></Link>)}
    </nav>
  );
}

function RelatedMeasures({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.relatedMeasures} aria-labelledby="related-measures-title">
      <header><p>Continue the investigation</p><h2 id="related-measures-title">Look at the same scope from another angle</h2><span>Operating, location, and maintenance scope stay in place. Measure-specific filters such as cost type may reset, and each measure uses its own recorded event date.</span></header>
      <div>
        {model.relatedMeasures.map((measure) => (
          <Link href={measure.link.href} key={measure.metricId} aria-label={measure.link.label}>
            <span>{measure.label}<ChevronRight size={16} aria-hidden="true" /></span>
            <strong>{measure.value}</strong>
            <small>{measure.comparisonLabel ? `${measure.comparisonLabel} · ` : ""}{measure.evidenceLabel}</small>
            <p>{measure.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DriversTable({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.tablePanel} id="change-drivers" aria-labelledby="drivers-title">
      <header>
        <div>
          <p>Where the change came from</p>
          <h2 id="drivers-title">{model.drivers.title}</h2>
          <span>{model.drivers.description}</span>
        </div>
        <strong>{model.drivers.sampleLabel}</strong>
      </header>
      <div className={styles.tableScroller}>
        <table className={styles.driverTable}>
          <caption>{model.drivers.reconciliationLabel}</caption>
          <thead><tr><th><SortHeading id="segment" links={model.drivers.sortLinks} /></th><th className={styles.number}><SortHeading id="current" links={model.drivers.sortLinks} /></th><th className={styles.number}><SortHeading id="comparison" links={model.drivers.sortLinks} /></th><th className={styles.number}><SortHeading id="change" links={model.drivers.sortLinks} /></th><th><SortHeading id="evidence" links={model.drivers.sortLinks} /></th><th>Actions</th></tr></thead>
          <tbody>
            {model.drivers.rows.length ? model.drivers.rows.map((row) => (
              <tr key={row.id}>
                <td><span className={styles.primaryRowLink}><strong>{row.label}</strong><small>{row.context}</small></span></td>
                <td className={styles.number}><strong>{row.currentLabel}</strong></td>
                <td className={styles.number}>{row.comparisonLabel}</td>
                <td className={styles.number}><strong>{row.changeLabel}</strong></td>
                <td><small>{row.shareLabel ? `${row.shareLabel} · ` : ""}{row.currentSourceCount} records now · {row.comparisonSourceCount} before</small></td>
                <td><div className={styles.rowActions}>{row.focusLink ? <Link className={styles.focusAction} href={row.focusLink.href} aria-label={row.focusLink.label}>Focus analysis</Link> : null}<Link className={styles.recordsAction} href={row.recordsLink.href} aria-label={row.recordsLink.label}>View records</Link></div></td>
              </tr>
            )) : <tr><td className={styles.empty} colSpan={6}>No change details are available for these filters and dates.</td></tr>}
          </tbody>
        </table>
      </div>
      {model.drivers.pagination ? <PaginationControls pagination={model.drivers.pagination} label="Change detail pages" /> : null}
    </section>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown size={14} aria-hidden="true" />;
  return direction === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />;
}

interface SortLinkModel {
  id: string;
  label: string;
  link: { href: string; label: string };
  active: boolean;
  direction?: "asc" | "desc";
}

function SortHeading({ id, links }: { id: string; links: SortLinkModel[] }) {
  const sort = links.find((entry) => entry.id === id);
  if (!sort) return null;
  return <Link className={`${styles.sortLink} ${sort.active ? styles.activeSort : ""}`} href={sort.link.href} aria-label={sort.link.label}>{sort.label}<SortIcon active={sort.active} direction={sort.direction} /></Link>;
}

function BenchmarkTable({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.tablePanel} id="store-comparison" aria-labelledby="benchmark-title">
      <header>
        <div>
          <p>Compare stores</p>
          <h2 id="benchmark-title">{model.benchmark.title}</h2>
          <span>{model.benchmark.description}</span>
        </div>
        <strong>{model.benchmark.sampleLabel}</strong>
      </header>
      <div className={`${styles.tableScroller} ${styles.storeTableScroller}`}>
        <table className={styles.benchmarkTable}>
          <caption>{model.benchmark.methodology}</caption>
          <thead><tr><th><SortHeading id="store" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="comparable" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="expected" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="variance" links={model.benchmark.sortLinks} /></th><th><SortHeading id="signal" links={model.benchmark.sortLinks} /></th><th><SortHeading id="coverage" links={model.benchmark.sortLinks} /></th></tr></thead>
          <tbody>
            {model.benchmark.rows.map((row) => (
              <tr key={row.id}>
                <td><span className={styles.primaryRowLink}><strong>{row.label}</strong><small>{row.context}</small><span className={styles.rowMiniActions}><Link href={row.focusLink.href}>Focus</Link><Link href={row.recordsLink.href}>Records</Link></span></span></td>
                <td className={styles.number}><strong>{row.comparableActualLabel}</strong>{row.excludedActualLabel ? <small>{row.excludedActualLabel}</small> : null}</td>
                <td className={styles.number}>{row.peerLink ? <Link className={styles.inlineCellLink} href={row.peerLink.href} aria-label={row.peerLink.label}>{row.rangeLabel}</Link> : row.rangeLabel}</td>
                <td className={styles.number}><strong>{row.varianceLabel}</strong></td>
                <td>
                  <span className={styles.findingCell}>
                    <span className={`${styles.signal} ${toneClass(row.signalTone)}`}>{row.signalLabel}</span>
                    {row.persistenceLabel ? <strong>{row.persistenceLabel}</strong> : null}
                    {row.findingExplanation ? <small>{row.findingExplanation}</small> : null}
                    {row.driverLink || row.largestRecordLink ? <span className={styles.findingActions}>{row.driverLink ? <Link href={row.driverLink.href} aria-label={row.driverLink.label}>Explain</Link> : null}{row.largestRecordLink ? <Link href={row.largestRecordLink.href} aria-label={row.largestRecordLink.label}>Largest record</Link> : null}</span> : null}
                  </span>
                </td>
                <td><small>{row.coverageLabel}{row.evidenceQualityLabel ? ` · ${row.evidenceQualityLabel}` : ""}{row.referenceHistoryLabel ? ` · ${row.referenceHistoryLabel}` : ""}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model.benchmark.pagination ? <PaginationControls pagination={model.benchmark.pagination} label="Store comparison pages" /> : null}
    </section>
  );
}

function SourceTable({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.tablePanel} id="source-records" aria-labelledby="source-title">
      <header>
        <div>
          <p>{model.sourceHeading}</p>
          <h2 id="source-title">{model.sourceMeasureLabel ?? model.metricLabel} · {model.sourcePeriodLabel}</h2>
          <span>{model.sourceDescription}</span>
        </div>
        <div className={styles.tableHeaderActions}>
          <TableProperties size={21} aria-hidden="true" />
          <a href={model.sourceExportLink.href} download aria-label={model.sourceExportLink.label}>Download records<Download size={16} aria-hidden="true" /></a>
        </div>
      </header>
      <div className={styles.tableScroller}>
        <table>
          <caption>{model.sourceTable.caption}</caption>
          <thead><tr>{model.sourceTable.columns.map((column) => <th className={column.align === "end" ? styles.number : undefined} key={column.key}><SortHeading id={column.key} links={model.sourceSortLinks} /></th>)}<th><span className={styles.visuallyHidden}>Open</span></th></tr></thead>
          <tbody>
            {model.sourceTable.rows.length ? model.sourceTable.rows.map((row) => (
              <tr key={row.id} id={row.id}>
                {row.cells.map((cell, index) => (
                  <td className={index === row.cells.length - 1 ? styles.number : undefined} key={cell.key}>
                    {index === 0 || cell.link
                      ? <Link className={styles.primaryRowLink} href={cell.link?.href ?? row.href}><strong>{cell.value}</strong>{cell.secondary ? <small>{cell.secondary}</small> : null}</Link>
                      : <span className={styles.plainCell}><strong>{cell.value}</strong>{cell.secondary ? <small>{cell.secondary}</small> : null}</span>}
                  </td>
                ))}
                <td><Link className={styles.rowAction} href={row.href} aria-label={`Open ${row.label}`}><ChevronRight size={17} aria-hidden="true" /></Link></td>
              </tr>
            )) : <tr><td className={styles.empty} colSpan={model.sourceTable.columns.length + 1}>No records match these filters and dates. Choose another month or broaden the filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {model.sourcePagination.totalPages > 1 ? <PaginationControls pagination={model.sourcePagination} label="Source record pages" /> : null}
    </section>
  );
}

export function TrendsWorkspace({ model }: { model: TrendAnalysisPageViewModel }) {
  const comparison = model.summary.find((metric) => metric.id === "comparison");
  const coverage = model.summary.find((metric) => metric.id === "coverage");
  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div><p>{model.page.eyebrow}</p><h1>{model.page.title}</h1><span>{model.page.description}</span></div>
        {model.page.secondaryAction ? <Link className={styles.secondaryButton} href={model.page.secondaryAction.href}>{model.page.secondaryAction.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <section className={styles.analysisContext} aria-label="Current analysis context">{model.analysisContext.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</section>
      {model.filterNotice ? <aside className={styles.filterNotice}><Info size={16} aria-hidden="true" />{model.filterNotice}</aside> : null}
      <ExecutiveResults model={model} />
      <TrendsFilterForm action={model.filterAction} activeView={model.activeView} clearHref={model.clearFiltersHref} filters={model.filters} scopeSummary={model.scopeSummary} />
      <Investigation model={model} />
      <AnalysisViews model={model} />

      {model.activeView === "overview" ? <>
        <ComparisonChart model={model} />
        <section className={styles.contextMetrics} aria-label="Comparison and data coverage">{comparison ? <SummaryCard metric={comparison} /> : null}{coverage ? <SummaryCard metric={coverage} /> : null}</section>
        <RelatedMeasures model={model} />
      </> : null}
      {model.activeView === "drivers" ? <DriversTable model={model} /> : null}
      {model.activeView === "stores" ? <BenchmarkTable model={model} /> : null}
      {model.activeView === "vendors" ? <VendorAccountability model={model} /> : null}
      {model.activeView === "planning" ? <OutlookPanel model={model} /> : null}
      {model.activeView === "records" ? <SourceTable model={model} /> : null}

      <details className={styles.notes}>
        <summary><Info size={17} aria-hidden="true" />How these numbers work<ChevronRight size={16} aria-hidden="true" /></summary>
        <ul>{model.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </details>
    </main>
  );
}
