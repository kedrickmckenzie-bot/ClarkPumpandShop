import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDomainError } from "@/lib/ops/errors";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
  acknowledgeServiceRequest: vi.fn(),
  linkServiceRequestToWorkOrder: vi.fn(),
  requestAcknowledgedServiceRequestFollowUp: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getOpsRequestContext, assertStoreInSessionScope: mocks.assertStoreInSessionScope };
});

vi.mock("@/lib/ops/commands", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ops/commands")>("@/lib/ops/commands");
  return {
    ...actual,
    acknowledgeServiceRequest: mocks.acknowledgeServiceRequest,
    linkServiceRequestToWorkOrder: mocks.linkServiceRequestToWorkOrder,
    requestAcknowledgedServiceRequestFollowUp: mocks.requestAcknowledgedServiceRequestFollowUp,
  };
});

import { POST as acknowledge } from "@/app/api/ops/requests/[id]/acknowledge/route";
import { POST as link } from "@/app/api/ops/requests/[id]/link/route";
import { POST as followUp } from "@/app/api/ops/requests/[id]/follow-up/route";

const serviceRequest = {
  id: "request-route-ack",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  storeId: "store-northline-101",
  status: "submitted",
};
const session = { organizationId: NORTHLINE_ORGANIZATION_ID, role: "facilities", storeIds: undefined, regionIds: undefined };
const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

function post(path: string, fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request(`https://operations.test${path}`, { method: "POST", body: form });
}

describe("request acknowledgment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const repository = { getRequest: vi.fn().mockResolvedValue(serviceRequest) };
    mocks.getOpsRequestContext.mockResolvedValue({ session, repository, actor });
    mocks.assertStoreInSessionScope.mockResolvedValue({ id: serviceRequest.storeId });
    mocks.acknowledgeServiceRequest.mockResolvedValue({ ...serviceRequest, status: "acknowledged" });
    mocks.linkServiceRequestToWorkOrder.mockResolvedValue({ ...serviceRequest, status: "acknowledged", linkedWorkOrderId: "wo-route" });
    mocks.requestAcknowledgedServiceRequestFollowUp.mockResolvedValue({ request: { ...serviceRequest, status: "under_review" }, task: { id: "task-route" } });
  });

  it("requires review capability and store scope for the one-click acknowledgment", async () => {
    const response = await acknowledge(post(`/api/ops/requests/${serviceRequest.id}/acknowledge`, { expectedStatus: "submitted" }), { params: Promise.resolve({ id: serviceRequest.id }) });
    const { repository } = await mocks.getOpsRequestContext.mock.results[0].value;
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/app/requests/${serviceRequest.id}?updated=request-acknowledged`);
    expect(mocks.getOpsRequestContext).toHaveBeenCalledWith(["facilities", "regional", "store_manager"], "review_request");
    expect(mocks.assertStoreInSessionScope).toHaveBeenCalledWith(session, serviceRequest.storeId);
    expect(mocks.acknowledgeServiceRequest).toHaveBeenCalledWith({ repository }, {
      organizationId: NORTHLINE_ORGANIZATION_ID, requestId: serviceRequest.id, expectedStatus: "submitted", actor,
    });
  });

  it("does not preselect work and passes an explicit correction reason and safe return context", async () => {
    const missingChoice = await link(post(`/api/ops/requests/${serviceRequest.id}/link`, { expectedStatus: "submitted" }), { params: Promise.resolve({ id: serviceRequest.id }) });
    expect(missingChoice.status).toBe(422);
    expect(mocks.linkServiceRequestToWorkOrder).not.toHaveBeenCalled();

    const response = await link(post(`/api/ops/requests/${serviceRequest.id}/link`, {
      expectedStatus: "acknowledged",
      workOrderId: "wo-route",
      correctionReason: "The equipment photo confirms this is the other open job.",
      returnTo: `/app/requests/${serviceRequest.id}?from=queue`,
    }), { params: Promise.resolve({ id: serviceRequest.id }) });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(`/app/requests/${serviceRequest.id}`);
    expect(response.headers.get("location")).toContain("from=queue");
    expect(mocks.linkServiceRequestToWorkOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requestId: serviceRequest.id, workOrderId: "wo-route", expectedStatus: "acknowledged",
      correctionReason: "The equipment photo confirms this is the other open job.", actor,
    }));
  });

  it("requires a follow-up explanation and fails closed before mutation when store scope is denied", async () => {
    const missingReason = await followUp(post(`/api/ops/requests/${serviceRequest.id}/follow-up`, {}), { params: Promise.resolve({ id: serviceRequest.id }) });
    expect(missingReason.status).toBe(422);
    expect(mocks.requestAcknowledgedServiceRequestFollowUp).not.toHaveBeenCalled();

    mocks.assertStoreInSessionScope.mockRejectedValue(new OpsDomainError("FORBIDDEN", "Store is outside your assigned scope."));
    const denied = await acknowledge(post(`/api/ops/requests/${serviceRequest.id}/acknowledge`, { expectedStatus: "submitted" }), { params: Promise.resolve({ id: serviceRequest.id }) });
    expect(denied.status).toBe(403);
    expect(mocks.acknowledgeServiceRequest).not.toHaveBeenCalled();
  });
});
