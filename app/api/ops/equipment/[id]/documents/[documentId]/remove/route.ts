import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { removeEquipmentDocument } from "@/lib/ops/equipment-documents";
import { equipmentForDocuments } from "@/lib/server/equipment-documents";

/** Managers take a document out of the library; history keeps the record. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params;
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "regional"], "setup_equipment", request);
    await equipmentForDocuments(repository, session, id);
    await removeEquipmentDocument({ organizationId: session.organizationId, actor, assetId: id, documentId }, { repository });
    return relativeRedirect303(`/app/equipment/${encodeURIComponent(id)}?saved=document-removed#documents`);
  } catch (error) { return opsApiError(error); }
}
