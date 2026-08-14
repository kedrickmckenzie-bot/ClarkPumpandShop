import type { OpsRepository, OpsStatement } from "./repository";
import { atomicWorkOrderMutation } from "./concurrency";
import { OpsDomainError } from "./errors";
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
  WorkOrder,
  WorkOrderEstimateRequest,
  WorkOrderPriority,
  WorkOrderStatus,
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

const terminalWorkOrderStatuses = new Set<WorkOrderStatus>(["closed", "cancelled"]);

/**
 * The generic control editor is intentionally not a workflow-state machine.
 * Evidence-bearing states are projected only by their named domain commands
 * (issuance, vendor response, visit check-in/out, and follow-up completion).
 */
const workOrderControlTransitionMap: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  draft: ["cancelled"],
  awaiting_approval: ["cancelled"],
  approved: ["cancelled"],
  issued: ["cancelled"],
  accepted: ["cancelled"],
  scheduled: ["cancelled"],
  in_progress: ["cancelled"],
  waiting_on_vendor: ["cancelled"],
  waiting_on_parts: ["cancelled"],
  completed_pending_review: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function allowedWorkOrderControlTransitions(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return workOrderControlTransitionMap[status];
}

/** @deprecated Prefer the explicit control-editor name. */
export function allowedWorkOrderTransitions(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return allowedWorkOrderControlTransitions(status);
}

const routeAndIssueEligibleStatuses = new Set<WorkOrderStatus>([
  "approved",
  "issued",
  "accepted",
  "scheduled",
  "waiting_on_vendor",
  "waiting_on_parts",
]);

const vendorResponseClosedWorkStatuses = new Set<WorkOrderStatus>([
  "in_progress",
  "waiting_on_vendor",
  "waiting_on_parts",
  "completed_pending_review",
  "closed",
  "cancelled",
]);

const openBidRequestStatuses = new Set(["requested", "opened", "submitted"]);

function assertNoOpenBidRequests(requests: WorkOrderEstimateRequest[]) {
  if (requests.some((request) => openBidRequestStatuses.has(request.status))) {
    throw new OpsDomainError(
      "CONFLICT",
      "Open bid requests must be selected or withdrawn before service work can be issued",
    );
  }
}

export function canRouteAndIssueWorkOrder(status: WorkOrderStatus): boolean {
  return routeAndIssueEligibleStatuses.has(status);
}

function addHours(instant: IsoDateTime, hours: number): IsoDateTime {
  return new Date(Date.parse(instant) + hours * 60 * 60 * 1000).toISOString();
}

