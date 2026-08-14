import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }),
  z.object({
    action: z.literal("submit"),
    responderName: z.string().max(100),
    expectedRevision: z.number().int().min(0),
    amount: z.string().max(30),
    currency: z.string().length(3).optional(),
    scope: z.string().max(4000),
    exclusions: z.string().max(4000).optional(),
    leadTimeDays: z.number().int().min(0).max(3650).optional(),
    validUntil: z.string().max(40).optional(),
  }),
  z.object({
    action: z.literal("decline"),
    responderName: z.string().max(100),
    expectedRevision: z.number().int().min(0),
    reason: z.string().max(2000),
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const command = commandSchema.parse(await request.json());
    const gateway = getPublicOperationsGateway();
    const receipt = command.action === "open"
      ? await gateway.openVendorEstimate(token)
      : command.action === "submit"
        ? await gateway.submitVendorEstimate(token, command)
        : await gateway.declineVendorEstimate(token, command);
    return publicApiSuccess(receipt, 201);
  } catch (error) {
    return publicApiError(error);
  }
}
