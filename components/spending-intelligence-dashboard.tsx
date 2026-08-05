"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Layers3,
  MapPin,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "@/components/site-link";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  median,
  replacementAnalysis,
} from "@/lib/domain/analytics";
import type {
  Asset,
  Component,
  CostAllocation,
  DemoData,
  Region,
  Store as StoreRecord,
} from "@/lib/domain/types";
import { PLATFORM_NOW, platformData } from "@/lib/platform/data";

export type ScopeLevel = "company" | "division" | "region" | "store";
type PeriodKey = "ytd" | "ttm" | "prior_ttm";
type DonutMode = "category" | "vendor" | "work_type";

export interface SpendingIntelligenceDashboardProps {
  initialScopeLevel?: ScopeLevel;
  initialScopeId?: string;
  compactHeader?: boolean;
}

type DemoDivision = {
  id: string;
  name: string;
  regionIds: string[];
  detail: string;
};

type DrillState = {
  categoryId?: string;
  groupKey?: string;
  assetId?: string;
  componentId?: string;
};

type PeriodRange = {
  start: Date;
  end: Date;
  label: string;
  comparisonStart: Date;
  comparisonEnd: Date;
};

type AllocationRow = {
  allocation: CostAllocation;
  netAmountCents: number;
  invoice: DemoData["invoices"][number];
  workOrder?: DemoData["workOrders"][number];
  store?: StoreRecord;
  vendor?: DemoData["vendors"][number];
  asset?: Asset;
  component?: Component;
};

type SpendSlice = {
  key: string;
  label: string;
  valueCents: number;
  color: string;
  allocationIds: string[];
};

type SourceFilter = {
  label: string;
  allocationIds: string[];
  rowsOverride?: AllocationRow[];
  periodLabel?: string;
};

type EquipmentGroup = {
  key: string;
  label: string;
};

type LifecycleItem = {
  asset: Asset;
  decision: "capital_review" | "plan" | "watch" | "no_flag";
  decisionLabel: string;
  analysis: ReturnType<typeof replacementAnalysis>;
  reasons: string[];
  store?: StoreRecord;
  categoryId?: string;
  group: EquipmentGroup;
};

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "ytd", label: "Year to date" },
  { key: "ttm", label: "Last 12 months" },
  { key: "prior_ttm", label: "Prior 12 months" },
];

const WORK_TYPE_COLORS: Record<CostAllocation["workClass"], string> = {
  planned_pm: "#2f8f7b",
  reactive: "#d78324",
  emergency: "#c6483f",
  diagnostic: "#7b61a8",
  capital: "#456c9b",
  warranty: "#4b8d5a",
  internal: "#6f7d79",
};

const FALLBACK_COLORS = [
  "#167a6c",
  "#4e6f8e",
  "#d78324",
  "#795b91",
  "#a64e45",
  "#708445",
  "#5d6f78",
  "#a07b38",
];

