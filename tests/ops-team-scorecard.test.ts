import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { buildOpsSeedStatements, seedOpsRepository } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import {
  TEAM_MEASURES, TEAM_MEASURE_GROUPS, outsideTheirControl, plannedDayResult, returnReason, summarizeTeamMeasure, teamFlags, teamJobResult, techJobFactsFromFixture,
  type TechJobFact,
} from "@/lib/ops/team-scorecard";
import { scorecardWindows } from "@/lib/ops/vendor-scorecard";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { OpsFixture } from "@/lib/ops/types";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildTeamScorecardPage, canViewTeamScorecard } from "@/app/app/_data/team-scorecard-presenter";
import { roleCanOpenOperatorHref } from "@/components/ops/role-policy";

const AS_OF = "2026-10-15T18:00:00.000Z";
const fixture = () => buildShowcaseFixture(AS_OF);

function sqlite(f: OpsFixture) {
  const db = new DatabaseSync(":memory:");
  const bind = (params: readonly unknown[]) => params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[];
  const driver: OpsSqlDriver = { dialect: "sqlite",
    async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...bind(statement.params)) as Row[], affectedRows: 0 }; },
    async atomic() { throw new Error("read only"); } };
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(name => /^\d.*\.sql$/.test(name)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(f)) db.prepare(statement.sql).run(...bind(statement.params));
  return { db, repository: createOpsSqlRepository(driver, "d1") };
}

async function parity(repository: OpsRepository, f: OpsFixture) {
  const org = f.organizations[0]!.id, region = f.regions[0]!.id;
  const year = { from: "2025-01-01T00:00:00.000Z", to: "2026-12-31T00:00:00.000Z" };
  for (const scope of [{ organizationId: org }, { organizationId: org, regionIds: [region] }, { organizationId: org, storeIds: [f.stores[0]!.id] }, { organizationId: org, storeIds: [] }, { organizationId: "foreign" }]) {
    expect(await repository.listTechJobFacts(scope, year)).toEqual(techJobFactsFromFixture(f, scope, year));
  }
  const one = { ...year, techId: "membership-northline-tech-5" };
  expect(await repository.listTechJobFacts({ organizationId: org }, one)).toEqual(techJobFactsFromFixture(f, { organizationId: org }, one));
  const all = await repository.listTechJobFacts({ organizationId: org }, year);
  expect(all.length).toBeGreaterThan(300);
  return all;
}

describe("team scorecard facts", () => {
  it("returns the same facts from SQLite (D1) as from the demo data, for every scope", async () => {
    const f = fixture(), { db, repository } = sqlite(f);
    try {
      const all = await parity(repository, f);
      // Only technicians count: store teams doing small jobs are not on the team scorecard.
      expect(new Set(all.map(fact => fact.techId)).size).toBe(6);
      for (const key of TEAM_MEASURES) expect(all.some(fact => teamJobResult(fact, key, AS_OF).counted), key).toBe(true);
    } finally { db.close(); }
  }, 60000);
});

const base: TechJobFact = { workOrderId: "w", number: "WO-1", problem: "Leak", storeId: "s", storeNumber: "101", storeName: "Store", techId: "t1", techName: "Ana", trade: "plumbing",
  pm: false, found: false, startedAt: "2026-09-01T13:00:00.000Z", plans: [] };
const job = (i: number, extra: Partial<TechJobFact> = {}): TechJobFact => ({ ...base, workOrderId: `w${i}`, number: `WO-${i}`, ...extra });
const NOW = "2026-10-06T16:00:00.000Z";
const plan = (revision: number, day: string, recordedAt: string) => ({ revision, precision: "day", day, zone: "America/New_York", recordedAt });

