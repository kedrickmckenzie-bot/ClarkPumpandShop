import Link from "next/link";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ScorecardCell, ScorecardDrill, ScorecardPageModel, ScorecardRow } from "@/app/app/_data/vendor-scorecard-presenter";
import { MEASURES, MEASURE_INFO } from "@/lib/ops/vendor-scorecard";
import { PrintButton, RegionSelect } from "./scorecard-controls";
import styles from "./vendor-scorecard-page.module.css";

function Trend({ cell }: { cell: ScorecardCell }) {
  const { trend, value, priorValue } = cell.summary;
  if (!trend || value === undefined || priorValue === undefined || !cell.trendLabel) return null;
  const Icon = value > priorValue ? ArrowUp : ArrowDown;
  return <span className={trend === "better" ? styles.better : styles.worse} title={cell.trendLabel}>
    <Icon size={14} strokeWidth={2.5} aria-hidden="true" /><span className={styles.srOnly}>{cell.trendLabel}</span>
  </span>;
}

function Cell({ cell, vendorName }: { cell: ScorecardCell; vendorName: string }) {
  const info = MEASURE_INFO[cell.measure];
  const rank = cell.summary.rank;
  const alert = cell.measure === "invoice" && cell.summary.hits > 0;
  const className = [cell.empty || cell.summary.tooFew ? styles.quiet : "", cell.summary.counted === 0 && cell.measure !== "jobs" ? styles.noData : ""].filter(Boolean).join(" ");
  return <td data-label={info.label} className={className || undefined}>
    <Link href={cell.href} scroll={false} className={styles.cellLink} aria-label={`${vendorName}, ${info.label}: ${cell.value === "—" ? cell.detail : `${cell.value}, ${cell.detail}`}. Show the jobs.`}>
      <span className={`${styles.value} ${alert ? styles.alert : ""}`}>{cell.value}<Trend cell={cell} /></span>
      <span className={styles.detail}>{cell.detail}</span>
      {rank ? <span className={rank === "best" ? styles.best : styles.weakest}>{rank === "best" ? "Best" : "Weakest"}</span> : null}
    </Link>
  </td>;
}

function Drill({ drill }: { drill: ScorecardDrill }) {
  return <section id="scorecard-jobs" className={styles.drill} aria-labelledby="scorecard-jobs-title">
    <header className={styles.drillHead}>
      <div>
        <p className={styles.drillEyebrow}>{drill.vendorName} · {drill.tradeLabel}</p>
        <h3 id="scorecard-jobs-title">{drill.measureLabel}</h3>
        <p className={styles.drillHeadline}>{drill.headline}</p>
        <p className={styles.drillDefinition}>{drill.definition}</p>
      </div>
      <Link href={drill.closeHref} scroll={false} className={styles.close}><X size={16} aria-hidden="true" />Close</Link>
    </header>
    {drill.rows.length ? <div className={styles.drillTable}><table>
      <caption className={styles.srOnly}>Jobs behind {drill.measureLabel} for {drill.vendorName}</caption>
      <thead><tr><th scope="col">Job</th><th scope="col">Store</th><th scope="col">Problem</th><th scope="col">Sent</th><th scope="col">Result</th></tr></thead>
      <tbody>{drill.rows.map(row => <tr key={row.workOrderId}>
        <td data-label="Job"><Link href={`/app/work-orders/${encodeURIComponent(row.workOrderId)}`}>{row.number}</Link></td>
        <td data-label="Store">{row.store}</td>
        <td data-label="Problem" className={styles.problem}>{row.problem}</td>
        <td data-label="Sent">{row.sent}</td>
        <td data-label="Result"><span className={row.tone === "good" ? styles.pillGood : row.tone === "bad" ? styles.pillBad : styles.pill}>{row.result}</span></td>
      </tr>)}</tbody>
    </table></div> : <p className={styles.empty}>No jobs count toward this yet.</p>}
  </section>;
}

