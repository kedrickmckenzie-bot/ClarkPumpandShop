import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements, seedOpsRepository } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { SINCE_KINDS, fixedAt, markOverviewSeen, matchesSince, sinceHref, sinceStartFor, sinceWindowFromQuery, type SinceWindow } from "@/lib/ops/since-last-looked";
import { equipmentIssuesFromFixture, repeatProblemWindow, REPEAT_DAYS } from "@/lib/ops/equipment-issues";
import { REPEAT_WORK_MIN_JOBS } from "@/lib/ops/replacement-intelligence";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { ActorContext, OpsFixture } from "@/lib/ops/types";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** The presentation data plus a vendor decline in the window (a source fact only, so seeding stays valid). */
function changedFixture() {
  const f = buildNorthlinePresentationFixture();
  // The window reaches back to the latest job that left limbo, so every kind has source records.
  const to = f.asOf, inside = iso(Date.parse(to) - 2 * DAY);
  const done = f.workOrders.filter(w => matchesSince(f, w, { kind: "fixed", from: "2000-01-01T00:00:00.000Z", to })).map(w => fixedAt(w)!).sort().at(-1)!;
  const from = iso(Math.min(Date.parse(to) - 30 * DAY, Date.parse(done) - DAY));
  const response = f.vendorResponses[0]!;
  f.vendorResponses.push({ ...response, id: "since-declined", response: "declined", respondedAt: inside, proposedAt: undefined });
  return { f, from, to };
}

/** Fixture-only edge cases (no seeding): ends of the window and cancelled work. */
function edgeFixture() {
  const { f, from, to } = changedFixture();
  const isOpen = (status: string) => !["completed_pending_review", "resolved", "closed", "cancelled"].includes(status);
  const open = f.workOrders.filter(w => isOpen(w.status));
  Object.assign(open[0]!, { priority: "urgent", createdAt: iso(Date.parse(to) - DAY) });
  Object.assign(open[1]!, { priority: "emergency", createdAt: to });
  Object.assign(open[2]!, { priority: "urgent", createdAt: from });
  Object.assign(open[3]!, { dueAt: iso(Date.parse(to) - DAY) });
  Object.assign(open[4]!, { dueAt: from });
  const cancelled = f.workOrders.find(w => w.status === "cancelled");
  if (cancelled) Object.assign(cancelled, { priority: "urgent", createdAt: iso(Date.parse(to) - DAY) });
  // Fixed only once out of limbo. Each of these has a "completed" result reported inside the window.
  const reported = (work: typeof open[number]) => { (f.workResults ??= []).push({ id: `result-${work.id}`, organizationId: work.organizationId, workOrderId: work.id, linkedAt: from, performerName: "Tech", source: "technician_report", outcome: "completed", outcomeRecordedAt: iso(Date.parse(to) - 3 * DAY), outcomeRecordedByActorType: "user", outcomeRecordedByActorName: "Tech", cycleVersion: 1 }); };
  const limbo = open[5]!, confirmed = open[6]!, selfClosed = open[7]!, selfClosedWaiting = open[8]!;
  [limbo, confirmed, selfClosed, selfClosedWaiting].forEach(reported);
  Object.assign(limbo, { status: "completed_pending_review", requireConfirmation: true, resolvedAt: undefined, closedAt: undefined });
  Object.assign(confirmed, { status: "resolved", requireConfirmation: true, resolvedAt: iso(Date.parse(to) - DAY), closedAt: undefined });
  Object.assign(selfClosed, { status: "closed", requireConfirmation: false, resolvedAt: undefined, closedAt: iso(Date.parse(to) - DAY) });
  Object.assign(selfClosedWaiting, { status: "resolved", requireConfirmation: false, resolvedAt: undefined, closedAt: undefined });
  return { f, from, to, edges: { inside: open[0]!.id, atNow: open[1]!.id, atLastLook: open[2]!.id, overdue: open[3]!.id, overdueAtLastLook: open[4]!.id, cancelled: cancelled?.id,
    limbo: limbo.id, confirmed: confirmed.id, selfClosed: selfClosed.id, selfClosedWaiting: selfClosedWaiting.id } };
}

async function compare(repository: OpsRepository, f: OpsFixture, scope: OrganizationScope, from: string, to: string) {
  const reference = createOpsFixtureRepository(structuredClone(f));
  for (const kind of SINCE_KINDS) {
    const change: SinceWindow = { kind, from, to };
    const expected = f.workOrders.filter(w => w.organizationId === scope.organizationId && (!scope.storeIds || scope.storeIds.includes(w.storeId)) && matchesSince(f, w, change)).map(w => w.id).sort();
    const list = await reference.listWorkOrders(scope, { change, limit: 100 });
    expect(list.items.map(w => w.id).sort()).toEqual(expected);
    expect(await reference.countWorkOrders(scope, { change })).toBe(expected.length);
    const sqlList = await repository.listWorkOrders(scope, { change, limit: 100 });
    expect(sqlList.items.map(w => w.id).sort(), kind).toEqual(expected);
    expect(sqlList.totalCount).toBe(expected.length);
    expect(await repository.countWorkOrders(scope, { change }), kind).toBe(expected.length);
    if (!scope.storeIds && scope.organizationId === f.organizations[0]!.id) expect(expected.length, `${kind} has source records`).toBeGreaterThan(0);
  }
}

