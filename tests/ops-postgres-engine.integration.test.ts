import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { recordApprovalDecision } from "@/lib/ops/approval-governance";
import {
  assignWorkOrder,
  checkInVisit,
  checkOutVisit,
  createServiceRequest,
  createWorkOrder,
  issueWorkOrder,
  recordVendorResponse,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "@/lib/ops/commands";
import {
  createOpsPostgresRepository,
  type PostgresClientLike,
  type PostgresPoolLike,
  type PostgresQueryResult,
} from "@/lib/ops/postgres-repository";
import { seedOpsRepository } from "@/lib/ops/seed";
import {
  reviewRequestImpactAssessment,
  type RequestImpactAssessmentDraft,
} from "@/lib/ops/request-impact-assessment";
import { recordWorkOrderVerification } from "@/lib/ops/work-order-verification-commands";
import type { ServiceRequest, WorkOrder } from "@/lib/ops/types";

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

    const estimateRequests = await repository.listEstimateRequestsForWorkOrder(
      fixture.organizations[0].id,
      "wo-northline-105-price-check",
    );
    expect(estimateRequests).toHaveLength(2);
    await expect(repository.getLatestEstimateProposal(
      fixture.organizations[0].id,
      "estimate-request-105-cedar",
    )).resolves.toMatchObject({
      workOrderId: "wo-northline-105-price-check",
      vendorId: "vendor-northline-cedar",
      revision: 1,
      amount: { amountMinor: 178_000, currency: "USD" },
    });
    await expect(repository.getEstimateRequest(
      "org-other",
      "estimate-request-105-cedar",
    )).resolves.toBeNull();

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

  it("rejects blank approval-policy currency values", async () => {
    const organizationId = buildNorthlinePresentationFixture().organizations[0].id;

    await expect(database.query(
      `INSERT INTO ops_approval_policies
        (id, organization_id, policy_key, version, name, scope_kind, scope_id,
         min_amount_minor, currency, required_role, status, created_at)
       VALUES
        ('approval-policy-blank-currency', $1, 'blank-currency', 1,
         'Blank currency must fail', 'organization', $1, 0, '   ',
         'facilities_admin', 'active', now())`,
      [organizationId],
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
    expect(workOrder).toMatchObject({
      status: "awaiting_approval",
      approvalRequest: {
        requiredRole: "regional_manager",
        policyKey: "regional-service",
      },
    });
    await recordApprovalDecision(services, {
      organizationId,
      approvalRequestId: workOrder.approvalRequest!.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-regional-1",
      reason: "Urgent refrigeration work is within the regional service allowance.",
      actor: {
        organizationId,
        actorType: "user",
        actorId: "membership-northline-regional-1",
        actorName: "Avery Brooks",
      },
    });
    await expect(repository.getWorkOrder(organizationId, workOrder.id)).resolves.toMatchObject({
      status: "approved",
      nextAction: "Issue service authorization",
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

  it("runs the complete Wave 1 reactive loop against PostgreSQL", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);
    const organizationId = fixture.organizations[0].id;
    const store = fixture.stores.find((candidate) => candidate.id === "store-northline-101")!;
    const vendor = fixture.vendors.find((candidate) => candidate.id === "vendor-northline-summit")!;
    let currentTime = "2026-08-20T12:00:00.000Z";
    let sequence = 0;
    let tokenSequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => currentTime },
      ids: { next: (prefix) => `${prefix}-pg-wave1-${String(++sequence).padStart(4, "0")}` },
    };
    const advance = (minutes: number) => {
      currentTime = new Date(Date.parse(currentTime) + minutes * 60_000).toISOString();
    };
    const facilitiesActor = {
      organizationId,
      actorType: "user" as const,
      actorId: "membership-northline-facilities",
      actorName: "Jordan Lee",
    };
    const regionalActor = {
      organizationId,
      actorType: "user" as const,
      actorId: "membership-northline-regional-1",
      actorName: "Avery Brooks",
    };
    const technicianActor = {
      organizationId,
      actorType: "technician" as const,
      actorName: "Morgan Ellis",
    };
    const impact: RequestImpactAssessmentDraft = {
      storeOperatingState: "partially_operational",
      safetyConcern: "none_reported",
      productInventoryRisk: "at_risk",
      customersAffected: "yes",
      complianceImpact: "potential",
      redundantEquipment: "no",
      revenueFunctionImpact: "refrigerated_merchandise",
      confidence: "medium",
      source: "store_report",
      notes: "Store-reported facts; estimates are not verified losses.",
    };

    async function reviewedRequest(problem: string, reporterName: string) {
      const request = await createServiceRequest(services, {
        organizationId,
        storeId: store.id,
        reporterName,
        problem,
        priority: "urgent",
        impact,
        actor: { organizationId, actorType: "store_device", actorName: reporterName },
      });
      advance(5);
      await reviewRequestImpactAssessment(services, {
        organizationId,
        requestId: request.id,
        expectedRequestStatus: "submitted",
        expectedLatestAssessmentId: request.impactAssessment.id,
        disposition: "confirmed",
        assessment: { ...impact, confidence: "high", source: "manager_review" },
        actor: facilitiesActor,
      });
      return request;
    }

    async function approvedWork(request: ServiceRequest, scope: string): Promise<WorkOrder> {
      advance(5);
      const workOrder = await createWorkOrder(services, {
        organizationId,
        storeId: store.id,
        requestId: request.id,
        problem: request.problem,
        authorizedScope: scope,
        categoryKey: "refrigeration",
        priority: "urgent",
        accountableParty: "Facilities coordinator",
        nextAction: "Assign service provider",
        nteAmountMinor: 125_000,
        actor: facilitiesActor,
      });
      expect(workOrder.approvalRequest).toMatchObject({ requiredRole: "regional_manager" });
      advance(5);
      await recordApprovalDecision(services, {
        organizationId,
        approvalRequestId: workOrder.approvalRequest!.id,
        decision: "approved",
        deciderMembershipId: regionalActor.actorId,
        reason: "Urgent refrigeration work reviewed against policy.",
        actor: regionalActor,
      });
      return (await repository.getWorkOrder(organizationId, workOrder.id))!;
    }

    async function authorize(workOrder: WorkOrder) {
      advance(5);
      const assignment = await assignWorkOrder(services, {
        organizationId,
        workOrderId: workOrder.id,
        kind: "outside_vendor",
        vendorId: vendor.id,
        actor: facilitiesActor,
      });
      const current = (await repository.getWorkOrder(organizationId, workOrder.id))!;
      advance(5);
      const issuance = await issueWorkOrder(services, {
        organizationId,
        workOrderId: current.id,
        assignmentId: assignment.id,
        revision: 1,
        channel: "email",
        authorizationSnapshot: {
          organizationName: fixture.organizations[0].name,
          workOrderNumber: current.number,
          store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}` },
          vendor: { id: vendor.id, name: vendor.name },
          problem: current.problem,
          priority: current.priority,
          authorizedScope: current.authorizedScope,
          categoryKey: current.categoryKey,
          requestedTiming: current.dueAt,
          nte: current.nte,
          billingInstruction: `Reference operator work order ${current.number} on service paperwork and invoices.`,
        },
        publicToken: { tokenHash: (++tokenSequence).toString(16).padStart(64, "0"), expiresAt: "2026-09-20T12:00:00.000Z" },
        actor: facilitiesActor,
      });
      advance(5);
      await recordVendorResponse(services, {
        organizationId,
        workOrderId: current.id,
        assignmentId: assignment.id,
        issuanceId: issuance.id,
        response: "accepted",
        responderName: "Summit Dispatch",
        actor: { organizationId, actorType: "vendor_link", actorName: "Summit Dispatch" },
      });
    }

    const requestOne = await reviewedRequest("Beer-cave fan is grinding and product temperature is rising.", "Avery Clerk");
    const requestTwo = await reviewedRequest("Freezer door heater is icing and the door will not seal.", "Casey Clerk");
    const workOne = await approvedWork(requestOne, "Restore the beer-cave fan and verify temperature pull-down.");
    const workTwo = await approvedWork(requestTwo, "Repair the door-heater circuit and verify a complete seal.");
    await authorize(workOne);
    await authorize(workTwo);

    currentTime = "2026-08-21T13:00:00.000Z";
    const visit = await checkInVisit(services, {
      organizationId,
      storeId: store.id,
      workOrderIds: [workOne.id, workTwo.id],
      technicianName: "Morgan Ellis",
      technicianPhoneOrPin: "TECH-417",
      crewCount: 2,
      additionalTechnicianNames: ["Riley Chen"],
      vehicleIdentifier: "SUMMIT-12",
      arrivalNote: "Store manager provided access to both refrigeration areas.",
      purpose: "Complete both assigned refrigeration repairs.",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: currentTime },
      actor: technicianActor,
    });
    currentTime = "2026-08-21T15:00:00.000Z";
    const checkout = await checkOutVisit(services, {
      organizationId,
      visitId: visit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [
        { workOrderId: workOne.id, outcome: "completed", outcomeNotes: "Fan replaced and pull-down confirmed." },
        { workOrderId: workTwo.id, outcome: "completed", outcomeNotes: "Door-heater relay replaced and seal observed." },
      ],
      location: { result: "trusted_store_device", capturedAt: currentTime },
      actor: technicianActor,
    });
    const outcomeOne = checkout.siteVisitWorkOrders.find((record) => record.workOrderId === workOne.id)!;
    const outcomeTwo = checkout.siteVisitWorkOrders.find((record) => record.workOrderId === workTwo.id)!;
    let currentOne = (await repository.getWorkOrder(organizationId, workOne.id))!;
    let currentTwo = (await repository.getWorkOrder(organizationId, workTwo.id))!;
    advance(20);
    await recordWorkOrderVerification(services, {
      organizationId,
      workOrderId: workOne.id,
      expectedWorkOrderVersion: currentOne.version ?? 0,
      expectedSiteVisitWorkOrderId: outcomeOne.id,
      expectedOutcomeRecordedAt: outcomeOne.outcomeRecordedAt!,
      decision: "verified",
      reason: "Store confirmed stable operation.",
      actor: facilitiesActor,
    });
    await recordWorkOrderVerification(services, {
      organizationId,
      workOrderId: workTwo.id,
      expectedWorkOrderVersion: currentTwo.version ?? 0,
      expectedSiteVisitWorkOrderId: outcomeTwo.id,
      expectedOutcomeRecordedAt: outcomeTwo.outcomeRecordedAt!,
      decision: "rejected",
      reason: "Door icing returned during normal use.",
      actor: facilitiesActor,
    });
    advance(10);
    await updateWorkOrderControl(services, {
      organizationId,
      workOrderId: workOne.id,
      expectedStatus: "resolved",
      status: "closed",
      note: "Verified repair closed with no remaining obligation.",
      actor: facilitiesActor,
    });

    currentTime = "2026-08-22T13:00:00.000Z";
    const returnVisit = await checkInVisit(services, {
      organizationId,
      storeId: store.id,
      workOrderIds: [workTwo.id],
      technicianName: "Morgan Ellis",
      crewCount: 1,
      arrivalNote: "Return after internal rejection.",
      purpose: "Correct recurring freezer-door icing.",
      channel: "store_device",
      location: { result: "trusted_store_device", capturedAt: currentTime },
      actor: technicianActor,
    });
    currentTime = "2026-08-22T14:00:00.000Z";
    const returnCheckout = await checkOutVisit(services, {
      organizationId,
      visitId: returnVisit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [{ workOrderId: workTwo.id, outcome: "completed", outcomeNotes: "Heater termination replaced; door remained clear and sealed." }],
      location: { result: "trusted_store_device", capturedAt: currentTime },
      actor: technicianActor,
    });
    currentTwo = (await repository.getWorkOrder(organizationId, workTwo.id))!;
    advance(20);
    const accepted = await recordWorkOrderVerification(services, {
      organizationId,
      workOrderId: workTwo.id,
      expectedWorkOrderVersion: currentTwo.version ?? 0,
      expectedSiteVisitWorkOrderId: returnCheckout.siteVisitWorkOrders[0]!.id,
      expectedOutcomeRecordedAt: returnCheckout.siteVisitWorkOrders[0]!.outcomeRecordedAt!,
      decision: "verified",
      reason: "Store confirmed the return repair under normal use.",
      actor: facilitiesActor,
    });
    expect(accepted.cycle).toBe(2);
    advance(10);
    await updateWorkOrderControl(services, {
      organizationId,
      workOrderId: workTwo.id,
      expectedStatus: "resolved",
      status: "closed",
      note: "Return repair verified and closed.",
      actor: facilitiesActor,
    });

    currentOne = (await repository.getWorkOrder(organizationId, workOne.id))!;
    currentTwo = (await repository.getWorkOrder(organizationId, workTwo.id))!;
    expect([currentOne.status, currentTwo.status]).toEqual(["closed", "closed"]);
    const persistedVisit = await database.query<{ vendor_id: string; work_order_id: string | null; crew_count: number }>(
      "SELECT vendor_id, work_order_id, crew_count FROM ops_visit_sessions WHERE organization_id = $1 AND id = $2",
      [organizationId, visit.id],
    );
    expect(persistedVisit.rows[0]).toEqual({ vendor_id: vendor.id, work_order_id: null, crew_count: 2 });
    const facts = await database.query<{ links: number; evidence: number; impacts: number; open_tasks: number }>(
      `SELECT
        (SELECT count(*)::int FROM ops_site_visit_work_orders WHERE organization_id = $1 AND visit_id = $2) AS links,
        (SELECT count(*)::int FROM ops_visit_evidence WHERE organization_id = $1 AND visit_id = $2) AS evidence,
        (SELECT count(*)::int FROM ops_request_impact_assessments WHERE organization_id = $1 AND request_id IN ($3, $4)) AS impacts,
        (SELECT count(*)::int FROM ops_workflow_tasks WHERE organization_id = $1 AND work_order_id IN ($5, $6) AND status IN ('open', 'in_progress')) AS open_tasks`,
      [organizationId, visit.id, requestOne.id, requestTwo.id, workOne.id, workTwo.id],
    );
    expect(facts.rows[0]).toEqual({ links: 2, evidence: 2, impacts: 4, open_tasks: 0 });
    await expect(repository.listWorkOrderVerifications(organizationId, workTwo.id)).resolves.toMatchObject([
      { cycle: 1, decision: "rejected", siteVisitWorkOrderId: outcomeTwo.id },
      { cycle: 2, decision: "verified", siteVisitWorkOrderId: returnCheckout.siteVisitWorkOrders[0]!.id },
    ]);
  }, 120_000);
});
