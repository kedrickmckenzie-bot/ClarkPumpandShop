import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronRight,
  CircleCheck,
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
  SupportingLink,
  TableViewModel,
  Tone,
  TrendViewModel,
} from "./data-contract";
import styles from "./ops.module.css";

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
    <div className={styles.pageActions}>
      {secondary ? <Link className={styles.secondaryButton} href={secondary.href}>{secondary.label}</Link> : null}
      {primary ? <Link className={styles.primaryButton} href={primary.href}>{primary.label}<ArrowRight aria-hidden="true" size={18} /></Link> : null}
    </div>
  );
}

function PageHeader({ page }: { page: DashboardPageViewModel["page"] }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {page.eyebrow ? <p className={styles.eyebrow}>{page.eyebrow}</p> : null}
        <h1>{page.title}</h1>
        <p className={styles.pageDescription}>{page.description}</p>
        <div className={styles.contextLine}>
          <span>{page.scopeLabel}</span>
          {page.periodLabel ? <><span aria-hidden="true">•</span><span>{page.periodLabel}</span></> : null}
          {page.updatedLabel ? <><span aria-hidden="true">•</span><span>{page.updatedLabel}</span></> : null}
        </div>
      </div>
      <PageActions primary={page.primaryAction} secondary={page.secondaryAction} />
    </header>
  );
}

export function DataStatePanel({ state }: { state: Exclude<DataState, { kind: "ready" }> }) {
  if (state.kind === "loading") {
    return (
      <div className={styles.statePanel} role="status" aria-live="polite">
        <LoaderCircle className={styles.spinner} aria-hidden="true" size={28} />
        <h2>{state.label ?? "Loading workspace"}</h2>
        <p>Gathering the latest records for your access scope.</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
        <AlertCircle aria-hidden="true" size={28} />
        <h2>{state.title}</h2>
        <p>{state.message}</p>
        {state.retryHref ? <Link className={styles.secondaryButton} href={state.retryHref}>Try again</Link> : null}
      </div>
    );
  }

  return (
    <div className={styles.statePanel}>
      <Inbox aria-hidden="true" size={30} />
      <h2>{state.title}</h2>
      <p>{state.message}</p>
      {state.action ? <Link className={styles.primaryButton} href={state.action.href}>{state.action.label}<ArrowRight aria-hidden="true" size={18} /></Link> : null}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: MetricViewModel[] }) {
  if (metrics.length === 0) return null;
  return (
    <section aria-label="Key measures" className={styles.metricGrid}>
      {metrics.map((metric) => (
        <Link className={`${styles.metricCard} ${toneClass(metric.tone)}`} href={metric.link.href} key={metric.id}>
          <span className={styles.metricLabel}>{metric.label}</span>
          <strong className={styles.metricValue}>{metric.value}</strong>
          <span className={styles.metricSupporting}>{metric.supportingText}</span>
          {metric.trendLabel ? <span className={styles.metricTrend}>{metric.trendLabel}</span> : null}
          <span className={styles.metricLink}>{metric.link.label}<ChevronRight aria-hidden="true" size={17} /></span>
        </Link>
      ))}
    </section>
  );
}

function BreakdownCard({ breakdown }: { breakdown: BreakdownViewModel }) {
  const maximum = Math.max(...breakdown.segments.map((segment) => segment.value), 1);
  const total = breakdown.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const palette = ["#176b4a", "#5d8f78", "#d59a38", "#527da9", "#9a6557", "#7b6ba7", "#82946d"];
  let cursor = 0;
  const gradient = total > 0
    ? `conic-gradient(${breakdown.segments.map((segment, index) => {
        const start = cursor;
        cursor += (Math.max(0, segment.value) / total) * 100;
        return `${palette[index % palette.length]} ${start}% ${cursor}%`;
      }).join(", ")})`
    : "conic-gradient(#e4e9e6 0 100%)";
  return (
    <article className={styles.visualCard}>
      <div className={styles.cardHeading}>
        <div><h2>{breakdown.title}</h2>{breakdown.description ? <p>{breakdown.description}</p> : null}</div>
        {breakdown.totalLabel ? <strong>{breakdown.totalLabel}</strong> : null}
      </div>
      {breakdown.segments.length > 0 ? (
        <div className={styles.breakdownBody}>
          <div className={styles.donutChart} style={{ background: gradient }} role="img" aria-label={`${breakdown.title}. ${breakdown.segments.map((segment) => `${segment.label}: ${segment.formattedValue}`).join("; ")}`}>
            <span><strong>{breakdown.totalLabel ?? breakdown.segments.length}</strong><small>{breakdown.totalLabel ? "total" : "groups"}</small></span>
          </div>
          <div className={styles.segmentList}>
          {breakdown.segments.map((segment) => (
            <Link href={segment.link.href} className={styles.segmentRow} key={segment.id}>
              <span className={styles.segmentSwatch} style={{ background: palette[breakdown.segments.indexOf(segment) % palette.length] }} aria-hidden="true" />
              <span className={styles.segmentLabels}><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
              <span className={styles.segmentTrack} aria-hidden="true">
                <span className={`${styles.segmentFill} ${toneClass(segment.tone)}`} style={{ width: `${Math.max((segment.value / maximum) * 100, 2)}%` }} />
              </span>
              <strong className={styles.segmentValue}>{segment.formattedValue}</strong>
              <ChevronRight aria-hidden="true" size={17} />
            </Link>
          ))}
          </div>
        </div>
      ) : <p className={styles.inlineEmpty}>No source records match this view.</p>}
      <Link className={styles.sourceLink} href={breakdown.sourceLink.href}>{breakdown.sourceLink.label}<ExternalLink aria-hidden="true" size={15} /></Link>
    </article>
  );
}

