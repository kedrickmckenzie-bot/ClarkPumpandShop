import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  assertOpsFixture,
  buildNorthlinePresentationFixture,
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "../lib/ops/fixtures";
import {
  NORTHLINE_POSTGRES_SEED_LOCK_KEYS,
  NORTHLINE_POSTGRES_SEED_VERSION,
} from "../lib/ops/northline-postgres-bootstrap";
import { createOpsPostgresTransactionRepository } from "../lib/ops/postgres-repository";
import { assertDestructiveResetAllowed } from "../lib/ops/reset-safety";
import { seedOpsRepository } from "../lib/ops/seed";
import { getPostgresPool } from "../lib/server/postgres-pool";

const MIGRATIONS_FOLDER = "drizzle-postgres";
const LOCK_KEYS = [
  "traceops-postgres-migrations-v1",
  "cstore-operations-postgres-migrations-v1",
  "cstore-operations-postgres-reset-v1",
  ...NORTHLINE_POSTGRES_SEED_LOCK_KEYS,
] as const;

async function reset() {
  const target = assertDestructiveResetAllowed(process.env);
  const fixture = buildNorthlinePresentationFixture();
  assertOpsFixture(fixture);
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  const pool = await getPostgresPool();
  const client = await pool.connect();
  const lockedKeys: string[] = [];
  let inTransaction = false;

  try {
    const currentDatabase = await client.query<{ current_database: string }>("SELECT current_database()");
    if (currentDatabase.rows[0]?.current_database !== target.databaseName) {
      throw new Error("Connected PostgreSQL database does not match the confirmed reset target.");
    }
    for (const lockKey of LOCK_KEYS) {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
      lockedKeys.push(lockKey);
    }

    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("CREATE SCHEMA drizzle");
    await client.query(`CREATE TABLE drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL UNIQUE,
      created_at bigint
    )`);

    for (const migration of migrations) {
      await client.query("BEGIN");
      inTransaction = true;
      try {
        for (const statement of migration.sql) {
          if (statement.trim()) await client.query(statement);
        }
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [migration.hash, migration.folderMillis],
        );
        await client.query("COMMIT");
        inTransaction = false;
      } catch (error) {
        await client.query("ROLLBACK");
        inTransaction = false;
        throw error;
      }
    }

    await client.query("BEGIN");
    inTransaction = true;
    const repository = createOpsPostgresTransactionRepository(client);
    const seeded = await seedOpsRepository(repository, fixture, [{
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
    }]);

    const [stores, vendors, organizations] = await Promise.all([
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM ops_stores WHERE organization_id = $1", [NORTHLINE_ORGANIZATION_ID]),
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM ops_vendors WHERE organization_id = $1", [NORTHLINE_ORGANIZATION_ID]),
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM ops_organizations WHERE id = $1", [NORTHLINE_ORGANIZATION_ID]),
    ]);
    if (Number(stores.rows[0]?.count) !== 15 || Number(vendors.rows[0]?.count) !== 5 || Number(organizations.rows[0]?.count) !== 1) {
      throw new Error("Reset verification failed: the deterministic Northline tenant does not match its 15-store/five-vendor contract.");
    }
    await client.query("COMMIT");
    inTransaction = false;

    console.log(`Reset ${target.databaseName} on ${target.host} (${target.environment}).`);
    console.log(`Applied ${migrations.length} migrations and ${seeded.statements} deterministic seed statements.`);
    console.log("Verified one Northline organization, 15 stores, and five approved outside vendors.");
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the reset failure that triggered rollback.
      }
    }
    throw error;
  } finally {
    try {
      for (const lockKey of lockedKeys.reverse()) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
      }
    } finally {
      client.release();
      await pool.end?.();
    }
  }
}

await reset();
