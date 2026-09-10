import { describe, expect, it, vi } from "vitest";
import { buildProgramModel } from "@/app/app/_data/operator-presenter";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OperatorSession, ProgramPageViewModel } from "@/components/ops/data-contract";
import type { OpsFixture } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));
const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "demo", displayName: "Manager", email: "demo@example.test", organizationName: "Demo", scopeLabel: "All", role: "facilities" };
const queryFor = (href: string) => Object.fromEntries(new URL(href, "https://example.test").searchParams);
const follow = (fixture: OpsFixture, href: string) => buildProgramModel(fixture, session, "pm", queryFor(href));
function allRows(fixture: OpsFixture, model: ProgramPageViewModel) {
  const rows = [...model.table!.rows];
  while (model.pagination?.nextHref) { model = follow(fixture, model.pagination.nextHref); rows.push(...model.table!.rows); }
  return rows;
}

describe("PM chart evidence", () => {
  it("uses service-dated cost lines from the selected PM equipment and never a broad work queue", () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find((row) => row.id === "wo-northline-104")!;
    const occurrence = fixture.pmOccurrences.find((row) => row.assetId === work.assetId)!;
    const plan = fixture.pmPlans.find((row) => row.id === occurrence.planId)!;
    work.createdAt = "2023-01-01T00:00:00.000Z";
    const source = fixture.costLines[0];
    fixture.costLines = [
      { ...source, id: "inside", workOrderId: work.id, serviceDate: "2026-07-02", amount: { amountMinor: 12345, currency: "USD" } },
      { ...source, id: "quiet-recorded-zero", workOrderId: work.id, serviceDate: "2026-07-03", amount: { amountMinor: 0, currency: "USD" } },
      { ...source, id: "old-service", workOrderId: work.id, serviceDate: "2020-01-01" },
      { ...source, id: "future-service", workOrderId: work.id, serviceDate: "2030-01-01" },
      { ...source, id: "foreign", organizationId: "another-tenant", workOrderId: work.id, serviceDate: "2026-07-02" },
      { ...source, id: "other-currency", workOrderId: work.id, serviceDate: "2026-07-02", amount: { amountMinor: 100, currency: "CAD" } },
    ];
    const other = { ...work, id: "outside-pm", assetId: "asset-without-pm" };
    fixture.assets.push({ ...fixture.assets.find((row) => row.id === work.assetId)!, id: other.assetId });
    fixture.workOrders.push(other);
    fixture.costLines.push({ ...source, id: "outside-equipment", workOrderId: other.id, serviceDate: "2026-07-02" });
    const pmWork = fixture.workOrders.find((row) => fixture.pmOccurrences.some((item) => item.workOrderId === row.id && row.assetId === work.assetId))!;
    fixture.costLines.push({ ...source, id: "pm-generated", workOrderId: pmWork.id, serviceDate: "2026-07-02" });
    const query = { store: work.storeId, region: fixture.stores.find((row) => row.id === work.storeId)!.regionId, program: plan.programId };
    const chart = buildProgramModel(fixture, session, "pm", query).trends.find((row) => row.id === "pm-reactive-cost")!;
    expect(chart.points.map((point) => [point.id, point.value])).toEqual([["2026-07", 12345]]);
    const point = chart.points[0];
    expect(queryFor(point.link.href)).toMatchObject({ ...query, evidence: "reactive-cost", month: "2026-07" });
    const evidence = follow(fixture, point.link.href);
    expect(evidence.table!.rows.map((row) => row.id)).toEqual(["quiet-recorded-zero", "inside"]);
    expect(evidence.sourceDescription).toContain("$123.45");
    expect(evidence.table!.rows[0].cells.find((cell) => cell.key === "cost")?.value).toBe("$0.00");
    expect(evidence.table!.rows.every((row) => row.href === `/app/work-orders/${work.id}?view=cost`)).toBe(true);
    expect(follow(fixture, point.link.href.replace("2026-07", "2026-06")).table!.rows).toEqual([]);
  });

  it("keeps the cohort numerator and denominator reviewable, including quiet equipment and latest-window changes", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildProgramModel(fixture, session, "pm");
    const chart = model.breakdowns.find((row) => row.id === "pm-effectiveness-cohorts")!;
    const cohortIds = new Set<string>();
    for (const segment of chart.segments) {
      const evidence = follow(fixture, segment.link.href);
      const workRows = allRows(fixture, evidence);
      const equipment = follow(fixture, evidence.filters![0].options.find((option) => option.value === "cohort-equipment")!.href);
      const equipmentRows = allRows(fixture, equipment);
      expect(segment.value).toBe(equipmentRows.length ? workRows.length / (equipmentRows.length * 12) * 100 : 0);
      expect(equipmentRows.reduce((sum, row) => sum + Number(row.cells.find((cell) => cell.key === "work")!.value), 0)).toBe(workRows.length);
      for (const row of equipmentRows) { expect(cohortIds.has(row.id)).toBe(false); cohortIds.add(row.id); }
      for (const row of workRows) {
        const work = fixture.workOrders.find((item) => item.id === row.id)!;
        expect(equipmentRows.some((equipmentRow) => equipmentRow.id === work.assetId)).toBe(true);
        expect(fixture.pmOccurrences.some((item) => item.workOrderId === work.id)).toBe(false);
      }
      if (equipmentRows.length) {
        const occurrenceRow = follow(fixture, equipmentRows[0].cells.find((cell) => cell.key === "window")!.link!.href).table!.rows;
        expect(occurrenceRow).toHaveLength(1);
      }
    }
    expect(allRows(fixture, follow(fixture, chart.sourceLink.href))).toHaveLength(cohortIds.size);
    const completedIds = allRows(fixture, follow(fixture, chart.segments[0].link.href.replace("reactive-work", "cohort-equipment"))).map((row) => row.id);
    const changed = fixture.pmOccurrences.find((row) => row.assetId === completedIds[0])!;
    const recentWindow = new Date(Date.parse(fixture.asOf) - 86400000).toISOString();
    fixture.pmOccurrences.push({ ...changed, id: "new-missed-window", status: "missed", completedAt: undefined, windowEndsAt: recentWindow, dueAt: recentWindow });
    const updated = buildProgramModel(fixture, session, "pm").breakdowns.find((row) => row.id === chart.id)!;
    expect(allRows(fixture, follow(fixture, updated.segments[0].link.href.replace("reactive-work", "cohort-equipment"))).map((row) => row.id)).not.toContain(changed.assetId);
    expect(allRows(fixture, follow(fixture, updated.segments[1].link.href.replace("reactive-work", "cohort-equipment"))).map((row) => row.id)).toContain(changed.assetId);
  });

  it("does not broaden invalid cohorts, evidence kinds, or out-of-scope stores", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(buildProgramModel(fixture, session, "pm", { evidence: "reactive-work", cohort: "invalid" }).table!.rows).toEqual([]);
    expect(buildProgramModel(fixture, session, "pm", { evidence: "reactive-work", cohort: "invalid" }).sourceDescription).toContain("a rate is unavailable");
    expect(buildProgramModel(fixture, session, "pm", { evidence: "reactive-work", cohort: "constructor" }).table!.rows).toEqual([]);
    expect(buildProgramModel(fixture, session, "pm", { evidence: "invalid" }).table!.rows).toEqual([]);
    const restricted = { ...session, role: "store_manager" as const, storeIds: ["store-northline-104"] };
    expect(buildProgramModel(fixture, restricted, "pm", { evidence: "reactive-cost", store: "store-northline-105" }).table!.rows).toEqual([]);
    expect(buildProgramModel(fixture, session, "pm", { view: "all" }).page.periodLabel).toBe("All recorded PM windows");
  });
});
