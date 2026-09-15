import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmClosedEligible, pmScheduleRowsFromFixture, type PmScheduleQuery } from "./pm-schedule-query";

export interface PmAnalysisQuery extends Pick<PmScheduleQuery, "asOf" | "store" | "region" | "program" | "window">, PageRequest {
  kind: "months" | "reactive-cost" | "reactive-work" | "cohort-equipment";
  cohort?: "all" | "completed" | "missed";
  month?: string;
}
export interface PmAnalysisRow {
  id: string;
  date: string;
  assetId?: string;
  assetName?: string;
  storeId?: string;
  storeNumber?: string;
  storeName?: string;
  timeZone?: string;
  workId?: string;
  workNumber?: string;
  description?: string;
  amountMinor: number;
  occurrenceId?: string;
  windowStartsAt?: string;
  windowEndsAt?: string;
  status?: string;
  workCount: number;
}
export interface PmAnalysisSummary { coveredEquipment: number; completedEquipment: number; missedEquipment: number; completedWork: number; missedWork: number; }
export interface PmAnalysisPage { items: PmAnalysisRow[]; totalCount: number; totalAmountMinor: number; summary: PmAnalysisSummary; nextOffset?: number; }
export function pmAnalysisPeriod(asOf: string) {
  return { from: new Date(Date.parse(asOf) - 365.2425 * 86400000).toISOString(), through: new Date(asOf).toISOString().slice(0, 10) };
}
export function validatePmAnalysisQuery(query: PmAnalysisQuery) {
  if (!["months", "reactive-cost", "reactive-work", "cohort-equipment"].includes(query.kind) || query.cohort && !["all", "completed", "missed"].includes(query.cohort)
    || query.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) throw new RangeError("Choose a valid maintenance comparison.");
}
export function pmAnalysisFromFixture(fixture: OpsFixture, scope: OrganizationScope, query: PmAnalysisQuery): PmAnalysisPage {
  validatePmAnalysisQuery(query);
  const occurrences = pmScheduleRowsFromFixture(fixture, scope, query), period = pmAnalysisPeriod(query.asOf);
  const coveredIds = new Set(occurrences.flatMap(row => row.assetId ? [row.assetId] : []));
  const assetById = new Map(fixture.assets.filter(row => row.organizationId === scope.organizationId && coveredIds.has(row.id)).map(row => [row.id, row]));
  const storeById = new Map(fixture.stores.filter(row => row.organizationId === scope.organizationId).map(row => [row.id, row]));
  const latest = new Map<string, typeof occurrences[number]>();
  for (const row of [...occurrences].filter(row => row.assetId && pmClosedEligible(row, query.asOf)).sort((a, b) => Date.parse(b.windowEndsAt) - Date.parse(a.windowEndsAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))) if (!latest.has(row.assetId!)) latest.set(row.assetId!, row);
  const pmWorkIds = new Set(fixture.pmOccurrences.filter(row => row.organizationId === scope.organizationId && fixture.workOrders.some(work => work.organizationId === scope.organizationId && work.id === row.workOrderId && work.storeId === row.storeId)).flatMap(row => row.workOrderId ? [row.workOrderId] : []));
  const reactive = fixture.workOrders.filter(row => row.organizationId === scope.organizationId && row.assetId && assetById.get(row.assetId)?.storeId === row.storeId && !pmWorkIds.has(row.id));
  const reactiveById = new Map(reactive.map(row => [row.id, row]));
  const periodWork = reactive.filter(row => Date.parse(row.createdAt) >= Date.parse(period.from) && Date.parse(row.createdAt) <= Date.parse(query.asOf));
  const cohort = (assetId: string) => latest.get(assetId)?.status === "completed" ? "completed" : latest.has(assetId) ? "missed" : undefined;
  const matches = (assetId: string) => latest.has(assetId) && (!query.cohort || query.cohort === "all" || cohort(assetId) === query.cohort);
  const summary: PmAnalysisSummary = { coveredEquipment: coveredIds.size, completedEquipment: [...latest.keys()].filter(id => cohort(id) === "completed").length, missedEquipment: [...latest.keys()].filter(id => cohort(id) === "missed").length,
    completedWork: periodWork.filter(row => cohort(row.assetId!) === "completed").length, missedWork: periodWork.filter(row => cohort(row.assetId!) === "missed").length };
  const context = (assetId: string) => { const asset = assetById.get(assetId)!, store = storeById.get(asset.storeId)!; return { assetId, assetName: asset.name, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, timeZone: store.timeZone }; };
  const costs = fixture.costLines.filter(row => row.organizationId === scope.organizationId && reactiveById.has(row.workOrderId) && row.serviceDate >= period.from.slice(0, 10) && row.serviceDate <= period.through && row.amount.currency === "USD"
    && (!query.month || row.serviceDate.startsWith(query.month)) && (!query.cohort || query.cohort === "all" || matches(reactiveById.get(row.workOrderId)!.assetId!)));
  let rows: PmAnalysisRow[];
  if (query.kind === "months") {
    const months = new Map<string, number>(); for (const line of costs) months.set(line.serviceDate.slice(0, 7), (months.get(line.serviceDate.slice(0, 7)) ?? 0) + line.amount.amountMinor);
    rows = [...months].map(([id, amountMinor]) => ({ id, date: id, amountMinor, workCount: 0 }));
  } else if (query.kind === "reactive-cost") rows = costs.map(line => { const work = reactiveById.get(line.workOrderId)!; return { id: line.id, date: line.serviceDate, ...context(work.assetId!), workId: work.id, workNumber: work.number, description: line.description, amountMinor: line.amount.amountMinor, workCount: 0 }; });
  else if (query.kind === "reactive-work") rows = periodWork.filter(row => matches(row.assetId!)).map(work => ({ id: work.id, date: new Date(work.createdAt).toISOString(), ...context(work.assetId!), workId: work.id, workNumber: work.number, description: work.problem, amountMinor: 0, workCount: 1 }));
  else rows = [...latest].filter(([id]) => matches(id)).map(([assetId, row]) => ({ id: assetId, date: row.windowEndsAt, ...context(assetId), occurrenceId: row.id, windowStartsAt: row.windowStartsAt, windowEndsAt: row.windowEndsAt, status: row.status, amountMinor: 0, workCount: periodWork.filter(work => work.assetId === assetId).length }));
  rows.sort((a, b) => query.kind === "months" || query.kind === "cohort-equipment" ? a.id < b.id ? -1 : a.id > b.id ? 1 : 0 : Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(query);
  return { items: rows.slice(offset, offset + limit), totalCount: rows.length, totalAmountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0), summary, nextOffset: offset + limit < rows.length ? offset + limit : undefined };
}
