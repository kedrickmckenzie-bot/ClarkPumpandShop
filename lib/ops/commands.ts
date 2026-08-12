import type { OpsRepository, OpsStatement } from "./repository";
import type { ServiceAuthorizationSnapshot } from "./view-models";
import type {
  ActorContext,
  AssignmentKind,
  AssignmentStatus,
  IsoDateTime,
  LocationObservation,
  OpsId,
  VendorResponseKind,
  VisitChannel,
  VisitOutcome,
  WorkOrderPriority,
} from "./types";

export interface OpsClock { now(): IsoDateTime }
export interface OpsIdSource { next(prefix: string): OpsId }
export interface OpsCommandServices { repository: OpsRepository; clock?: OpsClock; ids?: OpsIdSource }

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function json(value: unknown) { return JSON.stringify(value); }

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  aggregateType: string;
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: OpsIdSource;
}): OpsStatement[] {
  const payloadJson = json(input.payload);
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"), organization_id: input.organizationId,
      aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
      event_type: input.eventType, actor_type: input.actor.actorType,
      actor_id: input.actor.actorId, actor_name: input.actor.actorName,
      occurred_at: input.occurredAt, payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"), organization_id: input.organizationId,
      topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId, payload_json: payloadJson,
      status: "pending", available_at: input.occurredAt, created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

export class OpsDomainError extends Error {
  constructor(public readonly code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "OpsDomainError";
  }
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
}

const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const LOCATION_MAX_FUTURE_SKEW_MS = 60 * 1000;

function assertFreshLocationCapture(location: LocationObservation, serverObservedAt: IsoDateTime) {
  const capturedAt = Date.parse(location.capturedAt);
  const observedAt = Date.parse(serverObservedAt);
  if (!Number.isFinite(capturedAt)) throw new OpsDomainError("VALIDATION", "Location capture time is invalid");
  const age = observedAt - capturedAt;
  if (age > LOCATION_MAX_AGE_MS || age < -LOCATION_MAX_FUTURE_SKEW_MS) {
    throw new OpsDomainError("VALIDATION", "Location evidence must be captured at check-in or checkout time");
  }
}

export interface CreateStoreInput {
  organizationId: OpsId; regionId?: OpsId; storeNumber: string; name: string;
  address1: string; address2?: string; city: string; state: string; postalCode: string;
  aliases?: string[]; latitudeE6?: number; longitudeE6?: number; geofenceRadiusM?: number;
  locationPolicyEnabled?: boolean; timeZone?: string; actor: ActorContext;
}

export async function createStore(svc: OpsCommandServices, input: CreateStoreInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getOrganization(input.organizationId))) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const now = clock.now();
  const id = ids.next("store");
  const storeNumber = required(input.storeNumber, "Store number");
  const name = required(input.name, "Store name");
  const address1 = required(input.address1, "Address");
  const city = required(input.city, "City");
  const state = required(input.state, "State");
  const postalCode = required(input.postalCode, "Postal code");
  const aliases = [...new Set((input.aliases ?? []).map((item) => item.trim()).filter(Boolean))];
  const searchText = [storeNumber, name, address1, input.address2, city, state, postalCode, ...aliases].filter(Boolean).join(" ").toLocaleLowerCase("en-US");
  const statements = [
    insert("ops_stores", {
      id, organization_id: input.organizationId, region_id: input.regionId,
      store_number: storeNumber, name, address_1: address1, address_2: input.address2,
      city, state, postal_code: postalCode, aliases_json: json(aliases), search_text: searchText,
      latitude_e6: input.latitudeE6, longitude_e6: input.longitudeE6,
      geofence_radius_m: input.geofenceRadiusM ?? 200, location_policy_enabled: input.locationPolicyEnabled === false ? 0 : 1,
      time_zone: input.timeZone, status: "active", created_at: now,
    }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "store", aggregateId: id, eventType: "store.created", actor: input.actor, occurredAt: now, payload: { storeNumber, name }, ids }),
  ];
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, regionId: input.regionId, storeNumber, name, address1, address2: input.address2, city, state, postalCode, aliases, latitudeE6: input.latitudeE6, longitudeE6: input.longitudeE6, geofenceRadiusM: input.geofenceRadiusM ?? 200, locationPolicyEnabled: input.locationPolicyEnabled !== false, timeZone: input.timeZone, status: "active" as const, createdAt: now };
}

export interface OnboardVendorInput {
  organizationId: OpsId; code: string; name: string; dispatchEmail: string; dispatchPhone?: string;
  preferred?: boolean; specialties: Array<{ canonicalKey: string; displayName: string; searchAliases?: string[] }>;
  coverage: Array<{ scopeKind: "organization" | "region" | "store"; scopeId: OpsId; preferredRank?: number }>;
  actor: ActorContext;
}

