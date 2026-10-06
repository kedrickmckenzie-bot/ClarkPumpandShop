import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { buildOpsSeedStatements, seedOpsRepository } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { SMALL_SAMPLE, buildScorecard, jobResult, scorecardWindows, summarizeMeasure, vendorJobFactsFromFixture, type VendorJobFact } from "@/lib/ops/vendor-scorecard";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { OpsFixture } from "@/lib/ops/types";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildVendorScorecardPage, canViewVendorScorecards, hoursLabel } from "@/app/app/_data/vendor-scorecard-presenter";
import { roleCanOpenOperatorHref } from "@/components/ops/role-policy";

const fixture = () => buildShowcaseFixture("2026-10-03T18:00:00.000Z");

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
    expect(await repository.listVendorJobFacts(scope, year)).toEqual(vendorJobFactsFromFixture(f, scope, year));
  }
  const all = await repository.listVendorJobFacts({ organizationId: org }, year);
  expect(all.length).toBeGreaterThan(10);
  return all;
}

describe("vendor scorecard facts", () => {
  it("returns the same job facts from SQLite (D1) as from the demo data, for every scope", async () => {
    const f = fixture(), { db, repository } = sqlite(f);
    try {
      const all = await parity(repository, f);
      // Every measure has real source records in the demo, so the page is never empty.
      for (const key of ["response", "firstFix", "fixHeld", "cost", "declined"] as const) expect(all.some(fact => { const r = jobResult(fact, key, f.asOf); return r.counted && (r.hit || r.value !== undefined); }), key).toBe(true);
    } finally { db.close(); }
  });
});

const base: VendorJobFact = { workOrderId: "w", number: "WO-1", problem: "Leak", storeId: "s", storeNumber: "101", storeName: "Store", vendorId: "v1", vendorName: "Alpha", trade: "plumbing",
  sentAt: "2026-09-01T10:00:00.000Z", declined: false, costMinor: 0, costLineCount: 0, invoiceIssue: false };
const job = (i: number, extra: Partial<VendorJobFact> = {}): VendorJobFact => ({ ...base, workOrderId: `w${i}`, number: `WO-${i}`, ...extra });
const NOW = "2026-10-06T12:00:00.000Z";

describe("vendor scorecard summary", () => {
  it("uses medians, rates and the small-sample rule, and judges callbacks only after 30 days", () => {
    const facts = [1, 2, 3, 4, 5].map(i => job(i, { firstResponseAt: new Date(Date.parse(base.sentAt) + i * 3_600_000).toISOString(), firstOutcome: i <= 4 ? "completed" : "parts_required", completedAt: i <= 4 ? "2026-09-02T10:00:00.000Z" : undefined, assetId: "a", costMinor: i * 10_000, costLineCount: 1 }));
    facts[0]!.callbackAt = "2026-09-20T10:00:00.000Z";
    expect(summarizeMeasure(facts, "response", NOW).value).toBe(3);
    expect(summarizeMeasure(facts, "firstFix", NOW)).toMatchObject({ counted: 5, hits: 4, value: 0.8, tooFew: false });
    expect(summarizeMeasure(facts, "cost", NOW).value).toBe(30_000);
    expect(summarizeMeasure(facts, "callbacks", NOW)).toMatchObject({ counted: 4, hits: 1, tooFew: true });
    // A fix recorded 10 days ago cannot be judged yet.
    expect(jobResult(job(9, { completedAt: "2026-09-26T10:00:00.000Z", assetId: "a" }), "callbacks", NOW).counted).toBe(false);
    expect(summarizeMeasure(facts.slice(0, SMALL_SAMPLE - 1), "firstFix", NOW).tooFew).toBe(true);
    expect(hoursLabel(0.5)).toBe("30 min");
    expect(hoursLabel(3.25)).toBe("3.3 hr");
    expect(hoursLabel(72)).toBe("3 days");
  });

  it("marks best and weakest only among comparable vendors, and trends only on clear changes", () => {
    const alpha = [1, 2, 3, 4, 5].map(i => job(i, { firstOutcome: "completed" }));
    const beta = [6, 7, 8, 9, 10].map(i => job(i, { vendorId: "v2", vendorName: "Beta", firstOutcome: i < 8 ? "completed" : "return_visit_required" }));
    const gamma = [11, 12].map(i => job(i, { vendorId: "v3", vendorName: "Gamma", firstOutcome: "return_visit_required" }));
    const priorBeta = [20, 21, 22, 23, 24].map(i => job(i, { vendorId: "v2", vendorName: "Beta", firstOutcome: "completed" }));
    const [group] = buildScorecard([...alpha, ...beta, ...gamma], priorBeta, NOW);
    const by = (id: string) => group!.vendors.find(v => v.vendorId === id)!.measures.firstFix;
    expect(by("v1").rank).toBe("best");
    expect(by("v2").rank).toBe("worst");
    // Gamma has too few jobs to be ranked at all.
    expect(by("v3").rank).toBeUndefined();
    expect(by("v2")).toMatchObject({ trend: "worse", priorValue: 1 });
    expect(by("v1").trend).toBeUndefined();
  });
});

