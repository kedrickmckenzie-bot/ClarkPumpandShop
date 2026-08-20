import { z } from "zod";
import { OpsDomainError } from "@/lib/ops/errors";
import { respondToServiceRun } from "@/lib/ops/service-run-commands";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const schema = z.object({
  response: z.enum(["accepted", "countered", "stop_change_requested", "work_order_change_requested", "insufficient_capacity", "declined"]),
  responderName: z.string().trim().min(1).max(100),
  requestedStartsAt: z.string().datetime().optional(),
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
    if (!capability) throw new OpsDomainError("NOT_FOUND", "Service Run response link is invalid, expired, or already used");
    const response = await respondToServiceRun({
      tokenHash, ...command,
      actor: { organizationId: capability.run.organizationId, actorType: "vendor_link", actorName: `${command.responderName} via secure Service Run link` },
    }, { repository });
    return publicApiSuccess({
      heading: command.response === "accepted" ? "Service Run accepted" : "Response recorded",
      message: command.response === "accepted" ? "The operator and Stores now see the committed schedule." : "The original recommendation remains preserved while the operator reviews your requested change.",
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
