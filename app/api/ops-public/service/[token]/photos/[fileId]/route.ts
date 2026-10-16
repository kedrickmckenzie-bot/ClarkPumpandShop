import { resolveServiceJobPhoto } from "@/components/ops-public/server-gateway";
import { publicApiError } from "@/components/ops-public/server-http";
import { quoteFileResponse } from "@/lib/server/quote-file-response";

/** A photo the operator shared with the vendor on this job; nothing else on the job is reachable here. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  try { const { token, fileId } = await params; return await quoteFileResponse(await resolveServiceJobPhoto(token, fileId), request); }
  catch (error) { return publicApiError(error); }
}
