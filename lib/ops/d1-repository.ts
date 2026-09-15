import type { OpsSqlDriver } from "./sql-driver";
import { createOpsSqlRepository } from "./sql-repository";

/** Cloudflare types and prepared statements stay inside the D1 adapter. */
export function createOpsD1Repository(db: D1Database) {
  const driver: OpsSqlDriver = {
    dialect: "sqlite",
    async query<Row extends Record<string, unknown>>({ sql, params }: import("./repository").OpsStatement) {
      const result = await db.prepare(sql).bind(...params).all<Row>();
      return { rows: result.results ?? [], affectedRows: Number(result.meta?.changes ?? result.results?.length ?? 0) };
    },
    async atomic(statements) {
      if (statements.length) await db.batch(statements.map(({ sql, params }) => db.prepare(sql).bind(...params)));
    },
  };
  return createOpsSqlRepository(driver, "d1");
}
