import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { POST } from "@/app/api/ops/preview-edition/route";
import type { OperatorSession } from "@/components/ops/data-contract";
import { CreateWorkOrderForm } from "@/components/ops/forms";
import {
  contextualNavigationForPath,
  navigationForRole,
} from "@/components/ops/navigation";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import { VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";

let buildAccountabilityDashboardModel: typeof import("@/app/app/_data/operator-presenter").buildAccountabilityDashboardModel;
let buildSearchModel: typeof import("@/app/app/_data/operator-presenter").buildSearchModel;
let buildCreateWorkOrderModel: typeof import("@/app/app/_data/operator-presenter").buildCreateWorkOrderModel;
let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;
let buildVendorPerformanceListModel: typeof import("@/app/app/_data/operator-presenter").buildVendorPerformanceListModel;

beforeAll(async () => {
  ({ buildAccountabilityDashboardModel, buildCreateWorkOrderModel, buildListModel, buildSearchModel, buildVendorPerformanceListModel } = await import("@/app/app/_data/operator-presenter"));
});

function editionRequest(edition: string, returnTo = "/app/overview") {
  const body = new FormData();
  body.set("edition", edition);
  body.set("returnTo", returnTo);
  return new Request("http://127.0.0.1:8788/api/ops/preview-edition", { method: "POST", body });
}

function session(overrides: Partial<OperatorSession> = {}): OperatorSession {
  return {
    userId: "edition-preview-user",
    displayName: "Edition preview operator",
    email: "edition-preview@northline.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    demoEdition: "accountability",
    ...overrides,
  };
}

describe("demo package switch", () => {
  it("persists the selected package and redirects away from a complete-only screen", async () => {
    const response = await POST(editionRequest("accountability", "/app/lifecycle?asset=asset-115-beer-cave"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/app/overview");
    expect(response.headers.get("set-cookie")).toContain("ops-preview-edition=accountability");
  });

  it("returns to the current screen when the complete package is selected", async () => {
    const response = await POST(editionRequest("complete", "/app/lifecycle?asset=asset-115-beer-cave"));
    expect(response.headers.get("location")).toBe("/app/lifecycle?asset=asset-115-beer-cave");
  });

  it("rejects unknown package values", async () => {
    const response = await POST(editionRequest("enterprise-plus"));
    expect(response.status).toBe(422);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("presents a focused four-destination accountability navigation", () => {
    expect(navigationForRole("facilities", "accountability").map((item) => item.id)).toEqual([
      "overview",
      "work",
      "stores",
      "vendors",
    ]);
    expect(navigationForRole("executive", "accountability").find((item) => item.id === "overview")?.href)
      .toBe("/app/overview");
    expect(contextualNavigationForPath("facilities", "/app/work-orders", "accountability")?.items.map((item) => item.id))
      .toEqual(["work-orders", "visits"]);
    expect(navigationForRole("facilities", "complete")).toHaveLength(6);
  });

  it("builds the smaller package from source service records without planning links", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildAccountabilityDashboardModel(fixture, session());
    const links = [
      ...model.metrics.map((metric) => metric.link.href),
      ...model.priorityActions.map((action) => action.link.href),
      ...model.breakdowns.flatMap((breakdown) => [
        breakdown.sourceLink.href,
        ...breakdown.segments.map((segment) => segment.link.href),
      ]),
      ...(model.spotlight ? [model.spotlight.link.href] : []),
    ];

    expect(model.page.title).toBe("Vendor check-in & work orders");
    expect(model.metrics).toHaveLength(4);
    expect(model.breakdowns.map((breakdown) => breakdown.title)).toEqual(["Open work by status"]);
    expect(model.journey).toBeUndefined();
    expect(model.spotlight).toBeUndefined();
    expect(model.priorityActions.every((action) => action.link.href.startsWith("/app/visits/"))).toBe(true);
    expect(links.every((href) => !href.startsWith("/app/spend") && !href.startsWith("/app/lifecycle") && !href.startsWith("/app/equipment"))).toBe(true);
  });

  it("keeps equipment out of accountability search results", () => {
    const fixture = buildNorthlinePresentationFixture();
    const accountability = buildSearchModel(fixture, session(), { q: "beer cave" });
    const complete = buildSearchModel(fixture, session({ demoEdition: "complete" }), { q: "beer cave" });

    expect(accountability.groups.map((group) => group.id)).not.toContain("equipment");
    expect(accountability.groups.map((group) => group.id)).not.toContain("requests");
    expect(complete.groups.map((group) => group.id)).toContain("equipment");
  });

  it("removes costs and advanced setup from accountability work and store lists", () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = buildListModel(fixture, session(), "work-orders");
    const stores = buildListModel(fixture, session(), "stores");
    const visits = buildListModel(fixture, session(), "visits", { review: "true" });

    expect(work.table.columns.map((column) => column.key)).not.toContain("cost");
    expect(stores.table.columns.map((column) => column.key)).not.toContain("cost");
    expect(visits.appliedFilters?.map((filter) => filter.label)).toContain("Needs review");
  });

  it("renders an operational vendor directory instead of scorecards", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildVendorPerformanceListModel(fixture, session());
    const accountabilityMarkup = renderToStaticMarkup(createElement(VendorPerformanceList, { model, edition: "accountability" }));
    const completeMarkup = renderToStaticMarkup(createElement(VendorPerformanceList, { model, edition: "complete" }));

    expect(accountabilityMarkup).toContain("Dispatch contact");
    expect(accountabilityMarkup).not.toContain("Vendors to review");
    expect(accountabilityMarkup).not.toContain("Median first response");
    expect(accountabilityMarkup).not.toContain("Recorded work cost");
    expect(completeMarkup).toContain("Median first response");
  });

  it("reduces work-order creation to outside-vendor routing", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildCreateWorkOrderModel(fixture, session(), {});
    const accountabilityMarkup = renderToStaticMarkup(createElement(CreateWorkOrderForm, { model, edition: "accountability" }));
    const completeMarkup = renderToStaticMarkup(createElement(CreateWorkOrderForm, { model, edition: "complete" }));

    expect(accountabilityMarkup).toContain("Choose the vendor");
    expect(accountabilityMarkup).not.toContain("Internal maintenance");
    expect(accountabilityMarkup).not.toContain("Request quotes first");
    expect(accountabilityMarkup).not.toContain("Not-to-exceed amount");
    expect(completeMarkup).toContain("Request quotes first");
  });
});
