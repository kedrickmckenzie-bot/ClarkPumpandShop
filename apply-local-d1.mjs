import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const dbDir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const migDir = resolve(process.cwd(), "drizzle");
const migrations = readdirSync(migDir).filter((n) => n.length > 5 && !Number.isNaN(Number(n.slice(0, 4))) && n.endsWith(".sql")).sort();
for (const file of readdirSync(dbDir)) {
  if (!file.endsWith(".sqlite") || file.includes("metadata")) continue;
  console.log("applying", migrations.length, "migrations to", file);
  const db = new DatabaseSync(resolve(dbDir, file));
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) {
    const sql = readFileSync(resolve(migDir, migration), "utf8");
    db.exec("BEGIN");
    try {
      for (const statement of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) db.exec(statement);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`migration ${migration} failed`, { cause: error });
    }
  }
  const tables = db.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name LIKE 'ops_%'").get();
  console.log("ops tables:", tables.c);
  db.close();
}