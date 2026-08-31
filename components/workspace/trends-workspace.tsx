import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronRight,
  CircleGauge,
  Download,
  Filter,
  Info,
  Lightbulb,
  LineChart,
  Search,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import type { MetricViewModel, Tone, TrendAnalysisPageViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
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
        <div className={styles.chart} style={{ minWidth: `${Math.max(900, model.series.length * 78)}px` }}>
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
                  style={{ height: point.currentValue === 0 ? undefined : `${Math.max(5, (point.currentValue / max) * 100)}%` }}
                /> : <span className={styles.noDataBar} aria-label={`${point.currentMonthLabel}: no observations`} />}
                {point.comparisonLink && point.comparisonValue !== undefined && point.comparisonHasData ? (
                  <Link
                    className={`${styles.comparisonBar} ${point.comparisonValue === 0 ? styles.zeroBar : ""}`}
                    href={point.comparisonLink.href}
                    aria-describedby={tooltipId}
                    aria-label={`${point.comparisonMonthLabel}: ${point.comparisonFormattedValue}. ${point.comparisonLink.label}`}
                    title={`${point.comparisonMonthLabel}: ${point.comparisonFormattedValue}`}
                    style={{ height: point.comparisonValue === 0 ? undefined : `${Math.max(5, (point.comparisonValue / max) * 100)}%` }}
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
      <footer><Info size={16} aria-hidden="true" />{model.comparisonNote ? `${model.comparisonNote} ` : ""}Hover over a month to compare it. Click a bar to see the records included.</footer>
    </section>
  );
}

function InsightStrip({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.insightStrip} aria-label="Analysis highlights">
      {model.insights.map((insight) => (
        <Link className={`${styles.insightCard} ${toneClass(insight.tone)}`} href={insight.link.href} key={insight.id}>
          <span><Lightbulb size={16} aria-hidden="true" />{insight.eyebrow}<ChevronRight size={16} aria-hidden="true" /></span>
          <strong>{insight.title}</strong>
          <p>{insight.detail}</p>
        </Link>
      ))}
    </section>
  );
}

