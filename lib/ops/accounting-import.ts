import { OpsDomainError, type OpsCommandServices } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import type { AccountingInvoiceSource, ActorContext, InvoiceLineCategory } from "./types";

/** A provider adapter normalizes its revision/change cursor to a monotonic revision. */
export interface AccountingInvoiceDelivery {
  connectionKey: string; companyKey: string; externalInvoiceId: string; revision: number;
  vendorExternalId: string; vendorId?: string; invoiceNumber: string; invoiceDate: string;
  currency: string; totalMinor: number; paidMinor: number; voided: boolean;
  kind: "bill" | "credit"; relatedExternalInvoiceId?: string; maintenance: boolean;
  documentUrl?: string;
  lines: Array<{ id: string; description: string; category: InvoiceLineCategory; amountMinor: number; storeCode?: string; workOrderNumber?: string }>;
}
export interface AccountingSourcePayload {
  delivery: AccountingInvoiceDelivery;
  importedAt?: string;
  reviewedVendorId?: string;
  previousReview?: { actor: string; at: string; reason: string };
}
export type AccountingSplit = { lineId: string; workOrderId: string; amountMinor: number };

const insert = (table: string, values: Record<string, unknown>): OpsStatement => {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
};
const clock = (svc: OpsCommandServices) => svc.clock?.now() ?? new Date().toISOString();
const id = (svc: OpsCommandServices, prefix: string) => svc.ids?.next(prefix) ?? `${prefix}-${crypto.randomUUID()}`;
async function hash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
export async function accountingSourceIdentity(organizationId: string, connectionKey: string, companyKey: string, externalInvoiceId: string) { return `accounting-${await hash([organizationId, connectionKey, companyKey, externalInvoiceId])}`; }
export function accountingPayload(source: AccountingInvoiceSource): AccountingSourcePayload { return JSON.parse(source.payloadJson); }

/** Import administration requires company-wide finance access, including at the command boundary. */
export async function requireAccountingAccess(repository: OpsRepository, actor: ActorContext) {
  if (actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "Finance access is required");
  const membership = await repository.getMembership(actor.organizationId, actor.actorId);
  const grants = await repository.listScopeGrantsForMembership(actor.organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || !["finance_reviewer", "executive", "facilities_admin"].includes(membership.role) || !grants.some((grant) => grant.scopeKind === "organization" && grant.scopeId === actor.organizationId)) throw new OpsDomainError("FORBIDDEN", "Company-wide finance access is required to manage accounting imports");
}

function validateDelivery(delivery: AccountingInvoiceDelivery) {
  for (const value of [delivery.connectionKey, delivery.companyKey, delivery.externalInvoiceId, delivery.vendorExternalId, delivery.invoiceNumber]) if (!value.trim() || value.length > 160) throw new OpsDomainError("VALIDATION", "The accounting source is missing a valid company, vendor, or invoice reference");
  if (!Number.isSafeInteger(delivery.revision) || delivery.revision < 1 || !/^[A-Z]{3}$/.test(delivery.currency) || !/^\d{4}-\d{2}-\d{2}$/.test(delivery.invoiceDate) || !Number.isFinite(Date.parse(delivery.invoiceDate))) throw new OpsDomainError("VALIDATION", "Check the source version, invoice date, and currency");
  for (const amount of [delivery.totalMinor, delivery.paidMinor, ...delivery.lines.map((line) => line.amountMinor)]) if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999_999_999_999) throw new OpsDomainError("VALIDATION", "Accounting amounts must be non-negative integer minor units");
  if (delivery.lines.length > 100 || delivery.lines.reduce((sum, line) => sum + line.amountMinor, 0) !== delivery.totalMinor || new Set(delivery.lines.map((line) => line.id)).size !== delivery.lines.length) throw new OpsDomainError("VALIDATION", "Invoice items must have distinct references and add up to the invoice total");
  if (delivery.lines.some((line) => !line.id.trim() || line.id.length > 160 || !line.description.trim() || line.description.length > 2000 || !["labor", "part", "travel", "diagnostic", "equipment_rental", "disposal", "permit", "tax", "other_fee"].includes(line.category))) throw new OpsDomainError("VALIDATION", "Check the invoice item descriptions and charge types");
  if (delivery.documentUrl) { const url = new URL(delivery.documentUrl); if (url.protocol !== "https:" || url.username || url.password) throw new OpsDomainError("VALIDATION", "The original document must use a secure provider link"); }
  if (delivery.kind === "credit" && !delivery.relatedExternalInvoiceId) throw new OpsDomainError("VALIDATION", "A credit needs its original accounting bill reference");
}

