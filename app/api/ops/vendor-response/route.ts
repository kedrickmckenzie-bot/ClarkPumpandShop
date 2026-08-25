import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { resolveVendorResponse } from "@/lib/ops/vendor-response-continuation";

const ALLOWED_ROLES = ["executive", "facilities", "regional"] as const;

/**
 * Operator-side vendor response continuation: accept or counter a proposed
 * date, or reply to a vendor question. Stays on the canonical work-order case
 * page and reports the outcome through a notice parameter.
 */
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext([...ALLOWED_ROLES]);
    const formData = await request.formData();
    const text = (key: string) => {
      const raw = formData.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const decision = text("decision");
    const returnTo = text("returnTo") || "/app/work-orders";
    const result = await resolveVendorResponse(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        vendorResponseId: text("vendorResponseId"),
        decision: decision as "accept_proposed_date" | "counter_proposed_date" | "reply_to_question",
        scheduledFor: text("scheduledFor") || undefined,
        message: text("message") || undefined,
        actor: context.actor,
      },
    );
    const separator = returnTo.includes("?") ? "&" : "?";
    return relativeRedirect303(`${returnTo}${separator}notice=${encodeURIComponent(`Vendor response recorded (${result.appointment ? result.appointment.status : "reply sent"}).`)}`);
  } catch (error) {
    return opsApiError(error);
  }
}