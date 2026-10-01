import {roleCanAccessListRoute} from "@/components/ops/role-policy";
import Link from "next/link";
import {storeWorkspaceContext} from "@/lib/server/store-workspace-context";
import {formatOperationsDateTime} from "@/lib/ops/local-time";
import styles from "./store-tasks.module.css";
const labels:Record<string,string>={submitted:"New",under_review:"Under review",acknowledged:"Acknowledged"};
export async function StoreOpenReports({id}:{id:string}) {
 const {session,repository,store}=await storeWorkspaceContext(id);
 if(!roleCanAccessListRoute(session.role,"requests"))return null;
 const reports=await repository.listRequests({...session,storeIds:[id]},{storeId:id,status:"open_unlinked",limit:5});
 const count=reports.totalCount??reports.items.length;
 const href=`/app/requests?${new URLSearchParams({store:id,status:"open_unlinked"})}`;
 return <section className={`${styles.page} ${styles.panel} ${styles.fullWidth}`} aria-labelledby="store-open-reports"><header className={styles.header}><h2 id="store-open-reports"><Link href={href}>{count} open issue report{count===1?"":"s"}</Link></h2><Link href={href}>Review reports →</Link></header>{reports.items.length?<><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Reported problem</th><th>Status</th><th>Priority</th><th>Reported</th></tr></thead><tbody>{reports.items.map(r=><tr key={r.id}><td data-label="Problem"><Link href={`/app/requests/${r.id}`}>{r.problem}</Link><p className={styles.muted}>{r.reference} · {r.reporterName}</p></td><td data-label="Status">{labels[r.status]??r.status}</td><td data-label="Priority">{r.priority.charAt(0).toUpperCase()+r.priority.slice(1)}</td><td data-label="Reported">{formatOperationsDateTime(r.submittedAt,store.timeZone)}</td></tr>)}</tbody></table></div>{reports.nextCursor?<Link href={href}>View all {reports.totalCount} open reports</Link>:null}</>:<p className={styles.muted}>No reports waiting for review or a work order.</p>}</section>;
}
