import { NextResponse } from "next/server";
import { nameStoreEquipment } from "@/lib/ops/setup-commands";
import {
  assertStoreInSessionScope,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const { id } = await params;
    await assertStoreInSessionScope(context.session, id);
    const formData = await request.formData();
    const equipment = [...formData.entries()]
      .filter(([key]) => key.startsWith("name:"))
      .map(([key, value]) => ({
        assetId: key.slice("name:".length),
        name: typeof value === "string" ? value : "",
      }));
    const assets = await nameStoreEquipment(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        storeId: id,
        equipment,
        actor: context.actor,
      },
    );
    const redirectTo = `/app/stores/${encodeURIComponent(id)}?equipmentNamed=${assets.length}`;
    return request.headers.get("x-ops-client") === "store-equipment-naming"
      ? NextResponse.json({ ok: true, redirectTo })
      : relativeRedirect303(redirectTo);
  } catch (error) {
    return opsApiError(error);
  }
}
