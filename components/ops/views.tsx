import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  Layers3,
  LoaderCircle,
  MapPin,
  PencilLine,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import type {
  ActionItemViewModel,
  ApprovedLaterManagementViewModel,
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
  TableRowViewModel,
  TableViewModel,
  Tone,
  TrendViewModel,
} from "./data-contract";
import styles from "./enterprise-workspace.module.css";
import { RecordSections } from "@/components/workspace/record-sections";
import { ApprovedLaterIssuanceDialog } from "./approved-later-issuance-dialog";
import { PaginationControls } from "./pagination-controls";
import { ApprovedWorkPortfolio } from "@/components/workspace/approved-work-portfolio";
import type { ApprovedWorkPortfolioViewModel } from "@/app/app/_data/approved-work-presenter";

const CHART_PALETTE = ["#2855d9", "#64748b", "#0f766e", "#8b5cf6", "#d97706", "#dc2626", "#475569"];
const CHART_TONE_COLORS: Partial<Record<Tone, string>> = {
  positive: "#16805c",
  warning: "#d97706",
  critical: "#dc2626",
  info: "#2855d9",
  neutral: "#64748b",
};

function chartColor(tone: Tone | undefined, index: number) {
  return tone ? CHART_TONE_COLORS[tone] ?? CHART_PALETTE[index % CHART_PALETTE.length] : CHART_PALETTE[index % CHART_PALETTE.length];
}

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

function PageHeader({ page, status }: { page: DashboardPageViewModel["page"]; status?: { label: string; tone?: Tone } }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeadingCopy}>
        {page.eyebrow ? <p className={styles.eyebrow}>{page.eyebrow}</p> : null}
        <div className={styles.pageTitleLine}><h1>{page.title}</h1>{status ? <span className={`${styles.headerStatus} ${toneClass(status.tone)}`}><CircleDot aria-hidden="true" size={14} />{status.label}</span> : null}</div>
        <p className={styles.pageDescription}>{page.description}</p>
      </div>
      <PageActions primary={page.primaryAction} secondary={page.secondaryAction} />
      <div className={styles.contextBar} aria-label="Current view context">
        <span><small>Viewing</small><strong>{page.scopeLabel}</strong></span>
        {page.periodLabel ? <span><small>Period</small><strong>{page.periodLabel}</strong></span> : null}
        {page.updatedLabel ? <span><small>Updated</small><strong>{page.updatedLabel}</strong></span> : null}
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

