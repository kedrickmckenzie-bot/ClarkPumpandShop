import Link from "next/link";
import {notFound} from "next/navigation";
import {loadOperatorSession} from "../../_data/operator-loader";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {roleCanOpenOperatorHref} from "@/components/ops/role-policy";
import {formatOperationsDate} from "@/lib/ops/local-time";
import styles from "@/components/workspace/brief-summary.module.css";
export const metadata={title:"Reported operating problems"};
export default async function OperatingReportsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const session=await loadOperatorSession();
 if(!roleCanOpenOperatorHref(session.role,"/app/requests"))notFound();
 const query=await searchParams,page=Number(query.page??1),size=25;
 if(!Number.isSafeInteger(page)||page<1)return <div><h1>Choose a valid page</h1><Link href="/app/requests/operating">Return to operating reports</Link></div>;
 const result=await (await getServerOpsRepository()).listOperatingRisks(session,{limit:size,offset:(page-1)*size});
 const pages=Math.max(1,Math.ceil(result.totalCount/size));
 return <div className={`${styles.page} ${styles.summary}`}>
  <header className={styles.head}><Link href="/app/overview">← Overview</Link><h1>Reported operating problems</h1><p>Open reports of limited or stopped operations.</p><p className={styles.context}>{session.scopeLabel} · {result.totalCount} reports</p></header>
  <section className={styles.section}>
   {result.items.length?<div className={styles.tableScroll}><table className={`${styles.recordsTable} ${styles.operatingTable}`}><caption className={styles.caption}>Priority reports awaiting review</caption><thead><tr><th scope="col">Store</th><th scope="col">Problem</th><th scope="col">Operations</th><th scope="col">Reported</th></tr></thead><tbody>{result.items.map(row=><tr key={row.id}><td data-label="Store">Store {row.storeNumber}</td><td data-label="Problem"><Link href={`/app/requests/${row.id}`}>{row.problem}</Link></td><td data-label="Operations">{row.state==="unable_to_operate"?"Unable to operate":"Limited operations"}</td><td data-label="Reported">{formatOperationsDate(row.reportedAt,"UTC")}</td></tr>)}</tbody></table></div>:<p>{result.totalCount?"No reports on this page.":"No open reports of limited or stopped operations."}</p>}
   {pages>1||page>1?<nav className={styles.pagination} aria-label="Operating report pages">{page>1?<Link href={`/app/requests/operating?page=${page-1}`}>← Previous</Link>:null}<span>Page {page} of {pages}</span>{page<pages?<Link href={`/app/requests/operating?page=${page+1}`}>Next →</Link>:null}</nav>:null}
  </section>
 </div>;
}
