export interface DestructiveResetEnvironment {
  ALLOW_DESTRUCTIVE_RESET?: string;
  OPS_ENVIRONMENT?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
  OPS_RESET_DATABASE_CONFIRM?: string;
  RENDER?: string;
  RENDER_SERVICE_ID?: string;
}

export interface DestructiveResetTarget {
  databaseName: string;
  host: string;
  environment: "development" | "test" | "demo" | "local";
}

const allowedEnvironments = new Set<DestructiveResetTarget["environment"]>([
  "development",
  "test",
  "demo",
  "local",
]);

const protectedDatabaseNames = new Set(["postgres", "template0", "template1"]);

/**
 * Fail-closed guard shared by the reset CLI and its tests. A reset requires an
 * explicitly non-production environment, an opt-in flag, and confirmation of
 * the exact database name parsed from DATABASE_URL.
 */
export function assertDestructiveResetAllowed(
  environment: DestructiveResetEnvironment,
): DestructiveResetTarget {
  if (environment.ALLOW_DESTRUCTIVE_RESET !== "true") {
    throw new Error("Destructive reset is disabled. Set ALLOW_DESTRUCTIVE_RESET=true explicitly.");
  }

  const opsEnvironment = environment.OPS_ENVIRONMENT?.trim().toLocaleLowerCase("en-US");
  if (!opsEnvironment || !allowedEnvironments.has(opsEnvironment as DestructiveResetTarget["environment"])) {
    throw new Error("OPS_ENVIRONMENT must be development, test, demo, or local for a destructive reset.");
  }
  if (environment.NODE_ENV?.trim().toLocaleLowerCase("en-US") === "production") {
    throw new Error("Destructive reset is blocked when NODE_ENV=production.");
  }
  if (environment.RENDER || environment.RENDER_SERVICE_ID) {
    throw new Error("Destructive reset is blocked inside a Render service.");
  }

  const rawUrl = environment.DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("DATABASE_URL is required for PostgreSQL reset.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
  if (!databaseName || databaseName.includes("/") || protectedDatabaseNames.has(databaseName.toLocaleLowerCase("en-US"))) {
    throw new Error("Refusing to reset an empty, system, or ambiguous PostgreSQL database name.");
  }
  if (environment.OPS_RESET_DATABASE_CONFIRM !== databaseName) {
    throw new Error(`OPS_RESET_DATABASE_CONFIRM must exactly equal the target database name (${databaseName}).`);
  }

  return {
    databaseName,
    host: url.hostname,
    environment: opsEnvironment as DestructiveResetTarget["environment"],
  };
}
