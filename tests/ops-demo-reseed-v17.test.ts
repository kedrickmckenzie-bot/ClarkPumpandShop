import { afterAll, describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { Miniflare } from "miniflare";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { ensureNorthlinePostgresSeed } from "@/lib/ops/northline-postgres-bootstrap";
import { NORTHLINE_BOOTSTRAP_COMMAND, NORTHLINE_SEED_VERSION, planNorthlineSeedRelease } from "@/lib/ops/northline-seed-release";
import { createOpsPostgresTransactionRepository, type PostgresClientLike, type PostgresQueryResult } from "@/lib/ops/postgres-repository";
import { seedOpsRepository } from "@/lib/ops/seed";
import { wipeD1DemoTenant, type D1ResetBinding } from "@/lib/ops/reset-demo-tenant-d1";
import { bulkSeedD1 } from "./helpers/d1-bulk-seed";

const OLD_VERSION = "northline-ops-2026-10-03-v16";
const anchor = "2026-10-07T15:00:00.000Z";

describe("one-time reseed of the hosted demo for the v17 story", () => {
  it("plans a reset only for a database seeded by an earlier version", () => {
    expect(planNorthlineSeedRelease([])).toEqual({ kind: "seed_current" });
    expect(planNorthlineSeedRelease([{ key: OLD_VERSION, command: NORTHLINE_BOOTSTRAP_COMMAND }])).toEqual({ kind: "reset_current" });
    expect(planNorthlineSeedRelease([{ key: NORTHLINE_SEED_VERSION, command: NORTHLINE_BOOTSTRAP_COMMAND }])).toEqual({ kind: "already_current" });
    // Without the one-time reset the older insert-only enrichment still applies.
    expect(planNorthlineSeedRelease([{ key: OLD_VERSION, command: NORTHLINE_BOOTSTRAP_COMMAND }], { resetEarlier: false })).toEqual({ kind: "enrich_existing", sourceVersion: OLD_VERSION });
  });

  let pg: PGlite | undefined;
  afterAll(async () => { await pg?.close(); });
  it("Render (PostgreSQL): replaces only the demo tenant once, then leaves it alone", async () => {
    pg = new PGlite();
    const db = pg;
    for (const file of (await readdir("drizzle-postgres")).filter(f => /^\d.*\.sql$/.test(f)).sort()) {
      // PGlite has no trigram extension; search indexes are not part of this test.
      for (const sql of (await readFile(`drizzle-postgres/${file}`, "utf8")).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) if (!/pg_trgm|gin_trgm_ops/i.test(sql)) await db.exec(sql);
    }
    const client: PostgresClientLike & { release(): void } = {
      async query<Row extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []): Promise<PostgresQueryResult<Row>> { const result = await db.query<Row>(sql, [...values]); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; },
      release() {},
    };
    const pool = { query: client.query, connect: async () => client };
    // An existing preview: the earlier showcase, an older seed receipt, a demo edit and another tenant.
    const earlier = buildShowcaseFixture(anchor, { operatingHistory: false });
    await db.exec("BEGIN");
    await seedOpsRepository(createOpsPostgresTransactionRepository(client), earlier);
    await db.exec("COMMIT");
    await db.query("INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, request_hash, created_at, expires_at) VALUES ($1, $2, $3, $1, $2, $4, '9999-12-31T23:59:59.999Z')", [NORTHLINE_ORGANIZATION_ID, OLD_VERSION, NORTHLINE_BOOTSTRAP_COMMAND, anchor]);
    await db.query("UPDATE ops_store_tasks SET title = 'edit made in the old demo' WHERE id = $1", [earlier.storeTasks![0]!.id]);
    await db.exec("INSERT INTO ops_organizations SELECT 'other-tenant', 'Other tenant', 'other-tenant', time_zone, work_order_prefix, created_at FROM ops_organizations LIMIT 1");

    const first = await ensureNorthlinePostgresSeed(pool);
    expect(first).toMatchObject({ seeded: true, reset: true, stores: 15, vendors: 5 });
    const fresh = buildShowcaseFixture(new Date().toISOString());
    const count = async (sql: string, values: unknown[] = []) => Number((await db.query<{ n: number }>(sql, values)).rows[0]!.n);
    expect(await count("SELECT count(*)::int AS n FROM ops_work_orders WHERE organization_id = $1", [NORTHLINE_ORGANIZATION_ID])).toBe(fresh.workOrders.length);
    expect(await count("SELECT count(*)::int AS n FROM ops_store_tasks WHERE title = 'edit made in the old demo'")).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM ops_organizations WHERE id = 'other-tenant'")).toBe(1);
    expect(await count("SELECT count(*)::int AS n FROM ops_idempotency_keys WHERE organization_id = $1 AND key = $2", [NORTHLINE_ORGANIZATION_ID, NORTHLINE_SEED_VERSION])).toBe(1);

    // The next start finds the new receipt and does not reset again.
    await db.query("UPDATE ops_store_tasks SET title = 'edit made in the new demo' WHERE id = $1", [fresh.storeTasks![0]!.id]);
    expect(await ensureNorthlinePostgresSeed(pool)).toMatchObject({ seeded: false });
    expect(await count("SELECT count(*)::int AS n FROM ops_store_tasks WHERE title = 'edit made in the new demo'")).toBe(1);
  }, 300_000);

  let runtime: Miniflare | undefined;
  afterAll(async () => { await runtime?.dispose(); });
  it("Sites (D1): removes every demo row and nothing else, so the fresh seed loads cleanly", async () => {
    runtime = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", d1Databases: ["DB"] });
    const db = await runtime.getD1Database("DB");
    for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) {
      for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
    }
    await bulkSeedD1(db, buildShowcaseFixture(anchor, { operatingHistory: false }));
    await db.exec("INSERT INTO ops_organizations SELECT 'other-tenant', 'Other tenant', 'other-tenant', time_zone, work_order_prefix, created_at FROM ops_organizations LIMIT 1");
    await db.prepare("INSERT INTO ops_audit_events (id,organization_id,aggregate_type,aggregate_id,event_type,actor_type,actor_name,occurred_at,payload_json) VALUES ('other-audit','other-tenant','organization','other-tenant','organization.created','system','Test','2026-01-01T00:00:00.000Z','{}')").run();

    const result = await wipeD1DemoTenant(db as unknown as D1ResetBinding);
    expect(result.tables).toBeGreaterThan(50);
    const remaining = await db.prepare("SELECT count(*) AS n FROM ops_work_orders WHERE organization_id = ?").bind(NORTHLINE_ORGANIZATION_ID).first<{ n: number }>();
    expect(remaining!.n).toBe(0);
    expect((await db.prepare("SELECT count(*) AS n FROM ops_organizations WHERE id = ?").bind(NORTHLINE_ORGANIZATION_ID).first<{ n: number }>())!.n).toBe(0);
    expect((await db.prepare("SELECT count(*) AS n FROM ops_audit_events WHERE organization_id = 'other-tenant'").first<{ n: number }>())!.n).toBe(1);

    // The new story loads into the emptied tenant without a single conflict.
    const fresh = buildShowcaseFixture(anchor);
    await bulkSeedD1(db, fresh);
    expect((await db.prepare("SELECT count(*) AS n FROM ops_work_orders WHERE organization_id = ?").bind(NORTHLINE_ORGANIZATION_ID).first<{ n: number }>())!.n).toBe(fresh.workOrders.length);
  }, 300_000);
});
