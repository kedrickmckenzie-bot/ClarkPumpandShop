import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const commandSchema = z.object({ action: z.literal("open") });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    commandSchema.parse(await request.json());
    const receipt = await getPublicOperationsGateway().openServiceAuthorization(token);
    return publicApiSuccess(receipt, 201);
  } catch (error) {
    return publicApiError(error);
  }
}
