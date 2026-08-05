"use client";

import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileStack,
  FileWarning,
  Landmark,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PlatformBadge,
  PlatformBreadcrumbs,
  PlatformEmpty,
  PlatformPageHeader,
  PlatformProgress,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import Link from "@/components/site-link";
import { formatCurrency, formatDate, formatPercent } from "@/lib/domain/analytics";
import {
  financeData,
  reconcileInvoice,
  rollupBudgetPosition,
  rollupFinancialPosition,
  rollupFinancialPositionBy,
  type Accrual,
  type FinancialRollupFilter,
  type FinancialStage,
  type MaintenanceBudget,
  type MaintenanceInvoice,
  type MaintenanceLedgerEntry,
  type PaymentRecord,
  type ProposalQuoteView,
  type PurchaseOrder,
} from "@/lib/platform/finance";
import { platformData } from "@/lib/platform/data";

export type FinancialView =
  | "overview"
  | "budgets"
  | "approvals"
  | "purchase-orders"
  | "invoices"
  | "payments"
  | "accruals"
  | "dimensions";

type FinanceTab = FinancialView;

type BadgeTone = "neutral" | "good" | "warning" | "critical" | "info" | "purple";

type FinanceControls = {
  tab: FinanceTab;
  query: string;
  regionId: string;
  storeId: string;
  vendorId: string;
  status: string;
  recordId: string;
  page: number;
  hydrated: boolean;
};

type Scope = Pick<FinanceControls, "regionId" | "storeId" | "vendorId">;

const PAGE_SIZE = 12;
const VALID_TABS = new Set<FinanceTab>([
  "overview",
  "budgets",
  "approvals",
  "purchase-orders",
  "invoices",
  "payments",
  "accruals",
  "dimensions",
]);

const TAB_DEFINITIONS: Array<{ id: FinanceTab; label: string; advanced?: boolean }> = [
  { id: "overview", label: "Overview" },
  { id: "approvals", label: "Approvals" },
  { id: "purchase-orders", label: "Purchase orders" },
  { id: "invoices", label: "Bills to review" },
  { id: "payments", label: "Payments" },
  { id: "budgets", label: "Budgets", advanced: true },
  { id: "accruals", label: "Work done, not billed", advanced: true },
  { id: "dimensions", label: "Accounting setup", advanced: true },
];

const DEFAULT_CONTROLS: FinanceControls = {
  tab: "overview",
  query: "",
  regionId: "",
  storeId: "",
  vendorId: "",
  status: "all",
  recordId: "",
  page: 1,
  hydrated: false,
};

const storeById = new Map(platformData.stores.map((record) => [record.id, record]));
const regionById = new Map(platformData.regions.map((record) => [record.id, record]));
const vendorById = new Map(platformData.vendors.map((record) => [record.id, record]));
const workOrderById = new Map(platformData.workOrders.map((record) => [record.id, record]));
const categoryById = new Map(platformData.categories.map((record) => [record.id, record]));
const systemById = new Map(platformData.systems.map((record) => [record.id, record]));
const assetById = new Map(platformData.assets.map((record) => [record.id, record]));
const glAccountById = new Map(financeData.glAccounts.map((record) => [record.id, record]));
const costCenterById = new Map(
  financeData.accountingCostCenters.map((record) => [record.id, record]),
);

const titleCase = (value: string): string =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const sumCents = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const matchesQuery = (query: string, ...values: Array<string | number | undefined>): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
};

const toneForStatus = (status: string): BadgeTone => {
  if (
    [
      "approved",
      "paid",
      "observed_paid",
      "closed",
      "fully_invoiced",
      "posted",
      "acknowledged",
      "reversed",
    ].includes(status)
  ) {
    return "good";
  }
  if (["declined", "expired", "void", "cancelled", "overallocated"].includes(status)) {
    return "critical";
  }
  if (
    [
      "requested",
      "submitted",
      "under_review",
      "received",
      "partially_invoiced",
      "observed_partial",
      "open",
      "unallocated",
    ].includes(status)
  ) {
    return "warning";
  }
  if (["issued", "superseded", "draft"].includes(status)) return "info";
  return "neutral";
};

const recordMatchesScope = (
  workOrderId: string,
  vendorId: string | undefined,
  scope: Scope,
): boolean => {
  const workOrder = workOrderById.get(workOrderId);
  const store = workOrder ? storeById.get(workOrder.storeId) : undefined;
  if (scope.regionId && store?.regionId !== scope.regionId) return false;
  if (scope.storeId && workOrder?.storeId !== scope.storeId) return false;
  if (scope.vendorId && (vendorId ?? workOrder?.vendorId) !== scope.vendorId) return false;
  return true;
};

const ledgerEntryMatchesScope = (entry: MaintenanceLedgerEntry, scope: Scope): boolean => {
  if (scope.regionId && entry.regionId !== scope.regionId) return false;
  if (scope.storeId && entry.storeId !== scope.storeId) return false;
  if (scope.vendorId && entry.vendorId !== scope.vendorId) return false;
  return true;
};

const workContextText = (workOrderId: string, vendorId?: string): string => {
  const workOrder = workOrderById.get(workOrderId);
  const store = workOrder ? storeById.get(workOrder.storeId) : undefined;
  const vendor = vendorId ? vendorById.get(vendorId) : undefined;
  return [
    workOrder?.number,
    workOrder?.title,
    store?.code,
    store?.name,
    store?.address1,
    store?.city,
    vendor?.name,
    vendor?.shortName,
  ]
    .filter(Boolean)
    .join(" ");
};

const quoteAmount = (quote: ProposalQuoteView): number =>
  quote.quotedCents ?? quote.requestedEstimateCents;

const buildRollupFilter = (scope: Scope): FinancialRollupFilter => ({
  organizationId: financeData.organizationId,
  ...(scope.regionId ? { regionId: scope.regionId } : {}),
  ...(scope.storeId ? { storeId: scope.storeId } : {}),
  ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
});

const budgetPositionForScope = (
  budget: MaintenanceBudget,
  scope: Scope,
): ReturnType<typeof rollupBudgetPosition> => {
  if (!scope.storeId && !scope.vendorId) {
    return rollupBudgetPosition(financeData.organizationId, budget.id);
  }
  const entries = financeData.ledgerEntries.filter(
    (entry) => entry.budgetId === budget.id && ledgerEntryMatchesScope(entry, scope),
  );
  const position = rollupFinancialPosition(
    { organizationId: financeData.organizationId },
    entries,
  );
  const entriesByWork = new Map<string, MaintenanceLedgerEntry[]>();
  entries.forEach((entry) => {
    const key = entry.workOrderId ?? `${entry.sourceType}:${entry.sourceId}`;
    const records = entriesByWork.get(key) ?? [];
    records.push(entry);
    entriesByWork.set(key, records);
  });
  const lifecycleExposureCents = sumCents(
    [...entriesByWork.values()].map((records) => {
      const workPosition = rollupFinancialPosition(
        { organizationId: financeData.organizationId },
        records,
      );
      return Math.max(
        workPosition.committedCents,
        workPosition.accruedCents,
        workPosition.netInvoicedCents,
      );
    }),
  );
  const approvedBudgetCents = sumCents(
    budget.lines
      .filter((line) => !scope.storeId || line.storeId === scope.storeId)
      .map((line) => line.approvedCents),
  );
  const forecastCents = Math.max(
    position.requestedCents,
    position.quotedCents,
    position.approvedCents,
    lifecycleExposureCents,
  );
  return {
    ...position,
    budgetId: budget.id,
    approvedBudgetCents,
    lifecycleExposureCents,
    forecastCents,
    availableCents: approvedBudgetCents - lifecycleExposureCents,
  };
};

const csvCell = (value: string | number | undefined): string =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const buildLedgerExportHref = (entries: readonly MaintenanceLedgerEntry[]): string => {
  const header = [
    "entry_id",
    "effective_at",
    "stage",
    "source_type",
    "source_id",
    "amount_cents",
    "currency",
    "work_order_id",
    "store_id",
    "vendor_id",
    "cost_center_id",
    "gl_account_id",
  ];
  const lines = entries.map((entry) =>
    [
      entry.id,
      entry.effectiveAt,
      entry.stage,
      entry.sourceType,
      entry.sourceId,
      entry.amountCents,
      entry.currency,
      entry.workOrderId,
      entry.storeId,
      entry.vendorId,
      entry.costCenterId,
      entry.glAccountId,
    ]
      .map(csvCell)
      .join(","),
  );
  return `data:text/csv;charset=utf-8,${encodeURIComponent([header.join(","), ...lines].join("\n"))}`;
};

function parseControlsFromLocation(fallbackTab: FinanceTab): FinanceControls {
  if (typeof window === "undefined") return { ...DEFAULT_CONTROLS, tab: fallbackTab };
  const parameters = new URLSearchParams(window.location.search);
  const requestedTab = parameters.get("view") as FinanceTab | null;
  return {
    tab: requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : fallbackTab,
    query: parameters.get("q") ?? "",
    regionId: parameters.get("region") ?? "",
    storeId: parameters.get("store") ?? "",
    vendorId: parameters.get("provider") ?? "",
    status: parameters.get("status") ?? "all",
    recordId: parameters.get("record") ?? "",
    page: Math.max(1, Number(parameters.get("page")) || 1),
    hydrated: true,
  };
}

