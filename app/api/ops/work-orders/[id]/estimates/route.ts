import { OpsDomainError } from "@/lib/ops/commands";
import { requestEstimate } from "@/lib/ops/estimate-commands";
import type { EstimateRequestChannel, EstimateRequestKind } from "@/lib/ops/types";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const requestKinds = new Set<EstimateRequestKind>(["estimate_only"]);
const requestChannels = new Set<EstimateRequestChannel>(["email", "sms", "manual"]);

function createRawToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const kind = formText(formData, "kind", { required: true, max: 40 }) as EstimateRequestKind;
    const channel = formText(formData, "channel", { required: true, max: 20 }) as EstimateRequestChannel;
    if (!requestKinds.has(kind) || !requestChannels.has(channel)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported quote-request delivery channel.");
    }
    const dueAt = optionalIsoDate(formText(formData, "dueAt", { required: true, max: 40 }));
    if (!dueAt) throw new OpsDomainError("VALIDATION", "Quote response due date is required.");
    const rawToken = createRawToken();
    const tokenHash = await sha256Hex(rawToken);
    const standardExpiry = Date.now() + 30 * 86_400_000;
    const dueProtectedExpiry = Date.parse(dueAt) + 7 * 86_400_000;
    const expiresAt = new Date(Math.max(standardExpiry, dueProtectedExpiry)).toISOString();

    await requestEstimate(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId,
        vendorId: formText(formData, "vendorId", { required: true, max: 120 }),
        kind,
        decisionKind: (formText(formData, "decisionKind", { max: 40 }) || "service_bid") as "service_bid" | "replacement_quote",
        requestedScope: formText(formData, "requestedScope", { required: true, max: 4_000 }),
        channel,
        dueAt,
        publicToken: { tokenHash, expiresAt },
        actor: context.actor,
      },
    );

    return relativeRedirect303(`/public/estimate/${encodeURIComponent(rawToken)}`);
  } catch (error) {
    return opsApiError(error);
  }
}
