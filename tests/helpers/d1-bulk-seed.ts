import { buildOpsSeedStatements } from "@/lib/ops/seed";
import type { OpsFixture } from "@/lib/ops/types";
import type { OpsRepository } from "@/lib/ops/repository";

/** Inlines one bound value as SQLite text; line breaks become char(10) because exec() splits on new lines. */
function literal(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''").replaceAll("\r", "").replaceAll("\n", "'||char(10)||'")}'`;
}

/**
 * Loads seed rows into a Miniflare D1 database in a few exec() calls. Each separately bound
 * statement costs about 5 ms in Miniflare, so seeding ~10,000 rows that way takes close to a
 * minute and times out setup hooks under parallel load. Only for building historical test data.
 */
export async function bulkSeedD1(db: { exec(sql: string): Promise<unknown> }, fixture: OpsFixture, options: { omitStoreContacts?: boolean } = {}) {
  const statements = buildOpsSeedStatements(fixture, options).map(({ sql, params }) => {
    let index = 0;
    return sql.replaceAll("\n", " ").replace(/\?/g, () => literal(params[index++]));
  });
  for (let index = 0; index < statements.length; index += 500) await db.exec(statements.slice(index, index + 500).join("\n"));
  return statements.length;
}

/**
 * The insert-only backfill on top of historical data, through the repository like a real start-up seed, but only
 * the rows the historical copy lacks. Re-sending rows that are already there does nothing (ON CONFLICT DO NOTHING)
 * and costs about 5 ms each in Miniflare, which pushed setup past its time limit.
 */
export async function backfillNewRows(repository: OpsRepository, fixture: OpsFixture, historical: OpsFixture, historicalOptions: { omitStoreContacts?: boolean } = {}) {
  const already = new Set(buildOpsSeedStatements(historical, historicalOptions).map(statement => JSON.stringify(statement)));
  const fresh = buildOpsSeedStatements(fixture).filter(statement => !already.has(JSON.stringify(statement)));
  if (process.env.SEED_DEBUG) process.stdout.write(`BACKFILL ${fresh.length} of ${already.size}\n`);
  for (let index = 0; index < fresh.length; index += 75) await repository.atomicWrite(fresh.slice(index, index + 75));
  return fresh.length;
}
