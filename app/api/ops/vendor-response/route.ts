import { getOpsRequestContext, assertStoreInSessionScope } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { resolveVendorResponse } from "@/lib/ops/vendor-response-continuation";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { OpsDomainError } from "@/lib/ops/errors";

const ALLOWED_ROLES = ["facilities", "regional"] as const;
const DECISIONS = new Set(["accept_proposed_date", "counter_proposed_date", "reply_to_question"]);

function safeReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/app/work-orders";
}

function appendResult(destination: string, key: "notice" | "error", message: string) {
  const parsed = new URL(safeReturnTo(destination), "https://operations.invalid");
  parsed.searchParams.set(key, message);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * Operator-side vendor response continuation: accept or counter a proposed
 * date, or reply to a vendor question. Stays on the canonical work-order case
 * page and reports the outcome through a notice parameter.
 */
export async function POST(request: Request) {
  let returnTo = "/app/work-orders";
  try {
    const formData = await request.formData();
    const text = (key: string) => {
      const raw = formData.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const decision = text("decision");
    returnTo = safeReturnTo(text("returnTo") || returnTo);
    if (!DECISIONS.has(decision)) throw new OpsDomainError("VALIDATION", "Choose a valid vendor-response action.");
    const vendorResponseId = text("vendorResponseId");
    if (!vendorResponseId) throw new OpsDomainError("VALIDATION", "Vendor response is required.");
    const context = await getOpsRequestContext([...ALLOWED_ROLES]);
    const response = await context.repository.getVendorResponse(context.session.organizationId, vendorResponseId);
    if (!response) throw new OpsDomainError("NOT_FOUND", "Vendor response was not found in this organization.");
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, response.workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in this organization.");
    const store = await assertStoreInSessionScope(context.session, workOrder.storeId);
    const organization = await context.repository.getOrganization(context.session.organizationId);
    const scheduledFor = decision === "counter_proposed_date"
      ? localDateTimeToIso(text("scheduledFor"), store.timeZone ?? organization?.timeZone ?? "UTC")
      : undefined;
    const result = await resolveVendorResponse(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        vendorResponseId,
        decision: decision as "accept_proposed_date" | "counter_proposed_date" | "reply_to_question",
        scheduledFor,
        message: text("message") || undefined,
        actor: context.actor,
      },
    );
    const message = result.appointment?.status === "confirmed"
      ? "Service date confirmed. The vendor now owns arrival and check-in."
      : result.appointment?.status === "counter_proposed"
        ? "Counterproposal sent. The vendor now owns the response."
        : "Reply sent. The vendor now owns the next response.";
    return relativeRedirect303(appendResult(returnTo, "notice", message));
  } catch (error) {
    if (!(error instanceof OpsDomainError)) console.error("Vendor response continuation failed", error);
    const message = error instanceof OpsDomainError ? error.message : "The vendor response could not be recorded.";
    return relativeRedirect303(appendResult(returnTo, "error", message));
  }
}
