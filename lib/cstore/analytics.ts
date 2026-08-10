import type {
  Asset,
  CostLine,
  DemoDataset,
  EntityId,
  ExceptionRecord,
  Invoice,
  InvoiceWorkLink,
  MaintenanceCategory,
  MinorUnits,
  RecordScope,
  SpendBasis,
  SpendFilter,
  Store,
  Vendor,
  VendorIssuance,
  Visit,
  WorkOrder,
} from "./types";

const TERMINAL_WORK_STATUSES = new Set<WorkOrder["status"]>(["closed", "cancelled"]);

export interface Metric<TValue = number> {
  value: TValue;
  sourceRecordIds: EntityId[];
  definition: string;
}

export interface ClassificationCoverage {
  classifiedAmountMinor: MinorUnits;
  unclassifiedAmountMinor: MinorUnits;
  classifiedPercentage: number;
  classifiedSourceCount: number;
  totalSourceCount: number;
}

export interface SpendSourceRow {
  sourceRecordId: EntityId;
  basis: SpendBasis;
  amountMinor: MinorUnits;
  currency: "USD";
  occurredAt: string;
  workOrderId: EntityId;
  storeId: EntityId;
  regionId?: EntityId;
  categoryId?: EntityId;
  assetId?: EntityId;
  vendorId?: EntityId;
  invoiceId?: EntityId;
}

export interface SpendMetric extends Metric<MinorUnits> {
  basis: SpendBasis;
  currency: "USD";
  scope: RecordScope;
  classificationCoverage: ClassificationCoverage;
}

export type SpendGroup = "region" | "store" | "category" | "vendor" | "month";

export interface SpendBreakdownRow {
  key: string;
  label: string;
  amountMinor: MinorUnits;
  percentage: number;
  sourceRecordIds: EntityId[];
  workOrderIds: EntityId[];
  sourceCount: number;
}

export interface PortfolioSummary {
  invoicedSpend: SpendMetric;
  openWork: Metric;
  urgentOpenWork: Metric;
  techniciansOnsite: Metric;
  openExceptions: Metric;
  criticalExceptions: Metric;
  invoicesNeedingReview: Metric;
  pmCompliance: Metric<number>;
}

export interface WorkOrderDetail {
  workOrder: WorkOrder;
  store: Store;
  category?: MaintenanceCategory;
  asset?: Asset;
  request?: DemoDataset["requests"][number];
  assignments: DemoDataset["assignments"];
  vendorIssuances: VendorIssuance[];
  visits: Visit[];
  costLines: CostLine[];
  invoiceLinks: InvoiceWorkLink[];
  invoices: Invoice[];
  documents: DemoDataset["documents"];
  exceptions: ExceptionRecord[];
  auditEvents: DemoDataset["auditEvents"];
}

export interface StoreDashboard {
  store: Store;
  invoicedSpend: SpendMetric;
  openWork: WorkOrder[];
  activeVisits: Visit[];
  assets: Asset[];
  pmOccurrences: DemoDataset["pmOccurrences"];
  exceptions: ExceptionRecord[];
  categorySpend: SpendBreakdownRow[];
}

export type SearchResultKind = "store" | "vendor" | "work_order" | "asset" | "invoice";

export interface SearchResult {
  kind: SearchResultKind;
  id: EntityId;
  title: string;
  subtitle: string;
  score: number;
  matchedOn: string[];
  storeId?: EntityId;
}

export interface VendorSearchResult {
  vendor: Vendor;
  score: number;
  matchedOn: string[];
  coversStore: boolean;
  preferredForStore: boolean;
}

export interface CostOutlier {
  storeId: EntityId;
  categoryId: EntityId;
  amountMinor: MinorUnits;
  peerMedianMinor: MinorUnits;
  multipleOfMedian: number;
  sourceRecordIds: EntityId[];
  workOrderIds: EntityId[];
  rule: string;
}

export interface LifecycleCandidate {
  asset: Asset;
  repairSpendMinor: MinorUnits;
  replacementEstimateMinor: MinorUnits;
  repairToReplacementPercentage: number;
  correctiveWorkOrderCount: number;
  assetAgeYears: number;
  expectedLifePercentage: number;
  reasons: string[];
  thresholds: string[];
  sourceRecordIds: EntityId[];
  workOrderIds: EntityId[];
}

/**
 * Organization policy used only to surface factual lifecycle review reasons.
 * It is intentionally not a score and never produces a repair/replace decision.
 */
export interface LifecycleAnalyticsPolicy {
  nearExpectedLifePercentage: number;
  reactiveWorkOrders12Months: number;
  confirmedComponentWorkOrders12Months: number;
  cleanCostShare12MonthsPercentage: number;
  cleanCostShare24MonthsPercentage: number;
}

export interface LifecycleAnalyticsOptions {
  policy?: Partial<LifecycleAnalyticsPolicy>;
}

export type LifecycleWarrantyStatus = "active" | "expired" | "not_started" | "not_recorded" | "unknown";

export interface LifecycleWarrantyFacts {
  status: LifecycleWarrantyStatus;
  provider?: string;
  startsOn?: string;
  endsOn?: string;
  coverage?: string;
  reference?: string;
  sourceRecordIds: EntityId[];
}

export interface LifecycleCostWindow {
  months: 12 | 24;
  from: string;
  to: string;
  /** Current authorization/NTE evidence. This is not actual maintenance cost. */
  authorizedMinor: MinorUnits;
  authorizedSourceRecordIds: EntityId[];
  /** Finalized cost entered directly against the work order. */
  recordedMinor: MinorUnits;
  recordedSourceRecordIds: EntityId[];
  /** Matched invoice allocation with no open invoice-review fact. */
  cleanInvoiceMinor: MinorUnits;
  cleanInvoiceSourceRecordIds: EntityId[];
  /** Invoice allocation whose match, invoice, or open exception still needs review. */
  needsReviewInvoiceMinor: MinorUnits;
  needsReviewInvoiceSourceRecordIds: EntityId[];
  /**
   * De-duplicated actual-cost evidence: recorded cost for a work order when
   * present, otherwise its clean invoice allocation. Authorizations are never
   * silently treated as actual cost.
   */
  confirmedActualMinor: MinorUnits;
  confirmedActualSourceRecordIds: EntityId[];
  confirmedActualShareOfReplacementPercentage?: number;
}

export interface LifecycleActivityWindow {
  months: 12 | 24;
  from: string;
  to: string;
  distinctWorkOrderCount: number;
  workOrderIds: EntityId[];
  distinctVisitCount: number;
  visitIds: EntityId[];
  temporaryOrUnresolvedWorkOrderIds: EntityId[];
}

export interface LifecyclePmWindow {
  months: 12 | 24;
  from: string;
  to: string;
  occurrenceCount: number;
  completedCount: number;
  skippedCount: number;
  overdueCount: number;
  dueCount: number;
  sourceRecordIds: EntityId[];
}

export interface LifecyclePmFacts {
  planCount: number;
  activePlanCount: number;
  planIds: EntityId[];
  trailing12Months: LifecyclePmWindow;
  trailing24Months: LifecyclePmWindow;
}

/**
 * A recurrence means the same explicitly tracked component is present on at
 * least two distinct completed reactive work orders. It does not claim that
 * the problem, cause, or failure mode was the same because the current source
 * model does not yet capture those codes.
 */
export interface ConfirmedComponentRecurrence {
  componentId: EntityId;
  componentCode: string;
  componentName: string;
  windowMonths: 12 | 24;
  distinctWorkOrderCount: number;
  workOrderIds: EntityId[];
  distinctVisitCount: number;
  visitIds: EntityId[];
  firstWorkAt: string;
  latestWorkAt: string;
  sourceRecordIds: EntityId[];
}

export type LifecycleReviewReasonCode =
  | "expected_life_reference_near"
  | "expected_life_reference_reached"
  | "reactive_work_order_volume"
  | "confirmed_component_recurrence"
  | "clean_cost_share_12_months"
  | "clean_cost_share_24_months"
  | "invoice_cost_needs_review"
  | "temporary_or_unresolved_work"
  | "pm_overdue";

export interface LifecycleReviewReason {
  code: LifecycleReviewReasonCode;
  category: "service_life" | "activity" | "component" | "cost" | "invoice_evidence" | "pm";
  label: string;
  detail: string;
  observedValue?: number;
  thresholdValue?: number;
  unit?: "count" | "percentage" | "minor_units";
  sourceRecordIds: EntityId[];
}

export interface AssetLifecycleDecisionFacts {
  asset: Asset;
  asOf: string;
  assetAgeYears?: number;
  expectedLifeYears: number;
  expectedLifePercentage?: number;
  expectedReplacementOn?: string;
  expectedReplacementYear?: number;
  currentReplacementEstimateMinor: MinorUnits;
  currency: "USD";
  warranty: LifecycleWarrantyFacts;
  costs: {
    trailing12Months: LifecycleCostWindow;
    trailing24Months: LifecycleCostWindow;
  };
  reactiveActivity: {
    trailing12Months: LifecycleActivityWindow;
    trailing24Months: LifecycleActivityWindow;
  };
  pm: LifecyclePmFacts;
  confirmedComponentRecurrences: {
    trailing12Months: ConfirmedComponentRecurrence[];
    trailing24Months: ConfirmedComponentRecurrence[];
  };
  reviewReasons: LifecycleReviewReason[];
  sourceRecordIds: EntityId[];
}

export interface LifecycleCapexProjectionOptions extends RecordScope {
  startYear?: number;
  endYear?: number;
  includeRetired?: boolean;
}

/** Defaults for a future editable planning surface; returned values are never persisted. */
export interface LifecycleCapexPlanDraft {
  include: boolean;
  targetYear: number;
  amountMinor: MinorUnits;
  note: string;
}

export interface LifecycleCapexProjectionRow {
  rowId: string;
  assetId: EntityId;
  storeId: EntityId;
  regionId?: EntityId;
  categoryId: EntityId;
  assetCode: string;
  assetName: string;
  expectedReplacementOn: string;
  expectedReplacementYear: number;
  currentReplacementEstimateMinor: MinorUnits;
  currency: "USD";
  draft: LifecycleCapexPlanDraft;
  sourceRecordIds: EntityId[];
}

export interface LifecycleCapexYearBucket {
  year: number;
  projectedAmountMinor: MinorUnits;
  assetCount: number;
  rows: LifecycleCapexProjectionRow[];
}

