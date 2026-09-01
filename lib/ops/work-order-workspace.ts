import type { WorkOrderCanonicalStageId, WorkOrderServiceSubStage } from "./work-order-case";

export type WorkOrderServicePath = "direct" | "bids";

export type WorkOrderWorkspaceMode =
  | "held"
  | "closed"
  | "vendor_response"
  | "waiting_on_vendor"
  | "choose_path"
  | "direct_service"
  | "bids"
  | "current_record";

export interface WorkOrderWorkspaceInput {
  stage: WorkOrderCanonicalStageId;
  serviceSubStage?: WorkOrderServiceSubStage;
  heldStatus?: "active" | "claimed" | "review_required" | "completed" | "cancelled";
  vendorResponseKind?: "accepted" | "declined" | "proposed_date" | "question";
  activeBidRequestCount: number;
  proposalCount: number;
  selectedVendorName?: string;
  selectedDecisionKind?: "service_bid" | "replacement_quote";
  currentIssuanceRevision?: number;
  requestedPath?: WorkOrderServicePath;
}

/**
 * Selects the ONE operator workspace that owns the current service step.
 * The case page may still show read-only history from other subsystems, but it
 * must never render competing mutation surfaces at the same time.
 */
export function resolveWorkOrderWorkspace(input: WorkOrderWorkspaceInput): WorkOrderWorkspaceMode {
  if (input.heldStatus && ["active", "claimed", "review_required"].includes(input.heldStatus)) return "held";
  if (input.stage === "closed") return "closed";

  if (input.stage === "vendor_response_scheduling") {
    if (input.selectedDecisionKind === "replacement_quote") return "bids";
    if (
      (input.serviceSubStage === "date_proposed" && input.vendorResponseKind === "proposed_date")
      || (input.serviceSubStage === "question_pending" && input.vendorResponseKind === "question")
    ) return "vendor_response";
    if (input.vendorResponseKind === "declined" || input.serviceSubStage === "authorization_ready") {
      if (input.requestedPath === "direct") return "direct_service";
      if (input.requestedPath === "bids") return "bids";
      return "choose_path";
    }
    return "waiting_on_vendor";
  }

  if (input.stage === "provider_decision") {
    if (input.requestedPath === "direct") return "direct_service";
    if (input.requestedPath === "bids") return "bids";
    if (input.activeBidRequestCount > 0 || input.proposalCount > 0) return "bids";
    return "choose_path";
  }

  if (input.stage === "authorization_or_bidding") {
    if (input.selectedDecisionKind === "replacement_quote") return "bids";
    if (input.selectedVendorName && !input.currentIssuanceRevision) return "direct_service";
    if (input.activeBidRequestCount > 0 || input.proposalCount > 0) return "bids";
    if (input.requestedPath === "bids") return "bids";
    return "direct_service";
  }

  return "current_record";
}
