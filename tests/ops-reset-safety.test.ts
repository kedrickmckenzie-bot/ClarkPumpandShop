import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertDestructiveResetAllowed } from "@/lib/ops/reset-safety";

const allowed = {
  ALLOW_DESTRUCTIVE_RESET: "true",
  OPS_ENVIRONMENT: "development",
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://ops:secret@localhost:5432/traceops_dev",
  OPS_RESET_DATABASE_CONFIRM: "traceops_dev",
};

describe("destructive reset safety", () => {
  it("requires explicit authorization and exact target confirmation", () => {
    expect(() => assertDestructiveResetAllowed({ ...allowed, ALLOW_DESTRUCTIVE_RESET: undefined })).toThrow(/disabled/i);
    expect(() => assertDestructiveResetAllowed({ ...allowed, OPS_RESET_DATABASE_CONFIRM: "another_database" })).toThrow(/exactly equal/i);
  });

  it("blocks production and hosted Render environments", () => {
    expect(() => assertDestructiveResetAllowed({ ...allowed, NODE_ENV: "production" })).toThrow(/production/i);
    expect(() => assertDestructiveResetAllowed({ ...allowed, RENDER_SERVICE_ID: "srv-production" })).toThrow(/Render/i);
    expect(() => assertDestructiveResetAllowed({ ...allowed, OPS_ENVIRONMENT: "production" })).toThrow(/OPS_ENVIRONMENT/i);
  });

  it("rejects system databases and returns a resolved safe target", () => {
    expect(() => assertDestructiveResetAllowed({
      ...allowed,
      DATABASE_URL: "postgresql://ops:secret@localhost:5432/postgres",
      OPS_RESET_DATABASE_CONFIRM: "postgres",
    })).toThrow(/system/i);
    expect(assertDestructiveResetAllowed(allowed)).toEqual({
      databaseName: "traceops_dev",
      host: "localhost",
      environment: "development",
    });
  });

  it("guards before connecting or dropping and resets both application schemas", () => {
    const source = readFileSync(new URL("../scripts/reset-postgres.ts", import.meta.url), "utf8");
    const guardAt = source.indexOf("assertDestructiveResetAllowed(process.env)");
    const connectAt = source.indexOf("getPostgresPool()");
    const dropDrizzleAt = source.indexOf("DROP SCHEMA IF EXISTS drizzle CASCADE");
    const dropPublicAt = source.indexOf("DROP SCHEMA public CASCADE");

    expect(guardAt).toBeGreaterThan(-1);
    expect(connectAt).toBeGreaterThan(guardAt);
    expect(dropDrizzleAt).toBeGreaterThan(connectAt);
    expect(dropPublicAt).toBeGreaterThan(dropDrizzleAt);
    expect(source).toContain("SELECT current_database()");
    expect(source).toContain("Verified one Northline organization, 15 stores, and five approved outside vendors.");
  });
});