function defaultWorkOrderDueAt(priority: WorkOrderPriority, createdAt: IsoDateTime): IsoDateTime {
  const hours: Record<WorkOrderPriority, number> = {
    emergency: 2,
    urgent: 24,
    routine: 72,
    planned: 168,
  };
  return addHours(createdAt, hours[priority]);
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function revokeServiceAuthorizationTokens(
  organizationId: OpsId,
  issuanceIds: readonly OpsId[],
  now: IsoDateTime,
): OpsStatement[] {
  return issuanceIds.map((issuanceId) => ({
    sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
    params: [now, organizationId, "service_authorization", "work_order_issuance", issuanceId],
  }));
}

async function assertSelectedEstimateIsCurrent(
  repository: OpsRepository,
  selectedEstimate: WorkOrderEstimateRequest | undefined,
  now: IsoDateTime,
) {
  if (!selectedEstimate) return;
  const proposal = await repository.getLatestEstimateProposal(
    selectedEstimate.organizationId,
    selectedEstimate.id,
  );
  if (!proposal) {
    throw new OpsDomainError("CONFLICT", "The selected bid is missing its proposal evidence. Reopen the provider decision before issuing service work.");
  }
  if (proposal.validUntil && Date.parse(proposal.validUntil) <= Date.parse(now)) {
    throw new OpsDomainError("CONFLICT", "The selected vendor bid has expired. Reopen the bid decision before issuing work.");
  }
}

export interface CommandIdempotency {
  key: string;
  command: string;
  requestHash: string;
  expiresAt: IsoDateTime;
}

function idempotencyStatement(
  organizationId: OpsId,
  resultId: OpsId,
  now: IsoDateTime,
  input: CommandIdempotency,
): OpsStatement {
  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(input.key)) throw new OpsDomainError("VALIDATION", "Idempotency key is invalid");
  if (!/^[a-z0-9._:-]{3,100}$/.test(input.command)) throw new OpsDomainError("VALIDATION", "Idempotency command is invalid");
  if (!/^[a-f0-9]{64}$/i.test(input.requestHash)) throw new OpsDomainError("VALIDATION", "Idempotency request hash is invalid");
  if (input.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Idempotency expiry must be in the future");
  return insert("ops_idempotency_keys", {
    organization_id: organizationId,
    key: input.key,
    command: input.command,
    result_id: resultId,
    request_hash: input.requestHash.toLowerCase(),
    created_at: now,
    expires_at: input.expiresAt,
  });
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

export { OpsDomainError } from "./errors";

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
  escalationTo?: string; nteAmountMinor?: number; currency?: string;
  repairEstimateAmountMinor?: number; repairEstimateCurrency?: string;
  estimatedServiceExtensionMonths?: number;
  initialAssignment?: {
    kind: AssignmentKind;
    vendorId?: OpsId;
    internalMembershipId?: OpsId;
  };
  actor: ActorContext;
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
  if (input.repairEstimateAmountMinor !== undefined && (!Number.isInteger(input.repairEstimateAmountMinor) || input.repairEstimateAmountMinor < 0)) throw new OpsDomainError("VALIDATION", "Repair estimate must be a non-negative integer minor-unit amount");
  if (input.estimatedServiceExtensionMonths !== undefined && (!Number.isInteger(input.estimatedServiceExtensionMonths) || input.estimatedServiceExtensionMonths < 1 || input.estimatedServiceExtensionMonths > 1_200)) throw new OpsDomainError("VALIDATION", "Estimated service extension must be a whole number from 1 to 1,200 months");
  if ((input.repairEstimateAmountMinor !== undefined || input.estimatedServiceExtensionMonths !== undefined) && !input.assetId) throw new OpsDomainError("VALIDATION", "Repair planning inputs require a selected asset");
  if (input.initialAssignment?.kind === "outside_vendor") {
    if (!input.initialAssignment.vendorId || input.initialAssignment.internalMembershipId) {
      throw new OpsDomainError("VALIDATION", "An outside assignment requires exactly one vendor");
    }
    const vendor = await repository.getVendor(input.organizationId, input.initialAssignment.vendorId);
    if (!vendor || vendor.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Outside vendor is not approved");
    if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, input.storeId))) {
      throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
    }
  }
  if (input.initialAssignment?.kind === "internal") {
    if (!input.initialAssignment.internalMembershipId || input.initialAssignment.vendorId) {
      throw new OpsDomainError("VALIDATION", "An internal assignment requires exactly one maintenance member");
    }
    const member = await repository.getMembership(input.organizationId, input.initialAssignment.internalMembershipId);
    if (!member || member.status !== "active" || member.role !== "internal_technician") {
      throw new OpsDomainError("FORBIDDEN", "Internal assignee is not an active maintenance team member");
    }
  }
  if (input.initialAssignment?.kind === "choose_later" && (input.initialAssignment.vendorId || input.initialAssignment.internalMembershipId)) {
    throw new OpsDomainError("VALIDATION", "Choose later cannot include a provider");
  }
  const now = clock.now(); const id = ids.next("work-order");
  const organization = await repository.getOrganization(input.organizationId);
  if (!organization) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const number = input.number ? required(input.number, "Work order number") : await repository.allocateWorkOrderNumber(input.organizationId, organization.workOrderPrefix, Number(now.slice(0, 4)));
  const problem = required(input.problem, "Problem description");
  const priority = input.priority ?? "routine";
  const assignmentProjection = input.initialAssignment
    ? input.initialAssignment.kind === "outside_vendor"
      ? { accountableParty: "Facilities coordinator", nextAction: "Issue service authorization" }
      : input.initialAssignment.kind === "internal"
        ? { accountableParty: "Internal maintenance", nextAction: "Acknowledge internal assignment" }
        : { accountableParty: "Facilities coordinator", nextAction: required(input.nextAction, "Next action") }
    : undefined;
  const accountableParty = assignmentProjection?.accountableParty ?? required(input.accountableParty, "Accountable party");
  const nextAction = assignmentProjection?.nextAction ?? required(input.nextAction, "Next action");
  const dueAt = input.dueAt ?? defaultWorkOrderDueAt(priority, now);
  const escalationTo = required(input.escalationTo ?? "Facilities director", "Escalation destination");
  const statements: OpsStatement[] = [insert("ops_work_orders", { id, organization_id: input.organizationId, number, store_id: input.storeId, request_id: input.requestId, problem, authorized_scope: input.authorizedScope, category_key: input.categoryKey, taxonomy_node_id: input.taxonomyNodeId, asset_id: input.assetId, component_id: input.componentId, priority, status: "approved", version: 0, accountable_party: accountableParty, next_action: nextAction, due_at: dueAt, escalation_to: escalationTo, nte_amount_minor: input.nteAmountMinor, nte_currency: input.nteAmountMinor === undefined ? undefined : input.currency ?? "USD", repair_estimate_amount_minor: input.repairEstimateAmountMinor, repair_estimate_currency: input.repairEstimateAmountMinor === undefined ? undefined : input.repairEstimateCurrency ?? "USD", estimated_service_extension_months: input.estimatedServiceExtensionMonths, created_at: now })];
  if (input.requestId) statements.push({ sql: "UPDATE ops_requests SET status = ?, converted_work_order_id = ? WHERE organization_id = ? AND id = ? AND store_id = ?", params: ["converted", id, input.organizationId, input.requestId, input.storeId] });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: id, eventType: "work_order.created", actor: input.actor, occurredAt: now, payload: { number, storeId: input.storeId, requestId: input.requestId, classified: Boolean(input.categoryKey), assetLinked: Boolean(input.assetId), repairPlanning: input.repairEstimateAmountMinor === undefined && input.estimatedServiceExtensionMonths === undefined ? undefined : { repairEstimateAmountMinor: input.repairEstimateAmountMinor, repairEstimateCurrency: input.repairEstimateAmountMinor === undefined ? undefined : input.repairEstimateCurrency ?? "USD", estimatedServiceExtensionMonths: input.estimatedServiceExtensionMonths } }, ids }));
  let initialAssignment: Awaited<ReturnType<typeof assignWorkOrder>> | undefined;
  if (input.initialAssignment) {
    const assignmentId = ids.next("assignment");
    statements.push(
      insert("ops_work_order_assignments", {
        id: assignmentId,
        organization_id: input.organizationId,
        work_order_id: id,
        kind: input.initialAssignment.kind,
        vendor_id: input.initialAssignment.vendorId,
        internal_membership_id: input.initialAssignment.internalMembershipId,
        status: "pending",
        assigned_at: now,
      }),
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: id,
        eventType: "work_order.assigned",
        actor: input.actor,
        occurredAt: now,
        payload: {
          assignmentId,
          kind: input.initialAssignment.kind,
          vendorId: input.initialAssignment.vendorId,
          internalMembershipId: input.initialAssignment.internalMembershipId,
          initialAssignment: true,
        },
        ids,
      }),
    );
    initialAssignment = {
      id: assignmentId,
      organizationId: input.organizationId,
      workOrderId: id,
      kind: input.initialAssignment.kind,
      vendorId: input.initialAssignment.vendorId,
      internalMembershipId: input.initialAssignment.internalMembershipId,
      status: "pending",
      assignedAt: now,
    };
  }
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, number, storeId: input.storeId, requestId: input.requestId, problem, authorizedScope: input.authorizedScope, categoryKey: input.categoryKey, taxonomyNodeId: input.taxonomyNodeId, assetId: input.assetId, componentId: input.componentId, priority, status: "approved" as const, version: 0, accountableParty, nextAction, dueAt, escalationTo, nte: input.nteAmountMinor === undefined ? undefined : { amountMinor: input.nteAmountMinor, currency: input.currency ?? "USD" }, repairEstimate: input.repairEstimateAmountMinor === undefined ? undefined : { amountMinor: input.repairEstimateAmountMinor, currency: input.repairEstimateCurrency ?? "USD" }, estimatedServiceExtensionMonths: input.estimatedServiceExtensionMonths, createdAt: now, initialAssignment };
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
  const priorIssuances = prior
    ? await repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId)
    : [];
  const selectedEstimate = (await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId))
    .find((request) => request.status === "selected");
  if (selectedEstimate) {
    throw new OpsDomainError("CONFLICT", "This work order has a selected bid. Issue that vendor or reopen the bid decision before reassigning it.");
  }
  const statements: OpsStatement[] = [];
  if (prior) statements.push(
    { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)", params: ["superseded", input.organizationId, prior.id, input.workOrderId, "cancelled", "declined", "completed", "superseded"] },
    ...revokeServiceAuthorizationTokens(input.organizationId, priorIssuances.map((issuance) => issuance.id), now),
  );
  statements.push(insert("ops_work_order_assignments", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, kind: input.kind, vendor_id: input.vendorId, internal_membership_id: input.internalMembershipId, status, assigned_at: now, supersedes_assignment_id: prior?.id }), { sql: "UPDATE ops_work_orders SET next_action = ?, accountable_party = ? WHERE organization_id = ? AND id = ?", params: [input.kind === "choose_later" ? "Choose service provider" : "Issue service authorization", input.kind === "outside_vendor" ? "Facilities coordinator" : input.kind === "internal" ? "Internal maintenance" : "Facilities coordinator", input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.assigned", actor: input.actor, occurredAt: now, payload: { assignmentId: id, supersedesAssignmentId: prior?.id, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId }, ids }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, status, assignedAt: now };
}

export interface IssueWorkOrderInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; revision: number; channel: "email" | "sms" | "print" | "manual"; authorizationSnapshot: ServiceAuthorizationSnapshot; publicToken?: { tokenHash: string; expiresAt: IsoDateTime }; actor: ActorContext }
export async function issueWorkOrder(svc: OpsCommandServices, input: IssueWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const now = clock.now();
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId); const assignment = await repository.getAssignment(input.organizationId, input.assignmentId);
  if (!workOrder || !assignment || assignment.workOrderId !== input.workOrderId) throw new OpsDomainError("NOT_FOUND", "Work order assignment not found");
  if (!canRouteAndIssueWorkOrder(workOrder.status)) throw new OpsDomainError("CONFLICT", "Work is not eligible for issuance in its current state");
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new OpsDomainError("VALIDATION", "Issuance revision must be a positive integer");
  const activeAssignment = await repository.getActiveAssignment(input.organizationId, input.workOrderId);
  if (!activeAssignment || activeAssignment.id !== assignment.id) throw new OpsDomainError("CONFLICT", "Only the current active assignment can be issued");
  if (assignment.kind === "choose_later") throw new OpsDomainError("CONFLICT", "Choose a service provider before issuing work");
  const estimateRequests = await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId);
  assertNoOpenBidRequests(estimateRequests);
  const selectedEstimate = estimateRequests.find((request) => request.status === "selected");
  if (selectedEstimate && (assignment.kind !== "outside_vendor" || assignment.vendorId !== selectedEstimate.vendorId)) {
    throw new OpsDomainError("CONFLICT", "Only the vendor selected from the bid comparison can receive this service authorization.");
  }
  await assertSelectedEstimateIsCurrent(repository, selectedEstimate, now);
  const [latest, priorIssuances] = await Promise.all([
    repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
    repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId),
  ]);
  if (latest && input.revision !== latest.revision + 1) throw new OpsDomainError("CONFLICT", "Issuance revision must follow the latest immutable revision");
  if (!latest && input.revision !== 1) throw new OpsDomainError("CONFLICT", "First issuance revision must be 1");
  if (input.authorizationSnapshot.workOrderNumber !== workOrder.number || input.authorizationSnapshot.store.id !== workOrder.storeId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the work order");
  if (assignment.kind === "outside_vendor" && input.authorizationSnapshot.vendor.id !== assignment.vendorId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the assigned vendor");
  required(input.authorizationSnapshot.organizationName, "Authorization organization name");
  required(input.authorizationSnapshot.problem, "Authorization problem");
  required(input.authorizationSnapshot.billingInstruction, "Authorization billing instruction");
  const id = ids.next("issuance"); const payload = json(input.authorizationSnapshot);
  if (input.publicToken) {
    if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Only outside-vendor work uses a public authorization link");
    if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
    if (input.publicToken.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Authorization link expiry must be in the future");
  }
  const statements: OpsStatement[] = [
    ...revokeServiceAuthorizationTokens(input.organizationId, priorIssuances.map((issuance) => issuance.id), now),
    insert("ops_work_order_issuances", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, assignment_id: input.assignmentId, revision: input.revision, immutable_payload_json: payload, channel: input.channel, issued_at: now }),
    { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ?", params: ["issued", input.organizationId, input.assignmentId, input.workOrderId] },
    { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["issued", assignment.kind === "outside_vendor" ? "Outside vendor" : "Internal maintenance", "Acknowledge service authorization", input.organizationId, input.workOrderId] },
  ];
  if (input.publicToken) statements.push(insert("ops_public_tokens", { id: ids.next("public-token"), organization_id: input.organizationId, purpose: "service_authorization", subject_type: "work_order_issuance", subject_id: id, token_hash: input.publicToken.tokenHash, expires_at: input.publicToken.expiresAt, created_at: now }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.issued", actor: input.actor, occurredAt: now, payload: { issuanceId: id, assignmentId: input.assignmentId, revision: input.revision, channel: input.channel }, ids }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, assignmentId: input.assignmentId, revision: input.revision, immutablePayloadJson: payload, channel: input.channel, issuedAt: now };
}

export interface RouteAndIssueWorkOrderInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  expectedRevision: number;
  channel: "email" | "sms" | "print" | "manual";
  authorizationSnapshot: ServiceAuthorizationSnapshot;
  publicToken: { tokenHash: string; expiresAt: IsoDateTime };
  actor: ActorContext;
}

/**
 * Selects (or reuses) an outside vendor and creates the immutable authorization
 * in one transaction. This is the operator handoff boundary: a failed issuance
 * must never leave behind a new active assignment with no authorization.
 */
export async function routeAndIssueWorkOrder(
  svc: OpsCommandServices,
  input: RouteAndIssueWorkOrderInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const now = clock.now();
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (!canRouteAndIssueWorkOrder(workOrder.status)) throw new OpsDomainError("CONFLICT", "Work is not eligible for issuance in its current state");
  const [organization, vendor, store, asset] = await Promise.all([
    repository.getOrganization(input.organizationId),
    repository.getVendor(input.organizationId, input.vendorId),
    repository.getStore(input.organizationId, workOrder.storeId),
    workOrder.assetId ? repository.getAsset(input.organizationId, workOrder.assetId) : Promise.resolve(null),
  ]);
  if (!organization || !store) throw new OpsDomainError("NOT_FOUND", "Work-order organization or store not found");
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Approved outside vendor is required");
  if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, workOrder.storeId))) {
    throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new OpsDomainError("VALIDATION", "Expected issuance revision must be a non-negative integer");
  }
  const [latest, priorIssuances] = await Promise.all([
    repository.getLatestIssuanceForWorkOrder(input.organizationId, workOrder.id),
    repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
  ]);
  const currentRevision = latest?.revision ?? 0;
  if (input.expectedRevision !== currentRevision) {
    throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before issuing a new revision");
  }
  const activeAssignment = await repository.getActiveAssignment(input.organizationId, workOrder.id);
  const estimateRequests = await repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id);
  assertNoOpenBidRequests(estimateRequests);
  const selectedEstimate = estimateRequests.find((request) => request.status === "selected");
  if (selectedEstimate && selectedEstimate.vendorId !== vendor.id) {
    throw new OpsDomainError("CONFLICT", "Only the vendor selected from the bid comparison can receive this service authorization.");
  }
  await assertSelectedEstimateIsCurrent(repository, selectedEstimate, now);
  if (activeAssignment?.kind === "internal") {
    throw new OpsDomainError("CONFLICT", "Internal work must be reassigned before it can be issued to a vendor");
  }
  if (activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId !== vendor.id) {
    throw new OpsDomainError("CONFLICT", "Another vendor is already assigned. Record an explicit reassignment before issuing a different provider.");
  }
  const snapshot = input.authorizationSnapshot;
  const formattedAddress = [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", ");
  const snapshotNteMatches = snapshot.nte?.amountMinor === workOrder.nte?.amountMinor
    && snapshot.nte?.currency === workOrder.nte?.currency;
  if (
    snapshot.organizationName !== organization.name
    || snapshot.workOrderNumber !== workOrder.number
    || snapshot.store.id !== workOrder.storeId
    || snapshot.store.storeNumber !== store.storeNumber
    || snapshot.store.name !== store.name
    || snapshot.store.formattedAddress !== formattedAddress
    || snapshot.vendor.id !== vendor.id
    || snapshot.vendor.name !== vendor.name
    || snapshot.problem !== workOrder.problem
    || snapshot.priority !== workOrder.priority
    || snapshot.authorizedScope !== workOrder.authorizedScope
    || snapshot.categoryKey !== workOrder.categoryKey
    || snapshot.asset?.id !== workOrder.assetId
    || snapshot.asset?.name !== asset?.name
    || snapshot.asset?.assetTag !== asset?.assetTag
    || snapshot.requestedTiming !== workOrder.dueAt
    || !snapshotNteMatches
  ) {
    throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the current work order");
  }
  required(snapshot.organizationName, "Authorization organization name");
  required(snapshot.problem, "Authorization problem");
  required(snapshot.billingInstruction, "Authorization billing instruction");
  if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (input.publicToken.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Authorization link expiry must be in the future");

  const reuseAssignment = activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === vendor.id;
  const priorAssignment = activeAssignment ?? (latest ? await repository.getAssignment(input.organizationId, latest.assignmentId) : null);
  const assignmentId = reuseAssignment ? activeAssignment.id : ids.next("assignment");
  const issuanceId = ids.next("issuance");
  const revision = currentRevision + 1;
  const payload = json(snapshot);
  const statements: OpsStatement[] = [];
  if (!reuseAssignment) {
    if (activeAssignment) {
      statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)",
        params: ["superseded", input.organizationId, activeAssignment.id, workOrder.id, "cancelled", "declined", "completed", "superseded"],
      });
    }
    statements.push(
      insert("ops_work_order_assignments", {
        id: assignmentId,
        organization_id: input.organizationId,
        work_order_id: workOrder.id,
        kind: "outside_vendor",
        vendor_id: vendor.id,
        status: "pending",
        assigned_at: now,
        supersedes_assignment_id: priorAssignment?.id,
      }),
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: workOrder.id,
        eventType: "work_order.assigned",
        actor: input.actor,
        occurredAt: now,
        payload: {
          assignmentId,
          supersedesAssignmentId: priorAssignment?.id,
          kind: "outside_vendor",
          vendorId: vendor.id,
          issuedAtomically: true,
        },
        ids,
      }),
    );
  }
  statements.push(
    insert("ops_work_order_issuances", {
      id: issuanceId,
      organization_id: input.organizationId,
      work_order_id: workOrder.id,
      assignment_id: assignmentId,
      revision,
      immutable_payload_json: payload,
      channel: input.channel,
      issued_at: now,
    }),
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ?",
      params: ["issued", input.organizationId, assignmentId, workOrder.id],
    },
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", "Outside vendor", "Acknowledge service authorization", input.organizationId, workOrder.id],
    },
  );
  statements.push(...revokeServiceAuthorizationTokens(
    input.organizationId,
    priorIssuances.map((issuance) => issuance.id),
    now,
  ));
  statements.push(
    insert("ops_public_tokens", {
      id: ids.next("public-token"),
      organization_id: input.organizationId,
      purpose: "service_authorization",
      subject_type: "work_order_issuance",
      subject_id: issuanceId,
      token_hash: input.publicToken.tokenHash.toLowerCase(),
      expires_at: input.publicToken.expiresAt,
      created_at: now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "work_order",
      aggregateId: workOrder.id,
      eventType: "work_order.issued",
      actor: input.actor,
      occurredAt: now,
      payload: { issuanceId, assignmentId, revision, channel: input.channel, vendorId: vendor.id, supersedesIssuanceId: latest?.id },
      ids,
    }),
  );
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "This work order changed while the authorization was being created. Refresh and verify the selected provider.",
  });
  return {
    assignment: {
      id: assignmentId,
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      kind: "outside_vendor" as const,
      vendorId: vendor.id,
      status: "issued" as const,
      assignedAt: reuseAssignment ? activeAssignment.assignedAt : now,
      supersedesAssignmentId: reuseAssignment ? activeAssignment.supersedesAssignmentId : priorAssignment?.id,
    },
    issuance: {
      id: issuanceId,
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      assignmentId,
      revision,
      immutablePayloadJson: payload,
      channel: input.channel,
      issuedAt: now,
    },
  };
}

