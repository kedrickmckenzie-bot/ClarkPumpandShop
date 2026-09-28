import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { recordFiles, type FileRecordKind } from "@/lib/server/record-files";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string; fileId: string }> }) {
  try {
    const { session, repository } = await getOpsRequestContext(["facilities", "regional", "store_manager", "executive", "finance"], undefined, request);
    const { kind, id, fileId } = await params;
    if (!["request", "visit", "asset", "invoice"].includes(kind)) return new Response("Record not found", { status: 404 });
    const files = await recordFiles(repository, session, kind as FileRecordKind, id);
    return quoteFileResponse(files.find(file => file.id === fileId) ?? null, request);
  } catch (error) { return opsApiError(error); }
}
