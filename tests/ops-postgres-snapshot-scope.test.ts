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
