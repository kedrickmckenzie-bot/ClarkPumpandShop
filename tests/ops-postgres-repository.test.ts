import { bindPostgresStatement } from "@/lib/ops/postgres-parameters";
import { describe, expect, it } from "vitest";
import {
  createOpsPostgresRepository,
  createOpsPostgresTransactionRepository,
  type PostgresClientLike,
  type PostgresPoolLike,
} from "@/lib/ops/postgres-repository";
import type { OpsStatement } from "@/lib/ops/repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

interface QueryCall {
  text: string;
  values: readonly unknown[];
}

interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
}

type QueryHandler = (
  text: string,
  values: readonly unknown[],
) => Promise<QueryResult> | QueryResult;

class FakePostgresClient implements PostgresClientLike {
  readonly calls: QueryCall[] = [];
  releaseCount = 0;

  constructor(private readonly handler: QueryHandler = () => ({ rows: [] })) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, values });
    const result = await this.handler(text, values);
    return { rows: result.rows as Row[] };
  }

  release() {
    this.releaseCount += 1;
  }
}

class FakePostgresPool implements PostgresPoolLike {
  readonly calls: QueryCall[] = [];
  connectCount = 0;

  constructor(
    readonly client: FakePostgresClient,
    private readonly handler: QueryHandler = () => ({ rows: [] }),
  ) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, values });
    const result = await this.handler(text, values);
    return { rows: result.rows as Row[] };
  }

  async connect(): Promise<PostgresClientLike> {
    this.connectCount += 1;
    return this.client;
  }
}

describe("PostgreSQL native statements", () => {
  it("numbers bind markers without rewriting question marks in SQL literals or identifiers", () => {
    const values = ["org-one", "store-one"] as const;
    const translated = bindPostgresStatement(
      `SELECT '?' AS literal_value, "?" AS literal_identifier
       FROM ops_stores
       WHERE organization_id = ? AND id = ?`,
      values,
    );

    expect(translated.text).toContain(`SELECT '?' AS literal_value, "?" AS literal_identifier`);
    expect(translated.text).toContain("organization_id = $1 AND id = $2");
    expect(translated.values).toEqual(values);
  });

  it("preserves idempotent seed semantics and PostgreSQL aggregate syntax", () => {
    const insert = bindPostgresStatement(
      "INSERT INTO ops_stores (id, organization_id, location_policy_enabled) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      ["store-one", "org-one", 1],
    );
    const aggregate = bindPostgresStatement(
      "SELECT string_agg(display_name, '|') AS specialties FROM ops_vendor_specialties WHERE organization_id = ?",
      ["org-one"],
    );

    expect(insert.text).toMatch(/^INSERT INTO ops_stores/i);
    expect(insert.text).toContain("VALUES ($1, $2, $3)");
    expect(insert.text).toMatch(/ON CONFLICT DO NOTHING\s*$/i);
    expect(insert.values).toEqual(["store-one", "org-one", true]);
    expect(aggregate.text).toContain("string_agg(display_name, '|')");
    expect(aggregate.text).toContain("organization_id = $1");
  });

  it("qualifies the work-order counter during PostgreSQL conflict updates", () => {
    const counter = bindPostgresStatement(
      "INSERT INTO ops_work_order_counters (organization_id, counter_year, next_value) VALUES (?, ?, 2) ON CONFLICT(organization_id, counter_year) DO UPDATE SET next_value = ops_work_order_counters.next_value + 1 RETURNING next_value - 1 AS allocated",
      ["org-one", 2026],
    );

    expect(counter.text).toContain(
      "SET next_value = ops_work_order_counters.next_value + 1",
    );
  });
});

