import { buildShowcaseFixture } from "../lib/ops/showcase-fixture";
import { assertDemoTenantReset, resetDemoTenant } from "../lib/ops/reset-demo-tenant";
import { getPostgresPool, closePostgresPool } from "../lib/server/postgres-pool";

assertDemoTenantReset({ OPS_ENVIRONMENT: process.env.OPS_ENVIRONMENT, OPS_RESET_TENANT_CONFIRM: process.env.OPS_RESET_TENANT_CONFIRM });
const pool = await getPostgresPool();
const client = await pool.connect();
try {
  const fixture = buildShowcaseFixture();
  const result = await resetDemoTenant(client, fixture);
  console.log(`Refreshed the fictional demo at ${fixture.asOf}: 15 stores, 5 vendors, ${fixture.inspections?.length} inspections, ${fixture.storeTasks?.length} store tasks, ${fixture.capitalPlans?.length} capital plans (${result.statements} seed statements).`);
  console.log("Other tenants, database schema and stored uploads were retained.");
} finally {
  client.release();
  await closePostgresPool();
}
