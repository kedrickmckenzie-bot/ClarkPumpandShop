import type { OrganizationScope } from "./repository";

/** Alias is repository-owned SQL. Scope values always remain bound parameters. */
export function scopeWhere(scope: OrganizationScope, alias: string, params: unknown[]) {
  const clauses = [`${alias}.organization_id = ?`];
  params.push(scope.organizationId);
  if (scope.storeIds !== undefined) {
    if (scope.storeIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.id IN (${scope.storeIds.map(() => "?").join(",")})`); params.push(...scope.storeIds); }
  }
  if (scope.regionIds !== undefined) {
    if (scope.regionIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.region_id IN (${scope.regionIds.map(() => "?").join(",")})`); params.push(...scope.regionIds); }
  }
  return clauses.join(" AND ");
}
