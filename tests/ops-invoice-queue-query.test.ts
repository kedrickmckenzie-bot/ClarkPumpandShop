import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import { invoiceQueueFromFixture, invoiceQueueViews } from "@/lib/ops/invoice-queue-query";
import { invoiceQueueQueryRegression } from "./helpers/invoice-queue-query-regression";

it("pages exact invoice, flag and currency source cohorts with parent scope enforced", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const invoice = fixture.invoices.find(i => i.id === "invoice-summit-104-compressor")!, line = fixture.invoiceLines.find(l => l.invoiceId === invoice.id)!;
  const allocation = fixture.invoiceLineAllocations.find(a => a.invoiceLineId === line.id)!, flag = fixture.invoiceExceptions.find(f => f.invoiceId === invoice.id)!;
  const event = fixture.valueEvents.find(e => e.category === "identified_exposure" && e.invoiceLineId)!;
  for (let i = 0; i < 230; i++) {
    const id = `queue-dense-${String(229 - i).padStart(3, "0")}`, date = i % 2 ? "2026-08-25T14:00:00-04:00" : "2026-08-25T18:00:00.000Z";
    fixture.invoices.push({ ...invoice, id, vendorInvoiceNumber: `Density ${id}`, invoiceDate: "2026-08-25" });
    fixture.invoiceLines.push({ ...line, id: `line-${id}`, invoiceId: id });
    fixture.invoiceLineAllocations.push({ ...allocation, id: `allocation-${id}`, invoiceLineId: `line-${id}` });
    fixture.invoiceExceptions.push({ ...flag, id: `flag-${id}`, invoiceId: id, status: "open", detectedAt: date });
    fixture.valueEvents.push({ ...event, id: `event-${id}`, deduplicationKey: `queue-event-${id}`, invoiceLineId: `line-${id}`, workOrderId: allocation.workOrderId, amount: { amountMinor: 123, currency: i % 2 ? "USD" : "CAD" }, occurredAt: date });
  }
  fixture.invoices.push({ ...invoice, id: "queue-unallocated", vendorInvoiceNumber: "UNALLOCATED" });
  const db = new DatabaseSync(":memory:"), sizes: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(s: { sql: string; params: readonly unknown[] }) { const rows = db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[]; sizes.push(rows.length); return { rows, affectedRows: 0 }; }, async atomic() { throw new Error("Read cannot mutate"); } };
  const repository = createOpsSqlRepository(driver, "d1");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const s of buildOpsSeedStatements(fixture)) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    await invoiceQueueQueryRegression(repository, fixture);
    const scope = { organizationId, storeIds: [allocation.storeId] };
    for (const view of invoiceQueueViews) {
      const seen: string[] = []; let offset = 0;
      do {
        const query = { view, currency: "USD", search: "Density", limit: 25, offset }, page = await repository.listInvoiceQueue(scope, query);
        expect(page).toEqual(invoiceQueueFromFixture(fixture, scope, query)); seen.push(...page.rows.map(r => r.id));
        if (page.nextOffset === undefined) break; offset = page.nextOffset; if (offset > 1000) throw new Error("Pagination did not advance");
      } while (offset <= 1000);
      expect(seen).toHaveLength(view === "exposure" ? 115 : 230); expect(new Set(seen).size).toBe(seen.length);
    }
    expect((await repository.listInvoiceQueue(scope, { view: "all", search: "UNALLOCATED", currency: "USD" })).totalCount).toBe(0);
    expect((await repository.listInvoiceQueue({ organizationId }, { view: "all", search: "UNALLOCATED", currency: "USD" })).totalCount).toBe(1);
    expect((await repository.listInvoiceQueue(scope, { view: "exposure", search: "Density", currency: "CAD" })).exposureAmount.amountMinor).toBe(115 * 123);
    const changed = fixture.invoiceLineAllocations.find(a => a.id === "allocation-queue-dense-229")!;
    changed.storeId = fixture.stores.find(s => s.id !== allocation.storeId)!.id;
    db.prepare("UPDATE ops_invoice_line_allocations SET store_id=? WHERE id=?").run(changed.storeId, changed.id);
    for (const view of invoiceQueueViews) { const query = { view, currency: "USD", search: "queue-dense-229" }; expect((await repository.listInvoiceQueue({ organizationId }, query)).totalCount).toBe(0); }
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25);
  } finally { db.close(); }
}, 120_000);
