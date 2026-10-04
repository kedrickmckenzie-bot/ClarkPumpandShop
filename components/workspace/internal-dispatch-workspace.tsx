import Link from "next/link";
import { scheduleLabel } from "@/lib/ops/dispatch-calendar";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { roleCan } from "@/components/ops/role-policy";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { WorkOrderListPage, WorkOrderListRow } from "@/lib/ops/view-models";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { InternalAssignmentFields } from "./internal-assignment-fields";
import styles from "./internal-dispatch.module.css";

export function DispatchVersionFields({ row, returnTo }: { row: Pick<WorkOrderListRow, "version" | "assignmentId">; returnTo: string }) {
  return <><input type="hidden" name="expectedVersion" value={row.version ?? 0}/><input type="hidden" name="expectedAssignmentId" value={row.assignmentId ?? ""}/><input type="hidden" name="submissionKey" value={randomUUID()}/><input type="hidden" name="returnTo" value={returnTo}/></>;
}
export function InternalDispatchWorkspace({ session, page, view, search, technician, storeId, nextHref, heldPage, heldNextHref, compact, contextQuery, heading }: {
  heading?: string; compact?: boolean; contextQuery?: string;
  session: OperatorSession; page: WorkOrderListPage; view: string; search: string; technician: boolean; storeId?: string; nextHref?: string; heldPage?: WorkOrderListPage; heldNextHref?: string;
}) {
  const base = technician ? "/app/my-work" : "/app/dispatch";
  const query = (nextView: string) => { const q = new URLSearchParams(contextQuery); q.set("view",nextView); if (search) q.set("q", search); if (storeId) q.set("store", storeId); return `${base}?${q}`; };
  const tabs = technician ? [["mine", "My jobs"], ["pool", "Available team work"]] : [["all", "All internal work"], ["awaiting_allocation", "To arrange"], ["pool", "Available to team"], ["person", "Assigned"]];
  return <div className={styles.workspace}>
    {!compact ? <><header className={styles.header}><div><h1>{technician ? "My work" : "Dispatch"}</h1><p>{technician ? "Your assigned jobs and work you can take." : "Assign internal work and see who handles it."}</p></div><Link href={technician ? "/app/work-orders?assignee=me&status=open" : "/app/work-orders?status=open"}>Open work-order list →</Link></header>
    <nav className={styles.tabs} aria-label="Internal work views">{tabs.map(([key, label]) => <Link key={key} href={query(key)} aria-current={view === key ? "page" : undefined}>{label}</Link>)}</nav>
    <form className={styles.search} method="get"><input type="hidden" name="view" value={view}/>{storeId ? <input type="hidden" name="store" value={storeId}/> : null}<label>Search work<input type="search" name="q" defaultValue={search} placeholder="Problem, work order or store address" maxLength={120}/></label><button type="submit">Search</button>{search || storeId ? <Link href={`${base}?view=${view}`}>Clear filters</Link> : null}</form>
    </> : null}
    {storeId ? <p className={styles.muted}>Filtered to one store · <Link href={`/app/stores/${encodeURIComponent(storeId)}`}>Open store</Link></p> : <p className={styles.muted}>{session.companywide ? "All your stores" : "Your permitted stores"}</p>}
    {technician ? <p><Link href="/app/my-work/check-in">No work order provided / I don&apos;t see my work order</Link></p> : null}
    {[{page,title:heading??(technician?"Work needing attention":"Internal jobs"),next:nextHref},...(heldPage?[{page:heldPage,title:"For a suitable visit",next:heldNextHref}]:[])].map(group=><section key={group.title} className={styles.surface} aria-label={group.title}><h2>{group.title}{group.page.totalCount !== undefined ? ` (${group.page.totalCount})` : ""}</h2>
      {group.page.items.length ? <table className={styles.table}><thead><tr><th>Job / store</th><th>Who handles it?</th><th>Next action</th><th>Action</th></tr></thead><tbody>{group.page.items.map(row => {
        const mine = row.internalMembershipId === session.membershipId;
        const ready = !row.inspectionId && !row.hasOpenFollowUp && !["draft", "awaiting_approval", "in_progress", "waiting_on_parts", "waiting_on_vendor", "completed_pending_review", "resolved", "closed", "cancelled"].includes(row.status);
        return <tr key={row.id}>
          <td><Link href={technician && !row.inspectionId ? `/app/my-work/${encodeURIComponent(row.id)}` : `/app/work-orders/${encodeURIComponent(row.id)}`}>{row.number}</Link><strong>{row.problem}</strong><span>Store {row.storeNumber} · {row.storeName}</span><span className={["urgent", "emergency"].includes(row.priority) ? styles.urgent : styles.muted}>{row.priority === "emergency" ? "Emergency" : row.priority === "urgent" ? "Urgent" : row.priority === "planned" ? "Planned" : "Routine"}{row.visitHoldPosture ? " · Next visit is fine" : ""}</span></td>
          <td data-label="Who handles it?"><strong>{row.internalAssigneeName ? `Assigned to ${row.internalAssigneeName}` : row.internalTarget === "pool" ? "Needs a technician" : "Manager to arrange"}</strong><span className={styles.muted}>Manager: {row.internalAccountableParty}</span></td>
          <td data-label="Next action"><strong>{scheduleLabel(row.schedule)}</strong><span>Target completion: {row.targetCompletionAt?formatOperationsDateTime(row.targetCompletionAt,row.schedule?.planningZone):"Not set"}</span><strong>{ready && !row.visitHoldPosture ? row.internalTarget === "person" ? "Ready to work" : row.internalTarget === "pool" ? "Needs a technician" : row.nextAction : row.nextAction}</strong>{row.accountableParty !== row.internalAssigneeName && row.accountableParty !== row.internalAccountableParty ? <span>{row.accountableParty}</span> : null}{row.visitHoldDeadlineAt ? <span className={styles.muted}>Review by {formatOperationsDateTime(row.visitHoldDeadlineAt)}</span> : null}<span className={styles.muted}>Next action due: {row.dueAt ? formatOperationsDateTime(row.dueAt) : "Needs review"}</span></td>
          <td data-label="Action">
            {!row.inspectionId&&(!technician||mine)&&roleCan(session,"schedule_internal_work")&&!["completed_pending_review","resolved","closed","cancelled"].includes(row.status)?<Link href={"/app/dispatch/schedule/"+encodeURIComponent(row.id)+"?returnTo="+encodeURIComponent(query(view))+"&day="+encodeURIComponent(new URLSearchParams(contextQuery).get("week")??"")}>{row.schedule?"Move schedule":"Schedule"}</Link>:null}
            {row.inspectionId ? <Link href={`/app/compliance/${encodeURIComponent(row.inspectionId)}`}>Open inspection →</Link> : null}
            {technician && view === "pool" && ready && roleCan(session, "claim_internal_work") ? <RecordForm action={`/api/ops/work-orders/${encodeURIComponent(row.id)}/internal-dispatch`} offerSavedWork={false} className={styles.form}><DispatchVersionFields row={row} returnTo={query(view)}/><button type="submit" name="action" value="claim">Take job</button></RecordForm> : null}
            {technician && mine && ready && roleCan(session, "return_internal_work") ? <details><summary>Return to team</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(row.id)}/internal-dispatch`} offerSavedWork={false} className={styles.form}><DispatchVersionFields row={row} returnTo={query(view)}/>{row.schedule?<p>Returning removes the schedule. The job becomes available to the team.</p>:null}<label>Reason (optional)<textarea name="reason" rows={2} maxLength={1000}/></label><button type="submit" name="action" value="return">Return to team</button></RecordForm></details> : null}
            {!technician && ready && roleCan(session, "assign_internal_work") ? <details><summary>{row.internalTarget === "person" ? "Reassign" : "Assign"}</summary>{row.schedule?<p>Reassigning removes this schedule. Use Move schedule to change the person and date together.</p>:null}<RecordForm action={`/api/ops/work-orders/${encodeURIComponent(row.id)}/internal-dispatch`} offerSavedWork={false} className={styles.form}><DispatchVersionFields row={row} returnTo={query(view)}/><InternalAssignmentFields storeId={row.storeId} defaultTarget={row.internalTarget ?? "pool"} defaultManager={row.internalAccountableId && row.internalAccountableId !== "facilities-coordination" ? {id:row.internalAccountableId,name:row.internalAccountableParty}:undefined} defaultPerson={row.internalMembershipId && row.internalAssigneeName ? { id: row.internalMembershipId, name: row.internalAssigneeName } : undefined}/><button type="submit" name="action" value="assign">Assign</button></RecordForm></details> : null}
            <Link href={technician && !row.inspectionId ? `/app/my-work/${encodeURIComponent(row.id)}` : `/app/work-orders/${encodeURIComponent(row.id)}?view=service#internal-assignment`}>Open job →</Link>
          </td>
        </tr>;
      })}</tbody></table> : <p className={styles.empty}>{group.title === "For a suitable visit" ? "No next-visit work in this view." : search ? "No jobs match this search." : technician && view === "mine" ? "No assigned jobs. Check Available team work for jobs you can take." : view === "pool" ? "No available team jobs at your permitted stores." : "No internal jobs in this view."} <Link href={query(technician ? "pool" : "all")}>{technician ? "Available team work" : "All internal work"} →</Link></p>}
    {group.next ? <Link href={group.next}>More {group.title.toLowerCase()} →</Link> : null}</section>)}
  </div>;
}