function TrendCard({ trend }: { trend: TrendViewModel }) {
  const maximum = Math.max(...trend.points.map((point) => point.value), 1);
  return (
    <article className={styles.visualCard}>
      <div className={styles.cardHeading}><div><h2>{trend.title}</h2>{trend.description ? <p>{trend.description}</p> : null}</div></div>
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
      ) : <p className={styles.inlineEmpty}>No source records match this period.</p>}
      <Link className={styles.sourceLink} href={trend.sourceLink.href}>{trend.sourceLink.label}<ExternalLink aria-hidden="true" size={15} /></Link>
    </article>
  );
}

function ActionList({ actions }: { actions: ActionItemViewModel[] }) {
  return (
    <section className={styles.actionCard} aria-labelledby="priority-actions-heading">
      <div className={styles.cardHeading}>
        <div><h2 id="priority-actions-heading">What needs attention</h2><p>Exceptions and decisions assigned within your scope.</p></div>
        <Link className={styles.textLink} href="/app/action-center">Open action center<ArrowRight aria-hidden="true" size={16} /></Link>
      </div>
      {actions.length > 0 ? (
        <div className={styles.actionList}>
          {actions.map((action) => (
            <Link className={styles.actionRow} href={action.link.href} key={action.id}>
              <span className={`${styles.statusDot} ${toneClass(action.tone)}`} aria-hidden="true" />
              <span className={styles.actionCopy}><strong>{action.title}</strong><span>{action.description}</span><small>{action.categoryLabel} · {action.ownerLabel}</small></span>
              <span className={styles.actionDue}><Clock3 aria-hidden="true" size={15} />{action.dueLabel}</span>
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ))}
        </div>
      ) : <p className={styles.inlineEmpty}>Nothing needs attention in this scope.</p>}
    </section>
  );
}

