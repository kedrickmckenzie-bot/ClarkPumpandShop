import Link from "next/link";
import { getAiClient } from "@/lib/server/ai-provider";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { InternalResultFields } from "@/components/workspace/internal-result-fields";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { applicableVisitWorkOutcomes, internalWorkResultLabel } from "@/lib/ops/work-order-outcome";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function InternalVisit({params}:{params:Promise<{id:string}>}){
  const {id}=await params,c=await getOpsRequestContext(["technician"]),r=c.repository,org=c.session.organizationId;
  const scope=await internalDispatchScope(r,c.session), visit=await r.getVisit(org,id);
  if(!visit||visit.internalMembershipId!==c.session.membershipId||!scope.storeIds?.includes(visit.storeId))return <section><h1>Visit not available</h1><Link href="/app/my-work">My work</Link></section>;
  const [links,store,pool,own]=await Promise.all([r.listSiteVisitWorkOrders(org,id),r.getStore(org,visit.storeId),r.listWorkOrders(scope,{internalOnly:true,internalTarget:"pool",storeId:visit.storeId,heldOnly:true,limit:25}),r.listWorkOrders(scope,{internalOnly:true,internalMembershipId:c.session.membershipId,storeId:visit.storeId,heldOnly:true,limit:25})]);
  const [jobs,assignments,results,holds]=await Promise.all([
    Promise.all(links.map(link=>r.getWorkOrder(org,link.workOrderId))),
    Promise.all(links.map(link=>r.getActiveAssignment(org,link.workOrderId))),
    Promise.all(links.map(link=>r.listWorkResults(org,link.workOrderId))),
    Promise.all(links.map(link=>r.getWorkOrderVisitHold(org,link.workOrderId))),
  ]);
  const savedResults=new Map(applicableVisitWorkOutcomes(links,results.flat()).map(result=>[result.siteVisitWorkOrderId??result.id,result]));
  const extras=[...pool.items,...own.items].filter(row=>!row.inspectionId&&!links.some(link=>link.workOrderId===row.id));
  const aiHelp=Boolean(getAiClient());
  const fields=()=> <><input name="visitId" type="hidden" value={id}/><input name="submissionKey" type="hidden" value={randomUUID()}/></>;
  return <div className={styles.workspace}><header className={styles.header}><div><Link href="/app/my-work">← My work</Link><h1>Store {store?.storeNumber} · {store?.name}</h1><p>Checked in {formatOperationsDateTime(visit.checkedInAt,store?.timeZone)}</p></div><strong>{visit.status==="active"?"Visit active":"Visit finished"}</strong></header>
    {visit.status==="active" ? <>
      <section className={styles.jobBody}><h2>Finish visit</h2><RecordForm action="/api/ops/internal-visits" offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}>{fields()}{links.map((link,index)=><section key={link.id}><h3>{jobs[index]?.problem}</h3><p>{jobs[index]?.number} · <Link href={`/app/my-work/${encodeURIComponent(link.workOrderId)}`}>Open job</Link></p>{holds[index]?.posture==="look_and_report"&&holds[index]?.id===link.workOrderHoldId?<p>Look and report only. Write down what you find. Repairs need a manager&apos;s OK first.</p>:null}<input type="hidden" name={`${link.workOrderId}:expectedVersion`} value={jobs[index]?.version??0}/><input type="hidden" name={`${link.workOrderId}:expectedAssignmentId`} value={assignments[index]?.id??""}/><InternalResultFields visit ai={aiHelp ? { workOrderId: link.workOrderId } : undefined} prefix={`${link.workOrderId}:`} lookAndReport={holds[index]?.posture==="look_and_report"&&holds[index]?.id===link.workOrderHoldId}/></section>)}{!links.length?<label>What happened?<textarea name="notes" required maxLength={3000}/></label>:null}<button name="action" value="check_out" type="submit">Save and check out</button></RecordForm></section>
      {extras.length ? <section className={styles.jobBody}><h2>When you&apos;re nearby</h2><p>Other jobs at this store you could do now. Tick any you will do.</p><RecordForm action="/api/ops/internal-visits" offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}>{fields()}{extras.map(row=><label key={row.id}><input type="checkbox" name="heldWorkOrderId" value={row.id}/><span>{row.number} · {row.problem} · <Link href={`/app/my-work/${encodeURIComponent(row.id)}`}>Details</Link></span></label>)}<button type="submit" name="action" value="add_work">Add ticked jobs to this visit</button></RecordForm></section> : null}
    </> : <section className={styles.jobBody}><h2>Saved results</h2>{links.length?<ul>{links.map((link,index)=>{const amendment=savedResults.get(link.id),result=amendment??link;return <li key={link.id}><Link href={`/app/my-work/${encodeURIComponent(link.workOrderId)}`}>{jobs[index]?.number} · {jobs[index]?.problem}</Link><p>{internalWorkResultLabel(result.outcome)}{result.outcomeNotes ? ` · ${result.outcomeNotes}` : ""}</p>{amendment?.source==="correction"?<small>Corrected result · Recorded by {result.outcomeRecordedByActorName}</small>:null}</li>;})}</ul>:<p>Your manager will match this visit to a job.</p>}<Link href="/app/my-work">Return to My work →</Link></section>}
  </div>;
}
