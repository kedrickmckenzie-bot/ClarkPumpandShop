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
  const warranties = <section id="equipment-warranties" className={styles.warranty}><header><h3>Warranties ({model.warranty.length})</h3>{model.addWarrantyHref ? <Link href={model.addWarrantyHref}>Add warranty</Link> : null}</header>{model.warranty.length ? <div className={styles.table}><table><thead><tr><th>Coverage</th><th>Dates</th><th>Terms</th></tr></thead><tbody>{model.warranty.map(row => <tr key={row.id}><td>{row.href ? <Link href={row.href}>{row.label}</Link> : <strong>{row.label}</strong>}{row.provider ? <small>{row.provider}</small> : null}</td><td>{row.dates ?? "See recorded reference"}<small>{row.status}</small></td><td><details><summary>View terms</summary><p>{row.detail}</p></details></td></tr>)}</tbody></table></div> : <p>No warranties recorded. Add equipment, component or vendor-work coverage.</p>}<small>Dates show the recorded term. Whether a repair is covered still needs review.</small></section>;
  const selectedChoice = model.choices.find((row) => row.selected);
  return <section id="equipment-review" className={styles.workspace} aria-labelledby="equipment-review-title">
    <header><p>{model.issueCohort ? "Issues from Overview" : "Service history"}</p><h2 id="equipment-review-title">{model.title}</h2></header>
    {model.notice ? <p role="status">{model.notice}</p> : <>
      <div className={styles.summary}>
        <div><span>{model.issueCohort ? `Recorded work cost · ${model.currency}` : "Recorded work cost"} · {model.period}</span><strong>{model.workCost}</strong></div>
        <div><span>{model.issueCohort ? "Unplanned jobs opened" : "Jobs with activity"} · {model.period}</span><strong>{model.rowCount}</strong></div>
        <a href="#open-work"><span>Open now</span><strong>{model.currentWork.length}</strong></a>
        <a href="#equipment-warranties"><span>Warranties</span><strong>{model.warranty.length}</strong></a>
        {model.nextPm ? <Link href={model.nextPm.href}><span>Next PM due</span><strong>{model.nextPm.label}</strong></Link> : null}
      </div>
      <section id="open-work" className={styles.current} aria-labelledby="open-work-title"><h3 id="open-work-title">Open now</h3>{model.currentWork.length ? <ul>{model.currentWork.map((work) => <li key={work.href}><Link href={work.href}>{work.label}</Link><WorkReviewButton href={work.href} label={work.label} context={`${model.title} · ${model.period}`} /></li>)}</ul> : <p>No open work on this equipment.</p>}</section>
    </>}
    <div className={styles.filters}>
      <label>Part<select aria-label="Equipment review scope" value={selectedChoice?.href ?? ""} onChange={(event) => router.push(event.target.value)}><option value="" disabled>Choose part</option>{model.choices.map((row) => <option value={row.href} key={row.href}>{row.label}</option>)}</select></label>
      <nav className={styles.periods} aria-label="Equipment history period">{model.periods.map((choice) => <Link key={choice.href} href={choice.href} aria-current={choice.selected ? "page" : undefined}>{choice.label}</Link>)}</nav>
    </div>
    {model.notice ? null : <>
      <div className={styles.table}><table><caption>Jobs on {model.title}</caption><thead><tr><th>Job</th><th>Result</th><th>Cost in period</th><th>Quotes</th></tr></thead><tbody>{model.rows.map((row) => <tr key={row.id}><td data-label="Job"><Link href={row.href}>{row.number}</Link><strong>{row.problem}</strong><small>{row.scope}{row.opened ? ` · Opened ${row.opened}` : ""}</small>{row.provider ? <small>{row.provider}</small> : null}<WorkReviewButton href={row.href} label={row.number} context={`${model.title} · ${model.period}`} /></td><td data-label="Result"><p>{row.outcome}</p><small>{row.verification}</small></td><td data-label="Cost in period">{row.cost}</td><td data-label="Quotes">{row.quotes.length ? row.quotes.map((quote) => <p key={quote}>{quote}</p>) : <span>None</span>}</td></tr>)}</tbody></table></div>
      {!model.rows.length ? <p>No work in this period for this part.</p> : null}
      {model.rowCount > model.rows.length ? <p>Showing {model.rows.length} of {model.rowCount} jobs.</p> : null}
      {model.pages.length ? <nav className={styles.periods} aria-label="Equipment history pages">{model.pages.map((page) => <Link href={page.href} key={page.href}>{page.label}</Link>)}</nav> : null}
      <p className={styles.note}>Results and quotes are current through {model.asOf}. Costs use the selected period.{model.issueCohort ? ` Only ${model.currency} costs on these issues are included.` : ""}</p>
      {warranties}
    </>}
    <footer><Link href={model.recordsHref}>{model.recordsLabel}</Link>{model.allHistoryHref ? <Link href={model.allHistoryHref}>Full asset history</Link> : null}{model.decisionHref ? <Link href={model.decisionHref}>Repair or replace</Link> : null}{model.rankingHref ? <Link href={model.rankingHref}>Back to issue ranking</Link> : null}{model.componentHref ? <Link href={model.componentHref}>Component identity and replacement record</Link> : null}{model.createHref ? <Link href={model.createHref}>Create separate work in this scope</Link> : null}</footer>
    <details className={styles.method}><summary>History scope and evidence limits</summary><p>{model.issueCohort ? "Each non-cancelled, unplanned work order opened in the selected period counts once. Work linked to scheduled maintenance is excluded. The count describes service issues, not confirmed outages." : "Work appears if it was created, had a linked job update, or has a recorded cost in the selected period."} Costs use service dates. Equipment and component associations come from recorded classification; work without a component remains in its own bucket. Current outcomes and quotes may be later than the selected activity. Similar reports do not establish a recurring failure or a confirmed cause. Warranty dates do not establish entitlement. A quiet or empty history does not prove complete recording coverage.</p></details>
  </section>;
}
