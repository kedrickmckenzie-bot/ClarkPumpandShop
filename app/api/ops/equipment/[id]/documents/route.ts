import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { addEquipmentDocument, EQUIPMENT_DOCUMENT_MAX_BYTES } from "@/lib/ops/equipment-documents";
import { equipmentForDocuments } from "@/lib/server/equipment-documents";
import { OpsDomainError } from "@/lib/ops/errors";

/** Managers add a manual, diagram or sheet to the equipment library. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "regional"], "setup_equipment", request);
    await equipmentForDocuments(repository, session, id);
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > EQUIPMENT_DOCUMENT_MAX_BYTES || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new OpsDomainError("VALIDATION", "Upload a PDF, JPG, PNG or WebP up to 25 MB.");
    const [stored] = await getQuoteUploadStore(session.accessMode === "preview").store({ organizationId: session.organizationId, subjectType: "equipment_document", subjectId: id, uploads: [{ name: file.name.slice(0, 180), mediaType: file.type, size: file.size, bytes: await file.arrayBuffer() }], idempotencyKey: crypto.randomUUID() });
    if (!stored?.stored) throw new OpsDomainError("VALIDATION", "The file could not be stored. Try again.");
    const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 160);
    await addEquipmentDocument({
      organizationId: session.organizationId, actor, assetId: id, title,
      docType: String(form.get("docType") ?? "manual"), appliesTo: form.get("appliesTo") === "unit" ? "unit" : "model",
      file: { id: `file-${crypto.randomUUID()}`, organizationId: session.organizationId, storageKey: stored.key, sha256: stored.sha256, originalName: stored.originalName, contentType: stored.mediaType, byteLength: stored.size, status: "available", createdAt: new Date().toISOString() },
    }, { repository });
    return relativeRedirect303(`/app/equipment/${encodeURIComponent(id)}?saved=document#documents`);
  } catch (error) { return opsApiError(error); }
}
