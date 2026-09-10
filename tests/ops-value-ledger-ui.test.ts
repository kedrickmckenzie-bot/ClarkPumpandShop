import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ValueLedgerWorkspace } from "@/components/ops/value-ledger-workspace";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("source-linked Value Ledger", () => {
  it("does not sum different currencies or turn requested deductions into confirmed benefits", () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.valueEvents[0];
    const events = [
      { ...source, id: "usd-opportunity", category: "estimated_opportunity" as const, eventType: "invoice_deduction_requested", amount: { amountMinor: 10000, currency: "USD" }, sourceDecision: "Vendor wording stays exactly as recorded: await_credit" },
      { ...source, id: "eur-opportunity", category: "estimated_opportunity" as const, amount: { amountMinor: 20000, currency: "EUR" } },
    ];
    const markup = renderToStaticMarkup(createElement(ValueLedgerWorkspace, { fixture, events, allEvents: events }));
    expect(markup).toContain("$100.00 · €200.00");
    expect(markup).not.toContain("$300.00");
    expect(markup).toContain("Deduction requested — awaiting confirmation");
    expect(markup).toContain("Vendor wording stays exactly as recorded: await_credit");
    expect(markup).toContain("No recorded amount");
  });
  it("keeps realized value, identified exposure, and estimated opportunity separate", () => {
    const fixture = buildNorthlinePresentationFixture();
    const markup = renderToStaticMarkup(createElement(ValueLedgerWorkspace, {
      fixture,
      events: fixture.valueEvents,
      allEvents: fixture.valueEvents,
    }));

    expect(markup).toContain("Confirmed financial benefits");
    expect(markup).toContain("Identified exposure");
    expect(markup).toContain("Estimated opportunity");
    expect(markup).toContain("Review confirmed benefits, possible recoveries, and planning estimates separately");
    expect(markup).toContain("It is not a deduction, credit, or savings claim");
    expect(markup).toContain("Each entry keeps its source and review history");
    expect(markup).toContain("Invoice COLDLINE-202603-104-4");
    expect(markup).toContain("Invoice COLDLINE-202603-104-4-COPY");
    expect(markup).not.toContain("invoice-document-sha256:");
    expect(markup).not.toContain("f5c0b8e6d9ed63cc6572df4bdda92d02ce6de55a70012f93f426d99b5f991922");
    expect(markup).toMatch(/href="\/app\/(invoices|warranties|service-runs|work-orders|equipment)\//);
    expect(markup).not.toContain("Total value created");
  });
});
