import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("server memory guards", () => {
  it("reuses Intl formatters instead of constructing one per formatted value", () => {
    const offenders = ["app", "components", "lib"].flatMap(sourceFiles)
      .filter((path) => !path.endsWith("intl-format-cache.ts"))
      .filter((path) => /new Intl\.(DateTimeFormat|NumberFormat)\(/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("routes every PostgreSQL presenter snapshot through the shared change-checked copy", () => {
    const provider = readFileSync("lib/server/ops-repository-provider.ts", "utf8");
    const direct = provider.match(/return loadOpsFixtureSnapshotFromPostgres\(/g) ?? [];
    expect(direct).toEqual([]);
    expect(provider.match(/readCachedPostgresSnapshot\(pool, organizationId, "(full|trends)"/g)).toHaveLength(2);
  });
});