export async function onboardVendor(svc: OpsCommandServices, input: OnboardVendorInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getOrganization(input.organizationId))) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const now = clock.now();
  const id = ids.next("vendor");
  const code = required(input.code, "Vendor code");
  const name = required(input.name, "Vendor name");
  const dispatchEmail = required(input.dispatchEmail, "Dispatch email");
  if (!dispatchEmail.includes("@")) throw new OpsDomainError("VALIDATION", "Dispatch email is invalid");
  if (!input.specialties.length) throw new OpsDomainError("VALIDATION", "At least one specialty is required");
  const searchText = [name, ...input.specialties.flatMap((item) => [item.displayName, ...(item.searchAliases ?? [])])].join(" ").toLocaleLowerCase("en-US");
  const statements: OpsStatement[] = [insert("ops_vendors", { id, organization_id: input.organizationId, code, name, dispatch_email: dispatchEmail, dispatch_phone: input.dispatchPhone, status: "approved", preferred: input.preferred ? 1 : 0, search_text: searchText, created_at: now })];
  for (const specialty of input.specialties) statements.push(insert("ops_vendor_specialties", { id: ids.next("specialty"), organization_id: input.organizationId, vendor_id: id, canonical_key: required(specialty.canonicalKey, "Specialty key"), display_name: required(specialty.displayName, "Specialty name"), search_aliases_json: json(specialty.searchAliases ?? []) }));
  for (const coverage of input.coverage) statements.push(insert("ops_vendor_coverage", { id: ids.next("coverage"), organization_id: input.organizationId, vendor_id: id, scope_kind: coverage.scopeKind, scope_id: coverage.scopeId, preferred_rank: coverage.preferredRank }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "vendor", aggregateId: id, eventType: "vendor.onboarded", actor: input.actor, occurredAt: now, payload: { code, name, specialtyCount: input.specialties.length }, ids }));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, code, name, dispatchEmail, dispatchPhone: input.dispatchPhone, status: "approved" as const, preferred: input.preferred ?? false, createdAt: now };
}

export interface CreateServiceRequestInput {
  organizationId: OpsId; storeId: OpsId; reporterName: string; reporterEmployeeId?: string;
  problem: string; priority?: WorkOrderPriority; actor: ActorContext;
}

export async function createServiceRequest(svc: OpsCommandServices, input: CreateServiceRequestInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getStore(input.organizationId, input.storeId))) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  const now = clock.now(); const id = ids.next("request"); const reference = `REQ-${id.slice(-8).toUpperCase()}`;
  const problem = required(input.problem, "Problem description"); const reporterName = required(input.reporterName, "Reporter name");
  await repository.atomicWrite([
    insert("ops_requests", { id, organization_id: input.organizationId, reference, store_id: input.storeId, reporter_name: reporterName, reporter_employee_id: input.reporterEmployeeId, problem, priority: input.priority ?? "routine", status: "submitted", submitted_at: now }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "request", aggregateId: id, eventType: "request.submitted", actor: input.actor, occurredAt: now, payload: { reference, storeId: input.storeId, problem }, ids }),
  ]);
  return { id, organizationId: input.organizationId, reference, storeId: input.storeId, reporterName, reporterEmployeeId: input.reporterEmployeeId, problem, priority: input.priority ?? "routine", status: "submitted" as const, submittedAt: now };
}

export interface CreateWorkOrderInput {
  organizationId: OpsId; number?: string; storeId: OpsId; requestId?: OpsId; problem: string;
  authorizedScope?: string; categoryKey?: string; taxonomyNodeId?: OpsId; assetId?: OpsId; componentId?: OpsId;
  priority?: WorkOrderPriority; accountableParty: string; nextAction: string; dueAt?: IsoDateTime;
  escalationTo?: string; nteAmountMinor?: number; currency?: string; actor: ActorContext;
}

