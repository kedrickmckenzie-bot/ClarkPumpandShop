import { AiDiagnoseChat } from "@/components/workspace/ai-diagnose-chat";
import { JobPreparationFields } from "@/components/workspace/job-preparation-fields";
import { getAiClient } from "@/lib/server/ai-provider";
import { EquipmentDocuments } from "@/components/workspace/equipment-documents";
import { TechnicianHistory } from "@/components/workspace/technician-history";
import { dispatchPlanLabel, dispatchTime, dueLabel } from "@/lib/ops/dispatch-board";
import Link from "next/link";
import { civilDate, plainNextAction } from "@/lib/ops/dispatch-calendar";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { roleCan } from "@/components/ops/role-policy";
import { InternalResultFields, InternalVendorHandoffFields } from "@/components/workspace/internal-result-fields";
import { DispatchVersionFields } from "@/components/workspace/internal-dispatch-fields";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { dispatchIdentity, internalTarget } from "@/lib/ops/internal-dispatch";
import { internalWorkResultLabel } from "@/lib/ops/work-order-outcome";
import styles from "@/components/workspace/internal-dispatch.module.css";

const sourceLabels: Record<string, string> = {
  technician_report: "Reported by the technician",
  phone: "Reported by phone",
  email: "Reported by email",
  in_person: "Reported in person",
  correction: "Correction",
};
const fileLimit = { files: 5, bytes: 8 * 1024 * 1024 };

