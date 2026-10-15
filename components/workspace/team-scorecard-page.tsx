import Link from "next/link";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";
import type { TeamScorecardModel, TeamFlagGroup, TechCard } from "@/app/app/_data/team-scorecard-presenter";
import { TEAM_MEASURE_GROUPS, TEAM_MEASURE_INFO } from "@/lib/ops/team-scorecard";
import { CellContent, Context, Drill, ScoreTable, Section, cellClass, type MeasureMeta } from "./vendor-scorecard-page";
import { PrintButton } from "./scorecard-controls";
import styles from "./vendor-scorecard-page.module.css";

const META: MeasureMeta = { info: TEAM_MEASURE_INFO, groups: TEAM_MEASURE_GROUPS };
const DATE_LABEL = "Assigned";

/** "Worth a look": plain sentences, grouped by technician, each opening the jobs behind it. Calm when nothing stands out. */
function WorthALook({ flags, single }: { flags: TeamFlagGroup[]; single: boolean }) {
  return <section className={styles.flags} aria-labelledby="worth-a-look-title">
    <header className={styles.flagsHead}>
      <h2 id="worth-a-look-title">Worth a look</h2>
      <span>Compared with teammates doing the same type of work</span>
    </header>
    {flags.length ? <ul className={styles.flagList}>{flags.flatMap(group => group.items.map(item => <li key={item.href}>
      <Flag size={16} aria-hidden="true" className={styles.flagIcon} />
      <div>
        <p className={styles.flagTitle}>{single ? null : <><Link href={group.href}>{group.techName}</Link> · </>}{item.label}</p>
        <p className={styles.flagText}>{item.text}</p>
      </div>
      <Link href={item.href} scroll={false} className={styles.flagLink}>See the jobs<ArrowRight size={14} aria-hidden="true" /></Link>
    </li>))}</ul>
      : <p className={styles.flagsCalm}>Nothing stands out in this period.</p>}
  </section>;
}

