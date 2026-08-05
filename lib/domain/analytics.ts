import type {
  Asset,
  CostAllocation,
  DemoData,
  PmOccurrence,
  WorkOrder,
} from "@/lib/domain/types";

export const CLOSED_STATUSES = new Set(["closed", "cancelled"]);

export function isOpenWorkOrder(workOrder: WorkOrder) {
  return !CLOSED_STATUSES.has(workOrder.status);
}

export function formatCurrency(cents: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(cents / 100);
}

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileValue * sorted.length) - 1));
  return sorted[index];
}

function monthShift(value: Date, months: number) {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function allocationsInPeriod(
  data: DemoData,
  start: Date,
  end: Date,
  filter: {
    storeId?: string;
    categoryId?: string;
    systemId?: string;
    assetId?: string;
    componentId?: string;
    classes?: CostAllocation["workClass"][];
  } = {},
) {
  const paidInvoiceIds = new Set(
    data.invoices
      .filter((invoice) => {
        const issuedAt = new Date(invoice.issuedAt);
        return invoice.status === "paid" && issuedAt >= start && issuedAt < end;
      })
      .map((invoice) => invoice.id),
  );
  return data.allocations.filter((allocation) => {
    if (!paidInvoiceIds.has(allocation.invoiceId)) return false;
    if (filter.storeId && allocation.storeId !== filter.storeId) return false;
    if (filter.categoryId && allocation.categoryId !== filter.categoryId) return false;
    if (filter.systemId && allocation.systemId !== filter.systemId) return false;
    if (filter.assetId && allocation.assetId !== filter.assetId) return false;
    if (filter.componentId && allocation.componentId !== filter.componentId) return false;
    if (filter.classes && !filter.classes.includes(allocation.workClass)) return false;
    return true;
  });
}

export function spendForPeriod(
  data: DemoData,
  start: Date,
  end: Date,
  filter: Parameters<typeof allocationsInPeriod>[3] = {},
) {
  const invoiceSpend = allocationsInPeriod(data, start, end, filter).reduce((sum, allocation) => sum + allocation.amountCents, 0);
  const filteredInvoiceIds = new Set(allocationsInPeriod(data, start, end, filter).map((allocation) => allocation.invoiceId));
  const postedCredits = data.credits
    .filter((credit) => credit.status === "posted" && filteredInvoiceIds.has(credit.invoiceId))
    .reduce((sum, credit) => sum + credit.amountCents, 0);
  return invoiceSpend - postedCredits;
}

export function trailingPeriods(nowValue: string) {
  const now = new Date(nowValue);
  return {
    now,
    ttmStart: monthShift(now, -12),
    priorStart: monthShift(now, -24),
  };
}

function occurrenceMatches(
  data: DemoData,
  occurrence: PmOccurrence,
  filter: { storeId?: string; categoryId?: string; systemId?: string; assetId?: string; vendorId?: string },
) {
  const plan = data.pmPlans.find((candidate) => candidate.id === occurrence.planId);
  if (!plan) return false;
  if (filter.storeId && occurrence.storeId !== filter.storeId) return false;
  if (filter.categoryId && plan.categoryId !== filter.categoryId) return false;
  if (filter.systemId && occurrence.systemId !== filter.systemId) return false;
  if (filter.assetId && occurrence.assetId !== filter.assetId) return false;
  if (filter.vendorId && plan.vendorId !== filter.vendorId) return false;
  return true;
}

export function pmCompliance(
  data: DemoData,
  filter: { storeId?: string; categoryId?: string; systemId?: string; assetId?: string; vendorId?: string } = {},
  nowValue = data ? "2026-08-05T14:00:00.000Z" : new Date().toISOString(),
) {
  const now = new Date(nowValue);
  const eligible = data.pmOccurrences.filter((occurrence) => {
    if (!occurrenceMatches(data, occurrence, filter)) return false;
    if (new Date(occurrence.dueAt) > now) return false;
    return !["waived", "not_applicable", "scheduled", "due_soon"].includes(occurrence.status);
  });
  const onTime = eligible.filter((occurrence) => ["completed_early", "completed_on_time"].includes(occurrence.status) && occurrence.verified);
  return {
    numerator: onTime.length,
    denominator: eligible.length,
    value: eligible.length === 0 ? 1 : onTime.length / eligible.length,
  };
}

export interface ReplacementReason {
  key: string;
  label: string;
  value: string;
  threshold: string;
}

export function replacementAnalysis(data: DemoData, asset: Asset, nowValue = "2026-08-05T14:00:00.000Z") {
  const { now, ttmStart, priorStart } = trailingPeriods(nowValue);
  const currentReactive = spendForPeriod(data, ttmStart, now, { assetId: asset.id, classes: ["reactive", "emergency", "diagnostic"] });
  const priorReactive = spendForPeriod(data, priorStart, ttmStart, { assetId: asset.id, classes: ["reactive", "emergency", "diagnostic"] });
  const ageYears = (now.getTime() - new Date(asset.installedAt).getTime()) / (365.2425 * 86_400_000);
  const workOrders = data.workOrders.filter((workOrder) => {
    const createdAt = new Date(workOrder.createdAt);
    return workOrder.assetId === asset.id && createdAt >= ttmStart && createdAt < now && ["reactive", "emergency"].includes(workOrder.workType);
  });
  const workOrderIds = new Set(workOrders.map((workOrder) => workOrder.id));
  const assetVisits = data.visits.filter((visit) => workOrderIds.has(visit.workOrderId));
  const system = data.systems.find((candidate) => candidate.id === asset.storeSystemId);
  const compliance = pmCompliance(data, { systemId: asset.storeSystemId }, nowValue);
  const burden = asset.replacementCostCents > 0 ? currentReactive / asset.replacementCostCents : 0;
  const increase = priorReactive > 0 ? (currentReactive - priorReactive) / priorReactive : 0;
  const reasons: ReplacementReason[] = [];

  if (ageYears / asset.expectedLifeYears >= 0.8) reasons.push({ key: "age", label: "Asset is late in expected service life", value: `${ageYears.toFixed(1)} years`, threshold: `≥ 80% of ${asset.expectedLifeYears}-year life` });
  if (burden >= 0.4) reasons.push({ key: "burden", label: "Recent repair burden is high", value: formatPercent(burden), threshold: "≥ 40% of estimated replacement cost" });
  if (increase >= 0.35 && currentReactive - priorReactive >= 250_000) reasons.push({ key: "trend", label: "Reactive repair cost is increasing", value: `+${formatPercent(increase)}`, threshold: "≥ 35% and ≥ $2,500 increase" });
  if (workOrders.length >= 3) reasons.push({ key: "failures", label: "Repeated reactive failures", value: `${workOrders.length} work orders`, threshold: "≥ 3 in trailing 12 months" });
  if (assetVisits.length >= 5) reasons.push({ key: "visits", label: "High service-visit volume", value: `${assetVisits.length} verified visits`, threshold: "≥ 5 in trailing 12 months" });
  if (Math.max(0, workOrders.length - 2) >= 2) reasons.push({ key: "repeat", label: "Repeat failures or callbacks", value: `${Math.max(0, workOrders.length - 2)} repeat failures`, threshold: "≥ 2" });
  if (compliance.value < 0.8) reasons.push({ key: "pm", label: "Preventive maintenance adherence is low", value: formatPercent(compliance.value), threshold: "< 80% on-time" });
  if (new Date(asset.warrantyEndsAt) < now) reasons.push({ key: "warranty", label: "Manufacturer warranty has expired", value: formatDate(asset.warrantyEndsAt), threshold: "Warranty end before today" });

  const hasMajorReason = reasons.some((reason) => ["age", "burden", "trend"].includes(reason.key));
  const recommended = reasons.length >= 3 && hasMajorReason;
  return {
    recommended,
    ageYears,
    currentReactive,
    priorReactive,
    increase,
    burden,
    failureCount: workOrders.length,
    visitCount: assetVisits.length,
    repeatFailures: Math.max(0, workOrders.length - 2),
    compliance,
    reasons,
    system,
  };
}

export function replacementWatchlist(data: DemoData, nowValue = "2026-08-05T14:00:00.000Z") {
  return data.assets
    .map((asset) => ({ asset, analysis: replacementAnalysis(data, asset, nowValue) }))
    .filter((item) => item.analysis.recommended)
    .sort((a, b) => b.analysis.burden - a.analysis.burden);
}

export function storeComparison(data: DemoData, nowValue = "2026-08-05T14:00:00.000Z") {
  const { now, ttmStart, priorStart } = trailingPeriods(nowValue);
  const refrigerationSpends = data.stores.map((store) => spendForPeriod(data, ttmStart, now, { storeId: store.id, categoryId: "refrigeration" }));
  const companyMedian = median(refrigerationSpends.filter((value) => value > 0));
  const p90 = percentile(refrigerationSpends.filter((value) => value > 0), 0.9);

  return data.stores.map((store) => {
    const open = data.workOrders.filter((workOrder) => workOrder.storeId === store.id && isOpenWorkOrder(workOrder));
    const spend = spendForPeriod(data, ttmStart, now, { storeId: store.id });
    const priorSpend = spendForPeriod(data, priorStart, ttmStart, { storeId: store.id });
    const refrigerationSpend = spendForPeriod(data, ttmStart, now, { storeId: store.id, categoryId: "refrigeration" });
    const reactive = spendForPeriod(data, ttmStart, now, { storeId: store.id, classes: ["reactive", "emergency", "diagnostic"] });
    const planned = spendForPeriod(data, ttmStart, now, { storeId: store.id, classes: ["planned_pm"] });
    const workOrderIds = new Set(data.workOrders.filter((workOrder) => workOrder.storeId === store.id).map((workOrder) => workOrder.id));
    const repeatVisits = data.visits.filter((visit) => workOrderIds.has(visit.workOrderId)).length - new Set(data.visits.filter((visit) => workOrderIds.has(visit.workOrderId)).map((visit) => visit.workOrderId)).size;
    const replacementCandidates = replacementWatchlist(data, nowValue).filter(({ asset }) => data.systems.find((system) => system.id === asset.storeSystemId)?.storeId === store.id).length;
    const ratio = companyMedian > 0 ? refrigerationSpend / companyMedian : 0;
    return {
      store,
      openCount: open.length,
      criticalCount: open.filter((workOrder) => workOrder.priority === "critical").length,
      spend,
      priorSpend,
      change: priorSpend > 0 ? (spend - priorSpend) / priorSpend : 0,
      pm: pmCompliance(data, { storeId: store.id }, nowValue),
      reactivePlannedRatio: planned > 0 ? reactive / planned : reactive > 0 ? Number.POSITIVE_INFINITY : 0,
      repeatVisits: Math.max(0, repeatVisits),
      replacementCandidates,
      refrigerationSpend,
      outlierRatio: ratio,
      isOutlier: refrigerationSpend >= 500_000 && (ratio >= 1.75 || refrigerationSpend >= p90),
    };
  });
}

export function classificationCoverage(data: DemoData) {
  const categorized = data.workOrders.filter((workOrder) => Boolean(workOrder.categoryId)).length;
  const systemMapped = data.workOrders.filter((workOrder) => Boolean(workOrder.systemId)).length;
  const postedInvoiceIds = new Set(data.invoices.filter((invoice) => invoice.status === "paid").map((invoice) => invoice.id));
  const posted = data.allocations.filter((allocation) => postedInvoiceIds.has(allocation.invoiceId));
  const spend = posted.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  const assetSpend = posted.filter((allocation) => allocation.assetId).reduce((sum, allocation) => sum + allocation.amountCents, 0);
  const componentSpend = posted.filter((allocation) => allocation.componentId).reduce((sum, allocation) => sum + allocation.amountCents, 0);
  return {
    categorized: data.workOrders.length ? categorized / data.workOrders.length : 0,
    systemMapped: data.workOrders.length ? systemMapped / data.workOrders.length : 0,
    assetSpend: spend ? assetSpend / spend : 0,
    componentSpend: spend ? componentSpend / spend : 0,
  };
}

export function commandCenterMetrics(data: DemoData, nowValue = "2026-08-05T14:00:00.000Z") {
  const now = new Date(nowValue);
  const { ttmStart, priorStart } = trailingPeriods(nowValue);
  const openWork = data.workOrders.filter(isOpenWorkOrder);
  const approvedNotInvoiced = data.authorizations
    .filter((authorization) => authorization.status !== "cancelled")
    .reduce((sum, authorization) => {
      const invoiced = data.invoices.filter((invoice) => invoice.workOrderId === authorization.workOrderId && invoice.status !== "void").reduce((invoiceSum, invoice) => invoiceSum + invoice.totalCents, 0);
      return sum + Math.max(0, authorization.amountCents - invoiced);
    }, 0);
  const currentYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const previousYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const previousYearEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1));
  const currentYear = spendForPeriod(data, currentYearStart, now, {});
  const priorYear = spendForPeriod(data, previousYearStart, previousYearEnd, {});
  return {
    openCritical: openWork.filter((workOrder) => workOrder.priority === "critical").length,
    overdueFollowUps: data.followUps.filter((followUp) => followUp.status === "open" && new Date(followUp.dueAt) < now).length,
    missingNextAction: openWork.filter((workOrder) => !workOrder.accountableParty || !workOrder.nextAction || !workOrder.dueAt || !workOrder.escalation).length,
    awaitingVendor: openWork.filter((workOrder) => workOrder.vendorAcceptance === "pending").length,
    pm: pmCompliance(data, {}, nowValue),
    ttmSpend: spendForPeriod(data, ttmStart, now, {}),
    priorTtmSpend: spendForPeriod(data, priorStart, ttmStart, {}),
    currentYear,
    priorYear,
    yearChange: priorYear > 0 ? (currentYear - priorYear) / priorYear : 0,
    approvedNotInvoiced,
    invoicesReview: data.invoices.filter((invoice) => invoice.status === "review" || invoice.status === "submitted").length,
    replacementCandidates: replacementWatchlist(data, nowValue).length,
    outlierStores: storeComparison(data, nowValue).filter((row) => row.isOutlier).length,
  };
}

export function workOrderSpend(data: DemoData, workOrderId: string) {
  const invoiceIds = new Set(data.invoices.filter((invoice) => invoice.workOrderId === workOrderId && invoice.status !== "void").map((invoice) => invoice.id));
  return data.allocations.filter((allocation) => invoiceIds.has(allocation.invoiceId)).reduce((sum, allocation) => sum + allocation.amountCents, 0);
}

export function allocationTotals(data: DemoData, invoiceId: string) {
  const invoice = data.invoices.find((candidate) => candidate.id === invoiceId);
  const allocated = data.allocations.filter((allocation) => allocation.invoiceId === invoiceId).reduce((sum, allocation) => sum + allocation.amountCents, 0);
  return { total: invoice?.totalCents ?? 0, allocated, unallocated: Math.max(0, (invoice?.totalCents ?? 0) - allocated) };
}
