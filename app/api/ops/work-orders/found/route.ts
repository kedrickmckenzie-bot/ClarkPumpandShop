import { reportFoundProblem } from "@/lib/ops/found-problem";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { storeCompletionFiles } from "@/lib/server/work-completion-files";

/** A technician reports a problem found on site: fix it now (their job) or send it to a manager. */
export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const context = await getOpsRequestContext(["technician"], "report_found_problem", request);
    const organization = await context.repository.getOrganization(context.session.organizationId);
    const fixNow = formText(data, "choice", { required: true, max: 20 }) === "fix_now";
    const key = formText(data, "submissionKey", { required: true, max: 120 });
    // Photos go to private storage first; the job and its file links are then saved together.
    const files = await storeCompletionFiles(data, context.session.organizationId, "found-problem", context.session.accessMode === "preview", key);
    const work = await reportFoundProblem({ repository: context.repository }, {
      organizationId: context.session.organizationId, actor: context.actor,
      storeId: formText(data, "storeId", { required: true, max: 120 }),
      assetId: formText(data, "assetId", { max: 120 }) || undefined,
      problem: formText(data, "problem", { required: true, max: 500 }),
      fixNow, today: civilDate(new Date().toISOString(), organization?.timeZone ?? "America/New_York"),
      key, files,
    });
    if (request.headers.get("accept")?.includes("application/json")) return Response.json({ saved: true, id: work.id, number: work.number });
    return relativeRedirect303(fixNow ? `/app/my-work/${encodeURIComponent(work.id)}?saved=found` : `/app/my-work?sent=${encodeURIComponent(work.number)}`);
  } catch (error) { return opsApiError(error); }
}
