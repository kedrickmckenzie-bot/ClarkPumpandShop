import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Layers3,
  MapPinned,
  ShieldAlert,
} from "lucide-react";
import type {
  ActionItemViewModel,
  BreakdownViewModel,
  DashboardPageViewModel,
  MetricViewModel,
  Tone,
  TrendViewModel,
} from "@/components/ops/data-contract";
import styles from "./control-tower.module.css";

function toneClass(tone: Tone = "neutral") {
  return {
    neutral: "",
    positive: styles.tonePositive,
    warning: styles.toneWarning,
    critical: styles.toneCritical,
    info: styles.toneInfo,
  }[tone];
}

function PageHeader({ model }: { model: DashboardPageViewModel }) {
  const { page } = model;
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          {page.eyebrow ? <p className={styles.eyebrow}>{page.eyebrow}</p> : null}
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className={styles.pageActions}>
          {page.secondaryAction ? <Link className={styles.secondaryAction} href={page.secondaryAction.href}>{page.secondaryAction.label}</Link> : null}
          {page.primaryAction ? <Link className={styles.primaryAction} href={page.primaryAction.href}>{page.primaryAction.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </header>
      <div className={styles.contextBar} aria-label="Dashboard context">
        <span><MapPinned size={15} aria-hidden="true" /><strong>Scope</strong> {page.scopeLabel}</span>
        {page.periodLabel ? <span><CalendarClock size={15} aria-hidden="true" /><strong>Period</strong> {page.periodLabel}</span> : null}
        {page.updatedLabel ? <span><Clock3 size={15} aria-hidden="true" /><strong>Updated</strong> {page.updatedLabel}</span> : null}
        <span><Layers3 size={15} aria-hidden="true" /><strong>Basis</strong> Source records in your permitted scope</span>
      </div>
    </>
  );
}

function MetricStrip({ metrics }: { metrics: MetricViewModel[] }) {
  if (!metrics.length) return null;
  return (
    <section className={styles.kpiStrip} aria-label="Network pulse">
      {metrics.slice(0, 4).map((metric) => (
        <Link href={metric.link.href} className={styles.kpi} key={metric.id}>
          <span className={styles.kpiLabel}>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.supportingText}</small>
          {metric.trendLabel ? <span className={styles.kpiTrend}>{metric.trendLabel}</span> : null}
        </Link>
      ))}
    </section>
  );
}

