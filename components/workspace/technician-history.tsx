import Link from "next/link";
import type { OpsRepository, OrganizationScope, WorkOrderListQuery } from "@/lib/ops/repository";
import { internalWorkResultLabel } from "@/lib/ops/work-order-outcome";
import { dispatchStatus, dispatchTime } from "@/lib/ops/dispatch-board";
import { FileLinks } from "./file-links";
import styles from "./internal-dispatch.module.css";

/** Operational evidence only. Financial facts never enter this component's props or markup. */
export async function TechnicianHistory({repository,scope,storeId,assetId,excludeId,limit=25,cursor,title="Past work",zone="America/New_York",nextHref}:{repository:OpsRepository;scope:OrganizationScope;storeId?:string;assetId?:string;excludeId?:string;limit?:number;cursor?:string;title?:string;zone?:string;nextHref?:(cursor:string)=>string}) {
  const query:WorkOrderListQuery={storeId,assetId,activityOrder:true,limit:excludeId?limit+1:limit,cursor,statuses:["in_progress","waiting_on_vendor","waiting_on_parts","completed_pending_review","resolved","closed"]};
  const page=await repository.listWorkOrders(scope,query), rows=page.items.filter(row=>row.id!==excludeId).slice(0,limit);
  const evidence=await Promise.all(rows.map(async row=>({row,detail:await repository.getWorkOrderDetail(scope,row.id),results:await repository.listWorkResults(scope.organizationId,row.id),files:await repository.listFilesForEntity(scope.organizationId,"work_order",row.id)})));
  return <section className={styles.jobBody}><h2 className={styles.subHeading}>{title}</h2>
    {evidence.length?<ul className={styles.historyList}>{evidence.map(({row,detail,results,files})=><li key={row.id}>
      <Link href={`/app/work-orders/${encodeURIComponent(row.id)}`}>Store {row.storeNumber} · {row.problem}</Link>
      <p>{row.internalAssigneeName??row.vendorName??"Maintenance team"} · {dispatchStatus(row).label}</p>
      {results.length?results.slice(0,3).map(result=><p key={result.id}><strong>{internalWorkResultLabel(result.outcome)}</strong> · {result.performerName} · {dispatchTime(result.outcomeRecordedAt,zone,zone)}{result.outcomeNotes?` — ${result.outcomeNotes}`:""}</p>):detail?.visits.slice(0,3).map(visit=><p key={visit.id}>{visit.technicianName} · {dispatchTime(visit.checkedOutAt??visit.checkedInAt,zone,zone)}{visit.workOutcomeNotes?` — ${visit.workOutcomeNotes}`:""}</p>)}
      {files.length?<details><summary>Notes and photos ({files.length})</summary><ul>{files.map(file=><li key={file.id}><FileLinks file={file} href={`/api/ops/work-orders/${encodeURIComponent(row.id)}/files/${encodeURIComponent(file.id)}`}/></li>)}</ul></details>:null}
    </li>)}</ul>:<p>No past work recorded here yet.</p>}
    {nextHref&&page.nextCursor?<p>Showing {rows.length} of {page.totalCount ?? rows.length} · <Link href={nextHref(page.nextCursor)}>Show more</Link></p>:null}
  </section>;
}