function MetricStrip({
  metrics,
  heading,
  description,
}: {
  metrics: MetricViewModel[];
  heading?: string;
  description?: string;
}) {
  if (metrics.length === 0) return null;

  return (
    <section aria-label={heading ?? "Key measures"} className={styles.metricExplorer}>
      {heading ? <header className={styles.metricExplorerHeader}><div><small>Common questions</small><h2>{heading}</h2></div>{description ? <p>{description}</p> : null}</header> : null}
      <div className={styles.metricStrip}>{metrics.map((metric) => (
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
      ))}</div>
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
      return `${chartColor(segment.tone, index)} ${start}% ${cursor}%`;
    }).join(", ")})`
    : "conic-gradient(#e2e8f0 0 100%)";
  const [centerValue, ...centerLabelParts] = (breakdown.totalLabel ?? String(breakdown.segments.length)).split(" ");
  const centerLabel = centerLabelParts.join(" ") || (breakdown.totalLabel ? "total" : "groups");

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
            <span><strong>{centerValue}</strong><small>{centerLabel}</small></span>
          </div>
          <div className={styles.segmentList} role="list">
            {breakdown.segments.map((segment, index) => (
              <Link href={segment.link.href} className={styles.segmentRow} key={segment.id} role="listitem">
                <span className={styles.segmentSwatch} style={{ background: chartColor(segment.tone, index) }} aria-hidden="true" />
                <span className={styles.segmentLabels}><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
                <span className={styles.segmentTrack} aria-hidden="true">
                  <span style={{ width: `${Math.max((segment.value / maximum) * 100, 2)}%`, background: chartColor(segment.tone, index) }} />
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
  const description = section?.description ?? "Items waiting for your team to review or update.";
  const link = section?.link ?? { href: "/app/action-center", label: "See all" };

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
              <span className={styles.actionOwner}><small>Owner</small><strong>{action.ownerLabel}</strong></span>
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

function DataTable({ table, selectedId, rowHref, selection }: { table: TableViewModel; selectedId?: string; rowHref?: (row: TableViewModel["rows"][number]) => string; selection?: { name: string; label: string; isDisabled?: (row: TableViewModel["rows"][number]) => boolean } }) {
  if (!table.rows.length) return <InlineEmpty message="No source records are linked to this section yet." />;

  return (
    <div className={styles.tableShell}>
      <div className={styles.tableScroller}>
        <table className={styles.dataTable} data-table={table.id} data-columns={table.columns.length}>
          <caption className={styles.visuallyHidden}>{table.caption}</caption>
          <thead>
            <tr>{selection ? <th className={styles.selectColumn} scope="col"><span className={styles.visuallyHidden}>{selection.label}</span></th> : null}{table.columns.map((column) => <th data-column={column.key} className={column.align === "end" ? styles.alignEnd : undefined} scope="col" key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} data-selected={row.id === selectedId || undefined}>
                {selection ? <td className={styles.selectColumn}><input type="checkbox" name={selection.name} value={row.id} aria-label={`Select ${row.label}`} disabled={selection.isDisabled?.(row)} /></td> : null}
                {table.columns.map((column, index) => {
                  const cell = row.cells.find((candidate) => candidate.key === column.key);
                  return (
                    <td data-column={column.key} className={`${column.align === "end" ? styles.alignEnd : ""} ${cell?.tone ? toneClass(cell.tone) : ""}`} key={column.key}>
                      <Link href={cell?.link?.href ?? rowHref?.(row) ?? row.href} aria-current={!cell?.link && row.id === selectedId ? "true" : undefined} aria-label={cell?.link ? `${cell.link.label}: ${cell.value}` : index === 0 ? `Open ${row.label}` : `${column.label}: ${cell?.value ?? "Not available"}. Open ${row.label}`}>
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

type SurfaceViewMode = "tile" | "table";

/** Surfaces whose records read best as summary cards; every operational queue defaults to a dense table. */
const TILE_DEFAULT_SURFACES = new Set(["stores"]);
const TRIAGE_SURFACES = new Set(["action-center", "work-orders", "visits"]);

function queueCell(row: TableRowViewModel, key: string) {
  return row.cells.find((cell) => cell.key === key);
}

function ReviewQueueSurface({ model }: { model: ListPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {model.metrics ? <MetricStrip metrics={model.metrics} heading="Choose what to review" description="Each summary opens the exact items behind the count." /> : null}
          <section className={`${styles.listWorkspace} ${styles.reviewQueueWorkspace}`}>
            <div className={styles.listToolbar}>
              {model.search ? (
                <form className={styles.listSearch} action={model.search.action} method="get" role="search">
                  <Search aria-hidden="true" size={18} />
                  <label className={styles.visuallyHidden} htmlFor={`${model.table.id}-search`}>{model.search.label}</label>
                  <input id={`${model.table.id}-search`} name="q" type="search" defaultValue={model.search.value} placeholder={model.search.placeholder} />
                  {model.search.preservedParameters?.map((parameter) => <input key={parameter.name} name={parameter.name} type="hidden" value={parameter.value} />)}
                  <button type="submit">Search</button>
                </form>
              ) : <span className={styles.toolbarTitle}>Review queue</span>}
              <strong className={styles.resultSummary}>{model.resultSummary}</strong>
            </div>
            <FilterGroups filters={model.filters} />
            <AppliedFilterBar filters={model.appliedFilters} clearFiltersHref={model.clearFiltersHref} />

            <div className={styles.reviewQueueLayout}>
              <div className={styles.reviewQueueMain}>
                <header className={styles.reviewQueueHeading}>
                  <div>
                    <h2>Review items</h2>
                    <p>Click an item to see the details and take action.</p>
                  </div>
                  <span>{model.filters?.some((filter) => filter.options.some((option) => option.value === "history" && option.selected)) ? "Most recently completed first" : "Most urgent first"}</span>
                </header>
                {model.table.rows.length ? (
                  <ol className={styles.reviewQueueList} aria-label="Review items">
                    {model.table.rows.map((row) => {
                      const item = queueCell(row, "item");
                      const store = queueCell(row, "store");
                      const record = queueCell(row, "record");
                      const owner = queueCell(row, "owner");
                      const due = queueCell(row, "due");
                      const priority = queueCell(row, "priority");
                      const type = queueCell(row, "type");
                      return (
                        <li key={row.id}>
                          <Link
                            className={`${styles.reviewQueueItem} ${toneClass(priority?.tone)}`}
                            href={row.href}
                          >
                            <span className={styles.reviewQueueMarker} aria-hidden="true" />
                            <div className={styles.reviewQueueAction}>
                              <div className={styles.reviewQueueBadges}>
                                <span>{type?.value ?? "Review item"}</span>
                                {priority?.value !== "Review" ? <strong>{priority?.value ?? "Open"}</strong> : null}
                              </div>
                              <h3>{item?.value ?? row.label}</h3>
                              {item?.secondary && type?.value === "Record to check" ? <p>{item.secondary}</p> : null}
                              <div className={styles.reviewQueueContext}>
                                <span><MapPin aria-hidden="true" size={15} />{store?.value ?? "Companywide"}</span>
                                <span><CircleDot aria-hidden="true" size={15} />{record?.value ?? "Related record"}{record?.secondary && record.secondary !== record.value ? ` · ${record.secondary}` : ""}</span>
                              </div>
                            </div>
                            <div className={styles.reviewQueueOwner}>
                              <span><UserRound aria-hidden="true" size={15} />Owner</span>
                              <strong>{owner?.value ?? "Unassigned"}</strong>
                            </div>
                            <div className={styles.reviewQueueDue}>
                              <span><CalendarClock aria-hidden="true" size={15} />When</span>
                              <strong>{due?.value ?? "No deadline"}</strong>
                            </div>
                            <ChevronRight className={styles.reviewQueueChevron} aria-hidden="true" size={19} />
                          </Link>
                          {row.sources?.length ? <details className={styles.controlDisclosure}>
                            <summary>Tasks and supporting records ({row.sources.length})</summary>
                            <ul>{row.sources.map((source) => <li key={source.id}>
                              <Link href={source.href}>{source.label}</Link>
                              <p>Responsible: {source.owner} · {source.dueLabel}</p>
                              <p>Done when: {source.doneWhen}</p>
                            </li>)}</ul>
                          </details> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : <InlineEmpty message="No open items match these filters." />}
              </div>
            </div>
            {model.pagination ? <PaginationControls pagination={model.pagination} /> : null}
          </section>
        </>
      )}
    </div>
  );
}

function ApprovedLaterManagementPanel({
  management,
  selectedReturnTo,
  listReturnTo,
}: {
  management: ApprovedLaterManagementViewModel;
  selectedReturnTo: string;
  listReturnTo: string;
}) {
  const workOrderPath = `/app/work-orders/${encodeURIComponent(management.workOrderId)}`;
  const holdAction = `${workOrderPath.replace("/app/", "/api/ops/")}/visit-hold`;
  const groupHref = `/app/store-sweeps/new?store=${encodeURIComponent(management.storeId)}&workOrder=${encodeURIComponent(management.workOrderId)}`;

  if (!management.canManage) {
    return (
      <section className={styles.approvedLaterManager}>
        <div className={styles.managementHeading}><PencilLine aria-hidden="true" size={17} /><div><strong>Management actions</strong><span>Your current role can review this job but cannot change it.</span></div></div>
      </section>
    );
  }

  return (
    <section className={styles.approvedLaterManager} aria-label="Manage approved work">
      <div className={styles.managementHeading}><PencilLine aria-hidden="true" size={19} /><div><strong>Manage this approved job</strong><span>Choose the next service path, update the approval, or change the underlying work-order record.</span></div></div>

      <div className={styles.managementWorkspace}>
        <div className={styles.managementMainColumn}>
          <section className={styles.managementSection}>
            <header className={styles.managementSectionHeader}><div><small>Next step</small><strong>Choose how this work should move forward</strong></div><span>The work stays approved until you deliberately change its path.</span></header>
            <div className={styles.managementActions}>
              <ApprovedLaterIssuanceDialog model={management} />
              <Link href={groupHref}><Layers3 aria-hidden="true" size={18} /><span><strong>Review other approved jobs at this store</strong><small>Choose which jobs to send together in one vendor request.</small></span></Link>
            </div>
          </section>

          <form action={holdAction} method="post" className={styles.approvedLaterEditForm}>
            <input type="hidden" name="operation" value="place" />
            <input type="hidden" name="returnTo" value={selectedReturnTo} />
            <header className={styles.managementSectionHeader}><div><small>Approval settings</small><strong>Edit the next-suitable-visit instructions</strong></div><span>These settings guide a future visit without creating a vendor price.</span></header>
            <div className={styles.approvedLaterFieldGrid}>
              <label>
                <span>What may the vendor do?</span>
                <select name="posture" defaultValue={management.posture}>
                  <option value="complete_using_professional_judgment">Complete during the visit if practical</option>
                  <option value="look_and_report">Inspect and report back</option>
                </select>
                <small>Use “inspect and report back” when the scope may need a separate decision.</small>
              </label>
              <label>
                <span>Review if not handled by</span>
                <input type="datetime-local" name="deadlineAt" required defaultValue={management.deadlineInputValue} />
                <small>Store-local time ({management.storeTimeZone})</small>
              </label>
              <label>
                <span>Flag an invoice for review above <small>Optional</small></span>
                <input type="number" name="internalReviewThreshold" min="0" step="0.01" inputMode="decimal" placeholder="No threshold" defaultValue={management.internalReviewThresholdInputValue} />
                <small>Internal review threshold only—not shown to the vendor.</small>
              </label>
            </div>
            <footer className={styles.managementFormFooter}><span>Saving updates this approval and its audit history.</span><button type="submit">Save approval changes</button></footer>
          </form>
        </div>

        <aside className={styles.managementSideColumn} aria-label="Additional work-order controls">
          <section className={styles.managementLinks}>
            <header><small>Work-order details</small><strong>Edit the underlying record</strong></header>
            <Link href={`${workOrderPath}?view=activity#work-control`}><PencilLine aria-hidden="true" size={16} /><span><strong>Priority, owner, due date, or status</strong><small>Open the accountable work controls</small></span></Link>
            <Link href={`${workOrderPath}?view=cost#work-records`}><PencilLine aria-hidden="true" size={16} /><span><strong>Service area or equipment</strong><small>Update classification with an audit note</small></span></Link>
          </section>

          <section className={styles.managementRemove}>
            <header><small>Administrative actions</small><strong>Remove or cancel</strong></header>
            <form action={holdAction} method="post">
              <input type="hidden" name="operation" value="release" />
              <input type="hidden" name="returnTo" value={listReturnTo} />
              <div><strong>Remove from the next-visit list</strong><span>Keep the work order open and return it to provider selection.</span></div>
              <button type="submit">Remove from next-visit list</button>
            </form>
            <form action={`${workOrderPath.replace("/app/", "/api/ops/")}/control`} method="post">
              <input type="hidden" name="operation" value="update" />
              <input type="hidden" name="expectedStatus" value="approved" />
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="priority" value={management.priority} />
              <input type="hidden" name="returnTo" value={listReturnTo} />
              <label><span>Cancellation reason</span><textarea name="note" required rows={3} maxLength={2000} placeholder="Why is this work no longer needed?" /></label>
              <button className={styles.managementDanger} type="submit"><Trash2 aria-hidden="true" size={16} />Cancel work order</button>
              <small>The record remains in history; it is never silently deleted.</small>
            </form>
          </section>
        </aside>
      </div>
    </section>
  );
}

