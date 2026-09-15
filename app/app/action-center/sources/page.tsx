import Link from "next/link";
import type { Metadata } from "next";
import { loadReviewSourcesModel } from "../../_data/operator-loader";
import styles from "@/components/workspace/brief-summary.module.css";

export const metadata: Metadata={title:"Review records"};
export default async function ReviewSourcesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  let model;
  try { model=await loadReviewSourcesModel(await searchParams); }
  catch(error) { if(!(error instanceof RangeError)) throw error; return <div><h1>Review records</h1><p>{error.message}</p><Link href="/app/action-center">Return to review queue</Link></div>; }
  if(!model) return <div><h1>Item no longer in this view</h1><p>It may have been completed or moved out of your scope.</p><Link href="/app/action-center">Return to review queue</Link></div>;
  return <div className={`${styles.page} ${styles.summary}`}>
    <header className={styles.head}><Link href={model.queue}>← Review queue</Link><h1>{model.title}</h1>{model.recordContext?<p>{model.recordContext}</p>:null}<p className={styles.context}>{model.scopeLabel}</p></header>
    <section className={styles.section}><h2>Tasks and records ({model.totalCount})</h2>
      {model.rows.length ? <div className={styles.tableScroll}><table className={styles.recordsTable}><caption className={styles.caption}>Supporting tasks and records</caption><thead><tr><th scope="col">Record</th><th scope="col">Owner</th><th scope="col">Deadline</th></tr></thead><tbody>{model.rows.map(row=><tr key={row.id}><td data-label="Record"><Link href={row.href}>{row.label}</Link><small className={styles.cellDetail}>{row.doneWhen}</small></td><td data-label="Owner">{row.owner}</td><td data-label="Deadline">{row.dueLabel}</td></tr>)}</tbody></table></div>:<p>No records on this page.</p>}
      {model.pagination?<nav className={styles.pagination} aria-label="Supporting record pages">{model.pagination.previousHref?<Link href={model.pagination.previousHref}>← Previous</Link>:null}<span>{model.pagination.summary}</span>{model.pagination.nextHref?<Link href={model.pagination.nextHref}>Next →</Link>:null}</nav>:null}
    </section>
  </div>;
}