function sqlite(f: OpsFixture) {
  const db = new DatabaseSync(":memory:");
  const run = (sql: string, params: readonly unknown[]) => db.prepare(sql).run(...params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
  const driver: OpsSqlDriver = { dialect: "sqlite",
    async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]) as Row[], affectedRows: 0 }; },
    async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) run(s.sql, s.params); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } } };
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(name => /^\d.*\.sql$/.test(name)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(f)) run(statement.sql, statement.params);
  return { db, repository: createOpsSqlRepository(driver, "d1") };
}

const actorFor = (f: OpsFixture, role = "facilities_manager"): ActorContext => {
  const membership = f.memberships.find(m => m.role === role) ?? f.memberships[0]!;
  return { actorType: "user", actorId: membership.id, actorName: "Manager", organizationId: membership.organizationId };
};

async function markSeenScenario(repository: OpsRepository, f: OpsFixture) {
  const org = f.organizations[0]!.id, actor = actorFor(f), other = f.memberships.find(m => m.organizationId === org && m.id !== actor.actorId)!;
  expect(await repository.getOverviewSeenAt(org, actor.actorId!)).toBeUndefined();
  await markOverviewSeen({ repository, clock: { now: () => "2026-10-01T10:00:00.000Z" } }, { organizationId: org, actor });
  await markOverviewSeen({ repository, clock: { now: () => "2026-10-02T09:30:00.000Z" } }, { organizationId: org, actor });
  // Newest look wins; earlier looks are kept, other people and organizations are untouched.
  expect(await repository.getOverviewSeenAt(org, actor.actorId!)).toBe("2026-10-02T09:30:00.000Z");
  expect(await repository.getOverviewSeenAt(org, other.id)).toBeUndefined();
  expect(await repository.getOverviewSeenAt("another-org", actor.actorId!)).toBeUndefined();
  await expect(markOverviewSeen({ repository }, { organizationId: "another-org", actor })).rejects.toThrow(/Sign in/);
  await expect(markOverviewSeen({ repository }, { organizationId: org, actor: { ...actor, actorType: "system" } as ActorContext })).rejects.toThrow(/Sign in/);
}

describe("Since you last looked", () => {
  it("counts each kind with the same rule as the list it opens, edges included", async () => {
    const { f, from, to, edges } = edgeFixture();
    const repository = createOpsFixtureRepository(f), scope = { organizationId: f.organizations[0]!.id };
    for (const kind of SINCE_KINDS) {
      const list = await repository.listWorkOrders(scope, { change: { kind, from, to }, limit: 100 });
      expect(list.items.length, kind).toBeGreaterThan(0);
      expect(await repository.countWorkOrders(scope, { change: { kind, from, to } })).toBe(list.items.length);
    }
    const urgent = (await repository.listWorkOrders(scope, { change: { kind: "urgent", from, to }, limit: 100 })).items.map(w => w.id);
    // Exactly at the last look is already seen; exactly now is new; cancelled never counts.
    expect(urgent).toContain(edges.inside);
    expect(urgent).toContain(edges.atNow);
    expect(urgent).not.toContain(edges.atLastLook);
    if (edges.cancelled) expect(urgent).not.toContain(edges.cancelled);
    const overdue = (await repository.listWorkOrders(scope, { change: { kind: "overdue", from, to }, limit: 100 })).items.map(w => w.id);
    expect(overdue).toContain(edges.overdue);
    expect(overdue).not.toContain(edges.overdueAtLastLook);
    // "Fixed" waits for limbo to end: confirmed, or closed by itself when no check is required.
    const fixed = (await repository.listWorkOrders(scope, { change: { kind: "fixed", from, to }, limit: 100 })).items.map(w => w.id);
    expect(fixed).toContain(edges.confirmed);
    expect(fixed).toContain(edges.selfClosed);
    expect(fixed).not.toContain(edges.limbo);
    expect(fixed).not.toContain(edges.selfClosedWaiting);
  });

  it("builds list links that read back to the same window, and ignores bad ones", () => {
    const window: SinceWindow = { kind: "declined", from: "2026-10-01T10:00:00.000Z", to: "2026-10-06T12:00:00.000Z" };
    const params = new URL(sinceHref(window), "https://test.invalid").searchParams;
    expect(sinceWindowFromQuery(params.get("change")!, params.get("changedFrom")!, params.get("changedTo")!)).toEqual(window);
    expect(sinceWindowFromQuery("deleted", window.from, window.to)).toBeUndefined();
    expect(sinceWindowFromQuery("fixed", window.to, window.from)).toBeUndefined();
    expect(sinceWindowFromQuery("fixed", "nope", window.to)).toBeUndefined();
    expect(sinceStartFor(undefined, window.to)).toBe("2026-09-29T12:00:00.000Z");
    expect(sinceStartFor(window.from, window.to)).toBe(window.from);
  });

  it("returns the same jobs and counts from SQLite (D1) as from the fixture, for every scope", async () => {
    const { f, from, to } = changedFixture();
    const { db, repository } = sqlite(f);
    try {
      const org = f.organizations[0]!.id;
      for (const scope of [{ organizationId: org }, { organizationId: org, storeIds: [f.stores[0]!.id, f.stores[3]!.id] }, { organizationId: org, storeIds: [] }, { organizationId: "foreign" }]) await compare(repository, f, scope, from, to);
    } finally { db.close(); }
  });

  it("saves Mark as seen per person on the server, insert-only, in the fixture and SQLite", async () => {
    const f = buildNorthlinePresentationFixture();
    await markSeenScenario(createOpsFixtureRepository(structuredClone(f)), f);
    const { db, repository } = sqlite(f);
    try {
      await markSeenScenario(repository, f);
      expect((db.prepare("SELECT COUNT(*) AS n FROM ops_overview_seen_marks").get() as { n: number }).n).toBe(2);
    } finally { db.close(); }
  });
});

