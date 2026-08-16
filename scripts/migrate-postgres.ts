import { readMigrationFiles } from "drizzle-orm/migrator";
import { getPostgresPool } from "../lib/server/postgres-pool";

const MIGRATIONS_FOLDER = "drizzle-postgres";
const LEGACY_MIGRATION_LOCK_KEY = "traceops-postgres-migrations-v1";
const MIGRATION_LOCK_KEY = "cstore-operations-postgres-migrations-v1";
const MIGRATION_LOCK_KEYS = [
  // Keep the legacy lock first so a rolling deployment remains serialized
  // with an older migration runner while the neutral namespace takes over.
  LEGACY_MIGRATION_LOCK_KEY,
  MIGRATION_LOCK_KEY,
] as const;

async function migrate() {
  const pool = await getPostgresPool();
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  const client = await pool.connect();
  const lockedKeys: string[] = [];
  try {
    // The session lock serializes Render predeploys and any manual migration
    // runner from the first migration-table check through the final commit.
    for (const lockKey of MIGRATION_LOCK_KEYS) {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
      lockedKeys.push(lockKey);
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL UNIQUE,
      created_at bigint
    )`);

    const applied = await client.query<{ hash: string }>(
      "SELECT hash FROM drizzle.__drizzle_migrations",
    );
    const appliedHashes = new Set(applied.rows.map((row) => row.hash));

    for (const migration of migrations) {
      if (appliedHashes.has(migration.hash)) continue;
      let inTransaction = false;
      try {
        await client.query("BEGIN");
        inTransaction = true;
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
        if (inTransaction) await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(`PostgreSQL migrations are current (${migrations.length} known migration${migrations.length === 1 ? "" : "s"}).`);
  } finally {
    try {
      for (const lockKey of lockedKeys.reverse()) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
      }
    } finally {
      client.release();
    }
  }
}

try {
  await migrate();
} finally {
  const pool = await getPostgresPool();
  await pool.end?.();
}
