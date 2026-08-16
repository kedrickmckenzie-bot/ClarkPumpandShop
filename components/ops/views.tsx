import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  LoaderCircle,
  Search,
} from "lucide-react";
import type {
  ActionItemViewModel,
  BreakdownViewModel,
  DashboardPageViewModel,
  DataState,
  DetailPageViewModel,
  FilterGroupViewModel,
  ListPageViewModel,
  MetricViewModel,
  ProgramPageViewModel,
  SearchPageViewModel,
  SupportingLink,
  TableViewModel,
  Tone,
  TrendViewModel,
} from "./data-contract";
import styles from "./enterprise-workspace.module.css";

const CHART_PALETTE = ["#2855d9", "#64748b", "#0f766e", "#8b5cf6", "#d97706", "#dc2626", "#475569"];

function toneClass(tone: Tone = "neutral") {
  const classes: Record<Tone, string> = {
    neutral: styles.toneNeutral,
    positive: styles.tonePositive,
    warning: styles.toneWarning,
    critical: styles.toneCritical,
    info: styles.toneInfo,
  };
  return classes[tone];
}

function PageActions({ primary, secondary }: { primary?: SupportingLink; secondary?: SupportingLink }) {
  if (!primary && !secondary) return null;

  return (
    <div className={styles.pageActions} aria-label="Page actions">
      {secondary ? <Link className={styles.secondaryButton} href={secondary.href}>{secondary.label}</Link> : null}
      {primary ? (
        <Link className={styles.primaryButton} href={primary.href}>
          {primary.label}
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      ) : null}
    </div>
  );
}

function PageHeader({ page }: { page: DashboardPageViewModel["page"] }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeadingCopy}>
        {page.eyebrow ? <p className={styles.eyebrow}>{page.eyebrow}</p> : null}
        <h1>{page.title}</h1>
        <p className={styles.pageDescription}>{page.description}</p>
      </div>
      <PageActions primary={page.primaryAction} secondary={page.secondaryAction} />
      <div className={styles.contextBar} aria-label="Current view context">
        <span><small>Scope</small><strong>{page.scopeLabel}</strong></span>
        {page.periodLabel ? <span><small>Period</small><strong>{page.periodLabel}</strong></span> : null}
        {page.updatedLabel ? <span><small>Data</small><strong>{page.updatedLabel}</strong></span> : null}
      </div>
    </header>
  );
}

export function DataStatePanel({ state }: { state: Exclude<DataState, { kind: "ready" }> }) {
  if (state.kind === "loading") {
    return (
      <section className={styles.statePanel} role="status" aria-live="polite" aria-busy="true">
        <span className={styles.stateIcon}><LoaderCircle className={styles.spinner} aria-hidden="true" size={24} /></span>
        <div><h2>{state.label ?? "Loading workspace"}</h2><p>Gathering the latest records for your access scope.</p></div>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
        <span className={styles.stateIcon}><AlertCircle aria-hidden="true" size={24} /></span>
        <div><h2>{state.title}</h2><p>{state.message}</p></div>
        {state.retryHref ? <Link className={styles.secondaryButton} href={state.retryHref}>Try again</Link> : null}
      </section>
    );
  }

  return (
    <section className={styles.statePanel}>
      <span className={styles.stateIcon}><Inbox aria-hidden="true" size={24} /></span>
      <div><h2>{state.title}</h2><p>{state.message}</p></div>
      {state.action ? (
        <Link className={styles.primaryButton} href={state.action.href}>
          {state.action.label}<ArrowRight aria-hidden="true" size={17} />
        </Link>
      ) : null}
    </section>
  );
}

