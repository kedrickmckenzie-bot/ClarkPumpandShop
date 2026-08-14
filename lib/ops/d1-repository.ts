import type {
  ExceptionQueueQuery,
  OpsRepository,
  OpsStatement,
  OrganizationScope,
  PublicTokenLookup,
  WorkOrderListQuery,
} from "./repository";
import type {
  Asset,
  AssetComponent,
  Division,
  FollowUp,
  IdempotencyKey,
  IsoDateTime,
  Membership,
  OpsException,
  OpsId,
  PageRequest,
  ServiceRequest,
  Store,
  StoredFile,
  TaxonomyNode,
  Vendor,
  VendorEstimateProposal,
  VendorResponse,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderEstimateRequest,
  WorkOrderIssuance,
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

type Row = Record<string, unknown>;

function scalarText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function text(row: Row, key: string) { return scalarText(row[key]); }
function maybeText(row: Row, key: string) { return row[key] == null ? undefined : scalarText(row[key]); }
function maybeNumber(row: Row, key: string) { return row[key] == null ? undefined : Number(row[key]); }
function bool(row: Row, key: string) { return Boolean(Number(row[key] ?? 0)); }
function jsonArray(row: Row, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try { return JSON.parse(text(row, key) || "[]") as string[]; } catch { return []; }
}
function limit(input?: number) { return Math.max(1, Math.min(100, input ?? 25)); }
function formatAddress(row: Pick<Store, "address1" | "address2" | "city" | "state" | "postalCode">) { return [row.address1, row.address2, `${row.city}, ${row.state} ${row.postalCode}`].filter(Boolean).join(", "); }

function encodeCursor(sortValue: string, id: string) {
  return `${encodeURIComponent(sortValue)}|${encodeURIComponent(id)}`;
}

function decodeCursor(cursor: string | undefined) {
  if (cursor === undefined) return undefined;
  const parts = cursor.split("|");
  if (parts.length !== 2) return null;
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    return decoded.every(Boolean) ? decoded as [string, string] : null;
  } catch {
    return null;
  }
}

function addKeysetCursor(
  clauses: string[],
  params: unknown[],
  cursor: string | undefined,
  sortColumn: string,
  idColumn: string,
  direction: "asc" | "desc",
) {
  const decoded = decodeCursor(cursor);
  if (decoded === undefined) return;
  if (decoded === null) {
    clauses.push("1 = 0");
    return;
  }
  const [sortValue, id] = decoded;
  const comparison = direction === "asc" ? ">" : "<";
  clauses.push(`(${sortColumn} ${comparison} ? OR (${sortColumn} = ? AND ${idColumn} ${comparison} ?))`);
  params.push(sortValue, sortValue, id);
}

function storeAllowed(scope: OrganizationScope, store: Store) {
  if (scope.storeIds !== undefined && !scope.storeIds.includes(store.id)) return false;
  if (scope.regionIds !== undefined && (!store.regionId || !scope.regionIds.includes(store.regionId))) return false;
  return true;
}

function storeFrom(row: Row): Store {
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), divisionId: maybeText(row, "division_id"), regionId: maybeText(row, "region_id"), storeNumber: text(row, "store_number"), name: text(row, "name"), address1: text(row, "address_1"), address2: maybeText(row, "address_2"), city: text(row, "city"), state: text(row, "state"), postalCode: text(row, "postal_code"), aliases: jsonArray(row, "aliases_json"), latitudeE6: maybeNumber(row, "latitude_e6"), longitudeE6: maybeNumber(row, "longitude_e6"), geofenceRadiusM: Number(row.geofence_radius_m ?? 200), locationPolicyEnabled: bool(row, "location_policy_enabled"), timeZone: maybeText(row, "time_zone"), status: text(row, "status") as Store["status"], createdAt: text(row, "created_at") };
}

function workOrderFrom(row: Row): WorkOrder {
  const amount = maybeNumber(row, "nte_amount_minor");
  const repairEstimateAmount = maybeNumber(row, "repair_estimate_amount_minor");
  return { id: text(row, "id"), organizationId: text(row, "organization_id"), number: text(row, "number"), storeId: text(row, "store_id"), requestId: maybeText(row, "request_id"), problem: text(row, "problem"), authorizedScope: maybeText(row, "authorized_scope"), categoryKey: maybeText(row, "category_key"), taxonomyNodeId: maybeText(row, "taxonomy_node_id"), assetId: maybeText(row, "asset_id"), componentId: maybeText(row, "component_id"), priority: text(row, "priority") as WorkOrder["priority"], status: text(row, "status") as WorkOrder["status"], version: Number(row.version ?? 0), accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: maybeText(row, "due_at"), escalationTo: maybeText(row, "escalation_to"), nte: amount == null ? undefined : { amountMinor: amount, currency: text(row, "nte_currency") || "USD" }, repairEstimate: repairEstimateAmount == null ? undefined : { amountMinor: repairEstimateAmount, currency: text(row, "repair_estimate_currency") || "USD" }, estimatedServiceExtensionMonths: maybeNumber(row, "estimated_service_extension_months"), vendorServiceTicketNumber: maybeText(row, "vendor_service_ticket_number"), vendorInvoiceNumber: maybeText(row, "vendor_invoice_number"), externalAccountingPo: maybeText(row, "external_accounting_po"), createdAt: text(row, "created_at"), closedAt: maybeText(row, "closed_at") };
}