export async function createWorkOrder(svc: OpsCommandServices, input: CreateWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getStore(input.organizationId, input.storeId))) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  if (input.requestId) {
    const request = await repository.getRequest(input.organizationId, input.requestId);
    if (!request || request.storeId !== input.storeId) throw new OpsDomainError("NOT_FOUND", "Request not found for this store and organization");
    if (request.status === "converted" || request.convertedWorkOrderId) throw new OpsDomainError("CONFLICT", "Request already has a canonical work order");
  }
  if (input.componentId && !input.assetId) throw new OpsDomainError("VALIDATION", "A component cannot be selected without its asset");
  if (input.taxonomyNodeId) {
    const selected = await repository.getTaxonomyNode(input.organizationId, input.taxonomyNodeId);
    if (!selected || !selected.active) throw new OpsDomainError("VALIDATION", "Taxonomy selection is not active in this organization");
    if (input.categoryKey) {
      const nodes = await repository.listTaxonomyNodes(input.organizationId);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      let root = selected;
      const visited = new Set<OpsId>();
      while (root.parentNodeId) {
        if (visited.has(root.id)) throw new OpsDomainError("VALIDATION", "Taxonomy hierarchy contains a cycle");
        visited.add(root.id);
        const parent = byId.get(root.parentNodeId);
        if (!parent) throw new OpsDomainError("VALIDATION", "Taxonomy selection has an invalid parent path");
        root = parent;
      }
      if (root.canonicalKey !== input.categoryKey) throw new OpsDomainError("VALIDATION", "Taxonomy selection must belong to the selected category");
    }
  }
  if (input.assetId) {
    const asset = await repository.getAsset(input.organizationId, input.assetId);
    if (!asset || asset.storeId !== input.storeId) throw new OpsDomainError("VALIDATION", "Asset must belong to the selected store and organization");
    if (input.categoryKey && asset.categoryKey !== input.categoryKey) throw new OpsDomainError("VALIDATION", "Asset must belong to the selected category");
    if (input.componentId) {
      const component = await repository.getComponent(input.organizationId, input.componentId);
      if (!component || component.assetId !== asset.id) throw new OpsDomainError("VALIDATION", "Component must belong to the selected asset and organization");
    }
  }
  if (input.nteAmountMinor !== undefined && (!Number.isInteger(input.nteAmountMinor) || input.nteAmountMinor < 0)) throw new OpsDomainError("VALIDATION", "NTE must be a non-negative integer minor-unit amount");
  const now = clock.now(); const id = ids.next("work-order");
  const organization = await repository.getOrganization(input.organizationId);
  if (!organization) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const number = input.number ? required(input.number, "Work order number") : await repository.allocateWorkOrderNumber(input.organizationId, organization.workOrderPrefix, Number(now.slice(0, 4)));
  const problem = required(input.problem, "Problem description");
  const statements: OpsStatement[] = [insert("ops_work_orders", { id, organization_id: input.organizationId, number, store_id: input.storeId, request_id: input.requestId, problem, authorized_scope: input.authorizedScope, category_key: input.categoryKey, taxonomy_node_id: input.taxonomyNodeId, asset_id: input.assetId, component_id: input.componentId, priority: input.priority ?? "routine", status: "approved", accountable_party: required(input.accountableParty, "Accountable party"), next_action: required(input.nextAction, "Next action"), due_at: input.dueAt, escalation_to: input.escalationTo, nte_amount_minor: input.nteAmountMinor, nte_currency: input.nteAmountMinor === undefined ? undefined : input.currency ?? "USD", created_at: now })];
  if (input.requestId) statements.push({ sql: "UPDATE ops_requests SET status = ?, converted_work_order_id = ? WHERE organization_id = ? AND id = ? AND store_id = ?", params: ["converted", id, input.organizationId, input.requestId, input.storeId] });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: id, eventType: "work_order.created", actor: input.actor, occurredAt: now, payload: { number, storeId: input.storeId, requestId: input.requestId, classified: Boolean(input.categoryKey), assetLinked: Boolean(input.assetId) }, ids }));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, number, storeId: input.storeId, requestId: input.requestId, problem, authorizedScope: input.authorizedScope, categoryKey: input.categoryKey, taxonomyNodeId: input.taxonomyNodeId, assetId: input.assetId, componentId: input.componentId, priority: input.priority ?? "routine", status: "approved" as const, accountableParty: input.accountableParty.trim(), nextAction: input.nextAction.trim(), dueAt: input.dueAt, escalationTo: input.escalationTo, nte: input.nteAmountMinor === undefined ? undefined : { amountMinor: input.nteAmountMinor, currency: input.currency ?? "USD" }, createdAt: now };
}

