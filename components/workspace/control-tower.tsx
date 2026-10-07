import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPinned,
  ShieldAlert,
} from "lucide-react";
import type {
  BreakdownViewModel,
  DashboardPageViewModel,
  MetricViewModel,
  Tone,
  TrendViewModel,
} from "@/components/ops/data-contract";
import styles from "./control-tower.module.css";
import { CompanySpendSummary } from "./company-spend-summary";

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
        <span><MapPinned size={15} aria-hidden="true" /><strong>Viewing</strong> {page.scopeLabel}</span>
        {page.periodLabel ? <span><CalendarClock size={15} aria-hidden="true" /><strong>Cost period</strong> {page.periodLabel}</span> : null}
        {page.updatedLabel ? <span><Clock3 size={15} aria-hidden="true" /><strong>Updated</strong> {page.updatedLabel}</span> : null}
      </div>
    </>
  );
}

function MetricStrip({ metrics }: { metrics: MetricViewModel[] }) {
  if (!metrics.length) return null;
  return (
    <section className={styles.kpiStrip} aria-label="Network pulse">
      {metrics.slice(0, 4).map((metric) => (
        <Link href={metric.link.href} className={`${styles.kpi} ${toneClass(metric.tone)}`} key={metric.id}>
          <span className={styles.kpiTopline}><span className={styles.kpiLabel}>{metric.label}</span><ChevronRight aria-hidden="true" size={16} /></span>
          <strong>{metric.value}</strong>
          <small>{metric.supportingText}</small>
          {metric.trendLabel ? <span className={styles.kpiTrend}>{metric.trendLabel}</span> : null}
        </Link>
      ))}
    </section>
  );
}