function MetricStrip({ metrics }: { metrics: MetricViewModel[] }) {
  if (metrics.length === 0) return null;

  return (
    <section aria-label="Key measures" className={styles.metricStrip}>
      {metrics.map((metric) => (
        <Link className={`${styles.metricItem} ${toneClass(metric.tone)}`} href={metric.link.href} key={metric.id}>
          <span className={styles.metricTopline}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <ChevronRight aria-hidden="true" size={16} />
          </span>
          <strong className={styles.metricValue}>{metric.value}</strong>
          <span className={styles.metricSupporting}>{metric.supportingText}</span>
          {metric.trendLabel ? <span className={styles.metricTrend}>{metric.trendLabel}</span> : null}
          <span className={styles.metricLink}>{metric.link.label}</span>
        </Link>
      ))}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  action,
  id,
  aside,
}: {
  title: string;
  description?: string;
  action?: SupportingLink;
  id?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div><h2 id={id}>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {aside}
      {action ? <Link className={styles.textLink} href={action.href}>{action.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
    </div>
  );
}

function BreakdownPanel({ breakdown }: { breakdown: BreakdownViewModel }) {
  const maximum = Math.max(...breakdown.segments.map((segment) => segment.value), 1);
  const total = breakdown.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let cursor = 0;
  const gradient = total > 0
    ? `conic-gradient(${breakdown.segments.map((segment, index) => {
      const start = cursor;
      cursor += (Math.max(0, segment.value) / total) * 100;
      return `${CHART_PALETTE[index % CHART_PALETTE.length]} ${start}% ${cursor}%`;
    }).join(", ")})`
    : "conic-gradient(#e2e8f0 0 100%)";

  return (
    <article className={styles.analysisPanel}>
      <SectionHeading title={breakdown.title} description={breakdown.description} aside={breakdown.totalLabel ? <strong className={styles.sectionTotal}>{breakdown.totalLabel}</strong> : null} />
      {breakdown.segments.length > 0 ? (
        <div className={styles.breakdownBody}>
          <div
            className={styles.donutChart}
            style={{ background: gradient }}
            role="img"
            aria-label={`${breakdown.title}. ${breakdown.segments.map((segment) => `${segment.label}: ${segment.formattedValue}`).join("; ")}`}
          >
            <span><strong>{breakdown.totalLabel ?? breakdown.segments.length}</strong><small>{breakdown.totalLabel ? "total" : "groups"}</small></span>
          </div>
          <div className={styles.segmentList} role="list">
            {breakdown.segments.map((segment, index) => (
              <Link href={segment.link.href} className={styles.segmentRow} key={segment.id} role="listitem">
                <span className={styles.segmentSwatch} style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} aria-hidden="true" />
                <span className={styles.segmentLabels}><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
                <span className={styles.segmentTrack} aria-hidden="true">
                  <span style={{ width: `${Math.max((segment.value / maximum) * 100, 2)}%` }} />
                </span>
                <strong className={styles.segmentValue}>{segment.formattedValue}</strong>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            ))}
          </div>
        </div>
      ) : <InlineEmpty message="No source records match this view." />}
      <Link className={styles.sourceLink} href={breakdown.sourceLink.href}>{breakdown.sourceLink.label}<ExternalLink aria-hidden="true" size={14} /></Link>
    </article>
  );
}

function TrendPanel({ trend }: { trend: TrendViewModel }) {
  const maximum = Math.max(...trend.points.map((point) => point.value), 1);

  return (
    <article className={styles.analysisPanel}>
      <SectionHeading title={trend.title} description={trend.description} />
      {trend.points.length > 0 ? (
        <div className={styles.trendPlot}>
          {trend.points.map((point) => (
            <Link href={point.link.href} className={styles.trendColumn} key={point.id} aria-label={`${point.label}: ${point.formattedValue}. ${point.link.label}`}>
              <span className={styles.trendValue}>{point.formattedValue}</span>
              <span className={styles.trendBarTrack} aria-hidden="true"><span style={{ height: `${Math.max((point.value / maximum) * 100, 4)}%` }} /></span>
              <span className={styles.trendLabel}>{point.label}</span>
            </Link>
          ))}
        </div>
      ) : <InlineEmpty message="No source records match this period." />}
      <Link className={styles.sourceLink} href={trend.sourceLink.href}>{trend.sourceLink.label}<ExternalLink aria-hidden="true" size={14} /></Link>
    </article>
  );
}

function InlineEmpty({ message }: { message: string }) {
  return <div className={styles.inlineEmpty}><Inbox aria-hidden="true" size={20} /><span>{message}</span></div>;
}

function ActionQueue({ actions, section }: { actions: ActionItemViewModel[]; section?: DashboardPageViewModel["prioritySection"] }) {
  const title = section?.title ?? "What needs attention";
  const description = section?.description ?? "Exceptions and decisions assigned within your scope.";
  const link = section?.link ?? { href: "/app/action-center", label: "Open action center" };

  return (
    <section className={styles.queuePanel} aria-labelledby="priority-actions-heading">
      <SectionHeading id="priority-actions-heading" title={title} description={description} action={link} />
      {actions.length > 0 ? (
        <div className={styles.actionList} role="list">
          {actions.map((action) => (
            <Link className={styles.actionRow} href={action.link.href} key={action.id} role="listitem">
              <span className={`${styles.statusMarker} ${toneClass(action.tone)}`} aria-hidden="true" />
              <span className={styles.actionPrimary}>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
                <small>{[action.recordLabel, action.storeLabel, action.categoryLabel].filter(Boolean).join(" · ")}</small>
              </span>
              {action.priorityLabel ? <span className={`${styles.queueBadge} ${toneClass(action.tone)}`}>{action.priorityLabel}</span> : null}
              <span className={styles.actionOwner}><small>Accountable</small><strong>{action.ownerLabel}</strong></span>
              <span className={styles.actionDue}><Clock3 aria-hidden="true" size={14} /><span><small>Due</small><strong>{action.dueLabel}</strong></span></span>
              <ChevronRight className={styles.rowChevron} aria-hidden="true" size={17} />
            </Link>
          ))}
        </div>
      ) : <InlineEmpty message="Nothing needs attention in this scope." />}
    </section>
  );
}

function ServiceJourney({ stages }: { stages: NonNullable<DashboardPageViewModel["journey"]> }) {
  if (!stages.length) return null;

  return (
    <section className={styles.journeyPanel} aria-labelledby="service-journey-heading">
      <SectionHeading
        id="service-journey-heading"
        title="Service flow"
        description="Every count opens the exact queue or source records at that stage."
      />
      <div className={styles.journeyTrack}>
        {stages.map((stage, index) => (
          <Link className={`${styles.journeyStage} ${toneClass(stage.tone)}`} href={stage.link.href} key={stage.id}>
            <span className={styles.journeyIndex}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.journeyCopy}><small>{stage.label}</small><strong>{stage.value}</strong><span>{stage.supportingText}</span></span>
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DashboardView({ model }: { model: DashboardPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {model.journey ? <ServiceJourney stages={model.journey} /> : null}
          <MetricStrip metrics={model.metrics} />
          <ActionQueue actions={model.priorityActions} section={model.prioritySection} />
          {(model.breakdowns.length || model.trends.length) ? (
            <section className={styles.analysisGrid} aria-label="Operational intelligence">
              {model.breakdowns.map((breakdown) => <BreakdownPanel breakdown={breakdown} key={breakdown.id} />)}
              {model.trends.map((trend) => <TrendPanel trend={trend} key={trend.id} />)}
            </section>
          ) : null}
          {model.spotlight ? (
            <Link className={styles.spotlight} href={model.spotlight.link.href}>
              <span className={styles.spotlightIcon}><BarChart3 aria-hidden="true" size={21} /></span>
              <span className={styles.spotlightCopy}><small>{model.spotlight.eyebrow ?? "Review opportunity"}</small><strong>{model.spotlight.title}</strong><p>{model.spotlight.description}</p></span>
              <span className={styles.spotlightFacts}>{model.spotlight.facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></span>)}</span>
              <span className={styles.spotlightLink}>{model.spotlight.link.label}<ArrowRight aria-hidden="true" size={17} /></span>
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterGroups({ filters }: { filters?: FilterGroupViewModel[] }) {
  if (!filters?.length) return null;

  return (
    <div className={styles.filters} aria-label="Filter results">
      <span className={styles.filterHeading}><Filter aria-hidden="true" size={16} />Filters</span>
      {filters.map((filter) => (
        <div className={styles.filterGroup} key={filter.id}>
          <span>{filter.label}</span>
          <div>
            {filter.options.map((option) => (
              <Link
                href={option.href}
                key={option.value}
                className={option.selected ? styles.filterChipActive : styles.filterChip}
                aria-current={option.selected ? "page" : undefined}
              >{option.label}</Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ table }: { table: TableViewModel }) {
  if (!table.rows.length) return <InlineEmpty message="No source records are linked to this section yet." />;

  return (
    <div className={styles.tableShell}>
      <div className={styles.tableScroller}>
        <table className={styles.dataTable}>
          <caption className={styles.visuallyHidden}>{table.caption}</caption>
          <thead>
            <tr>{table.columns.map((column) => <th className={column.align === "end" ? styles.alignEnd : undefined} scope="col" key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id}>
                {table.columns.map((column, index) => {
                  const cell = row.cells.find((candidate) => candidate.key === column.key);
                  return (
                    <td className={`${column.align === "end" ? styles.alignEnd : ""} ${cell?.tone ? toneClass(cell.tone) : ""}`} key={column.key}>
                      <Link href={row.href} aria-label={index === 0 ? `Open ${row.label}` : `${column.label}: ${cell?.value ?? "Not available"}. Open ${row.label}`}>
                        <span>{cell?.value ?? "—"}</span>
                        {cell?.secondary ? <small>{cell.secondary}</small> : null}
                        {index === table.columns.length - 1 ? <ChevronRight className={styles.cellChevron} aria-hidden="true" size={15} /> : null}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ListView({ model }: { model: ListPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {model.metrics ? <MetricStrip metrics={model.metrics} /> : null}
          <section className={styles.listWorkspace}>
            <div className={styles.listToolbar}>
              {model.search ? (
                <form className={styles.listSearch} action={model.search.action} method="get" role="search">
                  <Search aria-hidden="true" size={18} />
                  <label className={styles.visuallyHidden} htmlFor={`${model.table.id}-search`}>{model.search.label}</label>
                  <input id={`${model.table.id}-search`} name="q" type="search" defaultValue={model.search.value} placeholder={model.search.placeholder} />
                  {model.search.preservedParameters?.map((parameter) => <input key={parameter.name} name={parameter.name} type="hidden" value={parameter.value} />)}
                  <button type="submit">Search</button>
                </form>
              ) : <span className={styles.toolbarTitle}>Records</span>}
              <strong className={styles.resultSummary}>{model.resultSummary}</strong>
            </div>
            <FilterGroups filters={model.filters} />
            {model.appliedFilters?.length ? (
              <div className={styles.appliedFilters} aria-label="Applied filters">
                <span>Applied</span>
                <div>{model.appliedFilters.map((filter) => <Link href={filter.removeHref} key={filter.id} aria-label={`Remove ${filter.label} filter`}>{filter.label}<span aria-hidden="true">×</span></Link>)}</div>
                {model.clearFiltersHref ? <Link className={styles.clearFilters} href={model.clearFiltersHref}>Clear all</Link> : null}
              </div>
            ) : null}
            <DataTable table={model.table} />
            {model.pagination ? (
              <nav className={styles.pagination} aria-label="Result pages">
                <span>{model.pagination.summary}</span>
                <div>
                  {model.pagination.previousHref ? <Link href={model.pagination.previousHref}><ArrowLeft aria-hidden="true" size={16} />Previous</Link> : <span aria-disabled="true"><ArrowLeft aria-hidden="true" size={16} />Previous</span>}
                  {model.pagination.nextHref ? <Link href={model.pagination.nextHref}>Next<ArrowRight aria-hidden="true" size={16} /></Link> : <span aria-disabled="true">Next<ArrowRight aria-hidden="true" size={16} /></span>}
                </div>
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

export function SearchView({ model }: { model: SearchPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      <form className={styles.universalSearch} action="/app/search" method="get" role="search">
        <Search aria-hidden="true" size={20} />
        <label className={styles.visuallyHidden} htmlFor="universal-search">Search records</label>
        <input id="universal-search" name="q" type="search" defaultValue={model.query} placeholder="Store, address, work order, vendor, equipment, or serial number" />
        <button type="submit">Search</button>
      </form>
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <div className={styles.searchSummary}><strong>{model.resultSummary}</strong><span>Results are limited to your current role and location scope.</span></div>
          <div className={styles.searchGroups}>
            {model.groups.length ? model.groups.map((group) => (
              <section className={styles.searchGroup} key={group.id}>
                <SectionHeading title={group.label} description={`${group.resultCount} match${group.resultCount === 1 ? "" : "es"}`} aside={group.resultCount > group.rows.length ? <span className={styles.sectionMeta}>Showing top {group.rows.length}</span> : null} />
                {group.rows.length ? (
                  <div className={styles.searchResultList}>
                    {group.rows.map((row) => {
                      const primary = row.cells[0];
                      const context = row.cells[1];
                      return (
                        <Link href={row.href} className={styles.searchResult} key={row.id}>
                          <span><strong>{primary?.value ?? row.label}</strong>{primary?.secondary ? <small>{primary.secondary}</small> : null}</span>
                          {context ? <span className={styles.searchContext}><strong>{context.value}</strong>{context.secondary ? <small>{context.secondary}</small> : null}</span> : null}
                          <ChevronRight aria-hidden="true" size={17} />
                        </Link>
                      );
                    })}
                  </div>
                ) : <InlineEmpty message="No matching records in this group." />}
              </section>
            )) : <InlineEmpty message="No records match this search." />}
          </div>
        </>
      )}
    </div>
  );
}

export function ProgramView({ model, beforeContent }: { model: ProgramPageViewModel; beforeContent?: ReactNode }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {beforeContent}
          <FilterGroups filters={model.filters} />
          <MetricStrip metrics={model.metrics} />
          {(model.breakdowns.length || model.trends.length) ? (
            <section className={styles.analysisGrid} aria-label="Program intelligence">
              {model.breakdowns.map((breakdown) => <BreakdownPanel breakdown={breakdown} key={breakdown.id} />)}
              {model.trends.map((trend) => <TrendPanel trend={trend} key={trend.id} />)}
            </section>
          ) : null}
          <ActionQueue actions={model.priorityActions} />
          {model.table ? <section className={styles.listWorkspace}><DataTable table={model.table} /></section> : null}
        </>
      )}
    </div>
  );
}

export function DetailView({ model, beforeSections, after }: { model: DetailPageViewModel; beforeSections?: ReactNode; after?: ReactNode }) {
  return (
    <div className={styles.pageStack}>
      <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <section className={styles.recordSummary} aria-label="Record summary">
            <div className={styles.recordStatus}><small>Current status</small><span className={`${styles.statusPill} ${toneClass(model.statusTone)}`}><CircleDot aria-hidden="true" size={14} />{model.statusLabel}</span></div>
            <div className={styles.factGrid}>
              {model.facts.map((fact) => {
                const content = <><span className={styles.factLabel}>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</>;
                return fact.link ? (
                  <Link className={styles.factItem} href={fact.link.href} key={fact.label}>{content}<ChevronRight aria-hidden="true" size={15} /></Link>
                ) : <div className={styles.factItem} key={fact.label}>{content}</div>;
              })}
            </div>
          </section>
          {beforeSections}
          <div className={styles.detailSections}>
            {model.sections.length ? model.sections.map((section) => (
              <section className={styles.detailSection} id={section.id} key={section.id}>
                <SectionHeading title={section.title} description={section.description} action={section.action} />
                {section.facts ? (
                  <div className={styles.compactFacts}>
                    {section.facts.map((fact) => {
                      const content = <><span className={styles.factLabel}>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</>;
                      return fact.link ? (
                        <Link className={styles.compactFactLink} href={fact.link.href} key={fact.label}>{content}<span className={styles.factAction}>{fact.link.label}<ChevronRight aria-hidden="true" size={14} /></span></Link>
                      ) : <div key={fact.label}>{content}</div>;
                    })}
                  </div>
                ) : null}
                {section.table ? <DataTable table={section.table} /> : null}
                {section.timeline ? (
                  <ol className={styles.timeline}>
                    {section.timeline.map((event) => (
                      <li key={event.id}>
                        <span className={`${styles.timelineDot} ${toneClass(event.tone)}`} aria-hidden="true" />
                        <div className={styles.timelineContent}>
                          <strong>{event.title}</strong>
                          {event.description ? <p>{event.description}</p> : null}
                          <small>{event.timestampLabel} · {event.actorLabel}</small>
                          {event.link ? <Link className={styles.textLink} href={event.link.href}>{event.link.label}<ChevronRight aria-hidden="true" size={14} /></Link> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {!section.facts && !section.table && !section.timeline ? <InlineEmpty message="No information has been recorded in this section yet." /> : null}
              </section>
            )) : <InlineEmpty message="No record history is available yet." />}
          </div>
          {after}
        </>
      )}
    </div>
  );
}