function audit(svc: OpsCommandServices, source: AccountingInvoiceSource, actor: ActorContext, before: AccountingInvoiceSource | null, event: string): OpsStatement[] {
  const payloadJson = JSON.stringify({ before, after: source, paymentExecuted: false, serviceCompletionChanged: false });
  return [insert("ops_audit_events", { id: id(svc, "audit"), organization_id: source.organizationId, aggregate_type: "accounting_invoice_source", aggregate_id: source.id, event_type: event, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: source.updatedAt, payload_json: payloadJson }), insert("ops_outbox_messages", { id: id(svc, "outbox"), organization_id: source.organizationId, topic: `ops.${event}`, aggregate_type: "accounting_invoice_source", aggregate_id: source.id, payload_json: payloadJson, status: "pending", available_at: source.updatedAt, created_at: source.updatedAt, attempt_count: 0 })];
}

async function persistSource(svc: OpsCommandServices, source: AccountingInvoiceSource, before: AccountingInvoiceSource | null, actor: ActorContext, statements: OpsStatement[], event: string) {
  // The unique transition fence and all affected financial records commit together.
  const fence = insert("ops_idempotency_keys", { organization_id: source.organizationId, key: `__ops_internal__/accounting:${source.id}:version:${before?.version ?? 0}`, command: event, result_id: source.id, request_hash: await hash(source), created_at: source.updatedAt, expires_at: "9999-12-31T23:59:59.999Z" });
  const values = { id: source.id, organization_id: source.organizationId, connection_key: source.connectionKey, company_key: source.companyKey, external_invoice_id: source.externalInvoiceId, source_revision: source.sourceRevision, version: source.version, payload_json: source.payloadJson, invoice_id: source.invoiceId ?? null, match_state: source.matchState, updated_at: source.updatedAt };
  const write: OpsStatement = before ? { sql: "UPDATE ops_accounting_invoice_sources SET source_revision = ?, version = ?, payload_json = ?, invoice_id = ?, match_state = ?, updated_at = ? WHERE organization_id = ? AND id = ? AND version = ?", params: [source.sourceRevision, source.version, source.payloadJson, source.invoiceId ?? null, source.matchState, source.updatedAt, source.organizationId, source.id, before.version] } : insert("ops_accounting_invoice_sources", values);
  try { await svc.repository.atomicWrite([fence, ...statements, write, ...audit(svc, source, actor, before, event)]); }
  catch (error) { if (await svc.repository.getIdempotencyKey(source.organizationId, String(fence.params[1]))) throw new OpsDomainError("CONFLICT", "This accounting invoice changed. Refresh before trying again"); throw error; }
}

