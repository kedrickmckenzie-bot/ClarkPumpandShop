import {notFound} from "next/navigation";
import {loadOperatorSession} from "@/app/app/_data/operator-loader";
import { LiveSearchForm } from "@/components/ops/live-search-form";
import {OpsDomainError} from "@/lib/ops/errors";
import Link from "next/link";
import {getOpsRequestContext,assertStoreInSessionScope} from "@/lib/server/ops-request-context";
import {taskIdentity,taskScope} from "@/lib/ops/store-tasks";
import {taskRoles,taskViewLabels,type TaskView} from "@/lib/ops/store-task-types";
import {formatOperationsDateTime} from "@/lib/ops/local-time";
import styles from "./store-tasks.module.css";
export default async function StoreTaskWorkspace({searchParams,fixedStore,sourceId}:{searchParams:Promise<Record<string,string|undefined>>;fixedStore?:string;sourceId?:string}) {
 if(!(taskRoles as readonly string[]).includes((await loadOperatorSession()).role))notFound();
 const {session,repository:r,actor}=await getOpsRequestContext(taskRoles),q=await searchParams;
 let access;
 try {access=await taskIdentity(r,session.organizationId,actor.actorId!);} catch(e) {if(e instanceof OpsDomainError&&e.code==='FORBIDDEN')return <div className={styles.page}><h1>Tasks</h1><p>Tasks aren’t enabled for this account. Ask your administrator for access.</p></div>;throw e;}
 const scope=await taskScope(r,session,actor.actorId!);
 const store=fixedStore??q.store;if(store)await assertStoreInSessionScope(session,store);
 const selectedStore=store?await r.getStore(session.organizationId,store):null;
 const chosen=q.view&&q.view in taskViewLabels?q.view as TaskView:undefined;
 let view:TaskView=chosen??(fixedStore||sourceId?'all':'mine');
 const offset=Math.max(0,Math.min(100000,Math.floor(Number(q.offset)||0))),now=new Date().toISOString();
 let page=await r.queryStoreTasks(scope,{...access,view,storeId:store,sourceId,search:q.q,offset,limit:25,now});
 // First visit with nothing assigned to me: open the shared tasks someone can take. A chosen tab is always kept.
 if(!chosen&&view==='mine'&&!page.items.length&&!q.q){const shared=await r.queryStoreTasks(scope,{...access,view:'shared',storeId:store,sourceId,offset:0,limit:25,now});if(shared.items.length){view='shared';page=shared;}}
 const base=fixedStore?`/app/stores/${encodeURIComponent(fixedStore)}/tasks`:'/app/tasks';
 const href=(v:TaskView,o=0)=>`${base}?${new URLSearchParams({view:v,offset:String(o),...(store?{store}:{}),...(q.q?{q:q.q}:{}),...(sourceId?{source:sourceId}:{})})}`;
 return <div className={styles.page}><header className={styles.header}><div><h1>{selectedStore?`Store ${selectedStore.storeNumber} · Tasks`:'Tasks'}</h1><p className={styles.muted}>{selectedStore?selectedStore.name:session.scopeLabel}</p></div><Link className={styles.primary} href={`/app/tasks/new${store?`?store=${encodeURIComponent(store)}`:''}`}>New task</Link></header>
 <nav className={styles.tabs} aria-label="Task views">{Object.entries(taskViewLabels).map(([key,label])=><Link key={key} href={href(key as TaskView)} aria-current={key===view?'page':undefined}>{label}</Link>)}</nav>
 <section className={styles.panel}><LiveSearchForm className={styles.filters} method="get"><input type="hidden" name="view" value={view}/>{store?<input type="hidden" name="store" value={store}/>:null}{sourceId?<input type="hidden" name="source" value={sourceId}/>:null}<label>Search tasks<input name="q" type="search" defaultValue={q.q} placeholder="Task or store"/></label><button>Search</button></LiveSearchForm><p className={styles.muted}>{page.totalCount} task{page.totalCount===1?'':'s'}</p>
 <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Task / store</th><th>Next action</th><th>Who handles it</th><th>Due</th></tr></thead><tbody>{page.items.map(t=><tr key={t.id}><td data-label="Task"><Link href={`/app/tasks/${t.id}`}>{t.title}</Link><p className={styles.muted}>Store {t.storeNumber} · {t.storeName}</p>{t.newReply?<span className={styles.tag}>New reply</span>:null}{t.priority==='urgent'?<span className={styles.tag}>Urgent</span>:null}</td><td data-label="Next action">{t.status==='closed'?'Closed':t.status==='review'?'Review findings':t.claimantId||t.assignment==='person'?'Complete the check':'Take task'}{t.assignment==='local'&&t.status==='open'?<p className={styles.muted}>Store action needed</p>:null}{t.status!=='closed'&&t.result==='attention'?<p className={styles.error}>Needs attention</p>:t.status!=='closed'&&t.result==='unable'?<p>Couldn’t complete</p>:null}</td><td data-label="Handling">{t.status==='review'?t.requesterName:t.handlerName|| (t.assignment==='local'?'Someone at the store':'Anyone responsible for this store')}{t.status==='open'?<p className={styles.muted}>If overdue: {t.fallbackName}</p>:null}</td><td data-label="Due">{t.status==='review'?'Awaiting review':formatOperationsDateTime(t.dueAt,t.timeZone)}{t.status==='open'&&t.dueAt<now?<p className={styles.error}>Overdue</p>:null}</td></tr>)}</tbody></table></div>
 {!page.items.length?<p>No tasks in this view. Try Shared tasks or create a new task.</p>:null}<nav className={styles.actions} aria-label="Task pages">{offset>0?<Link href={href(view,offset-25)}>Previous</Link>:null}{offset+25<page.totalCount?<Link href={href(view,offset+25)}>Next</Link>:null}</nav></section></div>;
}
