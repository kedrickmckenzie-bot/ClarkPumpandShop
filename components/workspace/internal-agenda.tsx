import Link from "next/link";
import type { WorkOrderListPage } from "@/lib/ops/view-models";
import { civilDate, scheduleLabel } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import styles from "./internal-dispatch.module.css";

export function InternalAgenda({page,title,technician,returnTo,nextHref,zone,referenceAt}:{page:WorkOrderListPage;title:string;technician:boolean;returnTo:string;nextHref?:string;zone:string;referenceAt:string}) {
  const groups=new Map<string,typeof page.items>();
  for(const row of [...page.items].sort((a,b)=>(a.schedule?.day??a.schedule?.week??"").localeCompare(b.schedule?.day??b.schedule?.week??"")||(a.schedule?.startsAt??"").localeCompare(b.schedule?.startsAt??"")||a.id.localeCompare(b.id))) {
    const handler=row.internalTarget==="pool"?"To allocate":row.internalTarget==="awaiting_allocation"?"Manager to arrange":row.internalAssigneeName??"Assigned technician";
    const key=handler+" · "+(row.schedule?.precision==="week"?"Week only":row.schedule?.day?formatOperationsDate(row.schedule.day):"Unscheduled");
    groups.set(key,[...groups.get(key)??[],row]);
  }
  return <section className={styles.panel} aria-label={title}><h2>{title} ({page.totalCount??page.items.length})</h2>
    {!page.items.length?<p>No work in this period. <Link href={technician?"/app/my-work?view=mine":"/app/dispatch"}>{technician?"All my jobs":"Needs planning"}</Link></p>:null}
    {[...groups].map(([key,rows])=><section key={key} className={styles.agendaGroup}><h3>{key}</h3><ul className={styles.agendaList}>{rows.map(row=><li key={row.id}>
      <div><strong>{row.problem}</strong><p><Link href={technician?"/app/my-work/"+encodeURIComponent(row.id):"/app/work-orders/"+encodeURIComponent(row.id)+"?view=service"}>{row.number}</Link> · Store {row.storeNumber} · {row.storeName}</p><p>{scheduleLabel(row.schedule)}</p>{row.schedule?.planningZone&&row.schedule.planningZone!==zone?<p className={styles.muted}>Saved plan zone: {row.schedule.planningZone}</p>:null}
        {row.schedule&&(row.schedule.precision==="week"?addCalendarDays(row.schedule.week,6)<civilDate(referenceAt,row.schedule.planningZone):row.schedule.day!<civilDate(referenceAt,row.schedule.planningZone))?<p className={styles.urgent}>Needs replanning · work remains unfinished</p>:null}
        {row.schedule?.startsAt&&row.schedule.entryZone!==row.schedule.planningZone?<p className={styles.muted}>Planning time: {formatOperationsDateTime(row.schedule.startsAt,row.schedule.planningZone)}</p>:null}
        {row.schedule?.precision==="appointment"&&!row.schedule.durationMinutes?<p className={styles.muted}>Repair duration unknown · availability uncertain</p>:null}
        {row.schedule?.tentative||row.hasOpenFollowUp||["waiting_on_parts","waiting_on_vendor"].includes(row.status)?<p className={styles.urgent}>Waiting · {row.nextAction}</p>:null}
        <p className={styles.muted}>Target completion: {row.targetCompletionAt?formatOperationsDateTime(row.targetCompletionAt,row.schedule?.planningZone):"Not set"} · Next action due: {row.dueAt?formatOperationsDateTime(row.dueAt,row.schedule?.planningZone):"Needs review"}</p>
      </div><div className={styles.agendaActions}><Link href={"/app/dispatch/schedule/"+encodeURIComponent(row.id)+"?returnTo="+encodeURIComponent(returnTo)}>Move schedule</Link><Link href={technician?"/app/my-work/"+encodeURIComponent(row.id):"/app/work-orders/"+encodeURIComponent(row.id)+"?view=service"}>Open job →</Link></div>
    </li>)}</ul></section>)}
    {nextHref?<Link href={nextHref}>More {title.toLowerCase()} →</Link>:null}
  </section>;
}
