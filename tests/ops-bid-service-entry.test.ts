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
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;

beforeAll(async () => {
  ({ buildCreateWorkOrderModel, buildDetailModel } = await import("@/app/app/_data/operator-presenter"));
});

const session: OperatorSession = {
  userId: "user-bid-service-entry",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@clark-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Clark Pump and Shop",
  scopeLabel: "Clark Pump and Shop companywide · 15 stores",
};

function requestFor(
  assignmentKind: "bid_request" | "outside_vendor" | "hold_for_visit",
  url = "https://operations.test/api/ops/work-orders",
) {
  const formData = new FormData();
  formData.set("storeId", "store-northline-101");
  formData.set("priority", "urgent");
  formData.set("problem", "Beer cave temperature is climbing above its normal range.");
  formData.set("assignmentKind", assignmentKind);
  if (assignmentKind === "outside_vendor") {
    formData.set("vendorId", "vendor-northline-summit");
  }
  if (assignmentKind === "hold_for_visit") {
    formData.set("categoryKey", "plumbing");
    formData.set("holdPosture", "complete_using_professional_judgment");
    formData.set("holdDeadlineAt", "2026-10-10T12:30");
    formData.set("holdInternalReviewThreshold", "250.00");
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
  requestContextMocks.assertStoreInSessionScope.mockResolvedValue(
    repository.snapshot().stores.find((store) => store.id === "store-northline-101"),
  );
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
    expect(markup).toContain("Outside vendor");
    expect(markup).toContain("Request bids first");
    expect(markup).toContain("No vendor is assigned and no check-in is available");
    expect(markup).toContain("Bid requests ask for numbers only");
  });

  it("prefills an unmatched visit and creates its canonical work order with an auditable link", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const visitModel = buildDetailModel(fixture, session, "visit", "visit-northline-107-no-wo");
    expect(visitModel.page.primaryAction).toEqual({
      label: "Create work order from visit",
      href: "/app/work-orders/new?sourceException=exception-northline-107-no-wo",
    });
    expect(visitModel.sections[0]).toMatchObject({
      id: "missing-work-order",
      title: "Create the missing work order",
    });
    const model = buildCreateWorkOrderModel(fixture, session, { sourceException: "exception-northline-107-no-wo" });
    const markup = renderToStaticMarkup(createElement(CreateWorkOrderForm, { model }));
    expect(model.defaults).toMatchObject({
      storeId: "store-northline-107",
      problem: "Restore the flickering stockroom light and inspect the loose junction-box cover",
      priority: "routine",
      assignmentKind: "outside_vendor",
      vendorId: "vendor-northline-brightpath",
    });
    expect(model.sourceVisit).toMatchObject({
      visitId: "visit-northline-107-no-wo",
      providerName: "BrightLine Electrical & Lighting",
      outcomeLabel: "Resolved",
      outcomeNotes: "Replaced the failed LED driver, secured the junction-box cover, and confirmed the stockroom light remained stable before departure.",
    });
    expect(markup).toContain("After-the-fact service record");
    expect(markup).toContain("Documenting work after service began");
    expect(markup).toContain("It will not backdate authorization");
    expect(markup).toContain("Technician checkout");
    expect(markup).toContain("Replaced the failed LED driver");
    expect(markup).toContain("Create and link work order");
    expect(markup).toContain("sourceExceptionId");

    const repository = configureContext();
    const before = repository.snapshot();
    const formData = new FormData();
    formData.set("storeId", "store-northline-107");
    formData.set("priority", "urgent");
    formData.set("problem", "Restore the flickering stockroom light and inspect the loose junction-box cover");
    formData.set("assignmentKind", "outside_vendor");
    formData.set("vendorId", "vendor-northline-brightpath");
    formData.set("sourceExceptionId", "exception-northline-107-no-wo");

    const response = await POST(new Request("https://operations.test/api/ops/work-orders", { method: "POST", body: formData }));
    expect(response.status).toBe(303);
    const destination = new URL(response.headers.get("location")!, "https://operations.test");
    expect(destination.searchParams.get("view")).toBe("visits");
    expect(destination.searchParams.get("notice")).toContain("created after service began");
    const after = repository.snapshot();
    const beforeIds = new Set(before.workOrders.map((workOrder) => workOrder.id));
    const workOrder = after.workOrders.find((candidate) => !beforeIds.has(candidate.id))!;
    expect(workOrder).toMatchObject({ storeId: "store-northline-107", status: "completed_pending_review" });
    expect(after.visits.find((visit) => visit.id === "visit-northline-107-no-wo")?.workOrderId).toBe(workOrder.id);
    expect(after.exceptions.find((exception) => exception.id === "exception-northline-107-no-wo")).toMatchObject({ status: "resolved", workOrderId: workOrder.id });
    expect(after.assignments.find((assignment) => assignment.workOrderId === workOrder.id)).toMatchObject({ status: "accepted", vendorId: "vendor-northline-brightpath" });
    expect(after.workflowTasks.find((task) => task.workOrderId === workOrder.id && task.status === "open")).toMatchObject({
      taskType: "verify_repair",
      assigneeName: "Facilities coordinator",
      title: "Verify current service outcome",
    });
    expect(after.siteVisitWorkOrders).toContainEqual(expect.objectContaining({
      visitId: "visit-northline-107-no-wo",
      workOrderId: workOrder.id,
      outcome: "completed",
      outcomeNotes: "Replaced the failed LED driver, secured the junction-box cover, and confirmed the stockroom light remained stable before departure.",
    }));
    expect(after.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: "visit-northline-107-no-wo", eventType: "visit.reconciled" }));
    const reconciliation = after.auditEvents.find((event) => event.aggregateId === workOrder.id && event.eventType === "work_order.visit_reconciled");
    expect(JSON.parse(reconciliation!.payloadJson)).toMatchObject({ authorizationTiming: "recorded_after_service_began" });
    const createdDetail = buildDetailModel(after, session, "work-order", workOrder.id);
    expect(createdDetail.facts).toContainEqual(expect.objectContaining({ label: "Record origin", value: "Created after service began" }));
    expect(createdDetail.sections.find((section) => section.id === "authorization")).toMatchObject({
      title: "Service record and billing reference",
    });
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
    expect(response.headers.get("location")).toMatch(/view=service&updated=bid-request-created#bid-requests$/);
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
    expect(response.headers.get("location")).toMatch(/view=service&updated=service-work-created#issue-work$/);
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

  it("creates manager-approved held work without assigning a vendor or exposing a price", async () => {
    const repository = configureContext();
    const before = repository.snapshot();

    const response = await POST(requestFor("hold_for_visit"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("approved%20to%20wait%20for%20a%20matching%20vendor%20visit");
    const after = repository.snapshot();
    const workOrder = after.workOrders.at(-1)!;
    expect(workOrder).toMatchObject({
      status: "approved",
      categoryKey: "plumbing",
      accountableParty: "Facilities coordinator",
      nextAction: "Wait for a matching vendor visit",
    });
    expect(after.assignments).toHaveLength(before.assignments.length);
    expect(after.workOrderVisitHolds?.find((hold) => hold.workOrderId === workOrder.id)).toMatchObject({
      posture: "complete_using_professional_judgment",
      status: "active",
      deadlineAt: "2026-10-10T16:30:00.000Z",
      internalReviewThreshold: { amountMinor: 25_000, currency: "USD" },
    });
  });
});
