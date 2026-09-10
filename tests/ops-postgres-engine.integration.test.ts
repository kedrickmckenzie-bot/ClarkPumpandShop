import { loadOpsFixtureSnapshotFromPostgres } from "@/lib/ops/postgres-snapshot";
import { TREND_SOURCE_TABLES } from "@/lib/ops/trends-source-tables";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import { importAccountingInvoice, reviewAccountingInvoice } from "@/lib/ops/accounting-import";
import { accountingDemoDelivery } from "@/lib/ops/accounting-demo-adapter";
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
  placeWorkOrderOnVisitHold,
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
import { runSlaEscalationCycle } from "@/lib/ops/job-workers";
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

    const scopedStoreManagers = await repository.listNotificationRecipients(
      fixture.organizations[0].id,
      "store_manager",
      { storeId: fixture.stores[0].id, regionId: fixture.stores[0].regionId },
    );
    expect(scopedStoreManagers).toHaveLength(1);
    expect(scopedStoreManagers[0]?.email).toBe(`store${fixture.stores[0].storeNumber}.manager@clark-demo.example`);
    const scopedRegionalManagers = await repository.listNotificationRecipients(
      fixture.organizations[0].id,
      "regional_manager",
      { storeId: fixture.stores[0].id, regionId: fixture.stores[0].regionId },
    );
    expect(scopedRegionalManagers).toHaveLength(1);
    expect(scopedRegionalManagers[0]?.email).toBe("regional1@clark-demo.example");
    await repository.upsertNotificationRule({ organizationId: fixture.organizations[0].id, id: "notification-rule-vendor-commitment-executive", eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "executive", occurredAt: fixture.asOf });
    expect((await repository.listNotificationRules(fixture.organizations[0].id)).filter((rule) => rule.eventKey === "vendor_commitment_received").map((rule) => rule.recipientRole).sort()).toEqual(["executive", "facilities_admin", "regional_manager", "store_manager"]);

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

    expect(workOrder.number).toMatch(/^CPS-2026-\d{4}$/);
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

  it("runs the SLA escalation worker through the SQL adapter without bind mismatches", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);
    const organizationId = fixture.organizations[0].id;

    // Regression: listOverdueEscalationCandidates previously bound three
    // parameters to a two-placeholder statement; PGlite rejects the mismatch.
    await database.query(
      `UPDATE ops_workflow_tasks t SET due_at = '2026-01-01T00:00:00.000Z'
       WHERE t.organization_id = $1 AND t.status IN ('open', 'in_progress')
         AND t.escalation_destination IS NOT NULL
         AND EXISTS (SELECT 1 FROM ops_work_orders w WHERE w.organization_id = t.organization_id AND w.id = t.work_order_id AND w.status NOT IN ('resolved', 'closed', 'cancelled'))`,
      [organizationId],
    );

    const summary = await runSlaEscalationCycle({
      repository,
      clock: { now: () => "2026-08-20T09:00:00.000Z" },
    });
    expect(summary.organizationsSkipped).toBe(0);
    expect(summary.escalatedCount).toBeGreaterThan(0);
    // Tasks already overdue against a terminal work order are honest failures;
    // the worker must count exactly those and nothing else.
    const expectedFailures = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ops_workflow_tasks t
       WHERE t.organization_id = $1 AND t.status IN ('open', 'in_progress')
         AND t.due_at IS NOT NULL AND t.due_at <= $2
         AND t.work_order_id IS NULL`,
      [organizationId, "2026-08-20T09:00:00.000Z"],
    );
    expect(summary.failedCount).toBe(expectedFailures.rows[0]!.count);

    // The per-organization job run records this org's own outcome.
    const runs = await database.query<{ status: string; failed_count: number }>(
      "SELECT status, failed_count FROM ops_job_runs WHERE organization_id = $1 AND job_type = 'sla_escalation'",
      [organizationId],
    );
    expect(runs.rows.length).toBe(1);
    expect(runs.rows[0]).toMatchObject({ status: "succeeded", failed_count: expectedFailures.rows[0]!.count });

    // Slot idempotency still holds through the SQL adapter.
    const second = await runSlaEscalationCycle({
      repository,
      clock: { now: () => "2026-08-20T09:30:00.000Z" },
    });
    expect(second.organizationsSkipped).toBe(summary.organizationsConsidered);
  }, 120_000);

  it("scopes outbox status counts to the requesting organization", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);
    const organizationId = fixture.organizations[0].id;

    // A foreign tenant with its own outbox traffic must be invisible.
    await database.transaction(async (transaction) => {
      await transaction.exec("INSERT INTO ops_organizations (id, name, slug, work_order_prefix, created_at) VALUES ('org-foreign-counts', 'Foreign Tenant', 'foreign-counts', 'FRX', now())");
      for (let index = 0; index < 3; index += 1) {
        await transaction.exec(`INSERT INTO ops_outbox_messages (id, organization_id, topic, aggregate_type, aggregate_id, payload_json, status, available_at, created_at, attempt_count) VALUES ('outbox-foreign-${index}', 'org-foreign-counts', 'ops.foreign.topic', 'test', 'aggregate-${index}', '{}', 'pending', now(), now(), 0)`);
      }
    });

    const ownCounts = await repository.outboxStatusCounts(organizationId);
    const ownTotal = ownCounts.reduce((sum, row) => sum + row.count, 0);
    const expected = await database.query<{ status: string; count: number }>(
      "SELECT status, count(*)::int AS count FROM ops_outbox_messages WHERE organization_id = $1 GROUP BY status",
      [organizationId],
    );
    expect(ownTotal).toBeGreaterThan(0);
    expect(ownCounts).toEqual(expected.rows.map((row) => ({ status: row.status, count: row.count })));

    const foreignCounts = await repository.outboxStatusCounts("org-foreign-counts");
    expect(foreignCounts).toEqual([{ status: "pending", count: 3 }]);
  }, 60_000);

  it("stores saved views as plain query strings and round-trips them on PostgreSQL", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);
    const organizationId = fixture.organizations[0].id;
    const membershipId = "membership-northline-facilities";

    // Regression: the column was JSONB and rejected URL-search strings.
    await repository.putSavedView({
      organizationId,
      id: "saved-view-pg-roundtrip",
      ownerMembershipId: membershipId,
      surface: "work-orders",
      name: "Open at store 101",
      queryString: "status=open&store=store-northline-101",
      createdAt: "2026-08-20T09:00:00.000Z",
    });

    const views = await repository.listSavedViews(organizationId, membershipId, "work-orders");
    const roundTripped = views.find((view) => view.id === "saved-view-pg-roundtrip");
    expect(roundTripped).toBeDefined();
    expect(roundTripped!.queryString).toBe("status=open&store=store-northline-101");

    // Saving the same name replaces without duplicating.
    await repository.putSavedView({
      organizationId,
      id: "saved-view-pg-roundtrip-2",
      ownerMembershipId: membershipId,
      surface: "work-orders",
      name: "Open at store 101",
      queryString: "status=open",
      createdAt: "2026-08-20T09:05:00.000Z",
    });
    const replaced = await repository.listSavedViews(organizationId, membershipId, "work-orders");
    expect(replaced.filter((view) => view.name === "Open at store 101")).toHaveLength(1);
    expect(replaced.find((view) => view.name === "Open at store 101")!.queryString).toBe("status=open");

    await expect(repository.deleteSavedView(organizationId, membershipId, "saved-view-pg-roundtrip-2")).resolves.toBe(true);
  }, 60_000);

  it("persists a held-work revision, atomic claim, and review outcome through PostgreSQL", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsPostgresRepository(pool);
    await seedOpsRepository(repository, fixture);
    const organizationId = fixture.organizations[0].id;
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => "2026-08-27T12:00:00.000Z" },
      ids: { next: (prefix) => `${prefix}-pg-held-${++sequence}` },
    };
    const actor = { actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee", organizationId };
    const workOrderId = "wo-held-104-restroom-door";

    await placeWorkOrderOnVisitHold(services, {
      organizationId,
      workOrderId,
      posture: "look_and_report",
      deadlineAt: "2026-10-01T17:00:00.000Z",
      internalReviewThresholdAmountMinor: 30_000,
      currency: "USD",
      actor,
    });
    await expect(repository.getWorkOrderVisitHold(organizationId, workOrderId)).resolves.toMatchObject({ posture: "look_and_report", status: "active", internalReviewThreshold: { amountMinor: 30_000, currency: "USD" } });

    const visit = await checkInVisit(services, {
      organizationId,
      storeId: "store-northline-104",
      vendorId: "vendor-northline-cedar",
      heldWorkOrderIds: [workOrderId],
      unmatchedReason: "Plumbing vendor onsite without an issued work order.",
      technicianName: "Postgres Held Work Tech",
      purpose: "Review approved held work",
      channel: "qr",
      location: { result: "permission_denied", capturedAt: "2026-08-27T12:00:00.000Z" },
      actor: { actorType: "technician", actorName: "Postgres Held Work Tech", organizationId },
    });
    await expect(repository.getWorkOrderVisitHold(organizationId, workOrderId)).resolves.toMatchObject({ status: "claimed", claimedVisitId: visit.id });

    await checkOutVisit(services, {
      organizationId,
      visitId: visit.id,
      channel: "qr",
      location: { result: "permission_denied", capturedAt: "2026-08-27T12:00:00.000Z" },
      perWorkOrderOutcomes: [{ workOrderId, outcome: "diagnosis_only", outcomeNotes: "Closer body is worn; replacement should be planned." }],
      actor: { actorType: "technician", actorName: "Postgres Held Work Tech", organizationId },
    });
    await expect(repository.getWorkOrderVisitHold(organizationId, workOrderId)).resolves.toMatchObject({ status: "review_required" });
    await expect(repository.listSiteVisitWorkOrders(organizationId, visit.id)).resolves.toEqual([
      expect.objectContaining({ workOrderId, selectionSource: "held_work", outcome: "diagnosis_only" }),
    ]);
  }, 120_000);
  it("loads persisted coverage through narrow reads and imports accounting corrections on PostgreSQL", async () => {
    const started = performance.now();
    const fixture = await loadOpsFixtureSnapshotFromPostgres(pool, "org-northline-demo", "2026-08-25T18:00:00.000Z", { includedTables: TREND_SOURCE_TABLES, auditEventTypes: ["recording.coverage_attested"] });
    const loaded = performance.now();
    expect(fixture.auditEvents.length).toBeGreaterThan(0);
    expect(fixture.auditEvents.every((event) => event.eventType === "recording.coverage_attested")).toBe(true);
    const session = { userId: "user-northline-facilities", organizationId: "org-northline-demo", membershipId: "membership-northline-facilities", displayName: "Jordan Lee", email: "demo@example.com", role: "facilities" as const, organizationName: "Clark Pump and Shop", scopeLabel: "Companywide" };
    const model = buildTrendsModel(fixture, session, { metric: "recorded_cost", period: "6", view: "records", detailKind: "benchmark", benchmarkStore: "store-northline-104" }, { includeExportRows: true });
    const modeled = performance.now();
    process.stdout.write(`Persisted Trends: load ${Math.round(loaded - started)} ms; model ${Math.round(modeled - loaded)} ms; combined ${Math.round(modeled - started)} ms\n`);
    expect(model.benchmark.rows.some((row) => row.evidenceQualityLabel?.includes("Supported"))).toBe(true);
    const repository = createOpsPostgresRepository(pool);
    const actor = { organizationId: "org-northline-demo", actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
    const source = (await importAccountingInvoice({ repository }, actor, accountingDemoDelivery("new"))).source;
    const reviewed = await reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, vendorId: "vendor-northline-summit", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 35000 }, { lineId: "travel", workOrderId: "wo-northline-104", amountMinor: 10000 }], reason: "PostgreSQL source review" });
    await importAccountingInvoice({ repository }, actor, accountingDemoDelivery("correction"));
    expect((await repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.total.amountMinor).toBe(40000);
    expect((await repository.listInvoiceExceptions(actor.organizationId, reviewed.invoiceId!)).some((row) => row.kind === "allocation_mismatch")).toBe(true);
    expect((await repository.listAccountingInvoiceSources(actor.organizationId, 25, 0)).filter((row) => row.id === source.id)).toHaveLength(1);
    await repository.atomicWrite([
      { sql: "INSERT INTO ops_files (id, organization_id, storage_key, sha256, original_name, content_type, byte_length, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params: ["pg-quote-file", actor.organizationId, "pg-private-quote", "a".repeat(64), "quote.pdf", "application/pdf", 12, "available", fixture.asOf] },
      { sql: "INSERT INTO ops_entity_files (id, organization_id, file_id, entity_type, entity_id, purpose, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params: ["pg-quote-link", actor.organizationId, "pg-quote-file", "estimate_proposal", "estimate-proposal-105-summit-r1", "service_document", "vendor_shared", fixture.asOf] },
    ]);
    expect(await repository.listFilesForEntity(actor.organizationId, "estimate_proposal", "estimate-proposal-105-summit-r1", "vendor_shared")).toHaveLength(1);
    expect(await repository.listFilesForEntity("foreign", "estimate_proposal", "estimate-proposal-105-summit-r1", "vendor_shared")).toHaveLength(0);
    await repository.atomicWrite([{ sql: "UPDATE ops_entity_files SET visibility = ? WHERE organization_id = ? AND id = ?", params: ["internal", actor.organizationId, "pg-quote-link"] }]);
    expect(await repository.listFilesForEntity(actor.organizationId, "estimate_proposal", "estimate-proposal-105-summit-r1", "vendor_shared")).toHaveLength(0);
    expect(await repository.listFilesForEntity(actor.organizationId, "estimate_proposal", "estimate-proposal-105-summit-r1")).toHaveLength(1);

  });

});
