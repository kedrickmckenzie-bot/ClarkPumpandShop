import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";

const baseline = readFileSync("drizzle-postgres/0000_ops_platform_baseline.sql", "utf8");
const migrationRunner = readFileSync("scripts/migrate-postgres.ts", "utf8");
const d1FixtureRepair = readFileSync(
  "drizzle/0006_repair_northline_issuance_history.sql",
  "utf8",
);

describe("PostgreSQL migration and seed contract", () => {
  it("defers every audited forward fixture reference until the seed transaction commits", () => {
    const expectedDeferredConstraints = [
      "fk_ops_requests_converted_work",
      "fk_ops_work_orders_request",
      "fk_ops_work_orders_asset",
      "fk_ops_work_orders_component",
    ];

    for (const constraint of expectedDeferredConstraints) {
      expect(baseline).toMatch(new RegExp(
        `CONSTRAINT "${constraint}"[^;]+DEFERRABLE INITIALLY DEFERRED`,
        "i",
      ));
    }

    const fixture = buildNorthlinePresentationFixture();
    expect(fixture.requests.some((request) => request.convertedWorkOrderId)).toBe(true);
    expect(fixture.workOrders.some((workOrder) => workOrder.requestId)).toBe(true);
    expect(fixture.workOrders.some((workOrder) => workOrder.assetId)).toBe(true);
    expect(fixture.workOrders.some((workOrder) => workOrder.componentId)).toBe(true);
  });

  it("uses native PostgreSQL types while retaining the deterministic demo contract", () => {
    const fixture = buildNorthlinePresentationFixture();
    const statements = buildOpsSeedStatements(fixture);

    expect(baseline).toContain('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    expect(baseline).toContain('"idx_ops_stores_search_trgm"');
    expect(baseline).toContain('"idx_ops_vendors_search_trgm"');
    expect(baseline.match(/gin_trgm_ops/g)).toHaveLength(2);
    expect(baseline).toContain("jsonb");
    expect(baseline).toContain("boolean");
    expect(baseline).toContain("timestamp with time zone");
    expect(baseline).toContain("bigint");
    expect(fixture.stores).toHaveLength(15);
    expect(fixture.vendors).toHaveLength(5);
    expect(statements.length).toBeGreaterThan(2_000);
    expect(statements.some((statement) => statement.sql.includes("ops_work_order_counters"))).toBe(true);
    expect(baseline).toContain('CREATE TABLE "ops_idempotency_keys"');
  });

  it("serializes concurrent migration runners on one PostgreSQL session", () => {
    expect(migrationRunner).toContain("cstore-operations-postgres-migrations-v1");
    expect(migrationRunner).toContain("traceops-postgres-migrations-v1");
    expect(migrationRunner).toContain("pg_advisory_lock(hashtext($1))");
    expect(migrationRunner).toContain("pg_advisory_unlock(hashtext($1))");
    expect(migrationRunner).toContain("hash text NOT NULL UNIQUE");
    expect(migrationRunner.indexOf("pg_advisory_lock")).toBeLessThan(
      migrationRunner.indexOf("SELECT hash FROM drizzle.__drizzle_migrations"),
    );
  });

  it("repairs the already-hosted fictional D1 issuance before the V3 seed", () => {
    expect(d1FixtureRepair).toContain("response-northline-109-return");
    expect(d1FixtureRepair).toContain("issuance-northline-109-return-r1");
    expect(d1FixtureRepair).toContain("northline-ops-2026-08-10-v2");
    expect(d1FixtureRepair).not.toMatch(/DELETE FROM `ops_organizations`/);
  });
});
