import "server-only";
import type { OperatorRole, OperatorSession } from "@/components/ops/data-contract";
import { resolveRoleCapabilities } from "@/lib/ops/capability-policy";
import type { OpsRepository } from "@/lib/ops/repository";
import { OperatorAccessError } from "./operator-access";

export const domainRoleForOperatorRole = {
  executive: "executive", facilities: "facilities_admin", regional: "regional_manager",
  store_manager: "store_manager", finance: "finance_reviewer",
} as const;

/** Organization is an untrusted selector; the verified subject must belong to it. */
export async function resolveAuthenticatedOperatorSession(repository: OpsRepository, input: {
  userId: string; organizationId: string;
}): Promise<OperatorSession> {
  if (!input.organizationId) throw new OperatorAccessError("company", "Choose your company to continue.");
  const [user, memberships] = await Promise.all([
    repository.getUserInOrganization(input.organizationId, input.userId),
    repository.listMembershipsForUser(input.organizationId, input.userId),
  ]);
  const active = memberships.filter(row => row.status === "active");
  if (!user || user.status !== "active" || active.length !== 1) {
    throw new OperatorAccessError("membership", "Your account does not have access to this company. Ask your administrator for help.");
  }
  const membership = active[0];
  const role = (Object.keys(domainRoleForOperatorRole) as OperatorRole[]).find(key => domainRoleForOperatorRole[key] === membership.role);
  if (!role) throw new OperatorAccessError("membership", "Your account does not have operator access.");
  const [organization, grants, overrides, storeIds] = await Promise.all([
    repository.getOrganization(input.organizationId),
    repository.listScopeGrantsForMembership(input.organizationId, membership.id),
    repository.listRoleCapabilityOverrides(input.organizationId),
    repository.listStoreIdsForMembership(input.organizationId, membership.id),
  ]);
  const readable = grants.filter(grant => ["ops:*", "ops:read", "ops:write", "ops:read_write", "ops:store_manage", "ops:finance_read"].includes(grant.permission));
  const companywide = readable.some(grant => grant.scopeKind === "organization" && grant.scopeId === input.organizationId);
  if (!organization || !readable.length || (!companywide && !storeIds.length)) {
    throw new OperatorAccessError("membership", "No stores are assigned to your account. Ask your administrator for help.");
  }
  const policy = resolveRoleCapabilities(membership.role, overrides);
  // Mixed read/write scopes remain read-only until independent write scopes are supported.
  const writable = readable.every(grant => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(grant.permission));
  const regionIds = !companywide && readable.every(grant => grant.scopeKind === "region") ? readable.map(grant => grant.scopeId) : undefined;
  const scope = { organizationId: input.organizationId, storeIds: companywide ? undefined : storeIds, regionIds };
  const stores = await repository.searchStores(scope, "", { limit: 1 });
  const first = stores.items[0];
  const scopeLabel = !companywide && storeIds.length === 1 && first
    ? `Store ${first.storeNumber} · ${first.name}`
    : `${companywide ? organization.name + " companywide" : regionIds?.length === 1 ? first?.regionName ?? "Assigned region" : "Assigned stores"} · ${stores.totalCount ?? storeIds.length} stores`;
  return { ...scope, userId: user.id, membershipId: membership.id, displayName: user.displayName, email: user.email,
    role, organizationName: organization.name, scopeLabel, permissions: readable.map(grant => grant.permission),
    effectiveCapabilities: writable ? policy.capabilities : [], capabilityWarnings: policy.warnings, demoEdition: "complete", accessMode: "authenticated" };
}
