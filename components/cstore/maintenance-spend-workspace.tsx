"use client";

import { type CSSProperties, useId, useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  FileText,
  Gauge,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
  Wrench,
  X,
} from "lucide-react";

import type {
  DemoDataset,
  InvoiceWorkLink,
  Store,
  Vendor,
  WorkOrder,
} from "../../lib/cstore/types";
import styles from "./maintenance-spend-workspace.module.css";

export type MaintenanceSpendBasis = "recorded" | "authorized" | "linked_invoice";
export type MaintenanceSpendPeriod = "trailing_12" | "ytd" | "month";

export interface MaintenanceSpendState {
  basis: MaintenanceSpendBasis;
  period: MaintenanceSpendPeriod;
  regionId: string;
  storeId: string;
  categoryId: string;
  vendorId: string;
  sourcePage: number;
}

export const defaultMaintenanceSpendState: MaintenanceSpendState = {
  basis: "recorded",
  period: "trailing_12",
  regionId: "all",
  storeId: "all",
  categoryId: "all",
  vendorId: "all",
  sourcePage: 1,
};

export interface MaintenanceSpendWorkspaceProps {
  dataset: DemoDataset;
  scopeLabel: string;
  value: MaintenanceSpendState;
  onChange: (value: MaintenanceSpendState) => void;
  onOpenWork: (workOrderId: string) => void;
  onOpenStore: (storeId: string) => void;
  onOpenAsset: (assetId: string) => void;
  onOpenVendor: (vendorId: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onGenerateReport: (state: MaintenanceSpendState) => void;
  canGenerate: boolean;
  invoiceEvidenceEnabled?: boolean;
  className?: string;
}

interface SpendRecord {
  id: string;
  work: WorkOrder;
  store: Store;
  amountMinor: number;
  effectiveAt: string;
  sourceLabel: string;
  sourceDetail: string;
  categoryId?: string;
  assetId?: string;
  vendorId?: string;
  invoiceIds: string[];
  invoiceLinks: InvoiceWorkLink[];
  usedInvoiceFallback: boolean;
}

interface BreakdownRow<T> {
  id: string;
  item?: T;
  label: string;
  meta: string;
  amountMinor: number;
  recordCount: number;
  color?: string;
}

const sourcePageSize = 10;
const fallbackColors = ["#0b7568", "#df6d50", "#376f9e", "#d49a48", "#836da5", "#5a8c66", "#9b6e52"];

const basisOptions: Array<{ value: MaintenanceSpendBasis; label: string; description: string }> = [
  {
    value: "recorded",
    label: "Recorded maintenance cost",
    description: "Work costs entered on the service record; linked invoice amount fills the gap only when no recorded cost exists.",
  },
  {
    value: "authorized",
    label: "Authorized / NTE",
    description: "The latest approved amount or service-authorization limit for each work order.",
  },
  {
    value: "linked_invoice",
    label: "Linked invoice amount",
    description: "Optional invoice evidence linked to customer work orders. This is not a payment or accounting ledger.",
  },
];

const periodOptions: Array<{ value: MaintenanceSpendPeriod; label: string }> = [
  { value: "trailing_12", label: "Trailing 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "month", label: "This month" },
];

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function money(minorUnits: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(minorUnits / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function latestTimestamp(values: Array<string | undefined>, fallback: string) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? fallback;
}

function periodRange(period: MaintenanceSpendPeriod, asOf: string) {
  const datasetAsOf = Date.parse(asOf);
  const endTimestamp = Math.max(Number.isNaN(datasetAsOf) ? 0 : datasetAsOf, Date.now());
  const end = new Date(endTimestamp);
  const start = new Date(endTimestamp);
  if (period === "trailing_12") start.setUTCFullYear(start.getUTCFullYear() - 1);
  if (period === "ytd") start.setUTCMonth(0, 1);
  if (period === "ytd") start.setUTCHours(0, 0, 0, 0);
  if (period === "month") start.setUTCDate(1);
  if (period === "month") start.setUTCHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function invoiceTotal(dataset: DemoDataset, invoiceId: string) {
  return dataset.invoices
    .find((invoice) => invoice.id === invoiceId)
    ?.lineItems.reduce((sum, line) => sum + line.amountMinor, 0) ?? 0;
}

function vendorForWork(dataset: DemoDataset, workOrderId: string) {
  const assignment = dataset.assignments
    .filter((record) => record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined")
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0];
  return assignment?.partyId;
}

function createSpendRecord(dataset: DemoDataset, work: WorkOrder, basis: MaintenanceSpendBasis): SpendRecord | null {
  const store = dataset.stores.find((record) => record.id === work.storeId);
  if (!store) return null;

  const links = dataset.invoiceWorkLinks.filter((record) => record.workOrderId === work.id);
  const invoiceIds = [...new Set(links.map((record) => record.invoiceId))];
  const linkedAmount = links.reduce((sum, record) => sum + record.attributedAmountMinor, 0);
  const linkedDate = latestTimestamp(
    invoiceIds.map((invoiceId) => dataset.invoices.find((invoice) => invoice.id === invoiceId)?.receivedAt),
    work.createdAt,
  );
  const linkedVendorId = invoiceIds
    .map((invoiceId) => dataset.invoices.find((invoice) => invoice.id === invoiceId)?.vendorId)
    .find(Boolean);

  if (basis === "linked_invoice") {
    if (!links.length) return null;
    return {
      id: work.id,
      work,
      store,
      amountMinor: linkedAmount,
      effectiveAt: linkedDate,
      sourceLabel: "Linked invoice amount",
      sourceDetail: `${invoiceIds.length} linked ${invoiceIds.length === 1 ? "invoice" : "invoices"}`,
      categoryId: links.find((record) => record.categoryId)?.categoryId ?? work.categoryId,
      assetId: links.find((record) => record.assetId)?.assetId ?? work.assetId,
      vendorId: linkedVendorId ?? vendorForWork(dataset, work.id),
      invoiceIds,
      invoiceLinks: links,
      usedInvoiceFallback: false,
    };
  }

  if (basis === "authorized") {
    const approvedLine = dataset.costLines
      .filter((record) => record.workOrderId === work.id && record.basis === "approved")
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
    const latestIssuance = dataset.vendorIssuances
      .filter((record) => record.workOrderId === work.id && record.notToExceedMinor != null)
      .sort((left, right) => right.version - left.version)[0];
    const amountMinor = approvedLine?.amountMinor ?? latestIssuance?.notToExceedMinor ?? work.notToExceedMinor;
    if (amountMinor == null) return null;
    return {
      id: work.id,
      work,
      store,
      amountMinor,
      effectiveAt: approvedLine?.recordedAt ?? latestIssuance?.issuedAt ?? work.createdAt,
      sourceLabel: approvedLine ? "Approved work amount" : "Not-to-exceed limit",
      sourceDetail: latestIssuance ? `Service authorization v${latestIssuance.version}` : "Current customer work-order limit",
      categoryId: approvedLine?.categoryId ?? work.categoryId,
      assetId: approvedLine?.assetId ?? work.assetId,
      vendorId: approvedLine?.vendorId ?? latestIssuance?.vendorId ?? vendorForWork(dataset, work.id),
      invoiceIds,
      invoiceLinks: links,
      usedInvoiceFallback: false,
    };
  }

  const recordedLines = dataset.costLines.filter((record) => record.workOrderId === work.id && record.basis === "recorded");
  if (recordedLines.length) {
    return {
      id: work.id,
      work,
      store,
      amountMinor: recordedLines.reduce((sum, record) => sum + record.amountMinor, 0),
      effectiveAt: latestTimestamp(recordedLines.map((record) => record.recordedAt), work.createdAt),
      sourceLabel: "Recorded work cost",
      sourceDetail: `${recordedLines.length} entered cost ${recordedLines.length === 1 ? "line" : "lines"}`,
      categoryId: recordedLines.find((record) => record.categoryId)?.categoryId ?? work.categoryId,
      assetId: recordedLines.find((record) => record.assetId)?.assetId ?? work.assetId,
      vendorId: recordedLines.find((record) => record.vendorId)?.vendorId ?? vendorForWork(dataset, work.id),
      invoiceIds,
      invoiceLinks: links,
      usedInvoiceFallback: false,
    };
  }

  if (!links.length) return null;
  return {
    id: work.id,
    work,
    store,
    amountMinor: linkedAmount,
    effectiveAt: linkedDate,
    sourceLabel: "Linked invoice fallback",
    sourceDetail: "No recorded work-cost line exists",
    categoryId: links.find((record) => record.categoryId)?.categoryId ?? work.categoryId,
    assetId: links.find((record) => record.assetId)?.assetId ?? work.assetId,
    vendorId: linkedVendorId ?? vendorForWork(dataset, work.id),
    invoiceIds,
    invoiceLinks: links,
    usedInvoiceFallback: true,
  };
}

export function maintenanceSpendWorkOrderIds(dataset: DemoDataset, state: MaintenanceSpendState) {
  const range = periodRange(state.period, dataset.asOf);
  return dataset.workOrders
    .map((work) => createSpendRecord(dataset, work, state.basis))
    .filter((record): record is SpendRecord => Boolean(record))
    .filter((record) => record.effectiveAt >= range.start && record.effectiveAt <= range.end)
    .filter((record) => state.regionId === "all" || record.store.regionId === state.regionId)
    .filter((record) => state.storeId === "all" || record.store.id === state.storeId)
    .filter((record) => state.categoryId === "all" || (state.categoryId === "unclassified" ? !record.categoryId : record.categoryId === state.categoryId))
    .filter((record) => state.vendorId === "all" || (state.vendorId === "no_vendor" ? !record.vendorId : record.vendorId === state.vendorId))
    .map((record) => record.work.id);
}

function sumRecords(records: SpendRecord[]) {
  return records.reduce((sum, record) => sum + record.amountMinor, 0);
}

function donutBackground(rows: Array<BreakdownRow<unknown>>, total: number) {
  if (!total || !rows.length) return "conic-gradient(#e5ecea 0 100%)";
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const start = cursor;
    cursor += (row.amountMinor / total) * 100;
    return `${row.color ?? fallbackColors[index % fallbackColors.length]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function MaintenanceSpendWorkspace({
  dataset,
  scopeLabel,
  value,
  onChange,
  onOpenWork,
  onOpenStore,
  onOpenAsset,
  onOpenVendor,
  onOpenInvoice,
  onGenerateReport,
  canGenerate,
  invoiceEvidenceEnabled = true,
  className,
}: MaintenanceSpendWorkspaceProps) {
  const sourceAnchorId = `maintenance-spend-sources-${useId().replaceAll(":", "")}`;
  const effectiveBasis: MaintenanceSpendBasis = !invoiceEvidenceEnabled && value.basis === "linked_invoice" ? "recorded" : value.basis;
  const visibleBasisOptions = invoiceEvidenceEnabled ? basisOptions : basisOptions.filter((option) => option.value !== "linked_invoice");
  const selectedBasis = visibleBasisOptions.find((option) => option.value === effectiveBasis) ?? visibleBasisOptions[0];
  const range = periodRange(value.period, dataset.asOf);

  function update(next: Partial<MaintenanceSpendState>, resetPage = true) {
    onChange({ ...value, ...next, sourcePage: resetPage ? 1 : (next.sourcePage ?? value.sourcePage) });
  }

  const availableStores = dataset.stores.filter((store) => value.regionId === "all" || store.regionId === value.regionId);
  const allBasisRecords = useMemo(
    () => dataset.workOrders.map((work) => createSpendRecord(dataset, work, effectiveBasis)).filter((record): record is SpendRecord => Boolean(record)),
    [dataset, effectiveBasis],
  );
  const periodRecords = allBasisRecords.filter((record) => record.effectiveAt >= range.start && record.effectiveAt <= range.end);
  const records = periodRecords
    .filter((record) => value.regionId === "all" || record.store.regionId === value.regionId)
    .filter((record) => value.storeId === "all" || record.store.id === value.storeId)
    .filter((record) => value.categoryId === "all" || (value.categoryId === "unclassified" ? !record.categoryId : record.categoryId === value.categoryId))
    .filter((record) => value.vendorId === "all" || (value.vendorId === "no_vendor" ? !record.vendorId : record.vendorId === value.vendorId))
    .sort((left, right) => right.amountMinor - left.amountMinor || right.effectiveAt.localeCompare(left.effectiveAt) || left.work.number.localeCompare(right.work.number));

  const total = sumRecords(records);
  const fallbackRecords = records.filter((record) => record.usedInvoiceFallback);
  const unclassifiedRecords = records.filter((record) => !record.categoryId);
  const directRecordedCount = records.filter((record) => record.sourceLabel === "Recorded work cost").length;

  const categoryRows: Array<BreakdownRow<unknown>> = [
    ...dataset.categories.map((category, index) => {
      const categoryRecords = records.filter((record) => record.categoryId === category.id);
      return {
        id: category.id,
        label: category.label,
        meta: `${categoryRecords.length} work ${categoryRecords.length === 1 ? "order" : "orders"}`,
        amountMinor: sumRecords(categoryRecords),
        recordCount: categoryRecords.length,
        color: category.color || fallbackColors[index % fallbackColors.length],
      };
    }),
    {
      id: "unclassified",
      label: "Unclassified",
      meta: `${unclassifiedRecords.length} work ${unclassifiedRecords.length === 1 ? "order" : "orders"}`,
      amountMinor: sumRecords(unclassifiedRecords),
      recordCount: unclassifiedRecords.length,
      color: "#8c9a97",
    },
  ].filter((row) => row.amountMinor > 0).sort((left, right) => right.amountMinor - left.amountMinor);

  const storeRows: Array<BreakdownRow<Store>> = dataset.stores
    .map((store) => {
      const storeRecords = records.filter((record) => record.store.id === store.id);
      return {
        id: store.id,
        item: store,
        label: `Store ${store.storeNumber}`,
        meta: `${store.address.city} · ${storeRecords.length} source ${storeRecords.length === 1 ? "record" : "records"}`,
        amountMinor: sumRecords(storeRecords),
        recordCount: storeRecords.length,
      };
    })
    .filter((row) => row.amountMinor > 0)
    .sort((left, right) => right.amountMinor - left.amountMinor);

  const vendorRows: Array<BreakdownRow<Vendor>> = [
    ...dataset.vendors.map((vendor) => {
      const vendorRecords = records.filter((record) => record.vendorId === vendor.id);
      return {
        id: vendor.id,
        item: vendor,
        label: vendor.displayName,
        meta: `${vendorRecords.length} work ${vendorRecords.length === 1 ? "order" : "orders"}`,
        amountMinor: sumRecords(vendorRecords),
        recordCount: vendorRecords.length,
      };
    }),
    (() => {
      const noVendorRecords = records.filter((record) => !record.vendorId);
      return {
        id: "no_vendor",
        label: "Internal / no outside vendor",
        meta: `${noVendorRecords.length} work ${noVendorRecords.length === 1 ? "order" : "orders"}`,
        amountMinor: sumRecords(noVendorRecords),
        recordCount: noVendorRecords.length,
      };
    })(),
  ].filter((row) => row.amountMinor > 0).sort((left, right) => right.amountMinor - left.amountMinor);

  const assetRows = dataset.assets
    .map((asset) => {
      const assetRecords = records.filter((record) => record.assetId === asset.id);
      return { asset, records: assetRecords, amountMinor: sumRecords(assetRecords) };
    })
    .filter((row) => row.amountMinor > 0)
    .sort((left, right) => right.amountMinor - left.amountMinor);

  const maxStore = storeRows[0]?.amountMinor || 1;
  const maxVendor = vendorRows[0]?.amountMinor || 1;
  const pageCount = Math.max(1, Math.ceil(records.length / sourcePageSize));
  const safePage = Math.min(Math.max(1, value.sourcePage), pageCount);
  const pageRecords = records.slice((safePage - 1) * sourcePageSize, safePage * sourcePageSize);
  const selectedRegion = dataset.regions.find((record) => record.id === value.regionId);
  const selectedStore = dataset.stores.find((record) => record.id === value.storeId);
  const selectedCategory = dataset.categories.find((record) => record.id === value.categoryId);
  const selectedVendor = dataset.vendors.find((record) => record.id === value.vendorId);
  const activeFilters = [
    selectedRegion ? { label: selectedRegion.name, clear: () => update({ regionId: "all", storeId: "all" }) } : null,
    selectedStore ? { label: `Store ${selectedStore.storeNumber}`, clear: () => update({ storeId: "all" }) } : null,
    value.categoryId !== "all" ? { label: selectedCategory?.label ?? "Unclassified", clear: () => update({ categoryId: "all" }) } : null,
    value.vendorId !== "all" ? { label: selectedVendor?.displayName ?? "Internal / no vendor", clear: () => update({ vendorId: "all" }) } : null,
  ].filter((filter): filter is { label: string; clear: () => void } => Boolean(filter));

  return (
    <section className={classes(styles.root, className)}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Maintenance cost visibility · {scopeLabel}</span>
          <h2>See the cost, then open the work behind it.</h2>
          <p>
            Recorded maintenance cost is the default. Authorization limits and optional linked-invoice evidence remain separate, transparent views.
          </p>
        </div>
        {canGenerate ? (
          <button className={styles.reportButton} type="button" onClick={() => onGenerateReport(value)}>
            <FileBarChart aria-hidden="true" /> Generate this view
          </button>
        ) : null}
      </header>

      <section className={styles.basisDeck} aria-label="Maintenance cost basis">
        {visibleBasisOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={classes(styles.basisButton, effectiveBasis === option.value && styles.basisButtonActive)}
            onClick={() => update({ basis: option.value })}
            aria-pressed={effectiveBasis === option.value}
          >
            {option.value === "recorded" ? <Wrench aria-hidden="true" /> : option.value === "authorized" ? <ShieldCheck aria-hidden="true" /> : <ReceiptText aria-hidden="true" />}
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
            {effectiveBasis === option.value ? <span className={styles.selectedMark}>Selected</span> : null}
          </button>
        ))}
      </section>

      <section className={styles.filterDeck} aria-label="Maintenance cost filters">
        <label>
          <span>Period</span>
          <select value={value.period} onChange={(event) => update({ period: event.target.value as MaintenanceSpendPeriod })}>
            {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Region</span>
          <select value={value.regionId} onChange={(event) => update({ regionId: event.target.value, storeId: "all" })}>
            <option value="all">All regions</option>
            {dataset.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </label>
        <label>
          <span>Store</span>
          <select value={value.storeId} onChange={(event) => update({ storeId: event.target.value })}>
            <option value="all">All stores in scope</option>
            {availableStores.map((store) => <option key={store.id} value={store.id}>#{store.storeNumber} · {store.address.city}</option>)}
          </select>
        </label>
        <label>
          <span>Service category</span>
          <select value={value.categoryId} onChange={(event) => update({ categoryId: event.target.value })}>
            <option value="all">All categories</option>
            {dataset.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            <option value="unclassified">Unclassified</option>
          </select>
        </label>
        <label>
          <span>Outside vendor</span>
          <select value={value.vendorId} onChange={(event) => update({ vendorId: event.target.value })}>
            <option value="all">All fulfillment</option>
            {dataset.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>)}
            <option value="no_vendor">Internal / no outside vendor</option>
          </select>
        </label>
      </section>

      <div className={styles.scopeTrail}>
        <span>{selectedBasis.label}</span><ChevronRight aria-hidden="true" />
        <span>{periodOptions.find((option) => option.value === value.period)?.label}</span><ChevronRight aria-hidden="true" />
        <strong>{activeFilters.length ? activeFilters.map((filter) => filter.label).join(" · ") : scopeLabel}</strong>
      </div>
      {activeFilters.length ? (
        <div className={styles.filterChips} aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button type="button" key={filter.label} onClick={filter.clear}>{filter.label}<X aria-hidden="true" /></button>
          ))}
          <button type="button" onClick={() => update({ regionId: "all", storeId: "all", categoryId: "all", vendorId: "all" })}>Clear scope filters</button>
        </div>
      ) : null}

      <section className={styles.kpiGrid} aria-label="Maintenance cost summary">
        <a className={styles.kpiCard} href={`#${sourceAnchorId}`}>
          <span><CircleDollarSign aria-hidden="true" />Selected maintenance cost</span>
          <strong>{money(total)}</strong>
          <small>{selectedBasis.label} · {records.length} source work orders</small>
        </a>
        <a className={styles.kpiCard} href={`#${sourceAnchorId}`}>
          <span><FileText aria-hidden="true" />Work with cost in view</span>
          <strong>{records.length}</strong>
          <small>{effectiveBasis === "recorded" ? `${directRecordedCount} have directly recorded cost` : "One current value per work order"}</small>
        </a>
        <button className={styles.kpiCard} type="button" onClick={() => update({ basis: "linked_invoice" })}>
          <span><ReceiptText aria-hidden="true" />Optional invoice evidence</span>
          <strong>{effectiveBasis === "recorded" ? fallbackRecords.length : records.filter((record) => record.invoiceIds.length).length}</strong>
          <small>{effectiveBasis === "recorded" ? "Used only where recorded cost is absent" : "Work orders with linked invoice evidence"}</small>
        </button>
        <button className={styles.kpiCard} type="button" onClick={() => update({ categoryId: "unclassified" })}>
          <span><PackageSearch aria-hidden="true" />Unclassified cost</span>
          <strong>{money(sumRecords(unclassifiedRecords))}</strong>
          <small>{unclassifiedRecords.length} work orders remain visible without invented categories</small>
        </button>
      </section>

      <section className={styles.visualGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span>Cost mix</span><h3>Service categories</h3><p>Choose a slice to keep the same scope and narrow the source records.</p></div>
            <BarChart3 aria-hidden="true" />
          </header>
          {categoryRows.length ? (
            <div className={styles.donutLayout}>
              <button
                className={styles.donut}
                type="button"
                style={{ "--donut-background": donutBackground(categoryRows, total) } as CSSProperties}
                onClick={() => update({ categoryId: "all" })}
                aria-label={`${money(total)} across ${categoryRows.length} service categories; clear category filter`}
              >
                <span><strong>{money(total, true)}</strong><small>{categoryRows.length} categories</small></span>
              </button>
              <div className={styles.legendList}>
                {categoryRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => update({ categoryId: row.id })}>
                    <i style={{ background: row.color }} />
                    <span><strong>{row.label}</strong><small>{row.meta}</small></span>
                    <b>{money(row.amountMinor)}</b>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : <EmptyCostView />}
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span>Operating scope</span><h3>Highest-cost stores</h3><p>Filter to a store or open its complete operating record.</p></div>
            <StoreIcon aria-hidden="true" />
          </header>
          {storeRows.length ? (
            <div className={styles.barList}>
              {storeRows.slice(0, 7).map((row) => (
                <div className={styles.barRecord} key={row.id}>
                  <button className={styles.barMain} type="button" onClick={() => update({ regionId: row.item?.regionId ?? "all", storeId: row.id })}>
                    <span><strong>{row.label}</strong><small>{row.meta}</small></span>
                    <span className={styles.barTrack}><i style={{ width: `${Math.max(5, (row.amountMinor / maxStore) * 100)}%` }} /></span>
                    <b>{money(row.amountMinor)}</b>
                  </button>
                  <button className={styles.openRecordButton} type="button" onClick={() => onOpenStore(row.id)} aria-label={`Open ${row.label} record`}><ArrowRight aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          ) : <EmptyCostView />}
        </article>
      </section>

      <section className={styles.visualGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span>Service partners</span><h3>Cost by outside vendor</h3><p>Internal work stays explicit instead of being assigned to a placeholder vendor.</p></div>
            <Truck aria-hidden="true" />
          </header>
          {vendorRows.length ? (
            <div className={styles.barList}>
              {vendorRows.slice(0, 7).map((row) => (
                <div className={styles.barRecord} key={row.id}>
                  <button className={styles.barMain} type="button" onClick={() => update({ vendorId: row.id })}>
                    <span><strong>{row.label}</strong><small>{row.meta}</small></span>
                    <span className={styles.barTrack}><i style={{ width: `${Math.max(5, (row.amountMinor / maxVendor) * 100)}%` }} /></span>
                    <b>{money(row.amountMinor)}</b>
                  </button>
                  {row.item ? <button className={styles.openRecordButton} type="button" onClick={() => onOpenVendor(row.id)} aria-label={`Open ${row.label} record`}><ArrowRight aria-hidden="true" /></button> : null}
                </div>
              ))}
            </div>
          ) : <EmptyCostView />}
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span>Lifecycle context</span><h3>Equipment cost drivers</h3><p>Only work explicitly classified to an asset appears here.</p></div>
            <Gauge aria-hidden="true" />
          </header>
          {assetRows.length ? (
            <div className={styles.assetList}>
              {assetRows.slice(0, 7).map((row) => {
                const store = dataset.stores.find((record) => record.id === row.asset.storeId);
                return (
                  <button type="button" key={row.asset.id} onClick={() => onOpenAsset(row.asset.id)}>
                    <span className={styles.assetIcon}><Gauge aria-hidden="true" /></span>
                    <span><strong>{row.asset.name}</strong><small>Store {store?.storeNumber} · {row.asset.assetCode} · {row.records.length} source records</small></span>
                    <b>{money(row.amountMinor)}</b>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : <EmptyCostView message="No cost in this selection is classified to an individual asset." />}
        </article>
      </section>

      <article className={classes(styles.panel, styles.sourcePanel)} id={sourceAnchorId}>
        <header className={styles.panelHeader}>
          <div>
            <span>Supporting records</span>
            <h3>Every amount in this view</h3>
            <p>Open the customer work order, store, category, vendor, asset, or optional invoice evidence without losing these filters.</p>
          </div>
          <span className={styles.recordCount}>{records.length} records</span>
        </header>
        {pageRecords.length ? (
          <div className={styles.sourceList}>
            {pageRecords.map((record) => {
              const category = dataset.categories.find((item) => item.id === record.categoryId);
              const vendor = dataset.vendors.find((item) => item.id === record.vendorId);
              const asset = dataset.assets.find((item) => item.id === record.assetId);
              return (
                <div className={styles.sourceRecord} key={record.id}>
                  <button className={styles.sourcePrimary} type="button" onClick={() => onOpenWork(record.work.id)}>
                    <span className={styles.sourceWorkIcon}><Wrench aria-hidden="true" /></span>
                    <span className={styles.sourceCopy}>
                      <span>{record.work.number} · {formatDate(record.effectiveAt)}</span>
                      <strong>{record.work.title}</strong>
                      <small>{record.sourceLabel} · {record.sourceDetail}</small>
                    </span>
                    <span className={styles.sourceAmount}><strong>{money(record.amountMinor)}</strong><small>Open work order</small></span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <div className={styles.sourceActions}>
                    <button type="button" onClick={() => onOpenStore(record.store.id)}><StoreIcon aria-hidden="true" /><span>Store {record.store.storeNumber}</span></button>
                    <button type="button" onClick={() => update({ categoryId: record.categoryId ?? "unclassified" })}><Building2 aria-hidden="true" /><span>{category?.label ?? "Unclassified"}</span></button>
                    {vendor ? <button type="button" onClick={() => onOpenVendor(vendor.id)}><Truck aria-hidden="true" /><span>{vendor.displayName}</span></button> : <button type="button" onClick={() => update({ vendorId: "no_vendor" })}><Truck aria-hidden="true" /><span>Internal / no vendor</span></button>}
                    {asset ? <button type="button" onClick={() => onOpenAsset(asset.id)}><Gauge aria-hidden="true" /><span>{asset.assetCode}</span></button> : null}
                    {record.invoiceIds.map((invoiceId) => {
                      const invoice = dataset.invoices.find((item) => item.id === invoiceId);
                      if (!invoice) return null;
                      return <button type="button" key={invoiceId} onClick={() => onOpenInvoice(invoiceId)}><ReceiptText aria-hidden="true" /><span>{invoice.invoiceNumber} · {money(invoiceTotal(dataset, invoiceId))}</span></button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyCostView message="No source records match this basis, period, and scope." />}

        {records.length > sourcePageSize ? (
          <footer className={styles.pagination}>
            <span>Page {safePage} of {pageCount}</span>
            <div>
              <button type="button" disabled={safePage <= 1} onClick={() => update({ sourcePage: safePage - 1 }, false)}><ChevronLeft aria-hidden="true" /> Previous</button>
              <button type="button" disabled={safePage >= pageCount} onClick={() => update({ sourcePage: safePage + 1 }, false)}>Next <ChevronRight aria-hidden="true" /></button>
            </div>
          </footer>
        ) : null}
      </article>

      <p className={styles.boundaryNote}>
        <ShieldCheck aria-hidden="true" /> TraceOps connects maintenance cost to work and evidence. Optional invoice matching supports review; it does not run accounting, approve payment, or move money.
      </p>
    </section>
  );
}

function EmptyCostView({ message = "No maintenance cost matches this selection." }: { message?: string }) {
  return (
    <div className={styles.empty}>
      <CircleDollarSign aria-hidden="true" />
      <strong>No cost in view</strong>
      <p>{message}</p>
    </div>
  );
}
