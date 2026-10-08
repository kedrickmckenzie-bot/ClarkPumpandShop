import { OpsDomainError } from "@/lib/ops/errors";
import { changeReportSchedule, runReportScheduleNow } from "@/lib/ops/reports/schedules";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const DONE = { pause: "schedule-paused", resume: "schedule-resumed", remove: "schedule-removed", send_now: "schedule-sent" } as const;

/** Pause, turn on, remove or send a schedule now. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session, repository, actor } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"], undefined, request);
    const form = await request.formData();
    const action = formText(form, "action", { required: true, max: 20 });
    if (!(action in DONE)) throw new OpsDomainError("VALIDATION", "Choose an action.");
    if (action === "send_now") await runReportScheduleNow({ repository }, { organizationId: session.organizationId, actor, scheduleId: id, role: session.role });
    else await changeReportSchedule({ repository }, { organizationId: session.organizationId, actor, scheduleId: id, role: session.role, action: action as "pause" | "resume" | "remove", expectedVersion: Number(formText(form, "version", { max: 10 })) });
    return relativeRedirect303(`/app/reports?saved=${DONE[action as keyof typeof DONE]}#report-schedules`);
  } catch (error) {
    return opsApiError(error);
  }
}
