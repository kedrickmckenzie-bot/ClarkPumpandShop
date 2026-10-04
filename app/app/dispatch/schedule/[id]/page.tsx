import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { InternalAssignmentFields } from "@/components/workspace/internal-assignment-fields";
import { InternalScheduleFields } from "@/components/workspace/internal-schedule-fields";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate, scheduleLabel } from "@/lib/ops/dispatch-calendar";
import { internalTarget } from "@/lib/ops/internal-dispatch";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function SchedulePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {id}=await params,q=await searchParams,context=await getOpsRequestContext(["facilities","regional","technician"]),{repository:r,session:s}=context;
  const work=await r.getWorkOrderDetail(await internalDispatchScope(r,s),id);
  if(!work)return <section><h1>Job unavailable</h1><p>This job is outside your current store access.</p></section>;
  const [record,assignment,org,store,history]=await Promise.all([r.getWorkOrder(s.organizationId,id),r.getActiveAssignment(s.organizationId,id),r.getOrganization(s.organizationId),r.getStore(s.organizationId,work.storeId),r.listInternalSchedules(s.organizationId,id)]);
  const manager=s.role!=="technician",plan=record?.internalScheduleId?history.find(p=>p.id===record.internalScheduleId&&p.assignmentId===assignment?.id):undefined;
  const destinations=["/app/dispatch","/app/my-work",`/app/my-work/${encodeURIComponent(id)}`,`/app/work-orders/${encodeURIComponent(id)}`];
  const returnTo=q.returnTo&&destinations.some(path=>q.returnTo===path||q.returnTo!.startsWith(path+"?")||q.returnTo!.startsWith(path+"#"))?q.returnTo:manager?"/app/dispatch":"/app/my-work";
  const zone=org!.timeZone,storeZone=store?.timeZone??zone;
  const versionFields=(key:string)=><><input type="hidden" name="expectedVersion" value={work.version??0}/><input type="hidden" name="expectedAssignmentId" value={assignment?.id??""}/><input type="hidden" name="expectedScheduleId" value={record?.internalScheduleId??""}/><input type="hidden" name="submissionKey" value={key}/><input type="hidden" name="returnTo" value={returnTo}/></>;
  return <div className={styles.workspace}><header><Link href={returnTo}>← Back to work</Link><h1>Schedule {work.number}</h1><p>Store {work.storeNumber} · {work.storeName}</p><h2>{work.problem}</h2></header>
    <section className={styles.surface}><h2>Current plan</h2><p>{scheduleLabel(plan)}</p>{plan?.startsAt&&plan.entryZone!==plan.planningZone?<p>Planning time: {formatOperationsDateTime(plan.startsAt,plan.planningZone)}</p>:null}<p>Next action due: {work.dueAt?formatOperationsDateTime(work.dueAt,zone):"Needs review"}</p><p>Target completion: {record?.targetCompletionAt?formatOperationsDateTime(record.targetCompletionAt,storeZone):"Not set"}</p><p>{work.nextAction}</p>{q.saved?<p role="status">Saved.</p>:null}</section>
    {assignment?.kind==="internal"&&(manager||assignment.internalMembershipId===s.membershipId)&&!["closed","cancelled","resolved","completed_pending_review"].includes(work.status)?<section className={styles.surface}><h2>{plan?"Move schedule":"Plan this work"}</h2><p>Saving changes the live schedule immediately.</p>
      {!manager&&plan?.precision==="appointment"?<p>A manager changes this fixed appointment.</p>:<RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>
        {versionFields(randomUUID())}{manager?<InternalAssignmentFields storeId={work.storeId} defaultTarget={internalTarget(assignment)} defaultPerson={assignment.internalMembershipId?{id:assignment.internalMembershipId,name:work.internalAssigneeName??"Assigned technician"}:undefined} defaultManager={record?.internalAccountableType==="membership"&&record.internalAccountableId?{id:record.internalAccountableId,name:work.internalAccountableParty}:undefined}/>:<p>Assigned to you. Managers change assignments and fixed appointments.</p>}
        <InternalScheduleFields plan={plan} manager={manager} storeZone={storeZone} planningZone={zone} today={civilDate(new Date().toISOString(),zone)} date={q.day&&/^\d{4}-\d{2}-\d{2}$/.test(q.day)?q.day:civilDate(new Date().toISOString(),zone)} waiting={Boolean(work.hasOpenFollowUp||work.visitHoldPosture||["waiting_on_parts","waiting_on_vendor"].includes(work.status))}/>
      </RecordForm>}
      {plan&&(manager||plan.precision!=="appointment")?<details><summary>Remove schedule</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>{versionFields(randomUUID())}<input type="hidden" name="precision" value="removed"/><p>The job stays assigned and returns to Unscheduled.</p><button type="submit">Remove schedule</button></RecordForm></details>:null}
    </section>:<p>{!manager&&assignment?.internalTarget==="pool"?<>Take this job from <Link href="/app/my-work?view=pool">Available team work</Link> before planning it.</>:"This job is not available for you to schedule."}</p>}
    {manager?<details className={styles.surface}><summary>Change Target completion</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-schedule`} offerSavedWork={false} className={styles.form}>{versionFields(randomUUID())}<input type="hidden" name="action" value="target"/><label>Target completion · {storeZone}<input type="datetime-local" name="localTarget" defaultValue={record?.targetCompletionAt?cachedDateTimeFormat("sv-SE",{timeZone:storeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(record.targetCompletionAt)).replace(" ","T"):undefined}/></label><p className={styles.muted}>Leave blank to remove the target. This does not change the planned date or next-action deadline.</p><label>If this time occurs twice<select name="disambiguation"><option value="">Ask me</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></label><label>Reason<textarea name="reason" required rows={2} maxLength={1000}/></label><button type="submit">Save target</button></RecordForm></details>:null}
    {history.length?<details className={styles.surface}><summary>Schedule history ({history.length})</summary><ol>{history.map(p=><li key={p.id}>{p.precision==="removed"?"Schedule removed":scheduleLabel(p)} · Attempt {p.attempt} · {p.recordedByName} · {formatOperationsDateTime(p.recordedAt,zone)}{p.reviewReason?" · "+p.reviewReason:""}</li>)}</ol></details>:null}
    <Link href={manager?`/app/work-orders/${encodeURIComponent(id)}?view=service`:`/app/my-work/${encodeURIComponent(id)}`}>Open job →</Link>
  </div>;
}
