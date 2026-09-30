import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";

const mocked = vi.hoisted(() => ({ repository: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsReportingAsOf: () => "2026-09-28T12:00:00.000Z", getServerOpsRepository: mocked.repository, getServerOpsFixtureSnapshot: mocked.snapshot, getServerOpsTrendsFixtureSnapshot: mocked.snapshot }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: async () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("Not found"); } }));
import { loadListModel, loadSavedViewsModel, loadSearchModel } from "@/app/app/_data/operator-loader";

describe("query-first route loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.repository.mockResolvedValue(createOpsFixtureRepository(buildNorthlinePresentationFixture()));
    mocked.snapshot.mockRejectedValue(new Error("This list must not load a tenant snapshot"));
  });
  it("loads upcoming appointments without the snapshot that omits them", async () => {
    const fixture=buildNorthlinePresentationFixture();
    for(const appointment of fixture.serviceAppointments??[]) if(appointment.status==="confirmed") appointment.startsAt="2026-10-01T12:00:00.000Z";
    const repository=createOpsFixtureRepository(fixture);mocked.repository.mockResolvedValue(repository);
    const expected=await repository.listUpcomingAppointments({organizationId:fixture.organizations[0].id},{now:"2026-09-28T12:00:00.000Z",limit:25});
    const model=await loadListModel("visits",{status:"upcoming",layout:"tile"});
    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.map(r=>r.id)).toEqual(expected.items.map(r=>r.id));
    expect(model.rowNavigation).toBe("record");
    expect(model.table.rows.every(r=>r.href.startsWith("/app/work-orders/"))).toBe(true);
    expect(mocked.snapshot).not.toHaveBeenCalled();
  });
  it("loads saved views without fetching unrelated tenant data", async () => {
    expect(await loadSavedViewsModel("work-orders")).toEqual([]);
    expect(mocked.snapshot).not.toHaveBeenCalled();
  });
  it("keeps created-date history filters on the native query path", async () => {
    const model = await loadListModel("work-orders", { status: "history", createdFrom: "2026-08-01", createdThrough: "2026-08-25" });
    expect(model.filters?.some((filter) => filter.id === "work-view")).toBe(true);
    expect(model.appliedFilters?.some((filter) => filter.label === "Created from 2026-08-01 (UTC)")).toBe(true);
    expect(mocked.snapshot).not.toHaveBeenCalled();
  });
  it("assembles search context without loading a tenant snapshot", async () => {
    const model = await loadSearchModel({ q: "104" });
    expect(model.groups.length).toBeGreaterThan(0);
    expect(model.groups.every((group) => group.moreLink)).toBe(true);
    expect(mocked.snapshot).not.toHaveBeenCalled();
  });
  it("keeps spending hierarchy, period context, and mutation notices on bounded queries", async () => {
    const model = await loadListModel("work-orders", { basis: "recorded", period: "12m", path: "Refrigeration", costMonth: "2026-07", costFrom: "2025-09-01", costTo: "2026-08-25", saved: "reviewed" });
    expect(model.page.title).toBe("Recorded work cost");
    expect(model.rowNavigation).toBe("record");
    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.length).toBeLessThanOrEqual(25);
    expect(mocked.snapshot).not.toHaveBeenCalled();
  });
});
