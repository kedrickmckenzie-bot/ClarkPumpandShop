import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/work-orders/route";
import { CreateWorkOrderForm } from "@/components/ops/forms";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

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

let buildCreateWorkOrderModel: typeof import("@/app/app/_data/operator-presenter").buildCreateWorkOrderModel;

beforeAll(async () => {
  ({ buildCreateWorkOrderModel } = await import("@/app/app/_data/operator-presenter"));
});

const session: OperatorSession = {
  userId: "user-bid-service-entry",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide · 15 stores",
};

function requestFor(
  assignmentKind: "bid_request" | "outside_vendor",
  url = "https://traceops.test/api/ops/work-orders",
) {
  const formData = new FormData();
  formData.set("storeId", "store-northline-101");
  formData.set("priority", "urgent");
  formData.set("problem", "Beer cave temperature is climbing above its normal range.");
  formData.set("assignmentKind", assignmentKind);
  if (assignmentKind === "outside_vendor") {
    formData.set("vendorId", "vendor-northline-summit");
  }
  return new Request(url, {
    method: "POST",
    body: formData,
  });
}

function configureContext() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  requestContextMocks.getOpsRequestContext.mockResolvedValue({
    session,
    repository,
    actor: {
      actorType: "user",
      actorId: session.membershipId,
      actorName: session.displayName,
      organizationId: session.organizationId,
    },
  });
  requestContextMocks.assertStoreInSessionScope.mockResolvedValue(undefined);
  return repository;
}

describe("work-order vendor path entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows direct service and pricing-only bid requests as different choices", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildCreateWorkOrderModel(fixture, session);
    const markup = renderToStaticMarkup(createElement(CreateWorkOrderForm, { model }));

    expect(markup).toContain("Choose the service path");
    expect(markup).toContain("Send service work");
    expect(markup).toContain("Request bids first");
    expect(markup).toContain("No vendor is assigned and no check-in is available");
    expect(markup).toContain("Bid requests ask for numbers only");
  });

  it("starts the bid path without assigning a vendor, issuing service, or creating cost", async () => {
    const repository = configureContext();
    const before = repository.snapshot();

    const response = await POST(requestFor(
      "bid_request",
      "http://0.0.0.0:3000/api/ops/work-orders",
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(/^\/app\/work-orders\//);
    expect(response.headers.get("location")).toMatch(/updated=bid-request-created#bid-requests$/);
    expect(response.headers.get("location")).not.toContain("0.0.0.0");
    const after = repository.snapshot();
    const workOrder = after.workOrders.at(-1)!;
    expect(workOrder.nextAction).toBe("Send bid requests and compare responses");
    const newAssignments = after.assignments.slice(before.assignments.length);
    expect(newAssignments).toEqual([
      expect.objectContaining({
        workOrderId: workOrder.id,
        kind: "choose_later",
        status: "pending",
      }),
    ]);
    expect(newAssignments[0]?.vendorId).toBeUndefined();
    expect(after.estimateRequests).toHaveLength(before.estimateRequests.length);
    expect(after.issuances).toHaveLength(before.issuances.length);
    expect(after.visits).toHaveLength(before.visits.length);
    expect(after.costLines).toHaveLength(before.costLines.length);
  });

  it("starts direct service with one pending vendor but no check-in eligibility before issuance", async () => {
    const repository = configureContext();
    const before = repository.snapshot();

    const response = await POST(requestFor("outside_vendor"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(/updated=service-work-created#issue-work$/);
    const after = repository.snapshot();
    const workOrder = after.workOrders.at(-1)!;
    expect(workOrder.nextAction).toBe("Issue service authorization");
    expect(after.assignments.slice(before.assignments.length)).toEqual([
      expect.objectContaining({
        workOrderId: workOrder.id,
        kind: "outside_vendor",
        vendorId: "vendor-northline-summit",
        status: "pending",
      }),
    ]);
    await expect(repository.findActiveVendorAssignment(
      NORTHLINE_ORGANIZATION_ID,
      workOrder.id,
      "vendor-northline-summit",
    )).resolves.toBeNull();
    expect(after.issuances).toHaveLength(before.issuances.length);
    expect(after.visits).toHaveLength(before.visits.length);
    expect(after.costLines).toHaveLength(before.costLines.length);
  });
});
