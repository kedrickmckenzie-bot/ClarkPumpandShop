import type { OrganizationScope } from "./repository";
import type { Invoice, Money, OpsFixture } from "./types";
import { scopedInvoiceRecords } from "./dashboard-cohorts";

/** Two bounded record references; invoice lines, allocations and exception history stay on the server. */
export interface DashboardContext {
  store?: { id: string; storeNumber: string };
  invoice?: {
    id: string;
    number: string;
    vendorName: string;
    status: Invoice["status"];
    total: Money;
  };
}

const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function dashboardContextFromFixture(fixture: OpsFixture, scope: OrganizationScope): DashboardContext {
  const stores = fixture.stores.filter(store => store.organizationId === scope.organizationId
    && (scope.storeIds === undefined || scope.storeIds.includes(store.id))
    && (scope.regionIds === undefined || Boolean(store.regionId && scope.regionIds.includes(store.regionId))))
    .sort((a, b) => compareId(a.storeNumber, b.storeNumber) || compareId(a.id, b.id));
  const visible = new Map(scopedInvoiceRecords(fixture, scope.organizationId, new Set(stores.map(store => store.id))).map(invoice => [invoice.id, invoice]));
  // Oldest unresolved evidence first, with a stable invoice identity for tied timestamps.
  const flag = fixture.invoiceExceptions.filter(flag => flag.organizationId === scope.organizationId && flag.status === "open" && visible.has(flag.invoiceId))
    .sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt) || compareId(a.invoiceId, b.invoiceId))[0];
  const invoice = flag ? visible.get(flag.invoiceId)! : undefined;
  return {
    store: stores[0] ? { id: stores[0].id, storeNumber: stores[0].storeNumber } : undefined,
    invoice: invoice ? { id: invoice.id, number: invoice.vendorInvoiceNumber, vendorName: fixture.vendors.find(vendor => vendor.organizationId === scope.organizationId && vendor.id === invoice.vendorId)?.name ?? "Unknown vendor", status: invoice.status, total: { ...invoice.total } } : undefined,
  };
}
