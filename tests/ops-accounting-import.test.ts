import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { accountingPayload, importAccountingInvoice, reviewAccountingInvoice } from "@/lib/ops/accounting-import";
import { accountingDemoDelivery } from "@/lib/ops/accounting-demo-adapter";

const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
function setup() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  let sequence = 0;
  return { repository, clock: { now: () => "2026-09-09T18:00:00.000Z" }, ids: { next: (prefix: string) => `${prefix}-accounting-test-${++sequence}` } };
}
const splits = [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 35000 }, { lineId: "travel", workOrderId: "wo-northline-104", amountMinor: 5000 }, { lineId: "travel", workOrderId: "wo-northline-105-price-check", amountMinor: 5000 }];
describe("inbound accounting records", () => {
  it("replays, reviews a split bill, applies a correction and payment without duplication or service changes", async () => {
    const svc = setup();
    const initial = svc.repository.snapshot();
    const first = await importAccountingInvoice(svc, actor, accountingDemoDelivery("new"));
    expect(first.source.matchState).toBe("needs_review");
    expect((await importAccountingInvoice(svc, actor, accountingDemoDelivery("replay"))).replayed).toBe(true);
    expect(svc.repository.snapshot().invoices).toHaveLength(initial.invoices.length);
    const reviewed = await reviewAccountingInvoice(svc, actor, { sourceId: first.source.id, expectedVersion: first.source.version, vendorId: "vendor-northline-summit", splits, reason: "Checked the service records and shared call" });
    expect((await svc.repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.total.amountMinor).toBe(45000);
    const firstLines = await svc.repository.listInvoiceLines(actor.organizationId, reviewed.invoiceId!);
    const firstAllocations = (await Promise.all(firstLines.map((line) => svc.repository.listInvoiceLineAllocations(actor.organizationId, line.id)))).flat();
    expect(new Set(firstAllocations.map((allocation) => allocation.storeId))).toEqual(new Set(["store-northline-104", "store-northline-105"]));
    expect(firstAllocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0)).toBe(45000);
    const changed = await importAccountingInvoice(svc, actor, accountingDemoDelivery("correction"));
    expect(changed.source.invoiceId).toBe(reviewed.invoiceId);
    expect(changed.source.matchState).toBe("needs_review");
    expect((await svc.repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.total.amountMinor).toBe(40000);
    const lines = await svc.repository.listInvoiceLines(actor.organizationId, reviewed.invoiceId!);
    const allocations = (await Promise.all(lines.map((line) => svc.repository.listInvoiceLineAllocations(actor.organizationId, line.id)))).flat();
    expect(allocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0)).toBe(0);
    await expect(reviewAccountingInvoice(svc, actor, { sourceId: first.source.id, expectedVersion: reviewed.version, vendorId: "vendor-northline-summit", splits, reason: "Stale review" })).rejects.toMatchObject({ code: "CONFLICT" });
    await importAccountingInvoice(svc, actor, accountingDemoDelivery("payment"));
    expect((await svc.repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.paidAmount.amountMinor).toBe(40000);
    const paid = (await svc.repository.getAccountingInvoiceSource(actor.organizationId, first.source.id))!;
    expect(paid.matchState).toBe("needs_review");
    await reviewAccountingInvoice(svc, actor, { sourceId: paid.id, expectedVersion: paid.version, vendorId: "vendor-northline-summit", splits: [{ lineId: "repair", workOrderId: "wo-northline-104", amountMinor: 35000 }, { lineId: "travel", workOrderId: "wo-northline-104-issued", amountMinor: 5000 }], reason: "Verified corrected items and both work orders" });
    const flags = await svc.repository.listInvoiceExceptions(actor.organizationId, reviewed.invoiceId!);
    expect(flags.find((flag) => flag.kind === "allocation_mismatch")?.status).toBe("resolved");
    const reviewedSplits = (await Promise.all(lines.map((line) => svc.repository.listInvoiceLineAllocations(actor.organizationId, line.id)))).flat().filter((allocation) => allocation.amount.amountMinor > 0);
    expect(reviewedSplits.every((allocation) => allocation.confirmedByMembershipId === actor.actorId)).toBe(true);
    await importAccountingInvoice(svc, actor, accountingDemoDelivery("void"));
    expect((await svc.repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.status).toBe("void");
    const final = svc.repository.snapshot();
    expect(final.invoices).toHaveLength(initial.invoices.length + 1);
    expect(final.costLines).toEqual(initial.costLines);
    expect(final.workOrders).toEqual(initial.workOrders);
    expect(final.valueEvents).toEqual(initial.valueEvents);
    expect(final.auditEvents.some((event) => event.eventType === "invoice.accounting_source_amended")).toBe(true);
    expect(accountingPayload(changed.source).previousReview?.reason).toBe("Checked the service records and shared call");
  });

  it("keeps imported facts replayable after a human vendor match and fences concurrent review", async () => {
    const svc = setup();
    const delivery = { ...accountingDemoDelivery("new"), vendorId: undefined };
    const source = (await importAccountingInvoice(svc, actor, delivery)).source;
    const input = { sourceId: source.id, expectedVersion: source.version, vendorId: "vendor-northline-summit", splits, reason: "Matched the external supplier to ColdLine" };
    const attempts = await Promise.allSettled([reviewAccountingInvoice(svc, actor, input), reviewAccountingInvoice(svc, actor, input)]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await importAccountingInvoice(svc, actor, delivery)).replayed).toBe(true);
    const reviewed = (await svc.repository.getAccountingInvoiceSource(actor.organizationId, source.id))!;
    expect(accountingPayload(reviewed).delivery.vendorId).toBeUndefined();
    expect(accountingPayload(reviewed).reviewedVendorId).toBe(input.vendorId);
    await expect(importAccountingInvoice(svc, actor, { ...delivery, revision: 2, kind: "credit", relatedExternalInvoiceId: "some-bill" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires review of duplicate vendor references, uses company identity, and filters merchandise", async () => {
    const svc = setup();
    const existing = svc.repository.snapshot().invoices.find((invoice) => invoice.vendorId === "vendor-northline-summit")!;
    const delivery = { ...accountingDemoDelivery("new"), invoiceNumber: existing.vendorInvoiceNumber };
    const first = await importAccountingInvoice(svc, actor, delivery);
    const input = { sourceId: first.source.id, expectedVersion: first.source.version, vendorId: delivery.vendorId!, splits, reason: "Check duplicate" };
    await expect(reviewAccountingInvoice(svc, actor, input)).rejects.toMatchObject({ code: "CONFLICT" });
    const count = svc.repository.snapshot().invoices.length;
    await reviewAccountingInvoice(svc, actor, { ...input, existingInvoiceId: existing.id });
    expect(svc.repository.snapshot().invoices).toHaveLength(count);
    const other = await importAccountingInvoice(svc, actor, { ...delivery, companyKey: "different-company" });
    expect(other.source.id).not.toBe(first.source.id);
    await expect(reviewAccountingInvoice(svc, actor, { ...input, sourceId: other.source.id, existingInvoiceId: existing.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await importAccountingInvoice(svc, actor, accountingDemoDelivery("merchandise"))).source.matchState).toBe("excluded");
    expect(svc.repository.snapshot().invoices).toHaveLength(count);
  });

  it("rejects inconsistent amounts and forbidden actors and keeps credits separate from savings", async () => {
    const svc = setup();
    await expect(importAccountingInvoice(svc, { ...actor, organizationId: "foreign" }, accountingDemoDelivery("new"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(importAccountingInvoice(svc, { ...actor, actorId: "membership-northline-store-104" }, accountingDemoDelivery("new"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(importAccountingInvoice(svc, actor, { ...accountingDemoDelivery("new"), totalMinor: 1 })).rejects.toMatchObject({ code: "VALIDATION" });
    const original = await importAccountingInvoice(svc, actor, accountingDemoDelivery("new"));
    const reviewed = await reviewAccountingInvoice(svc, actor, { sourceId: original.source.id, expectedVersion: original.source.version, vendorId: "vendor-northline-summit", splits, reason: "Match original bill" });
    const credit = await importAccountingInvoice(svc, actor, accountingDemoDelivery("credit"));
    const values = svc.repository.snapshot().valueEvents;
    await reviewAccountingInvoice(svc, actor, { sourceId: credit.source.id, expectedVersion: credit.source.version, vendorId: "vendor-northline-summit", existingInvoiceId: reviewed.invoiceId, splits: [], reason: "Credit applies to this accounting bill" });
    expect(svc.repository.snapshot().valueEvents).toEqual(values);
    expect((await svc.repository.getInvoice(actor.organizationId, reviewed.invoiceId!))?.total.amountMinor).toBe(45000);
    expect(await svc.repository.listAccountingInvoiceSources("foreign", 25, 0)).toEqual([]);
  });
});
