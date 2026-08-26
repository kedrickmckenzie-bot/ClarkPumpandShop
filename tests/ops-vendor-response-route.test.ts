import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDomainError } from "@/lib/ops/errors";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
  resolveVendorResponse: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getOpsRequestContext, assertStoreInSessionScope: mocks.assertStoreInSessionScope };
});

vi.mock("@/lib/ops/vendor-response-continuation", () => ({
  resolveVendorResponse: mocks.resolveVendorResponse,
}));

import { POST } from "@/app/api/ops/vendor-response/route";

const organizationId = "org-northline-demo";
const response = {
  id: "response-current-113-proposed-date",
  organizationId,
  workOrderId: "wo-current-113-freezer-service",
};
const workOrder = { id: response.workOrderId, organizationId, storeId: "store-northline-113" };
const session = { organizationId, role: "regional", regionIds: ["region-northline-south"] };
const actor = { organizationId, actorType: "user" as const, actorId: "membership-northline-regional-2", actorName: "Regional operator" };

function requestFor(decision: string, scheduledFor?: string, returnTo = `/app/work-orders/${workOrder.id}?view=service`) {
  const form = new FormData();
  form.set("vendorResponseId", response.id);
  form.set("decision", decision);
  form.set("returnTo", returnTo);
  if (scheduledFor) form.set("scheduledFor", scheduledFor);
  return new Request("https://operations.test/api/ops/vendor-response", { method: "POST", body: form });
}

describe("operator vendor-response continuation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const repository = {
      getVendorResponse: vi.fn().mockResolvedValue(response),
      getWorkOrder: vi.fn().mockResolvedValue(workOrder),
      getOrganization: vi.fn().mockResolvedValue({ id: organizationId, timeZone: "America/Chicago" }),
    };
    mocks.getOpsRequestContext.mockResolvedValue({ session, repository, actor });
    mocks.assertStoreInSessionScope.mockResolvedValue({ id: workOrder.storeId, timeZone: "America/New_York" });
    mocks.resolveVendorResponse.mockResolvedValue({ appointment: { status: "counter_proposed" } });
  });

  it("enforces an operational role and store scope, then converts store-local time", async () => {
    const result = await POST(requestFor("counter_proposed_date", "2026-08-28T14:00"));
    const { repository } = await mocks.getOpsRequestContext.mock.results[0].value;

    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toContain("notice=Counterproposal+sent");
    expect(mocks.getOpsRequestContext).toHaveBeenCalledWith(["facilities", "regional"]);
    expect(mocks.assertStoreInSessionScope).toHaveBeenCalledWith(session, workOrder.storeId);
    expect(mocks.resolveVendorResponse).toHaveBeenCalledWith({ repository }, expect.objectContaining({
      organizationId,
      vendorResponseId: response.id,
      decision: "counter_proposed_date",
      scheduledFor: "2026-08-28T18:00:00.000Z",
      actor,
    }));
  });

  it("redirects a scoped form error back to the case without exposing raw JSON", async () => {
    mocks.assertStoreInSessionScope.mockRejectedValue(new OpsDomainError("FORBIDDEN", "Store is outside your assigned region."));
    const result = await POST(requestFor("accept_proposed_date"));

    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toContain("error=Store+is+outside+your+assigned+region");
    expect(mocks.resolveVendorResponse).not.toHaveBeenCalled();
  });

  it("does not trust an external return destination", async () => {
    const result = await POST(requestFor("reply_to_question", undefined, "https://evil.example/steal"));
    expect(result.headers.get("location")).toMatch(/^\/app\/work-orders\?/);
  });
});
