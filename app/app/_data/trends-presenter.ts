import "server-only";
import { supportedRecordingCoverage } from "@/lib/ops/recording-coverage";

import type {
  MetricViewModel,
  OperatorSession,
  PaginationViewModel,
  TableRowViewModel,
  Tone,
  TrendAnalysisPageViewModel,
  TrendAnalysisView,
  TrendBenchmarkRowViewModel,
  TrendBenchmarkSortId,
  TrendBreakdownId,
  TrendComparisonId,
  TrendDriverSortId,
  TrendMetricId,
  TrendSourceSortId,
  TrendSortDirection,
} from "@/components/ops/data-contract";
import type { Asset, OpsFixture, Store, WorkOrder } from "@/lib/ops/types";
import type { OperatorSearchParameters } from "./operator-presenter";

interface TrendSourceRecord {
  id: string;
  date: string;
  localDate: string;
  periodKey: string;
  displayDate: string;
  value: number;
  storeId: string;
  workOrderId?: string;
  invoiceId?: string;
  visitId?: string;
  pmOccurrenceId?: string;
  categoryKey?: string;
  categoryKeys?: string[];
  assetId?: string;
  assetIds?: string[];
  componentId?: string;
  componentName?: string;
  componentNames?: string[];
  vendorId?: string;
  label: string;
  detail: string;
  displayValue?: string;
  href: string;
  grossAmountMinor?: number;
  workType?: "reactive" | "preventive";
  workTypes?: Array<"reactive" | "preventive">;
  taxonomyLinks?: Array<{
    categoryKey?: string;
    assetId?: string;
    componentId?: string;
    componentName?: string;
    workType?: "reactive" | "preventive";
  }>;
  costKind?: "labor" | "parts" | "travel" | "materials" | "other";
  sourceKind?: "source_record" | "raw_peer_observation" | "calculated_peer_contribution";
  units?: "minor_currency" | "count" | "hours" | "percent";
  currency?: string;
  providerAttribution?: "invoice_vendor" | "visit_vendor" | "historical_assignment" | "response_assignment" | "current_assignment" | "internal" | "ambiguous" | "unattributed";
  providerAttributionLabel?: string;
  cohortId?: string;
  referenceStart?: string;
  referenceEnd?: string;
  rawValue?: number;
  cappedValue?: number;
  weight?: number;
  exposureFactor?: number;
  coverageStatus?: "observed" | "measured_zero" | "unknown";
  sourceIds?: string[];
}

type TrendDetailKind = "current" | "comparison" | "both" | "unclassified" | "benchmark" | "projection" | "month" | "vendor_outstanding";

export interface TrendExportRecord {
  sourceId: string;
  sourceKind: NonNullable<TrendSourceRecord["sourceKind"]>;
  recordLabel: string;
  detail: string;
  sourceDate: string;
  localDate: string;
  periodKey: string;
  timeBasis: string;
  rawValue: number;
  amountMinor?: number;
  currency?: string;
  units: NonNullable<TrendSourceRecord["units"]>;
  storeId: string;
  storeNumber?: string;
  workOrderId?: string;
  invoiceId?: string;
  visitId?: string;
  pmOccurrenceId?: string;
  categoryKeys: string[];
  assetIds: string[];
  componentNames: string[];
  vendorId?: string;
  providerAttribution?: TrendSourceRecord["providerAttribution"];
  providerAttributionLabel?: string;
  cohortId?: string;
  referenceStart?: string;
  referenceEnd?: string;
  uncappedInput?: number;
  cappedInput?: number;
  weight?: number;
  exposureFactor?: number;
  coverageStatus?: TrendSourceRecord["coverageStatus"];
  contributingSourceIds: string[];
  sourcePath: string;
}

export type TrendAnalysisBuildResult = TrendAnalysisPageViewModel & { exportRows?: TrendExportRecord[] };

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const longMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const localDateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const displayDateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const localDateValueCache = new Map<string, string>();
const displayDateValueCache = new Map<string, string>();

function localDateFormatter(timeZone: string) {
  const cached = localDateFormatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });
  localDateFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

function displayDateFormatter(timeZone: string) {
  const cached = displayDateFormatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  displayDateFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

const metricCopy: Record<TrendMetricId, { label: string; definition: string }> = {
  recorded_cost: {
    label: "Recorded work cost",
    definition: "Costs entered on work orders, grouped by service month. Estimates and invoices are not included.",
  },
  linked_invoice: {
    label: "Linked invoice amount",
    definition: "Confirmed invoice amounts linked to work orders, grouped by invoice month.",
  },
  work_orders: {
    label: "Work orders created",
    definition: "Work orders opened during the selected dates, including reactive work and preventive maintenance.",
  },
  service_visits: {
    label: "Recorded service visits",
    definition: "Vendor and technician check-ins recorded during the selected dates. A check-in confirms a visit, not billable labor time.",
  },
  vendor_response: {
    label: "Vendor response time",
    definition: "Median time between sending a work order and receiving the first recorded response among answered requests. Unanswered requests are reported separately by issuance cohort.",
  },
  pm_completion: {
    label: "PM completion",
    definition: "Percent of preventive-maintenance items marked complete among the PM windows that ended during the month.",
  },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sentence(value: string | undefined) {
  if (!value) return "Unclassified";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bHvac\b/g, "HVAC")
    .replace(/\bPm\b/g, "PM")
    .replace(/\bNte\b/g, "NTE");
}

function money(minor: number) {
  return currency.format(minor / 100);
}

function compactMoney(minor: number) {
  return compactCurrency.format(minor / 100);
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  return shortMonthFormatter.format(new Date(`${key}-01T12:00:00.000Z`));
}

function longMonthLabel(key: string) {
  return longMonthFormatter.format(new Date(`${key}-01T12:00:00.000Z`));
}

function localDateKey(value: string, timeZone = "UTC") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const cacheKey = `${timeZone}\u0000${value}`;
  const cached = localDateValueCache.get(cacheKey);
  if (cached) return cached;
  const parts = localDateFormatter(timeZone).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  localDateValueCache.set(cacheKey, result);
  return result;
}

function dateLabel(value: string, timeZone = "UTC") {
  const cacheKey = `${timeZone}\u0000${value}`;
  const cached = displayDateValueCache.get(cacheKey);
  if (cached) return cached;
  const result = displayDateFormatter(timeZone).format(new Date(value));
  displayDateValueCache.set(cacheKey, result);
  return result;
}

function addMonths(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  return value.toISOString().slice(0, 7);
}

function rollingMonths(asOf: string, count: number) {
  const end = monthKey(asOf);
  return Array.from({ length: count }, (_, index) => addMonths(end, index - count + 1));
}

function endOfMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
}

function dayInMonth(key: string, day: number) {
  const finalDay = Number(endOfMonth(key).slice(-2));
  return `${key}-${String(Math.min(day, finalDay)).padStart(2, "0")}`;
}

function href(path: string, values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function paginationModel(
  totalRows: number,
  currentPage: number,
  pageSize: number,
  pageHref: (page: number) => string,
): PaginationViewModel {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalRows);
  const pageNumbers = [...new Set([1, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, totalPages]
    .filter((page) => page >= 1 && page <= totalPages))].sort((left, right) => left - right);
  return {
    summary: totalRows ? `Showing ${start + 1}–${end} of ${totalRows}` : "No records",
    currentPage,
    totalPages,
    pageLinks: pageNumbers.map((page) => ({ page, href: pageHref(page), current: page === currentPage })),
    previousHref: currentPage > 1 ? pageHref(currentPage - 1) : undefined,
    nextHref: currentPage < totalPages ? pageHref(currentPage + 1) : undefined,
  };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function winsorizedDistribution(values: number[]) {
  if (!values.length) return { mean: 0, low: 0, high: 0, capped: [] as number[] };
  const lowerFence = quantile(values, values.length >= 20 ? 0.05 : 0.1);
  const upperFence = quantile(values, values.length >= 20 ? 0.95 : 0.9);
  const capped = values.map((value) => Math.min(Math.max(value, lowerFence), upperFence));
  return {
    mean: capped.reduce((sum, value) => sum + value, 0) / capped.length,
    low: quantile(capped, 0.25),
    high: quantile(capped, 0.75),
    capped,
  };
}

function ratioLabel(current: number, comparison: number) {
  if (!comparison) return current ? "New activity" : "No change";
  const change = ((current - comparison) / comparison) * 100;
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
}

function metricChangeLabel(metric: TrendMetricId, current: number, comparison: number) {
  if (metric === "pm_completion") {
    const points = Math.round(current - comparison);
    return `${points >= 0 ? "+" : ""}${points} pts`;
  }
  if (metric === "vendor_response") {
    const difference = Math.abs(current - comparison);
    if (difference < 0.05) return "No change";
    return `${difference < 10 ? difference.toFixed(1) : Math.round(difference)} hr ${current < comparison ? "faster" : "slower"}`;
  }
  return ratioLabel(current, comparison);
}

function differenceSentence(metric: TrendMetricId, current: number, comparison: number) {
  if (current === comparison) return "No change from the comparison period";
  const direction = current > comparison ? "more" : "less";
  if (metric === "vendor_response") {
    const difference = Math.abs(current - comparison);
    return `${difference < 10 ? difference.toFixed(1) : Math.round(difference)} hours ${current < comparison ? "faster" : "slower"} than before`;
  }
  if (metric === "pm_completion") return `${Math.round(Math.abs(current - comparison))} percentage points ${current > comparison ? "higher" : "lower"} than before`;
  return `${formatMetric(metric, Math.abs(current - comparison))} ${direction} than before`;
}

function evidenceLabel(metric: TrendMetricId, count: number) {
  const nouns = metric === "recorded_cost"
    ? ["work-cost entry", "work-cost entries"]
    : metric === "linked_invoice"
      ? ["confirmed invoice link", "confirmed invoice links"]
      : metric === "work_orders"
        ? ["work order", "work orders"]
        : metric === "service_visits"
          ? ["recorded check-in", "recorded check-ins"]
          : metric === "vendor_response"
            ? ["vendor response", "vendor responses"]
            : ["PM item", "PM items"];
  return `${count} ${count === 1 ? nouns[0] : nouns[1]}`;
}

function additiveContributionLabel(change: number, totalChange: number) {
  if (!change) return "No net impact";
  const share = Math.round(Math.abs((change / totalChange) * 100));
  const movement = totalChange > 0 ? "increase" : "decrease";
  return Math.sign(change) === Math.sign(totalChange)
    ? `Drove ${share}% of the overall ${movement}`
    : `Offset ${share}% of the overall ${movement}`;
}

function monthlyPattern(values: number[]) {
  const active = values.filter((value) => value > 0).length;
  if (active < Math.max(2, Math.ceil(values.length / 2))) return "Sparse";
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  if (!mean) return "No recorded activity";
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  const relativeSpread = Math.sqrt(variance) / mean;
  return relativeSpread > 1 ? "Uneven" : relativeSpread > 0.5 ? "Variable" : "Consistent";
}

function metricUnits(metric: TrendMetricId): NonNullable<TrendSourceRecord["units"]> {
  if (metric === "recorded_cost" || metric === "linked_invoice") return "minor_currency";
  if (metric === "vendor_response") return "hours";
  if (metric === "pm_completion") return "percent";
  return "count";
}

function currentIssuedVendorMap(fixture: OpsFixture, organizationId: string) {
  const assignments = new Map(fixture.assignments
    .filter((row) => row.organizationId === organizationId)
    .map((row) => [row.id, row]));
  const result = new Map<string, string>();
  for (const issuance of fixture.issuances
    .filter((row) => row.organizationId === organizationId)
    .sort((left, right) => left.issuedAt.localeCompare(right.issuedAt))) {
    const assignment = assignments.get(issuance.assignmentId);
    if (assignment?.kind === "outside_vendor" && assignment.vendorId) result.set(issuance.workOrderId, assignment.vendorId);
  }
  return result;
}

function historicalCostProvider(
  indexes: {
    visitsByWorkId: Map<string, OpsFixture["visits"]>;
    assignmentsByWorkId: Map<string, OpsFixture["assignments"]>;
  },
  work: WorkOrder,
  serviceDate: string,
  storeTimeZone: string,
) {
  const matchingVisitVendors = new Set((indexes.visitsByWorkId.get(work.id) ?? [])
    .filter((visit) =>
      visit.organizationId === work.organizationId
      && Boolean(visit.vendorId)
      && [visit.checkedInAt, visit.checkedOutAt].filter(Boolean).some((value) => localDateKey(value!, storeTimeZone) === serviceDate),
    )
    .map((visit) => visit.vendorId!)
  );
  if (matchingVisitVendors.size === 1) {
    return {
      vendorId: [...matchingVisitVendors][0],
      providerAttribution: "visit_vendor" as const,
      providerAttributionLabel: "Historical vendor from the linked service visit",
    };
  }
  if (matchingVisitVendors.size > 1) {
    return {
      providerAttribution: "ambiguous" as const,
      providerAttributionLabel: "Ambiguous historical provider: more than one linked vendor visit occurred on the service date",
    };
  }

  const assignment = (indexes.assignmentsByWorkId.get(work.id) ?? [])
    .filter((row) =>
      row.organizationId === work.organizationId
      && localDateKey(row.assignedAt, storeTimeZone) <= serviceDate,
    )
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt) || right.id.localeCompare(left.id))[0];
  if (assignment?.kind === "outside_vendor" && assignment.vendorId) {
    return {
      vendorId: assignment.vendorId,
      providerAttribution: "historical_assignment" as const,
      providerAttributionLabel: "Historical vendor from the service assignment in effect by the cost date",
    };
  }
  if (assignment?.kind === "internal") {
    return {
      providerAttribution: "internal" as const,
      providerAttributionLabel: "Internal maintenance assignment in effect by the cost date",
    };
  }
  return {
    providerAttribution: "unattributed" as const,
    providerAttributionLabel: "No historical provider relationship can be established for this cost",
  };
}

function daysInMonth(key: string) {
  return Number(endOfMonth(key).slice(-2));
}

function assetMonthExposure(asset: Asset, key: string, storeTimeZone: string, throughDate?: string) {
  const start = `${key}-01`;
  const naturalEnd = endOfMonth(key);
  const end = throughDate && throughDate.slice(0, 7) === key && throughDate < naturalEnd ? throughDate : naturalEnd;
  const installed = asset.installedAt ? localDateKey(asset.installedAt, storeTimeZone) : undefined;
  const retired = asset.retiredAt ? localDateKey(asset.retiredAt, storeTimeZone) : undefined;
  if (installed && installed > end) return { factor: 0, status: "before_installation" as const };
  if (retired && retired < start) return { factor: 0, status: "after_retirement" as const };
  if (!installed) return { factor: undefined, status: "unknown_start" as const };
  const exposedStart = installed > start ? installed : start;
  const exposedEnd = retired && retired < end ? retired : end;
  if (exposedEnd < exposedStart) return { factor: 0, status: "outside_lifecycle" as const };
  const activeDays = Math.floor((Date.parse(`${exposedEnd}T12:00:00.000Z`) - Date.parse(`${exposedStart}T12:00:00.000Z`)) / 86_400_000) + 1;
  return {
    factor: activeDays / daysInMonth(key),
    status: activeDays === daysInMonth(key) ? "full" as const : "partial" as const,
    activeDays,
  };
}

function assetExposedOnLocalDate(asset: Asset, localDate: string, storeTimeZone: string) {
  const installed = asset.installedAt ? localDateKey(asset.installedAt, storeTimeZone) : undefined;
  const retired = asset.retiredAt ? localDateKey(asset.retiredAt, storeTimeZone) : undefined;
  return Boolean(installed && localDate >= installed && (!retired || localDate <= retired));
}

function allowedStores(fixture: OpsFixture, session: OperatorSession) {
  // Location-scoped roles must fail closed when their expected grant is
  // missing. An absent grant can never mean companywide access.
  if (session.role === "store_manager" && !session.storeIds?.length) return [];
  if (session.role === "regional" && !session.regionIds?.length) return [];
  const regionIds = session.regionIds?.length ? new Set(session.regionIds) : undefined;
  const storeIds = session.storeIds?.length ? new Set(session.storeIds) : undefined;
  return fixture.stores.filter((store) =>
    store.organizationId === session.organizationId
    && (!regionIds || (store.regionId ? regionIds.has(store.regionId) : false))
    && (!storeIds || storeIds.has(store.id)),
  );
}

function assetPath(asset: Asset | undefined) {
  if (!asset) return [];
  return asset.groupPath.map((part) => part.trim().toLocaleLowerCase("en-US")).filter(Boolean);
}

function assetMatchesTrendPath(asset: Asset | undefined, selectedPath: string | undefined) {
  if (!selectedPath) return true;
  const requested = selectedPath.split("|").map((part) => part.trim().toLocaleLowerCase("en-US")).filter(Boolean);
  const actual = assetPath(asset);
  if (requested.length <= 1) return requested.length === 0 || actual.includes(requested[0]);
  return requested.every((part, index) => actual[index] === part);
}

function trendPathLabel(value: string) {
  return value.split("|").map((part) => sentence(part)).filter(Boolean).join(" › ");
}

function recordCategoryKeys(row: TrendSourceRecord) {
  return row.categoryKeys?.length ? row.categoryKeys : row.categoryKey ? [row.categoryKey] : [];
}

function recordAssetIds(row: TrendSourceRecord) {
  return row.assetIds?.length ? row.assetIds : row.assetId ? [row.assetId] : [];
}

function recordComponentNames(row: TrendSourceRecord) {
  return row.componentNames?.length ? row.componentNames : row.componentName ? [row.componentName] : [];
}

function recordTaxonomyLinks(row: TrendSourceRecord) {
  if (row.taxonomyLinks) return row.taxonomyLinks;
  if (!row.categoryKey && !row.assetId && !row.componentId && !row.componentName && !row.workType) return [];
  return [{
    categoryKey: row.categoryKey,
    assetId: row.assetId,
    componentId: row.componentId,
    componentName: row.componentName,
    workType: row.workType,
  }];
}

function benchmarkAssetId(row: TrendSourceRecord) {
  const assetIds = recordAssetIds(row);
  return assetIds.length === 1 ? assetIds[0] : undefined;
}

