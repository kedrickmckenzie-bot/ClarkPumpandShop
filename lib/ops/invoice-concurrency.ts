import type { Invoice } from "./types";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";

/** Shared by accounting amendments and financial decisions. The assertion
 * fails atomically if another writer advanced the observed invoice version. */
export function invoiceVersionStatements(invoice: Invoice, now: string): OpsStatement[] {
  const version = invoice.version ?? 0;
  return [
    { sql: "UPDATE ops_invoices SET version = ? WHERE organization_id = ? AND id = ? AND version = ?", params: [version + 1, invoice.organizationId, invoice.id, version] },
    { sql: "INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, created_at, expires_at, request_hash) VALUES (?, ?, ?, ?, ?, ?, (SELECT ? FROM ops_invoices WHERE organization_id = ? AND id = ? AND version = ?))", params: [invoice.organizationId, `__ops_internal__/invoice:${invoice.id}:version:${version + 1}`, "invoice.version_fence", invoice.id, now, "9999-12-31T23:59:59.999Z", String(version + 1), invoice.organizationId, invoice.id, version + 1] },
  ];
}

export async function atomicInvoiceWrite(repository: OpsRepository, invoice: Invoice, now: string, statements: OpsStatement[]) {
  try { await repository.atomicWrite([...invoiceVersionStatements(invoice, now), ...statements]); }
  catch (error) { if (((await repository.getInvoice(invoice.organizationId, invoice.id))?.version ?? 0) !== (invoice.version ?? 0)) throw new OpsDomainError("CONFLICT", "This invoice changed during review. Review its latest charges before saving."); throw error; }
}
