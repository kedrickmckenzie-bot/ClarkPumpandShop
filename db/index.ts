import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as legacySchema from "./schema";
import * as opsSchema from "./ops-schema";

const schema = { ...legacySchema, ...opsSchema };

export function getD1Binding() {
  const bindings = env as unknown as { DB?: D1Database };
  return bindings.DB;
}

export function getDb() {
  const binding = getD1Binding();

  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(binding, { schema });
}
