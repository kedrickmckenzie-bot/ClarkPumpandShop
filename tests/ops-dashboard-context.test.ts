import { expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { dashboardContextFromFixture } from "@/lib/ops/dashboard-context";
import { queryDashboardContext } from "@/lib/ops/dashboard-context-sql";
import { presentInvoiceSpotlight } from "@/app/app/_data/dashboard-context-presenter";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("selects the oldest fully visible invoice with two bounded native reads, including timestamp ties", async () => {
  const fixture = buildNorthlinePresentationFixture();
  const organizationId = fixture.organizations[0].id;
  fixture.organizations.push({ ...fixture.organizations[0], id: "foreign-org", name: "Separate test tenant" });
  const store = fixture.stores[0], otherStore = fixture.stores.find(row => row.id !== store.id)!;
  const sourceInvoice = fixture.invoices[0], sourceLine = fixture.invoiceLines[0], sourceAllocation = fixture.invoiceLineAllocations[0], sourceFlag = fixture.invoiceExceptions[0];
  fixture.invoiceExceptions = [];
  const add = (id: string, detectedAt: string, storeIds: string[], status: "open" | "resolved" = "open") => {
    fixture.invoices.push({ ...sourceInvoice, id, vendorInvoiceNumber: id, total: { amountMinor: 123456, currency: "CAD" } });
    fixture.invoiceLines.push({ ...sourceLine, id: `${id}-line`, invoiceId: id, lineNumber: 1 });
    storeIds.forEach((storeId, index) => fixture.invoiceLineAllocations.push({ ...sourceAllocation, id: `${id}-allocation-${index}`, invoiceLineId: `${id}-line`, storeId }));
    fixture.invoiceExceptions.push({ ...sourceFlag, id: `${id}-flag`, invoiceId: id, detectedAt, status });
  };
  add("invoice-a-visible", "2026-01-01T00:00:00.000Z", [store.id]);
  add("invoice-b-visible", "2025-12-31T19:00:00-05:00", [store.id]);
  add("invoice-cross-store", "2025-01-01T00:00:00Z", [store.id, otherStore.id]);
  add("invoice-unallocated", "2024-01-01T00:00:00Z", []);
  add("invoice-resolved", "2023-01-01T00:00:00Z", [store.id], "resolved");
  // Another organization's evidence must not make a local invoice the oldest candidate.
  fixture.invoiceExceptions.push({ ...sourceFlag, id: "foreign-invoice-flag", organizationId: "foreign-org", invoiceId: "invoice-b-visible", detectedAt: "2020-01-01T00:00:00Z", status: "open" });
  const db = new DatabaseSync(":memory:");
  const returnedRows: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
    const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];
    returnedRows.push(rows.length); return { rows, affectedRows: 0 };
  }, async atomic() { throw new Error("Read-only check"); } };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const scopes = [{ organizationId, storeIds: [store.id] }, { organizationId }, { organizationId, storeIds: [] }, { organizationId: "foreign-org", storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }];
    for (const scope of scopes) expect(await queryDashboardContext(driver, scope)).toEqual(dashboardContextFromFixture(fixture, scope));
    expect(returnedRows).toHaveLength(scopes.length * 2);
    expect(returnedRows.every(count => count <= 1)).toBe(true);
    const local = await queryDashboardContext(driver, scopes[0]);
    expect(local.invoice?.id).toBe("invoice-a-visible");
    expect((await queryDashboardContext(driver, { organizationId })).invoice?.id).toBe("invoice-cross-store");
    const spotlight = presentInvoiceSpotlight(local.invoice)!;
    expect(spotlight.facts[0]).toEqual({ label: "Invoice total · CAD", value: "CA$1,234.56" });
    expect(spotlight.link.href).toBe("/app/invoices/invoice-a-visible");
    db.exec("UPDATE ops_invoice_exceptions SET status='resolved'");
    expect((await queryDashboardContext(driver, scopes[0])).invoice).toBeUndefined();
    expect(presentInvoiceSpotlight(undefined)).toBeUndefined();
  } finally { db.close(); }
});
