import type { PostgresPoolLike } from "./postgres-repository";
import type { IsoDateTime, OpsFixture, OpsId } from "./types";

/**
 * Shares one read-only tenant snapshot across requests in this process.
 *
 * Every request still asks PostgreSQL whether anything has been written since
 * the snapshot was read (`pg_current_snapshot()` changes whenever a write
 * transaction starts or finishes anywhere in the database). Only an unchanged
 * database reuses the copy, so a committed mutation is visible on the next
 * request on every instance. The copy is deep-frozen: a presenter that tries
 * to modify shared source records fails loudly instead of leaking changes into
 * other users' requests.
 */
type Entry = { token: string; snapshot: Promise<OpsFixture> };

const entries = new Map<string, Entry>();

export type SnapshotLoader = (asOf: IsoDateTime) => Promise<OpsFixture>;

export async function readDatabaseChangeToken(pool: PostgresPoolLike): Promise<string | undefined> {
  try {
    const result = await pool.query("SELECT pg_current_snapshot()::text AS token");
    const token = (result.rows[0] as { token?: unknown } | undefined)?.token;
    return typeof token === "string" ? token : undefined;
  } catch {
    return undefined;
  }
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export async function readCachedPostgresSnapshot(
  pool: PostgresPoolLike,
  organizationId: OpsId,
  variant: string,
  asOf: IsoDateTime,
  load: SnapshotLoader,
): Promise<OpsFixture> {
  const token = await readDatabaseChangeToken(pool);
  if (!token) return load(asOf);
  const key = `${organizationId}\u0000${variant}`;
  let entry = entries.get(key);
  if (!entry || entry.token !== token) {
    const snapshot = load(asOf).then(deepFreeze);
    entry = { token, snapshot };
    entries.set(key, entry);
    snapshot.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
  }
  const shared = await entry.snapshot;
  return { ...shared, asOf };
}

export function clearPostgresSnapshotCache() {
  entries.clear();
}
