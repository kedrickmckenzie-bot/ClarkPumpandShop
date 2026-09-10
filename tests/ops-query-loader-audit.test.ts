import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";

const mocked = vi.hoisted(() => ({ repository: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocked.repository, getServerOpsFixtureSnapshot: mocked.snapshot, getServerOpsTrendsFixtureSnapshot: mocked.snapshot }));
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
  it("loads saved views without fetching unrelated tenant data", async () => {
    expect(await loadSavedViewsModel("work-orders")).toEqual([]);
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
