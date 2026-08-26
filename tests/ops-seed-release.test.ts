import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import {
  ensureNorthlinePostgresSeed,
  NORTHLINE_POSTGRES_SEED_LOCK_KEY,
  NORTHLINE_POSTGRES_SEED_LOCK_KEYS,
  NORTHLINE_POSTGRES_SEED_VERSION,
} from "@/lib/ops/northline-postgres-bootstrap";
import {
  buildNorthlineCompatibilityAmendments,
  buildNorthlineCompatibilityMarker,
  buildNorthlineCurrentSeedMarker,
  NORTHLINE_BOOTSTRAP_COMMAND,
  NORTHLINE_COMPATIBILITY_COMMAND,
  NORTHLINE_SEED_COMPATIBILITY_MARKER,
  NORTHLINE_SEED_VERSION,
  planNorthlineSeedRelease,
  type NorthlineSeedMarkerRow,
} from "@/lib/ops/northline-seed-release";
import type {
  PostgresClientLike,
  PostgresPoolLike,
  PostgresQueryResult,
} from "@/lib/ops/postgres-repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";

type RecordedQuery = {
  text: string;
  values: readonly unknown[];
};

class RecordingPostgresClient implements PostgresClientLike {
  readonly queries: RecordedQuery[] = [];
  released = false;

  constructor(public markers: NorthlineSeedMarkerRow[]) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push({ text, values });
    if (/SELECT key, command, result_id FROM ops_idempotency_keys/i.test(text)) {
      return { rows: this.markers as unknown as Row[] };
    }
    return { rows: [], rowCount: /^\s*INSERT/i.test(text) ? 1 : 0 };
  }

  release() {
    this.released = true;
  }
}

class RecordingPostgresPool implements PostgresPoolLike {
  constructor(readonly client: RecordingPostgresClient) {}

  async connect() {
    return this.client;
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return this.client.query<Row>(text, values);
  }
}

