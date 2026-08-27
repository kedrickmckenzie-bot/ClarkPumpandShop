import { createStore } from "@/lib/ops/commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const formData = await request.formData();
    const radiusValue = formText(formData, "geofenceRadiusM", { max: 10 });
    const radius = radiusValue ? Number(radiusValue) : undefined;
    const result = await createStore(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        regionId: formText(formData, "regionId", { max: 120 }) || undefined,
        storeNumber: formText(formData, "storeNumber", { required: true, max: 30 }),
        name: formText(formData, "name", { required: true, max: 160 }),
        address1: formText(formData, "address1", { required: true, max: 180 }),
        address2: formText(formData, "address2", { max: 180 }) || undefined,
        city: formText(formData, "city", { required: true, max: 100 }),
        state: formText(formData, "state", { required: true, max: 2 }).toUpperCase(),
        postalCode: formText(formData, "postalCode", { required: true, max: 15 }),
        aliases: formText(formData, "aliases", { max: 500 }).split(",").map((value) => value.trim()).filter(Boolean),
        geofenceRadiusM: Number.isFinite(radius) ? radius : undefined,
        locationPolicyEnabled: formData.get("locationPolicyEnabled") === "true",
        timeZone: formText(formData, "timeZone", { required: true, max: 80 }),
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/stores/${encodeURIComponent(result.id)}/equipment-setup?created=true`);
  } catch (error) {
    return opsApiError(error);
  }
}
