import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceQueueWorkspace } from "@/components/ops/warranty-finance-workspace";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("invoice review workspace", () => {
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
