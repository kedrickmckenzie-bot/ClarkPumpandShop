import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess, readPublicIdempotencyKey } from "@/components/ops-public/server-http";

const addWorkSchema = z.object({
  visitId: z.string().min(1).max(120),
  heldWorkOrderIds: z.array(z.string().min(1).max(120)).min(1).max(100),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const submissionKey = readPublicIdempotencyKey(request);
    const command = addWorkSchema.parse(await request.json());
    return publicApiSuccess(await getPublicOperationsGateway().addHeldWorkToVisit(token, { ...command, submissionKey }));
  } catch (error) {
    return publicApiError(error);
  }
}
