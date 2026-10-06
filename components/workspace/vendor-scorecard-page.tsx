import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, X } from "lucide-react";
import type { DrillPlacement, ScorecardCell, ScorecardDrill, ScorecardPageModel, ScorecardRow, VendorCard } from "@/app/app/_data/vendor-scorecard-presenter";
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

function CellContent({ cell, rowLabel }: { cell: ScorecardCell; rowLabel: string }) {
  const info = MEASURE_INFO[cell.measure];
  const rank = cell.summary.rank;
  const alert = cell.measure === "invoice" && cell.summary.hits > 0;
  return <Link href={cell.href} scroll={false} className={styles.cellLink} aria-label={`${rowLabel}, ${info.label}: ${cell.value === "—" ? cell.detail : `${cell.value}, ${cell.detail}`}. Show the jobs.`}>
    <span className={`${styles.value} ${alert ? styles.alert : ""}`}>{cell.value}<Trend cell={cell} /></span>
    <span className={styles.detail}>{cell.detail}</span>
    {rank ? <span className={rank === "best" ? styles.best : styles.weakest}>{rank === "best" ? "Best" : "Weakest"}</span> : null}
  </Link>;
}

function cellClass(cell: ScorecardCell) {
  return [cell.empty || cell.summary.tooFew ? styles.quiet : "", cell.summary.counted === 0 && cell.measure !== "jobs" ? styles.noData : ""].filter(Boolean).join(" ") || undefined;
}