export interface RecordVendorResponseInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; issuanceId: OpsId; response: VendorResponseKind; responderName: string; proposedAt?: IsoDateTime; message?: string; actor: ActorContext }

export interface MarkServiceAuthorizationOpenedInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  assignmentId: OpsId;
  issuanceId: OpsId;
  actor: ActorContext;
}

export async function markServiceAuthorizationOpened(
  svc: OpsCommandServices,
  input: MarkServiceAuthorizationOpenedInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [workOrder, assignment, issuance, activeAssignment, latestIssuance] = await Promise.all([
    repository.getWorkOrder(input.organizationId, input.workOrderId),
    repository.getAssignment(input.organizationId, input.assignmentId),
    repository.getIssuance(input.organizationId, input.issuanceId),
    repository.getActiveAssignment(input.organizationId, input.workOrderId),
    repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
  ]);
  if (
    !workOrder ||
    !assignment ||
    !issuance ||
    assignment.kind !== "outside_vendor" ||
    assignment.workOrderId !== input.workOrderId ||
    issuance.workOrderId !== input.workOrderId ||
    issuance.assignmentId !== assignment.id
  ) throw new OpsDomainError("NOT_FOUND", "Service authorization was not found");
  if (activeAssignment?.id !== assignment.id || latestIssuance?.id !== issuance.id) {
    throw new OpsDomainError("CONFLICT", "This service authorization has been superseded");
  }
  if (assignment.status !== "issued") return { assignment, changed: false };
  const openedAt = clock.now();
  try {
    await atomicWorkOrderMutation({ repository, workOrder, now: openedAt, statements: [
      {
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status = ?",
        params: ["opened", input.organizationId, assignment.id, input.workOrderId, "issued"],
      },
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: input.workOrderId,
        eventType: "service_authorization.opened",
        actor: input.actor,
        occurredAt: openedAt,
        payload: { assignmentId: assignment.id, issuanceId: issuance.id, revision: issuance.revision },
        ids,
      }),
    ] });
  } catch (error) {
    if (error instanceof OpsDomainError && error.code === "CONFLICT") {
      const [currentAssignment, currentActiveAssignment, currentLatestIssuance] = await Promise.all([
        repository.getAssignment(input.organizationId, input.assignmentId),
        repository.getActiveAssignment(input.organizationId, input.workOrderId),
        repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
      ]);
      if (
        currentAssignment?.status === "opened"
        && currentAssignment.workOrderId === input.workOrderId
        && currentActiveAssignment?.id === currentAssignment.id
        && currentLatestIssuance?.id === input.issuanceId
        && currentLatestIssuance.assignmentId === currentAssignment.id
      ) return { assignment: currentAssignment, changed: false };
    }
    throw error;
  }
  return { assignment: { ...assignment, status: "opened" as const }, changed: true, openedAt };
}

