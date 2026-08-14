import {
  buildNorthlinePresentationFixture,
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "./fixtures";
import {
  createOpsPostgresTransactionRepository,
  type PostgresPoolLike,
} from "./postgres-repository";
import { seedOpsRepository } from "./seed";

export const NORTHLINE_POSTGRES_SEED_VERSION = "northline-ops-2026-08-13-v5";

export async function ensureNorthlinePostgresSeed(pool: PostgresPoolLike) {
  const client = await pool.connect();
  let locked = false;
  let inTransaction = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [NORTHLINE_POSTGRES_SEED_VERSION]);
    locked = true;

    let marker: Record<string, unknown> | undefined;
    try {
      const result = await client.query(
        "SELECT result_id FROM ops_idempotency_keys WHERE organization_id = $1 AND key = $2 LIMIT 1",
        [NORTHLINE_ORGANIZATION_ID, NORTHLINE_POSTGRES_SEED_VERSION],
      );
      marker = result.rows[0];
    } catch (error) {
      throw new Error(
        "TraceOps PostgreSQL is reachable but the ops baseline migration is not applied.",
        { cause: error },
      );
    }
    if (marker) return { seeded: false as const };

    // Keep the advisory lock, marker check, source seed, and completion marker
    // on one session and transaction. DEFERRABLE FKs cover the intentional
    // request/work-order/equipment forward references until commit.
    await client.query("BEGIN");
    inTransaction = true;
    const repository = createOpsPostgresTransactionRepository(client);
    const result = await seedOpsRepository(
      repository,
      buildNorthlinePresentationFixture(),
      [{
        sql: `INSERT OR IGNORE INTO ops_idempotency_keys
          (organization_id, key, command, result_id, request_hash, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          NORTHLINE_ORGANIZATION_ID,
          NORTHLINE_POSTGRES_SEED_VERSION,
          "bootstrap_ops_fixture",
          NORTHLINE_ORGANIZATION_ID,
          NORTHLINE_POSTGRES_SEED_VERSION,
          NORTHLINE_AS_OF,
          "9999-12-31T23:59:59.999Z",
        ],
      }],
    );
    await client.query("COMMIT");
    inTransaction = false;
    return { seeded: true as const, ...result };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the bootstrap failure that caused the rollback.
      }
    }
    throw error;
  } finally {
    try {
      if (locked) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [NORTHLINE_POSTGRES_SEED_VERSION]);
      }
    } finally {
      client.release();
    }
  }
}