describe("team scorecard rules", () => {
  it("judges the planned day fairly: moved ahead counts the new day, a passed day stays missed", () => {
    // Done on the day (late afternoon Eastern is still that day).
    expect(plannedDayResult({ plans: [plan(1, "2026-09-03", "2026-09-01T14:00:00Z")], firstWorkedAt: "2026-09-03T21:30:00Z" }, NOW)).toMatchObject({ counted: true, hit: true });
    // Moved the evening before: judged on the new day.
    expect(plannedDayResult({ plans: [plan(1, "2026-09-03", "2026-09-01T14:00:00Z"), plan(2, "2026-09-04", "2026-09-02T23:00:00Z")], firstWorkedAt: "2026-09-04T15:00:00Z" }, NOW)).toMatchObject({ counted: true, hit: true, day: "2026-09-04" });
    // The day passed, then it was re-planned: still a miss.
    expect(plannedDayResult({ plans: [plan(1, "2026-09-03", "2026-09-01T14:00:00Z"), plan(2, "2026-09-05", "2026-09-04T12:00:00Z")], firstWorkedAt: "2026-09-05T15:00:00Z" }, NOW)).toMatchObject({ counted: true, hit: false, day: "2026-09-03" });
    // Still open after the day: missed. Day not reached yet: not judged. No planned day: not counted.
    expect(plannedDayResult({ plans: [plan(1, "2026-10-01", "2026-09-29T14:00:00Z")] }, NOW)).toMatchObject({ counted: true, hit: false });
    expect(plannedDayResult({ plans: [plan(1, "2026-10-09", "2026-10-05T14:00:00Z")] }, NOW)).toEqual({ counted: false });
    expect(plannedDayResult({ plans: [{ ...plan(1, "", "2026-10-05T14:00:00Z"), precision: "week", day: undefined }] }, NOW)).toEqual({ counted: false });
  });

  it("counts first-visit fixes on repairs only and names each return's reason", () => {
    expect(teamJobResult(job(1, { firstOutcome: "completed" }), "firstFix", NOW)).toEqual({ counted: true, hit: true });
    expect(teamJobResult(job(2, { firstOutcome: "completed", pm: true }), "firstFix", NOW)).toEqual({ counted: false });
    expect(teamJobResult(job(3, { firstOutcome: "no_issue_found" }), "firstFix", NOW)).toEqual({ counted: false });
    expect(returnReason({ firstOutcome: "parts_required" })).toBe("Waiting on parts");
    expect(returnReason({ firstOutcome: "return_visit_required", firstBlocker: "help" })).toBe("Needed help");
    expect(returnReason({ firstOutcome: "return_visit_required" })).toBe("Needed another trip");
    expect(outsideTheirControl({ firstOutcome: "parts_required" })).toBe(true);
    expect(outsideTheirControl({ firstOutcome: "return_visit_required" })).toBe(false);
    expect(summarizeTeamMeasure([job(4, { pm: true, firstOutcome: "completed" })], "firstFix", NOW).emptyReason).toBe("Only planned maintenance");
  });

  it("flags only clear gaps against teammates on the same work, and never parts waits", () => {
    const facts: TechJobFact[] = [];
    for (let i = 0; i < 10; i++) facts.push(job(i, { techId: "t1", techName: "Ana", firstOutcome: i < 5 ? "completed" : "return_visit_required" }));
    for (let i = 0; i < 10; i++) facts.push(job(100 + i, { techId: "t2", techName: "Ben", firstOutcome: i < 9 ? "completed" : "return_visit_required" }));
    // Cal's returns are all waiting on parts: shown on the page, never flagged.
    for (let i = 0; i < 10; i++) facts.push(job(200 + i, { techId: "t3", techName: "Cal", firstOutcome: i < 5 ? "completed" : "parts_required" }));
    // Dee does other work: never compared with plumbing.
    for (let i = 0; i < 10; i++) facts.push(job(300 + i, { techId: "t4", techName: "Dee", trade: "electrical", firstOutcome: "return_visit_required" }));
    const flags = teamFlags(facts, [], NOW);
    expect(flags.map(f => f.techName)).toEqual(["Ana"]);
    expect(flags[0]).toMatchObject({ measure: "firstFix", trade: "plumbing", text: "5 of 10 jobs needed a second trip. Rest of the team: 1 of 15." });
  });

  it("counts a problem a tech found themselves only toward repaired again", () => {
    const found = job(1, { found: true, firstOutcome: "completed", firstCompletedAt: "2026-09-01T15:00:00.000Z", completedAt: "2026-09-01T15:00:00.000Z", assetId: "a", plans: [plan(1, "2026-09-01", "2026-09-01T13:00:00Z")], firstWorkedAt: "2026-09-01T15:00:00.000Z" });
    for (const key of ["jobs", "finish", "plannedDay", "firstFix"] as const) expect(teamJobResult(found, key, NOW).counted, key).toBe(false);
    expect(teamJobResult(found, "callbacks", NOW)).toEqual({ counted: true, hit: false });
  });

  it("keeps the column bands in the same order as every row", () => {
    expect(TEAM_MEASURE_GROUPS.flatMap(group => group.keys)).toEqual([...TEAM_MEASURES]);
  });

  it("gives the demo a believable story: one repeat-repair flag, and parts waits not held against anyone", () => {
    const f = fixture(), { current, prior } = scorecardWindows(AS_OF, 365);
    const facts = techJobFactsFromFixture(f, { organizationId: f.organizations[0]!.id }, { from: prior.from, to: current.to });
    const inWindow = (w: { from: string; to: string }) => facts.filter(x => x.startedAt >= w.from && x.startedAt < w.to);
    const flags = teamFlags(inWindow(current), inWindow(prior), AS_OF);
    expect(flags.some(flag => flag.techName === "Sam Patel" && flag.measure === "callbacks" && flag.trade === "refrigeration")).toBe(true);
    expect(flags.some(flag => flag.techName === "Alex Morgan" && flag.measure === "firstFix")).toBe(false);
    expect(flags.length).toBeLessThanOrEqual(4);
  });
});

