import { createServiceRequest, OpsDomainError } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { parseRequestImpactForm } from "@/lib/server/request-impact-form";

const priorities = new Set(["routine", "urgent", "emergency"]);

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const formData = await request.formData();
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    const priority = formText(formData, "priority", { required: true, max: 20 });
    if (!priorities.has(priority)) throw new OpsDomainError("VALIDATION", "Choose a supported request priority.");
    await assertStoreInSessionScope(context.session, storeId);
    const result = await createServiceRequest(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        storeId,
        reporterName: formText(formData, "reporterName", { required: true, max: 100 }),
        reporterEmployeeId: formText(formData, "reporterEmployeeId", { max: 80 }) || undefined,
        problem: formText(formData, "problem", { required: true, max: 2_000 }),
        priority: priority as "routine" | "urgent" | "emergency",
        impact: parseRequestImpactForm(formData, { source: "store_report", required: false }),
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/requests?created=${encodeURIComponent(result.reference)}`);
  } catch (error) {
    return opsApiError(error);
  }
}
