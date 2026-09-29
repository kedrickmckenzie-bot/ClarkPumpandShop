import Link from "next/link";
import {getOpsRequestContext} from "@/lib/server/ops-request-context";
import {taskIdentity,taskScope} from "@/lib/ops/store-tasks";
import {taskRoles} from "@/lib/ops/store-task-types";
import {OpsDomainError} from "@/lib/ops/errors";
import styles from "./store-tasks.module.css";
export async function LinkedStoreTasks({kind,id}:{kind:'work'|'visit'|'invoice'|'asset';id:string}) {
 const {session,repository:r,actor}=await getOpsRequestContext(taskRoles);
 let access;try{access=await taskIdentity(r,session.organizationId,actor.actorId!);}catch(e){if(e instanceof OpsDomainError&&e.code==='FORBIDDEN')return null;throw e;}
 const page=await r.queryStoreTasks(await taskScope(r,session,actor.actorId!),{...access,view:'all',sourceId:id,limit:5,now:new Date().toISOString()});
 return <section className={`${styles.page} ${styles.panel}`}><header className={styles.header}><h2>Internal tasks</h2><Link href={`/app/tasks/new?${new URLSearchParams({[kind]:id})}`}>New task</Link></header>{page.items.length?<ul>{page.items.map(t=><li key={t.id}><Link href={`/app/tasks/${t.id}`}>{t.title}</Link> · {t.status==='review'?'Awaiting review':t.status==='closed'?'Closed':t.claimantId?'In progress':'Open'}</li>)}</ul>:<p className={styles.muted}>No tasks linked to this record.</p>}{page.totalCount>5?<Link href={`/app/tasks?source=${id}&view=all`}>View all {page.totalCount} tasks</Link>:null}</section>;
}
