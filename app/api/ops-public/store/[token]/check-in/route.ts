import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { locationEvidenceSchema, publicApiError, publicApiSuccess, readPublicIdempotencyKey } from "@/components/ops-public/server-http";

const checkInSchema = z.object({
  vendorId: z.string().min(1).max(120).optional(),
  workOrderIds: z.array(z.string().min(1).max(120)).min(1).max(100).optional(),
  workOrderId: z.string().min(1).max(120).optional(),
  serviceRunId: z.string().min(1).max(120).optional(),
  plannedWorkOrderRemovalReason: z.string().max(1000).optional(),
  noWorkOrderReason: z.string().max(500).optional(),
  technicianName: z.string().min(1).max(100),
  technicianPhoneOrPin: z.string().max(100).optional(),
  crewCount: z.number().int().min(1).max(100).optional(),
  additionalTechnicianNames: z.array(z.string().min(1).max(100)).max(99).optional(),
  vehicleIdentifier: z.string().max(120).optional(),
  arrivalNote: z.string().max(1000).optional(),
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
