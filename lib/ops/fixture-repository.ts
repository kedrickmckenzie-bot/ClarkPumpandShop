import {
  NORTHLINE_AS_OF,
  NORTHLINE_DEMO_ENTRY_TOKENS,
  NORTHLINE_DEMO_TOKEN_HASHES,
  buildNorthlinePresentationFixture,
} from "./fixtures";
import type {
  ExceptionQueueQuery,
  MutableOpsFixtureRepository,
  OpsRepository,
  OpsStatement,
  OrganizationScope,
  PublicTokenLookup,
  WorkOrderListQuery,
} from "./repository";
import type {
  IsoDateTime,
  OpsFixture,
  OpsId,
  Page,
  PageRequest,
  Store,
  VisitSession,
  WorkOrder,
} from "./types";
import type {
  ActiveVisitView,
  AssetDetailView,
  ExceptionQueueRow,
  ExecutiveSnapshotView,
  PmOccurrenceRow,
  PublicStoreGatewayView,
  RequestListRow,
  ServiceAuthorizationView,
  StoreDetailView,
  StoreSearchRow,
  StoreVisitContextView,
  TrustedStoreActiveVisitRow,
  TrustedStoreDeviceView,
  VendorDirectoryRow,
  VisitListRow,
  WorkOrderDetailView,
  WorkOrderListRow,
} from "./view-models";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function normalize(value: string) { return value.trim().toLocaleLowerCase("en-US"); }
function snakeToCamel(value: string) { return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()); }
function formatAddress(store: Store) { return [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "); }
function inPeriod(value: string, startsAt: string, endsAt: string) { return value >= startsAt && value <= endsAt; }

function page<T extends { id: string }>(rows: T[], request: PageRequest = {}): Page<T> {
  const limit = Math.max(1, Math.min(100, request.limit ?? 25));
  const start = request.cursor ? Math.max(0, rows.findIndex((row) => row.id === request.cursor) + 1) : 0;
  const items = rows.slice(start, start + limit);
  return { items, nextCursor: start + limit < rows.length ? items.at(-1)?.id : undefined };
}

function storeAllowed(fixture: OpsFixture, scope: OrganizationScope, storeId: OpsId) {
  const store = fixture.stores.find((row) => row.organizationId === scope.organizationId && row.id === storeId);
  if (!store) return false;
  if (scope.storeIds !== undefined && !scope.storeIds.includes(store.id)) return false;
  if (scope.regionIds !== undefined && (!store.regionId || !scope.regionIds.includes(store.regionId))) return false;
  return true;
}

function exceptionAllowed(fixture: OpsFixture, scope: OrganizationScope, storeId?: OpsId) {
  if (storeId) return storeAllowed(fixture, scope, storeId);
  return scope.storeIds === undefined && scope.regionIds === undefined;
}

function tokenRecord(fixture: OpsFixture, input: PublicTokenLookup) {
  return fixture.publicTokens.find((row) => row.tokenHash === input.tokenHash && row.purpose === input.purpose && row.expiresAt > input.now && !row.revokedAt) ?? null;
}

function locationResult(fixture: OpsFixture, organizationId: OpsId, visitId: OpsId) {
  return fixture.visitEvidence.find((row) => row.organizationId === organizationId && row.visitId === visitId && row.kind === "check_in")?.location?.result ?? "not_requested";
}

function visitRow(fixture: OpsFixture, visit: VisitSession): VisitListRow {
  const store = fixture.stores.find((row) => row.organizationId === visit.organizationId && row.id === visit.storeId)!;
  const workOrder = visit.workOrderId ? fixture.workOrders.find((row) => row.organizationId === visit.organizationId && row.id === visit.workOrderId) : undefined;
  return {
    id: visit.id, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name,
    providerKind: visit.providerKind, vendorId: visit.vendorId, internalMembershipId: visit.internalMembershipId,
    providerName: visit.providerName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number,
    technicianName: visit.technicianName, purpose: visit.purpose, status: visit.status,
    checkedInAt: visit.checkedInAt, checkedOutAt: visit.checkedOutAt, outcome: visit.outcome,
    locationResult: locationResult(fixture, visit.organizationId, visit.id), approximateObservedSeconds: visit.observedDurationSeconds,
  };
}

function workOrderRow(fixture: OpsFixture, workOrder: WorkOrder): WorkOrderListRow {
  const store = fixture.stores.find((row) => row.organizationId === workOrder.organizationId && row.id === workOrder.storeId)!;
  const assignment = fixture.assignments.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).at(-1);
  const vendor = assignment?.vendorId ? fixture.vendors.find((row) => row.organizationId === workOrder.organizationId && row.id === assignment.vendorId) : undefined;
  return {
    id: workOrder.id, number: workOrder.number, storeId: store.id, storeNumber: store.storeNumber,
    storeName: store.name, problem: workOrder.problem, categoryKey: workOrder.categoryKey,
    priority: workOrder.priority, status: workOrder.status, assignmentKind: assignment?.kind ?? "choose_later",
    assignmentStatus: assignment?.status, vendorId: vendor?.id, vendorName: vendor?.name,
    accountableParty: workOrder.accountableParty, nextAction: workOrder.nextAction, dueAt: workOrder.dueAt,
    createdAt: workOrder.createdAt, visitCount: fixture.visits.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).length,
    recordedCostMinor: fixture.costLines.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).reduce((sum, row) => sum + row.amount.amountMinor, 0), currency: "USD",
  };
}

