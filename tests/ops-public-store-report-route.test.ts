import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => ({
  reportStoreIssue: vi.fn(),
}));

vi.mock("@/components/ops-public/server-gateway", () => ({
  getPublicOperationsGateway: () => ({ reportStoreIssue: gatewayMocks.reportStoreIssue }),
}));

import { POST } from "@/app/api/ops-public/store/[token]/report/route";

const command = {
  reporterName: "Avery Clerk",
  employeeId: "NFM-4102",
  problem: "The beer cave is warming.",
  urgency: "priority",
  area: "Beer cave",
  impact: {
    storeOperatingState: "partially_operational",
    safetyConcern: "none_reported",
    productInventoryRisk: "at_risk",
    customersAffected: "yes",
  },
};

function request(submissionKey?: string) {
  const formData = new FormData();
  formData.set("command", JSON.stringify(command));
  return new Request("https://operations.example/api/ops-public/store/token/report", {
    method: "POST",
    headers: submissionKey ? { "idempotency-key": submissionKey } : undefined,
    body: formData,
  });
}

describe("public store report route idempotency boundary", () => {
  beforeEach(() => {
    gatewayMocks.reportStoreIssue.mockReset();
    gatewayMocks.reportStoreIssue.mockResolvedValue({
      receiptId: "receipt-request-1",
      receivedAt: "2026-08-20T16:00:00.000Z",
      mode: "demo",
      heading: "Issue reported",
      message: "Issue received.",
      requestNumber: "REQ-0001",
      storeNumber: "104",
      evidenceReceived: 0,
      nextStep: "Manager review",
    });
  });

  it("passes the required header key into the gateway command", async () => {
    const submissionKey = "store-report-browser-retry-0001";
    const response = await POST(request(submissionKey), { params: Promise.resolve({ token: "store-token" }) });

    expect(response.status).toBe(201);
    expect(gatewayMocks.reportStoreIssue).toHaveBeenCalledWith("store-token", {
      ...command,
      evidence: [],
      submissionKey,
    });
  });

  it("rejects a report without a retry key before invoking the gateway", async () => {
    const response = await POST(request(), { params: Promise.resolve({ token: "store-token" }) });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "invalid_idempotency_key" });
    expect(gatewayMocks.reportStoreIssue).not.toHaveBeenCalled();
  });
});
