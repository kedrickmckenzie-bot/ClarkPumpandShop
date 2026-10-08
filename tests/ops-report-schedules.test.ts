import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements, seedOpsRepository } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { changeReportSchedule, createReportSchedule, deliverScheduledReport, nextRunAt, runReportScheduleCycle, runReportScheduleNow, scheduleLabel } from "@/lib/ops/reports/schedules";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { ActorContext, OpsFixture } from "@/lib/ops/types";
import type { TransactionalEmail } from "@/lib/ops/email-delivery";

const zone = "America/New_York";
const clock = (at: string) => ({ now: () => at });
let counter = 0;
const ids = { next: (prefix: string) => `${prefix}-t${++counter}` };

function sqlite(f: OpsFixture) {
  const db = new DatabaseSync(":memory:");
  const bind = (params: readonly unknown[]) => params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[];
  const driver: OpsSqlDriver = { dialect: "sqlite",
    async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...bind(statement.params)) as Row[], affectedRows: 0 }; },
    async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) db.prepare(s.sql).run(...bind(s.params)); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } } };
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(name => /^\d.*\.sql$/.test(name)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(f)) db.prepare(statement.sql).run(...bind(statement.params));
  return createOpsSqlRepository(driver, "d1");
}

const actorFor = (f: OpsFixture, role: string): ActorContext => {
  const membership = f.memberships.find(m => m.role === role)!;
  return { actorType: "user", actorId: membership.id, actorName: "Planner", organizationId: membership.organizationId };
};

async function scheduleScenario(repository: OpsRepository, f: OpsFixture) {
  const org = f.organizations[0]!.id, leader = actorFor(f, "facilities_admin"), store = actorFor(f, "store_manager"), owner = actorFor(f, "executive");
  const base = { organizationId: org, reportId: "owner-summary", options: { period: "last_month" as const, work: "both" as const, detail: "summary" as const }, sendHour: 7 };
  // Validation and access come before anything is saved.
  await expect(createReportSchedule({ repository }, { ...base, actor: leader, role: "facilities", frequency: "weekly", weekday: 1, recipients: [] })).rejects.toThrow(/at least one person/);
  await expect(createReportSchedule({ repository }, { ...base, actor: store, role: "store_manager", reportId: "vendor-ap", frequency: "weekly", weekday: 1, recipients: [store.actorId!] })).rejects.toThrow(/can't open/);
  await expect(createReportSchedule({ repository }, { ...base, actor: leader, role: "facilities", frequency: "monthly", monthDay: 31, recipients: [leader.actorId!] })).rejects.toThrow(/1 to 28/);
  await expect(createReportSchedule({ repository }, { ...base, actor: leader, role: "facilities", frequency: "weekly", weekday: 1, recipients: ["nobody"] })).rejects.toThrow(/no longer active/);

  const weekly = await createReportSchedule({ repository, clock: clock("2026-10-07T12:00:00.000Z"), ids }, { ...base, actor: leader, role: "facilities", frequency: "weekly", weekday: 1, recipients: [leader.actorId!, owner.actorId!] });
  expect(weekly.nextRunAt).toBe("2026-10-12T11:00:00.000Z"); // Monday 7 AM Eastern (daylight time)
  // A vendor-only report is locked to vendor work whatever the form sent.
  const ap = await createReportSchedule({ repository, clock: clock("2026-10-07T12:00:00.000Z"), ids }, { ...base, reportId: "vendor-ap", options: { ...base.options, work: "in_house" }, actor: leader, role: "facilities", frequency: "monthly", monthDay: 1, recipients: [leader.actorId!] });
  expect(ap.nextRunAt).toBe("2026-11-01T12:00:00.000Z"); // 7 AM Eastern after daylight time ends
  expect(JSON.parse((await repository.getReportSchedule(org, ap.id))!.optionsJson).work).toBe("vendor");
  expect(await repository.getReportSchedule("another-org", weekly.id)).toBeNull();
  expect((await repository.listReportSchedules(org)).map(s => s.id).sort()).toEqual([weekly.id, ap.id].sort());

  // Nothing is due before the send time; at the send time one run is saved and the schedule moves a week on.
  expect(await runReportScheduleCycle({ repository, clock: clock("2026-10-12T10:59:00.000Z"), ids })).toEqual({ due: 0, queued: 0, skipped: 0, failed: 0 });
  expect(await runReportScheduleCycle({ repository, clock: clock("2026-10-12T11:02:00.000Z"), ids })).toMatchObject({ due: 1, queued: 1 });
  expect(await runReportScheduleCycle({ repository, clock: clock("2026-10-12T11:03:00.000Z"), ids })).toMatchObject({ due: 0, queued: 0 });
  const runs = await repository.listReportRuns(org, 10);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ scheduleId: weekly.id, reportId: "owner-summary", runAt: "2026-10-12T11:00:00.000Z", periodLabel: "September 2026", deliveryStatus: "queued", recipientCount: 2 });
  expect((await repository.getReportSchedule(org, weekly.id))).toMatchObject({ nextRunAt: "2026-10-19T11:00:00.000Z", lastRunAt: "2026-10-12T11:00:00.000Z" });
  expect(await repository.getReportRun("another-org", runs[0]!.id)).toBeNull();

  // Without an email service the run stays saved and says so; with one, each person gets a link, never numbers.
  const message = { organizationId: org, id: "outbox-report", topic: "ops.report.scheduled", aggregateType: "report_run", aggregateId: runs[0]!.id, payloadJson: JSON.stringify({ runId: runs[0]!.id }), attemptCount: 0 };
  await deliverScheduledReport({ repository, provider: null, baseUrl: "https://ops.example.test" }, message);
  expect((await repository.getReportRun(org, runs[0]!.id))!.deliveryStatus).toBe("email_not_set_up");
  const sent: TransactionalEmail[] = [];
  await deliverScheduledReport({ repository, provider: { name: "fake", async send(email) { sent.push(email); return { messageId: email.idempotencyKey }; } }, baseUrl: "https://ops.example.test" }, message, "2026-10-12T11:05:00.000Z");
  expect(sent).toHaveLength(2);
  expect(sent[0]!.text).toContain(`https://ops.example.test/app/reports/runs/${runs[0]!.id}`);
  expect(sent.map(e => e.text).join(" ")).not.toMatch(/\$\d/);
  expect(await repository.getReportRun(org, runs[0]!.id)).toMatchObject({ deliveryStatus: "sent", deliveredAt: "2026-10-12T11:05:00.000Z" });

  // Only the maker or a leader may change a schedule; changes are version-fenced.
  const current = (await repository.getReportSchedule(org, weekly.id))!;
  await expect(changeReportSchedule({ repository }, { organizationId: org, actor: store, role: "store_manager", scheduleId: weekly.id, action: "remove", expectedVersion: current.version })).rejects.toThrow(/person who made/);
  await changeReportSchedule({ repository, clock: clock("2026-10-13T12:00:00.000Z"), ids }, { organizationId: org, actor: owner, role: "executive", scheduleId: weekly.id, action: "pause", expectedVersion: current.version });
  await expect(changeReportSchedule({ repository }, { organizationId: org, actor: leader, role: "facilities", scheduleId: weekly.id, action: "resume", expectedVersion: current.version })).rejects.toThrow(/changed/);
  expect(await runReportScheduleCycle({ repository, clock: clock("2026-10-20T12:00:00.000Z"), ids })).toMatchObject({ due: 0 });
  await changeReportSchedule({ repository, clock: clock("2026-10-20T12:00:00.000Z"), ids }, { organizationId: org, actor: leader, role: "facilities", scheduleId: weekly.id, action: "resume", expectedVersion: current.version + 1 });
  expect((await repository.getReportSchedule(org, weekly.id))!.nextRunAt).toBe("2026-10-26T11:00:00.000Z");

  // Send now saves a run without moving the regular schedule; removing keeps the record but hides it.
  const now = await runReportScheduleNow({ repository, clock: clock("2026-10-21T15:00:00.000Z"), ids }, { organizationId: org, actor: leader, role: "facilities", scheduleId: ap.id });
  expect(await repository.getReportRun(org, now.runId)).toMatchObject({ periodLabel: "September 2026", deliveryStatus: "queued" });
  expect((await repository.getReportSchedule(org, ap.id))!.nextRunAt).toBe("2026-11-01T12:00:00.000Z");
  await changeReportSchedule({ repository, clock: clock("2026-10-22T12:00:00.000Z"), ids }, { organizationId: org, actor: leader, role: "facilities", scheduleId: ap.id, action: "remove", expectedVersion: 0 });
  expect((await repository.listReportSchedules(org)).map(s => s.id)).toEqual([weekly.id]);
  expect((await repository.getReportSchedule(org, ap.id))!.status).toBe("removed");
}

