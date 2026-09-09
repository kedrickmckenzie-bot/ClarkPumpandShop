import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceDetailWorkspace, InvoiceQueueWorkspace } from "@/components/ops/warranty-finance-workspace";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("invoice review workspace", () => {
  it("replaces raw allocation identifiers with exact work, store, and visit destinations", () => {
    const fixture = buildNorthlinePresentationFixture();
    const invoice = fixture.invoices.find((row) => row.id === "invoice-summit-104-compressor")!;
    const allocation = fixture.invoiceLineAllocations.find((row) => row.siteVisitWorkOrderId && fixture.invoiceLines.some((line) => line.id === row.invoiceLineId && line.invoiceId === invoice.id))!;
    const outcome = fixture.siteVisitWorkOrders.find((row) => row.id === allocation.siteVisitWorkOrderId)!;
    const markup = renderToStaticMarkup(createElement(InvoiceDetailWorkspace, { fixture, invoice, canDecide: false }));
    expect(markup).toContain(`href="/app/visits/${outcome.visitId}?section=work-orders"`);
    expect(markup).toContain(`href="/app/work-orders/${allocation.workOrderId}"`);
    expect(markup).toContain(`href="/app/stores/${allocation.storeId}"`);
    expect(markup).not.toContain(allocation.siteVisitWorkOrderId);
    expect(markup).not.toContain("/undefined");
  });

  it("makes each principal measure open its exact supporting review set", () => {
    const fixture = buildNorthlinePresentationFixture();
    const markup = renderToStaticMarkup(createElement(InvoiceQueueWorkspace, {
      fixture,
      invoices: fixture.invoices,
    }));
    const openExceptions = fixture.invoiceExceptions.filter((exception) => exception.status === "open");
    const reviewInvoiceIds = new Set(openExceptions.map((exception) => exception.invoiceId));

    expect(markup).toContain('href="#invoice-register"');
    expect(markup.match(/href="#invoice-review"/g)).toHaveLength(3);
    expect(markup).toContain(`Invoices needing review</span><strong>${reviewInvoiceIds.size}</strong>`);
    expect(markup).toContain(`Open review flags</span><strong>${openExceptions.length}</strong>`);
    expect(markup).toContain('id="invoice-review"');
    expect(markup).toContain('id="invoice-register"');
    expect(markup).toContain("Open evidence");
    expect(markup).toContain("Open invoice");
    expect(markup).not.toContain("Payments executed");
  });
});
