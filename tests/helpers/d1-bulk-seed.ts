import { buildOpsSeedStatements } from "@/lib/ops/seed";
import type { OpsFixture } from "@/lib/ops/types";

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
