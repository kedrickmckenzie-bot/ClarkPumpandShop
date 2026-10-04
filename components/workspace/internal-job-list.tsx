import { dispatchPlanLabel, dispatchTime, dueLabel } from "@/lib/ops/dispatch-board";
import Link from "next/link";
import { RecordForm } from "@/components/ops/record-form";
import { roleCan } from "@/components/ops/role-policy";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { WorkOrderListPage, WorkOrderListRow } from "@/lib/ops/view-models";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { civilDate, plainNextAction } from "@/lib/ops/dispatch-calendar";
import { DispatchVersionFields } from "./internal-dispatch-fields";
import { InternalAssignmentFields } from "./internal-assignment-fields";
import styles from "./internal-dispatch.module.css";

const finished = ["completed_pending_review", "resolved", "closed", "cancelled"];
// Only these roles can open the focused job page; owners and read-only roles use the full work order.
const jobPageRoles = ["technician", "facilities", "regional"];
const notStartable = ["draft", "awaiting_approval", "in_progress", "waiting_on_parts", "waiting_on_vendor", ...finished];

/** One short status a technician or manager can act on. */
export function jobStatus(row: WorkOrderListRow) {
  if (row.status === "waiting_on_parts") return { text: "Waiting on parts", tone: "wait" as const };
  if (row.status === "waiting_on_vendor") return { text: "Waiting on vendor", tone: "wait" as const };
  if (["completed_pending_review", "resolved"].includes(row.status)) return { text: row.nextAction ? plainNextAction(row.nextAction) : "Check the work", tone: "done" as const };
  if (row.hasOpenFollowUp) return { text: plainNextAction(row.nextAction), tone: "wait" as const };
  if (row.visitHoldPosture) return { text: "Do on next visit", tone: "calm" as const };
  if (row.inspectionId) return { text: plainNextAction(row.nextAction), tone: "calm" as const };
  // Started work is not "ready": a check-in moved it on. "Onsite" needs live visit evidence, which a list row doesn't carry.
  if (row.status === "in_progress") return { text: "Work started", tone: "active" as const };
  if (row.internalTarget === "pool") return { text: "Needs a technician", tone: "calm" as const };
  if (row.internalTarget === "awaiting_allocation") return { text: "Manager to assign", tone: "calm" as const };
  return { text: "Ready to work", tone: "calm" as const };
}

function whoLabel(row: WorkOrderListRow) {
  if (row.internalAssigneeName) return row.internalAssigneeName;
  if (row.internalTarget === "pool") return "Any technician can take it";
  return `${row.internalAccountableParty} will assign it`;
}

function needsManagerReview(row: WorkOrderListRow) {
  return Boolean(row.internalMembershipId) && !row.inspectionId && (row.hasOpenFollowUp || row.status === "waiting_on_parts");
}