function ScoreTable({ caption, firstColumn, rows }: { caption: string; firstColumn: string; rows: ScorecardRow[] }) {
  return <div className={styles.tableWrap}>
    <table className={styles.table}>
      <caption className={styles.srOnly}>{caption}</caption>
      <thead><tr><th scope="col">{firstColumn}</th>{MEASURES.map(key => <th scope="col" key={key} title={MEASURE_INFO[key].definition}>{MEASURE_INFO[key].label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}>
        <th scope="row">
          {row.href ? <Link href={row.href} className={styles.rowLink}>{row.label}<ChevronRight size={15} aria-hidden="true" /></Link> : <span className={styles.rowName}>{row.label}</span>}
          {row.sublabel ? <span className={styles.rowTrade}>{row.sublabel}</span> : null}
        </th>
        {row.cells.map(cell => <td key={cell.measure} data-label={MEASURE_INFO[cell.measure].label} className={cellClass(cell)}><CellContent cell={cell} rowLabel={row.label} /></td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

function Drill({ drill }: { drill: ScorecardDrill }) {
  return <section id="scorecard-jobs" className={styles.drill} aria-labelledby="scorecard-jobs-title">
    <header className={styles.drillHead}>
      <div>
        <p className={styles.drillEyebrow}>{drill.context}</p>
        <h3 id="scorecard-jobs-title">{drill.measureLabel}</h3>
        <p className={styles.drillHeadline}>{drill.headline}</p>
        <p className={styles.drillDefinition}>{drill.definition}</p>
      </div>
      <Link href={drill.closeHref} scroll={false} className={styles.close}><X size={16} aria-hidden="true" />Close</Link>
    </header>
    {drill.rows.length ? <div className={styles.drillTable}><table>
      <caption className={styles.srOnly}>Jobs behind {drill.measureLabel} for {drill.context}</caption>
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

function Section({ id, title, meta, note, children, drill, placement }: { id: string; title: string; meta?: string; note?: string; children: ReactNode; drill?: ScorecardDrill; placement: DrillPlacement }) {
  return <section id={id} className={styles.group} aria-labelledby={`${id}-title`}>
    <header className={styles.groupHead}>
      <h2 id={`${id}-title`}>{title}</h2>
      {meta ? <span>{meta}</span> : null}
      {note ? <span className={styles.note}>{note}</span> : null}
    </header>
    {children}
    {drill?.placement === placement ? <Drill drill={drill} /> : null}
  </section>;
}

function Context({ model }: { model: ScorecardPageModel }) {
  return <>
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
  </>;
}

function Definitions({ model }: { model: ScorecardPageModel }) {
  return <details className={styles.definitions}>
    <summary>How each number is measured</summary>
    <dl>{model.definitions.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.definition}</dd></div>)}</dl>
    <p>Rates and typical times need at least {model.smallSample} jobs; below that you see &ldquo;too few to judge&rdquo;. Best and Weakest only compare vendors doing the same type of work. Arrows show a clear change from the previous period. Tap any number to see the jobs behind it.</p>
  </details>;
}

function VendorView({ model, card }: { model: ScorecardPageModel; card: VendorCard }) {
  return <>
    <Link href={card.backHref} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />All vendors</Link>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Vendor scorecard</p>
        <h1>{card.name}</h1>
        <p className={styles.lede}>{card.jobs} {card.jobs === 1 ? "job" : "jobs"} in this period. <Link href={card.profileHref} className={styles.inlineLink}>Contacts, coverage and documents<ArrowRight size={14} aria-hidden="true" /></Link></p>
      </div>
      <PrintButton className={styles.printButton} />
    </header>
    <Context model={model} />

    <section id="scorecard-summary" className={styles.group} aria-labelledby="scorecard-summary-title">
      <header className={styles.groupHead}><h2 id="scorecard-summary-title">This period</h2></header>
      <div className={styles.tiles}>
        {card.summary.map(cell => <div key={cell.measure} className={`${styles.tile} ${cellClass(cell) ?? ""}`}>
          <span className={styles.tileLabel}>{MEASURE_INFO[cell.measure].label}</span>
          <CellContent cell={cell} rowLabel={card.name} />
        </div>)}
      </div>
      {model.drill?.placement === "summary" ? <Drill drill={model.drill} /> : null}
    </section>

    <Section id="scorecard-history" title="Over time" meta={`${card.history.columns.length} periods of ${model.periods.find(p => p.selected)!.label}`} note="Is this vendor getting better or worse? The highlighted period is the current one." drill={model.drill} placement="history">
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.history}`}>
          <caption className={styles.srOnly}>{card.name} over time</caption>
          <thead><tr><th scope="col">Measure</th>{card.history.columns.map(column => <th scope="col" key={column.label} className={column.current ? styles.currentColumn : undefined}>{column.label}{column.current ? <span className={styles.nowTag}>Now</span> : null}</th>)}</tr></thead>
          <tbody>{card.history.rows.map(row => <tr key={row.measure}>
            <th scope="row"><span className={styles.rowName}>{row.label}</span></th>
            {/* On a phone the periods list newest first; the desktop table keeps time running left to right. */}
            {row.cells.map((cell, index) => <td key={index} style={{ order: row.cells.length - index }} data-label={card.history.columns[index]!.label} className={[cell.quiet ? styles.quiet : "", card.history.columns[index]!.current ? styles.currentColumn : ""].filter(Boolean).join(" ") || undefined}>
              <Link href={cell.href} scroll={false} className={styles.cellLink} aria-label={`${row.label}, ${card.history.columns[index]!.label}: ${cell.value}${cell.detail ? `, ${cell.detail}` : ""}. Show the jobs.`}>
                <span className={styles.value}>{cell.value}</span>{cell.detail ? <span className={styles.detail}>{cell.detail}</span> : null}
              </Link>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </Section>

    <Section id="scorecard-district" title="By district" meta={`${card.byDistrict.length} ${card.byDistrict.length === 1 ? "district" : "districts"}`} drill={model.drill} placement="district">
      <ScoreTable caption={`${card.name} by district`} firstColumn="District" rows={card.byDistrict} />
    </Section>

    <Section id="scorecard-trade" title="By type of work" meta={`${card.byTrade.length} ${card.byTrade.length === 1 ? "type" : "types"}`} drill={model.drill} placement="trade">
      <ScoreTable caption={`${card.name} by type of work`} firstColumn="Type of work" rows={card.byTrade} />
    </Section>
  </>;
}

function AllView({ model }: { model: ScorecardPageModel }) {
  const selectedTrade = model.trades.find(t => t.selected);
  return <>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Vendors</p>
        <h1>Vendor scorecards</h1>
        <p className={styles.lede}>How each vendor is doing on your jobs. Tap a vendor for their full scorecard, or any number for the jobs behind it.</p>
      </div>
      <PrintButton className={styles.printButton} />
    </header>
    <Context model={model} />
    {model.trades.length > 1 ? <nav className={styles.trades} aria-label="Type of work">
      <Link href={model.allTradesHref} aria-current={selectedTrade ? undefined : "page"} className={selectedTrade ? styles.chip : styles.chipOn}>All types <span>{model.totals.jobs}</span></Link>
      {model.trades.map(trade => <Link key={trade.value} href={trade.href} aria-current={trade.selected ? "page" : undefined} className={trade.selected ? styles.chipOn : styles.chip}>{trade.label} <span>{trade.jobs}</span></Link>)}
    </nav> : null}

    {model.vendors.length ? <Section id="scorecard-vendors" title={selectedTrade ? `${selectedTrade.label} vendors` : "All vendors"}
      meta={`${model.vendors.length} ${model.vendors.length === 1 ? "vendor" : "vendors"} · ${selectedTrade ? selectedTrade.jobs : model.totals.jobs} jobs`}
      note={selectedTrade && model.vendors.length === 1 ? "Only one vendor did this work in this period. Compare them with their own past periods on their scorecard." : undefined}
      drill={model.drill} placement="vendors">
      <ScoreTable caption={selectedTrade ? `${selectedTrade.label} vendors compared` : "All vendors"} firstColumn="Vendor" rows={model.vendors} />
    </Section> : <section className={styles.emptyState}>
      <h2>No vendor jobs in this period</h2>
      <p>Nothing was sent to a vendor between {model.periodLabel}.</p>
      {model.period !== 365 ? <Link href={model.periods.find(p => p.value === 365)!.href}>Look at the last 12 months</Link> : null}
    </section>}

    {model.comparisons.length ? <>
      <h2 className={styles.sectionTitle}>Same type of work, side by side</h2>
      {model.comparisons.map(group => <Section key={group.trade} id={`scorecard-${group.trade}`} title={group.label} meta={`${group.rows.length} vendors · ${group.jobs} jobs`} drill={model.drill} placement={`compare:${group.trade}`}>
        <ScoreTable caption={`${group.label} vendors compared`} firstColumn="Vendor" rows={group.rows} />
      </Section>)}
    </> : null}
  </>;
}

export function VendorScorecardPage({ model }: { model: ScorecardPageModel }) {
  return <div className={styles.page}>
    {model.vendor ? <VendorView model={model} card={model.vendor} /> : <AllView model={model} />}
    <Definitions model={model} />
  </div>;
}
