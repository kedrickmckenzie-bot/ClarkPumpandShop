import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { plainScheduleLabel } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { roleCan } from "@/components/ops/role-policy";
import styles from "./internal-dispatch.module.css";

export async function InternalPlanningPanel({workOrderId}:{workOrderId:string}) {
  const context=await getOpsRequestContext(["facilities","regional","technician","executive","store_manager","finance"]),work=await context.repository.getWorkOrderDetail(await internalDispatchScope(context.repository,context.session),workOrderId);
  if(!work||work.assignmentKind!=="internal")return null;
  return <section className={styles.panel}><h2>Date</h2><dl className={styles.facts}><div><dt>When</dt><dd>{plainScheduleLabel(work.schedule)}</dd></div>{work.dueAt?<div><dt>Due</dt><dd>{formatOperationsDateTime(work.dueAt,work.schedule?.planningZone)}</dd></div>:null}{work.targetCompletionAt?<div><dt>Finish by</dt><dd>{formatOperationsDateTime(work.targetCompletionAt,work.schedule?.entryZone)}</dd></div>:null}</dl>{!work.inspectionId&&(context.session.role!=="technician"||work.internalMembershipId===context.session.membershipId)&&roleCan(context.session,"schedule_internal_work")&&!["closed","cancelled","resolved","completed_pending_review"].includes(work.status)?<Link className={`${styles.btn} ${styles.btnSecondary}`} href={"/app/dispatch/schedule/"+encodeURIComponent(workOrderId)+"?returnTo="+encodeURIComponent("/app/work-orders/"+workOrderId+"?view=service")}>{work.schedule?"Change date":"Pick a date"}</Link>:null}</section>;
}
