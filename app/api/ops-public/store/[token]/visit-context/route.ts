import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { publicApiError, publicApiSuccess } from "@/components/ops-public/server-http";

const lookupSchema = z.object({ vendorId: z.string().min(1).max(120).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { vendorId } = lookupSchema.parse(await request.json().catch(() => ({})));
    return publicApiSuccess(await getPublicOperationsGateway().lookupVendorVisitContext(token, vendorId));
  } catch (error) {
    return publicApiError(error);
  }
}
