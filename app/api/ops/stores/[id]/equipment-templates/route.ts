import { NextResponse } from "next/server";
import { applyStoreEquipmentTemplates } from "@/lib/ops/setup-commands";
import { assertStoreInSessionScope, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]); const { id } = await params; await assertStoreInSessionScope(context.session, id); const formData = await request.formData(); const selections = [...formData.entries()].filter(([key]) => key.startsWith("quantity:")).map(([key, value]) => ({ templateId: key.slice("quantity:".length), quantity: Number(value) })).filter((row) => Number.isSafeInteger(row.quantity) && row.quantity > 0); const assets = await applyStoreEquipmentTemplates({ repository: context.repository }, { organizationId: context.session.organizationId, storeId: id, selections, actor: context.actor }); const redirectTo = `/app/stores/${encodeURIComponent(id)}?equipmentCreated=${assets.length}`; return request.headers.get("x-traceops-client") === "store-equipment-setup" ? NextResponse.json({ ok: true, redirectTo }) : relativeRedirect303(redirectTo);
  } catch (error) { return opsApiError(error); }
}
