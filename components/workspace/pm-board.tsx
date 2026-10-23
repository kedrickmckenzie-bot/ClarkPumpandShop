import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import type { MetricViewModel, PmBoardViewModel, PmSlipRowViewModel, ProgramPageViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import { StoreJump } from "@/components/ops/store-jump";
import styles from "./pm-board.module.css";

function Tile({ metric }: { metric: MetricViewModel }) {
  return (
    <Link href={metric.link.href} className={styles.tile} data-tone={metric.tone} aria-current={metric.selected ? "page" : undefined}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.supportingText}</small>
    </Link>
  );
}

function SlipTable({ title, rows, nameLabel }: { title: string; rows: PmSlipRowViewModel[]; nameLabel: string }) {
  return (
    <div className={styles.slipTable}>
      <h3>{title}</h3>
      {rows.length ? <table>
        <thead><tr><th>{nameLabel}</th><th data-align="end">Done</th><th data-align="end">Not done</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><Link href={row.href}>{row.label}</Link></td>
          <td data-align="end"><Link href={row.href}><strong>{row.rateLabel}</strong><small>{row.detail}</small></Link></td>
          <td data-align="end" data-bad={row.missed > 0 || undefined}><Link href={row.href}>{row.missed}</Link></td>
        </tr>)}</tbody>
      </table> : <p className={styles.quiet}>Nothing was due.</p>}
    </div>
  );
}

function Comparison({ model }: { model: PmBoardViewModel["comparison"] }) {
  const max = Math.max(0.1, ...model.segments.map(segment => segment.value));
  return (
    <section className={styles.panel} aria-labelledby="pm-compare">
      <header><div><h2 id="pm-compare">{model.title}</h2>{model.description ? <p>{model.description}</p> : null}</div></header>
      <div className={styles.bars}>{model.segments.map(segment => (
        <Link href={segment.link.href} key={segment.id} data-cohort={segment.id}>
          <span>{segment.label}</span>
          <i aria-hidden="true"><b style={{ width: `${Math.max(2, segment.value / max * 100)}%` }} /></i>
          <strong>{segment.formattedValue}</strong>
        </Link>
      ))}</div>
      <footer><Link href={model.sourceLink.href}>{model.sourceLink.label}<ChevronRight size={14} aria-hidden="true" /></Link></footer>
    </section>
  );
}

export function PmBoard({ model, board }: { model: ProgramPageViewModel; board: PmBoardViewModel }) {
  const tabs = model.filters?.[0]?.options ?? [];
  return (
    <>
      <div className={styles.tools}>
        <StoreJump />
        {model.clearFiltersHref ? <Link href={model.clearFiltersHref}>Show all stores</Link> : null}
      </div>
      <nav className={styles.tiles} aria-label="Maintenance at a glance">{model.metrics.map(metric => <Tile metric={metric} key={metric.id} />)}</nav>

      <section className={styles.panel} aria-labelledby="pm-list">
        <nav className={styles.tabs} aria-label="Show">{tabs.map(tab => <Link href={tab.href} key={tab.value} aria-current={tab.selected ? "page" : undefined}>{tab.label}</Link>)}</nav>
        <header className={styles.listHead}><h2 id="pm-list">{board.listTitle}</h2><span>{model.resultSummary} · {model.sourceDescription}</span></header>
        {board.rows.length ? <ul className={styles.rows}>{board.rows.map(row => (
          <li key={row.id}>
            <Link href={row.href} className={styles.what}><strong>{row.title}</strong><small>{row.equipment ?? "Store maintenance"}</small></Link>
            <Link href={row.storeHref} className={styles.store}>{row.storeLabel}</Link>
            <span className={styles.due} data-late={row.late || undefined}><strong>{row.timingLabel ?? row.statusLabel}</strong><small>{row.dueLabel}</small></span>
            <span className={styles.who} data-none={!row.who || undefined}>{row.who ?? "Not assigned"}</span>
            <Link href={row.action.href} className={row.action.primary ? styles.primary : styles.secondary}>{row.action.label}</Link>
          </li>
        ))}</ul> : <p className={styles.empty}><Inbox size={18} aria-hidden="true" />{board.emptyLabel}</p>}
        {model.pagination ? <PaginationControls pagination={model.pagination} label="Maintenance pages" /> : null}
      </section>

      <section className={styles.panel} aria-labelledby="pm-slipping">
        <header><div><h2 id="pm-slipping">Who&apos;s slipping</h2><p>{board.slipping.periodLabel}. Worst first.</p></div><Link href={board.slipping.allStoresHref}>See every one<ChevronRight size={14} aria-hidden="true" /></Link></header>
        <div className={styles.slipping}>
          <SlipTable title="By store" nameLabel="Store" rows={board.slipping.stores} />
          <SlipTable title="By vendor or team" nameLabel="Who did it" rows={board.slipping.vendors} />
        </div>
      </section>

      <Comparison model={board.comparison} />
    </>
  );
}
