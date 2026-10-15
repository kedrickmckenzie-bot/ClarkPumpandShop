import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { addSpendTotal, repairQuality, spendCoverage, spendSplit, withdrawSpendTotal, SpendTotalOverlapError, type SpendTotal } from "@/lib/ops/spend-totals";
import type { OpsRepository } from "@/lib/ops/repository";

const org = "org-northline-demo", now = "2026-10-13T15:00:00.000Z", today = now.slice(0, 10);
const finance = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-finance", actorName: "Avery Brooks" };

async function sqliteRepository() {
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const db = new DatabaseSync(":memory:");
  type Value = string | number | null;
  for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  for (const s of buildOpsSeedStatements(buildShowcaseFixture(now))) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
  const repository = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } } }, "d1");
  return { repository, close: () => db.close() };
}

const entry = (periodStart: string, periodEnd: string, extra: Partial<SpendTotal> = {}): SpendTotal => ({ id: `t-${periodStart}`, organizationId: org, periodStart, periodEnd, kind: "total", amountMinor: 1000, currency: "USD", enteredByName: "A", createdAt: now, ...extra });

describe("maintenance spend totals", () => {
  it("shows the last day entered, the next day to pull, and missing dates", () => {
    expect(spendCoverage([])).toEqual({ lastDay: undefined, nextStart: undefined, gaps: [] });
    const coverage = spendCoverage([entry("2026-01-01", "2026-03-31"), entry("2026-05-01", "2026-06-30"), entry("2026-04-01", "2026-04-15", { withdrawnAt: now })]);
    expect(coverage).toEqual({ lastDay: "2026-06-30", nextStart: "2026-07-01", gaps: [{ from: "2026-04-01", to: "2026-04-30" }] });
  });

  it("blocks overlapping dates, keeps withdrawn entries on record, and matches between storage types", async () => {
    const sql = await sqliteRepository();
    try {
      const results = [];
      for (const repository of [createOpsFixtureRepository(buildShowcaseFixture(now)), sql.repository] as OpsRepository[]) {
        const svc = { repository, clock: { now: () => now } };
        const demo = await repository.listSpendTotals(org);
        expect(demo).toHaveLength(4);
        expect(spendCoverage(demo).nextStart).toBe("2026-10-01");
        await expect(addSpendTotal(svc, { organizationId: org, periodStart: "2026-09-15", periodEnd: "2026-10-10", kind: "total", amountMinor: 500_00, actor: finance, key: "spend-test-0001" })).rejects.toBeInstanceOf(SpendTotalOverlapError);
        await expect(addSpendTotal(svc, { organizationId: org, periodStart: "2026-10-01", periodEnd: "2026-12-31", kind: "total", amountMinor: 1, actor: finance, key: "spend-test-0002" })).rejects.toThrow(/already happened/);
        await addSpendTotal(svc, { organizationId: org, periodStart: "2026-10-01", periodEnd: "2026-10-10", kind: "in_house", amountMinor: 4_200_00, actor: finance, key: "spend-test-0003" });
        await addSpendTotal(svc, { organizationId: org, periodStart: "2026-10-01", periodEnd: "2026-10-10", kind: "in_house", amountMinor: 4_200_00, actor: finance, key: "spend-test-0003" });
        const saved = demo[demo.length - 1]!;
        await withdrawSpendTotal(svc, { organizationId: org, id: saved.id, reason: "Wrong dates", actor: finance });
        // Once the wrong entry is withdrawn, the corrected one saves.
        await addSpendTotal(svc, { organizationId: org, periodStart: saved.periodStart, periodEnd: saved.periodEnd, kind: "total", amountMinor: saved.amountMinor + 100, actor: finance, key: "spend-test-0004" });
        const after = await repository.listSpendTotals(org);
        results.push(after.map(({ id, periodStart, periodEnd, kind, amountMinor, withdrawnAt, withdrawnReason, enteredByName }) => ({ id, periodStart, periodEnd, kind, amountMinor, withdrawnAt, withdrawnReason, enteredByName })));
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0]).toHaveLength(6);
      expect(results[0].filter(row => row.withdrawnAt)).toEqual([expect.objectContaining({ withdrawnReason: "Wrong dates" })]);
    } finally { sql.close(); }
  }, 60_000);

  it("estimates in-house as total minus vendor cost for exactly the same dates", () => {
    const fixture = buildShowcaseFixture(now);
    const ctx = buildReportContext(fixture, { organizationId: org }, {}, now, today);
    const rows = spendSplit(ctx, fixture.spendTotals ?? []);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.inHouseEstimated).toBe(true);
      expect(row.vendorMinor + row.inHouseMinor).toBe(row.entry.amountMinor);
      expect(row.inHouseMinor).toBeGreaterThan(0);
    }
    const inHouse = spendSplit(ctx, [entry("2026-07-01", "2026-09-30", { kind: "in_house", amountMinor: 900_00 })])[0]!;
    expect(inHouse).toMatchObject({ inHouseMinor: 900_00, inHouseEstimated: false, totalMinor: 900_00 + inHouse.vendorMinor });
    const quality = repairQuality(ctx, { from: "2025-10-01", to: today }, "in_house");
    expect(quality.completed).toBeGreaterThan(0);
  });
});