function requestRow(fixture: OpsFixture, request: OpsFixture["requests"][number]): RequestListRow {
  const store = fixture.stores.find((row) => row.organizationId === request.organizationId && row.id === request.storeId)!;
  return { id: request.id, reference: request.reference, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, reporterName: request.reporterName, problem: request.problem, priority: request.priority, status: request.status, submittedAt: request.submittedAt, convertedWorkOrderId: request.convertedWorkOrderId };
}

function mapTable(fixture: OpsFixture, table: string): Array<Record<string, unknown>> {
  const mapping: Record<string, keyof OpsFixture> = {
    ops_divisions: "divisions", ops_regions: "regions", ops_taxonomy_nodes: "taxonomyNodes",
    ops_stores: "stores", ops_users: "users", ops_memberships: "memberships",
    ops_scope_grants: "scopeGrants", ops_vendors: "vendors", ops_vendor_specialties: "vendorSpecialties",
    ops_vendor_coverage: "vendorCoverage", ops_requests: "requests", ops_work_orders: "workOrders",
    ops_work_order_assignments: "assignments", ops_work_order_issuances: "issuances",
    ops_vendor_responses: "vendorResponses", ops_visit_sessions: "visits", ops_visit_evidence: "visitEvidence",
    ops_files: "files", ops_entity_files: "entityFiles",
    ops_follow_ups: "followUps", ops_exceptions: "exceptions", ops_assets: "assets",
    ops_asset_components: "components", ops_pm_plans: "pmPlans", ops_pm_occurrences: "pmOccurrences",
    ops_cost_lines: "costLines", ops_invoice_references: "invoiceReferences", ops_invoice_allocations: "invoiceAllocations",
    ops_audit_events: "auditEvents", ops_outbox_messages: "outboxMessages", ops_public_tokens: "publicTokens",
  };
  const key = mapping[table];
  if (!key) throw new Error(`Fixture repository does not support table ${table}`);
  return fixture[key] as unknown as Array<Record<string, unknown>>;
}

function hydrateInserted(table: string, raw: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => { row[snakeToCamel(key)] = value; });
  if (table === "ops_taxonomy_nodes") { row.aliases = JSON.parse(String(row.aliasesJson ?? "[]")); row.active = Boolean(row.active); delete row.aliasesJson; }
  if (table === "ops_stores") { row.aliases = JSON.parse(String(row.aliasesJson ?? "[]")); row.locationPolicyEnabled = Boolean(row.locationPolicyEnabled); delete row.aliasesJson; delete row.searchText; }
  if (table === "ops_vendors") { row.preferred = Boolean(row.preferred); delete row.searchText; }
  if (table === "ops_vendor_specialties") { row.searchAliases = JSON.parse(String(row.searchAliasesJson ?? "[]")); delete row.searchAliasesJson; }
  if (table === "ops_work_orders" && row.nteAmountMinor !== undefined) { row.nte = { amountMinor: row.nteAmountMinor, currency: row.nteCurrency ?? "USD" }; delete row.nteAmountMinor; delete row.nteCurrency; }
  if (table === "ops_visit_evidence") { row.location = { result: row.locationResult ?? "not_requested", latitudeE6: row.latitudeE6, longitudeE6: row.longitudeE6, accuracyM: row.accuracyM, distanceM: row.distanceM, capturedAt: row.observedAt }; delete row.locationResult; delete row.latitudeE6; delete row.longitudeE6; delete row.accuracyM; delete row.distanceM; }
  if (table === "ops_cost_lines") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_invoice_references") { row.grossAmount = { amountMinor: row.grossAmountMinor, currency: row.currency }; delete row.grossAmountMinor; delete row.currency; }
  if (table === "ops_invoice_allocations") { row.amount = { amountMinor: row.amountMinor, currency: row.currency }; delete row.amountMinor; delete row.currency; }
  if (table === "ops_assets") {
    row.groupPath = JSON.parse(String(row.groupPathJson ?? "[]"));
    delete row.groupPathJson;
    if (row.replacementEstimateMinor !== undefined) row.replacementEstimate = { amountMinor: row.replacementEstimateMinor, currency: row.replacementCurrency ?? "USD" };
    delete row.replacementEstimateMinor;
    delete row.replacementCurrency;
  }
  if (table === "ops_pm_plans") row.active = Boolean(row.active);
  return row;
}

