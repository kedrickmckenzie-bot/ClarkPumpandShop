import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { parseJsonFormField, publicApiError, publicApiSuccess, readPublicUploads } from "@/components/ops-public/server-http";

const reportSchema = z.object({
  reporterName: z.string().max(100),
  employeeId: z.string().max(80).optional(),
  problem: z.string().max(2000),
  urgency: z.enum(["routine", "priority", "urgent_safety"]),
  area: z.string().max(120).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const formData = await request.formData();
    const command = parseJsonFormField(formData, "command", reportSchema);
    const evidence = await readPublicUploads(formData, {
      maxFiles: 3,
      allowedMediaTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    });
    return publicApiSuccess(await getPublicOperationsGateway().reportStoreIssue(token, { ...command, evidence }), 201);
  } catch (error) {
    return publicApiError(error);
  }
}