function assignmentFrom(row: Row): WorkOrderAssignment { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), kind: text(row, "kind") as WorkOrderAssignment["kind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), status: text(row, "status") as WorkOrderAssignment["status"], assignedAt: text(row, "assigned_at"), supersedesAssignmentId: maybeText(row, "supersedes_assignment_id") }; }
function issuanceFrom(row: Row): WorkOrderIssuance { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), revision: Number(row.revision), immutablePayloadJson: text(row, "immutable_payload_json"), channel: text(row, "channel") as WorkOrderIssuance["channel"], issuedAt: text(row, "issued_at") }; }
function estimateRequestFrom(row: Row): WorkOrderEstimateRequest { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), vendorId: text(row, "vendor_id"), kind: text(row, "kind") as WorkOrderEstimateRequest["kind"], requestedScope: text(row, "requested_scope"), status: text(row, "status") as WorkOrderEstimateRequest["status"], channel: text(row, "channel") as WorkOrderEstimateRequest["channel"], requestedAt: text(row, "requested_at"), dueAt: maybeText(row, "due_at"), openedAt: maybeText(row, "opened_at"), respondedAt: maybeText(row, "responded_at"), decisionAt: maybeText(row, "decision_at") }; }
function estimateProposalFrom(row: Row): VendorEstimateProposal { return { id: text(row, "id"), organizationId: text(row, "organization_id"), requestId: text(row, "request_id"), workOrderId: text(row, "work_order_id"), vendorId: text(row, "vendor_id"), revision: Number(row.revision), amount: { amountMinor: Number(row.amount_minor), currency: text(row, "currency") || "USD" }, scope: text(row, "scope"), exclusions: maybeText(row, "exclusions"), leadTimeDays: maybeNumber(row, "lead_time_days"), validUntil: maybeText(row, "valid_until"), submittedAt: text(row, "submitted_at") }; }
function visitFrom(row: Row): VisitSession { return { id: text(row, "id"), organizationId: text(row, "organization_id"), storeId: text(row, "store_id"), providerKind: text(row, "provider_kind") as VisitSession["providerKind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), workOrderId: maybeText(row, "work_order_id"), unmatchedReason: maybeText(row, "unmatched_reason"), technicianName: text(row, "technician_name"), providerName: text(row, "provider_name"), purpose: text(row, "purpose"), status: text(row, "status") as VisitSession["status"], startedChannel: text(row, "started_channel") as VisitSession["startedChannel"], endedChannel: maybeText(row, "ended_channel") as VisitSession["endedChannel"], checkedInAt: text(row, "checked_in_at"), checkedOutAt: maybeText(row, "checked_out_at"), outcome: maybeText(row, "outcome") as VisitSession["outcome"], outcomeNotes: maybeText(row, "outcome_notes"), observedDurationSeconds: maybeNumber(row, "observed_duration_seconds") }; }
function followUpFrom(row: Row): FollowUp { return { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), sourceVisitId: maybeText(row, "source_visit_id"), accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: text(row, "due_at"), escalationTo: text(row, "escalation_to"), status: text(row, "status") as FollowUp["status"], createdAt: text(row, "created_at"), completedAt: maybeText(row, "completed_at") }; }
function exceptionFrom(row: Row): OpsException { return { id: text(row, "id"), organizationId: text(row, "organization_id"), kind: text(row, "kind") as OpsException["kind"], storeId: maybeText(row, "store_id"), workOrderId: maybeText(row, "work_order_id"), visitId: maybeText(row, "visit_id"), vendorId: maybeText(row, "vendor_id"), severity: text(row, "severity") as OpsException["severity"], status: text(row, "status") as OpsException["status"], summary: text(row, "summary"), detectedAt: text(row, "detected_at"), resolvedAt: maybeText(row, "resolved_at") }; }

function visitListRow(row: Row): VisitListRow {
  return {
    id: text(row, "id"),
    storeId: text(row, "store_id"),
    storeNumber: text(row, "store_number"),
    storeName: text(row, "store_name"),
    providerKind: text(row, "provider_kind") as VisitListRow["providerKind"],
    vendorId: maybeText(row, "vendor_id"),
    internalMembershipId: maybeText(row, "internal_membership_id"),
    providerName: text(row, "provider_name"),
    workOrderId: maybeText(row, "work_order_id"),
    workOrderNumber: maybeText(row, "work_order_number"),
    technicianName: text(row, "technician_name"),
    purpose: text(row, "purpose"),
    status: text(row, "status"),
    checkedInAt: text(row, "checked_in_at"),
    checkedOutAt: maybeText(row, "checked_out_at"),
    outcome: maybeText(row, "outcome") as VisitListRow["outcome"],
    locationResult: (maybeText(row, "location_result") ?? "not_requested") as VisitListRow["locationResult"],
    approximateObservedSeconds: maybeNumber(row, "observed_duration_seconds"),
  };
}

function scopeWhere(scope: OrganizationScope, alias: string, params: unknown[]) {
  const clauses = [`${alias}.organization_id = ?`];
  params.push(scope.organizationId);
  if (scope.storeIds !== undefined) {
    if (scope.storeIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.id IN (${scope.storeIds.map(() => "?").join(",")})`); params.push(...scope.storeIds); }
  }
  if (scope.regionIds !== undefined) {
    if (scope.regionIds.length === 0) clauses.push("1 = 0");
    else { clauses.push(`${alias}.region_id IN (${scope.regionIds.map(() => "?").join(",")})`); params.push(...scope.regionIds); }
  }
  return clauses.join(" AND ");
}

class D1OpsRepository implements OpsRepository {
  constructor(
    private readonly db: D1Database,
    readonly kind: "d1" | "postgres" = "d1",
  ) {}

  private async first(sql: string, params: readonly unknown[] = []) { return await this.db.prepare(sql).bind(...params).first<Row>(); }
  private async all(sql: string, params: readonly unknown[] = []) { const result = await this.db.prepare(sql).bind(...params).all<Row>(); return result.results ?? []; }

  async getOrganization(organizationId: OpsId) { const row = await this.first("SELECT id, name, slug, time_zone, work_order_prefix, created_at FROM ops_organizations WHERE id = ?", [organizationId]); return row ? { id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"), timeZone: text(row, "time_zone"), workOrderPrefix: text(row, "work_order_prefix"), createdAt: text(row, "created_at") } : null; }
  async getDivision(organizationId: OpsId, divisionId: OpsId) { const row = await this.first("SELECT * FROM ops_divisions WHERE organization_id = ? AND id = ?", [organizationId, divisionId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), code: text(row, "code"), name: text(row, "name"), createdAt: text(row, "created_at") } satisfies Division : null; }
  async getTaxonomyNode(organizationId: OpsId, taxonomyNodeId: OpsId) { const row = await this.first("SELECT * FROM ops_taxonomy_nodes WHERE organization_id = ? AND id = ?", [organizationId, taxonomyNodeId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), parentNodeId: maybeText(row, "parent_node_id"), nodeKind: text(row, "node_kind") as TaxonomyNode["nodeKind"], canonicalKey: maybeText(row, "canonical_key"), name: text(row, "name"), aliases: jsonArray(row, "aliases_json"), depth: Number(row.depth), sortOrder: Number(row.sort_order), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies TaxonomyNode : null; }
  async listTaxonomyNodes(organizationId: OpsId) { const rows = await this.all("SELECT * FROM ops_taxonomy_nodes WHERE organization_id = ? ORDER BY depth, sort_order, name, id", [organizationId]); return rows.map((row) => ({ id: text(row, "id"), organizationId: text(row, "organization_id"), parentNodeId: maybeText(row, "parent_node_id"), nodeKind: text(row, "node_kind") as TaxonomyNode["nodeKind"], canonicalKey: maybeText(row, "canonical_key"), name: text(row, "name"), aliases: jsonArray(row, "aliases_json"), depth: Number(row.depth), sortOrder: Number(row.sort_order), active: bool(row, "active"), createdAt: text(row, "created_at") } satisfies TaxonomyNode)); }
  async getStore(organizationId: OpsId, storeId: OpsId) { const row = await this.first("SELECT * FROM ops_stores WHERE organization_id = ? AND id = ?", [organizationId, storeId]); return row ? storeFrom(row) : null; }
  async getVendor(organizationId: OpsId, vendorId: OpsId) { const row = await this.first("SELECT * FROM ops_vendors WHERE organization_id = ? AND id = ?", [organizationId, vendorId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), code: text(row, "code"), name: text(row, "name"), dispatchEmail: text(row, "dispatch_email"), dispatchPhone: maybeText(row, "dispatch_phone"), status: text(row, "status") as Vendor["status"], preferred: bool(row, "preferred"), createdAt: text(row, "created_at") } : null; }
  async getMembership(organizationId: OpsId, membershipId: OpsId) { const row = await this.first("SELECT * FROM ops_memberships WHERE organization_id = ? AND id = ?", [organizationId, membershipId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), userId: text(row, "user_id"), role: text(row, "role") as Membership["role"], status: text(row, "status") as Membership["status"], createdAt: text(row, "created_at") } : null; }
  async getRequest(organizationId: OpsId, requestId: OpsId) { const row = await this.first("SELECT * FROM ops_requests WHERE organization_id = ? AND id = ?", [organizationId, requestId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), reference: text(row, "reference"), storeId: text(row, "store_id"), reporterName: text(row, "reporter_name"), reporterEmployeeId: maybeText(row, "reporter_employee_id"), problem: text(row, "problem"), priority: text(row, "priority") as ServiceRequest["priority"], status: text(row, "status") as ServiceRequest["status"], submittedAt: text(row, "submitted_at"), convertedWorkOrderId: maybeText(row, "converted_work_order_id") } : null; }
  async getWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_orders WHERE organization_id = ? AND id = ?", [organizationId, workOrderId]); return row ? workOrderFrom(row) : null; }
  async getAsset(organizationId: OpsId, assetId: OpsId) { const row = await this.first("SELECT * FROM ops_assets WHERE organization_id = ? AND id = ?", [organizationId, assetId]); if (!row) return null; const replacement = maybeNumber(row, "replacement_estimate_minor"); return { id: text(row, "id"), organizationId: text(row, "organization_id"), storeId: text(row, "store_id"), categoryKey: text(row, "category_key"), taxonomyNodeId: maybeText(row, "taxonomy_node_id"), groupPath: jsonArray(row, "group_path_json"), assetTag: text(row, "asset_tag"), name: text(row, "name"), manufacturer: maybeText(row, "manufacturer"), model: maybeText(row, "model"), serialNumber: maybeText(row, "serial_number"), supplier: maybeText(row, "supplier"), installedAt: maybeText(row, "installed_at"), expectedLifeYears: maybeNumber(row, "expected_life_years"), warrantyEndsAt: maybeText(row, "warranty_ends_at"), replacementEstimate: replacement == null ? undefined : { amountMinor: replacement, currency: text(row, "replacement_currency") || "USD" }, status: text(row, "status") as Asset["status"], createdAt: text(row, "created_at") }; }
  async getComponent(organizationId: OpsId, componentId: OpsId) { const row = await this.first("SELECT * FROM ops_asset_components WHERE organization_id = ? AND id = ?", [organizationId, componentId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), assetId: text(row, "asset_id"), parentComponentId: maybeText(row, "parent_component_id"), name: text(row, "name"), partNumber: maybeText(row, "part_number"), serialNumber: maybeText(row, "serial_number"), installedAt: maybeText(row, "installed_at"), warrantyEndsAt: maybeText(row, "warranty_ends_at"), createdAt: text(row, "created_at") } satisfies AssetComponent : null; }
  async getAssignment(organizationId: OpsId, assignmentId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND id = ?", [organizationId, assignmentId]); return row ? assignmentFrom(row) : null; }
  async getIssuance(organizationId: OpsId, issuanceId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND id = ?", [organizationId, issuanceId]); return row ? issuanceFrom(row) : null; }
  async getEstimateRequest(organizationId: OpsId, estimateRequestId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_estimate_requests WHERE organization_id = ? AND id = ? LIMIT 1", [organizationId, estimateRequestId]); return row ? estimateRequestFrom(row) : null; }
  async getLatestEstimateProposal(organizationId: OpsId, estimateRequestId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_estimate_proposals WHERE organization_id = ? AND request_id = ? ORDER BY revision DESC, submitted_at DESC, id DESC LIMIT 1", [organizationId, estimateRequestId]); return row ? estimateProposalFrom(row) : null; }
  async listEstimateRequestsForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_work_order_estimate_requests WHERE organization_id = ? AND work_order_id = ? ORDER BY requested_at DESC, id DESC", [organizationId, workOrderId]); return rows.map(estimateRequestFrom); }
  async getVisit(organizationId: OpsId, visitId: OpsId) { const row = await this.first("SELECT * FROM ops_visit_sessions WHERE organization_id = ? AND id = ?", [organizationId, visitId]); return row ? visitFrom(row) : null; }
  async getFollowUp(organizationId: OpsId, followUpId: OpsId) { const row = await this.first("SELECT * FROM ops_follow_ups WHERE organization_id = ? AND id = ?", [organizationId, followUpId]); return row ? followUpFrom(row) : null; }
  async getException(organizationId: OpsId, exceptionId: OpsId) { const row = await this.first("SELECT * FROM ops_exceptions WHERE organization_id = ? AND id = ?", [organizationId, exceptionId]); return row ? exceptionFrom(row) : null; }
  async getIdempotencyKey(organizationId: OpsId, key: string): Promise<IdempotencyKey | null> { const row = await this.first("SELECT * FROM ops_idempotency_keys WHERE organization_id = ? AND key = ? LIMIT 1", [organizationId, key]); return row ? { organizationId: text(row, "organization_id"), key: text(row, "key"), command: text(row, "command"), resultId: text(row, "result_id"), requestHash: text(row, "request_hash"), createdAt: text(row, "created_at"), expiresAt: text(row, "expires_at") } : null; }
  async getStoredFileByStorageKey(organizationId: OpsId, storageKey: string): Promise<StoredFile | null> { const row = await this.first("SELECT * FROM ops_files WHERE organization_id = ? AND storage_key = ? LIMIT 1", [organizationId, storageKey]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), storageKey: text(row, "storage_key"), sha256: text(row, "sha256"), originalName: text(row, "original_name"), contentType: text(row, "content_type"), byteLength: Number(row.byte_length), status: text(row, "status") as StoredFile["status"], createdAt: text(row, "created_at") } : null; }
  async getActiveAssignment(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND status NOT IN ('cancelled','declined','completed','superseded') ORDER BY assigned_at DESC, id DESC LIMIT 1", [organizationId, workOrderId]); return row ? assignmentFrom(row) : null; }
  async getLatestIssuanceForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND work_order_id = ? ORDER BY revision DESC LIMIT 1", [organizationId, workOrderId]); return row ? issuanceFrom(row) : null; }
  async listIssuancesForWorkOrder(organizationId: OpsId, workOrderId: OpsId) { const rows = await this.all("SELECT * FROM ops_work_order_issuances WHERE organization_id = ? AND work_order_id = ? ORDER BY revision, id", [organizationId, workOrderId]); return rows.map(issuanceFrom); }
  async getLatestVendorResponse(organizationId: OpsId, assignmentId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id = ? AND assignment_id = ? ORDER BY responded_at DESC, id DESC LIMIT 1", [organizationId, assignmentId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: text(row, "issuance_id"), response: text(row, "response") as VendorResponse["response"], responderName: text(row, "responder_name"), proposedAt: maybeText(row, "proposed_at"), message: maybeText(row, "message"), respondedAt: text(row, "responded_at") } : null; }
  async getLatestVendorResponseForIssuance(organizationId: OpsId, issuanceId: OpsId) { const row = await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id = ? AND issuance_id = ? ORDER BY responded_at DESC, id DESC LIMIT 1", [organizationId, issuanceId]); return row ? { id: text(row, "id"), organizationId: text(row, "organization_id"), workOrderId: text(row, "work_order_id"), assignmentId: text(row, "assignment_id"), issuanceId: text(row, "issuance_id"), response: text(row, "response") as VendorResponse["response"], responderName: text(row, "responder_name"), proposedAt: maybeText(row, "proposed_at"), message: maybeText(row, "message"), respondedAt: text(row, "responded_at") } : null; }
  async findActiveVendorAssignment(organizationId: OpsId, workOrderId: OpsId, vendorId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND vendor_id = ? AND status IN ('issued','opened','accepted') ORDER BY assigned_at DESC LIMIT 1", [organizationId, workOrderId, vendorId]); return row ? assignmentFrom(row) : null; }
  async findActiveInternalAssignment(organizationId: OpsId, workOrderId: OpsId, membershipId: OpsId) { const row = await this.first("SELECT * FROM ops_work_order_assignments WHERE organization_id = ? AND work_order_id = ? AND internal_membership_id = ? AND status NOT IN ('cancelled','declined','completed','superseded') ORDER BY assigned_at DESC LIMIT 1", [organizationId, workOrderId, membershipId]); return row ? assignmentFrom(row) : null; }
  async vendorCoversStore(organizationId: OpsId, vendorId: OpsId, storeId: OpsId) { const row = await this.first("SELECT 1 AS allowed FROM ops_stores s JOIN ops_vendor_coverage c ON c.organization_id = s.organization_id AND c.vendor_id = ? AND (c.scope_kind = 'organization' AND c.scope_id = s.organization_id OR c.scope_kind = 'region' AND c.scope_id = s.region_id OR c.scope_kind = 'store' AND c.scope_id = s.id) WHERE s.organization_id = ? AND s.id = ? LIMIT 1", [vendorId, organizationId, storeId]); return Boolean(row); }
  async findActiveVisit(organizationId: OpsId, storeId: OpsId, provider: { vendorId?: OpsId; internalMembershipId?: OpsId; technicianName: string }) { const row = await this.first("SELECT * FROM ops_visit_sessions WHERE organization_id = ? AND store_id = ? AND status = 'active' AND COALESCE(vendor_id,'') = ? AND COALESCE(internal_membership_id,'') = ? AND lower(technician_name) = lower(?) LIMIT 1", [organizationId, storeId, provider.vendorId ?? "", provider.internalMembershipId ?? "", provider.technicianName]); return row ? visitFrom(row) : null; }
  async listActiveVisitsForStore(organizationId: OpsId, storeId: OpsId): Promise<TrustedStoreActiveVisitRow[]> { const rows = await this.all(`SELECT v.*, w.number AS work_order_number FROM ops_visit_sessions v LEFT JOIN ops_work_orders w ON w.organization_id = v.organization_id AND w.id = v.work_order_id WHERE v.organization_id = ? AND v.store_id = ? AND v.status = 'active' ORDER BY v.checked_in_at, v.id`, [organizationId, storeId]); return rows.map((row) => ({ id: text(row, "id"), providerKind: text(row, "provider_kind") as TrustedStoreActiveVisitRow["providerKind"], vendorId: maybeText(row, "vendor_id"), internalMembershipId: maybeText(row, "internal_membership_id"), providerName: text(row, "provider_name"), technicianName: text(row, "technician_name"), workOrderId: maybeText(row, "work_order_id"), workOrderNumber: maybeText(row, "work_order_number"), unmatchedReason: maybeText(row, "unmatched_reason"), purpose: text(row, "purpose"), checkedInAt: text(row, "checked_in_at"), startedChannel: text(row, "started_channel") as TrustedStoreActiveVisitRow["startedChannel"] })); }
  async allocateWorkOrderNumber(organizationId: OpsId, prefix: string, year: number) { const row = await this.first("INSERT INTO ops_work_order_counters (organization_id, counter_year, next_value) VALUES (?, ?, 2) ON CONFLICT(organization_id, counter_year) DO UPDATE SET next_value = next_value + 1 RETURNING next_value - 1 AS allocated", [organizationId, year]); if (!row) throw new Error("Unable to allocate work-order number"); return `${prefix}-${year}-${String(Number(row.allocated)).padStart(4, "0")}`; }

  async searchStores(scope: OrganizationScope, search: string, request: PageRequest = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    const query = search.trim().toLocaleLowerCase("en-US");
    if (query) {
      clauses.push("s.search_text LIKE ?");
      params.push(`%${query}%`);
    }
    addKeysetCursor(clauses, params, request.cursor, "s.store_number", "s.id", "asc");
    const max = limit(request.limit);
    params.push(max + 1);
    const rows = await this.all(`SELECT s.*, r.name AS region_name,
      (SELECT COUNT(*) FROM ops_work_orders w WHERE w.organization_id = s.organization_id AND w.store_id = s.id AND w.status NOT IN ('closed','cancelled')) AS open_work_count,
      (SELECT COUNT(*) FROM ops_visit_sessions v WHERE v.organization_id = s.organization_id AND v.store_id = s.id AND v.status = 'active') AS active_visit_count,
      (SELECT COALESCE(SUM(c.amount_minor),0) FROM ops_cost_lines c JOIN ops_work_orders cw ON cw.organization_id = c.organization_id AND cw.id = c.work_order_id WHERE c.organization_id = s.organization_id AND cw.store_id = s.id) AS recorded_cost_minor
      FROM ops_stores s LEFT JOIN ops_regions r ON r.organization_id = s.organization_id AND r.id = s.region_id
      WHERE ${clauses.join(" AND ")} ORDER BY s.store_number, s.id LIMIT ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): StoreSearchRow => ({ id: text(row, "id"), storeNumber: text(row, "store_number"), name: text(row, "name"), regionName: maybeText(row, "region_name"), formattedAddress: formatAddress(storeFrom(row)), openWorkCount: Number(row.open_work_count ?? 0), activeVisitCount: Number(row.active_visit_count ?? 0), recordedCostMinor: Number(row.recorded_cost_minor ?? 0), currency: "USD" }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "store_number"), text(last, "id")) : undefined };
  }

  private async workOrderRows(scope: OrganizationScope, query: WorkOrderListQuery & { workOrderId?: OpsId; assetId?: OpsId; unbounded?: boolean } = {}) {
    const params: unknown[] = []; const storeScope = scopeWhere(scope, "s", params); const clauses = [storeScope];
    if (query.storeId) { clauses.push("w.store_id = ?"); params.push(query.storeId); }
    if (query.regionId) { clauses.push("s.region_id = ?"); params.push(query.regionId); }
    if (query.vendorId) { clauses.push("a.vendor_id = ?"); params.push(query.vendorId); }
    if (query.statuses?.length) { clauses.push(`w.status IN (${query.statuses.map(() => "?").join(",")})`); params.push(...query.statuses); }
    if (query.priorities?.length) { clauses.push(`w.priority IN (${query.priorities.map(() => "?").join(",")})`); params.push(...query.priorities); }
    if (query.createdFrom) { clauses.push("w.created_at >= ?"); params.push(query.createdFrom); }
    if (query.createdTo) { clauses.push("w.created_at <= ?"); params.push(query.createdTo); }
    if (query.search?.trim()) { clauses.push("lower(w.number || ' ' || w.problem || ' ' || s.store_number || ' ' || s.name || ' ' || COALESCE(v.name,'')) LIKE ?"); params.push(`%${query.search.trim().toLocaleLowerCase("en-US")}%`); }
    if (query.workOrderId) { clauses.push("w.id = ?"); params.push(query.workOrderId); }
    if (query.assetId) { clauses.push("w.asset_id = ?"); params.push(query.assetId); }
    addKeysetCursor(clauses, params, query.cursor, "w.created_at", "w.id", "desc");
    if (!query.unbounded) params.push(limit(query.limit) + 1);
    return await this.all(`SELECT w.*, s.store_number, s.name AS store_name, a.kind AS assignment_kind, a.status AS assignment_status, a.vendor_id, v.name AS vendor_name,
      (SELECT COUNT(*) FROM ops_visit_sessions vs WHERE vs.organization_id = w.organization_id AND vs.work_order_id = w.id) AS visit_count,
      (SELECT COALESCE(SUM(c.amount_minor),0) FROM ops_cost_lines c WHERE c.organization_id = w.organization_id AND c.work_order_id = w.id) AS recorded_cost_minor
      FROM ops_work_orders w JOIN ops_stores s ON s.organization_id = w.organization_id AND s.id = w.store_id
      LEFT JOIN ops_work_order_assignments a ON a.id = (SELECT aa.id FROM ops_work_order_assignments aa WHERE aa.organization_id = w.organization_id AND aa.work_order_id = w.id ORDER BY aa.assigned_at DESC, aa.id DESC LIMIT 1)
      LEFT JOIN ops_vendors v ON v.organization_id = w.organization_id AND v.id = a.vendor_id
      WHERE ${clauses.join(" AND ")} ORDER BY w.created_at DESC, w.id DESC ${query.unbounded ? "" : "LIMIT ?"}`, params);
  }

  private workListRow(row: Row): WorkOrderListRow { return { id: text(row, "id"), number: text(row, "number"), storeId: text(row, "store_id"), storeNumber: text(row, "store_number"), storeName: text(row, "store_name"), problem: text(row, "problem"), categoryKey: maybeText(row, "category_key"), priority: text(row, "priority") as WorkOrderListRow["priority"], status: text(row, "status") as WorkOrderListRow["status"], assignmentKind: (maybeText(row, "assignment_kind") ?? "choose_later") as WorkOrderListRow["assignmentKind"], assignmentStatus: maybeText(row, "assignment_status") as WorkOrderListRow["assignmentStatus"], vendorId: maybeText(row, "vendor_id"), vendorName: maybeText(row, "vendor_name"), accountableParty: text(row, "accountable_party"), nextAction: text(row, "next_action"), dueAt: maybeText(row, "due_at"), createdAt: text(row, "created_at"), visitCount: Number(row.visit_count ?? 0), recordedCostMinor: Number(row.recorded_cost_minor ?? 0), currency: "USD" }; }

  async listWorkOrders(scope: OrganizationScope, query: WorkOrderListQuery = {}) { const rows = await this.workOrderRows(scope, query); const max = limit(query.limit); const visibleRows = rows.slice(0, max); const items = visibleRows.map((row) => this.workListRow(row)); const last = visibleRows.at(-1); return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "created_at"), text(last, "id")) : undefined }; }

  async listRequests(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    if (query.status) { clauses.push("r.status = ?"); params.push(query.status); }
    if (query.storeId) { clauses.push("r.store_id = ?"); params.push(query.storeId); }
    addKeysetCursor(clauses, params, query.cursor, "r.submitted_at", "r.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1);
    const rows = await this.all(`SELECT r.*, s.store_number, s.name AS store_name
      FROM ops_requests r JOIN ops_stores s ON s.organization_id = r.organization_id AND s.id = r.store_id
      WHERE ${clauses.join(" AND ")} ORDER BY r.submitted_at DESC, r.id DESC LIMIT ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): RequestListRow => ({ id: text(row, "id"), reference: text(row, "reference"), storeId: text(row, "store_id"), storeNumber: text(row, "store_number"), storeName: text(row, "store_name"), reporterName: text(row, "reporter_name"), problem: text(row, "problem"), priority: text(row, "priority") as RequestListRow["priority"], status: text(row, "status"), submittedAt: text(row, "submitted_at"), convertedWorkOrderId: maybeText(row, "converted_work_order_id") }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "submitted_at"), text(last, "id")) : undefined };
  }

  async listVisits(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId; vendorId?: OpsId } = {}) {
    const params: unknown[] = [];
    const clauses = [scopeWhere(scope, "s", params)];
    if (query.status) { clauses.push("vs.status = ?"); params.push(query.status); }
    if (query.storeId) { clauses.push("vs.store_id = ?"); params.push(query.storeId); }
    if (query.vendorId) { clauses.push("vs.vendor_id = ?"); params.push(query.vendorId); }
    addKeysetCursor(clauses, params, query.cursor, "vs.checked_in_at", "vs.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1);
    const rows = await this.all(`SELECT vs.*, s.store_number, s.name AS store_name, w.number AS work_order_number, e.location_result
      FROM ops_visit_sessions vs JOIN ops_stores s ON s.organization_id = vs.organization_id AND s.id = vs.store_id
      LEFT JOIN ops_work_orders w ON w.organization_id = vs.organization_id AND w.id = vs.work_order_id
      LEFT JOIN ops_visit_evidence e ON e.organization_id = vs.organization_id AND e.visit_id = vs.id AND e.kind = 'check_in'
      WHERE ${clauses.join(" AND ")} ORDER BY vs.checked_in_at DESC, vs.id DESC LIMIT ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map(visitListRow);
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "checked_in_at"), text(last, "id")) : undefined };
  }

  async listExceptions(scope: OrganizationScope, query: ExceptionQueueQuery = {}) {
    const params: unknown[] = [];
    const locationScoped = scope.storeIds !== undefined || scope.regionIds !== undefined;
    const clauses = locationScoped
      ? [scopeWhere(scope, "s", params)]
      : ["e.organization_id = ?"];
    if (!locationScoped) params.push(scope.organizationId);
    if (query.statuses?.length) { clauses.push(`e.status IN (${query.statuses.map(() => "?").join(",")})`); params.push(...query.statuses); }
    if (query.kinds?.length) { clauses.push(`e.kind IN (${query.kinds.map(() => "?").join(",")})`); params.push(...query.kinds); }
    if (query.storeId) { clauses.push("e.store_id = ?"); params.push(query.storeId); }
    if (query.vendorId) { clauses.push("e.vendor_id = ?"); params.push(query.vendorId); }
    addKeysetCursor(clauses, params, query.cursor, "e.detected_at", "e.id", "desc");
    const max = limit(query.limit);
    params.push(max + 1);
    const rows = await this.all(`SELECT e.*, s.store_number, w.number AS work_order_number
      FROM ops_exceptions e
      LEFT JOIN ops_stores s ON s.organization_id = e.organization_id AND s.id = e.store_id
      LEFT JOIN ops_work_orders w ON w.organization_id = e.organization_id AND w.id = e.work_order_id
      WHERE ${clauses.join(" AND ")} ORDER BY e.detected_at DESC, e.id DESC LIMIT ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): ExceptionQueueRow => ({ id: text(row, "id"), kind: text(row, "kind") as ExceptionQueueRow["kind"], status: text(row, "status") as ExceptionQueueRow["status"], severity: text(row, "severity") as ExceptionQueueRow["severity"], summary: text(row, "summary"), storeId: maybeText(row, "store_id"), storeNumber: maybeText(row, "store_number"), workOrderId: maybeText(row, "work_order_id"), workOrderNumber: maybeText(row, "work_order_number"), visitId: maybeText(row, "visit_id"), detectedAt: text(row, "detected_at") }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "detected_at"), text(last, "id")) : undefined };
  }

  async listVendors(scope: OrganizationScope, search = "", request: PageRequest = {}) {
    const params: unknown[] = [];
    const scopedStores = scopeWhere(scope, "ss", params);
    const clauses = ["v.organization_id = ?"];
    params.push(scope.organizationId);
    const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
    if (normalizedSearch) { clauses.push("v.search_text LIKE ?"); params.push(`%${normalizedSearch}%`); }
    addKeysetCursor(clauses, params, request.cursor, "v.name", "v.id", "asc");
    const max = limit(request.limit);
    params.push(max + 1);
    const rows = await this.all(`WITH scoped_stores AS (
        SELECT ss.id FROM ops_stores ss WHERE ${scopedStores}
      )
      SELECT v.*,
      (SELECT group_concat(display_name, '|') FROM ops_vendor_specialties sp WHERE sp.organization_id = v.organization_id AND sp.vendor_id = v.id) AS specialties,
      (SELECT COUNT(*) FROM ops_work_order_assignments a
        JOIN ops_work_orders w ON w.organization_id = a.organization_id AND w.id = a.work_order_id
        JOIN scoped_stores sw ON sw.id = w.store_id
        WHERE a.organization_id = v.organization_id AND a.vendor_id = v.id AND w.status NOT IN ('closed','cancelled')) AS open_work_orders,
      (SELECT COUNT(*) FROM ops_visit_sessions vs
        JOIN scoped_stores sv ON sv.id = vs.store_id
        WHERE vs.organization_id = v.organization_id AND vs.vendor_id = v.id AND vs.status = 'active') AS active_visits
      FROM ops_vendors v WHERE ${clauses.join(" AND ")} ORDER BY v.name, v.id LIMIT ?`, params);
    const visibleRows = rows.slice(0, max);
    const items = visibleRows.map((row): VendorDirectoryRow => ({ id: text(row, "id"), name: text(row, "name"), status: text(row, "status"), preferred: bool(row, "preferred"), specialties: text(row, "specialties").split("|").filter(Boolean), coverageLabels: [], openWorkOrders: Number(row.open_work_orders ?? 0), activeVisits: Number(row.active_visits ?? 0), returnVisitWorkOrders: 0 }));
    const last = visibleRows.at(-1);
    return { items, nextCursor: rows.length > max && last ? encodeCursor(text(last, "name"), text(last, "id")) : undefined };
  }

  async getStoreDetail(scope: OrganizationScope, storeId: OpsId): Promise<StoreDetailView | null> { const store = await this.getStore(scope.organizationId, storeId); if (!store || !storeAllowed(scope, store)) return null; const base = (await this.searchStores({ ...scope, storeIds: [store.id] }, store.storeNumber, { limit: 1 })).items[0]; if (!base) return null; const openWorkOrders = (await this.listWorkOrders({ ...scope, storeIds: [store.id] }, { statuses: ["draft","awaiting_approval","approved","issued","accepted","scheduled","in_progress","waiting_on_vendor","waiting_on_parts","completed_pending_review"], limit: 100 })).items; const activeVisits = (await this.listVisits({ ...scope, storeIds: [store.id] }, { status: "active", limit: 100 })).items; const assets = await this.all("SELECT a.id, a.asset_tag, a.name, a.category_key, a.status, COALESCE(SUM(c.amount_minor),0) AS recorded_cost_minor FROM ops_assets a LEFT JOIN ops_work_orders w ON w.organization_id = a.organization_id AND w.asset_id = a.id LEFT JOIN ops_cost_lines c ON c.organization_id = w.organization_id AND c.work_order_id = w.id WHERE a.organization_id = ? AND a.store_id = ? GROUP BY a.id, a.asset_tag, a.name, a.category_key, a.status ORDER BY a.name", [scope.organizationId, store.id]); return { ...base, regionId: store.regionId, status: store.status, activeVisits, openWorkOrders, assets: assets.map((row) => ({ id: text(row,"id"), assetTag: text(row,"asset_tag"), name: text(row,"name"), categoryKey: text(row,"category_key"), status: text(row,"status"), recordedCostMinor: Number(row.recorded_cost_minor ?? 0) })) }; }

  async getWorkOrderDetail(scope: OrganizationScope, workOrderId: OpsId): Promise<WorkOrderDetailView | null> {
    const workOrder = await this.getWorkOrder(scope.organizationId, workOrderId);
    if (!workOrder) return null;
    const store = await this.getStore(scope.organizationId, workOrder.storeId);
    if (!store || !storeAllowed(scope, store)) return null;
    const baseRow = (await this.workOrderRows({ ...scope, storeIds: [store.id] }, { workOrderId: workOrder.id, limit: 1 }))[0];
    if (!baseRow) return null;
    const requestRow = workOrder.requestId
      ? await this.first(`SELECT r.*, s.store_number, s.name AS store_name
          FROM ops_requests r JOIN ops_stores s ON s.organization_id = r.organization_id AND s.id = r.store_id
          WHERE r.organization_id = ? AND r.id = ? AND r.store_id = ?`, [scope.organizationId, workOrder.requestId, store.id])
      : null;
    const request = requestRow ? ({ id: text(requestRow, "id"), reference: text(requestRow, "reference"), storeId: text(requestRow, "store_id"), storeNumber: text(requestRow, "store_number"), storeName: text(requestRow, "store_name"), reporterName: text(requestRow, "reporter_name"), problem: text(requestRow, "problem"), priority: text(requestRow, "priority") as RequestListRow["priority"], status: text(requestRow, "status"), submittedAt: text(requestRow, "submitted_at"), convertedWorkOrderId: maybeText(requestRow, "converted_work_order_id") } satisfies RequestListRow) : undefined;
    const visitRows = await this.all(`SELECT vs.*, s.store_number, s.name AS store_name, w.number AS work_order_number, e.location_result
      FROM ops_visit_sessions vs JOIN ops_stores s ON s.organization_id = vs.organization_id AND s.id = vs.store_id
      JOIN ops_work_orders w ON w.organization_id = vs.organization_id AND w.id = vs.work_order_id
      LEFT JOIN ops_visit_evidence e ON e.organization_id = vs.organization_id AND e.visit_id = vs.id AND e.kind = 'check_in'
      WHERE vs.organization_id = ? AND vs.work_order_id = ? AND vs.store_id = ?
      ORDER BY vs.checked_in_at DESC, vs.id DESC`, [scope.organizationId, workOrder.id, store.id]);
    const visits = visitRows.map(visitListRow);
    const followUps = await this.all("SELECT id, next_action, accountable_party, due_at, status FROM ops_follow_ups WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at", [scope.organizationId, workOrder.id]);
    const costs = await this.all("SELECT * FROM ops_cost_lines WHERE organization_id = ? AND work_order_id = ? ORDER BY service_date, id", [scope.organizationId, workOrder.id]);
    const asset = workOrder.assetId ? await this.getAsset(scope.organizationId, workOrder.assetId) : null;
    const component = workOrder.componentId ? await this.getComponent(scope.organizationId, workOrder.componentId) : null;
    return { ...this.workListRow(baseRow), request, authorizedScope: workOrder.authorizedScope, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, component: component ? { id: component.id, name: component.name } : undefined, nte: workOrder.nte, vendorServiceTicketNumber: workOrder.vendorServiceTicketNumber, vendorInvoiceNumber: workOrder.vendorInvoiceNumber, externalAccountingPo: workOrder.externalAccountingPo, visits, followUps: followUps.map((row) => ({ id: text(row,"id"), nextAction: text(row,"next_action"), accountableParty: text(row,"accountable_party"), dueAt: text(row,"due_at"), status: text(row,"status") })), costs: costs.map((row) => ({ id: text(row,"id"), kind: text(row,"kind"), description: text(row,"description"), amountMinor: Number(row.amount_minor), currency: text(row,"currency"), serviceDate: text(row,"service_date") })) };
  }

  async getAssetDetail(scope: OrganizationScope, assetId: OpsId): Promise<AssetDetailView | null> { const asset = await this.getAsset(scope.organizationId, assetId); if (!asset) return null; const store = await this.getStore(scope.organizationId, asset.storeId); if (!store || !storeAllowed(scope, store)) return null; const components = await this.all("SELECT * FROM ops_asset_components WHERE organization_id = ? AND asset_id = ? ORDER BY name", [scope.organizationId, asset.id]); const workOrders = (await this.workOrderRows({ ...scope, storeIds: [store.id] }, { assetId: asset.id, unbounded: true })).map((row) => this.workListRow(row)); return { id: asset.id, storeId: asset.storeId, assetTag: asset.assetTag, name: asset.name, categoryKey: asset.categoryKey, groupPath: asset.groupPath, manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber, installedAt: asset.installedAt, expectedLifeYears: asset.expectedLifeYears, warrantyEndsAt: asset.warrantyEndsAt, replacementEstimateMinor: asset.replacementEstimate?.amountMinor, currency: asset.replacementEstimate?.currency ?? "USD", status: asset.status, components: components.map((row) => ({ id: text(row,"id"), parentComponentId: maybeText(row,"parent_component_id"), name: text(row,"name"), partNumber: maybeText(row,"part_number"), serialNumber: maybeText(row,"serial_number") })), workOrders, recordedCostMinor: workOrders.reduce((sum,row) => sum + row.recordedCostMinor,0) }; }

  async listPmOccurrences(scope: OrganizationScope, query: PageRequest & { status?: string; storeId?: OpsId } = {}) { const params: unknown[] = []; const clauses = [scopeWhere(scope,"s",params)]; if (query.status) { clauses.push("o.status = ?"); params.push(query.status); } if (query.storeId) { clauses.push("o.store_id = ?"); params.push(query.storeId); } addKeysetCursor(clauses, params, query.cursor, "o.due_at", "o.id", "asc"); const max=limit(query.limit); params.push(max+1); const rows = await this.all(`SELECT o.*, p.name AS plan_name, s.store_number, a.name AS asset_name FROM ops_pm_occurrences o JOIN ops_stores s ON s.organization_id = o.organization_id AND s.id = o.store_id JOIN ops_pm_plans p ON p.organization_id = o.organization_id AND p.id = o.plan_id LEFT JOIN ops_assets a ON a.organization_id = o.organization_id AND a.id = o.asset_id WHERE ${clauses.join(" AND ")} ORDER BY o.due_at, o.id LIMIT ?`,params); const visibleRows=rows.slice(0,max); const items=visibleRows.map((row):PmOccurrenceRow=>({id:text(row,"id"),planId:text(row,"plan_id"),planName:text(row,"plan_name"),storeId:text(row,"store_id"),storeNumber:text(row,"store_number"),assetId:maybeText(row,"asset_id"),assetName:maybeText(row,"asset_name"),dueAt:text(row,"due_at"),windowStartsAt:text(row,"window_starts_at"),windowEndsAt:text(row,"window_ends_at"),status:text(row,"status"),workOrderId:maybeText(row,"work_order_id")})); const last=visibleRows.at(-1); return {items,nextCursor:rows.length>max&&last?encodeCursor(text(last,"due_at"),text(last,"id")):undefined}; }

  async getExecutiveSnapshot(scope: OrganizationScope, period: { startsAt: IsoDateTime; endsAt: IsoDateTime }): Promise<ExecutiveSnapshotView> {
    const scoped = (alias: string) => { const params: unknown[] = []; return { where: scopeWhere(scope, alias, params), params }; };
    const visitScope = scoped("s");
    const visit = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN v.status='active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN v.work_order_id IS NULL THEN 1 ELSE 0 END) AS no_wo FROM ops_visit_sessions v JOIN ops_stores s ON s.organization_id=v.organization_id AND s.id=v.store_id WHERE ${visitScope.where} AND v.checked_in_at BETWEEN ? AND ?`, [...visitScope.params, period.startsAt, period.endsAt]);
    const workScope = scoped("s");
    const work = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN w.status NOT IN ('closed','cancelled') THEN 1 ELSE 0 END) AS open FROM ops_work_orders w JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${workScope.where} AND w.created_at BETWEEN ? AND ?`, [...workScope.params, period.startsAt, period.endsAt]);
    const exceptionScope = scoped("s");
    const exceptions = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN e.status!='resolved' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN e.kind IN ('unexpected_visit','high_risk_service') THEN 1 ELSE 0 END) AS unexpected, SUM(CASE WHEN e.kind='missing_checkout' AND e.status!='resolved' THEN 1 ELSE 0 END) AS missing FROM ops_exceptions e JOIN ops_stores s ON s.organization_id=e.organization_id AND s.id=e.store_id WHERE ${exceptionScope.where} AND e.detected_at BETWEEN ? AND ?`, [...exceptionScope.params, period.startsAt, period.endsAt]);
    const followScope = scoped("s");
    const followUps = await this.first(`SELECT COUNT(*) AS total, SUM(CASE WHEN f.status='open' AND f.due_at<? THEN 1 ELSE 0 END) AS overdue FROM ops_follow_ups f JOIN ops_work_orders w ON w.organization_id=f.organization_id AND w.id=f.work_order_id JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${followScope.where}`, [period.endsAt, ...followScope.params]);
    const costScope = scoped("s");
    const costs = await this.first(`SELECT COUNT(*) AS total, COALESCE(SUM(c.amount_minor),0) AS amount FROM ops_cost_lines c JOIN ops_work_orders w ON w.organization_id=c.organization_id AND w.id=c.work_order_id JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE ${costScope.where} AND c.service_date BETWEEN ? AND ?`, [...costScope.params, period.startsAt.slice(0,10), period.endsAt.slice(0,10)]);
    return { organizationId: scope.organizationId, period, scope: { regionId: scope.regionIds?.length===1 ? scope.regionIds[0] : undefined, storeId: scope.storeIds?.length===1 ? scope.storeIds[0] : undefined }, activeVisits: Number(visit?.active ?? 0), unexpectedVisits: Number(exceptions?.unexpected ?? 0), openExceptions: Number(exceptions?.open ?? 0), noWorkOrderVisits: Number(visit?.no_wo ?? 0), missingCheckouts: Number(exceptions?.missing ?? 0), openWorkOrders: Number(work?.open ?? 0), overdueFollowUps: Number(followUps?.overdue ?? 0), recordedCost: { amountMinor: Number(costs?.amount ?? 0), currency: "USD" }, sourceCounts: { visits: Number(visit?.total ?? 0), workOrders: Number(work?.total ?? 0), followUps: Number(followUps?.total ?? 0), exceptions: Number(exceptions?.total ?? 0), costLines: Number(costs?.total ?? 0) } };
  }

  private async publicToken(input: PublicTokenLookup) { return await this.first("SELECT * FROM ops_public_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ? AND revoked_at IS NULL LIMIT 1", [input.tokenHash,input.purpose,input.now]); }
  async getPublicStoreGatewayByToken(input: PublicTokenLookup): Promise<PublicStoreGatewayView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="store")return null; const org=text(token,"organization_id"); const store=await this.getStore(org,text(token,"subject_id")); const organization=await this.getOrganization(org); if(!store||!organization)return null; const vendors=await this.all("SELECT DISTINCT v.id,v.name,(SELECT group_concat(display_name,'|') FROM ops_vendor_specialties sp WHERE sp.organization_id=v.organization_id AND sp.vendor_id=v.id) AS specialties FROM ops_vendors v JOIN ops_vendor_coverage c ON c.organization_id=v.organization_id AND c.vendor_id=v.id WHERE v.organization_id=? AND v.status='approved' AND (c.scope_kind='organization' AND c.scope_id=? OR c.scope_kind='region' AND c.scope_id=? OR c.scope_kind='store' AND c.scope_id=?) ORDER BY v.name",[org,org,store.regionId??"",store.id]); return {organizationId:org,organizationName:organization.name,store:{id:store.id,storeNumber:store.storeNumber,name:store.name,formattedAddress:formatAddress(store),locationPolicyEnabled:store.locationPolicyEnabled},approvedVendors:vendors.map(row=>({id:text(row,"id"),name:text(row,"name"),specialties:text(row,"specialties").split("|").filter(Boolean)})),actions:["report_issue","vendor_sign_in","current_visits"]}; }
  async getStoreVisitContextByToken(input: PublicTokenLookup): Promise<StoreVisitContextView|null> { const gateway=await this.getPublicStoreGatewayByToken(input); if(!gateway||!input.vendorId||!gateway.approvedVendors.some(row=>row.id===input.vendorId))return null; const vendor=await this.getVendor(gateway.organizationId,input.vendorId); if(!vendor)return null; const rows=await this.all("SELECT w.id,w.number,w.problem,w.category_key,w.status FROM ops_work_orders w JOIN ops_work_order_assignments a ON a.organization_id=w.organization_id AND a.work_order_id=w.id WHERE w.organization_id=? AND w.store_id=? AND a.vendor_id=? AND a.status IN ('issued','opened','accepted') AND w.status NOT IN ('completed_pending_review','closed','cancelled') ORDER BY w.created_at DESC",[gateway.organizationId,gateway.store.id,vendor.id]); return {organizationName:gateway.organizationName,store:gateway.store,vendor:{id:vendor.id,name:vendor.name},eligibleWorkOrders:rows.map(row=>({id:text(row,"id"),number:text(row,"number"),problem:text(row,"problem"),categoryKey:maybeText(row,"category_key"),status:text(row,"status") as WorkOrder["status"]})),allowsNoWorkOrder:true}; }
  async getServiceAuthorizationByToken(input: PublicTokenLookup): Promise<ServiceAuthorizationView|null> {
    const token=await this.publicToken(input);
    if(!token||text(token,"subject_type")!=="work_order_issuance")return null;
    const org=text(token,"organization_id");
    const issuance=await this.getIssuance(org,text(token,"subject_id"));
    if(!issuance)return null;
    const [assignment,workOrder,latestIssuance]=await Promise.all([
      this.getAssignment(org,issuance.assignmentId),
      this.getWorkOrder(org,issuance.workOrderId),
      this.getLatestIssuanceForWorkOrder(org,issuance.workOrderId),
    ]);
    if(!assignment||!workOrder||latestIssuance?.id!==issuance.id||assignment.kind!=="outside_vendor"||assignment.workOrderId!==workOrder.id||!assignment.vendorId||!["issued","opened","accepted"].includes(assignment.status)||["completed_pending_review","closed","cancelled"].includes(workOrder.status))return null;
    const activeAssignment=await this.getActiveAssignment(org,workOrder.id);
    if(activeAssignment?.id!==assignment.id)return null;
    const [vendor,store,organization]=await Promise.all([
      this.getVendor(org,assignment.vendorId),
      this.getStore(org,workOrder.storeId),
      this.getOrganization(org),
    ]);
    if(!vendor||!store||!organization)return null;
    let snapshot:Partial<ServiceAuthorizationView>={};
    try{snapshot=JSON.parse(issuance.immutablePayloadJson) as Partial<ServiceAuthorizationView>;}catch{return null;}
    const response=await this.first("SELECT * FROM ops_vendor_responses WHERE organization_id=? AND issuance_id=? ORDER BY responded_at DESC, id DESC LIMIT 1",[org,issuance.id]);
    return {organizationId:org,organizationName:snapshot.organizationName??organization.name,workOrderId:workOrder.id,assignmentId:assignment.id,issuanceId:issuance.id,workOrderNumber:snapshot.workOrderNumber??workOrder.number,revision:issuance.revision,status:workOrder.status,assignmentStatus:assignment.status,store:snapshot.store??{id:store.id,storeNumber:store.storeNumber,name:store.name,formattedAddress:formatAddress(store)},vendor:snapshot.vendor??{id:vendor.id,name:vendor.name},problem:snapshot.problem??workOrder.problem,priority:snapshot.priority??workOrder.priority,authorizedScope:snapshot.authorizedScope,categoryKey:snapshot.categoryKey,asset:snapshot.asset,requestedTiming:snapshot.requestedTiming,nte:snapshot.nte,billingInstruction:snapshot.billingInstruction??`Reference operator work order ${workOrder.number} on all service tickets and invoices.`,issuedAt:issuance.issuedAt,latestResponse:response?{response:text(response,"response") as VendorResponse["response"],responderName:text(response,"responder_name"),proposedAt:maybeText(response,"proposed_at"),message:maybeText(response,"message"),respondedAt:text(response,"responded_at")}:undefined};
  }
  async getActiveVisitByToken(input: PublicTokenLookup): Promise<ActiveVisitView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="visit")return null; const org=text(token,"organization_id"); const visit=await this.getVisit(org,text(token,"subject_id")); if(!visit||visit.status!=="active"||!visit.vendorId)return null; const store=await this.getStore(org,visit.storeId); const workOrder=visit.workOrderId?await this.getWorkOrder(org,visit.workOrderId):null; const evidence=await this.first("SELECT location_result FROM ops_visit_evidence WHERE organization_id=? AND visit_id=? AND kind='check_in'",[org,visit.id]); if(!store)return null; return {organizationId:org,id:visit.id,storeId:store.id,storeNumber:store.storeNumber,storeName:store.name,vendorId:visit.vendorId,vendorName:visit.providerName,workOrderId:workOrder?.id,workOrderNumber:workOrder?.number,unmatchedReason:visit.unmatchedReason,technicianName:visit.technicianName,purpose:visit.purpose,checkedInAt:visit.checkedInAt,startedChannel:visit.startedChannel,checkInLocationResult:(maybeText(evidence??{},"location_result")??"not_requested") as ActiveVisitView["checkInLocationResult"],approximateObservedSeconds:Math.max(0,Math.floor((Date.parse(input.now)-Date.parse(visit.checkedInAt))/1000))}; }
  async getEstimateRequestByPublicToken(input: PublicTokenLookup) { const token=await this.publicToken(input); if(!token||token.used_at!=null||text(token,"subject_type")!=="work_order_estimate_request")return null; const request=await this.getEstimateRequest(text(token,"organization_id"),text(token,"subject_id")); return request&&(input.vendorId===undefined||request.vendorId===input.vendorId)?{request,tokenId:text(token,"id"),expiresAt:text(token,"expires_at")}:null; }
  async getVisitByCheckoutToken(input: PublicTokenLookup) { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="visit")return null; const visit=await this.getVisit(text(token,"organization_id"),text(token,"subject_id")); return visit ? { visit, expiresAt:text(token,"expires_at") } : null; }
  async getTrustedStoreDeviceByToken(input: PublicTokenLookup): Promise<TrustedStoreDeviceView|null> { const token=await this.publicToken(input); if(!token||text(token,"subject_type")!=="store")return null; const org=text(token,"organization_id"); const store=await this.getStore(org,text(token,"subject_id")); const organization=await this.getOrganization(org); if(!store||!organization)return null; return { organizationId:org, organizationName:organization.name, store:{ id:store.id, storeNumber:store.storeNumber, name:store.name, formattedAddress:formatAddress(store) }, activeVisits:await this.listActiveVisitsForStore(org,store.id) }; }

  async atomicWrite(statements: readonly OpsStatement[]) { await this.db.batch(statements.map((statement) => this.db.prepare(statement.sql).bind(...statement.params))); }
}

export function createOpsSqlRepository(
  db: D1Database,
  kind: "d1" | "postgres",
): OpsRepository {
  return new D1OpsRepository(db, kind);
}

export function createOpsD1Repository(db: D1Database): OpsRepository {
  return createOpsSqlRepository(db, "d1");
}
