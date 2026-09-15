import type { OpsFixture, PageRequest } from "./types";
import type { OrganizationScope } from "./repository";
import type { BriefSourceRow } from "./owner-brief-query";
import { dashboardPageBounds } from "./dashboard-query";
import { scopedInvoiceRecords } from "./dashboard-cohorts";

export const INTEGRITY_SOURCES = {
  closed_work: "Closed work", with_outcome: "Visit outcome recorded", without_outcome: "No visit outcome recorded",
  vendor_closed: "Closed work with an outside assignment", verified: "Latest outside-work outcome verified", unverified: "Latest outside-work outcome not verified",
  with_cost: "Work cost recorded", without_cost: "No work cost recorded",
  missing_action: "Work without a next action", aged_invoice: "Invoice reviews 30+ days old",
  unclassified_work: "Work not yet classified", missing_life: "Equipment life not entered",
} as const;
export type IntegritySource = keyof typeof INTEGRITY_SOURCES;
export type IntegrityCounts = Record<IntegritySource, number>;
export interface IntegrityQuery extends PageRequest { kind: IntegritySource; }
export interface IntegrityPage { items: BriefSourceRow[]; totalCount: number; counts: IntegrityCounts; nextOffset?: number; }
export function integrityHref(kind: IntegritySource, offset = 0) {
  return `/app/brief/integrity?${new URLSearchParams({ kind, ...(offset ? { offset: String(offset) } : {}) })}`;
}
export function validateIntegrityQuery(asOf: string, query: IntegrityQuery) {
  if (!Number.isFinite(Date.parse(asOf)) || !Object.hasOwn(INTEGRITY_SOURCES, query.kind)) throw new RangeError("Choose a valid record check.");
}
const binary = (a: string, b: string) => a === b ? 0 : a < b ? -1 : 1;
/** Fixture reference only; persisted adapters count and page inside the database. */
export function integrityFromFixture(fixture: OpsFixture, scope: OrganizationScope, asOf: string, query: IntegrityQuery): IntegrityPage {
  validateIntegrityQuery(asOf, query);
  const stores = fixture.stores.filter(row => row.organizationId === scope.organizationId && (scope.storeIds === undefined || scope.storeIds.includes(row.id)) && (scope.regionIds === undefined || scope.regionIds.includes(row.regionId ?? "")));
  const storeIds = new Set(stores.map(row => row.id));
  const groups = Object.fromEntries(Object.keys(INTEGRITY_SOURCES).map(key => [key, []])) as unknown as Record<IntegritySource, BriefSourceRow[]>;
  const add = (kind: IntegritySource, row: BriefSourceRow) => groups[kind].push(row);
  for (const work of fixture.workOrders.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId))) {
    const row: BriefSourceRow = { id: work.id, label: `${work.number} · Store ${stores.find(store => store.id === work.storeId)!.storeNumber}`, detail: work.problem, entityId: work.id, entityType: "work_order", storeId: work.storeId, amountMinor: 0, date: new Date(work.closedAt ?? work.resolvedAt ?? work.createdAt).toISOString(), status: work.status };
    if (["resolved", "closed"].includes(work.status)) {
      add("closed_work", row);
      const latest = fixture.siteVisitWorkOrders.filter(item => item.organizationId === scope.organizationId && item.workOrderId === work.id).sort((a, b) => Date.parse(b.linkedAt) - Date.parse(a.linkedAt) || Date.parse(b.outcomeRecordedAt ?? "1970-01-01") - Date.parse(a.outcomeRecordedAt ?? "1970-01-01") || binary(b.id, a.id))[0];
      const outcome = latest?.outcome && latest.outcomeRecordedAt ? latest : undefined;
      add(outcome ? "with_outcome" : "without_outcome", row);
      const hasCost = fixture.costLines.some(item => item.organizationId === scope.organizationId && item.workOrderId === work.id);
      add(hasCost ? "with_cost" : "without_cost", row);
      if (fixture.assignments.some(item => item.organizationId === scope.organizationId && item.workOrderId === work.id && item.vendorId)) {
        add("vendor_closed", row);
        const check = outcome ? fixture.workOrderVerifications.filter(item => item.organizationId === scope.organizationId && item.workOrderId === work.id && item.siteVisitWorkOrderId === outcome.id).sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt) || binary(b.id, a.id))[0] : undefined;
        add(check?.decision === "verified" && check.outcome === outcome?.outcome && Date.parse(check.outcomeRecordedAt) === Date.parse(outcome?.outcomeRecordedAt ?? "") ? "verified" : "unverified", row);
      }
    } else if (work.status !== "cancelled" && !fixture.workflowTasks.some(task => task.organizationId === scope.organizationId && task.workOrderId === work.id && ["open", "in_progress"].includes(task.status))) add("missing_action", row);
    if (work.status !== "cancelled" && !work.categoryKey?.trim()) add("unclassified_work", row);
  }
  for (const invoice of scopedInvoiceRecords(fixture, scope.organizationId, storeIds)) {
    const oldest = fixture.invoiceExceptions.filter(row => row.organizationId === scope.organizationId && row.invoiceId === invoice.id && row.status === "open").sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt))[0];
    if (oldest && Date.parse(oldest.detectedAt) <= Date.parse(asOf) - 30 * 86_400_000) add("aged_invoice", { id: invoice.id, label: invoice.vendorInvoiceNumber, detail: "Oldest open review flag", entityId: invoice.id, entityType: "invoice", amountMinor: 0, date: new Date(oldest.detectedAt).toISOString(), status: "Needs review" });
  }
  for (const asset of fixture.assets.filter(row => row.organizationId === scope.organizationId && storeIds.has(row.storeId) && row.status !== "retired" && !row.expectedLifeYears)) add("missing_life", { id: asset.id, label: `${asset.name} · Store ${stores.find(store => store.id === asset.storeId)!.storeNumber}`, detail: "Optional equipment detail", entityId: asset.id, entityType: "asset", storeId: asset.storeId, amountMinor: 0, date: new Date(asset.createdAt).toISOString(), status: "Not entered" });
  const counts = Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.length])) as IntegrityCounts;
  const { limit, offset } = dashboardPageBounds(query);
  const rows = groups[query.kind].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || binary(a.id, b.id));
  return { items: rows.slice(offset, offset + limit), totalCount: rows.length, counts, nextOffset: offset + limit < rows.length ? offset + limit : undefined };
}