export function InternalJobRow({ row, session, technician, returnTo, week, showWho = true, organizationZone="America/New_York", storeZones={} }: {
  row: WorkOrderListRow; session: OperatorSession; technician: boolean; returnTo: string; week?: string; showWho?: boolean; organizationZone?:string; storeZones?:Record<string,string>;
}) {
  const storeZone=storeZones[row.storeId]??organizationZone;
  const mine = row.internalMembershipId === session.membershipId;
  const ready = !row.inspectionId && !row.hasOpenFollowUp && !notStartable.includes(row.status);
  const status = jobStatus(row);
  const jobPage = jobPageRoles.includes(session.role);
  const jobHref = row.inspectionId
    ? `/app/compliance/${encodeURIComponent(row.inspectionId)}`
    : jobPage ? `/app/my-work/${encodeURIComponent(row.id)}` : `/app/work-orders/${encodeURIComponent(row.id)}?view=service`;
  const dispatchAction = `/api/ops/work-orders/${encodeURIComponent(row.id)}/internal-dispatch`;
  const canSchedule = !row.inspectionId && (!technician || mine) && roleCan(session, "schedule_internal_work") && !finished.includes(row.status) && row.status !== "in_progress" && !(technician && row.hasOpenFollowUp);
  const scheduleHref = `/app/dispatch/schedule/${encodeURIComponent(row.id)}?returnTo=${encodeURIComponent(returnTo)}${week ? `&day=${encodeURIComponent(week)}` : ""}`;
  const canTake = technician && !mine && row.internalTarget === "pool" && ready && roleCan(session, "claim_internal_work");
  const canReturn = technician && mine && ready && roleCan(session, "return_internal_work");
  const canAssign = !technician && ready && roleCan(session, "assign_internal_work");
  const urgent = ["urgent", "emergency"].includes(row.priority);
  const toneClass = { wait: styles.badgeWait, done: styles.badgeDone, calm: styles.badgeCalm, active: styles.badgeActive }[status.tone];

  return <li className={styles.jobRow}>
    <div className={styles.jobMain}>
      <p className={styles.jobTitle}>
        {row.problem}
        {urgent ? <span className={`${styles.badge} ${styles.badgeUrgent}`}>{row.priority === "emergency" ? "Emergency" : "Urgent"}</span> : null}
      </p>
      <p className={styles.jobMeta}>Store {row.storeNumber} · {row.storeName} · <Link href={jobHref}>{row.number}</Link></p>
      <div className={styles.jobFacts}>
        <span><span className={`${styles.badge} ${toneClass}`} style={{ marginLeft: 0 }}>{status.text}</span></span>
        {showWho && !(technician && mine) ? <span>Who: <strong>{whoLabel(row)}</strong></span> : null}
        {row.schedule ? <span>When: <strong>{dispatchPlanLabel(row.schedule,organizationZone)}</strong></span> : null}
        {row.dueAt && !(technician && row.hasOpenFollowUp) ? <span><strong>{dueLabel({dueAt:row.dueAt,storeZone},civilDate(new Date().toISOString(),storeZone),organizationZone)}</strong></span> : null}
        {row.targetCompletionAt && !(technician && row.hasOpenFollowUp) ? <span>Finish by: <strong>{dispatchTime(row.targetCompletionAt,storeZone,organizationZone)}</strong></span> : null}
      </div>
      {!technician && row.internalAssigneeName ? <p className={styles.jobMeta}>Manager: {row.internalAccountableParty}</p> : null}
    </div>
    <div className={styles.rowActions}>
      {canTake ? <RecordForm action={dispatchAction} offerSavedWork={false}>
        <DispatchVersionFields row={row} returnTo={returnTo}/>
        <button type="submit" name="action" value="claim">Take job</button>
      </RecordForm> : null}
      {technician && mine && !row.inspectionId ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={jobHref}>Open job</Link> : null}
      {!technician && jobPage && needsManagerReview(row) ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`${jobHref}#next-step`}>{row.status === "waiting_on_parts" ? "Mark ready" : "Decide next step"}</Link> : null}
      {canSchedule ? <Link className={`${styles.btn} ${row.schedule || technician || needsManagerReview(row) ? styles.btnSecondary : styles.btnPrimary}`} href={scheduleHref}>{row.schedule ? "Change date" : "Schedule"}</Link> : null}
      {canAssign ? <details>
        <summary className={`${styles.btn} ${styles.btnSecondary}`}>{row.internalTarget === "person" ? "Reassign" : "Assign"}</summary>
        <RecordForm action={dispatchAction} offerSavedWork={false} className={styles.form}>
          <DispatchVersionFields row={row} returnTo={returnTo}/>
          {row.schedule ? <p>Changing who does this job removes its date. Use Change date to pick a person and date together.</p> : null}
          <InternalAssignmentFields storeId={row.storeId} defaultTarget={row.internalTarget ?? "pool"}
            defaultManager={row.internalAccountableId && row.internalAccountableId !== "facilities-coordination" ? { id: row.internalAccountableId, name: row.internalAccountableParty } : undefined}
            defaultPerson={row.internalMembershipId && row.internalAssigneeName ? { id: row.internalMembershipId, name: row.internalAssigneeName } : undefined}/>
          <label>Why change who handles this?<textarea name="reason" required rows={2} maxLength={1000}/></label>
          <button type="submit" name="action" value="assign">Save</button>
        </RecordForm>
      </details> : null}
      {canReturn ? <details>
        <summary className={`${styles.btn} ${styles.btnSecondary}`}>Give back to team</summary>
        <RecordForm action={dispatchAction} offerSavedWork={false} className={styles.form}>
          <DispatchVersionFields row={row} returnTo={returnTo}/>
          <p>Another technician can take it.{row.schedule ? " Its date is removed." : ""}</p>
          <label>Why?<textarea name="reason" required rows={2} maxLength={1000}/></label>
          <button type="submit" name="action" value="return">Give back to team</button>
        </RecordForm>
      </details> : null}
      {!(technician && mine && !row.inspectionId) && !(!technician && jobPage && needsManagerReview(row))
        ? <Link className={`${styles.btn} ${styles.btnSecondary}`} href={jobHref}>{row.inspectionId ? "Open inspection" : "Open job"}</Link>
        : null}
    </div>
  </li>;
}

/** A titled list of jobs with an empty message and a link to the next page. */
export function InternalJobSection({ title, hint, page, session, technician, returnTo, week, empty, nextHref, groupByDay = false, organizationZone, storeZones }: {
  title: string; hint?: string; page: WorkOrderListPage; session: OperatorSession; technician: boolean; returnTo: string; week?: string;
  empty?: React.ReactNode; nextHref?: string; groupByDay?: boolean; organizationZone?:string; storeZones?:Record<string,string>;
}) {
  const count = page.totalCount ?? page.items.length;
  const groups = new Map<string, WorkOrderListRow[]>();
  if (groupByDay) {
    const sorted = [...page.items].sort((a, b) =>
      (a.schedule?.day ?? a.schedule?.week ?? "").localeCompare(b.schedule?.day ?? b.schedule?.week ?? "")
      || (a.schedule?.startsAt ?? "").localeCompare(b.schedule?.startsAt ?? "")
      || a.id.localeCompare(b.id));
    for (const row of sorted) {
      const key = row.schedule?.precision === "week" || !row.schedule?.day ? "Sometime this week" : formatOperationsDate(row.schedule.day);
      groups.set(key, [...groups.get(key) ?? [], row]);
    }
  } else groups.set("", page.items);

  return <section className={styles.surface} aria-label={title}>
    <div className={styles.sectionHead}><h2>{title} ({count})</h2>{hint ? <p>{hint}</p> : null}</div>
    {!page.items.length ? <p className={styles.emptyNote}>{empty ?? "Nothing here right now."}</p> : null}
    {[...groups].map(([day, rows]) => <div key={day || "all"}>
      {day ? <h3 className={styles.dayHeading}>{day}</h3> : null}
      <ul className={styles.jobList}>{rows.map(row => <InternalJobRow key={row.id} row={row} session={session} technician={technician} returnTo={returnTo} week={week} organizationZone={organizationZone} storeZones={storeZones}/>)}</ul>
    </div>)}
    {nextHref ? <p className={styles.muted}>Showing {page.items.length} of {count} · <Link className={styles.moreLink} href={nextHref}>Show more</Link></p> : null}
  </section>;
}
