import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  Landmark,
  Layers3,
  LoaderCircle,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type {
  BreakdownViewModel,
  DataState,
  ProgramPageViewModel,
  TableViewModel,
  Tone,
  TrendViewModel,
} from "@/components/ops/data-contract";
import styles from "./planning-workspace.module.css";

export type PlanningWorkspaceKind = "spend" | "pm" | "lifecycle";

const palette = ["#2563eb", "#64748b", "#0f766e", "#7c3aed", "#d97706", "#dc2626", "#475569"];

const workspaceCopy: Record<PlanningWorkspaceKind, {
  label: string;
  basisTitle: string;
  basis: string;
  sourceTitle: string;
  sourceDescription: string;
}> = {
  spend: {
    label: "Cost intelligence",
    basisTitle: "Recorded work cost",
    basis: "Only entered work-cost lines are totaled here. Approved amounts, vendor proposals, linked invoices, and unmatched invoice amounts remain separate facts.",
    sourceTitle: "Source work and cost",
    sourceDescription: "The selected scope, period, service area, and hierarchy carry into every source record.",
  },
  pm: {
    label: "Preventive maintenance control",
    basisTitle: "Occurrence compliance",
    basis: "Compliance uses completed eligible occurrences divided by all eligible occurrences whose completion window has closed. Open windows and waived work are not silently counted as failures.",
    sourceTitle: "PM occurrence ledger",
    sourceDescription: "Each row is a dated occurrence with its completion window, equipment or plan, status, and canonical work order when one exists.",
  },
  lifecycle: {
    label: "Lifecycle and capital planning",
    basisTitle: "Human capital review",
    basis: "The platform compares the current repair and replacement over the same expected-service horizon. Age, warranty, repeat work, and historical cost stay visible, but no score or rule makes the replacement decision.",
    sourceTitle: "Repair and replacement evidence",
    sourceDescription: "Review the current proposal, service-life assumptions, replacement benchmark, history, and exact source work before deciding.",
  },
};

function toneClass(tone: Tone = "neutral") {
  return {
    neutral: styles.neutral,
    positive: styles.positive,
    warning: styles.warning,
    critical: styles.critical,
    info: styles.info,
  }[tone];
}

function StatePanel({ state }: { state: Exclude<DataState, { kind: "ready" }> }) {
  const loading = state.kind === "loading";
  const error = state.kind === "error";
  const title = loading ? state.label ?? "Loading planning workspace" : state.title;
  const message = loading ? "Gathering the latest source records in your permitted scope." : state.message;
  return (
    <section className={styles.state} role={error ? "alert" : "status"}>
      {loading ? <LoaderCircle className={styles.spin} size={25} aria-hidden="true" /> : error ? <AlertCircle size={25} aria-hidden="true" /> : <Inbox size={25} aria-hidden="true" />}
      <div><h2>{title}</h2><p>{message}</p></div>
      {!loading && "action" in state && state.action ? <Link className={styles.primaryButton} href={state.action.href}>{state.action.label}</Link> : null}
      {error && state.retryHref ? <Link className={styles.secondaryButton} href={state.retryHref}>Try again</Link> : null}
    </section>
  );
}

