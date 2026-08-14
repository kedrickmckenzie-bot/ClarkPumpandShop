import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/work-orders/[id]/estimates/route";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

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

const WORK_ORDER_ID = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;

const facilitiesSession: OperatorSession = {
  userId: "user-estimate-route",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide - 15 stores",
};

function bidRequest(dueAt?: string) {
  const formData = new FormData();
  formData.set("vendorId", "vendor-northline-cedar");
  formData.set("kind", "estimate_only");
  formData.set("requestedScope", "Price the complete repair without authorizing onsite work.");
  formData.set("channel", "email");
  if (dueAt !== undefined) formData.set("dueAt", dueAt);
  return new Request(`https://traceops.test/api/ops/work-orders/${WORK_ORDER_ID}/estimates`, {
    method: "POST",
    body: formData,
  });
}

function configureContext() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  requestContextMocks.getOpsRequestContext.mockResolvedValue({
    session: facilitiesSession,
    repository,
    actor: {
      actorType: "user",
      actorId: facilitiesSession.membershipId,
      actorName: facilitiesSession.displayName,
      organizationId: NORTHLINE_ORGANIZATION_ID,
    },
  });
  requestContextMocks.assertStoreInSessionScope.mockResolvedValue(undefined);
  return repository;
}

describe("operator bid-request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { label: "missing", dueAt: undefined, message: "dueAt is required." },
    { label: "not in the future", dueAt: "2020-01-01T12:00:00.000Z", message: "Bid response due date must be in the future" },
  ])("rejects a $label response deadline without creating bid evidence", async ({ dueAt, message }) => {
    const repository = configureContext();
    const before = repository.snapshot();

    const response = await POST(bidRequest(dueAt), {
      params: Promise.resolve({ id: WORK_ORDER_ID }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION", error: message });
    expect(repository.snapshot()).toEqual(before);
  });
});
