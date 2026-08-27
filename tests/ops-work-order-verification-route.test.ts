import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { OpsDomainError } from "@/lib/ops/errors";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const mocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
  recordWorkOrderVerification: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>(
    "@/lib/server/ops-request-context",
  );
  return {
    ...actual,
    getOpsRequestContext: mocks.getOpsRequestContext,
    assertStoreInSessionScope: mocks.assertStoreInSessionScope,
  };
});

vi.mock("@/lib/ops/work-order-verification-commands", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ops/work-order-verification-commands")>(
    "@/lib/ops/work-order-verification-commands",
  );
  return { ...actual, recordWorkOrderVerification: mocks.recordWorkOrderVerification };
});

import { POST } from "@/app/api/ops/work-orders/[id]/verification/route";

const workOrder = {
  id: "wo-verification-route",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  storeId: "store-northline-104",
  number: "CPS-2026-9999",
};

function session(role: OperatorSession["role"]): OperatorSession {
  return {
    userId: `user-${role}`,
    membershipId: role === "store_manager"
      ? "membership-northline-store-104"
      : "membership-northline-facilities",
    displayName: role === "store_manager" ? "Casey Morgan" : "Jordan Lee",
    email: `${role}@clark-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: role === "store_manager" ? "Store 104" : "Clark Pump and Shop companywide",
    ...(role === "store_manager" ? { storeIds: [workOrder.storeId] } : {}),
  };
}

function configure(role: OperatorSession["role"] = "facilities") {
  const currentSession = session(role);
  const repository = { getWorkOrder: vi.fn().mockResolvedValue(workOrder) };
  const actor = {
    actorType: "user" as const,
    actorId: currentSession.membershipId,
    actorName: currentSession.displayName,
    organizationId: currentSession.organizationId,
  };
  mocks.getOpsRequestContext.mockResolvedValue({ session: currentSession, repository, actor });
  mocks.assertStoreInSessionScope.mockResolvedValue(workOrder);
  mocks.recordWorkOrderVerification.mockResolvedValue({ id: "verification-route-result" });
  return { currentSession, repository, actor };
}

function request(decision = "verified", reason = "Store operating condition confirmed") {
  const formData = new FormData();
  formData.set("decision", decision);
  formData.set("reason", reason);
  formData.set("expectedWorkOrderVersion", "7");
  formData.set("expectedSiteVisitWorkOrderId", "site-visit-work-route");
  formData.set("expectedOutcomeRecordedAt", "2026-08-20T14:00:00.000Z");
  return new Request(`https://operations.test/api/ops/work-orders/${workOrder.id}/verification`, {
    method: "POST",
    body: formData,
  });
}

describe("work-order verification route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permits a scoped store manager and sends exact stale-write fences to the domain command", async () => {
    const { currentSession, repository, actor } = configure("store_manager");
    const response = await POST(request("verified"), { params: Promise.resolve({ id: workOrder.id }) });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/app/work-orders/${workOrder.id}?view=visits&updated=verification-verified#work-verification`,
    );
    expect(mocks.getOpsRequestContext).toHaveBeenCalledWith(["facilities", "regional", "store_manager"]);
    expect(mocks.assertStoreInSessionScope).toHaveBeenCalledWith(currentSession, workOrder.storeId);
    expect(mocks.recordWorkOrderVerification).toHaveBeenCalledWith(
      { repository },
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: workOrder.id,
        expectedWorkOrderVersion: 7,
        expectedSiteVisitWorkOrderId: "site-visit-work-route",
        expectedOutcomeRecordedAt: "2026-08-20T14:00:00.000Z",
        decision: "verified",
        reason: "Store operating condition confirmed",
        actor,
      },
    );
  });

  it("returns a scoped authorization failure before the decision command runs", async () => {
    configure("store_manager");
    mocks.assertStoreInSessionScope.mockRejectedValue(
      new OpsDomainError("FORBIDDEN", "Store is outside your assigned scope."),
    );

    const response = await POST(request("rejected", "Repair did not hold"), {
      params: Promise.resolve({ id: workOrder.id }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.recordWorkOrderVerification).not.toHaveBeenCalled();
  });

  it("rejects unsupported decisions without touching the domain", async () => {
    configure();
    const response = await POST(request("closed"), { params: Promise.resolve({ id: workOrder.id }) });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION",
      error: "Choose verify or reject.",
    });
    expect(mocks.recordWorkOrderVerification).not.toHaveBeenCalled();
  });
});
