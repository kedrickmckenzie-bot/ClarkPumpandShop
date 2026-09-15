import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { invoiceQueueFromFixture, invoiceQueueViews, type InvoiceQueueQuery } from "@/lib/ops/invoice-queue-query";

export async function invoiceQueueQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id, store = fixture.stores[0];
  const scopes: OrganizationScope[] = [{ organizationId }, { organizationId, storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign" }];
  for (const view of invoiceQueueViews) {
    const query: InvoiceQueueQuery = { view, currency: "USD", limit: 2 };
    for (const scope of scopes) expect(await repository.listInvoiceQueue(scope, query), `${repository.kind} ${view} ${JSON.stringify(scope)}`).toEqual(invoiceQueueFromFixture(fixture, scope, query));
    for (const changes of [{ offset: 2 }, { offset: 10000 }, { search: "SUM" }, { search: "cold" }, { search: "100%_\\" }, { currency: "CAD" }]) {
      const q = { ...query, ...changes }; expect(await repository.listInvoiceQueue({ organizationId }, q), `${repository.kind} ${view} ${JSON.stringify(changes)}`).toEqual(invoiceQueueFromFixture(fixture, { organizationId }, q));
    }
  }
}
