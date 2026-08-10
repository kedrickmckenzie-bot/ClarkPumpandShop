import { describe, expect, it } from "vitest";

import {
  findCostOutliers,
  findLifecycleCandidates,
  getInvoiceTotalMinor,
  getSpendMetric,
  getSpendSourceRows,
  searchVendors,
  validateDemoDataset,
} from "@/lib/cstore/analytics";
import { DEMO_ORGANIZATION_ID, demoData } from "@/lib/cstore/demo-data";

describe("clean-slate c-store presentation fixture", () => {
  it("contains exactly 15 stores in three regions and exactly five vendors", () => {
    expect(demoData.stores).toHaveLength(15);
    expect(new Set(demoData.stores.map((store) => store.id))).toHaveLength(15);
    expect(demoData.regions).toHaveLength(3);
    expect(demoData.vendors).toHaveLength(5);
    expect(new Set(demoData.vendors.map((vendor) => vendor.id))).toHaveLength(5);
    expect(demoData.stores.every((store) => demoData.regions.some((region) => region.id === store.regionId))).toBe(true);
  });

  it("passes the connected-record and tenant integrity validator", () => {
    expect(validateDemoDataset(demoData, DEMO_ORGANIZATION_ID)).toEqual([]);
  });

  it("finds approved vendors using plain-language specialties and equipment aliases", () => {
    const plumberResults = searchVendors(demoData, DEMO_ORGANIZATION_ID, "plumber");
    const beerCaveResults = searchVendors(demoData, DEMO_ORGANIZATION_ID, "beer cave");

    expect(plumberResults.map((result) => result.vendor.displayName)).toEqual(["Cedar Mechanical"]);
    expect(plumberResults[0].matchedOn).toContain("specialty alias");
    expect(beerCaveResults.map((result) => result.vendor.displayName)).toEqual(["Summit Refrigeration"]);
    expect(beerCaveResults[0].matchedOn).toEqual(expect.arrayContaining(["specialty", "specialty alias", "equipment"]));
  });

  it("derives invoiced spend from reconciled invoice-to-work source links", () => {
    const sourceRows = getSpendSourceRows(demoData, DEMO_ORGANIZATION_ID, { basis: "invoiced" });
    const metric = getSpendMetric(demoData, DEMO_ORGANIZATION_ID, { basis: "invoiced" });
    const attributedTotal = demoData.invoiceWorkLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0);

    expect(metric.value).toBe(attributedTotal);
    expect(metric.sourceRecordIds).toEqual(sourceRows.map((row) => row.sourceRecordId));
    expect(metric.sourceRecordIds).toHaveLength(demoData.invoiceWorkLinks.length);

    for (const invoice of demoData.invoices) {
      const linkedAmount = demoData.invoiceWorkLinks
        .filter((link) => link.invoiceId === invoice.id)
        .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
      expect(linkedAmount, invoice.invoiceNumber).toBe(getInvoiceTotalMinor(invoice));
    }
  });

  it("carries the operator work-order number from vendor issuance through billing", () => {
    const workOrder = demoData.workOrders.find((candidate) => candidate.id === "wo-101-refrigeration-main")!;
    const vendorAssignment = demoData.assignments.find((assignment) =>
      assignment.workOrderId === workOrder.id && assignment.partyType === "vendor",
    )!;
    const issuance = demoData.vendorIssuances.find((candidate) =>
      candidate.workOrderId === workOrder.id && candidate.version === 1,
    )!;
    const invoiceLink = demoData.invoiceWorkLinks.find((link) => link.workOrderId === workOrder.id)!;
    const invoice = demoData.invoices.find((candidate) => candidate.id === invoiceLink.invoiceId)!;
    const visit = demoData.visits.find((candidate) => candidate.workOrderId === workOrder.id && candidate.vendorId === vendorAssignment.partyId)!;

    expect(vendorAssignment.partyId).toBe(issuance.vendorId);
    expect(issuance.assignmentId).toBe(vendorAssignment.id);
    expect(issuance.customerBillingInstruction).toContain(workOrder.number);
    expect(issuance.vendorReference).toBeTruthy();
    expect(invoice.customerWorkOrderReferences).toContain(workOrder.number);
    expect(invoice.vendorServiceReferences).toContain(issuance.vendorReference);
    expect(invoiceLink.storeId).toBe(workOrder.storeId);
    expect(invoiceLink.assetId).toBe(workOrder.assetId);
    expect(visit.storeId).toBe(workOrder.storeId);
  });

  it("surfaces the Store 104 refrigeration outlier and rule-based lifecycle review", () => {
    const outlier = findCostOutliers(demoData, DEMO_ORGANIZATION_ID).find((candidate) =>
      candidate.storeId === "store-104" && candidate.categoryId === "category-refrigeration",
    );
    const lifecycle = findLifecycleCandidates(demoData, DEMO_ORGANIZATION_ID).find((candidate) =>
      candidate.asset.id === "asset-104-beer-cave",
    );

    expect(outlier).toBeDefined();
    expect(outlier!.multipleOfMedian).toBeGreaterThan(1.5);
    expect(outlier!.sourceRecordIds.length).toBeGreaterThan(0);
    expect(lifecycle).toBeDefined();
    expect(lifecycle!.correctiveWorkOrderCount).toBe(3);
    expect(lifecycle!.repairToReplacementPercentage).toBeGreaterThan(35);
    expect(lifecycle!.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/repair spend/i),
      expect.stringMatching(/3 corrective work orders/i),
      expect.stringMatching(/repeat-repair/i),
    ]));
    expect(lifecycle!.sourceRecordIds.length).toBeGreaterThan(0);
  });
});
