import type { OpsRepository } from "@/lib/ops/repository";
import type { OperatorSession } from "@/components/ops/data-contract";
import { roleCanAccessDetailRoute } from "@/components/ops/role-policy";
import { OpsDomainError } from "@/lib/ops/errors";
export type FileRecordKind = "request" | "visit" | "asset" | "invoice";
export async function recordFiles(repository: OpsRepository, session: OperatorSession, kind: FileRecordKind, id: string) {
  if (!roleCanAccessDetailRoute(session.role, kind === "asset" ? "equipment" : kind)) throw new OpsDomainError("FORBIDDEN", "This record is outside your access.");
  if (kind === "invoice") {
    const result = await repository.readInvoiceRecord(session, id, { section: "items", limit: 1 });
    if (!result.invoice) throw new OpsDomainError("NOT_FOUND", "Invoice not found");
    const invoice = await repository.getInvoice(session.organizationId, id);
    const files = [...await repository.listFilesForEntity(session.organizationId, "invoice", id), ...await repository.listFilesForEntity(session.organizationId, "invoice_reference", id)];
    if (invoice?.supportingFileId) { const file = await repository.getStoredFileById(session.organizationId, invoice.supportingFileId); if (file) files.push(file); }
    return [...new Map(files.map(file => [file.id, file])).values()];
  }
  const record = kind === "request" ? await repository.getRequest(session.organizationId, id) : kind === "visit" ? await repository.getVisit(session.organizationId, id) : await repository.getAsset(session.organizationId, id);
  if (!record || !await repository.getStoreDetail(session, record.storeId)) throw new OpsDomainError("NOT_FOUND", "Record not found");
  return repository.listFilesForEntity(session.organizationId, kind, id);
}
