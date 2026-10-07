import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { resetDemoData } from "@/lib/server/demo-reset";
import { isFictionalPreview } from "@/lib/server/operator-access";
import { OpsDomainError } from "@/lib/ops/errors";

/** "Reset demo data" on Setup: top admin only, demo mode only, and the person must type RESET. */
export async function POST(request: Request) {
  try {
    if (!isFictionalPreview()) throw new OpsDomainError("FORBIDDEN", "Demo reset is only available in the demo.");
    const { session, repository, actor } = await getOpsRequestContext(["facilities"], undefined, request);
    const membership = actor.actorId ? await repository.getMembership(session.organizationId, actor.actorId) : null;
    if (session.persona || membership?.role !== "facilities_admin") throw new OpsDomainError("FORBIDDEN", "Only the top admin can reset the demo.");
    const form = await request.formData();
    if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "RESET") throw new OpsDomainError("VALIDATION", "Type RESET to confirm.");
    const { resetAt } = await resetDemoData();
    return relativeRedirect303(`/app/admin?${new URLSearchParams({ demoReset: resetAt })}`);
  } catch (error) {
    return opsApiError(error);
  }
}
