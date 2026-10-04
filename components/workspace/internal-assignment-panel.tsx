import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { internalTarget } from "@/lib/ops/internal-dispatch";
import { RecordForm } from "@/components/ops/record-form";
import { roleCan } from "@/components/ops/role-policy";
import { DispatchVersionFields } from "./internal-dispatch-workspace";
import { InternalAssignmentFields } from "./internal-assignment-fields";
import styles from "./internal-dispatch.module.css";

export async function InternalAssignmentPanel({ workOrderId }: { workOrderId: string }) {
  let context;
  try { context = await getOpsRequestContext(["facilities", "regional", "technician", "executive"]); } catch { return null; }
  const scope = await internalDispatchScope(context.repository, context.session);
  const [work, detail] = await Promise.all([context.repository.getWorkOrder(scope.organizationId, workOrderId), context.repository.getWorkOrderDetail(scope, workOrderId)]);
  if (!work || !scope.storeIds?.includes(work.storeId) || ["resolved", "closed", "cancelled"].includes(work.status)) return null;
  const store = await context.repository.getStore(scope.organizationId, work.storeId);
  if (scope.regionIds && (!store?.regionId || !scope.regionIds.includes(store.regionId))) return null;
  const assignment = await context.repository.getActiveAssignment(scope.organizationId, work.id);
  const target = assignment ? internalTarget(assignment) : undefined;
  const person = assignment?.internalMembershipId ? await context.repository.getMembership(scope.organizationId, assignment.internalMembershipId) : null;
  const user = person ? await context.repository.getUserInOrganization(scope.organizationId, person.userId) : null;
  const row = { version: work.version, assignmentId: assignment?.id };
  const hold = await context.repository.getWorkOrderVisitHold(context.session.organizationId, work.id);
  const inspection = await context.repository.inspectionForWork(scope.organizationId, work.id);
  const inspectionId = inspection?.workOrderId === work.id ? inspection.id : undefined;
  const mine = assignment?.kind === "internal" && assignment.internalMembershipId === context.session.membershipId;
  const activeVisit = detail?.visits.some(visit => visit.status === "active");
  const blocked = detail?.followUps.some(followUp => followUp.status === "open");
  const ready = !inspectionId && !activeVisit && !blocked && !["awaiting_approval", "draft", "completed_pending_review", "waiting_on_parts", "waiting_on_vendor"].includes(work.status);
  const action = roleCan(context.session, "assign_internal_work") ? "assign" : roleCan(context.session, "claim_internal_work") && target === "pool" && !["waiting_on_parts", "waiting_on_vendor"].includes(work.status) ? "claim" : roleCan(context.session, "return_internal_work") && mine ? "return" : null;
  const label = action === "assign" ? "Assign" : action === "claim" ? "Take job" : "Return to team";
  return <section id="internal-assignment" className={`${styles.workspace} ${styles.panel}`}><h2>Internal assignment</h2>
    {assignment?.kind === "internal" ? <dl className={styles.facts}><div><dt>Assigned to</dt><dd>{user?.displayName ?? (target === "pool" ? "Available to the team" : "Manager to arrange")}</dd></div><div><dt>Responsible manager / team</dt><dd>{work.internalAccountableParty ?? "Facilities coordination"}</dd></div></dl> : <p>Choose internal maintenance here to give this job to your team.</p>}
    {activeVisit ? <p>A visit is active. Finish the visit or ask the responsible manager for help before changing the assignment.</p> : blocked ? <p><Link href={`/app/my-work/${encodeURIComponent(work.id)}`}>Review the result and arrange the next step →</Link></p> : null}
    {inspectionId ? <p>Manage this assignment in the <Link href={`/app/compliance/${encodeURIComponent(inspectionId)}`}>inspection record</Link>.</p> : ["waiting_on_parts", "waiting_on_vendor"].includes(work.status) ? <p>Review the parts or vendor follow-up before changing this assignment.</p> : null}
    {work.internalScheduleId && action && action !== "claim" ? <p>Returning or reassigning removes the current schedule. Use Schedule to change the person and date together.</p> : null}
    {ready && action ? <details open={assignment?.kind === "internal"}><summary>{label}</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(work.id)}/internal-dispatch`} className={styles.form} offerSavedWork={false}><DispatchVersionFields row={row} returnTo=""/>{action === "assign" ? <InternalAssignmentFields storeId={work.storeId} defaultTarget={target ?? "pool"} defaultManager={work.internalAccountableType === "membership" && work.internalAccountableId ? {id:work.internalAccountableId,name:work.internalAccountableParty ?? "Responsible manager"}:undefined} defaultPerson={user && person ? { id: person.id, name: user.displayName } : undefined}/> : action === "return" ? <label>Reason (optional)<textarea name="reason" rows={2} maxLength={1000}/></label> : null}<button type="submit" name="action" value={action}>{label}</button></RecordForm></details> : null}
    {hold && ["active", "review_required"].includes(hold.status) && roleCan(context.session, "assign_internal_work") ? <details><summary>Not needed</summary><RecordForm action={`/api/ops/work-orders/${encodeURIComponent(work.id)}/control`} className={styles.form} offerSavedWork={false}><input type="hidden" name="operation" value="update"/><input type="hidden" name="expectedStatus" value={work.status}/><input type="hidden" name="expectedVersion" value={work.version ?? 0}/><input type="hidden" name="status" value="cancelled"/><input type="hidden" name="priority" value={work.priority}/><label>Reason<textarea name="note" rows={2} maxLength={1000} required/></label><button type="submit">Cancel as not needed</button></RecordForm></details> : null}
  </section>;
}
