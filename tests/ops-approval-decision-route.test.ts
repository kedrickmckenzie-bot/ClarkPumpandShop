import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/approvals/[id]/decision/route";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { ApprovalRequest, ApprovalRequiredRole, OpsFixture } from "@/lib/ops/types";

const requestContextMocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>(
    "@/lib/server/ops-request-context",
  );
  return {
    ...actual,
    getOpsRequestContext: requestContextMocks.getOpsRequestContext,
    assertStoreInSessionScope: requestContextMocks.assertStoreInSessionScope,
  };
});

const WORK_ORDER_ID = "wo-northline-105-price-check";
const APPROVAL_REQUEST_ID = "approval-request-route-pending";

const facilitiesSession: OperatorSession = {
  userId: "user-northline-facilities",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@clark-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Clark Pump and Shop",
  scopeLabel: "Clark Pump and Shop companywide · 15 stores",
};

function addPendingWorkApproval(
  fixture: OpsFixture,
  requiredRole: ApprovalRequiredRole = "facilities_admin",
) {
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === WORK_ORDER_ID)!;
  const policy = fixture.approvalPolicies.find((candidate) => candidate.policyKey === "major-repair")!;
  workOrder.status = "awaiting_approval";
  const approvalRequest: ApprovalRequest = {
    id: APPROVAL_REQUEST_ID,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    subjectType: "work_order",
    subjectId: workOrder.id,
    storeId: workOrder.storeId,
    categoryKey: workOrder.categoryKey,
    amount: { amountMinor: 625_000, currency: "USD" },
    policyId: policy.id,
    policyKey: policy.policyKey,
    policyVersion: policy.version,
    policyName: policy.name,
    policyScopeKind: policy.scopeKind,
    policyScopeId: policy.scopeId,
    requiredRole,
    escalationRole: "executive",
    requestedByMembershipId: "membership-northline-regional-1",
    requestedByName: "Morgan Hayes",
    reason: "Selected repair scope exceeds the regional authorization limit",
    requestedAt: "2026-08-20T13:00:00.000Z",
    dueAt: "2026-08-21T13:00:00.000Z",
  };
  fixture.approvalRequests.push(approvalRequest);
  return { workOrder, approvalRequest };
}

function decisionRequest(decision: string, reason?: string) {
  const formData = new FormData();
  formData.set("decision", decision);
  if (reason !== undefined) formData.set("reason", reason);
  return new Request(`https://operations.test/api/ops/approvals/${APPROVAL_REQUEST_ID}/decision`, {
    method: "POST",
    body: formData,
  });
}

function configureContext(fixture: OpsFixture, session: OperatorSession = facilitiesSession) {
  const repository = createOpsFixtureRepository(fixture);
  requestContextMocks.getOpsRequestContext.mockResolvedValue({
    session,
    repository,
    actor: {
      actorType: "user",
      actorId: session.membershipId ?? session.userId,
      actorName: session.displayName,
      organizationId: session.organizationId,
    },
  });
  requestContextMocks.assertStoreInSessionScope.mockResolvedValue(undefined);
  return repository;
}

describe("operator approval-decision route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the scoped current membership decision through the approval domain command", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const { workOrder, approvalRequest } = addPendingWorkApproval(fixture);
    const repository = configureContext(fixture);

    const response = await POST(decisionRequest("approved", "Repair scope and amount verified."), {
      params: Promise.resolve({ id: approvalRequest.id }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/app/work-orders/${workOrder.id}?view=activity&updated=approval-approved#work-control`,
    );
    expect(requestContextMocks.assertStoreInSessionScope).toHaveBeenCalledWith(facilitiesSession, workOrder.storeId);
    const snapshot = repository.snapshot();
    expect(snapshot.approvalDecisions.find((decision) => decision.approvalRequestId === approvalRequest.id)).toMatchObject({
      decision: "approved",
      decidedByMembershipId: facilitiesSession.membershipId,
      decidedByRole: "facilities_admin",
      reason: "Repair scope and amount verified.",
    });
    expect(snapshot.workOrders.find((candidate) => candidate.id === workOrder.id)).toMatchObject({
      status: "approved",
      nextAction: "Compare vendor quotes and choose the service provider",
    });
  });

  it("requires a real preview membership before attempting a decision", async () => {
    const fixture = buildNorthlinePresentationFixture();
    addPendingWorkApproval(fixture);
    const session = { ...facilitiesSession, membershipId: undefined };
    const repository = configureContext(fixture, session);

    const response = await POST(decisionRequest("approved"), {
      params: Promise.resolve({ id: APPROVAL_REQUEST_ID }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      error: "An active preview membership is required to record an approval decision.",
    });
    expect(requestContextMocks.assertStoreInSessionScope).not.toHaveBeenCalled();
    expect(repository.snapshot().approvalDecisions.some((decision) => decision.approvalRequestId === APPROVAL_REQUEST_ID)).toBe(false);
  });

  it("lets the domain command enforce the request's exact required role", async () => {
    const fixture = buildNorthlinePresentationFixture();
    addPendingWorkApproval(fixture, "store_manager");
    const repository = configureContext(fixture);

    const response = await POST(decisionRequest("approved"), {
      params: Promise.resolve({ id: APPROVAL_REQUEST_ID }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      error: "Store manager approval is required",
    });
    expect(repository.snapshot().approvalDecisions.some((decision) => decision.approvalRequestId === APPROVAL_REQUEST_ID)).toBe(false);
  });

  it("requires a reason for reject and escalate decisions", async () => {
    const fixture = buildNorthlinePresentationFixture();
    addPendingWorkApproval(fixture);
    const repository = configureContext(fixture);

    const response = await POST(decisionRequest("escalated"), {
      params: Promise.resolve({ id: APPROVAL_REQUEST_ID }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION",
      error: "A reason is required for a non-approval decision",
    });
    expect(repository.snapshot().approvalDecisions.some((decision) => decision.approvalRequestId === APPROVAL_REQUEST_ID)).toBe(false);
  });
});
