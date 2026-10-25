import { attentionAccess } from "@/app/app/_data/attention-presenter";
import { OpsDomainError } from "@/lib/ops/commands";
import { nudgeWorkflowTask } from "@/lib/ops/nudge";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

/** Nudge whoever an item is waiting on. Anyone who can see the store may nudge; nobody can approve by nudging. */
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager"], undefined, request);
    const form = await request.formData();
    const taskId = formText(form, "taskId", { required: true, max: 200 });
    const back = formText(form, "returnTo", { max: 500 });
    const org = context.session.organizationId;
    const task = await context.repository.getWorkflowTask(org, taskId);
    const work = task?.workOrderId ? await context.repository.getWorkOrder(org, task.workOrderId) : null;
    if (!task || !work) throw new OpsDomainError("NOT_FOUND", "This item was not found.");
    await assertStoreInSessionScope(context.session, work.storeId);
    const result = await nudgeWorkflowTask({ repository: context.repository }, { organizationId: org, workflowTaskId: task.id, actor: context.actor, actorRole: attentionAccess(context.session).role, actorMembershipId: context.actor.actorId });
    const target = back && back.startsWith("/app/action-center") ? back : "/app/action-center?lane=waiting";
    const url = new URL(target, "https://x.invalid");
    url.searchParams.set("nudged", result.escalatedTo ? `up:${task.id}` : task.id);
    return relativeRedirect303(`${url.pathname}${url.search}`);
  } catch (error) {
    return opsApiError(error);
  }
}
