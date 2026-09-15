import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest, PmOccurrence, ValueEvent } from "./types";
import { scopedInvoiceRecords } from "./dashboard-cohorts";
import { dashboardPageBounds } from "./dashboard-query";
import { lifecycleOutstandingState } from "./owner-brief";

export const BRIEF_SOURCES = {
  recorded_cost: "Recorded work cost", invoice_review: "Invoices under review", verified_value: "Confirmed financial benefits",
  opportunity: "Estimated opportunity", other_exposure: "Other amounts to review", opened_work: "Work opened", active_work: "Active work",
  escalations: "Escalations", pm: "PM occurrences", decisions: "Decisions to review", stores: "Cost by store",
} as const;
export type BriefSource = keyof typeof BRIEF_SOURCES;
export interface BriefPeriod { from: string; to: string; asOf: string; currency: string; }
export interface BriefSourceQuery extends PageRequest { kind: BriefSource; storeId?: string; }
export interface BriefSourceRow {
  id: string; label: string; detail: string; storeId?: string; entityId?: string;
  entityType?: "work_order" | "invoice" | "asset" | "request" | "store" | "pm_occurrence";
  amountMinor: number; currency?: string; date?: string; status: string;
  openedWork?: number;
}
export interface BriefSourcePage {
  items: BriefSourceRow[]; totalCount: number; totalAmountMinor: number;
  statuses: Record<string, number>; nextOffset?: number;
}
export const BRIEF_PM_STATES = ["completed_early", "completed_on_time", "completed_late", "completed", "missed", "open", "waived", "unscheduled", "cancelled"] as const;
export interface BriefSummary { period: BriefPeriod; sources: Record<BriefSource, BriefSourcePage>; }
export function validateBriefPeriod(period: BriefPeriod) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(period.from) || !validDate(period.to) || !Number.isFinite(Date.parse(period.asOf)) || period.from > period.to || period.to > period.asOf.slice(0, 10) || !/^[A-Z]{3}$/.test(period.currency)) throw new RangeError("Choose a valid period and currency.");
}
export function briefSourceHref(period: BriefPeriod, kind: BriefSource, offset = 0, storeId?: string) {
  return `/app/brief/records?${new URLSearchParams({ kind, from: period.from, to: period.to, currency: period.currency, ...(offset ? { offset: String(offset) } : {}), ...(storeId ? { store: storeId } : {}) })}`;
}
export function briefPmState(row: PmOccurrence, asOf: string): string {
  if (["waived", "cancelled"].includes(row.status)) return row.status;
  if (row.completedAt) return Date.parse(row.completedAt) < Date.parse(row.windowStartsAt) ? "completed_early" : Date.parse(row.completedAt) <= Date.parse(row.windowEndsAt) ? "completed_on_time" : "completed_late";
  if (row.status.startsWith("completed")) return row.status;
  if (Date.parse(row.windowEndsAt) < Date.parse(asOf)) return "missed";
  return ["unscheduled", "proposed", "upcoming"].includes(row.status) ? "unscheduled" : "open";
}
export function briefSourcePage(rows: BriefSourceRow[], query: BriefSourceQuery): BriefSourcePage {
  const { limit, offset } = dashboardPageBounds(query);
  const ordered = [...rows].sort((a, b) => query.kind === "stores" ? b.amountMinor - a.amountMinor || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1) : (b.date ?? "").localeCompare(a.date ?? "") || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
  return { items: ordered.slice(offset, offset + limit), totalCount: rows.length, totalAmountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0), statuses: Object.fromEntries(BRIEF_PM_STATES.map(state => [state, rows.filter(row => row.status === state).length])), nextOffset: offset + limit < rows.length ? offset + limit : undefined };
}

