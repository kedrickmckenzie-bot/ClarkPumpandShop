import { civilDate } from "@/lib/ops/dispatch-calendar";
import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { dispatchPlanLabel, dispatchTime, dueLabel, canPlanJob, dispatchJob } from "@/lib/ops/dispatch-board";
import { roleCan } from "@/components/ops/role-policy";
import styles from "./internal-dispatch.module.css";

export async function InternalPlanningPanel({workOrderId}:{workOrderId:string}) {
  const context=await getOpsRequestContext(["facilities","regional","technician","executive","store_manager","finance"]),work=await context.repository.getWorkOrderDetail(await internalDispatchScope(context.repository,context.session),workOrderId);
  if(!work||work.assignmentKind!=="internal")return null;
  const [organization,store]=await Promise.all([context.repository.getOrganization(context.session.organizationId),context.repository.getStore(context.session.organizationId,work.storeId)]);
  const zone=organization!.timeZone,storeZone=store?.timeZone??zone;
  const editable=canPlanJob(dispatchJob(work))&&!work.visits.some(visit=>visit.status==="active")&&(context.session.role!=="technician"||work.internalMembershipId===context.session.membershipId)&&roleCan(context.session,"schedule_internal_work");
  return <section className={styles.panel}><h2>Date</h2><dl className={styles.facts}>{work.schedule?<div><dt>When</dt><dd>{dispatchPlanLabel(work.schedule,zone)}</dd></div>:null}{work.dueAt?<div><dt>Due</dt><dd>{dueLabel({dueAt:work.dueAt,storeZone},civilDate(new Date().toISOString(),storeZone),zone)}</dd></div>:null}{work.targetCompletionAt?<div><dt>Finish by</dt><dd>{dispatchTime(work.targetCompletionAt,storeZone,zone)}</dd></div>:null}</dl>{editable?<Link className={`${styles.btn} ${styles.btnSecondary}`} href={"/app/dispatch/schedule/"+encodeURIComponent(workOrderId)+"?returnTo="+encodeURIComponent("/app/work-orders/"+workOrderId+"?view=service")}>{work.schedule?"Change date":"Pick a date"}</Link>:null}</section>;
}
