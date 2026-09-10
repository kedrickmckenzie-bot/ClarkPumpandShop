import { describe, expect, it } from "vitest";
import { loadOpsFixtureSnapshotFromPostgres } from "@/lib/ops/postgres-snapshot";
import type { PostgresPoolLike } from "@/lib/ops/postgres-repository";

describe("PostgreSQL presenter snapshots", () => {
  it("does not query operational tables outside an explicitly bounded projection", async () => {
    const statements: string[] = [];
    const pool: PostgresPoolLike = {
      async query(text) {
        statements.push(text);
        return { rows: [] };
      },
      async connect() {
        throw new Error("not used");
      },
    };

    const fixture = await loadOpsFixtureSnapshotFromPostgres(
      pool,
      "org-test",
      "2026-08-25T18:00:00.000Z",
      { includedTables: new Set(["ops_stores", "ops_work_orders"]) },
    );

    expect(statements).toEqual([
      "SELECT * FROM ops_organizations WHERE id = $1",
      "SELECT * FROM ops_stores WHERE organization_id = $1",
      "SELECT * FROM ops_work_orders WHERE organization_id = $1",
    ]);
    expect(fixture.stores).toEqual([]);
    expect(fixture.workOrders).toEqual([]);
    expect(fixture.auditEvents).toEqual([]);
    expect(statements.some((statement) => statement.includes("ops_audit_events"))).toBe(false);
  });
});


it("loads only coverage events with both organization and event-type predicates", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const pool = { async query(sql: string, values: readonly unknown[] = []) { calls.push({ sql, values }); return { rows: [] }; }, async connect() { throw new Error("unused"); } } as PostgresPoolLike;
  await loadOpsFixtureSnapshotFromPostgres(pool, "org-one", "2026-08-25T18:00:00Z", { includedTables: new Set(["ops_stores"]), auditEventTypes: ["recording.coverage_attested"] });
  expect(calls.filter((call) => call.sql.includes("ops_audit_events"))).toEqual([{ sql: "SELECT * FROM ops_audit_events WHERE organization_id = $1 AND event_type = ANY($2::text[])", values: ["org-one", ["recording.coverage_attested"]] }]);
  expect(calls).toHaveLength(3);
});
