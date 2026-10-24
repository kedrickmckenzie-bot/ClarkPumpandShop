import Link from "next/link";
import { ChevronDown, ChevronRight, Inbox, X } from "lucide-react";
import type { FilterOptionViewModel, ProgramPageViewModel, SpendBoardViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import { StoreJump } from "@/components/ops/store-jump";
import { WorkReviewButton } from "./work-review";
import styles from "./spend-board.module.css";

function Segments({ label, options }: { label: string; options: FilterOptionViewModel[] }) {
  return <nav className={styles.segments} aria-label={label}>{options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "page" : undefined}>{option.label}</Link>)}</nav>;
}

/** A short pick list that opens under its button; the links do the filtering. */
function Pick({ label, options }: { label: string; options: FilterOptionViewModel[] }) {
  const chosen = options.find(option => option.selected) ?? options[0];
  return (
    <details className={styles.pick}>
      <summary><small>{label}</small><strong>{chosen?.label}</strong><ChevronDown size={15} aria-hidden="true" /></summary>
      <div>{options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "true" : undefined}>{option.label}</Link>)}</div>
    </details>
  );
}

export function SpendBoard({ model, board }: { model: ProgramPageViewModel; board: SpendBoardViewModel }) {
  const found = board.groupings.find(row => row.value === "area");
  const areas = found ? { ...found, rows: found.rows.filter(row => row.value !== 0) } : undefined;
  const max = Math.max(1, ...(areas?.rows ?? []).map(row => Math.abs(row.value)));
  const table = model.table;
  return (
    <>
      <section className={styles.controls} aria-label="What to show">
        <Segments label="Period" options={board.periods} />
        <StoreJump />
        {board.regions.length > 2 ? <Pick label="Region" options={board.regions} /> : null}
        <Pick label="Service area" options={board.areas} />
        <Pick label="Show" options={board.bases} />
      </section>
      {board.chips.length ? <div className={styles.chips}>{board.chips.map(chip => <Link key={chip.label} href={chip.removeHref} aria-label={`Remove ${chip.label}`}>{chip.label}<X size={14} aria-hidden="true" /></Link>)}</div> : null}

      {board.showAreas && areas ? <section className={styles.panel} aria-labelledby="spend-where">
        <header><h2 id="spend-where">{areas.note ?? "By service area"}</h2><span className={styles.count}>Total {areas.totalLabel}</span></header>
        {areas.rows.length ? <ol className={styles.shares}>{areas.rows.map(row => (
          <li key={row.id}>
            <Link href={row.href}>
              <span className={styles.name}><strong>{row.label}</strong>{row.secondary ? <small>{row.secondary}</small> : null}</span>
              <i aria-hidden="true"><b style={{ width: `${Math.max(1, Math.abs(row.value) / max * 100)}%` }} /></i>
              <strong className={styles.amount}>{row.amountLabel}</strong>
              <small className={styles.share}>{row.shareLabel}</small>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}</ol> : <p className={styles.empty}><Inbox size={18} aria-hidden="true" />No cost in this view.</p>}
      </section> : null}

      {table ? <section className={styles.panel} id="costs" aria-labelledby="spend-costs">
        <header><h2 id="spend-costs">{board.costsTitle}</h2><span className={styles.count}>{model.resultSummary}</span></header>
        {table.rows.length ? <div className={styles.tableScroller}><table>
          <caption className={styles.hidden}>{table.caption}</caption>
          <thead><tr>{table.columns.map(column => <th key={column.key} data-align={column.align}>{column.label}</th>)}</tr></thead>
          <tbody>{table.rows.map(row => <tr key={row.id}>{table.columns.map((column, index) => {
            const cell = row.cells.find(candidate => candidate.key === column.key);
            return <td key={column.key} data-label={column.label} data-align={column.align}>
              {index === 0 ? <div className={styles.jobCell}><Link href={row.href} className={styles.job}><strong>{cell?.value}</strong>{cell?.secondary ? <small>{cell.secondary}</small> : null}</Link><WorkReviewButton compact href={row.href} label={row.label} context={board.costsTitle} /></div>
                : cell?.link ? <Link href={cell.link.href}>{cell.value}</Link> : <span>{cell?.value ?? "—"}</span>}
            </td>;
          })}</tr>)}</tbody>
        </table></div> : <p className={styles.empty}><Inbox size={18} aria-hidden="true" />No costs in this view.</p>}
        {model.pagination ? <PaginationControls pagination={model.pagination} label="Cost pages" /> : null}
      </section> : null}
    </>
  );
}
