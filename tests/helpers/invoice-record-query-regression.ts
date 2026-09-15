import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { invoiceRecordFromFixture, invoiceRecordSections, type InvoiceRecordQuery } from "@/lib/ops/invoice-record-query";

export async function invoiceRecordQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id, eligible = fixture.invoices.filter(i => fixture.invoiceLines.some(l => l.invoiceId === i.id && fixture.invoiceLineAllocations.some(a => a.invoiceLineId === l.id)));
  const invoice = eligible.find(i => fixture.invoiceExceptions.some(e => e.invoiceId === i.id)) ?? eligible[0];
  const line = fixture.invoiceLines.find(l => l.invoiceId === invoice.id)!;
  const allocation = fixture.invoiceLineAllocations.find(a => a.invoiceLineId === line.id)!;
  const store = fixture.stores.find(s => s.id === allocation.storeId)!;
  const scopes: OrganizationScope[] = [{ organizationId }, { organizationId, storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign" }];
  for (const section of invoiceRecordSections) {
    const query: InvoiceRecordQuery = { section, limit: 2, accounting: true };
    for (const scope of scopes) expect(await repository.readInvoiceRecord(scope, invoice.id, query), `${repository.kind} ${section} ${JSON.stringify(scope)}`).toEqual(invoiceRecordFromFixture(fixture, scope, invoice.id, query));
    for (const changes of [{ offset: 2 }, { offset: 10000 }, { line: line.id }, { line: "missing" }, { match: allocation.id }, { match: "missing" }, { basis: "linked" as const }, { basis: "unmatched" as const }, { open: true }, { accounting: false }]) {
      const q = { ...query, ...changes }; expect(await repository.readInvoiceRecord({ organizationId }, invoice.id, q), `${repository.kind} ${section} ${JSON.stringify(changes)}`).toEqual(invoiceRecordFromFixture(fixture, { organizationId }, invoice.id, q));
    }
  }
  expect((await repository.readInvoiceRecord({ organizationId }, "missing", { section: "items" })).invoice).toBeNull();
}
