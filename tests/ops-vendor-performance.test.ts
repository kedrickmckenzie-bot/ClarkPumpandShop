import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { VendorPerformanceDetail, VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";
import { recordVendorComplianceDocument, recordVendorQualification, type OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
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
    organizationName: "Clark Pump and Shop",
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
    expect(markup).toContain("Numbers, not a grade");
    expect(markup).not.toContain("Overall score");
  });

  it("renders the enterprise directory with relationship, compliance, and source-linked evidence", () => {
    const fixture = buildNorthlinePresentationFixture();
    const list = buildVendorPerformanceListModel(fixture, session());
    expect(list.portfolioMetrics.every((metric) => metric.sourceLink.href.startsWith("/app/"))).toBe(true);
    expect(list.portfolioMetrics.find((metric) => metric.id === "attention")?.sourceLink.href).toBe("/app/vendors?view=attention");
    expect(list.portfolioMetrics.find((metric) => metric.id === "visits")?.sourceLink.href).toBe("/app/visits");
    const markup = renderToStaticMarkup(createElement(VendorPerformanceList, { model: list }));
    expect(markup).toContain("Vendor network");
    expect(markup).toContain("How vendor measures work");
    expect(markup).toContain("Ready to use");
    expect(markup).toContain("Documents current");
    expect(markup).toContain("Recorded work cost only");
    expect(markup).toContain("5 of 5 approved vendors");
    expect(markup).toContain("Review these vendors");
    expect(markup).toContain("Open visit evidence");
  });

  it("derives onboarding controls and relationship filters from vendor source records", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildVendorPerformanceListModel(fixture, session());
    const summit = model.vendors.find((vendor) => vendor.id === "vendor-northline-summit")!;
    const brightPath = model.vendors.find((vendor) => vendor.id === "vendor-northline-brightpath")!;
    const fourSeasons = model.vendors.find((vendor) => vendor.id === "vendor-northline-four-seasons")!;

    expect(summit.compliance).toMatchObject({ state: "ready", approvedDocumentCount: 3, documentCount: 3, activeQualificationCount: 1 });
    expect(brightPath.compliance).toMatchObject({ state: "due_soon", label: "Renewal due soon" });
    expect(fourSeasons.relationshipState).toBe("stable");

    const stable = buildVendorPerformanceListModel(fixture, session(), { view: "stable" });
    expect(stable.vendors.map((vendor) => vendor.id)).toEqual(["vendor-northline-four-seasons"]);
    const plumbing = buildVendorPerformanceListModel(fixture, session(), { specialty: "plumbing" });
    expect(plumbing.vendors.map((vendor) => vendor.id)).toEqual(["vendor-northline-cedar"]);

    const detail = buildVendorPerformanceDetailModel(fixture, session(), summit.id);
    expect(detail.complianceRows).toHaveLength(3);
    expect(detail.qualificationRows).toHaveLength(1);
    expect(detail.complianceRows.every((row) => row.statusLabel === "Approved")).toBe(true);
  });

  it("renders vendor reminder due times in the organization timezone", () => {
    const fixture = buildNorthlinePresentationFixture();
    const detail = buildVendorPerformanceDetailModel(fixture, session(), "vendor-northline-summit");
    expect(detail.timeZone).toBe("America/New_York");
    expect(detail.vendorReminderRows.find((row) => row.id === "vendor-reminder-summit-fall-capacity")).toMatchObject({
      dueInputValue: "2026-08-28T11:00",
      dueLabel: "Aug 28, 11:00 AM EDT",
    });
  });

  it("searches vendor specialties through organization-approved plain-language aliases", () => {
    const fixture = buildNorthlinePresentationFixture();
    const plumbing = buildVendorPerformanceListModel(fixture, session(), { q: "plumber" });
    expect(plumbing.vendors.map((vendor) => vendor.name)).toContain("ClearFlow HVAC, Plumbing & Kitchen Repair");
  });

  it("records audited vendor renewals and routing qualifications without losing prior evidence", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    let sequence = 0;
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => "2026-08-25T16:00:00.000Z" },
      ids: { next: (prefix) => `${prefix}-vendor-control-${++sequence}` },
    };
    const actor = {
      actorType: "user" as const,
      actorId: "membership-northline-facilities",
      actorName: "Jordan Lee",
      organizationId: session().organizationId,
    };
    const vendorId = "vendor-northline-brightpath";

    await recordVendorComplianceDocument(services, {
      organizationId: session().organizationId,
      vendorId,
      documentType: "insurance",
      issuer: "Fictional Mutual",
      reference: "GL-2026-RENEWED",
      effectiveAt: "2026-09-01T00:00:00.000Z",
      expiresAt: "2027-09-01T00:00:00.000Z",
      reviewStatus: "approved",
      blocking: true,
      actor,
    });
    await recordVendorQualification(services, {
      organizationId: session().organizationId,
      vendorId,
      tradeKey: "electrical",
      serviceType: "Emergency electrical service",
      emergencyResponse: true,
      afterHours: true,
      maximumJobAmountMinor: 750_000,
      requiredLicense: "State electrical contractor license",
      actor,
    });

    const snapshot = repository.snapshot();
    const detail = buildVendorPerformanceDetailModel(snapshot, session(), vendorId);
    expect(detail.summary?.compliance).toMatchObject({ state: "ready", approvedDocumentCount: 3, documentCount: 3, activeQualificationCount: 2 });
    expect(detail.complianceRows).toHaveLength(5);
    expect(detail.complianceRows.filter((row) => row.documentTypeLabel === "Insurance").map((row) => row.statusLabel)).toEqual(["Approved", "Prior record retained", "Prior record retained"]);
    expect(detail.qualificationRows.some((row) => row.serviceRightsLabel.includes("Emergency") && row.limitLabel === "$7,500")).toBe(true);
    expect(snapshot.auditEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ aggregateId: vendorId, eventType: "vendor.compliance_document_recorded" }),
      expect.objectContaining({ aggregateId: vendorId, eventType: "vendor.qualification_recorded" }),
    ]));
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
