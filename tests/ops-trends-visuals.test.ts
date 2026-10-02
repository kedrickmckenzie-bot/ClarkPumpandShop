import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));
let buildTrendsModel: typeof import("@/app/app/_data/trends-presenter").buildTrendsModel;
beforeAll(async () => { ({ buildTrendsModel } = await import("@/app/app/_data/trends-presenter")); });

const session = (): OperatorSession => ({ userId: "user-northline-executive", membershipId: "membership-northline-executive", displayName: "Alex Morgan", email: "alex@example.test", role: "executive", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark Pump and Shop", scopeLabel: "Companywide", permissions: ["ops:*"], demoEdition: "complete" });

describe("trends change bridge", () => {
  it("walks from the earlier total to the selected total with steps that add up exactly", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {});
    const bridge = model.bridge!;
    expect(bridge).toBeDefined();
    const stepped = bridge.startValue + bridge.steps.reduce((sum, step) => sum + step.value, 0);
    expect(Math.round(stepped)).toBe(Math.round(bridge.endValue));
    // The biggest movers come first and each opens both periods for that store.
    const movers = bridge.steps.filter((step) => step.id !== "other");
    expect(movers.map((step) => Math.abs(step.value))).toEqual([...movers.map((step) => Math.abs(step.value))].sort((a, b) => b - a));
    expect(movers[0].link.href).toContain("detailKind=both");
    expect(movers[0].link.href).toContain(`driverValue=${movers[0].id}`);
  });

  it("opens exactly the remaining records from the All other bar", () => {
    const fixture = buildNorthlinePresentationFixture();
    const bridge = buildTrendsModel(fixture, session(), {}).bridge!;
    const other = bridge.steps.find((step) => step.id === "other");
    expect(other).toBeDefined();
    const count = (href: string) => {
      const query = Object.fromEntries(new URL(href, "http://x").searchParams);
      const model = buildTrendsModel(fixture, session(), query);
      return { total: Number(model.sourceSummary.match(/([\d,]+) records?/)?.[1].replace(/,/g, "")), label: model.sourcePeriodLabel };
    };
    const rest = count(other!.link.href);
    expect(rest.label).toContain("All other stores");
    const named = bridge.steps.filter((step) => step.id !== "other").reduce((sum, step) => sum + count(step.link.href).total, 0);
    const everything = count(bridge.endLink.href.replace("detailKind=current", "detailKind=both")).total;
    expect(rest.total).toBeGreaterThan(0);
    expect(rest.total + named).toBe(everything);
  });

  it("is left out when there is nothing to compare", () => {
    expect(buildTrendsModel(buildNorthlinePresentationFixture(), session(), { compare: "none" }).bridge).toBeUndefined();
  });
});

describe("trends heat map", () => {
  it("shows each store by month with totals that match the store breakdown, and opens exact records", () => {
    const model = buildTrendsModel(buildNorthlinePresentationFixture(), session(), {});
    const heatmap = model.heatmap!;
    expect(heatmap.months.length).toBeGreaterThan(0);
    for (const row of heatmap.rows) {
      const driver = model.drivers.rows.find((candidate) => candidate.id === row.id)!;
      const sum = row.cells.reduce((total, cell) => total + cell.value, 0);
      expect(Math.round(sum)).toBe(Math.round(driver.currentValue ?? 0));
    }
    const cell = heatmap.rows[0].cells.find((candidate) => candidate.count > 0)!;
    expect(cell.href).toContain(`detailMonth=${cell.month}`);
    expect(cell.href).toContain(`driverValue=${heatmap.rows[0].id}`);
    // Rows are ordered by total, highest first.
    const totals = heatmap.rows.map((row) => row.cells.reduce((total, c) => total + c.value, 0));
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });
});

describe("trends short answer", () => {
  const count = (fixture: ReturnType<typeof buildNorthlinePresentationFixture>, href: string) => {
    const model = buildTrendsModel(fixture, session(), Object.fromEntries(new URL(href, "http://x").searchParams));
    return Number(model.sourceSummary.match(/([\d,]+) records?/)?.[1].replace(/,/g, ""));
  };

  it("states the change, its biggest driver, how widespread it is and the service area that moved most", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildTrendsModel(fixture, session(), {});
    const story = model.story!, bridge = model.bridge!;
    expect(story.sentences.map((sentence) => sentence.id)).toEqual(["total", "lead", "breadth", "category"]);
    // The first sentence repeats the reconciled totals, never a separate number.
    expect(story.sentences[0].text).toContain(bridge.endFormatted);
    expect(story.sentences[0].text).toContain(bridge.startFormatted);
    // The lead driver's share matches the bridge, and its link is the bridge row's link.
    const lead = bridge.steps[0];
    const share = Math.round((lead.value / (bridge.endValue - bridge.startValue)) * 100);
    expect(story.sentences[1].text).toContain(`The biggest single change is ${lead.label}`);
    expect(story.sentences[1].text).toContain(share > 100 ? "more than the whole change" : `${share}% of the change`);
    expect(story.sentences[1].link).toEqual(lead.link);
    // Breadth counts every store with a change.
    const [up, total] = story.sentences[2].text.match(/^(\d+) of (\d+)/)!.slice(1).map(Number);
    expect(up).toBeLessThanOrEqual(total);
    // Every sentence opens records that exist.
    for (const sentence of story.sentences) if (sentence.link?.href.includes("view=records")) expect(count(fixture, sentence.link.href), sentence.id).toBeGreaterThan(0);
  });

  it("is left out when there is nothing to compare", () => {
    expect(buildTrendsModel(buildNorthlinePresentationFixture(), session(), { compare: "none" }).story).toBeUndefined();
  });
});

