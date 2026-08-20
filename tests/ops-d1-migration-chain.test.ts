import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";

function statementsIn(sql: string) {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("D1 migration chain", () => {
  it("applies every migration in a foreign-key-enforced per-file transaction", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    const directory = resolve(process.cwd(), "drizzle");
    const migrations = readdirSync(directory)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    try {
      expect(migrations).toHaveLength(26);
      for (const migration of migrations) {
        database.exec("BEGIN");
        try {
          for (const statement of statementsIn(readFileSync(resolve(directory, migration), "utf8"))) {
            database.exec(statement);
          }
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw new Error(`D1 migration ${migration} failed`, { cause: error });
        }
      }

      const tables = database.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'ops_request_impact_assessments',
            'ops_workflow_tasks',
            'ops_site_visit_work_orders',
            'ops_work_order_verifications',
            'ops_warranty_cases',
            'ops_applied_warranties',
            'ops_invoices',
            'ops_value_events'
          )
        ORDER BY name
      `).all();
      expect(tables).toHaveLength(8);
      expect(database.prepare("PRAGMA table_info(ops_requests)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "version", notnull: 1, dflt_value: "0" })]));
      expect(database.prepare("PRAGMA table_info(ops_invoices)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "submitted_by_membership_id" })]));
      expect(database.prepare("PRAGMA table_info(ops_warranty_rules)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "quote_id" }),expect.objectContaining({ name: "authorization_id" })]));
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

      database.exec("BEGIN");
      try {
        for (const statement of buildOpsSeedStatements(buildNorthlinePresentationFixture())) {
          const params = statement.params.map((value): SQLInputValue => (
            typeof value === "boolean" ? Number(value) : value as SQLInputValue
          ));
          database.prepare(statement.sql).run(...params);
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw new Error("D1 deterministic seed failed after the full migration chain", { cause: error });
      }
      expect(database.prepare("SELECT COUNT(*) AS count FROM ops_stores WHERE organization_id = ?").get("org-northline-demo"))
        .toMatchObject({ count: 15 });
      expect(database.prepare("SELECT version FROM ops_requests WHERE id = ? AND organization_id = ?").get("request-current-104-beer-cave-door", "org-northline-demo"))
        .toMatchObject({ version: 0 });
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });
});
