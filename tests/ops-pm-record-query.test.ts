import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureReadRepository } from "@/lib/ops/fixture-repository";
import { readPmOccurrenceRecord, readPmPlanRecord, workVisitEvidenceFromFixture } from "@/lib/ops/pm-record-query";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("bounds PM visit evidence, preserves timestamp ties and rejects conflicting linked stores", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const occurrence = fixture.pmOccurrences.find(row => row.workOrderId && fixture.siteVisitWorkOrders.some(link => link.workOrderId === row.workOrderId))!;
  const work = fixture.workOrders.find(row => row.id === occurrence.workOrderId)!;
  const baseLink = fixture.siteVisitWorkOrders.find(row => row.workOrderId === work.id)!;
  const base = fixture.visits.find(row => row.id === baseLink.visitId)!;
  fixture.visits.push(...Array.from({ length: 230 }, (_, i) => ({ ...base, id: `pm-visit-density-${String(i).padStart(3, "0")}`, workOrderId: work.id, checkedInAt: i % 2 ? "2026-08-25T11:00:00.123-04:00" : "2026-08-25T15:00:00.123Z", checkedOutAt: "2026-08-25T16:00:00.000Z" })));
  fixture.siteVisitWorkOrders.push(...Array.from({ length: 230 }, (_, i) => ({ ...baseLink, id: `pm-link-density-${i}`, visitId: `pm-visit-density-${String(i).padStart(3, "0")}`, ordinal: 1, outcomeRecordedAt: "2026-08-25T16:00:00.000Z" })));
  const db = new DatabaseSync(":memory:"), returned: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[]; returned.push(rows.length); return { rows, affectedRows: 0 }; }, async atomic() { throw new Error("Read must not mutate"); } };
  const repository = createOpsSqlRepository(driver, "d1"), scope = { organizationId };
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const ids: string[] = []; let offset = 0, total = 0;
    do {
      const query = { limit: 25, offset }, page = await repository.listWorkVisitEvidence(scope, work.id, query);
      expect(page).toEqual(workVisitEvidenceFromFixture(fixture, scope, work.id, query));
      total = page.totalCount; ids.push(...page.items.map(row => row.id));
      if (page.nextOffset === undefined) break;
      offset = page.nextOffset;
      if (offset > 1000) throw new Error("Page did not advance");
    } while (offset <= 1000);
    expect(ids.length).toBe(total); expect(new Set(ids).size).toBe(total);
    expect(ids.filter(id => id.startsWith("pm-visit-density-"))).toEqual(Array.from({ length: 230 }, (_, i) => `pm-visit-density-${String(i).padStart(3, "0")}`));
    expect(await repository.listWorkVisitEvidence(scope, work.id, { offset: 10000 })).toMatchObject({ items: [], totalCount: total });
    expect(Math.max(...returned)).toBeLessThanOrEqual(25);

    // These invalid historical links exist only in the disposable corruption fixture.
    const other = fixture.stores.find(row => row.id !== work.storeId)!;
    const otherPlan = fixture.pmPlans.find(row => row.storeId === other.id)!;
    const otherAsset = fixture.assets.find(row => row.storeId === other.id)!;
    const otherWork = fixture.workOrders.find(row => row.storeId === other.id)!;
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("UPDATE ops_pm_occurrences SET plan_id=?, asset_id=?, work_order_id=? WHERE id=?").run(otherPlan.id, otherAsset.id, otherWork.id, occurrence.id);
    const corrupted = await readPmOccurrenceRecord(repository, scope, occurrence.id);
    expect(corrupted).toMatchObject({ plan: null, asset: null, work: null });
    db.prepare("UPDATE ops_pm_plans SET asset_id=?, program_id=NULL WHERE id=?").run(otherAsset.id, occurrence.planId);
    expect((await readPmPlanRecord(repository, scope, occurrence.planId))?.asset).toBeNull();
    db.prepare("UPDATE ops_visit_sessions SET store_id=? WHERE id=?").run(other.id, "pm-visit-density-000");
    expect((await repository.listWorkVisitEvidence(scope, work.id, { offset: 10000 })).totalCount).toBe(total - 1);
    for (const badScope of [{ organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId, storeIds: [other.id] }, { organizationId: "foreign" }]) {
      expect(await readPmOccurrenceRecord(repository, badScope, occurrence.id)).toBeNull();
      expect((await repository.listWorkVisitEvidence(badScope, work.id)).totalCount).toBe(0);
    }
  } finally { db.close(); }
}, 120_000);

it("checks parent scope before resolving PM links and preserves asset-free records", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const occurrence = fixture.pmOccurrences.find(row => row.workOrderId)!;
  const repository = createOpsFixtureReadRepository(fixture);
  const readPlan = vi.spyOn(repository, "getPmPlan"), readAsset = vi.spyOn(repository, "getAsset"), readWork = vi.spyOn(repository, "getWorkOrder");
  expect(await readPmOccurrenceRecord(repository, { organizationId, storeIds: [] }, occurrence.id)).toBeNull();
  expect(readPlan).not.toHaveBeenCalled(); expect(readAsset).not.toHaveBeenCalled(); expect(readWork).not.toHaveBeenCalled();
  const plan = fixture.pmPlans.find(row => row.id === occurrence.planId)!;
  occurrence.assetId = undefined; plan.assetId = undefined;
  const record = await readPmOccurrenceRecord(createOpsFixtureReadRepository(fixture), { organizationId }, occurrence.id);
  expect(record?.asset).toBeNull(); expect(record?.plan?.id).toBe(plan.id);
});
