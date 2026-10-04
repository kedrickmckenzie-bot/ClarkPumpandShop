import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { OpsDomainError } from "@/lib/ops/errors";
import { dispatchJob } from "@/lib/ops/dispatch-board";
import { plainNextAction } from "@/lib/ops/dispatch-calendar";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "executive"], undefined, request);
    const scope = await internalDispatchScope(context.repository, context.session);
    const { id } = await params;
    const work = await context.repository.getWorkOrderDetail(scope, id);
    if (!work || work.assignmentKind !== "internal") throw new OpsDomainError("NOT_FOUND", "You don't have access to this store, or this job is no longer available.");
    const [store, results, schedules] = await Promise.all([context.repository.getStore(scope.organizationId, work.storeId), context.repository.listWorkResults(scope.organizationId, id), context.repository.listInternalSchedules(scope.organizationId, id)]);
    const job=dispatchJob(work,store?.timeZone,store?.regionId);
    const plan=schedules.find(p=>p.id===job.schedule?.id);
    if(job.schedule&&plan)job.schedule={...job.schedule,reviewReason:plan.reviewReason,localStart:plan.localStart,disambiguation:plan.disambiguation};
    return Response.json({ job, instructions: work.authorizedScope,
      nextAction: plainNextAction(work.nextAction),
      canReady: Boolean(results[0]?.followUpId && work.followUps.some(item => item.id === results[0].followUpId && item.status === "open")),
      activeVisit: work.visits.some(visit => visit.status === "active"),
      history: [...schedules.map(plan => ({at:plan.recordedAt,name:plan.recordedByName,notes:plan.reviewReason,label:plan.precision === "removed" ? "Date removed" : "Date saved"})), ...results.slice(0, 5).map(result => ({ at: result.outcomeRecordedAt, name: result.outcomeRecordedByActorName, notes: result.outcomeNotes,
        label: result.blocker === "parts" ? "Needs parts" : result.outcome === "completed" ? "Reported done" : "Reported a problem" }))].sort((a,b) => b.at.localeCompare(a.at)).slice(0,5) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
