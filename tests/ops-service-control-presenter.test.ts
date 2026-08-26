import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorRole, OperatorSession, TableRowViewModel } from "@/components/ops/data-contract";
import { allowedWorkOrderControlTransitions } from "@/lib/ops/commands";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { ApprovalRequest, OpsFixture } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));

let buildAttentionItemModel: typeof import("@/app/app/_data/operator-presenter").buildAttentionItemModel;
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;
let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;
let buildRequestReviewModel: typeof import("@/app/app/_data/operator-presenter").buildRequestReviewModel;
let buildVendorIssuanceModel: typeof import("@/app/app/_data/operator-presenter").buildVendorIssuanceModel;
let buildWorkOrderControlModel: typeof import("@/app/app/_data/operator-presenter").buildWorkOrderControlModel;

beforeAll(async () => {
  ({
    buildAttentionItemModel,
    buildDetailModel,
    buildListModel,
    buildRequestReviewModel,
    buildVendorIssuanceModel,
    buildWorkOrderControlModel,
  } = await import("@/app/app/_data/operator-presenter"));
});

function operatorSession(role: OperatorRole): OperatorSession {
  return {
    userId: `user-contract-${role}`,
    membershipId: `membership-contract-${role}`,
    displayName: `${role} contract user`,
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: role === "store_manager" ? "Store 104" : role === "regional" ? "North region" : "Northline companywide - 15 stores",
    regionIds: role === "regional" ? ["region-northline-north"] : undefined,
    storeIds: role === "store_manager" ? [NORTHLINE_DEMO_HANDLES.storyStoreId] : undefined,
  };
}

function cell(row: TableRowViewModel, key: string) {
  return row.cells.find((candidate) => candidate.key === key)?.value;
}

function queryValue(href: string, key: string) {
  return new URL(href, "https://operations.test").searchParams.get(key);
}

function attachPendingWorkApproval(fixture: OpsFixture) {
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === "wo-northline-105-price-check")!;
  const policy = fixture.approvalPolicies.find((candidate) => candidate.policyKey === "major-repair")!;
  workOrder.status = "awaiting_approval";
  const request: ApprovalRequest = {
    id: "approval-request-presenter-pending",
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
  fixture.approvalRequests.push(request);
  return { workOrder, request };
}