function ActionRow({ action }: { action: ActionItemViewModel }) {
  return (
    <Link href={action.link.href} className={`${styles.actionRow} ${toneClass(action.tone)}`}>
      <span className={styles.actionRail} aria-hidden="true" />
      <span className={styles.actionCopy}>
        <span className={styles.actionIdentity}>
          <span>{action.categoryLabel}</span>
          {action.recordLabel ? <span>· {action.recordLabel}</span> : null}
          {action.storeLabel ? <span>· {action.storeLabel}</span> : null}
        </span>
        <strong>{action.title}</strong>
        <p>{action.description}</p>
      </span>
      <span className={styles.actionMeta}><span>Accountable party</span><strong>{action.ownerLabel}</strong></span>
      <span className={styles.actionMeta}><span>Required by</span><strong>{action.dueLabel}</strong></span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

function AttentionSection({ model }: { model: DashboardPageViewModel }) {
  const actions = model.priorityActions.slice(0, 7);
  const critical = model.priorityActions.filter((item) => item.tone === "critical").length;
  const waiting = model.priorityActions.filter((item) => item.tone === "warning").length;
  const remaining = Math.max(0, model.priorityActions.length - actions.length);
  const source = model.prioritySection?.link ?? { href: "/app/action-center", label: "Open action queue" };

  return (
    <section className={styles.section} aria-labelledby="attention-heading">
      <header className={styles.sectionHeader}>
        <div><h2 id="attention-heading">{model.prioritySection?.title ?? "What needs attention now"}</h2><p>{model.prioritySection?.description ?? "Work ordered by responsibility and deadline."}</p></div>
        <Link className={styles.textLink} href={source.href}>{source.label}<ArrowRight size={15} aria-hidden="true" /></Link>
      </header>
      <div className={styles.attentionLayout}>
        <div className={styles.actionList}>
          {actions.length ? actions.map((action) => <ActionRow action={action} key={action.id} />) : <div className={styles.empty}><CheckCircle2 size={22} aria-hidden="true" /><p>No source records currently require action in this scope.</p></div>}
        </div>
        <aside className={styles.attentionSummary} aria-label="Action queue summary">
          <Link href={source.href}><span>Critical or overdue</span><strong>{critical}</strong><small>Needs immediate review</small></Link>
          <Link href={source.href}><span>Waiting or due soon</span><strong>{waiting}</strong><small>Monitor the next action</small></Link>
          <Link href={source.href}><span>Additional records</span><strong>{remaining}</strong><small>Open the complete queue</small></Link>
        </aside>
      </div>
    </section>
  );
}

function Pipeline({ model }: { model: DashboardPageViewModel }) {
  if (!model.journey?.length) return null;
  return (
    <section className={styles.section} aria-labelledby="pipeline-heading">
      <header className={styles.sectionHeader}><div><h2 id="pipeline-heading">Service pipeline</h2><p>Every stage opens the exact work records represented.</p></div></header>
      <div className={styles.pipeline}>
        {model.journey.map((stage) => (
          <Link href={stage.link.href} className={toneClass(stage.tone)} key={stage.id}>
            <span>{stage.label}</span>
            <strong>{stage.value}</strong>
            <small>{stage.supportingText}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Distribution({ model }: { model: BreakdownViewModel }) {
  const maximum = Math.max(1, ...model.segments.map((segment) => Math.max(0, segment.value)));
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><h2>{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div>
        {model.totalLabel ? <strong>{model.totalLabel}</strong> : null}
      </header>
      <div className={styles.distribution}>
        {model.segments.length ? model.segments.slice(0, 7).map((segment) => (
          <Link href={segment.link.href} className={styles.distributionRow} key={segment.id}>
            <span className={styles.distributionLabel}><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
            <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${Math.max(2, (Math.max(0, segment.value) / maximum) * 100)}%` }} /></span>
            <strong className={styles.distributionValue}>{segment.formattedValue}</strong>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )) : <p className={styles.empty}>No source records match this context.</p>}
      </div>
      <footer className={styles.sourceFooter}><span>Scope and basis carry into the source list.</span><Link className={styles.textLink} href={model.sourceLink.href}>{model.sourceLink.label}<ExternalLink size={14} aria-hidden="true" /></Link></footer>
    </section>
  );
}

function Trend({ model }: { model: TrendViewModel }) {
  const maximum = Math.max(1, ...model.points.map((point) => Math.max(0, point.value)));
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}><div><h2>{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div></header>
      {model.points.length ? (
        <div className={styles.trendChart} role="img" aria-label={`${model.title}. ${model.points.map((point) => `${point.label}: ${point.formattedValue}`).join("; ")}`}>
          {model.points.slice(-12).map((point) => (
            <Link href={point.link.href} className={styles.trendPoint} key={point.id} title={`${point.label}: ${point.formattedValue}`}>
              <i style={{ height: `${Math.max(3, (Math.max(0, point.value) / maximum) * 100)}%` }} aria-hidden="true" />
              <strong>{point.formattedValue}</strong>
              <span>{point.label}</span>
            </Link>
          ))}
        </div>
      ) : <p className={styles.empty}>No source records match this context.</p>}
      <footer className={styles.sourceFooter}><span>Each point opens its supporting records.</span><Link className={styles.textLink} href={model.sourceLink.href}>{model.sourceLink.label}<ExternalLink size={14} aria-hidden="true" /></Link></footer>
    </section>
  );
}

function Spotlight({ model }: { model: NonNullable<DashboardPageViewModel["spotlight"]> }) {
  return (
    <Link href={model.link.href} className={styles.spotlight}>
      <div className={styles.spotlightCopy}>
        <p className={styles.eyebrow}>{model.eyebrow ?? "Evidence spotlight"}</p>
        <h2>{model.title}</h2>
        <p>{model.description}</p>
        <span className={styles.textLink}>{model.link.label}<ArrowRight size={15} aria-hidden="true" /></span>
      </div>
      <div className={styles.spotlightFacts}>
        {model.facts.slice(0, 4).map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong>{fact.helperText ? <small>{fact.helperText}</small> : null}</div>)}
      </div>
    </Link>
  );
}

function StatePanel({ model }: { model: DashboardPageViewModel }) {
  if (model.state.kind === "ready") return null;
  const icon = model.state.kind === "error" ? <AlertCircle size={28} aria-hidden="true" /> : model.state.kind === "loading" ? <Clock3 size={28} aria-hidden="true" /> : <ShieldAlert size={28} aria-hidden="true" />;
  const title = model.state.kind === "loading" ? model.state.label ?? "Loading control tower" : model.state.title;
  const message = model.state.kind === "loading" ? "Gathering the latest source records for your permitted scope." : model.state.message;
  return <div className={styles.statePanel}>{icon}<h2>{title}</h2><p>{message}</p></div>;
}

export function ControlTower({ model }: { model: DashboardPageViewModel }) {
  if (model.state.kind !== "ready") {
    return <div className={styles.workspace}><PageHeader model={model} /><StatePanel model={model} /></div>;
  }

  return (
    <div className={styles.workspace}>
      <PageHeader model={model} />
      <AttentionSection model={model} />
      <MetricStrip metrics={model.metrics} />
      <Pipeline model={model} />
      <div className={styles.insightGrid} aria-label="Scope insights">
        {model.breakdowns.slice(0, 2).map((breakdown) => <Distribution model={breakdown} key={breakdown.id} />)}
        {model.trends.slice(0, 2).map((trend) => <Trend model={trend} key={trend.id} />)}
      </div>
      {model.spotlight ? <Spotlight model={model.spotlight} /> : null}
      {model.breakdowns.length + model.trends.length === 0 ? (
        <section className={styles.section}><div className={styles.empty}><BarChart3 size={24} aria-hidden="true" /><p>No insight records are available for this scope and period.</p></div></section>
      ) : null}
    </div>
  );
}
