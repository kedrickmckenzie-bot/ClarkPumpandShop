import Link from "next/link";
import type { ListPageViewModel } from "@/components/ops/data-contract";
import styles from "./brief-summary.module.css";

export function BriefRecords({ model }: { model: ListPageViewModel }) {
  return <div className={`${styles.page} ${styles.summary}`}>
    <header className={styles.head}><Link href={model.page.secondaryAction!.href}>← Owner brief</Link><h1>{model.page.title}</h1><p>{model.page.description}</p><p className={styles.context}>{model.page.scopeLabel}<br />{model.page.periodLabel}</p></header>
    <section className={styles.section}><h2>{model.resultSummary}</h2>
      {model.state.kind !== "ready" ? <p>{"message" in model.state ? model.state.message : "No records."} <Link href={model.clearFiltersHref!}>First page</Link></p> : <div className={styles.tableScroll}><table className={styles.recordsTable}>
        <caption className={styles.caption}>{model.table.caption}</caption>
        <thead><tr>{model.table.columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{model.table.rows.map(row => <tr key={row.id}>{model.table.columns.map(column => {
          const cell = row.cells.find(item => item.key === column.key)!;
          const content = <>{cell.value}{cell.secondary ? <small className={styles.cellDetail}>{cell.secondary}</small> : null}</>;
          return <td key={column.key} data-label={column.label}>{cell.link ? <Link href={cell.link.href}>{content}</Link> : content}</td>;
        })}</tr>)}</tbody>
      </table></div>}
      {model.pagination ? <nav className={styles.pagination} aria-label="Brief records pages">{model.pagination.previousHref ? <Link href={model.pagination.previousHref}>← Previous</Link> : null}<span>Page {model.pagination.currentPage} of {model.pagination.totalPages}</span>{model.pagination.nextHref ? <Link href={model.pagination.nextHref}>Next →</Link> : null}</nav> : null}
    </section>
  </div>;
}
