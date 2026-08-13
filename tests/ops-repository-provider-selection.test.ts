import { describe, expect, it } from "vitest";
import { selectOpsRepositoryBackend } from "@/lib/server/ops-repository-provider";
import {
  isLocalRenderDevelopment,
  isRenderNodeRuntime,
} from "@/lib/server/persistence-runtime";

describe("server ops repository selection policy", () => {
  it("prefers PostgreSQL whenever DATABASE_URL is configured", () => {
    expect(selectOpsRepositoryBackend({
      databaseUrl: "postgresql://example.invalid/traceops",
      d1Available: true,
      nodeEnv: "production",
    })).toBe("postgres");
  });

  it("keeps D1 as the hosted-preview adapter when PostgreSQL is not configured", () => {
    expect(selectOpsRepositoryBackend({
      d1Available: true,
      nodeEnv: "production",
    })).toBe("d1");
  });

  it("allows fixture state only in non-production development", () => {
    expect(selectOpsRepositoryBackend({
      databaseUrl: "   ",
      d1Available: false,
      nodeEnv: "development",
    })).toBe("fixture");
  });

  it("fails closed when production has no durable database", () => {
    expect(() => selectOpsRepositoryBackend({
      d1Available: false,
      nodeEnv: "production",
    })).toThrow(/requires.*database|PostgreSQL|D1/i);
  });

  it("distinguishes local Node preview from a deployed Render process", () => {
    expect(isRenderNodeRuntime({ TRACEOPS_RUNTIME: "render" })).toBe(true);
    expect(isLocalRenderDevelopment({ TRACEOPS_RUNTIME: "render", NODE_ENV: "development" })).toBe(true);
    expect(isLocalRenderDevelopment({ TRACEOPS_RUNTIME: "render", NODE_ENV: "production" })).toBe(false);
    expect(isLocalRenderDevelopment({ TRACEOPS_RUNTIME: "render", RENDER: "true" })).toBe(false);
  });
});
