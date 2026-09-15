import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { pmReviewFromFixture, type PmReviewQuery } from "@/lib/ops/pm-review-query";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { OpsFixture } from "@/lib/ops/types";

function database(fixture: OpsFixture) {
  const db = new DatabaseSync(":memory:"), sizes: number[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
    const rows = db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];
    sizes.push(rows.length); return { rows, affectedRows: 0 };
  }, async atomic() { throw new Error("Read cannot mutate"); } };
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
  return { db, sizes, repository: createOpsSqlRepository(driver, "d1") };
}

it("traverses full PM review and invoice/visit cohorts with bounded pages and stable ties", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const base = fixture.serviceDiscrepancies.find(r => r.factsJson.includes("pm_billed_vs_observed"))!;
  for (let i = 0; i < 230; i++) fixture.serviceDiscrepancies.push({ ...base, id: `review-density-${String(229 - i).padStart(3, "0")}`, createdAt: i % 2 ? "2026-08-26T05:00:00-04:00" : "2026-08-26T09:00:00.000Z" });
  const facts = JSON.parse(base.factsJson), invoice = fixture.invoices.find(i => i.id === base.invoiceId)!;
  const line = fixture.invoiceLines.find(l => l.invoiceId === invoice.id)!, allocation = fixture.invoiceLineAllocations.find(a => a.invoiceLineId === line.id)!;
  const visit = fixture.visits.find(v => v.id === facts.observedVisitIds[0])!;
  for (let i = 0; i < 31; i++) {
    const id = `review-extra-${String(i).padStart(2, "0")}`;
    fixture.invoices.push({ ...invoice, id, vendorInvoiceNumber: id });
    fixture.invoiceLines.push({ ...line, id: `line-${id}`, invoiceId: id });
    fixture.invoiceLineAllocations.push({ ...allocation, id: `allocation-${id}`, invoiceLineId: `line-${id}` });
    facts.billedInvoiceIds.push(id);
    fixture.visits.push({ ...visit, id: `visit-${id}` });
    for (const link of fixture.siteVisitWorkOrders.filter(l => l.visitId === visit.id)) fixture.siteVisitWorkOrders.push({ ...link, id: `${id}-${link.id}`, visitId: `visit-${id}` });
  }
  base.factsJson = JSON.stringify(facts);
  const { db, sizes, repository } = database(fixture), scope = { organizationId };
  try {
    for (const kind of ["reviews", "invoices", "visits"] as const) {
      const seen: string[] = []; let offset = 0, total = 0;
      do {
        const query: PmReviewQuery = { kind, review: kind === "reviews" ? undefined : base.id, limit: 25, offset };
        const page = await repository.listPmReview(scope, query);
        expect(page).toEqual(pmReviewFromFixture(fixture, scope, query));
        seen.push(...(kind === "reviews" ? page.reviews : page.sources).map(r => r.id)); total = page.totalCount;
        if (page.nextOffset === undefined) break;
        offset = page.nextOffset; if (offset > 1000) throw new Error("Pagination did not advance");
      } while (offset <= 1000);
      expect(seen).toHaveLength(total); expect(new Set(seen).size).toBe(total);
      expect(total).toBeGreaterThan(25);
      const past = await repository.listPmReview(scope, { kind, review: kind === "reviews" ? undefined : base.id, offset: 10000, limit: 25 });
      expect(past.totalCount).toBe(total); expect(past.sources).toEqual([]); expect(past.reviews).toEqual([]);
      if (kind !== "reviews") expect(past.parent?.id).toBe(base.id);
    }
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25);
  } finally { db.close(); }
}, 30000);

