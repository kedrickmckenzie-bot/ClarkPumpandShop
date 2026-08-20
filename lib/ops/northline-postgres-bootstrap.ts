import {
  buildNorthlinePresentationFixture,
  NORTHLINE_ORGANIZATION_ID,
} from "./fixtures";
import {
  createOpsPostgresTransactionRepository,
  type PostgresPoolLike,
} from "./postgres-repository";
import { seedOpsRepository } from "./seed";
import {
  buildNorthlineCompatibilityMarker,
  buildNorthlineCurrentSeedMarker,
  NORTHLINE_BOOTSTRAP_COMMAND,
  NORTHLINE_COMPATIBILITY_COMMAND,
  NORTHLINE_SEED_COMPATIBILITY_MARKER,
  NORTHLINE_SEED_VERSION,
  planNorthlineSeedRelease,
  remapNorthlineFixtureVisitWorkIds,
  type NorthlineSeedMarkerRow,
} from "./northline-seed-release";

export const NORTHLINE_POSTGRES_SEED_VERSION = NORTHLINE_SEED_VERSION;

/**
 * Fixture releases share this lock from v10 onward. Keep the v9 key during the
 * transition so an in-flight legacy process and the current release cannot seed different fixture
 * versions into the same empty database at the same time.
 */
export const NORTHLINE_POSTGRES_SEED_LOCK_KEY = `ops-fixture-bootstrap:${NORTHLINE_ORGANIZATION_ID}`;
const NORTHLINE_POSTGRES_LEGACY_SEED_LOCK_KEY = "northline-ops-2026-08-15-v9";
export const NORTHLINE_POSTGRES_SEED_LOCK_KEYS = [
  NORTHLINE_POSTGRES_SEED_LOCK_KEY,
  NORTHLINE_POSTGRES_LEGACY_SEED_LOCK_KEY,
] as const;

export async function ensureNorthlinePostgresSeed(pool: PostgresPoolLike) {
  const client = await pool.connect();
  const lockedKeys: string[] = [];
  let inTransaction = false;
  try {
    for (const lockKey of NORTHLINE_POSTGRES_SEED_LOCK_KEYS) {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
      lockedKeys.push(lockKey);
    }

    let markers: NorthlineSeedMarkerRow[];
    try {
      const result = await client.query<NorthlineSeedMarkerRow>(
        `SELECT key, command, result_id FROM ops_idempotency_keys
          WHERE organization_id = $1
            AND (key IN ($2, $3) OR command IN ($4, $5))
          ORDER BY created_at DESC, key DESC`,
        [
          NORTHLINE_ORGANIZATION_ID,
          NORTHLINE_POSTGRES_SEED_VERSION,
          NORTHLINE_SEED_COMPATIBILITY_MARKER,
          NORTHLINE_BOOTSTRAP_COMMAND,
          NORTHLINE_COMPATIBILITY_COMMAND,
        ],
      );
      markers = result.rows;
    } catch (error) {
      throw new Error(
        "PostgreSQL is reachable but the operations baseline migration is not applied.",
        { cause: error },
      );
    }
    const plan = planNorthlineSeedRelease(markers);
    if (plan.kind === "already_current") return { seeded: false as const };
    if (plan.kind === "already_enriched") {
      return { seeded: false as const, enrichedExisting: true as const };
    }

    // Keep the advisory lock, marker check, source seed, and completion marker
    // on one session and transaction. DEFERRABLE FKs cover the intentional
    // request/work-order/equipment forward references until commit.
    await client.query("BEGIN");
    inTransaction = true;
    const repository = createOpsPostgresTransactionRepository(client);

    if (plan.kind === "enrich_existing") {
      const links = await client.query<{ organization_id: string; id: string; visit_id: string; work_order_id: string }>(
        "SELECT organization_id, id, visit_id, work_order_id FROM ops_site_visit_work_orders WHERE organization_id = $1",
        [NORTHLINE_ORGANIZATION_ID],
      );
      const fixture = remapNorthlineFixtureVisitWorkIds(buildNorthlinePresentationFixture(), links.rows.map((row) => ({ organizationId: row.organization_id, id: row.id, visitId: row.visit_id, workOrderId: row.work_order_id })));
      const result = await seedOpsRepository(repository, fixture, [buildNorthlineCompatibilityMarker(plan.sourceVersion)]);
      await client.query("COMMIT");
      inTransaction = false;
      return {
        seeded: true as const,
        enrichedExisting: true as const,
        sourceVersion: plan.sourceVersion,
        ...result,
      };
    }

    const result = await seedOpsRepository(
      repository,
      buildNorthlinePresentationFixture(),
      [buildNorthlineCurrentSeedMarker()],
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
      for (const lockKey of lockedKeys.reverse()) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
      }
    } finally {
      client.release();
    }
  }
}
