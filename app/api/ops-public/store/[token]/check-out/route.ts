import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import {
  locationEvidenceSchema,
  parseJsonFormField,
  publicApiError,
  publicApiSuccess,
  readPublicUploads,
} from "@/components/ops-public/server-http";

const checkOutSchema = z.object({
  vendorId: z.string().min(1).max(120),
  visitId: z.string().min(1).max(120),
  outcome: z.enum(["resolved", "temporary_repair", "diagnosed_waiting_parts", "return_required", "unable_to_complete", "other"]),
  outcomeNotes: z.string().max(2000).optional(),
  location: locationEvidenceSchema,
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const formData = await request.formData();
    const command = parseJsonFormField(formData, "command", checkOutSchema);
    const evidence = await readPublicUploads(formData);
    return publicApiSuccess(await getPublicOperationsGateway().checkOut(token, { ...command, evidence }), 201);
  } catch (error) {
    return publicApiError(error);
  }
}
