import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import { invoiceRecordFromFixture } from "@/lib/ops/invoice-record-query";
import { invoiceRecordQueryRegression } from "./helpers/invoice-record-query-regression";

it("reads invoice sources with stable bounded pages and rejects conflicting allocation parents", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const invoice = fixture.invoices.find(i => i.id === "invoice-summit-107-pm-2026-q3")!, line = fixture.invoiceLines.find(l => l.invoiceId === invoice.id)!;
  const allocation = fixture.invoiceLineAllocations.find(a => a.invoiceLineId === line.id)!, scope = { organizationId, storeIds: [allocation.storeId] };
  for (let i = 0; i < 230; i++) {
    const id = `invoice-dense-${String(229 - i).padStart(3, "0")}`;
    fixture.invoiceLines.push({ ...line, id, lineNumber: i + 2 });
    fixture.invoiceLineAllocations.push({ ...allocation, id: `allocation-${id}`, invoiceLineId: id });
    fixture.invoiceExceptions.push({ id: `flag-${id}`, organizationId, invoiceId: invoice.id, kind: "allocation_mismatch", status: "open", summary: "Synthetic evidence check", amount: { amountMinor: 1, currency: "USD" }, detectedAt: i % 2 ? "2026-08-25T14:00:00-04:00" : fixture.asOf });
    fixture.invoiceAdjustments.push({ id: `adjustment-${id}`, organizationId, invoiceId: invoice.id, kind: "credit", amount: { amountMinor: 1, currency: i % 2 ? "CAD" : "USD" }, reason: "Synthetic recorded correction", createdByMembershipId: "membership-northline-finance", createdAt: i % 2 ? "2026-08-25T14:00:00-04:00" : fixture.asOf });
  }
  invoice.total = { ...invoice.total, amountMinor: invoice.total.amountMinor * 231 }; invoice.subtotal = { ...invoice.total };
  const unallocated = { ...invoice, id: "invoice-unallocated-test", vendorInvoiceNumber: "UNALLOCATED-TEST" }; fixture.invoices.push(unallocated);
  const db = new DatabaseSync(":memory:"), sizes: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(s: { sql: string; params: readonly unknown[] }) { const rows = db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[]; sizes.push(rows.length); return { rows, affectedRows: 0 }; }, async atomic() { throw new Error("Read cannot mutate"); } };
  const repository = createOpsSqlRepository(driver, "d1");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const s of buildOpsSeedStatements(fixture)) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    await invoiceRecordQueryRegression(repository, fixture);
    for (const section of ["items", "matches", "flags", "history"] as const) {
      const seen: string[] = []; let offset = 0;
      do {
        const query = { section, limit: 25, offset }, page = await repository.readInvoiceRecord(scope, invoice.id, query);
        expect(page).toEqual(invoiceRecordFromFixture(fixture, scope, invoice.id, query)); seen.push(...page.rows.map(r => r.id));
        if (page.nextOffset === undefined) break; offset = page.nextOffset; if (offset > 1000) throw new Error("Pagination did not advance");
      } while (offset <= 1000);
      const expected = section === "items" || section === "matches" ? 231 : 230;
      expect(seen).toHaveLength(expected); expect(new Set(seen).size).toBe(expected);
      expect((await repository.readInvoiceRecord(scope, invoice.id, { section, offset: 10000, limit: 25 })).totalCount).toBe(expected);
    }
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25);
    expect((await repository.readInvoiceRecord({ organizationId }, unallocated.id, { section: "items" })).invoice?.reportingState).toBe("needs_review");
    expect((await repository.readInvoiceRecord(scope, unallocated.id, { section: "items" })).invoice).toBeNull();
    expect((await repository.readInvoiceRecord(scope, invoice.id, { section: "matches", basis: "linked" })).invoice).toMatchObject({ itemsReconcile: true, linked: invoice.total, unmatched: { amountMinor: 0, currency: "USD" } });
    allocation.confirmedAt = undefined; db.prepare("UPDATE ops_invoice_line_allocations SET confirmed_at=NULL WHERE id=?").run(allocation.id);
    const unmatched = await repository.readInvoiceRecord(scope, invoice.id, { section: "items", basis: "unmatched" });
    expect(unmatched).toEqual(invoiceRecordFromFixture(fixture, scope, invoice.id, { section: "items", basis: "unmatched" }));
    expect(unmatched.totalCount).toBe(1); expect(unmatched.rows[0].amount).toEqual(line.lineAmount);
    expect((await repository.readInvoiceRecord(scope, invoice.id, { section: "matches", basis: "linked" })).totalCount).toBe(230);
    expect((await repository.readInvoiceRecord(scope, invoice.id, { section: "matches", match: allocation.id })).rows.map(r => r.id)).toEqual([allocation.id]);
    allocation.siteVisitWorkOrderId = fixture.siteVisitWorkOrders.find(v => v.workOrderId !== allocation.workOrderId)!.id;
    db.prepare("UPDATE ops_invoice_line_allocations SET site_visit_work_order_id=? WHERE id=?").run(allocation.siteVisitWorkOrderId, allocation.id);
    expect((await repository.readInvoiceRecord(scope, invoice.id, { section: "matches", match: allocation.id })).rows[0]).toMatchObject({ unavailableVisit: true, visitId: undefined });
    const otherStore = fixture.stores.find(s => s.id !== allocation.storeId)!;
    db.prepare("UPDATE ops_invoice_line_allocations SET store_id=? WHERE id=?").run(otherStore.id, allocation.id);
    expect((await repository.readInvoiceRecord({ organizationId }, invoice.id, { section: "items" })).invoice).toBeNull();
    expect((await repository.readInvoiceRecord({ organizationId, storeIds: [] }, invoice.id, { section: "history", accounting: true })).invoice).toBeNull();
  } finally { db.close(); }
}, 30000);