export function ListSurface({ model, approvedWork, surface, searchParams, canManageWorkflowTasks = false }: { model: ListPageViewModel; approvedWork?: ApprovedWorkPortfolioViewModel; surface: string; searchParams: Record<string, string | string[] | undefined>; canManageWorkflowTasks?: boolean }) {
  if (surface === "action-center") return <ReviewQueueSurface model={model} />;
  const metricCopy: Record<string, { heading: string; description: string }> = {
    stores: { heading: "Explore the store network", description: "Open the locations, work, visits, or recorded costs behind each summary." },
    "work-orders": { heading: "Choose a work queue", description: "Open the work orders that match the status or responsibility you need to manage." },
    visits: { heading: "Choose a visit view", description: "Open active visits, completed visits, or records that still need review." },
    requests: { heading: "Choose an issue queue", description: "Open reported issues by their current review or work-order status." },
    estimates: { heading: "Choose an estimate queue", description: "Open pricing requests by the decision or vendor response still needed." },
  };
  const metricHeading = metricCopy[surface] ?? { heading: "Choose what to review", description: "Each summary opens the matching records without losing your current scope." };
  const triageMode = TRIAGE_SURFACES.has(surface);
  const visitPlanParam = searchParams.visitPlan;
  const approvedLaterMode = surface === "work-orders" && (Array.isArray(visitPlanParam) ? visitPlanParam[0] : visitPlanParam) === "ready";
  const selectedParam = searchParams.selected;
  const selectedId = typeof selectedParam === "string" ? selectedParam : Array.isArray(selectedParam) ? selectedParam[0] : undefined;
  const selectedRow = selectedId ? model.table.rows.find((row) => row.id === selectedId) : undefined;
  const approvedLaterSelection = approvedLaterMode && selectedRow?.management?.kind === "approved_later";
  const layoutParam = searchParams.layout;
  const requestedView = typeof layoutParam === "string" && (layoutParam === "table" || layoutParam === "tile") ? layoutParam : null;
  const viewMode: SurfaceViewMode = triageMode ? "table" : requestedView ?? (TILE_DEFAULT_SURFACES.has(surface) ? "tile" : "table");
  const toggleQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (["layout", "selected", "matchStore"].includes(key) || value === undefined) continue;
    for (const single of Array.isArray(value) ? value : [value]) toggleQuery.append(key, single);
  }
  const baseQuery = toggleQuery.toString();
  const nextView: SurfaceViewMode = viewMode === "tile" ? "table" : "tile";
  const toggleHref = `/app/${surface}?${baseQuery ? `${baseQuery}&` : ""}layout=${nextView}`;
  const selectionHref = (id?: string) => {
    const query = [baseQuery, id ? `selected=${encodeURIComponent(id)}` : ""].filter(Boolean).join("&");
    return query ? `/app/${surface}?${query}` : `/app/${surface}`;
  };
  const workOrderReturnTo = `/app/work-orders${baseQuery ? `?${baseQuery}` : ""}`;
  const noticeParam = searchParams.notice;
  const notice = typeof noticeParam === "string" ? noticeParam : Array.isArray(noticeParam) ? noticeParam[0] : undefined;
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {notice ? <div className={styles.successNotice} role="status">{notice}</div> : null}
          {approvedLaterMode && approvedWork ? <ApprovedWorkPortfolio model={approvedWork} /> : model.metrics ? <MetricStrip metrics={model.metrics} heading={metricHeading.heading} description={metricHeading.description} /> : null}
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
            <AppliedFilterBar filters={model.appliedFilters} clearFiltersHref={model.clearFiltersHref} />
            {triageMode ? (
              <div className={styles.triageWorkspace} data-has-preview={selectedRow && !approvedLaterSelection || undefined}>
                <div className={styles.triageList}>{surface === "work-orders" && !approvedLaterMode && canManageWorkflowTasks ? (
                  <form className={styles.bulkForm} action="/api/ops/work-orders/bulk-follow-up" method="post">
                    <input type="hidden" name="returnTo" value={workOrderReturnTo} />
                    <DataTable table={model.table} selectedId={selectedId} rowHref={(row) => selectionHref(row.id)} selection={{ name: "workOrderId", label: "Select open work orders for a bulk follow-up", isDisabled: (row) => ["Closed", "Cancelled"].includes(row.cells.find((cell) => cell.key === "status")?.value ?? "") }} />
                    <div className={styles.bulkToolbar}>
                      <div><strong>Add the same follow-up to selected work</strong><small>One auditable, non-blocking reminder is added to each selected record.</small></div>
                      <label><span>Action</span><input name="nextAction" required maxLength={240} defaultValue="Follow up with provider" /></label>
                      <label><span>Due</span><input name="dueAt" type="datetime-local" required /></label>
                      <button type="submit">Add follow-ups</button>
                    </div>
                  </form>
                ) : <DataTable table={model.table} selectedId={selectedId} rowHref={(row) => selectionHref(row.id)} />}</div>
                {selectedRow ? approvedLaterSelection ? <>
                  <Link className={styles.approvedLaterBackdrop} href={selectionHref()} aria-label="Close approved work panel" />
                  <aside className={styles.approvedLaterDialog} role="dialog" aria-modal="true" aria-labelledby="approved-later-dialog-title">
                    <header className={styles.approvedLaterDialogHeader}>
                      <div><span>Approved for next suitable visit</span><div className={styles.approvedLaterTitleLine}><h2 id="approved-later-dialog-title">{selectedRow.label}</h2><strong>Ready for a suitable visit</strong></div><p>{selectedRow.cells[0]?.secondary ?? "Review and manage this approved job."}</p></div>
                      <Link href={selectionHref()} aria-label="Close approved work panel"><span>Close</span><b aria-hidden="true">×</b></Link>
                    </header>
                    <div className={styles.approvedLaterDialogBody}>
                      <section className={styles.approvedLaterOverview} aria-labelledby="approved-later-overview-heading">
                        <header><div><small>Current record</small><h3 id="approved-later-overview-heading">Work overview</h3></div><Link href={selectedRow.href}>Open complete record<ExternalLink aria-hidden="true" size={15} /></Link></header>
                        <dl>{model.table.columns.map((column) => { const cell = selectedRow.cells.find((candidate) => candidate.key === column.key); return <div key={column.key}><dt>{column.label}</dt><dd>{cell?.value ?? "—"}{cell?.secondary && cell.secondary !== selectedRow.cells[0]?.secondary ? <small>{cell.secondary}</small> : null}</dd></div>; })}</dl>
                      </section>
                      <ApprovedLaterManagementPanel management={selectedRow.management!} selectedReturnTo={selectionHref(selectedRow.id)} listReturnTo={workOrderReturnTo} />
                    </div>
                  </aside>
                </> : <aside className={styles.triagePreview} aria-live="polite">
                  <header><div><span>Selected record</span><h2>{selectedRow.label}</h2></div><Link href={selectionHref()} aria-label="Close record preview">×</Link></header>
                  {selectedRow.cells[0]?.secondary ? <p className={styles.triageSummary}>{selectedRow.cells[0].secondary}</p> : null}
                  <dl>{model.table.columns.map((column) => { const cell = selectedRow.cells.find((candidate) => candidate.key === column.key); return <div key={column.key}><dt>{column.label}</dt><dd>{cell?.value ?? "—"}{cell?.secondary && cell.secondary !== selectedRow.cells[0]?.secondary ? <small>{cell.secondary}</small> : null}</dd></div>; })}</dl>
                  <Link className={styles.triageOpen} href={selectedRow.href}>Open full record<ExternalLink aria-hidden="true" size={15} /></Link>
                </aside> : null}
              </div>
            ) : viewMode === "tile" ? <RecordTileGrid table={model.table} /> : <DataTable table={model.table} />}
            {!triageMode ? <nav className={styles.viewToggle} aria-label="Display mode">
              <Link href={toggleHref} className={styles.viewToggleLink}>{nextView === "table" ? "Switch to table view" : "Switch to card view"}</Link>
            </nav> : null}
            {model.pagination ? <PaginationControls pagination={model.pagination} /> : null}
          </section>
        </>
      )}
    </div>
  );
}