export async function recordVendorResponse(svc: OpsCommandServices, input: RecordVendorResponseInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const assignment = await repository.getAssignment(input.organizationId, input.assignmentId);
  const issuance = await repository.getIssuance(input.organizationId, input.issuanceId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder || !assignment || !issuance || assignment.workOrderId !== input.workOrderId || issuance.assignmentId !== assignment.id) {
    throw new OpsDomainError("NOT_FOUND", "Issued vendor assignment not found");
  }
  if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Vendor responses apply only to outside-vendor assignments");
  if (["accepted", "declined", "completed", "cancelled", "superseded"].includes(assignment.status)) throw new OpsDomainError("CONFLICT", "Assignment no longer accepts vendor responses");
  if (vendorResponseClosedWorkStatuses.has(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "Vendor response is closed because onsite work or follow-up has already started");
  }
  const workDetail = await repository.getWorkOrderDetail({ organizationId: input.organizationId }, input.workOrderId);
  if (workDetail?.visits.some((visit) => visit.status === "active")) {
    throw new OpsDomainError("CONFLICT", "Finish the active onsite visit before changing the service-authorization response");
  }
  const latestIssuance = await repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId);
  if (!latestIssuance || latestIssuance.id !== issuance.id) throw new OpsDomainError("CONFLICT", "Response link is for a superseded issuance revision");
  const priorResponse = await repository.getLatestVendorResponseForIssuance(input.organizationId, input.issuanceId);
  if (priorResponse && ["accepted", "declined"].includes(priorResponse.response)) throw new OpsDomainError("CONFLICT", "Assignment already has a terminal vendor response");
  if (input.response === "proposed_date" && !input.proposedAt) throw new OpsDomainError("VALIDATION", "Proposed date is required");
  const now = clock.now();
  const id = ids.next("vendor-response");
  const assignmentStatus = input.response === "accepted" ? "accepted" : input.response === "declined" ? "declined" : assignment.status;
  const workStatus = input.response === "accepted" ? "accepted" : input.response === "declined" ? "approved" : "issued";
  const facilitiesOwnsNext = ["declined", "proposed_date", "question"].includes(input.response);
  const nextAction = input.response === "declined" ? "Select another provider" : input.response === "proposed_date" ? "Review proposed service date" : input.response === "question" ? "Answer vendor question" : "Complete onsite service";
  const selectedEstimate = input.response === "declined"
    ? (await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId))
        .find((request) => request.status === "selected" && request.vendorId === assignment.vendorId)
    : undefined;
  const serviceAuthorizationIssuances = input.response === "declined"
    ? await repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId)
    : [];
  const statements: OpsStatement[] = [
    insert("ops_vendor_responses", {
      id,
      organization_id: input.organizationId,
      work_order_id: input.workOrderId,
      assignment_id: input.assignmentId,
      issuance_id: input.issuanceId,
      response: input.response,
      responder_name: required(input.responderName, "Responder name"),
      proposed_at: input.proposedAt,
      message: input.message,
      responded_at: now,
    }),
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: [assignmentStatus, input.organizationId, input.assignmentId],
    },
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?",
      params: [workStatus, facilitiesOwnsNext ? "Facilities coordinator" : "Outside vendor", nextAction, input.organizationId, input.workOrderId],
    },
  ];
  if (selectedEstimate) {
    statements.push(
      {
        sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
        params: ["not_selected", now, input.organizationId, selectedEstimate.id, "selected"],
      },
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order_estimate_request",
        aggregateId: selectedEstimate.id,
        eventType: "work_order_estimate.selection_reopened",
        actor: input.actor,
        occurredAt: now,
        payload: {
          workOrderId: input.workOrderId,
          vendorId: assignment.vendorId,
          reason: "selected_vendor_declined_service_authorization",
          responseId: id,
        },
        ids,
      }),
    );
  }
  if (input.response === "declined") {
    statements.push(...revokeServiceAuthorizationTokens(
      input.organizationId,
      serviceAuthorizationIssuances.map((item) => item.id),
      now,
    ));
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId,
    aggregateType: "work_order",
    aggregateId: input.workOrderId,
    eventType: `vendor.${input.response}`,
    actor: input.actor,
    occurredAt: now,
    payload: {
      responseId: id,
      assignmentId: input.assignmentId,
      issuanceId: input.issuanceId,
      revision: issuance.revision,
      proposedAt: input.proposedAt,
      message: input.message,
      reopenedEstimateRequestId: selectedEstimate?.id,
    },
    ids,
  }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
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
  let linkedWorkOrder: WorkOrder | null = null;
  if (input.workOrderId) {
    linkedWorkOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
    if (!linkedWorkOrder || linkedWorkOrder.storeId !== input.storeId) throw new OpsDomainError("NOT_FOUND", "Work order is not eligible at this store");
    if (["completed_pending_review", "closed", "cancelled"].includes(linkedWorkOrder.status)) throw new OpsDomainError("CONFLICT", "Completed, closed, or cancelled work cannot receive a new visit without an explicit reopen decision");
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
  return { repository, ids, now, statements, visit, linkedWorkOrder };
}

