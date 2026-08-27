import { describe, expect, it } from "vitest";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  assertOpsFixture,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type {
  OpsFixture,
  PmOccurrence,
  WorkOrderAssignment,
} from "@/lib/ops/types";

function uniqueIds(rows: ReadonlyArray<{ id: string }>) {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

function amountByWorkOrder(fixture: OpsFixture) {
  const amounts = new Map<string, number>();
  for (const line of fixture.costLines) {
    amounts.set(line.workOrderId, (amounts.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
  }
  return amounts;
}

function storeRecordedCost(fixture: OpsFixture, storeId: string) {
  const amounts = amountByWorkOrder(fixture);
  return fixture.workOrders
    .filter((workOrder) => workOrder.storeId === storeId)
    .reduce((sum, workOrder) => sum + (amounts.get(workOrder.id) ?? 0), 0);
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[midpoint]
    : Math.round((ordered[midpoint - 1] + ordered[midpoint]) / 2);
}

function assignmentMatchesVisit(
  assignments: WorkOrderAssignment[],
  visit: OpsFixture["visits"][number],
  workOrderId = visit.workOrderId,
) {
  return assignments.some((assignment) => {
    if (assignment.workOrderId !== workOrderId) return false;
    if (
      visit.status === "active" &&
      ["completed", "cancelled", "declined", "superseded"].includes(assignment.status)
    ) return false;
    if (visit.providerKind === "outside_vendor") {
      return assignment.kind === "outside_vendor" && assignment.vendorId === visit.vendorId;
    }
    return assignment.kind === "internal" && assignment.internalMembershipId === visit.internalMembershipId;
  });
}

function assertPmStateIsTemporallyCoherent(occurrence: PmOccurrence, asOf: string) {
  const now = Date.parse(asOf);
  const starts = Date.parse(occurrence.windowStartsAt);
  const due = Date.parse(occurrence.dueAt);
  const ends = Date.parse(occurrence.windowEndsAt);

  expect(Number.isFinite(starts), `${occurrence.id} has an invalid window start`).toBe(true);
  expect(Number.isFinite(due), `${occurrence.id} has an invalid due time`).toBe(true);
  expect(Number.isFinite(ends), `${occurrence.id} has an invalid window end`).toBe(true);
  expect(starts, `${occurrence.id} starts after its due time`).toBeLessThanOrEqual(due);
  expect(due, `${occurrence.id} is due after its completion window`).toBeLessThanOrEqual(ends);

  if (occurrence.status === "scheduled") {
    expect(now, `${occurrence.id} is scheduled after its window opened`).toBeLessThan(starts);
  } else if (occurrence.status === "due") {
    expect(now, `${occurrence.id} is due before its window opened`).toBeGreaterThanOrEqual(starts);
    expect(now, `${occurrence.id} is still due after its window closed`).toBeLessThanOrEqual(ends);
  } else if (occurrence.status === "missed") {
    expect(now, `${occurrence.id} is missed before its window closed`).toBeGreaterThan(ends);
  } else if (occurrence.status === "completed") {
    expect(occurrence.completedAt, `${occurrence.id} is completed without a completion time`).toBeTruthy();
    const completed = Date.parse(occurrence.completedAt!);
    expect(completed, `${occurrence.id} completed before its window`).toBeGreaterThanOrEqual(starts);
    expect(completed, `${occurrence.id} completed after its window`).toBeLessThanOrEqual(ends);
    expect(completed, `${occurrence.id} completed after the fixture as-of time`).toBeLessThanOrEqual(now);
  }
}

describe("Northline enriched presentation fixture contract", () => {
  it("keeps the presentation tenant compact while making every store materially explorable", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(() => assertOpsFixture(fixture)).not.toThrow();
    expect(fixture.organizations).toHaveLength(1);
    expect(fixture.organizations[0].id).toBe(NORTHLINE_ORGANIZATION_ID);
    expect(fixture.regions).toHaveLength(3);
    expect(fixture.stores).toHaveLength(15);
    expect(fixture.vendors).toHaveLength(5);
    expect(fixture.workOrders.length).toBeGreaterThanOrEqual(350);
    expect(fixture.workOrders.length).toBeLessThanOrEqual(425);
    expect(fixture.assets.length).toBeGreaterThanOrEqual(120);
    expect(fixture.assets.length).toBeLessThanOrEqual(160);
    expect(fixture.memberships.filter((membership) => membership.role === "internal_technician")).toHaveLength(2);
    expect(fixture.vendors.every((vendor) => vendor.status === "approved")).toBe(true);

    const workMonths = new Set(fixture.workOrders.map((workOrder) => workOrder.createdAt.slice(0, 7)));
    expect(workMonths.size).toBeGreaterThanOrEqual(18);

    for (const store of fixture.stores) {
      expect(
        fixture.workOrders.filter((workOrder) => workOrder.storeId === store.id).length,
        `Store ${store.storeNumber} needs enough work history to support its dashboard`,
      ).toBeGreaterThanOrEqual(4);
    }

    const categoryKeys = [...new Set(fixture.workOrders.map((workOrder) => workOrder.categoryKey))];
    expect(categoryKeys).toEqual(expect.arrayContaining([
      "refrigeration",
      "hvac",
      "forecourt",
      "plumbing",
      "electrical",
      "exterior",
      "foodservice",
    ]));

    const assignmentKinds = new Set(fixture.assignments.map((assignment) => assignment.kind));
    expect(assignmentKinds).toEqual(new Set(["internal", "outside_vendor", "choose_later"]));
    for (const vendor of fixture.vendors) {
      expect(
        fixture.assignments.filter((assignment) => assignment.vendorId === vendor.id).length,
        `${vendor.name} needs assigned work for vendor-distribution visibility`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("builds a location-named equipment register from reusable component trees", () => {
    const fixture = buildNorthlinePresentationFixture();
    const assetById = new Map(fixture.assets.map((asset) => [asset.id, asset]));

    const assetCategories = new Set(fixture.assets.map((asset) => asset.categoryKey));
    for (const category of ["refrigeration", "hvac", "forecourt", "foodservice"]) {
      expect(assetCategories.has(category), `Equipment register is missing ${category}`).toBe(true);
    }
    expect(fixture.components.length).toBeGreaterThan(fixture.assets.length * 5);

    for (const store of fixture.stores) {
      const storeAssets = fixture.assets.filter((asset) => asset.storeId === store.id);
      expect(storeAssets.length, `${store.storeNumber} needs a useful equipment register`).toBeGreaterThanOrEqual(8);
      expect(storeAssets.length, `${store.storeNumber} should remain presentation-sized`).toBeLessThanOrEqual(10);
      expect(storeAssets.filter((asset) => asset.categoryKey === "refrigeration")).toHaveLength(3);
      expect(storeAssets.filter((asset) => asset.categoryKey === "forecourt")).toHaveLength(4);
      expect(storeAssets.some((asset) => asset.name.includes(" - ")), `${store.storeNumber} needs human-readable location names`).toBe(true);

      for (const asset of storeAssets) {
        expect(
          fixture.components.filter((component) => component.assetId === asset.id).length,
          `${asset.assetTag} needs its template-derived component tree`,
        ).toBeGreaterThanOrEqual(5);
      }
    }

    for (const component of fixture.components.filter((candidate) => candidate.parentComponentId)) {
      const parent = fixture.components.find((candidate) => candidate.id === component.parentComponentId);
      expect(parent, `${component.id} has a missing parent`).toBeTruthy();
      expect(parent?.assetId, `${component.id} crosses into another asset tree`).toBe(component.assetId);
      expect(assetById.has(component.assetId)).toBe(true);
    }

    expect(fixture.components.find((component) => component.id === "component-104-compressor")).toMatchObject({
      assetId: NORTHLINE_DEMO_HANDLES.storyAssetId,
      name: "Compressor",
      partNumber: "ZB38KCE-TFD",
    });
  });

  it("keeps replacement-planning coverage explicit and manager-reviewable", () => {
    const fixture = buildNorthlinePresentationFixture();
    const activeAssets = fixture.assets.filter((asset) => asset.status !== "retired");
    const assigned = activeAssets.filter((asset) => asset.replacementProfileId);
    const excluded = activeAssets.filter((asset) => asset.replacementPlanningExcludedAt);
    const needsChoice = activeAssets.filter(
      (asset) => !asset.replacementProfileId && !asset.replacementPlanningExcludedAt,
    );

    expect(activeAssets).toHaveLength(138);
    expect(assigned).toHaveLength(135);
    expect(excluded).toEqual([
      expect.objectContaining({
        id: "asset-101-rapid-cook-oven",
        replacementPlanningExclusionReason: "Landlord-owned foodservice equipment is outside Northline's capital plan.",
      }),
    ]);
    expect(needsChoice.map((asset) => asset.id).sort()).toEqual([
      "asset-113-walk-in-freezer",
      "asset-114-ice-machine",
    ]);
    expect(fixture.assets.find((asset) => asset.id === "asset-113-walk-in-freezer")?.status).toBe("out_of_service");
    expect(fixture.replacementProfiles).toHaveLength(7);
    expect(fixture.replacementBenchmarks).toHaveLength(7);
  });

  it("keeps unconverted employee reports visible and current work operationally varied", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(new Set(fixture.requests.map((request) => request.status))).toEqual(
      new Set(["submitted", "under_review", "converted", "closed"]),
    );

    for (const request of fixture.requests) {
      const linkedWork = fixture.workOrders.filter((workOrder) => workOrder.requestId === request.id);
      if (request.status === "converted") {
        expect(request.convertedWorkOrderId, `${request.reference} is converted without a target`).toBeTruthy();
        expect(linkedWork).toHaveLength(1);
        expect(linkedWork[0].id).toBe(request.convertedWorkOrderId);
      } else {
        expect(request.convertedWorkOrderId, `${request.reference} should still be independent of work`).toBeUndefined();
        expect(linkedWork).toHaveLength(0);
      }
    }

    const openStatuses = new Set(
      fixture.workOrders
        .filter((workOrder) => !["closed", "cancelled"].includes(workOrder.status))
        .map((workOrder) => workOrder.status),
    );
    for (const status of ["approved", "awaiting_approval", "issued", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review"] as const) {
      expect(openStatuses.has(status), `Current work is missing the ${status} state`).toBe(true);
    }
    for (const workOrder of fixture.workOrders.filter((candidate) => !["closed", "cancelled"].includes(candidate.status))) {
      expect(workOrder.accountableParty.trim()).not.toBe("");
      expect(workOrder.nextAction.trim()).not.toBe("");
      expect(workOrder.dueAt).toBeTruthy();
      expect(workOrder.escalationTo).toBeTruthy();
    }
  });

  it("represents every low-friction vendor response without inventing a visit", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(new Set(fixture.vendorResponses.map((response) => response.response))).toEqual(
      new Set(["accepted", "declined", "proposed_date", "question"]),
    );

    for (const response of fixture.vendorResponses) {
      const issuance = fixture.issuances.find((candidate) => candidate.id === response.issuanceId);
      expect(issuance).toMatchObject({ workOrderId: response.workOrderId, assignmentId: response.assignmentId });
      expect(Date.parse(response.respondedAt)).toBeGreaterThanOrEqual(Date.parse(issuance!.issuedAt));
      expect(fixture.auditEvents).toContainEqual(expect.objectContaining({
        aggregateType: "vendor_response",
        aggregateId: response.id,
        eventType: "vendor.response_recorded",
      }));
      if (response.response === "proposed_date") expect(response.proposedAt).toBeTruthy();
      if (response.response === "question") expect(response.message?.trim()).toBeTruthy();
      if (response.response === "declined") {
        expect(fixture.assignments.find((assignment) => assignment.id === response.assignmentId)?.status).toBe("declined");
        expect(fixture.visits.some((visit) => visit.workOrderId === response.workOrderId && visit.vendorId === fixture.assignments.find((assignment) => assignment.id === response.assignmentId)?.vendorId)).toBe(false);
      }
    }
  });

  it("makes Store 104 a source-backed refrigeration outlier instead of a manual flag", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storyStore = fixture.stores.find((store) => store.id === NORTHLINE_DEMO_HANDLES.storyStoreId);
    const storyAsset = fixture.assets.find((asset) => asset.id === NORTHLINE_DEMO_HANDLES.storyAssetId);
    expect(storyStore).toBeTruthy();
    expect(storyAsset).toMatchObject({ storeId: storyStore!.id, categoryKey: "refrigeration" });

    const companyStoreCosts = fixture.stores.map((store) => storeRecordedCost(fixture, store.id));
    const companyMedian = median(companyStoreCosts);
    const storyStoreCost = storeRecordedCost(fixture, storyStore!.id);
    expect(companyMedian).toBeGreaterThan(0);
    expect(storyStoreCost).toBeGreaterThan(companyMedian * 2);

    const storyWork = fixture.workOrders.filter(
      (workOrder) => workOrder.storeId === storyStore!.id && workOrder.assetId === storyAsset!.id,
    );
    const workByComponent = Map.groupBy(
      storyWork.filter((workOrder) => workOrder.componentId),
      (workOrder) => workOrder.componentId!,
    );
    const repeatedComponent = [...workByComponent.entries()].find(([, workOrders]) => workOrders.length >= 2);
    expect(repeatedComponent, "Store 104 needs at least two work orders on the same named component").toBeTruthy();
    expect(
      fixture.components.some(
        (component) => component.id === repeatedComponent?.[0] && component.assetId === storyAsset!.id,
      ),
    ).toBe(true);

    const storyWorkIds = new Set(storyWork.map((workOrder) => workOrder.id));
    expect(fixture.visits.filter((visit) => visit.workOrderId && storyWorkIds.has(visit.workOrderId)).length).toBeGreaterThanOrEqual(3);
    expect(fixture.costLines.filter((line) => storyWorkIds.has(line.workOrderId)).length).toBeGreaterThanOrEqual(4);
  });

  it("uses multiple coherent PM periods and connects PM to canonical work", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(fixture.maintenancePrograms).toHaveLength(5);
    expect(fixture.maintenancePrograms.map((program) => program.name)).toEqual(expect.arrayContaining([
      "Quarterly refrigeration preventive service",
      "Spring HVAC cooling readiness",
      "Fall HVAC heating readiness",
      "Foodservice equipment deep clean",
      "Monthly pest-control monitoring",
    ]));
    expect(fixture.pmOccurrences.length).toBeGreaterThan(fixture.pmPlans.length);
    expect(new Set(fixture.pmOccurrences.map((occurrence) => occurrence.dueAt.slice(0, 7))).size).toBeGreaterThanOrEqual(5);
    expect(new Set(fixture.pmOccurrences.map((occurrence) => occurrence.status))).toEqual(
      new Set(["completed", "proposed", "scheduled", "due", "missed", "waived"]),
    );

    for (const occurrence of fixture.pmOccurrences) {
      assertPmStateIsTemporallyCoherent(occurrence, fixture.asOf);
    }

    const linked = fixture.pmOccurrences.filter((occurrence) => occurrence.workOrderId);
    expect(linked.length).toBeGreaterThanOrEqual(6);
    for (const occurrence of linked) {
      const workOrder = fixture.workOrders.find((candidate) => candidate.id === occurrence.workOrderId);
      expect(workOrder, `${occurrence.id} links to a missing work order`).toBeTruthy();
      expect(workOrder?.storeId).toBe(occurrence.storeId);
      if (occurrence.assetId) expect(workOrder?.assetId).toBe(occurrence.assetId);
    }
    expect(fixture.pmOccurrences.filter((occurrence) => occurrence.status === "scheduled")).toHaveLength(fixture.pmPlans.length);
    expect(fixture.pmOccurrences.find((occurrence) => occurrence.status === "waived")).toMatchObject({
      storeId: "store-northline-115",
      assetId: "asset-115-beer-cave",
    });
    const reconciliation = fixture.serviceDiscrepancies.find((item) => item.id === "service-discrepancy-pm-107-observed-visits");
    expect(reconciliation).toBeTruthy();
    expect(JSON.parse(reconciliation!.factsJson)).toMatchObject({
      reconciliationKind: "pm_billed_vs_observed",
      billedServiceUnits: 4,
      observedVisitCount: 2,
      determination: "review_only",
    });
  });

  it("keeps each observed visit on the exact store and assigned provider", () => {
    const fixture = buildNorthlinePresentationFixture();
    for (const visit of fixture.visits) {
      const store = fixture.stores.find((candidate) => candidate.id === visit.storeId);
      expect(store, `${visit.id} references a missing store`).toBeTruthy();
      const visitWorkOrders = fixture.siteVisitWorkOrders
        .filter((candidate) => candidate.visitId === visit.id)
        .sort((left, right) => left.ordinal - right.ordinal);

      if (!visitWorkOrders.length) {
        expect(visit.unmatchedReason, `${visit.id} has no work order or review reason`).toBeTruthy();
        continue;
      }

      for (const visitWorkOrder of visitWorkOrders) {
        const workOrder = fixture.workOrders.find((candidate) => candidate.id === visitWorkOrder.workOrderId);
        expect(workOrder, `${visit.id} references a missing work order`).toBeTruthy();
        expect(workOrder?.storeId, `${visit.id} and its work order disagree on store`).toBe(visit.storeId);
        expect(
          assignmentMatchesVisit(fixture.assignments, visit, visitWorkOrder.workOrderId),
          `${visit.id} does not match any assignment for ${visitWorkOrder.workOrderId} and its provider`,
        ).toBe(true);
      }
    }
  });

  it("shows a believable recent visit history instead of three identical onsite rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const active = fixture.visits.filter((visit) => visit.status === "active");
    const completed = fixture.visits.filter((visit) => visit.status === "checked_out");
    const recentCompleted = completed.filter((visit) => visit.checkedOutAt?.startsWith("2026-08"));

    expect(active).toHaveLength(3);
    expect(completed.length).toBeGreaterThan(active.length * 20);
    expect(recentCompleted.length).toBeGreaterThanOrEqual(8);
    expect(new Set(recentCompleted.map((visit) => visit.vendorId).filter(Boolean))).toEqual(
      new Set(fixture.vendors.map((vendor) => vendor.id)),
    );
    expect(recentCompleted.some((visit) => visit.providerKind === "internal")).toBe(true);
    expect(recentCompleted.filter((visit) => visit.startedChannel !== visit.endedChannel).length).toBeGreaterThanOrEqual(6);
    const recentOutcomes = new Set(recentCompleted.map((visit) => visit.outcome));
    for (const outcome of ["resolved", "diagnosed_waiting_parts", "return_required", "unable_to_complete", "temporary_repair", "no_issue_found", "inspection_complete"] as const) {
      expect(recentOutcomes.has(outcome), `Recent visit history is missing ${outcome}`).toBe(true);
    }
    expect(fixture.visits.some((visit) => visit.outcome === "unable_to_reproduce")).toBe(true);

    const unresolvedOutcomes = new Set(["diagnosed_waiting_parts", "return_required", "unable_to_complete", "temporary_repair"]);
    for (const visit of recentCompleted.filter((candidate) => candidate.outcome && unresolvedOutcomes.has(candidate.outcome))) {
      const followUp = fixture.followUps.find((candidate) => candidate.sourceVisitId === visit.id);
      expect(followUp, `${visit.id} needs an accountable follow-up`).toMatchObject({
        workOrderId: visit.workOrderId,
        status: "open",
        escalationTo: "Northline Facilities",
      });
    }

    expect(fixture.visits.some((visit) => !visit.workOrderId && visit.unmatchedReason)).toBe(true);
    expect(fixture.exceptions.some((exception) => exception.kind === "missing_checkout" && exception.status === "open")).toBe(true);
    expect(fixture.exceptions.some((exception) => exception.kind === "low_accuracy_location")).toBe(true);
  });

  it("includes attributable evidence, notifications, and invoice review states", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(fixture.files.length).toBeGreaterThan(0);
    expect(fixture.entityFiles.length).toBeGreaterThan(0);
    expect(fixture.outboxMessages.length).toBeGreaterThan(0);
    expect(fixture.auditEvents.length).toBeGreaterThan(0);

    for (const link of fixture.entityFiles) {
      expect(fixture.files.some((file) => file.id === link.fileId), `${link.id} references a missing file`).toBe(true);
    }
    for (const message of fixture.outboxMessages) {
      expect(message.organizationId).toBe(NORTHLINE_ORGANIZATION_ID);
      expect(["pending", "processing", "delivered", "failed"]).toContain(message.status);
    }

    const statuses = new Set(fixture.invoiceReferences.map((invoice) => invoice.matchStatus));
    expect(statuses.has("confirmed")).toBe(true);
    expect(statuses.has("suggested")).toBe(true);
    expect(statuses.has("unmatched")).toBe(true);
    expect(statuses.has("rejected")).toBe(true);
    expect(fixture.invoiceReferences.filter((invoice) => invoice.matchStatus === "suggested").length).toBeGreaterThanOrEqual(2);
    expect(fixture.invoiceReferences.filter((invoice) => invoice.matchStatus === "unmatched").length).toBeGreaterThanOrEqual(2);
    expect(fixture.invoiceReferences.filter((invoice) => invoice.matchStatus === "rejected").length).toBeGreaterThanOrEqual(2);

    const allocationsByInvoice = Map.groupBy(
      fixture.invoiceAllocations,
      (allocation) => allocation.invoiceReferenceId,
    );
    for (const invoice of fixture.invoiceReferences.filter((candidate) => candidate.matchStatus === "confirmed")) {
      const allocations = allocationsByInvoice.get(invoice.id) ?? [];
      expect(allocations.length, `${invoice.invoiceNumber} is confirmed without an allocation`).toBeGreaterThan(0);
      expect(
        allocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0),
        `${invoice.invoiceNumber} allocations do not reconcile`,
      ).toBe(invoice.grossAmount.amountMinor);
      expect(allocations.every((allocation) => allocation.confirmedAt)).toBe(true);
    }
    expect(
      fixture.invoiceReferences.some(
        (invoice) => invoice.matchStatus === "unmatched" && !(allocationsByInvoice.get(invoice.id)?.length),
      ),
    ).toBe(true);
  });

  it("contains at least one complete accountability chain from request through invoice evidence", () => {
    const fixture = buildNorthlinePresentationFixture();
    const invoiceByWork = new Map<string, string[]>();
    for (const allocation of fixture.invoiceAllocations) {
      const current = invoiceByWork.get(allocation.workOrderId) ?? [];
      current.push(allocation.invoiceReferenceId);
      invoiceByWork.set(allocation.workOrderId, current);
    }

    const complete = fixture.workOrders.find((workOrder) => {
      const request = fixture.requests.find(
        (candidate) => candidate.id === workOrder.requestId && candidate.convertedWorkOrderId === workOrder.id,
      );
      const assignment = fixture.assignments.find((candidate) => candidate.workOrderId === workOrder.id);
      const issuance = assignment
        ? fixture.issuances.find(
            (candidate) => candidate.workOrderId === workOrder.id && candidate.assignmentId === assignment.id,
          )
        : undefined;
      const response = issuance
        ? fixture.vendorResponses.find(
            (candidate) => candidate.workOrderId === workOrder.id && candidate.issuanceId === issuance.id,
          )
        : undefined;
      const visit = fixture.visits.find((candidate) => candidate.workOrderId === workOrder.id);
      const cost = fixture.costLines.find((candidate) => candidate.workOrderId === workOrder.id);
      const invoiceIds = invoiceByWork.get(workOrder.id) ?? [];
      const confirmedInvoice = fixture.invoiceReferences.find(
        (candidate) => invoiceIds.includes(candidate.id) && candidate.matchStatus === "confirmed",
      );
      return Boolean(request && assignment?.kind === "outside_vendor" && issuance && response && visit && cost && confirmedInvoice);
    });

    expect(complete, "No source record proves the full request-to-invoice accountability story").toBeTruthy();
  });

  it("keeps identifiers unique and preserves every public demo handle", () => {
    const fixture = buildNorthlinePresentationFixture();
    const identifiedCollections = [
      fixture.stores,
      fixture.vendors,
      fixture.requests,
      fixture.workOrders,
      fixture.assignments,
      fixture.issuances,
      fixture.vendorResponses,
      fixture.visits,
      fixture.visitEvidence,
      fixture.assets,
      fixture.components,
      fixture.pmPlans,
      fixture.pmOccurrences,
      fixture.costLines,
      fixture.invoiceReferences,
      fixture.invoiceAllocations,
      fixture.files,
      fixture.entityFiles,
      fixture.auditEvents,
      fixture.outboxMessages,
      fixture.publicTokens,
    ];
    expect(identifiedCollections.every(uniqueIds)).toBe(true);

    expect(fixture.stores.some((store) => store.id === NORTHLINE_DEMO_HANDLES.storyStoreId)).toBe(true);
    expect(fixture.assets.some((asset) => asset.id === NORTHLINE_DEMO_HANDLES.storyAssetId)).toBe(true);
    expect(fixture.workOrders.some((workOrder) => workOrder.id === NORTHLINE_DEMO_HANDLES.storyWorkOrderId)).toBe(true);
    expect(fixture.workOrders.some((workOrder) => workOrder.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)).toBe(true);
    expect(fixture.visits.some((visit) => visit.id === NORTHLINE_DEMO_HANDLES.activeVisitId)).toBe(true);
    expect(fixture.visits.some((visit) => visit.id === NORTHLINE_DEMO_HANDLES.unmatchedVisitId)).toBe(true);
  });
});
