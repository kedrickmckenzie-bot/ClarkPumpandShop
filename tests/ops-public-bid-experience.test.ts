import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ServiceAuthorizationView, VendorEstimateView } from "@/components/ops-public/contracts";
import { ServiceAuthorizationPage } from "@/components/ops-public/service-authorization-page";
import { VendorEstimatePage } from "@/components/ops-public/vendor-estimate-page";

const quoteRequest: VendorEstimateView = {
  organizationName: "Clark Pump and Shop",
  organizationSupport: "facilities@example.test",
  vendorName: "ClearFlow HVAC, Plumbing & Kitchen Repair",
  operatorWorkOrderNumber: "CPS-2026-0117",
  status: "submitted",
  statusLabel: "Quote submitted",
  requestKindLabel: "Quote request - pricing only",
  requestedAt: "2026-08-10T14:51:00.000Z",
  dueAt: "2026-08-11T16:00:00.000Z",
  store: {
    number: "105",
    name: "Northline Lakeside",
    address: "105 Lakeside Road, Lakeside, MI 49032",
  },
  problem: "The rooftop unit serving the sales floor is not cooling.",
  requestedScope: "Provide a fixed-price quote for the compressor repair.",
  latestProposal: {
    revision: 1,
    amountLabel: "$1,780.00",
    amount: "1780.00",
    currency: "USD",
    scope: "Replace compressor contactor and verify operation.",
    submittedAt: "2026-08-10T16:04:00.000Z",
  },
  previousProposals: [],
  canRespond: true,
  mode: "demo",
};

const serviceAuthorization: ServiceAuthorizationView = {
  organizationName: "Clark Pump and Shop",
  organizationSupport: "facilities@example.test",
  vendorName: "ColdLine Refrigeration & HVAC",
  operatorWorkOrderNumber: "CPS-2026-0116",
  revision: 1,
  issuedAt: "2026-08-10T14:00:00.000Z",
  opened: true,
  status: "awaiting_response",
  priority: "Priority",
  store: {
    number: "104",
    name: "Northline Ridgeview",
    address: "104 Ridgeview Drive, Ridgeview, MI 49031",
  },
  service: {
    problem: "The beer cave evaporator fan is grinding.",
    requestedWork: "Inspect and repair the evaporator fan assembly.",
  },
  authorization: {
    requestedBy: "Jordan Lee",
    billingInstruction: "Reference CPS-2026-0116 on the invoice.",
  },
  nextStep: "Review the authorized scope, then accept, propose a visit time, ask a question, or decline.",
  technicianVisitUrl: "/public/store/service-token/visit",
  mode: "demo",
};

describe("public quote request and service authorization distinction", () => {
  it("presents an ordinary quote request as pricing-only evidence with no onsite authority", () => {
    const markup = renderToStaticMarkup(createElement(VendorEstimatePage, {
      token: "quote-request-token",
      estimate: quoteRequest,
    }));

    expect(markup).toContain("Vendor Quote Request");
    expect(markup).toContain("What the operator wants priced");
    expect(markup).toContain("Quote due");
    expect(markup).toContain("Submit revised quote");
    expect(markup).toContain("This quote request is pricing only");
    expect(markup).toContain("not assigned or authorized");
    expect(markup).toContain("Do not travel to the store, check in, begin service, or bill against it");
    expect(markup).toContain("does not create a second work order");
    expect(markup).not.toContain("Submit estimate");
    expect(markup).not.toContain("Open technician check-in / checkout");
  });

  it("presents the separate service authorization as selected work with visit tools", () => {
    const markup = renderToStaticMarkup(createElement(ServiceAuthorizationPage, {
      token: "service-authorization-token",
      authorization: serviceAuthorization,
    }));

    expect(markup).toContain("Work Order / Service Authorization");
    expect(markup).toContain("Authorized work issued to ColdLine Refrigeration &amp; HVAC");
    expect(markup).toContain("This is authorized work, not a quote request");
    expect(markup).toContain("Your company was selected for this work");
    expect(markup).toContain("Digital acceptance is available when your company uses it");
    expect(markup).toContain("operator may still allow technician check-in for already-issued work");
    expect(markup).toContain("Work reference &amp; billing");
    expect(markup).not.toMatch(/authorization limit|not-to-exceed|\bNTE\b/iu);
    expect(markup).toContain("Technician check-in and checkout");
    expect(markup).toContain("Open technician check-in / checkout");
    expect(markup).toContain("Accept work");
  });
});