describe("PostgreSQL repository boundary", () => {
  it("builds native aggregate and JSON queries before binding parameters", async () => {
    const pool = new FakePostgresPool(new FakePostgresClient());
    const repository = createOpsPostgresRepository(pool);
    await repository.listVendors({ organizationId: "org-one" });
    await repository.listWorkOrders({ organizationId: "org-one" }, { categoryPath: ["Refrigeration", "Beer caves"] });
    expect(pool.calls.some(call => call.text.includes("string_agg(display_name, '|')"))).toBe(true);
    expect(pool.calls.some(call => call.text.includes("wa.group_path_json::jsonb ->> 0"))).toBe(true);
    expect(pool.calls.every(call => !/group_concat|json_extract|INSERT OR IGNORE/.test(call.text))).toBe(true);
    expect(pool.calls.every(call => call.values[0] === "org-one")).toBe(true);
  });

  it("reuses an owned transaction without nesting or releasing it", async () => {
    const client = new FakePostgresClient();
    const repository = createOpsPostgresTransactionRepository(client);
    await repository.getStore("org-one", "store-one");
    await repository.atomicWrite([{ sql: "DELETE FROM ops_saved_views WHERE organization_id = ? AND id = ?", params: ["org-one", "view-one"] }]);
    expect(client.calls).toHaveLength(2);
    expect(client.calls.some(call => /^(BEGIN|COMMIT|ROLLBACK)$/.test(call.text))).toBe(false);
    expect(client.releaseCount).toBe(0);
  });
  it("keeps the full fixture seed in one transaction for deferred forward references", async () => {
    const client = new FakePostgresClient();
    const pool = new FakePostgresPool(client);
    const repository = createOpsPostgresRepository(pool);
    const statements = buildOpsSeedStatements(buildNorthlinePresentationFixture());

    await repository.atomicWrite(statements);

    expect(pool.connectCount).toBe(1);
    expect(client.calls[0].text).toBe("BEGIN");
    expect(client.calls.at(-1)?.text).toBe("COMMIT");
    expect(client.calls).toHaveLength(statements.length + 2);
  });

  it("binds organization before record id and normalizes native PostgreSQL values", async () => {
    const createdAt = new Date("2026-08-10T12:34:56.000Z");
    const pool = new FakePostgresPool(
      new FakePostgresClient(),
      (text) => {
        if (!text.includes("FROM ops_stores")) return { rows: [] };
        return {
          rows: [{
            id: "store-shared-id",
            organization_id: "org-allowed",
            division_id: null,
            region_id: "region-one",
            store_number: "101",
            name: "Allowed Store",
            address_1: "101 Market Way",
            address_2: null,
            city: "Cedar Grove",
            state: "MI",
            postal_code: "49001",
            aliases_json: ["highway store", "north side"],
            latitude_e6: 42_100_000,
            longitude_e6: -85_600_000,
            geofence_radius_m: 200,
            location_policy_enabled: true,
            time_zone: "America/Detroit",
            status: "active",
            created_at: createdAt,
          }],
        };
      },
    );
    const repository = createOpsPostgresRepository(pool);

    expect(repository.kind).toBe("postgres");
    const store = await repository.getStore("org-allowed", "store-shared-id");

    expect(pool.calls).toHaveLength(1);
    expect(pool.calls[0].text).toContain("organization_id = $1 AND id = $2");
    expect(pool.calls[0].values).toEqual(["org-allowed", "store-shared-id"]);
    expect(store).toMatchObject({
      organizationId: "org-allowed",
      id: "store-shared-id",
      aliases: ["highway store", "north side"],
      locationPolicyEnabled: true,
      createdAt: "2026-08-10T12:34:56.000Z",
    });
  });

  it("commits every statement in one client transaction and always releases the client", async () => {
    const client = new FakePostgresClient();
    const pool = new FakePostgresPool(client);
    const repository = createOpsPostgresRepository(pool);
    const statements: OpsStatement[] = [
      {
        sql: "INSERT INTO ops_requests (id, organization_id, problem) VALUES (?, ?, ?)",
        params: ["request-one", "org-one", "Cooler is warm"],
      },
      {
        sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_id) VALUES (?, ?, ?)",
        params: ["audit-one", "org-one", "request-one"],
      },
    ];

    await repository.atomicWrite(statements);

    expect(pool.connectCount).toBe(1);
    expect(client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      "INSERT INTO ops_requests (id, organization_id, problem) VALUES ($1, $2, $3)",
      "INSERT INTO ops_audit_events (id, organization_id, aggregate_id) VALUES ($1, $2, $3)",
      "COMMIT",
    ]);
    expect(client.calls[1].values).toEqual(statements[0].params);
    expect(client.calls[2].values).toEqual(statements[1].params);
    expect(client.releaseCount).toBe(1);
  });

  it("rolls back a failed atomic write and releases the checked-out client", async () => {
    const expectedError = new Error("simulated statement failure");
    const client = new FakePostgresClient((text) => {
      if (text.includes("ops_outbox_messages")) throw expectedError;
      return { rows: [] };
    });
    const repository = createOpsPostgresRepository(new FakePostgresPool(client));

    await expect(repository.atomicWrite([
      {
        sql: "INSERT INTO ops_work_orders (id, organization_id) VALUES (?, ?)",
        params: ["work-one", "org-one"],
      },
      {
        sql: "INSERT INTO ops_outbox_messages (id, organization_id) VALUES (?, ?)",
        params: ["outbox-one", "org-one"],
      },
    ])).rejects.toBe(expectedError);

    expect(client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      "INSERT INTO ops_work_orders (id, organization_id) VALUES ($1, $2)",
      "INSERT INTO ops_outbox_messages (id, organization_id) VALUES ($1, $2)",
      "ROLLBACK",
    ]);
    expect(client.releaseCount).toBe(1);
  });
});
