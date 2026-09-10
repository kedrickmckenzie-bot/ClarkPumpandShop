import { resolveVendorQuoteFile } from "@/components/ops-public/server-gateway";
import { publicApiError } from "@/components/ops-public/server-http";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; proposalId: string; fileId: string }> }) {
  try { const { token, proposalId, fileId } = await params; return await quoteFileResponse(await resolveVendorQuoteFile(token, proposalId, fileId)); }
  catch (error) { return publicApiError(error); }
}