export async function checkInVisit(svc: OpsCommandServices, input: CheckInVisitInput) {
  const prepared = await prepareCheckInVisit(svc, input);
  if (prepared.linkedWorkOrder) {
    await atomicWorkOrderMutation({ repository: prepared.repository, workOrder: prepared.linkedWorkOrder, now: prepared.now, statements: prepared.statements });
  } else {
    await prepared.repository.atomicWrite(prepared.statements);
  }
  return prepared.visit;
}

export interface CheckInVisitWithCheckoutTokenInput extends CheckInVisitInput {
  checkoutToken: { tokenHash: string; expiresAt: IsoDateTime };
  idempotency?: CommandIdempotency;
}

export async function checkInVisitWithCheckoutToken(
  svc: OpsCommandServices,
  input: CheckInVisitWithCheckoutTokenInput,
) {
  const prepared = await prepareCheckInVisit(svc, input);
  if (!/^[a-f0-9]{64}$/i.test(input.checkoutToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (input.checkoutToken.expiresAt <= prepared.now) throw new OpsDomainError("VALIDATION", "Checkout token expiry must be in the future");
  const tokenId = prepared.ids.next("public-token");
  if (input.idempotency) {
    prepared.statements.unshift(idempotencyStatement(input.organizationId, prepared.visit.id, prepared.now, input.idempotency));
  }
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
  if (prepared.linkedWorkOrder) {
    await atomicWorkOrderMutation({ repository: prepared.repository, workOrder: prepared.linkedWorkOrder, now: prepared.now, statements: prepared.statements });
  } else {
    await prepared.repository.atomicWrite(prepared.statements);
  }
  return { visit: prepared.visit, tokenId, expiresAt: input.checkoutToken.expiresAt };
}

const unresolvedOutcomes = new Set<VisitOutcome>(["temporary_repair", "diagnosed_waiting_parts", "return_required", "unable_to_complete", "unable_to_reproduce"]);
export interface CheckOutVisitInput { organizationId: OpsId; visitId: OpsId; channel: VisitChannel; outcome: VisitOutcome; outcomeNotes?: string; location: LocationObservation; followUp?: { accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string }; idempotency?: CommandIdempotency; actor: ActorContext }
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
  const workOrder = visit.workOrderId
    ? await repository.getWorkOrder(input.organizationId, visit.workOrderId)
    : null;
  if (visit.workOrderId && !workOrder) throw new OpsDomainError("NOT_FOUND", "Visit work order not found");
  const statements: OpsStatement[] = [{ sql: "UPDATE ops_visit_sessions SET status = ?, ended_channel = ?, checked_out_at = ?, outcome = ?, outcome_notes = ?, observed_duration_seconds = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["checked_out", input.channel, now, input.outcome, input.outcomeNotes ?? null, observedDurationSeconds, input.organizationId, input.visitId, "active"] }, insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.visitId, kind: "check_out", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes }) })];
  let followUpId: OpsId | undefined;
  if (input.followUp && visit.workOrderId) { followUpId = ids.next("follow-up"); statements.push(insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: visit.workOrderId, source_visit_id: visit.id, accountable_party: required(input.followUp.accountableParty, "Follow-up accountable party"), next_action: required(input.followUp.nextAction, "Follow-up next action"), due_at: input.followUp.dueAt, escalation_to: required(input.followUp.escalationTo, "Follow-up escalation"), status: "open", created_at: now }), { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [input.outcome === "diagnosed_waiting_parts" ? "waiting_on_parts" : "waiting_on_vendor", input.followUp.accountableParty, input.followUp.nextAction, input.followUp.dueAt, input.followUp.escalationTo, input.organizationId, visit.workOrderId] }); }
  else if (visit.workOrderId) statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["completed_pending_review", "Facilities coordinator", "Review completed service", input.organizationId, visit.workOrderId] });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actor: input.actor, occurredAt: now, payload: { workOrderId: visit.workOrderId, outcome: input.outcome, channel: input.channel, observedDurationSeconds, followUpId, durationMeaning: "approximate_presence_not_labor" }, ids }));
  if (input.idempotency) statements.unshift(idempotencyStatement(input.organizationId, visit.id, now, input.idempotency));
  if (workOrder) await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  else await repository.atomicWrite(statements);
  return { ...visit, status: "checked_out" as const, endedChannel: input.channel, checkedOutAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes, observedDurationSeconds, followUpId };
}