function ScoreTable({ caption, rows, showTrade }: { caption: string; rows: ScorecardRow[]; showTrade?: boolean }) {
  return <div className={styles.tableWrap}>
    <table className={styles.table}>
      <caption className={styles.srOnly}>{caption}</caption>
      <thead><tr><th scope="col">Vendor</th>{MEASURES.map(key => <th scope="col" key={key} title={MEASURE_INFO[key].definition}>{MEASURE_INFO[key].label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={`${row.trade}:${row.vendorId}`}>
        <th scope="row"><Link href={row.vendorHref}>{row.vendorName}</Link>{showTrade ? <span className={styles.rowTrade}>{row.tradeLabel}</span> : null}</th>
        {row.cells.map(cell => <Cell key={cell.measure} cell={cell} vendorName={row.vendorName} />)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function VendorScorecardPage({ model }: { model: ScorecardPageModel }) {
  const soloDrill = model.drill && model.solo.some(row => row.trade === model.drill!.trade);
  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Vendors</p>
        <h1>Vendor scorecards</h1>
        <p className={styles.lede}>How each vendor performs on your jobs, next to vendors doing the same type of work.</p>
      </div>
      <PrintButton className={styles.printButton} />
    </header>

    <dl className={styles.context}>
      <div><dt>Viewing</dt><dd>{model.scopeLabel}</dd></div>
      <div><dt>Period</dt><dd>{model.periodLabel}</dd></div>
      <div><dt>Arrows compare with</dt><dd>{model.priorLabel}</dd></div>
    </dl>

    <div className={styles.controls}>
      <nav className={styles.segmented} aria-label="Period">
        {model.periods.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "page" : undefined} className={option.selected ? styles.segmentOn : styles.segment}>{option.label}</Link>)}
      </nav>
      {model.regions.length ? <RegionSelect className={styles.region} regions={model.regions} value={model.region} baseHref={model.regionBase} /> : null}
    </div>

    {model.trades.length > 1 ? <nav className={styles.trades} aria-label="Type of work">
      <Link href={model.allTradesHref} aria-current={model.trades.some(t => t.selected) ? undefined : "page"} className={model.trades.some(t => t.selected) ? styles.chip : styles.chipOn}>All types <span>{model.totals.jobs}</span></Link>
      {model.trades.map(trade => <Link key={trade.value} href={trade.href} aria-current={trade.selected ? "page" : undefined} className={trade.selected ? styles.chipOn : styles.chip}>{trade.label} <span>{trade.jobs}</span></Link>)}
    </nav> : null}

    {model.groups.length ? model.groups.map(group => <section key={group.trade} id={`scorecard-${group.trade}`} className={styles.group} aria-labelledby={`scorecard-${group.trade}-title`}>
      <header className={styles.groupHead}>
        <h2 id={`scorecard-${group.trade}-title`}>{group.label}</h2>
        <span>{group.rows.length} {group.rows.length === 1 ? "vendor" : "vendors"} · {group.jobs} {group.jobs === 1 ? "job" : "jobs"}</span>
        {group.rows.length === 1 ? <span className={styles.note}>Only one vendor did this work, so there is no comparison yet.</span> : null}
      </header>
      <ScoreTable caption={`${group.label} vendors compared`} rows={group.rows} />
      {model.drill?.trade === group.trade ? <Drill drill={model.drill} /> : null}
    </section>) : null}

    {model.solo.length ? <section id="scorecard-solo" className={styles.group} aria-labelledby="scorecard-solo-title">
      <header className={styles.groupHead}>
        <h2 id="scorecard-solo-title">One vendor per type of work</h2>
        <span className={styles.note}>Nothing to compare these with yet: each type of work had one vendor in this period, or the work is not classified.</span>
      </header>
      <ScoreTable caption="Vendors that are the only one doing a type of work" rows={model.solo} showTrade />
      {soloDrill ? <Drill drill={model.drill!} /> : null}
    </section> : null}

    {!model.groups.length && !model.solo.length ? <section className={styles.emptyState}>
      <h2>No vendor jobs in this period</h2>
      <p>Nothing was sent to a vendor between {model.periodLabel}.</p>
      {model.period !== 365 ? <Link href={model.periods.find(p => p.value === 365)!.href}>Look at the last 12 months</Link> : null}
    </section> : null}

    <details className={styles.definitions}>
      <summary>How each number is measured</summary>
      <dl>{model.definitions.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.definition}</dd></div>)}</dl>
      <p>Rates and typical times need at least {model.smallSample} jobs; below that a vendor shows &ldquo;too few to judge&rdquo;. Best and Weakest compare vendors in the same type of work. Arrows show a clear change from the previous period. Tap any number to see the jobs behind it.</p>
    </details>
  </div>;
}
