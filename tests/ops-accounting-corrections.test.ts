import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { accountingPayload, importAccountingInvoice, reviewAccountingInvoice } from "@/lib/ops/accounting-import";
import { accountingDemoDelivery } from "@/lib/ops/accounting-demo-adapter";
import { classifyAccountingChanges } from "@/lib/ops/accounting-changes";
import { loadAccountingReviewModel } from "@/lib/ops/accounting-review-model";
import { accountingDraftAmounts, createAccountingDraft, recoverAccountingDraft, retainAccountingChoices } from "@/lib/ops/accounting-review-draft";
import { resolveInvoiceReview } from "@/lib/ops/financial-control-commands";
import { accountingActor as actor, reportingSession } from "./helpers/accounting-reporting-regression";
import { buildTrendsModel } from "@/app/app/_data/trends-presenter";

function approvedInvoice() {
  const fixture = buildNorthlinePresentationFixture();
  fixture.invoices.push({ ...fixture.invoices[0], id: "approved-425", vendorId: "vendor-northline-summit", vendorInvoiceNumber: "APPROVED-425", invoiceDate: "2026-08-20", subtotal: { amountMinor: 42500, currency: "USD" }, tax: { amountMinor: 0, currency: "USD" }, fees: { amountMinor: 0, currency: "USD" }, total: { amountMinor: 42500, currency: "USD" }, approvedForPayment: { amountMinor: 42500, currency: "USD" }, paidAmount: { amountMinor: 0, currency: "USD" }, status: "approved_for_payment" });
  fixture.invoiceLines.push({ id: "approved-line", organizationId: actor.organizationId, invoiceId: "approved-425", lineNumber: 1, category: "labor", description: "Repair", quantityThousandths: 1000, unitAmount: { amountMinor: 42500, currency: "USD" }, lineAmount: { amountMinor: 42500, currency: "USD" }, createdAt: fixture.asOf });
  fixture.invoiceExceptions.push({ id: "approved-flag", organizationId: actor.organizationId, invoiceId: "approved-425", kind: "authorization", status: "open", summary: "Original finance review", amount: { amountMinor: 42500, currency: "USD" }, detectedAt: fixture.asOf });
  return createOpsFixtureRepository(fixture);
}
const incoming = (amount = 42500, description = "Repair") => ({ ...accountingDemoDelivery("new"), invoiceDate: "2026-08-20", invoiceNumber: "APPROVED-425", totalMinor: amount, lines: [{ id: "repair", description, amountMinor: amount, category: "labor" as const }] });

