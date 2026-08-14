import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { locationEvidenceSchema, publicApiError, publicApiSuccess, readPublicIdempotencyKey } from "@/components/ops-public/server-http";

const checkInSchema = z.object({
  vendorId: z.string().min(1).max(120),
  workOrderId: z.string().min(1).max(120).optional(),
  noWorkOrderReason: z.string().max(500).optional(),
  technicianName: z.string().max(100),
  location: locationEvidenceSchema,
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const submissionKey = readPublicIdempotencyKey(request);
    const command = checkInSchema.parse(await request.json());
    return publicApiSuccess(await getPublicOperationsGateway().checkIn(token, { ...command, submissionKey }), 201);
  } catch (error) {
    return publicApiError(error);
  }
}
