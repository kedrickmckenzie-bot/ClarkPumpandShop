import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess, readPublicUploads } from "@/components/ops-public/server-http";

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
    const multipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = multipart ? await request.formData() : undefined;
    const command = commandSchema.parse(form ? JSON.parse(String(form.get("command"))) : await request.json());
    const attachments = form && command.action === "submit" ? await readPublicUploads(form, { field: "attachments", maxFiles: 4, maxFileBytes: 10 * 1024 * 1024, allowedMediaTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] }) : [];
    const gateway = getPublicOperationsGateway();
    const receipt = command.action === "open"
      ? await gateway.openVendorEstimate(token)
      : command.action === "submit"
        ? await gateway.submitVendorEstimate(token, { ...command, attachments })
        : await gateway.declineVendorEstimate(token, command);
    return publicApiSuccess(receipt, 201);
  } catch (error) {
    return publicApiError(error);
  }
}
