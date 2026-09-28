import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { OpsDomainError } from "@/lib/ops/errors";
export async function storeCompletionFiles(form: FormData, organizationId: string, workOrderId: string, preview: boolean) {
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024 || files.some(file => !["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"].includes(file.type))) throw new OpsDomainError("VALIDATION", "Attach up to five PDF, JPG, PNG, WebP or text files, 8 MB total.");
  if (!files.length) return [];
  const uploads = await Promise.all(files.map(async file => ({ name: file.name.slice(0, 180), mediaType: file.type, size: file.size, bytes: await file.arrayBuffer() })));
  const stored = await getQuoteUploadStore(preview).store({ organizationId, subjectType: "work_order", subjectId: workOrderId, uploads, idempotencyKey: crypto.randomUUID() });
  if (stored.some(file => !file.stored)) throw new OpsDomainError("VALIDATION", "Files could not be stored. Please try again.");
  return stored.map(file => ({ id: `file-${crypto.randomUUID()}`, organizationId, storageKey: file.key, sha256: file.sha256, originalName: file.originalName, contentType: file.mediaType, byteLength: file.size, status: "available" as const, createdAt: new Date().toISOString() }));
}