describe("Repeat problems", () => {
  it("uses the issue ranking rule over 60 days with the replacement rules' 3-job threshold", async () => {
    expect(REPEAT_WORK_MIN_JOBS).toBe(3);
    expect(REPEAT_DAYS).toBe(60);
    const f = buildNorthlinePresentationFixture();
    const window = repeatProblemWindow(f.asOf);
    expect((Date.parse(window.costTo) - Date.parse(window.costFrom)) / DAY).toBe(59);
    // Make one unit a clear repeat problem inside the window.
    const asset = f.assets[0]!, base = f.workOrders.find(w => w.assetId === asset.id) ?? f.workOrders[0]!;
    for (let i = 0; i < 3; i++) f.workOrders.push({ ...base, id: `repeat-${i}`, number: `REPEAT-${i}`, requestId: undefined, assetId: asset.id, storeId: asset.storeId, priority: "routine", status: "closed", createdAt: `${window.costTo}T0${i}:00:00.000Z`, resolvedAt: undefined, closedAt: undefined });
    const scope = { organizationId: f.organizations[0]!.id };
    const all = equipmentIssuesFromFixture(f, scope, window, { limit: 100 });
    const repeat = equipmentIssuesFromFixture(f, scope, window, { limit: 100, minIssueCount: REPEAT_WORK_MIN_JOBS });
    expect(repeat.items.length).toBeGreaterThan(0);
    expect(repeat.items).toEqual(all.items.filter(row => row.issueCount >= 3));
    expect(repeat.totalCount).toBe(repeat.items.length);
    const { db, repository } = sqlite(f);
    try {
      expect(await repository.listEquipmentIssues(scope, window, { limit: 100, minIssueCount: 3 })).toEqual(repeat);
      expect(await repository.listEquipmentIssues(scope, window, { limit: 1, minIssueCount: 3 })).toEqual(equipmentIssuesFromFixture(f, scope, window, { limit: 1, minIssueCount: 3 }));
    } finally { db.close(); }
  });
});

// Opt in with a disposable local test database. Never migrate a customer database.
const url = process.env.OPS_DISPATCH_TEST_DATABASE_URL;
describe.skipIf(!url)("Since you last looked and repeat problems on PostgreSQL", () => {
  let pool: Pool, databaseName = "", repository: OpsRepository;
  const { f, from, to } = changedFixture();
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

  it("matches the fixture for every kind and scope", async () => {
    const org = f.organizations[0]!.id;
    for (const scope of [{ organizationId: org }, { organizationId: org, storeIds: [f.stores[0]!.id] }, { organizationId: "foreign" }]) await compare(repository, f, scope, from, to);
  }, 30000);
  it("keeps Mark as seen per person, insert-only", async () => { await markSeenScenario(repository, f); });
  it("returns the same repeat problems", async () => {
    const window = repeatProblemWindow(f.asOf), scope = { organizationId: f.organizations[0]!.id };
    expect(await repository.listEquipmentIssues(scope, window, { limit: 5, minIssueCount: 3 })).toEqual(equipmentIssuesFromFixture(f, scope, window, { limit: 5, minIssueCount: 3 }));
  });
});
