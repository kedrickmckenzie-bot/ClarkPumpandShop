import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { pmScheduleFromFixture, pmScheduleState } from "@/lib/ops/pm-schedule-query";
import { pmAnalysisFromFixture } from "@/lib/ops/pm-analysis-query";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("sorts all PM records before paging and keeps dense cost evidence scoped", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id, scope = { organizationId };
  const base = fixture.pmOccurrences.find(row => !row.workOrderId && row.assetId)!;
  fixture.pmOccurrences.push(...Array.from({ length: 230 }, (_, i) => ({ ...base, id: `pm-density-${String(229 - i).padStart(3, "0")}`, recurrenceKey: undefined, status: "due" as const, completedAt: undefined, result: undefined, exceptionReason: undefined,
    dueAt: i % 2 ? "2026-08-26T11:00:00.123-04:00" : "2026-08-26T15:00:00.123Z", windowStartsAt: "2026-08-20T15:00:00.000Z", windowEndsAt: "2026-09-02T15:00:00.000Z" })));
  const covered = new Set(fixture.pmOccurrences.map(row => row.assetId));
  const repair = fixture.workOrders.find(row => row.assetId && covered.has(row.assetId) && !fixture.pmOccurrences.some(pm => pm.workOrderId === row.id))!;
  const cost = fixture.costLines[0];
  fixture.costLines.push(...Array.from({ length: 230 }, (_, i) => ({ ...cost, id: `pm-cost-density-${String(i).padStart(3, "0")}`, workOrderId: repair.id, serviceDate: "2026-08-01", amount: { currency: "USD", amountMinor: 123 } })));
  fixture.costLines.push({ ...cost, id: "pm-other-currency", workOrderId: repair.id, serviceDate: "2026-08-01", amount: { currency: "CAD", amountMinor: 999999 } }, { ...cost, id: "pm-future-cost", workOrderId: repair.id, serviceDate: "2027-01-01", amount: { currency: "USD", amountMinor: 888888 } });
  const db = new DatabaseSync(":memory:"), sizes: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[]; sizes.push(rows.length); return { rows, affectedRows: 0 }; }, async atomic() { throw new Error("Read must not mutate"); } };
  const repository = createOpsSqlRepository(driver, "d1");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const ids: string[] = []; let offset = 0, total = 0;
    do {
      const query = { asOf: fixture.asOf, store: base.storeId, status: "due" as const, limit: 25, offset };
      const page = await repository.listPmSchedule(scope, query);
      expect(page).toEqual(pmScheduleFromFixture(fixture, scope, query));
      total = page.totalCount; ids.push(...page.items.map(row => row.id));
      if (page.nextOffset === undefined) break; offset = page.nextOffset;
      if (offset > 1000) throw new Error("Schedule page did not advance");
    } while (offset <= 1000);
    expect(ids.length).toBe(total); expect(new Set(ids).size).toBe(total);
    expect(ids.filter(id => id.startsWith("pm-density-"))).toEqual(Array.from({ length: 230 }, (_, i) => `pm-density-${String(i).padStart(3, "0")}`));
    const costIds: string[] = []; offset = 0;
    do {
      const query = { asOf: fixture.asOf, kind: "reactive-cost" as const, month: "2026-08", limit: 25, offset };
      const page = await repository.listPmAnalysis(scope, query);
      expect(page).toEqual(pmAnalysisFromFixture(fixture, scope, query));
      costIds.push(...page.items.map(row => row.id)); total = page.totalCount;
      if (page.nextOffset === undefined) break; offset = page.nextOffset;
      if (offset > 1000) throw new Error("Cost page did not advance");
    } while (offset <= 1000);
    expect(costIds.length).toBe(total); expect(new Set(costIds).size).toBe(total);
    expect(costIds.filter(id => id.startsWith("pm-cost-density-"))).toHaveLength(230);
    expect(costIds).not.toContain("pm-other-currency"); expect(costIds).not.toContain("pm-future-cost");
    const beyond = await repository.listPmAnalysis(scope, { asOf: fixture.asOf, kind: "reactive-cost", month: "2026-08", offset: 100000 });
    expect(beyond.totalCount).toBe(total); expect(beyond.items).toEqual([]);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25);
    // Invalid imported references are introduced only in this disposable database.
    const other = fixture.stores.find(row => row.id !== base.storeId)!;
    const otherPlan = fixture.pmPlans.find(row => row.storeId === other.id)!;
    const otherAsset = fixture.assets.find(row => row.storeId === other.id)!;
    const otherWork = fixture.workOrders.find(row => row.storeId === other.id)!;
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("UPDATE ops_pm_occurrences SET plan_id=?,asset_id=?,work_order_id=? WHERE id=?").run(otherPlan.id, otherAsset.id, otherWork.id, "pm-density-000");
    const invalid = (await repository.listPmSchedule(scope, { asOf: fixture.asOf, occurrence: "pm-density-000" })).items[0];
    expect(invalid.planId).toBeUndefined(); expect(invalid.assetId).toBeUndefined(); expect(invalid.workId).toBeUndefined(); expect(invalid.visitCount).toBe(0);
    for (const badScope of [{ organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign" }]) {
      expect((await repository.listPmSchedule(badScope, { asOf: fixture.asOf })).totalCount).toBe(0);
      expect((await repository.listPmAnalysis(badScope, { asOf: fixture.asOf, kind: "reactive-cost" })).totalCount).toBe(0);
    }
  } finally { db.close(); }
}, 120_000);

it("keeps due-date lateness separate from a missed window and terminal outcomes", () => {
  const fixture = buildNorthlinePresentationFixture(), base = { ...fixture.pmOccurrences[0], completedAt: undefined, windowStartsAt: "2026-08-20T12:00:00Z", dueAt: "2026-08-25T12:00:00Z", windowEndsAt: "2026-08-30T12:00:00Z", status: "scheduled" as const };
  expect(pmScheduleState(base, "2026-08-25T12:00:00Z")).toBe("due");
  expect(pmScheduleState(base, "2026-08-25T12:00:01Z")).toBe("overdue");
  expect(pmScheduleState(base, "2026-08-30T12:00:00Z")).toBe("overdue");
  expect(pmScheduleState(base, "2026-08-30T12:00:01Z")).toBe("missed");
  expect(pmScheduleState({ ...base, status: "cancelled" }, "2026-09-01T12:00:00Z")).toBe("cancelled");
  expect(pmScheduleState({ ...base, status: "waived" }, "2026-09-01T12:00:00Z")).toBe("waived");
  expect(pmScheduleState({ ...base, status: "completed_late", completedAt: "2026-09-01T12:00:00Z" }, "2026-09-01T12:00:00Z")).toBe("completed");
});
