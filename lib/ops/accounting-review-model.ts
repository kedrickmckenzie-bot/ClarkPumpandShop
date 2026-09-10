import { accountingPayload, accountingSourceIdentity, accountingLineIdentity, requireAccountingAccess, type AccountingInvoiceDelivery, type AccountingSplit } from "./accounting-import";
import type { OpsRepository } from "./repository";
import type { ActorContext } from "./types";
import { OpsDomainError } from "./errors";

export interface AccountingWorkChoice { id: string; number: string; problem: string; storeLabel: string }
export interface AccountingReviewModel {
  sourceId: string; version: number; linkedInvoiceId?: string; delivery: AccountingInvoiceDelivery;
  vendors: Array<{ id: string; name: string }>;
  work: AccountingWorkChoice[];
  invoices: Array<{ id: string; vendorInvoiceNumber: string }>;
  splits: AccountingSplit[];
  reviewNote: string;
  changeReasons: string[];
}

export async function loadAccountingReviewModel(repository: OpsRepository, actor: ActorContext, sourceId: string, search = "", selectedVendor?: string): Promise<AccountingReviewModel> {
  await requireAccountingAccess(repository, actor);
  const source = await repository.getAccountingInvoiceSource(actor.organizationId, sourceId);
  if (!source) throw new OpsDomainError("NOT_FOUND", "Accounting invoice not found");
  const payload = accountingPayload(source);
  const delivery = { ...payload.delivery, vendorId: payload.reviewedVendorId ?? payload.delivery.vendorId };
  const vendorId = selectedVendor || delivery.vendorId;
  if (vendorId && !await repository.getVendor(actor.organizationId, vendorId)) throw new OpsDomainError("FORBIDDEN", "Choose a vendor in this company");
  const [vendors, result, lines] = await Promise.all([
    repository.listVendors({ organizationId: actor.organizationId }, undefined, { limit: 100 }),
    repository.listWorkOrders({ organizationId: actor.organizationId }, { search: search || undefined, limit: 50 }),
    source.invoiceId ? repository.listInvoiceLines(actor.organizationId, source.invoiceId) : [],
  ]);
  const lineKeys = new Map(await Promise.all(delivery.lines.map(async (line) => [payload.lineIds?.[line.id] ?? await accountingLineIdentity(source.id, line.id), line.id] as const)));
  const allocations = (await Promise.all(lines.map((line) => repository.listInvoiceLineAllocations(actor.organizationId, line.id)))).flat().filter((split) => split.confirmedAt && split.amount.amountMinor > 0 && lineKeys.has(split.invoiceLineId));
  const selected = await Promise.all([...new Set(allocations.map((split) => split.workOrderId))].filter((id) => !result.items.some((item) => item.id === id)).map((id) => repository.getWorkOrder(actor.organizationId, id)));
  const work = [...result.items, ...selected.filter((item) => item !== null)];
  const stores = new Map((await Promise.all([...new Set(work.map((item) => item.storeId))].map((id) => repository.getStore(actor.organizationId, id)))).filter((store) => store !== null).map((store) => [store.id, store]));
  let invoices = vendorId ? await repository.findInvoicesByVendorReference(actor.organizationId, vendorId, delivery.invoiceNumber) : [];
  if (delivery.kind === "credit") {
    const original = await repository.getAccountingInvoiceSource(actor.organizationId, await accountingSourceIdentity(actor.organizationId, source.connectionKey, source.companyKey, delivery.relatedExternalInvoiceId!));
    const invoice = original?.invoiceId ? await repository.getInvoice(actor.organizationId, original.invoiceId) : null;
    invoices = invoice ? [invoice] : [];
  }
  return { sourceId, version: source.version, linkedInvoiceId: source.invoiceId, delivery, vendors: vendors.items.map(({ id, name }) => ({ id, name })), work: work.map((item) => ({ id: item.id, number: item.number, problem: item.problem, storeLabel: stores.has(item.storeId) ? `Store ${stores.get(item.storeId)!.storeNumber} · ${stores.get(item.storeId)!.name}` : "Store unavailable" })), invoices: invoices.map(({ id, vendorInvoiceNumber }) => ({ id, vendorInvoiceNumber })), splits: allocations.map((split) => ({ lineId: lineKeys.get(split.invoiceLineId)!, workOrderId: split.workOrderId, amountMinor: split.amount.amountMinor })), reviewNote: payload.previousReview?.reason ?? "", changeReasons: payload.changes?.reasons ?? [] };
}
