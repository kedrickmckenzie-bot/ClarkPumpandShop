import { NORTHLINE_ORGANIZATION_ID, assertOpsFixture } from "./fixtures";
import { createOpsPostgresTransactionRepository, type PostgresClientLike } from "./postgres-repository";
import { seedOpsRepository } from "./seed";
import { buildNorthlineCurrentSeedMarker } from "./northline-seed-release";
import type { OpsFixture } from "./types";

export function assertDemoTenantReset(env: { OPS_ENVIRONMENT?: string; OPS_RESET_TENANT_CONFIRM?: string }) {
  if (env.OPS_ENVIRONMENT !== "demo" || env.OPS_RESET_TENANT_CONFIRM !== NORTHLINE_ORGANIZATION_ID) {
    throw new Error("Demo reset requires OPS_ENVIRONMENT=demo and OPS_RESET_TENANT_CONFIRM=org-northline-demo.");
  }
}

/** Replace one fictional tenant in a transaction; retain schema and all other tenants. */
export async function resetDemoTenant(client: PostgresClientLike, fixture: OpsFixture) {
  assertOpsFixture(fixture);
  if (fixture.organizations.length !== 1 || fixture.organizations[0].id !== NORTHLINE_ORGANIZATION_ID) throw new Error("Only the fictional demo tenant can be reset.");
  const identifier = (value: string) => {
    if (!/^ops_[a-z0-9_]+$/.test(value)) throw new Error("Unexpected table name in demo reset.");
    return `"${value}"`;
  };
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`ops-fixture-bootstrap:${NORTHLINE_ORGANIZATION_ID}`]);
    const tables = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND table_name LIKE 'ops_%' ORDER BY table_name");
    const names = new Set(tables.rows.map(r => r.table_name));
    names.add("ops_organizations");
    const edges = await client.query<{ child: string; parent: string }>("SELECT c.relname AS child, p.relname AS parent FROM pg_constraint fk JOIN pg_class c ON c.oid = fk.conrelid JOIN pg_class p ON p.oid = fk.confrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE fk.contype = 'f' AND NOT fk.condeferrable AND n.nspname = 'public'");
    const order: string[] = [];
    while (names.size) {
      const ready = [...names].filter(parent => !edges.rows.some(e => e.parent === parent && e.child !== parent && names.has(e.child)));
      if (!ready.length) throw new Error("Demo reset found a non-deferrable dependency cycle. No records were changed.");
      for (const table of ready) { identifier(table); order.push(table); names.delete(table); }
    }
    await client.query(`LOCK TABLE ${order.map(identifier).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const existing = await client.query<{ name: string }>("SELECT name FROM ops_organizations WHERE id = $1", [NORTHLINE_ORGANIZATION_ID]);
    if (existing.rows[0] && existing.rows[0].name !== fixture.organizations[0].name) throw new Error("The demo tenant name does not match. Reset stopped.");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    for (const table of order) await client.query(`DELETE FROM ${identifier(table)} WHERE ${table === "ops_organizations" ? "id" : "organization_id"} = $1`, [NORTHLINE_ORGANIZATION_ID]);
    const result = await seedOpsRepository(createOpsPostgresTransactionRepository(client), fixture, [buildNorthlineCurrentSeedMarker()]);
    const counts = await client.query<{ stores: number; vendors: number }>("SELECT (SELECT count(*)::int FROM ops_stores WHERE organization_id = $1) AS stores, (SELECT count(*)::int FROM ops_vendors WHERE organization_id = $1) AS vendors", [NORTHLINE_ORGANIZATION_ID]);
    if (counts.rows[0]?.stores !== 15 || counts.rows[0]?.vendors !== 5) throw new Error("Demo seed verification failed.");
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
