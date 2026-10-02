import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { PostgresPoolLike } from "@/lib/ops/postgres-repository";
import { clearPostgresSnapshotCache, readCachedPostgresSnapshot, readDatabaseChangeToken } from "@/lib/ops/postgres-snapshot-cache";
import type { OpsFixture } from "@/lib/ops/types";

function fakePool(token: { value: string | Error }): PostgresPoolLike {
  return {
    async query() {
      if (token.value instanceof Error) throw token.value;
      return { rows: [{ token: token.value }] };
    },
    async connect() { throw new Error("unused"); },
  } as PostgresPoolLike;
}

function snapshot(label: string) {
  return { asOf: "2026-01-01T00:00:00.000Z", stores: [{ id: label, name: label }] } as unknown as OpsFixture;
}

describe("shared PostgreSQL snapshot", () => {
  beforeEach(() => clearPostgresSnapshotCache());

  it("reuses one frozen copy while the database is unchanged and stamps each request's time", async () => {
    const token: { value: string | Error } = { value: "10:10:" };
    let loads = 0;
    const load = async () => snapshot(`load-${++loads}`);
    const first = await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    const second = await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:05:00.000Z", load);
    expect(loads).toBe(1);
    expect(second.stores).toBe(first.stores);
    expect([first.asOf, second.asOf]).toEqual(["2026-10-02T12:00:00.000Z", "2026-10-02T12:05:00.000Z"]);
    expect(Object.isFrozen(first.stores)).toBe(true);
    expect(Object.isFrozen(first.stores[0])).toBe(true);
    expect(() => { (first.stores as unknown[]).push({}); }).toThrow(TypeError);
  });

  it("reloads after any database write and keeps tenants and variants apart", async () => {
    const token: { value: string | Error } = { value: "10:10:" };
    let loads = 0;
    const load = async () => snapshot(`load-${++loads}`);
    await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    token.value = "10:11:";
    const changed = await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    expect(changed.stores[0].id).toBe("load-2");
    const otherTenant = await readCachedPostgresSnapshot(fakePool(token), "org-b", "full", "2026-10-02T12:00:00.000Z", load);
    const otherVariant = await readCachedPostgresSnapshot(fakePool(token), "org-a", "trends", "2026-10-02T12:00:00.000Z", load);
    expect([otherTenant.stores[0].id, otherVariant.stores[0].id]).toEqual(["load-3", "load-4"]);
  });

  it("shares one in-flight load and falls back to a direct read when no change token is available", async () => {
    const token: { value: string | Error } = { value: "10:10:" };
    let loads = 0;
    const load = async () => snapshot(`load-${++loads}`);
    await Promise.all([1, 2, 3].map(() => readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load)));
    expect(loads).toBe(1);
    token.value = new Error("function pg_current_snapshot() does not exist");
    await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    expect(loads).toBe(3);
  });

  it("does not keep a failed load", async () => {
    const token: { value: string | Error } = { value: "10:10:" };
    let attempts = 0;
    const load = async () => { attempts += 1; if (attempts === 1) throw new Error("database unavailable"); return snapshot("ok"); };
    await expect(readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load)).rejects.toThrow("database unavailable");
    const recovered = await readCachedPostgresSnapshot(fakePool(token), "org-a", "full", "2026-10-02T12:00:00.000Z", load);
    expect(recovered.stores[0].id).toBe("ok");
  });

  it("uses a PostgreSQL change token that moves on writes but not on reads", async () => {
    const db = new PGlite();
    const pool = { query: (sql: string, values?: unknown[]) => db.query(sql, values), async connect() { throw new Error("unused"); } } as unknown as PostgresPoolLike;
    await db.exec("CREATE TABLE t (id int)");
    const start = await readDatabaseChangeToken(pool);
    await db.query("SELECT * FROM t");
    expect(await readDatabaseChangeToken(pool)).toBe(start);
    await db.query("INSERT INTO t VALUES (1)");
    expect(await readDatabaseChangeToken(pool)).not.toBe(start);
    await db.close();
  });
});
