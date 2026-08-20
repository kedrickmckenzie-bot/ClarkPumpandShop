import { OpsDomainError } from "@/lib/ops/errors";
import { acceptServiceRunCounter } from "@/lib/ops/service-run-commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "regional"]);
    const { id } = await params;
    const run = await context.repository.getServiceRun(context.session.organizationId, id);
    if (!run) throw new OpsDomainError("NOT_FOUND", "Service Run was not found in your organization");
    const formData = await request.formData();
    await acceptServiceRunCounter({ organizationId: context.session.organizationId, serviceRunId: run.id, responseId: formText(formData, "responseId", { required: true, max: 160 }), actor: context.actor }, { repository: context.repository });
    return relativeRedirect303(`/app/service-runs/${encodeURIComponent(run.id)}?updated=counter-accepted`);
  } catch (error) {
    return opsApiError(error);
  }
}
