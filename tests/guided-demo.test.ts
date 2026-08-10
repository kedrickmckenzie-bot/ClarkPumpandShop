import { describe, expect, it } from "vitest";

import { demoData } from "../lib/cstore/demo-data";
import {
  createGuidedAssignment,
  createGuidedInvoice,
  createGuidedInvoiceLink,
  createGuidedIssuance,
  createGuidedRequest,
  createGuidedWorkOrder,
  GUIDED_DEMO_IDS,
  GUIDED_INVOICE_TOTAL_MINOR,
  GUIDED_NTE_MINOR,
  GUIDED_WORK_ORDER_NUMBER,
} from "../lib/cstore/guided-demo";

describe("guided demo record chain", () => {
  it("uses real Store 104, employee, manager, asset, category, and vendor records", () => {
    expect(demoData.stores.find((store) => store.id === GUIDED_DEMO_IDS.store)?.storeNumber).toBe("104");
    expect(demoData.people.some((person) => person.id === GUIDED_DEMO_IDS.employee)).toBe(true);
    expect(demoData.people.some((person) => person.id === GUIDED_DEMO_IDS.manager)).toBe(true);
    expect(demoData.assets.some((asset) => asset.id === GUIDED_DEMO_IDS.asset)).toBe(true);
    expect(demoData.categories.some((category) => category.id === GUIDED_DEMO_IDS.category)).toBe(true);
    expect(demoData.vendors.some((vendor) => vendor.id === GUIDED_DEMO_IDS.preferredVendor)).toBe(true);
  });

  it("carries one customer work-order number through request, issuance, and invoice", () => {
    const request = createGuidedRequest(demoData);
    const work = createGuidedWorkOrder(demoData);
    const assignment = createGuidedAssignment(demoData, GUIDED_DEMO_IDS.preferredVendor);
    const issuance = createGuidedIssuance(demoData, GUIDED_DEMO_IDS.preferredVendor);
    const invoice = createGuidedInvoice(demoData, GUIDED_DEMO_IDS.preferredVendor);
    const link = createGuidedInvoiceLink(demoData);

    expect(work.requestId).toBe(request.id);
    expect(work.number).toBe(GUIDED_WORK_ORDER_NUMBER);
    expect(assignment.workOrderId).toBe(work.id);
    expect(issuance.assignmentId).toBe(assignment.id);
    expect(issuance.customerBillingInstruction).toContain(GUIDED_WORK_ORDER_NUMBER);
    expect(invoice.customerWorkOrderReferences).toContain(GUIDED_WORK_ORDER_NUMBER);
    expect(link.workOrderId).toBe(work.id);
    expect(link.invoiceId).toBe(invoice.id);
  });

  it("keeps the mock invoice within the authorization and exactly allocated", () => {
    const invoice = createGuidedInvoice(demoData, GUIDED_DEMO_IDS.preferredVendor);
    const link = createGuidedInvoiceLink(demoData);
    const invoiceTotal = invoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0);

    expect(invoiceTotal).toBe(GUIDED_INVOICE_TOTAL_MINOR);
    expect(invoice.status).toBe("received");
    expect(link.attributedAmountMinor).toBe(invoiceTotal);
    expect(invoiceTotal).toBeLessThan(GUIDED_NTE_MINOR);
    expect(link.matchMethod).toBe("work_order_reference");
  });
});
