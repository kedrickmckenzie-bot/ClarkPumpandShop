import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Inbox } from "lucide-react";
import type { FilterOptionViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import { StoreJump } from "@/components/ops/store-jump";
import type { buildTrendMonth, buildTrendsDashboard, buildTrendWhy } from "@/app/app/_data/trends-dashboard";
import { TrendTabs } from "./trend-tabs";
import styles from "./trends-dashboard.module.css";

type Dashboard = ReturnType<typeof buildTrendsDashboard>;

function Pick({ label, options }: { label: string; options: FilterOptionViewModel[] }) {
  if (options.length < 2) return null;
  const chosen = options.find(option => option.selected) ?? options[0];
  return <details className={styles.pick}><summary><small>{label}</small><strong>{chosen.label}</strong><ChevronDown size={15} aria-hidden="true" /></summary>
    <div>{options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "true" : undefined}>{option.label}</Link>)}</div></details>;
}

/** 24 months as a small line; the last 12 drawn darker. */
function Spark({ values }: { values: Array<number | null> }) {
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return <span className={styles.sparkEmpty} />;
  const max = Math.max(...known), min = Math.min(...known), span = max - min || 1;
  const point = (value: number, index: number) => `${(index / (values.length - 1)) * 120},${30 - ((value - min) / span) * 26}`;
  const line = (from: number, to: number) => values.slice(from, to).map((value, offset) => value === null ? null : point(value, from + offset)).filter(Boolean).join(" ");
  return <svg className={styles.spark} viewBox="0 0 120 32" aria-hidden="true" preserveAspectRatio="none">
    <polyline points={line(0, 13)} className={styles.sparkOld} />
    <polyline points={line(12, values.length)} className={styles.sparkNew} />
  </svg>;
}