function TechView({ model, card }: { model: TeamScorecardModel; card: TechCard }) {
  return <>
    <Link href={card.backHref} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />Team scorecard</Link>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Team scorecard</p>
        <h1>{card.name}</h1>
        <p className={styles.lede}>{card.jobs} {card.jobs === 1 ? "job" : "jobs"} in this period{card.openNow !== undefined ? ` · ${card.openNow} open now` : ""}. <Link href={card.dispatchHref} className={styles.inlineLink}>Today&apos;s work<ArrowRight size={14} aria-hidden="true" /></Link></p>
      </div>
      <PrintButton className={styles.printButton} />
    </header>
    <Context model={model} />
    <WorthALook flags={model.flags} single />

    <section id="scorecard-summary" className={styles.group} aria-labelledby="scorecard-summary-title">
      <header className={styles.groupHead}><h2 id="scorecard-summary-title">This period</h2><span>“Team” is everyone, all types of work</span></header>
      <div className={styles.tiles}>
        {card.summary.map(cell => <div key={cell.measure} className={`${styles.tile} ${cellClass(cell) ?? ""}`}>
          <span className={styles.tileLabel}>{TEAM_MEASURE_INFO[cell.measure].label}{TEAM_MEASURE_INFO[cell.measure].when ? <small className={styles.when}>{TEAM_MEASURE_INFO[cell.measure].when}</small> : null}</span>
          <CellContent cell={cell} rowLabel={card.name} meta={META} />
        </div>)}
      </div>
      {model.drill?.placement === "summary" ? <Drill drill={model.drill} dateLabel={DATE_LABEL} /> : null}
    </section>

    <Section id="scorecard-history" title="Over time" meta={`${card.history.columns.length} periods of ${model.periods.find(p => p.selected)!.label}`} note="Getting better or worse? The highlighted period is the current one." drill={model.drill} placement="history" dateLabel={DATE_LABEL}>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.history}`}>
          <caption className={styles.srOnly}>{card.name} over time</caption>
          <thead><tr><th scope="col">Measure</th>{card.history.columns.map(column => <th scope="col" key={column.label} className={column.current ? styles.currentColumn : undefined}>{column.label}{column.current ? <span className={styles.nowTag}>Now</span> : null}</th>)}</tr></thead>
          <tbody>{card.history.rows.map(row => <tr key={row.measure}>
            <th scope="row"><span className={styles.rowName}>{row.label}</span></th>
            {row.cells.map((cell, index) => <td key={index} style={{ order: row.cells.length - index }} data-label={card.history.columns[index]!.label} className={[cell.quiet ? styles.quiet : "", card.history.columns[index]!.current ? styles.currentColumn : ""].filter(Boolean).join(" ") || undefined}>
              <Link href={cell.href} scroll={false} className={styles.cellLink} aria-label={`${row.label}, ${card.history.columns[index]!.label}: ${cell.value}${cell.detail ? `, ${cell.detail}` : ""}. Show the jobs.`}>
                <span className={styles.value}>{cell.value}</span>{cell.detail ? <span className={styles.detail}>{cell.detail}</span> : null}
              </Link>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </Section>

    <Section id="scorecard-trade" title="By type of work" meta={`${card.byTrade.length} ${card.byTrade.length === 1 ? "type" : "types"}`} note="“Team” under each number is everyone on the team doing that type of work." drill={model.drill} placement="trade" dateLabel={DATE_LABEL}>
      <ScoreTable caption={`${card.name} by type of work`} firstColumn="Type of work" rows={card.byTrade} meta={META} />
    </Section>
  </>;
}

function TeamView({ model }: { model: TeamScorecardModel }) {
  const selectedTrade = model.trades.find(t => t.selected);
  return <>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Work</p>
        <h1>Team scorecard</h1>
        <p className={styles.lede}>How your in-house technicians&apos; jobs turn out. Tap a name for their page, or a number for the jobs behind it.</p>
      </div>
      <PrintButton className={styles.printButton} />
    </header>
    <Context model={model} />
    <WorthALook flags={model.flags} single={false} />
    {model.trades.length > 1 ? <nav className={styles.trades} aria-label="Type of work">
      <Link href={model.allTradesHref} aria-current={selectedTrade ? undefined : "page"} className={selectedTrade ? styles.chip : styles.chipOn}>All types <span>{model.totals.jobs}</span></Link>
      {model.trades.map(trade => <Link key={trade.value} href={trade.href} aria-current={trade.selected ? "page" : undefined} className={trade.selected ? styles.chipOn : styles.chip}>{trade.label} <span>{trade.jobs}</span></Link>)}
    </nav> : null}
    {model.rows.length > 1 ? <Section id="scorecard-techs" title={selectedTrade ? `${selectedTrade.label} technicians` : "Technicians"}
      meta={`${model.rows.length - 1} ${model.rows.length === 2 ? "technician" : "technicians"} · ${selectedTrade ? selectedTrade.jobs : model.totals.jobs} jobs`}
      drill={model.drill} placement="techs" dateLabel={DATE_LABEL}>
      <ScoreTable caption={selectedTrade ? `${selectedTrade.label} technicians` : "Technicians"} firstColumn="Technician" rows={model.rows} meta={META} />
    </Section> : <section className={styles.emptyState}>
      <h2>No in-house jobs in this period</h2>
      <p>Nothing was assigned to a technician between {model.periodLabel}.</p>
      {model.period !== 365 ? <Link href={model.periods.find(p => p.value === 365)!.href}>Look at the last 12 months</Link> : null}
    </section>}
  </>;
}

function Definitions({ model }: { model: TeamScorecardModel }) {
  return <details className={styles.definitions}>
    <summary>How each number is measured</summary>
    <dl>{model.definitions.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.definition}</dd></div>)}</dl>
    <p>Rates and typical times need at least {model.smallSample} jobs. “Worth a look” appears only when a technician is at least {model.flagGap} points worse than teammates doing the same type of work, with at least {model.flagSample} jobs on each side; returns that waited on parts, access or a vendor never count toward it. When nobody else does that work, it compares them with their own previous period. There are no rankings, and nothing here measures hours or busyness.</p>
  </details>;
}

export function TeamScorecardPage({ model }: { model: TeamScorecardModel }) {
  return <div className={styles.page}>
    {model.tech ? <TechView model={model} card={model.tech} /> : <TeamView model={model} />}
    <Definitions model={model} />
  </div>;
}
