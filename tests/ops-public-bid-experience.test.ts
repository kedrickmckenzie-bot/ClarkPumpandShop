import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ServiceAuthorizationView, VendorEstimateView } from "@/components/ops-public/contracts";
import { ServiceAuthorizationPage } from "@/components/ops-public/service-authorization-page";
import { VendorEstimatePage } from "@/components/ops-public/vendor-estimate-page";

const bidRequest: VendorEstimateView = {
  organizationName: "Northline Fuel & Market",
  organizationSupport: "facilities@example.test",
  vendorName: "Cedar Mechanical",
  operatorWorkOrderNumber: "NL-2026-0117",
  status: "submitted",
  statusLabel: "Bid submitted",
  requestKindLabel: "Bid request - pricing only",
  requestedAt: "2026-08-10T14:51:00.000Z",
  dueAt: "2026-08-11T16:00:00.000Z",
  store: {
    number: "105",
    name: "Northline Lakeside",
    address: "105 Lakeside Road, Lakeside, MI 49032",
  },
  problem: "The rooftop unit serving the sales floor is not cooling.",
  requestedScope: "Provide a fixed-price bid for the compressor repair.",
  latestProposal: {
    revision: 1,
    amountLabel: "$1,780.00",
    scope: "Replace compressor contactor and verify operation.",
    submittedAt: "2026-08-10T16:04:00.000Z",
  },
  canRespond: true,
  mode: "demo",
};

const serviceAuthorization: ServiceAuthorizationView = {
  organizationName: "Northline Fuel & Market",
  organizationSupport: "facilities@example.test",
  vendorName: "Summit Refrigeration",
  operatorWorkOrderNumber: "NL-2026-0116",
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
    notToExceedLabel: "$1,750.00 USD without additional approval",
    requestedBy: "Jordan Lee",
    billingInstruction: "Reference NL-2026-0116 on the invoice.",
  },
  technicianVisitUrl: "/public/store/service-token/visit",
  mode: "demo",
};

describe("public bid request and service authorization distinction", () => {
  it("presents a bid request as pricing-only RFP evidence with no onsite authority", () => {
    const markup = renderToStaticMarkup(createElement(VendorEstimatePage, {
      token: "bid-request-token",
      estimate: bidRequest,
    }));

    expect(markup).toContain("Vendor Bid Request");
    expect(markup).toContain("What the operator wants you to bid");
    expect(markup).toContain("Bid due");
    expect(markup).toContain("Submit bid");
    expect(markup).toContain("This bid request is pricing only");
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
    expect(markup).toContain("Authorized work issued to Summit Refrigeration");
    expect(markup).toContain("This is a work order, not a bid request");
    expect(markup).toContain("Your company was selected for this work");
    expect(markup).toContain("accept the service authorization before scheduling or beginning work");
    expect(markup).toContain("Technician check-in and checkout");
    expect(markup).toContain("Open technician check-in / checkout");
    expect(markup).toContain("Accept work");
  });
});