function buildAllRecords(fixture: OpsFixture, session: OperatorSession, metric: TrendMetricId) {
  const stores = allowedStores(fixture, session);
  const storeIds = new Set(stores.map((store) => store.id));
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const workOrders = fixture.workOrders.filter((row) => row.organizationId === session.organizationId && storeIds.has(row.storeId));
  const workById = new Map(workOrders.map((row) => [row.id, row]));
  const assets = fixture.assets.filter((row) => row.organizationId === session.organizationId && storeIds.has(row.storeId));
  const assetById = new Map(assets.map((row) => [row.id, row]));
  const componentById = new Map(fixture.components.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  const vendorByWork = currentIssuedVendorMap(fixture, session.organizationId);
  const visitsById = new Map(fixture.visits.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  const visitsByWorkId = new Map<string, OpsFixture["visits"]>();
  const addVisitForWork = (workOrderId: string, visit: OpsFixture["visits"][number]) => {
    const current = visitsByWorkId.get(workOrderId) ?? [];
    if (!current.some((candidate) => candidate.id === visit.id)) visitsByWorkId.set(workOrderId, [...current, visit]);
  };
  for (const visit of visitsById.values()) if (visit.workOrderId) addVisitForWork(visit.workOrderId, visit);
  for (const link of fixture.siteVisitWorkOrders.filter((row) => row.organizationId === session.organizationId)) {
    const visit = visitsById.get(link.visitId);
    if (visit) addVisitForWork(link.workOrderId, visit);
  }
  const assignmentsByWorkId = new Map<string, OpsFixture["assignments"]>();
  for (const assignment of fixture.assignments.filter((row) => row.organizationId === session.organizationId)) {
    assignmentsByWorkId.set(assignment.workOrderId, [...(assignmentsByWorkId.get(assignment.workOrderId) ?? []), assignment]);
  }
  const historicalProviderIndexes = { visitsByWorkId, assignmentsByWorkId };
  const invoiceById = new Map(fixture.invoiceReferences.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  const preventiveWorkOrderIds = new Set(fixture.pmWorkItems.filter((row) => row.organizationId === session.organizationId).map((row) => row.workOrderId));
  const records: TrendSourceRecord[] = [];

  const timing = (storeId: string, value: string) => {
    const timeZone = storeById.get(storeId)?.timeZone ?? "UTC";
    const localDate = localDateKey(value, timeZone);
    return {
      localDate,
      periodKey: localDate.slice(0, 7),
      displayDate: dateLabel(`${localDate}T12:00:00.000Z`),
    };
  };

  const common = (work: WorkOrder | undefined) => {
    const asset = work?.assetId ? assetById.get(work.assetId) : undefined;
    const categoryKey = work?.categoryKey ?? asset?.categoryKey;
    const componentName = work?.componentId ? componentById.get(work.componentId)?.name : undefined;
    const workType = work ? preventiveWorkOrderIds.has(work.id) ? "preventive" as const : "reactive" as const : undefined;
    return {
      storeId: work?.storeId ?? "",
      workOrderId: work?.id,
      categoryKey,
      assetId: work?.assetId,
      componentId: work?.componentId,
      componentName,
      vendorId: work ? vendorByWork.get(work.id) : undefined,
      providerAttribution: work && vendorByWork.has(work.id) ? "current_assignment" as const : "unattributed" as const,
      providerAttributionLabel: work && vendorByWork.has(work.id)
        ? "Current issued work-order assignment; this is not historical provider spend"
        : "No current issued outside-vendor assignment",
      workType,
      taxonomyLinks: work ? [{ categoryKey, assetId: work.assetId, componentId: work.componentId, componentName, workType }] : [],
    };
  };

  if (metric === "recorded_cost") {
    for (const line of fixture.costLines.filter((row) => row.organizationId === session.organizationId)) {
      const work = workById.get(line.workOrderId);
      if (!work) continue;
      const attribution = historicalCostProvider(historicalProviderIndexes, work, line.serviceDate, storeById.get(work.storeId)?.timeZone ?? "UTC");
      records.push({ id: line.id, sourceKind: "source_record", units: "minor_currency", currency: line.amount.currency, date: line.serviceDate, ...timing(work.storeId, line.serviceDate), value: line.amount.amountMinor, ...common(work), ...attribution, costKind: line.kind, label: work.number, detail: line.description, href: `/app/work-orders/${work.id}?view=cost` });
    }
  } else if (metric === "linked_invoice") {
    for (const allocation of fixture.invoiceAllocations.filter((row) => row.organizationId === session.organizationId && row.confirmedAt)) {
      const work = workById.get(allocation.workOrderId);
      const invoice = invoiceById.get(allocation.invoiceReferenceId);
      if (!work || !invoice || invoice.matchStatus !== "confirmed") continue;
      records.push({ id: allocation.id, sourceKind: "source_record", units: "minor_currency", currency: allocation.amount.currency, date: invoice.invoiceDate, ...timing(work.storeId, invoice.invoiceDate), value: allocation.amount.amountMinor, ...common(work), invoiceId: invoice.id, vendorId: invoice.vendorId, providerAttribution: "invoice_vendor", providerAttributionLabel: "Historical vendor named on the linked invoice", label: invoice.invoiceNumber, detail: `${work.number} · ${work.problem}`, href: `/app/invoices/${invoice.id}`, grossAmountMinor: invoice.grossAmount.amountMinor });
    }
  } else if (metric === "work_orders") {
    for (const work of workOrders) records.push({ id: work.id, sourceKind: "source_record", units: "count", date: work.createdAt, ...timing(work.storeId, work.createdAt), value: 1, ...common(work), label: work.number, detail: work.problem, href: `/app/work-orders/${work.id}` });
  } else if (metric === "service_visits") {
    for (const visit of fixture.visits.filter((row) => row.organizationId === session.organizationId && storeIds.has(row.storeId))) {
      const linkedIds = fixture.siteVisitWorkOrders
        .filter((link) => link.organizationId === session.organizationId && link.visitId === visit.id)
        .sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id))
        .map((link) => link.workOrderId);
      const workIds = [...new Set([...(visit.workOrderId ? [visit.workOrderId] : []), ...linkedIds])];
      const linkedWork = workIds.map((id) => workById.get(id)).filter((work): work is WorkOrder => Boolean(work));
      const work = (visit.workOrderId ? workById.get(visit.workOrderId) : undefined) ?? linkedWork[0];
      const taxonomyLinks = linkedWork.map((item) => {
        const linkedAsset = item.assetId ? assetById.get(item.assetId) : undefined;
        return {
          categoryKey: item.categoryKey ?? linkedAsset?.categoryKey,
          assetId: item.assetId,
          componentId: item.componentId,
          componentName: item.componentId ? componentById.get(item.componentId)?.name : undefined,
          workType: preventiveWorkOrderIds.has(item.id) ? "preventive" as const : "reactive" as const,
        };
      });
      const categoryKeys = [...new Set(taxonomyLinks.map((item) => item.categoryKey).filter((value): value is string => Boolean(value)))];
      const assetIds = [...new Set(taxonomyLinks.map((item) => item.assetId).filter((value): value is string => Boolean(value)))];
      const components = [...new Map(linkedWork.flatMap((item) => {
        if (!item.componentId) return [];
        const name = componentById.get(item.componentId)?.name;
        return name ? [[item.componentId, name] as const] : [];
      })).entries()];
      const workTypes = [...new Set(linkedWork.map((item) => preventiveWorkOrderIds.has(item.id) ? "preventive" as const : "reactive" as const))];
      records.push({
        id: visit.id,
        sourceKind: "source_record",
        units: "count",
        date: visit.checkedInAt,
        ...timing(visit.storeId, visit.checkedInAt),
        value: 1,
        storeId: visit.storeId,
        workOrderId: work?.id,
        visitId: visit.id,
        categoryKey: categoryKeys[0],
        categoryKeys,
        assetId: assetIds[0],
        assetIds,
        componentId: components[0]?.[0],
        componentName: components[0]?.[1],
        componentNames: [...new Set(components.map(([, name]) => name))],
        vendorId: visit.vendorId,
        providerAttribution: visit.vendorId ? "visit_vendor" : visit.providerKind === "internal" ? "internal" : "unattributed",
        providerAttributionLabel: visit.vendorId ? "Historical vendor recorded at check-in" : visit.providerKind === "internal" ? "Internal maintenance recorded at check-in" : "No vendor recorded at check-in",
        workType: workTypes.length === 1 ? workTypes[0] : undefined,
        workTypes,
        taxonomyLinks,
        label: visit.providerName,
        detail: linkedWork.length > 1 ? `${visit.purpose} · ${linkedWork.length} linked work orders` : visit.purpose,
        href: `/app/visits/${visit.id}`,
      });
    }
  } else if (metric === "vendor_response") {
    const issuanceById = new Map(fixture.issuances.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
    const firstResponseByIssuance = new Map<string, typeof fixture.vendorResponses[number]>();
    for (const response of fixture.vendorResponses.filter((row) => row.organizationId === session.organizationId).sort((left, right) => left.respondedAt.localeCompare(right.respondedAt))) {
      if (!firstResponseByIssuance.has(response.issuanceId)) firstResponseByIssuance.set(response.issuanceId, response);
    }
    for (const response of firstResponseByIssuance.values()) {
      const issuance = issuanceById.get(response.issuanceId);
      const work = workById.get(response.workOrderId);
      if (!issuance || !work) continue;
      const hours = Math.max(0, (Date.parse(response.respondedAt) - Date.parse(issuance.issuedAt)) / 3_600_000);
      const assignment = fixture.assignments.find((row) => row.organizationId === session.organizationId && row.id === response.assignmentId);
      records.push({ id: response.id, sourceKind: "source_record", units: "hours", date: response.respondedAt, ...timing(work.storeId, response.respondedAt), value: hours, ...common(work), vendorId: assignment?.vendorId, providerAttribution: assignment?.vendorId ? "response_assignment" : assignment?.kind === "internal" ? "internal" : "unattributed", providerAttributionLabel: assignment?.vendorId ? "Vendor assignment that received this response" : "No outside-vendor assignment is attached to this response", label: work.number, detail: `${sentence(response.response)} · ${response.responderName}`, href: `/app/work-orders/${work.id}?view=service` });
    }
  } else {
    const completedStatuses = new Set(["completed", "completed_early", "completed_on_time", "completed_late"]);
    for (const occurrence of fixture.pmOccurrences.filter((row) => row.organizationId === session.organizationId && storeIds.has(row.storeId) && row.windowEndsAt <= fixture.asOf && row.status !== "waived" && row.status !== "cancelled")) {
      const work = occurrence.workOrderId ? workById.get(occurrence.workOrderId) : undefined;
      const asset = occurrence.assetId ? assetById.get(occurrence.assetId) : undefined;
      const completed = completedStatuses.has(occurrence.status);
      const categoryKey = work?.categoryKey ?? asset?.categoryKey;
      const componentName = work?.componentId ? componentById.get(work.componentId)?.name : undefined;
      records.push({ id: occurrence.id, sourceKind: "source_record", units: "percent", date: occurrence.windowEndsAt, ...timing(occurrence.storeId, occurrence.windowEndsAt), value: completed ? 1 : 0, displayValue: sentence(occurrence.status), storeId: occurrence.storeId, workOrderId: work?.id, pmOccurrenceId: occurrence.id, categoryKey, assetId: occurrence.assetId, componentId: work?.componentId, componentName, vendorId: work ? vendorByWork.get(work.id) : undefined, providerAttribution: work && vendorByWork.has(work.id) ? "current_assignment" : "unattributed", providerAttributionLabel: work && vendorByWork.has(work.id) ? "Current issued work-order assignment; PM completion is not historical vendor spend" : "No current issued outside-vendor assignment", workType: "preventive", taxonomyLinks: [{ categoryKey, assetId: occurrence.assetId, componentId: work?.componentId, componentName, workType: "preventive" }], label: work?.number ?? "PM occurrence", detail: `${sentence(occurrence.status)} · window ended ${dateLabel(occurrence.windowEndsAt, storeById.get(occurrence.storeId)?.timeZone ?? "UTC")}`, href: work ? `/app/work-orders/${work.id}?view=service` : href("/app/pm", { occurrence: occurrence.id, store: occurrence.storeId, view: "all" }) });
    }
  }

  return { records, stores, workById, assetById, componentById };
}

function aggregate(metric: TrendMetricId, records: TrendSourceRecord[]) {
  if (!records.length) return 0;
  if (metric === "vendor_response") return median(records.map((row) => row.value));
  if (metric === "pm_completion") return (records.reduce((sum, row) => sum + row.value, 0) / records.length) * 100;
  return records.reduce((sum, row) => sum + row.value, 0);
}

function additiveMetricHasData(metric: TrendMetricId, records: TrendSourceRecord[]) {
  return metric === "recorded_cost" || metric === "linked_invoice" || metric === "work_orders" || metric === "service_visits" || records.length > 0;
}

function formatMetric(metric: TrendMetricId, value: number, compact = false, hasData = true) {
  if (!hasData && (metric === "vendor_response" || metric === "pm_completion")) return "No data";
  if (metric === "recorded_cost" || metric === "linked_invoice") return compact ? compactMoney(value) : money(value);
  if (metric === "vendor_response") return `${value < 10 ? value.toFixed(1) : Math.round(value)} hr`;
  if (metric === "pm_completion") return `${Math.round(value)}%`;
  return integer.format(Math.round(value));
}

function valueTone(metric: TrendMetricId, current: number, comparison: number): Tone {
  if (!comparison) return "neutral";
  if (metric === "recorded_cost" || metric === "linked_invoice" || metric === "work_orders" || metric === "service_visits") return "neutral";
  const improved = metric === "vendor_response" ? current <= comparison : metric === "pm_completion" ? current >= comparison : true;
  return improved ? "positive" : "warning";
}

function sourceTableRows(metric: TrendMetricId, rows: TrendSourceRecord[], storeById: Map<string, Store>, vendorNameById: Map<string, string>): TableRowViewModel[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    href: row.href,
    cells: [
      { key: "record", value: row.label, secondary: row.detail },
      { key: "store", value: storeById.has(row.storeId) ? `Store ${storeById.get(row.storeId)!.storeNumber}` : "Store unavailable", secondary: storeById.get(row.storeId)?.name },
      { key: "service", value: recordCategoryKeys(row).length ? recordCategoryKeys(row).map((value) => sentence(value)).join(" + ") : "Unclassified", secondary: [row.sourceKind === "calculated_peer_contribution" ? "Calculated contribution" : row.sourceKind === "raw_peer_observation" ? "Raw historical evidence" : undefined, row.costKind ? sentence(row.costKind) : undefined, recordComponentNames(row).length ? recordComponentNames(row).join(" + ") : row.vendorId ? vendorNameById.get(row.vendorId) : row.providerAttributionLabel].filter(Boolean).join(" · ") || undefined },
      { key: "date", value: row.displayDate },
      { key: "value", value: row.displayValue ?? formatMetric(metric, row.value), secondary: metric === "linked_invoice" && row.grossAmountMinor !== undefined ? `${money(row.grossAmountMinor)} invoice gross` : undefined },
    ],
  }));
}

