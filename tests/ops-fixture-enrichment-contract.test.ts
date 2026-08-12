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
) {
  return assignments.some((assignment) => {
    if (assignment.workOrderId !== visit.workOrderId) return false;
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
    expect(fixture.workOrders.length).toBeGreaterThanOrEqual(100);
    expect(fixture.workOrders.length).toBeLessThanOrEqual(120);
    expect(fixture.assets.length).toBeGreaterThanOrEqual(40);
    expect(fixture.assets.length).toBeLessThanOrEqual(60);

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
    expect(fixture.pmOccurrences.length).toBeGreaterThan(fixture.pmPlans.length);
    expect(new Set(fixture.pmOccurrences.map((occurrence) => occurrence.dueAt.slice(0, 7))).size).toBeGreaterThanOrEqual(4);

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
  });

  it("keeps each observed visit on the exact store and assigned provider", () => {
    const fixture = buildNorthlinePresentationFixture();
    for (const visit of fixture.visits) {
      const store = fixture.stores.find((candidate) => candidate.id === visit.storeId);
      expect(store, `${visit.id} references a missing store`).toBeTruthy();

      if (!visit.workOrderId) {
        expect(visit.unmatchedReason, `${visit.id} has no work order or review reason`).toBeTruthy();
        continue;
      }

      const workOrder = fixture.workOrders.find((candidate) => candidate.id === visit.workOrderId);
      expect(workOrder, `${visit.id} references a missing work order`).toBeTruthy();
      expect(workOrder?.storeId, `${visit.id} and its work order disagree on store`).toBe(visit.storeId);
      expect(
        assignmentMatchesVisit(fixture.assignments, visit),
        `${visit.id} does not match any assignment for its work order and provider`,
      ).toBe(true);
    }
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