const paidInvoiceStatuses = new Set(["paid"]);

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function addUtcMonths(value: Date, months: number) {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function addUtcYears(value: Date, years: number) {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function periodRange(key: PeriodKey): PeriodRange {
  const now = new Date(PLATFORM_NOW);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (key === "ytd") {
    return {
      start: yearStart,
      end: now,
      label: `${formatDate(yearStart.toISOString())}–${formatDate(now.toISOString())}`,
      comparisonStart: addUtcYears(yearStart, -1),
      comparisonEnd: addUtcYears(now, -1),
    };
  }
  if (key === "prior_ttm") {
    const end = addUtcMonths(now, -12);
    const start = addUtcMonths(now, -24);
    return {
      start,
      end,
      label: `${formatDate(start.toISOString())}–${formatDate(end.toISOString())}`,
      comparisonStart: addUtcMonths(now, -36),
      comparisonEnd: addUtcMonths(now, -24),
    };
  }
  const start = addUtcMonths(now, -12);
  return {
    start,
    end: now,
    label: `${formatDate(start.toISOString())}–${formatDate(now.toISOString())}`,
    comparisonStart: addUtcMonths(now, -24),
    comparisonEnd: start,
  };
}

function deriveDemoDivisions(regions: Region[]): DemoDivision[] {
  if (!regions.length) return [];
  const splitAt = Math.max(1, Math.ceil(regions.length / 2));
  return [regions.slice(0, splitAt), regions.slice(splitAt)]
    .filter((group) => group.length > 0)
    .map((group, index) => {
      const shortNames = group.map((region) => region.name.replace(/\s+Region$/i, ""));
      return {
        id: `demo-division-${index + 1}`,
        name: `${shortNames.join(" + ")} Division`,
        regionIds: group.map((region) => region.id),
        detail: group.map((region) => region.name).join(", "),
      };
    });
}

function equipmentGroupForAsset(asset: Asset): EquipmentGroup {
  const text = `${asset.assetClass} ${asset.name}`.toLowerCase();
  if (text.includes("beer cave")) return { key: "beer-caves", label: "Beer caves" };
  if (text.includes("freezer")) return { key: "freezers", label: "Freezers" };
  if (text.includes("cooler") || text.includes("walk-in") || text.includes("reach-in")) {
    return { key: "coolers", label: "Coolers" };
  }
  if (text.includes("ice machine")) return { key: "ice-machines", label: "Ice machines" };
  if (text.includes("condensing") || text.includes("evaporator") || text.includes("compressor")) {
    return { key: "refrigeration-plant", label: "Refrigeration plant" };
  }
  if (text.includes("rooftop") || /\brtu\b/.test(text)) {
    return { key: "rooftop-hvac", label: "Rooftop HVAC units" };
  }
  if (text.includes("oven") || text.includes("cooking")) {
    return { key: "cooking-equipment", label: "Ovens & cooking equipment" };
  }
  if (text.includes("water heater")) return { key: "water-heaters", label: "Water heaters" };
  if (text.includes("panel")) return { key: "electrical-panels", label: "Electrical panels" };
  if (text.includes("dispenser")) return { key: "fuel-dispensers", label: "Fuel dispensers" };
  const normalized = asset.assetClass
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    key: normalized || "other-equipment",
    label: asset.assetClass || "Other equipment",
  };
}

function storeLabel(store?: StoreRecord) {
  return store ? `Store ${store.code} · ${store.city}` : "Unknown store";
}

function sumRows(rows: AllocationRow[]) {
  return rows.reduce((sum, row) => sum + row.netAmountCents, 0);
}

function allocationRows(
  data: DemoData,
  start: Date,
  end: Date,
  storeIds: Set<string>,
): AllocationRow[] {
  const invoiceById = new Map(data.invoices.map((invoice) => [invoice.id, invoice]));
  const workOrderById = new Map(data.workOrders.map((record) => [record.id, record]));
  const storeById = new Map(data.stores.map((record) => [record.id, record]));
  const vendorById = new Map(data.vendors.map((record) => [record.id, record]));
  const assetById = new Map(data.assets.map((record) => [record.id, record]));
  const componentById = new Map(data.components.map((record) => [record.id, record]));
  const allocatedByInvoice = new Map<string, number>();
  data.allocations.forEach((allocation) => {
    allocatedByInvoice.set(
      allocation.invoiceId,
      (allocatedByInvoice.get(allocation.invoiceId) ?? 0) + allocation.amountCents,
    );
  });
  const postedCreditsByInvoice = new Map<string, number>();
  data.credits
    .filter((credit) => credit.status === "posted")
    .forEach((credit) => {
      postedCreditsByInvoice.set(
        credit.invoiceId,
        (postedCreditsByInvoice.get(credit.invoiceId) ?? 0) + credit.amountCents,
      );
    });

  return data.allocations.flatMap((allocation) => {
    const invoice = invoiceById.get(allocation.invoiceId);
    if (!invoice || !paidInvoiceStatuses.has(invoice.status)) return [];
    const issuedAt = new Date(invoice.issuedAt);
    if (issuedAt < start || issuedAt >= end || !storeIds.has(allocation.storeId)) return [];
    const allocatedTotal = allocatedByInvoice.get(invoice.id) ?? invoice.totalCents;
    const postedCredit = postedCreditsByInvoice.get(invoice.id) ?? 0;
    const creditShare = allocatedTotal
      ? Math.round(postedCredit * (allocation.amountCents / allocatedTotal))
      : 0;
    const workOrder = workOrderById.get(allocation.workOrderId);
    return [
      {
        allocation,
        invoice,
        netAmountCents: Math.max(0, allocation.amountCents - creditShare),
        workOrder,
        store: storeById.get(allocation.storeId),
        vendor: vendorById.get(invoice.vendorId ?? workOrder?.vendorId ?? ""),
        asset: allocation.assetId ? assetById.get(allocation.assetId) : undefined,
        component: allocation.componentId
          ? componentById.get(allocation.componentId)
          : undefined,
      },
    ];
  });
}

function rowsForDrill(rows: AllocationRow[], drill: DrillState) {
  return rows.filter((row) => {
    if (drill.categoryId && row.allocation.categoryId !== drill.categoryId) return false;
    if (drill.groupKey) {
      const key = row.asset ? equipmentGroupForAsset(row.asset).key : "unclassified";
      if (key !== drill.groupKey) return false;
    }
    if (drill.assetId && row.allocation.assetId !== drill.assetId) return false;
    if (drill.componentId && row.allocation.componentId !== drill.componentId) return false;
    return true;
  });
}

function buildSlices(
  rows: AllocationRow[],
  getKey: (row: AllocationRow) => string,
  getLabel: (row: AllocationRow, key: string) => string,
  getColor: (row: AllocationRow, key: string, index: number) => string,
): SpendSlice[] {
  const grouped = new Map<string, { label: string; valueCents: number; ids: string[]; sample: AllocationRow }>();
  rows.forEach((row) => {
    const key = getKey(row);
    const current = grouped.get(key);
    if (current) {
      current.valueCents += row.netAmountCents;
      current.ids.push(row.allocation.id);
    } else {
      grouped.set(key, {
        label: getLabel(row, key),
        valueCents: row.netAmountCents,
        ids: [row.allocation.id],
        sample: row,
      });
    }
  });
  return [...grouped.entries()]
    .map(([key, item], index) => ({
      key,
      label: item.label,
      valueCents: item.valueCents,
      allocationIds: item.ids,
      color: getColor(item.sample, key, index),
    }))
    .sort((left, right) => right.valueCents - left.valueCents);
}

function donutBackground(slices: SpendSlice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.valueCents, 0);
  if (!total) return "conic-gradient(#dfe7e4 0 100%)";
  let cursor = 0;
  const stops = slices.map((slice) => {
    const start = cursor;
    cursor += (slice.valueCents / total) * 100;
    return `${slice.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function lifecycleForAsset(data: DemoData, asset: Asset): LifecycleItem {
  const analysis = replacementAnalysis(data, asset, PLATFORM_NOW);
  const system = data.systems.find((candidate) => candidate.id === asset.storeSystemId);
  const store = data.stores.find((candidate) => candidate.id === system?.storeId);
  const ageRatio = asset.expectedLifeYears > 0 ? analysis.ageYears / asset.expectedLifeYears : 0;
  const reasons = analysis.reasons.map((reason) => `${reason.label}: ${reason.value}`);
  let decision: LifecycleItem["decision"] = "no_flag";
  let decisionLabel = "No current flag";
  if (analysis.recommended) {
    decision = "capital_review";
    decisionLabel = "Capital review";
  } else if (
    ageRatio >= 0.8 ||
    analysis.burden >= 0.25 ||
    ["poor", "failed"].includes(asset.condition)
  ) {
    decision = "plan";
    decisionLabel = "Plan replacement";
  } else if (
    analysis.failureCount >= 2 ||
    ["watch", "service_due", "offline"].includes(asset.state) ||
    asset.condition === "fair"
  ) {
    decision = "watch";
    decisionLabel = "Watch closely";
  }
  if (!reasons.length && decision !== "no_flag") {
    if (ageRatio >= 0.8) reasons.push(`${formatPercent(ageRatio)} of expected service life used`);
    if (["poor", "failed", "fair"].includes(asset.condition)) {
      reasons.push(`Condition recorded as ${asset.condition}`);
    }
    if (["watch", "service_due", "offline"].includes(asset.state)) {
      reasons.push(`Operating state is ${titleCase(asset.state)}`);
    }
  }
  return {
    asset,
    decision,
    decisionLabel,
    analysis,
    reasons,
    store,
    categoryId: system?.categoryId,
    group: equipmentGroupForAsset(asset),
  };
}

function monthBuckets(range: PeriodRange) {
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const cursor = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
  while (cursor < range.end && buckets.length < 18) {
    const next = addUtcMonths(cursor, 1);
    buckets.push({
      key: `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}`,
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(cursor),
      start: new Date(cursor),
      end: next < range.end ? next : range.end,
    });
    cursor.setTime(next.getTime());
  }
  return buckets;
}

function scopeOptions(
  level: ScopeLevel,
  divisions: DemoDivision[],
  data: DemoData,
): Array<{ id: string; label: string; detail?: string }> {
  if (level === "company") {
    return [{ id: data.organization.id, label: data.organization.name }];
  }
  if (level === "division") {
    return divisions.map((division) => ({
      id: division.id,
      label: division.name,
      detail: division.detail,
    }));
  }
  if (level === "region") {
    return data.regions.map((region) => ({ id: region.id, label: region.name }));
  }
  return data.stores.map((store) => ({
    id: store.id,
    label: `Store ${store.code} · ${store.city}`,
    detail: `${store.address1}, ${store.city}, ${store.state}`,
  }));
}

function validInitialScope(
  level: ScopeLevel,
  requestedId: string | undefined,
  divisions: DemoDivision[],
) {
  const options = scopeOptions(level, divisions, platformData);
  if (requestedId && options.some((option) => option.id === requestedId)) return requestedId;
  return options[0]?.id ?? platformData.organization.id;
}

export function SpendingIntelligenceDashboard({
  initialScopeLevel = "company",
  initialScopeId,
  compactHeader = false,
}: SpendingIntelligenceDashboardProps) {
  const divisions = useMemo(() => deriveDemoDivisions(platformData.regions), []);
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(initialScopeLevel);
  const [scopeId, setScopeId] = useState(() =>
    validInitialScope(initialScopeLevel, initialScopeId, divisions),
  );
  const [period, setPeriod] = useState<PeriodKey>("ttm");
  const [drill, setDrill] = useState<DrillState>({});
  const [donutMode, setDonutMode] = useState<DonutMode>("category");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);

  const range = periodRange(period);
  const availableScopeOptions = scopeOptions(scopeLevel, divisions, platformData);
  const activeScope = availableScopeOptions.find((option) => option.id === scopeId);
  const selectedDivision = divisions.find((division) => division.id === scopeId);
  const scopedStores = platformData.stores.filter((store) => {
    if (scopeLevel === "company") return true;
    if (scopeLevel === "division") return selectedDivision?.regionIds.includes(store.regionId ?? "");
    if (scopeLevel === "region") return store.regionId === scopeId;
    return store.id === scopeId;
  });
  const scopedStoreIds = new Set(scopedStores.map((store) => store.id));
  const baseRows = allocationRows(platformData, range.start, range.end, scopedStoreIds);
  const contextRows = rowsForDrill(baseRows, drill);
  const comparisonRows = rowsForDrill(
    allocationRows(platformData, range.comparisonStart, range.comparisonEnd, scopedStoreIds),
    drill,
  );
  const totalSpend = sumRows(contextRows);
  const comparisonSpend = sumRows(comparisonRows);
  const change = comparisonSpend ? (totalSpend - comparisonSpend) / comparisonSpend : null;
  const reactiveRows = contextRows.filter((row) =>
    ["reactive", "emergency", "diagnostic"].includes(row.allocation.workClass),
  );
  const plannedRows = contextRows.filter((row) => row.allocation.workClass === "planned_pm");
  const assetMappedRows = contextRows.filter((row) => Boolean(row.allocation.assetId));
  const categoryById = new Map(platformData.categories.map((category) => [category.id, category]));
  const systemById = new Map(platformData.systems.map((system) => [system.id, system]));
  const selectedCategory = drill.categoryId ? categoryById.get(drill.categoryId) : undefined;
  const selectedAsset = drill.assetId
    ? platformData.assets.find((asset) => asset.id === drill.assetId)
    : undefined;
  const selectedComponent = drill.componentId
    ? platformData.components.find((component) => component.id === drill.componentId)
    : undefined;

  const categorySlices = buildSlices(
    contextRows,
    (row) => row.allocation.categoryId || "unclassified",
    (_row, key) => categoryById.get(key)?.name ?? "Unclassified",
    (_row, key, index) => categoryById.get(key)?.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  );
  const vendorSlices = buildSlices(
    contextRows,
    (row) => row.vendor?.id ?? "internal",
    (row) => row.vendor?.shortName ?? "Internal / unassigned",
    (row, _key, index) => row.vendor?.accent ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  );
  const workTypeSlices = buildSlices(
    contextRows,
    (row) => row.allocation.workClass,
    (_row, key) => titleCase(key === "planned_pm" ? "planned maintenance" : key),
    (_row, key, index) =>
      WORK_TYPE_COLORS[key as CostAllocation["workClass"]] ??
      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  );
  const donutSlices =
    donutMode === "category"
      ? categorySlices
      : donutMode === "vendor"
        ? vendorSlices
        : workTypeSlices;

  const allAssetsInScope = platformData.assets.filter((asset) => {
    const system = systemById.get(asset.storeSystemId);
    return Boolean(system && scopedStoreIds.has(system.storeId));
  });
  const lifecycleItems = allAssetsInScope
    .map((asset) => lifecycleForAsset(platformData, asset))
    .filter((item) => !drill.categoryId || item.categoryId === drill.categoryId)
    .filter((item) => !drill.groupKey || item.group.key === drill.groupKey)
    .filter((item) => !drill.assetId || item.asset.id === drill.assetId)
    .sort((left, right) => {
      const order = { capital_review: 3, plan: 2, watch: 1, no_flag: 0 } as const;
      return (
        order[right.decision] - order[left.decision] ||
        right.analysis.burden - left.analysis.burden ||
        right.analysis.ageYears - left.analysis.ageYears
      );
    });

  const categoryHierarchyItems = buildSlices(
    baseRows,
    (row) => row.allocation.categoryId || "unclassified",
    (_row, key) => categoryById.get(key)?.name ?? "Unclassified",
    (_row, key, index) => categoryById.get(key)?.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  );
  const assetsForSelectedCategory = allAssetsInScope.filter((asset) => {
    const system = systemById.get(asset.storeSystemId);
    return system?.categoryId === drill.categoryId;
  });
  const groupMap = new Map<string, { group: EquipmentGroup; assets: Asset[]; rows: AllocationRow[] }>();
  assetsForSelectedCategory.forEach((asset) => {
    const group = equipmentGroupForAsset(asset);
    const existing = groupMap.get(group.key) ?? { group, assets: [], rows: [] };
    existing.assets.push(asset);
    groupMap.set(group.key, existing);
  });
  if (drill.categoryId) {
    baseRows
      .filter((row) => row.allocation.categoryId === drill.categoryId)
      .forEach((row) => {
        const group = row.asset
          ? equipmentGroupForAsset(row.asset)
          : { key: "unclassified", label: "Not assigned to equipment" };
        const existing = groupMap.get(group.key) ?? { group, assets: [], rows: [] };
        existing.rows.push(row);
        groupMap.set(group.key, existing);
      });
  }
  const hierarchyGroups = [...groupMap.values()].sort(
    (left, right) => sumRows(right.rows) - sumRows(left.rows) || left.group.label.localeCompare(right.group.label),
  );
  const assetsForSelectedGroup = assetsForSelectedCategory
    .filter((asset) => equipmentGroupForAsset(asset).key === drill.groupKey)
    .map((asset) => ({
      asset,
      store: platformData.stores.find(
        (store) => store.id === systemById.get(asset.storeSystemId)?.storeId,
      ),
      rows: baseRows.filter((row) => row.allocation.assetId === asset.id),
    }))
    .sort((left, right) => sumRows(right.rows) - sumRows(left.rows));
  const componentsForAsset = selectedAsset
    ? platformData.components
        .filter((component) => component.assetId === selectedAsset.id)
        .map((component) => ({
          component,
          rows: baseRows.filter((row) => row.allocation.componentId === component.id),
        }))
        .sort((left, right) => sumRows(right.rows) - sumRows(left.rows))
    : [];

  const buckets = monthBuckets(range).map((bucket) => {
    const rows = contextRows.filter((row) => {
      const issuedAt = new Date(row.invoice.issuedAt);
      return issuedAt >= bucket.start && issuedAt < bucket.end;
    });
    return { ...bucket, rows, valueCents: sumRows(rows) };
  });
  const maxMonth = Math.max(1, ...buckets.map((bucket) => bucket.valueCents));

  const storeSpends = scopedStores
    .map((store) => {
      const rows = baseRows.filter((row) => row.allocation.storeId === store.id);
      return { store, rows, valueCents: sumRows(rows) };
    })
    .filter((item) => item.valueCents > 0);
  const peerMedian = median(storeSpends.map((item) => item.valueCents));
  const storeOutliers = storeSpends
    .filter(
      (item) =>
        storeSpends.length > 1 &&
        item.valueCents >= peerMedian * 1.25 &&
        item.valueCents - peerMedian >= 100_000,
    )
    .sort((left, right) => right.valueCents - left.valueCents)
    .slice(0, 2);
  const categoryMedian = median(categoryHierarchyItems.map((item) => item.valueCents));
  const categoryOutliers = categoryHierarchyItems
    .filter((item) => item.valueCents >= categoryMedian * 1.35 && item.valueCents >= 100_000)
    .slice(0, 2);
  const assetSpendItems = allAssetsInScope
    .map((asset) => ({
      asset,
      rows: baseRows.filter((row) => row.allocation.assetId === asset.id),
    }))
    .filter((item) => sumRows(item.rows) > 0);
  const assetMedian = median(assetSpendItems.map((item) => sumRows(item.rows)));
  const assetOutliers = assetSpendItems
    .filter((item) => sumRows(item.rows) >= Math.max(100_000, assetMedian * 1.5))
    .sort((left, right) => sumRows(right.rows) - sumRows(left.rows))
    .slice(0, 2);

  const effectiveSourceRows = sourceFilter?.rowsOverride
    ? sourceFilter.rowsOverride
    : sourceFilter
      ? contextRows.filter((row) => sourceFilter.allocationIds.includes(row.allocation.id))
      : contextRows;
  const sortedSourceRows = [...effectiveSourceRows].sort(
    (left, right) =>
      new Date(right.invoice.issuedAt).getTime() - new Date(left.invoice.issuedAt).getTime(),
  );
  const visibleSourceRows = showAllSources ? sortedSourceRows : sortedSourceRows.slice(0, 8);

  const selectedGroupLabel = drill.groupKey
    ? hierarchyGroups.find((item) => item.group.key === drill.groupKey)?.group.label ??
      equipmentGroupForAsset(selectedAsset ?? allAssetsInScope[0]).label
    : undefined;
  const contextLabel = [selectedCategory?.name, selectedGroupLabel, selectedAsset?.name, selectedComponent?.name]
    .filter(Boolean)
    .at(-1) ?? "All maintenance";

  const changeScopeLevel = (nextLevel: ScopeLevel) => {
    const options = scopeOptions(nextLevel, divisions, platformData);
    setScopeLevel(nextLevel);
    setScopeId(options[0]?.id ?? platformData.organization.id);
    setDrill({});
    setSourceFilter(null);
    setShowAllSources(false);
  };

  const chooseCategory = (categoryId: string) => {
    setDrill({ categoryId });
    setSourceFilter(null);
    setShowAllSources(false);
  };

  const chooseLifecycleAsset = (item: LifecycleItem) => {
    setDrill({
      categoryId: item.categoryId,
      groupKey: item.group.key,
      assetId: item.asset.id,
    });
    setSourceFilter(null);
    setShowAllSources(false);
  };

  const setSourceFromSlice = (slice: SpendSlice) => {
    if (donutMode === "category") {
      chooseCategory(slice.key);
      return;
    }
    setSourceFilter({ label: `${slice.label} source records`, allocationIds: slice.allocationIds });
    setShowAllSources(false);
  };

  const backOneLevel = () => {
    if (drill.componentId) setDrill((current) => ({ ...current, componentId: undefined }));
    else if (drill.assetId) setDrill((current) => ({ ...current, assetId: undefined }));
    else if (drill.groupKey) setDrill((current) => ({ ...current, groupKey: undefined }));
    else if (drill.categoryId) setDrill({});
    setSourceFilter(null);
    setShowAllSources(false);
  };

  return (
    <section className={`si-dashboard ${compactHeader ? "si-dashboard-compact" : ""}`}>
      <header className="si-hero">
        <div className="si-hero-copy">
          <span className="si-eyebrow">Maintenance spending intelligence</span>
          <h1>{compactHeader ? "See where maintenance money goes" : "Follow every maintenance dollar to the work behind it"}</h1>
          {!compactHeader && (
            <p>
              Start with the portfolio, spot an exception, then move through a store, service
              category, equipment group, individual unit, and component without losing the
              financial trail.
            </p>
          )}
        </div>
        <div className="si-definition-card">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>What this view counts</strong>
            <small>Paid invoices by invoice date, less posted vendor credits. Every value below opens its allocation records.</small>
          </span>
        </div>
      </header>

      <section className="si-control-deck" aria-label="Spending scope and period">
        <div className="si-control-group">
          <span className="si-control-label">View the</span>
          <div className="si-segmented-control" role="group" aria-label="Organization level">
            {(["company", "division", "region", "store"] as ScopeLevel[]).map((level) => (
              <button
                type="button"
                className={scopeLevel === level ? "is-active" : ""}
                aria-pressed={scopeLevel === level}
                onClick={() => changeScopeLevel(level)}
                key={level}
              >
                {titleCase(level)}
              </button>
            ))}
          </div>
        </div>
        <label className="si-scope-select">
          <span>{titleCase(scopeLevel)}</span>
          <select
            value={scopeId}
            onChange={(event) => {
              setScopeId(event.target.value);
              setDrill({});
              setSourceFilter(null);
            }}
          >
            {availableScopeOptions.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {activeScope?.detail && <small>{activeScope.detail}</small>}
        </label>
        <div className="si-control-group si-period-control">
          <span className="si-control-label">Period</span>
          <div className="si-segmented-control" role="group" aria-label="Spending period">
            {PERIOD_OPTIONS.map((option) => (
              <button
                type="button"
                className={period === option.key ? "is-active" : ""}
                aria-pressed={period === option.key}
                onClick={() => {
                  setPeriod(option.key);
                  setSourceFilter(null);
                }}
                key={option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="si-context-strip">
        <span><Building2 aria-hidden="true" />{activeScope?.label ?? platformData.organization.name}</span>
        <ChevronRight aria-hidden="true" />
        <span>{contextLabel}</span>
        <span className="si-context-period">{range.label}</span>
        {(drill.categoryId || sourceFilter) && (
          <button
            type="button"
            onClick={() => {
              setDrill({});
              setSourceFilter(null);
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset spending drill-down
          </button>
        )}
      </div>

      <section className="si-kpi-grid" aria-label="Spending summary">
        <button
          type="button"
          className="si-kpi-card si-kpi-primary"
          onClick={() => setSourceFilter(null)}
        >
          <span><CircleDollarSign aria-hidden="true" />Net paid spend</span>
          <strong>{formatCurrency(totalSpend)}</strong>
          <small>{contextRows.length} allocation records · open the source list</small>
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`si-kpi-card ${change !== null && change > 0 ? "si-kpi-warning" : ""}`}
          onClick={() =>
            setSourceFilter({
              label: "Current and comparison-period records",
              allocationIds: [],
              rowsOverride: [...contextRows, ...comparisonRows],
              periodLabel: `${range.label} compared with ${formatDate(range.comparisonStart.toISOString())}–${formatDate(range.comparisonEnd.toISOString())}`,
            })
          }
        >
          <span><TrendingUp aria-hidden="true" />Change from comparable period</span>
          <strong>{change === null ? "No baseline" : `${change > 0 ? "+" : ""}${formatPercent(change)}`}</strong>
          <small>{comparisonSpend ? `${formatCurrency(comparisonSpend)} in the comparison period` : "No paid source records in the comparison period"}</small>
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className="si-kpi-card"
          onClick={() =>
            setSourceFilter({
              label: "Reactive, emergency & diagnostic work",
              allocationIds: reactiveRows.map((row) => row.allocation.id),
            })
          }
        >
          <span><AlertTriangle aria-hidden="true" />Unplanned share</span>
          <strong>{totalSpend ? formatPercent(sumRows(reactiveRows) / totalSpend) : "0%"}</strong>
          <small>{formatCurrency(sumRows(reactiveRows))} unplanned · {formatCurrency(sumRows(plannedRows))} planned</small>
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className="si-kpi-card"
          onClick={() =>
            setSourceFilter({
              label: "Spend assigned to an individual asset",
              allocationIds: assetMappedRows.map((row) => row.allocation.id),
            })
          }
        >
          <span><Layers3 aria-hidden="true" />Asset-level visibility</span>
          <strong>{totalSpend ? formatPercent(sumRows(assetMappedRows) / totalSpend) : "0%"}</strong>
          <small>The remainder stays visible as not assigned to equipment</small>
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      <section className="si-visual-grid">
        <article className="si-panel si-mix-panel">
          <header className="si-panel-header">
            <div>
              <span className="si-section-kicker">Spend mix</span>
              <h2>What is driving {contextLabel.toLowerCase()}</h2>
            </div>
            <div className="si-chart-tabs" role="group" aria-label="Break spending down by">
              {(["category", "vendor", "work_type"] as DonutMode[]).map((mode) => (
                <button
                  type="button"
                  className={donutMode === mode ? "is-active" : ""}
                  aria-pressed={donutMode === mode}
                  onClick={() => setDonutMode(mode)}
                  key={mode}
                >
                  {mode === "work_type" ? "Work type" : titleCase(mode)}
                </button>
              ))}
            </div>
          </header>
          <div className="si-donut-layout">
            <div
              className="si-donut"
              style={{ background: donutBackground(donutSlices) }}
              role="img"
              aria-label={`${formatCurrency(totalSpend)} broken down by ${donutMode.replace("_", " ")}`}
            >
              <div className="si-donut-center">
                <strong>{formatCurrency(totalSpend, true)}</strong>
                <span>net paid</span>
              </div>
            </div>
            <div className="si-donut-legend">
              {donutSlices.slice(0, 8).map((slice) => (
                <button type="button" onClick={() => setSourceFromSlice(slice)} key={slice.key}>
                  <i style={{ backgroundColor: slice.color }} aria-hidden="true" />
                  <span><strong>{slice.label}</strong><small>{slice.allocationIds.length} records</small></span>
                  <b>{formatCurrency(slice.valueCents)}</b>
                  <em>{totalSpend ? formatPercent(slice.valueCents / totalSpend) : "0%"}</em>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
              {!donutSlices.length && <p className="si-empty-copy">No paid spending is recorded in this selection.</p>}
            </div>
          </div>
        </article>

        <article className="si-panel si-trend-panel">
          <header className="si-panel-header">
            <div>
              <span className="si-section-kicker">Trend</span>
              <h2>When the spend happened</h2>
            </div>
            <span className="si-panel-note">Invoice date</span>
          </header>
          <div className="si-trend-chart" aria-label="Monthly spending trend">
            {buckets.map((bucket) => (
              <button
                type="button"
                className="si-trend-column"
                aria-label={`${bucket.label}: ${formatCurrency(bucket.valueCents)}. Show ${bucket.rows.length} source records.`}
                onClick={() =>
                  setSourceFilter({
                    label: `${bucket.label} source records`,
                    allocationIds: bucket.rows.map((row) => row.allocation.id),
                  })
                }
                key={bucket.key}
              >
                <span className="si-trend-value">{bucket.valueCents ? formatCurrency(bucket.valueCents, true) : "—"}</span>
                <i className="si-trend-track" aria-hidden="true">
                  <i
                    className="si-trend-fill"
                    style={{ height: `${Math.max(3, (bucket.valueCents / maxMonth) * 100)}%` }}
                  />
                </i>
                <span className="si-trend-label">{bucket.label}</span>
              </button>
            ))}
          </div>
          <p className="si-chart-help">Select a month to open the exact invoice allocations behind its bar.</p>
        </article>
      </section>

      <section className="si-breakdown-grid" aria-label="Vendor and work type breakdowns">
        <article className="si-panel si-bar-panel">
          <header className="si-panel-header">
            <div><span className="si-section-kicker">Vendor view</span><h2>Who received the spend</h2></div>
          </header>
          <div className="si-ranked-bars">
            {vendorSlices.slice(0, 5).map((slice) => (
              <button
                type="button"
                onClick={() => setSourceFilter({ label: `${slice.label} source records`, allocationIds: slice.allocationIds })}
                key={slice.key}
              >
                <span><strong>{slice.label}</strong><b>{formatCurrency(slice.valueCents)}</b></span>
                <i aria-hidden="true"><i style={{ width: `${totalSpend ? (slice.valueCents / totalSpend) * 100 : 0}%`, backgroundColor: slice.color }} /></i>
                <small>{slice.allocationIds.length} source allocations</small>
              </button>
            ))}
          </div>
        </article>
        <article className="si-panel si-bar-panel">
          <header className="si-panel-header">
            <div><span className="si-section-kicker">Work mix</span><h2>Planned versus unplanned</h2></div>
          </header>
          <div className="si-ranked-bars">
            {workTypeSlices.map((slice) => (
              <button
                type="button"
                onClick={() => setSourceFilter({ label: `${slice.label} source records`, allocationIds: slice.allocationIds })}
                key={slice.key}
              >
                <span><strong>{slice.label}</strong><b>{formatCurrency(slice.valueCents)}</b></span>
                <i aria-hidden="true"><i style={{ width: `${totalSpend ? (slice.valueCents / totalSpend) * 100 : 0}%`, backgroundColor: slice.color }} /></i>
                <small>{totalSpend ? formatPercent(slice.valueCents / totalSpend) : "0%"} of this selection</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="si-panel si-outlier-panel">
        <header className="si-panel-header">
          <div>
            <span className="si-section-kicker">Cost exceptions</span>
            <h2>Start with the places that look different</h2>
            <p>These flags use visible rules. Select one to narrow the dashboard and inspect its source records.</p>
          </div>
          <span className="si-rule-note">Store flag: at least 25% and $1,000 above the selected peer median</span>
        </header>
        <div className="si-outlier-grid">
          {storeOutliers.map((item) => (
            <button
              type="button"
              onClick={() => {
                setScopeLevel("store");
                setScopeId(item.store.id);
                setDrill({});
                setSourceFilter(null);
              }}
              key={`store-${item.store.id}`}
            >
              <span className="si-outlier-type"><MapPin aria-hidden="true" />Store outlier</span>
              <strong>{storeLabel(item.store)}</strong>
              <b>{formatCurrency(item.valueCents)}</b>
              <small>{peerMedian ? formatPercent(item.valueCents / peerMedian - 1) : "0%"} above selected peer median</small>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
          {categoryOutliers.map((item) => (
            <button type="button" onClick={() => chooseCategory(item.key)} key={`category-${item.key}`}>
              <span className="si-outlier-type"><Layers3 aria-hidden="true" />Category concentration</span>
              <strong>{item.label}</strong>
              <b>{formatCurrency(item.valueCents)}</b>
              <small>{sumRows(baseRows) ? formatPercent(item.valueCents / sumRows(baseRows)) : "0%"} of selected-scope spend</small>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
          {assetOutliers.map((item) => {
            const system = systemById.get(item.asset.storeSystemId);
            const group = equipmentGroupForAsset(item.asset);
            return (
              <button
                type="button"
                onClick={() => {
                  setDrill({ categoryId: system?.categoryId, groupKey: group.key, assetId: item.asset.id });
                  setSourceFilter(null);
                }}
                key={`asset-${item.asset.id}`}
              >
                <span className="si-outlier-type"><Wrench aria-hidden="true" />Equipment outlier</span>
                <strong>{item.asset.name}</strong>
                <b>{formatCurrency(sumRows(item.rows))}</b>
                <small>{storeLabel(platformData.stores.find((store) => store.id === system?.storeId))} · above asset-spend threshold</small>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}
          {!storeOutliers.length && !categoryOutliers.length && !assetOutliers.length && (
            <p className="si-empty-copy">No records cross the displayed outlier rules in this selection.</p>
          )}
        </div>
      </section>

      <section className="si-panel si-hierarchy-panel">
        <header className="si-panel-header si-hierarchy-header">
          <div>
            <span className="si-section-kicker">Interactive cost hierarchy</span>
            <h2>Move from the total to the individual part</h2>
            <p>Nothing has to be classified to the deepest level. Unassigned spend remains in the totals and is shown plainly.</p>
          </div>
          {drill.categoryId && (
            <button className="si-back-button" type="button" onClick={backOneLevel}>
              <ArrowLeft aria-hidden="true" /> Back one level
            </button>
          )}
        </header>
        <nav className="si-breadcrumbs" aria-label="Spending hierarchy">
          <button type="button" onClick={() => setDrill({})}>All categories</button>
          {selectedCategory && <><ChevronRight aria-hidden="true" /><button type="button" onClick={() => setDrill({ categoryId: selectedCategory.id })}>{selectedCategory.name}</button></>}
          {drill.groupKey && <><ChevronRight aria-hidden="true" /><button type="button" onClick={() => setDrill({ categoryId: drill.categoryId, groupKey: drill.groupKey })}>{selectedGroupLabel}</button></>}
          {selectedAsset && <><ChevronRight aria-hidden="true" /><button type="button" onClick={() => setDrill({ categoryId: drill.categoryId, groupKey: drill.groupKey, assetId: selectedAsset.id })}>{selectedAsset.name}</button></>}
          {selectedComponent && <><ChevronRight aria-hidden="true" /><span>{selectedComponent.name}</span></>}
        </nav>

        {!drill.categoryId && (
          <div className="si-hierarchy-grid si-category-grid">
            {categoryHierarchyItems.map((item) => (
              <button type="button" onClick={() => chooseCategory(item.key)} key={item.key}>
                <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.allocationIds.length} allocations</small></span>
                <b>{formatCurrency(item.valueCents)}</b>
                <em>{sumRows(baseRows) ? formatPercent(item.valueCents / sumRows(baseRows)) : "0%"}</em>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        {drill.categoryId && !drill.groupKey && (
          <div className="si-hierarchy-level">
            <div className="si-level-intro"><span>Next level</span><h3>Choose an equipment group</h3><p>Groups use the configured asset classes; customers can use their own names and taxonomy.</p></div>
            <div className="si-hierarchy-grid si-group-grid">
              {hierarchyGroups.map((item) => (
                <button
                  type="button"
                  onClick={() => {
                    setDrill({ categoryId: drill.categoryId, groupKey: item.group.key });
                    setSourceFilter(null);
                  }}
                  key={item.group.key}
                >
                  <span><strong>{item.group.label}</strong><small>{item.assets.length} configured units · {item.rows.length} allocations</small></span>
                  <b>{formatCurrency(sumRows(item.rows))}</b>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {drill.groupKey && !drill.assetId && (
          <div className="si-hierarchy-level">
            <div className="si-level-intro"><span>Next level</span><h3>Choose an individual unit</h3><p>Each unit carries its own service cost, work history, condition, and replacement facts.</p></div>
            {drill.groupKey === "unclassified" ? (
              <div className="si-unclassified-callout">
                <AlertTriangle aria-hidden="true" />
                <span><strong>{formatCurrency(sumRows(contextRows))} is not assigned to an individual unit</strong><small>It remains in company, store, and category totals. Open the source records to classify it later without losing the original history.</small></span>
              </div>
            ) : (
              <div className="si-hierarchy-grid si-asset-grid">
                {assetsForSelectedGroup.map((item) => (
                  <button
                    type="button"
                    onClick={() => {
                      setDrill({ ...drill, assetId: item.asset.id });
                      setSourceFilter(null);
                    }}
                    key={item.asset.id}
                  >
                    <span><strong>{item.asset.name}</strong><small>{storeLabel(item.store)} · {item.asset.assetTag}</small></span>
                    <b>{formatCurrency(sumRows(item.rows))}</b>
                    <em className={`si-state si-state-${item.asset.state}`}>{titleCase(item.asset.state)}</em>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedAsset && !selectedComponent && (
          <div className="si-hierarchy-level">
            <div className="si-asset-summary">
              <div><span>Selected unit</span><h3>{selectedAsset.name}</h3><p>{selectedAsset.manufacturer} {selectedAsset.model} · {selectedAsset.assetTag} · {selectedAsset.location}</p></div>
              <div><span>Spend in view</span><strong>{formatCurrency(sumRows(contextRows))}</strong><small>{contextRows.length} source allocations</small></div>
              <Link href={`/assets/${selectedAsset.id}`}>Open full equipment record <ArrowRight aria-hidden="true" /></Link>
            </div>
            <div className="si-level-intro"><span>Optional level</span><h3>Components inside this unit</h3><p>Select a component when costs are tracked that deeply. Zero-spend components still show what is installed.</p></div>
            <div className="si-hierarchy-grid si-component-grid">
              {componentsForAsset.map((item) => (
                <button
                  type="button"
                  onClick={() => {
                    setDrill({ ...drill, componentId: item.component.id });
                    setSourceFilter(null);
                  }}
                  key={item.component.id}
                >
                  <span><strong>{item.component.name}</strong><small>{item.component.type} · Part {item.component.partNumber}</small></span>
                  <b>{formatCurrency(sumRows(item.rows))}</b>
                  <em>{item.component.criticalSpare ? "Critical spare" : "Installed component"}</em>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
              {!componentsForAsset.length && <p className="si-empty-copy">No component records are configured for this unit. Asset-level reporting remains complete.</p>}
            </div>
          </div>
        )}

        {selectedComponent && (
          <div className="si-component-detail">
            <div><span>Component</span><h3>{selectedComponent.name}</h3><p>{selectedComponent.type} · Part {selectedComponent.partNumber} · Quantity {selectedComponent.quantity}</p></div>
            <dl>
              <div><dt>Spend in view</dt><dd>{formatCurrency(sumRows(contextRows))}</dd></div>
              <div><dt>Recorded unit cost</dt><dd>{formatCurrency(selectedComponent.unitCostCents)}</dd></div>
              <div><dt>Warranty through</dt><dd>{formatDate(selectedComponent.warrantyEndsAt)}</dd></div>
            </dl>
            <Link href={`/components/${selectedComponent.id}`}>Open component record <ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <section className="si-panel si-lifecycle-panel">
        <header className="si-panel-header">
          <div>
            <span className="si-section-kicker">Lifecycle intelligence</span>
            <h2>Know what to watch, plan, or send for capital review</h2>
            <p>Guidance is rule based, not an automatic replacement order. Every flag shows the facts and threshold that produced it.</p>
          </div>
          <span className="si-panel-note">Repair history: trailing 12 months</span>
        </header>
        <div className="si-lifecycle-summary">
          {([
            ["capital_review", "Capital review"],
            ["plan", "Plan replacement"],
            ["watch", "Watch closely"],
          ] as const).map(([decision, label]) => {
            const items = lifecycleItems.filter((item) => item.decision === decision);
            return (
              <div className={`si-lifecycle-count si-lifecycle-${decision}`} key={decision}>
                <strong>{items.length}</strong><span>{label}</span><small>{formatCurrency(items.reduce((sum, item) => sum + item.asset.replacementCostCents, 0))} estimated replacement value</small>
              </div>
            );
          })}
        </div>
        <div className="si-lifecycle-list">
          {lifecycleItems.filter((item) => item.decision !== "no_flag").slice(0, 5).map((item) => (
            <button type="button" onClick={() => chooseLifecycleAsset(item)} key={item.asset.id}>
              <span className={`si-decision-badge si-decision-${item.decision}`}>{item.decisionLabel}</span>
              <span className="si-lifecycle-name"><strong>{item.asset.name}</strong><small>{storeLabel(item.store)} · {item.asset.assetTag}</small></span>
              <span className="si-lifecycle-facts"><b>{formatCurrency(item.analysis.currentReactive)}</b><small>reactive repair cost</small></span>
              <span className="si-lifecycle-facts"><b>{formatCurrency(item.asset.replacementCostCents)}</b><small>replacement estimate</small></span>
              <span className="si-lifecycle-reasons"><strong>{item.reasons[0] ?? "Operating state requires attention"}</strong><small>{item.analysis.reasons[0]?.threshold ?? `${item.analysis.ageYears.toFixed(1)} years old`}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
          {!lifecycleItems.some((item) => item.decision !== "no_flag") && <p className="si-empty-copy">No equipment crosses the lifecycle review rules in this selection.</p>}
        </div>
        {selectedAsset && lifecycleItems[0]?.asset.id === selectedAsset.id && (
          <div className="si-selected-lifecycle">
            <div><span>Why this unit is flagged</span><h3>{lifecycleItems[0].decisionLabel}: {selectedAsset.name}</h3></div>
            <ul>
              {lifecycleItems[0].reasons.map((reason) => <li key={reason}>{reason}</li>)}
              {!lifecycleItems[0].reasons.length && <li>No lifecycle threshold is currently crossed.</li>}
            </ul>
            <p>Repair burden is {formatPercent(lifecycleItems[0].analysis.burden)} of the recorded replacement estimate. Expected life is {selectedAsset.expectedLifeYears} years; current age is {lifecycleItems[0].analysis.ageYears.toFixed(1)} years.</p>
          </div>
        )}
      </section>

      <section className="si-panel si-source-panel" aria-live="polite">
        <header className="si-panel-header">
          <div>
            <span className="si-section-kicker">Source records</span>
            <h2>{sourceFilter?.label ?? `${contextLabel} records`}</h2>
            <p>{effectiveSourceRows.length} allocations total {formatCurrency(sumRows(effectiveSourceRows))}. Scope, period, financial stage, and hierarchy filters stay visible above.</p>
            {sourceFilter?.periodLabel && <small className="si-source-period">Periods shown: {sourceFilter.periodLabel}</small>}
          </div>
          {sourceFilter && <button type="button" className="si-clear-source" onClick={() => setSourceFilter(null)}><RotateCcw aria-hidden="true" />Show all records in this drill-down</button>}
        </header>
        <div className="si-source-table-wrap">
          <table className="si-source-table">
            <thead><tr><th>Date</th><th>Store</th><th>Work and hierarchy</th><th>Vendor</th><th>Invoice</th><th>Net allocation</th><th /></tr></thead>
            <tbody>
              {visibleSourceRows.map((row) => (
                <tr key={row.allocation.id}>
                  <td>{formatDate(row.invoice.issuedAt)}</td>
                  <td><Link href={`/stores/${row.store?.id}`}>{storeLabel(row.store)}</Link></td>
                  <td>
                    {row.workOrder ? <Link href={`/work-orders/${row.workOrder.id}`}><strong>{row.workOrder.number} · {row.workOrder.title}</strong></Link> : <strong>Work record unavailable</strong>}
                    <small>{categoryById.get(row.allocation.categoryId)?.name ?? "Unclassified"} · {row.asset?.name ?? "Not assigned to equipment"}{row.component ? ` · ${row.component.name}` : ""}</small>
                  </td>
                  <td>{row.vendor?.shortName ?? "Internal / unassigned"}</td>
                  <td><strong>{row.invoice.number}</strong><small>Paid</small></td>
                  <td><strong>{formatCurrency(row.netAmountCents)}</strong><small>{titleCase(row.allocation.workClass)}</small></td>
                  <td><Link className="si-source-open" href={`/work-orders/${row.allocation.workOrderId}`}>Open <ArrowRight aria-hidden="true" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleSourceRows.length && <div className="si-empty-source"><ReceiptText aria-hidden="true" /><strong>No paid source records match this exact selection</strong><span>Move back one hierarchy level or choose another period. Zero-spend equipment remains available in the hierarchy.</span></div>}
        </div>
        {sortedSourceRows.length > 8 && (
          <button type="button" className="si-show-more" onClick={() => setShowAllSources((current) => !current)}>
            {showAllSources ? "Show the newest 8 records" : `Show all ${sortedSourceRows.length} source allocations`}
          </button>
        )}
      </section>
    </section>
  );
}
