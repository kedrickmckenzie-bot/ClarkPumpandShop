import { NORTHLINE_ORGANIZATION_ID } from "./fixtures";

/** The parts of a Cloudflare D1 binding this reset uses. */
export interface D1ResetBinding {
  prepare(sql: string): { bind(...values: unknown[]): unknown; all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> };
  batch(statements: unknown[]): Promise<unknown>;
}

/**
 * Removes every row of the fictional demo tenant from a D1 database, in one transaction.
 * Schema, other tenants and stored uploads are kept. Foreign keys are checked at commit
 * (`defer_foreign_keys`), so the order of deletes does not matter.
 * Only ever called for the fictional preview tenant, before it is seeded fresh.
 */
export async function wipeD1DemoTenant(binding: D1ResetBinding) {
  const tables = (await binding.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ops\\_%' ESCAPE '\\'").all<{ name: string }>()).results ?? [];
  const scoped: string[] = [];
  for (const { name } of tables) {
    if (!/^ops_[a-z0-9_]+$/.test(name)) throw new Error("Unexpected table name in demo reset.");
    const columns = (await binding.prepare(`SELECT name FROM pragma_table_info('${name}')`).all<{ name: string }>()).results ?? [];
    if (columns.some(column => column.name === "organization_id")) scoped.push(name);
  }
  const deletes = scoped.map(name => binding.prepare(`DELETE FROM "${name}" WHERE organization_id = ?`).bind(NORTHLINE_ORGANIZATION_ID));
  await binding.batch([
    binding.prepare("PRAGMA defer_foreign_keys = on"),
    ...deletes,
    binding.prepare('DELETE FROM "ops_organizations" WHERE id = ?').bind(NORTHLINE_ORGANIZATION_ID),
  ]);
  return { tables: scoped.length };
}