function AppliedFilterBar({ filters, clearFiltersHref }: { filters?: ListPageViewModel["appliedFilters"]; clearFiltersHref?: string }) {
  if (!filters?.length) return null;
  return (
    <div className={styles.appliedFilters} aria-label="Applied filters">
      <span>Showing</span>
      <div>{filters.map((filter) => <Link href={filter.removeHref} key={filter.id} aria-label={`Remove ${filter.label} filter`}>{filter.label}<span aria-hidden="true">×</span></Link>)}</div>
      {clearFiltersHref ? <Link className={styles.clearFilters} href={clearFiltersHref}>Clear filters</Link> : null}
    </div>
  );
}

function RecordTileGrid({ table }: { table: TableViewModel }) {
  const toneClassNames: Partial<Record<string, string>> = {
    positive: styles.tileTonePositive,
    warning: styles.tileToneWarning,
    critical: styles.tileToneCritical,
    info: styles.tileToneInfo,
  };
  if (table.rows.length === 0) {
    return <div className={styles.tileEmpty}>No records match the current filters.</div>;
  }
  return (
    <div className={styles.tileGrid}>
      {table.rows.map((row) => {
        const facts = table.columns.slice(1)
          .map((column) => ({ label: column.label, cell: row.cells.find((candidate) => candidate.key === column.key) }))
          .filter((fact) => fact.cell != null && fact.cell.value !== "" && fact.cell.value !== "—")
          .slice(0, 5);
        return (
          <Link key={row.id} href={row.href} className={styles.tile}>
            <span className={styles.tileTitle}>{row.label}</span>
            {row.cells[0]?.secondary ? <span className={styles.tileSubtitle}>{row.cells[0].secondary}</span> : null}
            <dl className={styles.tileFacts}>
              {facts.map((fact) => (
                <div key={fact.label} className={fact.cell?.tone ? toneClassNames[fact.cell.tone ?? ""] : undefined}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.cell!.value}{fact.cell!.secondary ? <small>{fact.cell!.secondary}</small> : null}</dd>
                </div>
              ))}
            </dl>
          </Link>
        );
      })}
    </div>
  );
}

