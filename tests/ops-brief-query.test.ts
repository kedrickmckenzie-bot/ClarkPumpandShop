import { expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { briefSourcesFromFixture, type BriefSource, type BriefSourceQuery } from "@/lib/ops/owner-brief-query";
import { queryBriefSources } from "@/lib/ops/owner-brief-sql";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { ValueEvent } from "@/lib/ops/types";

it("keeps exact period/currency/source totals while paging dense decisions and rejecting conflicting references", async () => {
  const fixture = buildNorthlinePresentationFixture();
  const seedStatements = buildOpsSeedStatements(fixture);
  const organizationId = fixture.organizations[0].id, store = fixture.stores[0];
  const work = fixture.workOrders.find(row => row.storeId === store.id)!;
  const other = fixture.workOrders.find(row => row.storeId !== store.id)!;
  const scope = { organizationId, storeIds: [store.id] };
  const period = { from: "2026-07-27", to: "2026-08-25", asOf: fixture.asOf, currency: "USD" };
  fixture.costLines = [
    { ...fixture.costLines[0], id: "brief-cost-first-day", workOrderId: work.id, serviceDate: period.from, amount: { amountMinor: 12345, currency: "USD" } },
    { ...fixture.costLines[0], id: "brief-cost-next-day", workOrderId: work.id, serviceDate: "2026-08-26", amount: { amountMinor: 999999, currency: "USD" } },
    { ...fixture.costLines[0], id: "brief-cost-cad", workOrderId: work.id, serviceDate: period.from, amount: { amountMinor: 9999, currency: "CAD" } },
  ];
  const value = (id: string, refs: Partial<ValueEvent>): ValueEvent => ({ id, organizationId, category: "realized_verified", eventType: "credit_confirmed", amount: { amountMinor: 100, currency: "USD" }, sourceDecision: id, deduplicationKey: id, occurredAt: `${period.from}T12:00:00Z`, ...refs });
  fixture.valueEvents = [value("visible-credit", { workOrderId: work.id }), value("foreign-work-credit", { workOrderId: other.id }), value("unattributed-credit", {}), value("conflicting-credit", { workOrderId: work.id, warrantyCaseId: fixture.warrantyCases.find(row => row.workOrderId !== work.id)!.id }), value("missing-reference-credit", { workOrderId: work.id, approvalDecisionId: "missing" })];
  fixture.workflowTasks = Array.from({ length: 230 }, (_, index) => ({ ...fixture.workflowTasks.find(row => row.status === "open")!, id: `brief-task-${String(index).padStart(3, "0")}`, workOrderId: work.id, serviceRequestId: undefined, sourceFollowUpId: undefined, sourceApprovalRequestId: undefined, sourceApprovalDecisionId: undefined, taskType: "approve_quote", status: "open", escalationLevel: 2, dueAt: index % 2 ? "2026-08-25T12:00:00-04:00" : "2026-08-25T16:00:00.000Z" }));
  fixture.lifecycleRecommendations = [];
  const pm = fixture.pmOccurrences.find(row => row.storeId === store.id)!;
  fixture.pmOccurrences = [
    { ...pm, id: "brief-pm-on-time", recurrenceKey: "brief-on-time", dueAt: "2026-08-01T12:00:00Z", windowStartsAt: "2026-08-01T12:00:00Z", windowEndsAt: "2026-08-02T12:00:00Z", completedAt: "2026-08-02T08:00:00-04:00", status: "completed" },
    { ...pm, id: "brief-pm-missed", recurrenceKey: "brief-missed", dueAt: "2026-08-01T12:00:00Z", windowStartsAt: "2026-08-01T12:00:00Z", windowEndsAt: "2026-08-02T12:00:00Z", completedAt: undefined, status: "due" },
  ];
  const db = new DatabaseSync(":memory:"); const returnedRows: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
    const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];
    returnedRows.push(rows.length); return { rows, affectedRows: 0 };
  }, async atomic() { throw new Error("Read-only check"); } };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of seedStatements) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    // Deliberately malformed cross-record references exercise the read boundary.
    // Keep them out of the valid presentation seeder and this isolated database only.
    db.exec("PRAGMA foreign_keys=OFF");
    for (const [table, rows] of [
      ["ops_cost_lines", fixture.costLines], ["ops_value_events", fixture.valueEvents],
      ["ops_workflow_tasks", fixture.workflowTasks], ["ops_pm_occurrences", fixture.pmOccurrences],
      ["ops_lifecycle_recommendations", fixture.lifecycleRecommendations],
    ] as const) {
      const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name)));
      db.exec(`DELETE FROM ${table}`);
      for (const row of rows) {
        const entries = Object.entries(row).flatMap(([key, value]) => key === "amount" ? Object.entries({ amount_minor: (value as { amountMinor: number }).amountMinor, currency: (value as { currency: string }).currency }) : [[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]]).filter(([key]) => columns.has(String(key)));
        db.prepare(`INSERT INTO ${table} (${entries.map(([key]) => key).join(",")}) VALUES (${entries.map(() => "?").join(",")})`).run(...entries.map(([, value]) => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
      }
    }
    for (const kind of ["recorded_cost", "verified_value", "pm", "decisions", "stores"] as BriefSource[]) {
      const query = { kind, limit: 25 };
      expect(await queryBriefSources(driver, scope, period, query)).toEqual(briefSourcesFromFixture(fixture, scope, period, query));
    }
    expect((await queryBriefSources(driver, scope, period, { kind: "recorded_cost" })).totalAmountMinor).toBe(12345);
    expect((await queryBriefSources(driver, scope, { ...period, currency: "CAD" }, { kind: "recorded_cost" })).totalAmountMinor).toBe(9999);
    expect((await queryBriefSources(driver, scope, period, { kind: "verified_value" })).items.map(row => row.id)).toEqual(["visible-credit"]);
    expect((await queryBriefSources(driver, { organizationId }, period, { kind: "verified_value", storeId: store.id })).totalAmountMinor).toBe(100);
    const statuses = (await queryBriefSources(driver, scope, period, { kind: "pm" })).statuses;
    expect(statuses).toMatchObject({ completed_on_time: 1, missed: 1 });
    const ids: string[] = [];
    let offset: number | undefined = 0;
    while (offset !== undefined) {
      const query: BriefSourceQuery = { kind: "decisions", offset, limit: 25 };
      const page = await queryBriefSources(driver, scope, period, query);
      expect(page).toEqual(briefSourcesFromFixture(fixture, scope, period, query));
      expect(page.totalCount).toBe(230); ids.push(...page.items.map(row => row.id)); offset = page.nextOffset;
    }
    expect(new Set(ids).size).toBe(230); expect(ids).toEqual([...ids].sort());
    expect(Math.max(...returnedRows)).toBeLessThanOrEqual(26);
  } finally { db.close(); }
});