export interface LifecycleCapexProjection {
  asOf: string;
  startYear: number;
  endYear: number;
  currency: "USD";
  overdueRows: LifecycleCapexProjectionRow[];
  yearBuckets: LifecycleCapexYearBucket[];
  projectedAmountMinor: MinorUnits;
  unprojectableAssetIds: EntityId[];
  definition: string;
}

export const DEFAULT_LIFECYCLE_ANALYTICS_POLICY: Readonly<LifecycleAnalyticsPolicy> = Object.freeze({
  nearExpectedLifePercentage: 80,
  reactiveWorkOrders12Months: 3,
  confirmedComponentWorkOrders12Months: 2,
  cleanCostShare12MonthsPercentage: 35,
  cleanCostShare24MonthsPercentage: 50,
});

export interface VendorPerformanceRow {
  vendor: Vendor;
  workOrdersIssued: number;
  acceptedOrResponded: number;
  responseRate: number;
  completedWorkOrders: number;
  observedVisits: number;
  locationVerifiedVisits: number;
  visitEvidenceRate: number;
  invoicedSpendMinor: MinorUnits;
  openExceptionCount: number;
  sourceRecordIds: EntityId[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  recordId?: EntityId;
}

function assertOrganization(dataset: DemoDataset, organizationId: string): void {
  if (dataset.organization.id !== organizationId) {
    throw new Error(`Organization ${organizationId} is not available in this tenant-scoped dataset.`);
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function between(timestamp: string, from?: string, to?: string): boolean {
  const value = Date.parse(timestamp);
  return (!from || value >= Date.parse(from)) && (!to || value <= Date.parse(to));
}

function matchesScope(
  dataset: DemoDataset,
  row: Pick<SpendSourceRow, "storeId" | "regionId" | "categoryId" | "vendorId" | "assetId" | "occurredAt">,
  scope: RecordScope,
): boolean {
  const store = dataset.stores.find((candidate) => candidate.id === row.storeId);
  if (scope.regionId && (row.regionId ?? store?.regionId) !== scope.regionId) return false;
  if (scope.storeId && row.storeId !== scope.storeId) return false;
  if (scope.categoryId && row.categoryId !== scope.categoryId) return false;
  if (scope.vendorId && row.vendorId !== scope.vendorId) return false;
  if (scope.assetId && row.assetId !== scope.assetId) return false;
  return between(row.occurredAt, scope.from, scope.to);
}

export function formatMoney(amountMinor: MinorUnits, currency: "USD" = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export function getInvoiceTotalMinor(invoice: Invoice): MinorUnits {
  return invoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0);
}

export function getVisitDurationMinutes(visit: Visit): number | undefined {
  if (!visit.checkedOutAt) return undefined;
  return Math.max(0, Math.round((Date.parse(visit.checkedOutAt) - Date.parse(visit.checkedInAt)) / 60_000));
}

export function filterWorkOrders(
  dataset: DemoDataset,
  organizationId: string,
  scope: RecordScope = {},
): WorkOrder[] {
  assertOrganization(dataset, organizationId);
  return dataset.workOrders
    .filter((workOrder) => {
      if (workOrder.organizationId !== organizationId) return false;
      const store = dataset.stores.find((candidate) => candidate.id === workOrder.storeId);
      if (scope.regionId && store?.regionId !== scope.regionId) return false;
      if (scope.storeId && workOrder.storeId !== scope.storeId) return false;
      if (scope.categoryId && workOrder.categoryId !== scope.categoryId) return false;
      if (scope.assetId && workOrder.assetId !== scope.assetId) return false;
      if (scope.vendorId) {
        const assignedVendor = dataset.assignments.some((assignment) =>
          assignment.workOrderId === workOrder.id && assignment.partyType === "vendor" && assignment.partyId === scope.vendorId,
        );
        if (!assignedVendor) return false;
      }
      return between(workOrder.createdAt, scope.from, scope.to);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.number.localeCompare(b.number));
}

export function getSpendSourceRows(
  dataset: DemoDataset,
  organizationId: string,
  filter: SpendFilter,
): SpendSourceRow[] {
  assertOrganization(dataset, organizationId);
  if (filter.basis === "invoiced") {
    return dataset.invoiceWorkLinks
      .filter((link) => link.organizationId === organizationId)
      .map((link) => {
        const invoice = dataset.invoices.find((candidate) => candidate.id === link.invoiceId);
        const store = dataset.stores.find((candidate) => candidate.id === link.storeId);
        return {
          sourceRecordId: link.id,
          basis: "invoiced" as const,
          amountMinor: link.attributedAmountMinor,
          currency: link.currency,
          occurredAt: invoice?.receivedAt ?? link.linkedAt,
          workOrderId: link.workOrderId,
          storeId: link.storeId,
          regionId: store?.regionId,
          categoryId: link.categoryId,
          assetId: link.assetId,
          vendorId: invoice?.vendorId,
          invoiceId: invoice?.id,
        } satisfies SpendSourceRow;
      })
      .filter((row) => matchesScope(dataset, row, filter))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.sourceRecordId.localeCompare(b.sourceRecordId));
  }

  return dataset.costLines
    .filter((line) => line.organizationId === organizationId && line.basis === filter.basis)
    .map((line) => {
      const store = dataset.stores.find((candidate) => candidate.id === line.storeId);
      return {
        sourceRecordId: line.id,
        basis: line.basis,
        amountMinor: line.amountMinor,
        currency: line.currency,
        occurredAt: line.recordedAt,
        workOrderId: line.workOrderId,
        storeId: line.storeId,
        regionId: store?.regionId,
        categoryId: line.categoryId,
        assetId: line.assetId,
        vendorId: line.vendorId,
      } satisfies SpendSourceRow;
    })
    .filter((row) => matchesScope(dataset, row, filter))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.sourceRecordId.localeCompare(b.sourceRecordId));
}

function getCoverage(rows: SpendSourceRow[]): ClassificationCoverage {
  const classifiedRows = rows.filter((row) => row.categoryId);
  const classifiedAmountMinor = classifiedRows.reduce((sum, row) => sum + row.amountMinor, 0);
  const totalAmountMinor = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  return {
    classifiedAmountMinor,
    unclassifiedAmountMinor: totalAmountMinor - classifiedAmountMinor,
    classifiedPercentage: totalAmountMinor === 0 ? 100 : Math.round((classifiedAmountMinor / totalAmountMinor) * 1_000) / 10,
    classifiedSourceCount: classifiedRows.length,
    totalSourceCount: rows.length,
  };
}

export function getSpendMetric(
  dataset: DemoDataset,
  organizationId: string,
  filter: SpendFilter,
): SpendMetric {
  const rows = getSpendSourceRows(dataset, organizationId, filter);
  return {
    value: rows.reduce((sum, row) => sum + row.amountMinor, 0),
    currency: "USD",
    basis: filter.basis,
    scope: {
      regionId: filter.regionId,
      storeId: filter.storeId,
      categoryId: filter.categoryId,
      vendorId: filter.vendorId,
      assetId: filter.assetId,
      from: filter.from,
      to: filter.to,
    },
    sourceRecordIds: rows.map((row) => row.sourceRecordId),
    classificationCoverage: getCoverage(rows),
    definition: `${filter.basis[0].toUpperCase()}${filter.basis.slice(1)} maintenance amount from explicitly attributed source records.`,
  };
}

function groupLabel(dataset: DemoDataset, group: SpendGroup, key: string): string {
  if (key === "unclassified") return "Unclassified";
  if (key === "internal-or-unassigned") return "Internal / no vendor";
  if (group === "region") return dataset.regions.find((record) => record.id === key)?.name ?? key;
  if (group === "store") {
    const store = dataset.stores.find((record) => record.id === key);
    return store ? `Store ${store.storeNumber} · ${store.name.replace("Northline ", "")}` : key;
  }
  if (group === "category") return dataset.categories.find((record) => record.id === key)?.label ?? key;
  if (group === "vendor") return dataset.vendors.find((record) => record.id === key)?.displayName ?? key;
  if (group === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  }
  return key;
}

export function getSpendBreakdown(
  dataset: DemoDataset,
  organizationId: string,
  filter: SpendFilter,
  group: SpendGroup,
): SpendBreakdownRow[] {
  const rows = getSpendSourceRows(dataset, organizationId, filter);
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  const buckets = new Map<string, SpendSourceRow[]>();

  for (const row of rows) {
    const key = group === "region"
      ? row.regionId ?? "unclassified"
      : group === "store"
        ? row.storeId
        : group === "category"
          ? row.categoryId ?? "unclassified"
          : group === "vendor"
            ? row.vendorId ?? "internal-or-unassigned"
            : row.occurredAt.slice(0, 7);
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const amountMinor = bucket.reduce((sum, row) => sum + row.amountMinor, 0);
      return {
        key,
        label: groupLabel(dataset, group, key),
        amountMinor,
        percentage: total === 0 ? 0 : Math.round((amountMinor / total) * 1_000) / 10,
        sourceRecordIds: bucket.map((row) => row.sourceRecordId),
        workOrderIds: unique(bucket.map((row) => row.workOrderId)),
        sourceCount: bucket.length,
      } satisfies SpendBreakdownRow;
    })
    .sort((a, b) => group === "month" ? a.key.localeCompare(b.key) : b.amountMinor - a.amountMinor || a.label.localeCompare(b.label));
}

export function getMonthlySpendTrend(
  dataset: DemoDataset,
  organizationId: string,
  filter: SpendFilter,
): SpendBreakdownRow[] {
  return getSpendBreakdown(dataset, organizationId, filter, "month");
}

export function getPortfolioSummary(
  dataset: DemoDataset,
  organizationId: string,
  scope: RecordScope = {},
): PortfolioSummary {
  assertOrganization(dataset, organizationId);
  const scopedWork = filterWorkOrders(dataset, organizationId, scope);
  const scopedWorkIds = new Set(scopedWork.map((workOrder) => workOrder.id));
  const openWork = scopedWork.filter((workOrder) => !TERMINAL_WORK_STATUSES.has(workOrder.status));
  const urgentOpenWork = openWork.filter((workOrder) => workOrder.priority === "urgent" || workOrder.priority === "emergency");
  const activeVisits = dataset.visits.filter((visit) =>
    visit.organizationId === organizationId && !visit.checkedOutAt && scopedWorkIds.has(visit.workOrderId ?? ""),
  );
  const scopedStoreIds = new Set(
    dataset.stores
      .filter((store) => (!scope.regionId || store.regionId === scope.regionId) && (!scope.storeId || store.id === scope.storeId))
      .map((store) => store.id),
  );
  const exceptions = dataset.exceptions.filter((exception) =>
    exception.organizationId === organizationId && exception.status !== "resolved" &&
    (!exception.storeId || scopedStoreIds.has(exception.storeId)) &&
    (!scope.categoryId || !exception.workOrderId || scopedWorkIds.has(exception.workOrderId)) &&
    (!scope.vendorId || exception.vendorId === scope.vendorId),
  );
  const invoiceLinks = getSpendSourceRows(dataset, organizationId, { ...scope, basis: "invoiced" });
  const scopedInvoiceIds = new Set(invoiceLinks.flatMap((row) => row.invoiceId ? [row.invoiceId] : []));
  const invoicesNeedingReview = dataset.invoices.filter((invoice) => scopedInvoiceIds.has(invoice.id) && invoice.status === "needs_review");
  const pmOccurrences = dataset.pmOccurrences.filter((occurrence) => scopedStoreIds.has(occurrence.storeId));
  const pmDuePopulation = pmOccurrences.filter((occurrence) =>
    occurrence.status === "completed" || occurrence.status === "overdue" || occurrence.status === "due",
  );
  const pmCompleted = pmDuePopulation.filter((occurrence) => occurrence.status === "completed");

  return {
    invoicedSpend: getSpendMetric(dataset, organizationId, { ...scope, basis: "invoiced" }),
    openWork: {
      value: openWork.length,
      sourceRecordIds: openWork.map((workOrder) => workOrder.id),
      definition: "Work orders not in a closed or cancelled state.",
    },
    urgentOpenWork: {
      value: urgentOpenWork.length,
      sourceRecordIds: urgentOpenWork.map((workOrder) => workOrder.id),
      definition: "Open work orders with urgent or emergency priority.",
    },
    techniciansOnsite: {
      value: activeVisits.length,
      sourceRecordIds: activeVisits.map((visit) => visit.id),
      definition: "Visits with a recorded check-in and no recorded checkout as of the dataset timestamp.",
    },
    openExceptions: {
      value: exceptions.length,
      sourceRecordIds: exceptions.map((exception) => exception.id),
      definition: "Acknowledged or open exception records in the selected store scope.",
    },
    criticalExceptions: {
      value: exceptions.filter((exception) => exception.severity === "critical").length,
      sourceRecordIds: exceptions.filter((exception) => exception.severity === "critical").map((exception) => exception.id),
      definition: "Open exception records explicitly classified as critical.",
    },
    invoicesNeedingReview: {
      value: invoicesNeedingReview.length,
      sourceRecordIds: invoicesNeedingReview.map((invoice) => invoice.id),
      definition: "Received invoice records carrying a needs-review status; not a payment decision.",
    },
    pmCompliance: {
      value: pmDuePopulation.length === 0 ? 100 : Math.round((pmCompleted.length / pmDuePopulation.length) * 1_000) / 10,
      sourceRecordIds: pmDuePopulation.map((occurrence) => occurrence.id),
      definition: "Completed occurrences divided by completed, due and overdue PM occurrences in scope.",
    },
  };
}

export function getWorkOrderDetail(
  dataset: DemoDataset,
  organizationId: string,
  workOrderId: string,
): WorkOrderDetail | undefined {
  assertOrganization(dataset, organizationId);
  const workOrder = dataset.workOrders.find((candidate) => candidate.organizationId === organizationId && candidate.id === workOrderId);
  if (!workOrder) return undefined;
  const invoiceLinks = dataset.invoiceWorkLinks.filter((link) => link.organizationId === organizationId && link.workOrderId === workOrder.id);
  const invoices = dataset.invoices.filter((invoice) => invoice.organizationId === organizationId && invoiceLinks.some((link) => link.invoiceId === invoice.id));
  const visitIds = new Set(dataset.visits.filter((visit) => visit.workOrderId === workOrder.id).map((visit) => visit.id));
  return {
    workOrder,
    store: dataset.stores.find((store) => store.id === workOrder.storeId)!,
    category: dataset.categories.find((category) => category.id === workOrder.categoryId),
    asset: dataset.assets.find((asset) => asset.id === workOrder.assetId),
    request: dataset.requests.find((request) => request.id === workOrder.requestId),
    assignments: dataset.assignments.filter((assignment) => assignment.organizationId === organizationId && assignment.workOrderId === workOrder.id),
    vendorIssuances: dataset.vendorIssuances.filter((issuance) => issuance.organizationId === organizationId && issuance.workOrderId === workOrder.id).sort((a, b) => a.version - b.version),
    visits: dataset.visits.filter((visit) => visit.organizationId === organizationId && visit.workOrderId === workOrder.id).sort((a, b) => Date.parse(a.checkedInAt) - Date.parse(b.checkedInAt)),
    costLines: dataset.costLines.filter((line) => line.organizationId === organizationId && line.workOrderId === workOrder.id),
    invoiceLinks,
    invoices,
    documents: dataset.documents.filter((document) =>
      document.organizationId === organizationId && (document.workOrderId === workOrder.id || (document.visitId && visitIds.has(document.visitId)) || (document.invoiceId && invoices.some((invoice) => invoice.id === document.invoiceId))),
    ),
    exceptions: dataset.exceptions.filter((exception) => exception.organizationId === organizationId && exception.workOrderId === workOrder.id),
    auditEvents: dataset.auditEvents.filter((event) =>
      event.organizationId === organizationId &&
      (event.entityId === workOrder.id || event.payloadSnapshot.workOrderId === workOrder.id || visitIds.has(event.entityId) || invoices.some((invoice) => invoice.id === event.entityId)),
    ).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)),
  };
}

