import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

// Local development repair utility for the miniflare D1 database ONLY.
//
// It is idempotent: applied migrations are recorded in a marker table inside
// each local sqlite file, so re-running applies only what is missing. It must
// never be pointed at a hosted D1 database — use `wrangler d1 migrations`
// for that. The local fixture resets when the dev process restarts, so this
// tool is for convenience only and is safe to delete with `.wrangler/`.
const dbDir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const migDir = resolve(process.cwd(), "drizzle");
const MARKER_TABLE = "_local_d1_applied_migrations";

const migrations = readdirSync(migDir).filter((n) => n.length > 5 && !Number.isNaN(Number(n.slice(0, 4))) && n.endsWith(".sql")).sort();
for (const file of readdirSync(dbDir)) {
  if (!file.endsWith(".sqlite") || file.includes("metadata")) continue;
  const db = new DatabaseSync(resolve(dbDir, file));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(db.prepare(`SELECT name FROM ${MARKER_TABLE}`).all().map((row) => row.name));
  const pending = migrations.filter((migration) => !applied.has(migration));
  console.log(`${file}: ${pending.length} pending of ${migrations.length} migrations`);
  for (const migration of pending) {
    const sql = readFileSync(resolve(migDir, migration), "utf8");
    db.exec("BEGIN");
    try {
      for (const statement of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) db.exec(statement);
      db.prepare(`INSERT INTO ${MARKER_TABLE} (name, applied_at) VALUES (?, ?)`).run(migration, new Date().toISOString());
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