export interface CreateFollowUpInput { organizationId: OpsId; workOrderId: OpsId; sourceVisitId?: OpsId; accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string; actor: ActorContext }
export async function createFollowUp(svc: OpsCommandServices, input: CreateFollowUpInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot receive a follow-up");
  if (input.sourceVisitId && !(await repository.getVisit(input.organizationId, input.sourceVisitId))) throw new OpsDomainError("NOT_FOUND", "Source visit not found");
  const now = clock.now(); const id = ids.next("follow-up");
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [insert("ops_follow_ups", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, source_visit_id: input.sourceVisitId, accountable_party: required(input.accountableParty, "Accountable party"), next_action: required(input.nextAction, "Next action"), due_at: input.dueAt, escalation_to: required(input.escalationTo, "Escalation"), status: "open", created_at: now }), { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [input.accountableParty, input.nextAction, input.dueAt, input.escalationTo, input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "follow_up.created", actor: input.actor, occurredAt: now, payload: { followUpId: id, sourceVisitId: input.sourceVisitId, dueAt: input.dueAt }, ids })] });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, sourceVisitId: input.sourceVisitId, accountableParty: input.accountableParty.trim(), nextAction: input.nextAction.trim(), dueAt: input.dueAt, escalationTo: input.escalationTo.trim(), status: "open" as const, createdAt: now };
}

export interface ReviewServiceRequestInput {
  organizationId: OpsId;
  requestId: OpsId;
  expectedStatus: "submitted" | "under_review";
  decision: "start_review" | "escalate" | "close";
  note?: string;
  actor: ActorContext;
}

export async function reviewServiceRequest(svc: OpsCommandServices, input: ReviewServiceRequestInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const request = await repository.getRequest(input.organizationId, input.requestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Service request not found");
  if (request.status !== input.expectedStatus) throw new OpsDomainError("CONFLICT", "This request changed. Refresh before recording another decision");
  if (request.convertedWorkOrderId) throw new OpsDomainError("CONFLICT", "The request already has a canonical work order");
  if (input.decision === "start_review" && request.status !== "submitted") throw new OpsDomainError("CONFLICT", "Review has already started");
  const note = input.note?.trim();
  if ((input.decision === "close" || input.decision === "escalate") && !note) {
    throw new OpsDomainError("VALIDATION", "A reason is required for this review decision");
  }
  const now = clock.now();
  const nextStatus = input.decision === "close" ? "closed" : "under_review";
  const eventType = input.decision === "start_review"
    ? "request.review_started"
    : input.decision === "escalate"
      ? "request.escalated"
      : "request.closed";
  await repository.atomicWrite([
    {
      sql: "UPDATE ops_requests SET status = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: [nextStatus, input.organizationId, request.id, input.expectedStatus],
    },
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "request",
      aggregateId: request.id,
      eventType,
      actor: input.actor,
      occurredAt: now,
      payload: { previousStatus: request.status, status: nextStatus, note },
      ids,
    }),
  ]);
  return { ...request, status: nextStatus, reviewDecision: input.decision, reviewedAt: now, note };
}

export interface UpdateWorkOrderControlInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  expectedStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  priority?: WorkOrderPriority;
  accountableParty?: string;
  nextAction?: string;
  dueAt?: IsoDateTime;
  escalationTo?: string;
  note: string;
  actor: ActorContext;
}