describe("report schedules", () => {
  it("labels and next send times follow the organization's clock", () => {
    const s = { frequency: "weekly" as const, weekday: 1, monthDay: null, sendHour: 7, timeZone: zone };
    expect(scheduleLabel(s)).toBe("Every Monday at 7 AM");
    expect(scheduleLabel({ ...s, frequency: "monthly", monthDay: 2, sendHour: 15 })).toBe("Monthly on the 2nd at 3 PM");
    expect(nextRunAt(s, "2026-10-12T11:00:00.000Z")).toBe("2026-10-19T11:00:00.000Z");
    expect(nextRunAt(s, "2026-10-12T10:59:59.000Z")).toBe("2026-10-12T11:00:00.000Z");
    expect(nextRunAt({ ...s, frequency: "monthly", monthDay: 28 }, "2027-02-28T13:00:00.000Z")).toBe("2027-03-28T11:00:00.000Z");
  });
  it("works on the in-memory fixture", async () => { const f = buildNorthlinePresentationFixture(); await scheduleScenario(createOpsFixtureRepository(f), f); });
  it("works on D1 (SQLite) with the real migrations", async () => { const f = buildNorthlinePresentationFixture(); await scheduleScenario(sqlite(f), f); }, 60000);
});

const url = process.env.OPS_DISPATCH_TEST_DATABASE_URL;
describe.skipIf(!url)("report schedules on PostgreSQL", () => {
  let pool: Pool, databaseName = "", repository: OpsRepository;
  const f = buildNorthlinePresentationFixture();
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/dispatch_.*test$/.test(parsed.pathname)) throw new Error("Use an isolated localhost dispatch_*test database.");
    const admin = new Pool({ connectionString: url });
    databaseName = `dispatch_${crypto.randomUUID().replaceAll("-", "")}_test`;
    try { await admin.query(`CREATE DATABASE ${databaseName}`); } finally { await admin.end(); }
    parsed.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: parsed.toString(), max: 4 });
    for (const file of readdirSync("drizzle-postgres").filter(name => /^\d.*\.sql$/.test(name)).sort()) {
      for (const sql of readFileSync(`drizzle-postgres/${file}`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await pool.query(sql);
    }
    repository = createOpsPostgresRepository(pool);
    const seeded = structuredClone(f); seeded.outboxMessages = [];
    await seedOpsRepository(repository, seeded);
  }, 120000);
  afterAll(async () => { await pool?.end(); if (databaseName) { const cleanup = new Pool({ connectionString: url }); try { await cleanup.query(`DROP DATABASE ${databaseName}`); } finally { await cleanup.end(); } } });
  it("matches the fixture", async () => { await scheduleScenario(repository, f); }, 60000);
});