export default async function InternalJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?:Promise<{saved?:string}> }) {
  const { id } = await params;
  const saved=(await searchParams)?.saved;
  const context = await getOpsRequestContext(["technician", "facilities", "regional"]);
  const { repository: r, session: s } = context;
  const org = s.organizationId;
  const work = await r.getWorkOrderDetail(await internalDispatchScope(r, s), id);
  if (!work) return <section>
    <h1>Job not available</h1>
    <p>This job is at a store you can&apos;t access, or it no longer exists.</p>
    <Link href="/app/my-work">Back to My work</Link>
  </section>;
  const [assignment, policy, files, store, results, inspection, hold] = await Promise.all([
    r.getActiveAssignment(org, id), r.getActiveWorkflowPolicy(org), r.listFilesForEntity(org, "work_order", id), r.getStore(org, work.storeId),
    r.listWorkResults(org, id), r.inspectionForWork(org, id), r.getWorkOrderVisitHold(org, id),
  ]);
  const mine = assignment?.kind === "internal" && assignment.internalMembershipId === s.membershipId;
  const manager = ["facilities", "regional"].includes(s.role);
  await dispatchIdentity(r, org, s.membershipId!, work.storeId, manager ? ["facilities_admin", "field_manager", "regional_manager"] : ["internal_technician"], false);

  const active = work.visits.find(visit => visit.status === "active");
  const terminal = ["draft", "awaiting_approval", "closed", "cancelled", "resolved", "completed_pending_review"].includes(work.status);
  const ownInspection = inspection?.workOrderId === id;
  const lookAndReport = hold?.posture === "look_and_report" && !["released", "cancelled", "completed"].includes(hold.status);
  const returnBlocked = results[0]?.followUpId && work.followUps.some(f => f.id === results[0].followUpId && f.status === "open");
  const independentFollowUps = work.followUps.filter(f => f.status === "open" && f.id !== results[0]?.followUpId);
  const resultBlocked = Boolean(returnBlocked || work.hasOpenFollowUp);
  const canReport = (mine || manager && assignment?.kind === "internal" && assignment.internalMembershipId) && !terminal && !ownInspection;
  const vendorNeeded = results[0]?.blocker === "vendor" || results[0]?.outcome === "quote_required";
  const canTake = !manager && !mine && assignment?.kind === "internal" && internalTarget(assignment) === "pool" && !terminal && !resultBlocked
    && !["waiting_on_parts", "waiting_on_vendor"].includes(work.status) && roleCan(s, "claim_internal_work");
  const canSchedule = (mine && !resultBlocked || manager && assignment?.kind === "internal") && !terminal && !ownInspection;

  const path = `/app/my-work/${encodeURIComponent(id)}`;
  const action = `/api/ops/work-orders/${encodeURIComponent(id)}/internal-result`;
  const version = () => <DispatchVersionFields row={work} returnTo={path}/>;
  // A manager recording a result passed on by phone says who did the work and how they heard.
  const managerSource = (problem = false) => manager ? <>
    <label>Who did the work?<input name="performerName" defaultValue={work.internalAssigneeName} required maxLength={200}/></label>
    <label>How did you hear?<select name="source" defaultValue="phone">
      <option value="phone">Phone call</option>
      <option value="email">Email</option>
      <option value="in_person">In person</option>
    </select></label>
    {policy?.internalCheckInRequired && !problem ? <label>Why wasn&apos;t there a check-in?<textarea name="exceptionReason" required maxLength={1000}/></label> : null}
  </> : null;

  // What the technician is waiting for after flagging a problem, in their words.
  const waitingFor = ({ parts: "to get the parts", help: "to arrange help", cannot_today: "to pick a new time", vendor: "to choose an outside vendor" } as Record<string, string>)[results[0]?.blocker ?? ""];
  const status = work.status === "waiting_on_parts" && !terminal ? "Waiting on parts"
    : active ? "Onsite now"
    : work.status === "in_progress" && !resultBlocked ? "Work started"
    : resultBlocked && !manager && waitingFor ? `Waiting on manager ${waitingFor}`
    : plainNextAction(work.nextAction);
  const urgent = ["urgent", "emergency"].includes(work.priority);
  const organization=await r.getOrganization(org), zone=store?.timeZone??organization!.timeZone;
  const recent=await TechnicianHistory({repository:r,scope:await internalDispatchScope(r,s),storeId:work.storeId,assetId:work.asset?.id,excludeId:id,limit:5,title:work.asset?"Recent work on this equipment":"Recent work at this store",zone});
  const backHref = manager ? "/app/dispatch" : "/app/my-work";
  const aiHelp = Boolean(getAiClient());

  return <div className={styles.workspace}>
    <header className={styles.jobHeader}>
      <Link href={backHref}>← {manager ? "Dispatch" : "My work"}</Link>
      <h1>
        {work.problem}
        {urgent ? <span className={`${styles.badge} ${styles.badgeUrgent}`}>{work.priority === "emergency" ? "Emergency" : "Urgent"}</span> : null}
      </h1>
      <p>Store {work.storeNumber} · {work.storeName}{store?.address1 ? ` · ${store.address1}` : ""}{store?.city ? `, ${store.city}` : ""}</p>
      <p className={styles.muted}>Work order {work.number}</p>
    </header>

    {saved?<p className={styles.notice} role="status">Saved. Job updated.</p>:null}
    <section className={styles.jobBody}>
      <dl className={styles.facts}>
        <div><dt>Status</dt><dd>{status}</dd></div>
        <div><dt>Who</dt><dd>{work.internalAssigneeName ?? "Any technician can take it"}</dd></div>
        <div><dt>Manager</dt><dd>{work.internalAccountableParty}</dd></div>
        {work.schedule ? <div><dt>When</dt><dd>{dispatchPlanLabel(work.schedule,organization!.timeZone)}</dd></div> : null}
        {work.dueAt && !(resultBlocked && !manager) ? <div><dt>Due</dt><dd>{dueLabel({dueAt:work.dueAt,storeZone:zone},civilDate(new Date().toISOString(),zone),organization!.timeZone)}</dd></div> : null}
        {work.targetCompletionAt && !(resultBlocked && !manager) ? <div><dt>Finish by</dt><dd>{dispatchTime(work.targetCompletionAt,zone,organization!.timeZone)}</dd></div> : null}
      </dl>
      {work.asset ? <p><strong>Equipment:</strong> {work.asset.name} · {work.asset.assetTag}{work.component ? ` · ${work.component.name}` : ""}</p> : null}
      {work.technicianNotes ? <p><strong>Notes for the tech:</strong> {work.technicianNotes}</p> : null}
      {(mine||manager)&&!terminal?<details><summary>Notes and time estimate</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/preparation`} className={styles.form}><input type="hidden" name="expectedVersion" value={work.version??0}/><JobPreparationFields allowConfirmation={manager} notes={work.technicianNotes} minutes={work.estimatedMinutes} confirmationDelay={work.confirmationDelay}/>{active?<label>Taking longer: about how many more minutes?<input type="number" name="remainingMinutes" min="1" max="1440"/></label>:null}<button type="submit">Save job details</button></RecordForm></details>:null}
      {work.authorizedScope ? <p><strong>What to do:</strong> {work.authorizedScope}</p> : null}
      {independentFollowUps.filter(f => plainNextAction(f.nextAction) !== status).map(f => <p key={f.id} className={styles.urgent}>
        Also needed: {plainNextAction(f.nextAction)} · {f.accountableParty} · {dueLabel({dueAt:f.dueAt,storeZone:zone},civilDate(new Date().toISOString(),zone),organization!.timeZone)}
      </p>)}
      {lookAndReport ? <p><strong>Look and report only.</strong> Write down what you find. Repairs need a manager&apos;s OK first.</p> : null}
      {files.length ? <div>
        <h2 className={styles.subHeading}>Photos and instructions</h2>
        <ul>{files.map(file => <li key={file.id}>
          <a href={`/api/ops/work-orders/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer">{file.originalName}</a>
        </li>)}</ul>
      </div> : null}
      {canSchedule ? <p>
        <Link className={`${styles.btn} ${styles.btnSecondary}`} href={`/app/dispatch/schedule/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(path)}`}>
          {work.schedule ? "Change date" : "Pick a date"}
        </Link>
      </p> : null}
    </section>

    {aiHelp && (mine || manager) && !terminal ? <AiDiagnoseChat workOrderId={id}/> : null}

    <section id="next-step" className={styles.jobBody}>
      <h2 className={styles.subHeading}>Next step</h2>
      {ownInspection ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/app/compliance/${encodeURIComponent(inspection.id)}`}>Open inspection checklist</Link> : null}
      {active ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/app/my-work/visits/${encodeURIComponent(active.id)}`}>Finish visit and record results</Link> : null}

      {resultBlocked && !manager ? <p className={styles.notice}>Waiting on your manager {waitingFor ?? `to ${plainNextAction(work.nextAction).toLowerCase()}`}. You&apos;ll get the job back when it&apos;s ready.</p> : null}
      {canReport ? <div className={styles.jobActions}>
        {!active && !resultBlocked && (!policy?.internalCheckInRequired || manager) ? <details id="record-result">
          <summary className={`${styles.btn} ${styles.btnPrimary}`}>{manager ? "Record a result" : "Record result"}</summary>
          <RecordForm action={action} offerSavedWork={false} attachmentLimit={fileLimit} className={styles.form}>
            {version()}{managerSource()}<InternalResultFields lookAndReport={lookAndReport} ai={aiHelp ? { workOrderId: id } : undefined}/>
            <button name="action" value="result" type="submit">Save result</button>
          </RecordForm>
        </details> : null}
        {!active && !resultBlocked && mine ? <details>
          <summary className={`${styles.btn} ${policy?.internalCheckInRequired ? styles.btnPrimary : styles.btnSecondary}`}>
            {policy?.internalCheckInRequired ? "Check in to start" : "Check in (optional)"}
          </summary>
          <RecordForm action="/api/ops/internal-visits" offerSavedWork={false} attachmentLimit={fileLimit} className={styles.form}>
            <input name="submissionKey" type="hidden" value={randomUUID()}/>
            <input name="storeId" type="hidden" value={work.storeId}/>
            <input name="workOrderId" type="hidden" value={work.id}/>
            <input name="expectedVersion" type="hidden" value={work.version ?? 0}/>
            <input name="expectedAssignmentId" type="hidden" value={assignment!.id}/>
            <p>Checking in records that you are at the store now.</p>
            <button type="submit" name="action" value="check_in">Check in now</button>
          </RecordForm>
        </details> : null}
        <details id="flag-problem">
          <summary className={`${styles.btn} ${styles.btnSecondary}`}>Flag a problem</summary>
          <RecordForm action={action} offerSavedWork={false} attachmentLimit={fileLimit} className={styles.form}>
            {version()}{managerSource(true)}<InternalResultFields problem ai={aiHelp ? { workOrderId: id } : undefined}/>
            <button name="action" value="problem" type="submit">Send to manager</button>
          </RecordForm>
        </details>
      </div> : null}

      {canTake ? <RecordForm action={`/api/ops/work-orders/${encodeURIComponent(id)}/internal-dispatch`} offerSavedWork={false} className={styles.form}>
        <DispatchVersionFields row={{ version: work.version, assignmentId: assignment!.id }} returnTo={path}/>
        <p>This is a team job. Take it to make it yours.</p>
        <button type="submit" name="action" value="claim">Take job</button>
      </RecordForm> : null}
      {!mine && !manager && !terminal && !canTake ? <p>This job belongs to someone else.</p> : null}


      {manager && !terminal && returnBlocked && !vendorNeeded ? <RecordForm action={action} offerSavedWork={false} attachmentLimit={fileLimit} className={styles.form}>
        {version()}
        <p><strong>{plainNextAction(work.nextAction)}.</strong> When it&apos;s sorted, send the job back to {work.internalAssigneeName ?? "the technician"}.</p>
        <label>What changed?<textarea name="notes" required maxLength={1000} placeholder="For example: parts arrived, or help is booked for Tuesday"/></label>
        <button type="submit" name="action" value="ready">Mark ready</button>
      </RecordForm> : null}
      {manager && !active && returnBlocked && vendorNeeded ? <RecordForm action={action} offerSavedWork={false} className={styles.form}>
        {version()}
        <p><strong>The technician says this needs an outside vendor.</strong></p>
        <InternalVendorHandoffFields storeId={work.storeId}/>
        <button type="submit" name="action" value="vendor">Send to this vendor</button>
      </RecordForm> : null}
      {terminal ? <p>{plainNextAction(work.nextAction)}.</p> : null}
    </section>

    {results.length ? <section className={styles.jobBody}>
      <h2 className={styles.subHeading}>What has been done</h2>
      <ul className={styles.historyList}>{results.slice(0, 20).map(result => <li key={result.id}>
        <strong>{internalWorkResultLabel(result.outcome)}</strong> · {result.performerName}
        {result.outcomeNotes ? <p>{result.outcomeNotes}</p> : null}
        <small>
          {dispatchTime(result.outcomeRecordedAt,zone,organization!.timeZone)} · {sourceLabels[result.source] ?? result.source.replaceAll("_", " ")}
          {result.outcomeRecordedByActorName !== result.performerName ? ` · Entered by ${result.outcomeRecordedByActorName}` : ""}
          {result.reportedPerformedAt ? ` · Work time given: ${dispatchTime(result.reportedPerformedAt,zone,organization!.timeZone)} (not verified)` : ""}
        </small>
      </li>)}</ul>
    </section> : null}

    <p><Link href={`/app/work-orders/${encodeURIComponent(id)}`}>Full work order record →</Link></p>
    {work.asset ? <EquipmentDocuments assetId={work.asset.id} compact /> : null}
    {recent}
  </div>;
}
