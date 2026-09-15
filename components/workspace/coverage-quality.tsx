import Link from "next/link";
import type { IntegritySummary } from "@/app/app/_data/record-integrity-presenter";
import { integrityHref, type IntegritySource } from "@/lib/ops/record-integrity-query";
import styles from "./brief-summary.module.css";

export function CoverageQualitySection({ model }: { model: IntegritySummary }) {
  const { counts } = model;
  const countLink = (kind: IntegritySource, label: string) => <Link href={integrityHref(kind)} aria-label={`${label}: ${counts[kind]} records`}>{counts[kind]}</Link>;
  return <section id="record-checks" className={`${styles.summary} ${styles.section}`} aria-labelledby="record-checks-heading">
    <header><h2 id="record-checks-heading">Record checks</h2><span className={styles.checkContext}>All history · {model.scopeLabel}</span></header>
    <div className={styles.integrityColumns}>
      <div><h3>Needs follow-up</h3><ul className={styles.checkList}>
        <li><Link href={integrityHref("missing_action")}>Work without a next action <strong>{counts.missing_action}</strong></Link></li>
        <li><Link href={integrityHref("aged_invoice")}>Invoice reviews 30+ days old <strong>{counts.aged_invoice}</strong></Link></li>
      </ul>
      <details className={styles.optionalDetails}><summary>Optional details to add</summary><p>These do not block work.</p><ul className={styles.checkList}>
        <li><Link href={integrityHref("unclassified_work")}>Work not yet classified <strong>{counts.unclassified_work}</strong></Link></li>
        <li><Link href={integrityHref("missing_life")}>Equipment life not entered <strong>{counts.missing_life}</strong></Link></li>
      </ul></details></div>
      <div><h3>Closed work evidence</h3><p><Link href={integrityHref("closed_work")}>{counts.closed_work} resolved or closed work orders</Link></p>
      <div className={styles.tableScroll}><table className={styles.evidenceTable}><thead><tr><th>Evidence</th><th>Yes</th><th>No</th></tr></thead><tbody>
        <tr><th scope="row">Latest visit outcome recorded</th><td data-label="Yes">{countLink("with_outcome", "Visit outcome recorded")}</td><td data-label="No">{countLink("without_outcome", "No visit outcome recorded")}</td></tr>
        <tr><th scope="row">Work cost recorded</th><td data-label="Yes">{countLink("with_cost", "Work cost recorded")}</td><td data-label="No">{countLink("without_cost", "No work cost recorded")}</td></tr>
        <tr><th scope="row">Outside work verified</th><td data-label="Yes">{countLink("verified", "Latest outside-work outcome verified")}</td><td data-label="No">{countLink("unverified", "Latest outside-work outcome not verified")}</td></tr>
      </tbody></table></div>
      <details className={styles.optionalDetails}><summary>About these counts</summary><p>Evidence coverage does not decide whether work is complete. Visits, verification and costs are optional.</p><p>Verification covers <Link href={integrityHref("vendor_closed")}>{counts.vendor_closed} closed jobs with an outside assignment</Link>. Only a verified decision matching the latest recorded outcome counts.</p></details>
      </div>
    </div>
  </section>;
}
