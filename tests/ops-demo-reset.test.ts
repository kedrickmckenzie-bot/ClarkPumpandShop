import { beforeEach, describe, expect, it, vi } from "vitest";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  isFictionalPreview: vi.fn(),
  resetDemoData: vi.fn(),
  getMembership: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getOpsRequestContext };
});
vi.mock("@/lib/server/operator-access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/operator-access")>("@/lib/server/operator-access");
  return { ...actual, isFictionalPreview: mocks.isFictionalPreview };
});
vi.mock("@/lib/server/demo-reset", () => ({ resetDemoData: mocks.resetDemoData }));

import { POST } from "@/app/api/ops/demo/reset/route";

const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

function post(confirm: string) {
  const form = new FormData();
  form.set("confirm", confirm);
  return new Request("http://localhost/api/ops/demo/reset", { method: "POST", body: form });
}

describe("demo reset button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFictionalPreview.mockReturnValue(true);
    mocks.getMembership.mockResolvedValue({ role: "facilities_admin" });
    mocks.getOpsRequestContext.mockResolvedValue({
      session: { organizationId: NORTHLINE_ORGANIZATION_ID, role: "facilities" },
      repository: { getMembership: mocks.getMembership },
      actor,
    });
    mocks.resetDemoData.mockResolvedValue({ resetAt: "2026-10-07T12:00:00.000Z" });
  });

  it("resets for the top admin in the demo after RESET is typed", async () => {
    const response = await POST(post("reset"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/app/admin?demoReset=2026-10-07");
    expect(mocks.resetDemoData).toHaveBeenCalledOnce();
  });

  it("refuses outside the demo, before reading the session", async () => {
    mocks.isFictionalPreview.mockReturnValue(false);
    const response = await POST(post("RESET"));
    expect(response.status).toBe(403);
    expect(mocks.getOpsRequestContext).not.toHaveBeenCalled();
    expect(mocks.resetDemoData).not.toHaveBeenCalled();
  });

  it("refuses without the typed confirmation", async () => {
    const response = await POST(post("yes"));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.resetDemoData).not.toHaveBeenCalled();
  });

  it("refuses anyone but the top admin", async () => {
    mocks.getMembership.mockResolvedValue({ role: "regional_manager" });
    expect((await POST(post("RESET"))).status).toBe(403);
    mocks.getMembership.mockResolvedValue({ role: "facilities_admin" });
    mocks.getOpsRequestContext.mockResolvedValue({ session: { organizationId: NORTHLINE_ORGANIZATION_ID, role: "facilities", persona: "field_manager" }, repository: { getMembership: mocks.getMembership }, actor });
    expect((await POST(post("RESET"))).status).toBe(403);
    expect(mocks.resetDemoData).not.toHaveBeenCalled();
  });
});