function applyStatement(fixture: OpsFixture, statement: OpsStatement) {
  const insertMatch = statement.sql.match(/^INSERT INTO ([a-z0-9_]+) \((.+)\) VALUES \((.+)\)$/i);
  if (insertMatch) {
    const table = insertMatch[1]; const columns = insertMatch[2].split(",").map((item) => item.trim());
    const raw = Object.fromEntries(columns.map((column, index) => [column, statement.params[index]]));
    const rows = mapTable(fixture, table); const row = hydrateInserted(table, raw);
    if (row.id && rows.some((item) => item.id === row.id)) throw new Error(`Duplicate fixture id ${String(row.id)}`);
    if (table === "ops_visit_evidence" && ["check_in", "check_out"].includes(String(row.kind)) && rows.some((item) => item.organizationId === row.organizationId && item.visitId === row.visitId && item.kind === row.kind)) throw new Error(`Visit already has ${String(row.kind)} evidence`);
    rows.push(row); return;
  }
  const updateMatch = statement.sql.match(/^UPDATE ([a-z0-9_]+) SET (.+) WHERE (.+)$/i);
  if (updateMatch) {
    const table = updateMatch[1]; const setColumns = [...updateMatch[2].matchAll(/([a-z0-9_]+) = \?/gi)].map((match) => match[1]);
    const whereColumns = [...updateMatch[3].matchAll(/([a-z0-9_]+) = \?/gi)].map((match) => match[1]);
    const setValues = statement.params.slice(0, setColumns.length); const whereValues = statement.params.slice(setColumns.length);
    const rows = mapTable(fixture, table);
    rows.filter((row) => whereColumns.every((column, index) => row[snakeToCamel(column)] === whereValues[index])).forEach((row) => setColumns.forEach((column, index) => { row[snakeToCamel(column)] = setValues[index]; }));
    return;
  }
  throw new Error(`Fixture repository cannot execute statement: ${statement.sql}`);
}

class FixtureOpsRepository implements MutableOpsFixtureRepository {
  readonly kind = "fixture" as const;
  private counters = new Map<string, number>();
  constructor(private fixture: OpsFixture) {
    for (const organization of fixture.organizations) {
      const max = fixture.workOrders.filter((row) => row.organizationId === organization.id).map((row) => Number(row.number.match(/(\d+)$/)?.[1] ?? 0)).reduce((highest, value) => Math.max(highest, value), 0);
      this.counters.set(`${organization.id}:2026`, max + 1);
    }
  }
  snapshot() { return clone(this.fixture); }