it("keeps damaged references partial, currencies separate and current cross-channel evidence auditable", async () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id;
  const review = fixture.serviceDiscrepancies.find(r => r.factsJson.includes("pm_billed_vs_observed"))!;
  const facts = JSON.parse(review.factsJson), scope = { organizationId, storeIds: [facts.storeId] };
  const otherInvoice = fixture.invoices.find(i => fixture.invoiceLines.some(l => l.invoiceId === i.id && fixture.invoiceLineAllocations.some(a => a.invoiceLineId === l.id && a.storeId !== facts.storeId)))!;
  facts.billedInvoiceIds.push(facts.billedInvoiceIds[0], otherInvoice.id, "unknown-invoice", "unknown-invoice", 42, null);
  facts.missingOccurrenceIds.push("unknown-occurrence"); facts.observedVisitIds.push("unknown-visit");
  review.factsJson = JSON.stringify(facts);
  for (const [i, invalid] of ["{broken", "null", "[]", JSON.stringify({ ...facts, storeId: 107 }), JSON.stringify({ ...facts, storeId: fixture.stores[0].id })].entries()) fixture.serviceDiscrepancies.push({ ...review, id: `invalid-review-${i}`, factsJson: invalid });
  const { db, repository } = database(fixture);
  const check = async (query: PmReviewQuery) => {
    const page = await repository.listPmReview(scope, query); expect(page).toEqual(pmReviewFromFixture(fixture, scope, query)); return page;
  };
  try {
    expect((await check({ kind: "reviews", limit: 25 })).reviews).toHaveLength(1);
    const initial = (await check({ kind: "invoices", review: review.id, limit: 25 })).parent!;
    expect(initial).toMatchObject({ invoiceCount: 4, occurrenceCount: 4, visitCount: 2, missingCount: 2, unavailableLinks: 4, amountMinor: 170000, missingAmountMinor: 85000 });
    const line = fixture.invoiceLines.find(l => l.invoiceId === facts.billedInvoiceIds[0])!;
    const allocation = fixture.invoiceLineAllocations.find(a => a.invoiceLineId === line.id)!;
    allocation.amount.currency = "CAD"; db.prepare("UPDATE ops_invoice_line_allocations SET currency='CAD' WHERE id=?").run(allocation.id);
    const mixed = await check({ kind: "invoices", review: review.id, limit: 25 });
    expect(mixed.parent?.amountMinor).toBeUndefined(); expect(mixed.parent?.currency).toBeUndefined();
    expect(new Set(mixed.sources.map(r => r.currency))).toEqual(new Set(["USD", "CAD"]));
    // A valid visit can acquire a second work order through another channel.
    const target = fixture.pmOccurrences.find(o => o.id === facts.missingOccurrenceIds[0])!, visit = fixture.visits.find(v => v.id === facts.observedVisitIds[0])!;
    const link = { id: "review-cross-channel-link", organizationId, visitId: visit.id, workOrderId: target.workOrderId!, ordinal: 99, linkedByActorType: "user" as const, linkedByActorName: "Test operator", linkedAt: fixture.asOf };
    fixture.siteVisitWorkOrders.push(link);
    db.prepare("INSERT INTO ops_site_visit_work_orders (id,organization_id,visit_id,work_order_id,ordinal,linked_by_actor_type,linked_by_actor_name,linked_at) VALUES (?,?,?,?,?,?,?,?)").run(link.id, organizationId, link.visitId, link.workOrderId, link.ordinal, link.linkedByActorType, link.linkedByActorName, link.linkedAt);
    expect((await check({ kind: "occurrences", review: review.id, missing: true, limit: 25 })).totalCount).toBe(1);
    expect(db.prepare("SELECT facts_json FROM ops_service_discrepancies WHERE id=?").get(review.id)?.facts_json).toBe(review.factsJson);
    // A whole invoice becomes unavailable when any allocation crosses stores.
    allocation.storeId = fixture.stores[0].id; db.prepare("UPDATE ops_invoice_line_allocations SET store_id=? WHERE id=?").run(allocation.storeId, allocation.id);
    expect((await check({ kind: "invoices", review: review.id, limit: 25 })).parent).toMatchObject({ invoiceCount: 3, unavailableLinks: 5 });
    for (const denied of [{ organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign" }, { organizationId, storeIds: [fixture.stores[0].id] }]) {
      const page = await repository.listPmReview(denied, { kind: "invoices", review: review.id, limit: 25 });
      expect(page.sources).toEqual([]); expect(page.parent).toBeNull(); expect(page.totalCount).toBe(0);
    }
  } finally { db.close(); }
}, 30000);