export async function updateWorkOrderControl(svc: OpsCommandServices, input: UpdateWorkOrderControlInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (workOrder.status !== input.expectedStatus) throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before recording another update");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work orders cannot be edited");
  if (input.status !== workOrder.status && !allowedWorkOrderControlTransitions(workOrder.status).includes(input.status)) {
    throw new OpsDomainError("CONFLICT", `Work cannot move directly from ${workOrder.status} to ${input.status}`);
  }
  const note = required(input.note, "Update note");
  const now = clock.now();
  const terminal = terminalWorkOrderStatuses.has(input.status);
  let estimateRequestsToRetire: WorkOrderEstimateRequest[] = [];
  let serviceAuthorizationIssuanceIds: OpsId[] = [];
  const priority = input.priority ?? workOrder.priority;
  let accountableParty: string;
  let nextAction: string;
  let dueAt: IsoDateTime | null;
  let escalationTo: string | null;
  if (terminal) {
    const [detail, estimateRequests, serviceAuthorizations] = await Promise.all([
      repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
      repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id),
      repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
    ]);
    if (detail?.visits.some((visit) => visit.status === "active")) {
      throw new OpsDomainError("CONFLICT", "Finish the active visit before closing or cancelling this work order");
    }
    if (detail?.followUps.some((followUp) => followUp.status === "open")) {
      throw new OpsDomainError("CONFLICT", "Complete or cancel open follow-ups before closing or cancelling this work order");
    }
    estimateRequestsToRetire = estimateRequests.filter((request) => (
      ["requested", "opened", "submitted"].includes(request.status)
      || (input.status === "cancelled" && request.status === "selected")
    ));
    serviceAuthorizationIssuanceIds = serviceAuthorizations.map((issuance) => issuance.id);
    accountableParty = "No active owner";
    nextAction = "No further action";
    dueAt = null;
    escalationTo = null;
  } else {
    accountableParty = required(input.accountableParty ?? workOrder.accountableParty, "Accountable party");
    nextAction = required(input.nextAction ?? workOrder.nextAction, "Next action");
    dueAt = input.dueAt ?? workOrder.dueAt ?? defaultWorkOrderDueAt(priority, now);
    escalationTo = required(input.escalationTo ?? workOrder.escalationTo ?? "Facilities director", "Escalation destination");
    if (!Number.isFinite(Date.parse(dueAt))) throw new OpsDomainError("VALIDATION", "Due date is invalid");
  }
  const closedAt = terminal ? now : null;
  const eventType = input.status !== workOrder.status
    ? input.status === "closed"
      ? "work_order.closed"
      : input.status === "cancelled"
        ? "work_order.cancelled"
        : "work_order.status_changed"
    : "work_order.control_updated";
  const statements: OpsStatement[] = [{
    sql: "UPDATE ops_work_orders SET status = ?, priority = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ?, closed_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
    params: [input.status, priority, accountableParty, nextAction, dueAt, escalationTo, closedAt, input.organizationId, workOrder.id, input.expectedStatus],
  }];
  if (terminal) {
    statements.push(...revokeServiceAuthorizationTokens(
      input.organizationId,
      serviceAuthorizationIssuanceIds,
      now,
    ));
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)",
      params: [input.status === "closed" ? "completed" : "cancelled", input.organizationId, workOrder.id, "cancelled", "declined", "completed", "superseded"],
    });
    for (const estimateRequest of estimateRequestsToRetire) {
      const nextEstimateStatus = estimateRequest.status === "selected" ? "not_selected" : "withdrawn";
      statements.push(
        {
          sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
          params: [nextEstimateStatus, now, input.organizationId, estimateRequest.id, estimateRequest.status],
        },
        {
          sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
          params: [now, input.organizationId, "vendor_estimate", "work_order_estimate_request", estimateRequest.id],
        },
        ...auditAndOutbox({
          organizationId: input.organizationId,
          aggregateType: "work_order_estimate_request",
          aggregateId: estimateRequest.id,
          eventType: "work_order_estimate.retired_with_work_order",
          actor: input.actor,
          occurredAt: now,
          payload: {
            workOrderId: workOrder.id,
            previousStatus: estimateRequest.status,
            status: nextEstimateStatus,
            terminalWorkOrderStatus: input.status,
          },
          ids,
        }),
      );
    }
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId,
    aggregateType: "work_order",
    aggregateId: workOrder.id,
    eventType,
    actor: input.actor,
    occurredAt: now,
    payload: {
      note,
      previous: {
        status: workOrder.status,
        priority: workOrder.priority,
        accountableParty: workOrder.accountableParty,
        nextAction: workOrder.nextAction,
        dueAt: workOrder.dueAt,
        escalationTo: workOrder.escalationTo,
      },
      current: { status: input.status, priority, accountableParty, nextAction, dueAt, escalationTo },
    },
    ids,
  }));
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
  });
  return { ...workOrder, status: input.status, priority, accountableParty, nextAction, dueAt: dueAt ?? undefined, escalationTo: escalationTo ?? undefined, closedAt: closedAt ?? undefined, updatedAt: now };
}

export interface RescheduleFollowUpInput {
  organizationId: OpsId;
  followUpId: OpsId;
  accountableParty: string;
  nextAction: string;
  dueAt: IsoDateTime;
  escalationTo: string;
  note: string;
  actor: ActorContext;
}

export async function rescheduleFollowUp(svc: OpsCommandServices, input: RescheduleFollowUpInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const followUp = await repository.getFollowUp(input.organizationId, input.followUpId);
  if (!followUp) throw new OpsDomainError("NOT_FOUND", "Follow-up not found");
  if (followUp.status !== "open") throw new OpsDomainError("CONFLICT", "Only an open follow-up can be updated");
  const workOrder = await repository.getWorkOrder(input.organizationId, followUp.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Linked work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot receive a follow-up update");
  if (!Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Follow-up due date is invalid");
  const accountableParty = required(input.accountableParty, "Accountable party");
  const nextAction = required(input.nextAction, "Next action");
  const escalationTo = required(input.escalationTo, "Escalation destination");
  const note = required(input.note, "Update note");
  const now = clock.now();
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    { sql: "UPDATE ops_follow_ups SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [accountableParty, nextAction, input.dueAt, escalationTo, input.organizationId, followUp.id, "open"] },
    { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [accountableParty, nextAction, input.dueAt, escalationTo, input.organizationId, followUp.workOrderId] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: followUp.workOrderId, eventType: "follow_up.updated", actor: input.actor, occurredAt: now, payload: { followUpId: followUp.id, note, previous: { accountableParty: followUp.accountableParty, nextAction: followUp.nextAction, dueAt: followUp.dueAt, escalationTo: followUp.escalationTo }, current: { accountableParty, nextAction, dueAt: input.dueAt, escalationTo } }, ids }),
  ] });
  return { ...followUp, accountableParty, nextAction, dueAt: input.dueAt, escalationTo, updatedAt: now };
}

export interface CompleteFollowUpInput {
  organizationId: OpsId;
  followUpId: OpsId;
  resolution: string;
  actor: ActorContext;
}

