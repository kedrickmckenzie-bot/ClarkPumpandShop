import { describe, expect, it } from "vitest";

import {
  buildNorthlinePresentationFixture,
  DEMO_ORGANIZATION_NAME,
  DEMO_VENDOR_NAMES,
} from "../lib/ops/fixtures";

const terminalWorkStatuses = new Set(["closed", "cancelled"]);
const openTaskStatuses = new Set(["open", "in_progress", "paused"]);

function groupedCounts<T>(rows: readonly T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
}

describe("Clark Pump and Shop presentation data realism", () => {
  const fixture = buildNorthlinePresentationFixture();
  const asOf = Date.parse(fixture.asOf);

  it("uses one clear fictional customer identity and five plain-language vendors", () => {
    expect(fixture.organizations).toEqual([
      expect.objectContaining({ name: DEMO_ORGANIZATION_NAME, slug: "clark-pump-shop-demo", workOrderPrefix: "CPS" }),
    ]);
    expect(fixture.stores).toHaveLength(15);
    expect(fixture.stores.every((store) => store.name.startsWith(`${DEMO_ORGANIZATION_NAME} - `))).toBe(true);
    expect(fixture.workOrders.every((workOrder) => workOrder.number.startsWith("CPS-"))).toBe(true);

    expect(fixture.vendors.map((vendor) => vendor.name)).toEqual(Object.values(DEMO_VENDOR_NAMES));
    expect(fixture.vendors).toHaveLength(5);
    expect(fixture.vendors.every((vendor) =>
      /refrigeration|hvac|plumbing|kitchen|fuel|dispenser|electrical|lighting|landscaping|snow/i.test(vendor.name)
    )).toBe(true);
    expect(fixture.exceptions.some((exception) =>
      /payment-enabled|card reader.*manager review|skimmer/i.test(exception.summary)
    )).toBe(false);
  });

  it("represents a credible store equipment register with visible operating exceptions", () => {
    expect(fixture.assets).toHaveLength(144);
    const assetsByStore = groupedCounts(fixture.assets, (asset) => asset.storeId);
    expect([...assetsByStore.values()].every((count) => count >= 8 && count <= 11)).toBe(true);
    const visitsByStore = groupedCounts(fixture.visits, (visit) => visit.storeId);
    expect(new Set(visitsByStore.values()).size).toBeGreaterThan(1);

    const statuses = groupedCounts(fixture.assets, (asset) => asset.status);
    expect(statuses.get("out_of_service")).toBeGreaterThanOrEqual(1);
    expect(statuses.get("watch")).toBeGreaterThanOrEqual(4);
    expect(new Set(fixture.assets.map((asset) => asset.categoryKey))).toEqual(
      new Set(["refrigeration", "hvac", "forecourt", "foodservice", "electrical", "plumbing"]),
    );
    expect(fixture.assets.every((asset) => asset.assetTag && asset.serialNumber && asset.manufacturer && asset.model)).toBe(true);
    for (const workOrder of fixture.workOrders.filter((row) => row.id.startsWith("wo-recurring-") && row.categoryKey === "foodservice")) {
      expect(fixture.assets.some((asset) => asset.storeId === workOrder.storeId && asset.categoryKey === "foodservice")).toBe(true);
    }
  });

  it("keeps featured demo service stories connected from complaint through equipment and service evidence", () => {
    const featuredWorkOrderIds = [
      "wo-recent-aug-101-refrigeration",
      "wo-recent-aug-102-hvac",
      "wo-recent-aug-103-electrical",
      "wo-recent-aug-105-forecourt",
      "wo-recent-aug-106-exterior",
      "wo-recent-aug-108-electrical",
      "wo-recent-aug-110-refrigeration",
      "wo-recent-aug-111-plumbing",
      "wo-current-113-prep-sink",
      "wo-current-113-freezer-service",
      "wo-current-107-hvac-scheduled",
      "wo-upcoming-102-ice-machine",
      "wo-upcoming-105-dispenser-inspection",
      "wo-upcoming-104-sign-lighting",
      "wo-upcoming-114-lot-drainage",
      "wo-current-114-canopy-service",
    ];
    const intentionalSiteConditionRecords = new Set([
      "wo-recent-aug-106-exterior",
      "wo-upcoming-114-lot-drainage",
    ]);
    const workOrders = new Map(fixture.workOrders.map((workOrder) => [workOrder.id, workOrder]));
    const requests = new Map(fixture.requests.map((request) => [request.id, request]));
    const assets = new Map(fixture.assets.map((asset) => [asset.id, asset]));
    const components = new Map(fixture.components.map((component) => [component.id, component]));

    for (const workOrderId of featuredWorkOrderIds) {
      const workOrder = workOrders.get(workOrderId);
      expect(workOrder, `${workOrderId} is missing`).toBeDefined();
      expect(workOrder?.requestId, `${workOrderId} has no source complaint`).toBeTruthy();
      const request = requests.get(workOrder!.requestId!);
      expect(request?.convertedWorkOrderId).toBe(workOrderId);
      expect(request?.problem).toBe(workOrder?.problem);
      expect(fixture.assignments.some((assignment) => assignment.workOrderId === workOrderId)).toBe(true);
      expect(fixture.issuances.some((issuance) => issuance.workOrderId === workOrderId)).toBe(true);

      if (intentionalSiteConditionRecords.has(workOrderId)) {
        expect(workOrder?.assetId).toBeUndefined();
        expect(workOrder?.componentId).toBeUndefined();
        continue;
      }

      const asset = assets.get(workOrder!.assetId!);
      expect(asset, `${workOrderId} has no valid equipment link`).toBeDefined();
      expect(asset?.storeId).toBe(workOrder?.storeId);
      const component = components.get(workOrder!.componentId!);
      expect(component, `${workOrderId} has no valid component link`).toBeDefined();
      expect(component?.assetId).toBe(asset?.id);
    }

    expect(featuredWorkOrderIds.filter((id) => !workOrders.get(id)?.assetId)).toEqual(
      [...intentionalSiteConditionRecords],
    );

    const completedFeaturedIds = featuredWorkOrderIds.filter((id) => id.startsWith("wo-recent-"));
    for (const workOrderId of completedFeaturedIds) {
      const visits = fixture.visits.filter((visit) => visit.workOrderId === workOrderId);
      expect(visits, `${workOrderId} has no observed visit`).toHaveLength(1);
      expect(visits[0].status).toBe("checked_out");
      expect(visits[0].outcomeNotes?.trim(), `${workOrderId} has no technician outcome notes`).toBeTruthy();
      expect(fixture.costLines.some((cost) => cost.workOrderId === workOrderId)).toBe(true);
    }
  });

  it("keeps live operations current without making the whole queue overdue", () => {
    const activeVisits = fixture.visits.filter((visit) => visit.status === "active");
    expect(activeVisits).toHaveLength(3);
    expect(activeVisits.every((visit) => {
      const ageHours = (asOf - Date.parse(visit.checkedInAt)) / 3_600_000;
      return ageHours >= 0 && ageHours <= 8;
    })).toBe(true);

    const completedDurations = fixture.visits
      .filter((visit) => visit.status === "checked_out")
      .map((visit) => visit.observedDurationSeconds ?? 0);
    expect(Math.min(...completedDurations)).toBeGreaterThanOrEqual(30 * 60);
    expect(Math.max(...completedDurations)).toBeLessThanOrEqual(4 * 60 * 60);

    const openWork = fixture.workOrders.filter((workOrder) => !terminalWorkStatuses.has(workOrder.status));
    const overdueWork = openWork.filter((workOrder) => workOrder.dueAt && Date.parse(workOrder.dueAt) < asOf);
    expect(openWork.length).toBeGreaterThanOrEqual(12);
    expect(openWork.length).toBeLessThanOrEqual(35);
    expect(overdueWork.length / openWork.length).toBeLessThanOrEqual(0.4);
    expect(openWork.every((workOrder) => workOrder.accountableParty && workOrder.nextAction && workOrder.dueAt && workOrder.escalationTo)).toBe(true);

    const openTasks = fixture.workflowTasks.filter((task) => openTaskStatuses.has(task.status));
    const overdueTasks = openTasks.filter((task) => task.dueAt && Date.parse(task.dueAt) < asOf);
    expect(overdueTasks.length / openTasks.length).toBeLessThanOrEqual(0.4);
  });

  it("shows approved small jobs as a portfolio problem instead of a one-store trick", () => {
    const activeHolds = (fixture.workOrderVisitHolds ?? []).filter((hold) => hold.status === "active");
    const workOrders = new Map(fixture.workOrders.map((workOrder) => [workOrder.id, workOrder]));
    const heldWork = activeHolds.map((hold) => workOrders.get(hold.workOrderId)!);
    const countsByStore = groupedCounts(heldWork, (workOrder) => workOrder.storeId);

    expect(activeHolds).toHaveLength(12);
    expect(countsByStore.size).toBe(7);
    expect(Math.max(...countsByStore.values())).toBeGreaterThanOrEqual(4);
    expect(new Set(heldWork.map((workOrder) => workOrder.categoryKey))).toEqual(new Set(["plumbing", "electrical", "exterior"]));
    expect(heldWork.every((workOrder) => workOrder.status === "approved" && workOrder.nextAction === "Approved for a future vendor visit")).toBe(true);
  });

  it("keeps spend broad enough for analysis without flattening every store", () => {
    const workOrders = new Map(fixture.workOrders.map((workOrder) => [workOrder.id, workOrder]));
    const spendByCategory = new Map<string, number>();
    const spendByStore = new Map<string, number>();
    let total = 0;
    for (const cost of fixture.costLines) {
      const workOrder = workOrders.get(cost.workOrderId);
      expect(workOrder).toBeDefined();
      const amount = cost.amount.amountMinor;
      total += amount;
      spendByCategory.set(workOrder!.categoryKey ?? "unclassified", (spendByCategory.get(workOrder!.categoryKey ?? "unclassified") ?? 0) + amount);
      spendByStore.set(workOrder!.storeId, (spendByStore.get(workOrder!.storeId) ?? 0) + amount);
    }

    expect(total).toBeGreaterThanOrEqual(20_000_000);
    expect(total).toBeLessThanOrEqual(50_000_000);
    const approximateAnnualSpendPerStore = total / fixture.stores.length / 2;
    expect(approximateAnnualSpendPerStore).toBeGreaterThanOrEqual(1_000_000);
    expect(approximateAnnualSpendPerStore).toBeLessThanOrEqual(2_000_000);
    // Michigan snow and grounds contracts can legitimately be the largest
    // portfolio category, but no one service area should consume the ledger.
    expect([...spendByCategory.values()].every((amount) => amount > 0 && amount / total < 0.55)).toBe(true);
    expect(new Set(spendByCategory.keys())).toEqual(new Set(["refrigeration", "hvac", "forecourt", "plumbing", "electrical", "exterior", "foodservice"]));

    const store104 = spendByStore.get("store-northline-104")!;
    const sorted = [...spendByStore.values()].sort((left, right) => left - right);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(store104 / median).toBeGreaterThan(1.5);
    expect(store104 / median).toBeLessThan(3);
  });

  it("keeps invoice arithmetic and PM program history internally believable", () => {
    for (const invoice of fixture.invoices) {
      expect(invoice.subtotal.amountMinor + invoice.tax.amountMinor + invoice.fees.amountMinor).toBe(invoice.total.amountMinor);
    }
    const grossByReference = new Map(fixture.invoiceReferences.map((invoice) => [invoice.id, invoice.grossAmount.amountMinor]));
    const allocatedByReference = new Map<string, number>();
    for (const allocation of fixture.invoiceAllocations) {
      allocatedByReference.set(allocation.invoiceReferenceId, (allocatedByReference.get(allocation.invoiceReferenceId) ?? 0) + allocation.amount.amountMinor);
    }
    for (const [invoiceId, allocated] of allocatedByReference) expect(allocated).toBeLessThanOrEqual(grossByReference.get(invoiceId)!);

    expect(fixture.maintenancePrograms).toHaveLength(5);
    const pmStatuses = new Set(fixture.pmOccurrences.map((occurrence) => occurrence.status));
    expect(pmStatuses).toEqual(new Set(["completed", "scheduled", "missed", "due", "waived", "proposed"]));
    expect(fixture.pmOccurrences.filter((occurrence) => occurrence.status === "completed").length).toBeGreaterThan(100);
    expect(fixture.pmOccurrences.filter((occurrence) => occurrence.status === "missed").length).toBeGreaterThanOrEqual(5);

    const completedOccurrences = fixture.pmOccurrences.filter((occurrence) => occurrence.status === "completed");
    expect(completedOccurrences.every((occurrence) => occurrence.workOrderId || occurrence.result?.startsWith("Manager-attested historical completion"))).toBe(true);
    const unobservedPlatformWork = completedOccurrences.filter((occurrence) => occurrence.workOrderId &&
      !fixture.visits.some((visit) => visit.workOrderId === occurrence.workOrderId)
      && !fixture.siteVisitWorkOrders.some((link) => link.workOrderId === occurrence.workOrderId),
    );
    expect(unobservedPlatformWork.map((occurrence) => occurrence.id).sort()).toEqual([
      "pm-occurrence-107-2026-q2",
      "pm-occurrence-107-2026-q3",
    ]);

    for (const workOrderId of ["wo-service-run-104-reactive", "wo-service-run-105-pm"]) {
      expect(fixture.issuances.some((issuance) => issuance.workOrderId === workOrderId)).toBe(true);
      expect((fixture.serviceAppointments ?? []).some((appointment) => appointment.workOrderId === workOrderId && appointment.status === "confirmed")).toBe(true);
    }
  });
});
