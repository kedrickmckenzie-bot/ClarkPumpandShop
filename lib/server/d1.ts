import { env } from "cloudflare:workers";

export const ORGANIZATION_ID = "org-clarks";

export function getD1(): D1Database {
  const bindings = env as unknown as { DB?: D1Database };
  if (!bindings.DB) throw new Error("D1 binding DB is unavailable");
  return bindings.DB;
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
