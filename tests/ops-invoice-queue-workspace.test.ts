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

    expect(markup).toContain('href="/app/invoices?view=all#invoice-register"');
    expect(markup.match(/href="\/app\/invoices\?view=review#invoice-register"/g)).toHaveLength(3);
    expect(markup).toContain(`Invoices needing review</span><strong>${reviewInvoiceIds.size}</strong>`);
    expect(markup).toContain(`Open review flags</span><strong>${openExceptions.length}</strong>`);

    expect(markup).toContain('id="invoice-register"');

    expect(markup).toContain("Open invoice");
    expect(markup).not.toContain("Payments executed");
  });
});

it("pages invoice records without changing the full-scope counts", () => {
  const fixture = buildNorthlinePresentationFixture();
  const render = (page: string, view = "all") => renderToStaticMarkup(createElement(InvoiceQueueWorkspace, {fixture, invoices: fixture.invoices, page, view}));
  const first = render("1"), second = render("2");
  const rows = (markup: string) => [...markup.matchAll(/data-label="Invoice"><a href="([^"]+)"/g)].map(match => match[1]);
  expect(rows(first)).toHaveLength(20);
  expect(rows(second)).toHaveLength(20);
  expect(rows(first).some(href => rows(second).includes(href))).toBe(false);
  expect(second).toContain(`Invoices in scope</span><strong>${fixture.invoices.length}</strong>`);
  const review = render("1", "review");
  const ids = new Set(fixture.invoiceExceptions.filter(row=>row.status === "open").map(row=>`/app/invoices/${row.invoiceId}`));
  expect(rows(review).every(href=>ids.has(href))).toBe(true);
  expect(rows(render("-1"))).toEqual(rows(first));
  expect(rows(render("Infinity"))).toEqual(rows(first));
});
it("links an invoice directly to the warranty cases for its allocated work", () => {
  const fixture=buildNorthlinePresentationFixture();
  const invoice=fixture.invoices.find(row=>row.id==="invoice-summit-104-warranty-callback")!;
  const lines=new Set(fixture.invoiceLines.filter(row=>row.invoiceId===invoice.id).map(row=>row.id));
  const work=new Set(fixture.invoiceLineAllocations.filter(row=>lines.has(row.invoiceLineId)).map(row=>row.workOrderId));
  const cases=fixture.warrantyCases.filter(row=>work.has(row.workOrderId));
  expect(cases.length).toBeGreaterThan(0);
  const markup=renderToStaticMarkup(createElement(InvoiceDetailWorkspace,{fixture,invoice,canDecide:false}));
  for(const item of cases) expect(markup).toContain(`/app/warranties/${item.id}#diagnosis`);
});