/** This year's months against the same months a year earlier. Points open the records behind them. */
function YearChart({ chart }: { chart: Dashboard["chart"] }) {
  const width = 760, height = 240, left = 64, right = 16, top = 16, bottom = 30;
  const values = chart.points.flatMap(point => [point.value, point.before]).filter((value): value is number => value !== null);
  const max = Math.max(1, ...values) * 1.1;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, chart.points.length - 1));
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const path = (key: "value" | "before") => chart.points.map((point, index) => point[key] === null ? null : `${x(index)},${y(point[key]!)}`).filter(Boolean).join(" ");
  const ticks = [0, 0.5, 1].map(share => max / 1.1 * share);
  const tickLabel = (value: number) => {
    if (chart.measure === "spend" || chart.measure === "cost_per_job") return value >= 100_000 ? `$${Math.round(value / 100_000)}k` : `$${Math.round(value / 100)}`;
    if (chart.measure === "came_back" || chart.measure === "pm_done") return `${Math.round(value * 100)}%`;
    return chart.measure === "days_to_fix" ? `${value.toFixed(1)}d` : String(Math.round(value));
  };
  return <figure className={styles.chart}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.label} by month, this year and the year before`}>
      {ticks.map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={styles.grid} /><text x={left - 8} y={y(tick) + 4} textAnchor="end" className={styles.axis}>{tickLabel(tick)}</text></g>)}
      <polyline points={path("before")} className={styles.lineBefore} />
      <polyline points={path("value")} className={styles.lineNow} />
      {chart.points.map((point, index) => <g key={point.key}>
        <text x={x(index)} y={height - 8} textAnchor="middle" className={styles.axis}>{point.label}{point.partial ? "*" : ""}</text>
        {point.before !== null ? <a href={point.beforeHref}><circle cx={x(index)} cy={y(point.before)} r={4} className={styles.dotBefore}><title>{`${point.label} a year earlier: ${point.beforeLabel}`}</title></circle></a> : null}
        {point.value !== null ? <a href={point.href}><circle cx={x(index)} cy={y(point.value)} r={5} className={point.partial ? styles.dotPartial : styles.dotNow}><title>{`${point.label}${point.partial ? " so far" : ""}: ${point.valueLabel} · a year earlier ${point.beforeLabel}`}</title></circle></a> : null}
      </g>)}
    </svg>
    <figcaption><span><i className={styles.keyNow} />Last 12 months</span><span><i className={styles.keyBefore} />Same months a year earlier</span>{chart.points.some(point => point.partial) ? <span>* this month so far, compared with the same days a year ago</span> : null}</figcaption>
    <details className={styles.asTable}><summary>Show as a table</summary>
      <table><thead><tr><th>Month</th><th data-align="end">This year</th><th data-align="end">A year earlier</th></tr></thead>
        <tbody>{chart.points.map(point => <tr key={point.key}><td>{point.label}{point.partial ? " (so far)" : ""}</td><td data-align="end"><Link href={point.href}>{point.valueLabel}</Link></td><td data-align="end"><Link href={point.beforeHref}>{point.beforeLabel}</Link></td></tr>)}</tbody></table>
    </details>
  </figure>;
}

export function TrendsDashboard({ model }: { model: Dashboard }) {
  const selected = model.tiles.find(tile => tile.selected)!;
  return (
    <div className={styles.page}>
      <header className={styles.header}><div><h1>Trends</h1><p>Getting better or worse, and why · {model.scopeLabel}</p></div><Link className={styles.secondary} href={model.href("/app/spend")}>Spending</Link></header>
      <TrendTabs active="overview" />
      <section className={styles.controls} aria-label="What to show"><StoreJump always /><Pick label="Service area" options={model.areaOptions} /><span className={styles.period}>{model.periodLabel}</span></section>

      <nav className={styles.tiles} aria-label="Measures">{model.tiles.map(tile => (
        <Link key={tile.id} href={tile.href} className={styles.tile} aria-current={tile.selected ? "page" : undefined}>
          <span className={styles.tileLabel}>{tile.label}</span>
          <strong>{tile.value}</strong>
          <span className={styles.change} data-tone={tile.change.tone}>{tile.change.label}{tile.before !== "—" ? <small> · was {tile.before}</small> : null}</span>
          <Spark values={tile.spark} />
        </Link>
      ))}</nav>

      <section className={styles.card} aria-labelledby="trend-chart">
        <header><div><h2 id="trend-chart">{selected.label} by month</h2><p>{model.chart.definition}</p></div><span className={styles.change} data-tone={selected.change.tone}>{selected.change.label} vs. last year</span></header>
        <YearChart chart={model.chart} />
      </section>

      <div className={styles.pair}>
        <section className={styles.card} aria-labelledby="why">
          <header><div><h2 id="why">Why spending changed</h2><p>{model.why.before} → {model.why.after} · <strong data-tone={model.why.change > 0 ? "worse" : "better"}>{model.why.changeLabel}</strong></p></div><Link href={model.href("/app/trends/why")}>Details<ChevronRight size={14} aria-hidden="true" /></Link></header>
          <ol className={styles.parts}>{model.why.parts.map(part => <li key={part.id}><Link href={part.href}>
            <span className={styles.partName}><strong>{part.label}</strong><small>{part.detail}</small></span>
            <span className={styles.diverge} aria-hidden="true"><i data-side={part.amount >= 0 ? "up" : "down"} style={{ width: `${Math.abs(part.amount) / model.why.max * 50}%` }} /></span>
            <b data-tone={part.amount > 0 ? "worse" : part.amount < 0 ? "better" : "neutral"}>{part.amountLabel}</b>
          </Link></li>)}</ol>
          <p className={styles.note}>The four parts add up exactly to the change. A pattern from your records, not proof of cause.</p>
        </section>

        <section className={styles.card} aria-labelledby="movers">
          <header><h2 id="movers">Biggest movers</h2><nav className={styles.segments} aria-label="Movers by">{model.movers.options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "page" : undefined}>{option.label}</Link>)}</nav></header>
          {model.movers.rows.length ? <ol className={styles.parts}>{model.movers.rows.map(row => <li key={row.key}><Link href={row.href}>
            <span className={styles.partName}><strong>{row.label}</strong><small>{row.before} → {row.after}</small></span>
            <span className={styles.diverge} aria-hidden="true"><i data-side={row.change >= 0 ? "up" : "down"} style={{ width: `${Math.abs(row.change) / model.movers.max * 50}%` }} /></span>
            <b data-tone={row.change > 0 ? "worse" : row.change < 0 ? "better" : "neutral"}>{row.changeLabel}</b>
          </Link></li>)}</ol> : <p className={styles.empty}><Inbox size={18} aria-hidden="true" />No spending to compare.</p>}
          <p className={styles.note}>Spend, last 12 months vs. the 12 before. Biggest change first, up or down.</p>
        </section>
      </div>

      {model.odd.length ? <section className={styles.card} aria-labelledby="odd">
        <header><h2 id="odd">Unusual months</h2><span className={styles.period}>Spend well above a typical month</span></header>
        <ul className={styles.odd}>{model.odd.map(row => <li key={row.key}>
          <Link href={row.href} className={styles.oddMonth}><strong>{row.label}</strong><small>{row.value} · {row.times}</small></Link>
          {row.cause && row.causeHref ? <Link href={row.causeHref} className={styles.oddCause}>{row.cause}</Link> : null}
        </li>)}</ul>
      </section> : null}
    </div>
  );
}

export function TrendMonthPage({ model }: { model: ReturnType<typeof buildTrendMonth> }) {
  return <div className={styles.page}>
    <Link className={styles.back} href={model.backHref}><ArrowLeft size={15} aria-hidden="true" />Trends</Link>
    <header className={styles.header}><div><h1>{model.title}</h1><p>{model.value} · {model.count} records · {model.scopeLabel}</p></div></header>
    <section className={styles.card}>
      <p className={styles.note}>{model.definition}</p>
      {model.rows.length ? <table className={styles.table}><thead><tr><th>Record</th><th>Store</th><th data-align="end">Counted as</th></tr></thead>
        <tbody>{model.rows.map(row => <tr key={row.id}><td><Link href={row.href} className={styles.strong}>{row.title}</Link><small>{row.detail}</small></td><td>{row.store}</td><td data-align="end" data-bad={row.bad || undefined}>{row.value}</td></tr>)}</tbody></table>
        : <p className={styles.empty}><Inbox size={18} aria-hidden="true" />Nothing counted this month.</p>}
      {model.pagination ? <PaginationControls pagination={model.pagination} label="Record pages" /> : null}
    </section>
  </div>;
}

export function TrendWhyPage({ model }: { model: ReturnType<typeof buildTrendWhy> }) {
  const jobs = (rows: typeof model.bigAfter) => rows.length ? <table className={styles.table}><tbody>{rows.map(row => <tr key={row.id}><td><Link href={row.href} className={styles.strong}>{row.label}</Link></td><td>{row.store}</td><td data-align="end">{row.amount}</td></tr>)}</tbody></table> : <p className={styles.empty}>None.</p>;
  return <div className={styles.page}>
    <Link className={styles.back} href={model.backHref}><ArrowLeft size={15} aria-hidden="true" />Trends</Link>
    <header className={styles.header}><div><h1>Why spending changed</h1><p>{model.before} → {model.after} · last 12 months vs. the 12 before · {model.scopeLabel}</p></div></header>
    <section className={styles.card} id="big"><header><h2>A few big one-off jobs · {model.parts.big}</h2><span className={styles.period}>Jobs of {model.threshold} or more</span></header>
      <div className={styles.pair}><div><h3>Last 12 months</h3>{jobs(model.bigAfter)}</div><div><h3>The 12 before</h3>{jobs(model.bigBefore)}</div></div></section>
    <section className={styles.card} id="volume"><header><h2>More or fewer jobs · {model.parts.volume}</h2></header>
      <p>{model.regular.jobsAfter} jobs with cost vs. {model.regular.jobsBefore}, counted at the earlier typical cost of {model.regular.avgBefore}. Big one-offs are left out here.</p></section>
    <section className={styles.card} id="mix"><header><h2>Shift in the kind of work · {model.parts.mix}</h2></header>
      <p className={styles.note}>When more of the jobs are costlier kinds of work, spending rises even at the same prices.</p>
      <table className={styles.table}><thead><tr><th>Service area</th><th data-align="end">Share of jobs before</th><th data-align="end">Share now</th><th data-align="end">Average before</th><th data-align="end">Average now</th></tr></thead>
        <tbody>{model.areas.map(row => <tr key={row.key}><td><strong>{row.label}</strong><small>{row.jobsBefore} → {row.jobsAfter} jobs</small></td><td data-align="end">{row.shareBefore}</td><td data-align="end">{row.shareAfter}</td><td data-align="end">{row.avgBefore}</td><td data-align="end">{row.avgAfter}</td></tr>)}</tbody></table></section>
    <section className={styles.card} id="rate"><header><h2>Each job cost more or less · {model.parts.rate}</h2></header>
      <p>The same kind of job at a different price. Average job {model.regular.avgBefore} before, {model.regular.avgAfter} now; the table above shows it by service area.</p></section>
  </div>;
}
