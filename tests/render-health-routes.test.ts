import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkPersistenceReadiness } = vi.hoisted(() => ({
  checkPersistenceReadiness: vi.fn(),
}));

vi.mock("@/lib/server/persistence-readiness", () => ({
  checkPersistenceReadiness,
}));

import { GET as getHealth } from "@/app/api/health/route";
import { GET as getReadiness } from "@/app/api/ready/route";

describe("Render health routes", () => {
  beforeEach(() => {
    checkPersistenceReadiness.mockReset();
  });

  it("reports process liveness without probing dependencies", async () => {
    const response = await getHealth();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "traceops-convenience-suite",
    });
    expect(checkPersistenceReadiness).not.toHaveBeenCalled();
  });

  it("returns 200 only when persistence is ready", async () => {
    checkPersistenceReadiness.mockResolvedValue({
      ready: true,
      checks: { persistence: "ready" },
    });

    const response = await getReadiness();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "ready",
      checks: { persistence: "ready" },
    });
  });

  it("returns a safe 503 response when persistence is unavailable", async () => {
    checkPersistenceReadiness.mockRejectedValue(
      new Error("contains-private-connection-details"),
    );

    const response = await getReadiness();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "not_ready",
      checks: { persistence: "unavailable" },
    });
    expect(JSON.stringify(body)).not.toContain("private-connection-details");
  });
});
