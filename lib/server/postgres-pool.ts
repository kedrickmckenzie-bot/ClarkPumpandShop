import type { PostgresPoolLike } from "@/lib/ops/postgres-repository";

interface PgModuleLike {
  Pool: new (options: {
    connectionString: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }) => PostgresPoolLike;
}

let pool: PostgresPoolLike | undefined;
let poolUrl: string | undefined;

async function loadPgModule(): Promise<PgModuleLike> {
  // Next externalizes node-postgres for the Node server. Keep this import
  // statically analyzable so Turbopack emits a real runtime package load rather
  // than compiling the computed specifier into MODULE_NOT_FOUND.
  try {
    return await import("pg") as PgModuleLike;
  } catch (error) {
    throw new Error(
      "TraceOps PostgreSQL requires the `pg` runtime package when DATABASE_URL is configured.",
      { cause: error },
    );
  }
}

export async function getPostgresPool(databaseUrl = process.env.DATABASE_URL): Promise<PostgresPoolLike> {
  const resolvedUrl = databaseUrl?.trim();
  if (!resolvedUrl) throw new Error("DATABASE_URL is required for PostgreSQL persistence.");

  if (!pool || poolUrl !== resolvedUrl) {
    const { Pool } = await loadPgModule();
    pool = new Pool({
      connectionString: resolvedUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    poolUrl = resolvedUrl;
  }

  return pool;
}

export async function resetPostgresPoolForTests() {
  const current = pool;
  pool = undefined;
  poolUrl = undefined;
  await current?.end?.();
}
