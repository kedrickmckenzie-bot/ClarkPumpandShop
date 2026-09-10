import type { ListPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import { invoiceReporting } from "@/lib/ops/invoice-reporting";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { matchesWorkCategoryPath } from "@/lib/ops/work-cost-query";
import type { OpsFixture } from "@/lib/ops/types";
import type { OperatorSearchParameters } from "./operator-presenter";

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export function hasInvoiceEvidenceFilters(query: OperatorSearchParameters) {
  return ["from", "to", "costMonth", "store", "region", "category", "path", "asset", "component"].some((key) => Boolean(first(query[key])));
}

/** The Spending chart and this table use the same confirmed allocation source. */
export function buildInvoiceEvidenceModel(fixture: OpsFixture, session: OperatorSession, query: OperatorSearchParameters): ListPageViewModel {
  const values = Object.fromEntries(Object.entries(query).flatMap(([key, raw]) => first(raw) ? [[key, first(raw)!]] : []));
  const currency = /^[A-Z]{3}$/.test(values.currency ?? "") ? values.currency : "USD";
  const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
  const stores = new Map(fixture.stores.filter((store) => store.organizationId === session.organizationId
    && (!session.storeIds || session.storeIds.includes(store.id))
    && (!session.regionIds || Boolean(store.regionId && session.regionIds.includes(store.regionId)))).map((store) => [store.id, store]));
  const assets = new Map(fixture.assets.filter((asset) => asset.organizationId === session.organizationId).map((asset) => [asset.id, asset]));
  const work = new Map(fixture.workOrders.filter((row) => row.organizationId === session.organizationId && stores.has(row.storeId)).map((row) => [row.id, row]));
  const rows = invoiceReporting(fixture, session.organizationId).allocations.filter((allocation) => {
    const order = work.get(allocation.workOrderId);
    if (!order || allocation.amount.currency !== currency) return false;
    return (!values.from || allocation.invoiceDate >= values.from)
      && (!values.to || allocation.invoiceDate.slice(0, 10) <= values.to)
      && (!values.costMonth || allocation.invoiceDate.slice(0, 7) === values.costMonth)
      && (!values.store || order.storeId === values.store)
      && (!values.region || stores.get(order.storeId)?.regionId === values.region)
      && (!values.category || (order.categoryKey ?? "unclassified") === values.category)
      && (!values.asset || (values.asset === "unlinked" ? !order.assetId : order.assetId === values.asset))
      && (!values.component || (values.component === "unlinked" ? !order.componentId : order.componentId === values.component))
      && matchesWorkCategoryPath(order.assetId ? assets.get(order.assetId) : undefined, values.path?.split("|"))
      && (!values.q || `${allocation.invoiceNumber} ${order.number} ${order.problem} ${stores.get(order.storeId)?.storeNumber}`.toLowerCase().includes(values.q.toLowerCase()));
  }).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const requested = Number(values.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ ...values, ...overrides }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `/app/invoices?${params}`;
  };
  const fullInvoiceAccess = (invoiceId: string) => {
    const lineIds = new Set(fixture.invoiceLines.filter((line) => line.organizationId === session.organizationId && line.invoiceId === invoiceId).map((line) => line.id));
    const allocations = fixture.invoiceLineAllocations.filter((row) => row.organizationId === session.organizationId && lineIds.has(row.invoiceLineId));
    return allocations.length > 0 && allocations.every((row) => stores.has(row.storeId));
  };
  const selectedStore = values.store ? stores.get(values.store) : undefined;
  return {
    state: { kind: "ready" }, rowNavigation: "record",
    page: { title: "Linked invoice amount", eyebrow: "Invoice source records", description: "Confirmed invoice allocations behind the selected spending total. Open an allocation to review its invoice, or follow the linked work order and store.",
      scopeLabel: [selectedStore ? `Store ${selectedStore.storeNumber} · ${selectedStore.name}` : session.scopeLabel,
        values.region ? fixture.regions.find((row) => row.organizationId === session.organizationId && row.id === values.region)?.name : undefined,
        values.category, values.path?.split("|").join(" › "), values.asset ? assets.get(values.asset)?.name ?? "Unlinked equipment" : undefined,
        values.component ? fixture.components.find((row) => row.organizationId === session.organizationId && row.id === values.component)?.name ?? "Unlinked component" : undefined].filter(Boolean).join(" · "),
      periodLabel: [values.from ? `From ${formatOperationsDate(values.from)}` : undefined, values.to ? `Through ${formatOperationsDate(values.to)}` : undefined, currency].filter(Boolean).join(" · "),
      secondaryAction: { label: "All invoice references", href: "/app/invoices" } },
    resultSummary: `${rows.length} confirmed allocations · ${money(rows.reduce((sum, row) => sum + row.amount.amountMinor, 0))}`,
    search: { label: "Search invoice evidence", placeholder: "Invoice, work order, problem, or store number", value: values.q, action: "/app/invoices", preservedParameters: Object.entries(values).filter(([key]) => !["q", "page"].includes(key)).map(([name, value]) => ({ name, value })) },
    table: { id: "invoice-evidence", caption: "Confirmed invoice allocations", columns: [{ key: "invoice", label: "Invoice" }, { key: "work", label: "Work order" }, { key: "store", label: "Store" }, { key: "date", label: "Invoice date" }, { key: "amount", label: "Linked amount", align: "end" }], rows: rows.slice((page - 1) * 25, page * 25).map((row) => {
      const order = work.get(row.workOrderId)!;
      const store = stores.get(order.storeId)!;
      return { id: row.id, label: row.invoiceNumber, href: fullInvoiceAccess(row.invoiceId) ? row.href : `/app/work-orders/${order.id}?view=cost`, cells: [
        { key: "invoice", value: row.invoiceNumber },
        { key: "work", value: order.number, secondary: order.problem, link: { href: `/app/work-orders/${order.id}?view=cost`, label: "Open work cost" } },
        { key: "store", value: `Store ${store.storeNumber}`, secondary: store.name, link: { href: `/app/stores/${store.id}`, label: "Open store" } },
        { key: "date", value: formatOperationsDate(row.invoiceDate) }, { key: "amount", value: money(row.amount.amountMinor) },
      ] };
    }) },
    pagination: pageCount > 1 ? { summary: `${rows.length} allocations · 25 per page`, currentPage: page, totalPages: pageCount,
      pageLinks: [...new Set([1, page - 1, page, page + 1, pageCount])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b).map((value) => ({ page: value, current: value === page, href: href({ page: String(value) }) })),
      previousHref: page > 1 ? href({ page: String(page - 1) }) : undefined, nextHref: page < pageCount ? href({ page: String(page + 1) }) : undefined } : undefined,
  };
}
