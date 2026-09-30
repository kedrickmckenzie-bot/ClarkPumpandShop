import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { roleCan } from "@/components/ops/role-policy";
import { canShareSentWork, sentWorkSnapshot } from "@/lib/ops/sent-work-orders";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { CopySentWorkLink } from "./copy-sent-work-link";
import styles from "./sent-work-orders.module.css";
export async function SentWorkOrders({workOrderId}:{workOrderId:string}) {
  const session=await loadOperatorSession();
  const repository=await getServerOpsRepository();
  if(!await repository.getWorkOrderDetail(session,workOrderId))return null;
  const [work,rows,active]=await Promise.all([repository.getWorkOrder(session.organizationId,workOrderId),repository.listIssuancesForWorkOrder(session.organizationId,workOrderId),repository.getActiveAssignment(session.organizationId,workOrderId)]);
  if(!work || !rows.length)return null;
  const ordered=[...rows].sort((a,b)=>b.revision-a.revision);
  const assignment=await repository.getAssignment(session.organizationId,ordered[0].assignmentId);
  return <section className={styles.panel} aria-labelledby="sent-work-heading">
    <header><h2 id="sent-work-heading">Sent work orders</h2><p>Saved versions of the instructions sent to the vendor.</p></header>
    <ul className={styles.versions}>{ordered.map(row=>{
      const snapshot=sentWorkSnapshot(row);
      return <li key={row.id}><div><strong>Version {row.revision} · {snapshot?.vendor.name ?? "Vendor not recorded"}</strong><span>{formatOperationsDateTime(row.issuedAt,snapshot?.store.timeZone)} · {row.channel === "manual" ? "Link handoff" : row.channel === "print" ? "Print handoff" : row.channel === "email" ? "Email handoff" : "SMS handoff"}</span></div>
        <Link href={`/app/work-orders/${encodeURIComponent(workOrderId)}/sent/${encodeURIComponent(row.id)}`}>View sent work order →</Link>
      </li>;
    })}</ul>
    {roleCan(session,"issue_work_order") && canShareSentWork(work,ordered[0],ordered[0],assignment,active)?<CopySentWorkLink workOrderId={work.id} issuanceId={ordered[0].id}/>:null}
  </section>;
}