export function ListView({ model }: { model: ListPageViewModel }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader page={model.page} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          {model.metrics ? <MetricStrip metrics={model.metrics} heading="Choose what to review" description="Each summary opens the matching records without losing your current scope." /> : null}
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
            {model.pagination ? <PaginationControls pagination={model.pagination} /> : null}
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
        <input id="universal-search" name="q" type="search" defaultValue={model.query} placeholder={model.placeholder ?? "Store, address, work order, vendor, equipment, or serial number"} />
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
          <AppliedFilterBar filters={model.appliedFilters} clearFiltersHref={model.clearFiltersHref} />
          <MetricStrip metrics={model.metrics} heading="Explore the equipment register" description="Open a measure to see the exact equipment, stores, planning coverage, or lifecycle records behind it." />
          {(model.breakdowns.length || model.trends.length) ? (
            <section className={styles.analysisGrid} aria-label="Program intelligence">
              {model.breakdowns.map((breakdown) => <BreakdownPanel breakdown={breakdown} key={breakdown.id} />)}
              {model.trends.map((trend) => <TrendPanel trend={trend} key={trend.id} />)}
            </section>
          ) : null}
          {model.priorityActions.length ? <ActionQueue actions={model.priorityActions} /> : null}
          {model.table ? <section className={styles.listWorkspace}>
            {model.search || model.resultSummary ? <div className={styles.listToolbar}>
              {model.search ? <form className={styles.listSearch} action={model.search.action} method="get" role="search">
                <Search aria-hidden="true" size={18} />
                <label className={styles.visuallyHidden} htmlFor={`${model.table.id}-search`}>{model.search.label}</label>
                <input id={`${model.table.id}-search`} name="q" type="search" defaultValue={model.search.value} placeholder={model.search.placeholder} />
                {model.search.preservedParameters?.map((parameter) => <input key={parameter.name} name={parameter.name} type="hidden" value={parameter.value} />)}
                <button type="submit">Search</button>
              </form> : <span className={styles.toolbarTitle}>Records</span>}
              {model.resultSummary ? <strong className={styles.resultSummary}>{model.resultSummary}</strong> : null}
            </div> : null}
            <DataTable table={model.table} />
            {model.pagination ? <PaginationControls pagination={model.pagination} /> : null}
          </section> : null}
        </>
      )}
    </div>
  );
}

