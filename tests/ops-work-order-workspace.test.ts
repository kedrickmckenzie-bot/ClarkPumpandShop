import { describe, expect, it } from "vitest";
import { resolveWorkOrderWorkspace } from "@/lib/ops/work-order-workspace";

const base = {
  activeBidRequestCount: 0,
  proposalCount: 0,
};

describe("stage-driven work-order workspace", () => {
  it("lets held work own the current workspace without exposing routing controls", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "provider_decision", heldStatus: "active", requestedPath: "direct" })).toBe("held");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "provider_decision", heldStatus: "claimed", requestedPath: "bids" })).toBe("held");
  });

  it("shows only the vendor-response decision when a date or question is pending", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "date_proposed", vendorResponseKind: "proposed_date" })).toBe("vendor_response");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "question_pending", vendorResponseKind: "question" })).toBe("vendor_response");
  });

  it("keeps accepted and scheduled work in a read-only vendor handoff", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "accepted", vendorResponseKind: "accepted", currentIssuanceRevision: 1 })).toBe("waiting_on_vendor");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "scheduled", vendorResponseKind: "accepted", currentIssuanceRevision: 1 })).toBe("waiting_on_vendor");
  });

  it("opens exactly the chosen sourcing path before assignment", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "provider_decision" })).toBe("choose_path");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "provider_decision", requestedPath: "direct" })).toBe("direct_service");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "provider_decision", requestedPath: "bids" })).toBe("bids");
  });

  it("routes active pricing and a selected service bid to the correct next workspace", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "authorization_or_bidding", activeBidRequestCount: 2 })).toBe("bids");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "authorization_or_bidding", selectedVendorName: "ColdLine", selectedDecisionKind: "service_bid" })).toBe("direct_service");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", selectedVendorName: "ColdLine", selectedDecisionKind: "replacement_quote" })).toBe("bids");
  });

  it("never exposes mutation workspaces after service has moved on or closed", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "onsite_service", requestedPath: "bids" })).toBe("current_record");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "followup_closeout", requestedPath: "direct" })).toBe("current_record");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "cost_invoice_evidence", requestedPath: "direct" })).toBe("current_record");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "closed", requestedPath: "direct" })).toBe("closed");
  });

  it("makes decline recovery an explicit new choice before opening another path", () => {
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "authorization_ready", vendorResponseKind: "declined" })).toBe("choose_path");
    expect(resolveWorkOrderWorkspace({ ...base, stage: "vendor_response_scheduling", serviceSubStage: "authorization_ready", vendorResponseKind: "declined", requestedPath: "direct" })).toBe("direct_service");
  });
});