describe("team scorecard page", () => {
  const f = fixture(), repository = createOpsFixtureRepository(f);
  const session: OperatorSession = { organizationId: f.organizations[0]!.id, organizationName: "Clark Pump and Shop", userId: "u", membershipId: "m", displayName: "Jordan", email: "j@example.test", scopeLabel: "All stores", role: "facilities", demoEdition: "complete" };
  const open = async (href: string) => buildTeamScorecardPage(repository, session, Object.fromEntries(new URL(href, "http://x").searchParams), AS_OF);
  async function drilled(href: string) {
    const first = (await open(href)).drill!;
    const rows = [...first.rows];
    for (let next = first.page?.nextHref; next;) { const page = (await open(next)).drill!; rows.push(...page.rows); next = page.page?.nextHref; }
    return { ...first, rows };
  }
  async function expectCellsMatch(cells: Array<{ href: string; measure: string; summary: { counted: number; hits: number } }>, label: string) {
    const jobs = cells.find(cell => cell.measure === "jobs")!.summary.counted;
    for (const cell of cells) {
      const drill = await drilled(cell.href);
      expect(drill.rows, `${label} ${cell.measure}`).toHaveLength(cell.summary.counted);
      // Every list adds back up to the jobs total: counted rows plus the "not counted" breakdown.
      const left = /^Not counted: (\d+) of (\d+) jobs — /.exec(drill.notCounted ?? "");
      const found = drill.rows.filter(row => row.tags.includes("Found by them")).length;
      expect(cell.summary.counted - found + Number(left?.[1] ?? 0), `${label} ${cell.measure} adds up`).toBe(jobs);
      if (left) expect(Number(left[2]), `${label} ${cell.measure} total`).toBe(jobs);
      if (["plannedDay", "firstFix", "callbacks"].includes(cell.measure)) {
        const hitTone = cell.measure === "callbacks" ? "bad" : "good";
        expect(drill.rows.filter(r => r.tone === hitTone), `${label} ${cell.measure}`).toHaveLength(cell.summary.hits);
      }
    }
  }

  it("opens exactly the jobs behind every number, for the whole team and each technician", async () => {
    const page = await open("/app/dispatch/team?period=365");
    expect(page.view).toBe("team");
    expect(page.rows[0]).toMatchObject({ key: "team", label: "Whole team", total: true });
    expect(page.rows).toHaveLength(7);
    for (const row of page.rows) await expectCellsMatch(row.cells, row.label);
    // Each flag opens the jobs it describes.
    const flagged = page.flags.flatMap(group => group.items);
    expect(flagged.length).toBeGreaterThan(0);
    for (const item of flagged) expect((await drilled(item.href)).rows.length).toBeGreaterThanOrEqual(8);
  }, 120000);

  it("gives each technician a page with their history, types of work and team comparison", async () => {
    const page = await open("/app/dispatch/team?period=365&tech=membership-northline-tech-5");
    expect(page.view).toBe("tech");
    expect(page.tech).toMatchObject({ name: "Sam Patel", dispatchHref: "/app/dispatch/technicians/membership-northline-tech-5" });
    expect(page.tech!.summary.find(c => c.measure === "firstFix")!.compare).toMatch(/^Team: \d+%$/);
    await expectCellsMatch(page.tech!.summary, "Sam");
    for (const row of page.tech!.byTrade) await expectCellsMatch(row.cells, `Sam ${row.label}`);
    expect(page.flags.map(group => group.techName)).toEqual(["Sam Patel"]);
    // A store manager's or another company's person is never shown as a technician.
    expect((await open("/app/dispatch/team?tech=membership-northline-store-101")).view).toBe("team");
  }, 120000);

  it("is for managers and the owner only", () => {
    for (const role of ["executive", "facilities", "regional"] as const) expect(canViewTeamScorecard({ role })).toBe(true);
    for (const role of ["store_manager", "technician", "finance"] as const) expect(canViewTeamScorecard({ role })).toBe(false);
    expect(roleCanOpenOperatorHref("store_manager", "/app/dispatch/team")).toBe(false);
    expect(roleCanOpenOperatorHref("facilities", "/app/dispatch/team")).toBe(true);
  });
});

const url = process.env.OPS_DISPATCH_TEST_DATABASE_URL;
describe.skipIf(!url)("team scorecard facts on PostgreSQL", () => {
  let pool: Pool, databaseName = "", repository: OpsRepository;
  const f = fixture();
  beforeAll(async () => {
    const parsed = new URL(url!);
    const admin = new Pool({ connectionString: url });
    databaseName = `dispatch_${crypto.randomUUID().replaceAll("-", "")}_test`;
    try { await admin.query(`CREATE DATABASE ${databaseName}`); } finally { await admin.end(); }
    parsed.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: parsed.toString(), max: 4 });
    for (const file of readdirSync("drizzle-postgres").filter(name => /^\d.*\.sql$/.test(name)).sort()) {
      for (const sql of readFileSync(`drizzle-postgres/${file}`, "utf8").split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean)) await pool.query(sql);
    }
    repository = createOpsPostgresRepository(pool);
    const seeded = structuredClone(f); seeded.outboxMessages = [];
    await seedOpsRepository(repository, seeded);
  }, 120000);
  afterAll(async () => { await pool?.end(); if (databaseName) { const cleanup = new Pool({ connectionString: url }); try { await cleanup.query(`DROP DATABASE ${databaseName}`); } finally { await cleanup.end(); } } });
  it("matches the demo data for every scope", async () => { await parity(repository, f); }, 60000);
});
