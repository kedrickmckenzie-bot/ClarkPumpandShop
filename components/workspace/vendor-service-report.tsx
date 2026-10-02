import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import Link from "next/link";
import type { VendorServiceReport as Report } from "@/lib/ops/vendor-service-report";
import styles from "./communications.module.css";
export function VendorServiceReport({model,vendorId}:{model:Report;vendorId:string}) {
  const base = `/app/vendors/${vendorId}`;
  return <section className={`${styles.workspace} ${styles.panel}`} id="service-report">
    <header><h2>Service performance</h2><p>{model.period} · Current store scope</p></header>
    <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Measure</th><th>Evidence</th><th>Review</th></tr></thead><tbody>
      <tr><th>Arrived when promised</th><td>{model.arrivals.observed ? `${model.arrivals.onTime} of ${model.arrivals.observed} observed arrivals by promised time` : "No observed arrivals to compare"}<br/><small>{model.arrivals.due ? `${model.arrivals.due-model.arrivals.observed} of ${model.arrivals.due} due commitments have no arrival evidence.` : "No promised arrivals in this period."}</small></td><td><Link href={`${base}?report=arrivals#service-report-evidence`}>View work</Link></td></tr>
      <tr><th>Follow-up burden</th><td>{model.followUps.work} of {model.followUps.total} {model.followUps.total === 1 ? "job" : "jobs"} required follow-up<br/><small>Follow-ups created by this vendor’s recorded visit outcomes.</small></td><td><Link href={`${base}?report=followups#service-report-evidence`}>View work</Link></td></tr>
      <tr><th>Confirmed callbacks</th><td>{model.callbacks.work} {model.callbacks.work === 1 ? "job" : "jobs"}<br/><small>Rejected completion followed by another vendor visit. {model.callbacks.verified} {model.callbacks.verified === 1 ? "job has" : "jobs have"} a conclusive store review.</small></td><td><Link href={`${base}?report=callbacks#service-report-evidence`}>View work</Link></td></tr>
    </tbody></table></div>
    <details><summary>Compare similar work costs</summary><p>Same category, equipment model, part, priority and planned/reactive work. Scope and parts can still differ.</p>
      <small>{model.excludedCostWork} {model.excludedCostWork === 1 ? "job" : "jobs"} excluded: incomplete classification, mixed providers/currencies, or work still open. Medians need 5 recorded jobs.</small>
      <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Comparable group</th><th>Cost coverage</th><th>Median recorded cost</th><th>Source</th></tr></thead><tbody>{model.cohorts.map(row=><tr key={row.key}><td>{row.label}</td><td>{row.withCost} / {row.count} {row.count === 1 ? "job" : "jobs"}</td><td>{row.medianMinor===null ? "Small sample" : cachedNumberFormat("en-US",{style:"currency",currency:row.currency}).format(row.medianMinor/100)}</td><td><Link href={row.href}>View jobs</Link></td></tr>)}</tbody></table></div>{!model.cohorts.length ? <p>No comparable completed work yet.</p> : null}
    </details>
    <section id="service-report-evidence"><h2>{model.evidenceTitle}</h2><p>{model.evidenceTotal} supporting work orders</p><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Work order</th><th>Evidence</th></tr></thead><tbody>{model.evidence.map(row=><tr key={row.id}><td><Link href={row.href}>{row.number}</Link><p>{row.problem}</p></td><td>{row.detail}</td></tr>)}</tbody></table></div>{!model.evidence.length ? <p>No supporting records in this period.</p> : null}<nav className={styles.bar}>{model.previous ? <Link href={model.previous}>Previous</Link> : <span/>}{model.next ? <Link href={model.next}>Next</Link> : null}</nav></section>
  </section>;
}
