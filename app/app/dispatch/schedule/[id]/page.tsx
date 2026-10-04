import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { InternalAssignmentFields } from "@/components/workspace/internal-assignment-fields";
import { InternalScheduleFields } from "@/components/workspace/internal-schedule-fields";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate, plainNextAction, plainScheduleLabel } from "@/lib/ops/dispatch-calendar";
import { internalTarget } from "@/lib/ops/internal-dispatch";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function SchedulePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {id}=await params,q=await searchParams,context=await getOpsRequestContext(["facilities","regional","technician"]),{repository:r,session:s}=context;
  const work=await r.getWorkOrderDetail(await internalDispatchScope(r,s),id);
  if(!work)return <section><h1>Job not available</h1><p>This job is at a store you can&apos;t access.</p></section>;
  const [record,assignment,org,store,history]=await Promise.all([r.getWorkOrder(s.organizationId,id),r.getActiveAssignment(s.organizationId,id),r.getOrganization(s.organizationId),r.getStore(s.organizationId,work.storeId),r.listInternalSchedules(s.organizationId,id)]);
  const manager=s.role!=="technician",plan=record?.internalScheduleId?history.find(p=>p.id===record.internalScheduleId&&p.assignmentId===assignment?.id):undefined;
  const destinations=["/app/dispatch","/app/my-work",`/app/my-work/${encodeURIComponent(id)}`,`/app/work-orders/${encodeURIComponent(id)}`];
  const returnTo=q.returnTo&&destinations.some(path=>q.returnTo===path||q.returnTo!.startsWith(path+"?")||q.returnTo!.startsWith(path+"#"))?q.returnTo:manager?"/app/dispatch":"/app/my-work";
  const zone=org!.timeZone,storeZone=store?.timeZone??zone;
  const versionFields=(key:string)=><><input type="hidden" name="expectedVersion" value={work.version??0}/><input type="hidden" name="expectedAssignmentId" value={assignment?.id??""}/><input type="hidden" name="expectedScheduleId" value={record?.internalScheduleId??""}/><input type="hidden" name="submissionKey" value={key}/><input type="hidden" name="returnTo" value={returnTo}/></>;
  return <div className={styles.workspace}><header className={styles.jobHeader}><Link href={returnTo}>← Back</Link><h1>{plan?"Change date":"Pick a date"}</h1><p><strong>{work.problem}</strong></p><p>Store {work.storeNumber} · {work.storeName} · {work.number}</p></header>
    {q.saved?<p className={styles.notice} role="status">Saved.</p>:null}<section className={styles.jobBody}><dl className={styles.facts}><div><dt>Now</dt><dd>{plainScheduleLabel(plan)}</dd></div>{work.dueAt?<div><dt>Due</dt><dd>{formatOperationsDateTime(work.dueAt,zone)}</dd></div>:null}{record?.targetCompletionAt?<div><dt>Finish by</dt><dd>{formatOperationsDateTime(record.targetCompletionAt,storeZone)}</dd></div>:null}<div><dt>Next step</dt><dd>{plainNextAction(work.nextAction)}</dd></div></dl></section>
    {assignment?.kind==="internal"&&(manager||assignment.internalMembershipId===s.membershipId)&&!["closed","cancelled","resolved","completed_pending_review"].includes(work.status)?<section className={styles.jobBody}><h2 className={styles.subHeading}>{manager?"Who and when":"When"}</h2><p className={styles.muted}>{manager?"The technician sees the change as soon as you save.":"Your manager sees the change as soon as you save."}</p>
      {!manager&&plan?.precision==="appointment"?<p>This is set for a fixed time. Ask your manager to change it.</p>:<RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>
        {versionFields(randomUUID())}{manager?<InternalAssignmentFields storeId={work.storeId} defaultTarget={internalTarget(assignment)} defaultPerson={assignment.internalMembershipId?{id:assignment.internalMembershipId,name:work.internalAssigneeName??"Assigned technician"}:undefined} defaultManager={record?.internalAccountableType==="membership"&&record.internalAccountableId?{id:record.internalAccountableId,name:work.internalAccountableParty}:undefined}/>:null}
        <InternalScheduleFields plan={plan} manager={manager} storeZone={storeZone} planningZone={zone} today={civilDate(new Date().toISOString(),zone)} date={q.day&&/^\d{4}-\d{2}-\d{2}$/.test(q.day)?q.day:civilDate(new Date().toISOString(),zone)} waiting={Boolean(work.hasOpenFollowUp||work.visitHoldPosture||["waiting_on_parts","waiting_on_vendor"].includes(work.status))}/>
      </RecordForm>}
      {plan&&(manager||plan.precision!=="appointment")?<details><summary className={`${styles.btn} ${styles.btnSecondary}`}>Remove date</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>{versionFields(randomUUID())}<input type="hidden" name="precision" value="removed"/><p>The job stays with the same person, just without a date.</p><button type="submit">Remove date</button></RecordForm></details>:null}
    </section>:<p>{!manager&&assignment?.internalTarget==="pool"?<>Take this job from <Link href="/app/my-work?view=pool">Jobs to take</Link> first.</>:"You can't change the date for this job."}</p>}
    {manager?<details className={styles.filters}><summary>Set a finish-by date</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>{versionFields(randomUUID())}<input type="hidden" name="action" value="target"/><label>Finish by (store time)<input type="datetime-local" name="localTarget" defaultValue={record?.targetCompletionAt?cachedDateTimeFormat("sv-SE",{timeZone:storeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(record.targetCompletionAt)).replace(" ","T"):undefined}/></label><p className={styles.muted}>Leave blank to remove it. This doesn&apos;t move the planned date.</p><input type="hidden" name="disambiguation" value=""/><label>Why?<textarea name="reason" required rows={2} maxLength={1000}/></label><button type="submit">Save finish-by date</button></RecordForm></details>:null}
    {history.length?<details className={styles.filters}><summary>Date history ({history.length})</summary><ol>{history.map(p=><li key={p.id}>{p.precision==="removed"?"Date removed":plainScheduleLabel(p)} · {p.recordedByName} · {formatOperationsDateTime(p.recordedAt,zone)}{p.reviewReason?" · "+p.reviewReason:""}</li>)}</ol></details>:null}
    <Link href={`/app/my-work/${encodeURIComponent(id)}`}>Open job →</Link>
  </div>;
}
