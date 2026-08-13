import { NORTHLINE_ORGANIZATION_ID } from "../lib/ops/fixtures";
import { ensureNorthlinePostgresSeed } from "../lib/ops/northline-postgres-bootstrap";
import { getPostgresPool } from "../lib/server/postgres-pool";

async function seed() {
  const pool = await getPostgresPool();
  try {
    const result = await ensureNorthlinePostgresSeed(pool);
    console.log(result.seeded
      ? `Deterministic Northline fixture seeded for ${NORTHLINE_ORGANIZATION_ID}.`
      : `Northline fixture is already current for ${NORTHLINE_ORGANIZATION_ID}.`);
  } finally {
    await pool.end?.();
  }
}

await seed();
