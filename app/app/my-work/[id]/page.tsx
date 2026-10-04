import Link from "next/link";
import { scheduleLabel } from "@/lib/ops/dispatch-calendar";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { InternalResultFields, InternalVendorHandoffFields } from "@/components/workspace/internal-result-fields";
import { DispatchVersionFields } from "@/components/workspace/internal-dispatch-workspace";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { dispatchIdentity } from "@/lib/ops/internal-dispatch";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { internalWorkResultLabel } from "@/lib/ops/work-order-outcome";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function InternalJob({ params }: { params: Promise<{id:string}> }) {
  const {id} = await params;
  const context = await getOpsRequestContext(["technician","facilities","regional"]);
  const {repository:r,session:s} = context, org=s.organizationId;
  const work = await r.getWorkOrderDetail(await internalDispatchScope(r,s),id);
  if (!work) return <section><h1>Job unavailable</h1><p>This job is outside your current store access or no longer exists.</p><Link href="/app/my-work">My work</Link></section>;
  const [assignment,policy,files,store,results,inspection,hold] = await Promise.all([r.getActiveAssignment(org,id),r.getActiveWorkflowPolicy(org),r.listFilesForEntity(org,"work_order",id),r.getStore(org,work.storeId),r.listWorkResults(org,id),r.inspectionForWork(org,id),r.getWorkOrderVisitHold(org,id)]);
  const mine = assignment?.kind === "internal" && assignment.internalMembershipId === s.membershipId;
  const manager = ["facilities","regional"].includes(s.role);
  await dispatchIdentity(r,org,s.membershipId!,work.storeId,manager ? ["facilities_admin","field_manager","regional_manager"] : ["internal_technician"],false);
  const active = work.visits.find(visit=>visit.status === "active");
  const terminal = ["draft","awaiting_approval","closed","cancelled","resolved","completed_pending_review"].includes(work.status);
  const ownInspection = inspection?.workOrderId === id;
  const lookAndReport = hold?.posture === "look_and_report" && !["released", "cancelled", "completed"].includes(hold.status);
  const returnBlocked = results[0]?.followUpId && work.followUps.some(f=>f.id===results[0].followUpId&&f.status==="open");
  const independentFollowUps = work.followUps.filter(f=>f.status==="open"&&f.id!==results[0]?.followUpId);
  const resultBlocked = Boolean(returnBlocked || work.hasOpenFollowUp);
  const canReport = (mine || manager && assignment?.kind === "internal" && assignment.internalMembershipId) && !terminal && !ownInspection;
  const path = `/app/my-work/${encodeURIComponent(id)}`, action=`/api/ops/work-orders/${encodeURIComponent(id)}/internal-result`;
  const version = () => <DispatchVersionFields row={work} returnTo={path}/>;
  const managerSource = (problem = false) => manager ? <><label>Reported performer<input name="performerName" defaultValue={work.internalAssigneeName} required maxLength={200}/></label><label>Received by<select name="source" defaultValue="phone"><option value="phone">Phone</option><option value="email">Email</option><option value="in_person">In person</option></select></label>{policy?.internalCheckInRequired && !problem ? <label>Reason for check-in exception<textarea name="exceptionReason" required maxLength={1000}/></label> : null}</> : null;
  return <div className={styles.workspace}>
    <header className={styles.header}><div><Link href={manager ? "/app/dispatch" : "/app/my-work"}>← {manager ? "Dispatch" : "My work"}</Link><h1>Store {work.storeNumber} · {work.storeName}</h1><p>{store?.address1}{store?.city ? ` · ${store.city}` : ""}</p></div><span>{work.number}</span></header><section className={styles.panel}><h2>Planned work</h2><p>{scheduleLabel(work.schedule)}</p><p>Target completion: {work.targetCompletionAt?formatOperationsDateTime(work.targetCompletionAt,work.schedule?.planningZone):"Not set"}</p>{(mine||manager&&assignment?.kind==="internal")&&!terminal&&!ownInspection?<Link href={"/app/dispatch/schedule/"+encodeURIComponent(id)+"?returnTo="+encodeURIComponent("/app/my-work/"+id)}>Schedule / move →</Link>:null}</section>
    <section className={styles.jobBody}><h2>{work.problem}</h2>{work.asset ? <p><strong>{work.asset.name}</strong> · {work.asset.assetTag}{work.component ? ` · ${work.component.name}` : ""}</p> : null}{work.authorizedScope ? <p>{work.authorizedScope}</p> : null}
      <p className={styles.muted}>{work.internalAssigneeName ? `Assigned to ${work.internalAssigneeName}` : "Needs a technician"} · Manager: {work.internalAccountableParty}</p>
      <p><strong>{terminal || resultBlocked ? work.nextAction : work.status === "waiting_on_parts" ? "Waiting for parts" : work.nextAction === "Begin internal work" ? "Ready to work" : work.nextAction === "Arrange team pickup" ? "Needs a technician" : work.nextAction}</strong>{work.dueAt ? ` · Due ${formatOperationsDateTime(work.dueAt,store?.timeZone)}` : ""}</p>
      {independentFollowUps.filter(f=>f.nextAction!==work.nextAction).map(f=><p key={f.id}><strong>{f.nextAction}</strong> · {f.accountableParty} · Due {formatOperationsDateTime(f.dueAt,store?.timeZone)}</p>)}
      {files.length ? <div><h3>Photos & instructions</h3><ul>{files.map(file=><li key={file.id}><a href={`/api/ops/work-orders/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer">{file.originalName}</a></li>)}</ul></div> : null}
      {ownInspection ? <Link href={`/app/compliance/${encodeURIComponent(inspection.id)}`}>Open inspection checklist →</Link> : null}
      {lookAndReport ? <p><strong>Look and report only.</strong> Record findings; repairs need manager authorization.</p> : null}
      {active ? <p><Link href={`/app/my-work/visits/${encodeURIComponent(active.id)}`}>Record results & check out →</Link></p> : null}
      {canReport ? <div className={styles.jobActions}>
        {!active && !resultBlocked && (!policy?.internalCheckInRequired || manager) ? <details id="record-result"><summary>Record result</summary><RecordForm action={action} offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}>{version()}{managerSource()}<InternalResultFields lookAndReport={lookAndReport}/><button name="action" value="result" type="submit">Save result</button></RecordForm></details> : null}
        {!active && !resultBlocked && mine ? <details><summary>{policy?.internalCheckInRequired ? "Check in to record results" : "Check in (optional)"}</summary><RecordForm action="/api/ops/internal-visits" offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}><input name="submissionKey" type="hidden" value={randomUUID()}/><input name="storeId" type="hidden" value={work.storeId}/><input name="workOrderId" type="hidden" value={work.id}/><input name="expectedVersion" type="hidden" value={work.version??0}/><input name="expectedAssignmentId" type="hidden" value={assignment!.id}/><button type="submit" name="action" value="check_in">Check in</button></RecordForm></details> : null}
        <details id="flag-problem"><summary>Flag a problem</summary><RecordForm action={action} offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}>{version()}{managerSource(true)}<InternalResultFields problem/><button name="action" value="problem" type="submit">Send to manager</button></RecordForm></details>
      </div> : null}
      {!mine && !manager && !terminal ? <p>Take this job from Available team work before recording a result.</p> : null}
      {manager && !terminal && returnBlocked && results[0]?.blocker !== "vendor" && results[0]?.outcome !== "quote_required" ? <RecordForm action={action} offerSavedWork={false} attachmentLimit={{files:5,bytes:8*1024*1024}} className={styles.form}>{version()}<label>Ready for return work<textarea name="notes" required maxLength={1000} placeholder="Parts arrived, help arranged, or another reviewed change"/></label><button type="submit" name="action" value="ready">Mark ready to work</button></RecordForm> : null}
      {resultBlocked && !manager ? <p>Your manager is reviewing what is needed before work can continue.</p> : null}
      {manager && !active && returnBlocked && (results[0]?.blocker === "vendor" || results[0]?.outcome === "quote_required") ? <details open><summary>Choose an outside vendor</summary><RecordForm action={action} offerSavedWork={false} className={styles.form}>{version()}<InternalVendorHandoffFields storeId={work.storeId}/><button type="submit" name="action" value="vendor">Choose vendor</button></RecordForm></details> : null}
    </section>
    <p><Link href={`/app/work-orders/${encodeURIComponent(id)}`}>Full work record →</Link></p>
    {results.length ? <section className={styles.jobBody}><h2>Recorded results</h2><ul>{results.slice(0,20).map(result=><li key={result.id}><strong>{internalWorkResultLabel(result.outcome)}</strong> · {result.performerName}<p>{result.outcomeNotes}</p><small>{formatOperationsDateTime(result.outcomeRecordedAt,store?.timeZone)} · {result.source.replaceAll("_"," ")} · Recorded by {result.outcomeRecordedByActorName}{result.reportedPerformedAt ? ` · Reported work time: ${formatOperationsDateTime(result.reportedPerformedAt,store?.timeZone)} (unverified)` : ""}</small></li>)}</ul></section> : null}
  </div>;
}