export async function completeFollowUp(svc: OpsCommandServices, input: CompleteFollowUpInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const followUp = await repository.getFollowUp(input.organizationId, input.followUpId);
  if (!followUp) throw new OpsDomainError("NOT_FOUND", "Follow-up not found");
  if (followUp.status !== "open") throw new OpsDomainError("CONFLICT", "Follow-up is already complete or cancelled");
  const workOrder = await repository.getWorkOrder(input.organizationId, followUp.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Linked work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed work cannot receive a follow-up completion");
  const resolution = required(input.resolution, "Completion note");
  const detail = await repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id);
  const remaining = (detail?.followUps ?? [])
    .filter((candidate) => candidate.id !== followUp.id && candidate.status === "open")
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const next = remaining[0];
  const now = clock.now();
  const nextProjection = next
    ? { status: workOrder.status, accountableParty: next.accountableParty, nextAction: next.nextAction, dueAt: next.dueAt, escalationTo: workOrder.escalationTo ?? "Facilities director" }
    : { status: "completed_pending_review" as const, accountableParty: "Facilities coordinator", nextAction: "Review completed service and close", dueAt: addHours(now, 24), escalationTo: "Facilities director" };
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    { sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", now, input.organizationId, followUp.id, "open"] },
    { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [nextProjection.status, nextProjection.accountableParty, nextProjection.nextAction, nextProjection.dueAt, nextProjection.escalationTo, input.organizationId, workOrder.id] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "follow_up.completed", actor: input.actor, occurredAt: now, payload: { followUpId: followUp.id, resolution, remainingOpenFollowUps: remaining.length, nextProjection }, ids }),
  ] });
  return { ...followUp, status: "completed" as const, completedAt: now, resolution, nextProjection };
}

export interface ReviewExceptionInput {
  organizationId: OpsId;
  exceptionId: OpsId;
  decision: "acknowledge" | "resolve";
  note: string;
  actor: ActorContext;
}

export async function reviewException(svc: OpsCommandServices, input: ReviewExceptionInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const exception = await repository.getException(input.organizationId, input.exceptionId);
  if (!exception) throw new OpsDomainError("NOT_FOUND", "Review item not found");
  if (exception.status === "resolved") throw new OpsDomainError("CONFLICT", "This review item is already resolved");
  const note = required(input.note, "Review note");
  const now = clock.now();
  const status = input.decision === "resolve" ? "resolved" : "acknowledged";
  await repository.atomicWrite([
    { sql: "UPDATE ops_exceptions SET status = ?, resolved_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [status, status === "resolved" ? now : null, input.organizationId, exception.id, exception.status] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "exception", aggregateId: exception.id, eventType: status === "resolved" ? "exception.resolved" : "exception.acknowledged", actor: input.actor, occurredAt: now, payload: { note, kind: exception.kind, storeId: exception.storeId, workOrderId: exception.workOrderId, visitId: exception.visitId }, ids }),
  ]);
  return { ...exception, status, resolvedAt: status === "resolved" ? now : undefined, note };
}

export interface ReconcileUnmatchedVisitInput {
  organizationId: OpsId;
  exceptionId: OpsId;
  workOrderId: OpsId;
  note: string;
  actor: ActorContext;
}

export async function reconcileUnmatchedVisit(svc: OpsCommandServices, input: ReconcileUnmatchedVisitInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const exception = await repository.getException(input.organizationId, input.exceptionId);
  if (!exception || exception.kind !== "no_work_order" || !exception.visitId) throw new OpsDomainError("NOT_FOUND", "Unmatched visit review item not found");
  if (exception.status === "resolved") throw new OpsDomainError("CONFLICT", "This unmatched visit is already resolved");
  const visit = await repository.getVisit(input.organizationId, exception.visitId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!visit || !workOrder || visit.storeId !== workOrder.storeId) throw new OpsDomainError("VALIDATION", "Choose open work for the same store as this visit");
  if (visit.workOrderId) throw new OpsDomainError("CONFLICT", "This visit is already linked to a work order");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "A visit cannot be linked to closed or cancelled work");
  const assignment = await repository.getActiveAssignment(input.organizationId, workOrder.id);
  if (visit.vendorId && assignment?.kind === "outside_vendor" && assignment.vendorId !== visit.vendorId) {
    throw new OpsDomainError("CONFLICT", "The visit vendor does not match the active work-order assignment");
  }
  const note = required(input.note, "Reconciliation note");
  const now = clock.now();
  const statements: OpsStatement[] = [
    { sql: "UPDATE ops_visit_sessions SET work_order_id = ? WHERE organization_id = ? AND id = ? AND work_order_id IS NULL", params: [workOrder.id, input.organizationId, visit.id] },
    { sql: "UPDATE ops_exceptions SET status = ?, work_order_id = ?, resolved_at = ? WHERE organization_id = ? AND id = ?", params: ["resolved", workOrder.id, now, input.organizationId, exception.id] },
    insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: visit.id, kind: "amendment", channel: visit.endedChannel ?? visit.startedChannel, observed_at: now, payload_json: json({ amendment: "linked_to_work_order", workOrderId: workOrder.id, workOrderNumber: workOrder.number, originalUnmatchedReason: visit.unmatchedReason, note }) }),
  ];
  let followUpId: OpsId | undefined;
  if (visit.status === "active") {
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", visit.providerName, "Record service outcome", workOrder.dueAt ?? addHours(now, 8), workOrder.escalationTo ?? "Facilities director", input.organizationId, workOrder.id] });
  } else if (visit.outcome && unresolvedOutcomes.has(visit.outcome)) {
    followUpId = ids.next("follow-up");
    const waitingStatus = visit.outcome === "diagnosed_waiting_parts" ? "waiting_on_parts" : "waiting_on_vendor";
    const nextAction = visit.outcome === "diagnosed_waiting_parts" ? "Confirm parts and return date" : "Coordinate required follow-up service";
    const dueAt = addHours(now, 48);
    statements.push(
      insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: workOrder.id, source_visit_id: visit.id, accountable_party: "Facilities coordinator", next_action: nextAction, due_at: dueAt, escalation_to: "Facilities director", status: "open", created_at: now }),
      { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [waitingStatus, "Facilities coordinator", nextAction, dueAt, "Facilities director", input.organizationId, workOrder.id] },
    );
  } else {
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: ["completed_pending_review", "Facilities coordinator", "Review completed service and close", addHours(now, 24), "Facilities director", input.organizationId, workOrder.id] });
  }
  statements.push(
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.reconciled", actor: input.actor, occurredAt: now, payload: { exceptionId: exception.id, workOrderId: workOrder.id, workOrderNumber: workOrder.number, note, followUpId }, ids }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.visit_reconciled", actor: input.actor, occurredAt: now, payload: { exceptionId: exception.id, visitId: visit.id, note, followUpId }, ids }),
  );
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { visitId: visit.id, exceptionId: exception.id, workOrderId: workOrder.id, workOrderNumber: workOrder.number, followUpId, reconciledAt: now };
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