function InvestigationContext({ model }: { model: TrendAnalysisPageViewModel }) {
  return (
    <section className={styles.investigation} aria-label="Current investigation scope">
      <header><Search size={17} aria-hidden="true" /><div><strong>Investigation scope</strong><span>These trails control every total, chart, driver, and store comparison on this page.</span></div></header>
      <div className={styles.trails}>
        {model.investigation.trails.map((trail) => (
          <div className={styles.trail} key={trail.id}>
            <small>{trail.label}</small>
            <nav aria-label={`${trail.label} scope`}>
              {trail.crumbs.map((crumb, index) => (
                <span key={crumb.id}>
                  {index ? <ChevronRight size={14} aria-hidden="true" /> : null}
                  {crumb.link ? <Link href={crumb.link.href} aria-label={crumb.link.label}>{crumb.label}</Link> : <strong>{crumb.label}</strong>}
                </span>
              ))}
            </nav>
          </div>
        ))}
      </div>
      {model.investigation.evidence ? (
        <aside><Info size={16} aria-hidden="true" /><div><strong>Exact records shown: {model.investigation.evidence.label}</strong><span>{model.investigation.evidence.description}</span></div><Link href={model.investigation.evidence.clearLink.href}>{model.investigation.evidence.clearLink.label}</Link></aside>
      ) : null}
    </section>
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
        <table>
          <caption>{model.benchmark.methodology}</caption>
          <thead><tr><th><SortHeading id="store" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="actual" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="comparable" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="expected" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="variance" links={model.benchmark.sortLinks} /></th><th className={styles.number}><SortHeading id="ratio" links={model.benchmark.sortLinks} /></th><th><SortHeading id="signal" links={model.benchmark.sortLinks} /></th><th><SortHeading id="coverage" links={model.benchmark.sortLinks} /></th><th>Actions</th></tr></thead>
          <tbody>
            {model.benchmark.rows.map((row) => (
              <tr key={row.id}>
                <td><span className={styles.primaryRowLink}><strong>{row.label}</strong><small>{row.context}</small></span></td>
                <td className={styles.number}><strong>{row.actualLabel}</strong>{row.excludedActualLabel ? <small>{row.excludedActualLabel}</small> : null}</td>
                <td className={styles.number}>{row.comparableActualLabel}</td>
                <td className={styles.number}>{row.peerLink ? <Link className={styles.inlineCellLink} href={row.peerLink.href} aria-label={row.peerLink.label}>{row.expectedLabel}</Link> : row.expectedLabel}</td>
                <td className={styles.number}><strong>{row.varianceLabel}</strong></td>
                <td className={styles.number}>{row.ratioLabel}</td>
                <td><span className={`${styles.signal} ${toneClass(row.signalTone)}`}>{row.signalLabel}</span></td>
                <td><small>{row.coverageLabel}</small></td>
                <td><div className={styles.rowActions}><Link className={styles.focusAction} href={row.focusLink.href} aria-label={row.focusLink.label}>Focus analysis</Link><Link className={styles.recordsAction} href={row.recordsLink.href} aria-label={row.recordsLink.label}>View records</Link></div></td>
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
          <h2 id="source-title">{model.metricLabel} · {model.sourcePeriodLabel}</h2>
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
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td className={index === row.cells.length - 1 ? styles.number : undefined} key={cell.key}>
                    {index === 0
                      ? <Link className={styles.primaryRowLink} href={row.href}><strong>{cell.value}</strong>{cell.secondary ? <small>{cell.secondary}</small> : null}</Link>
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
  const groupedFilters = [
    { id: "analysis", label: "What to compare", description: "Choose what to track, the dates, and how you want the change grouped." },
    { id: "operating_scope", label: "Locations", description: "Show the whole company, one region, or one store." },
    { id: "maintenance_scope", label: "More filters", description: "Optional filters for work type, equipment, component, or vendor." },
  ] as const;
  const hasMaintenanceScope = model.filters.some((filter) => filter.group === "maintenance_scope" && Boolean(filter.value));
  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div><p>{model.page.eyebrow}</p><h1>{model.page.title}</h1><span>{model.page.description}</span></div>
        {model.page.secondaryAction ? <Link className={styles.secondaryButton} href={model.page.secondaryAction.href}>{model.page.secondaryAction.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <section className={styles.contextBar} aria-label="Current trend context">
        <span><BarChart3 size={17} aria-hidden="true" /><small>Showing</small><strong>{model.page.scopeLabel}</strong></span>
        <span><LineChart size={17} aria-hidden="true" /><small>{model.currentPeriodName}</small><strong>{model.currentPeriodLabel}</strong></span>
        {model.comparisonPeriodLabel ? <span><ArrowUpDown size={17} aria-hidden="true" /><small>{model.comparisonPeriodName}</small><strong>{model.comparisonPeriodLabel}</strong></span> : null}
        <span><ShieldCheck size={17} aria-hidden="true" /><small>Data through</small><strong>{model.page.updatedLabel}</strong></span>
      </section>

      <InvestigationContext model={model} />

      <form className={styles.filters} action={model.filterAction} method="get">
        <header><span><SlidersHorizontal size={18} aria-hidden="true" />Filters</span><Link href={model.clearFiltersHref}><RotateCcw size={15} aria-hidden="true" />Reset</Link></header>
        <div className={styles.filterGroups}>
          {groupedFilters.map((group) => group.id === "maintenance_scope" ? (
            <details className={styles.filterGroup} key={group.id} open={hasMaintenanceScope}>
              <summary><span><strong>{group.label}</strong><small>{group.description}</small></span><ChevronRight size={16} aria-hidden="true" /></summary>
              <div className={styles.filterGrid}>{model.filters.filter((filter) => filter.group === group.id).map((filter) => (
                <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
              ))}</div>
            </details>
          ) : (
            <fieldset className={styles.filterGroup} key={group.id}>
              <legend>{group.label}</legend><p>{group.description}</p>
              <div className={styles.filterGrid}>{model.filters.filter((filter) => filter.group === group.id).map((filter) => (
                <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
              ))}</div>
            </fieldset>
          ))}
        </div>
        <button type="submit"><Filter size={16} aria-hidden="true" />Apply filters</button>
      </form>

      <section className={styles.summaryStrip} aria-label="Trend summary">{model.summary.map((metric) => <SummaryCard metric={metric} key={metric.id} />)}</section>
      <InsightStrip model={model} />
      <RelatedMeasures model={model} />
      <ComparisonChart model={model} />
      <DriversTable model={model} />
      <BenchmarkTable model={model} />
      <SourceTable model={model} />

      <section className={`${styles.outlookPanel} ${styles[model.outlook.kind]}`}>
        <span><CircleGauge size={23} aria-hidden="true" /></span>
        <div><p>{model.outlook.eyebrow}</p><h2>{model.outlook.label}</h2><small>{model.outlook.description}</small></div>
        <strong>{model.outlook.value}</strong>
        <div className={styles.outlookMeta}>{model.outlook.facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></span>)}</div>
        <aside><Info size={16} aria-hidden="true" />{model.outlook.caution}</aside>
        {model.outlook.evidenceLink ? <Link className={styles.outlookEvidenceLink} href={model.outlook.evidenceLink.href}>{model.outlook.evidenceLink.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </section>

      <details className={styles.notes}>
        <summary><Info size={17} aria-hidden="true" />How these numbers work<ChevronRight size={16} aria-hidden="true" /></summary>
        <ul>{model.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </details>
    </main>
  );
}