export function getStoreDashboard(
  dataset: DemoDataset,
  organizationId: string,
  storeId: string,
): StoreDashboard | undefined {
  assertOrganization(dataset, organizationId);
  const store = dataset.stores.find((candidate) => candidate.organizationId === organizationId && candidate.id === storeId);
  if (!store) return undefined;
  return {
    store,
    invoicedSpend: getSpendMetric(dataset, organizationId, { basis: "invoiced", storeId }),
    openWork: filterWorkOrders(dataset, organizationId, { storeId }).filter((workOrder) => !TERMINAL_WORK_STATUSES.has(workOrder.status)),
    activeVisits: dataset.visits.filter((visit) => visit.organizationId === organizationId && visit.storeId === storeId && !visit.checkedOutAt),
    assets: dataset.assets.filter((asset) => asset.organizationId === organizationId && asset.storeId === storeId),
    pmOccurrences: dataset.pmOccurrences.filter((occurrence) => occurrence.organizationId === organizationId && occurrence.storeId === storeId),
    exceptions: dataset.exceptions.filter((exception) => exception.organizationId === organizationId && exception.storeId === storeId && exception.status !== "resolved"),
    categorySpend: getSpendBreakdown(dataset, organizationId, { basis: "invoiced", storeId }, "category"),
  };
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textScore(query: string, values: Array<{ value: string; label: string; weight: number }>): { score: number; matchedOn: string[] } {
  const words = normalized(query).split(" ").filter(Boolean);
  if (words.length === 0) return { score: 0, matchedOn: [] };
  let score = 0;
  const matchedOn: string[] = [];
  for (const candidate of values) {
    const text = normalized(candidate.value);
    const everyWord = words.every((word) => text.includes(word));
    const anyWord = words.some((word) => text.includes(word));
    if (!anyWord) continue;
    const exact = text === normalized(query);
    const prefix = text.startsWith(normalized(query));
    score += candidate.weight * (exact ? 3 : prefix ? 2 : everyWord ? 1.5 : 1);
    matchedOn.push(candidate.label);
  }
  return { score, matchedOn: unique(matchedOn) };
}

export function searchDemoData(
  dataset: DemoDataset,
  organizationId: string,
  query: string,
  limit = 20,
): SearchResult[] {
  assertOrganization(dataset, organizationId);
  if (!normalized(query)) return [];
  const results: SearchResult[] = [];

  for (const store of dataset.stores.filter((candidate) => candidate.organizationId === organizationId)) {
    const match = textScore(query, [
      { value: store.storeNumber, label: "store number", weight: 10 },
      { value: store.name, label: "store name", weight: 7 },
      { value: store.normalizedAddress, label: "address", weight: 6 },
      ...store.aliases.map((alias) => ({ value: alias.value, label: alias.type.replaceAll("_", " "), weight: 7 })),
      ...store.searchTerms.map((term) => ({ value: term, label: "search term", weight: 3 })),
    ]);
    if (match.score > 0) results.push({ kind: "store", id: store.id, title: `Store ${store.storeNumber} · ${store.name.replace("Northline ", "")}`, subtitle: `${store.address.line1}, ${store.address.city}, ${store.address.state}`, score: match.score, matchedOn: match.matchedOn, storeId: store.id });
  }

  for (const vendor of dataset.vendors.filter((candidate) => candidate.organizationId === organizationId)) {
    const match = textScore(query, [
      { value: vendor.displayName, label: "vendor name", weight: 9 },
      { value: vendor.legalName, label: "legal name", weight: 6 },
      { value: vendor.customerVendorNumber, label: "vendor number", weight: 8 },
      { value: vendor.description, label: "description", weight: 4 },
      ...vendor.aliases.map((alias) => ({ value: alias, label: "vendor alias", weight: 7 })),
      ...vendor.searchTerms.map((term) => ({ value: term, label: "specialty", weight: 6 })),
      ...vendor.specialties.flatMap((specialty) => [
        { value: specialty.label, label: "specialty", weight: 7 },
        ...specialty.aliases.map((alias) => ({ value: alias, label: "specialty alias", weight: 6 })),
        ...specialty.equipmentTypes.map((equipment) => ({ value: equipment, label: "equipment serviced", weight: 5 })),
      ]),
    ]);
    if (match.score > 0) results.push({ kind: "vendor", id: vendor.id, title: vendor.displayName, subtitle: vendor.specialties.map((specialty) => specialty.label).join(" · "), score: match.score, matchedOn: match.matchedOn });
  }

  for (const workOrder of dataset.workOrders.filter((candidate) => candidate.organizationId === organizationId)) {
    const store = dataset.stores.find((candidate) => candidate.id === workOrder.storeId)!;
    const match = textScore(query, [
      { value: workOrder.number, label: "work-order number", weight: 10 },
      { value: workOrder.title, label: "title", weight: 6 },
      { value: workOrder.problemDescription, label: "problem", weight: 3 },
      ...workOrder.tags.map((tag) => ({ value: tag, label: "tag", weight: 2 })),
    ]);
    if (match.score > 0) results.push({ kind: "work_order", id: workOrder.id, title: `${workOrder.number} · ${workOrder.title}`, subtitle: `Store ${store.storeNumber} · ${workOrder.status.replaceAll("_", " ")}`, score: match.score, matchedOn: match.matchedOn, storeId: store.id });
  }

  for (const asset of dataset.assets.filter((candidate) => candidate.organizationId === organizationId)) {
    const store = dataset.stores.find((candidate) => candidate.id === asset.storeId)!;
    const match = textScore(query, [
      { value: asset.assetCode, label: "asset code", weight: 9 },
      { value: asset.name, label: "asset name", weight: 7 },
      { value: asset.serialNumber, label: "serial number", weight: 10 },
      { value: asset.model, label: "model", weight: 6 },
      { value: asset.manufacturer, label: "manufacturer", weight: 5 },
      ...asset.searchTerms.map((term) => ({ value: term, label: "asset term", weight: 3 })),
    ]);
    if (match.score > 0) results.push({ kind: "asset", id: asset.id, title: asset.name, subtitle: `Store ${store.storeNumber} · ${asset.assetCode} · ${asset.model}`, score: match.score, matchedOn: match.matchedOn, storeId: store.id });
  }

  for (const invoice of dataset.invoices.filter((candidate) => candidate.organizationId === organizationId)) {
    const link = dataset.invoiceWorkLinks.find((candidate) => candidate.invoiceId === invoice.id);
    const match = textScore(query, [
      { value: invoice.invoiceNumber, label: "invoice number", weight: 10 },
      ...invoice.customerWorkOrderReferences.map((reference) => ({ value: reference, label: "customer work-order reference", weight: 9 })),
      ...invoice.vendorServiceReferences.map((reference) => ({ value: reference, label: "vendor service reference", weight: 7 })),
    ]);
    if (match.score > 0) results.push({ kind: "invoice", id: invoice.id, title: invoice.invoiceNumber, subtitle: `${formatMoney(getInvoiceTotalMinor(invoice))} · ${invoice.status.replaceAll("_", " ")}`, score: match.score, matchedOn: match.matchedOn, storeId: link?.storeId });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export function searchVendors(
  dataset: DemoDataset,
  organizationId: string,
  query: string,
  options: { storeId?: string; categoryId?: string } = {},
): VendorSearchResult[] {
  assertOrganization(dataset, organizationId);
  const store = options.storeId ? dataset.stores.find((candidate) => candidate.id === options.storeId) : undefined;
  return dataset.vendors
    .filter((vendor) => vendor.organizationId === organizationId && vendor.status !== "inactive")
    .map((vendor) => {
      const match = textScore(query, [
        { value: vendor.displayName, label: "name", weight: 9 },
        { value: vendor.legalName, label: "legal name", weight: 5 },
        { value: vendor.description, label: "description", weight: 4 },
        ...vendor.aliases.map((alias) => ({ value: alias, label: "alias", weight: 7 })),
        ...vendor.searchTerms.map((term) => ({ value: term, label: "specialty", weight: 7 })),
        ...vendor.specialties.flatMap((specialty) => [
          { value: specialty.label, label: "specialty", weight: 8 },
          ...specialty.aliases.map((alias) => ({ value: alias, label: "specialty alias", weight: 7 })),
          ...specialty.equipmentTypes.map((equipment) => ({ value: equipment, label: "equipment", weight: 6 })),
        ]),
      ]);
      const categoryMatch = !options.categoryId || vendor.specialties.some((specialty) => specialty.categoryId === options.categoryId);
      const coversStore = !store?.regionId || vendor.coverageRegionIds.includes(store.regionId);
      const preferredForStore = Boolean(options.storeId && vendor.preferredStoreIds.includes(options.storeId));
      const score = normalized(query) && match.score === 0
        ? Number.NEGATIVE_INFINITY
        : (normalized(query) ? match.score : 1) + (categoryMatch ? 25 : -50) + (coversStore ? 12 : -100) + (preferredForStore ? 10 : 0) + (vendor.status === "preferred" ? 3 : 0);
      return { vendor, score, matchedOn: match.matchedOn, coversStore, preferredForStore };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.vendor.displayName.localeCompare(b.vendor.displayName));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

export function findCostOutliers(
  dataset: DemoDataset,
  organizationId: string,
  filter: Omit<SpendFilter, "basis"> & { basis?: SpendBasis } = {},
): CostOutlier[] {
  const basis = filter.basis ?? "invoiced";
  const rows = getSpendSourceRows(dataset, organizationId, { ...filter, basis }).filter((row) => row.categoryId);
  const grouped = new Map<string, SpendSourceRow[]>();
  for (const row of rows) {
    const key = `${row.categoryId}|${row.storeId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const totals = [...grouped.entries()].map(([key, bucket]) => {
    const [categoryId, storeId] = key.split("|");
    return { categoryId, storeId, amountMinor: bucket.reduce((sum, row) => sum + row.amountMinor, 0), rows: bucket };
  });
  const byCategory = new Map<string, typeof totals>();
  for (const total of totals) byCategory.set(total.categoryId, [...(byCategory.get(total.categoryId) ?? []), total]);

  const results: CostOutlier[] = [];
  for (const total of totals) {
    const peerTotals = (byCategory.get(total.categoryId) ?? []).filter((peer) => peer.storeId !== total.storeId).map((peer) => peer.amountMinor);
    if (peerTotals.length < 3) continue;
    const peerMedianMinor = median(peerTotals);
    const multiple = peerMedianMinor === 0 ? 0 : total.amountMinor / peerMedianMinor;
    if (total.amountMinor < 150_000 || multiple < 1.5) continue;
    results.push({
      storeId: total.storeId,
      categoryId: total.categoryId,
      amountMinor: total.amountMinor,
      peerMedianMinor,
      multipleOfMedian: Math.round(multiple * 10) / 10,
      sourceRecordIds: total.rows.map((row) => row.sourceRecordId),
      workOrderIds: unique(total.rows.map((row) => row.workOrderId)),
      rule: `${basis} spend is at least $1,500 and at least 1.5× the median among peer stores with ${basis} activity in this category.`,
    });
  }
  return results.sort((a, b) => b.multipleOfMedian - a.multipleOfMedian || b.amountMinor - a.amountMinor);
}

export function findLifecycleCandidates(
  dataset: DemoDataset,
  organizationId: string,
  scope: RecordScope = {},
): LifecycleCandidate[] {
  assertOrganization(dataset, organizationId);
  const asOf = Date.parse(dataset.asOf);
  const rows = getSpendSourceRows(dataset, organizationId, { ...scope, basis: "invoiced" });
  return dataset.assets
    .filter((asset) => asset.organizationId === organizationId)
    .filter((asset) => !scope.storeId || asset.storeId === scope.storeId)
    .filter((asset) => !scope.categoryId || asset.categoryId === scope.categoryId)
    .filter((asset) => !scope.assetId || asset.id === scope.assetId)
    .flatMap((asset) => {
      const assetRows = rows.filter((row) => row.assetId === asset.id);
      const repairSpendMinor = assetRows.reduce((sum, row) => sum + row.amountMinor, 0);
      const workOrderIds = unique(assetRows.map((row) => row.workOrderId));
      const correctiveWorkOrderCount = dataset.workOrders.filter((workOrder) =>
        workOrder.organizationId === organizationId && workOrder.assetId === asset.id && workOrder.source !== "pm" && workOrderIds.includes(workOrder.id),
      ).length;
      const assetAgeYears = Math.round(((asOf - Date.parse(asset.installedOn)) / (365.25 * 86_400_000)) * 10) / 10;
      const repairToReplacementPercentage = asset.replacementEstimateMinor === 0 ? 0 : Math.round((repairSpendMinor / asset.replacementEstimateMinor) * 1_000) / 10;
      const expectedLifePercentage = Math.round((assetAgeYears / asset.expectedLifeYears) * 1_000) / 10;
      const repeatRepairException = dataset.exceptions.find((exception) => exception.assetId === asset.id && exception.type === "repeat_repair" && exception.status !== "resolved");
      const reasons: string[] = [];
      if (repairToReplacementPercentage >= 35) reasons.push(`Documented repair spend is ${repairToReplacementPercentage}% of the current replacement estimate.`);
      if (correctiveWorkOrderCount >= 3) reasons.push(`${correctiveWorkOrderCount} corrective work orders are linked to this asset in the available review history.`);
      if (expectedLifePercentage >= 80) reasons.push(`Asset age is ${expectedLifePercentage}% of its expected service life.`);
      if (repeatRepairException) reasons.push("An open repeat-repair exception is linked to the asset.");
      const qualifies = repairToReplacementPercentage >= 35 || (correctiveWorkOrderCount >= 3 && expectedLifePercentage >= 75) || Boolean(repeatRepairException);
      if (!qualifies) return [];
      return [{
        asset,
        repairSpendMinor,
        replacementEstimateMinor: asset.replacementEstimateMinor,
        repairToReplacementPercentage,
        correctiveWorkOrderCount,
        assetAgeYears,
        expectedLifePercentage,
        reasons,
        thresholds: [
          "Repair spend is at least 35% of replacement estimate", 
          "or at least 3 corrective work orders and asset is at least 75% through expected life",
          "or an open repeat-repair exception exists",
        ],
        sourceRecordIds: unique([...assetRows.map((row) => row.sourceRecordId), ...(repeatRepairException ? [repeatRepairException.id] : [])]),
        workOrderIds,
      } satisfies LifecycleCandidate];
    })
    .sort((a, b) => b.repairToReplacementPercentage - a.repairToReplacementPercentage || b.correctiveWorkOrderCount - a.correctiveWorkOrderCount);
}

const LIFECYCLE_COMPLETED_WORK_STATUSES = new Set<WorkOrder["status"]>([
  "completed",
  "awaiting_invoice",
  "invoice_received",
  "closed",
]);

const LIFECYCLE_INVOICE_EXCEPTION_TYPES = new Set<ExceptionRecord["type"]>([
  "invoice_over_nte",
  "invoice_missing_work_order",
  "duplicate_invoice_reference",
]);

function lifecyclePolicy(options: LifecycleAnalyticsOptions): LifecycleAnalyticsPolicy {
  return { ...DEFAULT_LIFECYCLE_ANALYTICS_POLICY, ...options.policy };
}

function monthsBefore(timestamp: string, months: 12 | 24): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return timestamp;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

function roundedPercentage(numerator: number, denominator: number): number | undefined {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return undefined;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function assetAgeYears(installedOn: string, asOf: string): number | undefined {
  const installed = Date.parse(installedOn);
  const current = Date.parse(asOf);
  if (!Number.isFinite(installed) || !Number.isFinite(current) || current < installed) return undefined;
  return Math.round(((current - installed) / (365.25 * 86_400_000)) * 10) / 10;
}

function expectedReplacementDate(installedOn: string, expectedLifeYears: number): string | undefined {
  const installed = new Date(installedOn);
  if (!Number.isFinite(installed.getTime()) || !Number.isFinite(expectedLifeYears) || expectedLifeYears <= 0) return undefined;
  const wholeYears = Math.trunc(expectedLifeYears);
  const remainingMonths = Math.round((expectedLifeYears - wholeYears) * 12);
  installed.setUTCFullYear(installed.getUTCFullYear() + wholeYears);
  installed.setUTCMonth(installed.getUTCMonth() + remainingMonths);
  return installed.toISOString().slice(0, 10);
}

function isReactiveLifecycleWork(workOrder: WorkOrder): boolean {
  return workOrder.source !== "pm" && workOrder.status !== "cancelled" && workOrder.status !== "draft";
}

function lifecycleWorkAt(workOrder: WorkOrder): string {
  return workOrder.completedAt ?? workOrder.closedAt ?? workOrder.createdAt;
}

function reactiveWorkForAsset(dataset: DemoDataset, organizationId: string, assetId: string): WorkOrder[] {
  return dataset.workOrders.filter((workOrder) =>
    workOrder.organizationId === organizationId && workOrder.assetId === assetId && isReactiveLifecycleWork(workOrder),
  );
}

function workInLifecycleWindow(workOrders: WorkOrder[], from: string, to: string): WorkOrder[] {
  return workOrders.filter((workOrder) => between(lifecycleWorkAt(workOrder), from, to));
}

function buildLifecycleActivityWindow(
  dataset: DemoDataset,
  organizationId: string,
  assetId: string,
  months: 12 | 24,
): LifecycleActivityWindow {
  const to = dataset.asOf;
  const from = monthsBefore(to, months);
  const allReactiveWork = reactiveWorkForAsset(dataset, organizationId, assetId);
  const windowWork = workInLifecycleWindow(allReactiveWork, from, to);
  const allWorkIds = new Set(allReactiveWork.map((workOrder) => workOrder.id));
  const visits = dataset.visits.filter((visit) =>
    visit.organizationId === organizationId &&
    Boolean(visit.workOrderId && allWorkIds.has(visit.workOrderId)) &&
    between(visit.checkedInAt, from, to),
  );
  const temporaryOrUnresolvedWorkOrderIds = windowWork
    .filter((workOrder) =>
      workOrder.outcome === "temporary_repair" ||
      workOrder.outcome === "unresolved" ||
      workOrder.outcome === "diagnosed_waiting_parts" ||
      workOrder.status === "unresolved" ||
      workOrder.status === "waiting_parts",
    )
    .map((workOrder) => workOrder.id);
  return {
    months,
    from,
    to,
    distinctWorkOrderCount: windowWork.length,
    workOrderIds: windowWork.map((workOrder) => workOrder.id),
    distinctVisitCount: visits.length,
    visitIds: visits.map((visit) => visit.id),
    temporaryOrUnresolvedWorkOrderIds,
  };
}

function invoiceLinkNeedsLifecycleReview(
  dataset: DemoDataset,
  organizationId: string,
  link: InvoiceWorkLink,
): boolean {
  const invoice = dataset.invoices.find((candidate) => candidate.organizationId === organizationId && candidate.id === link.invoiceId);
  if (!invoice || invoice.status === "needs_review" || link.matchStatus === "review_needed") return true;
  return dataset.exceptions.some((exception) =>
    exception.organizationId === organizationId &&
    exception.status !== "resolved" &&
    LIFECYCLE_INVOICE_EXCEPTION_TYPES.has(exception.type) &&
    (exception.invoiceId === invoice.id || exception.sourceRecordIds.includes(invoice.id)),
  );
}

function buildLifecycleCostWindow(
  dataset: DemoDataset,
  organizationId: string,
  asset: Asset,
  months: 12 | 24,
): LifecycleCostWindow {
  const to = dataset.asOf;
  const from = monthsBefore(to, months);
  const windowWork = workInLifecycleWindow(reactiveWorkForAsset(dataset, organizationId, asset.id), from, to);
  const windowWorkIds = new Set(windowWork.map((workOrder) => workOrder.id));
  const costLines = dataset.costLines.filter((line) =>
    line.organizationId === organizationId && line.assetId === asset.id && windowWorkIds.has(line.workOrderId),
  );
  const authorizedLines = costLines.filter((line) => line.basis === "approved");
  const recordedLines = costLines.filter((line) => line.basis === "recorded");
  const invoiceLinks = dataset.invoiceWorkLinks.filter((link) =>
    link.organizationId === organizationId && link.assetId === asset.id && windowWorkIds.has(link.workOrderId),
  );
  const cleanInvoiceLinks = invoiceLinks.filter((link) => !invoiceLinkNeedsLifecycleReview(dataset, organizationId, link));
  const needsReviewInvoiceLinks = invoiceLinks.filter((link) => invoiceLinkNeedsLifecycleReview(dataset, organizationId, link));
  const confirmedActualSourceRecordIds: EntityId[] = [];
  let confirmedActualMinor = 0;

  for (const workOrder of windowWork) {
    const workRecordedLines = recordedLines.filter((line) => line.workOrderId === workOrder.id);
    if (workRecordedLines.length > 0) {
      confirmedActualMinor += workRecordedLines.reduce((sum, line) => sum + line.amountMinor, 0);
      confirmedActualSourceRecordIds.push(...workRecordedLines.map((line) => line.id));
      continue;
    }
    const workInvoiceLinks = cleanInvoiceLinks.filter((link) => link.workOrderId === workOrder.id);
    confirmedActualMinor += workInvoiceLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0);
    confirmedActualSourceRecordIds.push(...workInvoiceLinks.map((link) => link.id));
  }

  return {
    months,
    from,
    to,
    authorizedMinor: authorizedLines.reduce((sum, line) => sum + line.amountMinor, 0),
    authorizedSourceRecordIds: authorizedLines.map((line) => line.id),
    recordedMinor: recordedLines.reduce((sum, line) => sum + line.amountMinor, 0),
    recordedSourceRecordIds: recordedLines.map((line) => line.id),
    cleanInvoiceMinor: cleanInvoiceLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0),
    cleanInvoiceSourceRecordIds: cleanInvoiceLinks.map((link) => link.id),
    needsReviewInvoiceMinor: needsReviewInvoiceLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0),
    needsReviewInvoiceSourceRecordIds: needsReviewInvoiceLinks.map((link) => link.id),
    confirmedActualMinor,
    confirmedActualSourceRecordIds: unique(confirmedActualSourceRecordIds),
    confirmedActualShareOfReplacementPercentage: roundedPercentage(confirmedActualMinor, asset.replacementEstimateMinor),
  };
}

function buildLifecyclePmWindow(
  occurrences: DemoDataset["pmOccurrences"],
  asOf: string,
  months: 12 | 24,
): LifecyclePmWindow {
  const from = monthsBefore(asOf, months);
  const windowOccurrences = occurrences.filter((occurrence) => between(occurrence.dueAt, from, asOf));
  return {
    months,
    from,
    to: asOf,
    occurrenceCount: windowOccurrences.length,
    completedCount: windowOccurrences.filter((occurrence) => occurrence.status === "completed").length,
    skippedCount: windowOccurrences.filter((occurrence) => occurrence.status === "skipped").length,
    overdueCount: windowOccurrences.filter((occurrence) => occurrence.status === "overdue").length,
    dueCount: windowOccurrences.filter((occurrence) => occurrence.status === "due").length,
    sourceRecordIds: windowOccurrences.map((occurrence) => occurrence.id),
  };
}

function buildLifecyclePmFacts(
  dataset: DemoDataset,
  organizationId: string,
  assetId: string,
): LifecyclePmFacts {
  const plans = dataset.pmPlans.filter((plan) => plan.organizationId === organizationId && plan.assetId === assetId);
  const planIds = new Set(plans.map((plan) => plan.id));
  const occurrences = dataset.pmOccurrences.filter((occurrence) =>
    occurrence.organizationId === organizationId && planIds.has(occurrence.pmPlanId),
  );
  return {
    planCount: plans.length,
    activePlanCount: plans.filter((plan) => plan.active).length,
    planIds: plans.map((plan) => plan.id),
    trailing12Months: buildLifecyclePmWindow(occurrences, dataset.asOf, 12),
    trailing24Months: buildLifecyclePmWindow(occurrences, dataset.asOf, 24),
  };
}

function buildWarrantyFacts(asset: Asset, asOf: string): LifecycleWarrantyFacts {
  if (!asset.warranty) return { status: "not_recorded", sourceRecordIds: [] };
  const asOfDate = asOf.slice(0, 10);
  const { startsOn, endsOn } = asset.warranty;
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(endsOn);
  const status: LifecycleWarrantyStatus = !validDates
    ? "unknown"
    : asOfDate < startsOn
      ? "not_started"
      : asOfDate <= endsOn
        ? "active"
        : "expired";
  return {
    status,
    provider: asset.warranty.provider,
    startsOn,
    endsOn,
    coverage: asset.warranty.coverage,
    reference: asset.warranty.reference,
    sourceRecordIds: [asset.id],
  };
}

function buildConfirmedComponentRecurrences(
  dataset: DemoDataset,
  organizationId: string,
  assetId: string,
  months: 12 | 24,
): ConfirmedComponentRecurrence[] {
  const to = dataset.asOf;
  const from = monthsBefore(to, months);
  const validComponentIds = new Set(
    dataset.assetComponents
      .filter((component) => component.organizationId === organizationId && component.assetId === assetId)
      .map((component) => component.id),
  );
  const completedWork = workInLifecycleWindow(reactiveWorkForAsset(dataset, organizationId, assetId), from, to)
    .filter((workOrder) =>
      Boolean(workOrder.componentId && validComponentIds.has(workOrder.componentId)) &&
      (Boolean(workOrder.completedAt) || LIFECYCLE_COMPLETED_WORK_STATUSES.has(workOrder.status)),
    );
  const byComponent = new Map<EntityId, WorkOrder[]>();
  for (const workOrder of completedWork) {
    const componentId = workOrder.componentId!;
    byComponent.set(componentId, [...(byComponent.get(componentId) ?? []), workOrder]);
  }
  return [...byComponent.entries()]
    .filter(([, workOrders]) => workOrders.length >= 2)
    .map(([componentId, workOrders]) => {
      const component = dataset.assetComponents.find((candidate) => candidate.id === componentId)!;
      const sortedWork = [...workOrders].sort((left, right) => lifecycleWorkAt(left).localeCompare(lifecycleWorkAt(right)));
      const workOrderIds = new Set(sortedWork.map((workOrder) => workOrder.id));
      const visits = dataset.visits.filter((visit) =>
        visit.organizationId === organizationId &&
        Boolean(visit.workOrderId && workOrderIds.has(visit.workOrderId)) &&
        between(visit.checkedInAt, from, to),
      );
      return {
        componentId,
        componentCode: component.componentCode,
        componentName: component.name,
        windowMonths: months,
        distinctWorkOrderCount: sortedWork.length,
        workOrderIds: sortedWork.map((workOrder) => workOrder.id),
        distinctVisitCount: visits.length,
        visitIds: visits.map((visit) => visit.id),
        firstWorkAt: lifecycleWorkAt(sortedWork[0]),
        latestWorkAt: lifecycleWorkAt(sortedWork.at(-1)!),
        sourceRecordIds: unique([componentId, ...sortedWork.map((workOrder) => workOrder.id), ...visits.map((visit) => visit.id)]),
      } satisfies ConfirmedComponentRecurrence;
    })
    .sort((left, right) => right.distinctWorkOrderCount - left.distinctWorkOrderCount || left.componentCode.localeCompare(right.componentCode));
}

function lifecycleReviewReasons(
  facts: Omit<AssetLifecycleDecisionFacts, "reviewReasons" | "sourceRecordIds">,
  policy: LifecycleAnalyticsPolicy,
): LifecycleReviewReason[] {
  const reasons: LifecycleReviewReason[] = [];
  const lifePercentage = facts.expectedLifePercentage;
  if (lifePercentage !== undefined && lifePercentage >= 100) {
    reasons.push({
      code: "expected_life_reference_reached",
      category: "service_life",
      label: "Expected-life reference reached",
      detail: `Chronological age is ${lifePercentage}% of the recorded ${facts.expectedLifeYears}-year expected-life reference.`,
      observedValue: lifePercentage,
      thresholdValue: 100,
      unit: "percentage",
      sourceRecordIds: [facts.asset.id],
    });
  } else if (lifePercentage !== undefined && lifePercentage >= policy.nearExpectedLifePercentage) {
    reasons.push({
      code: "expected_life_reference_near",
      category: "service_life",
      label: "Near expected-life reference",
      detail: `Chronological age is ${lifePercentage}% of the recorded ${facts.expectedLifeYears}-year expected-life reference.`,
      observedValue: lifePercentage,
      thresholdValue: policy.nearExpectedLifePercentage,
      unit: "percentage",
      sourceRecordIds: [facts.asset.id],
    });
  }

  const activity12 = facts.reactiveActivity.trailing12Months;
  if (activity12.distinctWorkOrderCount >= policy.reactiveWorkOrders12Months) {
    reasons.push({
      code: "reactive_work_order_volume",
      category: "activity",
      label: "Multiple reactive work orders",
      detail: `${activity12.distinctWorkOrderCount} distinct reactive work orders and ${activity12.distinctVisitCount} distinct visits are recorded in the trailing 12 months.`,
      observedValue: activity12.distinctWorkOrderCount,
      thresholdValue: policy.reactiveWorkOrders12Months,
      unit: "count",
      sourceRecordIds: unique([...activity12.workOrderIds, ...activity12.visitIds]),
    });
  }

  for (const recurrence of facts.confirmedComponentRecurrences.trailing12Months) {
    if (recurrence.distinctWorkOrderCount < policy.confirmedComponentWorkOrders12Months) continue;
    reasons.push({
      code: "confirmed_component_recurrence",
      category: "component",
      label: "Same tracked component on multiple work orders",
      detail: `${recurrence.componentName} is explicitly linked to ${recurrence.distinctWorkOrderCount} distinct completed reactive work orders in the trailing 12 months. No common failure mode or cause is inferred.`,
      observedValue: recurrence.distinctWorkOrderCount,
      thresholdValue: policy.confirmedComponentWorkOrders12Months,
      unit: "count",
      sourceRecordIds: recurrence.sourceRecordIds,
    });
  }

  const cost12 = facts.costs.trailing12Months;
  if (
    cost12.confirmedActualShareOfReplacementPercentage !== undefined &&
    cost12.confirmedActualShareOfReplacementPercentage >= policy.cleanCostShare12MonthsPercentage
  ) {
    reasons.push({
      code: "clean_cost_share_12_months",
      category: "cost",
      label: "Trailing-12-month supported cost share",
      detail: `Recorded cost or clean matched invoice cost is ${cost12.confirmedActualShareOfReplacementPercentage}% of the current replacement estimate in the trailing 12 months.`,
      observedValue: cost12.confirmedActualShareOfReplacementPercentage,
      thresholdValue: policy.cleanCostShare12MonthsPercentage,
      unit: "percentage",
      sourceRecordIds: cost12.confirmedActualSourceRecordIds,
    });
  } else {
    const cost24 = facts.costs.trailing24Months;
    if (
      cost24.confirmedActualShareOfReplacementPercentage !== undefined &&
      cost24.confirmedActualShareOfReplacementPercentage >= policy.cleanCostShare24MonthsPercentage
    ) {
      reasons.push({
        code: "clean_cost_share_24_months",
        category: "cost",
        label: "Trailing-24-month supported cost share",
        detail: `Recorded cost or clean matched invoice cost is ${cost24.confirmedActualShareOfReplacementPercentage}% of the current replacement estimate in the trailing 24 months.`,
        observedValue: cost24.confirmedActualShareOfReplacementPercentage,
        thresholdValue: policy.cleanCostShare24MonthsPercentage,
        unit: "percentage",
        sourceRecordIds: cost24.confirmedActualSourceRecordIds,
      });
    }
  }

  const needsReviewCost = facts.costs.trailing24Months.needsReviewInvoiceMinor;
  if (needsReviewCost > 0) {
    reasons.push({
      code: "invoice_cost_needs_review",
      category: "invoice_evidence",
      label: "Invoice-linked amount remains under review",
      detail: `${formatMoney(needsReviewCost)} of trailing-24-month invoice allocation is shown separately because its match or an invoice exception still needs review.`,
      observedValue: needsReviewCost,
      unit: "minor_units",
      sourceRecordIds: facts.costs.trailing24Months.needsReviewInvoiceSourceRecordIds,
    });
  }

  if (activity12.temporaryOrUnresolvedWorkOrderIds.length > 0) {
    reasons.push({
      code: "temporary_or_unresolved_work",
      category: "activity",
      label: "Temporary or unresolved outcomes recorded",
      detail: `${activity12.temporaryOrUnresolvedWorkOrderIds.length} trailing-12-month work order(s) have a temporary, waiting-parts, or unresolved outcome.`,
      observedValue: activity12.temporaryOrUnresolvedWorkOrderIds.length,
      unit: "count",
      sourceRecordIds: activity12.temporaryOrUnresolvedWorkOrderIds,
    });
  }

  if (facts.pm.trailing12Months.overdueCount > 0) {
    reasons.push({
      code: "pm_overdue",
      category: "pm",
      label: "Overdue PM occurrence recorded",
      detail: `${facts.pm.trailing12Months.overdueCount} PM occurrence(s) are recorded as overdue in the trailing 12 months. This is context, not a claimed cause of reactive work.`,
      observedValue: facts.pm.trailing12Months.overdueCount,
      thresholdValue: 1,
      unit: "count",
      sourceRecordIds: facts.pm.trailing12Months.sourceRecordIds,
    });
  }

  return reasons;
}

export function getAssetLifecycleDecisionFacts(
  dataset: DemoDataset,
  organizationId: string,
  assetId: string,
  options: LifecycleAnalyticsOptions = {},
): AssetLifecycleDecisionFacts | undefined {
  assertOrganization(dataset, organizationId);
  const asset = dataset.assets.find((candidate) => candidate.organizationId === organizationId && candidate.id === assetId);
  if (!asset) return undefined;
  const ageYears = assetAgeYears(asset.installedOn, dataset.asOf);
  const expectedLifePercentage = ageYears === undefined ? undefined : roundedPercentage(ageYears, asset.expectedLifeYears);
  const replacementOn = expectedReplacementDate(asset.installedOn, asset.expectedLifeYears);
  const costs12 = buildLifecycleCostWindow(dataset, organizationId, asset, 12);
  const costs24 = buildLifecycleCostWindow(dataset, organizationId, asset, 24);
  const activity12 = buildLifecycleActivityWindow(dataset, organizationId, asset.id, 12);
  const activity24 = buildLifecycleActivityWindow(dataset, organizationId, asset.id, 24);
  const pm = buildLifecyclePmFacts(dataset, organizationId, asset.id);
  const recurrences12 = buildConfirmedComponentRecurrences(dataset, organizationId, asset.id, 12);
  const recurrences24 = buildConfirmedComponentRecurrences(dataset, organizationId, asset.id, 24);
  const factsWithoutReasons: Omit<AssetLifecycleDecisionFacts, "reviewReasons" | "sourceRecordIds"> = {
    asset,
    asOf: dataset.asOf,
    assetAgeYears: ageYears,
    expectedLifeYears: asset.expectedLifeYears,
    expectedLifePercentage,
    expectedReplacementOn: replacementOn,
    expectedReplacementYear: replacementOn ? Number(replacementOn.slice(0, 4)) : undefined,
    currentReplacementEstimateMinor: asset.replacementEstimateMinor,
    currency: asset.currency,
    warranty: buildWarrantyFacts(asset, dataset.asOf),
    costs: { trailing12Months: costs12, trailing24Months: costs24 },
    reactiveActivity: { trailing12Months: activity12, trailing24Months: activity24 },
    pm,
    confirmedComponentRecurrences: { trailing12Months: recurrences12, trailing24Months: recurrences24 },
  };
  const reviewReasons = lifecycleReviewReasons(factsWithoutReasons, lifecyclePolicy(options));
  return {
    ...factsWithoutReasons,
    reviewReasons,
    sourceRecordIds: unique([
      asset.id,
      ...activity24.workOrderIds,
      ...activity24.visitIds,
      ...costs24.authorizedSourceRecordIds,
      ...costs24.recordedSourceRecordIds,
      ...costs24.cleanInvoiceSourceRecordIds,
      ...costs24.needsReviewInvoiceSourceRecordIds,
      ...pm.planIds,
      ...pm.trailing24Months.sourceRecordIds,
      ...recurrences24.flatMap((recurrence) => recurrence.sourceRecordIds),
    ]),
  };
}

function assetMatchesLifecycleScope(dataset: DemoDataset, asset: Asset, scope: RecordScope): boolean {
  const store = dataset.stores.find((candidate) => candidate.id === asset.storeId);
  if (scope.regionId && store?.regionId !== scope.regionId) return false;
  if (scope.storeId && asset.storeId !== scope.storeId) return false;
  if (scope.categoryId && asset.categoryId !== scope.categoryId) return false;
  if (scope.assetId && asset.id !== scope.assetId) return false;
  if (scope.vendorId && asset.supplierVendorId !== scope.vendorId) return false;
  return true;
}

export function listAssetLifecycleDecisionFacts(
  dataset: DemoDataset,
  organizationId: string,
  scope: RecordScope = {},
  options: LifecycleAnalyticsOptions = {},
): AssetLifecycleDecisionFacts[] {
  assertOrganization(dataset, organizationId);
  return dataset.assets
    .filter((asset) => asset.organizationId === organizationId && assetMatchesLifecycleScope(dataset, asset, scope))
    .map((asset) => getAssetLifecycleDecisionFacts(dataset, organizationId, asset.id, options)!)
    .sort((left, right) => {
      const leftStore = dataset.stores.find((store) => store.id === left.asset.storeId)?.storeNumber ?? "";
      const rightStore = dataset.stores.find((store) => store.id === right.asset.storeId)?.storeNumber ?? "";
      return leftStore.localeCompare(rightStore, undefined, { numeric: true }) || left.asset.assetCode.localeCompare(right.asset.assetCode);
    });
}

function lifecycleCapexRow(
  dataset: DemoDataset,
  asset: Asset,
  startYear: number,
): LifecycleCapexProjectionRow | undefined {
  const replacementOn = expectedReplacementDate(asset.installedOn, asset.expectedLifeYears);
  if (!replacementOn || !Number.isInteger(asset.replacementEstimateMinor) || asset.replacementEstimateMinor <= 0) return undefined;
  const expectedYear = Number(replacementOn.slice(0, 4));
  const store = dataset.stores.find((candidate) => candidate.id === asset.storeId);
  return {
    rowId: `lifecycle-capex-${asset.id}`,
    assetId: asset.id,
    storeId: asset.storeId,
    regionId: store?.regionId,
    categoryId: asset.categoryId,
    assetCode: asset.assetCode,
    assetName: asset.name,
    expectedReplacementOn: replacementOn,
    expectedReplacementYear: expectedYear,
    currentReplacementEstimateMinor: asset.replacementEstimateMinor,
    currency: asset.currency,
    draft: {
      include: true,
      targetYear: Math.max(startYear, expectedYear),
      amountMinor: asset.replacementEstimateMinor,
      note: "",
    },
    sourceRecordIds: [asset.id],
  };
}

export function getUpcomingLifecycleCapexProjection(
  dataset: DemoDataset,
  organizationId: string,
  options: LifecycleCapexProjectionOptions = {},
): LifecycleCapexProjection {
  assertOrganization(dataset, organizationId);
  const asOfYear = new Date(dataset.asOf).getUTCFullYear();
  const startYear = options.startYear ?? asOfYear;
  const endYear = options.endYear ?? startYear + 5;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new Error("Lifecycle CapEx projection requires integer years with endYear at or after startYear.");
  }
  const scope: RecordScope = {
    regionId: options.regionId,
    storeId: options.storeId,
    categoryId: options.categoryId,
    vendorId: options.vendorId,
    assetId: options.assetId,
  };
  const scopedAssets = dataset.assets.filter((asset) =>
    asset.organizationId === organizationId &&
    (options.includeRetired || asset.status !== "retired") &&
    assetMatchesLifecycleScope(dataset, asset, scope),
  );
  const unprojectableAssetIds: EntityId[] = [];
  const rows = scopedAssets.flatMap((asset) => {
    const row = lifecycleCapexRow(dataset, asset, startYear);
    if (!row) {
      unprojectableAssetIds.push(asset.id);
      return [];
    }
    return [row];
  });
  const asOfDate = dataset.asOf.slice(0, 10);
  const overdueRows = rows
    .filter((row) => row.expectedReplacementOn < asOfDate || row.expectedReplacementYear < startYear)
    .sort((left, right) => left.expectedReplacementOn.localeCompare(right.expectedReplacementOn) || left.assetCode.localeCompare(right.assetCode));
  const upcomingRows = rows.filter((row) =>
    row.expectedReplacementOn >= asOfDate && row.expectedReplacementYear >= startYear && row.expectedReplacementYear <= endYear,
  );
  const yearBuckets: LifecycleCapexYearBucket[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const yearRows = upcomingRows
      .filter((row) => row.expectedReplacementYear === year)
      .sort((left, right) => left.expectedReplacementOn.localeCompare(right.expectedReplacementOn) || left.assetCode.localeCompare(right.assetCode));
    yearBuckets.push({
      year,
      projectedAmountMinor: yearRows.reduce((sum, row) => sum + row.draft.amountMinor, 0),
      assetCount: yearRows.length,
      rows: yearRows,
    });
  }
  const projectedAmountMinor = overdueRows.reduce((sum, row) => sum + row.draft.amountMinor, 0) +
    yearBuckets.reduce((sum, bucket) => sum + bucket.projectedAmountMinor, 0);
  return {
    asOf: dataset.asOf,
    startYear,
    endYear,
    currency: "USD",
    overdueRows,
    yearBuckets,
    projectedAmountMinor,
    unprojectableAssetIds,
    definition: "Planning projection based only on recorded installation date, expected-life reference, and current replacement estimate. Draft plan fields are editable values returned in memory; this is not a failure prediction, replacement decision, or persisted capital plan.",
  };
}

export function getVendorPerformance(
  dataset: DemoDataset,
  organizationId: string,
  scope: RecordScope = {},
): VendorPerformanceRow[] {
  assertOrganization(dataset, organizationId);
  const scopedWork = filterWorkOrders(dataset, organizationId, scope);
  const scopedWorkIds = new Set(scopedWork.map((workOrder) => workOrder.id));
  return dataset.vendors
    .filter((vendor) => vendor.organizationId === organizationId)
    .map((vendor) => {
      const issuances = dataset.vendorIssuances.filter((issuance) => issuance.vendorId === vendor.id && scopedWorkIds.has(issuance.workOrderId) && issuance.version === 1);
      const issuedWorkIds = new Set(issuances.map((issuance) => issuance.workOrderId));
      const visits = dataset.visits.filter((visit) => visit.vendorId === vendor.id && (!visit.workOrderId || scopedWorkIds.has(visit.workOrderId)));
      const spendRows = getSpendSourceRows(dataset, organizationId, { ...scope, vendorId: vendor.id, basis: "invoiced" });
      const exceptions = dataset.exceptions.filter((exception) => exception.vendorId === vendor.id && exception.status !== "resolved" && (!exception.workOrderId || scopedWorkIds.has(exception.workOrderId)));
      const responded = issuances.filter((issuance) => issuance.response);
      const verifiedVisits = visits.filter((visit) => visit.evidenceStrength === "location_verified" && visit.locationEvidence.verification === "inside_geofence");
      return {
        vendor,
        workOrdersIssued: issuances.length,
        acceptedOrResponded: responded.length,
        responseRate: issuances.length === 0 ? 0 : Math.round((responded.length / issuances.length) * 1_000) / 10,
        completedWorkOrders: scopedWork.filter((workOrder) => issuedWorkIds.has(workOrder.id) && ["completed", "awaiting_invoice", "invoice_received", "closed"].includes(workOrder.status)).length,
        observedVisits: visits.length,
        locationVerifiedVisits: verifiedVisits.length,
        visitEvidenceRate: visits.length === 0 ? 0 : Math.round((verifiedVisits.length / visits.length) * 1_000) / 10,
        invoicedSpendMinor: spendRows.reduce((sum, row) => sum + row.amountMinor, 0),
        openExceptionCount: exceptions.length,
        sourceRecordIds: unique([...issuances.map((issuance) => issuance.id), ...visits.map((visit) => visit.id), ...spendRows.map((row) => row.sourceRecordId), ...exceptions.map((exception) => exception.id)]),
      } satisfies VendorPerformanceRow;
    })
    .sort((a, b) => b.invoicedSpendMinor - a.invoicedSpendMinor || a.vendor.displayName.localeCompare(b.vendor.displayName));
}

function checkUniqueIds<T extends { id: string }>(records: T[], collection: string, issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) issues.push({ severity: "error", code: "duplicate_id", message: `${collection} contains duplicate ID ${record.id}.`, recordId: record.id });
    seen.add(record.id);
  }
}

function requireReference(
  condition: boolean,
  code: string,
  message: string,
  recordId: string,
  issues: ValidationIssue[],
): void {
  if (!condition) issues.push({ severity: "error", code, message, recordId });
}

export function validateDemoDataset(
  dataset: DemoDataset,
  organizationId: string,
): ValidationIssue[] {
  assertOrganization(dataset, organizationId);
  const issues: ValidationIssue[] = [];
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["divisions", dataset.divisions], ["regions", dataset.regions], ["stores", dataset.stores], ["categories", dataset.categories],
    ["taxonomyNodes", dataset.taxonomyNodes], ["assets", dataset.assets], ["assetComponents", dataset.assetComponents], ["people", dataset.people],
    ["teams", dataset.teams], ["vendors", dataset.vendors], ["requests", dataset.requests], ["workOrders", dataset.workOrders],
    ["assignments", dataset.assignments], ["vendorIssuances", dataset.vendorIssuances], ["visits", dataset.visits], ["costLines", dataset.costLines],
    ["invoices", dataset.invoices], ["invoiceWorkLinks", dataset.invoiceWorkLinks], ["pmPlans", dataset.pmPlans], ["pmOccurrences", dataset.pmOccurrences],
    ["documents", dataset.documents], ["exceptions", dataset.exceptions], ["auditEvents", dataset.auditEvents],
  ];
  for (const [name, records] of collections) checkUniqueIds(records, name, issues);

  if (dataset.stores.length !== 15) issues.push({ severity: "error", code: "presentation_store_count", message: `Expected exactly 15 presentation stores; found ${dataset.stores.length}.` });
  if (dataset.regions.length !== 3) issues.push({ severity: "error", code: "presentation_region_count", message: `Expected exactly 3 regions; found ${dataset.regions.length}.` });
  if (dataset.vendors.length !== 5) issues.push({ severity: "error", code: "presentation_vendor_count", message: `Expected exactly 5 vendors; found ${dataset.vendors.length}.` });

  for (const [name, records] of collections) {
    for (const record of records as Array<{ id: string; organizationId?: string }>) {
      if (record.organizationId && record.organizationId !== organizationId) issues.push({ severity: "error", code: "tenant_boundary", message: `${name} record belongs to a different organization.`, recordId: record.id });
    }
  }

  const stores = new Map(dataset.stores.map((record) => [record.id, record]));
  const categories = new Set(dataset.categories.map((record) => record.id));
  const assets = new Map(dataset.assets.map((record) => [record.id, record]));
  const workOrders = new Map(dataset.workOrders.map((record) => [record.id, record]));
  const assignments = new Map(dataset.assignments.map((record) => [record.id, record]));
  const vendors = new Set(dataset.vendors.map((record) => record.id));
  const invoices = new Map(dataset.invoices.map((record) => [record.id, record]));
  const visits = new Set(dataset.visits.map((record) => record.id));
  const documents = new Set(dataset.documents.map((record) => record.id));
  const plans = new Map(dataset.pmPlans.map((record) => [record.id, record]));

  for (const store of dataset.stores) {
    requireReference(dataset.regions.some((region) => region.id === store.regionId), "store_region", "Store references a missing region.", store.id, issues);
    if (!dataset.assets.some((asset) => asset.storeId === store.id)) issues.push({ severity: "warning", code: "store_without_assets", message: "Store has no seeded assets.", recordId: store.id });
    if (!dataset.workOrders.some((workOrder) => workOrder.storeId === store.id)) issues.push({ severity: "warning", code: "store_without_work", message: "Store has no seeded work orders.", recordId: store.id });
    if (!dataset.pmPlans.some((plan) => plan.storeId === store.id)) issues.push({ severity: "warning", code: "store_without_pm", message: "Store has no seeded PM plans.", recordId: store.id });
  }

  for (const asset of dataset.assets) {
    requireReference(stores.has(asset.storeId), "asset_store", "Asset references a missing store.", asset.id, issues);
    requireReference(categories.has(asset.categoryId), "asset_category", "Asset references a missing category.", asset.id, issues);
    if (!Number.isInteger(asset.replacementEstimateMinor)) issues.push({ severity: "error", code: "minor_units", message: "Asset replacement estimate is not an integer minor-unit value.", recordId: asset.id });
  }

  for (const component of dataset.assetComponents) requireReference(assets.has(component.assetId), "component_asset", "Component references a missing asset.", component.id, issues);

  for (const workOrder of dataset.workOrders) {
    const store = stores.get(workOrder.storeId);
    requireReference(Boolean(store), "work_store", "Work order references a missing store.", workOrder.id, issues);
    if (workOrder.categoryId) requireReference(categories.has(workOrder.categoryId), "work_category", "Work order references a missing category.", workOrder.id, issues);
    if (workOrder.assetId) {
      const asset = assets.get(workOrder.assetId);
      requireReference(Boolean(asset), "work_asset", "Work order references a missing asset.", workOrder.id, issues);
      if (asset && (asset.storeId !== workOrder.storeId || (workOrder.categoryId && asset.categoryId !== workOrder.categoryId))) {
        issues.push({ severity: "error", code: "physical_belonging", message: "Work-order asset does not belong to its store/category path.", recordId: workOrder.id });
      }
    }
    if (!TERMINAL_WORK_STATUSES.has(workOrder.status) && !workOrder.accountable) issues.push({ severity: "error", code: "missing_accountability", message: "Non-terminal work has no accountable party or next action.", recordId: workOrder.id });
    if (workOrder.classificationDeferred && workOrder.assetId) issues.push({ severity: "warning", code: "deferred_with_asset", message: "Work is marked classification-deferred while already linked to an asset.", recordId: workOrder.id });
    if (workOrder.notToExceedMinor !== undefined && !Number.isInteger(workOrder.notToExceedMinor)) issues.push({ severity: "error", code: "minor_units", message: "Work-order NTE is not an integer minor-unit value.", recordId: workOrder.id });
  }

  for (const assignment of dataset.assignments) {
    requireReference(workOrders.has(assignment.workOrderId), "assignment_work", "Assignment references a missing work order.", assignment.id, issues);
    if (assignment.partyType === "vendor") requireReference(vendors.has(assignment.partyId), "assignment_vendor", "Assignment references a missing vendor.", assignment.id, issues);
  }

  for (const issuance of dataset.vendorIssuances) {
    const assignment = assignments.get(issuance.assignmentId);
    requireReference(workOrders.has(issuance.workOrderId), "issuance_work", "Issuance references a missing work order.", issuance.id, issues);
    requireReference(vendors.has(issuance.vendorId), "issuance_vendor", "Issuance references a missing vendor.", issuance.id, issues);
    requireReference(Boolean(assignment && assignment.workOrderId === issuance.workOrderId && assignment.partyId === issuance.vendorId), "issuance_assignment", "Issuance does not reference the matching vendor assignment.", issuance.id, issues);
  }

  for (const visit of dataset.visits) {
    const store = stores.get(visit.storeId);
    requireReference(Boolean(store), "visit_store", "Visit references a missing store.", visit.id, issues);
    if (visit.workOrderId) {
      const workOrder = workOrders.get(visit.workOrderId);
      requireReference(Boolean(workOrder), "visit_work", "Visit references a missing work order.", visit.id, issues);
      if (workOrder && workOrder.storeId !== visit.storeId) issues.push({ severity: "error", code: "visit_store_mismatch", message: "Visit store does not match its work order.", recordId: visit.id });
    }
    if (visit.vendorId) requireReference(vendors.has(visit.vendorId), "visit_vendor", "Visit references a missing vendor.", visit.id, issues);
    if (visit.checkedOutAt && Date.parse(visit.checkedOutAt) < Date.parse(visit.checkedInAt)) issues.push({ severity: "error", code: "visit_time", message: "Visit checkout precedes check-in.", recordId: visit.id });
    for (const documentId of visit.documentIds) requireReference(documents.has(documentId), "visit_document", "Visit references a missing document.", visit.id, issues);
  }

  for (const costLine of dataset.costLines) {
    requireReference(workOrders.has(costLine.workOrderId), "cost_work", "Cost line references a missing work order.", costLine.id, issues);
    if (!Number.isInteger(costLine.amountMinor)) issues.push({ severity: "error", code: "minor_units", message: "Cost line amount is not an integer minor-unit value.", recordId: costLine.id });
  }

  for (const invoice of dataset.invoices) {
    requireReference(vendors.has(invoice.vendorId), "invoice_vendor", "Invoice references a missing vendor.", invoice.id, issues);
    requireReference(documents.has(invoice.documentId), "invoice_document", "Invoice references a missing document.", invoice.id, issues);
    for (const line of invoice.lineItems) {
      if (!Number.isInteger(line.amountMinor) || line.amountMinor !== line.quantity * line.unitAmountMinor) issues.push({ severity: "error", code: "invoice_line_amount", message: "Invoice line amount does not reconcile quantity and unit amount.", recordId: line.id });
    }
    const linkedAmount = dataset.invoiceWorkLinks.filter((link) => link.invoiceId === invoice.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0);
    const invoiceAmount = getInvoiceTotalMinor(invoice);
    if (linkedAmount !== invoiceAmount) issues.push({ severity: "error", code: "invoice_reconciliation", message: `Invoice links attribute ${linkedAmount} but line items total ${invoiceAmount}.`, recordId: invoice.id });
  }

  for (const link of dataset.invoiceWorkLinks) {
    requireReference(invoices.has(link.invoiceId), "link_invoice", "Invoice work link references a missing invoice.", link.id, issues);
    requireReference(workOrders.has(link.workOrderId), "link_work", "Invoice work link references a missing work order.", link.id, issues);
    const workOrder = workOrders.get(link.workOrderId);
    if (workOrder && workOrder.storeId !== link.storeId) issues.push({ severity: "error", code: "link_store_mismatch", message: "Invoice attribution store does not match the linked work order.", recordId: link.id });
  }

  for (const occurrence of dataset.pmOccurrences) {
    const plan = plans.get(occurrence.pmPlanId);
    requireReference(Boolean(plan), "pm_plan", "PM occurrence references a missing plan.", occurrence.id, issues);
    if (plan && plan.storeId !== occurrence.storeId) issues.push({ severity: "error", code: "pm_store_mismatch", message: "PM occurrence store does not match its plan.", recordId: occurrence.id });
    if (occurrence.workOrderId) requireReference(workOrders.has(occurrence.workOrderId), "pm_work", "PM occurrence references a missing work order.", occurrence.id, issues);
  }

  for (const exception of dataset.exceptions) {
    if (exception.workOrderId) requireReference(workOrders.has(exception.workOrderId), "exception_work", "Exception references a missing work order.", exception.id, issues);
    if (exception.visitId) requireReference(visits.has(exception.visitId), "exception_visit", "Exception references a missing visit.", exception.id, issues);
    if (exception.invoiceId) requireReference(invoices.has(exception.invoiceId), "exception_invoice", "Exception references a missing invoice.", exception.id, issues);
  }

  for (const event of dataset.auditEvents) {
    if (!event.demoMode) issues.push({ severity: "error", code: "demo_audit_label", message: "A demo audit event is not visibly marked Demo Mode.", recordId: event.id });
  }

  return issues;
}

export function assertDemoDataset(dataset: DemoDataset, organizationId: string): void {
  const errors = validateDemoDataset(dataset, organizationId).filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Demo dataset validation failed:\n${errors.map((issue) => `- [${issue.code}] ${issue.message}${issue.recordId ? ` (${issue.recordId})` : ""}`).join("\n")}`);
  }
}
