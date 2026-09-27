import { describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { equipmentIssuesFromFixture, equipmentIssueHistoryHref } from "@/lib/ops/equipment-issues";
import { rollingYearStart } from "@/lib/ops/dashboard-query";
import { buildEquipmentReview } from "@/app/app/_data/equipment-review";
import { buildEquipmentIssueRanking } from "@/app/app/_data/equipment-issues-presenter";
import { recordedMoneyLabel } from "@/lib/ops/work-review";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

const fixture = () => buildNorthlinePresentationFixture();
const data = fixture();
const window = { asOf: data.asOf, costFrom: rollingYearStart(data.asOf), costTo: data.asOf.slice(0, 10), currency: "USD" };
const scope = { organizationId: data.organizations[0].id };
const session: OperatorSession = { ...scope, userId: "test", displayName: "Manager", email: "test@example.test", organizationName: "Demo", scopeLabel: "All stores", role: "facilities", demoEdition: "complete" };

describe("equipment issue ranking and its exact history", () => {
  it("counts distinct unplanned jobs, excludes PM/cancelled/future work and does not multiply costs or visits", () => {
    const f = fixture(), asset = f.assets.find(a => a.id === "asset-104-walk-in") ?? f.assets[0];
    const work = f.workOrders.find(w => w.assetId === asset.id)!;
    f.workOrders = Array.from({ length: 7 }, (_, i) => ({ ...work, id: `issue-${i}`, assetId: asset.id, storeId: asset.storeId, priority: i === 2 ? "planned" as const : "routine" as const, status: i === 3 ? "cancelled" as const : "closed" as const, createdAt: i === 4 ? "2020-01-01T12:00:00Z" : i === 5 ? "2099-01-01T12:00:00Z" : `${window.costTo}T12:00:00Z` }));
    f.pmOccurrences = [{ ...f.pmOccurrences[0], workOrderId: "issue-6" }];
    const cost = f.costLines[0];
    f.costLines = [
      { ...cost, id: "a", workOrderId: "issue-0", serviceDate: window.costTo, amount: { amountMinor: 10025, currency: "USD" } },
      { ...cost, id: "b", workOrderId: "issue-0", serviceDate: window.costTo, amount: { amountMinor: 20025, currency: "USD" } },
      { ...cost, id: "c", workOrderId: "issue-1", serviceDate: window.costTo, amount: { amountMinor: 9900, currency: "CAD" } },
      { ...cost, id: "d", workOrderId: "issue-0", serviceDate: "2099-01-01", amount: { amountMinor: 999999, currency: "USD" } },
      { ...cost, id: "e", organizationId: "foreign", workOrderId: "issue-0", serviceDate: window.costTo, amount: { amountMinor: 999999, currency: "USD" } },
    ];
    const result = equipmentIssuesFromFixture(f, scope, window);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ issueCount: 2, recordedCostMinor: 30050, costWorkCount: 1 });
    const params = Object.fromEntries(new URL(equipmentIssueHistoryHref(asset.id, window), "https://test.invalid").searchParams);
    const review = buildEquipmentReview(f, session, asset.id, params)!;
    expect(review.rows.map(w => w.id).sort()).toEqual(["issue-0", "issue-1"]);
    expect(review.workCost).toBe("$300.50");
    expect(review.decisionHref).toContain(`decision=${asset.id}`);
    expect(buildEquipmentReview(f, { ...session, role: "store_manager", storeIds: [asset.storeId] }, asset.id, params)?.decisionHref).toBeUndefined();
    expect(buildEquipmentReview(f, { ...session, storeIds: [] }, asset.id, params)).toBeNull();
  });

  it("reconciles every ranking amount/count to its paginated asset history with the exact window", () => {
    const f = fixture();
    for (const row of equipmentIssuesFromFixture(f, scope, window, { limit: 100 }).items) {
      const params = Object.fromEntries(new URL(equipmentIssueHistoryHref(row.id, window), "https://test.invalid").searchParams);
      const history = buildEquipmentReview(f, session, row.id, params)!;
      expect(history.rowCount).toBe(row.issueCount);
      expect(history.workCost).toBe(row.costWorkCount ? recordedMoneyLabel([{ amountMinor: row.recordedCostMinor, currency: "USD" }]) : "No amounts recorded");
      expect(history.rankingHref).toContain(`issueFrom=${window.costFrom}`);
      expect(history.allHistoryHref).not.toContain("cohort=");
      for (const page of history.pages) expect(page.href).toContain(`issueFrom=${window.costFrom}`);
    }
  });

  it("runs bounded SQLite queries with identical ranks, pagination, empty/foreign scopes and costs", async () => {
    const f = fixture(), db = new DatabaseSync(":memory:");
    f.costLines.push({ ...f.costLines[0], id: "extra-cost-line-for-count-regression" });
    const sizes: number[] = [];
    const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
      const rows = db.prepare(statement.sql).all(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]) as Row[];
      sizes.push(rows.length); return { rows, affectedRows: 0 };
    }, async atomic() { throw new Error("read only"); } };
    try {
      db.exec("PRAGMA foreign_keys=ON");
      for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
      for (const statement of buildOpsSeedStatements(f)) db.prepare(statement.sql).run(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
      // Change priority after issuance; the original authorization stays immutable.
      const pm = f.pmOccurrences.find(p => p.workOrderId)!;
      f.workOrders.find(w => w.id === pm.workOrderId)!.priority = "routine";
      db.prepare("UPDATE ops_work_orders SET priority='routine' WHERE organization_id=? AND id=?").run(scope.organizationId, pm.workOrderId!);
      const repository = createOpsSqlRepository(driver, "d1");
      for (const selected of [scope, { ...scope, storeIds: [f.stores[0].id] }, { ...scope, regionIds: [f.regions[0].id] }, { ...scope, storeIds: [] }, { organizationId: "foreign" }]) {
        for (const offset of [0, 5, 10000]) expect(await repository.listEquipmentIssues(selected, window, { limit: 5, offset })).toEqual(equipmentIssuesFromFixture(f, selected, window, { limit: 5, offset }));
      }
      expect(sizes.every(n => n <= 5)).toBe(true);
    } finally { db.close(); }
  });

  it("preserves dates through full-ranking pages and rejects invalid windows", async () => {
    const f = fixture();
    const asset = f.assets[0], work = f.workOrders.find(w => w.assetId === asset.id)!;
    for (let i = 0; i < 30; i++) {
      f.assets.push({ ...asset, id: `page-asset-${i}`, assetTag: `PAGE-${i}` });
      f.workOrders.push({ ...work, id: `page-work-${i}`, number: `PAGE-${i}`, assetId: `page-asset-${i}`, priority: "routine", status: "closed", createdAt: `${window.costTo}T12:00:00Z` });
    }
    const repository = createOpsFixtureRepository(f);
    const model = await buildEquipmentIssueRanking(repository, session, { page: "2" }, window.asOf);
    expect(model.table.rows).toHaveLength(25);
    expect(model.pagination?.previousHref).toContain(`issueFrom=${window.costFrom}`);
    expect(model.table.rows.every(row => row.href.includes("cohort=issues"))).toBe(true);
    const firstPage = await buildEquipmentIssueRanking(repository, session, {}, window.asOf);
    expect(model.table.rows.some(row => firstPage.table.rows.some(other => other.id === row.id))).toBe(false);
    expect((await buildEquipmentIssueRanking(repository, session, { issueFrom: "invalid" }, window.asOf)).state.kind).toBe("error");
    expect(buildEquipmentReview(f, session, asset.id, { cohort: "issues", issueFrom: "invalid" })?.rows).toEqual([]);
  });
});
