import type { OpsFixture } from "./types";

/**
 * Vendor scorecards computed entirely from source records — no hand-entered
 * ratings. Every number drills back to Visits, Work Order Verifications, and
 * Invoice Exceptions. Rates are withheld (null) when the sample is too small
 * to be fair to the vendor.
 */

export interface VendorScorecard {
  vendorId: string;
  vendorName: string;
  workOrdersAssigned: number;
  visitsCompleted: number;
  responsesTotal: number;
  responsesAccepted: number;
  /** accepted / total responses; null below the small-sample floor. */
  acceptanceRate: number | null;
  outcomesRecorded: number;
  verificationsVerified: number;
  verificationsRejected: number;
  /** verified / (verified + rejected); null below the small-sample floor. */
  verificationPassRate: number | null;
  responsesDeclined: number;
  openFollowUpCount: number;
  openInvoiceExceptionCount: number;
  openInvoiceExceptionAmountMinor: number;
  currency: string;
}

const SMALL_SAMPLE_FLOOR = 5;

export function buildVendorScorecards(
  fixture: Pick<OpsFixture, "vendors" | "assignments" | "visits" | "siteVisitWorkOrders" | "workOrderVerifications" | "invoices" | "invoiceExceptions" | "vendorResponses" | "followUps">,
  organizationId: string,
): VendorScorecard[] {
  const vendors = fixture.vendors.filter((row) => row.organizationId === organizationId);
  const assignments = fixture.assignments.filter((row) => row.organizationId === organizationId);
  const visits = fixture.visits.filter((row) => row.organizationId === organizationId);
  const outcomes = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId);
  const verifications = fixture.workOrderVerifications.filter((row) => row.organizationId === organizationId);
  const invoices = fixture.invoices.filter((row) => row.organizationId === organizationId);
  const exceptions = fixture.invoiceExceptions.filter((row) => row.organizationId === organizationId);

  return vendors.map((vendor) => {
    const assignedWorkOrderIds = new Set(assignments.filter((row) => row.vendorId === vendor.id).map((row) => row.workOrderId));
    const assignmentIds = new Set(assignments.filter((row) => row.vendorId === vendor.id).map((row) => row.id));
    const vendorVisits = visits.filter((row) => row.vendorId === vendor.id);
    const visitIds = new Set(vendorVisits.map((row) => row.id));
    const vendorOutcomes = outcomes.filter((row) => visitIds.has(row.visitId));
    const outcomeIds = new Set(vendorOutcomes.map((row) => row.id));
    const vendorVerifications = verifications.filter((row) => outcomeIds.has(row.siteVisitWorkOrderId));
    const verifiedCount = vendorVerifications.filter((row) => row.decision === "verified").length;
    const rejectedCount = vendorVerifications.length - verifiedCount;
    const vendorInvoices = invoices.filter((row) => row.vendorId === vendor.id);
    const invoiceIds = new Set(vendorInvoices.map((row) => row.id));
    const openExceptions = exceptions.filter((row) => invoiceIds.has(row.invoiceId) && row.status === "open");
    const responses = fixture.vendorResponses.filter((row) => row.organizationId === organizationId && assignmentIds.has(row.assignmentId));
    const responsesAccepted = responses.filter((row) => row.response === "accepted").length;
    const responsesDeclined = responses.filter((row) => row.response === "declined").length;
    const outcomeFollowUpIds = new Set(vendorOutcomes.map((row) => row.followUpId).filter((value): value is string => value != null));
    const openFollowUpCount = fixture.followUps.filter((row) => row.organizationId === organizationId && outcomeFollowUpIds.has(row.id) && row.status !== "completed").length;

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      workOrdersAssigned: assignedWorkOrderIds.size,
      visitsCompleted: vendorVisits.filter((row) => row.checkedOutAt != null).length,
      responsesTotal: responses.length,
      responsesAccepted,
      responsesDeclined,
      openFollowUpCount,
      acceptanceRate: responses.length >= SMALL_SAMPLE_FLOOR ? responsesAccepted / responses.length : null,
      outcomesRecorded: vendorOutcomes.filter((row) => row.outcome != null).length,
      verificationsVerified: verifiedCount,
      verificationsRejected: rejectedCount,
      verificationPassRate: vendorVerifications.length >= SMALL_SAMPLE_FLOOR ? verifiedCount / vendorVerifications.length : null,
      openInvoiceExceptionCount: openExceptions.length,
      openInvoiceExceptionAmountMinor: openExceptions.reduce((sum, row) => sum + row.amount.amountMinor, 0),
      currency: vendorInvoices[0]?.total.currency ?? "USD",
    };
  });
}
