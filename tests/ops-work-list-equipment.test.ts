import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("shows the same linked equipment on work-order list rows from the demo data and the database", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const db = new DatabaseSync(":memory:");
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(s: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read cannot mutate"); } };
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const s of buildOpsSeedStatements(fixture)) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    const scope = { organizationId }, query = { limit: 200 };
    const equipment = (rows: Array<{ id: string; assetName?: string; assetTag?: string }>) => rows.map(row => [row.id, row.assetName ?? null, row.assetTag ?? null]);
    const sql = (await createOpsSqlRepository(driver, "d1").listWorkOrders(scope, query)).items;
    const demo = (await createOpsFixtureRepository(fixture).listWorkOrders(scope, query)).items;
    expect(equipment(sql)).toEqual(equipment(demo));
    expect(demo.some(row => row.assetName)).toBe(true);
    expect(demo.some(row => !row.assetName)).toBe(true);
    for (const row of demo.filter(row => row.assetName)) {
      const work = fixture.workOrders.find(w => w.id === row.id)!, asset = fixture.assets.find(a => a.id === work.assetId)!;
      expect([row.assetName, row.assetTag]).toEqual([asset.name, asset.assetTag]);
    }
  } finally { db.close(); }
});
