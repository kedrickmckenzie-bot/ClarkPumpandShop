import type { OpsRepository, OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest, Store } from "./types";
import { dashboardPageBounds } from "./dashboard-query";

export function pmStoreAllowed(scope: OrganizationScope, store: Store) {
  return store.organizationId === scope.organizationId
    && (scope.storeIds === undefined || scope.storeIds.includes(store.id))
    && (scope.regionIds === undefined || scope.regionIds.includes(store.regionId ?? ""));
}

/** Resolve the parent store before reading any linked record. Dangling links stay unavailable. */
export async function readPmPlanRecord(repository: OpsRepository, scope: OrganizationScope, id: string) {
  const plan = await repository.getPmPlan(scope.organizationId, id);
  const store = plan?.storeId ? await repository.getStore(scope.organizationId, plan.storeId) : null;
  if (!plan || !store || !pmStoreAllowed(scope, store)) return null;
  const [candidateAsset, program] = await Promise.all([
    plan.assetId ? repository.getAsset(scope.organizationId, plan.assetId) : null,
    plan.programId ? repository.getMaintenanceProgram(scope.organizationId, plan.programId) : null,
  ]);
  const asset = candidateAsset?.storeId === store.id ? candidateAsset : null;
  return { plan, store, asset, program };
}

export async function readPmOccurrenceRecord(repository: OpsRepository, scope: OrganizationScope, id: string) {
  const occurrence = await repository.getPmOccurrence(scope.organizationId, id);
  const store = occurrence ? await repository.getStore(scope.organizationId, occurrence.storeId) : null;
  if (!occurrence || !store || !pmStoreAllowed(scope, store)) return null;
  const [candidatePlan, candidateAsset, candidateWork] = await Promise.all([
    repository.getPmPlan(scope.organizationId, occurrence.planId),
    occurrence.assetId ? repository.getAsset(scope.organizationId, occurrence.assetId) : null,
    occurrence.workOrderId ? repository.getWorkOrder(scope.organizationId, occurrence.workOrderId) : null,
  ]);
  // A store-free rule may serve several stores; a store-specific plan may only serve its own.
  const plan = candidatePlan && (!candidatePlan.storeId || candidatePlan.storeId === store.id) ? candidatePlan : null;
  const asset = candidateAsset?.storeId === store.id ? candidateAsset : null;
  const work = candidateWork?.storeId === store.id ? candidateWork : null;
  return { occurrence, store, plan, asset, work };
}

export interface WorkVisitEvidence {
  id: string;
  checkedInAt: string;
  checkedOutAt?: string;
  providerName: string;
  technicianName: string;
  status: string;
}
export interface WorkVisitEvidencePage {
  items: WorkVisitEvidence[];
  totalCount: number;
  nextOffset?: number;
}

export function workVisitEvidencePage(items: WorkVisitEvidence[], totalCount: number, request: PageRequest): WorkVisitEvidencePage {
  const { limit, offset } = dashboardPageBounds(request);
  return { items, totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}

export function workVisitEvidenceFromFixture(fixture: OpsFixture, scope: OrganizationScope, workId: string, request: PageRequest) {
  const work = fixture.workOrders.find(row => row.organizationId === scope.organizationId && row.id === workId);
  const store = fixture.stores.find(row => row.organizationId === scope.organizationId && row.id === work?.storeId);
  if (!work || !store || !pmStoreAllowed(scope, store)) return workVisitEvidencePage([], 0, request);
  const links = new Set(fixture.siteVisitWorkOrders.filter(row => row.organizationId === scope.organizationId && row.workOrderId === workId).map(row => row.visitId));
  const rows = fixture.visits.filter(row => row.organizationId === scope.organizationId && row.storeId === store.id && (row.workOrderId === workId || links.has(row.id)))
    .sort((a, b) => Date.parse(b.checkedInAt) - Date.parse(a.checkedInAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const { limit, offset } = dashboardPageBounds(request);
  return workVisitEvidencePage(rows.slice(offset, offset + limit).map(row => ({ id: row.id, checkedInAt: new Date(row.checkedInAt).toISOString(), checkedOutAt: row.checkedOutAt ? new Date(row.checkedOutAt).toISOString() : undefined, providerName: row.providerName, technicianName: row.technicianName, status: row.status })), rows.length, request);
}
