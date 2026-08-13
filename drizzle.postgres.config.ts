import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle-postgres",
  schema: "./db/ops-schema-postgres.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://traceops:traceops@localhost:5432/traceops",
  },
});
