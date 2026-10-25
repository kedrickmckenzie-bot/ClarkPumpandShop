import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { nextUp, nudgeWorkflowTask } from "@/lib/ops/nudge";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("records nudges on the job's history, once a day per person, and sends the item up after three", async () => {
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const task = fixture.workflowTasks.find(t => t.status === "open" && t.workOrderId && t.assigneeType === "role" && t.assigneeRole === "store_manager")!;
  expect(task).toBeDefined();
  const repository = createOpsFixtureRepository(fixture);
  let now = "2026-10-25T15:00:00.000Z";
  const svc = { repository, clock: { now: () => now } };
  const actor = (id: string, name: string) => ({ actorType: "user" as const, actorId: id, actorName: name, organizationId: org });
  const regional = actor("membership-northline-regional-1", "Dana Regional"), owner = actor("membership-northline-executive", "Owner Person");

  // The person it's waiting on can't nudge themselves.
  await expect(nudgeWorkflowTask(svc, { organizationId: org, workflowTaskId: task.id, actor: actor("membership-northline-store-101", "Store"), actorRole: "store_manager" })).rejects.toThrow(/yours/);
  expect(await nudgeWorkflowTask(svc, { organizationId: org, workflowTaskId: task.id, actor: regional, actorRole: "regional_manager" })).toEqual({ nudgeNumber: 1, escalatedTo: undefined });
  await expect(nudgeWorkflowTask(svc, { organizationId: org, workflowTaskId: task.id, actor: regional, actorRole: "regional_manager" })).rejects.toThrow(/already nudged this today/);
  now = "2026-10-25T15:05:00.000Z";
  expect((await nudgeWorkflowTask(svc, { organizationId: org, workflowTaskId: task.id, actor: owner, actorRole: "executive" })).nudgeNumber).toBe(2);
  now = "2026-10-26T15:30:00.000Z";
  const third = await nudgeWorkflowTask(svc, { organizationId: org, workflowTaskId: task.id, actor: regional, actorRole: "regional_manager" });
  expect(third).toEqual({ nudgeNumber: 3, escalatedTo: "Regional manager" });
  const after = await repository.getWorkflowTask(org, task.id);
  expect(after?.escalationDestination).toBe("Regional manager");
  expect(after?.escalationLevel).toBe(task.escalationLevel + 1);
  expect(nextUp(after!)).toBe("Facilities");

  // Recorded with the person's name on the job, and read the same way from SQL.
  const nudges = await repository.listWorkOrderNudges(org, [task.workOrderId!]);
  expect(nudges.map(n => n.actorName)).toEqual(["Dana Regional", "Owner Person", "Dana Regional"]);
  const saved = repository.snapshot();
  expect(saved.auditEvents.filter(e => e.aggregateId === task.workOrderId && e.eventType === "work_order.nudged")).toHaveLength(3);
  const db = new DatabaseSync(":memory:");
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read must not mutate"); } };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(saved)) db.prepare(statement.sql).run(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    expect(await createOpsSqlRepository(driver, "d1").listWorkOrderNudges(org, [task.workOrderId!])).toEqual(nudges);
  } finally { db.close(); }
}, 120_000);
