import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createWorkOrder, createFollowUp, updateWorkOrderControl, recordWorkOrderNote, type OpsCommandServices } from "@/lib/ops/commands";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import { selectPrimaryWorkflowTask } from "@/lib/ops/workflow-task-commands";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { OpsRepository } from "@/lib/ops/repository";
import { workListNavigation } from "@/lib/ops/work-list-navigation";

vi.mock("server-only", () => ({}));
const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
const fixture = buildNorthlinePresentationFixture();
const memory = createOpsFixtureRepository(fixture);
const db = new DatabaseSync(":memory:");
const params = (values: readonly unknown[]) => values.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[];
const driver: OpsSqlDriver = {
  dialect: "sqlite",
  async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...params(statement.params)) as Row[], affectedRows: 0 }; },
  async atomic(statements) { db.exec("BEGIN"); try { for (const statement of statements) db.prepare(statement.sql).run(...params(statement.params)); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } },
};
const sql = createOpsSqlRepository(driver, "d1");
beforeAll(() => {
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...params(statement.params));
});
afterAll(() => db.close());
let sequence = 0;
function services(repository: OpsRepository): OpsCommandServices { return { repository, clock: { now: () => "2026-08-26T12:00:00.000Z" }, ids: { next: prefix => `${prefix}-simple-${++sequence}` } }; }
async function basic(repository: OpsRepository) {
  return createWorkOrder(services(repository), { organizationId: actor.organizationId, storeId: "store-northline-104", problem: "Back room door latch sticks", accountableParty: "Facilities coordinator", nextAction: "Call the store", actor });
}

for (const [name, repository] of [["fixture", memory], ["SQLite", sql]] as const) describe(`${name}: optional adoption`, () => {
  it("creates, updates and closes basic work without equipment, vendor, visit or invoice", async () => {
    const work = await basic(repository);
    await updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: work.status, nextAction: "Call Casey after lunch", dueAt: "2026-08-27T17:00:00.000Z", note: "Phone update: Casey will check the latch", actor });
    const current = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    expect(selectPrimaryWorkflowTask(await repository.listWorkflowTasksForWorkOrder(actor.organizationId, work.id))).toMatchObject({ title: current.nextAction, dueAt: current.dueAt });
    await expect(updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: work.status, note: "Stale duplicate", actor })).rejects.toMatchObject({ code: "CONFLICT" });
    const closed = await updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: current.status, expectedVersion: persistedWorkOrderVersion(current), status: "closed", manualCompletion: { source: "phone", confirmedBy: "Casey, store manager" }, note: "Casey confirmed the latch now works", actor });
    expect(closed.status).toBe("closed");
    const detail = await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id);
    expect(detail?.visits).toEqual([]);
    expect(await repository.listWorkOrderVerifications(actor.organizationId, work.id)).toEqual([]);
    expect((await repository.listWorkflowTasksForWorkOrder(actor.organizationId, work.id)).every(task => !["open", "in_progress"].includes(task.status))).toBe(true);
  });
  it("records notes without altering accountability and rejects stale notes", async () => {
    const work = await basic(repository);
    const input = { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(work), note: "Email update: store says latch still sticks", actor };
    await recordWorkOrderNote(services(repository), input);
    const current = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    expect(current).toMatchObject({ status: work.status, accountableParty: work.accountableParty, nextAction: work.nextAction, dueAt: work.dueAt });
    expect(persistedWorkOrderVersion(current)).toBe(persistedWorkOrderVersion(work) + 1);
    await expect(recordWorkOrderNote(services(repository), input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("reconciles missing-cost filters against the same full scoped cohort", async () => {
    const scope = { organizationId: actor.organizationId, storeIds: ["store-northline-104"] };
    const query = { currency: "USD" as const, limit: 100 };
    const all = await repository.listWorkOrders(scope, query);
    const withCost = await repository.listWorkOrders(scope, { ...query, hasCost: true });
    const withoutCost = await repository.listWorkOrders(scope, { ...query, hasCost: false });
    expect(withCost.items.length + withoutCost.items.length).toBe(all.items.length);
    expect(withCost.items.every(row => row.recordedCostLineCount! > 0)).toBe(true);
    expect(withoutCost.items.every(row => row.recordedCostLineCount === 0)).toBe(true);
    expect(withoutCost.items.length).toBeGreaterThan(0);
  });
  it("keeps unresolved follow-ups and observed visit verification gates", async () => {
    const work = await basic(repository);
    await createFollowUp(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, accountableParty: "Facilities coordinator", nextAction: "Confirm parts delivery", dueAt: "2026-08-28T17:00:00.000Z", escalationTo: "Facilities director", actor });
    for (const id of [work.id, "wo-northline-112"]) {
      const current = (await repository.getWorkOrder(actor.organizationId, id))!;
      await expect(updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: id, expectedStatus: current.status, expectedVersion: persistedWorkOrderVersion(current), status: "closed", manualCompletion: { source: "phone", confirmedBy: "Casey" }, note: "Attempt premature closure", actor })).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await repository.getWorkOrder(actor.organizationId, id))?.status).toBe(current.status);
    }
  });
  it("rejects manual closure by a store user and across organizations", async () => {
    const work = await basic(repository);
    const input = { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: "closed" as const, manualCompletion: { source: "email" as const, confirmedBy: "Casey" }, note: "Confirmed result", actor };
    await expect(updateWorkOrderControl(services(repository), { ...input, actor: { ...actor, actorId: "membership-northline-store-104" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateWorkOrderControl(services(repository), { ...input, organizationId: "other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("scopes due-work reads and distinguishes missing from zero cost", async () => {
    const scope = { organizationId: actor.organizationId, storeIds: ["store-northline-104"] };
    const rows = await repository.listWorkOrders(scope, { dueBefore: fixture.asOf, statuses: ["approved", "issued", "waiting_on_parts"], limit: 100, currency: "USD" });
    expect(rows.items.length).toBeGreaterThan(0);
    expect(rows.items.every(row => row.storeId === scope.storeIds[0] && row.dueAt! <= fixture.asOf)).toBe(true);
    expect(rows.items.some(row => row.recordedCostLineCount === 0)).toBe(true);
    expect((await repository.listWorkOrders({ organizationId: "other" }, { dueBefore: fixture.asOf })).items).toEqual([]);
  });
});

it("keeps store, period and search when switching everyday queues", () => {
  for (const view of workListNavigation({ store: "104", costFrom: "2026-01-01", q: "cooler", stage: "not-sent", page: "3" })) {
    const query = new URL(view.href, "https://example.test").searchParams;
    expect(query.get("store")).toBe("104"); expect(query.get("costFrom")).toBe("2026-01-01"); expect(query.get("q")).toBe("cooler"); expect(query.has("page")).toBe(false); expect(query.has("stage")).toBe(false);
  }
});
