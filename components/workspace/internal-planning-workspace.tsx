import Link from "next/link";
import { InternalDispatchWorkspace } from "./internal-dispatch-workspace";
import { InternalAgenda } from "./internal-agenda";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { WorkOrderListPage } from "@/lib/ops/view-models";
import type { OperatorSession } from "@/components/ops/data-contract";
import styles from "./internal-dispatch.module.css";

export function InternalPlanningWorkspace({session,technician,view,search,week,zone,referenceAt,readiness,person,region,storeId,page,heldPage,planned,replan,review,links,filters}:{session:OperatorSession;technician:boolean;view:string;search:string;week:string;zone:string;referenceAt:string;readiness:string;person?:string;region?:string;storeId?:string;page:WorkOrderListPage;heldPage?:WorkOrderListPage;planned?:WorkOrderListPage;replan?:WorkOrderListPage;review?:WorkOrderListPage;links:Record<string,string|undefined>;filters:{people:{id:string;name:string}[];regions:{id:string;name:string}[]}}) {
  const base=technician?"/app/my-work":"/app/dispatch",query=new URLSearchParams({view,q:search,week,readiness,...(person?{person}:{}),...(region?{region}:{}),...(storeId?{store:storeId}:{})});
  const href=(key:string,value:string)=>{const next=new URLSearchParams(query);next.set(key,value);return base+"?"+next;};
  const tabs=technician?[["today","Today"],["upcoming","Upcoming"],["mine","All my jobs"],["pool","Available team work"]]:[["all","All internal work"],["pool","To allocate"],["person","Assigned"],["awaiting_allocation","Manager to arrange"]];
  return <div className={styles.workspace}><header className={styles.header}><div><h1>{technician?"My work":"Dispatch"}</h1><p>{technician?"Your agenda, unfinished work and team jobs.":"Plan internal work. Schedule changes are live immediately."}</p></div><Link href="/app/work-orders?status=open">All open work →</Link></header>
    <nav className={styles.tabs} aria-label="Internal work views">{tabs.map(([key,label])=><Link key={key} href={href("view",key)} aria-current={view===key?"page":undefined}>{label}</Link>)}</nav>
    {!technician?<nav className={styles.tabs} aria-label="Planning week"><Link href={href("week",addCalendarDays(week,-7))}>← Previous week</Link><strong>Week of {formatOperationsDate(week)} · {zone}</strong><Link href={href("week",addCalendarDays(week,7))}>Next week →</Link></nav>:null}
    <form className={styles.search} method="get"><input type="hidden" name="view" value={view}/>{storeId?<input type="hidden" name="store" value={storeId}/>:null}{!technician?<label>Week containing<input type="date" name="week" defaultValue={week}/></label>:null}<label>Search work<input type="search" name="q" defaultValue={search} maxLength={120} placeholder="Problem, WO, store number or address"/></label><label>Work state<select name="readiness" defaultValue={readiness}><option value="all">All states</option><option value="ready">Ready</option><option value="waiting">Waiting</option><option value="next_visit">Next visit</option></select></label>
      {!technician?<><label>Technician<select name="person" defaultValue={person??""}><option value="">Everyone</option>{filters.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Region<select name="region" defaultValue={region??""}><option value="">All permitted regions</option>{filters.regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></>:null}<button type="submit">Apply filters</button><Link href={base}>Clear filters</Link>
    </form>
    <p className={styles.muted}>{session.companywide?"All your stores":"Your permitted stores"} · Current planning zone: {zone}. {storeId?<Link href={"/app/stores/"+encodeURIComponent(storeId)}>Open selected store</Link>:null}</p>
    {technician?<p><Link href="/app/my-work/check-in">No work order provided / I don&apos;t see my work order</Link></p>:null}
    {planned?<InternalAgenda zone={zone} referenceAt={referenceAt} page={planned} title={technician?view==="today"?"Today":"Upcoming":"Week agenda"} technician={technician} returnTo={base+"?"+query} nextHref={links.planned}/>:null}
    {replan?.totalCount?<InternalAgenda zone={zone} referenceAt={referenceAt} page={replan} title="Needs replanning" technician={technician} returnTo={base+"?"+query} nextHref={links.replan}/>:null}
    {review?.totalCount?<InternalDispatchWorkspace compact contextQuery={query.toString()} session={session} technician={false} view={view} search={search} storeId={storeId} page={review} heading="Results to review" nextHref={links.review}/>:null}
    {!technician||["mine","pool"].includes(view)?<InternalDispatchWorkspace compact heading={technician?undefined:"Needs planning"} contextQuery={query.toString()} session={session} technician={technician} view={view} search={search} storeId={storeId} page={page} heldPage={heldPage} nextHref={links.backlog} heldNextHref={links.held}/>:null}
  </div>;
}
