import { sessionHasNoStores } from "@/components/ops/role-policy";
import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { OpsDomainError } from "@/lib/ops/commands";
import { saveFollowUpPreference, runRoutineFollowUpCycle } from "@/lib/ops/routine-follow-ups";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request) {
  try {
    const context = await getOpsRequestContext(["facilities"],undefined,request,true);
    if (context.session.storeIds !== undefined || context.session.regionIds !== undefined || sessionHasNoStores(context.session)) throw new OpsDomainError("FORBIDDEN","Companywide access is required.");
    const form = await request.formData();
    if (form.get("action") === "preview") {
      if (context.session.accessMode !== "preview") throw new OpsDomainError("FORBIDDEN","Preview only");
      const result = await runRoutineFollowUpCycle({repository:context.repository},context.session.organizationId);
      return relativeRedirect303(`/app/admin/notifications?notice=${encodeURIComponent(`${result.queued} reminders queued; ${result.failed} need review. No email sent.`)}`);
    }
    await saveFollowUpPreference({repository:context.repository},context.session.organizationId,Number(form.get("cadenceHours")),context.actor);
    return relativeRedirect303("/app/admin/notifications?notice=Follow-up+frequency+saved");
  } catch(error) { return opsApiError(error); }
}