export async function importAccountingInvoice(svc: OpsCommandServices, actor: ActorContext, delivery: AccountingInvoiceDelivery) {
  await requireAccountingAccess(svc.repository, actor);
  validateDelivery(delivery);
  if (delivery.vendorId && !(await svc.repository.getVendor(actor.organizationId, delivery.vendorId))) throw new OpsDomainError("VALIDATION", "Map the accounting vendor to a vendor in this company");
  const sourceId = await accountingSourceIdentity(actor.organizationId, delivery.connectionKey, delivery.companyKey, delivery.externalInvoiceId);
  const before = await svc.repository.getAccountingInvoiceSource(actor.organizationId, sourceId);
  const previous = before ? accountingPayload(before) : undefined;
  if (before && delivery.revision <= before.sourceRevision) {
    if (delivery.revision === before.sourceRevision && await hash(delivery) === await hash(previous!.delivery)) return { source: before, replayed: true };
    throw new OpsDomainError("CONFLICT", "This is an older or conflicting accounting update. Import the latest source version");
  }
  if (previous && previous.delivery.kind !== delivery.kind) throw new OpsDomainError("CONFLICT", "An accounting bill cannot become a credit under the same source reference");
  const amountChanged = previous && await hash([previous.delivery.vendorExternalId, previous.delivery.vendorId, previous.delivery.currency, previous.delivery.totalMinor, previous.delivery.lines.map((line) => [line.id, line.amountMinor])]) !== await hash([delivery.vendorExternalId, delivery.vendorId, delivery.currency, delivery.totalMinor, delivery.lines.map((line) => [line.id, line.amountMinor])]);
  const source: AccountingInvoiceSource = { id: sourceId, organizationId: actor.organizationId, connectionKey: delivery.connectionKey, companyKey: delivery.companyKey, externalInvoiceId: delivery.externalInvoiceId, sourceRevision: delivery.revision, version: (before?.version ?? 0) + 1, payloadJson: JSON.stringify({ delivery, importedAt: clock(svc), previousReview: previous?.previousReview, reviewedVendorId: previous?.delivery.vendorExternalId === delivery.vendorExternalId ? previous.reviewedVendorId : undefined } satisfies AccountingSourcePayload), invoiceId: before?.invoiceId, matchState: !delivery.maintenance && !before?.invoiceId ? "excluded" : before?.invoiceId && before.matchState === "matched" && !amountChanged ? "matched" : "needs_review", updatedAt: clock(svc) };
  const statements = source.invoiceId && delivery.kind === "bill" ? await invoiceStatements(svc, source, undefined, Boolean(amountChanged)) : [];
  await persistSource(svc, source, before, actor, statements, "accounting.invoice_imported");
  return { source, replayed: false };
}