/** Fixture-only reference. Persisted adapters execute these cohorts in scoped SQL. */
export function briefSourcesFromFixture(fixture: OpsFixture, scope: OrganizationScope, period: BriefPeriod, query: BriefSourceQuery): BriefSourcePage {
  validateBriefPeriod(period);
  const within = (date: string) => date.slice(0, 10) >= period.from && date.slice(0, 10) <= period.to;
  const stores = fixture.stores.filter(row => row.organizationId === scope.organizationId && (!query.storeId || row.id === query.storeId) && (scope.storeIds === undefined || scope.storeIds.includes(row.id)) && (scope.regionIds === undefined || Boolean(row.regionId && scope.regionIds.includes(row.regionId))));
  const storeIds = new Set(stores.map(row => row.id));
  const work = fixture.workOrders.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId));
  const workById = new Map(work.map(row => [row.id, row]));
  const assets = fixture.assets.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId));
  const assetById = new Map(assets.map(row => [row.id, row]));
  const invoices = scopedInvoiceRecords(fixture, scope.organizationId, storeIds);
  const invoiceIds = new Set(invoices.map(row => row.id));
  const lineIds = new Set(fixture.invoiceLines.filter(row => row.organizationId === scope.organizationId && invoiceIds.has(row.invoiceId)).map(row => row.id));
  const requests = new Map(fixture.requests.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId)).map(row => [row.id, row]));
  const costs = fixture.costLines.filter(row => row.organizationId === scope.organizationId && workById.has(row.workOrderId) && within(row.serviceDate) && row.amount.currency === period.currency);
  const taskRows = fixture.workflowTasks.filter(row => row.organizationId === scope.organizationId && ["open", "in_progress"].includes(row.status) && (row.workOrderId ? workById.has(row.workOrderId) : Boolean(row.serviceRequestId && requests.has(row.serviceRequestId))));
  const taskSource = (task: typeof taskRows[number]): BriefSourceRow => ({ id: task.id, label: task.title, detail: task.reason, storeId: task.workOrderId ? workById.get(task.workOrderId)?.storeId : requests.get(task.serviceRequestId!)?.storeId, entityId: task.workOrderId ?? task.serviceRequestId, entityType: task.workOrderId ? "work_order" : "request", amountMinor: 0, date: task.dueAt ? new Date(task.dueAt).toISOString() : undefined, status: task.taskType === "approve_quote" ? "approval" : "escalated_task" });
  const valueVisible = (row: ValueEvent) => {
    if (row.workOrderId && !workById.has(row.workOrderId) || row.assetId && !assetById.has(row.assetId) || row.invoiceLineId && !lineIds.has(row.invoiceLineId)) return false;
    if (row.warrantyCaseId && !fixture.warrantyCases.some(item => item.organizationId === scope.organizationId && item.id === row.warrantyCaseId && workById.has(item.workOrderId) && assetById.has(item.assetId))) return false;
    if (row.approvalDecisionId && !fixture.approvalDecisions.some(item => item.organizationId === scope.organizationId && item.id === row.approvalDecisionId && fixture.approvalRequests.some(request => request.organizationId === scope.organizationId && request.id === item.approvalRequestId && storeIds.has(request.storeId)))) return false;
    if (row.contractVersionId && !fixture.contractVersions.some(item => item.organizationId === scope.organizationId && item.id === row.contractVersionId)) return false;
    if (row.serviceRunId) {
      const linked = fixture.serviceRunWorkOrders.filter(item => item.organizationId === scope.organizationId && item.serviceRunId === row.serviceRunId);
      const stops = fixture.routeStops.filter(item => item.organizationId === scope.organizationId && item.serviceRunId === row.serviceRunId);
      if (!fixture.serviceRuns.some(item => item.organizationId === scope.organizationId && item.id === row.serviceRunId) || !linked.length || linked.some(item => !workById.has(item.workOrderId)) || stops.some(item => !storeIds.has(item.storeId))) return false;
    }
    return !query.storeId && scope.storeIds === undefined && scope.regionIds === undefined || Boolean(row.workOrderId || row.assetId || row.invoiceLineId || row.warrantyCaseId || row.approvalDecisionId || row.serviceRunId);
  };
  let rows: BriefSourceRow[];
  if (query.kind === "recorded_cost") rows = costs.map(row => ({ id: row.id, label: `${workById.get(row.workOrderId)!.number} · ${row.description}`, detail: row.kind, entityId: row.workOrderId, entityType: "work_order", storeId: workById.get(row.workOrderId)!.storeId, amountMinor: row.amount.amountMinor, currency: row.amount.currency, date: row.serviceDate.slice(0, 10), status: row.kind }));
  else if (query.kind === "invoice_review") rows = invoices.filter(row => row.total.currency === period.currency && fixture.invoiceExceptions.some(flag => flag.organizationId === scope.organizationId && flag.invoiceId === row.id && flag.status === "open")).map(row => ({ id: row.id, label: row.vendorInvoiceNumber, detail: "Open review flag", entityId: row.id, entityType: "invoice", amountMinor: row.total.amountMinor, currency: row.total.currency, date: row.invoiceDate.slice(0, 10), status: row.status }));
  else if (["verified_value", "opportunity", "other_exposure"].includes(query.kind)) {
    const category = query.kind === "verified_value" ? "realized_verified" : query.kind === "opportunity" ? "estimated_opportunity" : "identified_exposure";
    rows = fixture.valueEvents.filter(row => row.organizationId === scope.organizationId && row.category === category && row.amount.currency === period.currency && within(row.occurredAt) && valueVisible(row) && (query.kind !== "other_exposure" || !row.eventType.startsWith("invoice_"))).map(row => ({ id: row.id, label: row.eventType, detail: row.sourceDecision, entityId: row.workOrderId ?? row.assetId, entityType: row.workOrderId ? "work_order" : row.assetId ? "asset" : undefined, storeId: row.workOrderId ? workById.get(row.workOrderId)?.storeId : row.assetId ? assetById.get(row.assetId)?.storeId : undefined, amountMinor: row.amount.amountMinor, currency: row.amount.currency, date: row.occurredAt.slice(0, 10), status: row.category }));
  } else if (query.kind === "opened_work" || query.kind === "active_work") rows = work.filter(row => query.kind === "opened_work" ? within(row.createdAt) : !["resolved", "closed", "cancelled"].includes(row.status)).map(row => ({ id: row.id, label: row.number, detail: row.problem, storeId: row.storeId, entityId: row.id, entityType: "work_order", amountMinor: 0, date: row.createdAt.slice(0, 10), status: row.status }));
  else if (query.kind === "escalations") rows = taskRows.filter(row => row.escalationLevel > 0).map(taskSource);
  else if (query.kind === "pm") rows = fixture.pmOccurrences.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId) && within(row.dueAt)).map(row => ({ id: row.id, label: `${fixture.pmPlans.find(plan => plan.organizationId === scope.organizationId && plan.id === row.planId)?.name ?? "Store PM"} · Store ${stores.find(store => store.id === row.storeId)!.storeNumber}`, detail: assetById.get(row.assetId ?? "")?.name ?? "Store PM", storeId: row.storeId, entityId: row.id, entityType: "pm_occurrence", amountMinor: 0, date: row.dueAt.slice(0, 10), status: briefPmState(row, period.asOf) }));
  else if (query.kind === "stores") rows = stores.map(store => ({ id: store.id, label: `Store ${store.storeNumber} · ${store.name}`, detail: "", storeId: store.id, entityId: store.id, entityType: "store", amountMinor: costs.filter(row => workById.get(row.workOrderId)!.storeId === store.id).reduce((sum, row) => sum + row.amount.amountMinor, 0), currency: period.currency, openedWork: work.filter(row => row.storeId === store.id && within(row.createdAt)).length, status: store.status }));
  else if (query.kind === "decisions") {
    rows = taskRows.filter(row => row.taskType === "approve_quote" || row.escalationLevel > 0).map(task => ({ ...taskSource(task), id: `task:${task.id}` }));
    for (const asset of assets) {
      const decision = fixture.lifecycleRecommendations.filter(row => row.organizationId === scope.organizationId && row.assetId === asset.id).sort((a, b) => b.version - a.version || b.decidedAt.localeCompare(a.decidedAt) || b.id.localeCompare(a.id))[0];
      if (!decision || !["capital_review", "replace"].includes(decision.recommendation)) continue;
      const state = lifecycleOutstandingState(decision); if (!state) continue;
      rows.push({ id: `lifecycle:${decision.id}`, label: `${asset.name} · ${state}`, detail: decision.userReason, storeId: asset.storeId, entityId: asset.id, entityType: "asset", amountMinor: 0, date: new Date(decision.decidedAt).toISOString(), status: "lifecycle" });
    }
  } else throw new RangeError("Choose a brief record type.");
  return briefSourcePage(rows, query);
}
