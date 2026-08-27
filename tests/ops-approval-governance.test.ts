import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  approvalRequestState,
  recordApprovalDecision,
  resolveApprovalPolicy,
} from "@/lib/ops/approval-governance";
import { createWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import {
  createNorthlineFixtureRepository,
  createOpsFixtureRepository,
} from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { ApprovalDecisionKind } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));

let buildApprovalPolicyWorkspaceModel: typeof import("@/app/app/_data/operator-presenter").buildApprovalPolicyWorkspaceModel;
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;

beforeAll(async () => {
  ({ buildApprovalPolicyWorkspaceModel, buildDetailModel } = await import("@/app/app/_data/operator-presenter"));
});

function harness(now = "2026-08-15T12:00:00.000Z") {
  const repository = createNorthlineFixtureRepository();
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-approval-test-${++sequence}` },
  };
  return { repository, services };
}

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function facilitiesSession(): OperatorSession {
  return {
    userId: "user-northline-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Jordan Lee",
    email: "jordan.lee@clark-demo.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    permissions: ["ops:*"],
  };
}

describe("approval governance", () => {
  it("seeds an independently eligible approver for every store and governed role", () => {
    const fixture = buildNorthlinePresentationFixture();
    const membershipsByRole = new Map(fixture.memberships.filter((membership) => membership.status === "active").map((membership) => [membership.id, membership]));

    for (const store of fixture.stores) {
      const storeManager = [...membershipsByRole.values()].find((membership) => (
        membership.role === "store_manager"
        && fixture.scopeGrants.some((grant) => grant.membershipId === membership.id && grant.scopeKind === "store" && grant.scopeId === store.id)
      ));
      expect(storeManager, `missing store-manager approver for ${store.storeNumber}`).toBeDefined();
    }

    expect([...membershipsByRole.values()].filter((membership) => membership.role === "facilities_admin")).toHaveLength(2);
  });

  it("seeds a Store 104 issue whose impact, review task, and routine approval are actionable by the visible manager", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const request = fixture.requests.find((candidate) => candidate.id === "request-current-104-beer-cave-door")!;
    const approval = fixture.approvalRequests.find((candidate) => candidate.id === "approval-request-104-pending")!;
    const impacts = fixture.requestImpactAssessments.filter((assessment) => assessment.requestId === request.id);
    const reviewTask = fixture.workflowTasks.find((task) => task.serviceRequestId === request.id && task.taskType === "review_issue")!;
    const managerScope = fixture.scopeGrants.find((grant) => (
      grant.membershipId === "membership-northline-store-104"
      && grant.scopeKind === "store"
      && grant.scopeId === "store-northline-104"
    ));

    expect(request).toMatchObject({ storeId: "store-northline-104", status: "under_review" });
    expect(impacts.map((assessment) => assessment.assessmentKind)).toEqual(["initial_report", "review"]);
    expect(reviewTask).toMatchObject({ status: "in_progress", requiredForProgress: true, blocking: true });
    expect(approval).toMatchObject({
      subjectType: "service_request",
      subjectId: request.id,
      storeId: "store-northline-104",
      requiredRole: "store_manager",
      requestedByMembershipId: "membership-northline-facilities",
    });
    expect(managerScope).toBeDefined();

    let sequence = 0;
    await recordApprovalDecision({
      repository,
      clock: { now: () => "2026-08-10T16:10:00.000Z" },
      ids: { next: (prefix) => `${prefix}-store-104-seed-${++sequence}` },
    }, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: approval.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-store-104",
      reason: "Within the Store 104 routine repair allowance.",
      actor: {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        actorType: "user",
        actorId: "membership-northline-store-104",
        actorName: "Robin Carter",
      },
    });

    expect(repository.snapshot().approvalDecisions.filter((decision) => decision.approvalRequestId === approval.id))
      .toEqual([expect.objectContaining({ decision: "approved", decidedByMembershipId: "membership-northline-store-104" })]);
  });

  it("enforces the approving membership's store and region grants on the server", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const storeApproval = fixture.approvalRequests.find((candidate) => candidate.id === "approval-request-104-pending")!;
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => "2026-08-15T12:00:00.000Z" },
      ids: { next: (prefix) => `${prefix}-scope-test-${++sequence}` },
    };

    await expect(recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: storeApproval.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-store-101",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "membership-northline-store-101", actorName: "Cameron Blake" },
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: "The approving membership is not authorized for this store" });

    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-106",
      problem: "Investigate a ceiling stain above the stockroom.",
      categoryKey: "exterior",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      nteAmountMinor: 180_000,
      actor: facilitiesActor,
    });
    const regionalApproval = repository.snapshot().approvalRequests.find((candidate) => candidate.subjectId === workOrder.id)!;
    await expect(recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: regionalApproval.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-regional-1",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "membership-northline-regional-1", actorName: "Taylor Reed" },
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: "The approving membership is not authorized for this store" });

    expect(repository.snapshot().approvalDecisions.some((decision) => (
      decision.approvalRequestId === storeApproval.id || decision.approvalRequestId === regionalApproval.id
    ))).toBe(false);
  });

  it.each(["pending", "rejected", "cancelled", "escalated"] as const)(
    "blocks request conversion while the current approval is %s",
    async (state) => {
      const fixture = buildNorthlinePresentationFixture();
      const approval = fixture.approvalRequests.find((candidate) => candidate.id === "approval-request-104-pending")!;
      if (state !== "pending") {
        fixture.approvalDecisions.push({
          id: `approval-decision-104-${state}`,
          organizationId: NORTHLINE_ORGANIZATION_ID,
          approvalRequestId: approval.id,
          decision: state as ApprovalDecisionKind,
          decidedByMembershipId: "membership-northline-store-104",
          decidedByName: "Robin Carter",
          decidedByRole: "store_manager",
          reason: `Fixture ${state} decision`,
          escalatedToRole: state === "escalated" ? "regional_manager" : undefined,
          decidedAt: "2026-08-10T16:10:00.000Z",
        });
      }
      const repository = createOpsFixtureRepository(fixture);
      const services: OpsCommandServices = {
        repository,
        clock: { now: () => "2026-08-15T12:00:00.000Z" },
        ids: { next: (prefix) => `${prefix}-approval-gate-${state}` },
      };

      await expect(createWorkOrder(services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        storeId: "store-northline-104",
        requestId: "request-current-104-beer-cave-door",
        problem: "Beer-cave door is not sealing and condensation is building.",
        accountableParty: "Facilities coordinator",
        nextAction: "Choose service provider",
        initialAssignment: { kind: "choose_later" },
        actor: facilitiesActor,
      })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "The current request approval must be approved before work-order creation",
      });
      expect(repository.snapshot().workOrders.some((workOrder) => workOrder.requestId === approval.subjectId)).toBe(false);
    },
  );

  it("allows request conversion only after the current approval is approved", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    const approval = fixture.approvalRequests.find((candidate) => candidate.id === "approval-request-104-pending")!;
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => "2026-08-15T12:00:00.000Z" },
      ids: { next: (prefix) => `${prefix}-approved-conversion-${++sequence}` },
    };
    await recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: approval.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-store-104",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "membership-northline-store-104", actorName: "Robin Carter" },
    });
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      requestId: approval.subjectId,
      problem: "Beer-cave door is not sealing and condensation is building.",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      initialAssignment: { kind: "choose_later" },
      actor: facilitiesActor,
    });

    expect(repository.snapshot().requests.find((request) => request.id === approval.subjectId)).toMatchObject({
      status: "converted",
      convertedWorkOrderId: workOrder.id,
      version: 2,
    });
  });

  it("resolves the most specific eligible tenant policy", () => {
    const fixture = buildNorthlinePresentationFixture();
    const store = fixture.stores.find((candidate) => candidate.id === "store-northline-104")!;
    const base = fixture.approvalPolicies.find((policy) => policy.policyKey === "regional-service")!;
    const policies = [
      ...fixture.approvalPolicies,
      { ...base, id: "approval-policy-north-region-refrigeration", policyKey: "north-refrigeration", name: "North refrigeration", scopeKind: "region" as const, scopeId: store.regionId!, categoryKey: "refrigeration", requiredRole: "facilities_admin" as const },
      { ...base, id: "approval-policy-store-104-refrigeration", policyKey: "store-104-refrigeration", name: "Store 104 refrigeration", scopeKind: "store" as const, scopeId: store.id, categoryKey: "refrigeration", requiredRole: "executive" as const },
      { ...base, id: "approval-policy-other-tenant", organizationId: "org-other", policyKey: "other", name: "Other tenant", scopeKind: "organization" as const, scopeId: "org-other", requiredRole: "executive" as const },
    ];

    const match = resolveApprovalPolicy({ policies, organizationId: NORTHLINE_ORGANIZATION_ID, store, categoryKey: "refrigeration", amountMinor: 180_000, currency: "USD" });

    expect(match?.id).toBe("approval-policy-store-104-refrigeration");
  });

  it("keeps basic store-and-problem work valid when no policy-triggering amount is entered", async () => {
    const { repository, services } = harness();
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      problem: "Front vestibule closer is slamming",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      actor: facilitiesActor,
    });

    expect(workOrder.status).toBe("approved");
    expect(repository.snapshot().approvalRequests.filter((request) => request.subjectId === workOrder.id)).toHaveLength(0);
  });

  it("atomically gates a matching NTE, then appends an authorized decision and releases the work order", async () => {
    const { repository, services } = harness();
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      problem: "Freezer door sweep needs replacement",
      categoryKey: "refrigeration",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      nteAmountMinor: 65_000,
      actor: facilitiesActor,
    });
    const created = repository.snapshot();
    const request = created.approvalRequests.find((candidate) => candidate.subjectId === workOrder.id)!;

    expect(workOrder).toMatchObject({ status: "awaiting_approval", accountableParty: "Store manager", nextAction: "Review authorization" });
    expect(request).toMatchObject({ requiredRole: "store_manager", policyKey: "store-routine", policyVersion: 1 });
    expect(created.auditEvents.some((event) => event.aggregateId === request.id && event.eventType === "approval.requested")).toBe(true);
    expect(created.outboxMessages.some((message) => message.aggregateId === request.id && message.topic === "ops.approval.requested")).toBe(true);

    await recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: request.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-store-104",
      reason: "Within store repair allowance",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "membership-northline-store-104", actorName: "Robin Carter" },
    });

    const decided = repository.snapshot();
    expect(decided.workOrders.find((candidate) => candidate.id === workOrder.id)).toMatchObject({ status: "approved", version: 1, nextAction: "Issue service authorization" });
    expect(decided.approvalRequests.find((candidate) => candidate.id === request.id)).toEqual(request);
    expect(decided.approvalDecisions.filter((candidate) => candidate.approvalRequestId === request.id)).toHaveLength(1);
    expect(approvalRequestState(request, decided.approvalDecisions)).toBe("approved");
  });

  it("preserves an escalation decision and creates the next accountable review in one transaction", async () => {
    const { repository, services } = harness();
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-106",
      problem: "Roof access is needed to investigate a ceiling stain",
      categoryKey: "exterior",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      nteAmountMinor: 180_000,
      actor: facilitiesActor,
    });
    const request = repository.snapshot().approvalRequests.find((candidate) => candidate.subjectId === workOrder.id)!;

    const result = await recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: request.id,
      decision: "escalated",
      deciderMembershipId: "membership-northline-regional-2",
      reason: "Potential roof penetration requires facilities review",
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user", actorId: "membership-northline-regional-2", actorName: "Morgan Hayes" },
    });

    const snapshot = repository.snapshot();
    expect(result.escalatedRequest).toMatchObject({ parentApprovalRequestId: request.id, requiredRole: "facilities_admin" });
    expect(approvalRequestState(request, snapshot.approvalDecisions)).toBe("escalated");
    expect(snapshot.workOrders.find((candidate) => candidate.id === workOrder.id)).toMatchObject({ status: "awaiting_approval", accountableParty: "Facilities administrator", nextAction: "Review escalated authorization" });
    expect(snapshot.approvalRequests.filter((candidate) => candidate.subjectId === workOrder.id)).toHaveLength(2);
  });

  it("rejects a decision from the wrong role and keeps the immutable request pending", async () => {
    const { repository, services } = harness();
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      problem: "Replace a damaged freezer gasket",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      nteAmountMinor: 65_000,
      actor: facilitiesActor,
    });
    const request = repository.snapshot().approvalRequests.find((candidate) => candidate.subjectId === workOrder.id)!;

    await expect(recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: request.id,
      decision: "approved",
      deciderMembershipId: "membership-northline-facilities",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.snapshot().approvalDecisions.some((decision) => decision.approvalRequestId === request.id)).toBe(false);
  });

  it("enforces requester-approver segregation even when the requester has the required role", async () => {
    const { repository, services } = harness();
    const workOrder = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      problem: "Replace the failed walk-in condensing unit",
      categoryKey: "refrigeration",
      accountableParty: "Facilities coordinator",
      nextAction: "Choose service provider",
      nteAmountMinor: 625_000,
      actor: facilitiesActor,
    });
    const request = repository.snapshot().approvalRequests.find((candidate) => candidate.subjectId === workOrder.id)!;

    expect(request).toMatchObject({
      requiredRole: "facilities_admin",
      requestedByMembershipId: facilitiesActor.actorId,
    });
    await expect(recordApprovalDecision(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: request.id,
      decision: "approved",
      deciderMembershipId: facilitiesActor.actorId,
      actor: facilitiesActor,
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "The requester cannot decide their own approval request",
    });
    expect(repository.snapshot().approvalDecisions.some((decision) => decision.approvalRequestId === request.id)).toBe(false);
  });

  it("exposes policy versions and pending, approved, and escalated evidence in the operator workspace", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workspace = buildApprovalPolicyWorkspaceModel(fixture, facilitiesSession());
    const requestDetail = buildDetailModel(fixture, facilitiesSession(), "request", "request-current-106-ceiling-stain");
    const workDetail = buildDetailModel(fixture, facilitiesSession(), "work-order", "wo-northline-115");

    expect(workspace.sections.find((section) => section.id === "policy-versions")?.table?.rows).toHaveLength(4);
    const ledgerStates = workspace.sections.find((section) => section.id === "approval-ledger")?.table?.rows.flatMap((row) => row.cells.filter((cell) => cell.key === "status").map((cell) => cell.value));
    expect(ledgerStates).toEqual(expect.arrayContaining(["Pending", "Approved", "Escalated"]));
    expect(requestDetail.sections.find((section) => section.id === "approval-governance")?.table?.rows).toHaveLength(2);
    expect(workDetail.facts.find((fact) => fact.label === "Approval")?.value).toBe("Approved");
  });
});