export interface AssignWorkOrderInput { organizationId: OpsId; workOrderId: OpsId; kind: AssignmentKind; vendorId?: OpsId; internalMembershipId?: OpsId; actor: ActorContext }
export async function assignWorkOrder(svc: OpsCommandServices, input: AssignWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (["closed", "cancelled"].includes(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot be reassigned");
  if (input.kind === "outside_vendor" && (!input.vendorId || !(await repository.getVendor(input.organizationId, input.vendorId)))) throw new OpsDomainError("VALIDATION", "Approved outside vendor is required");
  if (input.kind === "outside_vendor" && input.vendorId) {
    const vendor = await repository.getVendor(input.organizationId, input.vendorId);
    if (vendor?.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Outside vendor is not approved");
    if (!(await repository.vendorCoversStore(input.organizationId, input.vendorId, workOrder.storeId))) throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
  }
  if (input.kind === "internal" && (!input.internalMembershipId || !(await repository.getMembership(input.organizationId, input.internalMembershipId)))) throw new OpsDomainError("VALIDATION", "Internal maintenance member is required");
  if (input.kind === "choose_later" && (input.vendorId || input.internalMembershipId)) throw new OpsDomainError("VALIDATION", "Choose later cannot include a provider");
  const now = clock.now(); const id = ids.next("assignment"); const status: AssignmentStatus = "pending";
  const prior = await repository.getActiveAssignment(input.organizationId, input.workOrderId);
  const statements: OpsStatement[] = [];
  if (prior) statements.push({ sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)", params: ["superseded", input.organizationId, prior.id, input.workOrderId, "cancelled", "declined", "completed", "superseded"] });
  statements.push(insert("ops_work_order_assignments", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, kind: input.kind, vendor_id: input.vendorId, internal_membership_id: input.internalMembershipId, status, assigned_at: now, supersedes_assignment_id: prior?.id }), { sql: "UPDATE ops_work_orders SET next_action = ?, accountable_party = ? WHERE organization_id = ? AND id = ?", params: [input.kind === "choose_later" ? "Choose service provider" : "Issue service authorization", input.kind === "outside_vendor" ? "Facilities coordinator" : input.kind === "internal" ? "Internal maintenance" : "Facilities coordinator", input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.assigned", actor: input.actor, occurredAt: now, payload: { assignmentId: id, supersedesAssignmentId: prior?.id, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId }, ids }));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, status, assignedAt: now };
}

export interface IssueWorkOrderInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; revision: number; channel: "email" | "sms" | "print" | "manual"; authorizationSnapshot: ServiceAuthorizationSnapshot; publicToken?: { tokenHash: string; expiresAt: IsoDateTime }; actor: ActorContext }
export async function issueWorkOrder(svc: OpsCommandServices, input: IssueWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId); const assignment = await repository.getAssignment(input.organizationId, input.assignmentId);
  if (!workOrder || !assignment || assignment.workOrderId !== input.workOrderId) throw new OpsDomainError("NOT_FOUND", "Work order assignment not found");
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new OpsDomainError("VALIDATION", "Issuance revision must be a positive integer");
  const activeAssignment = await repository.getActiveAssignment(input.organizationId, input.workOrderId);
  if (!activeAssignment || activeAssignment.id !== assignment.id) throw new OpsDomainError("CONFLICT", "Only the current active assignment can be issued");
  if (assignment.kind === "choose_later") throw new OpsDomainError("CONFLICT", "Choose a service provider before issuing work");
  const latest = await repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId);
  if (latest && input.revision !== latest.revision + 1) throw new OpsDomainError("CONFLICT", "Issuance revision must follow the latest immutable revision");
  if (!latest && input.revision !== 1) throw new OpsDomainError("CONFLICT", "First issuance revision must be 1");
  if (input.authorizationSnapshot.workOrderNumber !== workOrder.number || input.authorizationSnapshot.store.id !== workOrder.storeId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the work order");
  if (assignment.kind === "outside_vendor" && input.authorizationSnapshot.vendor.id !== assignment.vendorId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the assigned vendor");
  required(input.authorizationSnapshot.organizationName, "Authorization organization name");
  required(input.authorizationSnapshot.problem, "Authorization problem");
  required(input.authorizationSnapshot.billingInstruction, "Authorization billing instruction");
  const now = clock.now(); const id = ids.next("issuance"); const payload = json(input.authorizationSnapshot);
  if (input.publicToken) {
    if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Only outside-vendor work uses a public authorization link");
    if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
    if (input.publicToken.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Authorization link expiry must be in the future");
  }
  const statements: OpsStatement[] = [insert("ops_work_order_issuances", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, assignment_id: input.assignmentId, revision: input.revision, immutable_payload_json: payload, channel: input.channel, issued_at: now }), { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ?", params: ["issued", input.organizationId, input.assignmentId, input.workOrderId] }, { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["issued", assignment.kind === "outside_vendor" ? "Outside vendor" : "Internal maintenance", "Acknowledge service authorization", input.organizationId, input.workOrderId] }];
  if (input.publicToken) statements.push(insert("ops_public_tokens", { id: ids.next("public-token"), organization_id: input.organizationId, purpose: "service_authorization", subject_type: "work_order_issuance", subject_id: id, token_hash: input.publicToken.tokenHash, expires_at: input.publicToken.expiresAt, created_at: now }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.issued", actor: input.actor, occurredAt: now, payload: { issuanceId: id, assignmentId: input.assignmentId, revision: input.revision, channel: input.channel }, ids }));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, assignmentId: input.assignmentId, revision: input.revision, immutablePayloadJson: payload, channel: input.channel, issuedAt: now };
}

export interface RecordVendorResponseInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; issuanceId: OpsId; response: VendorResponseKind; responderName: string; proposedAt?: IsoDateTime; message?: string; actor: ActorContext }
export async function recordVendorResponse(svc: OpsCommandServices, input: RecordVendorResponseInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const assignment = await repository.getAssignment(input.organizationId, input.assignmentId); const issuance = await repository.getIssuance(input.organizationId, input.issuanceId);
  if (!assignment || !issuance || assignment.workOrderId !== input.workOrderId || issuance.assignmentId !== assignment.id) throw new OpsDomainError("NOT_FOUND", "Issued vendor assignment not found");
  if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Vendor responses apply only to outside-vendor assignments");
  if (["declined", "completed", "cancelled", "superseded"].includes(assignment.status)) throw new OpsDomainError("CONFLICT", "Assignment no longer accepts vendor responses");
  const latestIssuance = await repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId);
  if (!latestIssuance || latestIssuance.id !== issuance.id) throw new OpsDomainError("CONFLICT", "Response link is for a superseded issuance revision");
  const priorResponse = await repository.getLatestVendorResponse(input.organizationId, input.assignmentId);
  if (priorResponse && ["accepted", "declined"].includes(priorResponse.response)) throw new OpsDomainError("CONFLICT", "Assignment already has a terminal vendor response");
  if (input.response === "proposed_date" && !input.proposedAt) throw new OpsDomainError("VALIDATION", "Proposed date is required");
  const now = clock.now(); const id = ids.next("vendor-response");
  const assignmentStatus = input.response === "accepted" ? "accepted" : input.response === "declined" ? "declined" : "issued";
  const workStatus = input.response === "accepted" ? "accepted" : "issued";
  const facilitiesOwnsNext = ["declined", "proposed_date", "question"].includes(input.response);
  const nextAction = input.response === "declined" ? "Select another provider" : input.response === "proposed_date" ? "Review proposed service date" : input.response === "question" ? "Answer vendor question" : "Complete onsite service";
  await repository.atomicWrite([insert("ops_vendor_responses", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, assignment_id: input.assignmentId, issuance_id: input.issuanceId, response: input.response, responder_name: required(input.responderName, "Responder name"), proposed_at: input.proposedAt, message: input.message, responded_at: now }), { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?", params: [assignmentStatus, input.organizationId, input.assignmentId] }, { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: [workStatus, facilitiesOwnsNext ? "Facilities coordinator" : "Outside vendor", nextAction, input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: `vendor.${input.response}`, actor: input.actor, occurredAt: now, payload: { responseId: id, assignmentId: input.assignmentId, issuanceId: input.issuanceId, revision: issuance.revision, proposedAt: input.proposedAt, message: input.message }, ids })]);
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, assignmentId: input.assignmentId, issuanceId: input.issuanceId, response: input.response, responderName: input.responderName.trim(), proposedAt: input.proposedAt, message: input.message, respondedAt: now };
}

export interface CheckInVisitInput { organizationId: OpsId; storeId: OpsId; vendorId?: OpsId; internalMembershipId?: OpsId; workOrderId?: OpsId; unmatchedReason?: string; technicianName: string; purpose: string; channel: VisitChannel; location: LocationObservation; actor: ActorContext }
async function prepareCheckInVisit(svc: OpsCommandServices, input: CheckInVisitInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  if (Boolean(input.vendorId) === Boolean(input.internalMembershipId)) throw new OpsDomainError("VALIDATION", "Choose exactly one outside vendor or internal maintenance member");
  const vendor = input.vendorId ? await repository.getVendor(input.organizationId, input.vendorId) : null;
  const internalMember = input.internalMembershipId ? await repository.getMembership(input.organizationId, input.internalMembershipId) : null;
  if (input.vendorId && !vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
  if (vendor && vendor.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Vendor is not approved");
  if (vendor && !(await repository.vendorCoversStore(input.organizationId, vendor.id, input.storeId))) throw new OpsDomainError("FORBIDDEN", "Vendor does not cover this store");
  if (input.internalMembershipId && !internalMember) throw new OpsDomainError("NOT_FOUND", "Internal maintenance member not found in organization");
  const providerName = vendor?.name ?? "Internal maintenance";
  const technicianName = required(input.technicianName, "Technician name"); const purpose = required(input.purpose, "Visit purpose");
  if (await repository.findActiveVisit(input.organizationId, input.storeId, { vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, technicianName })) throw new OpsDomainError("CONFLICT", "This technician already has an active visit at this store");
  if (input.workOrderId) {
    const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
    if (!workOrder || workOrder.storeId !== input.storeId) throw new OpsDomainError("NOT_FOUND", "Work order is not eligible at this store");
    if (["closed", "cancelled"].includes(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot receive a new visit");
    if (input.vendorId && !(await repository.findActiveVendorAssignment(input.organizationId, input.workOrderId, input.vendorId))) throw new OpsDomainError("FORBIDDEN", "Work order is not assigned to this vendor");
    if (input.internalMembershipId && !(await repository.findActiveInternalAssignment(input.organizationId, input.workOrderId, input.internalMembershipId))) throw new OpsDomainError("FORBIDDEN", "Work order is not assigned to this internal maintenance member");
  } else required(input.unmatchedReason ?? "", "Reason when no work order is provided");
  const now = clock.now();
  assertFreshLocationCapture(input.location, now);
  const id = ids.next("visit"); const evidenceId = ids.next("evidence");
  const statements: OpsStatement[] = [insert("ops_visit_sessions", { id, organization_id: input.organizationId, store_id: input.storeId, provider_kind: input.vendorId ? "outside_vendor" : "internal", vendor_id: input.vendorId, internal_membership_id: input.internalMembershipId, work_order_id: input.workOrderId, unmatched_reason: input.workOrderId ? undefined : input.unmatchedReason?.trim(), technician_name: technicianName, provider_name: providerName, purpose, status: "active", started_channel: input.channel, checked_in_at: now }), insert("ops_visit_evidence", { id: evidenceId, organization_id: input.organizationId, visit_id: id, kind: "check_in", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now }) })];
  if (!input.workOrderId) statements.push(insert("ops_exceptions", { id: ids.next("exception"), organization_id: input.organizationId, kind: "no_work_order", store_id: input.storeId, visit_id: id, vendor_id: input.vendorId, severity: "attention", status: "open", summary: `${providerName} checked in without an operator work order`, detected_at: now }));
  if (["outside_geofence", "low_accuracy"].includes(input.location.result)) statements.push(insert("ops_exceptions", { id: ids.next("exception"), organization_id: input.organizationId, kind: input.location.result === "outside_geofence" ? "outside_geofence" : "low_accuracy_location", store_id: input.storeId, work_order_id: input.workOrderId, visit_id: id, vendor_id: input.vendorId, severity: "attention", status: "open", summary: `Check-in location result: ${input.location.result}`, detected_at: now }));
  if (input.workOrderId) statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", providerName, "Record service outcome", input.organizationId, input.workOrderId] });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: id, eventType: "visit.checked_in", actor: input.actor, occurredAt: now, payload: { storeId: input.storeId, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, workOrderId: input.workOrderId, channel: input.channel, locationResult: input.location.result }, ids }));
  const visit = { id, organizationId: input.organizationId, storeId: input.storeId, providerKind: input.vendorId ? "outside_vendor" as const : "internal" as const, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, workOrderId: input.workOrderId, unmatchedReason: input.workOrderId ? undefined : input.unmatchedReason?.trim(), technicianName, providerName, purpose, status: "active" as const, startedChannel: input.channel, checkedInAt: now };
  return { repository, ids, now, statements, visit };
}

export async function checkInVisit(svc: OpsCommandServices, input: CheckInVisitInput) {
  const prepared = await prepareCheckInVisit(svc, input);
  await prepared.repository.atomicWrite(prepared.statements);
  return prepared.visit;
}

export interface CheckInVisitWithCheckoutTokenInput extends CheckInVisitInput {
  checkoutToken: { tokenHash: string; expiresAt: IsoDateTime };
}

export async function checkInVisitWithCheckoutToken(
  svc: OpsCommandServices,
  input: CheckInVisitWithCheckoutTokenInput,
) {
  const prepared = await prepareCheckInVisit(svc, input);
  if (!/^[a-f0-9]{64}$/i.test(input.checkoutToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (input.checkoutToken.expiresAt <= prepared.now) throw new OpsDomainError("VALIDATION", "Checkout token expiry must be in the future");
  const tokenId = prepared.ids.next("public-token");
  prepared.statements.push(
    insert("ops_public_tokens", {
      id: tokenId,
      organization_id: input.organizationId,
      purpose: "active_visit",
      subject_type: "visit",
      subject_id: prepared.visit.id,
      token_hash: input.checkoutToken.tokenHash.toLowerCase(),
      expires_at: input.checkoutToken.expiresAt,
      created_at: prepared.now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "visit",
      aggregateId: prepared.visit.id,
      eventType: "visit.checkout_token_issued",
      actor: input.actor,
      occurredAt: prepared.now,
      payload: { tokenId, expiresAt: input.checkoutToken.expiresAt },
      ids: prepared.ids,
    }),
  );
  await prepared.repository.atomicWrite(prepared.statements);
  return { visit: prepared.visit, tokenId, expiresAt: input.checkoutToken.expiresAt };
}

const unresolvedOutcomes = new Set<VisitOutcome>(["temporary_repair", "diagnosed_waiting_parts", "return_required", "unable_to_complete"]);
export interface CheckOutVisitInput { organizationId: OpsId; visitId: OpsId; channel: VisitChannel; outcome: VisitOutcome; outcomeNotes?: string; location: LocationObservation; followUp?: { accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string }; actor: ActorContext }
export async function checkOutVisit(svc: OpsCommandServices, input: CheckOutVisitInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const visit = await repository.getVisit(input.organizationId, input.visitId);
  if (!visit) throw new OpsDomainError("NOT_FOUND", "Visit not found");
  if (visit.status !== "active" || visit.checkedOutAt) throw new OpsDomainError("CONFLICT", "Visit is already closed");
  const now = clock.now();
  assertFreshLocationCapture(input.location, now);
  const observedDurationSeconds = Math.max(0, Math.floor((Date.parse(now) - Date.parse(visit.checkedInAt)) / 1000));
  if (!Number.isFinite(observedDurationSeconds)) throw new OpsDomainError("VALIDATION", "Visit check-in timestamp is invalid");
  if (unresolvedOutcomes.has(input.outcome) && visit.workOrderId && !input.followUp) throw new OpsDomainError("VALIDATION", "Unresolved work requires an accountable follow-up");
  const statements: OpsStatement[] = [{ sql: "UPDATE ops_visit_sessions SET status = ?, ended_channel = ?, checked_out_at = ?, outcome = ?, outcome_notes = ?, observed_duration_seconds = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["checked_out", input.channel, now, input.outcome, input.outcomeNotes ?? null, observedDurationSeconds, input.organizationId, input.visitId, "active"] }, insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.visitId, kind: "check_out", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes }) })];
  let followUpId: OpsId | undefined;
  if (input.followUp && visit.workOrderId) { followUpId = ids.next("follow-up"); statements.push(insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: visit.workOrderId, source_visit_id: visit.id, accountable_party: required(input.followUp.accountableParty, "Follow-up accountable party"), next_action: required(input.followUp.nextAction, "Follow-up next action"), due_at: input.followUp.dueAt, escalation_to: required(input.followUp.escalationTo, "Follow-up escalation"), status: "open", created_at: now }), { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [input.outcome === "diagnosed_waiting_parts" ? "waiting_on_parts" : "waiting_on_vendor", input.followUp.accountableParty, input.followUp.nextAction, input.followUp.dueAt, input.followUp.escalationTo, input.organizationId, visit.workOrderId] }); }
  else if (visit.workOrderId) statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["completed_pending_review", "Facilities coordinator", "Review completed service", input.organizationId, visit.workOrderId] });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actor: input.actor, occurredAt: now, payload: { workOrderId: visit.workOrderId, outcome: input.outcome, channel: input.channel, observedDurationSeconds, followUpId, durationMeaning: "approximate_presence_not_labor" }, ids }));
  await repository.atomicWrite(statements);
  return { ...visit, status: "checked_out" as const, endedChannel: input.channel, checkedOutAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes, observedDurationSeconds, followUpId };
}

export interface CreateFollowUpInput { organizationId: OpsId; workOrderId: OpsId; sourceVisitId?: OpsId; accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string; actor: ActorContext }
export async function createFollowUp(svc: OpsCommandServices, input: CreateFollowUpInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getWorkOrder(input.organizationId, input.workOrderId))) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (input.sourceVisitId && !(await repository.getVisit(input.organizationId, input.sourceVisitId))) throw new OpsDomainError("NOT_FOUND", "Source visit not found");
  const now = clock.now(); const id = ids.next("follow-up");
  await repository.atomicWrite([insert("ops_follow_ups", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, source_visit_id: input.sourceVisitId, accountable_party: required(input.accountableParty, "Accountable party"), next_action: required(input.nextAction, "Next action"), due_at: input.dueAt, escalation_to: required(input.escalationTo, "Escalation"), status: "open", created_at: now }), { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [input.accountableParty, input.nextAction, input.dueAt, input.escalationTo, input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "follow_up.created", actor: input.actor, occurredAt: now, payload: { followUpId: id, sourceVisitId: input.sourceVisitId, dueAt: input.dueAt }, ids })]);
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, sourceVisitId: input.sourceVisitId, accountableParty: input.accountableParty.trim(), nextAction: input.nextAction.trim(), dueAt: input.dueAt, escalationTo: input.escalationTo.trim(), status: "open" as const, createdAt: now };
}

export interface AttachPublicEvidenceInput {
  organizationId: OpsId;
  entityType: "request" | "work_order" | "visit";
  entityId: OpsId;
  storageKey: string;
  sha256: string;
  originalName: string;
  contentType: string;
  byteLength: number;
  purpose: "photo" | "service_document" | "other";
  visibility?: "internal" | "vendor_shared" | "public_receipt";
  channel?: VisitChannel;
  actor: ActorContext;
}

export async function attachPublicEvidence(svc: OpsCommandServices, input: AttachPublicEvidenceInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const entity = input.entityType === "request"
    ? await repository.getRequest(input.organizationId, input.entityId)
    : input.entityType === "work_order"
      ? await repository.getWorkOrder(input.organizationId, input.entityId)
      : await repository.getVisit(input.organizationId, input.entityId);
  if (!entity) throw new OpsDomainError("NOT_FOUND", "Evidence target not found in organization");
  if (!Number.isInteger(input.byteLength) || input.byteLength < 1) throw new OpsDomainError("VALIDATION", "File size must be a positive integer");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new OpsDomainError("VALIDATION", "File SHA-256 is invalid");
  const now = clock.now();
  const fileId = ids.next("file");
  const linkId = ids.next("file-link");
  const statements: OpsStatement[] = [
    insert("ops_files", { id: fileId, organization_id: input.organizationId, storage_key: required(input.storageKey, "Storage key"), sha256: input.sha256.toLowerCase(), original_name: required(input.originalName, "Original file name"), content_type: required(input.contentType, "Content type"), byte_length: input.byteLength, status: "available", created_at: now }),
    insert("ops_entity_files", { id: linkId, organization_id: input.organizationId, file_id: fileId, entity_type: input.entityType, entity_id: input.entityId, purpose: input.purpose, visibility: input.visibility ?? "vendor_shared", created_at: now }),
  ];
  if (input.entityType === "visit") statements.push(insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.entityId, kind: input.purpose === "photo" ? "photo" : "file", channel: input.channel ?? "secure_link", observed_at: now, payload_json: json({ fileId, linkId, purpose: input.purpose }) }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: input.entityType, aggregateId: input.entityId, eventType: "evidence.attached", actor: input.actor, occurredAt: now, payload: { fileId, linkId, purpose: input.purpose, contentType: input.contentType, byteLength: input.byteLength }, ids }));
  await repository.atomicWrite(statements);
  return { fileId, linkId, organizationId: input.organizationId, entityType: input.entityType, entityId: input.entityId, createdAt: now };
}

export interface IssueVisitCheckoutTokenInput {
  organizationId: OpsId;
  visitId: OpsId;
  tokenHash: string;
  expiresAt: IsoDateTime;
  actor: ActorContext;
}

export async function issueVisitCheckoutToken(svc: OpsCommandServices, input: IssueVisitCheckoutTokenInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const visit = await repository.getVisit(input.organizationId, input.visitId);
  if (!visit || visit.status !== "active") throw new OpsDomainError("NOT_FOUND", "Active visit not found");
  if (!/^[a-f0-9]{64}$/i.test(input.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  const now = clock.now();
  if (input.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Checkout token expiry must be in the future");
  const tokenId = ids.next("public-token");
  await repository.atomicWrite([
    insert("ops_public_tokens", { id: tokenId, organization_id: input.organizationId, purpose: "active_visit", subject_type: "visit", subject_id: visit.id, token_hash: input.tokenHash.toLowerCase(), expires_at: input.expiresAt, created_at: now }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checkout_token_issued", actor: input.actor, occurredAt: now, payload: { tokenId, expiresAt: input.expiresAt }, ids }),
  ]);
  return { tokenId, organizationId: input.organizationId, visitId: visit.id, expiresAt: input.expiresAt };
}
