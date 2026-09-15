import type { OpsFixture } from "./types";

export interface MaintenancePlan {
  estimateLabel: string;
  pricedCount: number;
  unpricedCount: number;
  totalCount: number;
  page: number;
  pages: number;
  rows: Array<{ id: string; number: string; problem: string; store: string; estimate: string; nextAction: string; due: string; href: string }>;
}

/** A work estimate inventory, not an invoice balance or a spending forecast. */
export function buildMaintenancePlan(fixture: OpsFixture, organizationId: string, eligibleWorkIds: Set<string>, currency: string, requestedPage = 1): MaintenancePlan {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
  const stores = new Map(fixture.stores.filter((store) => store.organizationId === organizationId).map((store) => [store.id, store]));
  const work = fixture.workOrders.filter((row) => row.organizationId === organizationId && eligibleWorkIds.has(row.id)
    && stores.has(row.storeId) && !["closed", "cancelled", "resolved", "completed_pending_review"].includes(row.status)
    && row.createdAt <= fixture.asOf)
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || a.id.localeCompare(b.id));
  const priced = work.filter((row) => row.repairEstimate?.currency === currency);
  const pages = Math.max(1, Math.ceil(work.length / 10));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return {
    estimateLabel: money.format(priced.reduce((sum, row) => sum + row.repairEstimate!.amountMinor, 0) / 100),
    pricedCount: priced.length, unpricedCount: work.length - priced.length, totalCount: work.length, page, pages,
    rows: work.slice((page - 1) * 10, page * 10).map((row) => ({
      id: row.id, number: row.number, problem: row.problem,
      store: `Store ${stores.get(row.storeId)!.storeNumber}`,
      estimate: row.repairEstimate ? moneyFor(row.repairEstimate) : "Price needed",
      nextAction: row.nextAction,
      due: row.dueAt ?? "",
      href: `/app/work-orders/${row.id}?view=cost`,
    })),
  };
}

function moneyFor(amount: { currency: string; amountMinor: number }) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: amount.currency, maximumFractionDigits: 0 }).format(amount.amountMinor / 100);
}
