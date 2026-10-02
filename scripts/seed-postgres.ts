import { NORTHLINE_ORGANIZATION_ID } from "../lib/ops/fixtures";
import { ensureNorthlinePostgresSeed } from "../lib/ops/northline-postgres-bootstrap";
import { closePostgresPool, getPostgresPool } from "../lib/server/postgres-pool";
import { runPostgresStartupStep } from "./postgres-startup-retry";

async function seed() {
  const pool = await getPostgresPool();
  const result = await ensureNorthlinePostgresSeed(pool);
  // Refresh planner statistics after a bulk load so the first dashboard reads
  // do not wait for the background autovacuum to notice the new rows.
  if (result.seeded) await pool.query("ANALYZE");
  console.log(result.seeded
    ? `Deterministic Clark Pump and Shop fixture seeded for ${NORTHLINE_ORGANIZATION_ID}.`
    : `Clark Pump and Shop fixture is already current for ${NORTHLINE_ORGANIZATION_ID}.`);
}

try {
  await runPostgresStartupStep("PostgreSQL seed", seed);
} finally {
  await closePostgresPool();
}