async function invoiceStatements(svc: OpsCommandServices, source: AccountingInvoiceSource, splits?: AccountingSplit[], invalidate = false, reviewerId?: string): Promise<OpsStatement[]> {
  const payload = accountingPayload(source);
  const delivery = { ...payload.delivery, vendorId: payload.reviewedVendorId ?? payload.delivery.vendorId };
  const invoiceId = source.invoiceId!;
  const existing = await svc.repository.getInvoice(source.organizationId, invoiceId);
  const oldLines = existing ? await svc.repository.listInvoiceLines(source.organizationId, invoiceId) : [];
  const statements: OpsStatement[] = [];
  if (!delivery.vendorId) throw new OpsDomainError("VALIDATION", "Choose the matching platform vendor first");
  const tax = delivery.lines.filter((line) => line.category === "tax").reduce((sum, line) => sum + line.amountMinor, 0);
  const status = delivery.voided ? "void" : delivery.paidMinor >= delivery.totalMinor && delivery.totalMinor > 0 ? "paid" : delivery.paidMinor > 0 ? "partially_paid" : invalidate ? "matching" : "received";
  if (existing) statements.push({ sql: "UPDATE ops_invoices SET vendor_id = ?, vendor_invoice_number = ?, invoice_date = ?, subtotal_minor = ?, tax_minor = ?, fees_minor = ?, total_minor = ?, currency = ?, paid_amount_minor = ?, status = ? WHERE organization_id = ? AND id = ?", params: [delivery.vendorId, delivery.invoiceNumber, delivery.invoiceDate, delivery.totalMinor - tax, tax, 0, delivery.totalMinor, delivery.currency, delivery.paidMinor, status, source.organizationId, invoiceId] });
  else statements.push(insert("ops_invoices", { id: invoiceId, organization_id: source.organizationId, vendor_id: delivery.vendorId, vendor_invoice_number: delivery.invoiceNumber, invoice_date: delivery.invoiceDate, subtotal_minor: delivery.totalMinor - tax, tax_minor: tax, fees_minor: 0, total_minor: delivery.totalMinor, currency: delivery.currency, approved_for_payment_minor: 0, paid_amount_minor: delivery.paidMinor, status, created_at: source.updatedAt }));
  // Keep old rows as auditable amendments. Removed items become zero; history has the prior source.
  if (oldLines.length) {
    const beforeLines = await Promise.all(oldLines.map(async (line) => ({ line, splits: await svc.repository.listInvoiceLineAllocations(source.organizationId, line.id) })));
    statements.push(insert("ops_audit_events", { id: id(svc, "audit"), organization_id: source.organizationId, aggregate_type: "invoice", aggregate_id: invoiceId, event_type: "invoice.accounting_source_amended", actor_type: "system", actor_name: "Accounting import", occurred_at: source.updatedAt, payload_json: JSON.stringify({ before: existing, lines: beforeLines, sourceId: source.id, sourceRevision: source.sourceRevision }) }));
    for (const line of oldLines) {
      statements.push({ sql: "UPDATE ops_invoice_lines SET unit_amount_minor = ?, line_amount_minor = ? WHERE organization_id = ? AND id = ?", params: [0, 0, source.organizationId, line.id] });
      if (splits || invalidate) statements.push({ sql: "UPDATE ops_invoice_line_allocations SET amount_minor = ?, confirmed_at = ?, confirmed_by_membership_id = ? WHERE organization_id = ? AND invoice_line_id = ?", params: [0, null, null, source.organizationId, line.id] });
    }
  }
  let nextLineNumber = oldLines.reduce((max, line) => Math.max(max, line.lineNumber), 0) + 1;
  for (const line of delivery.lines) {
    const lineId = `accounting-line-${await hash([source.id, line.id])}`;
    if (oldLines.some((old) => old.id === lineId)) statements.push({ sql: "UPDATE ops_invoice_lines SET description = ?, category = ?, unit_amount_minor = ?, line_amount_minor = ?, currency = ? WHERE organization_id = ? AND id = ?", params: [line.description, line.category, line.amountMinor, line.amountMinor, delivery.currency, source.organizationId, lineId] });
    else statements.push(insert("ops_invoice_lines", { id: lineId, organization_id: source.organizationId, invoice_id: invoiceId, line_number: nextLineNumber++, category: line.category, description: line.description, quantity_thousandths: 1000, unit_amount_minor: line.amountMinor, line_amount_minor: line.amountMinor, currency: delivery.currency, created_at: source.updatedAt }));
    for (const split of (splits ?? []).filter((split) => split.lineId === line.id)) {
      const work = await svc.repository.getWorkOrder(source.organizationId, split.workOrderId);
      if (!work) throw new OpsDomainError("VALIDATION", "Choose work orders in this company");
      statements.push(insert("ops_invoice_line_allocations", { id: id(svc, "invoice-split"), organization_id: source.organizationId, invoice_line_id: lineId, work_order_id: work.id, store_id: work.storeId, asset_id: work.assetId, component_id: work.componentId, amount_minor: split.amountMinor, currency: delivery.currency, method: "manual", confirmed_by_membership_id: reviewerId, confirmed_at: source.updatedAt }));
    }
  }
  if (invalidate) statements.push({ sql: "UPDATE ops_invoices SET approved_for_payment_minor = ? WHERE organization_id = ? AND id = ?", params: [0, source.organizationId, invoiceId] });
  if (invalidate) statements.push(insert("ops_invoice_exceptions", { id: id(svc, "invoice-exception"), organization_id: source.organizationId, invoice_id: invoiceId, kind: "allocation_mismatch", status: "open", summary: "Accounting changed this invoice. Check the amounts and linked work again.", amount_minor: delivery.totalMinor, currency: delivery.currency, detected_at: source.updatedAt }));
  return statements;
}