function Pipeline({ model }: { model: DashboardPageViewModel }) {
  if (!model.journey?.length) return null;
  return (
    <section className={styles.section} aria-labelledby="pipeline-heading">
      <header className={styles.sectionHeader}><div><h2 id="pipeline-heading">Where work stands</h2><p>Select a stage to see the work behind it.</p></div></header>
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
        {model.segments.length ? model.segments.map((segment) => (
          <Link href={segment.link.href} className={styles.distributionRow} key={segment.id}>
            <span className={styles.distributionLabel}><strong>{segment.label}</strong><small>{segment.shareLabel ?? segment.link.label}</small></span>
            <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${segment.value > 0 ? Math.max(2, (segment.value / maximum) * 100) : 0}%` }} /></span>
            <strong className={styles.distributionValue}>{segment.formattedValue}</strong>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )) : <p className={styles.empty}>No source records match this context.</p>}
      </div>
      <footer className={styles.sourceFooter}>{model.coverageLabel ? <span>{model.coverageLabel}</span> : null}<Link className={styles.textLink} href={model.sourceLink.href}>{model.sourceLink.label}<ExternalLink size={14} aria-hidden="true" /></Link></footer>
    </section>
  );
}

function Trend({ model }: { model: TrendViewModel }) {
  const maximum = Math.max(1, ...model.points.map((point) => Math.max(0, point.value)));
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}><div><h2>{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div></header>
      {model.points.length ? (
        <div className={styles.trendChart} style={{ gridTemplateColumns: `repeat(${model.points.length}, minmax(56px, 1fr))` }} role="group" aria-label={`${model.title}. ${model.points.map((point) => `${point.label}: ${point.formattedValue}`).join("; ")}`}>
          {model.points.slice(-12).map((point) => (
            <Link href={point.link.href} className={styles.trendPoint} key={point.id} title={`${point.label}: ${point.formattedValue}`}>
              <i style={{ height: point.value > 0 ? `${Math.max(3, (point.value / maximum) * 100)}%` : "0" }} aria-hidden="true" />
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
  const title = model.state.kind === "loading" ? model.state.label ?? "Loading your dashboard" : model.state.title;
  const message = model.state.kind === "loading" ? "Getting the latest records available to you." : model.state.message;
  return <div className={styles.statePanel}>{icon}<h2>{title}</h2><p>{message}</p></div>;
}

export function EquipmentIssues({ model }: { model: NonNullable<DashboardPageViewModel["equipmentIssues"]> }) {
  return <section id="equipment-issues" className={styles.section} aria-labelledby="equipment-issues-title">
    <div className={styles.issueHeading}><div><h2 id="equipment-issues-title">Most frequent equipment issues</h2><p>{model.period} · {model.totalCount ? `Top ${Math.min(5, model.totalCount)} in your scope` : "Your equipment scope"}</p></div><Link href={model.href} className={styles.textLink}>View all <ArrowRight size={16} aria-hidden="true" /></Link></div>
    {model.rows.length ? <div className={styles.issueTable}><table><caption>Equipment ranked by unplanned work orders</caption><thead><tr><th>Equipment</th><th>Store</th><th>Issues</th><th>Recorded work cost · {model.currency}</th><th>Latest issue</th></tr></thead><tbody>{model.rows.map(row => <tr key={row.id}>
      <td><Link href={row.href}>{row.name}</Link><small>{row.assetTag}</small></td><td>{row.storeLabel}</td>
      <td data-suffix={row.issueCount === 1 ? " issue" : " issues"}><Link href={row.href} aria-label={`${row.issueCount} ${row.issueCount === 1 ? "issue" : "issues"} for ${row.name} at ${row.storeLabel}`}>{row.issueCount}</Link></td>
      <td>{row.cost}<small>{row.coverage}</small></td><td data-prefix="Latest issue: ">{row.latestIssue}</td>
    </tr>)}</tbody></table></div> : <p className={styles.issueNote}>No unplanned work orders are linked to equipment in this period.</p>}
    <p className={styles.issueNote}>Unplanned work linked to equipment. Counts describe issues, not confirmed outages. <Link href="/app/work-orders?asset=unlinked&status=all">Review work without equipment</Link>.</p>
  </section>;
}

/** What changed since this person last pressed "Mark as seen". Each count opens exactly its jobs. */
export function SinceLastLooked({ model }: { model: NonNullable<DashboardPageViewModel["sinceLastLooked"]> }) {
  const changed = model.parts.filter(part => part.count > 0);
  return <section id="since-last-looked" className={styles.sinceBar} aria-labelledby="since-last-looked-title">
    <div className={styles.sinceCopy}>
      <h2 id="since-last-looked-title">Since you last looked</h2>
      <p className={styles.sinceWhen}>{model.sinceLabel}</p>
      {changed.length ? <p className={styles.sinceParts}>{changed.map((part, index) => <span key={part.kind}>{index ? <span aria-hidden="true" className={styles.sinceDot}>·</span> : null}<Link href={part.href} className={part.kind === "fixed" ? styles.sinceGood : styles.sinceAlert}><strong>{part.count}</strong> {part.label}</Link></span>)}</p>
        : <p className={styles.sinceParts}>Nothing new.</p>}
    </div>
    <form method="post" action={model.markSeenAction}><button type="submit" className={styles.sinceButton}>Mark as seen</button></form>
  </section>;
}

/** Repeat problems: equipment with several repair calls in a short window, using the issue-ranking rule. */
export function RepeatProblems({ model }: { model: NonNullable<DashboardPageViewModel["repeatProblems"]> }) {
  return <section id="repeat-problems" className={styles.section} aria-labelledby="repeat-problems-title">
    <div className={styles.issueHeading}><div><h2 id="repeat-problems-title">Repeat problems</h2><p>{model.minIssues}+ repair calls in the last {model.days} days · {model.period}</p></div><Link href={model.totalCount > model.rows.length ? model.href : model.allIssuesHref ?? model.href} className={styles.textLink}>{model.totalCount > model.rows.length ? `View all ${model.totalCount}` : "All equipment issues"} <ArrowRight size={16} aria-hidden="true" /></Link></div>
    {model.rows.length ? <div className={styles.issueTable}><table><caption>Equipment with repeat repair calls</caption><thead><tr><th>Equipment</th><th>Store</th><th>Calls</th><th>Recorded work cost</th><th>Latest call</th></tr></thead><tbody>{model.rows.map(row => <tr key={row.id}>
      <td><Link href={row.href}>{row.name}</Link><small>{row.assetTag}</small></td><td>{row.storeLabel}</td>
      <td data-suffix=" calls"><Link href={row.href} aria-label={`${row.issueCount} repair calls for ${row.name} at ${row.storeLabel}`}>{row.issueCount}</Link></td>
      <td>{row.cost}<small>{row.coverage}</small></td><td data-prefix="Latest call: ">{row.latestIssue}</td>
    </tr>)}</tbody></table></div> : <p className={styles.issueNote}>No equipment has {model.minIssues} or more repair calls in the last {model.days} days.</p>}
  </section>;
}

export function ControlTower({ model, capitalSummary, operatingSummary }: { model: DashboardPageViewModel; capitalSummary?: ReactNode; operatingSummary?: ReactNode }) {
  if (model.state.kind !== "ready") {
    return <div className={styles.workspace}><PageHeader model={model} /><StatePanel model={model} /></div>;
  }

  const useSpendSummary = model.layout === "operations" || model.layout === "regional";
  const isSpendBreakdown = (breakdown: BreakdownViewModel) => ["recorded-cost-by-service-area", "recorded-cost-by-store"].includes(breakdown.id);
  const regularBreakdowns = useSpendSummary ? model.breakdowns.filter(breakdown => !isSpendBreakdown(breakdown)) : model.breakdowns;
  const spendSummary = useSpendSummary ? <CompanySpendSummary breakdowns={model.breakdowns.filter(isSpendBreakdown).sort((a, b) => a.id.localeCompare(b.id))} /> : null;
  const insights = regularBreakdowns.length + model.trends.length ? (
    <div className={styles.insightStack} aria-label="Scope insights">
      {regularBreakdowns.length ? (
        <div className={styles.insightGrid}>
          {regularBreakdowns.slice(0, model.layout === "executive" ? 3 : 2).map((breakdown) => <Distribution model={breakdown} key={breakdown.id} />)}
        </div>
      ) : null}
      {model.trends.slice(0, 2).map((trend) => <Trend model={trend} key={trend.id} />)}
    </div>
  ) : (
    <section className={styles.section}><div className={styles.empty}><BarChart3 size={24} aria-hidden="true" /><p>No insight records are available for this scope and period.</p></div></section>
  );
  const since = model.sinceLastLooked ? <SinceLastLooked model={model.sinceLastLooked} /> : null;
  const metrics = <>{since}<MetricStrip metrics={model.metrics} />{operatingSummary}</>;
  // Every role can reach the review queue from the Overview: a count tile when the layout has one, otherwise one link.
  const queueLink = model.metrics.some((metric) => metric.link.href.startsWith("/app/action-center")) ? null
    : <p className={styles.queueLink}><Link className={styles.textLink} href="/app/action-center">Open review queue<ArrowRight size={15} aria-hidden="true" /></Link></p>;
  const pipeline = <Pipeline model={model} />;
  const spotlight = model.spotlight ? <Spotlight model={model.spotlight} /> : null;
  const repeat = model.repeatProblems ? <RepeatProblems model={model.repeatProblems} /> : null;
  // One equipment table: repeat problems when shown, with the full issue ranking one tap away; otherwise the ranking.
  const equipment = repeat ?? (model.equipmentIssues ? <EquipmentIssues model={model.equipmentIssues} /> : null);
  let content: ReactNode;

  switch (model.layout) {
    case "executive":
      // Owner order: money first, where it goes, what is broken, upcoming decisions.
      content = <>{metrics}{queueLink}{insights}{equipment}{capitalSummary}{spotlight}</>;
      break;
    case "finance":
      content = <>{metrics}{queueLink}{capitalSummary}{pipeline}{equipment}<details className={styles.section}><summary>Spending and equipment insights</summary>{insights}{spotlight}</details></>;
      break;
    case "regional":
      content = <>{metrics}{capitalSummary}{equipment}{spendSummary}<details className={styles.section}><summary>More insights</summary>{insights}{spotlight}</details></>;
      break;
    case "store":
      content = <>{metrics}{capitalSummary}{equipment}{pipeline}{insights}{spotlight}</>;
      break;
    case "operations":
    default:
      // The "Needs your action" tile opens the review queue; the work summary lines replace the stage tiles here.
      content = <>{metrics}{capitalSummary}{equipment}{spendSummary}<details className={styles.section}><summary>More insights</summary>{insights}{spotlight}</details></>;
  }

  return <div className={styles.workspace}><PageHeader model={model} />{content}</div>;
}
