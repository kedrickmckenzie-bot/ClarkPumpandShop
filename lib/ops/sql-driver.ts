import type { OpsStatement } from "./repository";

export type SqlRow = Record<string, unknown>;
export interface SqlResult<Row extends SqlRow = SqlRow> { rows: Row[]; affectedRows: number; }

/** Provider-neutral execution contract. Queries are parameterized SQL, never D1 objects. */
export interface OpsSqlDriver {
  readonly dialect: "sqlite" | "postgres";
  query<Row extends SqlRow = SqlRow>(statement: OpsStatement): Promise<SqlResult<Row>>;
  atomic(statements: readonly OpsStatement[]): Promise<void>;
}

/** Fragments accept only repository-owned column expressions, never request text. */
export function sqlJsonArrayText(dialect: OpsSqlDriver["dialect"], expression: string, index: number) {
  return dialect === "postgres" ? `(${expression}::jsonb ->> ${index})` : `json_extract(${expression}, '$[${index}]')`;
}

export function sqlStringAggregate(dialect: OpsSqlDriver["dialect"], expression: string) {
  return `${dialect === "postgres" ? "string_agg" : "group_concat"}(${expression}, '|')`;
}
