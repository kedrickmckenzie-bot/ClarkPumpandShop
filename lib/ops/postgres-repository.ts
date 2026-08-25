import { createOpsSqlRepository } from "./d1-repository";
import type { OpsRepository } from "./repository";

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

const BOOLEAN_COLUMNS = new Map<string, ReadonlySet<string>>([
  ["ops_stores", new Set(["location_policy_enabled"])],
  ["ops_taxonomy_nodes", new Set(["active"])],
  ["ops_equipment_templates", new Set(["active"])],
  ["ops_vendors", new Set(["preferred"])],
  ["ops_vendor_qualifications", new Set(["pm_work", "emergency_response", "warranty_work", "after_hours"])],
  ["ops_vendor_compliance_documents", new Set(["blocking"])],
  ["ops_contract_versions", new Set(["preferred_provider", "exclusive_provider", "reactive_work_allowed", "emergency_work_allowed", "pm_work_allowed"])],
  ["ops_contract_scopes", new Set(["included"])],
  ["ops_vendor_capacity", new Set(["blackout"])],
  ["ops_pm_plans", new Set(["active"])],
  ["ops_checklist_responses", new Set(["passed"])],
  ["ops_service_run_work_orders", new Set(["planned", "addressed"])],
  ["ops_repair_items", new Set(["vendor_supplied"])],
  ["ops_warranty_amendments", new Set(["applies_to_repair_only"])],
  ["ops_warranty_cases", new Set(["diagnosis_required", "invoice_hold"])],
  ["ops_replacement_profiles", new Set(["active"])],
]);

function replaceQuestionMarkParameters(sql: string) {
  let result = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (quote) {
      result += character;
      if (character === quote) {
        if (next === quote) {
          result += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
    } else if (character === "?") {
      parameter += 1;
      result += `$${parameter}`;
    } else {
      result += character;
    }
  }

  return result;
}

function booleanInsertValues(sql: string, values: readonly unknown[]) {
  const match = sql.match(/^\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([a-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match) return values;

  const booleanColumns = BOOLEAN_COLUMNS.get(match[1].toLocaleLowerCase("en-US"));
  if (!booleanColumns) return values;

  const columns = match[2].split(",").map((column) => column.trim().replace(/^['"]|['"]$/g, "").toLocaleLowerCase("en-US"));
  return values.map((value, index) => {
    if (!booleanColumns.has(columns[index]) || typeof value === "boolean" || value == null) return value;
    if (value === 0 || value === "0") return false;
    if (value === 1 || value === "1") return true;
    return value;
  });
}

export function translateOpsSqlForPostgres(
  sql: string,
  params: readonly unknown[] = [],
): { text: string; values: readonly unknown[] } {
  const insertOrIgnore = /^\s*INSERT\s+OR\s+IGNORE\b/i.test(sql);
  let text = sql
    .replace(/^\s*INSERT\s+OR\s+IGNORE\b/i, "INSERT")
    .replace(/\bgroup_concat\s*\(([^,()]+),\s*([^()]+)\)/gi, "string_agg($1, $2)")
    // PostgreSQL treats an unqualified column shared by the target table and
    // EXCLUDED as ambiguous inside ON CONFLICT. SQLite resolves this update
    // expression to the current counter row.
    .replace(
      /SET\s+next_value\s*=\s*next_value\s*\+\s*1/i,
      "SET next_value = ops_work_order_counters.next_value + 1",
    );

  if (insertOrIgnore) {
    const returning = text.match(/\s+RETURNING\s+/i);
    if (returning?.index !== undefined) {
      text = `${text.slice(0, returning.index)} ON CONFLICT DO NOTHING${text.slice(returning.index)}`;
    } else {
      text = `${text.trimEnd()} ON CONFLICT DO NOTHING`;
    }
  }

  return {
    text: replaceQuestionMarkParameters(text),
    values: booleanInsertValues(sql, params),
  };
}

function compatibilityResult<Row extends PostgresRow>(rows: Row[]) {
  return { results: rows, success: true, meta: {} };
}

class PostgresPreparedStatement {
  readonly params: readonly unknown[];

  constructor(
    readonly sql: string,
    private readonly queryable: PostgresQueryableLike,
    params: readonly unknown[] = [],
  ) {
    this.params = params;
  }

  bind(...params: unknown[]) {
    return new PostgresPreparedStatement(this.sql, this.queryable, params);
  }

  private async execute<Row extends PostgresRow>() {
    const query = translateOpsSqlForPostgres(this.sql, this.params);
    return this.queryable.query<Row>(query.text, query.values);
  }

  async first<Row extends PostgresRow>() {
    const result = await this.execute<Row>();
    return result.rows[0] ?? null;
  }

  async all<Row extends PostgresRow>() {
    const result = await this.execute<Row>();
    return compatibilityResult(result.rows);
  }

  async run<Row extends PostgresRow>() {
    const result = await this.execute<Row>();
    // Surface affected-row counts through the D1-compatible meta shape so
    // callers that branch on meta.changes (claims, deletes) behave identically
    // on PostgreSQL.
    return { ...compatibilityResult(result.rows), meta: result.rowCount != null ? { changes: result.rowCount } : {} };
  }

  async raw<Row extends unknown[]>() {
    const result = await this.execute<PostgresRow>();
    return result.rows.map((row) => Object.values(row)) as Row[];
  }
}

class PostgresD1CompatibilityBinding {
  constructor(private readonly pool: PostgresPoolLike) {}

  prepare(sql: string) {
    return new PostgresPreparedStatement(sql, this.pool);
  }

  async batch(statements: readonly PostgresPreparedStatement[]) {
    if (statements.length === 0) return [];
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) {
        const query = translateOpsSqlForPostgres(statement.sql, statement.params);
        const result = await client.query(query.text, query.values);
        results.push(compatibilityResult(result.rows));
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the domain/database failure that caused the rollback.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Reuse an already-open transaction without nesting BEGIN/COMMIT. */
export function createOpsPostgresTransactionRepository(
  client: PostgresClientLike,
): OpsRepository {
  const binding = {
    prepare(sql: string) {
      return new PostgresPreparedStatement(sql, client);
    },
    async batch(statements: readonly PostgresPreparedStatement[]) {
      const results = [];
      for (const statement of statements) {
        const query = translateOpsSqlForPostgres(statement.sql, statement.params);
        const result = await client.query(query.text, query.values);
        results.push(compatibilityResult(result.rows));
      }
      return results;
    },
  };
  return createOpsSqlRepository(binding as unknown as D1Database, "postgres");
}

/**
 * PostgreSQL shares the domain read/write contract with the D1 adapter. Only
 * bind syntax, a small SQL dialect surface, and transaction execution differ.
 */
export function createOpsPostgresRepository(pool: PostgresPoolLike): OpsRepository {
  const compatibilityBinding = new PostgresD1CompatibilityBinding(pool);
  return createOpsSqlRepository(compatibilityBinding as unknown as D1Database, "postgres");
}
