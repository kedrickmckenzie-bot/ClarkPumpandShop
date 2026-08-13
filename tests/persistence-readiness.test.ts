import { afterEach, describe, expect, it } from "vitest";
import { checkPersistenceReadiness } from "@/lib/server/persistence-readiness";

const originalRuntime = process.env.TRACEOPS_RUNTIME;
const originalRender = process.env.RENDER;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalRuntime === undefined) delete process.env.TRACEOPS_RUNTIME;
  else process.env.TRACEOPS_RUNTIME = originalRuntime;
  if (originalRender === undefined) delete process.env.RENDER;
  else process.env.RENDER = originalRender;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("persistence readiness", () => {
  it("fails cleanly on Render without importing the Cloudflare runtime", async () => {
    process.env.TRACEOPS_RUNTIME = "render";
    process.env.RENDER = "true";
    delete process.env.DATABASE_URL;

    await expect(checkPersistenceReadiness()).resolves.toEqual({
      ready: false,
      checks: { persistence: "missing DATABASE_URL" },
    });
  });
});
