import {
  recordTechnicianStatus,
  type TechnicianStatus,
} from "@/lib/ops/technician-status";
import {
  getOpsRequestContext,
  assertStoreInSessionScope,
  formText,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request: Request) {
  try {
    const c = await getOpsRequestContext(
        ["technician"],
        "record_internal_result",
        request,
      ),
      data = await request.formData();
    const storeId = formText(data, "storeId", { required: true, max: 120 });
    await assertStoreInSessionScope(c.session, storeId);
    await recordTechnicianStatus(
      { repository: c.repository },
      {
        organizationId: c.session.organizationId,
        actor: c.actor,
        storeId,
        status: formText(data, "status", {
          required: true,
          max: 20,
        }) as TechnicianStatus["status"],
        workOrderId: formText(data, "workOrderId", { max: 120 }) || undefined,
        expectedRevision: Number(
          formText(data, "expectedRevision", { required: true, max: 16 }),
        ),
      },
    );
    return relativeRedirect303("/app/my-work?saved=status");
  } catch (error) {
    return opsApiError(error);
  }
}
