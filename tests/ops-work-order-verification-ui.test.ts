import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { WorkOrderVerificationPanel } from "@/components/ops/work-order-verification-panel";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { OpsFixture, SiteVisitWorkOrder, WorkOrderStatus } from "@/lib/ops/types";
import type { WorkOrderVerificationRecord } from "@/lib/ops/work-order-verification-commands";

vi.mock("server-only", () => ({}));

let buildWorkOrderVerificationModel: typeof import("@/app/app/_data/work-order-verification-presenter").buildWorkOrderVerificationModel;

beforeAll(async () => {
  ({ buildWorkOrderVerificationModel } = await import("@/app/app/_data/work-order-verification-presenter"));
});

const workOrderId = "wo-recent-aug-111-plumbing";
const visitId = "visit-recent-aug-111-plumbing";
const outcomeId = "site-visit-work-order-verification-ui";
const outcomeTime = "2026-08-10T13:37:00.000Z";

function session(role: OperatorSession["role"] = "facilities"): OperatorSession {
  return {
    userId: `user-verification-${role}`,
    membershipId: role === "facilities"
      ? "membership-northline-facilities"
      : role === "store_manager"
        ? "membership-northline-store-104"
        : "membership-northline-executive",
    displayName: role === "facilities" ? "Jordan Lee" : "Review user",
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: "Northline companywide · 15 stores",
    ...(role === "store_manager" ? { storeIds: ["store-northline-104"] } : {}),
  };
}

function verificationFixture() {
  const fixture = buildNorthlinePresentationFixture();
  fixture.siteVisitWorkOrders ??= [];
  fixture.siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter((record) => (
    record.workOrderId !== workOrderId
  ));
  (fixture as OpsFixture & { workOrderVerifications: WorkOrderVerificationRecord[] }).workOrderVerifications = [];
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === workOrderId)!;
  workOrder.status = "completed_pending_review";
  workOrder.version = 7;
  const outcome: SiteVisitWorkOrder = {
    id: outcomeId,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    visitId,
    workOrderId,
    ordinal: 1,
    linkedByActorType: "technician",
    linkedByActorName: "Imani Lewis",
    linkedAt: "2026-08-10T12:15:00.000Z",
    outcome: "completed",
    outcomeNotes: "Supply connection replaced and the sink remained dry during repeated use.",
    outcomeRecordedByActorType: "technician",
    outcomeRecordedByActorName: "Imani Lewis",
    outcomeRecordedAt: outcomeTime,
  };
  fixture.siteVisitWorkOrders.push(outcome);
  const verifyTask = fixture.workflowTasks.find((task) => task.workOrderId === workOrderId && task.taskType === "verify_repair");
  if (verifyTask) {
    Object.assign(verifyTask, {
      status: "open",
      createdAt: outcomeTime,
      completedAt: undefined,
      completedByActorType: undefined,
      completedByActorId: undefined,
      completedByActorName: undefined,
      resolutionNote: undefined,
    });
    fixture.workflowTasks = fixture.workflowTasks.filter((task) => task.workOrderId !== workOrderId || task.id === verifyTask.id);
  }
  return fixture as OpsFixture & { workOrderVerifications: WorkOrderVerificationRecord[] };
}

describe("embedded work-order verification surface", () => {
  it("binds verify and reject forms to the exact current outcome and work-order version", () => {
    const fixture = verificationFixture();
    const model = buildWorkOrderVerificationModel(fixture, session(), workOrderId);
    const markup = renderToStaticMarkup(createElement(WorkOrderVerificationPanel, { model }));

    expect(model).toMatchObject({
      permitted: true,
      canDecide: true,
      expectedWorkOrderVersion: 7,
      expectedSiteVisitWorkOrderId: outcomeId,
      expectedOutcomeRecordedAt: outcomeTime,
    });
    expect(markup).toContain("Verification, resolution, and closure");
    expect(markup).toContain("Work completed");
    expect(markup).toContain('type="hidden" name="decision" value="verified"');
    expect(markup).toContain('type="hidden" name="decision" value="rejected"');
    expect(markup).toContain(`type="hidden" name="expectedSiteVisitWorkOrderId" value="${outcomeId}"`);
    expect(markup).toContain("It does not close the work order automatically");
  });

  it("shows immutable rejected history and withholds another decision until a new outcome exists", () => {
    const fixture = verificationFixture();
    fixture.workOrderVerifications.push({
      id: "verification-ui-rejected",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      siteVisitWorkOrderId: outcomeId,
      outcome: "completed",
      outcomeRecordedAt: outcomeTime,
      cycle: 1,
      decision: "rejected",
      reason: "The sink cabinet is still wet after normal use.",
      decidedByMembershipId: "membership-northline-facilities",
      decidedByName: "Jordan Lee",
      decidedAt: "2026-08-10T15:00:00.000Z",
    });
    fixture.workOrders.find((candidate) => candidate.id === workOrderId)!.status = "in_progress";
    const model = buildWorkOrderVerificationModel(fixture, session(), workOrderId);
    const markup = renderToStaticMarkup(createElement(WorkOrderVerificationPanel, { model }));

    expect(model.canDecide).toBe(false);
    expect(model.history).toHaveLength(1);
    expect(markup).toContain("Cycle 1 · Rejected");
    expect(markup).toContain("The sink cabinet is still wet after normal use.");
    expect(markup).toContain("A new observed visit and outcome are required");
    expect(markup).not.toContain("Verify and mark resolved");
  });

  it("shows the current outcome read-only when a store manager is outside store scope", () => {
    const fixture = verificationFixture();
    const model = buildWorkOrderVerificationModel(fixture, session("store_manager"), workOrderId);

    expect(model.available).toBe(false);
    expect(model.permitted).toBe(false);
    expect(model.history).toEqual([]);
  });

  it("keeps evidence readable but removes decision forms for a review-only executive", () => {
    const fixture = verificationFixture();
    const model = buildWorkOrderVerificationModel(fixture, session("executive"), workOrderId);
    const markup = renderToStaticMarkup(createElement(WorkOrderVerificationPanel, { model }));

    expect(model.available).toBe(true);
    expect(model.permitted).toBe(false);
    expect(markup).toContain("Work completed");
    expect(markup).toContain("Decision unavailable");
    expect(markup).not.toContain('name="decision"');
  });

  it("presents a verified outcome as resolved but not automatically closed", () => {
    const fixture = verificationFixture();
    const decidedAt = "2026-08-10T15:00:00.000Z";
    fixture.workOrderVerifications.push({
      id: "verification-ui-verified",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      siteVisitWorkOrderId: outcomeId,
      outcome: "completed",
      outcomeRecordedAt: outcomeTime,
      cycle: 1,
      decision: "verified",
      reason: "Store manager observed normal operation.",
      decidedByMembershipId: "membership-northline-facilities",
      decidedByName: "Jordan Lee",
      decidedAt,
    });
    const workOrder = fixture.workOrders.find((candidate) => candidate.id === workOrderId)!;
    workOrder.status = "resolved" as WorkOrderStatus;
    Object.assign(workOrder, { resolvedAt: decidedAt });
    const model = buildWorkOrderVerificationModel(fixture, session(), workOrderId);

    expect(model.workOrderStatus).toBe("resolved");
    expect(model.resolvedLabel).toBeTruthy();
    expect(model.canDecide).toBe(false);
    expect(model.decisionBlockReason).toContain("Facilities can close it");
  });
});
