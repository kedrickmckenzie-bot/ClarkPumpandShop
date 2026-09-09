import Link from "next/link";
import type { RequestWorkLinkPageViewModel } from "./data-contract";
import styles from "./request-work-linker.module.css";

export function RequestWorkLinker({ model }: { model: RequestWorkLinkPageViewModel }) {
  return <main className={styles.workspace}>
    <Link className={styles.back} href={model.returnHref}>← Back to {model.reference}</Link>
    <header className={styles.header}><div><p>Potentially related work</p><h1>Browse this store’s open work</h1><span>Choose only when the report belongs with the work. Similar wording is a suggestion—not evidence of a duplicate, shared physical item, or completed repair.</span></div></header>
    <aside className={styles.notice}><strong>{model.reference}:</strong> {model.problem}. The original report, equipment references, photos, and timestamps remain unchanged after linking.</aside>
    <form className={styles.search} action={model.searchAction} method="get"><input type="hidden" name="returnTo" value={model.returnHref} /><input name="q" defaultValue={model.searchValue} aria-label="Search this store’s open work" placeholder="Search work-order number, problem, vendor, or category" /><button type="submit">Search</button></form>
    <section className={styles.results} aria-labelledby="work-results-title"><header id="work-results-title">{model.resultSummary}</header>
      {model.rows.length ? <ol className={styles.list}>{model.rows.map((work) => {
        const alreadyLinked = work.id === model.currentLinkedWorkOrderId;
        const correction = Boolean(model.currentLinkedWorkOrderId && !alreadyLinked);
        return <li key={work.id}><div className={styles.record}><Link href={`/app/work-orders/${work.id}`}>{work.number}</Link><strong>{work.problem}</strong><small>{work.statusLabel} · {work.serviceContext}</small></div><form className={styles.linkForm} action={model.linkAction} method="post"><input type="hidden" name="expectedStatus" value={model.expectedStatus} /><input type="hidden" name="workOrderId" value={work.id} /><input type="hidden" name="returnTo" value={model.returnHref} />{correction ? <label>Why this link is being corrected<input name="correctionReason" required minLength={3} maxLength={1000} /></label> : null}<button type="submit" disabled={alreadyLinked}>{alreadyLinked ? "Currently linked" : correction ? "Correct link" : model.expectedStatus === "acknowledged" ? "Link report" : "Acknowledge and link"}</button></form></li>;
      })}</ol> : <p className={styles.empty}>No active work matches this search. Try another term or return to acknowledge without linking.</p>}
      <footer className={styles.pagination}><span>Page {model.currentPage} of {model.totalPages}</span><nav>{model.previousHref ? <Link href={model.previousHref}>Previous</Link> : <span />}{model.nextHref ? <Link href={model.nextHref}>Next</Link> : null}</nav></footer>
    </section>
  </main>;
}
