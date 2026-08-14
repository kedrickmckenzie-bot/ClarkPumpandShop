import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import {
  assignWorkOrder,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import {
  createOpsPostgresRepository,
  type PostgresClientLike,
  type PostgresPoolLike,
  type PostgresQueryResult,
} from "@/lib/ops/postgres-repository";
import { seedOpsRepository } from "@/lib/ops/seed";

class PGliteClient implements PostgresClientLike {
  constructor(private readonly database: PGlite) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const result = await this.database.query<Row>(text, [...values]);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }

  release() {}
}

class PGlitePool implements PostgresPoolLike {
  constructor(private readonly database: PGlite) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return new PGliteClient(this.database).query<Row>(text, values);
  }

  async connect(): Promise<PostgresClientLike> {
    // PGlite is a single embedded connection, so this lock keeps concurrent
    // Promise.all callers from interleaving with an active transaction.
    const transactionLock = await this.database.query("SELECT pg_advisory_lock(8142026)");
    void transactionLock;
    const client = new PGliteClient(this.database);
    return {
      query: client.query.bind(client),
      release: () => { void this.database.query("SELECT pg_advisory_unlock(8142026)"); },
    };
  }
}

describe.sequential("PostgreSQL migration and deterministic seed on a real engine", () => {
  let database: PGlite;
  let pool: PGlitePool;

  beforeAll(async () => {
    database = new PGlite();
    pool = new PGlitePool(database);
    const migrationFiles = (await readdir("drizzle-postgres"))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    const statements = (await Promise.all(migrationFiles.map((name) => readFile(`drizzle-postgres/${name}`, "utf8"))))
      .flatMap((migration) => migration.split("--> statement-breakpoint"))
      .map((statement) => statement.trim())
      .filter(Boolean)
      // PGlite intentionally ships without pg_trgm. Render PostgreSQL supports
      // it; this embedded-engine check exercises every other migration,
      // constraint, seed, and repository path.
      .filter((statement) => !/pg_trgm|gin_trgm_ops/i.test(statement));
    await database.transaction(async (transaction) => {
      for (const statement of statements) await transaction.exec(statement);
    });
  }, 120_000);

  afterAll(async () => {
    await database.close();
  });

  it("applies every migration constraint and seeds the complete showcase atomically", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);

    await seedOpsRepository(repository, fixture);

    const counts = await database.query<{
      stores: number;
      vendors: number;
      work_orders: number;
      visits: number;
    }>(`SELECT
      (SELECT count(*)::int FROM ops_stores) AS stores,
      (SELECT count(*)::int FROM ops_vendors) AS vendors,
      (SELECT count(*)::int FROM ops_work_orders) AS work_orders,
      (SELECT count(*)::int FROM ops_visit_sessions) AS visits`);
    expect(counts.rows[0]).toEqual({
      stores: fixture.stores.length,
      vendors: fixture.vendors.length,
      work_orders: fixture.workOrders.length,
      visits: fixture.visits.length,
    });

    const store = await repository.getStore(
      fixture.organizations[0].id,
      fixture.stores[0].id,
    );
    expect(store).toMatchObject({
      id: fixture.stores[0].id,
      organizationId: fixture.organizations[0].id,
      aliases: fixture.stores[0].aliases,
    });

    // The seed is restartable and must not duplicate source facts.
    await seedOpsRepository(repository, fixture);
    const workOrderCount = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM ops_work_orders",
    );
    expect(workOrderCount.rows[0]?.count).toBe(fixture.workOrders.length);
  }, 120_000);

  it("enforces organization-aware foreign keys", async () => {
    await expect(database.query(
      `INSERT INTO ops_work_orders
        (id, organization_id, number, store_id, problem, priority, status,
         accountable_party, next_action, created_at)
       VALUES
        ('cross-tenant-work', 'org-other', 'OTHER-2026-0001', $1,
         'Should fail', 'routine', 'draft', 'Facilities', 'Review', now())`,
      [buildNorthlinePresentationFixture().stores[0].id],
    )).rejects.toThrow();
  });

  it("runs the canonical work-order issuance flow against PostgreSQL", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);

    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => "2026-08-13T14:00:00.000Z" },
      ids: { next: (prefix) => `${prefix}-pg-mutation-${++sequence}` },
    };
    const organizationId = fixture.organizations[0].id;
    const store = fixture.stores[0];
    const vendor = fixture.vendors.find((item) => item.id === "vendor-northline-summit");
    expect(vendor).toBeDefined();
    const actor = {
      organizationId,
      actorType: "user" as const,
      actorId: "membership-northline-facilities",
      actorName: "PostgreSQL integration test",
    };

    const workOrder = await createWorkOrder(services, {
      organizationId,
      storeId: store.id,
      problem: "Walk-in cooler temperature is trending high.",
      authorizedScope: "Inspect and report findings before exceeding the NTE.",
      priority: "urgent",
      accountableParty: "Facilities coordinator",
      nextAction: "Select provider",
      nteAmountMinor: 125_000,
      actor,
    });
    const assignment = await assignWorkOrder(services, {
      organizationId,
      workOrderId: workOrder.id,
      kind: "outside_vendor",
      vendorId: vendor!.id,
      actor,
    });
    const issuance = await issueWorkOrder(services, {
      organizationId,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      revision: 1,
      channel: "email",
      authorizationSnapshot: {
        organizationName: fixture.organizations[0].name,
        workOrderNumber: workOrder.number,
        store: {
          id: store.id,
          storeNumber: store.storeNumber,
          name: store.name,
          formattedAddress: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
        },
        vendor: { id: vendor!.id, name: vendor!.name },
        problem: workOrder.problem,
        priority: workOrder.priority,
        authorizedScope: workOrder.authorizedScope,
        nte: workOrder.nte,
        billingInstruction: `Reference operator work order ${workOrder.number} on all service tickets and invoices.`,
      },
      actor,
    });
    await recordVendorResponse(services, {
      organizationId,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      issuanceId: issuance.id,
      response: "accepted",
      responderName: "Summit Dispatch",
      actor: {
        ...actor,
        actorType: "vendor_link",
        actorId: undefined,
        actorName: "Summit Dispatch",
      },
    });

    expect(workOrder.number).toMatch(/^NL-2026-\d{4}$/);
    await expect(repository.getWorkOrder(organizationId, workOrder.id)).resolves.toMatchObject({
      id: workOrder.id,
      status: "accepted",
      categoryKey: undefined,
      assetId: undefined,
      accountableParty: "Outside vendor",
    });
    await expect(repository.getLatestVendorResponse(organizationId, assignment.id)).resolves.toMatchObject({
      issuanceId: issuance.id,
      response: "accepted",
      responderName: "Summit Dispatch",
    });
  }, 120_000);
});
