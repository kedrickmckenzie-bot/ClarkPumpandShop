"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { EquipmentReviewModel } from "@/app/app/_data/equipment-review";
import { WorkReviewButton } from "./work-review";
import styles from "./equipment-review.module.css";

export function EquipmentReview({ model }: { model: EquipmentReviewModel }) {
  const router = useRouter();
  const legacySection = useSearchParams().get("section");
  useEffect(() => {
    if (["service-history", "components", "lifecycle-evidence"].includes(legacySection ?? "")) document.getElementById("equipment-review")?.scrollIntoView({ block: "start" });
  }, [legacySection]);
  const context = <>
      <section id="equipment-warranties" className={styles.warranty}><header><h3>Warranties ({model.warranty.length})</h3>{model.addWarrantyHref ? <Link href={model.addWarrantyHref}>Add warranty</Link> : null}</header>{model.warranty.length ? <div className={styles.table}><table><thead><tr><th>Coverage</th><th>Dates</th><th>Terms</th></tr></thead><tbody>{model.warranty.map(row => <tr key={row.id}><td>{row.href ? <Link href={row.href}>{row.label}</Link> : <strong>{row.label}</strong>}{row.provider ? <small>{row.provider}</small> : null}</td><td>{row.dates ?? "See recorded reference"}<small>{row.status}</small></td><td><details><summary>View terms</summary><p>{row.detail}</p></details></td></tr>)}</tbody></table></div> : <p>No warranties recorded. Add equipment, component or vendor-work coverage.</p>}<small>Dates show the recorded term. Applicability to a repair still needs review.</small></section>
      {model.currentWork.length ? <details className={styles.current} open><summary>Existing open work in this equipment scope ({model.currentWork.length})</summary><ul>{model.currentWork.map((work) => <li key={work.href}><Link href={work.href}>{work.label}</Link><WorkReviewButton href={work.href} label={work.label} context={`${model.title} · ${model.period}`} /></li>)}</ul></details> : <p>No open work is recorded for this equipment scope.</p>}
  </>;
  return <section id="equipment-review" className={styles.workspace} aria-labelledby="equipment-review-title">
    <header><p>{model.issueCohort ? "Issues from Overview" : "Equipment review"}</p><h2 id="equipment-review-title">{model.title}</h2></header>
    <nav className={styles.periods} aria-label="Equipment review actions">{model.rankingHref ? <Link href={model.rankingHref}>Back to issue ranking</Link> : null}{model.allHistoryHref ? <Link href={model.allHistoryHref}>Full asset history</Link> : null}{model.decisionHref ? <Link href={model.decisionHref}>Repair or replace</Link> : null}</nav>
    <div className={styles.mobileScope}><label>Equipment scope<select aria-label="Equipment review scope" value={model.choices.find((row) => row.selected)?.href ?? ""} onChange={(event) => router.push(event.target.value)}><option value="" disabled>Choose equipment scope</option>{model.choices.map((row) => <option value={row.href} key={row.href}>{row.label}</option>)}</select></label></div>
    <nav className={styles.choices} aria-label="Equipment review scope">{model.choices.map((choice) => <Link key={choice.href} href={choice.href} aria-current={choice.selected ? "page" : undefined}>{choice.label}</Link>)}</nav>
    <nav className={styles.periods} aria-label="Equipment history period">{model.periods.map((choice) => <Link key={choice.href} href={choice.href} aria-current={choice.selected ? "page" : undefined}>{choice.label}</Link>)}</nav>
    {model.notice ? <p role="status">{model.notice}</p> : <>
      <div className={styles.summary}><div><span>{model.issueCohort ? `Recorded work cost · ${model.currency}` : "Recorded work cost"} · {model.period}</span><strong>{model.workCost}</strong></div><div><span>{model.issueCohort ? "Unplanned work orders opened in this period" : "Work with recorded activity in this period"}</span><strong>{model.rowCount}</strong></div></div>
      <p className={styles.note}>Job outcomes, open work, and quote status are current through {model.asOf}. Cost amounts use the selected period.{model.issueCohort ? ` Only ${model.currency} costs on these issues are included.` : ""}</p>
      <div className={styles.table}><table><caption>Connected service history for {model.title}</caption><thead><tr><th>Work and equipment</th><th>Outcome and verification</th><th>Cost in period</th><th>Current options</th></tr></thead><tbody>{model.rows.map((row) => <tr key={row.id}><td data-label="Work and equipment"><Link href={row.href}>{row.number}</Link><strong>{row.problem}</strong><small>{row.scope}{row.opened ? ` · Opened ${row.opened}` : ""}</small>{row.provider ? <small>{row.provider}</small> : null}<WorkReviewButton href={row.href} label={row.number} context={`${model.title} · ${model.period}`} /></td><td data-label="Outcome and verification"><p>{row.outcome}</p><small>{row.verification}</small></td><td data-label="Cost in period">{row.cost}</td><td data-label="Current options">{row.quotes.length ? row.quotes.map((quote) => <p key={quote}>{quote}</p>) : <span>No current quote recorded</span>}</td></tr>)}</tbody></table></div>
      {!model.rows.length ? <p>No work activity is recorded in this period and equipment scope.</p> : null}
      {model.rowCount > model.rows.length ? <p>Showing {model.rows.length} of {model.rowCount} work orders with activity.</p> : null}
      {model.pages.length ? <nav className={styles.periods} aria-label="Equipment history pages">{model.pages.map((page) => <Link href={page.href} key={page.href}>{page.label}</Link>)}</nav> : null}
      {context}

    </>}
    <footer><Link href={model.recordsHref}>{model.recordsLabel}</Link>{model.componentHref ? <Link href={model.componentHref}>Component identity and replacement record</Link> : null}{model.createHref ? <Link href={model.createHref}>Create separate work in this scope</Link> : null}</footer>
    <details className={styles.method}><summary>History scope and evidence limits</summary><p>{model.issueCohort ? "Each non-cancelled, unplanned work order opened in the selected period counts once. Work linked to scheduled maintenance is excluded. The count describes service issues, not confirmed outages." : "Work appears if it was created, had a linked job update, or has a recorded cost in the selected period."} Costs use service dates. Equipment and component associations come from recorded classification; work without a component remains in its own bucket. Current outcomes and quotes may be later than the selected activity. Similar reports do not establish a recurring failure or a confirmed cause. Warranty dates do not establish entitlement. A quiet or empty history does not prove complete recording coverage.</p></details>
  </section>;
}
