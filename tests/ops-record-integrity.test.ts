import { expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { queryRecordIntegrity } from "@/lib/ops/record-integrity-sql";
import { integrityFromFixture, type IntegrityQuery, type IntegritySource } from "@/lib/ops/record-integrity-query";
import { scopedInvoiceRecords } from "@/lib/ops/dashboard-cohorts";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("uses current exact verification evidence, ignores foreign aging flags and pages every closed record", async () => {
  const fixture = buildNorthlinePresentationFixture(), statements = buildOpsSeedStatements(fixture);
  const organizationId = fixture.organizations[0].id, store = fixture.stores.find(row => row.storeNumber === "104")!;
  const scope = { organizationId, storeIds: [store.id] };
  const work = fixture.workOrders.find(row => row.storeId === store.id && row.status === "closed" && fixture.assignments.some(assignment => assignment.workOrderId === row.id && assignment.vendorId))!;
  const baseOutcome = fixture.siteVisitWorkOrders.find(row => row.workOrderId === work.id)!;
  const outcome = { ...baseOutcome, id: "integrity-outcome", followUpId: undefined, linkedAt: "2026-08-01T16:00:00Z", outcome: "completed" as const, outcomeRecordedAt: "2026-08-01T17:00:00Z" };
  fixture.siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter(row => row.workOrderId !== work.id);
  const prior = { ...outcome, id: "integrity-prior-outcome", visitId: "integrity-prior-visit", linkedAt: "2026-07-01T12:00:00Z", outcomeRecordedAt: "2026-07-01T13:00:00Z" };
  fixture.siteVisitWorkOrders.push(prior, outcome);
  const verified = { ...fixture.workOrderVerifications[0], id: "integrity-a-verified", workOrderId: work.id, siteVisitWorkOrderId: outcome.id, outcome: "completed" as const, outcomeRecordedAt: outcome.outcomeRecordedAt, cycle: 900, decision: "verified" as const, decidedAt: "2026-08-02T16:00:00Z" };
  fixture.workOrderVerifications = fixture.workOrderVerifications.filter(row => row.workOrderId !== work.id);
  fixture.workOrderVerifications.push({ ...verified, siteVisitWorkOrderId: prior.id, outcomeRecordedAt: prior.outcomeRecordedAt }, { ...verified, id: "integrity-z-rejected", reason: "Current condition not confirmed", cycle: 901, decision: "rejected", decidedAt: "2026-08-02T12:00:00-04:00" });
  const invoice = scopedInvoiceRecords(fixture, organizationId, new Set([store.id]))[0];
  const flag = fixture.invoiceExceptions[0];
  fixture.invoiceExceptions = fixture.invoiceExceptions.filter(row => row.invoiceId !== invoice.id);
  fixture.invoiceExceptions.push({ ...flag, id: "integrity-local-flag", invoiceId: invoice.id, detectedAt: "2026-08-24T18:00:00Z", status: "open" }, { ...flag, id: "integrity-foreign-flag", organizationId: "foreign", invoiceId: invoice.id, detectedAt: "2020-01-01T00:00:00Z", status: "open" });
  fixture.workOrders.push({ ...work, id: "integrity-cancelled", requestId: undefined, number: "CANCELLED", status: "cancelled", categoryKey: undefined, assetId: undefined });
  fixture.workOrders.push(...Array.from({ length: 230 }, (_, index) => ({ ...work, id: `integrity-density-${String(index).padStart(3, "0")}`, number: `DENSITY-${index}`, requestId: undefined, closedAt: index % 2 ? "2026-08-01T12:00:00-04:00" : "2026-08-01T16:00:00Z" })));
  const db = new DatabaseSync(":memory:"), returnedRows: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
    const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];
    returnedRows.push(rows.length); return { rows, affectedRows: 0 };
  }, async atomic() { throw new Error("Read-only check"); } };
  const replaceRows = (table: string, rows: object[]) => {
    const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name)));
    db.exec(`DELETE FROM ${table}`);
    for (const row of rows) {
      const entries = Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value] as const).filter(([key]) => columns.has(key));
      db.prepare(`INSERT INTO ${table} (${entries.map(([key]) => key).join(",")}) VALUES (${entries.map(() => "?").join(",")})`).run(...entries.map(([, value]) => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    }
  };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of statements) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    // Cross-tenant foreign keys and inconsistent historical evidence are deliberate
    // read-boundary adversaries, confined to this disposable database.
    db.exec("PRAGMA foreign_keys=OFF");
    replaceRows("ops_work_orders", fixture.workOrders);
    replaceRows("ops_site_visit_work_orders", fixture.siteVisitWorkOrders);
    replaceRows("ops_work_order_verifications", fixture.workOrderVerifications);
    replaceRows("ops_invoice_exceptions", fixture.invoiceExceptions.map(row => ({ ...row, amountMinor: row.amount.amountMinor, currency: row.amount.currency })));
    const check = async (kind: IntegritySource) => {
      const query = { kind, limit: 100 };
      const result = await queryRecordIntegrity(driver, scope, fixture.asOf, query);
      expect(result).toEqual(integrityFromFixture(fixture, scope, fixture.asOf, query)); return result;
    };
    expect((await check("verified")).items.some(row => row.id === work.id)).toBe(false);
    expect((await check("aged_invoice")).items.some(row => row.id === invoice.id)).toBe(false);
    expect((await check("missing_action")).items.some(row => row.id === "integrity-cancelled")).toBe(false);
    expect((await check("unclassified_work")).items.some(row => row.id === "integrity-cancelled")).toBe(false);
    const pending = { ...outcome, id: "integrity-new-cycle", visitId: "integrity-new-visit", linkedAt: "2026-08-03T10:00:00Z", outcome: undefined, outcomeNotes: undefined, outcomeRecordedAt: undefined, outcomeRecordedByActorType: undefined, outcomeRecordedByActorId: undefined, outcomeRecordedByActorName: undefined };
    fixture.siteVisitWorkOrders.push(pending); replaceRows("ops_site_visit_work_orders", fixture.siteVisitWorkOrders);
    expect((await check("with_outcome")).items.some(row => row.id === work.id)).toBe(false);
    const ids: string[] = []; let offset: number | undefined = 0;
    while (offset !== undefined) {
      const query: IntegrityQuery = { kind: "closed_work", limit: 25, offset };
      const page = await queryRecordIntegrity(driver, scope, fixture.asOf, query);
      expect(page).toEqual(integrityFromFixture(fixture, scope, fixture.asOf, query));
      ids.push(...page.items.map(row => row.id)); offset = page.nextOffset;
    }
    expect(new Set(ids).size).toBe(ids.length); expect(ids.filter(id => id.startsWith("integrity-density-"))).toHaveLength(230);
    expect(Math.max(...returnedRows)).toBeLessThanOrEqual(101);
  } finally { db.close(); }
});