describe("accounting correction and matching decisions", () => {
  it.each([[45000, "Repair", 0], [42500, "Different repair", 0], [42500, "Repair", 42500]])("compares initial existing-invoice charges (%s, %s) before preserving approval", async (amount, description, expected) => {
    const repository = approvedInvoice();
    const source = (await importAccountingInvoice({ repository }, actor, incoming(amount, description))).source;
    await reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, existingInvoiceId: "approved-425", vendorId: "vendor-northline-summit", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: amount }], reason: "Compared source bill with the existing invoice" });
    expect((await repository.getInvoice(actor.organizationId, "approved-425"))?.approvedForPayment.amountMinor).toBe(expected);
    const history = repository.snapshot().auditEvents.find((event) => event.eventType === "invoice.accounting_source_amended" && event.aggregateId === "approved-425")!;
    expect(JSON.parse(history.payloadJson).before.approvedForPayment.amountMinor).toBe(42500);
    await expect(resolveInvoiceReview({ organizationId: actor.organizationId, invoiceId: "approved-425", exceptionId: "approved-flag", actor: { ...actor, actorId: "membership-northline-finance" }, decision: "accept_as_billed", reason: "Stale browser decision", expectedInvoiceVersion: 0 }, { repository })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("classifies references, categories, vendor mapping, exclusions, and metadata independently of payment", () => {
    const before = accountingDemoDelivery("new");
    for (const replacement of [{ storeCode: "105" }, { workOrderNumber: "OTHER" }, { category: "part" as const }, { description: "Different work" }]) {
      expect(classifyAccountingChanges(before, { ...before, lines: before.lines.map((line, index) => index ? line : { ...line, ...replacement }) })).toMatchObject({ matching: true, lineIds: ["repair"] });
    }
    expect(classifyAccountingChanges(before, { ...before, vendorId: undefined })).toMatchObject({ matching: true, financial: true, allMatches: true });
    expect(classifyAccountingChanges(before, { ...before, maintenance: false })).toMatchObject({ matching: true, allMatches: true });
    expect(classifyAccountingChanges(before, { ...before, paidMinor: 1000, documentUrl: "https://example.test/bill.pdf" })).toMatchObject({ matching: false, financial: false, payment: true, metadata: true });
  });

  it("preserves drafts across searches and failures, loads saved splits, and refreshes initially unmapped vendor duplicates", async () => {
    const repository = approvedInvoice();
    const source = (await importAccountingInvoice({ repository }, actor, { ...incoming(), vendorId: undefined })).source;
    const initial = await loadAccountingReviewModel(repository, actor, source.id, "104");
    expect(initial.invoices).toEqual([]);
    const selectedVendor = await loadAccountingReviewModel(repository, actor, source.id, "104", "vendor-northline-summit");
    expect(selectedVendor.invoices.some((invoice) => invoice.id === "approved-425")).toBe(true);
    const draft = { ...createAccountingDraft(selectedVendor), vendorId: "vendor-northline-summit", existingInvoiceId: "approved-425", reason: "Split checked across both stores", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amount: "300.00" }, { lineId: "repair", workOrderId: "wo-northline-105-price-check", amount: "125.00" }] };
    const result = await loadAccountingReviewModel(repository, actor, source.id, "105", draft.vendorId);
    const searched = retainAccountingChoices(draft, result.work);
    expect(searched).toMatchObject({ vendorId: draft.vendorId, existingInvoiceId: draft.existingInvoiceId, reason: draft.reason, splits: draft.splits });
    expect(accountingDraftAmounts(result, searched)[0]).toMatchObject({ total: 42500, allocated: 42500, remaining: 0, valid: true });
    await expect(reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, vendorId: draft.vendorId, splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 50000 }], reason: draft.reason })).rejects.toMatchObject({ code: "CONFLICT" }); // Duplicate protection remains on.
    expect(searched.splits).toEqual(draft.splits);
    const matched = await reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, vendorId: draft.vendorId, existingInvoiceId: draft.existingInvoiceId, reason: draft.reason, splits: draft.splits.map((split) => ({ ...split, amountMinor: Number(split.amount) * 100 })) });
    const reopened = await loadAccountingReviewModel(repository, actor, source.id, "not a result");
    expect(createAccountingDraft(reopened).splits.map(({ workOrderId, amount }) => ({ workOrderId, amount }))).toEqual(draft.splits.map(({ workOrderId, amount }) => ({ workOrderId, amount })));
    expect(reopened.work.some((work) => work.id === "wo-northline-105-price-check")).toBe(true);
    await importAccountingInvoice({ repository }, actor, { ...incoming(40000), revision: 2 });
    const latest = await loadAccountingReviewModel(repository, actor, source.id);
    const recovered = recoverAccountingDraft(searched, latest);
    expect(recovered.version).toBeGreaterThan(matched.version);
    expect(recovered.reason).toBe(draft.reason);
    expect(accountingDraftAmounts(latest, recovered)[0]).toMatchObject({ allocated: 42500, remaining: -2500, valid: false });
  });

  it.each(["currency", "vendor", "maintenance"])("invalidates approval and matching for a later %s correction", async (field) => {
    const repository = approvedInvoice();
    const bill = incoming();
    const source = (await importAccountingInvoice({ repository }, actor, bill)).source;
    await reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, existingInvoiceId: "approved-425", vendorId: bill.vendorId!, reason: "Unchanged existing invoice", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 42500 }] });
    const changed = { ...bill, revision: 2, ...(field === "currency" ? { currency: "EUR" } : field === "vendor" ? { vendorId: undefined, vendorExternalId: "different-source-vendor" } : { maintenance: false }) };
    const updated = (await importAccountingInvoice({ repository }, actor, changed)).source;
    expect(updated.matchState).toBe(field === "maintenance" ? "excluded" : "needs_review");
    expect((await repository.getInvoice(actor.organizationId, "approved-425"))!.approvedForPayment.amountMinor).toBe(0);
    const lines = new Set((await repository.listInvoiceLines(actor.organizationId, "approved-425")).map((line) => line.id));
    expect(repository.snapshot().invoiceLineAllocations.filter((split) => lines.has(split.invoiceLineId) && split.confirmedAt && split.amount.amountMinor > 0)).toEqual([]);
  });

  it("isolates currencies, excludes missing confirmation, and never falls back to a stale invoice reference", async () => {
    const repository = approvedInvoice();
    const bill = { ...incoming(), currency: "EUR", invoiceNumber: "EURO-425" };
    const source = (await importAccountingInvoice({ repository }, actor, bill)).source;
    await reviewAccountingInvoice({ repository }, actor, { sourceId: source.id, expectedVersion: source.version, vendorId: bill.vendorId!, reason: "Confirmed euro bill", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 42500 }] });
    const euro = buildTrendsModel(repository.snapshot(), reportingSession, { metric: "linked_invoice", currency: "EUR", period: "6", detailKind: "current" }, { includeExportRows: true });
    expect(euro.summary.find((row) => row.id === "current")?.value).toBe("€425.00");
    const invoiceId = euro.exportRows![0].invoiceId!;
    const exact = buildTrendsModel(repository.snapshot(), reportingSession, { metric: "linked_invoice", currency: "EUR", invoice: invoiceId, period: "6", view: "stores" }, { includeExportRows: true });
    expect(exact.activeView).toBe("records");
    expect(exact.exportRows!.every((row) => row.invoiceId === invoiceId)).toBe(true);
    expect(new URL(exact.sourceExportLink.href, "http://localhost").searchParams.get("invoice")).toBe(invoiceId);
    expect(exact.filters.find((filter) => filter.id === "invoice")?.value).toBe(invoiceId);
    expect(euro.exportRows!.every((row) => row.currency === "EUR")).toBe(true);
    const unknown = buildTrendsModel(repository.snapshot(), reportingSession, { metric: "linked_invoice", currency: "GBP" });
    expect(unknown.mainResult.value).toBe("No data");
    expect(unknown.summary.find((row) => row.id === "current")?.value).toBe("No data");
    expect(accountingPayload((await repository.getAccountingInvoiceSource(actor.organizationId, source.id))!).delivery.currency).toBe("EUR");
    const incomplete = repository.snapshot();
    incomplete.invoiceReferences.push({ ...incomplete.invoiceReferences[0], id: invoiceId, invoiceDate: "2026-08-20", grossAmount: { amountMinor: 42500, currency: "EUR" }, matchStatus: "confirmed" });
    incomplete.invoiceAllocations.push({ ...incomplete.invoiceAllocations[0], id: "stale-legacy-split", invoiceReferenceId: invoiceId, workOrderId: "wo-northline-104", amount: { amountMinor: 42500, currency: "EUR" }, confirmedAt: incomplete.asOf });
    const invoiceLineIds = new Set(incomplete.invoiceLines.filter((line) => line.invoiceId === invoiceId).map((line) => line.id));
    incomplete.invoiceLineAllocations = incomplete.invoiceLineAllocations.filter((split) => !invoiceLineIds.has(split.invoiceLineId));
    const unconfirmed = buildTrendsModel(incomplete, reportingSession, { metric: "linked_invoice", currency: "EUR", invoice: invoiceId }, { includeExportRows: true });
    expect(unconfirmed.mainResult.value).toBe("No data");
    expect(unconfirmed.exportRows).toEqual([]);

  });
});