  async getOrganization(organizationId: OpsId) { return clone(this.fixture.organizations.find((row) => row.id === organizationId) ?? null); }
  async getDivision(organizationId: OpsId, divisionId: OpsId) { return clone(this.fixture.divisions.find((row) => row.organizationId === organizationId && row.id === divisionId) ?? null); }
  async getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId) { return clone(this.fixture.taxonomyNodes.find((row) => row.organizationId === organizationId && row.id === taxonomyNodeId) ?? null); }
  async listTaxonomyNodes(organizationId: OpsId) { return clone(this.fixture.taxonomyNodes.filter((row) => row.organizationId === organizationId).sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))); }
  async getStore(organizationId: OpsId, storeId: OpsId) { return clone(this.fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId) ?? null); }
  async getVendor(organizationId: OpsId, vendorId: OpsId) { return clone(this.fixture.vendors.find((row) => row.organizationId === organizationId && row.id === vendorId) ?? null); }
  async getMembership(organizationId: OpsId, membershipId: OpsId) { return clone(this.fixture.memberships.find((row) => row.organizationId === organizationId && row.id === membershipId) ?? null); }
  async getRequest(organizationId: OpsId, requestId: OpsId) { return clone(this.fixture.requests.find((row) => row.organizationId === organizationId && row.id === requestId) ?? null); }
  async getWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === workOrderId) ?? null); }
  async getAsset(organizationId: OpsId, assetId: OpsId) { return clone(this.fixture.assets.find((row) => row.organizationId === organizationId && row.id === assetId) ?? null); }
  async getComponent(organizationId: OpsId, componentId: OpsId) { return clone(this.fixture.components.find((row) => row.organizationId === organizationId && row.id === componentId) ?? null); }
  async getAssignment(organizationId: OpsId, assignmentId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.id === assignmentId) ?? null); }
  async getIssuance(organizationId: OpsId, issuanceId: OpsId) { return clone(this.fixture.issuances.find((row) => row.organizationId === organizationId && row.id === issuanceId) ?? null); }
  async getVisit(organizationId: OpsId, visitId: OpsId) { return clone(this.fixture.visits.find((row) => row.organizationId === organizationId && row.id === visitId) ?? null); }
  async getActiveAssignment(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.assignments.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && !["cancelled", "declined", "completed", "superseded"].includes(row.status)).at(-1) ?? null); }
  async getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { return clone(this.fixture.issuances.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).sort((a, b) => b.revision - a.revision).at(0) ?? null); }
  async getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId) { return clone(this.fixture.vendorResponses.filter((row) => row.organizationId === organizationId && row.assignmentId === assignmentId).sort((a, b) => b.respondedAt.localeCompare(a.respondedAt)).at(0) ?? null); }
  async findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && row.vendorId === vendorId && !["cancelled", "declined", "completed", "superseded"].includes(row.status)) ?? null); }
  async findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId) { return clone(this.fixture.assignments.find((row) => row.organizationId === organizationId && row.workOrderId === workOrderId && row.internalMembershipId === membershipId && !["cancelled", "declined", "completed", "superseded"].includes(row.status)) ?? null); }
  async vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId) { const store = this.fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId); if (!store) return false; return this.fixture.vendorCoverage.some((row) => row.organizationId === organizationId && row.vendorId === vendorId && (row.scopeKind === "organization" && row.scopeId === organizationId || row.scopeKind === "region" && row.scopeId === store.regionId || row.scopeKind === "store" && row.scopeId === store.id)); }
  async findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }) { return clone(this.fixture.visits.find((row) => row.organizationId === organizationId && row.storeId === storeId && row.status === "active" && row.vendorId === provider.vendorId && row.internalMembershipId === provider.internalMembershipId && normalize(row.technicianName) === normalize(provider.technicianName)) ?? null); }
  async listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]> { return clone(this.fixture.visits.filter((row) => row.organizationId === organizationId && row.storeId === storeId && row.status === "active").sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id)).map((visit) => { const workOrder = visit.workOrderId ? this.fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === visit.workOrderId) : undefined; return { id: visit.id, providerKind: visit.providerKind, vendorId: visit.vendorId, internalMembershipId: visit.internalMembershipId, providerName: visit.providerName, technicianName: visit.technicianName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number, unmatchedReason: visit.unmatchedReason, purpose: visit.purpose, checkedInAt: visit.checkedInAt, startedChannel: visit.startedChannel }; })); }
  async allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number) { if (!this.fixture.organizations.some((row) => row.id === organizationId)) throw new Error("Organization not found"); const key = `${organizationId}:${year}`; const next = this.counters.get(key) ?? 1; this.counters.set(key, next + 1); return `${prefix}-${year}-${String(next).padStart(4, "0")}`; }

  async searchStores(scope: OrganizationScope, search: string, request?: PageRequest) {
    const query = normalize(search);
    const rows = this.fixture.stores.filter((store) => storeAllowed(this.fixture, scope, store.id)).filter((store) => !query || normalize([store.storeNumber, store.name, store.address1, store.address2, store.city, store.state, store.postalCode, ...store.aliases].filter(Boolean).join(" ")).includes(query)).sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true })).map((store): StoreSearchRow => ({
      id: store.id,
      storeNumber: store.storeNumber,
      name: store.name,
      regionName: this.fixture.regions.find((row) => row.organizationId === scope.organizationId && row.id === store.regionId)?.name,
      formattedAddress: formatAddress(store),
      openWorkCount: this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.storeId === store.id && !["closed", "cancelled"].includes(row.status)).length,
      activeVisitCount: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.storeId === store.id && row.status === "active").length,
      recordedCostMinor: this.fixture.costLines.filter((cost) => cost.organizationId === scope.organizationId && this.fixture.workOrders.some((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === cost.workOrderId && workOrder.storeId === store.id)).reduce((sum, row) => sum + row.amount.amountMinor, 0),
      currency: "USD",
    }));
    return page(rows, request);
  }

  async getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null> {
    if (!storeAllowed(this.fixture, scope, storeId)) return null;
    const store = this.fixture.stores.find((row) => row.organizationId === scope.organizationId && row.id === storeId)!;
    const base = (await this.searchStores(scope, store.storeNumber, { limit: 100 })).items.find((row) => row.id === storeId)!;
    const openWorkOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId && !["closed", "cancelled"].includes(row.status)).map((row) => workOrderRow(this.fixture, row));
    return { ...base, regionId: store.regionId, status: store.status, activeVisits: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId && row.status === "active").map((row) => visitRow(this.fixture, row)), openWorkOrders, assets: this.fixture.assets.filter((row) => row.organizationId === scope.organizationId && row.storeId === storeId).map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, status: asset.status, recordedCostMinor: this.fixture.costLines.filter((cost) => cost.organizationId === scope.organizationId && this.fixture.workOrders.some((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === cost.workOrderId && workOrder.assetId === asset.id)).reduce((sum, cost) => sum + cost.amount.amountMinor, 0) })) };
  }

  async listRequests(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) {
    const rows = this.fixture.requests.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((row) => requestRow(this.fixture, row));
    return page(rows, query);
  }

  async listWorkOrders(scope: OrganizationScope, query: WorkOrderListQuery = {}) {
    const search = normalize(query.search ?? "");
    const rows = this.fixture.workOrders.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.statuses?.length || query.statuses.includes(row.status)) && (!query.priorities?.length || query.priorities.includes(row.priority)) && (!query.storeId || row.storeId === query.storeId) && (!query.regionId || this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)?.regionId === query.regionId) && (!query.vendorId || this.fixture.assignments.some((assignment) => assignment.organizationId === scope.organizationId && assignment.workOrderId === row.id && assignment.vendorId === query.vendorId)) && (!query.createdFrom || row.createdAt >= query.createdFrom) && (!query.createdTo || row.createdAt <= query.createdTo)).map((row) => workOrderRow(this.fixture, row)).filter((row) => !search || normalize([row.number, row.problem, row.storeNumber, row.storeName, row.vendorName].filter(Boolean).join(" ")).includes(search)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.number.localeCompare(b.number));
    return page(rows, query);
  }

  async getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null> {
    const workOrder = this.fixture.workOrders.find((row) => row.organizationId === scope.organizationId && row.id === workOrderId);
    if (!workOrder || !storeAllowed(this.fixture, scope, workOrder.storeId)) return null;
    const base = workOrderRow(this.fixture, workOrder);
    const asset = workOrder.assetId ? this.fixture.assets.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.assetId) : undefined;
    const component = workOrder.componentId ? this.fixture.components.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.componentId) : undefined;
    const request = workOrder.requestId ? this.fixture.requests.find((row) => row.organizationId === scope.organizationId && row.id === workOrder.requestId) : undefined;
    return { ...base, request: request ? requestRow(this.fixture, request) : undefined, authorizedScope: workOrder.authorizedScope, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, component: component ? { id: component.id, name: component.name } : undefined, nte: workOrder.nte, vendorServiceTicketNumber: workOrder.vendorServiceTicketNumber, vendorInvoiceNumber: workOrder.vendorInvoiceNumber, externalAccountingPo: workOrder.externalAccountingPo, visits: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id).map((row) => visitRow(this.fixture, row)), followUps: this.fixture.followUps.filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id).map((row) => ({ id: row.id, nextAction: row.nextAction, accountableParty: row.accountableParty, dueAt: row.dueAt, status: row.status })), costs: this.fixture.costLines.filter((row) => row.organizationId === scope.organizationId && row.workOrderId === workOrder.id).map((row) => ({ id: row.id, kind: row.kind, description: row.description, amountMinor: row.amount.amountMinor, currency: row.amount.currency, serviceDate: row.serviceDate })) };
  }

  async listVendors(scope: OrganizationScope, search = "", request?: PageRequest) {
    const query = normalize(search);
    const rows = this.fixture.vendors.filter((row) => row.organizationId === scope.organizationId).filter((vendor) => !query || normalize([vendor.name, ...this.fixture.vendorSpecialties.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).flatMap((row) => [row.displayName, ...row.searchAliases])].join(" ")).includes(query)).sort((a, b) => a.name.localeCompare(b.name)).map((vendor): VendorDirectoryRow => { const workOrderIds = new Set(this.fixture.assignments.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.workOrderId)); const visitCounts = new Map<string, number>(); this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id && row.workOrderId && storeAllowed(this.fixture, scope, row.storeId)).forEach((row) => visitCounts.set(row.workOrderId!, (visitCounts.get(row.workOrderId!) ?? 0) + 1)); return { id: vendor.id, name: vendor.name, status: vendor.status, preferred: vendor.preferred, specialties: this.fixture.vendorSpecialties.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.displayName), coverageLabels: this.fixture.vendorCoverage.filter((row) => row.organizationId === scope.organizationId && row.vendorId === vendor.id).map((row) => row.scopeKind === "organization" ? "All stores" : row.scopeId), openWorkOrders: this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && workOrderIds.has(row.id) && !["closed", "cancelled"].includes(row.status)).length, activeVisits: this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && row.vendorId === vendor.id && row.status === "active").length, returnVisitWorkOrders: [...visitCounts.values()].filter((count) => count > 1).length }; });
    return page(rows, request);
  }

  async listVisits(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId; vendorId?: OpsId } = {}) { const rows = this.fixture.visits.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId) && (!query.vendorId || row.vendorId === query.vendorId)).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)).map((row) => visitRow(this.fixture, row)); return page(rows, query); }

  async listExceptions(scope: OrganizationScope, query: ExceptionQueueQuery = {}) { const rows = this.fixture.exceptions.filter((row) => row.organizationId === scope.organizationId && exceptionAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.statuses?.length || query.statuses.includes(row.status)) && (!query.kinds?.length || query.kinds.includes(row.kind)) && (!query.storeId || row.storeId === query.storeId) && (!query.vendorId || row.vendorId === query.vendorId)).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).map((row): ExceptionQueueRow => ({ id: row.id, kind: row.kind, status: row.status, severity: row.severity, summary: row.summary, storeId: row.storeId, storeNumber: this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)?.storeNumber, workOrderId: row.workOrderId, workOrderNumber: this.fixture.workOrders.find((workOrder) => workOrder.organizationId === scope.organizationId && workOrder.id === row.workOrderId)?.number, visitId: row.visitId, detectedAt: row.detectedAt })); return page(rows, query); }

  async getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null> { const asset = this.fixture.assets.find((row) => row.organizationId === scope.organizationId && row.id === assetId); if (!asset || !storeAllowed(this.fixture, scope, asset.storeId)) return null; const workOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && row.assetId === asset.id).map((row) => workOrderRow(this.fixture, row)); return { id: asset.id, storeId: asset.storeId, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, groupPath: asset.groupPath, manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber, installedAt: asset.installedAt, expectedLifeYears: asset.expectedLifeYears, warrantyEndsAt: asset.warrantyEndsAt, replacementEstimateMinor: asset.replacementEstimate?.amountMinor, currency: asset.replacementEstimate?.currency ?? "USD", status: asset.status, components: this.fixture.components.filter((row) => row.organizationId === scope.organizationId && row.assetId === asset.id).map((row) => ({ id: row.id, parentComponentId: row.parentComponentId, name: row.name, partNumber: row.partNumber, serialNumber: row.serialNumber })), workOrders, recordedCostMinor: workOrders.reduce((sum, row) => sum + row.recordedCostMinor, 0) }; }

  async listPmOccurrences(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) { const rows = this.fixture.pmOccurrences.filter((row) => storeAllowed(this.fixture, scope, row.storeId)).filter((row) => (!query.status || row.status === query.status) && (!query.storeId || row.storeId === query.storeId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((row): PmOccurrenceRow => ({ id: row.id, planId: row.planId, planName: this.fixture.pmPlans.find((plan) => plan.organizationId === scope.organizationId && plan.id === row.planId)?.name ?? "PM plan", storeId: row.storeId, storeNumber: this.fixture.stores.find((store) => store.organizationId === scope.organizationId && store.id === row.storeId)!.storeNumber, assetId: row.assetId, assetName: this.fixture.assets.find((asset) => asset.organizationId === scope.organizationId && asset.id === row.assetId)?.name, dueAt: row.dueAt, windowStartsAt: row.windowStartsAt, windowEndsAt: row.windowEndsAt, status: row.status, workOrderId: row.workOrderId })); return page(rows, query); }

  async getExecutiveSnapshot(scope: OrganizationScope, period: { startsAt: IsoDateTime; endsAt: IsoDateTime }): Promise<ExecutiveSnapshotView> { const workOrders = this.fixture.workOrders.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && inPeriod(row.createdAt, period.startsAt, period.endsAt)); const visits = this.fixture.visits.filter((row) => row.organizationId === scope.organizationId && storeAllowed(this.fixture, scope, row.storeId) && inPeriod(row.checkedInAt, period.startsAt, period.endsAt)); const exceptions = this.fixture.exceptions.filter((row) => row.organizationId === scope.organizationId && exceptionAllowed(this.fixture, scope, row.storeId) && inPeriod(row.detectedAt, period.startsAt, period.endsAt)); const followUps = this.fixture.followUps.filter((row) => { if (row.organizationId !== scope.organizationId) return false; const workOrder = this.fixture.workOrders.find((item) => item.organizationId === scope.organizationId && item.id === row.workOrderId); return workOrder && storeAllowed(this.fixture, scope, workOrder.storeId); }); const costLines = this.fixture.costLines.filter((row) => { if (row.organizationId !== scope.organizationId) return false; const workOrder = this.fixture.workOrders.find((item) => item.organizationId === scope.organizationId && item.id === row.workOrderId); return workOrder && storeAllowed(this.fixture, scope, workOrder.storeId) && row.serviceDate >= period.startsAt.slice(0, 10) && row.serviceDate <= period.endsAt.slice(0, 10); }); return { organizationId: scope.organizationId, period, scope: { regionId: scope.regionIds?.length === 1 ? scope.regionIds[0] : undefined, storeId: scope.storeIds?.length === 1 ? scope.storeIds[0] : undefined }, activeVisits: visits.filter((row) => row.status === "active").length, unexpectedVisits: exceptions.filter((row) => row.kind === "unexpected_visit" || row.kind === "high_risk_service").length, openExceptions: exceptions.filter((row) => row.status !== "resolved").length, noWorkOrderVisits: visits.filter((row) => !row.workOrderId).length, missingCheckouts: exceptions.filter((row) => row.kind === "missing_checkout" && row.status !== "resolved").length, openWorkOrders: workOrders.filter((row) => !["closed", "cancelled"].includes(row.status)).length, overdueFollowUps: followUps.filter((row) => row.status === "open" && row.dueAt < period.endsAt).length, recordedCost: { amountMinor: costLines.reduce((sum, row) => sum + row.amount.amountMinor, 0), currency: "USD" }, sourceCounts: { visits: visits.length, workOrders: workOrders.length, followUps: followUps.length, exceptions: exceptions.length, costLines: costLines.length } }; }

  async getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "store") return null; const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId); const organization = this.fixture.organizations.find((row) => row.id === token.organizationId); if (!store || !organization) return null; const vendorIds = new Set(this.fixture.vendorCoverage.filter((row) => row.organizationId === token.organizationId && (row.scopeKind === "organization" || (row.scopeKind === "region" && row.scopeId === store.regionId) || (row.scopeKind === "store" && row.scopeId === store.id))).map((row) => row.vendorId)); return { organizationId: organization.id, organizationName: organization.name, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store), locationPolicyEnabled: store.locationPolicyEnabled }, approvedVendors: this.fixture.vendors.filter((row) => row.organizationId === organization.id && row.status === "approved" && vendorIds.has(row.id)).map((vendor) => ({ id: vendor.id, name: vendor.name, specialties: this.fixture.vendorSpecialties.filter((row) => row.organizationId === organization.id && row.vendorId === vendor.id).map((row) => row.displayName) })), actions: ["report_issue", "vendor_sign_in", "current_visits"] }; }

  async getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView | null> {
    const token = tokenRecord(this.fixture, input);
    if (!token || token.subjectType !== "work_order_issuance") return null;
    const issuance = this.fixture.issuances.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId);
    if (!issuance) return null;
    const assignment = this.fixture.assignments.find((row) => row.organizationId === token.organizationId && row.id === issuance.assignmentId && row.workOrderId === issuance.workOrderId && row.kind === "outside_vendor");
    const workOrder = this.fixture.workOrders.find((row) => row.organizationId === token.organizationId && row.id === issuance.workOrderId);
    const vendor = assignment?.vendorId ? this.fixture.vendors.find((row) => row.organizationId === token.organizationId && row.id === assignment.vendorId) : undefined;
    if (!assignment || !workOrder || !vendor) return null;
    const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === workOrder.storeId)!;
    const response = this.fixture.vendorResponses.filter((row) => row.organizationId === token.organizationId && row.issuanceId === issuance.id).at(-1);
    const asset = workOrder.assetId ? this.fixture.assets.find((row) => row.organizationId === token.organizationId && row.id === workOrder.assetId) : undefined;
    let snapshot: Partial<ServiceAuthorizationView> & { store?: ServiceAuthorizationView["store"]; vendor?: ServiceAuthorizationView["vendor"] } = {};
    try { snapshot = JSON.parse(issuance.immutablePayloadJson) as typeof snapshot; } catch { return null; }
    return {
      organizationId: token.organizationId,
      organizationName: snapshot.organizationName ?? this.fixture.organizations.find((row) => row.id === token.organizationId)!.name,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      issuanceId: issuance.id,
      workOrderNumber: snapshot.workOrderNumber ?? workOrder.number,
      revision: issuance.revision,
      status: workOrder.status,
      store: snapshot.store ?? { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store) },
      vendor: snapshot.vendor ?? { id: vendor.id, name: vendor.name },
      problem: snapshot.problem ?? workOrder.problem,
      priority: snapshot.priority ?? workOrder.priority,
      authorizedScope: snapshot.authorizedScope,
      categoryKey: snapshot.categoryKey,
      asset: snapshot.asset ?? (asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined),
      requestedTiming: snapshot.requestedTiming,
      nte: snapshot.nte,
      billingInstruction: snapshot.billingInstruction ?? `Reference operator work order ${snapshot.workOrderNumber ?? workOrder.number} on all service tickets and invoices.`,
      issuedAt: issuance.issuedAt,
      latestResponse: response ? { response: response.response, responderName: response.responderName, proposedAt: response.proposedAt, message: response.message, respondedAt: response.respondedAt } : undefined,
    };
  }

  async getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView | null> { const gateway = await this.getPublicStoreGatewayByToken(input); if (!gateway || !input.vendorId || !gateway.approvedVendors.some((row) => row.id === input.vendorId)) return null; const vendor = this.fixture.vendors.find((row) => row.organizationId === gateway.organizationId && row.id === input.vendorId)!; const eligibleIds = new Set(this.fixture.assignments.filter((row) => row.organizationId === gateway.organizationId && row.vendorId === vendor.id && !["cancelled", "declined", "superseded", "completed"].includes(row.status)).map((row) => row.workOrderId)); return { organizationName: gateway.organizationName, store: gateway.store, vendor: { id: vendor.id, name: vendor.name }, eligibleWorkOrders: this.fixture.workOrders.filter((row) => row.organizationId === gateway.organizationId && row.storeId === gateway.store.id && eligibleIds.has(row.id) && !["closed", "cancelled"].includes(row.status)).map((row) => ({ id: row.id, number: row.number, problem: row.problem, categoryKey: row.categoryKey, status: row.status })), allowsNoWorkOrder: true }; }

  async getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "visit") return null; const visit = this.fixture.visits.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId && row.status === "active" && row.vendorId); if (!visit) return null; const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === visit.storeId)!; const workOrder = visit.workOrderId ? this.fixture.workOrders.find((row) => row.organizationId === token.organizationId && row.id === visit.workOrderId) : undefined; return { organizationId: token.organizationId, id: visit.id, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name, vendorId: visit.vendorId!, vendorName: visit.providerName, workOrderId: workOrder?.id, workOrderNumber: workOrder?.number, unmatchedReason: visit.unmatchedReason, technicianName: visit.technicianName, purpose: visit.purpose, checkedInAt: visit.checkedInAt, startedChannel: visit.startedChannel, checkInLocationResult: locationResult(this.fixture, token.organizationId, visit.id), approximateObservedSeconds: Math.max(0, Math.floor((Date.parse(input.now) - Date.parse(visit.checkedInAt)) / 1000)) }; }

  async getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView | null> { const token = tokenRecord(this.fixture, input); if (!token || token.subjectType !== "store") return null; const organization = this.fixture.organizations.find((row) => row.id === token.organizationId); const store = this.fixture.stores.find((row) => row.organizationId === token.organizationId && row.id === token.subjectId); if (!organization || !store) return null; return { organizationId: organization.id, organizationName: organization.name, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: formatAddress(store) }, activeVisits: await this.listActiveVisitsForStore(organization.id, store.id) }; }

  async atomicWrite(statements: readonly OpsStatement[]) { const candidate = clone(this.fixture); statements.forEach((statement) => applyStatement(candidate, statement)); this.fixture = candidate; }
}

