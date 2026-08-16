import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/work-orders/[id]/control/route";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";

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
const ASSIGNMENT_ID = "assignment-northline-104-issued";
const ISSUANCE_ID = "issuance-northline-104-issued-r1";

const facilitiesSession: OperatorSession = {
  userId: "user-route-contract",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide - 15 stores",
};

function manualResponseRequest(overrides: Record<string, string> = {}) {
  const values = {
    operation: "vendor_response",
    expectedAssignmentId: ASSIGNMENT_ID,
    expectedIssuanceId: ISSUANCE_ID,
    expectedIssuanceRevision: "1",
    response: "accepted",
    responseSource: "phone",
    responderName: "Morgan Hayes",
    message: "Confirmed the authorization and requested service window.",
    ...overrides,
  };
  const formData = new FormData();
  Object.entries(values).forEach(([name, value]) => formData.set(name, value));
  return new Request(`https://operations.test/api/ops/work-orders/${WORK_ORDER_ID}/control`, {
    method: "POST",
    body: formData,
  });
}

function configureContext(fixture: OpsFixture) {
  const repository = createOpsFixtureRepository(fixture);
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

function addReplacementRevision(fixture: OpsFixture, reassign: boolean) {
  const priorIssuance = fixture.issuances.find((item) => item.id === ISSUANCE_ID)!;
  let assignmentId = ASSIGNMENT_ID;
  if (reassign) {
    fixture.assignments.find((item) => item.id === ASSIGNMENT_ID)!.status = "superseded";
    assignmentId = "assignment-northline-104-reissued";
    fixture.assignments.push({
      id: assignmentId,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: WORK_ORDER_ID,
      kind: "outside_vendor",
      vendorId: "vendor-northline-cedar",
      status: "issued",
      assignedAt: "2026-08-11T16:00:00.000Z",
      supersedesAssignmentId: ASSIGNMENT_ID,
    });
  }
  fixture.issuances.push({
    ...priorIssuance,
    id: reassign
      ? "issuance-northline-104-reassigned-r2"
      : "issuance-northline-104-issued-r2",
    assignmentId,
    revision: 2,
    issuedAt: "2026-08-11T16:05:00.000Z",
  });
}

describe("operator manual vendor-response route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a response only on the exact current assignment and issuance revision", async () => {
    const repository = configureContext(buildNorthlinePresentationFixture());
    const before = repository.snapshot();

    const response = await POST(manualResponseRequest(), {
      params: Promise.resolve({ id: WORK_ORDER_ID }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/app/work-orders/${WORK_ORDER_ID}?updated=vendor-response#work-control`,
    );
    const after = repository.snapshot();
    expect(after.vendorResponses).toHaveLength(before.vendorResponses.length + 1);
    expect(after.vendorResponses.at(-1)).toMatchObject({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: WORK_ORDER_ID,
      assignmentId: ASSIGNMENT_ID,
      issuanceId: ISSUANCE_ID,
      response: "accepted",
      responderName: "Morgan Hayes",
    });
    expect(after.vendorResponses.at(-1)?.message).toMatch(
      /^Operator-recorded from phone by Jordan Lee\./,
    );
    expect(after.assignments.find((item) => item.id === ASSIGNMENT_ID)?.status).toBe("accepted");
    expect(after.workOrders.find((item) => item.id === WORK_ORDER_ID)?.status).toBe("accepted");
  });

  it.each([
    { label: "a newer issuance revision on the same assignment", reassign: false },
    { label: "a new vendor assignment and issuance", reassign: true },
  ])("rejects a stale form after $label without mutating records", async ({ reassign }) => {
    const fixture = buildNorthlinePresentationFixture();
    addReplacementRevision(fixture, reassign);
    const repository = configureContext(fixture);
    const before = repository.snapshot();

    const response = await POST(manualResponseRequest(), {
      params: Promise.resolve({ id: WORK_ORDER_ID }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "CONFLICT",
      error: "This vendor handoff changed after the page loaded. Refresh the work order before recording the vendor response.",
    });
    expect(repository.snapshot()).toEqual(before);
  });
});
