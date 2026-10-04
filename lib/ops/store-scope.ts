import type { ScopeGrant, Store } from "./types";

export const writableOpsPermissions = ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"];

/** Store coverage always includes its tenant, division, region and stable ID. */
export function grantCoversStore(grant: Pick<ScopeGrant, "organizationId" | "scopeKind" | "scopeId">, store: Pick<Store, "organizationId" | "id" | "divisionId" | "regionId">) {
  return grant.organizationId === store.organizationId && (
    grant.scopeKind === "organization" && grant.scopeId === store.organizationId
    || grant.scopeKind === "division" && grant.scopeId === store.divisionId
    || grant.scopeKind === "region" && grant.scopeId === store.regionId
    || grant.scopeKind === "store" && grant.scopeId === store.id
  );
}
