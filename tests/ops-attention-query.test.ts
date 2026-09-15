import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { queryAttention } from "@/lib/ops/attention-sql";
import { attentionFromFixture, type AttentionQueueRow } from "@/lib/ops/attention-query";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import { buildDashboardModel } from "@/app/app/_data/operator-presenter";
import { dashboardActivityFromFixture, rollingYearStart } from "@/lib/ops/dashboard-query";
import { attentionAccess } from "@/app/app/_data/attention-presenter";
import * as projection from "@/lib/ops/attention-projection";
import type { OperatorSession } from "@/components/ops/data-contract";

it("pages more than 200 same-deadline obligations without omission, duplicate identity, or unbounded returned rows", async () => {
  const fixture = buildNorthlinePresentationFixture();
  const base = fixture.workflowTasks.find(row => row.workOrderId && row.status === "open")!;
  fixture.workflowTasks.push(...Array.from({ length: 225 }, (_, index) => ({ ...base, id: `attention-density-${String(index).padStart(3, "0")}`, taskType: "schedule_service" as const, blocking: false, requiredForProgress: false, sourceFollowUpId: undefined, sourceApprovalRequestId: undefined, dueAt: index % 2 ? fixture.asOf.replace(".000Z", "Z") : fixture.asOf, priority: "normal" as const })));
  const db = new DatabaseSync(":memory:");
  let queries = 0;
  const returned: number[] = [];
  const driver: OpsSqlDriver = {
    dialect: "sqlite",
    async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
      queries++;
      const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];
      returned.push(rows.length);
      return { rows, affectedRows: 0 };
    },
    async atomic() { throw new Error("Read-only query must not write"); },
  };
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const scope = { organizationId: fixture.organizations[0].id };
    const access = { role: "facilities_admin" as const, canOpenRequest: true, canOpenWarranty: true };
    const rows: AttentionQueueRow[] = [];
    let cursor: string | undefined;
    let count = 0;
    do {
      const page = await queryAttention(driver, scope, access, { asOf: fixture.asOf, limit: 17, cursor });
      count = page.totalCount;
      expect(page.items.length).toBeLessThanOrEqual(17);
      rows.push(...page.items);
      cursor = page.nextCursor;
      if (queries > 30) throw new Error("Page cursor failed to advance");
    } while (cursor);
    expect(count).toBeGreaterThan(225);
    expect(rows).toHaveLength(count);
    expect(new Set(rows.map(row => row.id)).size).toBe(count);
    expect(rows.filter(row => row.id.startsWith("attention-density-")).map(row => row.id)).toEqual(Array.from({ length: 225 }, (_, index) => `attention-density-${String(index).padStart(3, "0")}`));
    expect(Math.max(...returned)).toBeLessThanOrEqual(18);
    expect(rows.slice(0, 100)).toEqual(attentionFromFixture(fixture, scope, access, { asOf: fixture.asOf, limit: 100 }).items);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally { db.close(); }
}, 120_000);

it.each(["facilities", "executive", "regional", "store_manager", "finance"] as const)("renders prepared %s dashboard counts without recomputing the attention population", role => {
  const fixture = buildNorthlinePresentationFixture();
  const store = fixture.stores.find(row => row.storeNumber === "104")!;
  const session = { role, organizationId: fixture.organizations[0].id, storeIds: role === "store_manager" ? [store.id] : undefined, regionIds: role === "regional" ? [store.regionId!] : undefined, scopeLabel: "Test scope", demoEdition: "complete" } as OperatorSession;
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const activity = dashboardActivityFromFixture(fixture, scope, { asOf: fixture.asOf, costFrom: rollingYearStart(fixture.asOf), costTo: fixture.asOf.slice(0, 10), currency: "USD" });
  const attention = attentionFromFixture(fixture, scope, attentionAccess(session), { asOf: fixture.asOf, limit: 7 });
  const expected = buildDashboardModel(fixture, session);
  const spy = vi.spyOn(projection, "projectAttentionItems").mockImplementation(() => { throw new Error("Dashboard rebuilt the review population"); });
  try { expect(buildDashboardModel(fixture, session, { activity, attention })).toEqual(expected); expect(spy).not.toHaveBeenCalled(); }
  finally { spy.mockRestore(); }
});