describe("enterprise service-control presenter contracts", () => {
  it("offers request review only in reviewable states and separates review from work-order creation authority", () => {
    const fixture = buildNorthlinePresentationFixture();
    const request = fixture.requests.find((candidate) => candidate.id === "request-northline-104-new")!;
    request.status = "submitted";
    request.convertedWorkOrderId = undefined;

    const facilities = buildRequestReviewModel(fixture, operatorSession("facilities"), request.id);
    const regional = buildRequestReviewModel(fixture, operatorSession("regional"), request.id);
    const storeManager = buildRequestReviewModel(fixture, operatorSession("store_manager"), request.id);
    const executive = buildRequestReviewModel(fixture, operatorSession("executive"), request.id);

    expect(facilities).toMatchObject({
      available: true,
      permitted: true,
      expectedStatus: "submitted",
      canPrepareWorkOrder: true,
      canCreateWorkOrder: false,
      submitAction: `/api/ops/requests/${request.id}/review`,
      impactSubmitAction: `/api/ops/requests/${request.id}/impact`,
    });
    expect(facilities.createWorkOrderHref).toBe(`/app/work-orders/new?request=${request.id}`);
    expect(regional).toMatchObject({ available: true, permitted: true, canPrepareWorkOrder: true, canCreateWorkOrder: false });
    expect(storeManager).toMatchObject({ available: true, permitted: true, canPrepareWorkOrder: false, canCreateWorkOrder: false });
    expect(storeManager.createWorkOrderHref).toBeUndefined();
    expect(executive).toMatchObject({ available: true, permitted: false, canPrepareWorkOrder: false, canCreateWorkOrder: false });

    request.status = "under_review";
    const initialImpact = fixture.requestImpactAssessments.find((assessment) => assessment.requestId === request.id)!;
    fixture.requestImpactAssessments.push({
      ...initialImpact,
      id: `${initialImpact.id}-test-review`,
      assessmentKind: "review",
      reviewDisposition: "confirmed",
      source: "manager_review",
      assessedByActorId: "membership-northline-facilities",
      assessedByActorName: "Jordan Lee",
      assessedAt: new Date(Date.parse(initialImpact.assessedAt) + 60_000).toISOString(),
    });
    expect(buildRequestReviewModel(fixture, operatorSession("facilities"), request.id)).toMatchObject({
      available: true,
      permitted: true,
      expectedStatus: "under_review",
      canPrepareWorkOrder: true,
      canCreateWorkOrder: true,
    });

    request.status = "converted";
    request.convertedWorkOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    expect(buildRequestReviewModel(fixture, operatorSession("facilities"), request.id)).toMatchObject({
      available: false,
      permitted: false,
      canCreateWorkOrder: false,
    });

    request.status = "closed";
    request.convertedWorkOrderId = undefined;
    expect(buildRequestReviewModel(fixture, operatorSession("facilities"), request.id)).toMatchObject({
      available: false,
      permitted: false,
      canCreateWorkOrder: false,
    });
  });

  it("presents the full service lifecycle and only server-allowed work-order transitions", () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find((candidate) => candidate.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)!;
    const facilities = buildWorkOrderControlModel(fixture, operatorSession("facilities"), work.id);

    expect(facilities.available).toBe(true);
    expect(facilities.permitted).toBe(true);
    expect(facilities.submitAction).toBe(`/api/ops/work-orders/${work.id}/control`);
    expect(facilities.manualResponseAction).toBe(facilities.submitAction);
    expect(facilities.stages.map((stage) => stage.id)).toEqual([
      "intake",
      "authorization",
      "assignment",
      "issuance",
      "response",
      "visit",
      "outcome",
      "closeout",
    ]);
    expect(facilities.statusOptions.map((option) => option.value)).toEqual([
      work.status,
      ...allowedWorkOrderControlTransitions(work.status),
    ]);
    expect(facilities.statusOptions[0]?.description).toBe("Current state");
    expect(facilities.statusOptions.slice(1).every((option) => option.description === "Administrative closeout")).toBe(true);

    expect(buildWorkOrderControlModel(fixture, operatorSession("regional"), work.id).permitted).toBe(true);
    expect(buildWorkOrderControlModel(fixture, operatorSession("store_manager"), work.id).permitted).toBe(false);
    expect(buildWorkOrderControlModel(fixture, operatorSession("executive"), work.id).permitted).toBe(false);
    expect(buildWorkOrderControlModel(fixture, operatorSession("finance"), work.id).permitted).toBe(false);

    const closedWork = fixture.workOrders.find((candidate) => candidate.status === "closed")!;
    const closed = buildWorkOrderControlModel(fixture, operatorSession("facilities"), closedWork.id);
    expect(closed.isTerminal).toBe(true);
    expect(closed.statusOptions.map((option) => option.value)).toEqual(["closed"]);
    expect(closed.canRecordManualVendorResponse).toBe(false);

    const resolved = buildWorkOrderControlModel(fixture, operatorSession("facilities"), "wo-recent-aug-111-plumbing");
    expect(resolved.closeout).toMatchObject({
      ready: true,
      openFollowUpCount: 0,
    });
    expect(resolved.closeout?.outcomeLabel).toMatch(/Verified by/i);
    expect(resolved.closeout?.visitEvidenceLabel).toMatch(/visit/i);
    expect(resolved.closeout?.costEvidenceLabel).toMatch(/recorded work cost/i);
  });

  it("presents the current pending approval and grants its decision only to the exact active membership role", () => {
    const fixture = buildNorthlinePresentationFixture();
    const { workOrder, request } = attachPendingWorkApproval(fixture);
    const facilitiesSession = {
      ...operatorSession("facilities"),
      membershipId: "membership-northline-facilities",
    };

    const model = buildWorkOrderControlModel(fixture, facilitiesSession, workOrder.id);

    expect(model.pendingApproval).toMatchObject({
      requestId: request.id,
      decisionAction: `/api/ops/approvals/${request.id}/decision`,
      policyName: "Major repair authorization",
      policyVersion: 1,
      amountLabel: "$6,250.00",
      requiredRoleLabel: "Maintenance administrator",
      dueLabel: "Aug 21, 1:00 PM",
      escalationRoleLabel: "Owner / leadership",
      canDecide: true,
    });
    expect(model.pendingApproval?.decisionOptions).toEqual([
      expect.objectContaining({ value: "approved", reasonRequired: false }),
      expect.objectContaining({ value: "rejected", reasonRequired: true }),
      expect.objectContaining({ value: "escalated", reasonRequired: true }),
    ]);
    expect(model.statusOptions.map((option) => option.value)).toEqual(["awaiting_approval"]);

    request.requestedByMembershipId = "membership-northline-facilities";
    expect(buildWorkOrderControlModel(fixture, facilitiesSession, workOrder.id).pendingApproval).toMatchObject({
      canDecide: false,
      decisionAccessMessage: "You requested this authorization. A different active Maintenance administrator must record the decision.",
    });
    request.requestedByMembershipId = "membership-northline-regional-1";

    const executive = buildWorkOrderControlModel(fixture, {
      ...operatorSession("executive"),
      membershipId: "membership-northline-executive",
    }, workOrder.id);
    expect(executive.pendingApproval).toMatchObject({
      requestId: request.id,
      canDecide: false,
      decisionAccessMessage: "An active Maintenance administrator membership must record this decision.",
    });

    fixture.approvalDecisions.push({
      id: "approval-decision-presenter-approved",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      approvalRequestId: request.id,
      decision: "approved",
      decidedByMembershipId: "membership-northline-facilities",
      decidedByName: "Jordan Lee",
      decidedByRole: "facilities_admin",
      decidedAt: "2026-08-20T14:00:00.000Z",
    });
    expect(buildWorkOrderControlModel(fixture, facilitiesSession, workOrder.id).pendingApproval).toBeUndefined();
  });

  it("uses honest handoff language and exposes attributable vendor-response state without claiming dispatch", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const issuance = buildVendorIssuanceModel(fixture, operatorSession("facilities"), workId);
    const pending = buildWorkOrderControlModel(fixture, operatorSession("facilities"), workId);

    expect(issuance.channels.map((channel) => channel.label)).toEqual([
      "Generate email-ready link",
      "Generate SMS-ready link",
      "Print / PDF handoff",
      "Record phone or manual handoff",
    ]);
    expect(issuance.channels.every((channel) => !/^Send\b/i.test(channel.label))).toBe(true);
    expect(issuance.helperText).toMatch(/automated email and SMS delivery are not connected/i);
    expect(pending.latestIssuance).toMatchObject({
      deliveryStateLabel: "Link generated",
    });
    expect(pending.latestIssuance?.deliveryStateDetail).toMatch(/not connected.*copy or share/i);
    expect(pending.canRecordManualVendorResponse).toBe(true);
    expect(pending.manualVendorResponseTarget).toEqual({
      expectedAssignmentId: "assignment-northline-104-issued",
      expectedIssuanceId: "issuance-northline-104-issued-r1",
      expectedIssuanceRevision: 1,
    });
    expect(pending.vendorResponseOptions.map((option) => option.value)).toEqual([
      "accepted",
      "declined",
      "proposed_date",
      "question",
    ]);

    const responded = buildWorkOrderControlModel(fixture, operatorSession("facilities"), "wo-recent-aug-102-hvac");
    expect(responded.latestIssuance?.deliveryStateLabel).toBe("Opened by vendor");
    expect(responded.latestVendorResponse?.response).toBe("accepted");
    expect(responded.canRecordManualVendorResponse).toBe(false);
    expect(responded.manualVendorResponseTarget).toBeUndefined();

    fixture.vendorResponses.push({
      id: "response-contract-proposed-date",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workId,
      assignmentId: "assignment-northline-104-issued",
      issuanceId: "issuance-northline-104-issued-r1",
      response: "proposed_date",
      responderName: "Summit Refrigeration dispatch",
      proposedAt: "2026-08-15T14:00:00.000Z",
      message: "The first available technician can arrive Friday afternoon.",
      respondedAt: "2026-08-11T13:00:00.000Z",
    });
    const proposed = buildWorkOrderControlModel(fixture, operatorSession("facilities"), workId);
    expect(proposed.latestVendorResponse).toMatchObject({
      response: "proposed_date",
      responderName: "Summit Refrigeration dispatch",
    });
    expect(proposed.stages.find((stage) => stage.id === "response")?.state).toBe("blocked");
    expect(proposed.canRecordManualVendorResponse).toBe(true);
  });

  it("links every visit row to a real visit detail, including unmatched visits", () => {
    const fixture = buildNorthlinePresentationFixture();
    const visitRows = Array.from({ length: Math.ceil(fixture.visits.length / 25) }, (_, index) =>
      buildListModel(fixture, operatorSession("facilities"), "visits", { page: String(index + 1) }).table.rows,
    ).flat();

    expect(visitRows).toHaveLength(fixture.visits.length);
    expect(new Set(visitRows.map((row) => row.id)).size).toBe(fixture.visits.length);
    expect(visitRows.every((row) => row.href === `/app/visits/${row.id}`)).toBe(true);
    expect(visitRows.find((row) => row.id === NORTHLINE_DEMO_HANDLES.unmatchedVisitId)?.href).toBe(
      `/app/visits/${NORTHLINE_DEMO_HANDLES.unmatchedVisitId}`,
    );

    const detail = buildDetailModel(fixture, operatorSession("facilities"), "visit", NORTHLINE_DEMO_HANDLES.unmatchedVisitId);
    expect(detail.state.kind).toBe("ready");
    expect(detail.page.primaryAction?.href).toMatch(/^\/app\/action-center\/exception-northline-107-/);
    expect(detail.sections.map((section) => section.id)).toEqual(["evidence", "exceptions", "timeline"]);
    expect(detail.sections.find((section) => section.id === "exceptions")?.table?.rows.every(
      (row) => row.href === `/app/action-center/${row.id}`,
    )).toBe(true);
  });

  it("makes Needs attention a filterable source-record queue with exact item links", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = operatorSession("facilities");
    const all = buildListModel(fixture, session, "action-center");
    const exceptionIds = fixture.exceptions.filter((item) => item.status !== "resolved").map((item) => item.id);
    const followUpIds = fixture.followUps.filter((item) => item.status === "open").map((item) => item.id);
    const vendorReminderIds = fixture.vendorReminders.filter((item) => item.status === "open").map((item) => item.id);

    expect(all.table.rows.map((row) => row.id).sort()).toEqual([...exceptionIds, ...followUpIds, ...vendorReminderIds].sort());
    expect(all.table.rows.filter((row) => !vendorReminderIds.includes(row.id)).every((row) => row.href === `/app/action-center/${row.id}`)).toBe(true);
    expect(all.table.rows.filter((row) => vendorReminderIds.includes(row.id)).every((row) => row.href.includes("/app/vendors/") && row.href.endsWith("#vendor-reminders"))).toBe(true);
    expect(all.metrics?.find((metric) => metric.id === "attention-all")?.value).toBe(String(all.table.rows.length));
    expect(all.metrics?.find((metric) => metric.id === "attention-exceptions")?.value).toBe(String(exceptionIds.length));
    expect(all.metrics?.find((metric) => metric.id === "attention-followups")?.value).toBe(String(followUpIds.length));
    expect(all.metrics?.find((metric) => metric.id === "attention-vendor-reminders")?.value).toBe(String(vendorReminderIds.length));

    const exceptions = buildListModel(fixture, session, "action-center", { type: "exception" });
    const followUps = buildListModel(fixture, session, "action-center", { type: "follow-up" });
    const vendorReminders = buildListModel(fixture, session, "action-center", { type: "vendor-reminder" });
    const urgent = buildListModel(fixture, session, "action-center", { priority: "urgent" });
    expect(exceptions.table.rows.every((row) => exceptionIds.includes(row.id))).toBe(true);
    expect(exceptions.table.rows.some((row) => followUpIds.includes(row.id))).toBe(false);
    expect(followUps.table.rows.every((row) => followUpIds.includes(row.id))).toBe(true);
    expect(followUps.table.rows.some((row) => exceptionIds.includes(row.id))).toBe(false);
    expect(vendorReminders.table.rows.every((row) => vendorReminderIds.includes(row.id))).toBe(true);
    expect(urgent.table.rows.every((row) => ["Urgent", "Overdue"].includes(cell(row, "priority") ?? ""))).toBe(true);

    const combined = buildListModel(fixture, session, "action-center", { type: "exception", priority: "urgent" });
    const typeFilter = combined.filters?.find((filter) => filter.id === "attention-type");
    const priorityFilter = combined.filters?.find((filter) => filter.id === "attention-priority");
    expect(typeFilter).toBeDefined();
    expect(priorityFilter).toBeDefined();
    if (!typeFilter || !priorityFilter) throw new Error("Attention queue filters are required for this contract");
    const followUpOption = typeFilter.options.find((option) => option.value === "follow-up");
    const standardOption = priorityFilter.options.find((option) => option.value === "standard");
    expect(followUpOption).toBeDefined();
    expect(standardOption).toBeDefined();
    if (!followUpOption || !standardOption) throw new Error("Attention queue filter options are required for this contract");
    const followUpHref = followUpOption.href;
    const standardHref = standardOption.href;
    expect(queryValue(followUpHref, "type")).toBe("follow-up");
    expect(queryValue(followUpHref, "priority")).toBe("urgent");
    expect(queryValue(standardHref, "type")).toBe("exception");
    expect(queryValue(standardHref, "priority")).toBe("standard");
  });

  it("gives exception reconciliation and follow-up control exact evidence and accountable fields", () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.workOrders.push({
      id: "wo-contract-store-107-forecourt",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      number: "NL-2026-0999",
      storeId: "store-northline-107",
      problem: "Inspect dispenser 4 payment-terminal connection",
      priority: "urgent",
      status: "approved",
      accountableParty: "Forecourt Systems Group",
      nextAction: "Generate vendor authorization",
      dueAt: "2026-08-15T18:00:00.000Z",
      escalationTo: "Northline Facilities",
      createdAt: "2026-08-11T12:00:00.000Z",
    });
    fixture.assignments.push({
      id: "assignment-contract-store-107-forecourt",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: "wo-contract-store-107-forecourt",
      kind: "outside_vendor",
      vendorId: "vendor-northline-forecourt",
      status: "accepted",
      assignedAt: "2026-08-11T12:05:00.000Z",
    });

    const exception = buildAttentionItemModel(fixture, operatorSession("facilities"), "exception-northline-107-no-wo");
    expect(exception.control).toMatchObject({
      available: true,
      permitted: true,
      kind: "exception",
      submitAction: "/api/ops/action-items/exception-northline-107-no-wo",
    });
    expect(exception.control.reconciliationOptions).toEqual([
      expect.objectContaining({ value: "wo-contract-store-107-forecourt", label: "NL-2026-0999" }),
    ]);
    expect(exception.control.unmatchedVisit).toMatchObject({
      createWorkOrderHref: "/app/work-orders/new?sourceException=exception-northline-107-no-wo",
      providerLabel: "Forecourt Systems Group",
    });
    expect(exception.detail.page.primaryAction?.href).toBe(`/app/visits/${NORTHLINE_DEMO_HANDLES.unmatchedVisitId}`);
    expect(exception.detail.sections.map((section) => section.id)).toEqual(["source-evidence", "timeline"]);
    expect(buildAttentionItemModel(fixture, operatorSession("executive"), "exception-northline-107-no-wo").control.permitted).toBe(false);

    const followUpId = "follow-up-recent-aug-102-hvac";
    const sourceFollowUp = fixture.followUps.find((candidate) => candidate.id === followUpId)!;
    const followUp = buildAttentionItemModel(fixture, operatorSession("facilities"), followUpId);
    expect(followUp.control).toMatchObject({
      available: true,
      permitted: true,
      kind: "follow_up",
      submitAction: `/api/ops/action-items/${followUpId}`,
      accountableParty: sourceFollowUp.accountableParty,
      nextAction: sourceFollowUp.nextAction,
      escalationTo: sourceFollowUp.escalationTo,
    });
    expect(followUp.control.dueAt).toBe(sourceFollowUp.dueAt.slice(0, 16));
    expect(followUp.detail.page.primaryAction?.href).toBe(`/app/work-orders/${sourceFollowUp.workOrderId}`);
    expect(followUp.detail.page.secondaryAction?.href).toBe(`/app/visits/${sourceFollowUp.sourceVisitId}`);
    expect(followUp.detail.sections.map((section) => section.id)).toEqual(["required-action", "timeline"]);
    expect(buildAttentionItemModel(fixture, operatorSession("executive"), followUpId).control.permitted).toBe(false);
  });

  it("builds a vendor accountability workspace from responses, work, visits, coverage, and open actions", () => {
    const fixture = buildNorthlinePresentationFixture();
    const vendorId = "vendor-northline-forecourt";
    const detail = buildDetailModel(fixture, operatorSession("facilities"), "vendor", vendorId);

    expect(detail.state.kind).toBe("ready");
    expect(detail.facts.map((fact) => fact.label)).toEqual([
      "Dispatch",
      "Open work",
      "Onsite now",
      "Recorded visits",
      "Response time",
      "Accepted authorizations",
      "Open items",
      "Recorded work cost",
    ]);
    expect(detail.sections.map((section) => section.id)).toEqual([
      "accountability",
      "response-history",
      "coverage",
      "work",
      "visits",
    ]);

    const accountability = detail.sections.find((section) => section.id === "accountability")!;
    const responseHistory = detail.sections.find((section) => section.id === "response-history")!;
    const coverage = detail.sections.find((section) => section.id === "coverage")!;
    const work = detail.sections.find((section) => section.id === "work")!;
    const visits = detail.sections.find((section) => section.id === "visits")!;
    expect(accountability.table?.rows.length).toBeGreaterThan(0);
    expect(accountability.table?.rows.every((row) => row.href === `/app/action-center/${row.id}`)).toBe(true);
    expect(responseHistory.table?.rows.length).toBeGreaterThan(0);
    expect(responseHistory.table?.rows.every((row) => row.href.startsWith("/app/work-orders/"))).toBe(true);
    expect(coverage.facts?.length).toBeGreaterThan(1);
    expect(work.table?.rows.length).toBeGreaterThan(0);
    expect(work.table?.rows.every((row) => row.href === `/app/work-orders/${row.id}`)).toBe(true);
    expect(visits.table?.rows.length).toBeGreaterThan(0);
    expect(visits.table?.rows.every((row) => row.href === `/app/visits/${row.id}`)).toBe(true);
    expect(visits.description).toMatch(/facts, not a black-box score/i);
  });

  it("wires the presenter controls and source-detail routes into the operator pages", async () => {
    const [requestRoute, workOrderRoute, workOrderCase, visitRoute, attentionRoute, serviceControlPanels] = await Promise.all([
      readFile("app/app/requests/[id]/page.tsx", "utf8"),
      readFile("app/app/work-orders/[id]/page.tsx", "utf8"),
      readFile("components/workspace/work-order-case.tsx", "utf8"),
      readFile("app/app/visits/[id]/page.tsx", "utf8"),
      readFile("app/app/action-center/[id]/page.tsx", "utf8"),
      readFile("components/ops/service-control-panels.tsx", "utf8"),
    ]);

    expect(requestRoute).toContain("loadRequestReviewModel");
    expect(requestRoute).toContain("<RequestReviewPanel model={review}");
    expect(workOrderRoute).toContain("loadWorkOrderControlModel");
    expect(workOrderRoute).toContain("<WorkOrderCase");
    expect(workOrderRoute).toContain("control={control}");
    expect(workOrderRoute).toContain("issuance={issuance}");
    expect(workOrderRoute).toContain("estimateComparison={estimateComparison}");
    expect(workOrderRoute).toContain("recording={recording}");
    expect(workOrderCase).toContain("<WorkOrderControlPanel model={control}");
    expect(workOrderCase).toContain("<VendorIssuancePanel model={issuance}");
    expect(workOrderCase).toContain("<EstimateComparisonPanel model={estimateComparison}");
    expect(workOrderCase).toContain("<WorkOrderRecordingPanel model={recording}");
    expect(visitRoute).toContain('loadDetailModel("visit", id)');
    expect(attentionRoute).toContain("loadAttentionItemModel");
    expect(attentionRoute).toContain("<AttentionItemPanel model={model.control}");
    expect(serviceControlPanels).toContain('name="expectedAssignmentId"');
    expect(serviceControlPanels).toContain('name="expectedIssuanceId"');
    expect(serviceControlPanels).toContain('name="expectedIssuanceRevision"');
  });
});