export function buildTrendsModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
  options: { includeExportRows?: boolean } = {},
): TrendAnalysisBuildResult {
  const removedFilters: string[] = [];
  const metric = (first(query.metric) ?? "recorded_cost") as TrendMetricId;
  const metricIds = Object.keys(metricCopy) as TrendMetricId[];
  const allowedMetricIds = metricIds.filter((candidate) =>
    !(session.role === "store_manager" && candidate === "linked_invoice")
    && !(session.role === "finance" && candidate === "pm_completion"),
  );
  const safeMetric: TrendMetricId = allowedMetricIds.includes(metric) ? metric : "recorded_cost";
  if (first(query.metric) && safeMetric !== metric) removedFilters.push("an unavailable measure");
  const periodValue = Number(first(query.period) ?? "6");
  const periodMonths = [3, 6, 12, 24].includes(periodValue) ? periodValue : 12;
  const comparisonExplicit = first(query.compare) !== undefined;
  const comparisonValue = first(query.compare) ?? "previous_period";
  const requestedComparison: TrendComparisonId = comparisonValue === "none" || comparisonValue === "previous_period" ? comparisonValue : "previous_year";
  let comparison: TrendComparisonId = requestedComparison === "previous_year" && periodMonths > 12 ? "previous_period" : requestedComparison;
  if (requestedComparison === "previous_year" && comparison !== requestedComparison) removedFilters.push("the overlapping same-year comparison");
  let selectedRegion = first(query.region);
  let selectedStore = first(query.store);
  let selectedCategory = first(query.category);
  let selectedPath = first(query.path);
  let selectedProfile = first(query.profile);
  let selectedAsset = first(query.asset);
  let selectedComponent = first(query.component);
  let selectedVendor = first(query.vendor);
  const workTypeValue = first(query.workType);
  const selectedWorkType = safeMetric === "pm_completion"
    ? workTypeValue === "preventive" ? "preventive" : undefined
    : workTypeValue === "reactive" || workTypeValue === "preventive" ? workTypeValue : undefined;
  if (workTypeValue && !selectedWorkType) removedFilters.push("the incompatible work-type filter");
  const costKindValue = first(query.costKind);
  const selectedCostKind = safeMetric === "recorded_cost" && (["labor", "parts", "travel", "materials", "other"] as const).includes(costKindValue as NonNullable<TrendSourceRecord["costKind"]>)
    ? costKindValue as NonNullable<TrendSourceRecord["costKind"]>
    : undefined;
  if (costKindValue && !selectedCostKind) removedFilters.push("the cost-type filter, which does not apply to this measure");
  const requestedBreakdown = first(query.breakdown);
  const hasRequestedBreakdown = (["region", "store", "category", "group", "profile", "component", "vendor"] as const).includes(requestedBreakdown as TrendBreakdownId);
  let breakdown: TrendBreakdownId = hasRequestedBreakdown
    ? requestedBreakdown as TrendBreakdownId
    : selectedStore ? "category" : "store";
  const requestedStoreSort = first(query.storeSort);
  const defaultStoreSort: TrendBenchmarkSortId = safeMetric === "vendor_response" || safeMetric === "pm_completion" ? "ratio" : "variance";
  const storeSort: TrendBenchmarkSortId = (["store", "actual", "comparable", "expected", "variance", "ratio", "signal", "coverage"] as const).includes(requestedStoreSort as TrendBenchmarkSortId)
    ? requestedStoreSort as TrendBenchmarkSortId
    : defaultStoreSort;
  const requestedStoreDirection = first(query.storeDirection);
  const storeDirection: TrendSortDirection = requestedStoreDirection === "asc" || requestedStoreDirection === "desc"
    ? requestedStoreDirection
    : safeMetric === "pm_completion" ? "asc" : "desc";
  const requestedDriverSort = first(query.driverSort);
  const driverSort: TrendDriverSortId = (["segment", "current", "comparison", "change", "evidence"] as const).includes(requestedDriverSort as TrendDriverSortId)
    ? requestedDriverSort as TrendDriverSortId
    : "change";
  const requestedDriverDirection = first(query.driverDirection);
  const driverDirection: TrendSortDirection = requestedDriverDirection === "asc" || requestedDriverDirection === "desc"
    ? requestedDriverDirection
    : driverSort === "segment" ? "asc" : "desc";
  const requestedSourceSort = first(query.sourceSort);
  const sourceSort: TrendSourceSortId = (["record", "store", "service", "date", "value"] as const).includes(requestedSourceSort as TrendSourceSortId)
    ? requestedSourceSort as TrendSourceSortId
    : "date";
  const requestedSourceDirection = first(query.sourceDirection);
  const sourceDirection: TrendSortDirection = requestedSourceDirection === "asc" || requestedSourceDirection === "desc"
    ? requestedSourceDirection
    : sourceSort === "record" || sourceSort === "store" || sourceSort === "service" ? "asc" : "desc";
  const detailKindValue = first(query.detailKind);
  const requestedViewValue = first(query.view);
  const detailMonthValue = first(query.detailMonth);
  const hasValidDetailMonthShape = Boolean(detailMonthValue && /^\d{4}-(0[1-9]|1[0-2])$/.test(detailMonthValue));
  const hasRecognizedPeriodDetailKind = detailKindValue === "current" || detailKindValue === "comparison" || detailKindValue === "both" || detailKindValue === "unclassified" || detailKindValue === "projection" || detailKindValue === "vendor_outstanding";
  const detailDriverBreakdownValue = first(query.driverBreakdown);
  let detailDriverBreakdown = (["region", "store", "category", "group", "profile", "component", "vendor"] as const).includes(detailDriverBreakdownValue as TrendBreakdownId)
    ? detailDriverBreakdownValue as TrendBreakdownId
    : undefined;
  let detailDriverValue = first(query.driverValue);
  let benchmarkStore = first(query.benchmarkStore);
  const requestedSourcePage = Number(first(query.sourcePage) ?? "1");
  const requestedDriverPage = Number(first(query.driverPage) ?? "1");
  const requestedStorePage = Number(first(query.storePage) ?? "1");
  const { records: allRecords, stores, workById, assetById, componentById } = buildAllRecords(fixture, session, safeMetric);
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const regionById = new Map(fixture.regions.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  const vendorNameById = new Map(fixture.vendors.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row.name]));
  const profileById = new Map(fixture.replacementProfiles.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  if (selectedVendor && !vendorNameById.has(selectedVendor)) {
    selectedVendor = undefined;
    removedFilters.push("an unavailable vendor");
  }
  if (selectedRegion && !stores.some((store) => store.regionId === selectedRegion)) {
    selectedRegion = undefined;
    removedFilters.push("an out-of-scope region");
  }
  if (selectedStore) {
    const store = storeById.get(selectedStore);
    if (!store || (selectedRegion && store.regionId !== selectedRegion)) {
      selectedStore = undefined;
      removedFilters.push("an out-of-scope store");
    }
  }
  if (selectedAsset) {
    const asset = assetById.get(selectedAsset);
    const assetStore = asset ? storeById.get(asset.storeId) : undefined;
    if (!asset || !assetStore || (selectedRegion && assetStore.regionId !== selectedRegion) || (selectedStore && asset.storeId !== selectedStore)) {
      selectedAsset = undefined;
      selectedComponent = undefined;
      removedFilters.push("equipment outside the effective location scope");
    } else if (!selectedStore) {
      // One equipment record always belongs to one location. Carry that fact
      // into the visible scope instead of analyzing a store-specific record
      // beneath a misleading companywide label.
      selectedStore = asset.storeId;
    }
  }
  const locationStoreIds = new Set(stores
    .filter((store) => (!selectedRegion || store.regionId === selectedRegion) && (!selectedStore || store.id === selectedStore))
    .map((store) => store.id));
  const locationAssets = [...assetById.values()].filter((asset) => locationStoreIds.has(asset.storeId));
  const categoryExists = (value: string) => locationAssets.some((asset) => asset.categoryKey === value)
    || allRecords.some((record) => locationStoreIds.has(record.storeId) && recordCategoryKeys(record).includes(value));
  if (selectedCategory && !categoryExists(selectedCategory)) {
    selectedCategory = undefined;
    selectedPath = undefined;
    selectedProfile = undefined;
    selectedAsset = undefined;
    selectedComponent = undefined;
    removedFilters.push("an unavailable service area and its narrower equipment filters");
  }
  const categoryAssets = locationAssets.filter((asset) => !selectedCategory || asset.categoryKey === selectedCategory);
  if (selectedPath && !categoryAssets.some((asset) => assetMatchesTrendPath(asset, selectedPath))) {
    selectedPath = undefined;
    selectedProfile = undefined;
    selectedAsset = undefined;
    selectedComponent = undefined;
    removedFilters.push("an incompatible equipment group and its narrower filters");
  }
  const pathAssets = categoryAssets.filter((asset) => assetMatchesTrendPath(asset, selectedPath));
  if (selectedProfile && !pathAssets.some((asset) => asset.replacementProfileId === selectedProfile)) {
    selectedProfile = undefined;
    selectedAsset = undefined;
    selectedComponent = undefined;
    removedFilters.push("an incompatible equipment type and its narrower filters");
  }
  const profileAssets = pathAssets.filter((asset) => !selectedProfile || asset.replacementProfileId === selectedProfile);
  if (selectedAsset && !profileAssets.some((asset) => asset.id === selectedAsset)) {
    selectedAsset = undefined;
    selectedComponent = undefined;
    removedFilters.push("an incompatible equipment record and component filter");
  }
  const componentAssetIds = new Set((selectedAsset ? profileAssets.filter((asset) => asset.id === selectedAsset) : profileAssets).map((asset) => asset.id));
  if (selectedComponent && ![...componentById.values()].some((component) => componentAssetIds.has(component.assetId) && component.name.toLocaleLowerCase("en-US") === selectedComponent!.toLocaleLowerCase("en-US"))) {
    selectedComponent = undefined;
    removedFilters.push("an incompatible component filter");
  }
  if (!hasRequestedBreakdown) breakdown = selectedStore ? "category" : "store";
  const componentName = selectedComponent?.toLocaleLowerCase("en-US");

  const maintenanceLinkMatches = (
    row: TrendSourceRecord,
    includeExactAsset = true,
    requiredWorkType = selectedWorkType,
  ) => {
    const hasMaintenanceFilter = Boolean(selectedCategory || selectedPath || selectedProfile || (includeExactAsset && selectedAsset) || componentName || requiredWorkType);
    if (!hasMaintenanceFilter) return true;
    return recordTaxonomyLinks(row).some((link) => {
      const asset = link.assetId ? assetById.get(link.assetId) : undefined;
      if (selectedCategory && link.categoryKey !== selectedCategory) return false;
      if (selectedPath && !assetMatchesTrendPath(asset, selectedPath)) return false;
      if (selectedProfile && asset?.replacementProfileId !== selectedProfile) return false;
      if (includeExactAsset && selectedAsset && link.assetId !== selectedAsset) return false;
      if (componentName && link.componentName?.toLocaleLowerCase("en-US") !== componentName) return false;
      if (requiredWorkType && link.workType !== requiredWorkType) return false;
      return true;
    });
  };

  const scopeRecord = (row: TrendSourceRecord, includeStore = true, includeVendor = true, includeExactAsset = true, includeCostKind = true) => {
    const store = storeById.get(row.storeId);
    if (!store) return false;
    if (selectedRegion && store.regionId !== selectedRegion) return false;
    if (includeStore && selectedStore && row.storeId !== selectedStore) return false;
    if (!maintenanceLinkMatches(row, includeExactAsset)) return false;
    if (includeVendor && selectedVendor && row.vendorId !== selectedVendor) return false;
    if (includeCostKind && selectedCostKind && row.costKind !== selectedCostKind) return false;
    return true;
  };
  const records = allRecords.filter((row) => scopeRecord(row));
  const peerRecords = allRecords.filter((row) => scopeRecord(row, false, true, false));
  const organizationTimeZone = fixture.organizations.find((row) => row.id === session.organizationId)?.timeZone ?? "UTC";
  const organizationLocalDate = localDateKey(fixture.asOf, organizationTimeZone);
  const currentMonths = rollingMonths(organizationLocalDate, periodMonths);
  const currentStart = `${currentMonths[0]}-01`;
  const currentEnd = organizationLocalDate;
  let comparisonFallbackNote: string | undefined;
  if (!comparisonExplicit && periodMonths <= 12 && (selectedCategory === "refrigeration" || selectedCategory === "hvac")) {
    const seasonalMonths = currentMonths.map((key) => addMonths(key, -12));
    const seasonalStart = `${seasonalMonths[0]}-01`;
    const seasonalEnd = dayInMonth(seasonalMonths.at(-1)!, Number(currentEnd.slice(-2)));
    const hasComparableSeasonalHistory = records.some((row) => row.localDate >= seasonalStart && row.localDate <= seasonalEnd && seasonalMonths.includes(row.periodKey));
    comparison = hasComparableSeasonalHistory ? "previous_year" : "previous_period";
    if (!hasComparableSeasonalHistory) comparisonFallbackNote = "Same-period-last-year history is not adequate for this scope, so the initial comparison uses the immediately preceding period.";
  }
  const baselineMonths = comparison === "previous_year"
    ? currentMonths.map((key) => addMonths(key, -12))
    : comparison === "previous_period"
      ? currentMonths.map((key) => addMonths(key, -periodMonths))
      : [];
  const baselineStart = baselineMonths.length ? `${baselineMonths[0]}-01` : undefined;
  const baselineEnd = baselineMonths.length ? dayInMonth(baselineMonths.at(-1)!, Number(currentEnd.slice(-2))) : undefined;
  const currentSet = new Set(currentMonths);
  const baselineSet = new Set(baselineMonths);
  const detailMonth = hasValidDetailMonthShape && detailMonthValue && (currentSet.has(detailMonthValue) || baselineSet.has(detailMonthValue))
    ? detailMonthValue
    : currentMonths.at(-1)!;
  const hasValidDetailMonth = Boolean(hasValidDetailMonthShape && detailMonthValue && (currentSet.has(detailMonthValue) || baselineSet.has(detailMonthValue)));
  if (!detailDriverBreakdown || !detailDriverValue) {
    detailDriverBreakdown = undefined;
    detailDriverValue = undefined;
  }
  const selectedAssetStoreIdForEvidence = selectedAsset ? assetById.get(selectedAsset)?.storeId : undefined;
  const benchmarkStoreRecord = benchmarkStore ? storeById.get(benchmarkStore) : undefined;
  if (
    !benchmarkStoreRecord
    || (selectedRegion && benchmarkStoreRecord.regionId !== selectedRegion)
    || (selectedStore && benchmarkStoreRecord.id !== selectedStore)
    || (selectedAssetStoreIdForEvidence && benchmarkStoreRecord.id !== selectedAssetStoreIdForEvidence)
  ) benchmarkStore = undefined;
  const hasValidBenchmarkFocus = detailKindValue === "benchmark" && Boolean(benchmarkStore);
  const requestedDetailKind: TrendDetailKind = hasRecognizedPeriodDetailKind
    ? detailKindValue
    : hasValidBenchmarkFocus
      ? "benchmark"
      : hasValidDetailMonth
        ? "month"
        : "current";
  const detailKind: TrendDetailKind = comparison === "none" && (requestedDetailKind === "comparison" || requestedDetailKind === "both")
    ? "current"
    : requestedDetailKind;
  const hasExplicitEvidenceFocus = Boolean(
    hasRecognizedPeriodDetailKind
    || hasValidDetailMonth
    || (detailDriverBreakdown && detailDriverValue)
    || hasValidBenchmarkFocus,
  );
  const activeView: TrendAnalysisView = (["overview", "stores", "drivers", "vendors", "planning", "records"] as const).includes(requestedViewValue as TrendAnalysisView)
    ? requestedViewValue as TrendAnalysisView
    : hasExplicitEvidenceFocus
      ? "records"
      : "overview";
  const currentRecords = records.filter((row) => currentSet.has(row.periodKey) && row.localDate >= currentStart && row.localDate <= currentEnd);
  const baselineRecords = records.filter((row) => baselineStart && baselineEnd && baselineSet.has(row.periodKey) && row.localDate >= baselineStart && row.localDate <= baselineEnd);
  const currentValue = aggregate(safeMetric, currentRecords);
  const baselineValue = aggregate(safeMetric, baselineRecords);
  const preventiveWorkOrderIds = new Set(fixture.pmWorkItems.filter((row) => row.organizationId === session.organizationId).map((row) => row.workOrderId));
  const assignmentById = new Map(fixture.assignments.filter((row) => row.organizationId === session.organizationId).map((row) => [row.id, row]));
  const latestIssuanceByAssignment = new Map<string, OpsFixture["issuances"][number]>();
  const firstIssuedAtByAssignment = new Map<string, string>();
  for (const issuance of fixture.issuances.filter((row) => row.organizationId === session.organizationId).sort((left, right) => left.issuedAt.localeCompare(right.issuedAt))) {
    firstIssuedAtByAssignment.set(issuance.assignmentId, firstIssuedAtByAssignment.get(issuance.assignmentId) ?? issuance.issuedAt);
    const latest = latestIssuanceByAssignment.get(issuance.assignmentId);
    if (!latest || issuance.revision > latest.revision || (issuance.revision === latest.revision && issuance.issuedAt > latest.issuedAt)) latestIssuanceByAssignment.set(issuance.assignmentId, issuance);
  }
  const firstResponseByAssignment = new Map<string, OpsFixture["vendorResponses"][number]>();
  for (const response of fixture.vendorResponses.filter((row) => row.organizationId === session.organizationId).sort((left, right) => left.respondedAt.localeCompare(right.respondedAt))) {
    if (!firstResponseByAssignment.has(response.assignmentId)) firstResponseByAssignment.set(response.assignmentId, response);
  }
  const issuanceCohort = [...latestIssuanceByAssignment.entries()].flatMap(([assignmentId, latestIssuance]) => {
    const assignment = assignmentById.get(assignmentId);
    const work = workById.get(latestIssuance.workOrderId);
    if (!assignment || !work || assignment.kind !== "outside_vendor" || !assignment.vendorId) return [];
    const asset = work.assetId ? assetById.get(work.assetId) : undefined;
    const componentName = work.componentId ? componentById.get(work.componentId)?.name : undefined;
    const workType = preventiveWorkOrderIds.has(work.id) ? "preventive" as const : "reactive" as const;
    const scopeProbe: TrendSourceRecord = {
      id: latestIssuance.id,
      date: firstIssuedAtByAssignment.get(assignmentId) ?? latestIssuance.issuedAt,
      localDate: "",
      periodKey: "",
      displayDate: "",
      value: 0,
      storeId: work.storeId,
      workOrderId: work.id,
      categoryKey: work.categoryKey ?? asset?.categoryKey,
      assetId: work.assetId,
      componentId: work.componentId,
      componentName,
      vendorId: assignment.vendorId,
      workType,
      taxonomyLinks: [{ categoryKey: work.categoryKey ?? asset?.categoryKey, assetId: work.assetId, componentId: work.componentId, componentName, workType }],
      label: work.number,
      detail: work.problem,
      href: `/app/work-orders/${work.id}?view=service`,
    };
    if (!scopeRecord(scopeProbe, true, true, true, false)) return [];
    const storeTimeZone = storeById.get(work.storeId)?.timeZone ?? organizationTimeZone;
    const issuedAt = firstIssuedAtByAssignment.get(assignmentId) ?? latestIssuance.issuedAt;
    const localIssuedDate = localDateKey(issuedAt, storeTimeZone);
    return [{ assignment, work, scopeProbe, latestIssuance, issuedAt, localIssuedDate, response: firstResponseByAssignment.get(assignmentId) }];
  });
  const currentIssuanceCohort = issuanceCohort.filter((row) => row.localIssuedDate >= currentStart && row.localIssuedDate <= currentEnd);
  const answeredIssuances = currentIssuanceCohort.filter((row) => Boolean(row.response));
  const unansweredIssuances = currentIssuanceCohort.filter((row) => !row.response && !["cancelled", "superseded"].includes(row.assignment.status));
  const closedWithoutResponse = currentIssuanceCohort.filter((row) => !row.response && ["cancelled", "superseded"].includes(row.assignment.status));
  const responseDueHours = 24;
  const asOfMillis = Date.parse(fixture.asOf);
  const overdueUnanswered = unansweredIssuances.filter((row) => asOfMillis - Date.parse(row.issuedAt) > responseDueHours * 3_600_000);
  const oldestOutstandingHours = unansweredIssuances.length
    ? Math.max(...unansweredIssuances.map((row) => Math.max(0, (asOfMillis - Date.parse(row.issuedAt)) / 3_600_000)))
    : 0;
  const responseMixCount = (kind: OpsFixture["vendorResponses"][number]["response"]) => answeredIssuances.filter((row) => row.response?.response === kind).length;
  const vendorAccountability: TrendAnalysisPageViewModel["vendorAccountability"] = {
    title: "Vendor response follow-through",
    description: "Response speed describes answered requests. Coverage uses the first-issuance cohort; outstanding age includes only assignments still awaiting a response. A fast decline counts as a response but not as accepted service.",
    cohortLabel: `${currentIssuanceCohort.length} effective outside-vendor authorizations first issued ${dateLabel(currentStart)}–${dateLabel(currentEnd)}`,
    responseCoverageLabel: currentIssuanceCohort.length ? `${Math.round((answeredIssuances.length / currentIssuanceCohort.length) * 100)}% · ${answeredIssuances.length} of ${currentIssuanceCohort.length} answered` : "No issued requests in this cohort",
    respondedCount: answeredIssuances.length,
    awaitingCount: unansweredIssuances.length,
    overdueCount: overdueUnanswered.length,
    oldestOutstandingLabel: unansweredIssuances.length ? oldestOutstandingHours < 48 ? `${Math.round(oldestOutstandingHours)} hours` : `${Math.round(oldestOutstandingHours / 24)} days` : "None outstanding",
    responseMix: [
      { label: "Accepted", value: String(responseMixCount("accepted")), description: "Vendor accepted the authorization." },
      { label: "Declined", value: String(responseMixCount("declined")), description: "A response was received, but service was not accepted." },
      { label: "Proposed a date", value: String(responseMixCount("proposed_date")), description: "Scheduling was proposed and still needs its own confirmation state." },
      { label: "Asked a question", value: String(responseMixCount("question")), description: "The vendor responded with an information request." },
      { label: "Closed without response", value: String(closedWithoutResponse.length), description: "The issued assignment was cancelled or superseded without a recorded vendor response; it remains in historical coverage but is not currently outstanding." },
    ],
    outstandingLink: {
      href: "",
      label: "Open exact outstanding assignments",
    },
    methodology: `One denominator row per outside-vendor assignment, using its first issuance date. Later issuance revisions do not add requests. Cancelled or superseded assignments remain in historical coverage, but are removed from the currently outstanding count. Overdue means an effective assignment has remained unanswered for more than ${responseDueHours} hours. Median response time remains grouped by response date and includes accepted, declined, proposed-date, and question responses.`,
  };
  const selectedPeriodName = `Selected ${periodMonths} months`;
  const compareLabel = comparison === "previous_year"
    ? `Same ${periodMonths} months last year`
    : comparison === "previous_period"
      ? `Earlier ${periodMonths} months`
      : "No comparison";
  const evidenceQuery = {
    detailKind: hasExplicitEvidenceFocus ? detailKind : undefined,
    detailMonth: hasExplicitEvidenceFocus && detailKind === "month" ? detailMonth : undefined,
    driverBreakdown: hasExplicitEvidenceFocus ? detailDriverBreakdown : undefined,
    driverValue: hasExplicitEvidenceFocus ? detailDriverValue : undefined,
    benchmarkStore: hasExplicitEvidenceFocus && detailKind === "benchmark" ? benchmarkStore : undefined,
  };
  const trendHref = (
    values: Record<string, string | undefined>,
    options: { preserveEvidence?: boolean } = {},
  ) => href("/app/trends", {
    metric: safeMetric,
    period: String(periodMonths),
    compare: comparison,
    breakdown,
    region: selectedRegion,
    store: selectedStore,
    category: selectedCategory,
    path: selectedPath,
    profile: selectedProfile,
    asset: selectedAsset,
    component: selectedComponent,
    vendor: selectedVendor,
    workType: selectedWorkType,
    costKind: selectedCostKind,
    storeSort,
    storeDirection,
    driverSort,
    driverDirection,
    sourceSort,
    sourceDirection,
    view: activeView,
    ...(options.preserveEvidence ? evidenceQuery : {}),
    ...values,
  });
  vendorAccountability.outstandingLink.href = `${trendHref({ view: "records", detailKind: "vendor_outstanding", detailMonth: undefined, driverBreakdown: undefined, driverValue: undefined, benchmarkStore: undefined, sourcePage: undefined })}#source-records`;
  const outstandingRecords: TrendSourceRecord[] = unansweredIssuances.map((row) => ({
    ...row.scopeProbe, id: row.assignment.id, sourceKind: "source_record", units: "count", value: 1,
    date: row.issuedAt, localDate: row.localIssuedDate, periodKey: row.localIssuedDate.slice(0, 7), displayDate: dateLabel(row.localIssuedDate),
    displayValue: "Awaiting response", sourceIds: [row.assignment.id, row.latestIssuance.id],
    detail: `${row.work.problem} · Unanswered effective assignment · First issued ${row.localIssuedDate}`,
    providerAttribution: "response_assignment", providerAttributionLabel: "Vendor assignment awaiting its first response",
  }));


  const series = currentMonths.map((key, index) => {
    const currentMonthRecords = currentRecords.filter((row) => row.periodKey === key);
    const current = aggregate(safeMetric, currentMonthRecords);
    const comparisonKey = baselineMonths[index];
    const comparisonMonthRecords = comparisonKey ? baselineRecords.filter((row) => row.periodKey === comparisonKey) : [];
    const previous = comparisonKey ? aggregate(safeMetric, comparisonMonthRecords) : undefined;
    const currentHasData = additiveMetricHasData(safeMetric, currentMonthRecords);
    const comparisonHasData = comparisonKey ? additiveMetricHasData(safeMetric, comparisonMonthRecords) : undefined;
    return {
      id: key,
      label: monthLabel(key),
      currentMonthLabel: longMonthLabel(key),
      currentValue: current,
      currentFormattedValue: formatMetric(safeMetric, current, true, currentHasData),
      currentSourceCount: currentMonthRecords.length,
      currentHasData,
      isPartialPeriod: key === currentMonths.at(-1) && currentEnd !== endOfMonth(key),
      comparisonMonthLabel: comparisonKey ? longMonthLabel(comparisonKey) : undefined,
      comparisonValue: previous,
      comparisonFormattedValue: previous === undefined ? undefined : formatMetric(safeMetric, previous, true, comparisonHasData),
      comparisonSourceCount: comparisonKey ? comparisonMonthRecords.length : undefined,
      comparisonHasData,
      changeLabel: previous === undefined || !currentHasData || !comparisonHasData ? undefined : metricChangeLabel(safeMetric, current, previous),
      currentLink: { href: `${trendHref({ view: "records", detailKind: "month", detailMonth: key })}#source-records`, label: `Open exact ${monthLabel(key)} records` },
      comparisonLink: comparisonKey ? { href: `${trendHref({ view: "records", detailKind: "month", detailMonth: comparisonKey })}#source-records`, label: `Open exact ${monthLabel(comparisonKey)} records` } : undefined,
    };
  });

  const classificationLevel = selectedAsset ? "component" : selectedCategory ? "equipment" : "service area";
  const hasRequiredClassification = (row: TrendSourceRecord) => {
    const links = recordTaxonomyLinks(row);
    if (selectedAsset) return links.some((link) => link.assetId === selectedAsset && Boolean(link.componentName));
    if (selectedCategory) return links.some((link) => link.categoryKey === selectedCategory && Boolean(link.assetId));
    return links.some((link) => Boolean(link.categoryKey));
  };
  const classified = currentRecords.filter(hasRequiredClassification);
  const coverageHasData = currentRecords.length > 0;
  const coverage = currentRecords.length ? Math.round((classified.length / currentRecords.length) * 100) : 0;
  const currentHasData = additiveMetricHasData(safeMetric, currentRecords);
  const baselineHasData = comparison !== "none" && additiveMetricHasData(safeMetric, baselineRecords);
  const currentEvidence = safeMetric === "pm_completion"
    ? `${currentRecords.reduce((sum, row) => sum + row.value, 0)} of ${currentRecords.length} eligible windows completed`
    : evidenceLabel(safeMetric, currentRecords.length);
  const comparisonEvidence = safeMetric === "pm_completion"
    ? `${baselineRecords.reduce((sum, row) => sum + row.value, 0)} of ${baselineRecords.length} eligible windows completed`
    : evidenceLabel(safeMetric, baselineRecords.length);
  const enableComparisonLink = {
    href: trendHref({ compare: "previous_period", detailKind: undefined, detailMonth: undefined, driverBreakdown: undefined, driverValue: undefined, benchmarkStore: undefined, sourcePage: undefined }),
    label: `Compare with the earlier ${periodMonths} months`,
  };
  const summary: MetricViewModel[] = [
    { id: "current", label: "Selected dates", value: formatMetric(safeMetric, currentValue, false, currentHasData), supportingText: `${dateLabel(currentStart)}–${dateLabel(currentEnd)} · ${currentEvidence}`, tone: "info", link: { href: `${trendHref({ view: "records", detailKind: "current", detailMonth: undefined })}#source-records`, label: "Open all records for the selected dates" } },
    { id: "comparison", label: comparison === "none" ? "Comparison" : "Compared with", value: comparison === "none" ? "Off" : formatMetric(safeMetric, baselineValue, false, baselineHasData), supportingText: comparison === "none" ? "Choose dates to compare" : !baselineHasData ? `${compareLabel} · no recorded data` : `${baselineStart && baselineEnd ? `${dateLabel(baselineStart)}–${dateLabel(baselineEnd)}` : compareLabel} · ${comparisonEvidence}`, tone: comparison === "none" || !baselineHasData ? "neutral" : valueTone(safeMetric, currentValue, baselineValue), link: comparison === "none" ? enableComparisonLink : { href: `${trendHref({ view: "records", detailKind: "comparison", detailMonth: undefined })}#source-records`, label: "Open all comparison-period records" } },
    { id: "change", label: "Change", value: comparison === "none" ? "—" : !currentHasData || !baselineHasData ? "Not available" : metricChangeLabel(safeMetric, currentValue, baselineValue), supportingText: comparison === "none" ? "Comparison is turned off" : !currentHasData || !baselineHasData ? "Both date ranges need recorded data" : differenceSentence(safeMetric, currentValue, baselineValue), tone: comparison === "none" || !currentHasData || !baselineHasData ? "neutral" : valueTone(safeMetric, currentValue, baselineValue), link: comparison === "none" ? enableComparisonLink : { href: `${trendHref({ view: "records", detailKind: "both", detailMonth: undefined })}#source-records`, label: "Open records from both date ranges" } },
    { id: "coverage", label: `${sentence(classificationLevel)} detail`, value: coverageHasData ? `${coverage}%` : "No data", supportingText: coverageHasData ? `${classified.length} of ${currentRecords.length} records include ${classificationLevel} information` : "No records are available for these filters and dates", tone: !coverageHasData ? "neutral" : coverage >= 85 ? "positive" : coverage >= 60 ? "warning" : "critical", link: coverageHasData ? { href: `${trendHref({ view: "records", detailKind: "unclassified", detailMonth: undefined })}#source-records`, label: "Review records missing classification" } : { href: `${trendHref({ view: "records", detailKind: "current", detailMonth: undefined })}#source-records`, label: "Open the selected-date record set" } },
  ];

  const additive = (["recorded_cost", "linked_invoice", "work_orders", "service_visits"] as TrendMetricId[]).includes(safeMetric);
  const moneyMetric = safeMetric === "recorded_cost" || safeMetric === "linked_invoice";
  const projectionNoun = safeMetric === "work_orders"
    ? "work-order volume"
    : safeMetric === "service_visits"
      ? "service-visit volume"
      : safeMetric === "linked_invoice"
        ? "linked invoice amount"
        : "recorded work cost";
  const currentMonthIsComplete = currentEnd === endOfMonth(monthKey(currentEnd));
  const lastCompleteMonth = currentMonthIsComplete ? monthKey(currentEnd) : addMonths(monthKey(currentEnd), -1);
  // Planning history is intentionally independent from the chart window. A
  // three-month view can still use a supported twelve-month complete-history
  // scenario without claiming those extra months are part of the chart.
  const projectionMonthCount = 12;
  const projectionMonths = rollingMonths(`${lastCompleteMonth}-01`, projectionMonthCount);
  const projectionRecords = records.filter((row) => projectionMonths.includes(row.periodKey) && row.localDate <= endOfMonth(lastCompleteMonth));
  const monthlyValues = projectionMonths.map((key) => aggregate(safeMetric, projectionRecords.filter((row) => row.periodKey === key)));
  const projectionValue = aggregate(safeMetric, projectionRecords);
  const annualized = additive ? (projectionValue / Math.max(projectionMonthCount, 1)) * 12 : currentValue;
  const activeMonths = monthlyValues.filter((value) => value > 0).length;
  const enoughProjectionHistory = additive && projectionMonthCount >= 6 && activeMonths >= 3 && projectionRecords.length >= 6;
  const projectionBySource = new Map<string, number>();
  for (const row of projectionRecords) {
    const sourceId = row.workOrderId ?? row.invoiceId ?? row.visitId ?? row.id;
    projectionBySource.set(sourceId, (projectionBySource.get(sourceId) ?? 0) + row.value);
  }
  const largestProjectionSource = [...projectionBySource.values()].sort((left, right) => right - left)[0] ?? 0;
  const largestProjectionShare = projectionValue > 0 ? Math.round((largestProjectionSource / projectionValue) * 100) : 0;
  const outlook = additive
    ? enoughProjectionHistory
      ? {
          kind: "projection" as const,
          eyebrow: "At the recent pace",
          label: `12-month ${projectionNoun} scenario`,
          value: formatMetric(safeMetric, annualized),
          description: `Annualizes an average of ${formatMetric(safeMetric, projectionValue / projectionMonthCount)} per month across ${projectionMonthCount} complete months; it does not alter recorded totals.`,
          facts: [
            { label: "History used", value: `${monthLabel(projectionMonths[0])}–${monthLabel(projectionMonths.at(-1)!)}` },
            { label: "Coverage", value: `${activeMonths} of ${projectionMonthCount} months with activity` },
            { label: "Pattern", value: monthlyPattern(monthlyValues) },
            { label: "Largest-job sensitivity", value: largestProjectionShare ? `${largestProjectionShare}% of the history` : "No concentrated source" },
          ],
          caution: safeMetric === "linked_invoice"
            ? "Planning estimate only. It assumes the recent pace of confirmed invoice links continues; it is not a budget, cash forecast, or payment forecast."
            : moneyMetric
              ? "Planning scenario only. It assumes the recent mix, recording coverage, and large-job influence continue; it is not a budget, forecast, savings claim, or equipment-failure prediction."
              : "Planning scenario only. It assumes the recent mix and recording coverage continue; it is not a workload commitment or staffing forecast.",
          evidenceLink: {
            href: `${trendHref({ view: "records", detailKind: "projection", detailMonth: undefined, driverBreakdown: undefined, driverValue: undefined, benchmarkStore: undefined, sourcePage: undefined })}#source-records`,
            label: "Open the complete-month records used in this estimate",
          },
        }
      : {
          kind: "insufficient_history" as const,
          eyebrow: "At the recent pace",
          label: "Not enough history for a 12-month scenario",
          value: "Not available",
          description: "The estimate appears after at least six complete months, activity in three months, and six records.",
          facts: [
            { label: "Months with activity", value: `${activeMonths} of ${projectionMonthCount}` },
            { label: "Records available", value: integer.format(projectionRecords.length) },
          ],
          caution: "The platform will not create a pace scenario from too little observed history.",
        }
    : {
        kind: "measured_baseline" as const,
        eyebrow: "Current result",
        label: safeMetric === "vendor_response" ? "Typical vendor response time" : "PM completion rate",
        value: formatMetric(safeMetric, currentValue, false, currentHasData),
        description: !currentHasData
          ? safeMetric === "vendor_response" ? "No vendor responses were recorded for these filters and dates." : "No PM windows ended during these dates."
          : safeMetric === "vendor_response"
            ? "This is the median elapsed time for requests whose first response was recorded during the selected dates; unanswered requests are shown separately."
            : "This is the completion rate for PM windows that ended during the selected dates.",
        facts: [
          { label: "Versus previous", value: comparison === "none" ? "Not compared" : !currentHasData || !baselineHasData ? "Not enough data" : metricChangeLabel(safeMetric, currentValue, baselineValue) },
          { label: "Records included", value: safeMetric === "pm_completion" ? currentEvidence : evidenceLabel(safeMetric, currentRecords.length) },
          ...(safeMetric === "vendor_response" ? [
            { label: "Issuance-cohort coverage", value: vendorAccountability.responseCoverageLabel },
            { label: "Awaiting response", value: String(vendorAccountability.awaitingCount) },
            { label: "Overdue unanswered", value: String(vendorAccountability.overdueCount) },
          ] : []),
        ],
        caution: "This is a measured result, not a forecast.",
      };

  const currentPeerRecords = peerRecords.filter((row) => currentSet.has(row.periodKey) && row.localDate >= currentStart && row.localDate <= currentEnd);
  const benchmarkPeerStores = stores.filter((store) => !selectedRegion || store.regionId === selectedRegion);
  const benchmarkPeerStoreIds = new Set(benchmarkPeerStores.map((store) => store.id));
  const selectedAssetStoreId = selectedAsset ? assetById.get(selectedAsset)?.storeId : undefined;
  const storesForBenchmark = benchmarkPeerStores.filter((store) => (!selectedStore || store.id === selectedStore) && (!selectedAssetStoreId || store.id === selectedAssetStoreId));
  const benchmarkTargetRecords = selectedAsset
    ? currentPeerRecords.filter((row) => maintenanceLinkMatches(row, true))
    : currentPeerRecords;
  const cohortByAsset = new Map<string, string>();
  const benchmarkAssets = fixture.assets.filter((asset) =>
    asset.organizationId === session.organizationId
    && benchmarkPeerStoreIds.has(asset.storeId)
    && (!selectedCategory || asset.categoryKey === selectedCategory)
    && assetMatchesTrendPath(asset, selectedPath)
    && (!selectedProfile || asset.replacementProfileId === selectedProfile)
    && (!componentName || [...componentById.values()].some((component) => component.assetId === asset.id && component.name.toLocaleLowerCase("en-US") === componentName))
  );
  const benchmarkAssetsByStore = new Map<string, Asset[]>();
  for (const asset of benchmarkAssets) {
    const cohort = asset.replacementProfileId ?? `${asset.categoryKey}|${asset.groupPath.join("|") || "general"}`;
    cohortByAsset.set(asset.id, cohort);
    benchmarkAssetsByStore.set(asset.storeId, [...(benchmarkAssetsByStore.get(asset.storeId) ?? []), asset]);
  }

  // Store comparisons use a stable 24-month peer reference window that ends
  // before the current month. Changing the visible 3/6/12-month period never
  // changes which history establishes the underlying equipment rates.
  const referenceMonths = Array.from({ length: 24 }, (_, index) => addMonths(monthKey(organizationLocalDate), index - 24));
  const referenceMonthSet = new Set(referenceMonths);
  const referenceEnd = endOfMonth(referenceMonths.at(-1)!);
  const referencePeerRecords = peerRecords.filter((row) => referenceMonthSet.has(row.periodKey) && row.localDate <= referenceEnd);
  const referenceRecordsByAssetMonth = new Map<string, TrendSourceRecord[]>();
  for (const row of referencePeerRecords) {
    const assetId = benchmarkAssetId(row);
    if (!assetId) continue;
    const key = `${assetId}|${row.periodKey}`;
    referenceRecordsByAssetMonth.set(key, [...(referenceRecordsByAssetMonth.get(key) ?? []), row]);
  }
  interface CohortMonthObservation {
    assetId: string;
    storeId: string;
    month: string;
    calendarMonth: string;
    value: number;
    exposureFactor: number;
    coverageStatus: "observed" | "measured_zero";
    records: TrendSourceRecord[];
  }
  const recordingCoverage = supportedRecordingCoverage(fixture, session.organizationId, safeMetric, allRecords);
  const monthIsCovered = (asset: Asset, month: string, through = endOfMonth(month)) => recordingCoverage.some((coverage) =>
    coverage.storeId === asset.storeId && coverage.startsOn <= `${month}-01` && coverage.endsOn >= through);
  const observationsByCohortAndCalendarMonth = new Map<string, CohortMonthObservation[]>();
  for (const asset of benchmarkAssets) {
    const cohort = cohortByAsset.get(asset.id)!;
    const storeTimeZone = storeById.get(asset.storeId)?.timeZone ?? organizationTimeZone;
    for (const month of referenceMonths) {
      const sourceRows = referenceRecordsByAssetMonth.get(`${asset.id}|${month}`) ?? [];
      const exposure = assetMonthExposure(asset, month, storeTimeZone);
      if (exposure.factor === 0) continue;
      // Neither equipment exposure nor an isolated transaction proves complete recording.
      if (exposure.factor === undefined || !monthIsCovered(asset, month)) continue;
      const exposureFactor = exposure.factor;
      const rawValue = aggregate(safeMetric, sourceRows);
      const value = exposureFactor > 0 ? rawValue / exposureFactor : rawValue;
      const key = `${cohort}|${month.slice(5)}`;
      const observation = {
        assetId: asset.id,
        storeId: asset.storeId,
        month,
        calendarMonth: month.slice(5),
        value,
        exposureFactor,
        coverageStatus: sourceRows.length ? "observed" as const : "measured_zero" as const,
        records: sourceRows,
      };
      observationsByCohortAndCalendarMonth.set(key, [...(observationsByCohortAndCalendarMonth.get(key) ?? []), observation]);
    }
  }
  const observedReferenceMonthCount = new Set([...observationsByCohortAndCalendarMonth.values()].flatMap((rows) => rows.map((row) => row.month))).size;
  interface PeerMonthSummary {
    peerRates: Array<{ storeId: string; value: number }>;
    distribution: ReturnType<typeof winsorizedDistribution>;
    positivePeerStores: Set<string>;
    positiveReferenceMonths: Set<string>;
    positivePeerStoreMonths: Set<string>;
    observations: CohortMonthObservation[];
  }
  const peerMonthSummaryCache = new Map<string, PeerMonthSummary>();
  const peerMonthSummary = (cohort: string, calendarMonth: string, excludedStoreId: string) => {
    const cacheKey = `${cohort}|${calendarMonth}|${excludedStoreId}`;
    const cached = peerMonthSummaryCache.get(cacheKey);
    if (cached) return cached;
    const peerValuesByStore = new Map<string, number[]>();
    const positivePeerStores = new Set<string>();
    const positiveReferenceMonths = new Set<string>();
    const positivePeerStoreMonths = new Set<string>();
    const observations = (observationsByCohortAndCalendarMonth.get(`${cohort}|${calendarMonth}`) ?? []).filter((observation) => observation.storeId !== excludedStoreId);
    for (const observation of observations) {
      if (observation.storeId === excludedStoreId) continue;
      peerValuesByStore.set(observation.storeId, [...(peerValuesByStore.get(observation.storeId) ?? []), observation.value]);
      positivePeerStores.add(observation.storeId);
      positiveReferenceMonths.add(observation.month);
      positivePeerStoreMonths.add(`${observation.storeId}|${observation.month}`);
    }
    const peerRates = [...peerValuesByStore.entries()].map(([storeId, values]) => ({
      storeId,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
    const summary = {
      peerRates,
      distribution: winsorizedDistribution(peerRates.map((entry) => entry.value)),
      positivePeerStores,
      positiveReferenceMonths,
      positivePeerStoreMonths,
      observations,
    };
    peerMonthSummaryCache.set(cacheKey, summary);
    return summary;
  };
  const selectedAssetCohort = selectedAsset ? cohortByAsset.get(selectedAsset) : undefined;
  const selectedAssetPeerIds = new Set(selectedAssetCohort
    ? benchmarkAssets.filter((asset) => cohortByAsset.get(asset.id) === selectedAssetCohort && asset.id !== selectedAsset).map((asset) => asset.id)
    : []);
  const nonAdditivePeerRecords = selectedAsset
    ? currentPeerRecords.filter((row) => {
        const assetId = benchmarkAssetId(row);
        return Boolean(assetId && selectedAssetPeerIds.has(assetId));
      })
    : currentPeerRecords;
  const actualByStore = new Map<string, TrendSourceRecord[]>();
  for (const row of benchmarkTargetRecords) actualByStore.set(row.storeId, [...(actualByStore.get(row.storeId) ?? []), row]);
  const nonAdditivePeerByStore = new Map<string, TrendSourceRecord[]>();
  for (const row of nonAdditivePeerRecords) nonAdditivePeerByStore.set(row.storeId, [...(nonAdditivePeerByStore.get(row.storeId) ?? []), row]);
  const benchmarkBasisRecordsByStore = new Map<string, TrendSourceRecord[]>();
  const benchmarkDisplayDate = `${dateLabel(currentStart)}–${dateLabel(currentEnd)}`;
  const benchmarkRows: TrendBenchmarkRowViewModel[] = storesForBenchmark.map((store) => {
    const includeBasisRecords = detailKind === "benchmark" && benchmarkStore === store.id;
    const storeRows = actualByStore.get(store.id) ?? [];
    const actual = aggregate(safeMetric, storeRows);
    const storeAssets = (benchmarkAssetsByStore.get(store.id) ?? [])
      .filter((row) => !selectedAsset || row.id === selectedAsset)
      .filter((asset) => {
        const storeTimeZone = storeById.get(asset.storeId)?.timeZone ?? organizationTimeZone;
        return currentMonths.some((month) => {
          const exposure = assetMonthExposure(asset, month, storeTimeZone, currentEnd);
          if (exposure.factor !== undefined) return exposure.factor > 0;
          return currentPeerRecords.some((record) => record.periodKey === month && recordAssetIds(record).includes(asset.id));
        });
      });
    let expected = 0;
    let rangeLow = 0;
    let rangeHigh = 0;
    let comparableAssets = 0;
    const expectedByCategory = new Map<string, number>();
    const referenceEvidenceByCategory = new Map<string, {
      positivePeerStores: Set<string>;
      positiveReferenceMonths: Set<string>;
      positivePeerStoreMonths: Set<string>;
    }>();
    const expectedRangeByMonth = new Map<string, { low: number; high: number }>();
    const basisRecords: TrendSourceRecord[] = [];
    const basisRecordIds = new Set<string>();
    const comparableAssetIds = new Set<string>();
    let unknownExposureAssets = 0;
    let unknownRecordingAssets = 0;
    const targetExposureMonths = new Set<string>();
    if (additive) {
      for (const asset of storeAssets) {
        const cohort = cohortByAsset.get(asset.id);
        if (!cohort) continue;
        let assetExpected = 0;
        let assetRangeLow = 0;
        let assetRangeHigh = 0;
        const assetExpectedRangeByMonth = new Map<string, { low: number; high: number }>();
        const assetPositivePeerStores = new Set<string>();
        const assetPositiveReferenceMonths = new Set<string>();
        const assetPositivePeerStoreMonths = new Set<string>();
        let comparableAcrossPeriod = true;
        for (const month of currentMonths) {
          const targetExposure = assetMonthExposure(asset, month, store.timeZone ?? organizationTimeZone, currentEnd);
          if (targetExposure.factor === 0) continue;
          if (targetExposure.factor === undefined) {
            unknownExposureAssets += 1;
            comparableAcrossPeriod = false;
            break;
          }
          if (!monthIsCovered(asset, month, currentEnd < endOfMonth(month) ? currentEnd : endOfMonth(month))) {
            unknownRecordingAssets += 1;
            comparableAcrossPeriod = false;
            break;
          }
          targetExposureMonths.add(`${asset.id}|${month}`);
          const summary = peerMonthSummary(cohort, month.slice(5), store.id);
          const { peerRates, distribution } = summary;
          summary.positivePeerStores.forEach((peerStoreId) => assetPositivePeerStores.add(peerStoreId));
          summary.positiveReferenceMonths.forEach((referenceMonth) => assetPositiveReferenceMonths.add(referenceMonth));
          summary.positivePeerStoreMonths.forEach((storeMonth) => assetPositivePeerStoreMonths.add(storeMonth));
          if (peerRates.length < 3) {
            comparableAcrossPeriod = false;
            break;
          }
          const partialFactor = targetExposure.factor;
          assetExpected += distribution.mean * partialFactor;
          assetRangeLow += distribution.low * partialFactor;
          assetRangeHigh += distribution.high * partialFactor;
          assetExpectedRangeByMonth.set(month, {
            low: distribution.low * partialFactor,
            high: distribution.high * partialFactor,
          });
          if (includeBasisRecords) {
            for (const [peerIndex, peerRate] of peerRates.entries()) {
              const peerStore = storeById.get(peerRate.storeId);
              const contribution = (distribution.capped[peerIndex] / peerRates.length) * partialFactor;
              const peerObservations = summary.observations.filter((observation) => observation.storeId === peerRate.storeId);
              const measuredZeroOnly = peerObservations.every((observation) => observation.coverageStatus === "measured_zero");
              const contributingSourceIds = peerObservations.flatMap((observation) => observation.records.map((record) => record.id));
              const calculationId = `benchmark:${store.id}:${asset.id}:${month}:${peerRate.storeId}`;
              basisRecords.push({
                id: calculationId,
                sourceKind: "calculated_peer_contribution",
                units: metricUnits(safeMetric),
                currency: moneyMetric ? "USD" : undefined,
                date: `${referenceEnd}T12:00:00.000Z`,
                localDate: referenceEnd,
                periodKey: month,
                displayDate: `${monthLabel(referenceMonths[0])}–${monthLabel(referenceMonths.at(-1)!)}`,
                value: contribution,
                storeId: peerRate.storeId,
                categoryKey: asset.categoryKey,
                assetId: asset.id,
                cohortId: cohort,
                referenceStart: `${referenceMonths[0]}-01`,
                referenceEnd,
                rawValue: peerRate.value,
                cappedValue: distribution.capped[peerIndex],
                weight: 1 / peerRates.length,
                exposureFactor: partialFactor,
                coverageStatus: measuredZeroOnly ? "measured_zero" : "observed",
                sourceIds: contributingSourceIds,
                label: `Calculation · ${peerStore ? `Store ${peerStore.storeNumber}` : "Peer store"} · ${asset.name}`,
                detail: `${monthLabel(month)} contribution = ${formatMetric(safeMetric, peerRate.value)} uncapped peer rate, capped to ${formatMetric(safeMetric, distribution.capped[peerIndex])}, × ${(1 / peerRates.length).toFixed(6)} peer weight, × ${partialFactor.toFixed(6)} target exposure. Reference ${referenceMonths[0]} through ${referenceMonths.at(-1)}; ${peerObservations.length} comparable calendar-month observations. ${measuredZeroOnly ? "Explicit store/measure recording coverage and documented equipment exposure support a quiet period retained as a measured zero." : `${contributingSourceIds.length} underlying source record${contributingSourceIds.length === 1 ? "" : "s"}.`}`,
                displayValue: formatMetric(safeMetric, contribution),
                href: `${trendHref({ view: "records", detailKind: "benchmark", benchmarkStore: store.id, detailMonth: undefined, sourcePage: undefined })}#${calculationId}`,
              });
              basisRecordIds.add(calculationId);
              for (const observation of peerObservations) {
                for (const raw of observation.records) {
                  const rawId = `benchmark-raw:${asset.id}:${month}:${raw.id}`;
                  if (basisRecordIds.has(rawId)) continue;
                  basisRecordIds.add(rawId);
                  basisRecords.push({
                    ...raw,
                    id: rawId,
                    sourceKind: "raw_peer_observation",
                    rawValue: raw.value,
                    cohortId: cohort,
                    referenceStart: `${referenceMonths[0]}-01`,
                    referenceEnd,
                    exposureFactor: observation.exposureFactor,
                    coverageStatus: observation.coverageStatus,
                    sourceIds: [raw.id],
                    label: `Raw evidence · ${raw.label}`,
                    detail: `${raw.detail} · ${monthLabel(observation.month)} historical observation for ${peerStore ? `Store ${peerStore.storeNumber}` : "the peer store"}; ${observation.exposureFactor.toFixed(6)} documented equipment-month exposure`,
                  });
                }
              }
            }
          }
        }
        if (!comparableAcrossPeriod) continue;
        expected += assetExpected;
        rangeLow += assetRangeLow;
        rangeHigh += assetRangeHigh;
        expectedByCategory.set(asset.categoryKey, (expectedByCategory.get(asset.categoryKey) ?? 0) + assetExpected);
        const categoryEvidence = referenceEvidenceByCategory.get(asset.categoryKey) ?? {
          positivePeerStores: new Set<string>(),
          positiveReferenceMonths: new Set<string>(),
          positivePeerStoreMonths: new Set<string>(),
        };
        assetPositivePeerStores.forEach((peerStoreId) => categoryEvidence.positivePeerStores.add(peerStoreId));
        assetPositiveReferenceMonths.forEach((month) => categoryEvidence.positiveReferenceMonths.add(month));
        assetPositivePeerStoreMonths.forEach((storeMonth) => categoryEvidence.positivePeerStoreMonths.add(storeMonth));
        referenceEvidenceByCategory.set(asset.categoryKey, categoryEvidence);
        comparableAssets += 1;
        comparableAssetIds.add(asset.id);
        for (const [month, assetMonthRange] of assetExpectedRangeByMonth) {
          const currentRange = expectedRangeByMonth.get(month) ?? { low: 0, high: 0 };
          expectedRangeByMonth.set(month, {
            low: currentRange.low + assetMonthRange.low,
            high: currentRange.high + assetMonthRange.high,
          });
        }
      }
    }
    let comparableRows = additive ? storeRows.filter((row) => {
      const assetId = benchmarkAssetId(row);
      const asset = assetId ? assetById.get(assetId) : undefined;
      return Boolean(
        assetId
        && asset
        && comparableAssetIds.has(assetId)
        && targetExposureMonths.has(`${assetId}|${row.periodKey}`)
        && assetExposedOnLocalDate(asset, row.localDate, store.timeZone ?? organizationTimeZone),
      );
    }) : storeRows;
    if (!additive) {
      const peerStores = benchmarkPeerStores
        .filter((peer) => peer.id !== store.id)
        .map((peer) => ({ storeId: peer.id, rows: nonAdditivePeerByStore.get(peer.id) ?? [] }))
        .filter((peer) => peer.rows.length > 0);
      const peerValues = peerStores.map((peer) => aggregate(safeMetric, peer.rows));
      expected = peerValues.length >= 3 ? median(peerValues) : 0;
      rangeLow = peerValues.length >= 3 ? quantile(peerValues, 0.25) : 0;
      rangeHigh = peerValues.length >= 3 ? quantile(peerValues, 0.75) : 0;
      comparableAssets = peerValues.length;
      comparableRows = storeRows;
      if (includeBasisRecords) {
        for (const peer of peerStores) {
          const peerStore = storeById.get(peer.storeId);
          const peerValue = aggregate(safeMetric, peer.rows);
          basisRecords.push({
            id: `benchmark:${store.id}:${peer.storeId}`,
            date: `${currentEnd}T12:00:00.000Z`,
            localDate: currentEnd,
            periodKey: monthKey(currentEnd),
            displayDate: benchmarkDisplayDate,
            value: peerValue,
            storeId: peer.storeId,
            categoryKey: selectedCategory,
            label: `Store ${peerStore?.storeNumber ?? "unknown"} peer result`,
            detail: `${evidenceLabel(safeMetric, peer.rows.length)} used to compare Store ${store.storeNumber}`,
            displayValue: formatMetric(safeMetric, peerValue, false, true),
            href: `${trendHref({ view: "records", store: peer.storeId, asset: undefined, detailKind: "current", detailMonth: undefined, driverBreakdown: undefined, driverValue: undefined, benchmarkStore: undefined, sourcePage: undefined })}#source-records`,
          });
        }
      }
    }
    if (includeBasisRecords) benchmarkBasisRecordsByStore.set(store.id, basisRecords);
    const actualHasData = additive || storeRows.length > 0;
    const comparableActual = aggregate(safeMetric, comparableRows);
    const evidenceFloor = safeMetric === "recorded_cost" || safeMetric === "linked_invoice" ? 10_000 : safeMetric === "vendor_response" ? 0.1 : 1;
    const coveragePercent = additive && storeAssets.length ? Math.round((comparableAssets / storeAssets.length) * 100) : 0;
    const relevantReferenceMonths = new Set([...referenceEvidenceByCategory.values()].flatMap((evidence) => [...evidence.positiveReferenceMonths]));
    const relevantPeerStores = new Set([...referenceEvidenceByCategory.values()].flatMap((evidence) => [...evidence.positivePeerStores]));
    const requiredReferenceMonths = Math.min(18, currentMonths.length * 2);
    const baselineReliable = additive
      ? relevantReferenceMonths.size >= requiredReferenceMonths && comparableAssets > 0 && relevantPeerStores.size >= 3 && expected >= evidenceFloor
      : comparableAssets >= 3;
    const ratio = baselineReliable && actualHasData && expected > 0 ? comparableActual / expected : undefined;
    const differenceFromRange = comparableActual > rangeHigh ? comparableActual - rangeHigh : comparableActual < rangeLow ? comparableActual - rangeLow : 0;
    const material = baselineReliable && actualHasData && (safeMetric === "recorded_cost" || safeMetric === "linked_invoice" ? Math.abs(differenceFromRange) >= 100_000 : Math.abs(differenceFromRange) >= 2);
    const aboveRange = baselineReliable && actualHasData && comparableActual > rangeHigh;
    const belowRange = baselineReliable && actualHasData && comparableActual < rangeLow;
    const high = material && aboveRange;
    const low = material && belowRange;
    const noComparison = !baselineReliable || !actualHasData;
    const signalLabel = noComparison
      ? "No reliable peer comparison yet"
      : safeMetric === "vendor_response"
        ? high ? "Slower than other stores" : low ? "Faster than other stores" : "Near other stores"
        : safeMetric === "pm_completion"
          ? low ? "Lower completion—review" : high ? "Higher completion" : "Near other stores"
        : additive
          ? high ? "Above historical peer range—review" : aboveRange ? "Above historical peer range" : belowRange ? "Below historical peer range" : "Within historical peer range"
          : high ? "Above peer range—review" : aboveRange ? "Above peer range" : belowRange ? "Below peer range" : "Within peer range";
    const signalTone: Tone = noComparison
      ? "neutral"
      : safeMetric === "vendor_response"
        ? high ? "warning" : low ? "positive" : "neutral"
        : safeMetric === "pm_completion"
          ? low ? "warning" : high ? "positive" : "neutral"
          : high ? "warning" : aboveRange || belowRange ? "info" : "positive";
    const signalRank = noComparison ? 0 : safeMetric === "pm_completion" ? low ? 3 : 1 : high ? 3 : aboveRange ? 2 : 1;
    const explainableAdditiveMetric = safeMetric === "recorded_cost" || safeMetric === "linked_invoice" || safeMetric === "work_orders";
    const comparableActualByCategory = new Map<string, number>();
    const recordedActualByCategory = new Map<string, number>();
    if (explainableAdditiveMetric) {
      for (const row of comparableRows) {
        const categories = recordCategoryKeys(row);
        if (categories.length !== 1 || !expectedByCategory.has(categories[0])) continue;
        comparableActualByCategory.set(categories[0], (comparableActualByCategory.get(categories[0]) ?? 0) + row.value);
      }
      for (const row of storeRows) {
        const categories = recordCategoryKeys(row);
        if (categories.length !== 1) continue;
        recordedActualByCategory.set(categories[0], (recordedActualByCategory.get(categories[0]) ?? 0) + row.value);
      }
    }
    const minimumPositiveReferenceMonths = Math.min(
      observedReferenceMonthCount,
      Math.max(6, Math.ceil(currentMonths.length * 1.25)),
    );
    const categoryDifferences = [...expectedByCategory.entries()].map(([categoryKey, categoryExpected]) => {
      const categoryActual = comparableActualByCategory.get(categoryKey) ?? 0;
      const categoryEvidence = referenceEvidenceByCategory.get(categoryKey);
      const categoryBaselineReliable = Boolean(
        categoryEvidence &&
        categoryEvidence.positivePeerStores.size >= 5 &&
        categoryEvidence.positiveReferenceMonths.size >= minimumPositiveReferenceMonths &&
        categoryEvidence.positivePeerStoreMonths.size >= 12,
      );
      return { categoryKey, categoryActual, categoryExpected, difference: categoryActual - categoryExpected, categoryBaselineReliable };
    });
    const categoryDirection = aboveRange ? 1 : belowRange ? -1 : 0;
    const largestCategoryDifference = baselineReliable && explainableAdditiveMetric
      ? [...categoryDifferences].filter((category) => category.categoryBaselineReliable).sort((left, right) => {
          const leftScore = categoryDirection ? left.difference * categoryDirection : Math.abs(left.difference);
          const rightScore = categoryDirection ? right.difference * categoryDirection : Math.abs(right.difference);
          return rightScore - leftScore;
        })[0]
      : undefined;
    const largestRecordedCategory = baselineReliable && explainableAdditiveMetric
      ? [...recordedActualByCategory.entries()]
          .map(([categoryKey, categoryActual]) => ({ categoryKey, categoryActual }))
          .sort((left, right) => right.categoryActual - left.categoryActual)[0]
      : undefined;
    const findingCategory = largestCategoryDifference ?? largestRecordedCategory;
    const findingExplanation = largestCategoryDifference
      ? `${sentence(largestCategoryDifference.categoryKey)} is the largest measured difference: ${formatMetric(safeMetric, Math.abs(largestCategoryDifference.difference))} ${largestCategoryDifference.difference >= 0 ? "above" : "below"} its historical peer expectation (${formatMetric(safeMetric, largestCategoryDifference.categoryActual)} recorded vs ${formatMetric(safeMetric, largestCategoryDifference.categoryExpected)} expected).`
      : largestRecordedCategory
        ? `${sentence(largestRecordedCategory.categoryKey)} is the largest recorded contributor: ${formatMetric(safeMetric, largestRecordedCategory.categoryActual)} of this store's ${formatMetric(safeMetric, actual)} ${metricCopy[safeMetric].label.toLocaleLowerCase("en-US")}. Not enough comparable ${sentence(largestRecordedCategory.categoryKey).toLocaleLowerCase("en-US")} history for a reliable category expectation.`
        : undefined;
    const driverLink = findingCategory ? {
      href: `${trendHref({
        view: "records",
        store: store.id,
        category: findingCategory.categoryKey,
        detailKind: "current",
        detailMonth: undefined,
        driverBreakdown: undefined,
        driverValue: undefined,
        benchmarkStore: undefined,
        sourcePage: undefined,
      })}#source-records`,
      label: `Open ${sentence(findingCategory.categoryKey)} source records for Store ${store.storeNumber}`,
    } : undefined;
    const findingSourceRows = largestCategoryDifference ? comparableRows : storeRows;
    const largestSourceGroup = findingCategory
      ? [...findingSourceRows
          .filter((row) => recordCategoryKeys(row).includes(findingCategory.categoryKey))
          .reduce((groups, row) => {
            const key = row.workOrderId ?? row.invoiceId ?? row.id;
            const current = groups.get(key);
            groups.set(key, current
              ? { ...current, value: current.value + row.value }
              : { value: row.value, label: row.label, href: row.href });
            return groups;
          }, new Map<string, { value: number; label: string; href: string }>())
          .values()]
        .sort((left, right) => right.value - left.value)[0]
      : undefined;
    const largestRecordLink = largestSourceGroup ? {
      href: largestSourceGroup.href,
      label: `Open ${largestSourceGroup.label}, the largest source record at ${formatMetric(safeMetric, largestSourceGroup.value)}`,
    } : undefined;
    const monthlyPositions = currentMonths.flatMap((month) => {
      const monthRange = expectedRangeByMonth.get(month);
      if (!monthRange) return [];
      const monthActual = aggregate(safeMetric, comparableRows.filter((row) => row.periodKey === month));
      return [{
        actual: monthActual,
        low: monthRange.low,
        high: monthRange.high,
      }];
    });
    const monthsAboveRange = monthlyPositions.filter((position) => position.actual > position.high).length;
    const monthsBelowRange = monthlyPositions.filter((position) => position.actual < position.low).length;
    const monthsWithinRange = monthlyPositions.length - monthsAboveRange - monthsBelowRange;
    const persistenceLabel = baselineReliable && monthlyPositions.length >= 3
      ? aboveRange
        ? `Above range in ${monthsAboveRange} of ${monthlyPositions.length} months`
        : belowRange
          ? `Below range in ${monthsBelowRange} of ${monthlyPositions.length} months`
          : `Within range in ${monthsWithinRange} of ${monthlyPositions.length} months`
      : undefined;
    const variance = baselineReliable && actualHasData ? comparableActual - expected : undefined;
    const storeFocusLink = {
      href: trendHref({
        store: store.id,
        breakdown: "category",
        detailKind: undefined,
        detailMonth: undefined,
        driverBreakdown: undefined,
        driverValue: undefined,
        benchmarkStore: undefined,
        sourcePage: undefined,
        driverPage: undefined,
        storePage: undefined,
      }),
      label: `Focus the full analysis on Store ${store.storeNumber}`,
    };
    const storeRecordsLink = {
      href: `${trendHref({ view: "records", detailKind: "current", detailMonth: undefined, driverBreakdown: "store", driverValue: store.id })}#source-records`,
      label: `Open Store ${store.storeNumber} exact records for the selected dates`,
    };
    return {
      id: store.id,
      label: `Store ${store.storeNumber}`,
      context: `${store.name} · ${regionById.get(store.regionId ?? "")?.name ?? "No region"}`,
      actualValue: actualHasData ? actual : undefined,
      actualLabel: formatMetric(safeMetric, actual, false, actualHasData),
      comparableActualValue: actualHasData ? comparableActual : undefined,
      comparableActualLabel: formatMetric(safeMetric, comparableActual, false, actualHasData),
      excludedActualLabel: additive && actual !== comparableActual ? `${formatMetric(safeMetric, actual - comparableActual)} outside the equipment match` : undefined,
      expectedValue: baselineReliable ? expected : undefined,
      expectedLabel: baselineReliable ? formatMetric(safeMetric, expected) : "No reliable peer comparison yet",
      rangeLowValue: baselineReliable ? rangeLow : undefined,
      rangeHighValue: baselineReliable ? rangeHigh : undefined,
      rangeLabel: baselineReliable ? `${formatMetric(safeMetric, rangeLow)}–${formatMetric(safeMetric, rangeHigh)}` : "No reliable peer comparison yet",
      varianceValue: variance,
      varianceLabel: variance === undefined
        ? "—"
        : differenceFromRange === 0
          ? "Within range"
        : safeMetric === "pm_completion"
          ? `${differenceFromRange >= 0 ? "+" : ""}${Math.round(differenceFromRange)} pts`
          : `${differenceFromRange >= 0 ? "+" : ""}${formatMetric(safeMetric, differenceFromRange)}`,
      ratioValue: ratio,
      ratioLabel: ratio !== undefined ? `${ratio.toFixed(1)}×` : "—",
      signalRank,
      signalLabel,
      signalTone,
      findingExplanation,
      persistenceLabel,
      driverLink,
      largestRecordLink,
      coverageValue: additive ? coveragePercent : comparableAssets,
      coverageLabel: additive ? `${coveragePercent}% matched · ${comparableAssets} of ${storeAssets.length} equipment record${storeAssets.length === 1 ? "" : "s"}` : `${comparableAssets} other stores compared`,
      evidenceQualityLabel: additive
        ? unknownExposureAssets
          ? `${unknownExposureAssets} equipment record${unknownExposureAssets === 1 ? " has" : "s have"} an unknown installation date and ${unknownExposureAssets === 1 ? "is" : "are"} excluded from the expectation`
          : unknownRecordingAssets ? `${unknownRecordingAssets} equipment records have unknown recording coverage and are excluded from the comparison` : baselineReliable ? "Supported historical comparison" : "Insufficient covered peer observations for a reliable comparison"
        : baselineReliable ? "Supported company peer comparison" : "Insufficient peer results",
      referenceHistoryLabel: additive
        ? `${relevantPeerStores.size} peer stores · ${relevantReferenceMonths.size} applicable reference months · ${targetExposureMonths.size} target equipment-months`
        : `${comparableAssets} peer stores with measured results`,
      focusLink: storeFocusLink,
      recordsLink: storeRecordsLink,
      link: storeRecordsLink,
      peerLink: baselineReliable ? { href: `${trendHref({ view: "records", detailKind: "benchmark", benchmarkStore: store.id, detailMonth: undefined })}#source-records`, label: `Open Store ${store.storeNumber} peer comparison inputs` } : undefined,
    };
  });
  const historicalComparisonRows = additive ? benchmarkRows.filter((row) =>
    row.comparableActualValue !== undefined
    && row.rangeHighValue !== undefined) : [];
  const aboveHistoricalCount = historicalComparisonRows.filter((row) => row.comparableActualValue! > row.rangeHighValue!).length;
  const portfolioWideHistoricalIncrease = historicalComparisonRows.length >= 5
    && aboveHistoricalCount / historicalComparisonRows.length >= 0.6;
  const historicalPortfolioContext = portfolioWideHistoricalIncrease
    ? `${aboveHistoricalCount} of ${historicalComparisonRows.length} comparable stores are above their historical peer range, which points to a portfolio-wide increase rather than one isolated store.`
    : undefined;

  const valueForSort = (row: TrendBenchmarkRowViewModel) => {
    if (storeSort === "store") return row.label;
    if (storeSort === "actual") return row.actualValue;
    if (storeSort === "comparable") return row.comparableActualValue;
    if (storeSort === "expected") return row.expectedValue;
    if (storeSort === "variance") return row.varianceValue;
    if (storeSort === "ratio") return row.ratioValue;
    if (storeSort === "signal") return row.signalRank;
    return row.coverageValue;
  };
  const sortedBenchmarkRows = [...benchmarkRows].sort((left, right) => {
    const leftValue = valueForSort(left);
    const rightValue = valueForSort(right);
    if (leftValue === undefined && rightValue === undefined) return left.label.localeCompare(right.label, undefined, { numeric: true });
    if (leftValue === undefined) return 1;
    if (rightValue === undefined) return -1;
    const comparisonValue = typeof leftValue === "string"
      ? leftValue.localeCompare(String(rightValue), undefined, { numeric: true })
      : leftValue - Number(rightValue);
    if (comparisonValue === 0) return left.label.localeCompare(right.label, undefined, { numeric: true });
    return storeDirection === "asc" ? comparisonValue : -comparisonValue;
  });
  const benchmarkPageSize = 15;
  const benchmarkTotalPages = Math.max(1, Math.ceil(sortedBenchmarkRows.length / benchmarkPageSize));
  const benchmarkPage = Number.isInteger(requestedStorePage) ? Math.min(Math.max(requestedStorePage, 1), benchmarkTotalPages) : 1;
  const visibleBenchmarkRows = sortedBenchmarkRows.slice((benchmarkPage - 1) * benchmarkPageSize, benchmarkPage * benchmarkPageSize);
  const benchmarkPagination = sortedBenchmarkRows.length > benchmarkPageSize
    ? paginationModel(sortedBenchmarkRows.length, benchmarkPage, benchmarkPageSize, (page) => `${trendHref({ view: "stores", storePage: String(page) }, { preserveEvidence: true })}#store-comparison`)
    : undefined;

  const defaultDirection = (id: TrendBenchmarkSortId): TrendSortDirection => id === "store" || id === "coverage" || (id === "ratio" && safeMetric === "pm_completion") ? "asc" : "desc";
  const sortLinks = ([
    ["store", "Store"],
    ["comparable", "Comparable actual"],
    ["expected", additive ? "Historical peer range" : "Peer operating range"],
    ["variance", "Difference"],
    ["signal", "Finding"],
    ["coverage", additive ? "Match coverage" : "Peer sample"],
  ] as const).map(([id, label]) => {
    const nextDirection = storeSort === id ? (storeDirection === "asc" ? "desc" : "asc") : defaultDirection(id);
    return {
      id,
      label,
      active: storeSort === id,
      direction: storeSort === id ? storeDirection : undefined,
      link: {
        href: trendHref({ view: "stores", storeSort: id, storeDirection: nextDirection, storePage: undefined }, { preserveEvidence: true }),
        label: `Sort stores by ${label.toLocaleLowerCase("en-US")} ${nextDirection === "asc" ? "ascending" : "descending"}`,
      },
    };
  });

  const scopedStores = stores.filter((store) => (!selectedRegion || store.regionId === selectedRegion) && (!selectedStore || store.id === selectedStore));
  const scopedStoreIds = new Set(scopedStores.map((store) => store.id));
  const scopedAssets = fixture.assets.filter((asset) => asset.organizationId === session.organizationId && scopedStores.some((store) => store.id === asset.storeId));
  const categories = [...new Set(allRecords.filter((row) => scopedStoreIds.has(row.storeId)).flatMap((row) => recordCategoryKeys(row)))].sort();
  const pathScopedAssets = scopedAssets.filter((asset) => !selectedCategory || asset.categoryKey === selectedCategory);
  const paths = [...new Set(pathScopedAssets.flatMap((asset) => asset.groupPath.map((_, index) => asset.groupPath.slice(0, index + 1).join("|"))))].sort();
  const profileScopedAssets = pathScopedAssets.filter((asset) => assetMatchesTrendPath(asset, selectedPath));
  const profiles = [...new Set(profileScopedAssets.map((asset) => asset.replacementProfileId).filter((value): value is string => Boolean(value)))].map((id) => profileById.get(id)).filter((value): value is NonNullable<typeof value> => Boolean(value)).sort((left, right) => left.name.localeCompare(right.name));
  const optionAssets = profileScopedAssets.filter((asset) => !selectedProfile || asset.replacementProfileId === selectedProfile);
  const optionAssetIds = new Set((selectedAsset ? optionAssets.filter((asset) => asset.id === selectedAsset) : optionAssets).map((asset) => asset.id));
  const components = [...new Set([...componentById.values()].filter((component) => optionAssetIds.has(component.assetId)).map((component) => component.name))].sort();
  const relevantVendorIds = new Set(allRecords.filter((row) => scopeRecord(row, true, false)).map((row) => row.vendorId).filter((value): value is string => Boolean(value)));
  const vendors = fixture.vendors.filter((vendor) => vendor.organizationId === session.organizationId && (relevantVendorIds.has(vendor.id) || vendor.id === selectedVendor)).sort((left, right) => left.name.localeCompare(right.name));
  const filterOption = (value: string, label: string) => ({ value, label });
  const unclassifiedDriverKey = "__unclassified__";
  const driverIdentity = (row: TrendSourceRecord, dimension: TrendBreakdownId = breakdown) => {
    const store = storeById.get(row.storeId);
    const rowAssets = recordAssetIds(row).map((id) => assetById.get(id)).filter((asset): asset is Asset => Boolean(asset));
    if (dimension === "region") {
      const key = store?.regionId ?? unclassifiedDriverKey;
      return { key, label: key === unclassifiedDriverKey ? "No region" : regionById.get(key)?.name ?? "Unknown region", context: "Operating region" };
    }
    if (dimension === "store") return { key: row.storeId, label: store ? `Store ${store.storeNumber}` : "Store unavailable", context: store?.name ?? "Store record unavailable" };
    if (dimension === "category") {
      const keys = recordCategoryKeys(row);
      if (selectedCategory && keys.includes(selectedCategory)) return { key: selectedCategory, label: sentence(selectedCategory), context: "Service area" };
      if (keys.length === 1) return { key: keys[0], label: sentence(keys[0]), context: "Service area" };
      if (keys.length > 1) return { key: `__multiple_categories__:${[...keys].sort().join("|")}`, label: "Multiple service areas", context: keys.map((key) => sentence(key)).join(" + ") };
      return { key: unclassifiedDriverKey, label: "Unclassified service area", context: "Service area" };
    }
    if (dimension === "group") {
      if (selectedPath && rowAssets.some((asset) => assetMatchesTrendPath(asset, selectedPath))) return { key: selectedPath, label: selectedPath.split("|").at(-1) ?? trendPathLabel(selectedPath), context: trendPathLabel(selectedPath) };
      const paths = [...new Set(rowAssets.map((asset) => asset.groupPath.join("|")).filter(Boolean))];
      if (paths.length === 1) return { key: paths[0], label: paths[0].split("|").at(-1) ?? trendPathLabel(paths[0]), context: trendPathLabel(paths[0]) };
      if (paths.length > 1) return { key: `__multiple_groups__:${[...paths].sort().join("||")}`, label: "Multiple equipment groups", context: paths.map((path) => trendPathLabel(path)).join(" + ") };
      return { key: unclassifiedDriverKey, label: "Unclassified equipment group", context: "Equipment group" };
    }
    if (dimension === "profile") {
      const profileIds = [...new Set(rowAssets.map((asset) => asset.replacementProfileId).filter((value): value is string => Boolean(value)))];
      if (selectedProfile && profileIds.includes(selectedProfile)) return { key: selectedProfile, label: profileById.get(selectedProfile)?.name ?? "Unknown equipment type", context: "Shared equipment type" };
      if (profileIds.length === 1) return { key: profileIds[0], label: profileById.get(profileIds[0])?.name ?? "Unknown equipment type", context: "Shared equipment type" };
      if (profileIds.length > 1) return { key: `__multiple_profiles__:${[...profileIds].sort().join("|")}`, label: "Multiple equipment types", context: profileIds.map((id) => profileById.get(id)?.name ?? "Unknown equipment type").join(" + ") };
      return { key: unclassifiedDriverKey, label: "Equipment type not assigned", context: "Shared equipment type" };
    }
    if (dimension === "component") {
      const names = recordComponentNames(row);
      const selectedName = selectedComponent && names.find((name) => name.toLocaleLowerCase("en-US") === selectedComponent.toLocaleLowerCase("en-US"));
      if (selectedName) return { key: selectedName, label: selectedName, context: "Component name" };
      if (names.length === 1) return { key: names[0], label: names[0], context: "Component name" };
      if (names.length > 1) return { key: `__multiple_components__:${[...names].sort().join("|")}`, label: "Multiple components", context: names.join(" + ") };
      return { key: unclassifiedDriverKey, label: "Component not classified", context: "Component name" };
    }
    const vendorId = row.vendorId;
    return { key: vendorId ?? unclassifiedDriverKey, label: vendorId ? vendorNameById.get(vendorId) ?? "Unknown vendor" : "Vendor not attributed", context: "Provider attribution" };
  };
  const currentDriverRows = new Map<string, TrendSourceRecord[]>();
  const comparisonDriverRows = new Map<string, TrendSourceRecord[]>();
  for (const row of currentRecords) {
    const key = driverIdentity(row).key;
    currentDriverRows.set(key, [...(currentDriverRows.get(key) ?? []), row]);
  }
  for (const row of baselineRecords) {
    const key = driverIdentity(row).key;
    comparisonDriverRows.set(key, [...(comparisonDriverRows.get(key) ?? []), row]);
  }
  const driverKeys = [...new Set([...currentDriverRows.keys(), ...comparisonDriverRows.keys()])];
  const totalDriverChange = currentValue - baselineValue;
  const driverEvidenceColumnLabel = additive
    ? comparison !== "none" && totalDriverChange !== 0 ? "Effect on change" : "Share of selected total"
    : "Records";
  const nextBreakdown: Record<TrendBreakdownId, TrendBreakdownId> = {
    region: "store",
    store: "category",
    category: "group",
    group: "profile",
    profile: "component",
    component: "vendor",
    vendor: "category",
  };
  const driverFocusValues = (dimension: TrendBreakdownId, key: string) => {
    if (key === unclassifiedDriverKey || key.startsWith("__multiple_")) return undefined;
    const common = {
      breakdown: nextBreakdown[dimension],
      detailKind: undefined,
      detailMonth: undefined,
      driverBreakdown: undefined,
      driverValue: undefined,
      benchmarkStore: undefined,
      sourcePage: undefined,
      driverPage: undefined,
      storePage: undefined,
    };
    if (dimension === "region") return { ...common, region: key, store: undefined };
    if (dimension === "store") return { ...common, store: key };
    if (dimension === "category") return { ...common, category: key, path: undefined, profile: undefined, asset: undefined, component: undefined };
    if (dimension === "group") return { ...common, path: key, profile: undefined, asset: undefined, component: undefined };
    if (dimension === "profile") return { ...common, profile: key, asset: undefined, component: undefined };
    if (dimension === "component") return { ...common, component: key };
    return { ...common, vendor: key };
  };
  const unsortedDriverRows = driverKeys.map((key) => {
    const current = currentDriverRows.get(key) ?? [];
    const prior = comparisonDriverRows.get(key) ?? [];
    const currentAggregate = aggregate(safeMetric, current);
    const comparisonAggregate = aggregate(safeMetric, prior);
    const currentDriverHasData = additiveMetricHasData(safeMetric, current);
    const comparisonDriverHasData = comparison !== "none" && additiveMetricHasData(safeMetric, prior);
    const identity = driverIdentity(current[0] ?? prior[0]);
    const changeValue = currentDriverHasData && comparisonDriverHasData ? currentAggregate - comparisonAggregate : undefined;
    const recordsLink = {
      href: `${trendHref({ view: "records", detailKind: comparison === "none" ? "current" : "both", detailMonth: undefined, driverBreakdown: breakdown, driverValue: key })}#source-records`,
      label: `Open exact ${identity.label} records`,
    };
    const focusValues = driverFocusValues(breakdown, key);
    return {
      id: key,
      label: identity.label,
      context: identity.context,
      currentValue: currentDriverHasData ? currentAggregate : undefined,
      currentLabel: formatMetric(safeMetric, currentAggregate, false, currentDriverHasData),
      comparisonValue: comparisonDriverHasData ? comparisonAggregate : undefined,
      comparisonLabel: comparison === "none" ? "Off" : formatMetric(safeMetric, comparisonAggregate, false, comparisonDriverHasData),
      changeValue,
      changeLabel: changeValue === undefined ? "Not available" : metricChangeLabel(safeMetric, currentAggregate, comparisonAggregate),
      shareLabel: additive && changeValue !== undefined && totalDriverChange
        ? additiveContributionLabel(changeValue, totalDriverChange)
        : additive && currentValue ? `${Math.round((currentAggregate / currentValue) * 100)}% of current` : undefined,
      currentSourceCount: current.length,
      comparisonSourceCount: prior.length,
      focusLink: focusValues ? { href: trendHref(focusValues), label: `Focus the full analysis on ${identity.label}` } : undefined,
      recordsLink,
      link: recordsLink,
    };
  });
  const driverSortValue = (row: typeof unsortedDriverRows[number]) => {
    if (driverSort === "segment") return row.label;
    if (driverSort === "current") return row.currentValue;
    if (driverSort === "comparison") return row.comparisonValue;
    if (driverSort === "change") return row.changeValue;
    return additive ? Math.abs(row.changeValue ?? 0) : row.currentSourceCount + row.comparisonSourceCount;
  };
  const driverRows = [...unsortedDriverRows].sort((left, right) => {
    const leftValue = driverSortValue(left);
    const rightValue = driverSortValue(right);
    if (leftValue === undefined && rightValue === undefined) return left.label.localeCompare(right.label, undefined, { numeric: true });
    if (leftValue === undefined) return 1;
    if (rightValue === undefined) return -1;
    const order = typeof leftValue === "string"
      ? leftValue.localeCompare(String(rightValue), undefined, { numeric: true })
      : leftValue - Number(rightValue);
    if (order === 0) return left.label.localeCompare(right.label, undefined, { numeric: true });
    return driverDirection === "asc" ? order : -order;
  });
  const driverPageSize = 15;
  const driverTotalPages = Math.max(1, Math.ceil(driverRows.length / driverPageSize));
  const driverPage = Number.isInteger(requestedDriverPage) ? Math.min(Math.max(requestedDriverPage, 1), driverTotalPages) : 1;
  const visibleDriverRows = driverRows.slice((driverPage - 1) * driverPageSize, driverPage * driverPageSize);
  const driverPagination = driverRows.length > driverPageSize
    ? paginationModel(driverRows.length, driverPage, driverPageSize, (page) => `${trendHref({ view: "drivers", driverPage: String(page) }, { preserveEvidence: true })}#change-drivers`)
    : undefined;
  const driverColumnLabel = breakdown === "category" ? "Service area" : breakdown === "profile" ? "Equipment type" : breakdown === "group" ? "Equipment group" : breakdown === "component" ? "Component" : breakdown === "vendor" ? "Vendor" : breakdown === "region" ? "Region" : "Store";
  const driverSortLinks: TrendAnalysisPageViewModel["drivers"]["sortLinks"] = ([
    ["segment", driverColumnLabel],
    ["current", "Selected dates"],
    ["comparison", compareLabel],
    ["change", "Change"],
    ["evidence", driverEvidenceColumnLabel],
  ] as const).map(([id, label]) => {
    const defaultDirection: TrendSortDirection = id === "segment" ? "asc" : "desc";
    const nextDirection = driverSort === id ? (driverDirection === "asc" ? "desc" : "asc") : defaultDirection;
    return {
      id,
      label,
      active: driverSort === id,
      direction: driverSort === id ? driverDirection : undefined,
      link: {
        href: trendHref({ view: "drivers", driverSort: id, driverDirection: nextDirection, driverPage: undefined }, { preserveEvidence: true }),
        label: `Sort change details by ${label.toLocaleLowerCase("en-US")} ${nextDirection === "asc" ? "ascending" : "descending"}`,
      },
    };
  });
  const breakdownLabels: Record<TrendBreakdownId, string> = { region: "region", store: "store", category: "service area", group: "equipment group", profile: "equipment type", component: "component name", vendor: "vendor" };
  const detailBaseRecords = detailKind === "vendor_outstanding" ? outstandingRecords : detailKind === "current"
    ? currentRecords
    : detailKind === "comparison"
      ? baselineRecords
      : detailKind === "both"
        ? [...currentRecords, ...baselineRecords]
        : detailKind === "unclassified"
          ? currentRecords.filter((row) => !hasRequiredClassification(row))
          : detailKind === "benchmark" && benchmarkStore
            ? benchmarkBasisRecordsByStore.get(benchmarkStore) ?? []
            : detailKind === "projection"
              ? projectionRecords
            : currentSet.has(detailMonth)
              ? currentRecords.filter((row) => row.periodKey === detailMonth)
              : baselineSet.has(detailMonth)
                ? baselineRecords.filter((row) => row.periodKey === detailMonth)
                : records.filter((row) => row.periodKey === detailMonth);
  const detailRecords = detailDriverBreakdown && detailDriverValue
    ? detailBaseRecords.filter((row) => driverIdentity(row, detailDriverBreakdown).key === detailDriverValue)
    : detailBaseRecords;
  const detailDriverLabel = detailDriverBreakdown && detailDriverValue
    ? detailRecords[0] ? driverIdentity(detailRecords[0], detailDriverBreakdown).label : detailDriverValue === unclassifiedDriverKey ? "Unclassified" : "Selected segment"
    : undefined;
  const detailPeriodLabel = detailKind === "vendor_outstanding" ? `Outstanding assignments first issued ${dateLabel(currentStart)}–${dateLabel(currentEnd)}` : detailKind === "current"
    ? `${detailDriverLabel ? `${detailDriverLabel} · ` : ""}${selectedPeriodName} · ${dateLabel(currentStart)}–${dateLabel(currentEnd)}`
    : detailKind === "comparison" && baselineStart && baselineEnd
      ? `${compareLabel} · ${dateLabel(baselineStart)}–${dateLabel(baselineEnd)}`
      : detailKind === "both" && baselineStart && baselineEnd
        ? `${detailDriverLabel ? `${detailDriverLabel} · ` : ""}Both date ranges`
        : detailKind === "unclassified"
          ? `Unclassified · ${dateLabel(currentStart)}–${dateLabel(currentEnd)}`
          : detailKind === "benchmark" && benchmarkStore
            ? `Calculation inputs used for ${benchmarkRows.find((row) => row.id === benchmarkStore)?.label ?? "store"} expected result · ${dateLabel(currentStart)}–${dateLabel(currentEnd)}`
            : detailKind === "projection"
              ? `Complete months used for the planning estimate · ${dateLabel(`${projectionMonths[0]}-01`)}–${dateLabel(endOfMonth(lastCompleteMonth))}`
            : monthLabel(detailMonth);
  const sourceSortValue = (row: TrendSourceRecord) => {
    const store = storeById.get(row.storeId);
    if (sourceSort === "record") return row.label;
    if (sourceSort === "store") return store ? `${store.storeNumber} ${store.name}` : undefined;
    if (sourceSort === "service") return `${recordCategoryKeys(row).join(" ")} ${row.costKind ?? ""} ${recordComponentNames(row).join(" ")} ${row.vendorId ? vendorNameById.get(row.vendorId) ?? "" : ""}`;
    if (sourceSort === "date") return `${row.localDate} ${row.date}`;
    return row.value;
  };
  const sortedDetailRecords = [...detailRecords].sort((left, right) => {
    const leftValue = sourceSortValue(left);
    const rightValue = sourceSortValue(right);
    if (leftValue === undefined && rightValue === undefined) return left.id.localeCompare(right.id, undefined, { numeric: true });
    if (leftValue === undefined) return 1;
    if (rightValue === undefined) return -1;
    const order = typeof leftValue === "string"
      ? leftValue.localeCompare(String(rightValue), undefined, { numeric: true })
      : leftValue - Number(rightValue);
    if (order === 0) return left.id.localeCompare(right.id, undefined, { numeric: true });
    return sourceDirection === "asc" ? order : -order;
  });
  const allSourceRows = sourceTableRows(safeMetric, sortedDetailRecords, storeById, vendorNameById);
  const sourcePageSize = 25;
  const sourceTotalPages = Math.max(1, Math.ceil(allSourceRows.length / sourcePageSize));
  const sourcePage = Number.isInteger(requestedSourcePage) ? Math.min(Math.max(requestedSourcePage, 1), sourceTotalPages) : 1;
  const sourceRows = allSourceRows.slice((sourcePage - 1) * sourcePageSize, sourcePage * sourcePageSize);
  const sourceColumnLabels: Record<TrendSourceSortId, string> = {
    record: "Record",
    store: "Store",
    service: "Work type / detail",
    date: "Date",
    value: detailKind === "vendor_outstanding" ? "Response" : safeMetric === "linked_invoice" ? "Linked amount" : safeMetric === "recorded_cost" ? "Cost" : "Result",
  };
  const sourceSortLinks: TrendAnalysisPageViewModel["sourceSortLinks"] = (Object.keys(sourceColumnLabels) as TrendSourceSortId[]).map((id) => {
    const defaultDirection: TrendSortDirection = id === "record" || id === "store" || id === "service" ? "asc" : "desc";
    const nextDirection = sourceSort === id ? (sourceDirection === "asc" ? "desc" : "asc") : defaultDirection;
    return {
      id,
      label: sourceColumnLabels[id],
      active: sourceSort === id,
      direction: sourceSort === id ? sourceDirection : undefined,
      link: {
        href: `${trendHref({
          view: "records",
          sourceSort: id,
          sourceDirection: nextDirection,
          sourcePage: undefined,
          detailKind,
          detailMonth: detailKind === "month" ? detailMonth : undefined,
          driverBreakdown: detailDriverBreakdown,
          driverValue: detailDriverValue,
          benchmarkStore: detailKind === "benchmark" ? benchmarkStore : undefined,
        })}#source-records`,
        label: `Sort source records by ${sourceColumnLabels[id].toLocaleLowerCase("en-US")} ${nextDirection === "asc" ? "ascending" : "descending"}`,
      },
    };
  });
  const sourcePageHref = (page: number) => `${trendHref({
    view: "records",
    detailKind,
    detailMonth: detailKind === "month" ? detailMonth : undefined,
    driverBreakdown: detailDriverBreakdown,
    driverValue: detailDriverValue,
    benchmarkStore: detailKind === "benchmark" ? benchmarkStore : undefined,
    sourcePage: String(page),
  })}#source-records`;
  const sourcePagination = paginationModel(allSourceRows.length, sourcePage, sourcePageSize, sourcePageHref);
  const sourceExportLink = href("/api/ops/trends/export", {
    metric: safeMetric,
    period: String(periodMonths),
    compare: comparison,
    breakdown,
    region: selectedRegion,
    store: selectedStore,
    category: selectedCategory,
    path: selectedPath,
    profile: selectedProfile,
    asset: selectedAsset,
    component: selectedComponent,
    vendor: selectedVendor,
    workType: selectedWorkType,
    costKind: selectedCostKind,
    storeSort,
    storeDirection,
    driverSort,
    driverDirection,
    sourceSort,
    sourceDirection,
    detailKind,
    detailMonth: detailKind === "month" ? detailMonth : undefined,
    driverBreakdown: detailDriverBreakdown,
    driverValue: detailDriverValue,
    benchmarkStore: detailKind === "benchmark" ? benchmarkStore : undefined,
  });

  const relatedMetricMap: Record<TrendMetricId, TrendMetricId[]> = {
    recorded_cost: ["work_orders", "service_visits", "linked_invoice", "vendor_response"],
    linked_invoice: ["recorded_cost", "work_orders", "service_visits", "vendor_response"],
    work_orders: ["recorded_cost", "service_visits", "vendor_response", "linked_invoice"],
    service_visits: ["work_orders", "recorded_cost", "vendor_response", "linked_invoice"],
    vendor_response: ["work_orders", "service_visits", "recorded_cost", "linked_invoice"],
    pm_completion: ["work_orders", "service_visits", "recorded_cost", "vendor_response"],
  };
  const measureDateBasis: Record<TrendMetricId, string> = {
    recorded_cost: "service dates on recorded work costs",
    linked_invoice: "invoice dates on confirmed links",
    work_orders: "work-order creation dates",
    service_visits: "recorded check-in dates",
    vendor_response: "first recorded vendor responses",
    pm_completion: "PM window end dates",
  };
  const vendorBasis: Record<TrendMetricId, string> = {
    recorded_cost: "the vendor on a same-date linked visit, then the assignment in effect by the cost date; otherwise the cost remains historically unattributed or ambiguous",
    linked_invoice: "the vendor named on the linked invoice",
    work_orders: "the current issued work-order assignment (not historical spend)",
    service_visits: "the vendor recorded at check-in",
    vendor_response: "the vendor assignment that sent the response",
    pm_completion: "the current issued work-order assignment (not historical spend)",
  };
  const relatedMeasures = relatedMetricMap[safeMetric].filter((relatedMetric) => allowedMetricIds.includes(relatedMetric)).slice(0, 3).map((relatedMetric) => {
    const related = buildAllRecords(fixture, session, relatedMetric).records;
    const effectiveWorkType = safeMetric === "pm_completion" ? "preventive" : selectedWorkType;
    const scoped = related.filter((row) => {
      const store = storeById.get(row.storeId);
      if (!store) return false;
      if (selectedRegion && store.regionId !== selectedRegion) return false;
      if (selectedStore && row.storeId !== selectedStore) return false;
      if (!maintenanceLinkMatches(row, true, effectiveWorkType)) return false;
      if (selectedVendor && row.vendorId !== selectedVendor) return false;
      return true;
    });
    const current = scoped.filter((row) => currentSet.has(row.periodKey) && row.localDate >= currentStart && row.localDate <= currentEnd);
    const prior = scoped.filter((row) => baselineStart && baselineEnd && baselineSet.has(row.periodKey) && row.localDate >= baselineStart && row.localDate <= baselineEnd);
    const currentAggregate = aggregate(relatedMetric, current);
    const priorAggregate = aggregate(relatedMetric, prior);
    const hasCurrent = additiveMetricHasData(relatedMetric, current);
    const hasPrior = comparison !== "none" && additiveMetricHasData(relatedMetric, prior);
    const relatedEvidence = relatedMetric === "pm_completion"
      ? `${current.reduce((sum, row) => sum + row.value, 0)} of ${current.length} eligible windows completed`
      : evidenceLabel(relatedMetric, current.length);
    return {
      metricId: relatedMetric,
      label: metricCopy[relatedMetric].label,
      value: formatMetric(relatedMetric, currentAggregate, false, hasCurrent),
      comparisonLabel: comparison === "none" || !hasCurrent || !hasPrior ? undefined : metricChangeLabel(relatedMetric, currentAggregate, priorAggregate),
      evidenceLabel: relatedEvidence,
      description: `Same operating and maintenance scope, measured by ${measureDateBasis[relatedMetric]}${selectedVendor ? `; vendor means ${vendorBasis[relatedMetric]}` : ""}.`,
      link: {
        href: trendHref({
          metric: relatedMetric,
          workType: effectiveWorkType,
          costKind: undefined,
          detailKind: undefined,
          detailMonth: undefined,
          driverBreakdown: undefined,
          driverValue: undefined,
          benchmarkStore: undefined,
          sourcePage: undefined,
          driverPage: undefined,
          storePage: undefined,
        }),
        label: `Analyze ${metricCopy[relatedMetric].label.toLocaleLowerCase("en-US")} with the same operating and maintenance scope`,
      },
    };
  });

  const accessibleLocationLabel = session.storeIds?.length === 1 && stores.length === 1
    ? `Store ${stores[0].storeNumber}`
    : session.regionIds?.length
      ? session.regionIds.map((id) => regionById.get(id)?.name).filter(Boolean).join(" + ") || "Regional scope"
      : "Companywide";
  const locationCrumbs = [
    {
      id: "company",
      label: accessibleLocationLabel,
      link: selectedRegion || selectedStore
        ? { href: trendHref({ region: undefined, store: undefined }), label: `Return to ${accessibleLocationLabel.toLocaleLowerCase("en-US")}` }
        : undefined,
    },
    ...(selectedRegion ? [{
      id: selectedRegion,
      label: regionById.get(selectedRegion)?.name ?? "Selected region",
      link: selectedStore ? { href: trendHref({ store: undefined }), label: "Return to the selected region" } : undefined,
    }] : []),
    ...(selectedStore ? [{ id: selectedStore, label: `Store ${storeById.get(selectedStore)?.storeNumber ?? "unknown"}` }] : []),
  ];
  const maintenanceSelected = Boolean(selectedCategory || selectedPath || selectedProfile || selectedAsset || selectedComponent);
  const maintenanceCrumbs = [
    {
      id: "all-service",
      label: "All service areas",
      link: maintenanceSelected
        ? { href: trendHref({ category: undefined, path: undefined, profile: undefined, asset: undefined, component: undefined }), label: "Return to all service areas" }
        : undefined,
    },
    ...(selectedCategory ? [{
      id: selectedCategory,
      label: sentence(selectedCategory),
      link: selectedPath || selectedProfile || selectedAsset || selectedComponent
        ? { href: trendHref({ path: undefined, profile: undefined, asset: undefined, component: undefined }), label: `Return to ${sentence(selectedCategory)}` }
        : undefined,
    }] : []),
    ...(selectedPath ? [{
      id: selectedPath,
      label: trendPathLabel(selectedPath),
      link: selectedProfile || selectedAsset || selectedComponent
        ? { href: trendHref({ profile: undefined, asset: undefined, component: undefined }), label: `Return to ${trendPathLabel(selectedPath)}` }
        : undefined,
    }] : []),
    ...(selectedProfile ? [{
      id: selectedProfile,
      label: profileById.get(selectedProfile)?.name ?? "Selected equipment type",
      link: selectedAsset || selectedComponent
        ? { href: trendHref({ asset: undefined, component: undefined }), label: "Return to the selected equipment type" }
        : undefined,
    }] : []),
    ...(selectedAsset ? [{
      id: selectedAsset,
      label: assetById.get(selectedAsset)?.name ?? "Selected equipment",
      link: selectedComponent ? { href: trendHref({ component: undefined }), label: "Return to the selected equipment" } : undefined,
    }] : []),
    ...(selectedComponent ? [{ id: selectedComponent, label: selectedComponent }] : []),
  ];
  const hasEvidenceFocus = hasExplicitEvidenceFocus;
  const investigation: TrendAnalysisPageViewModel["investigation"] = {
    trails: [
      { id: "location", label: "Location", crumbs: locationCrumbs },
      { id: "maintenance", label: "Maintenance", crumbs: maintenanceCrumbs },
      ...(selectedVendor ? [{
        id: "vendor" as const,
        label: "Vendor",
        crumbs: [{
          id: selectedVendor,
          label: vendorNameById.get(selectedVendor) ?? "Selected vendor",
          link: { href: trendHref({ vendor: undefined }), label: "Clear the vendor filter" },
        }],
      }] : []),
    ],
    evidence: hasEvidenceFocus ? {
      label: detailDriverLabel ? `${detailDriverLabel} records` : detailKind === "benchmark" ? "Peer comparison inputs" : detailKind === "month" ? `${monthLabel(detailMonth)} records` : `${detailPeriodLabel} records`,
      description: detailKind === "benchmark"
        ? "Only the calculation-input table is narrowed to this peer comparison. Open an input to inspect the underlying records for that peer equipment or store."
        : "Only the exact-record table is narrowed to this evidence set. The analysis above keeps the scope shown in the trails.",
      clearLink: {
        href: trendHref({ view: "overview", detailKind: undefined, detailMonth: undefined, driverBreakdown: undefined, driverValue: undefined, benchmarkStore: undefined, sourcePage: undefined }),
        label: "Clear the exact-record focus",
      },
    } : undefined,
  };
  const locationScopeParts = selectedStore
    ? [selectedRegion ? regionById.get(selectedRegion)?.name : undefined, `Store ${storeById.get(selectedStore)?.storeNumber ?? "unknown"}`]
    : [selectedRegion ? regionById.get(selectedRegion)?.name : accessibleLocationLabel];
  const scopeParts = [...locationScopeParts, selectedWorkType ? selectedWorkType === "preventive" ? "Preventive maintenance" : "Reactive work" : undefined, selectedCostKind ? `${sentence(selectedCostKind)} cost` : undefined, selectedCategory ? sentence(selectedCategory) : undefined, selectedPath ? trendPathLabel(selectedPath) : undefined, selectedProfile ? profileById.get(selectedProfile)?.name : undefined, selectedAsset ? assetById.get(selectedAsset)?.name : undefined, selectedComponent, selectedVendor ? vendorNameById.get(selectedVendor) : undefined].filter(Boolean);
  const scopeSummary = [
    scopeParts.join(" · "),
    `${dateLabel(currentStart)}–${dateLabel(currentEnd)}`,
    metricCopy[safeMetric].label,
    comparison === "none" ? "No date comparison" : `Compared with ${comparison === "previous_year" ? "the same months last year" : `the prior ${periodMonths} months`}`,
  ].join(" · ");
  const viewCopy: Array<{ id: TrendAnalysisView; label: string; description: string }> = [
    { id: "overview", label: "Overview", description: "Result, findings, and monthly pattern" },
    { id: "drivers", label: "Change drivers", description: `What changed by ${breakdownLabels[breakdown]}` },
    { id: "stores", label: "Compare stores", description: "Equipment-matched company peers" },
    { id: "vendors", label: "Vendor follow-through", description: "Response speed, coverage, and nonresponse" },
    { id: "planning", label: "Planning", description: "At-the-recent-pace scenario" },
    { id: "records", label: "Source records", description: "Exact records behind each number" },
  ];
  const views = viewCopy.map((view) => ({
    ...view,
    link: {
      href: trendHref({
        view: view.id,
        detailKind: view.id === "records" ? detailKind : undefined,
        detailMonth: view.id === "records" && detailKind === "month" ? detailMonth : undefined,
        driverBreakdown: view.id === "records" ? detailDriverBreakdown : undefined,
        driverValue: view.id === "records" ? detailDriverValue : undefined,
        benchmarkStore: view.id === "records" && detailKind === "benchmark" ? benchmarkStore : undefined,
        sourcePage: undefined,
      }),
      label: `Open ${view.label.toLocaleLowerCase("en-US")}`,
    },
  }));
  const largestVarianceRow = [...benchmarkRows]
    .filter((row) => row.varianceValue !== undefined)
    .sort((left, right) => Math.abs(right.varianceValue ?? 0) - Math.abs(left.varianceValue ?? 0))[0];
  const changeTone = comparison === "none" || !currentHasData || !baselineHasData ? "neutral" : valueTone(safeMetric, currentValue, baselineValue);
  const insights: TrendAnalysisPageViewModel["insights"] = [];
  if (largestVarianceRow && (largestVarianceRow.signalRank >= 2 || Boolean(selectedStore))) {
    insights.push({
      id: `store-difference:${largestVarianceRow.id}:${safeMetric}:${currentStart}:${currentEnd}`,
      findingType: "store_difference",
      eyebrow: portfolioWideHistoricalIncrease ? "Largest store difference in a broader increase" : "Store to investigate",
      title: `${largestVarianceRow.label} · ${largestVarianceRow.signalLabel}`,
      detail: largestVarianceRow.findingExplanation ?? (additive
        ? `${largestVarianceRow.comparableActualLabel} on matched equipment versus a ${largestVarianceRow.rangeLabel} historical company-peer range.`
        : `${largestVarianceRow.actualLabel} versus a ${largestVarianceRow.rangeLabel} company-peer operating range.`),
      magnitudeLabel: largestVarianceRow.varianceLabel,
      patternLabel: largestVarianceRow.persistenceLabel,
      evidenceLabel: `${largestVarianceRow.coverageLabel}${largestVarianceRow.referenceHistoryLabel ? ` · ${largestVarianceRow.referenceHistoryLabel}` : ""}`,
      evidenceLimit: largestVarianceRow.evidenceQualityLabel,
      sourceIds: currentRecords.filter((record) => record.storeId === largestVarianceRow.id).map((record) => record.id),
      actionLabel: `Investigate ${largestVarianceRow.label}`,
      tone: largestVarianceRow.signalTone,
      link: largestVarianceRow.focusLink,
    });
  }

  const groupedCurrentSources = [...currentRecords.reduce((groups, row) => {
    const id = row.workOrderId ?? row.invoiceId ?? row.visitId ?? row.pmOccurrenceId ?? row.id;
    const existing = groups.get(id);
    groups.set(id, existing
      ? { ...existing, value: existing.value + row.value, sourceIds: [...existing.sourceIds, row.id] }
      : { id, value: row.value, label: row.label, href: row.href, storeId: row.storeId, sourceIds: [row.id] });
    return groups;
  }, new Map<string, { id: string; value: number; label: string; href: string; storeId: string; sourceIds: string[] }>()).values()]
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const largestCurrentSource = groupedCurrentSources[0];
  const largestSourceShare = largestCurrentSource && currentValue ? Math.round(Math.abs((largestCurrentSource.value / currentValue) * 100)) : 0;
  if (additive && largestCurrentSource && largestSourceShare >= 35) {
    const sourceStore = storeById.get(largestCurrentSource.storeId);
    insights.push({
      id: `large-source:${largestCurrentSource.id}:${safeMetric}:${currentStart}:${currentEnd}`,
      findingType: "large_job",
      eyebrow: "Concentrated in a large job",
      title: `${largestCurrentSource.label} · ${formatMetric(safeMetric, largestCurrentSource.value)}`,
      detail: `${largestSourceShare}% of the selected result comes from this one source record${sourceStore ? ` at Store ${sourceStore.storeNumber}` : ""}. That concentration is an investigation fact, not proof the work was avoidable or nonrecurring.`,
      magnitudeLabel: `${largestSourceShare}% of selected result`,
      patternLabel: "Individual-job concentration",
      evidenceLabel: `${largestCurrentSource.sourceIds.length} source ${largestCurrentSource.sourceIds.length === 1 ? "entry" : "entries"}`,
      sourceIds: largestCurrentSource.sourceIds,
      actionLabel: "Open the major work record",
      tone: "info",
      link: { href: largestCurrentSource.href, label: `Open ${largestCurrentSource.label}` },
    });
  }

  const recurringByAsset = new Map<string, { records: TrendSourceRecord[]; workOrderIds: Set<string> }>();
  for (const record of currentRecords.filter((row) => row.workType === "reactive" && recordAssetIds(row).length === 1)) {
    const assetId = recordAssetIds(record)[0];
    const existing = recurringByAsset.get(assetId) ?? { records: [], workOrderIds: new Set<string>() };
    existing.records.push(record);
    if (record.workOrderId) existing.workOrderIds.add(record.workOrderId);
    recurringByAsset.set(assetId, existing);
  }
  const recurring = [...recurringByAsset.entries()]
    .filter(([, value]) => value.workOrderIds.size >= 3)
    .sort((left, right) => right[1].workOrderIds.size - left[1].workOrderIds.size)[0];
  if (recurring && insights.length < 3) {
    const [assetId, evidence] = recurring;
    const asset = assetById.get(assetId);
    insights.push({
      id: `recurring-work:${assetId}:${currentStart}:${currentEnd}`,
      findingType: "recurring_work",
      eyebrow: "Repeated reactive work",
      title: `${asset?.name ?? "Equipment"} · ${evidence.workOrderIds.size} work orders`,
      detail: "Several reactive jobs are linked to the same equipment during the selected dates. Planned return work and PM remain separate; this pattern warrants equipment-history review but does not by itself establish a vendor failure.",
      magnitudeLabel: `${evidence.workOrderIds.size} reactive work orders`,
      patternLabel: "Repeated equipment-linked activity",
      evidenceLabel: `${evidence.records.length} source records`,
      sourceIds: evidence.records.map((record) => record.id),
      actionLabel: "Review the equipment history",
      tone: "warning",
      link: { href: `/app/equipment/${assetId}`, label: `Open ${asset?.name ?? "equipment"} history` },
    });
  }
  if (vendorAccountability.overdueCount > 0 && insights.length < 3) {
    insights.push({
      id: `vendor-nonresponse:${currentStart}:${currentEnd}:${selectedVendor ?? "all"}`,
      findingType: "vendor_follow_through",
      eyebrow: "Vendor follow-through",
      title: `${vendorAccountability.overdueCount} overdue unanswered request${vendorAccountability.overdueCount === 1 ? "" : "s"}`,
      detail: `${vendorAccountability.responseCoverageLabel}. The oldest outstanding request is ${vendorAccountability.oldestOutstandingLabel} old. Response coverage and median speed use different, explicitly labeled time bases.`,
      magnitudeLabel: `${vendorAccountability.awaitingCount} awaiting response`,
      patternLabel: "Unanswered issuance cohort",
      evidenceLabel: vendorAccountability.cohortLabel,
      sourceIds: overdueUnanswered.map((row) => row.latestIssuance.id),
      actionLabel: "Review outstanding commitments",
      tone: "warning",
      link: { href: trendHref({ view: "vendors" }), label: "Open vendor follow-through" },
    });
  }
  const absoluteChange = currentValue - baselineValue;
  const materialChangeThreshold = moneyMetric ? 100_000 : safeMetric === "vendor_response" ? 2 : safeMetric === "pm_completion" ? 5 : 2;
  const materialPeriodChange = comparison !== "none" && currentHasData && baselineHasData && Math.abs(absoluteChange) >= materialChangeThreshold;
  if (materialPeriodChange && insights.length < 3) {
    insights.push({
      id: `period-change:${safeMetric}:${currentStart}:${currentEnd}:${comparison}`,
      findingType: "period_change",
      eyebrow: "Material period change",
      title: differenceSentence(safeMetric, currentValue, baselineValue),
      detail: historicalPortfolioContext ?? "Open the reconciled change view to see which locations or maintenance segments account for the net movement.",
      magnitudeLabel: `${absoluteChange >= 0 ? "+" : "−"}${formatMetric(safeMetric, Math.abs(absoluteChange))}`,
      patternLabel: "Period-over-period movement",
      evidenceLabel: `${currentEvidence} now · ${comparisonEvidence} in the comparison`,
      sourceIds: [...currentRecords, ...baselineRecords].map((record) => record.id),
      actionLabel: "Explain the change",
      tone: changeTone,
      link: { href: trendHref({ view: "drivers" }), label: "Open the reconciled change drivers" },
    });
  }
  if (!insights.length) {
    insights.push({
      id: `calm:${safeMetric}:${currentStart}:${currentEnd}`,
      findingType: "calm_state",
      eyebrow: "No material finding",
      title: currentHasData ? "No supported exception stands out in this scope" : "No measured result is available",
      detail: currentHasData
        ? "The selected result does not cross the material-change or evidence-quality rules used for findings. The chart and source records remain available for routine review."
        : "Broaden the dates or scope, or review classification coverage. Missing observations are not treated as measured zero.",
      evidenceLabel: currentEvidence,
      actionLabel: "Review the source records",
      tone: "positive",
      link: { href: `${trendHref({ view: "records", detailKind: "current" })}#source-records`, label: "Open the selected source records" },
    });
  }
  const selectedPeriodEvidenceLink = comparison === "none"
    ? summary.find((item) => item.id === "current")!.link
    : summary.find((item) => item.id === "change")!.link;
  const mainResult: TrendAnalysisPageViewModel["mainResult"] = {
    value: formatMetric(safeMetric, currentValue, false, currentHasData),
    absoluteChangeLabel: comparison === "none"
      ? "No comparison selected"
      : !currentHasData || !baselineHasData
        ? "Absolute change unavailable"
        : `${absoluteChange >= 0 ? "+" : "−"}${formatMetric(safeMetric, Math.abs(absoluteChange))}`,
    relativeChangeLabel: comparison !== "none" && currentHasData && baselineHasData && baselineValue !== 0 && safeMetric !== "vendor_response" && safeMetric !== "pm_completion"
      ? ratioLabel(currentValue, baselineValue)
      : undefined,
    comparisonBasis: compareLabel,
    evidenceLabel: currentEvidence,
    tone: changeTone,
    link: selectedPeriodEvidenceLink,
  };

  const canonicalQuery = trendHref({
    detailKind: undefined,
    detailMonth: undefined,
    driverBreakdown: undefined,
    driverValue: undefined,
    benchmarkStore: undefined,
    sourcePage: undefined,
    driverPage: undefined,
    storePage: undefined,
  }).split("?")[1] ?? "";
  const partialPeriodNote = baselineStart && baselineEnd && currentEnd !== endOfMonth(monthKey(currentEnd))
    ? `${longMonthLabel(monthKey(currentEnd)).split(" ")[0]} is not complete, so both ranges compare the first ${Number(currentEnd.slice(-2))} days of their final month.`
    : undefined;
  const comparisonNote = [comparisonFallbackNote, partialPeriodNote].filter(Boolean).join(" ") || undefined;
  const filterNotice = [...new Set(removedFilters)].length
    ? `The analysis removed ${[...new Set(removedFilters)].join(", ")} instead of silently broadening the result.`
    : undefined;
  const exportRows = options.includeExportRows ? sortedDetailRecords.map((row): TrendExportRecord => {
    const store = storeById.get(row.storeId);
    const units = row.units ?? metricUnits(safeMetric);
    const sourceId = row.sourceKind === "raw_peer_observation" && row.sourceIds?.length === 1 ? row.sourceIds[0] : row.id;
    return {
      sourceId,
      sourceKind: row.sourceKind ?? "source_record",
      recordLabel: row.label,
      detail: row.detail,
      sourceDate: row.date,
      localDate: row.localDate,
      periodKey: row.periodKey,
      timeBasis: detailKind === "vendor_outstanding" ? "assignment first issuance date" : row.sourceKind === "calculated_peer_contribution" ? "historical peer equipment-month contribution to the selected target month" : measureDateBasis[safeMetric],
      rawValue: row.value,
      amountMinor: units === "minor_currency" ? row.value : undefined,
      currency: row.currency ?? (units === "minor_currency" ? "USD" : undefined),
      units,
      storeId: row.storeId,
      storeNumber: store?.storeNumber,
      workOrderId: row.workOrderId,
      invoiceId: row.invoiceId,
      visitId: row.visitId,
      pmOccurrenceId: row.pmOccurrenceId,
      categoryKeys: recordCategoryKeys(row),
      assetIds: recordAssetIds(row),
      componentNames: recordComponentNames(row),
      vendorId: row.vendorId,
      providerAttribution: row.providerAttribution,
      providerAttributionLabel: row.providerAttributionLabel,
      cohortId: row.cohortId,
      referenceStart: row.referenceStart,
      referenceEnd: row.referenceEnd,
      uncappedInput: row.rawValue,
      cappedInput: row.cappedValue,
      weight: row.weight,
      exposureFactor: row.exposureFactor,
      coverageStatus: row.coverageStatus,
      contributingSourceIds: row.sourceIds ?? [sourceId],
      sourcePath: row.href,
    };
  }) : undefined;

  return {
    state: { kind: "ready" },
    page: {
      title: "Trends",
      eyebrow: "What changed and where",
      description: "See the main result and evidence-backed findings first, then investigate the location, equipment, vendor follow-through, or exact source records.",
      scopeLabel: scopeParts.join(" · "),
      periodLabel: `${dateLabel(currentStart)}–${dateLabel(currentEnd)}`,
      updatedLabel: dateLabel(currentEnd),
      secondaryAction: { href: "/app/spend", label: "View spending" },
    },
    canonicalQuery,
    activeView,
    scopeSummary,
    filterNotice,
    analysisContext: [
      { label: "Locations", value: locationScopeParts.filter(Boolean).join(" · ") },
      { label: "Measure", value: metricCopy[safeMetric].label },
      { label: "Dates", value: `${dateLabel(currentStart)}–${dateLabel(currentEnd)}` },
      { label: "Comparison", value: compareLabel },
    ],
    mainResult,
    views,
    filterAction: "/app/trends",
    filters: [
      { id: "metric", label: "Track", value: safeMetric, group: "analysis", options: allowedMetricIds.map((value) => filterOption(value, metricCopy[value].label)) },
      { id: "period", label: "Time range", value: String(periodMonths), group: "analysis", options: [filterOption("3", "Last 3 months"), filterOption("6", "Last 6 months"), filterOption("12", "Last 12 months"), filterOption("24", "Last 24 months")] },
      { id: "compare", label: "Compare to", value: comparison, group: "analysis", options: [filterOption("previous_year", "Same period last year"), filterOption("previous_period", `Earlier ${periodMonths} months`), filterOption("none", "Do not compare")] },
      { id: "breakdown", label: "Show the change by", value: breakdown, group: "analysis", options: [filterOption("region", "Region"), filterOption("store", "Store"), filterOption("category", "Service area"), filterOption("group", "Equipment group"), filterOption("profile", "Equipment type"), filterOption("component", "Component name"), filterOption("vendor", "Vendor")] },
      { id: "workType", label: "Work type", value: selectedWorkType ?? "", group: "analysis", options: [filterOption("", "All work"), ...(safeMetric === "pm_completion" ? [] : [filterOption("reactive", "Reactive work")]), filterOption("preventive", "Preventive maintenance")] },
      { id: "region", label: "Region", value: selectedRegion ?? "", group: "operating_scope", options: [filterOption("", "All regions"), ...fixture.regions.filter((row) => row.organizationId === session.organizationId && stores.some((store) => store.regionId === row.id)).map((row) => filterOption(row.id, row.name))] },
      { id: "store", label: "Store", value: selectedStore ?? "", group: "operating_scope", options: [filterOption("", "All stores"), ...stores.filter((store) => !selectedRegion || store.regionId === selectedRegion).map((store) => filterOption(store.id, `Store ${store.storeNumber} · ${store.name}`))] },
      { id: "category", label: "Service area", value: selectedCategory ?? "", group: "maintenance_scope", options: [filterOption("", "All service areas"), ...categories.map((value) => filterOption(value, sentence(value)))] },
      ...(safeMetric === "recorded_cost" ? [{ id: "costKind", label: "Cost type", value: selectedCostKind ?? "", group: "maintenance_scope" as const, options: [filterOption("", "All cost types"), filterOption("labor", "Labor"), filterOption("parts", "Parts"), filterOption("travel", "Travel"), filterOption("materials", "Materials"), filterOption("other", "Other")] }] : []),
      { id: "path", label: "Equipment group", value: selectedPath ?? "", group: "maintenance_scope", options: [filterOption("", "All groups"), ...(selectedPath && !paths.includes(selectedPath) ? [filterOption(selectedPath, trendPathLabel(selectedPath))] : []), ...paths.map((value) => filterOption(value, trendPathLabel(value)))] },
      { id: "profile", label: "Equipment type", value: selectedProfile ?? "", group: "maintenance_scope", options: [filterOption("", "All equipment types"), ...profiles.map((profile) => filterOption(profile.id, profile.name))] },
      { id: "asset", label: "Equipment", value: selectedAsset ?? "", group: "maintenance_scope", helperText: selectedStore ? "Choose one equipment record at this store, or leave all equipment selected." : "Choose a store first to select one equipment record.", options: [filterOption("", selectedStore ? "All equipment at this store" : "All equipment · choose a store for one record"), ...(selectedStore ? optionAssets.map((asset) => filterOption(asset.id, asset.name)) : [])] },
      { id: "component", label: selectedAsset ? "Component" : "Component name", value: selectedComponent ?? "", group: "maintenance_scope", options: [filterOption("", "All components"), ...components.map((value) => filterOption(value, value))] },
      { id: "vendor", label: "Vendor", value: selectedVendor ?? "", group: "maintenance_scope", helperText: `For this measure, vendor means ${vendorBasis[safeMetric]}.`, options: [filterOption("", "All vendors"), ...vendors.map((vendor) => filterOption(vendor.id, vendor.status === "approved" ? vendor.name : `${vendor.name} · ${sentence(vendor.status)}`))] },
    ],
    clearFiltersHref: "/app/trends",
    metricId: safeMetric,
    metricLabel: metricCopy[safeMetric].label,
    metricDefinition: metricCopy[safeMetric].definition,
    comparisonId: comparison,
    comparisonLabel: compareLabel,
    currentPeriodName: "Selected dates",
    comparisonPeriodName: comparison === "none" ? undefined : comparison === "previous_year" ? "Same months last year" : `Previous ${periodMonths} months`,
    currentPeriodLabel: `${dateLabel(currentStart)}–${dateLabel(currentEnd)}`,
    comparisonPeriodLabel: baselineStart && baselineEnd ? `${dateLabel(baselineStart)}–${dateLabel(baselineEnd)}` : undefined,
    comparisonNote,
    investigation,
    relatedMeasures,
    summary,
    series,
    outlook,
    insights,
    vendorAccountability,
    drivers: {
      breakdownId: breakdown,
      title: `What changed by ${breakdownLabels[breakdown]}`,
      description: additive
        ? `See which ${breakdownLabels[breakdown]}s pushed the total up or down. Focus the analysis to keep investigating, or open only the exact records.`
        : `Compare the measured result for each ${breakdownLabels[breakdown]}. Focus the analysis to keep investigating, or open only the exact records.`,
      reconciliationLabel: additive
        ? "The rows below reconcile to the selected and comparison totals above."
        : "Each row is an independent segment result. Rates and medians do not add up to the overall result.",
      sampleLabel: `${driverRows.length} ${breakdownLabels[breakdown]}${driverRows.length === 1 ? "" : "s"}`,
      sortLinks: driverSortLinks,
      pagination: driverPagination,
      rows: visibleDriverRows,
    },
    benchmark: {
      title: selectedStore
        ? "How this store compares"
        : safeMetric === "linked_invoice"
          ? "Linked invoice amount versus similar equipment"
          : safeMetric === "recorded_cost"
            ? "Recorded work cost versus similar equipment"
            : additive ? `${metricCopy[safeMetric].label} versus similar equipment` : "Compare stores",
      description: safeMetric === "linked_invoice"
        ? `Shows whether each store has more or less confirmed invoice amount linked to matched equipment than other stores in this user's accessible company scope—not an external industry benchmark.${historicalPortfolioContext ? ` ${historicalPortfolioContext}` : ""}`
        : safeMetric === "recorded_cost"
          ? `Shows whether each store recorded more or less work cost on matched equipment than other stores in this user's accessible company scope—not an external industry benchmark.${historicalPortfolioContext ? ` ${historicalPortfolioContext}` : ""}`
          : additive
          ? `Shows whether each store recorded more or less ${safeMetric === "work_orders" ? "work-order activity" : "service-visit activity"} on matched equipment than other accessible company stores.${historicalPortfolioContext ? ` ${historicalPortfolioContext}` : ""}`
          : "Shows how each store compares with measured results at other stores in the accessible company scope, not with an external benchmark.",
      methodology: additive
        ? `The historical peer range uses up to ${observedReferenceMonthCount} reference months for the same equipment cohort at other accessible company stores, aligned by calendar month. Peer observations are normalized for documented installation/retirement exposure; the target expectation is prorated by active days. A quiet month is a measured zero only when explicit store/measure recording coverage and lifecycle dates both support it. Unknown coverage is excluded, not converted to zero. Extreme peer rates are winsorized before equal-store weighting; monthly 25th–75th percentile ranges are then accumulated for the selected equipment exposure. That descriptive range is not a prediction interval or failure probability.`
        : "The peer range is the descriptive 25th–75th percentile at other accessible company stores. A comparison appears only when at least three other stores have measured results; it is not a prediction interval or external benchmark.",
      sampleLabel: additive ? `${benchmarkRows.length} stores · ${observedReferenceMonthCount} reference months` : `${benchmarkRows.length} stores · ${currentPeerRecords.length} records`,
      sortLinks,
      pagination: benchmarkPagination,
      rows: visibleBenchmarkRows,
    },
    sourceTable: {
      id: "trend-sources",
      caption: detailKind === "vendor_outstanding" ? detailPeriodLabel : detailKind === "benchmark"
        ? `${metricCopy[safeMetric].label} peer calculation inputs for ${detailPeriodLabel}`
        : `${metricCopy[safeMetric].label} records for ${detailPeriodLabel}`,
      columns: [
        { key: "record", label: "Record" },
        { key: "store", label: "Store" },
        { key: "service", label: "Work type / detail" },
        { key: "date", label: "Date" },
        { key: "value", label: detailKind === "vendor_outstanding" ? "Response" : safeMetric === "linked_invoice" ? "Linked amount" : safeMetric === "recorded_cost" ? "Cost" : "Result", align: "end" },
      ],
      rows: sourceRows,
    },
    sourceMeasureLabel: detailKind === "vendor_outstanding" ? "Vendor response evidence" : undefined,
    sourceHeading: detailKind === "vendor_outstanding" ? "Outstanding assignments in this issuance cohort" : detailKind === "benchmark" ? "Inputs behind this comparison" : "Records behind this number",
    sourceDescription: detailKind === "benchmark"
      ? `${detailRecords.filter((row) => row.sourceKind === "calculated_peer_contribution").length} calculated contribution${detailRecords.filter((row) => row.sourceKind === "calculated_peer_contribution").length === 1 ? "" : "s"} and ${detailRecords.filter((row) => row.sourceKind === "raw_peer_observation").length} raw historical record${detailRecords.filter((row) => row.sourceKind === "raw_peer_observation").length === 1 ? "" : "s"} are included. Calculated rows expose uncapped input, capping, peer weight, and target exposure; raw rows open the actual historical source record.`
      : `${detailRecords.length} record${detailRecords.length === 1 ? "" : "s"} included for the selected filters and dates.`,
    sourceSortLinks,
    sourceSummary: detailKind === "benchmark"
      ? `${detailRecords.length} calculation input${detailRecords.length === 1 ? "" : "s"}`
      : `${detailRecords.length} record${detailRecords.length === 1 ? "" : "s"}`,
    sourcePeriodLabel: detailPeriodLabel,
    sourceExportLink: { href: sourceExportLink, label: detailKind === "benchmark" ? "Download every peer comparison input as CSV" : "Download every source record in this exact analysis as CSV" },
    sourcePagination,
    notes: [
      "Use Focus analysis to narrow every chart and comparison. Use View exact records when you only want the evidence behind one number.",
      "The at-the-recent-pace planning scenario uses twelve complete months independently of the displayed chart window. It does not predict equipment failures, set a budget, or claim savings.",
      "Store comparisons use matched equipment at other accessible company stores and never use the selected store to set its own expectation. Spending above or below the range is an investigation fact, not a maintenance-quality judgment.",
      "A zero observation requires explicit recording coverage for the source measure and store, independently of equipment installation/retirement exposure. Unknown coverage and periods before installation are not treated as zero.",
      "Events are placed in months using each store's local time zone.",
      `Vendor attribution for this measure uses ${vendorBasis[safeMetric]}.`,
    ],
    exportRows,
  };
}
