import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorRole, OperatorSession } from "@/components/ops/data-contract";
import { EstimateComparisonPanel } from "@/components/ops/estimate-comparison-panel";
import { VendorIssuancePanel } from "@/components/ops/forms";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildEstimateComparisonModel: typeof import("@/app/app/_data/operator-presenter").buildEstimateComparisonModel;
let buildVendorIssuanceModel: typeof import("@/app/app/_data/operator-presenter").buildVendorIssuanceModel;

beforeAll(async () => {
  ({ buildEstimateComparisonModel, buildVendorIssuanceModel } = await import("@/app/app/_data/operator-presenter"));
});

function session(role: OperatorRole): OperatorSession {
  return {
    userId: `path-state-${role}`,
    membershipId: `path-state-membership-${role}`,
    displayName: `${role} path-state reviewer`,
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: "Northline companywide - 15 stores",
  };
}

describe("operator bid and service path states", () => {
  it("keeps the service path visible but paused while vendor bid requests remain open", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildVendorIssuanceModel(fixture, session("facilities"), "wo-northline-105-price-check");
    const markup = renderToStaticMarkup(createElement(VendorIssuancePanel, { model }));

    expect(model).toMatchObject({
      available: true,
      permitted: true,
      rolePermitted: true,
      workflowBlocked: true,
    });
    expect(markup).toContain("Service path");
    expect(markup).toContain("Service path paused");
    expect(markup).toContain("Select a bid for service authorization");
    expect(markup).toContain("withdraw every open bid request");
    expect(markup).not.toContain("Generate service authorization");
  });

  it("keeps the bid path visible but paused while outside service authorization is live", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildEstimateComparisonModel(
      fixture,
      session("facilities"),
      NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
    );
    const markup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model }));

    expect(model).toMatchObject({
      available: true,
      permitted: true,
      rolePermitted: true,
      workflowBlocked: true,
    });
    expect(markup).toContain("Bid path");
    expect(markup).toContain("Bid path paused");
    expect(markup).toContain("service authorization must be cancelled or declined");
    expect(markup).not.toContain("Send another bid request");
  });

  it("shows role denial separately from a workflow lock", () => {
    const fixture = buildNorthlinePresentationFixture();
    const serviceModel = buildVendorIssuanceModel(fixture, session("executive"), "wo-northline-105-price-check");
    const bidModel = buildEstimateComparisonModel(
      fixture,
      session("executive"),
      NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
    );
    const serviceMarkup = renderToStaticMarkup(createElement(VendorIssuancePanel, { model: serviceModel }));
    const bidMarkup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model: bidModel }));

    expect(serviceModel).toMatchObject({ rolePermitted: false, workflowBlocked: true });
    expect(bidModel).toMatchObject({ rolePermitted: false, workflowBlocked: true });
    expect(serviceMarkup).toContain("Your role can review the service path but cannot send a service authorization");
    expect(serviceMarkup).not.toContain("Service path paused");
    expect(bidMarkup).toContain("Your role can review the bid path but cannot send bid requests");
    expect(bidMarkup).not.toContain("Bid path paused");
  });

  it("labels preview bid creation without claiming outbound delivery", () => {
    const fixture = buildNorthlinePresentationFixture();
    const request = fixture.estimateRequests.find((candidate) => candidate.id === "estimate-request-105-summit")!;
    request.status = "requested";
    request.dueAt = "2026-08-27T16:00:00.000Z";
    request.openedAt = undefined;
    request.respondedAt = undefined;
    fixture.estimateRequests = fixture.estimateRequests.filter((candidate) => candidate.id === request.id);
    fixture.estimateProposals = [];
    const model = buildEstimateComparisonModel(fixture, session("facilities"), request.workOrderId);
    const markup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model }));

    expect(model.requests.find((candidate) => candidate.id === request.id)?.statusLabel).toBe("Link generated");
    expect(markup).toContain("Request created");
    expect(markup).toContain("This preview prepares a secure response link");
    expect(markup).toContain("it does not send email or text messages");
    expect(markup).not.toContain(">Sent<");
  });
});
