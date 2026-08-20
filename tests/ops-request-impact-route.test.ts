import { beforeEach, describe, expect, it, vi } from "vitest";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { OpsDomainError } from "@/lib/ops/errors";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getOpsRequestContext: vi.fn(),
  assertStoreInSessionScope: vi.fn(),
  reviewRequestImpactAssessment: vi.fn(),
}));

vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getOpsRequestContext, assertStoreInSessionScope: mocks.assertStoreInSessionScope };
});

vi.mock("@/lib/ops/request-impact-assessment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ops/request-impact-assessment")>("@/lib/ops/request-impact-assessment");
  return { ...actual, reviewRequestImpactAssessment: mocks.reviewRequestImpactAssessment };
});

import { POST } from "@/app/api/ops/requests/[id]/impact/route";

const serviceRequest = { id: "request-impact-route", organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-104", status: "submitted" };
const session = { organizationId: NORTHLINE_ORGANIZATION_ID, role: "facilities", storeIds: undefined, regionIds: undefined };
const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

function impactRequest() {
  const form = new FormData();
  form.set("expectedRequestStatus", "submitted");
  form.set("expectedLatestAssessmentId", "impact-initial-route");
  form.set("disposition", "revised");
  form.set("storeOperatingState", "partially_operational");
  form.set("safetyConcern", "potential");
  form.set("productInventoryRisk", "at_risk");
  form.set("productInventoryValue", "1250.50");
  form.set("customersAffected", "yes");
  form.set("complianceImpact", "potential");
  form.set("capacityUnavailablePercent", "25.5");
  form.set("redundantEquipment", "no");
  form.set("revenueFunctionImpact", "refrigerated_merchandise");
  form.set("estimatedDailyRevenueExposure", "2400");
  form.set("estimatedDowntimeMinutes", "180");
  form.set("confidence", "high");
  form.set("impactNotes", "Manager verified the operating facts.");
  return new Request(`https://operations.test/api/ops/requests/${serviceRequest.id}/impact`, { method: "POST", body: form });
}

describe("request impact review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const repository = { getRequest: vi.fn().mockResolvedValue(serviceRequest) };
    mocks.getOpsRequestContext.mockResolvedValue({ session, repository, actor });
    mocks.assertStoreInSessionScope.mockResolvedValue({ id: serviceRequest.storeId });
    mocks.reviewRequestImpactAssessment.mockResolvedValue({ id: "impact-review-route" });
  });

  it("uses membership context and store scope before invoking the atomic review command", async () => {
    const response = await POST(impactRequest(), { params: Promise.resolve({ id: serviceRequest.id }) });
    const { repository } = await mocks.getOpsRequestContext.mock.results[0].value;

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/app/requests/${serviceRequest.id}?updated=impact-review`);
    expect(mocks.getOpsRequestContext).toHaveBeenCalledWith(["facilities", "regional", "store_manager"]);
    expect(mocks.assertStoreInSessionScope).toHaveBeenCalledWith(session, serviceRequest.storeId);
    expect(mocks.reviewRequestImpactAssessment).toHaveBeenCalledWith({ repository }, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      requestId: serviceRequest.id,
      expectedRequestStatus: "submitted",
      expectedLatestAssessmentId: "impact-initial-route",
      disposition: "revised",
      assessment: expect.objectContaining({
        storeOperatingState: "partially_operational",
        productInventoryValueMinor: 125_050,
        capacityUnavailableBps: 2_550,
        estimatedDailyRevenueExposureMinor: 240_000,
        estimatedDowntimeMinutes: 180,
        source: "manager_review",
      }),
      actor,
    });
  });

  it("fails closed on store scope before the domain command", async () => {
    mocks.assertStoreInSessionScope.mockRejectedValue(new OpsDomainError("FORBIDDEN", "Store is outside your assigned scope."));
    const response = await POST(impactRequest(), { params: Promise.resolve({ id: serviceRequest.id }) });
    expect(response.status).toBe(403);
    expect(mocks.reviewRequestImpactAssessment).not.toHaveBeenCalled();
  });
});
