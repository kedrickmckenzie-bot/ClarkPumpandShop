import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { scheduleLabel } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { roleCan } from "@/components/ops/role-policy";
import styles from "./internal-dispatch.module.css";

export async function InternalPlanningPanel({workOrderId}:{workOrderId:string}) {
  const context=await getOpsRequestContext(["facilities","regional","technician","executive","store_manager","finance"]),work=await context.repository.getWorkOrderDetail(await internalDispatchScope(context.repository,context.session),workOrderId);
  if(!work||work.assignmentKind!=="internal")return null;
  return <section className={styles.panel}><h2>Internal plan</h2><p>Planned: {scheduleLabel(work.schedule)}</p><p>Target completion: {work.targetCompletionAt?formatOperationsDateTime(work.targetCompletionAt,work.schedule?.entryZone):"Not set"}</p><p>Next action due: {work.dueAt?formatOperationsDateTime(work.dueAt,work.schedule?.planningZone):"Needs review"}</p>{!work.inspectionId&&(context.session.role!=="technician"||work.internalMembershipId===context.session.membershipId)&&roleCan(context.session,"schedule_internal_work")&&!["closed","cancelled","resolved","completed_pending_review"].includes(work.status)?<Link href={"/app/dispatch/schedule/"+encodeURIComponent(workOrderId)+"?returnTo="+encodeURIComponent("/app/work-orders/"+workOrderId+"?view=service")}>{work.schedule?"Move schedule":"Schedule"} →</Link>:null}</section>;
}
