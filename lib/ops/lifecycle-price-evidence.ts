import type { OpsFixture, WorkOrder, Money } from "./types";

export interface LifecycleQuoteEvidence {
  id: string; vendor: string; amount: string; scope: string; exclusions: string;
  timing: string; status: string; href: string;
}
export const priceLabel = (amount?: Money) => amount ? new Intl.NumberFormat("en-US", { style: "currency", currency: amount.currency }).format(amount.amountMinor / 100) : "Price needed";

/** An approval pins a proposal revision and amount. A newer quote or company benchmark cannot overwrite it. */
export function lifecyclePriceEvidence(fixture: OpsFixture, work: WorkOrder | undefined, planning?: Money) {
  const org = work?.organizationId;
  const requests = work ? fixture.estimateRequests.filter((row) => row.organizationId === org && row.workOrderId === work.id && row.decisionKind === "replacement_quote") : [];
  const proposals = work ? fixture.estimateProposals.filter((row) => row.organizationId === org && row.workOrderId === work.id && requests.some((request) => request.id === row.requestId && request.vendorId === row.vendorId)) : [];
  const event = work ? fixture.replacementEvents.filter((row) => row.organizationId === org && row.workOrderId === work.id && row.assetId === work.assetId && row.status !== "cancelled").sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || b.id.localeCompare(a.id))[0] : undefined;
  const approved = event ? proposals.find((row) => row.id === event.sourceEstimateProposalId) : undefined;
  const quotes: LifecycleQuoteEvidence[] = requests.flatMap((request) => {
    const proposal = approved?.requestId === request.id ? approved : proposals.filter((row) => row.requestId === request.id).sort((a, b) => b.revision - a.revision || b.submittedAt.localeCompare(a.submittedAt))[0];
    if (!proposal) return [];
    const pinned = approved?.id === proposal.id;
    const expired = proposal.validUntil && proposal.validUntil < fixture.asOf;
    return [{ id: proposal.id, vendor: fixture.vendors.find((row) => row.organizationId === org && row.id === proposal.vendorId)?.name ?? "Vendor unavailable", amount: priceLabel(pinned ? event!.approvedAmount : proposal.amount), scope: proposal.scope || "Scope not recorded", exclusions: proposal.exclusions || "Exclusions not recorded — confirm before approval", timing: proposal.leadTimeDays === undefined ? "Availability not recorded" : `${proposal.leadTimeDays}-day quoted lead time; confirm the installation date`, status: pinned ? "Approved quote" : request.status === "not_selected" ? "Not selected" : ["withdrawn", "declined", "expired"].includes(request.status) ? request.status : expired ? "Quote expired" : request.status === "selected" ? "Selected; approval not recorded" : "Quote received", href: `/app/work-orders/${work!.id}?view=service&path=bids#quote-proposal-${proposal.id}` }];
  });
  const selected = proposals.filter((proposal) => requests.some((request) => request.id === proposal.requestId && request.status === "selected")).sort((a, b) => b.revision - a.revision || b.submittedAt.localeCompare(a.submittedAt))[0];
  const replacement = event?.approvedAmount ?? selected?.amount;
  return {
    replacement, replacementLabel: priceLabel(replacement), replacementBasis: event ? "Approved replacement" : selected ? "Selected replacement quote" : "Replacement quote",
    planningLabel: priceLabel(planning), approvedVendor: approved ? quotes.find((quote) => quote.id === approved.id)?.vendor : undefined,
    scope: approved?.scope ?? selected?.scope ?? "A replacement scope has not been selected. Review the quotes below.",
    approvedAt: event?.approvedAt, finalAmount: event?.status === "completed" && event.finalAmount ? priceLabel(event.finalAmount) : undefined,
    missing: event && !approved ? "The approved amount is recorded, but its original quote details are unavailable." : undefined,
    quotes,
  };
}
