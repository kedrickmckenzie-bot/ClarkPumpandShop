import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
import { documentAppliesTo } from "@/lib/ops/equipment-documents";
import { equipmentForDocuments } from "@/lib/server/equipment-documents";

/** Opens a library document for anyone who can see this equipment, technicians included. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params;
    const { session, repository } = await getOpsRequestContext(["facilities", "regional", "store_manager", "executive", "finance", "technician"], undefined, request);
    const asset = await equipmentForDocuments(repository, session, id);
    const document = await repository.getEquipmentDocument(session.organizationId, documentId);
    if (!document || !documentAppliesTo(document, asset)) return new Response("Document not found", { status: 404 });
    return quoteFileResponse(await repository.getStoredFileById(session.organizationId, document.fileId), request);
  } catch (error) { return opsApiError(error); }
}
