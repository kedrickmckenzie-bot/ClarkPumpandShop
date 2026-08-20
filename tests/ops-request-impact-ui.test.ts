import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { RequestReviewPanel } from "@/components/ops/service-control-panels";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

import { buildDetailModel, buildRequestReviewModel } from "@/app/app/_data/operator-presenter";

const session: OperatorSession = {
  userId: "user-northline-facilities",
  membershipId: "membership-northline-facilities",
  displayName: "Jordan Lee",
  email: "jordan.lee@northline-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Northline Fuel & Market",
  scopeLabel: "Northline companywide · 15 stores",
};

describe("request impact presentation", () => {
  it("surfaces current/history evidence and the estimate caveat on request and downstream work-order records", () => {
    const fixture = buildNorthlinePresentationFixture();
    const request = fixture.requests.find((candidate) => candidate.convertedWorkOrderId)!;
    const requestDetail = buildDetailModel(fixture, session, "request", request.id);
    const workDetail = buildDetailModel(fixture, session, "work-order", request.convertedWorkOrderId!);
    const requestImpact = requestDetail.sections.find((section) => section.id === "business-impact")!;
    const workImpact = workDetail.sections.find((section) => section.id === "business-impact")!;

    expect(requestImpact.description).toMatch(/not verified losses/i);
    expect(requestImpact.table?.rows.length).toBeGreaterThanOrEqual(2);
    expect(workImpact.description).toMatch(/not verified losses/i);
    expect(workImpact.table?.rows.map((row) => row.id)).toEqual(requestImpact.table?.rows.map((row) => row.id));
  });

  it("provides the latest assessment as review-form defaults and blocks work selection until manager review", () => {
    const fixture = buildNorthlinePresentationFixture();
    const request = fixture.requests.find((candidate) => candidate.status === "submitted")!;
    const model = buildRequestReviewModel(fixture, session, request.id);

    expect(model.impactSubmitAction).toBe(`/api/ops/requests/${request.id}/impact`);
    expect(model.latestImpact?.id).toBeTruthy();
    expect(model.impactHistory).toHaveLength(1);
    expect(model.impactCaveat).toMatch(/not verified losses/i);
    expect(model.canCreateWorkOrder).toBe(false);
  });

  it("makes a pending request-level authorization executable from the request record", () => {
    const fixture = buildNorthlinePresentationFixture();
    const requestId = "request-current-106-ceiling-stain";
    const model = buildRequestReviewModel(fixture, session, requestId);
    const detail = buildDetailModel(fixture, session, "request", requestId);
    const markup = renderToStaticMarkup(createElement(RequestReviewPanel, { model }));

    expect(model.pendingApproval).toMatchObject({
      requestId: "approval-request-106-facilities-pending",
      canDecide: true,
      requiredRoleLabel: "Facilities administrator",
    });
    expect(model.canCreateWorkOrder).toBe(false);
    expect(detail.page.primaryAction).toBeUndefined();
    expect(detail.sections.find((section) => section.id === "source-report")).toMatchObject({
      facts: expect.arrayContaining([
        expect.objectContaining({ label: "Review state", value: "Awaiting approval decision" }),
      ]),
      action: undefined,
    });
    expect(markup).toContain("Authorization decision required");
    expect(markup).toContain("Ordinary request-review updates cannot approve this request.");
    expect(markup).toContain('action="/api/ops/approvals/approval-request-106-facilities-pending/decision"');
    expect(markup).toContain('name="decision"');
    expect(markup).toContain('value="approved"');
    expect(markup).toContain('value="rejected"');
    expect(markup).toContain("The policy version and presented amount remain immutable.");
  });

  it("offers conversion only after impact review when no approval is required", () => {
    const fixture = buildNorthlinePresentationFixture();
    const requestId = "request-current-110-ice-machine";
    const detail = buildDetailModel(fixture, session, "request", requestId);

    expect(detail.page.primaryAction).toEqual({
      label: "Create work order",
      href: `/app/work-orders/new?request=${requestId}`,
    });
    expect(detail.sections.find((section) => section.id === "source-report")).toMatchObject({
      facts: expect.arrayContaining([
        expect.objectContaining({ label: "Review state", value: "Ready for work-order creation" }),
      ]),
      action: {
        label: "Create the accountable work record",
        href: `/app/work-orders/new?request=${requestId}`,
      },
    });
  });

  it("keeps structured impact inputs and the caveat embedded in employee intake and manager review", async () => {
    const [intake, review] = await Promise.all([
      readFile("components/ops/forms.tsx", "utf8"),
      readFile("components/ops/service-control-panels.tsx", "utf8"),
    ]);
    for (const field of ["storeOperatingState", "safetyConcern", "productInventoryRisk", "customersAffected", "complianceImpact", "redundantEquipment", "estimatedDailyRevenueExposure", "estimatedDowntimeMinutes", "confidence"]) {
      expect(intake).toContain(`name="${field}"`);
      expect(review).toContain(`name="${field}"`);
    }
    expect(intake).toMatch(/not verified losses/i);
    expect(review).toContain("expectedLatestAssessmentId");
  });
});
