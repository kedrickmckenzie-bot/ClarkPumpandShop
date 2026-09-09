import { OpsDomainError } from "./errors";
import { configurableMaintenanceCapabilities } from "./capability-policy";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, ConfigurableMaintenanceCapability, OrganizationRole } from "./types";

const configurableRoles = new Set<OrganizationRole>(["facilities_admin", "regional_manager", "store_manager"]);

export async function configureMaintenanceResponsibilities(input: {
  repository: OpsRepository;
  organizationId: string;
  role: OrganizationRole;
  enabledCapabilities: readonly ConfigurableMaintenanceCapability[];
  autoCloseRoutineAfterVerification: boolean;
  appliesToActiveWork: boolean;
  actor: ActorContext;
  occurredAt?: string;
}) {
  if (!configurableRoles.has(input.role)) throw new OpsDomainError("VALIDATION", "Choose a configurable maintenance role");
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "An active facilities administrator must change maintenance responsibilities");
  const membership = await input.repository.getMembership(input.organizationId, input.actor.actorId);
  if (!membership || membership.status !== "active" || membership.role !== "facilities_admin") throw new OpsDomainError("FORBIDDEN", "Only facilities administrators can change maintenance responsibilities");
  const enabled = new Set(input.enabledCapabilities);
  if ([...enabled].some((capability) => !configurableMaintenanceCapabilities.includes(capability))) throw new OpsDomainError("VALIDATION", "Choose supported maintenance responsibilities");
  if (enabled.has("issue_work_order") && !enabled.has("create_work_order")) throw new OpsDomainError("VALIDATION", "Dispatch requires work-order creation for the same role");

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const [overrides, policies] = await Promise.all([
    input.repository.listRoleCapabilityOverrides(input.organizationId),
    input.repository.listWorkflowPolicies(input.organizationId),
  ]);
  const statements: OpsStatement[] = [];
  for (const capability of configurableMaintenanceCapabilities) {
    const current = overrides.find((row) => row.role === input.role && row.capability === capability);
    const value = enabled.has(capability);
    if (current) statements.push({ sql: "UPDATE ops_role_capability_overrides SET enabled = ?, updated_by_membership_id = ?, updated_by_name = ?, updated_at = ? WHERE organization_id = ? AND id = ?", params: [value ? 1 : 0, membership.id, input.actor.actorName, occurredAt, input.organizationId, current.id] });
    else statements.push({ sql: "INSERT INTO ops_role_capability_overrides (id, organization_id, role, capability, enabled, updated_by_membership_id, updated_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params: [`role-capability-${crypto.randomUUID()}`, input.organizationId, input.role, capability, value ? 1 : 0, membership.id, input.actor.actorName, occurredAt, occurredAt] });
  }

  const currentPolicy = policies.find((row) => row.status === "active");
  const version = Math.max(0, ...policies.map((row) => row.version)) + 1;
  if (currentPolicy) statements.push({ sql: "UPDATE ops_workflow_policies SET status = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["superseded", input.organizationId, currentPolicy.id, "active"] });
  const policyId = `workflow-policy-${crypto.randomUUID()}`;
  statements.push({ sql: "INSERT INTO ops_workflow_policies (id, organization_id, version, status, auto_close_routine_after_verification, applies_to_active_work, created_by_membership_id, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params: [policyId, input.organizationId, version, "active", input.autoCloseRoutineAfterVerification ? 1 : 0, input.appliesToActiveWork ? 1 : 0, membership.id, input.actor.actorName, occurredAt] });
  statements.push({ sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params: [`audit-${crypto.randomUUID()}`, input.organizationId, "organization", input.organizationId, "organization.maintenance_responsibilities_changed", input.actor.actorType, input.actor.actorId, input.actor.actorName, occurredAt, JSON.stringify({ role: input.role, enabledCapabilities: [...enabled], workflowPolicyId: policyId, workflowPolicyVersion: version, autoCloseRoutineAfterVerification: input.autoCloseRoutineAfterVerification, appliesToActiveWork: input.appliesToActiveWork })] });
  await input.repository.atomicWrite(statements);
  return { policyId, version };
}
