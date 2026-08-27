import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => ({
  addHeldWorkToVisit: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
}));

vi.mock("@/components/ops-public/server-gateway", () => ({
  getPublicOperationsGateway: () => gatewayMocks,
}));

vi.mock("@/components/ops-public/pending-visit-cookie", () => ({
  setPendingVisitCookie: vi.fn(),
  clearPendingVisitCookie: vi.fn(),
}));

import { POST as checkIn } from "@/app/api/ops-public/store/[token]/check-in/route";
import { POST as checkOut } from "@/app/api/ops-public/store/[token]/check-out/route";
import { POST as addActiveVisitWork } from "@/app/api/ops-public/store/[token]/active-visit-work/route";

const location = {
  captureResult: "captured" as const,
  capturedAt: "2026-08-27T14:00:00.000Z",
  latitude: 42.3314,
  longitude: -83.0458,
  accuracyM: 12,
};

describe("public held-work HTTP boundary", () => {
  beforeEach(() => {
    gatewayMocks.addHeldWorkToVisit.mockReset();
    gatewayMocks.checkIn.mockReset();
    gatewayMocks.checkOut.mockReset();
    gatewayMocks.checkIn.mockResolvedValue({
      receiptId: "receipt-held-check-in",
      receivedAt: "2026-08-27T14:00:01.000Z",
      mode: "demo",
      heading: "Checked in",
      message: "Visit started.",
      visitId: "visit-held-route-test",
      vendorName: "ClearFlow Plumbing & HVAC",
      technicianName: "Dana Ruiz",
      workOrders: [{ id: "wo-held-104-restroom-door", number: "CPS-2026-0401" }],
      crewCount: 1,
      additionalTechnicianNames: [],
      checkedInAt: "2026-08-27T14:00:01.000Z",
      checkoutUrl: "/public/store/checkout-token",
      checkoutExpiresAt: "2026-08-29T14:00:01.000Z",
      location: { result: "verified", label: "Location verified" },
    });
    gatewayMocks.checkOut.mockResolvedValue({
      receiptId: "receipt-held-check-out",
      receivedAt: "2026-08-27T15:00:00.000Z",
      mode: "demo",
      heading: "Checked out",
      message: "Visit recorded.",
    });
    gatewayMocks.addHeldWorkToVisit.mockResolvedValue({
      organizationName: "Clark Pump and Shop",
      vendorId: "vendor-northline-cedar",
      eligibleWorkOrders: [],
      heldWork: [],
      plannedServiceRuns: [],
      activeVisits: [],
    });
  });

  it("preserves selected held work through the check-in route schema", async () => {
    const response = await checkIn(new Request("https://operations.example/api/ops-public/store/store-token/check-in", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "held-route-check-in-0001" },
      body: JSON.stringify({
        vendorId: "vendor-northline-cedar",
        heldWorkOrderIds: ["wo-held-104-restroom-door"],
        noWorkOrderReason: "Routine plumbing visit",
        technicianName: "Dana Ruiz",
        crewCount: 1,
        location,
      }),
    }), { params: Promise.resolve({ token: "store-token" }) });

    expect(response.status).toBe(201);
    expect(gatewayMocks.checkIn).toHaveBeenCalledWith("store-token", expect.objectContaining({
      heldWorkOrderIds: ["wo-held-104-restroom-door"],
      submissionKey: "held-route-check-in-0001",
    }));
  });

  it("preserves temporary-repair timing through the check-out route schema", async () => {
    const formData = new FormData();
    formData.set("command", JSON.stringify({
      visitId: "visit-held-route-test",
      perWorkOrderOutcomes: [{
        workOrderId: "wo-held-104-restroom-door",
        outcome: "temporary_repair",
        outcomeNotes: "Adjusted the closer; replacement should be reviewed.",
        vendorFollowUpTiming: "within_30_days",
      }],
      location,
    }));
    const response = await checkOut(new Request("https://operations.example/api/ops-public/store/checkout-token/check-out", {
      method: "POST",
      headers: { "idempotency-key": "held-route-check-out-0001" },
      body: formData,
    }), { params: Promise.resolve({ token: "checkout-token" }) });

    expect(response.status).toBe(201);
    expect(gatewayMocks.checkOut).toHaveBeenCalledWith("checkout-token", expect.objectContaining({
      perWorkOrderOutcomes: [{
        workOrderId: "wo-held-104-restroom-door",
        outcome: "temporary_repair",
        outcomeNotes: "Adjusted the closer; replacement should be reviewed.",
        vendorFollowUpTiming: "within_30_days",
      }],
      submissionKey: "held-route-check-out-0001",
    }));
  });

  it("preserves approved work added after check-in through the HTTP route", async () => {
    const response = await addActiveVisitWork(new Request("https://operations.example/api/ops-public/store/checkout-token/active-visit-work", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "held-route-add-work-0001" },
      body: JSON.stringify({
        visitId: "visit-held-route-test",
        heldWorkOrderIds: ["wo-held-104-restroom-door"],
      }),
    }), { params: Promise.resolve({ token: "checkout-token" }) });

    expect(response.status).toBe(200);
    expect(gatewayMocks.addHeldWorkToVisit).toHaveBeenCalledWith("checkout-token", {
      visitId: "visit-held-route-test",
      heldWorkOrderIds: ["wo-held-104-restroom-door"],
      submissionKey: "held-route-add-work-0001",
    });
  });

  it("rejects unsupported workflow fields instead of silently discarding them", async () => {
    const response = await checkIn(new Request("https://operations.example/api/ops-public/store/store-token/check-in", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "held-route-unknown-0001" },
      body: JSON.stringify({
        vendorId: "vendor-northline-cedar",
        noWorkOrderReason: "Routine plumbing visit",
        technicianName: "Dana Ruiz",
        crewCount: 1,
        unsupportedWorkflowField: "must not disappear",
        location,
      }),
    }), { params: Promise.resolve({ token: "store-token" }) });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "invalid_request" });
    expect(gatewayMocks.checkIn).not.toHaveBeenCalled();
  });
});
