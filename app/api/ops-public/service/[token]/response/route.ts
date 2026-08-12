import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const commandSchema = z.object({
  response: z.enum(["accepted", "declined", "proposed_date", "question"]),
  responderName: z.string().max(100),
  proposedArrival: z.string().max(40).optional(),
  detail: z.string().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const command = commandSchema.parse(await request.json());
    const receipt = await getPublicOperationsGateway().respondToServiceAuthorization(token, command);
    return publicApiSuccess(receipt, 201);
  } catch (error) {
    return publicApiError(error);
  }
}
