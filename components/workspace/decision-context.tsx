import { DecisionScope } from "./decision-scope";
import Link from "next/link";
import type { DecisionContextModel } from "@/app/app/_data/decision-context";
import { WorkReviewButton } from "./work-review";
import styles from "./lifecycle-record-stack.module.css";

export function DecisionContext({ model }: { model: DecisionContextModel }) {
  return <section className={styles.section} id="decision-context">
    <h2>What the repair history tells us</h2>
    <DecisionScope choices={model.choices} /><nav className={`${styles.scope} ${styles.desktopScope}`} aria-label="Decision equipment scope">{model.choices.map((choice) => <Link href={choice.href} key={choice.href} aria-current={choice.selected ? "page" : undefined} scroll={false}>{choice.label}</Link>)}</nav>
    <nav className={styles.scope} aria-label="Decision history period">{model.periods.map((choice) => <Link href={choice.href} key={choice.href} aria-current={choice.selected ? "page" : undefined} scroll={false}>{choice.label}</Link>)}</nav>
    <h3>{model.title}</h3>
    {model.notice ? <p role="status">{model.notice}</p> : <>
      <p>{model.period} · Recorded work cost</p>
      <div className={styles.spending}><div><span>Whole equipment</span><Link href={model.wholeHref}><strong>{model.wholeCost}</strong></Link></div>{model.selectedComponent ? <div><span>Selected component scope · included in the whole-equipment total</span><a href="#decision-costs"><strong>{model.selectedCost}</strong></a></div> : <div><span>Source cost lines</span><a href="#decision-costs">Review {model.costCount} recorded lines ↓</a></div>}</div>
      <ul className={styles.facts}>{model.facts.map((fact) => <li key={fact.text}>{fact.text} <Link href={fact.href}>See evidence</Link></li>)}</ul>
      {model.pending.length ? <aside className={styles.notice}><strong>Unresolved warranty reviews in this equipment scope</strong>{model.pending.map((row) => <p key={row.href}><Link href={row.href}>{row.label} →</Link></p>)}</aside> : null}
      <p className={styles.limit}>The component selection changes the evidence below. The quote’s written scope under “Quotes and scope” determines what would be replaced. Past spending does not by itself justify replacement.</p>
      <details className={styles.evidence}><summary>What happened and whether it was resolved ({model.rowCount} work orders)</summary><span id="decision-repairs" />
        <div className={styles.repairTable}><table><thead><tr><th>Problem and component</th><th>Repair and result</th><th>Recorded cost in period</th></tr></thead><tbody>{model.rows.map((row) => <tr key={row.id}><td data-label="Problem and component"><Link href={row.href}>{row.number}</Link><p>{row.problem}</p><small>{row.scope}</small><WorkReviewButton href={row.href} label={row.number} context={`${model.title} · ${model.period}`} /></td><td data-label="Repair and result">{row.repairs.length ? row.repairs.map((repair, index) => <p key={index}><strong>{repair.date} · {repair.failure}</strong><br />{repair.action}</p>) : <p>No structured diagnosis or repair item is recorded.</p>}<p>{row.outcome}</p><p><strong>{row.verification}</strong></p></td><td data-label="Recorded cost in period">{row.cost}</td></tr>)}</tbody></table></div>
        {!model.rows.length ? <p>No work activity is recorded for this scope and period.</p> : null}
        <nav className={styles.scope} aria-label="Decision history pages">{model.pages.map((row) => <Link key={row.href} href={row.href}>{row.label}</Link>)}</nav>
      </details>
      <details className={styles.evidence}><summary>Cost lines supporting this scope’s {model.selectedCost}</summary><span id="decision-costs" /><p>Service dates determine the period. Work without a component stays in its own bucket. Invoice amounts and repair-item subtotals are not added to these cost lines.</p><ul>{model.costs.map((row) => <li key={row.id}>{row.date} · {row.amount} · {row.description} · <Link href={row.href}>{row.work} — recorded cost</Link></li>)}</ul><nav className={styles.scope} aria-label="Decision cost pages">{model.costPages.map((page) => <Link href={page.href} key={page.href}>{page.label}</Link>)}</nav>{model.costCount > model.costs.length ? <p>Showing {model.costs.length} of {model.costCount} cost lines. The total includes every page.</p> : null}{!model.costs.length ? <p>No amounts recorded. This is not a measured zero.</p> : null}</details>
      <details className={styles.evidence}><summary>Warranty terms and references ({model.warranty.length})</summary>{model.warranty.length ? model.warranty.map((row) => <article key={row.id}><h3>{row.label}</h3><p>{row.detail}</p>{row.href ? <Link href={row.href}>Review the warranty source →</Link> : null}</article>) : <p>No warranty terms are recorded for this scope. Obtain the terms before assuming coverage.</p>}</details>
      <details className={styles.evidence}><summary>Open work and current options ({model.currentWork.length})</summary>{model.currentWork.map((row) => <p key={row.href}><Link href={`${row.href}?view=service`}>{row.label} — review service and quotes</Link></p>)}{!model.currentWork.length ? <p>No open work recorded for this scope.</p> : null}{model.rows.filter((row) => row.quotes.length).map((row) => <article key={row.id}><h3>{row.number}</h3>{row.quotes.map((quote) => <p key={quote}>{quote}</p>)}<Link href={`${row.href}?view=service&path=bids`}>Review these options →</Link></article>)}</details>
    </>}
  </section>;
}