export function DetailView({ model, beforeSections, after, initialSection }: { model: DetailPageViewModel; beforeSections?: ReactNode; after?: ReactNode; initialSection?: string }) {
  const linkedFacts = model.facts.filter((fact) => fact.link);
  const summaryFacts = model.facts.filter((fact) => !fact.link);
  return (
    <div className={styles.pageStack}>
      <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
      <PageHeader page={model.page} status={{ label: model.statusLabel, tone: model.statusTone }} />
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <section className={styles.recordSummary} aria-label="Record summary">
            {summaryFacts.length ? <><header className={styles.recordSummaryHeader}>
              <div><small>Record summary</small><h2>Key facts</h2></div>
              <p>Recorded facts stay separate from the places you can investigate next.</p>
            </header><div className={styles.recordSummaryGrid}>
              {summaryFacts.map((fact) => <div className={styles.factItem} key={fact.label}><span className={styles.factLabel}>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</div>)}
            </div></> : null}
            {linkedFacts.length ? <nav className={styles.recordDrilldowns} aria-label="Related information">
              <header><div><small>Supporting records</small><h3>Related information</h3></div><p>Open the store, equipment, work, visit, or cost records connected to this item.</p></header>
              <div>{linkedFacts.map((fact) => <Link href={fact.link!.href} key={fact.label}><span><small>{fact.label}</small><strong>{fact.value}</strong>{fact.helperText ? <em>{fact.helperText}</em> : null}</span><span>{fact.link!.label}<ChevronRight aria-hidden="true" size={15} /></span></Link>)}</div>
            </nav> : null}
          </section>
          {beforeSections}
          <RecordSections sections={model.sections} initialSection={initialSection} />
          {after}
        </>
      )}
    </div>
  );
}