export async function reviewAccountingInvoice(svc: OpsCommandServices, actor: ActorContext, input: { sourceId: string; expectedVersion: number; vendorId: string; existingInvoiceId?: string; confirmDistinctInvoice?: boolean; splits: AccountingSplit[]; reason: string }) {
  await requireAccountingAccess(svc.repository, actor);
  const before = await svc.repository.getAccountingInvoiceSource(actor.organizationId, input.sourceId);
  if (!before) throw new OpsDomainError("NOT_FOUND", "Accounting invoice not found");
  if (before.version !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Accounting updated this invoice. Refresh before saving your review");
  if (!input.reason.trim()) throw new OpsDomainError("VALIDATION", "Explain the match or correction");
  const payload = accountingPayload(before);
  if (!payload.delivery.maintenance) throw new OpsDomainError("VALIDATION", "This source is outside the maintenance import filter");
  const vendor = await svc.repository.getVendor(actor.organizationId, input.vendorId);
  if (!vendor) throw new OpsDomainError("VALIDATION", "Choose a vendor in this company");
  const duplicates = await svc.repository.findInvoicesByVendorReference(actor.organizationId, vendor.id, payload.delivery.invoiceNumber);
  if (!before.invoiceId && payload.delivery.kind === "bill" && duplicates.length && !input.existingInvoiceId && !input.confirmDistinctInvoice) throw new OpsDomainError("CONFLICT", "An invoice with this vendor and number already exists. Link it, or confirm this is a different accounting-company bill");
  const existing = input.existingInvoiceId ? await svc.repository.getInvoice(actor.organizationId, input.existingInvoiceId) : undefined;
  if (input.existingInvoiceId && (!existing || existing.vendorId !== vendor.id || existing.total.currency !== payload.delivery.currency)) throw new OpsDomainError("VALIDATION", "Choose an invoice for this vendor and currency");
  if (before.invoiceId && input.existingInvoiceId && before.invoiceId !== input.existingInvoiceId) throw new OpsDomainError("CONFLICT", "This accounting source already belongs to another invoice");
  if (payload.delivery.kind === "credit") {
    const originalId = await accountingSourceIdentity(actor.organizationId, before.connectionKey, before.companyKey, payload.delivery.relatedExternalInvoiceId!);
    const original = await svc.repository.getAccountingInvoiceSource(actor.organizationId, originalId);
    if (!original?.invoiceId || original.invoiceId !== existing?.id) throw new OpsDomainError("VALIDATION", "Match the original accounting bill from this company before linking its credit");
  }
  if (payload.delivery.kind === "credit" && !existing) throw new OpsDomainError("VALIDATION", "Link this credit to its original invoice");
  if (payload.delivery.kind === "bill") for (const line of payload.delivery.lines) {
    const splits = input.splits.filter((split) => split.lineId === line.id);
    if (splits.some((split) => !Number.isSafeInteger(split.amountMinor) || split.amountMinor < 0) || splits.reduce((sum, split) => sum + split.amountMinor, 0) !== line.amountMinor) throw new OpsDomainError("VALIDATION", "Each invoice item must be fully split between its work orders");
  }
  if (input.splits.some((split) => !payload.delivery.lines.some((line) => line.id === split.lineId))) throw new OpsDomainError("VALIDATION", "An invoice item changed. Refresh its split");
  const invoiceId = before.invoiceId ?? existing?.id ?? id(svc, "invoice");
  const source: AccountingInvoiceSource = { ...before, version: before.version + 1, invoiceId, matchState: "matched", updatedAt: clock(svc), payloadJson: JSON.stringify({ delivery: payload.delivery, reviewedVendorId: vendor.id, importedAt: payload.importedAt, previousReview: { actor: actor.actorName, at: clock(svc), reason: input.reason.trim() } } satisfies AccountingSourcePayload) };
  const owner = await svc.repository.getIdempotencyKey(actor.organizationId, `__ops_internal__/accounting-invoice-owner:${invoiceId}`);
  if (payload.delivery.kind === "bill" && owner && owner.resultId !== before.id) throw new OpsDomainError("CONFLICT", "This platform invoice is already linked to a different accounting bill. Review the company and source reference");
  const statements: OpsStatement[] = [];
  if (!before.invoiceId && payload.delivery.kind === "bill") statements.push(insert("ops_idempotency_keys", { organization_id: source.organizationId, key: `__ops_internal__/accounting-invoice-owner:${invoiceId}`, command: "accounting.invoice_claimed", result_id: source.id, request_hash: await hash([source.connectionKey, source.companyKey, source.externalInvoiceId]), created_at: source.updatedAt, expires_at: "9999-12-31T23:59:59.999Z" }));
  if (payload.delivery.kind === "bill") statements.push(...await invoiceStatements(svc, source, input.splits, false, actor.actorId));
  if (payload.delivery.kind === "bill") {
    const flags = await svc.repository.listInvoiceExceptions(source.organizationId, invoiceId);
    for (const flag of flags.filter((flag) => flag.status === "open" && flag.kind === "allocation_mismatch" && flag.summary === "Accounting changed this invoice. Check the amounts and linked work again.")) {
      statements.push({ sql: "UPDATE ops_invoice_exceptions SET status = ?, resolved_at = ?, resolution_reason = ? WHERE organization_id = ? AND id = ?", params: ["resolved", source.updatedAt, input.reason.trim(), source.organizationId, flag.id] });
    }
  }
  await persistSource(svc, source, before, actor, statements, "accounting.invoice_reviewed");
  return source;
}
