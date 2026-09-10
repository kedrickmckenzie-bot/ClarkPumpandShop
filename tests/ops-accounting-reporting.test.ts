import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { loadOpsFixtureSnapshotFromD1 } from "@/lib/ops/d1-snapshot";
import { TREND_SOURCE_TABLES } from "@/lib/ops/trends-source-tables";
import { accountingReportingRegression } from "./helpers/accounting-reporting-regression";

/** Real SQLite statements/transactions, exposed through the D1 adapter contract. */
class SqliteStatement {
  constructor(private db: DatabaseSync, readonly sql: string, private values: SQLInputValue[] = []) {}
  bind(...values: unknown[]) { return new SqliteStatement(this.db, this.sql, values.map((value) => value === undefined ? null : typeof value === "boolean" ? Number(value) : value as SQLInputValue)); }
  async all() { return { success: true, results: this.db.prepare(this.sql).all(...this.values), meta: {} }; }
  async first() { return this.db.prepare(this.sql).get(...this.values) ?? null; }
  async raw() { const statement = this.db.prepare(this.sql); statement.setReturnArrays(true); return statement.all(...this.values); }
  async run() { const result = this.db.prepare(this.sql).run(...this.values); return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
}

describe("authoritative invoice reporting", () => {
  it("connects reviewed imports and corrections to fixture Trends", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    await accountingReportingRegression(repository, async () => repository.snapshot());
  });
  it("executes the same commands and narrow reporting reads through persisted D1 SQL", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    const queries: string[] = [];
    const binding = {
      prepare(sql: string) { queries.push(sql); return new SqliteStatement(db, sql); },
      async batch(statements: SqliteStatement[]) { db.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.all()); db.exec("COMMIT"); return results; } catch (error) { db.exec("ROLLBACK"); throw error; } },
    } as unknown as D1Database;
    try {
      for (const file of readdirSync("drizzle").filter((file) => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
      for (const statement of buildOpsSeedStatements(buildNorthlinePresentationFixture())) await new SqliteStatement(db, statement.sql).bind(...statement.params).run();
      await accountingReportingRegression(createOpsD1Repository(binding), () => loadOpsFixtureSnapshotFromD1(binding, "org-northline-demo", "2026-08-25T18:00:00.000Z", { includedTables: TREND_SOURCE_TABLES, auditEventTypes: ["recording.coverage_attested"] }));
      expect(queries.some((sql) => sql.includes('from "ops_outbox_messages"'))).toBe(false);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.close(); }
  }, 120_000);
});
