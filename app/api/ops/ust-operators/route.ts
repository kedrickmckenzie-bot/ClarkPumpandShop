import { OpsDomainError } from "@/lib/ops/errors";
import { addUstOperator, removeUstOperator } from "@/lib/ops/ust";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

/** Adds or removes a fuel tank operator. Facilities and regional managers only; every change is audited. */
export async function POST(request: Request) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "regional"], undefined, request);
    const form = await request.formData();
    const action = formText(form, "action", { required: true, max: 10 });
    const svc = { repository };
    if (action === "add") {
      const storeId = formText(form, "storeId", { required: true, max: 120 });
      await assertStoreInSessionScope(session, storeId);
      await addUstOperator(svc, { organizationId: session.organizationId, storeId, operatorClass: formText(form, "operatorClass", { required: true, max: 1 }), name: formText(form, "name", { required: true, max: 120 }), certificateNumber: formText(form, "certificateNumber", { max: 60 }) || undefined, trainedOn: formText(form, "trainedOn", { max: 10 }) || undefined, expiresOn: formText(form, "expiresOn", { max: 10 }) || undefined, actor, key: formText(form, "key", { required: true, max: 80 }) });
      return relativeRedirect303(`/app/compliance/fuel-tanks?notice=${encodeURIComponent("Operator saved.")}#operators`);
    }
    if (action === "remove") {
      await removeUstOperator(svc, { organizationId: session.organizationId, operatorId: formText(form, "operatorId", { required: true, max: 160 }), actor, scope: session });
      return relativeRedirect303(`/app/compliance/fuel-tanks?notice=${encodeURIComponent("Operator removed. The record is kept.")}#operators`);
    }
    throw new OpsDomainError("VALIDATION", "Unknown action.");
  } catch (error) { return opsApiError(error); }
}
