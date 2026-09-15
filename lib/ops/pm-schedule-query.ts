import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest, PmOccurrence } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmStoreAllowed } from "./pm-record-query";

export const PM_SCHEDULE_STATES = ["scheduled", "due", "overdue", "missed", "completed", "waived", "cancelled", "unscheduled"] as const;
export type PmScheduleState = typeof PM_SCHEDULE_STATES[number];
export interface PmScheduleQuery extends PageRequest {
  asOf: string;
  store?: string;
  region?: string;
  program?: string;
  window?: "closed";
  view?: "attention" | "upcoming" | "all";
  status?: PmScheduleState | "follow-up";
  occurrence?: string;
}
export interface PmScheduleRow {
  id: string;
  planId?: string;
  planName: string;
  programId?: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  timeZone?: string;
  assetId?: string;
  assetName?: string;
  categoryKey?: string;
  workId?: string;
  workNumber?: string;
  hasWorkReference: boolean;
  dueAt: string;
  windowStartsAt: string;
  windowEndsAt: string;
  status: PmScheduleState;
  visitCount: number;
  followUpCount: number;
  importedHistory: boolean;
}
export interface PmScheduleSummary {
  states: Record<PmScheduleState, number>;
  all: number;
  attention: number;
  upcoming: number;
  followUp: number;
  closedEligible: number;
  closedCompleted: number;
}
export interface PmSchedulePage { items: PmScheduleRow[]; totalCount: number; summary: PmScheduleSummary; nextOffset?: number; }

export function pmScheduleScope(scope: OrganizationScope, query: Pick<PmScheduleQuery, "store" | "region">): OrganizationScope {
  return { ...scope,
    storeIds: query.store ? scope.storeIds === undefined ? [query.store] : scope.storeIds.filter(id => id === query.store) : scope.storeIds,
    regionIds: query.region ? scope.regionIds === undefined ? [query.region] : scope.regionIds.filter(id => id === query.region) : scope.regionIds,
  };
}
export function validatePmScheduleQuery(query: PmScheduleQuery) {
  if (!Number.isFinite(Date.parse(query.asOf)) || query.view && !["attention", "upcoming", "all"].includes(query.view)
    || query.window && query.window !== "closed" || query.status && ![...PM_SCHEDULE_STATES, "follow-up"].includes(query.status)) throw new RangeError("Choose a valid maintenance view.");
}
export function pmScheduleState(row: PmOccurrence, asOf: string): PmScheduleState {
  if (row.status === "waived" || row.status === "cancelled") return row.status;
  if (row.completedAt || row.status.startsWith("completed")) return "completed";
  if (Date.parse(row.windowEndsAt) < Date.parse(asOf)) return "missed";
  if (Date.parse(row.windowStartsAt) > Date.parse(asOf)) return "scheduled";
  if (["unscheduled", "proposed", "upcoming"].includes(row.status)) return "unscheduled";
  return Date.parse(row.dueAt) < Date.parse(asOf) ? "overdue" : "due";
}
export const pmClosedEligible = (row: Pick<PmScheduleRow, "status" | "windowEndsAt">, asOf: string) => Date.parse(row.windowEndsAt) < Date.parse(asOf) && !["waived", "cancelled"].includes(row.status);
export const pmNeedsAttention = (row: Pick<PmScheduleRow, "status">) => ["due", "overdue", "missed", "unscheduled"].includes(row.status);
export const pmUpcoming = (row: Pick<PmScheduleRow, "status">) => ["scheduled", "due", "overdue"].includes(row.status);

/** Fixture-only reference; persisted queries apply these predicates before returning rows. */
export function pmScheduleRowsFromFixture(fixture: OpsFixture, scope: OrganizationScope, query: PmScheduleQuery): PmScheduleRow[] {
  validatePmScheduleQuery(query);
  const access = pmScheduleScope(scope, query);
  const stores = new Map(fixture.stores.filter(row => pmStoreAllowed(access, row)).map(row => [row.id, row]));
  return fixture.pmOccurrences.filter(row => row.organizationId === scope.organizationId && stores.has(row.storeId)).map(occurrence => {
    const store = stores.get(occurrence.storeId)!;
    const plan = fixture.pmPlans.find(row => row.organizationId === scope.organizationId && row.id === occurrence.planId && (!row.storeId || row.storeId === store.id));
    const program = plan?.programId ? fixture.maintenancePrograms.find(row => row.organizationId === scope.organizationId && row.id === plan.programId) : undefined;
    const asset = fixture.assets.find(row => row.organizationId === scope.organizationId && row.storeId === store.id && row.id === occurrence.assetId);
    const work = fixture.workOrders.find(row => row.organizationId === scope.organizationId && row.storeId === store.id && row.id === occurrence.workOrderId);
    const links = new Set(work ? fixture.siteVisitWorkOrders.filter(row => row.organizationId === scope.organizationId && row.workOrderId === work.id).map(row => row.visitId) : []);
    const status = pmScheduleState(occurrence, query.asOf);
    return { id: occurrence.id, planId: plan?.id, planName: plan?.name ?? "Planned maintenance", programId: program?.id,
      storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, timeZone: store.timeZone,
      assetId: asset?.id, assetName: asset?.name, categoryKey: plan?.categoryKey,
      workId: work?.id, workNumber: work?.number, hasWorkReference: Boolean(occurrence.workOrderId),
      dueAt: new Date(occurrence.dueAt).toISOString(), windowStartsAt: new Date(occurrence.windowStartsAt).toISOString(), windowEndsAt: new Date(occurrence.windowEndsAt).toISOString(), status,
      visitCount: work ? fixture.visits.filter(row => row.organizationId === scope.organizationId && row.storeId === store.id && (row.workOrderId === work.id || links.has(row.id))).length : 0,
      followUpCount: work ? fixture.followUps.filter(row => row.organizationId === scope.organizationId && row.workOrderId === work.id && row.status === "open").length : 0,
      importedHistory: status === "completed" && !occurrence.workOrderId && Boolean(occurrence.result?.startsWith("Manager-attested historical completion")),
    };
  }).filter(row => (!query.program || row.programId === query.program) && (!query.window || pmClosedEligible(row, query.asOf)));
}
export function pmScheduleSummary(rows: PmScheduleRow[], asOf: string): PmScheduleSummary {
  const closed = rows.filter(row => pmClosedEligible(row, asOf));
  return { states: Object.fromEntries(PM_SCHEDULE_STATES.map(state => [state, rows.filter(row => row.status === state).length])) as PmScheduleSummary["states"], all: rows.length,
    attention: rows.filter(pmNeedsAttention).length, upcoming: rows.filter(pmUpcoming).length, followUp: rows.filter(row => row.followUpCount > 0).length,
    closedEligible: closed.length, closedCompleted: closed.filter(row => row.status === "completed").length };
}
export function pmScheduleFromFixture(fixture: OpsFixture, scope: OrganizationScope, query: PmScheduleQuery): PmSchedulePage {
  const base = pmScheduleRowsFromFixture(fixture, scope, query), { limit, offset } = dashboardPageBounds(query);
  const rows = base.filter(row => (!query.view || query.view === "all" || (query.view === "attention" ? pmNeedsAttention(row) : pmUpcoming(row)))
    && (!query.status || (query.status === "follow-up" ? row.followUpCount > 0 : row.status === query.status)) && (!query.occurrence || row.id === query.occurrence))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { items: rows.slice(offset, offset + limit), totalCount: rows.length, summary: pmScheduleSummary(base, query.asOf), nextOffset: offset + limit < rows.length ? offset + limit : undefined };
}