export function DashboardView({ model }: { model: DashboardPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <MetricGrid metrics={model.metrics} />
          <ActionList actions={model.priorityActions} />
          <section className={styles.visualGrid} aria-label="Operational intelligence">
            {model.breakdowns.map((breakdown) => <BreakdownCard breakdown={breakdown} key={breakdown.id} />)}
            {model.trends.map((trend) => <TrendCard trend={trend} key={trend.id} />)}
          </section>
          {model.spotlight ? (
            <Link className={styles.spotlight} href={model.spotlight.link.href}>
              <span><BarChart3 aria-hidden="true" size={24} /></span>
              <span><small>Review opportunity</small><strong>{model.spotlight.title}</strong><p>{model.spotlight.description}</p></span>
              <span className={styles.spotlightFacts}>{model.spotlight.facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></span>)}</span>
              <span className={styles.spotlightLink}>{model.spotlight.link.label}<ArrowRight aria-hidden="true" size={18} /></span>
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
      <span className={styles.filterHeading}><Filter aria-hidden="true" size={17} />Filters</span>
      {filters.map((filter) => (
        <div className={styles.filterGroup} key={filter.id}>
          <span>{filter.label}</span>
          <div>
            {filter.options.map((option) => (
              <Link
                href={option.href}
                key={option.value}
                className={option.selected ? styles.filterChipActive : styles.filterChip}
                aria-current={option.selected ? "true" : undefined}
              >{option.label}</Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ table }: { table: TableViewModel }) {
  return (
    <div className={styles.tableScroller}>
      <table className={styles.dataTable}>
        <caption className={styles.visuallyHidden}>{table.caption}</caption>
        <thead><tr>{table.columns.map((column) => <th className={column.align === "end" ? styles.alignEnd : undefined} scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((column, index) => {
                const cell = row.cells.find((candidate) => candidate.key === column.key);
                return (
                  <td className={`${column.align === "end" ? styles.alignEnd : ""} ${cell?.tone ? toneClass(cell.tone) : ""}`} key={column.key}>
                    <Link href={row.href} aria-label={index === 0 ? `Open ${row.label}` : `${column.label}: ${cell?.value ?? "Not available"}. Open ${row.label}`}>
                      <span>{cell?.value ?? "—"}</span>{cell?.secondary ? <small>{cell.secondary}</small> : null}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListView({ model }: { model: ListPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {model.metrics ? <MetricGrid metrics={model.metrics} /> : null}
          <section className={styles.listWorkspace}>
            {model.search ? (
              <form className={styles.listSearch} action={model.search.action} method="get" role="search">
                <Search aria-hidden="true" size={19} />
                <label className={styles.visuallyHidden} htmlFor={`${model.table.id}-search`}>{model.search.label}</label>
                <input id={`${model.table.id}-search`} name="q" type="search" defaultValue={model.search.value} placeholder={model.search.placeholder} />
                <button type="submit">Search</button>
              </form>
            ) : null}
            <FilterGroups filters={model.filters} />
            <div className={styles.resultHeader}><strong>{model.resultSummary}</strong></div>
            {model.table.rows.length ? <DataTable table={model.table} /> : <p className={styles.inlineEmpty}>No records match these filters.</p>}
            {model.pagination ? (
              <nav className={styles.pagination} aria-label="Result pages">
                <span>{model.pagination.summary}</span>
                <div>
                  {model.pagination.previousHref ? <Link href={model.pagination.previousHref}><ArrowLeft aria-hidden="true" size={17} />Previous</Link> : <span aria-disabled="true"><ArrowLeft aria-hidden="true" size={17} />Previous</span>}
                  {model.pagination.nextHref ? <Link href={model.pagination.nextHref}>Next<ArrowRight aria-hidden="true" size={17} /></Link> : <span aria-disabled="true">Next<ArrowRight aria-hidden="true" size={17} /></span>}
                </div>
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

export function ProgramView({ model }: { model: ProgramPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <FilterGroups filters={model.filters} />
          <MetricGrid metrics={model.metrics} />
          <section className={styles.visualGrid} aria-label="Program intelligence">
            {model.breakdowns.map((breakdown) => <BreakdownCard breakdown={breakdown} key={breakdown.id} />)}
            {model.trends.map((trend) => <TrendCard trend={trend} key={trend.id} />)}
          </section>
          <ActionList actions={model.priorityActions} />
          {model.table ? <section className={styles.listWorkspace}><DataTable table={model.table} /></section> : null}
        </>
      )}
    </div>
  );
}

export function DetailView({ model, after }: { model: DetailPageViewModel; after?: React.ReactNode }) {
  return (
    <div className={styles.pageStack}>
      <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={17} />{model.backLink.label}</Link>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <div className={styles.detailStatus}><span className={`${styles.statusPill} ${toneClass(model.statusTone)}`}><CircleCheck aria-hidden="true" size={16} />{model.statusLabel}</span></div>
          <section className={styles.factGrid} aria-label="Record summary">
            {model.facts.map((fact) => {
              const content = <><span>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</>;
              return fact.link ? <Link className={styles.factCard} href={fact.link.href} key={fact.label}>{content}<ChevronRight aria-hidden="true" size={17} /></Link> : <div className={styles.factCard} key={fact.label}>{content}</div>;
            })}
          </section>
          <div className={styles.detailSections}>
            {model.sections.map((section) => (
              <section className={styles.detailSection} id={section.id} key={section.id}>
                <div className={styles.cardHeading}><div><h2>{section.title}</h2>{section.description ? <p>{section.description}</p> : null}</div>{section.action ? <Link className={styles.textLink} href={section.action.href}>{section.action.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}</div>
                {section.facts ? <div className={styles.compactFacts}>{section.facts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</div>)}</div> : null}
                {section.table ? <DataTable table={section.table} /> : null}
                {section.timeline ? <ol className={styles.timeline}>{section.timeline.map((event) => <li key={event.id}><span className={`${styles.timelineDot} ${toneClass(event.tone)}`} aria-hidden="true" /><div><strong>{event.title}</strong>{event.description ? <p>{event.description}</p> : null}<small>{event.timestampLabel} · {event.actorLabel}</small>{event.link ? <Link className={styles.textLink} href={event.link.href}>{event.link.label}<ChevronRight aria-hidden="true" size={15} /></Link> : null}</div></li>)}</ol> : null}
              </section>
            ))}
          </div>
          {after}
        </>
      )}
    </div>
  );
}