function WorkspaceHeader({ model, kind }: { model: ProgramPageViewModel; kind: PlanningWorkspaceKind }) {
  const copy = workspaceCopy[kind];
  return (
    <>
      <header className={styles.header}>
        <div>
          <p>{copy.label}</p>
          <h1>{model.page.title}</h1>
          <span>{model.page.description}</span>
        </div>
        <div className={styles.headerActions}>
          {model.page.secondaryAction ? <Link className={styles.secondaryButton} href={model.page.secondaryAction.href}>{model.page.secondaryAction.label}</Link> : null}
          {model.page.primaryAction ? <Link className={styles.primaryButton} href={model.page.primaryAction.href}>{model.page.primaryAction.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </header>
      <div className={styles.context} aria-label="Current planning context">
        <span><Layers3 size={15} aria-hidden="true" /><small>Scope</small><strong>{model.page.scopeLabel}</strong></span>
        {model.page.periodLabel ? <span><Clock3 size={15} aria-hidden="true" /><small>Period</small><strong>{model.page.periodLabel}</strong></span> : null}
        {model.page.updatedLabel ? <span><ShieldCheck size={15} aria-hidden="true" /><small>Data</small><strong>{model.page.updatedLabel}</strong></span> : null}
      </div>
    </>
  );
}

function BasisBanner({ kind }: { kind: PlanningWorkspaceKind }) {
  const copy = workspaceCopy[kind];
  const Icon = kind === "spend" ? CircleDollarSign : kind === "pm" ? CalendarCheck2 : Scale;
  return (
    <section className={styles.basis} aria-label="Evidence basis">
      <span><Icon size={20} aria-hidden="true" /></span>
      <div><small>Evidence basis</small><strong>{copy.basisTitle}</strong><p>{copy.basis}</p></div>
    </section>
  );
}

function Filters({ model }: { model: ProgramPageViewModel }) {
  if (!model.filters?.length) return null;
  return (
    <section className={styles.filters} aria-label="Planning filters">
      <span className={styles.filterLabel}><Filter size={15} aria-hidden="true" />View</span>
      {model.filters.map((filter) => (
        <div key={filter.id}><small>{filter.label}</small><nav aria-label={filter.label}>{filter.options.map((option) => <Link aria-current={option.selected ? "page" : undefined} data-selected={option.selected || undefined} href={option.href} key={option.value}>{option.label}</Link>)}</nav></div>
      ))}
    </section>
  );
}

function MetricStrip({ model, kind }: { model: ProgramPageViewModel; kind: PlanningWorkspaceKind }) {
  return (
    <section className={styles.metrics} aria-label={kind === "pm" ? "PM status filters" : "Key planning measures"}>
      {model.metrics.map((metric) => (
        <Link href={metric.link.href} className={toneClass(metric.tone)} key={metric.id}>
          <span>{metric.label}<ChevronRight size={15} aria-hidden="true" /></span>
          <strong>{metric.value}</strong>
          <p>{metric.supportingText}</p>
          {metric.trendLabel ? <small>{metric.trendLabel}</small> : null}
        </Link>
      ))}
    </section>
  );
}

function Breakdown({ model }: { model: BreakdownViewModel }) {
  const total = model.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let cursor = 0;
  const gradient = total ? `conic-gradient(${model.segments.map((segment, index) => {
    const start = cursor;
    cursor += (Math.max(0, segment.value) / total) * 100;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  }).join(", ")})` : "conic-gradient(#e2e8f0 0 100%)";
  return (
    <article className={styles.panel}>
      <header><div><h2>{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div>{model.totalLabel ? <strong>{model.totalLabel}</strong> : null}</header>
      {model.segments.length ? (
        <div className={styles.breakdown}>
          <div className={styles.donut} style={{ background: gradient }} role="img" aria-label={model.segments.map((segment) => `${segment.label}: ${segment.formattedValue}`).join("; ")}><span><strong>{model.totalLabel ?? total}</strong><small>source total</small></span></div>
          <div className={styles.segmentList}>{model.segments.map((segment, index) => (
            <Link href={segment.link.href} key={segment.id}>
              <i style={{ background: palette[index % palette.length] }} aria-hidden="true" />
              <span><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
              <b>{segment.formattedValue}</b><ChevronRight size={15} aria-hidden="true" />
            </Link>
          ))}</div>
        </div>
      ) : <div className={styles.empty}><Inbox size={19} aria-hidden="true" />No source records match this context.</div>}
      <footer><Link href={model.sourceLink.href}>{model.sourceLink.label}<ExternalLink size={13} aria-hidden="true" /></Link></footer>
    </article>
  );
}

function Trend({ model }: { model: TrendViewModel }) {
  const maximum = Math.max(1, ...model.points.map((point) => Math.max(0, point.value)));
  return (
    <article className={styles.panel}>
      <header><div><h2>{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div></header>
      {model.points.length ? <div className={styles.trend} role="img" aria-label={model.points.map((point) => `${point.label}: ${point.formattedValue}`).join("; ")}>{model.points.slice(-12).map((point) => <Link href={point.link.href} key={point.id} title={`${point.label}: ${point.formattedValue}`}><strong>{point.formattedValue}</strong><i aria-hidden="true"><span style={{ height: `${Math.max(4, (Math.max(0, point.value) / maximum) * 100)}%` }} /></i><small>{point.label}</small></Link>)}</div> : <div className={styles.empty}><BarChart3 size={19} aria-hidden="true" />No trend records match this context.</div>}
      <footer><Link href={model.sourceLink.href}>{model.sourceLink.label}<ExternalLink size={13} aria-hidden="true" /></Link></footer>
    </article>
  );
}

function ActionQueue({ model, kind }: { model: ProgramPageViewModel; kind: PlanningWorkspaceKind }) {
  if (!model.priorityActions.length) return null;
  const label = kind === "pm" ? "PM and service follow-up" : kind === "lifecycle" ? "Decisions and missing evidence" : "Cost and service items requiring attention";
  return (
    <section className={styles.actions}>
      <header><div><p>Accountability</p><h2>{label}</h2></div><Link href="/app/action-center">Open full action queue<ArrowRight size={14} aria-hidden="true" /></Link></header>
      <div>{model.priorityActions.slice(0, 6).map((action) => <Link href={action.link.href} key={action.id}><i className={toneClass(action.tone)} aria-hidden="true" /><span><small>{[action.categoryLabel, action.recordLabel, action.storeLabel].filter(Boolean).join(" · ")}</small><strong>{action.title}</strong><p>{action.description}</p></span><span className={styles.owner}><small>Accountable</small><strong>{action.ownerLabel}</strong></span><span className={styles.due}><small>Due</small><strong>{action.dueLabel}</strong></span><ChevronRight size={16} aria-hidden="true" /></Link>)}</div>
    </section>
  );
}

function SourceTable({ table, title, description }: { table?: TableViewModel; title: string; description: string }) {
  if (!table) return null;
  return (
    <section className={styles.sourceSection}>
      <header><div><p>Supporting records</p><h2>{title}</h2><span>{description}</span></div><strong>{table.rows.length} shown</strong></header>
      {table.rows.length ? <div className={styles.tableScroller}><table><caption className={styles.visuallyHidden}>{table.caption}</caption><thead><tr>{table.columns.map((column) => <th data-align={column.align} key={column.key}>{column.label}</th>)}</tr></thead><tbody>{table.rows.map((row) => <tr key={row.id}>{table.columns.map((column, index) => { const cell = row.cells.find((candidate) => candidate.key === column.key); return <td data-align={column.align} className={cell?.tone ? toneClass(cell.tone) : undefined} key={column.key}><Link href={row.href}><span><strong>{cell?.value ?? "—"}</strong>{cell?.secondary ? <small>{cell.secondary}</small> : null}</span>{index === table.columns.length - 1 ? <ChevronRight size={14} aria-hidden="true" /> : null}</Link></td>; })}</tr>)}</tbody></table></div> : <div className={styles.empty}><Inbox size={19} aria-hidden="true" />No source records match this context.</div>}
    </section>
  );
}

function LifecycleAdministration({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <details className={styles.administration}><summary><span><Landmark size={18} aria-hidden="true" /><span><strong>Replacement planning settings</strong><small>Profiles, benchmarks, escalation, and cohort rules</small></span></span><ChevronRight size={16} aria-hidden="true" /></summary><div>{children}</div></details>;
}

export function PlanningWorkspace({
  model,
  kind,
  administration,
}: {
  model: ProgramPageViewModel;
  kind: PlanningWorkspaceKind;
  administration?: ReactNode;
}) {
  const copy = workspaceCopy[kind];
  return (
    <main className={styles.workspace}>
      <WorkspaceHeader model={model} kind={kind} />
      {model.state.kind !== "ready" ? <StatePanel state={model.state} /> : <>
        <BasisBanner kind={kind} />
        <Filters model={model} />
        <MetricStrip model={model} kind={kind} />
        <section className={styles.insights} aria-label={`${copy.label} analysis`}>
          {model.breakdowns.map((breakdown) => <Breakdown model={breakdown} key={breakdown.id} />)}
          {model.trends.map((trend) => <Trend model={trend} key={trend.id} />)}
        </section>
        <ActionQueue model={model} kind={kind} />
        <SourceTable table={model.table} title={copy.sourceTitle} description={copy.sourceDescription} />
        {kind === "lifecycle" ? <LifecycleAdministration>{administration}</LifecycleAdministration> : null}
      </>}
    </main>
  );
}
