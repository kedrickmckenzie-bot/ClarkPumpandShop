import type { OperatorCapability } from "@/components/ops/role-policy";
import { demoOperatorRolePolicy } from "@/components/ops/role-policy";
import type { OpsRepository } from "./repository";
import type { ConfigurableMaintenanceCapability, OrganizationRole, RoleCapabilityOverride } from "./types";

export const configurableMaintenanceCapabilities = [
  "create_work_order",
  "issue_work_order",
  "confirm_observable_result",
] as const satisfies readonly ConfigurableMaintenanceCapability[];

const operatorRoleForOrganizationRole = {
  facilities_admin: "facilities",
  regional_manager: "regional",
  store_manager: "store_manager",
  executive: "executive",
  finance_reviewer: "finance",
} as const;

export function isConfigurableMaintenanceCapability(value: string): value is ConfigurableMaintenanceCapability {
  return configurableMaintenanceCapabilities.includes(value as ConfigurableMaintenanceCapability);
}

export function defaultCapabilityEnabled(role: OrganizationRole, capability: ConfigurableMaintenanceCapability) {
  const operatorRole = operatorRoleForOrganizationRole[role as keyof typeof operatorRoleForOrganizationRole];
  if (!operatorRole) return false;
  return demoOperatorRolePolicy[operatorRole].capabilities.includes(capability);
}

export function resolveRoleCapabilities(
  role: OrganizationRole,
  overrides: readonly RoleCapabilityOverride[],
): { capabilities: OperatorCapability[]; warnings: string[] } {
  const operatorRole = operatorRoleForOrganizationRole[role as keyof typeof operatorRoleForOrganizationRole];
  if (!operatorRole) return { capabilities: [], warnings: [] };
  const capabilities = new Set<OperatorCapability>(demoOperatorRolePolicy[operatorRole].capabilities);
  const byCapability = new Map(overrides.filter((row) => row.role === role).map((row) => [row.capability, row]));
  for (const capability of configurableMaintenanceCapabilities) {
    const override = byCapability.get(capability);
    const enabled = override?.enabled ?? defaultCapabilityEnabled(role, capability);
    if (enabled) capabilities.add(capability);
    else capabilities.delete(capability);
  }

  const warnings: string[] = [];
  if (role === "store_manager" && capabilities.has("issue_work_order") && !capabilities.has("create_work_order")) {
    capabilities.delete("issue_work_order");
    warnings.push("Store-manager dispatch is inactive because work-order creation is not enabled.");
  }
  return { capabilities: [...capabilities], warnings };
}

export async function membershipHasCapability(
  repository: OpsRepository,
  organizationId: string,
  membershipId: string,
  capability: ConfigurableMaintenanceCapability,
) {
  const membership = await repository.getMembership(organizationId, membershipId);
  if (!membership || membership.status !== "active") return false;
  const overrides = await repository.listRoleCapabilityOverrides(organizationId);
  return resolveRoleCapabilities(membership.role, overrides).capabilities.includes(capability);
}
