import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { VendorPerformanceDetail, VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import type { OperatorSession } from "@/components/ops/data-contract";

vi.mock("server-only", () => ({}));

let buildVendorPerformanceDetailModel: typeof import("@/app/app/_data/operator-presenter").buildVendorPerformanceDetailModel;
let buildVendorPerformanceListModel: typeof import("@/app/app/_data/operator-presenter").buildVendorPerformanceListModel;

beforeAll(async () => {
  ({ buildVendorPerformanceDetailModel, buildVendorPerformanceListModel } = await import("@/app/app/_data/operator-presenter"));
});

function session(): OperatorSession {
  return {
    userId: "user-northline-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Jordan Lee",
    email: "jordan@example.test",
    role: "facilities",
    organizationId: "org-northline-demo",
    organizationName: "Northline Fuel & Market",
    scopeLabel: "All 15 stores",
    permissions: [],
  };
}

function latestVendorForWork(fixture: OpsFixture, workOrderId: string) {
  return fixture.assignments
    .filter((assignment) => assignment.organizationId === "org-northline-demo" && assignment.workOrderId === workOrderId)
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0]?.vendorId;
}

describe("vendor performance workspace", () => {
  it("keeps all five approved vendors comparable while deriving every measure from source records", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildVendorPerformanceListModel(fixture, session());
    expect(model.vendors).toHaveLength(5);
    expect(new Set(model.vendors.map((vendor) => vendor.id)).size).toBe(5);

    const forecourt = model.vendors.find((vendor) => vendor.id === "vendor-northline-forecourt")!;
    const sourceVisits = fixture.visits.filter(
      (visit) => visit.organizationId === session().organizationId && visit.vendorId === forecourt.id,
    );
    expect(forecourt.measures.noWorkOrder).toMatchObject({
      numerator: sourceVisits.filter((visit) => !visit.workOrderId).length,
      denominator: sourceVisits.length,
    });

    const activeExceptions = fixture.exceptions.filter(
      (exception) => exception.organizationId === session().organizationId && exception.vendorId === forecourt.id && exception.status !== "resolved",
    );
    const attributedWorkIds = new Set(
      fixture.workOrders
        .filter((work) => latestVendorForWork(fixture, work.id) === forecourt.id)
        .map((work) => work.id),
    );
    const openFollowUps = fixture.followUps.filter(
      (followUp) => followUp.organizationId === session().organizationId && followUp.status === "open" && attributedWorkIds.has(followUp.workOrderId),
    );
    expect(forecourt.measures.accountability.numerator).toBe(activeExceptions.length + openFollowUps.length);
    expect(forecourt.measures.accountability.denominatorLabel).toContain(`${activeExceptions.length} active exception`);

    const sourceCost = fixture.costLines
      .filter((line) => line.organizationId === session().organizationId && attributedWorkIds.has(line.workOrderId))
      .reduce((total, line) => total + line.amount.amountMinor, 0);
    expect(forecourt.recordedCostMinor).toBe(sourceCost);
    expect(forecourt.coverageStoreCount).toBe(15);
    expect(forecourt.coverageStoreDenominator).toBe(15);
    expect(forecourt.coverageRegionCount).toBe(3);
  });

  it("calculates authorization response and acceptance from exact vendor assignments and issuance revisions", () => {
    const fixture = buildNorthlinePresentationFixture();
    const vendorId = "vendor-northline-brightpath";
    const model = buildVendorPerformanceDetailModel(fixture, session(), vendorId);
    const summary = model.summary!;
    const assignmentIds = new Set(
      fixture.assignments
        .filter((assignment) => assignment.organizationId === session().organizationId && assignment.vendorId === vendorId)
        .map((assignment) => assignment.id),
    );
    const issuanceIds = new Set(
      fixture.issuances
        .filter((issuance) => issuance.organizationId === session().organizationId && assignmentIds.has(issuance.assignmentId))
        .map((issuance) => issuance.id),
    );
    const exactResponses = fixture.vendorResponses.filter(
      (response) => response.organizationId === session().organizationId && assignmentIds.has(response.assignmentId) && issuanceIds.has(response.issuanceId),
    );
    const terminalIssuanceIds = new Set(
      exactResponses
        .filter((response) => response.response === "accepted" || response.response === "declined")
        .map((response) => response.issuanceId),
    );
    const acceptedIssuanceIds = new Set(
      exactResponses.filter((response) => response.response === "accepted").map((response) => response.issuanceId),
    );
    expect(summary.measures.acceptance.denominator).toBe(terminalIssuanceIds.size);
    expect(summary.measures.acceptance.numerator).toBe(acceptedIssuanceIds.size);
    expect(model.authorizationRows).toHaveLength(issuanceIds.size);
    expect(model.authorizationRows.every((row) => row.href.startsWith("/app/work-orders/"))).toBe(true);
    expect(model.authorizationRows.filter((row) => row.decisionLabel === "Accepted")).toHaveLength(acceptedIssuanceIds.size);
  });

  it("shows not enough history instead of manufacturing a rating", () => {
    const fixture = structuredClone(buildNorthlinePresentationFixture());
    const vendorId = "vendor-northline-four-seasons";
    const assignmentIds = new Set(fixture.assignments.filter((assignment) => assignment.vendorId === vendorId).map((assignment) => assignment.id));
    fixture.vendorResponses = fixture.vendorResponses.filter((response) => !assignmentIds.has(response.assignmentId));

    const detail = buildVendorPerformanceDetailModel(fixture, session(), vendorId);
    expect(detail.summary?.measures.responseTime).toMatchObject({ value: "Not enough history", state: "insufficient", numerator: 0 });
    expect(detail.summary?.measures.acceptance).toMatchObject({ value: "Not enough history", state: "insufficient", denominator: 0 });

    const markup = renderToStaticMarkup(createElement(VendorPerformanceDetail, { model: detail }));
    expect(markup).toContain("Not enough history");
    expect(markup).toContain("Evidence, not a rating");
    expect(markup).not.toContain("Overall score");
  });

  it("renders denominator-first scorecard cells and evidence links without an opaque score", () => {
    const fixture = buildNorthlinePresentationFixture();
    const list = buildVendorPerformanceListModel(fixture, session());
    const markup = renderToStaticMarkup(createElement(VendorPerformanceList, { model: list }));
    expect(markup).toContain("No composite vendor score");
    expect(markup).toContain("issued authorizations have a recorded response");
    expect(markup).toContain("Open response evidence");
    expect(markup).toContain("Open cost sources");
    expect(markup).toContain("5 of 5 approved vendors");
  });

  it("searches vendor specialties through organization-approved plain-language aliases", () => {
    const fixture = buildNorthlinePresentationFixture();
    const plumbing = buildVendorPerformanceListModel(fixture, session(), { q: "plumber" });
    expect(plumbing.vendors.map((vendor) => vendor.name)).toContain("Cedar Mechanical");
  });

  it("keeps work-order vendor source links exact by honoring the vendor query", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const { buildListModel } = await import("@/app/app/_data/operator-presenter");
    const vendorId = "vendor-northline-summit";
    const work = buildListModel(fixture, session(), "work-orders", { vendor: vendorId });
    expect(work.table.rows.length).toBeGreaterThan(0);
    for (const row of work.table.rows) {
      expect(latestVendorForWork(fixture, row.id)).toBe(vendorId);
    }
  });
});
