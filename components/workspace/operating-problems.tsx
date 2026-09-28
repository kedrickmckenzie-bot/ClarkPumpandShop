import Link from "next/link";
import type { OperatingRisk } from "@/lib/ops/operating-risks";
import { formatOperationsDate } from "@/lib/ops/local-time";
import styles from "./operating-problems.module.css";

export function OperatingProblems({ rows }: { rows: OperatingRisk[] }) {
  function list(items: OperatingRisk[]) {
    return <ul className={styles.list}>{items.map(row => <li key={row.id}>
      <Link href={`/app/requests/${row.id}`}><strong>Store {row.storeNumber} · {row.problem}</strong></Link>
      <span>{row.state === "unable_to_operate" ? "Unable to operate" : "Limited operations"} · Reported {formatOperationsDate(row.reportedAt, "UTC")}</span>
      <Link href={`/app/requests/${row.id}`}>Review report →</Link>
    </li>)}</ul>;
  }
  return <section className={styles.panel} aria-label="Reported operating problems">
    <h2>Reported operating problems</h2>
    {rows.length ? list(rows.slice(0, 3)) : <p>No open reports of limited or stopped operations.</p>}
    {rows.length > 3 ? <details><summary>View all {rows.length} priority reports</summary>{list(rows.slice(3))}</details> : null}
  </section>;
}
