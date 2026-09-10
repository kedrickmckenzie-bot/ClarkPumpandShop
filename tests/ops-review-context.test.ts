import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildQueryListModel, buildQuerySearchModel } from "@/app/app/_data/operator-query-presenter";
import { RecordSections } from "@/components/workspace/record-sections";
import { SearchView } from "@/components/ops/views";
import type { OperatorSession } from "@/components/ops/data-contract";

const location = vi.hoisted(() => ({ query: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/visits/visit-1", useSearchParams: () => new URLSearchParams(location.query), useRouter: () => ({ push: vi.fn() }) }));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "user-northline-facilities", displayName: "Jordan Lee", email: "demo@example.test", organizationName: "Demo", scopeLabel: "Companywide", role: "facilities", demoEdition: "complete" };

describe("reviewing information in context", () => {
  beforeEach(() => { location.query = ""; });

  it("shows search facts and independent evidence destinations with a route to every matching group", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const model = await buildQuerySearchModel(repository, session, { q: "104" });
    expect(model.resultSummary).not.toContain("At least");
    for (const group of model.groups) {
      expect(group.rows.length).toBeLessThanOrEqual(8);
      expect(new URL(group.moreLink!.href, "https://local.test").searchParams.get("q")).toBe("104");
      expect(group.columns?.length).toBeGreaterThan(0);
    }
    const markup = renderToStaticMarkup(createElement(SearchView, { model }));
    expect(markup).toContain("Assigned to");
    expect(markup).toContain("Recorded cost");
    expect(markup).toContain("Serial number");
    expect(markup).toContain("Operating state");
    expect(markup).toContain('aria-label="Review open work:');
    expect(markup).toContain('href="/app/work-orders?store=store-northline-104&amp;status=open#main-content"');
    expect(markup).toContain("Review matching work orders");
    expect(markup).toContain("Showing 8");
  });

  it("marks counts as lower bounds only when the repository cannot provide a total", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const original = repository.listWorkOrders.bind(repository);
    vi.spyOn(repository, "listWorkOrders").mockImplementation(async (...args) => ({ ...await original(...args), totalCount: undefined }));
    const model = await buildQuerySearchModel(repository, session, { q: "104" });
    expect(model.groups.find((group) => group.id === "work")).toMatchObject({ resultCount: 8, hasMore: true, countIsLowerBound: true });
    expect(model.resultSummary).toContain("At least");
  });

  it("respects location grants and removes unavailable visit links from finance search", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    const finance = await buildQuerySearchModel(repository, { ...session, role: "finance", storeIds: ["store-northline-104"] }, { q: "104" });
    expect(finance.groups.some((group) => ["visits", "requests"].includes(group.id))).toBe(false);
    expect(finance.groups.flatMap((group) => group.rows.flatMap((row) => row.cells)).some((cell) => cell.link?.href.startsWith("/app/visits"))).toBe(false);
    const blocked = await buildQuerySearchModel(repository, { ...session, storeIds: [] }, { q: "104" });
    expect(blocked.groups.filter((group) => group.id !== "vendors")).toHaveLength(0);
  });

  it("does not infer onsite status or no work from a checked-out visit without a legacy outcome", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const visit = fixture.visits.find((row) => row.checkedOutAt && !row.outcome)!;
    expect(visit).toBeDefined();
    const model = await buildQueryListModel(createOpsFixtureRepository(fixture), session, "visits", { store: visit.storeId });
    const row = model.table.rows.find((item) => item.id === visit.id)!;
    expect(row.cells.find((cell) => cell.key === "outcome")?.value).toBe("CPS-2026-0104: Completed · CPS-2026-0035: Completed");
    expect(row.cells.find((cell) => cell.key === "work")?.value).not.toBe("No work order");
    expect(row.cells.find((cell) => cell.key === "outcome")?.link?.href).toBe(`/app/visits/${visit.id}`);
  });

  it("preserves source context through section links and keeps missing evidence neutral", () => {
    location.query = "period=12m&store=store-1";
    const markup = renderToStaticMarkup(createElement(RecordSections, { sections: [{ id: "costs", title: "Costs", table: { id: "costs-table", caption: "Recorded cost lines", columns: [{ key: "amount", label: "Recorded amount" }], rows: [] } }] }));
    expect(markup).toContain('href="/app/visits/visit-1?period=12m&amp;store=store-1&amp;section=costs#record-review-start"');
    expect(markup).toContain("No records are listed here");
    expect(markup).not.toContain("$0");
    expect(markup).toContain('id="costs"');
    location.query = "period=12m&store=store-1&section=costs";
    const focused = renderToStaticMarkup(createElement(RecordSections, { sections: [{ id: "costs", title: "Costs", facts: [{ label: "Basis", value: "Recorded work cost" }] }] }));
    expect(focused).not.toContain("Review this record");
    expect(focused).toContain('href="/app/visits/visit-1?period=12m&amp;store=store-1#record-review-start"');
    expect(focused).toContain('href="/app/visits/visit-1?period=12m&amp;store=store-1&amp;section=costs#record-review-start"');
  });
});
