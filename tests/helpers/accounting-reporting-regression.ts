import { resolveInvoiceReview } from "@/lib/ops/financial-control-commands";
import { expect } from "vitest";
import { importAccountingInvoice, reviewAccountingInvoice, accountingPayload } from "@/lib/ops/accounting-import";
import { accountingDemoDelivery } from "@/lib/ops/accounting-demo-adapter";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";
import { loadAccountingReviewModel } from "@/lib/ops/accounting-review-model";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";

export const accountingActor = { organizationId: "org-northline-demo", actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
export const reportingSession = { organizationId: accountingActor.organizationId, membershipId: accountingActor.actorId, userId: "user-northline-facilities", displayName: "Jordan Lee", email: "demo@example.test", role: "facilities" as const, organizationName: "Demo", scopeLabel: "Companywide" };
export async function accountingReportingRegression(repository: OpsRepository, snapshot: () => Promise<OpsFixture>) {
  const svc = { repository };
  const actor = accountingActor;
  const bill = { ...accountingDemoDelivery("new"), externalInvoiceId: "review-reporting-regression", invoiceNumber: "REVIEW-REPORTING-450", invoiceDate: "2026-08-20" };
  const model = async (extra: Record<string, string> = {}) => buildTrendsModel(await snapshot(), reportingSession, { metric: "linked_invoice", period: "6", view: "records", detailKind: "current", ...extra }, { includeExportRows: true });
  const total = async () => (await model()).exportRows!.reduce((sum, row) => sum + (row.amountMinor ?? 0), 0);
  const base = await total();
  const source = (await importAccountingInvoice(svc, actor, bill)).source;
  expect(await total()).toBe(base);
  const input = { sourceId: source.id, expectedVersion: source.version, vendorId: bill.vendorId!, reason: "Confirmed two-store charge allocation", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 35000 }, { lineId: "travel", workOrderId: "wo-northline-105-price-check", amountMinor: 10000 }] };
  const matched = await reviewAccountingInvoice(svc, actor, input);
  expect(await total()).toBe(base + 45000);
  expect((await importAccountingInvoice(svc, actor, bill)).replayed).toBe(true);
  expect(await total()).toBe(base + 45000);
  const rows = (await model()).exportRows!.filter((row) => row.invoiceId === matched.invoiceId);
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map((row) => row.storeId))).toEqual(new Set(["store-northline-104", "store-northline-105"]));
  expect(rows.every((row) => row.currency === "USD" && row.sourcePath.includes(`#allocation-${row.sourceId}`))).toBe(true);
  expect((await model({ store: "store-northline-104", vendor: bill.vendorId! })).exportRows!.filter((row) => row.invoiceId === matched.invoiceId).reduce((sum, row) => sum + row.amountMinor!, 0)).toBe(35000);
  const saved = await loadAccountingReviewModel(repository, actor, source.id, "impossible search");
  expect(saved.splits).toHaveLength(2);
  expect(saved.work.some((work) => work.id === "wo-northline-105-price-check" && work.storeLabel.includes("105"))).toBe(true);
  const moved = { ...bill, revision: 2, lines: bill.lines.map((line) => line.id === "repair" ? { ...line, storeCode: "105", workOrderNumber: "CPS-2026-0117" } : line) };
  const changed = (await importAccountingInvoice(svc, actor, moved)).source;
  expect(changed.matchState).toBe("needs_review");
  expect(accountingPayload(changed).changes?.reasons).toContain("Accounting changed the store reference. Check the linked work.");
  expect(await total()).toBe(base + 10000); // Other line's confirmed split stays valid.
  const paid = (await importAccountingInvoice(svc, actor, { ...moved, revision: 3, paidMinor: 45000 })).source;
  expect(paid.matchState).toBe("needs_review");
  expect(await total()).toBe(base + 10000);
  await expect(reviewAccountingInvoice(svc, actor, input)).rejects.toMatchObject({ code: "CONFLICT" });
  await reviewAccountingInvoice(svc, actor, { ...input, expectedVersion: paid.version, splits: input.splits.map((split) => ({ ...split, workOrderId: "wo-northline-105-price-check" })) });
  expect(await total()).toBe(base + 45000);
  const removed = { ...moved, revision: 4, totalMinor: 35000, lines: moved.lines.filter((line) => line.id === "repair") };
  await importAccountingInvoice(svc, actor, removed);
  expect(await total()).toBe(base + 35000);
  await importAccountingInvoice(svc, actor, { ...removed, revision: 5, voided: true });
  expect(await total()).toBe(base);
  expect((await repository.getInvoice(actor.organizationId, matched.invoiceId!))?.status).toBe("void");
  expect((await snapshot()).costLines.some((line) => line.id.includes("accounting"))).toBe(false);
  expect((await repository.listAccountingInvoiceHistory(actor.organizationId, source.id)).length).toBeGreaterThan(5);
  expect(await repository.getAccountingInvoiceSource("foreign", source.id)).toBeNull();
  await expect(reviewAccountingInvoice(svc, actor, { ...input, expectedVersion: (await repository.getAccountingInvoiceSource(actor.organizationId, source.id))!.version })).rejects.toMatchObject({ code: "VALIDATION" });

  // Existing invoice already represented by both canonical and legacy fixture records.
  const existing = (await repository.getInvoice(actor.organizationId, "invoice-summit-104-compressor"))!;
  const lines = await repository.listInvoiceLines(actor.organizationId, existing.id);
  await repository.atomicWrite([{ sql: "UPDATE ops_invoices SET approved_for_payment_minor = ? WHERE organization_id = ? AND id = ?", params: [42500, actor.organizationId, existing.id] }]);
  const existingBill = { ...bill, externalInvoiceId: "already-represented", invoiceNumber: existing.vendorInvoiceNumber, invoiceDate: existing.invoiceDate, totalMinor: existing.total.amountMinor, lines: lines.map((line) => ({ id: line.id, description: line.description, category: line.category, amountMinor: line.lineAmount.amountMinor })) };
  const duplicateBase = await total();
  const existingSource = (await importAccountingInvoice(svc, actor, existingBill)).source;
  const linked = await reviewAccountingInvoice(svc, actor, { sourceId: existingSource.id, expectedVersion: existingSource.version, vendorId: existing.vendorId, existingInvoiceId: existing.id, reason: "Same bill already represented in the platform", splits: lines.map((line) => ({ lineId: line.id, workOrderId: "wo-northline-104", amountMinor: line.lineAmount.amountMinor })) });
  expect(await total()).toBe(duplicateBase);
  expect((await repository.getInvoice(actor.organizationId, existing.id))!.approvedForPayment.amountMinor).toBe(42500);
  expect((await importAccountingInvoice(svc, actor, existingBill)).replayed).toBe(true);
  expect(await total()).toBe(duplicateBase);
  const adjustedBill = { ...existingBill, revision: 2, totalMinor: 45000, lines: [{ ...existingBill.lines[0], amountMinor: 45000 }] };
  const adjustedSource = (await importAccountingInvoice(svc, actor, adjustedBill)).source;
  expect((await repository.getInvoice(actor.organizationId, existing.id))!.approvedForPayment.amountMinor).toBe(0);
  expect(await total()).toBe(duplicateBase - existing.total.amountMinor);
  await reviewAccountingInvoice(svc, actor, { sourceId: linked.id, expectedVersion: adjustedSource.version, vendorId: existing.vendorId, reason: "Confirmed corrected bill", splits: [{ lineId: adjustedBill.lines[0].id, workOrderId: "wo-northline-104", amountMinor: 45000 }] });
  expect(await total()).toBe(duplicateBase - existing.total.amountMinor + 45000);

  // Both commands must read the same invoice version before either transaction commits.
  const current = (await repository.getInvoice(actor.organizationId, existing.id))!;
  const flag = (await repository.listInvoiceExceptions(actor.organizationId, existing.id)).find((flag) => flag.kind === "authorization" && flag.status === "open")!;
  // Isolate the approval under race from unrelated seeded review flags.
  for (const other of (await repository.listInvoiceExceptions(actor.organizationId, existing.id)).filter((row) => row.status === "open" && row.id !== flag.id)) await repository.atomicWrite([{ sql: "UPDATE ops_invoice_exceptions SET status = ? WHERE organization_id = ? AND id = ?", params: ["resolved", actor.organizationId, other.id] }]);
  const originalWrite = repository.atomicWrite.bind(repository);
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  repository.atomicWrite = async (statements) => {
    if (statements.some((statement) => statement.sql.startsWith("UPDATE ops_invoices SET version") && statement.params.includes(existing.id))) {
      if (++arrivals === 2) release();
      await ready;
    }
    return originalWrite(statements);
  };
  try {
    const raced = await Promise.allSettled([
      importAccountingInvoice(svc, actor, { ...adjustedBill, revision: 3, totalMinor: 47500, lines: [{ ...adjustedBill.lines[0], amountMinor: 47500 }] }),
      resolveInvoiceReview({ organizationId: actor.organizationId, invoiceId: existing.id, exceptionId: flag.id, actor: { ...actor, actorId: "membership-northline-finance" }, decision: "accept_as_billed", reason: "Concurrent financial review", expectedInvoiceVersion: current.version }, svc),
    ]);
    expect(raced.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(raced.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    const result = (await repository.getInvoice(actor.organizationId, existing.id))!;
    expect(result.approvedForPayment.amountMinor).toBe(result.total.amountMinor === 47500 ? 0 : 45000);
  } finally { repository.atomicWrite = originalWrite; }

}
