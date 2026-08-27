import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { WorkOrderControlPanel } from "@/components/ops/service-control-panels";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { ApprovalRequest, OpsFixture } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));

let buildWorkOrderControlModel: typeof import("@/app/app/_data/operator-presenter").buildWorkOrderControlModel;

beforeAll(async () => {
  ({ buildWorkOrderControlModel } = await import("@/app/app/_data/operator-presenter"));
});

const WORK_ORDER_ID = "wo-northline-105-price-check";
const APPROVAL_REQUEST_ID = "approval-request-ui-pending";

function addPendingApproval(fixture: OpsFixture) {
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
    requiredRole: "facilities_admin",
    escalationRole: "executive",
    requestedByMembershipId: "membership-northline-regional-1",
    requestedByName: "Morgan Hayes",
    reason: "Selected repair scope exceeds the regional authorization limit",
    requestedAt: "2026-08-20T13:00:00.000Z",
    dueAt: "2026-08-21T13:00:00.000Z",
  };
  fixture.approvalRequests.push(approvalRequest);
}

function session(membershipId: string, role: OperatorSession["role"]): OperatorSession {
  return {
    userId: `user-${role}`,
    membershipId,
    displayName: `${role} preview operator`,
    email: `${role}@clark-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
  };
}

describe("work-order pending approval controls", () => {
  it("renders policy facts, all permitted decisions, and conditional reason guidance in a functional form", () => {
    const fixture = buildNorthlinePresentationFixture();
    addPendingApproval(fixture);
    const model = buildWorkOrderControlModel(
      fixture,
      session("membership-northline-facilities", "facilities"),
      WORK_ORDER_ID,
    );

    const markup = renderToStaticMarkup(createElement(WorkOrderControlPanel, { model }));

    expect(markup).toContain("Approval needed");
    expect(markup).toContain("Major repair authorization · version 1");
    expect(markup).toContain("$6,250.00");
    expect(markup).toContain("Maintenance administrator");
    expect(markup).toContain("Aug 21, 1:00 PM");
    expect(markup).toContain(`action="/api/ops/approvals/${APPROVAL_REQUEST_ID}/decision"`);
    expect(markup).toContain('name="decision"');
    expect(markup).toContain('value="approved"');
    expect(markup).toContain('value="rejected"');
    expect(markup).toContain('value="escalated"');
    expect(markup).toContain('name="reason"');
    expect(markup).toContain("A reason is required for rejection or escalation and optional for approval.");
    expect(markup).toContain("The policy version and presented amount remain immutable.");
  });

  it("keeps the pending approval visible but withholds the form from a different membership role", () => {
    const fixture = buildNorthlinePresentationFixture();
    addPendingApproval(fixture);
    const model = buildWorkOrderControlModel(
      fixture,
      session("membership-northline-executive", "executive"),
      WORK_ORDER_ID,
    );

    const markup = renderToStaticMarkup(createElement(WorkOrderControlPanel, { model }));

    expect(markup).toContain("Approval needed");
    expect(markup).toContain("An active Maintenance administrator membership must record this decision.");
    expect(markup).not.toContain(`action="/api/ops/approvals/${APPROVAL_REQUEST_ID}/decision"`);
  });
});
