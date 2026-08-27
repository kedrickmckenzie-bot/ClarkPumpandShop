import { z } from "zod";
import { OpsDomainError } from "@/lib/ops/errors";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { respondToServiceRun } from "@/lib/ops/service-run-commands";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const schema = z.object({
  response: z.enum(["accepted", "countered", "stop_change_requested", "work_order_change_requested", "insufficient_capacity", "declined"]),
  responderName: z.string().trim().min(1).max(100),
  requestedStartsAt: z.string().trim().min(1).max(40).optional(),
  requestedStopOrder: z.array(z.string().min(1)).max(20).optional(),
  removeWorkOrderIds: z.array(z.string().min(1)).max(50).optional(),
  reasonCode: z.string().trim().max(100).optional(),
  reasonDetail: z.string().trim().max(2000).optional(),
});

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const command = schema.parse(await request.json());
    const tokenHash = await sha256Hex(token);
    const repository = await getServerOpsRepository();
    const capability = await repository.getServiceRunByPublicToken({ tokenHash, purpose: "service_run_response", now: new Date().toISOString() });
    if (!capability) throw new OpsDomainError("NOT_FOUND", "This response link is invalid, expired, or already used");
    const storeSweep = capability.run.schedulerVersion === "store-sweep-v1";
    let requestedStartsAt = command.requestedStartsAt;
    if (storeSweep && requestedStartsAt) {
      const stops = await repository.listRouteStops(capability.run.organizationId, capability.run.id);
      const store = stops[0] ? await repository.getStore(capability.run.organizationId, stops[0].storeId) : null;
      if (!store) throw new OpsDomainError("CONFLICT", "The store for these jobs is no longer available");
      requestedStartsAt = localDateTimeToIso(requestedStartsAt, store.timeZone ?? "America/New_York");
    }
    const response = await respondToServiceRun({
      tokenHash, ...command, requestedStartsAt,
      actor: { organizationId: capability.run.organizationId, actorType: "vendor_link", actorName: `${command.responderName} via secure ${storeSweep ? "store-visit" : "Service Run"} link` },
    }, { repository });
    return publicApiSuccess({
      heading: command.response === "accepted" ? (storeSweep ? "Jobs accepted" : "Service Run accepted") : "Response recorded",
      message: command.response === "accepted"
        ? (storeSweep ? "The customer and store team now see the visit date your company supplied." : "The operator and Stores now see the committed schedule.")
        : (storeSweep ? "The customer can now review your response. Each approved job remains on its own work-order record." : "The original recommendation remains preserved while the operator reviews your requested change."),
      responseId: response.id, response: response.response, respondedAt: response.respondedAt,
    }, 201);
  } catch (error) {
    if (error instanceof OpsDomainError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 422;
      return Response.json({ error: error.message, code: error.code }, { status, headers: { "cache-control": "no-store" } });
    }
    return publicApiError(error);
  }
}
