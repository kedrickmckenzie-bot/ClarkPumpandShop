import { describe, expect, it } from "vitest";

import { getSpendSourceRows } from "@/lib/cstore/analytics";
import { DEMO_ORGANIZATION_ID, demoData } from "@/lib/cstore/demo-data";

const completedStatuses = new Set(["completed", "awaiting_invoice", "invoice_received", "closed"]);

describe("invoice-independent completed-work costs", () => {
  it("records one completed-work cost for every completed demo work order", () => {
    for (const workOrder of demoData.workOrders.filter((record) => completedStatuses.has(record.status))) {
      const recordedLines = demoData.costLines.filter(
        (line) => line.workOrderId === workOrder.id && line.basis === "recorded",
      );

      expect(recordedLines, workOrder.number).toHaveLength(1);
      expect(recordedLines[0].amountMinor, workOrder.number).toBeGreaterThan(0);
    }
  });

  it("preserves the Store 104 compressor sequence when invoices are removed", () => {
    const datasetWithoutInvoices = {
      ...demoData,
      invoices: [],
      invoiceWorkLinks: [],
    };
    const rows = getSpendSourceRows(datasetWithoutInvoices, DEMO_ORGANIZATION_ID, {
      basis: "recorded",
      assetId: "asset-104-beer-cave",
    });

    expect(rows.map((row) => row.workOrderId).sort()).toEqual([
      "wo-104-refrigeration-callback-1",
      "wo-104-refrigeration-compressor-replacement",
      "wo-104-refrigeration-main",
    ]);
    expect(rows.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(1_041_000);
    expect(rows.every((row) => row.basis === "recorded" && !row.invoiceId)).toBe(true);
  });
});
