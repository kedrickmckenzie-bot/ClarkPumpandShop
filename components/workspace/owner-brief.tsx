import Link from "next/link";
import { BRIEF_SOURCES, briefSourceHref, type BriefSummary, type BriefSource } from "@/lib/ops/owner-brief-query";
import { briefMoney, briefRecordHref } from "@/app/app/_data/owner-brief-query-presenter";
import { formatOperationsDate } from "@/lib/ops/local-time";
import styles from "./brief-summary.module.css";

export function OwnerBriefSection({ model }: { model: BriefSummary & { scopeLabel: string } }) {
  const { period, sources } = model;
  const money = (amount: number) => briefMoney(amount, period.currency);
  const href = (kind: BriefSource, store?: string) => briefSourceHref(period, kind, 0, store);
  const pm = sources.pm.statuses;
  const onTime = pm.completed_early + pm.completed_on_time;
  const due = onTime + pm.completed_late + pm.completed + pm.missed;
  const notes = { recorded_cost: "Costs dated in this period", invoice_review: "Current flags · each invoice counted once", verified_value: "Confirmed credits and recoveries", opportunity: "Estimates awaiting confirmation" };
  return <section className={styles.summary} aria-label="Owner brief summary">
    <p className={styles.context}>{model.scopeLabel}<br />{formatOperationsDate(period.from)} – {formatOperationsDate(period.to)} · {period.currency}</p>
    <div className={styles.money}>
      {(["recorded_cost", "invoice_review", "verified_value", "opportunity"] as const).map(kind => <Link key={kind} href={href(kind)} className={styles.metric}>
        <span>{BRIEF_SOURCES[kind]}</span><strong>{money(sources[kind].totalAmountMinor)}</strong><small>{notes[kind]}</small><span className={styles.open}>View records →</span>
      </Link>)}
    </div>
    {sources.other_exposure.totalCount > 0 ? <p><Link href={href("other_exposure")}>Other amounts to review: {money(sources.other_exposure.totalAmountMinor)}</Link></p> : null}
    <div className={styles.facts}>
      <div><h2>PM completed on time</h2><Link href={href("pm")} className={styles.value}>{due ? `${Math.round(onTime / due * 100)}% · ${onTime} of ${due}` : "No closed PM windows"}</Link>
        <details><summary>How this is counted</summary><p>PM due in this period. The rate includes finished work and missed windows.</p><ul>
          {[["On time or early", onTime], ["Late", pm.completed_late], ["Missed", pm.missed], ["Finished, timing unknown", pm.completed], ["Window still open", pm.open], ["Unscheduled", pm.unscheduled], ["Waived", pm.waived], ["Cancelled", pm.cancelled]].map(([label, count]) => <li key={label}>{label}: {count}</li>)}
        </ul></details>
      </div>
      <div><h2>Work</h2><Link href={href("opened_work")} className={styles.value}>{sources.opened_work.totalCount} opened this period</Link><Link href={href("active_work")}>{sources.active_work.totalCount} active now</Link></div>
      <div><h2>Escalations</h2><Link href={href("escalations")} className={styles.value}>{sources.escalations.totalCount} active now</Link><small>Work needing the next level of review</small></div>
    </div>
    <section className={styles.section}><header><h2>Decisions to review <span>{sources.decisions.totalCount}</span></h2><Link href={href("decisions")}>View all →</Link></header>
      {sources.decisions.items.length ? <ul className={styles.decisions}>{sources.decisions.items.map(row => <li key={`${row.status}-${row.id}`}><span>{row.status === "lifecycle" ? "Equipment" : row.status === "approval" ? "Approval" : "Escalation"}</span><Link href={briefRecordHref(row)!}>{row.label}</Link></li>)}</ul> : <p>No decisions are waiting.</p>}
    </section>
    <section className={styles.section}><header><h2>Cost by store</h2><Link href={href("stores")}>View all {sources.stores.totalCount} stores →</Link></header>
      <div className={styles.tableScroll}><table><thead><tr><th>Store</th><th>Work opened</th><th>Recorded work cost</th></tr></thead><tbody>{sources.stores.items.map(row => <tr key={row.id}><th scope="row"><Link href={briefRecordHref(row)!}>{row.label}</Link></th><td><Link href={href("opened_work", row.id)}>{row.openedWork}</Link></td><td><Link href={href("recorded_cost", row.id)}>{money(row.amountMinor)}</Link></td></tr>)}</tbody></table></div>
    </section>
  </section>;
}
