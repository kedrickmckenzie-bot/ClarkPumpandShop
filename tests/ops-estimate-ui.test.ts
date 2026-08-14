import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstimateComparisonPanel } from "@/components/ops/estimate-comparison-panel";
import type { EstimateComparisonViewModel } from "@/components/ops/data-contract";

describe("vendor bid presentation", () => {
  it("describes a decline as a vendor response instead of a bid receipt", () => {
    const model: EstimateComparisonViewModel = {
      available: true,
      permitted: false,
      rolePermitted: false,
      workflowBlocked: false,
      workOrderId: "wo-declined-estimate",
      workOrderNumber: "NL-TEST-1",
      submitAction: "/api/ops/work-orders/wo-declined-estimate/estimates",
      defaultRequestedScope: "Price the reported repair.",
      vendors: [],
      requests: [{
        id: "estimate-request-declined",
        vendorId: "vendor-declined",
        vendorName: "Example Vendor",
        kindLabel: "Bid request - pricing only",
        requestedScope: "Price the reported repair.",
        status: "declined",
        statusLabel: "Vendor declined",
        requestedLabel: "Aug 10, 2026, 10:00 AM",
        openedLabel: "Aug 10, 2026, 10:05 AM",
        respondedLabel: "Aug 10, 2026, 10:15 AM",
        decisionLabel: "Vendor declined Aug 10, 2026, 10:15 AM",
        canSelect: false,
        canWithdraw: false,
        canReopen: false,
        decisionAction: "/api/ops/work-orders/wo-declined-estimate/estimates/estimate-request-declined",
      }],
      comparisonClosed: false,
      activeRequestCount: 0,
      proposalCount: 0,
    };

    const markup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model }));

    expect(markup).toContain("Vendor response");
    expect(markup).toContain("Declined Aug 10, 2026, 10:15 AM");
    expect(markup).toContain("Bid request - pricing only");
    expect(markup).not.toContain("Estimate only");
    expect(markup).not.toContain("Price check");
  });

  it("keeps bid invitations visibly separate from service authorization", () => {
    const model: EstimateComparisonViewModel = {
      available: true,
      permitted: true,
      rolePermitted: true,
      workflowBlocked: false,
      workOrderId: "wo-bid-language",
      workOrderNumber: "NL-TEST-2",
      submitAction: "/api/ops/work-orders/wo-bid-language/estimates",
      defaultRequestedScope: "Price the compressor repair.",
      vendors: [{ value: "vendor-backup", label: "Backup Mechanical", description: "HVAC" }],
      requests: [{
        id: "estimate-request-submitted",
        vendorId: "vendor-submitted",
        vendorName: "Example Vendor",
        kindLabel: "Bid request - pricing only",
        requestedScope: "Provide a fixed-price bid for the compressor repair.",
        status: "submitted",
        statusLabel: "Bid received",
        requestedLabel: "Aug 10, 2026, 10:00 AM",
        dueLabel: "Aug 12, 2026, 5:00 PM",
        openedLabel: "Aug 10, 2026, 10:05 AM",
        respondedLabel: "Aug 10, 2026, 10:15 AM",
        latestProposal: {
          id: "proposal-submitted",
          revision: 1,
          amountLabel: "$1,780.00",
          scope: "Replace the compressor contactor and test operation.",
          submittedLabel: "Aug 10, 2026, 10:15 AM",
        },
        canSelect: true,
        canWithdraw: true,
        canReopen: false,
        decisionAction: "/api/ops/work-orders/wo-bid-language/estimates/estimate-request-submitted",
      }],
      comparisonClosed: false,
      activeRequestCount: 1,
      proposalCount: 1,
    };

    const markup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model }));

    expect(markup).toContain("Request and compare vendor bids");
    expect(markup).toContain("Bid requests are pricing only");
    expect(markup).toContain("Bid scope");
    expect(markup).toContain("Bid due Aug 12, 2026, 5:00 PM");
    expect(markup).toContain("Select bid for service authorization");
    expect(markup).toContain("Send another bid request");
    expect(markup).toContain("no assignment, site visit, check-in, recorded cost, or billing is created");
    expect(markup).not.toContain("Estimate only");
    expect(markup).not.toContain("Price check");
  });

  it("requires a bid response deadline in the operator request form", () => {
    const model: EstimateComparisonViewModel = {
      available: true,
      permitted: true,
      rolePermitted: true,
      workflowBlocked: false,
      workOrderId: "wo-new-bid",
      workOrderNumber: "NL-TEST-3",
      submitAction: "/api/ops/work-orders/wo-new-bid/estimates",
      defaultRequestedScope: "Price the reported repair.",
      vendors: [{ value: "vendor-one", label: "Vendor One" }],
      requests: [],
      comparisonClosed: false,
      activeRequestCount: 0,
      proposalCount: 0,
    };

    const markup = renderToStaticMarkup(createElement(EstimateComparisonPanel, { model }));

    expect(markup).toContain("Bid due <em>Required</em>");
    const dueInput = markup.match(/<input[^>]*name="dueAt"[^>]*>/)?.[0];
    expect(dueInput).toContain('type="datetime-local"');
    expect(dueInput).toContain('required=""');
  });
});