export function createOpsFixtureRepository(fixture: OpsFixture): MutableOpsFixtureRepository { return new FixtureOpsRepository(clone(fixture)); }
export function createNorthlineFixtureRepository(): MutableOpsFixtureRepository { return createOpsFixtureRepository(buildNorthlinePresentationFixture()); }

const fixtureGlobal = globalThis as typeof globalThis & {
  __traceOpsNorthlineRuntimeRepository?: MutableOpsFixtureRepository;
};

// Next compiles API routes and React Server Components into separate module
// graphs. Process-global storage keeps the local development fixture coherent
// across those graphs, so a mutation made by an API route is immediately
// visible to the redirected detail page. Production Render never uses this
// fallback; it requires PostgreSQL.
export function getNorthlineFixtureRepository(): MutableOpsFixtureRepository {
  fixtureGlobal.__traceOpsNorthlineRuntimeRepository ??= createNorthlineFixtureRepository();
  return fixtureGlobal.__traceOpsNorthlineRuntimeRepository;
}

export function resetNorthlineFixtureRepository() {
  fixtureGlobal.__traceOpsNorthlineRuntimeRepository = createNorthlineFixtureRepository();
  return fixtureGlobal.__traceOpsNorthlineRuntimeRepository;
}

export function getNorthlineDemoRuntime() {
  return {
    repository: getNorthlineFixtureRepository() as OpsRepository,
    asOf: NORTHLINE_AS_OF,
    entryTokens: NORTHLINE_DEMO_ENTRY_TOKENS,
    tokenHashes: NORTHLINE_DEMO_TOKEN_HASHES,
  } as const;
}
