import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ValueLedgerWorkspace } from "@/components/ops/value-ledger-workspace";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

describe("source-linked Value Ledger", () => {
  it("keeps realized value, identified exposure, and estimated opportunity separate", () => {
    const fixture = buildNorthlinePresentationFixture();
    const markup = renderToStaticMarkup(createElement(ValueLedgerWorkspace, {
      fixture,
      events: fixture.valueEvents,
      allEvents: fixture.valueEvents,
    }));

    expect(markup).toContain("Realized and verified");
    expect(markup).toContain("Identified exposure");
    expect(markup).toContain("Estimated opportunity");
    expect(markup).toContain("never combined into one inflated savings number");
    expect(markup).toContain("It is not a deduction, credit, or savings claim");
    expect(markup).toContain("Internal controls keep one source decision from appearing more than once");
    expect(markup).toContain("Invoice COLDLINE-202603-104-4");
    expect(markup).toContain("Invoice COLDLINE-202603-104-4-COPY");
    expect(markup).not.toContain("invoice-document-sha256:");
    expect(markup).not.toContain("f5c0b8e6d9ed63cc6572df4bdda92d02ce6de55a70012f93f426d99b5f991922");
    expect(markup).toMatch(/href="\/app\/(invoices|warranties|service-runs|work-orders|equipment)\//);
    expect(markup).not.toContain("Total value created");
  });
});
