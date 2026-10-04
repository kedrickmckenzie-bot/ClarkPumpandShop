import { saveInternalSchedule, setInternalCompletionTarget } from "@/lib/ops/internal-scheduling";
import type { InternalTarget } from "@/lib/ops/internal-dispatch";
import { OpsDomainError } from "@/lib/ops/errors";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { plainScheduleLabel } from "@/lib/ops/dispatch-calendar";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const data=await request.formData(), action=formText(data,"action",{max:20})||"schedule";
    if(!["schedule","target"].includes(action))throw new OpsDomainError("VALIDATION","Choose a planning action.");
    const context=await getOpsRequestContext(action==="target"?["facilities","regional"]:["facilities","regional","technician"],action==="target"?"manage_internal_target":"schedule_internal_work",request);
    const {id}=await params,work=await context.repository.getWorkOrder(context.session.organizationId,id);
    if(!work)throw new OpsDomainError("NOT_FOUND","Job not found.");
    await assertStoreInSessionScope(context.session,work.storeId);
    const text=(name:string,max=120)=>formText(data,name,{max}), base={organizationId:context.session.organizationId,workOrderId:id,actor:context.actor,expectedVersion:Number(formText(data,"expectedVersion",{required:true,max:16})),key:formText(data,"submissionKey",{required:true,max:120})};
    const disambiguation=text("disambiguation") as "earlier"|"later"|undefined;
    if(action==="target")await setInternalCompletionTarget({repository:context.repository},{...base,localTarget:text("localTarget")||undefined,disambiguation:disambiguation||undefined,reason:formText(data,"reason",{required:true,max:1000})});
    const saved=action==="target"?undefined:await saveInternalSchedule({repository:context.repository},{...base,expectedAssignmentId:formText(data,"expectedAssignmentId",{required:true,max:120}),expectedScheduleId:text("expectedScheduleId")||null,precision:formText(data,"precision",{required:true,max:20}) as "week"|"day"|"appointment"|"removed",date:text("date")||undefined,localStart:text("localStart")||undefined,disambiguation:disambiguation||undefined,durationMinutes:text("durationMinutes")?Number(text("durationMinutes")):undefined,tentative:text("tentative")==="yes",reviewReason:[text("reviewReason",1000),text("reason",1000)].filter(Boolean).join("; ")||undefined,keepConflicts:text("keepConflicts")==="yes",target:text("internalTarget") as InternalTarget||undefined,membershipId:text("internalMembershipId")||undefined,managerId:text("managerId")||undefined});
    const returnTo=text("returnTo",1500);
    if(request.headers.get("accept")?.includes("application/json"))return Response.json({saved:true,number:work.number,when:saved?saved.schedule.precision==="removed"?"no date":plainScheduleLabel(saved.schedule,saved.schedule.planningZone):undefined,week:saved?.schedule.week});
    const valid=returnTo==="/app/dispatch"||returnTo.startsWith("/app/dispatch?")||returnTo==="/app/my-work"||returnTo.startsWith("/app/my-work?")||returnTo===`/app/my-work/${encodeURIComponent(id)}`||returnTo.startsWith(`/app/work-orders/${encodeURIComponent(id)}?`);
    if(!valid)return relativeRedirect303(`/app/dispatch/schedule/${encodeURIComponent(id)}?saved=1`);
    // Lists show a short "Saved" note and open on the week that now holds the job.
    const [path,search=""]=returnTo.split("?"),next=new URLSearchParams(search);
    if(saved&&(path==="/app/dispatch"||path==="/app/my-work")){
      next.set("saved",work.number);
      next.set("savedWhen",saved.schedule.precision==="removed"?"no date":plainScheduleLabel(saved.schedule,saved.schedule.planningZone));
      if(path==="/app/dispatch"&&saved.schedule.precision!=="removed")next.set("week",saved.schedule.week);
    }
    return relativeRedirect303(next.size?`${path}?${next}`:path);
  }catch(error){return opsApiError(error);}
}
