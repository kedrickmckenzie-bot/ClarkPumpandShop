import { createOpsSqlRepository } from "./sql-repository";
import type { OpsSqlDriver } from "./sql-driver";
import type { OpsStatement } from "./repository";
import { bindPostgresStatement } from "./postgres-parameters";
type PostgresRow = Record<string, unknown>;

export interface PostgresQueryResult<Row extends PostgresRow = PostgresRow> {
  rows: Row[];
  rowCount?: number | null;
}

export interface PostgresQueryableLike {
  query<Row extends PostgresRow = PostgresRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<Row>>;
}

export interface PostgresClientLike extends PostgresQueryableLike {
  release(): void;
}

export interface PostgresPoolLike extends PostgresQueryableLike {
  connect(): Promise<PostgresClientLike>;
  end?(): Promise<void>;
}

function postgresDriver(queryable: PostgresQueryableLike, atomic: (statements: readonly OpsStatement[]) => Promise<void>): OpsSqlDriver {
  return {
    dialect: "postgres",
    async query<Row extends PostgresRow>({ sql, params }: OpsStatement) {
      const statement = bindPostgresStatement(sql, params);
      const result = await queryable.query<Row>(statement.text, statement.values);
      return { rows: result.rows, affectedRows: result.rowCount ?? result.rows.length };
    },
    atomic,
  };
}

async function executeStatements(queryable: PostgresQueryableLike, statements: readonly OpsStatement[]) {
  for (const { sql, params } of statements) {
    const statement = bindPostgresStatement(sql, params);
    await queryable.query(statement.text, statement.values);
  }
}

/** Reuse the caller's transaction; never nest BEGIN/COMMIT. */
export function createOpsPostgresTransactionRepository(client: PostgresClientLike) {
  return createOpsSqlRepository(postgresDriver(client, statements => executeStatements(client, statements)), "postgres");
}

/** Native PostgreSQL driver: no D1 types, prepared-statement emulation or SQL rewriting. */
export function createOpsPostgresRepository(pool: PostgresPoolLike) {
  return createOpsSqlRepository(postgresDriver(pool, async statements => {
    if (!statements.length) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await executeStatements(client, statements);
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally {
      client.release();
    }
  }), "postgres");
}