import type { OpsFixture } from "./types";

/** Local snapshots obey the same tenant boundary as the SQL adapters. */
export function tenantFixture(fixture: OpsFixture, organizationId: string): OpsFixture {
  const userIds = new Set(fixture.memberships.filter(row => row.organizationId === organizationId).map(row => row.userId));
  return Object.fromEntries(Object.entries(fixture).map(([key, value]) => {
    if (!Array.isArray(value)) return [key, value];
    return [key, value.filter(row => key === "organizations" ? row.id === organizationId : key === "users" ? userIds.has(row.id) : row.organizationId === organizationId)];
  })) as OpsFixture;
}