describe("vendor scorecard page", () => {
  const f = fixture(), repository = createOpsFixtureRepository(f);
  const session: OperatorSession = { organizationId: f.organizations[0]!.id, organizationName: "Clark Pump and Shop", userId: "u", membershipId: "m", displayName: "Jordan", email: "j@example.test", scopeLabel: "All stores", role: "facilities", demoEdition: "complete" };

  const drilled = async (href: string) => (await buildVendorScorecardPage(repository, session, Object.fromEntries(new URL(href, "https://test.invalid").searchParams), f.asOf)).drill;
  async function expectCellsMatch(cells: Array<{ href: string; measure: string; summary: { counted: number; hits: number } }>, label: string) {
    for (const cell of cells) {
      const drill = await drilled(cell.href);
      expect(drill, `${label} ${cell.measure}`).toBeDefined();
      expect(drill!.rows, `${label} ${cell.measure}`).toHaveLength(cell.summary.counted);
      if (["declined", "invoice", "onTime", "firstFix", "fixHeld", "callbacks"].includes(cell.measure)) {
        const hitTone = ["onTime", "firstFix", "fixHeld"].includes(cell.measure) ? "good" : "bad";
        expect(drill!.rows.filter(r => r.tone === hitTone), `${label} ${cell.measure}`).toHaveLength(cell.summary.hits);
      }
    }
  }

  it("opens exactly the jobs behind every number on the all-vendors view", async () => {
    const page = await buildVendorScorecardPage(repository, session, { period: "365" }, f.asOf);
    expect(page.view).toBe("all");
    expect(page.vendors.length).toBe(page.totals.vendors);
    expect(page.vendors.reduce((sum, row) => sum + row.cells[0]!.summary.counted, 0)).toBe(page.totals.jobs);
    for (const row of [...page.vendors, ...page.comparisons.flatMap(g => g.rows)]) await expectCellsMatch(row.cells, row.label);
  }, 120000);

  it("gives each vendor a scorecard whose every number opens its jobs", async () => {
    const page = await buildVendorScorecardPage(repository, session, { period: "90" }, f.asOf);
    for (const row of page.vendors.slice(0, 3)) {
      const card = (await buildVendorScorecardPage(repository, session, Object.fromEntries(new URL(row.href!, "https://test.invalid").searchParams), f.asOf));
      expect(card.view).toBe("vendor");
      const vendor = card.vendor!;
      expect(vendor.name).toBe(row.label);
      expect(vendor.jobs).toBe(row.cells[0]!.summary.counted);
      // This period equals the vendor's row on the all-vendors view, and the newest "over time" column.
      expect(vendor.summary.map(c => c.value)).toEqual(row.cells.map(c => c.value));
      expect(vendor.history.columns.at(-1)!.current).toBe(true);
      expect(vendor.history.rows.map(r => r.cells.at(-1)!.counted)).toEqual(vendor.summary.map(c => c.summary.counted));
      // Districts and types of work add up to the vendor's jobs.
      expect(vendor.byDistrict.reduce((sum, r) => sum + r.cells[0]!.summary.counted, 0)).toBe(vendor.jobs);
      expect(vendor.byTrade.reduce((sum, r) => sum + r.cells[0]!.summary.counted, 0)).toBe(vendor.jobs);
      await expectCellsMatch(vendor.summary, `${vendor.name} summary`);
      for (const r of [...vendor.byDistrict, ...vendor.byTrade]) await expectCellsMatch(r.cells, `${vendor.name} ${r.label}`);
      for (const r of vendor.history.rows) for (const cell of r.cells) expect((await drilled(cell.href))!.rows, `${vendor.name} ${r.measure} history`).toHaveLength(cell.counted);
    }
  }, 120000);

  it("refuses another organization's vendor and keeps comparisons like for like", async () => {
    const foreign = await buildVendorScorecardPage(repository, session, { vendor: "vendor-from-elsewhere" }, f.asOf);
    expect(foreign.view).toBe("all");
    const page = await buildVendorScorecardPage(repository, session, { period: "365" }, f.asOf);
    for (const group of page.comparisons) { expect(group.rows.length).toBeGreaterThan(1); expect(group.trade).not.toBe("unclassified"); }
    expect(page.vendors.some(row => row.cells.some(c => c.summary.rank))).toBe(false);
    const trade = page.trades[0]!.value;
    const one = await buildVendorScorecardPage(repository, session, { period: "365", trade }, f.asOf);
    expect(one.comparisons).toEqual([]);
    expect(one.totals.jobs).toBe(page.totals.jobs);
    expect(one.vendors.reduce((sum, row) => sum + row.cells[0]!.summary.counted, 0)).toBe(page.trades[0]!.jobs);
    const region = f.regions[0]!.id;
    const regional = await buildVendorScorecardPage(repository, session, { period: "365", region }, f.asOf);
    expect(regional.totals.jobs).toBeLessThan(page.totals.jobs);
    expect(regional.totals.jobs).toBe(vendorJobFactsFromFixture(f, { organizationId: session.organizationId, regionIds: [region] }, scorecardWindows(f.asOf, 365).current).length);
    // A region outside the person's scope is ignored, never widened.
    const district = { ...session, role: "regional" as const, regionIds: [region] };
    const other = await buildVendorScorecardPage(repository, district, { period: "365", region: f.regions[1]!.id }, f.asOf);
    expect(other.totals.jobs).toBe(regional.totals.jobs);
  }, 60000);

  it("is for owners, facilities and district managers only", () => {
    expect(canViewVendorScorecards({ role: "facilities" })).toBe(true);
    expect(canViewVendorScorecards({ role: "executive" })).toBe(true);
    expect(canViewVendorScorecards({ role: "regional" })).toBe(true);
    expect(canViewVendorScorecards({ role: "regional", persona: "field_manager" })).toBe(false);
    for (const role of ["store_manager", "technician", "finance"] as const) {
      expect(canViewVendorScorecards({ role })).toBe(false);
      expect(roleCanOpenOperatorHref(role, "/app/vendors/scorecards")).toBe(false);
    }
  });

  it("counts older unattributed costs only for the job's sole provider", () => {
    const g = fixture(), org = g.organizations[0]!.id;
    const fact = vendorJobFactsFromFixture(g, { organizationId: org }, scorecardWindows(g.asOf, 365).current).find(x => x.costLineCount > 0)!;
    const vendor = g.vendors.find(v => v.organizationId === org && v.id !== fact.vendorId)!;
    g.assignments.push({ ...g.assignments.find(a => a.workOrderId === fact.workOrderId && a.vendorId === fact.vendorId)!, id: "second-vendor", vendorId: vendor.id, status: "superseded" });
    const again = vendorJobFactsFromFixture(g, { organizationId: org }, scorecardWindows(g.asOf, 365).current).find(x => x.workOrderId === fact.workOrderId && x.vendorId === fact.vendorId)!;
    expect(again.costLineCount).toBe(0);
  });
});

// Opt in with a disposable local test database. Never migrate a customer database.
const url = process.env.OPS_DISPATCH_TEST_DATABASE_URL;
describe.skipIf(!url)("vendor scorecard facts on PostgreSQL", () => {
  let pool: Pool, databaseName = "", repository: OpsRepository;
  const f = fixture();
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/dispatch_.*test$/.test(parsed.pathname)) throw new Error("Use an isolated localhost dispatch_*test database.");
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
