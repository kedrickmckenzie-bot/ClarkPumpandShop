import { OpsDomainError } from "@/lib/ops/errors";
import { configurableMaintenanceCapabilities } from "@/lib/ops/capability-policy";
import { configureMaintenanceResponsibilities } from "@/lib/ops/maintenance-policy-commands";
import type { ConfigurableMaintenanceCapability, OrganizationRole } from "@/lib/ops/types";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const roles = new Set<OrganizationRole>(["store_manager", "regional_manager", "facilities_admin"]);
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"], "administer");
    const form = await request.formData();
    const role = formText(form, "role", { required: true, max: 40 }) as OrganizationRole;
    const enabledCapabilities = form.getAll("enabledCapability").map(String) as ConfigurableMaintenanceCapability[];
    if (!roles.has(role) || enabledCapabilities.some((capability) => !configurableMaintenanceCapabilities.includes(capability))) throw new OpsDomainError("VALIDATION", "Choose supported maintenance responsibilities.");
    await configureMaintenanceResponsibilities({ repository: context.repository, organizationId: context.session.organizationId, role, enabledCapabilities, autoCloseRoutineAfterVerification: form.get("autoCloseRoutineAfterVerification") === "true", appliesToActiveWork: form.get("appliesToActiveWork") === "true", actor: context.actor });
    return relativeRedirect303(`/app/admin/maintenance-responsibilities?notice=${encodeURIComponent("Maintenance responsibilities saved.")}`);
  } catch (error) { return opsApiError(error); }
}