describe("Northline deterministic seed release", () => {
  it("uses one explicit release decision for fresh, current, and preserved databases", () => {
    expect(NORTHLINE_POSTGRES_SEED_VERSION).toBe(NORTHLINE_SEED_VERSION);
    expect(planNorthlineSeedRelease([])).toEqual({ kind: "seed_current" });
    expect(planNorthlineSeedRelease([{
      key: NORTHLINE_SEED_VERSION,
      command: NORTHLINE_BOOTSTRAP_COMMAND,
    }])).toEqual({ kind: "already_current" });
    expect(planNorthlineSeedRelease([{
      key: NORTHLINE_SEED_COMPATIBILITY_MARKER,
      command: NORTHLINE_COMPATIBILITY_COMMAND,
    }])).toEqual({ kind: "already_enriched" });
    expect(planNorthlineSeedRelease([{
      key: "northline-ops-2026-08-15-v9",
      command: NORTHLINE_BOOTSTRAP_COMMAND,
    }])).toEqual({
      kind: "enrich_existing",
      sourceVersion: "northline-ops-2026-08-15-v9",
    });

    expect(buildNorthlineCurrentSeedMarker().params[1]).toBe(NORTHLINE_SEED_VERSION);
    expect(buildNorthlineCompatibilityMarker("northline-ops-2026-08-15-v9").params.slice(0, 5))
      .toEqual([
        expect.any(String),
        NORTHLINE_SEED_COMPATIBILITY_MARKER,
        NORTHLINE_COMPATIBILITY_COMMAND,
        "northline-ops-2026-08-15-v9",
        NORTHLINE_SEED_VERSION,
      ]);
  });

  it("writes the complete v13 fixture and full-version marker to a fresh PostgreSQL database", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const expectedSourceStatements = buildOpsSeedStatements(fixture);
    const client = new RecordingPostgresClient([]);

    const result = await ensureNorthlinePostgresSeed(new RecordingPostgresPool(client));

    expect(result).toMatchObject({
      seeded: true,
      statements: expectedSourceStatements.length + 1,
      organizations: 1,
      stores: 15,
      vendors: 5,
    });
    const inserts = client.queries.filter((query) => /^\s*INSERT/i.test(query.text));
    expect(inserts).toHaveLength(expectedSourceStatements.length + 1);
    expect(inserts.some((query) => /INTO ops_request_impact_assessments/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_approval_requests/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_site_visit_work_orders/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_work_order_verifications/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_workflow_tasks/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_service_appointments/i.test(query.text))).toBe(true);
    expect(inserts.some((query) => /INTO ops_vendor_continuations/i.test(query.text))).toBe(false);
    const continuationFixture = structuredClone(fixture);
    (continuationFixture.vendorContinuations ??= []).push({
      id: "continuation-seed-contract",
      organizationId: fixture.organizations[0]!.id,
      workOrderId: "wo-current-113-freezer-service",
      vendorResponseId: "response-current-113-proposed-date",
      action: "accept_date",
      createdByMembershipId: "membership-northline-facilities",
      createdAt: fixture.asOf,
    });
    expect(buildOpsSeedStatements(continuationFixture).some((statement) => /INTO ops_vendor_continuations/i.test(statement.sql))).toBe(true);
    expect(inserts.some((query) => /INTO ops_requests/i.test(query.text) && query.values[0] === "request-current-104-beer-cave-door")).toBe(true);
    expect(inserts.some((query) => /INTO ops_request_impact_assessments/i.test(query.text) && query.values[0] === "impact-request-current-104-beer-cave-door-review")).toBe(true);
    expect(inserts.some((query) => /INTO ops_workflow_tasks/i.test(query.text) && query.values[0] === "workflow-task-request-current-104-beer-cave-door-review")).toBe(true);
    expect(inserts.some((query) => /INTO ops_approval_requests/i.test(query.text) && query.values[0] === "approval-request-104-pending")).toBe(true);
    const completionMarker = inserts.at(-1)!;
    expect(completionMarker.text).toMatch(/INTO ops_idempotency_keys/i);
    expect(completionMarker.values).toContain(NORTHLINE_SEED_VERSION);
    const acquiredLocks = client.queries.filter((query) => /SELECT pg_advisory_lock/i.test(query.text));
    const releasedLocks = client.queries.filter((query) => /SELECT pg_advisory_unlock/i.test(query.text));
    expect(NORTHLINE_POSTGRES_SEED_LOCK_KEY).not.toBe(NORTHLINE_POSTGRES_SEED_VERSION);
    expect(acquiredLocks.map((query) => query.values[0])).toEqual(NORTHLINE_POSTGRES_SEED_LOCK_KEYS);
    expect(releasedLocks.map((query) => query.values[0])).toEqual([...NORTHLINE_POSTGRES_SEED_LOCK_KEYS].reverse());
    expect(client.queries.map((query) => query.text.trim())).toContain("COMMIT");
    expect(client.released).toBe(true);
  });

  it("enriches a completed v9 database with missing rows and exact guarded amendments without claiming an exact v13 seed", async () => {
    const legacyVersion = "northline-ops-2026-08-15-v9";
    const client = new RecordingPostgresClient([{
      key: legacyVersion,
      command: NORTHLINE_BOOTSTRAP_COMMAND,
      result_id: "org-northline-demo",
    }]);

    const result = await ensureNorthlinePostgresSeed(new RecordingPostgresPool(client));

    expect(result).toMatchObject({ seeded: true, enrichedExisting: true, sourceVersion: legacyVersion, stores: 15, vendors: 5 });
    const inserts = client.queries.filter((query) => /^\s*INSERT/i.test(query.text));
    expect(inserts).toHaveLength(buildOpsSeedStatements(buildNorthlinePresentationFixture()).length + 1);
    const receipt = inserts.at(-1)!;
    expect(receipt.text).toMatch(/INTO ops_idempotency_keys/i);
    expect(receipt.values).toContain(NORTHLINE_SEED_COMPATIBILITY_MARKER);
    expect(receipt.values).toContain(NORTHLINE_COMPATIBILITY_COMMAND);
    expect(receipt.values).toContain(legacyVersion);
    expect(receipt.values[1]).not.toBe(NORTHLINE_SEED_VERSION);
    const updates = client.queries.filter((query) => /^\s*UPDATE/i.test(query.text));
    expect(updates).toHaveLength(buildNorthlineCompatibilityAmendments().length);
    expect(updates[0].text).toMatch(/UPDATE ops_asset_components/);
    expect(updates[0].text).toMatch(/serial_number = \$1/);
    expect(updates[0].values).toContain("CMP104-88214");
    expect(updates[0].values).toContain("CMP104-2026-0710");
    expect(client.queries.some((query) => /^\s*DELETE/i.test(query.text))).toBe(false);
    expect(inserts.some((query) => /INTO ops_component_lifecycle_events/i.test(query.text))).toBe(true);
    expect(client.queries.map((query) => query.text.trim())).toContain("COMMIT");
    expect(client.released).toBe(true);
  });
});
