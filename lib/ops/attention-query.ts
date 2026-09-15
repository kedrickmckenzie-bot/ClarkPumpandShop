import type { OrganizationScope } from "./repository";
import type { OpsFixture, OrganizationRole, PageRequest } from "./types";
import { projectAttentionItems, type AttentionProjectionItem } from "./attention-projection";
import { dashboardPageBounds } from "./dashboard-query";

/** Access is resolved by the server session, never accepted from URL parameters. */
export interface AttentionAccess {
  role: OrganizationRole;
  membershipId?: string;
  canOpenWarranty: boolean;
  canOpenRequest: boolean;
  accountabilityOnly?: boolean;
}
export interface AttentionQuery extends PageRequest {
  asOf: string;
  lane?: AttentionProjectionItem["lane"];
  group?: AttentionProjectionItem["group"];
}
/** A bounded queue row. Detailed source history remains on the linked record. */
export interface AttentionQueueRow extends Omit<AttentionProjectionItem, "sourceIds"> {
  sourceCount: number;
  storeLabel?: string;
  workNumber?: string;
  requestReference?: string;
  vendorName?: string;
}
export interface AttentionPage {
  items: AttentionQueueRow[];
  totalCount: number;
  mineCount: number;
  followUpCount: number;
  nextCursor?: string;
}
export const ACCOUNTABILITY_EXCEPTION_KINDS = ["no_work_order", "unexpected_visit", "missing_checkout", "outside_geofence", "low_accuracy_location", "duplicate_active_visit"] as const;
export function attentionSortKey(row: Pick<AttentionQueueRow, "dueAt" | "priority" | "id">, asOf: string): [number, number, string, string] {
  return [row.dueAt && Date.parse(row.dueAt) <= Date.parse(asOf) ? 0 : 1, { critical: 0, high: 1, normal: 2, low: 3 }[row.priority], row.dueAt ? new Date(row.dueAt).toISOString() : "9999-12-31T00:00:00.000Z", row.id];
}
export function compareAttentionKeys(a: ReturnType<typeof attentionSortKey>, b: ReturnType<typeof attentionSortKey>) {
  return a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);
}
export function attentionCursor(row: AttentionQueueRow, asOf: string) { return Buffer.from(JSON.stringify(attentionSortKey(row, asOf))).toString("base64url"); }
export function readAttentionCursor(value?: string): ReturnType<typeof attentionSortKey> | undefined {
  if (!value) return undefined;
  try {
    const key: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (Array.isArray(key) && key.length === 4 && [0, 1].includes(key[0]) && [0, 1, 2, 3].includes(key[1]) && typeof key[2] === "string" && Number.isFinite(Date.parse(key[2])) && typeof key[3] === "string" && key[3].length > 0 && key[3].length <= 200) return key as ReturnType<typeof attentionSortKey>;
  } catch { /* Do not silently restart an invalid page. */ }
  throw new RangeError("This page link is invalid. Open the first page.");
}
export function validateAttentionQuery(query: AttentionQuery) {
  if (!Number.isFinite(Date.parse(query.asOf))) throw new RangeError("Choose a valid review date.");
  if (query.lane && !["mine", "team", "waiting", "upcoming"].includes(query.lane)) throw new RangeError("Choose an open review lane.");
  if (query.group && !["work_vendor", "completion", "service_record", "financial", "vendor_relationship"].includes(query.group)) throw new RangeError("Choose a review group.");
}
export function attentionFromFixture(fixture: OpsFixture, scope: OrganizationScope, access: AttentionAccess, query: AttentionQuery): AttentionPage {
  validateAttentionQuery(query);
  const stores = fixture.stores.filter(row => row.organizationId === scope.organizationId && (scope.storeIds === undefined || scope.storeIds.includes(row.id)) && (scope.regionIds === undefined || Boolean(row.regionId && scope.regionIds.includes(row.regionId))));
  const rows = projectAttentionItems({ fixture, organizationId: scope.organizationId, storeIds: new Set(stores.map(row => row.id)), includeCompanywide: scope.storeIds === undefined && scope.regionIds === undefined, role: access.role, membershipId: access.membershipId, asOf: query.asOf })
    .filter(row => (access.canOpenWarranty || !row.linkHref.startsWith("/app/warranties/")) && (access.canOpenRequest || !row.linkHref.startsWith("/app/requests/")))
    .filter(row => !access.accountabilityOnly || row.sourceKind !== "vendor_reminder" && (row.sourceKind !== "exception" || (ACCOUNTABILITY_EXCEPTION_KINDS as readonly string[]).includes(row.reason)))
    .filter(row => (!query.lane || row.lane === query.lane) && (!query.group || row.group === query.group))
    .map((row): AttentionQueueRow => {
      const { sourceIds, ...item } = row;
      const store = stores.find(store => store.id === row.storeId);
      return { ...item, dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : undefined, completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined, sourceCount: sourceIds.length,
        storeLabel: row.storeId ? store ? `Store ${store.storeNumber} · ${store.name}` : "Unknown store" : undefined,
        workNumber: fixture.workOrders.find(work => work.organizationId === scope.organizationId && work.id === row.workOrderId && stores.some(store => store.id === work.storeId))?.number,
        requestReference: fixture.requests.find(request => request.organizationId === scope.organizationId && request.id === row.serviceRequestId && stores.some(store => store.id === request.storeId))?.reference,
        vendorName: fixture.vendors.find(vendor => vendor.organizationId === scope.organizationId && vendor.id === row.vendorId)?.name };
    }).sort((a, b) => compareAttentionKeys(attentionSortKey(a, query.asOf), attentionSortKey(b, query.asOf)));
  const { limit, offset } = dashboardPageBounds(query);
  const cursor = readAttentionCursor(query.cursor);
  const visible = cursor ? rows.filter(row => compareAttentionKeys(attentionSortKey(row, query.asOf), cursor) > 0) : rows.slice(offset);
  const items = visible.slice(0, limit);
  return { items, totalCount: rows.length, mineCount: rows.filter(row => row.lane === "mine").length, followUpCount: rows.filter(row => !["exception", "vendor_reminder"].includes(row.sourceKind)).length, nextCursor: visible.length > limit ? attentionCursor(items.at(-1)!, query.asOf) : undefined };
}
