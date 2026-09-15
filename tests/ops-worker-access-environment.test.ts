import { describe, expect, it } from "vitest";
import { applyWorkerAccessEnvironment } from "@/lib/server/worker-access-environment";
import { isFictionalPreview, trustsSitesIdentity } from "@/lib/server/operator-access";

describe("Worker access bindings", () => {
  it("honors explicit hosted preview before the shared access policy runs", () => {
    const environment = { NODE_ENV: "production" };
    applyWorkerAccessEnvironment({ OPS_ACCESS_MODE: "preview" }, environment);
    expect(isFictionalPreview(environment)).toBe(true);
  });

  it("fails closed when bindings are absent and clears stale preview values", () => {
    const environment = { NODE_ENV: "production", OPS_ACCESS_MODE: "preview", OPS_IDENTITY_PROVIDER: "sites" };
    applyWorkerAccessEnvironment({}, environment);
    expect(isFictionalPreview(environment)).toBe(false);
    expect(trustsSitesIdentity(environment)).toBe(false);
  });

  it("preserves configured authentication without enabling preview", () => {
    const environment = { NODE_ENV: "production" };
    applyWorkerAccessEnvironment({ OPS_ACCESS_MODE: "authenticated", OPS_IDENTITY_PROVIDER: "sites" }, environment);
    expect(isFictionalPreview(environment)).toBe(false);
    expect(trustsSitesIdentity(environment)).toBe(true);
  });
});
