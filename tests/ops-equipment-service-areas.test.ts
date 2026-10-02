import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/app/equipment", useSearchParams: () => new URLSearchParams() }));

const fixture = buildNorthlinePresentationFixture();
const facilities: OperatorSession = { role: "facilities", userId: "user-northline-facilities", membershipId: "membership-northline-facilities", displayName: "Jordan Lee", email: "j@example.test", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark", scopeLabel: "All stores", permissions: ["ops:*"] };
const params = (href: string) => Object.fromEntries(new URL(href, "https://example.test").searchParams);

describe("equipment by service area", () => {
  it("splits each service area by status, largest first, and every part opens exactly its equipment", async () => {
    const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
    const model = buildProgramModel(fixture, facilities, "equipment", {});
    const areas = model.breakdowns.find((breakdown) => breakdown.id === "equipment-category")!;
    expect(areas.segments.map((segment) => segment.value)).toEqual([...areas.segments.map((segment) => segment.value)].sort((a, b) => b - a));
    expect(areas.segments.some((segment) => segment.parts?.some((part) => part.id !== "operational"))).toBe(true);
    for (const segment of areas.segments) {
      const assets = fixture.assets.filter((asset) => asset.categoryKey === segment.id);
      expect(segment.parts!.reduce((sum, part) => sum + part.value, 0)).toBe(segment.value);
      for (const part of segment.parts!) {
        expect(part.value).toBe(assets.filter((asset) => asset.status === part.id).length);
        expect(part.tone).toBe(({ operational: "positive", watch: "warning", out_of_service: "critical" } as Record<string, string>)[part.id] ?? "neutral");
        const opened = new Set<string>();
        let query: Record<string, string> | undefined = params(part.link.href);
        while (query) {
          const page = buildProgramModel(fixture, facilities, "equipment", query);
          for (const row of page.table?.rows ?? []) opened.add(row.id);
          query = page.pagination?.nextHref ? params(page.pagination.nextHref) : undefined;
        }
        expect([...opened].sort()).toEqual(assets.filter((asset) => asset.status === part.id).map((asset) => asset.id).sort());
      }
    }
  });

  it("shows operational out of total per area with problem counts in status colors and plain follow-up wording", async () => {
    const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
    const { ProgramView } = await import("@/components/ops/views");
    const model = buildProgramModel(fixture, facilities, "equipment", {});
    const html = renderToStaticMarkup(createElement(ProgramView, { model, compact: true }));
    const hvac = model.breakdowns.find((breakdown) => breakdown.id === "equipment-category")!.segments.find((segment) => segment.id === "hvac")!;
    const operational = hvac.parts!.find((part) => part.id === "operational")?.value ?? 0;
    expect(html).toContain(`<strong>${operational}</strong> of ${hvac.value} operational`);
    expect(html).not.toContain(" working<");
    expect(html).toContain("have open work or a problem status");
    expect(html).toContain("open jobs need equipment linked");
    expect(html).not.toContain("need an equipment choice");
    expect(html).not.toContain("<summary>By service area</summary>");
  });

  it("opens exactly the counted open jobs that still need equipment, from Equipment and from the Work filter", async () => {
    const { buildQueryListModel } = await import("@/app/app/_data/operator-query-presenter");
    const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
    const repository = createOpsFixtureRepository(fixture);
    const listed = async (query: Record<string, string>) => {
      const found: string[] = [];
      let next: Record<string, string> | undefined = query;
      while (next) {
        const page = await buildQueryListModel(repository, facilities, "work-orders", next);
        found.push(...page.table.rows.map((row) => row.id));
        next = page.pagination?.nextHref ? params(page.pagination.nextHref) : undefined;
      }
      return found;
    };
    const metric = buildProgramModel(fixture, facilities, "equipment", {}).metrics.find((item) => item.id === "unlinked")!;
    const fromEquipment = await listed(params(metric.link.href));
    expect(fromEquipment).toHaveLength(Number(metric.value));
    // The Active view (open work) is where the filter is normally chosen.
    const active = await buildQueryListModel(repository, facilities, "work-orders", { status: "open" });
    const option = active.filters?.find((filter) => filter.id === "asset")?.options.find((item) => item.value === "needed");
    expect(option).toMatchObject({ label: "Needs equipment linked", selected: false });
    const fromFilter = await listed(params(option!.href));
    expect(fromFilter.sort()).toEqual([...fromEquipment].sort());
    const selected = await buildQueryListModel(repository, facilities, "work-orders", params(option!.href));
    expect(selected.filters?.find((filter) => filter.id === "asset")?.options.find((item) => item.value === "needed")?.selected).toBe(true);
  });
  it("keeps the selected region on every count link, so each opens only that region's records", async () => {
    const { buildQueryListModel } = await import("@/app/app/_data/operator-query-presenter");
    const { buildProgramModel } = await import("@/app/app/_data/operator-presenter");
    const repository = createOpsFixtureRepository(fixture);
    const region = fixture.regions[1];
    const regionStores = new Set(fixture.stores.filter((store) => store.regionId === region.id).map((store) => store.id));
    const model = buildProgramModel(fixture, facilities, "equipment", { region: region.id });
    const links = [
      ...model.metrics.map((metric) => metric.link.href),
      ...model.breakdowns.flatMap((breakdown) => [breakdown.sourceLink.href, ...breakdown.segments.flatMap((segment) => [segment.link.href, ...(segment.parts ?? []).map((part) => part.link.href)])]),
    ];
    expect(links.length).toBeGreaterThan(10);
    for (const href of links) expect(params(href).region, href).toBe(region.id);
    const areas = model.breakdowns.find((breakdown) => breakdown.id === "equipment-category")!;
    for (const part of areas.segments.flatMap((segment) => segment.parts ?? [])) {
      let query: Record<string, string> | undefined = params(part.link.href), opened = 0;
      while (query) {
        const page = buildProgramModel(fixture, facilities, "equipment", query);
        for (const row of page.table?.rows ?? []) { opened += 1; expect(regionStores.has(fixture.assets.find((asset) => asset.id === row.id)!.storeId)).toBe(true); }
        query = page.pagination?.nextHref ? params(page.pagination.nextHref) : undefined;
      }
      expect(opened).toBe(part.value);
    }
    const metric = model.metrics.find((item) => item.id === "unlinked")!;
    const jobs: string[] = [];
    let next: Record<string, string> | undefined = params(metric.link.href);
    while (next) {
      const page = await buildQueryListModel(repository, facilities, "work-orders", next);
      jobs.push(...page.table.rows.map((row) => row.id));
      next = page.pagination?.nextHref ? params(page.pagination.nextHref) : undefined;
    }
    expect(jobs).toHaveLength(Number(metric.value));
    for (const id of jobs) expect(regionStores.has(fixture.workOrders.find((work) => work.id === id)!.storeId)).toBe(true);
    expect(Number(metric.value)).toBeLessThan(Number(buildProgramModel(fixture, facilities, "equipment", {}).metrics.find((item) => item.id === "unlinked")!.value));
  });
});