function WorkStoreCell({ workOrderId }: { workOrderId: string }) {
  const workOrder = workOrderById.get(workOrderId);
  const store = workOrder ? storeById.get(workOrder.storeId) : undefined;
  return (
    <div className="finance-record-cell">
      {workOrder ? (
        <Link className="finance-record-link" href={`/work-orders/${workOrder.id}`}>
          <strong>{workOrder.number}</strong>
          <small>{workOrder.title}</small>
        </Link>
      ) : (
        <strong>{workOrderId}</strong>
      )}
      {store && (
        <Link className="finance-context-link" href={`/stores/${store.id}`}>
          Store {store.code} - {store.city}
        </Link>
      )}
    </div>
  );
}

function ProviderCell({ vendorId }: { vendorId?: string }) {
  const vendor = vendorId ? vendorById.get(vendorId) : undefined;
  if (!vendorId) return <span className="finance-muted">Internal / not assigned</span>;
  return vendor ? (
    <Link className="finance-record-link" href={`/providers/${vendor.id}`}>
      <strong>{vendor.shortName}</strong>
      <small>{vendor.trade}</small>
    </Link>
  ) : (
    <strong>{vendorId}</strong>
  );
}

function FinancePagination({
  total,
  page,
  onPageChange,
}: {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  if (pageCount <= 1) return null;
  return (
    <nav className="pf-pagination finance-pagination" aria-label="Table pagination">
      <button type="button" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>
        Previous
      </button>
      <span>
        Page {safePage} of {pageCount} - {total} records
      </span>
      <button
        type="button"
        disabled={safePage === pageCount}
        onClick={() => onPageChange(safePage + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function pageRecords<T>(records: readonly T[], page: number): T[] {
  const safePage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(records.length / PAGE_SIZE)));
  return records.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
}

function FinancialStageStrip({
  position,
  onSelect,
}: {
  position: ReturnType<typeof rollupFinancialPosition>;
  onSelect: (tab: FinanceTab, status?: string) => void;
}) {
  const stages: Array<{
    stage: FinancialStage;
    label: string;
    value: number;
    note: string;
    tab: FinanceTab;
    status?: string;
  }> = [
    {
      stage: "requested",
      label: "Requested",
      value: position.requestedCents,
      note: "Estimates and quote requests",
      tab: "approvals",
      status: "requested",
    },
    {
      stage: "quoted",
      label: "Quoted",
      value: position.quotedCents,
      note: "Submitted proposal value",
      tab: "approvals",
    },
    {
      stage: "approved",
      label: "Approved",
      value: position.approvedCents,
      note: "Authorized amount",
      tab: "approvals",
      status: "approved",
    },
    {
      stage: "committed",
      label: "Committed",
      value: position.committedCents,
      note: "Issued purchase orders",
      tab: "purchase-orders",
    },
    {
      stage: "accrued",
      label: "Accrued",
      value: position.accruedCents,
      note: "Recognized, not yet invoiced",
      tab: "accruals",
      status: "open",
    },
    {
      stage: "invoiced",
      label: "Invoiced",
      value: position.invoicedCents,
      note: "Gross posted invoice value",
      tab: "invoices",
    },
    {
      stage: "credited",
      label: "Vendor credits",
      value: position.creditedCents,
      note: "Posted vendor credits",
      tab: "invoices",
    },
    {
      stage: "warranty_recovered",
      label: "Warranty recovered",
      value: position.warrantyRecoveredCents,
      note: "Posted warranty recovery",
      tab: "invoices",
    },
    {
      stage: "paid",
      label: "Paid",
      value: position.paidCents,
      note: "Observed payment records",
      tab: "payments",
      status: "observed_paid",
    },
  ];

  return (
    <section className="pf-panel finance-stage-panel">
      <PlatformSectionHeader
        title="Financial lifecycle by stage"
        description="Parallel measures of the same maintenance lifecycle. These values must not be added together."
      />
      <div className="finance-stage-grid">
        {stages.map((item) => (
          <button
            className={`finance-stage-card finance-stage-${item.stage}`}
            key={item.stage}
            type="button"
            onClick={() => onSelect(item.tab, item.status)}
          >
            <span>{item.label}</span>
            <strong>{formatCurrency(item.value, true)}</strong>
            <small>{item.note}</small>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function FinanceFilterBar({
  controls,
  statusOptions,
  onChange,
  onClear,
}: {
  controls: FinanceControls;
  statusOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<FinanceControls>) => void;
  onClear: () => void;
}) {
  const stores = platformData.stores.filter(
    (store) => !controls.regionId || store.regionId === controls.regionId,
  );
  const hasFilters = Boolean(
    controls.query ||
      controls.regionId ||
      controls.storeId ||
      controls.vendorId ||
      controls.status !== "all",
  );
  return (
    <section className="pf-panel finance-filter-panel" aria-label="Financial filters">
      <label className="finance-search-field">
        <span>Search this view</span>
        <i>
          <Search aria-hidden="true" />
          <input
            value={controls.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Store, address, WO, provider or reference"
          />
        </i>
      </label>
      <label className="finance-filter-field">
        <span>Region</span>
        <select
          value={controls.regionId}
          onChange={(event) => {
            const regionId = event.target.value;
            const selectedStore = storeById.get(controls.storeId);
            onChange({
              regionId,
              storeId:
                controls.storeId && regionId && selectedStore?.regionId !== regionId
                  ? ""
                  : controls.storeId,
            });
          }}
        >
          <option value="">All regions</option>
          {platformData.regions.map((region) => (
            <option value={region.id} key={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <label className="finance-filter-field">
        <span>Store</span>
        <select
          value={controls.storeId}
          onChange={(event) => onChange({ storeId: event.target.value })}
        >
          <option value="">All stores</option>
          {stores.map((store) => (
            <option value={store.id} key={store.id}>
              #{store.code} - {store.city}, {store.state}
            </option>
          ))}
        </select>
      </label>
      <label className="finance-filter-field">
        <span>Provider</span>
        <select
          value={controls.vendorId}
          onChange={(event) => onChange({ vendorId: event.target.value })}
        >
          <option value="">All providers</option>
          {platformData.vendors.map((vendor) => (
            <option value={vendor.id} key={vendor.id}>
              {vendor.shortName}
            </option>
          ))}
        </select>
      </label>
      {statusOptions.length > 0 && (
        <label className="finance-filter-field">
          <span>Status</span>
          <select
            value={controls.status}
            onChange={(event) => onChange({ status: event.target.value })}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasFilters && (
        <button className="finance-clear-filters" type="button" onClick={onClear}>
          <X aria-hidden="true" /> Clear filters
        </button>
      )}
    </section>
  );
}

function OverviewView({
  scope,
  query,
  position,
  onOpenTab,
}: {
  scope: Scope;
  query: string;
  position: ReturnType<typeof rollupFinancialPosition>;
  onOpenTab: (tab: FinanceTab, status?: string) => void;
}) {
  const scopedPurchaseOrders = financeData.purchaseOrders.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedInvoices = financeData.invoices.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedQuotes = financeData.proposalQuoteViews.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedAccruals = financeData.accruals.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const invoiceReconciliations = scopedInvoices.map((invoice) => ({
    invoice,
    reconciliation: reconcileInvoice(financeData.organizationId, invoice.id),
  }));
  const openCommitmentCents = sumCents(
    scopedPurchaseOrders.map((record) => record.remainingCommitmentCents),
  );
  const unallocatedCents = sumCents(
    invoiceReconciliations.map((record) => record.reconciliation.unallocatedCents),
  );
  const paymentOutstandingCents = sumCents(
    invoiceReconciliations.map((record) => record.reconciliation.paymentOutstandingCents),
  );
  const openAccrualCents = sumCents(
    scopedAccruals.filter((record) => record.status === "open").map((record) => record.amountCents),
  );
  const actionRows = [
    {
      label: "Quotes and approvals waiting",
      count: scopedQuotes.filter((record) =>
        ["requested", "submitted", "under_review"].includes(record.status),
      ).length,
      amount: sumCents(
        scopedQuotes
          .filter((record) => ["requested", "submitted", "under_review"].includes(record.status))
          .map(quoteAmount),
      ),
      note: "A manager still needs to review or approve these",
      tab: "approvals" as const,
      status: "action_required",
      icon: FileWarning,
    },
    {
      label: "Purchase orders not yet billed",
      count: scopedPurchaseOrders.filter((record) => record.remainingCommitmentCents > 0).length,
      amount: openCommitmentCents,
      note: "Approved work with no matching bill yet",
      tab: "purchase-orders" as const,
      status: "open_commitment",
      icon: FileStack,
    },
    {
      label: "Bills that need checking",
      count: invoiceReconciliations.filter(
        ({ invoice, reconciliation }) =>
          invoice.status === "received" ||
          invoice.status === "under_review" ||
          reconciliation.unallocatedCents > 0 ||
          reconciliation.overallocatedCents > 0,
      ).length,
      amount: unallocatedCents,
      note: "Some bill dollars are not tied to the right work yet",
      tab: "invoices" as const,
      status: "reconciliation_exception",
      icon: AlertCircle,
    },
    {
      label: "Work completed, bill not received",
      count: scopedAccruals.filter((record) => record.status === "open").length,
      amount: openAccrualCents,
      note: "The work is recorded while accounting waits for the bill",
      tab: "accruals" as const,
      status: "open",
      icon: CalendarClock,
    },
    {
      label: "Unpaid bills",
      count: invoiceReconciliations.filter(
        ({ reconciliation }) => reconciliation.paymentOutstandingCents > 0,
      ).length,
      amount: paymentOutstandingCents,
      note: "Bill total remaining after recorded payments",
      tab: "payments" as const,
      status: "outstanding",
      icon: Banknote,
    },
  ];

  const breakdownDimension = scope.storeId
    ? "workOrderId"
    : scope.regionId
      ? "storeId"
      : "regionId";
  const breakdownRows = rollupFinancialPositionBy(
    buildRollupFilter(scope),
    breakdownDimension,
  )
    .map((row) => {
      const workOrder = breakdownDimension === "workOrderId" ? workOrderById.get(row.dimensionId) : undefined;
      const store = breakdownDimension === "storeId" ? storeById.get(row.dimensionId) : undefined;
      const region = breakdownDimension === "regionId" ? regionById.get(row.dimensionId) : undefined;
      const label = workOrder
        ? `${workOrder.number} - ${workOrder.title}`
        : store
          ? `Store ${store.code} - ${store.city}`
          : region?.name ?? "Unassigned";
      const href = workOrder
        ? `/work-orders/${workOrder.id}`
        : store
          ? `/stores/${store.id}`
          : `/stores?region=${row.dimensionId}`;
      return { row, label, href };
    })
    .filter((item) => matchesQuery(query, item.label))
    .sort((left, right) => right.row.unpaidCents - left.row.unpaidCents);

  return (
    <div className="finance-view finance-overview-view">
      <section className="pf-stat-grid finance-reconciliation-stats">
        <PlatformStat
          label="Purchase orders not yet billed"
          value={formatCurrency(openCommitmentCents, true)}
          note="Approved work with no matching bill yet"
          icon={FileStack}
          tone={openCommitmentCents > 0 ? "info" : "positive"}
        />
        <PlatformStat
          label="Bill dollars not assigned yet"
          value={formatCurrency(unallocatedCents, true)}
          note={`${invoiceReconciliations.filter(({ reconciliation }) => reconciliation.unallocatedCents > 0).length} bills need work or store details`}
          icon={AlertCircle}
          tone={unallocatedCents > 0 ? "warning" : "positive"}
        />
        <PlatformStat
          label="Work done, bill pending"
          value={formatCurrency(openAccrualCents, true)}
          note="Completed work waiting for a vendor bill"
          icon={CalendarClock}
          tone="info"
        />
        <PlatformStat
          label="Unpaid bills"
          value={formatCurrency(paymentOutstandingCents, true)}
          note="Based on the payments recorded here"
          icon={Banknote}
          tone={paymentOutstandingCents > 0 ? "warning" : "positive"}
        />
      </section>

      <div className="pf-dashboard-grid finance-overview-grid">
        <section className="pf-panel finance-action-panel">
          <PlatformSectionHeader
            title="What needs attention"
            description="Choose a row to see the individual quotes, purchase orders, bills, or payments behind it."
          />
          <div className="finance-action-list">
            {actionRows.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => onOpenTab(item.tab, item.status)}
                >
                  <i><Icon aria-hidden="true" /></i>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </span>
                  <em>{item.count}</em>
                  <b>{formatCurrency(item.amount)}</b>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

      </div>

      <details className="pf-panel finance-advanced-detail">
        <summary>See the full cost journey and accounting details</summary>
        <div className="finance-advanced-detail-body">
          <p>Follow money from a request or quote through approval, purchase order, completed work, bill, credit, and payment.</p>
          <FinancialStageStrip position={position} onSelect={onOpenTab} />
          <dl className="finance-definition-list">
            <div><dt>As of</dt><dd>{formatDate(financeData.asOf, true)}</dd></div>
            <div><dt>Region</dt><dd>{regionById.get(scope.regionId)?.name ?? "All regions"}</dd></div>
            <div><dt>Store</dt><dd>{storeById.get(scope.storeId) ? `Store ${storeById.get(scope.storeId)?.code}` : "All stores"}</dd></div>
            <div><dt>Provider</dt><dd>{vendorById.get(scope.vendorId)?.shortName ?? "All providers"}</dd></div>
          </dl>
        </div>
      </details>

      <details className="pf-panel finance-breakdown-panel finance-advanced-detail">
        <summary>{scope.storeId ? "Compare individual work orders" : scope.regionId ? "Compare stores" : "Compare regions"}</summary>
        <PlatformSectionHeader
          title={scope.storeId ? "Costs by work order" : scope.regionId ? "Costs by store" : "Costs by region"}
          description="Open a row to continue to the work or store behind the number."
        />
        <div className="pf-table-scroll">
          <table className="pf-table finance-position-table">
            <thead>
              <tr>
                <th>Scope</th><th>Committed</th><th>Accrued</th><th>Invoiced</th><th>Vendor credits</th><th>Warranty recovery</th><th>Paid</th><th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map(({ row, label, href }) => (
                <tr key={row.dimensionId}>
                  <td><Link className="finance-record-link" href={href}><strong>{label}</strong><small>{row.entryCount} ledger entries</small></Link></td>
                  <td><strong>{formatCurrency(row.committedCents)}</strong></td>
                  <td><strong>{formatCurrency(row.accruedCents)}</strong></td>
                  <td><strong>{formatCurrency(row.invoicedCents)}</strong></td>
                  <td><strong>{formatCurrency(row.creditedCents)}</strong></td>
                  <td><strong>{formatCurrency(row.warrantyRecoveredCents)}</strong></td>
                  <td><strong>{formatCurrency(row.paidCents)}</strong></td>
                  <td><strong>{formatCurrency(row.unpaidCents)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!breakdownRows.length && (
          <PlatformEmpty icon={Search} title="No position rows match" description="Change the scope or search text to see financial records." />
        )}
      </details>
    </div>
  );
}

function BudgetsView({
  scope,
  query,
  status,
  page,
  recordId,
  onPageChange,
  onSelectRecord,
}: {
  scope: Scope;
  query: string;
  status: string;
  page: number;
  recordId: string;
  onPageChange: (page: number) => void;
  onSelectRecord: (recordId: string) => void;
}) {
  const rows = financeData.budgets
    .filter((budget) => {
      if (scope.regionId && budget.regionId !== scope.regionId) return false;
      if (scope.storeId && !budget.lines.some((line) => line.storeId === scope.storeId)) return false;
      if (
        scope.vendorId &&
        !financeData.ledgerEntries.some(
          (entry) => entry.budgetId === budget.id && entry.vendorId === scope.vendorId,
        )
      ) return false;
      if (status !== "all" && budget.status !== status) return false;
      const relatedText = budget.lines
        .slice(0, 80)
        .map((line) => {
          const store = line.storeId ? storeById.get(line.storeId) : undefined;
          const category = line.categoryId ? categoryById.get(line.categoryId) : undefined;
          return `${store?.code ?? ""} ${store?.city ?? ""} ${category?.name ?? ""}`;
        })
        .join(" ");
      return matchesQuery(query, budget.name, budget.fiscalYear, relatedText);
    })
    .map((budget) => ({ budget, position: budgetPositionForScope(budget, scope) }))
    .sort((left, right) => right.position.forecastCents - left.position.forecastCents);
  const visibleRows = pageRecords(rows, page);
  const selected = rows.find(({ budget }) => budget.id === recordId) ?? rows[0];
  const selectedLines = selected
    ? selected.budget.lines
        .filter((line) => !scope.storeId || line.storeId === scope.storeId)
        .filter((line) => {
          const store = line.storeId ? storeById.get(line.storeId) : undefined;
          const category = line.categoryId ? categoryById.get(line.categoryId) : undefined;
          return matchesQuery(query, store?.code, store?.city, store?.address1, category?.name);
        })
        .sort((left, right) => right.approvedCents - left.approvedCents)
    : [];

  return (
    <div className="finance-view finance-budget-view">
      <section className="pf-panel finance-budget-panel">
        <PlatformSectionHeader
          title="Approved maintenance budgets"
            description={scope.vendorId ? "Budget authority remains store/region based; the provider filter narrows lifecycle activity only. Forecast uses the greatest non-overlapping stage per work record." : "Forecast is the greatest non-overlapping lifecycle exposure for each work record, not a sum of stages."}
        />
        <div className="pf-table-scroll">
          <table className="pf-table finance-budget-table">
            <thead><tr><th>Budget</th><th>Approved</th><th>Lifecycle exposure</th><th>Forecast</th><th>Available</th><th>Utilization</th><th /></tr></thead>
            <tbody>
              {visibleRows.map(({ budget, position }) => {
                const utilization = position.approvedBudgetCents > 0 ? position.lifecycleExposureCents / position.approvedBudgetCents : 0;
                return (
                  <tr key={budget.id} className={selected?.budget.id === budget.id ? "finance-selected-row" : undefined}>
                    <td><strong>{budget.name}</strong><small>FY {budget.fiscalYear} - {budget.lines.length} lines</small></td>
                    <td><strong>{formatCurrency(position.approvedBudgetCents)}</strong></td>
                    <td><strong>{formatCurrency(position.lifecycleExposureCents)}</strong><small>max valid stage per work item</small></td>
                    <td><strong>{formatCurrency(position.forecastCents)}</strong></td>
                    <td><strong className={position.availableCents < 0 ? "finance-negative" : "finance-positive"}>{formatCurrency(position.availableCents)}</strong></td>
                    <td><PlatformProgress value={utilization} tone={utilization > 1 ? "red" : utilization > 0.85 ? "amber" : "teal"} label={formatPercent(utilization)} /></td>
                    <td><button className="finance-inline-button" type="button" onClick={() => onSelectRecord(budget.id)}>View lines</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FinancePagination total={rows.length} page={page} onPageChange={onPageChange} />
        {!rows.length && <PlatformEmpty icon={CircleDollarSign} title="No budgets match" description="Change the current scope, status or search." />}
      </section>

      {selected && (
        <section className="pf-panel finance-budget-lines-panel">
          <PlatformSectionHeader
            title={`${selected.budget.name} - budget lines`}
            description="Approved budget is coded by store, service category, accounting cost center and GL account."
          >
            {selected.budget.regionId && <Link href={`/stores?region=${selected.budget.regionId}`}>Open stores <ArrowRight /></Link>}
          </PlatformSectionHeader>
          <div className="pf-table-scroll">
            <table className="pf-table finance-budget-lines-table">
              <thead><tr><th>Store</th><th>Service category</th><th>Accounting cost center</th><th>GL account</th><th>Approved</th></tr></thead>
              <tbody>
                {selectedLines.slice(0, 30).map((line) => {
                  const store = line.storeId ? storeById.get(line.storeId) : undefined;
                  const category = line.categoryId ? categoryById.get(line.categoryId) : undefined;
                  const costCenter = costCenterById.get(line.costCenterId);
                  const glAccount = glAccountById.get(line.glAccountId);
                  return (
                    <tr key={line.id}>
                      <td>{store ? <Link className="finance-record-link" href={`/stores/${store.id}`}><strong>Store {store.code}</strong><small>{store.city}, {store.state}</small></Link> : "Organization"}</td>
                      <td><strong>{category?.name ?? "Unassigned"}</strong></td>
                      <td><strong>{costCenter?.code ?? line.costCenterId}</strong><small>{costCenter?.name}</small></td>
                      <td><strong>{glAccount?.code ?? line.glAccountId}</strong><small>{glAccount?.name}</small></td>
                      <td><strong>{formatCurrency(line.approvedCents)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selectedLines.length > 30 && <p className="finance-table-note">Showing the 30 highest budget lines in this selection. Narrow by store or search to inspect a specific line.</p>}
        </section>
      )}
    </div>
  );
}

function ApprovalsView({
  records,
  query,
  status,
  page,
  onPageChange,
}: {
  records: ProposalQuoteView[];
  query: string;
  status: string;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const filtered = records
    .filter((record) => {
      if (status === "action_required" && !["requested", "submitted", "under_review"].includes(record.status)) return false;
      if (status !== "all" && status !== "action_required" && record.status !== status) return false;
      return matchesQuery(query, record.number, record.kind, record.status, workContextText(record.workOrderId, record.vendorId));
    })
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  const actionRequired = records.filter((record) => ["requested", "submitted", "under_review"].includes(record.status));
  const approved = records.filter((record) => record.status === "approved");
  const visible = pageRecords(filtered, page);

  return (
    <div className="finance-view finance-approval-view">
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Action required" value={String(actionRequired.length)} note={formatCurrency(sumCents(actionRequired.map(quoteAmount)), true)} icon={FileWarning} tone={actionRequired.length ? "warning" : "positive"} />
        <PlatformStat label="Approved proposals" value={String(approved.length)} note={formatCurrency(sumCents(approved.map((record) => record.approvedCents)), true)} icon={CheckCircle2} tone="positive" />
        <PlatformStat label="Quote requests" value={String(records.filter((record) => record.status === "requested").length)} note="Not yet quoted or committed" icon={ReceiptText} tone="info" />
      </section>
      <section className="pf-panel finance-quote-panel">
        <PlatformSectionHeader title="Quotes and approval decisions" description="Requested, quoted and approved amounts remain separate; no proposal becomes a commitment until a PO is issued." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-quote-table">
            <thead><tr><th>Proposal</th><th>Work / store</th><th>Provider</th><th>Requested</th><th>Quoted</th><th>Approved</th><th>Valid through</th><th>Status</th></tr></thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id}>
                  <td><strong>{record.number}</strong><small>{titleCase(record.kind)} - revision {record.revision}</small></td>
                  <td><WorkStoreCell workOrderId={record.workOrderId} /></td>
                  <td><ProviderCell vendorId={record.vendorId} /></td>
                  <td><strong>{formatCurrency(record.requestedEstimateCents)}</strong></td>
                  <td><strong>{record.quotedCents === undefined ? "-" : formatCurrency(record.quotedCents)}</strong></td>
                  <td><strong>{record.approvedCents > 0 ? formatCurrency(record.approvedCents) : "-"}</strong></td>
                  <td><strong>{record.validThrough ? formatDate(record.validThrough) : "-"}</strong></td>
                  <td><PlatformBadge tone={toneForStatus(record.status)}>{titleCase(record.status)}</PlatformBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FinancePagination total={filtered.length} page={page} onPageChange={onPageChange} />
        {!filtered.length && <PlatformEmpty icon={ReceiptText} title="No quotes match" description="Change the filters or search to see proposal records." />}
      </section>

      <section className="pf-panel finance-policy-panel">
        <PlatformSectionHeader title="Active approval policies" description="Authorization rules are maintenance controls, not a general-ledger workflow." />
        <div className="finance-policy-grid">
          {financeData.approvalPolicies.filter((policy) => policy.active).map((policy) => (
            <article key={policy.id}>
              <header><strong>{policy.name}</strong><PlatformBadge tone="good">Active</PlatformBadge></header>
              <p>{policy.appliesTo.workTypes?.map(titleCase).join(", ")}</p>
              <ol>
                {policy.tiers.map((tier) => (
                  <li key={tier.id}>
                    <span>{formatCurrency(tier.minimumAmountCents)}{tier.maximumAmountCents === undefined ? "+" : ` - ${formatCurrency(tier.maximumAmountCents)}`}</span>
                    <strong>{tier.requiredApproverRoles.join(" + ")}</strong>
                    <small>{tier.minimumApprovals} approval{tier.minimumApprovals === 1 ? "" : "s"} required</small>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PurchaseOrdersView({
  records,
  query,
  status,
  page,
  onPageChange,
}: {
  records: PurchaseOrder[];
  query: string;
  status: string;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const filtered = records
    .filter((record) => {
      if (status === "open_commitment" && record.remainingCommitmentCents <= 0) return false;
      if (status !== "all" && status !== "open_commitment" && record.status !== status) return false;
      return matchesQuery(query, record.number, record.status, workContextText(record.workOrderId, record.vendorId));
    })
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  const visible = pageRecords(filtered, page);
  const open = records.filter((record) => record.remainingCommitmentCents > 0);
  return (
    <div className="finance-view finance-po-view">
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Committed" value={formatCurrency(sumCents(records.map((record) => record.committedCents)), true)} note="Issued PO stage" icon={FileStack} tone="info" />
        <PlatformStat label="Open commitment" value={formatCurrency(sumCents(open.map((record) => record.remainingCommitmentCents)), true)} note={`${open.length} purchase orders`} icon={CalendarClock} tone={open.length ? "warning" : "positive"} />
        <PlatformStat label="Invoiced against PO" value={formatCurrency(sumCents(records.map((record) => record.invoicedCents)), true)} note="Displayed separately from commitment" icon={ReceiptText} />
      </section>
      <section className="pf-panel finance-po-panel">
        <PlatformSectionHeader title="Purchase orders and commitments" description="A purchase order is commitment authority, not an invoice or payment." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-po-table">
            <thead><tr><th>Purchase order</th><th>Work / store</th><th>Provider</th><th>Committed</th><th>Invoiced</th><th>Remaining</th><th>Expected</th><th>Coding</th><th>Status</th></tr></thead>
            <tbody>
              {visible.map((record) => {
                const allocation = record.allocations[0];
                const glAccount = allocation?.glAccountId ? glAccountById.get(allocation.glAccountId) : undefined;
                const costCenter = allocation?.costCenterId ? costCenterById.get(allocation.costCenterId) : undefined;
                return (
                  <tr key={record.id}>
                    <td><strong>{record.number}</strong><small>Issued {formatDate(record.issuedAt)}</small></td>
                    <td><WorkStoreCell workOrderId={record.workOrderId} /></td>
                    <td><ProviderCell vendorId={record.vendorId} /></td>
                    <td><strong>{formatCurrency(record.committedCents)}</strong></td>
                    <td><strong>{formatCurrency(record.invoicedCents)}</strong></td>
                    <td><strong className={record.remainingCommitmentCents > 0 ? "finance-warning" : "finance-positive"}>{formatCurrency(record.remainingCommitmentCents)}</strong></td>
                    <td><strong>{record.expectedCompletionAt ? formatDate(record.expectedCompletionAt) : "Not set"}</strong></td>
                    <td><strong>{glAccount?.code ?? "Unmapped GL"}</strong><small>{costCenter?.code ?? "Unmapped cost center"}</small></td>
                    <td><PlatformBadge tone={toneForStatus(record.status)}>{titleCase(record.status)}</PlatformBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FinancePagination total={filtered.length} page={page} onPageChange={onPageChange} />
        {!filtered.length && <PlatformEmpty icon={FileStack} title="No purchase orders match" description="Change the current filters or search." />}
      </section>
    </div>
  );
}

function InvoiceInspector({ invoice }: { invoice: MaintenanceInvoice }) {
  const reconciliation = reconcileInvoice(financeData.organizationId, invoice.id);
  const credits = financeData.credits.filter((record) => record.invoiceId === invoice.id);
  const payments = financeData.payments.filter((record) => record.invoiceId === invoice.id);
  return (
    <section className="pf-panel finance-invoice-inspector">
      <PlatformSectionHeader
        title={`${invoice.number} bill check`}
        description="See the full bill, where its dollars were assigned, any credits, and what has been paid."
      >
        <Link href={`/work-orders/${invoice.workOrderId}`}>Open work order <ArrowRight /></Link>
      </PlatformSectionHeader>
      <div className="finance-reconciliation-grid">
        <article><span>Full bill</span><strong>{formatCurrency(reconciliation.grossAmountCents)}</strong></article>
        <article><span>Assigned</span><strong>{formatCurrency(reconciliation.allocatedCents)}</strong></article>
        <article className={reconciliation.unallocatedCents > 0 ? "finance-exception-card" : undefined}><span>Not assigned yet</span><strong>{formatCurrency(reconciliation.unallocatedCents)}</strong></article>
        <article><span>Credits</span><strong>{formatCurrency(reconciliation.postedCreditCents)}</strong></article>
        <article><span>After credits</span><strong>{formatCurrency(reconciliation.netInvoicedCents)}</strong></article>
        <article><span>Paid</span><strong>{formatCurrency(reconciliation.paidCents)}</strong></article>
        <article className={reconciliation.paymentOutstandingCents > 0 ? "finance-exception-card" : undefined}><span>Still unpaid</span><strong>{formatCurrency(reconciliation.paymentOutstandingCents)}</strong></article>
      </div>
      <PlatformProgress
        value={reconciliation.grossAmountCents > 0 ? reconciliation.allocatedCents / reconciliation.grossAmountCents : 0}
        tone={reconciliation.unallocatedCents > 0 || reconciliation.overallocatedCents > 0 ? "amber" : "teal"}
        label={`${formatPercent(reconciliation.grossAmountCents > 0 ? reconciliation.allocatedCents / reconciliation.grossAmountCents : 0)} assigned`}
      />
      <div className="pf-table-scroll">
        <table className="pf-table finance-allocation-table">
          <thead><tr><th>Bill line</th><th>Work / store</th><th>Equipment or area</th><th>Accounting code</th><th>Cost type</th><th>Amount</th></tr></thead>
          <tbody>
            {invoice.allocations.map((allocation) => {
              const category = allocation.categoryId ? categoryById.get(allocation.categoryId) : undefined;
              const system = allocation.systemId ? systemById.get(allocation.systemId) : undefined;
              const asset = allocation.assetId ? assetById.get(allocation.assetId) : undefined;
              const glAccount = allocation.glAccountId ? glAccountById.get(allocation.glAccountId) : undefined;
              const costCenter = allocation.costCenterId ? costCenterById.get(allocation.costCenterId) : undefined;
              return (
                <tr key={allocation.id}>
                  <td><strong>{allocation.id}</strong><small>{category?.name ?? "Type of work not assigned"}</small></td>
                  <td><WorkStoreCell workOrderId={allocation.workOrderId ?? invoice.workOrderId} /></td>
                  <td><strong>{asset?.name ?? system?.name ?? "Store or type of work"}</strong><small>{asset?.assetTag ?? (allocation.componentId ? `Component ${allocation.componentId}` : "No individual equipment selected")}</small></td>
                  <td><strong>{glAccount ? `${glAccount.code} - ${glAccount.name}` : "GL mapping missing"}</strong><small>{costCenter ? `${costCenter.code} - ${costCenter.name}` : "Cost center missing"}</small></td>
                  <td><strong>{titleCase(allocation.costCategory ?? "other")}</strong><small>{titleCase(allocation.workClass ?? "unclassified")}</small></td>
                  <td><strong>{formatCurrency(allocation.amountCents)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="finance-related-financials">
        <article><strong>Credits and recoveries</strong>{credits.length ? credits.map((credit) => <p key={credit.id}><span>{credit.reference} - {titleCase(credit.recoveryType)}</span><b>{formatCurrency(credit.amountCents)}</b><PlatformBadge tone={toneForStatus(credit.status)}>{titleCase(credit.status)}</PlatformBadge></p>) : <small>No linked credit records.</small>}</article>
        <article><strong>Observed payments</strong>{payments.length ? payments.map((payment) => <p key={payment.id}><span>{payment.externalReference} - {formatDate(payment.observedAt)}</span><b>{formatCurrency(payment.amountCents)}</b><PlatformBadge tone={toneForStatus(payment.status)}>{titleCase(payment.status)}</PlatformBadge></p>) : <small>No observed payment record.</small>}</article>
      </div>
    </section>
  );
}

function InvoicesView({
  records,
  query,
  status,
  page,
  recordId,
  onPageChange,
  onSelectRecord,
}: {
  records: MaintenanceInvoice[];
  query: string;
  status: string;
  page: number;
  recordId: string;
  onPageChange: (page: number) => void;
  onSelectRecord: (recordId: string) => void;
}) {
  const rows = records.map((invoice) => ({
    invoice,
    reconciliation: reconcileInvoice(financeData.organizationId, invoice.id),
  }));
  const filtered = rows
    .filter(({ invoice, reconciliation }) => {
      if (
        status === "reconciliation_exception" &&
        invoice.status !== "received" &&
        invoice.status !== "under_review" &&
        reconciliation.unallocatedCents === 0 &&
        reconciliation.overallocatedCents === 0
      ) return false;
      if (status === "unallocated" && reconciliation.unallocatedCents === 0) return false;
      if (!["all", "reconciliation_exception", "unallocated"].includes(status) && invoice.status !== status) return false;
      const purchaseOrder = invoice.purchaseOrderId
        ? financeData.purchaseOrders.find((record) => record.id === invoice.purchaseOrderId)
        : undefined;
      return matchesQuery(query, invoice.number, purchaseOrder?.number, invoice.status, workContextText(invoice.workOrderId, invoice.vendorId));
    })
    .sort((left, right) => {
      const leftException = Number(left.reconciliation.unallocatedCents > 0 || left.invoice.status === "under_review");
      const rightException = Number(right.reconciliation.unallocatedCents > 0 || right.invoice.status === "under_review");
      return rightException - leftException || right.invoice.receivedAt.localeCompare(left.invoice.receivedAt);
    });
  const visible = pageRecords(filtered, page);
  const selected = filtered.find(({ invoice }) => invoice.id === recordId)?.invoice ?? filtered[0]?.invoice;
  const totalUnallocated = sumCents(rows.map(({ reconciliation }) => reconciliation.unallocatedCents));
  const totalOutstanding = sumCents(rows.map(({ reconciliation }) => reconciliation.paymentOutstandingCents));
  const totalPostedRecoveries = sumCents(rows.map(({ reconciliation }) => reconciliation.postedCreditCents));

  return (
    <div className="finance-view finance-invoice-view">
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Total billed" value={formatCurrency(sumCents(records.map((record) => record.grossAmountCents)), true)} note="Before credits" icon={ReceiptText} />
        <PlatformStat label="Not assigned yet" value={formatCurrency(totalUnallocated, true)} note="Choose the store, work, or equipment for these dollars" icon={AlertCircle} tone={totalUnallocated ? "warning" : "positive"} />
        <PlatformStat label="Credits" value={formatCurrency(totalPostedRecoveries, true)} note="Vendor and warranty credits" icon={CheckCircle2} tone="positive" />
        <PlatformStat label="Still unpaid" value={formatCurrency(totalOutstanding, true)} note="Based on recorded payments" icon={Banknote} tone={totalOutstanding ? "warning" : "positive"} />
      </section>
      <section className="pf-panel finance-invoice-panel">
        <PlatformSectionHeader title="Bills to review" description="Open a bill to see where every dollar was assigned and what still needs attention." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-invoice-table">
            <thead><tr><th>Bill</th><th>Work / store</th><th>Vendor</th><th>Total</th><th>Assigned</th><th>Not assigned</th><th>Credits</th><th>After credits</th><th>Paid</th><th>Due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {visible.map(({ invoice, reconciliation }) => (
                <tr key={invoice.id} className={selected?.id === invoice.id ? "finance-selected-row" : undefined}>
                  <td><strong>{invoice.number}</strong><small>{invoice.purchaseOrderId ? financeData.purchaseOrders.find((record) => record.id === invoice.purchaseOrderId)?.number : "No PO linked"}</small></td>
                  <td><WorkStoreCell workOrderId={invoice.workOrderId} /></td>
                  <td><ProviderCell vendorId={invoice.vendorId} /></td>
                  <td><strong>{formatCurrency(reconciliation.grossAmountCents)}</strong></td>
                  <td><strong>{formatCurrency(reconciliation.allocatedCents)}</strong></td>
                  <td><strong className={reconciliation.unallocatedCents > 0 ? "finance-warning" : "finance-positive"}>{formatCurrency(reconciliation.unallocatedCents)}</strong></td>
                  <td><strong>{formatCurrency(reconciliation.postedCreditCents)}</strong></td>
                  <td><strong>{formatCurrency(reconciliation.netInvoicedCents)}</strong></td>
                  <td><strong>{formatCurrency(reconciliation.paidCents)}</strong></td>
                  <td><strong>{formatDate(invoice.dueAt)}</strong></td>
                  <td><PlatformBadge tone={toneForStatus(invoice.status)}>{titleCase(invoice.status)}</PlatformBadge></td>
                  <td><button className="finance-inline-button" type="button" onClick={() => onSelectRecord(invoice.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FinancePagination total={filtered.length} page={page} onPageChange={onPageChange} />
        {!filtered.length && <PlatformEmpty icon={ReceiptText} title="No bills match" description="Change the filters or search to see more bills." />}
      </section>
      {selected && <InvoiceInspector invoice={selected} />}
    </div>
  );
}

function PaymentsView({
  payments,
  invoices,
  query,
  status,
  page,
  onPageChange,
  onInspectInvoice,
}: {
  payments: PaymentRecord[];
  invoices: MaintenanceInvoice[];
  query: string;
  status: string;
  page: number;
  onPageChange: (page: number) => void;
  onInspectInvoice: (invoiceId: string) => void;
}) {
  const paymentRows = payments.filter((payment) => {
    if (status === "outstanding") return false;
    if (status !== "all" && payment.status !== status) return false;
    const invoice = financeData.invoices.find((record) => record.id === payment.invoiceId);
    return matchesQuery(query, payment.externalReference, payment.status, invoice?.number, invoice ? workContextText(invoice.workOrderId, payment.vendorId) : "");
  });
  const outstandingRows = invoices
    .map((invoice) => ({ invoice, reconciliation: reconcileInvoice(financeData.organizationId, invoice.id) }))
    .filter(({ invoice, reconciliation }) => {
      if (reconciliation.paymentOutstandingCents <= 0) return false;
      if (!["all", "outstanding"].includes(status)) return false;
      return matchesQuery(query, invoice.number, workContextText(invoice.workOrderId, invoice.vendorId));
    })
    .sort((left, right) => left.invoice.dueAt.localeCompare(right.invoice.dueAt));
  const combinedTotal = paymentRows.length + outstandingRows.length;
  const combined = [
    ...paymentRows.map((payment) => ({ kind: "payment" as const, payment })),
    ...outstandingRows.map((record) => ({ kind: "outstanding" as const, ...record })),
  ];
  const visible = pageRecords(combined, page);
  const observedPaid = sumCents(payments.filter((record) => record.status !== "void").map((record) => record.amountCents));
  const outstanding = sumCents(outstandingRows.map(({ reconciliation }) => reconciliation.paymentOutstandingCents));

  return (
    <div className="finance-view finance-payment-view">
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Observed paid" value={formatCurrency(observedPaid, true)} note={`${payments.length} external AP observations`} icon={Banknote} tone="positive" />
        <PlatformStat label="Outstanding" value={formatCurrency(outstanding, true)} note={`${outstandingRows.length} net invoices`} icon={CalendarClock} tone={outstanding ? "warning" : "positive"} />
        <PlatformStat label="Unallocated payments" value={formatCurrency(sumCents(payments.map((record) => record.unallocatedCents)), true)} note="Payment-to-invoice allocation" icon={AlertCircle} tone={payments.some((record) => record.unallocatedCents > 0) ? "warning" : "positive"} />
      </section>
      <section className="pf-panel finance-payment-boundary">
        <p><Landmark aria-hidden="true" /><span><strong>Payment tracking, not payment execution</strong><small>These records observe AP status and external references. Maintenance Intelligence does not move money, connect bank accounts or replace accounts payable.</small></span></p>
      </section>
      <section className="pf-panel finance-payment-panel">
        <PlatformSectionHeader title="Payments and outstanding invoices" description="Observed payments and invoice balances remain linked to their work, store, provider and allocation trail." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-payment-table">
            <thead><tr><th>Reference</th><th>Invoice / work</th><th>Provider</th><th>Observed paid</th><th>Allocated</th><th>Outstanding</th><th>Date / due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {visible.map((row) => {
                if (row.kind === "payment") {
                  const invoice = financeData.invoices.find((record) => record.id === row.payment.invoiceId);
                  return (
                    <tr key={`payment-${row.payment.id}`}>
                      <td><strong>{row.payment.externalReference}</strong><small>{row.payment.sourceSystem.replaceAll("_", " ")}</small></td>
                      <td>{invoice ? <WorkStoreCell workOrderId={invoice.workOrderId} /> : <strong>{row.payment.invoiceId}</strong>}</td>
                      <td><ProviderCell vendorId={row.payment.vendorId} /></td>
                      <td><strong>{formatCurrency(row.payment.amountCents)}</strong></td>
                      <td><strong>{formatCurrency(row.payment.allocatedCents)}</strong></td>
                      <td><strong>-</strong></td>
                      <td><strong>{formatDate(row.payment.observedAt)}</strong></td>
                      <td><PlatformBadge tone={toneForStatus(row.payment.status)}>{titleCase(row.payment.status)}</PlatformBadge></td>
                      <td>{invoice && <button className="finance-inline-button" type="button" onClick={() => onInspectInvoice(invoice.id)}>Invoice</button>}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={`outstanding-${row.invoice.id}`}>
                    <td><strong>{row.invoice.number}</strong><small>No complete payment observation</small></td>
                    <td><WorkStoreCell workOrderId={row.invoice.workOrderId} /></td>
                    <td><ProviderCell vendorId={row.invoice.vendorId} /></td>
                    <td><strong>{formatCurrency(row.reconciliation.paidCents)}</strong></td>
                    <td><strong>{formatCurrency(row.reconciliation.allocatedCents)}</strong></td>
                    <td><strong className="finance-warning">{formatCurrency(row.reconciliation.paymentOutstandingCents)}</strong></td>
                    <td><strong>{formatDate(row.invoice.dueAt)}</strong></td>
                    <td><PlatformBadge tone="warning">Outstanding</PlatformBadge></td>
                    <td><button className="finance-inline-button" type="button" onClick={() => onInspectInvoice(row.invoice.id)}>Inspect</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FinancePagination total={combinedTotal} page={page} onPageChange={onPageChange} />
        {!combinedTotal && <PlatformEmpty icon={Banknote} title="No payment records match" description="Change the filters or search to see payment observations and outstanding invoices." />}
      </section>
    </div>
  );
}

function AccrualsView({
  records,
  query,
  status,
  page,
  onPageChange,
  onInspectInvoice,
}: {
  records: Accrual[];
  query: string;
  status: string;
  page: number;
  onPageChange: (page: number) => void;
  onInspectInvoice: (invoiceId: string) => void;
}) {
  const filtered = records
    .filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      return matchesQuery(query, record.id, record.accountingPeriod, record.basis, workContextText(record.workOrderId, record.vendorId));
    })
    .sort((left, right) => right.accruedAt.localeCompare(left.accruedAt));
  const visible = pageRecords(filtered, page);
  const open = records.filter((record) => record.status === "open");
  const reversed = records.filter((record) => record.status === "reversed");
  return (
    <div className="finance-view finance-accrual-view">
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Open accruals" value={formatCurrency(sumCents(open.map((record) => record.amountCents)), true)} note={`${open.length} recognized service records`} icon={CalendarClock} tone={open.length ? "info" : "positive"} />
        <PlatformStat label="Reversed accruals" value={formatCurrency(sumCents(reversed.map((record) => record.amountCents)), true)} note="Shown separately from open" icon={CheckCircle2} tone="positive" />
        <PlatformStat label="Accounting periods" value={String(new Set(records.map((record) => record.accountingPeriod)).size)} note="Period-specific recognition" icon={Landmark} />
      </section>
      <section className="pf-panel finance-accrual-panel">
        <PlatformSectionHeader title="Accruals and reversals" description="Accruals recognize received service before invoice; matching creates an explicit reversal rather than rewriting history." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-accrual-table">
            <thead><tr><th>Accrual</th><th>Period</th><th>Work / store</th><th>Provider</th><th>Basis</th><th>Service through</th><th>Amount</th><th>Coding</th><th>Status</th><th>Reversal</th></tr></thead>
            <tbody>
              {visible.map((record) => {
                const allocation = record.allocations[0];
                const glAccount = allocation?.glAccountId ? glAccountById.get(allocation.glAccountId) : undefined;
                const costCenter = allocation?.costCenterId ? costCenterById.get(allocation.costCenterId) : undefined;
                return (
                  <tr key={record.id}>
                    <td><strong>{record.id}</strong><small>Posted {formatDate(record.accruedAt)}</small></td>
                    <td><strong>{record.accountingPeriod}</strong></td>
                    <td><WorkStoreCell workOrderId={record.workOrderId} /></td>
                    <td><ProviderCell vendorId={record.vendorId} /></td>
                    <td><strong>{titleCase(record.basis)}</strong></td>
                    <td><strong>{formatDate(record.serviceThroughAt)}</strong></td>
                    <td><strong>{formatCurrency(record.amountCents)}</strong></td>
                    <td><strong>{glAccount?.code ?? "GL missing"}</strong><small>{costCenter?.code ?? "Cost center missing"}</small></td>
                    <td><PlatformBadge tone={toneForStatus(record.status)}>{titleCase(record.status)}</PlatformBadge></td>
                    <td>{record.reversalInvoiceId ? <button className="finance-inline-button" type="button" onClick={() => onInspectInvoice(record.reversalInvoiceId ?? "")}>Invoice</button> : <span className="finance-muted">Awaiting match</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FinancePagination total={filtered.length} page={page} onPageChange={onPageChange} />
        {!filtered.length && <PlatformEmpty icon={CalendarClock} title="No accruals match" description="Change the period, status, scope or search." />}
      </section>
    </div>
  );
}

function DimensionLedger({
  dimensionId,
  entries,
}: {
  dimensionId: string;
  entries: MaintenanceLedgerEntry[];
}) {
  const glAccount = glAccountById.get(dimensionId);
  const costCenter = costCenterById.get(dimensionId);
  const matching = entries
    .filter((entry) => entry.glAccountId === dimensionId || entry.costCenterId === dimensionId)
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt))
    .slice(0, 25);
  if (!glAccount && !costCenter) return null;
  return (
    <section className="pf-panel finance-dimension-ledger">
      <PlatformSectionHeader
        title={`${glAccount?.code ?? costCenter?.code} - ${glAccount?.name ?? costCenter?.name}`}
        description="Source-linked maintenance subledger entries for this accounting dimension."
      />
      <div className="pf-table-scroll">
        <table className="pf-table finance-ledger-table">
          <thead><tr><th>Effective</th><th>Stage</th><th>Source</th><th>Work / store</th><th>Provider</th><th>Amount</th></tr></thead>
          <tbody>
            {matching.map((entry) => (
              <tr key={entry.id}>
                <td><strong>{formatDate(entry.effectiveAt)}</strong></td>
                <td><PlatformBadge tone={entry.stage === "paid" ? "good" : entry.stage === "accrued" ? "purple" : "info"}>{titleCase(entry.stage)}</PlatformBadge></td>
                <td><strong>{titleCase(entry.sourceType)}</strong><small>{entry.sourceId}</small></td>
                <td>{entry.workOrderId ? <WorkStoreCell workOrderId={entry.workOrderId} /> : <span className="finance-muted">No work link</span>}</td>
                <td><ProviderCell vendorId={entry.vendorId} /></td>
                <td><strong>{formatCurrency(entry.amountCents)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!matching.length && <PlatformEmpty icon={Landmark} title="No ledger entries in scope" description="This dimension exists but has no entries under the current portfolio filters." />}
      {matching.length === 25 && <p className="finance-table-note">Showing the 25 most recent matching entries. Use the filtered export for the complete source-linked set.</p>}
    </section>
  );
}

function DimensionsView({
  entries,
  scope,
  query,
  status,
  page,
  recordId,
  onPageChange,
  onSelectRecord,
  exportHref,
}: {
  entries: MaintenanceLedgerEntry[];
  scope: Scope;
  query: string;
  status: string;
  page: number;
  recordId: string;
  onPageChange: (page: number) => void;
  onSelectRecord: (recordId: string) => void;
  exportHref: string;
}) {
  const accounts = financeData.glAccounts
    .filter((account) => status === "all" || account.accountType === status)
    .filter((account) => matchesQuery(query, account.code, account.name, account.accountType))
    .map((account) => ({
      account,
      position: rollupFinancialPosition({ ...buildRollupFilter(scope), glAccountId: account.id }),
    }));
  const selectedStoreRegionId = storeById.get(scope.storeId)?.regionId;
  const costCenters = financeData.accountingCostCenters
    .filter((costCenter) => !scope.regionId || costCenter.scope === "organization" || costCenter.regionId === scope.regionId)
    .filter((costCenter) => !scope.storeId || costCenter.scope === "organization" || costCenter.storeId === scope.storeId || (costCenter.scope === "region" && costCenter.regionId === selectedStoreRegionId))
    .filter((costCenter) => matchesQuery(query, costCenter.code, costCenter.name, costCenter.scope, storeById.get(costCenter.storeId ?? "")?.code))
    .map((costCenter) => ({
      costCenter,
      position: rollupFinancialPosition({ ...buildRollupFilter(scope), costCenterId: costCenter.id }),
    }))
    .sort((left, right) => left.costCenter.code.localeCompare(right.costCenter.code));
  const visibleCostCenters = pageRecords(costCenters, page);
  const missingGl = entries.filter((entry) => !entry.glAccountId).length;
  const missingCostCenter = entries.filter((entry) => !entry.costCenterId).length;

  return (
    <div className="finance-view finance-dimensions-view">
      <section className="pf-panel finance-accounting-boundary">
        <div><Landmark aria-hidden="true" /><span><strong>Accounting dimensions are not physical equipment groups</strong><small>A store may call ovens a “cost center” in maintenance language. GL and accounting cost centers remain separate IDs so allocations and exports stay correct.</small></span></div>
        <a className="pf-secondary-button finance-export-button" download="maintenance-ledger-review.csv" href={exportHref}><Download aria-hidden="true" />Download filtered ledger CSV</a>
      </section>
      <section className="pf-stat-grid finance-tab-stats">
        <PlatformStat label="Ledger entries" value={String(entries.length)} note="Filtered source-linked records" icon={FileStack} />
        <PlatformStat label="Missing GL mapping" value={String(missingGl)} note="Must be zero for clean export" icon={AlertCircle} tone={missingGl ? "warning" : "positive"} />
        <PlatformStat label="Missing cost center" value={String(missingCostCenter)} note="Unmapped accounting dimension" icon={Building2} tone={missingCostCenter ? "warning" : "positive"} />
      </section>
      <section className="pf-panel finance-gl-panel">
        <PlatformSectionHeader title="GL account mapping" description="Stages remain separate columns; this view prepares source-linked maintenance data for export." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-gl-table">
            <thead><tr><th>Account</th><th>Type</th><th>Committed</th><th>Accrued</th><th>Invoiced</th><th>Vendor credits</th><th>Warranty recovery</th><th>Paid</th><th>Entries</th><th /></tr></thead>
            <tbody>
              {accounts.map(({ account, position }) => (
                <tr key={account.id} className={recordId === account.id ? "finance-selected-row" : undefined}>
                  <td><strong>{account.code} - {account.name}</strong><small>{account.categoryId ? categoryById.get(account.categoryId)?.name : "Organization-wide"}</small></td>
                  <td><PlatformBadge tone="neutral">{titleCase(account.accountType)}</PlatformBadge></td>
                  <td><strong>{formatCurrency(position.committedCents)}</strong></td>
                  <td><strong>{formatCurrency(position.accruedCents)}</strong></td>
                  <td><strong>{formatCurrency(position.invoicedCents)}</strong></td>
                  <td><strong>{formatCurrency(position.creditedCents)}</strong></td>
                  <td><strong>{formatCurrency(position.warrantyRecoveredCents)}</strong></td>
                  <td><strong>{formatCurrency(position.paidCents)}</strong></td>
                  <td><strong>{position.entryCount}</strong></td>
                  <td><button className="finance-inline-button" type="button" onClick={() => onSelectRecord(account.id)}>Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="pf-panel finance-cost-center-panel">
        <PlatformSectionHeader title="Accounting cost centers" description="Organization, region and store dimensions are effective-dated and remain independent from the equipment hierarchy." />
        <div className="pf-table-scroll">
          <table className="pf-table finance-cost-center-table">
            <thead><tr><th>Cost center</th><th>Scope</th><th>Store / region</th><th>Committed</th><th>Accrued</th><th>Invoiced</th><th>Paid</th><th>Entries</th><th /></tr></thead>
            <tbody>
              {visibleCostCenters.map(({ costCenter, position }) => {
                const store = costCenter.storeId ? storeById.get(costCenter.storeId) : undefined;
                const region = costCenter.regionId ? regionById.get(costCenter.regionId) : undefined;
                return (
                  <tr key={costCenter.id} className={recordId === costCenter.id ? "finance-selected-row" : undefined}>
                    <td><strong>{costCenter.code} - {costCenter.name}</strong><small>{costCenter.active ? "Active" : "Inactive"}</small></td>
                    <td><PlatformBadge tone={costCenter.scope === "store" ? "info" : "neutral"}>{titleCase(costCenter.scope)}</PlatformBadge></td>
                    <td>{store ? <Link className="finance-record-link" href={`/stores/${store.id}`}><strong>Store {store.code}</strong><small>{store.city}, {store.state}</small></Link> : <strong>{region?.name ?? "Organization"}</strong>}</td>
                    <td><strong>{formatCurrency(position.committedCents)}</strong></td>
                    <td><strong>{formatCurrency(position.accruedCents)}</strong></td>
                    <td><strong>{formatCurrency(position.invoicedCents)}</strong></td>
                    <td><strong>{formatCurrency(position.paidCents)}</strong></td>
                    <td><strong>{position.entryCount}</strong></td>
                    <td><button className="finance-inline-button" type="button" onClick={() => onSelectRecord(costCenter.id)}>Inspect</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FinancePagination total={costCenters.length} page={page} onPageChange={onPageChange} />
        {!costCenters.length && <PlatformEmpty icon={Building2} title="No cost centers match" description="Change the scope or search to see accounting dimensions." />}
      </section>
      {recordId && <DimensionLedger dimensionId={recordId} entries={entries} />}
    </div>
  );
}

function statusOptionsFor(tab: FinanceTab): Array<{ value: string; label: string }> {
  switch (tab) {
    case "budgets":
      return ["draft", "approved", "closed"].map((value) => ({ value, label: titleCase(value) }));
    case "approvals":
      return ["action_required", "requested", "submitted", "under_review", "approved", "declined", "expired", "superseded"].map((value) => ({ value, label: titleCase(value) }));
    case "purchase-orders":
      return ["open_commitment", "draft", "issued", "acknowledged", "partially_invoiced", "fully_invoiced", "closed", "cancelled"].map((value) => ({ value, label: titleCase(value) }));
    case "invoices":
      return ["reconciliation_exception", "unallocated", "received", "under_review", "approved", "paid", "void"].map((value) => ({ value, label: titleCase(value) }));
    case "payments":
      return ["outstanding", "observed_partial", "observed_paid", "void"].map((value) => ({ value, label: titleCase(value) }));
    case "accruals":
      return ["open", "reversed"].map((value) => ({ value, label: titleCase(value) }));
    case "dimensions":
      return ["expense", "asset", "liability", "contra_expense"].map((value) => ({ value, label: titleCase(value) }));
    default:
      return [];
  }
}

export function FinancialSuite({ initialView = "overview" }: { initialView?: FinancialView }) {
  const [controls, setControls] = useState<FinanceControls>({
    ...DEFAULT_CONTROLS,
    tab: initialView,
  });

  useEffect(() => {
    const syncFromLocation = () => {
      // This synchronizes user-owned URL state after hydration and on browser navigation.
      setControls(parseControlsFromLocation(initialView));
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [initialView]);

  useEffect(() => {
    if (!controls.hydrated) return;
    const url = new URL(window.location.href);
    const values: Array<[string, string]> = [
      ["view", controls.tab],
      ["q", controls.query],
      ["region", controls.regionId],
      ["store", controls.storeId],
      ["provider", controls.vendorId],
      ["status", controls.status === "all" ? "" : controls.status],
      ["record", controls.recordId],
      ["page", controls.page === 1 ? "" : String(controls.page)],
    ];
    values.forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [controls]);

  const scope: Scope = {
    regionId: controls.regionId,
    storeId: controls.storeId,
    vendorId: controls.vendorId,
  };
  const position = rollupFinancialPosition(buildRollupFilter(scope));
  const scopedEntries = financeData.ledgerEntries.filter((entry) => ledgerEntryMatchesScope(entry, scope));
  const scopedQuotes = financeData.proposalQuoteViews.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedPurchaseOrders = financeData.purchaseOrders.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedInvoices = financeData.invoices.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );
  const scopedPayments = financeData.payments.filter((record) => {
    const invoice = financeData.invoices.find((candidate) => candidate.id === record.invoiceId);
    return invoice ? recordMatchesScope(invoice.workOrderId, record.vendorId, scope) : false;
  });
  const scopedAccruals = financeData.accruals.filter((record) =>
    recordMatchesScope(record.workOrderId, record.vendorId, scope),
  );

  const exportHref = buildLedgerExportHref(scopedEntries);

  const updateControls = (patch: Partial<FinanceControls>, preserveRecord = false) => {
    setControls((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 1,
      recordId: preserveRecord ? (patch.recordId ?? current.recordId) : (patch.recordId ?? ""),
    }));
  };

  const openTab = (tab: FinanceTab, status = "all", recordId = "") => {
    setControls((current) => ({
      ...current,
      tab,
      status,
      recordId,
      page: 1,
    }));
  };

  const clearFilters = () => {
    setControls((current) => ({
      ...current,
      query: "",
      regionId: "",
      storeId: "",
      vendorId: "",
      status: "all",
      recordId: "",
      page: 1,
    }));
  };

  const tabCounts: Partial<Record<FinanceTab, number>> = {
    budgets: financeData.budgets.length,
    approvals: scopedQuotes.filter((record) => ["requested", "submitted", "under_review"].includes(record.status)).length,
    "purchase-orders": scopedPurchaseOrders.filter((record) => record.remainingCommitmentCents > 0).length,
    invoices: scopedInvoices.filter((record) => {
      const reconciliation = reconcileInvoice(financeData.organizationId, record.id);
      return record.status === "received" || record.status === "under_review" || reconciliation.unallocatedCents > 0;
    }).length,
    payments: scopedInvoices.filter((record) => reconcileInvoice(financeData.organizationId, record.id).paymentOutstandingCents > 0).length,
    accruals: scopedAccruals.filter((record) => record.status === "open").length,
    dimensions: financeData.glAccounts.length + financeData.accountingCostCenters.length,
  };

  const renderTabLink = (tab: (typeof TAB_DEFINITIONS)[number]) => {
    const parameters = new URLSearchParams();
    parameters.set("view", tab.id);
    if (controls.regionId) parameters.set("region", controls.regionId);
    if (controls.storeId) parameters.set("store", controls.storeId);
    if (controls.vendorId) parameters.set("provider", controls.vendorId);
    const count = tabCounts[tab.id];
    return (
      <Link
        href={`/financials?${parameters.toString()}`}
        className={controls.tab === tab.id ? "active" : undefined}
        aria-current={controls.tab === tab.id ? "page" : undefined}
        key={tab.id}
        onClick={(event) => {
          event.preventDefault();
          openTab(tab.id);
        }}
      >
        <span>{tab.label}</span>
        {count !== undefined && <em>{count}</em>}
      </Link>
    );
  };

  const filtersOpen = Boolean(controls.query || controls.regionId || controls.storeId || controls.vendorId || controls.status !== "all");

  return (
    <AppShell>
      <div className="pf-page finance-suite">
        <PlatformBreadcrumbs items={[{ label: "Overview", href: "/" }, { label: "Spending & bills" }]} />
        <PlatformPageHeader
          eyebrow="Spending & bills"
          title="Understand maintenance costs"
          description="Start with what needs attention. Then open an approval, purchase order, bill, payment, store, or work order for the full detail."
        >
          <Link className="pf-secondary-button" href="/reports">View reports</Link>
          <a className="pf-primary-button finance-header-export" download="maintenance-costs.csv" href={exportHref}><Download aria-hidden="true" />Download costs</a>
        </PlatformPageHeader>

        <nav className="pf-tabs finance-tabs" aria-label="Maintenance accounting sections">
          {TAB_DEFINITIONS.filter((tab) => !tab.advanced).map(renderTabLink)}
        </nav>

        <details className="finance-more-tabs" open={TAB_DEFINITIONS.some((tab) => tab.id === controls.tab && tab.advanced) || undefined}>
          <summary>More accounting tools</summary>
          <nav className="pf-tabs" aria-label="More accounting sections">{TAB_DEFINITIONS.filter((tab) => tab.advanced).map(renderTabLink)}</nav>
        </details>

        <details className="finance-filter-disclosure" open={filtersOpen || undefined}>
          <summary>Filter this view</summary>
          <FinanceFilterBar
            controls={controls}
            statusOptions={statusOptionsFor(controls.tab)}
            onChange={(patch) => updateControls(patch)}
            onClear={clearFilters}
          />
        </details>

        {controls.tab === "overview" && (
          <OverviewView
            scope={scope}
            query={controls.query}
            position={position}
            onOpenTab={openTab}
          />
        )}
        {controls.tab === "budgets" && (
          <BudgetsView
            scope={scope}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            recordId={controls.recordId}
            onPageChange={(page) => updateControls({ page }, true)}
            onSelectRecord={(recordId) => updateControls({ recordId }, true)}
          />
        )}
        {controls.tab === "approvals" && (
          <ApprovalsView
            records={scopedQuotes}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            onPageChange={(page) => updateControls({ page }, true)}
          />
        )}
        {controls.tab === "purchase-orders" && (
          <PurchaseOrdersView
            records={scopedPurchaseOrders}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            onPageChange={(page) => updateControls({ page }, true)}
          />
        )}
        {controls.tab === "invoices" && (
          <InvoicesView
            records={scopedInvoices}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            recordId={controls.recordId}
            onPageChange={(page) => updateControls({ page }, true)}
            onSelectRecord={(recordId) => updateControls({ recordId }, true)}
          />
        )}
        {controls.tab === "payments" && (
          <PaymentsView
            payments={scopedPayments}
            invoices={scopedInvoices}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            onPageChange={(page) => updateControls({ page }, true)}
            onInspectInvoice={(invoiceId) => openTab("invoices", "all", invoiceId)}
          />
        )}
        {controls.tab === "accruals" && (
          <AccrualsView
            records={scopedAccruals}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            onPageChange={(page) => updateControls({ page }, true)}
            onInspectInvoice={(invoiceId) => openTab("invoices", "all", invoiceId)}
          />
        )}
        {controls.tab === "dimensions" && (
          <DimensionsView
            entries={scopedEntries}
            scope={scope}
            query={controls.query}
            status={controls.status}
            page={controls.page}
            recordId={controls.recordId}
            onPageChange={(page) => updateControls({ page }, true)}
            onSelectRecord={(recordId) => updateControls({ recordId }, true)}
            exportHref={exportHref}
          />
        )}
      </div>
    </AppShell>
  );
}
