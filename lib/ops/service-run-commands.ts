import { atomicWorkOrderSetMutation } from "./concurrency";
import { OpsDomainError } from "./errors";
import { heldWorkVendorEligibility } from "./held-work-policy";
import type { OpsRepository, OpsStatement } from "./repository";
import type { OpsClock, OpsCommandServices, OpsIdSource } from "./commands";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
  isOpenWorkflowTask,
} from "./workflow-task-commands";
import type {
  ActorContext,
  ContractScope,
  ContractVersion,
  IsoDateTime,
  Money,
  OpsId,
  PmOccurrence,
  RouteStop,
  SchedulingMode,
  ServiceRun,
  ServiceRunResponse,
  ServiceRunResponseKind,
  ServiceRunWorkOrder,
  Store,
  VendorCapacity,
  VendorQualification,
  WorkOrder,
  WorkflowTask,
} from "./types";

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const terminalWorkOrderStatuses = new Set(["closed", "cancelled"]);
const schedulableWorkOrderStatuses = new Set([
  "approved", "issued", "accepted", "scheduled", "waiting_on_vendor", "waiting_on_parts",
]);
const internalSchedulerRoles = new Set(["executive", "facilities_admin", "regional_manager"]);
const responseKinds = new Set<ServiceRunResponseKind>([
  "accepted", "countered", "stop_change_requested", "work_order_change_requested",
  "insufficient_capacity", "declined",
]);

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function instant(value: IsoDateTime, label: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
  return timestamp;
}

function nonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) throw new OpsDomainError("VALIDATION", `${label} must be a non-negative integer`);
  return value;
}

function positiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new OpsDomainError("VALIDATION", `${label} must be a positive integer`);
  return value;
}

function addMinutes(value: IsoDateTime, minutes: number): IsoDateTime {
  return new Date(instant(value, "Schedule time") + minutes * 60_000).toISOString();
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([column]) => column).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
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
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"), organization_id: input.organizationId,
      aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
      event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId,
      actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"), organization_id: input.organizationId,
      topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
      payload_json: payloadJson, status: "pending", available_at: input.occurredAt,
      created_at: input.occurredAt, attempt_count: 0,
    }),
  ];
}

async function assertSchedulerActor(input: {
  repository: OpsRepository;
  actor: ActorContext;
  organizationId: OpsId;
  stores: readonly Store[];
}) {
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) {
    throw new OpsDomainError("FORBIDDEN", "An authenticated scheduler membership is required");
  }
  const membership = await input.repository.getMembership(input.organizationId, input.actor.actorId);
  if (!membership || membership.status !== "active" || !internalSchedulerRoles.has(membership.role)) {
    throw new OpsDomainError("FORBIDDEN", "Facilities, regional manager, or executive access is required");
  }
  if (membership.role !== "regional_manager") return membership;
  const grants = await input.repository.listScopeGrantsForMembership(input.organizationId, membership.id);
  const authorized = input.stores.every((store) => grants.some((grant) =>
    grant.scopeKind === "organization" && grant.scopeId === input.organizationId
    || grant.scopeKind === "region" && grant.scopeId === store.regionId
    || grant.scopeKind === "store" && grant.scopeId === store.id));
  if (!authorized) throw new OpsDomainError("FORBIDDEN", "The scheduler membership does not cover every selected store");
  return membership;
}

function scopeMatches(scope: ContractScope, input: { organizationId: OpsId; store: Store; tradeKey: string; programId?: OpsId }) {
  if (scope.scopeKind === "organization") return scope.scopeId === input.organizationId;
  if (scope.scopeKind === "region") return scope.scopeId === input.store.regionId;
  if (scope.scopeKind === "store") return scope.scopeId === input.store.id;
  if (scope.scopeKind === "trade") return scope.scopeId === input.tradeKey;
  if (scope.scopeKind === "asset_type") return scope.scopeId === input.tradeKey;
  return scope.scopeKind === "pm_program" && scope.scopeId === input.programId;
}

function assertContractScope(input: {
  scopes: readonly ContractScope[];
  organizationId: OpsId;
  store: Store;
  tradeKey: string;
  programId?: OpsId;
}) {
  const locationScopes = input.scopes.filter((scope) => ["organization", "region", "store"].includes(scope.scopeKind));
  const workScopes = input.scopes.filter((scope) => ["trade", "asset_type"].includes(scope.scopeKind));
  const programScopes = input.scopes.filter((scope) => scope.scopeKind === "pm_program");
  const matching = (scope: ContractScope) => scopeMatches(scope, input);
  if (input.scopes.some((scope) => !scope.included && matching(scope))) {
    throw new OpsDomainError("CONFLICT", `Contract explicitly excludes ${input.store.name} or ${input.tradeKey}`);
  }
  if (!locationScopes.some((scope) => scope.included && matching(scope))) {
    throw new OpsDomainError("CONFLICT", `Contract does not include ${input.store.name}`);
  }
  if (workScopes.length && !workScopes.some((scope) => scope.included && matching(scope))) {
    throw new OpsDomainError("CONFLICT", `Contract does not include ${input.tradeKey} work`);
  }
  if (input.programId && programScopes.length && !programScopes.some((scope) => scope.included && matching(scope))) {
    throw new OpsDomainError("CONFLICT", "Contract does not include the selected PM Program");
  }
}

function qualificationMatches(input: {
  qualification: VendorQualification;
  tradeKey: string;
  store: Store;
  occurrence?: PmOccurrence;
  priority: WorkOrder["priority"];
  manufacturerAuthorization?: string;
  proposedEndsAt: IsoDateTime;
  expectedWorkValueMinor: number;
}) {
  const qualification = input.qualification;
  if (qualification.status !== "active" || qualification.tradeKey !== input.tradeKey) return false;
  if (qualification.expiresAt && instant(qualification.expiresAt, "Qualification expiry") < instant(input.proposedEndsAt, "Run end")) return false;
  if (qualification.regionId && qualification.regionId !== input.store.regionId) return false;
  if (qualification.storeId && qualification.storeId !== input.store.id) return false;
  if (input.occurrence && !qualification.pmWork) return false;
  if (input.priority === "emergency" && !qualification.emergencyResponse) return false;
  if (input.manufacturerAuthorization && qualification.manufacturerAuthorization !== input.manufacturerAuthorization) return false;
  if (qualification.maximumJobAmount && qualification.maximumJobAmount.amountMinor < input.expectedWorkValueMinor) return false;
  return true;
}

function latestByDocumentType<T extends { documentType: string; createdAt: IsoDateTime }>(rows: readonly T[]) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.documentType);
    if (!current || current.createdAt < row.createdAt) latest.set(row.documentType, row);
  }
  return latest;
}

function assertCompliance(input: {
  documents: Awaited<ReturnType<OpsRepository["listVendorComplianceDocuments"]>>;
  contract: ContractVersion;
  proposedEndsAt: IsoDateTime;
}) {
  const latest = latestByDocumentType(input.documents);
  for (const requirement of input.contract.complianceRequirements) {
    const document = latest.get(requirement);
    if (!document || document.reviewStatus !== "approved" || (document.expiresAt && document.expiresAt < input.proposedEndsAt)) {
      throw new OpsDomainError("CONFLICT", `Current approved vendor ${requirement} evidence is required`);
    }
  }
  for (const document of latest.values()) {
    if (!document.blocking) continue;
    if (document.reviewStatus !== "approved" || (document.expiresAt && document.expiresAt < input.proposedEndsAt)) {
      throw new OpsDomainError("CONFLICT", `Blocking vendor ${document.documentType} compliance prevents this commitment`);
    }
  }
}

function capacityFor(input: {
  rows: readonly VendorCapacity[];
  regionId: OpsId;
  tradeKey: string;
  proposedStartsAt: IsoDateTime;
  proposedEndsAt: IsoDateTime;
}) {
  return input.rows.find((row) => row.regionId === input.regionId && row.tradeKey === input.tradeKey
    && row.startsAt <= input.proposedStartsAt && row.endsAt >= input.proposedEndsAt && !row.blackout);
}

export interface ServiceRunRecommendationWork {
  workOrderId: OpsId;
  occurrenceId?: OpsId;
  estimatedDurationMinutes: number;
  confidence: "low" | "medium" | "high";
  manufacturerAuthorization?: string;
  requiredEquipment?: string[];
}

export interface ServiceRunRecommendationStop {
  storeId: OpsId;
  sequence: number;
  estimatedDriveMinutes: number;
  accessRequirements?: string;
}

export interface CreateServiceRunRecommendationInput {
  organizationId: OpsId;
  vendorId: OpsId;
  contractVersionId: OpsId;
  schedulingMode: SchedulingMode;
  proposedStartsAt: IsoDateTime;
  responseDueAt: IsoDateTime;
  work: ServiceRunRecommendationWork[];
  stops: ServiceRunRecommendationStop[];
  publicToken?: { tokenHash: string; expiresAt: IsoDateTime };
  actor: ActorContext;
}

export interface CreateServiceRunRecommendationResult {
  run: ServiceRun;
  stops: RouteStop[];
  work: ServiceRunWorkOrder[];
}

export async function createServiceRunRecommendation(
  input: CreateServiceRunRecommendationInput,
  dependencies: OpsCommandServices,
): Promise<CreateServiceRunRecommendationResult> {
  const { repository, clock, ids } = services(dependencies);
  const now = clock.now();
  const startMs = instant(input.proposedStartsAt, "Proposed start");
  const responseDueMs = instant(input.responseDueAt, "Vendor response deadline");
  if (startMs <= instant(now, "Current time")) throw new OpsDomainError("VALIDATION", "Proposed start must be in the future");
  if (responseDueMs <= instant(now, "Current time") || responseDueMs >= startMs) throw new OpsDomainError("VALIDATION", "Vendor response deadline must be before the proposed start");
  if (!input.work.length || !input.stops.length) throw new OpsDomainError("VALIDATION", "A Service Run requires work and at least one route stop");
  const workIds = new Set(input.work.map((row) => row.workOrderId));
  const stopIds = new Set(input.stops.map((row) => row.storeId));
  if (workIds.size !== input.work.length) throw new OpsDomainError("VALIDATION", "A Work Order can appear only once in a Service Run");
  if (stopIds.size !== input.stops.length) throw new OpsDomainError("VALIDATION", "A Store can appear only once in a Service Run");
  const sequences = input.stops.map((row) => row.sequence).sort((a, b) => a - b);
  if (sequences.some((value, index) => value !== index + 1)) throw new OpsDomainError("VALIDATION", "Route stop sequence must start at 1 and remain contiguous");
  input.work.forEach((row) => positiveInteger(row.estimatedDurationMinutes, "Estimated duration"));
  input.stops.forEach((row) => nonNegativeInteger(row.estimatedDriveMinutes, "Estimated drive time"));

  const [vendor, contract, scopes, policy, qualifications, documents, capacityRows, workOrders, stores] = await Promise.all([
    repository.getVendor(input.organizationId, input.vendorId),
    repository.getContractVersion(input.organizationId, input.contractVersionId),
    repository.listContractScopes(input.organizationId, input.contractVersionId),
    repository.getSchedulingPolicy(input.organizationId, input.contractVersionId),
    repository.listVendorQualifications(input.organizationId, input.vendorId),
    repository.listVendorComplianceDocuments(input.organizationId, input.vendorId),
    repository.listVendorCapacity(input.organizationId, input.vendorId),
    Promise.all(input.work.map((row) => repository.getWorkOrder(input.organizationId, row.workOrderId))),
    Promise.all(input.stops.map((row) => repository.getStore(input.organizationId, row.storeId))),
  ]);
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("CONFLICT", "An approved Vendor is required");
  if (!contract || contract.vendorId !== vendor.id) throw new OpsDomainError("NOT_FOUND", "Governing Contract Version was not found for this Vendor");
  if (contract.status !== "active" || contract.effectiveStartsAt > input.proposedStartsAt || (contract.effectiveEndsAt && contract.effectiveEndsAt < input.proposedStartsAt)) {
    throw new OpsDomainError("CONFLICT", "The governing Contract Version is not active for the proposed schedule");
  }
  if (contract.schedulingMode !== input.schedulingMode) throw new OpsDomainError("CONFLICT", "Scheduling mode must match the governing Contract Version");
  if (!policy) throw new OpsDomainError("CONFLICT", "The governing Contract Version requires an explicit Scheduling Policy");
  if (workOrders.some((row) => !row)) throw new OpsDomainError("NOT_FOUND", "One or more selected Work Orders were not found");
  if (stores.some((row) => !row)) throw new OpsDomainError("NOT_FOUND", "One or more route Stores were not found");
  const canonicalWorkOrders = workOrders as WorkOrder[];
  const canonicalStores = stores as Store[];
  await assertSchedulerActor({ repository, actor: input.actor, organizationId: input.organizationId, stores: canonicalStores });
  if (canonicalWorkOrders.some((row) => terminalWorkOrderStatuses.has(row.status) || !schedulableWorkOrderStatuses.has(row.status))) {
    throw new OpsDomainError("CONFLICT", "Every selected Work Order must be approved and ready to schedule");
  }
  assertCompliance({ documents, contract, proposedEndsAt: input.proposedStartsAt });

  const storeById = new Map(canonicalStores.map((row) => [row.id, row]));
  const stopByStoreId = new Map(input.stops.map((row) => [row.storeId, row]));
  const occurrenceByWorkOrder = new Map<OpsId, PmOccurrence>();
  const requiredQualifications = new Set<string>();
  let expectedWorkValueMinor = 0;
  let variableWorkMinutes = 0;
  for (const selected of input.work) {
    const workOrder = canonicalWorkOrders.find((row) => row.id === selected.workOrderId)!;
    const store = storeById.get(workOrder.storeId);
    if (!store || !stopByStoreId.has(workOrder.storeId)) throw new OpsDomainError("VALIDATION", `Work Order ${workOrder.number} does not belong to a selected route stop`);
    if (!await repository.vendorCoversStore(input.organizationId, vendor.id, store.id)) throw new OpsDomainError("CONFLICT", `${vendor.name} does not cover ${store.name}`);
    const assignment = await repository.getActiveAssignment(input.organizationId, workOrder.id);
    if (!assignment || assignment.kind !== "outside_vendor" || assignment.vendorId !== vendor.id) {
      throw new OpsDomainError("CONFLICT", `Work Order ${workOrder.number} is not actively assigned to ${vendor.name}`);
    }
    const tradeKey = required(workOrder.categoryKey ?? "", `Trade classification for ${workOrder.number}`);
    let occurrence: PmOccurrence | undefined;
    if (selected.occurrenceId) {
      occurrence = await repository.getPmOccurrence(input.organizationId, selected.occurrenceId) ?? undefined;
      if (!occurrence || occurrence.workOrderId !== workOrder.id || occurrence.storeId !== store.id) throw new OpsDomainError("CONFLICT", `PM occurrence does not govern ${workOrder.number}`);
      occurrenceByWorkOrder.set(workOrder.id, occurrence);
      const plan = await repository.getPmPlan(input.organizationId, occurrence.planId);
      if (!plan || !plan.active || plan.contractVersionId !== contract.id || plan.preferredVendorId !== vendor.id) throw new OpsDomainError("CONFLICT", "PM Plan vendor and contract must match the Service Run");
      if (plan.schedulingMode && plan.schedulingMode !== input.schedulingMode) throw new OpsDomainError("CONFLICT", "PM Plan scheduling mode does not match the Service Run");
      if (plan.accessRequirements && !required(stopByStoreId.get(store.id)!.accessRequirements ?? "", `Store access requirements for ${store.name}`)) throw new OpsDomainError("CONFLICT", `Store access requirements are missing for ${store.name}`);
      if (input.proposedStartsAt < occurrence.windowStartsAt || input.proposedStartsAt > occurrence.windowEndsAt) throw new OpsDomainError("CONFLICT", `Proposed schedule falls outside the immutable due window for ${workOrder.number}`);
      if (!contract.pmWorkAllowed) throw new OpsDomainError("CONFLICT", "The governing Contract Version does not authorize PM work");
    } else if (workOrder.priority === "emergency") {
      if (!contract.emergencyWorkAllowed) throw new OpsDomainError("CONFLICT", "The governing Contract Version does not authorize emergency work");
    } else if (!contract.reactiveWorkAllowed) {
      throw new OpsDomainError("CONFLICT", "The governing Contract Version does not authorize reactive work");
    }
    assertContractScope({ scopes, organizationId: input.organizationId, store, tradeKey, programId: occurrence?.programId });
    const workValue = workOrder.nte?.amountMinor ?? 0;
    if (!qualifications.some((qualification) => qualificationMatches({
      qualification, tradeKey, store, occurrence, priority: workOrder.priority,
      manufacturerAuthorization: selected.manufacturerAuthorization,
      proposedEndsAt: input.proposedStartsAt, expectedWorkValueMinor: workValue,
    }))) throw new OpsDomainError("CONFLICT", `${vendor.name} lacks a current qualification for ${workOrder.number}`);
    requiredQualifications.add(`${tradeKey}:${occurrence ? "pm" : workOrder.priority === "emergency" ? "emergency" : "reactive"}`);
    if (selected.manufacturerAuthorization) requiredQualifications.add(`manufacturer:${selected.manufacturerAuthorization}`);
    for (const equipment of selected.requiredEquipment ?? []) requiredQualifications.add(`equipment:${required(equipment, "Required equipment")}`);
    expectedWorkValueMinor += workValue;
    if (selected.confidence === "low") variableWorkMinutes += selected.estimatedDurationMinutes;
  }

  const baseServiceMinutes = input.work.reduce((sum, row) => sum + row.estimatedDurationMinutes, 0);
  const baseDriveMinutes = input.stops.reduce((sum, row) => sum + row.estimatedDriveMinutes, 0);
  const stopBufferMinutes = policy.perStopBufferMinutes * input.stops.length;
  const documentationMinutes = policy.documentationBufferMinutes * input.stops.length;
  const travelBufferMinutes = Math.ceil(baseDriveMinutes * policy.travelBufferBps / 10_000);
  const confidence = input.work.some((row) => row.confidence === "low") ? "low" : input.work.some((row) => row.confidence === "medium") ? "medium" : "high";
  const uncertaintyBps = confidence === "high" ? 0 : confidence === "medium" ? Math.ceil(policy.uncertaintyBufferBps / 2) : policy.uncertaintyBufferBps;
  const uncertaintyMinutes = Math.ceil(baseServiceMinutes * uncertaintyBps / 10_000);
  const capacityUsedMinutes = baseServiceMinutes + baseDriveMinutes + stopBufferMinutes + documentationMinutes + travelBufferMinutes + uncertaintyMinutes;
  const proposedEndsAt = addMinutes(input.proposedStartsAt, capacityUsedMinutes);
  assertCompliance({ documents, contract, proposedEndsAt });
  if (capacityUsedMinutes > policy.maximumRouteMinutes || input.stops.length > policy.maximumStores || baseDriveMinutes + travelBufferMinutes > policy.maximumTravelMinutes) {
    throw new OpsDomainError("CONFLICT", "Recommendation exceeds the Contract scheduling limits");
  }
  const regions = new Set(canonicalStores.map((store) => store.regionId).filter(Boolean) as OpsId[]);
  const trades = new Set(canonicalWorkOrders.map((workOrder) => workOrder.categoryKey!));
  for (const regionId of regions) {
    for (const tradeKey of trades) {
      const capacity = capacityFor({ rows: capacityRows, regionId, tradeKey, proposedStartsAt: input.proposedStartsAt, proposedEndsAt });
      if (!capacity) throw new OpsDomainError("CONFLICT", `No eligible ${tradeKey} capacity covers the proposed route window`);
      const usable = Math.max(0, capacity.crewMinutes - capacity.committedMinutes - Math.max(capacity.emergencyReserveMinutes, policy.emergencyReserveMinutes));
      const protectedCapacity = Math.floor(usable * policy.maximumUtilizationBps / 10_000);
      if (capacityUsedMinutes > protectedCapacity || capacityUsedMinutes > capacity.maximumRouteMinutes || input.stops.length > capacity.maximumStores || baseDriveMinutes + travelBufferMinutes > capacity.maximumTravelMinutes) {
        throw new OpsDomainError("CONFLICT", "Recommendation would overcommit protected Vendor capacity");
      }
      if (variableWorkMinutes > capacity.variableWorkLimitMinutes) throw new OpsDomainError("CONFLICT", "Low-confidence work exceeds the Vendor variable-work limit");
      const requiredEquipment = [...requiredQualifications].filter((value) => value.startsWith("equipment:")).map((value) => value.slice("equipment:".length));
      if (requiredEquipment.some((equipment) => !capacity.specialEquipment.includes(equipment))) throw new OpsDomainError("CONFLICT", "Required special equipment is unavailable in this capacity window");
    }
  }
  if (input.schedulingMode === "platform_directed" && (contract.schedulingMode !== "platform_directed" || contract.reservedCapacityMinutes < capacityUsedMinutes)) {
    throw new OpsDomainError("CONFLICT", "Platform-directed commitment requires contract-authorized reserved capacity");
  }

  const tripLine = (await repository.listRateCardLines(input.organizationId, contract.id))
    .find((line) => line.chargeType === "trip" && line.effectiveStartsAt <= input.proposedStartsAt && (!line.effectiveEndsAt || line.effectiveEndsAt >= input.proposedStartsAt));
  const estimatedTripReduction = Math.max(0, input.work.length - 1);
  const estimatedOpportunityMinor = tripLine ? Math.floor(tripLine.amount.amountMinor * estimatedTripReduction * (10_000 - contract.routeDiscountBps) / 10_000) : 0;
  const currency = contract.currency;
  const explanation = `Combines ${input.work.length} independent obligations across ${input.stops.length} ${input.stops.length === 1 ? "store" : "stores"}; validates one governing contract and current qualifications for every scope; protects ${stopBufferMinutes + documentationMinutes + travelBufferMinutes + uncertaintyMinutes} minutes of route, travel, documentation, and uncertainty buffer; uses ${capacityUsedMinutes} protected minutes; and may avoid ${estimatedTripReduction} separate ${estimatedTripReduction === 1 ? "truck roll" : "truck rolls"}.`;
  const runId = ids.next("service-run");
  const orderedStops = [...input.stops].sort((left, right) => left.sequence - right.sequence);
  let elapsed = 0;
  const routeStops: RouteStop[] = orderedStops.map((selected) => {
    elapsed += selected.estimatedDriveMinutes + Math.ceil(selected.estimatedDriveMinutes * policy.travelBufferBps / 10_000);
    const arrival = addMinutes(input.proposedStartsAt, elapsed);
    const serviceAtStop = input.work.filter((work) => canonicalWorkOrders.find((row) => row.id === work.workOrderId)!.storeId === selected.storeId)
      .reduce((sum, work) => sum + work.estimatedDurationMinutes, 0);
    const estimatedServiceMinutes = serviceAtStop + policy.perStopBufferMinutes + policy.documentationBufferMinutes
      + Math.ceil(serviceAtStop * uncertaintyBps / 10_000);
    elapsed += estimatedServiceMinutes;
    return {
      id: ids.next("route-stop"), organizationId: input.organizationId, serviceRunId: runId,
      storeId: selected.storeId, sequence: selected.sequence, proposedArrivalAt: arrival,
      committedArrivalAt: input.schedulingMode === "platform_directed" ? arrival : undefined,
      estimatedDriveMinutes: selected.estimatedDriveMinutes, estimatedServiceMinutes,
      accessRequirements: selected.accessRequirements?.trim() || undefined,
      status: "planned" as const,
    };
  });
  const stopRecordByStoreId = new Map(routeStops.map((row) => [row.storeId, row]));
  const workLinks: ServiceRunWorkOrder[] = input.work.map((selected) => {
    const workOrder = canonicalWorkOrders.find((row) => row.id === selected.workOrderId)!;
    return {
      id: ids.next("service-run-work"), organizationId: input.organizationId, serviceRunId: runId,
      routeStopId: stopRecordByStoreId.get(workOrder.storeId)!.id, workOrderId: workOrder.id,
      occurrenceId: selected.occurrenceId, planned: true,
      estimatedDurationMinutes: selected.estimatedDurationMinutes, addressed: false,
    };
  });
  const originalRecommendation = {
    vendorId: vendor.id, contractVersionId: contract.id, proposedStartsAt: input.proposedStartsAt,
    proposedEndsAt, stops: routeStops.map((row) => ({ storeId: row.storeId, sequence: row.sequence, proposedArrivalAt: row.proposedArrivalAt })),
    workOrders: workLinks.map((row) => ({ workOrderId: row.workOrderId, occurrenceId: row.occurrenceId, estimatedDurationMinutes: row.estimatedDurationMinutes })),
    expectedWorkValueMinor, estimatedOpportunityMinor, estimatedTripReduction,
  };
  const immediatelyCommitted = input.schedulingMode === "platform_directed";
  const run: ServiceRun = {
    id: runId, organizationId: input.organizationId, vendorId: vendor.id, contractVersionId: contract.id,
    schedulingMode: input.schedulingMode, status: immediatelyCommitted ? "committed" : "proposed",
    proposedStartsAt: input.proposedStartsAt, proposedEndsAt, responseDueAt: input.responseDueAt,
    committedStartsAt: immediatelyCommitted ? input.proposedStartsAt : undefined,
    committedEndsAt: immediatelyCommitted ? proposedEndsAt : undefined,
    estimatedDriveMinutes: baseDriveMinutes + travelBufferMinutes, estimatedServiceMinutes: baseServiceMinutes + stopBufferMinutes + documentationMinutes + uncertaintyMinutes,
    capacityUsedMinutes, expectedWorkValue: { amountMinor: expectedWorkValueMinor, currency },
    estimatedTripReduction, estimatedOpportunity: { amountMinor: estimatedOpportunityMinor, currency },
    recommendationExplanation: explanation, requiredQualifications: [...requiredQualifications].sort(),
    constraintsJson: JSON.stringify({ contractScope: true, geographicCoverage: true, qualifications: true, compliance: true, dueWindows: true, access: true, authorization: true, capacity: true, equipment: true, buffers: { stopBufferMinutes, documentationMinutes, travelBufferMinutes, uncertaintyMinutes }, maximumUtilizationBps: policy.maximumUtilizationBps }),
    confidence, schedulerVersion: "directive-11.8-v1", originalRecommendationJson: JSON.stringify(originalRecommendation),
    createdByActorType: input.actor.actorType, createdByActorId: input.actor.actorId,
    createdByActorName: input.actor.actorName, createdAt: now,
    acceptedAt: immediatelyCommitted ? now : undefined,
  };
  if (!immediatelyCommitted) {
    if (!input.publicToken || !/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "A valid vendor response token is required");
    if (input.publicToken.expiresAt <= now || input.publicToken.expiresAt > input.proposedStartsAt) throw new OpsDomainError("VALIDATION", "Vendor response token must expire after creation and no later than service start");
  }
  const statements: OpsStatement[] = [
    insert("ops_service_runs", {
      id: run.id, organization_id: run.organizationId, vendor_id: run.vendorId,
      contract_version_id: run.contractVersionId, scheduling_mode: run.schedulingMode, status: run.status,
      proposed_starts_at: run.proposedStartsAt, proposed_ends_at: run.proposedEndsAt,
      response_due_at: run.responseDueAt, committed_starts_at: run.committedStartsAt,
      committed_ends_at: run.committedEndsAt, estimated_drive_minutes: run.estimatedDriveMinutes,
      estimated_service_minutes: run.estimatedServiceMinutes, capacity_used_minutes: run.capacityUsedMinutes,
      expected_work_value_minor: run.expectedWorkValue.amountMinor, currency: run.expectedWorkValue.currency,
      estimated_trip_reduction: run.estimatedTripReduction, estimated_opportunity_minor: run.estimatedOpportunity.amountMinor,
      recommendation_explanation: run.recommendationExplanation,
      required_qualifications_json: JSON.stringify(run.requiredQualifications), constraints_json: run.constraintsJson,
      confidence: run.confidence, scheduler_version: run.schedulerVersion,
      original_recommendation_json: run.originalRecommendationJson,
      created_by_actor_type: run.createdByActorType, created_by_actor_id: run.createdByActorId,
      created_by_actor_name: run.createdByActorName, created_at: run.createdAt, accepted_at: run.acceptedAt,
    }),
    ...routeStops.map((row) => insert("ops_route_stops", {
      id: row.id, organization_id: row.organizationId, service_run_id: row.serviceRunId,
      store_id: row.storeId, sequence: row.sequence, proposed_arrival_at: row.proposedArrivalAt,
      committed_arrival_at: row.committedArrivalAt, estimated_drive_minutes: row.estimatedDriveMinutes,
      estimated_service_minutes: row.estimatedServiceMinutes, access_requirements: row.accessRequirements,
      status: row.status,
    })),
    ...workLinks.map((row) => insert("ops_service_run_work_orders", {
      id: row.id, organization_id: row.organizationId, service_run_id: row.serviceRunId,
      route_stop_id: row.routeStopId, work_order_id: row.workOrderId, occurrence_id: row.occurrenceId,
      planned: row.planned, estimated_duration_minutes: row.estimatedDurationMinutes, addressed: row.addressed,
    })),
  ];
  if (input.publicToken) statements.push(insert("ops_public_tokens", {
    id: ids.next("public-token"), organization_id: input.organizationId, purpose: "service_run_response",
    subject_type: "service_run", subject_id: run.id, token_hash: input.publicToken.tokenHash.toLowerCase(),
    expires_at: input.publicToken.expiresAt, created_at: now,
  }));
  for (const occurrence of occurrenceByWorkOrder.values()) {
    statements.push({ sql: "UPDATE ops_pm_occurrences SET status = ?, proposed_at = ? WHERE organization_id = ? AND id = ? AND status IN ('upcoming', 'unscheduled', 'due', 'proposed')", params: [immediatelyCommitted ? "scheduled" : "proposed", input.proposedStartsAt, input.organizationId, occurrence.id] });
  }
  for (const workOrder of canonicalWorkOrders) {
    const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
    const task = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      actor: input.actor, createdAt: now,
      draft: immediatelyCommitted ? {
        taskType: "confirm_store_access", title: "Confirm store access for committed Service Run",
        reason: `Service Run ${run.id} is contract-authorized and committed for ${input.proposedStartsAt}`,
        assigneeType: "role", assigneeRole: "store_manager", assigneeName: "Store manager",
        priority: workOrder.priority === "emergency" ? "critical" : "normal", blocking: true,
        requiredForProgress: true, dueAt: addMinutes(input.proposedStartsAt, -60), applicableSlaClock: "scheduling",
        completionCriteria: "Store access and any shutdown requirements are confirmed",
        escalationDestination: "Facilities coordinator",
      } : {
        taskType: "schedule_service", title: "Respond to Service Run recommendation",
        reason: `Service Run ${run.id} bundles this Work Order under Contract Version ${contract.version}`,
        assigneeType: "vendor", assigneeId: vendor.id, assigneeName: vendor.name,
        priority: workOrder.priority === "emergency" ? "critical" : "high", blocking: true,
        requiredForProgress: true, dueAt: input.responseDueAt, applicableSlaClock: "scheduling",
        completionCriteria: "Vendor accepts, counters, requests a scoped change, reports insufficient capacity, or declines",
        escalationDestination: "Facilities coordinator",
      },
    });
    statements.push(...buildCreateTaskStatements({ task, actor: input.actor, ids }));
    statements.push(buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, task]));
    if (immediatelyCommitted) statements.push({ sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?", params: ["scheduled", input.organizationId, workOrder.id] });
    statements.push(...auditAndOutbox({
      organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id,
      eventType: immediatelyCommitted ? "work_order.service_run_committed" : "work_order.service_run_proposed",
      actor: input.actor, occurredAt: now, payload: { serviceRunId: run.id, routeStopId: stopRecordByStoreId.get(workOrder.storeId)!.id, contractVersionId: contract.id }, ids,
    }));
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId, aggregateType: "service_run", aggregateId: run.id,
    eventType: immediatelyCommitted ? "service_run.committed" : "service_run.proposed",
    actor: input.actor, occurredAt: now,
    payload: { vendorId: vendor.id, contractVersionId: contract.id, workOrderIds: canonicalWorkOrders.map((row) => row.id), stopIds: routeStops.map((row) => row.id), capacityUsedMinutes, estimatedTripReduction, estimatedOpportunity: run.estimatedOpportunity, estimatedValueCategory: "estimated_opportunity", explanation }, ids,
  }));
  await atomicWorkOrderSetMutation({ repository, workOrders: canonicalWorkOrders, now, statements, conflictMessage: "One of the bundled Work Orders changed while the recommendation was being created" });
  return { run, stops: routeStops, work: workLinks };
}

export interface CreateStoreSweepInput {
  organizationId: OpsId;
  storeId: OpsId;
  vendorId: OpsId;
  contractVersionId: OpsId;
  responseDueAt: IsoDateTime;
  accessRequirements?: string;
  work: Array<{ workOrderId: OpsId }>;
  publicToken: { tokenHash: string; expiresAt: IsoDateTime };
  actor: ActorContext;
}

/**
 * Creates one vendor-facing store visit from already-approved held work.
 *
 * This is an operator decision, not a route-optimization claim. Every selected
 * work order keeps its own assignment, immutable authorization, visit outcome,
 * cost, invoice reference, and audit history. The package intentionally records
 * no estimated savings or trip reduction because neither is yet observed.
 */
export async function createStoreSweep(
  input: CreateStoreSweepInput,
  dependencies: OpsCommandServices,
): Promise<CreateServiceRunRecommendationResult> {
  const { repository, clock, ids } = services(dependencies);
  const now = clock.now();
  const responseDueMs = instant(input.responseDueAt, "Vendor response deadline");
  if (responseDueMs <= instant(now, "Current time")) throw new OpsDomainError("VALIDATION", "Vendor response deadline must be in the future");
  if (!input.work.length) throw new OpsDomainError("VALIDATION", "Select at least one approved job for this store visit");
  if (input.work.length > 50) throw new OpsDomainError("VALIDATION", "A store visit can include at most 50 approved jobs");
  const workIds = new Set(input.work.map((row) => row.workOrderId));
  if (workIds.size !== input.work.length) throw new OpsDomainError("VALIDATION", "Each approved job can be selected only once");
  if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Vendor response token is invalid");
  if (input.publicToken.expiresAt <= now || input.publicToken.expiresAt > input.responseDueAt) throw new OpsDomainError("VALIDATION", "Vendor response link must expire after creation and no later than the response deadline");

  const [organization, store, vendor, contract, documents, workOrders, holds] = await Promise.all([
    repository.getOrganization(input.organizationId),
    repository.getStore(input.organizationId, input.storeId),
    repository.getVendor(input.organizationId, input.vendorId),
    repository.getContractVersion(input.organizationId, input.contractVersionId),
    repository.listVendorComplianceDocuments(input.organizationId, input.vendorId),
    Promise.all(input.work.map((row) => repository.getWorkOrder(input.organizationId, row.workOrderId))),
    Promise.all(input.work.map((row) => repository.getWorkOrderVisitHold(input.organizationId, row.workOrderId))),
  ]);
  if (!organization || !store) throw new OpsDomainError("NOT_FOUND", "Store or organization was not found");
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("CONFLICT", "Choose an approved vendor");
  if (!contract || contract.vendorId !== vendor.id || contract.status !== "active") {
    throw new OpsDomainError("CONFLICT", "Current vendor work terms are required before sending these jobs");
  }
  if (contract.effectiveStartsAt > now || (contract.effectiveEndsAt && contract.effectiveEndsAt < now)) {
    throw new OpsDomainError("CONFLICT", "Vendor work terms are not currently active");
  }
  if (!contract.reactiveWorkAllowed) throw new OpsDomainError("CONFLICT", "Vendor work terms do not include reactive work");
  if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, store.id))) {
    throw new OpsDomainError("CONFLICT", `${vendor.name} does not cover this store`);
  }
  await assertSchedulerActor({ repository, actor: input.actor, organizationId: input.organizationId, stores: [store] });
  assertCompliance({ documents, contract, proposedEndsAt: now });
  if (workOrders.some((row) => !row)) throw new OpsDomainError("NOT_FOUND", "One or more selected jobs are no longer available");
  const canonicalWorkOrders = workOrders as WorkOrder[];
  for (let index = 0; index < canonicalWorkOrders.length; index += 1) {
    const workOrder = canonicalWorkOrders[index]!;
    const hold = holds[index];
    if (workOrder.storeId !== store.id) throw new OpsDomainError("VALIDATION", `${workOrder.number} belongs to another store`);
    if (workOrder.status !== "approved" || !hold || hold.status !== "active") {
      throw new OpsDomainError("CONFLICT", `${workOrder.number} is no longer approved for the next suitable visit`);
    }
    const eligibility = await heldWorkVendorEligibility({
      repository,
      organizationId: input.organizationId,
      vendorId: vendor.id,
      workOrder,
      now,
    });
    if (!eligibility.allowed) throw new OpsDomainError("CONFLICT", `${workOrder.number}: ${eligibility.reason}`);
  }
  const neededByAt = holds.reduce<string | undefined>((earliest, hold) => !hold ? earliest : !earliest || hold.deadlineAt < earliest ? hold.deadlineAt : earliest, undefined);
  if (!neededByAt) throw new OpsDomainError("CONFLICT", "The selected jobs no longer have active review dates");

  const [activeAssignments, latestIssuances, tasksByWorkOrder] = await Promise.all([
    Promise.all(canonicalWorkOrders.map((workOrder) => repository.getActiveAssignment(input.organizationId, workOrder.id))),
    Promise.all(canonicalWorkOrders.map((workOrder) => repository.getLatestIssuanceForWorkOrder(input.organizationId, workOrder.id))),
    Promise.all(canonicalWorkOrders.map((workOrder) => repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id))),
  ]);
  activeAssignments.forEach((assignment, index) => {
    if (!assignment) return;
    if (assignment.kind === "outside_vendor" && assignment.vendorId === vendor.id) return;
    if (assignment.kind === "choose_later") return;
    throw new OpsDomainError("CONFLICT", `${canonicalWorkOrders[index]!.number} is already assigned to another provider`);
  });

  const runId = ids.next("store-sweep");
  const stopId = ids.next("route-stop");
  const categories = [...new Set(canonicalWorkOrders.map((workOrder) => workOrder.categoryKey).filter((value): value is string => Boolean(value)))].sort();
  const recommendationExplanation = `Sends ${canonicalWorkOrders.length} already-approved ${canonicalWorkOrders.length === 1 ? "job" : "jobs"} at Store ${store.storeNumber} to ${vendor.name} together. The earliest existing review date remains the customer’s requested completion boundary; the vendor chooses its visit date, crew, route, and time onsite. Each job keeps its own work-order number, outcome, cost, and invoice history. No trip reduction or dollar savings is claimed until later evidence supports it.`;
  const originalRecommendation = {
    kind: "combined_work_request",
    vendorId: vendor.id,
    contractVersionId: contract.id,
    storeId: store.id,
    neededByAt,
    workOrders: input.work.map((selected) => ({ workOrderId: selected.workOrderId })),
    estimatedTripReduction: 0,
    estimatedOpportunityMinor: 0,
  };
  const run: ServiceRun = {
    id: runId,
    organizationId: input.organizationId,
    vendorId: vendor.id,
    contractVersionId: contract.id,
    schedulingMode: "vendor_planned",
    status: "proposed",
    neededByAt,
    // Legacy non-null schedule fields retain the request boundary for old readers.
    // Combined-work screens and commands use neededByAt until the vendor supplies a date.
    proposedStartsAt: neededByAt,
    proposedEndsAt: neededByAt,
    responseDueAt: input.responseDueAt,
    estimatedDriveMinutes: 0,
    estimatedServiceMinutes: 0,
    capacityUsedMinutes: 0,
    expectedWorkValue: { amountMinor: 0, currency: contract.currency },
    estimatedTripReduction: 0,
    estimatedOpportunity: { amountMinor: 0, currency: contract.currency },
    recommendationExplanation,
    requiredQualifications: categories,
    constraintsJson: JSON.stringify({ approvedVendor: true, storeCoverage: true, currentCustomerCompliance: true, managerApprovedWork: true, individualWorkOrdersPreserved: true }),
    confidence: "high",
    schedulerVersion: "store-sweep-v1",
    originalRecommendationJson: JSON.stringify(originalRecommendation),
    createdByActorType: input.actor.actorType,
    createdByActorId: input.actor.actorId,
    createdByActorName: input.actor.actorName,
    createdAt: now,
  };
  const routeStop: RouteStop = {
    id: stopId,
    organizationId: input.organizationId,
    serviceRunId: run.id,
    storeId: store.id,
    sequence: 1,
    proposedArrivalAt: neededByAt,
    estimatedDriveMinutes: 0,
    estimatedServiceMinutes: 0,
    accessRequirements: input.accessRequirements?.trim() || undefined,
    status: "planned",
  };
  const workLinks: ServiceRunWorkOrder[] = input.work.map((selected) => ({
    id: ids.next("service-run-work"),
    organizationId: input.organizationId,
    serviceRunId: run.id,
    routeStopId: routeStop.id,
    workOrderId: selected.workOrderId,
    planned: true,
    estimatedDurationMinutes: 0,
    addressed: false,
  }));

  const statements: OpsStatement[] = [
    insert("ops_service_runs", {
      id: run.id, organization_id: run.organizationId, vendor_id: run.vendorId,
      contract_version_id: run.contractVersionId, scheduling_mode: run.schedulingMode, status: run.status,
      needed_by_at: run.neededByAt,
      proposed_starts_at: run.proposedStartsAt, proposed_ends_at: run.proposedEndsAt,
      response_due_at: run.responseDueAt, estimated_drive_minutes: run.estimatedDriveMinutes,
      estimated_service_minutes: run.estimatedServiceMinutes, capacity_used_minutes: run.capacityUsedMinutes,
      expected_work_value_minor: 0, currency: run.expectedWorkValue.currency,
      estimated_trip_reduction: 0, estimated_opportunity_minor: 0,
      recommendation_explanation: run.recommendationExplanation,
      required_qualifications_json: JSON.stringify(run.requiredQualifications), constraints_json: run.constraintsJson,
      confidence: run.confidence, scheduler_version: run.schedulerVersion,
      original_recommendation_json: run.originalRecommendationJson,
      created_by_actor_type: run.createdByActorType, created_by_actor_id: run.createdByActorId,
      created_by_actor_name: run.createdByActorName, created_at: run.createdAt,
    }),
    insert("ops_route_stops", {
      id: routeStop.id, organization_id: routeStop.organizationId, service_run_id: routeStop.serviceRunId,
      store_id: routeStop.storeId, sequence: routeStop.sequence, proposed_arrival_at: routeStop.proposedArrivalAt,
      estimated_drive_minutes: 0, estimated_service_minutes: routeStop.estimatedServiceMinutes,
      access_requirements: routeStop.accessRequirements, status: routeStop.status,
    }),
    ...workLinks.map((row) => insert("ops_service_run_work_orders", {
      id: row.id, organization_id: row.organizationId, service_run_id: row.serviceRunId,
      route_stop_id: row.routeStopId, work_order_id: row.workOrderId,
      planned: row.planned, estimated_duration_minutes: row.estimatedDurationMinutes, addressed: row.addressed,
    })),
    insert("ops_public_tokens", {
      id: ids.next("public-token"), organization_id: input.organizationId, purpose: "service_run_response",
      subject_type: "service_run", subject_id: run.id, token_hash: input.publicToken.tokenHash.toLowerCase(),
      expires_at: input.publicToken.expiresAt, created_at: now,
    }),
  ];

  for (let index = 0; index < canonicalWorkOrders.length; index += 1) {
    const workOrder = canonicalWorkOrders[index]!;
    const activeAssignment = activeAssignments[index];
    const reuseAssignment = activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === vendor.id;
    const assignmentId = reuseAssignment ? activeAssignment.id : ids.next("assignment");
    const issuanceId = ids.next("issuance");
    if (!reuseAssignment) {
      if (activeAssignment) statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = 'superseded' WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN ('cancelled','declined','completed','superseded')",
        params: [input.organizationId, activeAssignment.id, workOrder.id],
      });
      statements.push(insert("ops_work_order_assignments", {
        id: assignmentId, organization_id: input.organizationId, work_order_id: workOrder.id,
        kind: "outside_vendor", vendor_id: vendor.id, status: "issued", assigned_at: now,
        supersedes_assignment_id: activeAssignment?.id,
      }));
      statements.push(...auditAndOutbox({
        organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id,
        eventType: "work_order.assigned", actor: input.actor, occurredAt: now,
        payload: { assignmentId, supersedesAssignmentId: activeAssignment?.id, kind: "outside_vendor", vendorId: vendor.id, storeSweepId: run.id }, ids,
      }));
    } else {
      statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = 'issued' WHERE organization_id = ? AND id = ? AND work_order_id = ?",
        params: [input.organizationId, assignmentId, workOrder.id],
      });
    }
    const latestIssuance = latestIssuances[index];
    if (latestIssuance) statements.push({
      sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND subject_type = 'work_order_issuance' AND subject_id = ? AND revoked_at IS NULL",
      params: [now, input.organizationId, latestIssuance.id],
    });
    const immutablePayload = JSON.stringify({
      organizationName: organization.name,
      workOrderNumber: workOrder.number,
      store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "), timeZone: store.timeZone },
      vendor: { id: vendor.id, name: vendor.name },
      problem: workOrder.problem,
      priority: workOrder.priority,
      authorizedScope: workOrder.authorizedScope,
      categoryKey: workOrder.categoryKey,
      neededByAt,
      schedulingOwner: "vendor",
      billingInstruction: `Include operator work-order number ${workOrder.number} on service paperwork and invoices.`,
      storeSweepId: run.id,
    });
    statements.push(
      insert("ops_work_order_issuances", {
        id: issuanceId, organization_id: input.organizationId, work_order_id: workOrder.id,
        assignment_id: assignmentId, revision: (latestIssuance?.revision ?? 0) + 1,
        immutable_payload_json: immutablePayload, channel: "email", issued_at: now,
      }),
      { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: ["issued", vendor.name, "Respond to jobs sent together", input.responseDueAt, "Facilities coordinator", input.organizationId, workOrder.id] },
      ...auditAndOutbox({
        organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id,
        eventType: "work_order.issued", actor: input.actor, occurredAt: now,
        payload: { issuanceId, assignmentId, revision: (latestIssuance?.revision ?? 0) + 1, channel: "email", vendorId: vendor.id, serviceRunId: run.id, storeSweep: true }, ids,
      }),
    );

    const tasks = tasksByWorkOrder[index]!;
    const openTasks = tasks.filter(isOpenWorkflowTask);
    for (const task of openTasks) statements.push(...buildCompleteWorkflowTaskStatements({
      task, actor: input.actor, occurredAt: now, ids, resolutionNote: `Sent with other approved jobs in request ${run.id}`,
    }));
    const responseTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      actor: input.actor, createdAt: now, draft: {
        taskType: "schedule_service", title: "Respond to jobs sent together",
        reason: `${workOrder.number} is one of ${canonicalWorkOrders.length} approved jobs sent together for Store ${store.storeNumber}. The vendor owns scheduling.`,
        assigneeType: "vendor", assigneeId: vendor.id, assigneeName: vendor.name,
        priority: "normal", blocking: true, requiredForProgress: true,
        dueAt: input.responseDueAt, applicableSlaClock: "scheduling",
        completionCriteria: "Vendor supplies its planned date, asks to remove an item, cannot take the work, or declines",
        escalationDestination: "Facilities coordinator",
      },
    });
    statements.push(...buildCreateTaskStatements({ task: responseTask, actor: input.actor, ids }));
    const nextTasks = tasks.map((task) => openTasks.some((open) => open.id === task.id)
      ? { ...task, status: "completed" as const, completedAt: now, completedByActorType: input.actor.actorType, completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName, resolutionNote: `Sent with other approved jobs in request ${run.id}` }
      : task);
    statements.push(buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...nextTasks, responseTask]));
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId, aggregateType: "service_run", aggregateId: run.id,
    eventType: "service_run.proposed", actor: input.actor, occurredAt: now,
    payload: { kind: "combined_work_request", vendorId: vendor.id, storeId: store.id, workOrderIds: canonicalWorkOrders.map((row) => row.id), neededByAt, schedulingOwner: "vendor", estimatedTripReduction: 0, estimatedOpportunity: run.estimatedOpportunity, explanation: recommendationExplanation }, ids,
  }));
  await atomicWorkOrderSetMutation({
    repository,
    workOrders: canonicalWorkOrders,
    now,
    statements,
    conflictMessage: "One of these approved jobs changed. Refresh the combined visit before sending it.",
  });
  return { run, stops: [routeStop], work: workLinks };
}

export interface RespondToServiceRunInput {
  tokenHash: string;
  response: ServiceRunResponseKind;
  responderName: string;
  requestedStartsAt?: IsoDateTime;
  requestedStopOrder?: OpsId[];
  removeWorkOrderIds?: OpsId[];
  reasonCode?: string;
  reasonDetail?: string;
  actor: ActorContext;
}

function responseRequiresReason(response: ServiceRunResponseKind) {
  return response !== "accepted";
}

async function runBundle(repository: OpsRepository, run: ServiceRun) {
  const [stops, links] = await Promise.all([
    repository.listRouteStops(run.organizationId, run.id),
    repository.listServiceRunWorkOrders(run.organizationId, run.id),
  ]);
  const workOrders = await Promise.all(links.map((row) => repository.getWorkOrder(run.organizationId, row.workOrderId)));
  if (workOrders.some((row) => !row)) throw new OpsDomainError("CONFLICT", "A bundled Work Order no longer exists");
  return { stops, links, workOrders: workOrders as WorkOrder[] };
}

function validateRequestedChanges(input: {
  response: ServiceRunResponseKind;
  stops: readonly RouteStop[];
  links: readonly ServiceRunWorkOrder[];
  requestedStopOrder?: readonly OpsId[];
  removeWorkOrderIds?: readonly OpsId[];
}) {
  const requestedStopOrder = input.requestedStopOrder ?? [];
  const removeWorkOrderIds = input.removeWorkOrderIds ?? [];
  if (new Set(requestedStopOrder).size !== requestedStopOrder.length || new Set(removeWorkOrderIds).size !== removeWorkOrderIds.length) throw new OpsDomainError("VALIDATION", "Requested changes cannot contain duplicates");
  if (requestedStopOrder.some((id) => !input.stops.some((stop) => stop.storeId === id))) throw new OpsDomainError("VALIDATION", "Requested stop change references a Store outside the original recommendation");
  if (removeWorkOrderIds.some((id) => !input.links.some((link) => link.workOrderId === id))) throw new OpsDomainError("VALIDATION", "Requested Work Order change references work outside the original recommendation");
  if (requestedStopOrder.length && requestedStopOrder.length !== input.stops.length) throw new OpsDomainError("VALIDATION", "A stop-order change must retain every original stop");
  if (removeWorkOrderIds.length === input.links.length) throw new OpsDomainError("VALIDATION", "A counterproposal cannot remove every Work Order");
  if (input.response === "stop_change_requested" && !requestedStopOrder.length) throw new OpsDomainError("VALIDATION", "A requested stop order is required");
  if (input.response === "work_order_change_requested" && !removeWorkOrderIds.length) throw new OpsDomainError("VALIDATION", "At least one requested Work Order removal is required");
}

export async function respondToServiceRun(input: RespondToServiceRunInput, dependencies: OpsCommandServices): Promise<ServiceRunResponse> {
  const { repository, clock, ids } = services(dependencies);
  const now = clock.now();
  if (!/^[a-f0-9]{64}$/i.test(input.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (!responseKinds.has(input.response)) throw new OpsDomainError("VALIDATION", "Service Run response is invalid");
  const capability = await repository.getServiceRunByPublicToken({ tokenHash: input.tokenHash.toLowerCase(), purpose: "service_run_response", now });
  if (!capability) throw new OpsDomainError("NOT_FOUND", "Service Run response link is invalid, expired, or already used");
  const run = capability.run;
  const storeSweep = run.schedulerVersion === "store-sweep-v1";
  if (input.actor.organizationId !== run.organizationId || input.actor.actorType !== "vendor_link") throw new OpsDomainError("FORBIDDEN", "Vendor link actor does not match this Service Run");
  if (!["proposed", "countered"].includes(run.status)) throw new OpsDomainError("CONFLICT", "This Service Run is not awaiting a Vendor response");
  const responderName = required(input.responderName, "Responder name");
  const reasonCode = responseRequiresReason(input.response) ? required(input.reasonCode ?? "", "Structured reason") : input.reasonCode?.trim() || undefined;
  const reasonDetail = responseRequiresReason(input.response) ? required(input.reasonDetail ?? "", "Reason detail") : input.reasonDetail?.trim() || undefined;
  const { stops, links, workOrders } = await runBundle(repository, run);
  validateRequestedChanges({ response: input.response, stops, links, requestedStopOrder: input.requestedStopOrder, removeWorkOrderIds: input.removeWorkOrderIds });
  if (input.requestedStartsAt) instant(input.requestedStartsAt, "Requested start");
  if (storeSweep && ["accepted", "work_order_change_requested"].includes(input.response) && !input.requestedStartsAt) {
    throw new OpsDomainError("VALIDATION", "The vendor’s planned visit date is required");
  }
  if (storeSweep && input.requestedStartsAt && instant(input.requestedStartsAt, "Vendor planned date") <= instant(now, "Current time")) {
    throw new OpsDomainError("VALIDATION", "The vendor’s planned visit date must be in the future");
  }
  if (input.response === "countered" && !input.requestedStartsAt && !input.requestedStopOrder?.length && !input.removeWorkOrderIds?.length) throw new OpsDomainError("VALIDATION", "A counterproposal must request a concrete change");
  const requestedStartsAt = input.requestedStartsAt;
  const shiftMinutes = requestedStartsAt && !storeSweep ? Math.round((Date.parse(requestedStartsAt) - Date.parse(run.proposedStartsAt)) / 60_000) : 0;
  const removedLinks = links.filter((link) => input.removeWorkOrderIds?.includes(link.workOrderId));
  const dueWindowImpactCount = await (async () => {
    if (!requestedStartsAt) return 0;
    let count = 0;
    for (const link of links) {
      if (!link.occurrenceId || input.removeWorkOrderIds?.includes(link.workOrderId)) continue;
      const occurrence = await repository.getPmOccurrence(run.organizationId, link.occurrenceId);
      if (occurrence && (requestedStartsAt < occurrence.windowStartsAt || requestedStartsAt > occurrence.windowEndsAt)) count += 1;
    }
    return count;
  })();
  const originalTripMinutes = stops.reduce((sum, stop) => sum + stop.estimatedDriveMinutes, 0);
  const reorderedTripMinutes = input.requestedStopOrder?.length ? input.requestedStopOrder.reduce((sum, storeId) => sum + (stops.find((stop) => stop.storeId === storeId)?.estimatedDriveMinutes ?? 0), 0) : originalTripMinutes;
  const travelImpactMinutes = reorderedTripMinutes - originalTripMinutes;
  const removedValue = removedLinks.reduce((sum, link) => sum + Math.floor(run.expectedWorkValue.amountMinor * link.estimatedDurationMinutes / Math.max(1, run.estimatedServiceMinutes)), 0);
  const economicImpact: Money = { amountMinor: Math.max(0, removedValue), currency: run.expectedWorkValue.currency };
  const resultingPlan = {
    requestedStartsAt: requestedStartsAt ?? (storeSweep ? undefined : run.proposedStartsAt),
    requestedStopOrder: input.requestedStopOrder ?? stops.sort((a, b) => a.sequence - b.sequence).map((stop) => stop.storeId),
    retainedWorkOrderIds: links.filter((link) => !input.removeWorkOrderIds?.includes(link.workOrderId)).map((link) => link.workOrderId),
    removedWorkOrderIds: input.removeWorkOrderIds ?? [], shiftMinutes,
  };
  const response: ServiceRunResponse = {
    id: ids.next("service-run-response"), organizationId: run.organizationId, serviceRunId: run.id,
    response: input.response, requestedStartsAt, requestedStopChangesJson: input.requestedStopOrder?.length ? JSON.stringify(input.requestedStopOrder) : undefined,
    requestedWorkOrderChangesJson: input.removeWorkOrderIds?.length ? JSON.stringify({ removeWorkOrderIds: input.removeWorkOrderIds }) : undefined,
    reasonCode, reasonDetail, travelImpactMinutes, dueWindowImpactCount, economicImpact,
    responderName, respondedAt: now, resultingPlanJson: JSON.stringify(resultingPlan),
  };
  const accepted = input.response === "accepted";
  const committedStartsAt = accepted ? (storeSweep ? requestedStartsAt! : run.proposedStartsAt) : undefined;
  const committedEndsAt = accepted ? (storeSweep ? undefined : run.proposedEndsAt) : undefined;
  if (accepted && storeSweep) {
    const [contract, documents] = await Promise.all([
      repository.getContractVersion(run.organizationId, run.contractVersionId),
      repository.listVendorComplianceDocuments(run.organizationId, run.vendorId),
    ]);
    if (!contract || contract.status !== "active" || contract.effectiveStartsAt > committedStartsAt! || contract.effectiveEndsAt && contract.effectiveEndsAt < committedStartsAt!) {
      throw new OpsDomainError("CONFLICT", "Current vendor work terms are required for the vendor’s planned date");
    }
    assertCompliance({ documents, contract, proposedEndsAt: committedStartsAt! });
  }
  const sweepUnavailable = storeSweep && ["declined", "insufficient_capacity"].includes(input.response);
  const nextStatus = accepted
    ? "committed"
    : ["countered", "stop_change_requested", "work_order_change_requested"].includes(input.response)
      ? "countered"
      : input.response === "declined" || sweepUnavailable
        ? "declined"
        : "proposed";
  const statements: OpsStatement[] = [
    insert("ops_service_run_responses", {
      id: response.id, organization_id: response.organizationId, service_run_id: response.serviceRunId,
      response: response.response, requested_starts_at: response.requestedStartsAt,
      requested_stop_changes_json: response.requestedStopChangesJson,
      requested_work_order_changes_json: response.requestedWorkOrderChangesJson,
      reason_code: response.reasonCode, reason_detail: response.reasonDetail,
      travel_impact_minutes: response.travelImpactMinutes, due_window_impact_count: response.dueWindowImpactCount,
      economic_impact_minor: response.economicImpact.amountMinor, currency: response.economicImpact.currency,
      responder_name: response.responderName, responded_at: response.respondedAt,
      resulting_plan_json: response.resultingPlanJson,
    }),
    { sql: "UPDATE ops_public_tokens SET used_at = ? WHERE organization_id = ? AND id = ? AND used_at IS NULL AND revoked_at IS NULL", params: [now, run.organizationId, capability.tokenId] },
    insert("ops_idempotency_keys", {
      organization_id: run.organizationId, key: `service-run-response:${capability.tokenId}`,
      command: "service_run.respond", result_id: response.id,
      request_hash: input.tokenHash.toLowerCase(), created_at: now, expires_at: "9999-12-31T23:59:59.999Z",
    }),
    { sql: "UPDATE ops_service_runs SET status = ?, committed_starts_at = ?, committed_ends_at = ?, accepted_at = ? WHERE organization_id = ? AND id = ? AND status IN ('proposed', 'countered')", params: [nextStatus, committedStartsAt ?? null, committedEndsAt ?? null, accepted ? now : null, run.organizationId, run.id] },
  ];
  const vendorActor: ActorContext = { ...input.actor, actorName: responderName };
  if (accepted) {
    for (const stop of stops) statements.push({ sql: "UPDATE ops_route_stops SET committed_arrival_at = ? WHERE organization_id = ? AND id = ? AND service_run_id = ?", params: [committedStartsAt!, run.organizationId, stop.id, run.id] });
    for (const link of links) if (link.occurrenceId) statements.push({ sql: "UPDATE ops_pm_occurrences SET status = 'scheduled', committed_at = ? WHERE organization_id = ? AND id = ? AND status = 'proposed'", params: [committedStartsAt!, run.organizationId, link.occurrenceId] });
    for (const workOrder of workOrders) {
      const tasks = await repository.listWorkflowTasksForWorkOrder(run.organizationId, workOrder.id);
      const activeAssignment = await repository.getActiveAssignment(run.organizationId, workOrder.id);
      const runTask = tasks.find((task) => isOpenWorkflowTask(task) && task.taskType === "schedule_service" && (storeSweep ? ["Respond to jobs sent together", "Respond to proposed store visit"].includes(task.title) : task.reason.includes(run.id)));
      const acceptedNote = storeSweep ? "Vendor accepted the grouped jobs and supplied its planned date" : "Vendor accepted the original Service Run recommendation";
      const nextTasks: WorkflowTask[] = tasks.map((task) => runTask && task.id === runTask.id ? { ...task, status: "completed", completedAt: now, completedByActorType: vendorActor.actorType, completedByActorId: vendorActor.actorId, completedByActorName: vendorActor.actorName, resolutionNote: acceptedNote } : task);
      if (runTask) statements.push(...buildCompleteWorkflowTaskStatements({ task: runTask, actor: vendorActor, occurredAt: now, ids, resolutionNote: acceptedNote }));
      if (storeSweep && activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === run.vendorId) statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status IN ('issued','opened','accepted')",
        params: ["accepted", run.organizationId, activeAssignment.id, workOrder.id],
      });
      const accessTask = buildWorkflowTaskRecord({
        id: ids.next("workflow-task"), organizationId: run.organizationId, workOrderId: workOrder.id,
        actor: vendorActor, createdAt: now, draft: {
          taskType: "confirm_store_access", title: storeSweep ? "Confirm store access for the planned visit" : "Confirm store access for committed Service Run",
          reason: storeSweep ? `Vendor supplied its planned visit date of ${committedStartsAt}` : `Vendor accepted Service Run ${run.id} for ${committedStartsAt}`,
          assigneeType: "role", assigneeRole: "store_manager", assigneeName: "Store manager",
          priority: workOrder.priority === "emergency" ? "critical" : "normal", blocking: true,
          requiredForProgress: true, dueAt: addMinutes(committedStartsAt!, -60), applicableSlaClock: "scheduling",
          completionCriteria: "Store access and any shutdown requirements are confirmed",
          escalationDestination: "Facilities coordinator",
        },
      });
      statements.push(...buildCreateTaskStatements({ task: accessTask, actor: vendorActor, ids }));
      statements.push(buildWorkflowTaskProjectionStatement(run.organizationId, workOrder.id, [...nextTasks, accessTask]));
      statements.push({ sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('closed', 'cancelled')", params: ["scheduled", run.organizationId, workOrder.id] });
    }
  } else if (sweepUnavailable) {
    for (const workOrder of workOrders) {
      const [tasks, hold, activeAssignment] = await Promise.all([
        repository.listWorkflowTasksForWorkOrder(run.organizationId, workOrder.id),
        repository.getWorkOrderVisitHold(run.organizationId, workOrder.id),
        repository.getActiveAssignment(run.organizationId, workOrder.id),
      ]);
      const runTask = tasks.find((task) => isOpenWorkflowTask(task) && task.taskType === "schedule_service" && ["Respond to jobs sent together", "Respond to proposed store visit"].includes(task.title));
      const resolutionNote = "Vendor could not take the grouped jobs; the approved job returned to the future-visit list";
      if (runTask) statements.push(...buildCompleteWorkflowTaskStatements({ task: runTask, actor: vendorActor, occurredAt: now, ids, resolutionNote }));
      if (activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === run.vendorId) statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN ('completed','cancelled','superseded','declined')",
        params: ["declined", run.organizationId, activeAssignment.id, workOrder.id],
      });
      const readyTask = buildWorkflowTaskRecord({
        id: ids.next("workflow-task"), organizationId: run.organizationId, workOrderId: workOrder.id,
        actor: vendorActor, createdAt: now, draft: {
          taskType: "choose_service_provider", title: "Approved for a future vendor visit",
          reason: `${workOrder.number} remains approved after the grouped work request was declined.`,
          assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator",
          priority: "normal", blocking: true, requiredForProgress: true, dueAt: hold?.deadlineAt ?? workOrder.dueAt,
          applicableSlaClock: "scheduling",
          completionCriteria: "Include this job in another planned visit or issue it separately",
          escalationDestination: "Regional facilities manager",
        },
      });
      statements.push(...buildCreateTaskStatements({ task: readyTask, actor: vendorActor, ids }));
      const nextTasks: WorkflowTask[] = tasks.map((task) => runTask && task.id === runTask.id ? { ...task, status: "completed", completedAt: now, completedByActorType: vendorActor.actorType, completedByActorId: vendorActor.actorId, completedByActorName: vendorActor.actorName, resolutionNote } : task);
      statements.push(buildWorkflowTaskProjectionStatement(run.organizationId, workOrder.id, [...nextTasks, readyTask]));
      statements.push({
        sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('closed','cancelled')",
        params: ["approved", "Facilities coordinator", "Approved for a future vendor visit", hold?.deadlineAt ?? workOrder.dueAt, "Regional facilities manager", run.organizationId, workOrder.id],
      });
    }
  }
  statements.push(...auditAndOutbox({
    organizationId: run.organizationId, aggregateType: "service_run", aggregateId: run.id,
    eventType: `service_run.vendor_${input.response}`, actor: vendorActor, occurredAt: now,
    payload: { responseId: response.id, originalRecommendation: JSON.parse(run.originalRecommendationJson), requestedChange: resultingPlan, travelImpactMinutes, dueWindowImpactCount, economicImpact, neededByAt: run.neededByAt, vendorPlannedStartsAt: committedStartsAt, plannedAfterNeededBy: Boolean(storeSweep && committedStartsAt && run.neededByAt && committedStartsAt > run.neededByAt), finalAcceptedPlan: accepted ? resultingPlan : undefined }, ids,
  }));
  await atomicWorkOrderSetMutation({ repository, workOrders, now, statements, conflictMessage: "A bundled Work Order changed while the Vendor response was being recorded" });
  return response;
}

export interface AcceptServiceRunCounterInput {
  organizationId: OpsId;
  serviceRunId: OpsId;
  responseId: OpsId;
  actor: ActorContext;
}

export async function acceptServiceRunCounter(input: AcceptServiceRunCounterInput, dependencies: OpsCommandServices): Promise<ServiceRun> {
  const { repository, clock, ids } = services(dependencies);
  const now = clock.now();
  const run = await repository.getServiceRun(input.organizationId, input.serviceRunId);
  if (!run) throw new OpsDomainError("NOT_FOUND", "Service Run was not found");
  const storeSweep = run.schedulerVersion === "store-sweep-v1";
  const responses = await repository.listServiceRunResponses(input.organizationId, run.id);
  const response = responses.find((row) => row.id === input.responseId);
  if (!response || !["countered", "stop_change_requested", "work_order_change_requested"].includes(response.response)) throw new OpsDomainError("CONFLICT", "A valid Vendor counterproposal is required");
  if (responses.at(-1)?.id !== response.id || run.status !== "countered") throw new OpsDomainError("CONFLICT", "Only the latest open counterproposal can be accepted");
  const { stops, links, workOrders } = await runBundle(repository, run);
  const stores = await Promise.all(stops.map((stop) => repository.getStore(input.organizationId, stop.storeId)));
  if (stores.some((store) => !store)) throw new OpsDomainError("CONFLICT", "A route Store no longer exists");
  await assertSchedulerActor({ repository, actor: input.actor, organizationId: input.organizationId, stores: stores as Store[] });
  const resultingPlan = JSON.parse(response.resultingPlanJson ?? "{}") as { requestedStartsAt?: IsoDateTime; requestedStopOrder?: OpsId[]; retainedWorkOrderIds?: OpsId[]; removedWorkOrderIds?: OpsId[]; shiftMinutes?: number };
  if (storeSweep && !resultingPlan.requestedStartsAt) throw new OpsDomainError("CONFLICT", "The vendor did not supply a planned visit date");
  const startsAt = resultingPlan.requestedStartsAt ?? run.proposedStartsAt;
  const shiftMinutes = storeSweep ? 0 : resultingPlan.shiftMinutes ?? Math.round((Date.parse(startsAt) - Date.parse(run.proposedStartsAt)) / 60_000);
  const endsAt = storeSweep ? undefined : addMinutes(run.proposedEndsAt, shiftMinutes);
  if (storeSweep) {
    const [contract, documents] = await Promise.all([
      repository.getContractVersion(run.organizationId, run.contractVersionId),
      repository.listVendorComplianceDocuments(run.organizationId, run.vendorId),
    ]);
    if (!contract || contract.status !== "active" || contract.effectiveStartsAt > startsAt || contract.effectiveEndsAt && contract.effectiveEndsAt < startsAt) {
      throw new OpsDomainError("CONFLICT", "Current vendor work terms are required for the vendor’s planned date");
    }
    assertCompliance({ documents, contract, proposedEndsAt: startsAt });
  }
  for (const link of links) {
    if (!link.occurrenceId || resultingPlan.removedWorkOrderIds?.includes(link.workOrderId)) continue;
    const occurrence = await repository.getPmOccurrence(input.organizationId, link.occurrenceId);
    if (occurrence && (startsAt < occurrence.windowStartsAt || startsAt > occurrence.windowEndsAt)) throw new OpsDomainError("CONFLICT", "Counterproposal falls outside a PM due window and cannot be committed");
  }
  const accepted: ServiceRun = { ...run, status: "committed", committedStartsAt: startsAt, committedEndsAt: endsAt, acceptedAt: now };
  const statements: OpsStatement[] = [
    insert("ops_idempotency_keys", { organization_id: input.organizationId, key: `service-run-commit:${run.id}`, command: "service_run.accept_counter", result_id: response.id, request_hash: response.id, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" }),
    { sql: "UPDATE ops_service_runs SET status = ?, committed_starts_at = ?, committed_ends_at = ?, accepted_at = ? WHERE organization_id = ? AND id = ? AND status = 'countered'", params: ["committed", startsAt, endsAt ?? null, now, input.organizationId, run.id] },
  ];
  const stopOrder = resultingPlan.requestedStopOrder ?? stops.sort((a, b) => a.sequence - b.sequence).map((stop) => stop.storeId);
  for (const stop of stops) {
    const sequence = stopOrder.indexOf(stop.storeId) + 1;
    statements.push({ sql: "UPDATE ops_route_stops SET sequence = ?, committed_arrival_at = ? WHERE organization_id = ? AND id = ? AND service_run_id = ?", params: [sequence || stop.sequence, storeSweep ? startsAt : addMinutes(stop.proposedArrivalAt, shiftMinutes), input.organizationId, stop.id, run.id] });
  }
  for (const link of links) {
    const removed = resultingPlan.removedWorkOrderIds?.includes(link.workOrderId) ?? false;
    if (removed) statements.push({ sql: "UPDATE ops_service_run_work_orders SET planned = ?, removal_reason = ? WHERE organization_id = ? AND id = ? AND service_run_id = ?", params: [false, response.reasonDetail ?? response.reasonCode ?? "Vendor-requested removal", input.organizationId, link.id, run.id] });
    else if (link.occurrenceId) statements.push({ sql: "UPDATE ops_pm_occurrences SET status = 'scheduled', committed_at = ? WHERE organization_id = ? AND id = ? AND status IN ('proposed', 'unscheduled', 'upcoming', 'due')", params: [startsAt, input.organizationId, link.occurrenceId] });
  }
  for (const workOrder of workOrders) {
    const [tasks, hold, activeAssignment] = await Promise.all([
      repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id),
      repository.getWorkOrderVisitHold(input.organizationId, workOrder.id),
      repository.getActiveAssignment(input.organizationId, workOrder.id),
    ]);
    const runTask = tasks.find((task) => isOpenWorkflowTask(task) && task.taskType === "schedule_service" && (storeSweep ? ["Respond to jobs sent together", "Respond to proposed store visit"].includes(task.title) : task.reason.includes(run.id)));
    const removed = resultingPlan.removedWorkOrderIds?.includes(workOrder.id) ?? false;
    const nextTasks = tasks.map((task) => runTask && task.id === runTask.id ? { ...task, status: "completed" as const, completedAt: now, completedByActorType: input.actor.actorType, completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName, resolutionNote: removed ? "Vendor-requested removal accepted; return to scheduling" : "Vendor counterproposal accepted" } : task);
    if (runTask) statements.push(...buildCompleteWorkflowTaskStatements({ task: runTask, actor: input.actor, occurredAt: now, ids, resolutionNote: removed ? "Vendor-requested removal accepted; return to scheduling" : "Vendor counterproposal accepted" }));
    if (storeSweep && activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === run.vendorId) statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN ('completed','cancelled','superseded','declined')",
      params: [removed ? "declined" : "accepted", input.organizationId, activeAssignment.id, workOrder.id],
    });
    const replacement = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      actor: input.actor, createdAt: now, draft: removed && storeSweep ? {
        taskType: "choose_service_provider", title: "Approved for a future vendor visit",
        reason: `${workOrder.number} was removed from this grouped work request and remains approved.`,
        assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator",
        priority: "normal", blocking: true, requiredForProgress: true, dueAt: hold?.deadlineAt ?? workOrder.dueAt, applicableSlaClock: "scheduling",
        completionCriteria: "Include this job in another planned visit or issue it separately",
        escalationDestination: "Regional facilities manager",
      } : removed ? {
        taskType: "schedule_service", title: "Reschedule work removed from Service Run",
        reason: `Work Order was removed from Service Run ${run.id} through an accepted Vendor counterproposal`,
        assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator",
        priority: "high", blocking: true, requiredForProgress: true, dueAt: addMinutes(now, 240), applicableSlaClock: "scheduling",
        completionCriteria: "Work is committed on another valid Service Run or separately scheduled",
        escalationDestination: "Regional facilities manager",
      } : {
        taskType: "confirm_store_access", title: storeSweep ? "Confirm store access for the planned visit" : "Confirm store access for committed Service Run",
        reason: storeSweep ? `The vendor supplied ${startsAt} as its planned visit date` : `Counterproposal for Service Run ${run.id} was accepted for ${startsAt}`,
        assigneeType: "role", assigneeRole: "store_manager", assigneeName: "Store manager",
        priority: workOrder.priority === "emergency" ? "critical" : "normal", blocking: true,
        requiredForProgress: true, dueAt: addMinutes(startsAt, -60), applicableSlaClock: "scheduling",
        completionCriteria: "Store access and any shutdown requirements are confirmed",
        escalationDestination: "Facilities coordinator",
      },
    });
    statements.push(...buildCreateTaskStatements({ task: replacement, actor: input.actor, ids }));
    statements.push(buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...nextTasks, replacement]));
    if (removed && storeSweep) statements.push({
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('closed','cancelled')",
      params: ["approved", "Facilities coordinator", "Approved for a future vendor visit", hold?.deadlineAt ?? workOrder.dueAt, "Regional facilities manager", input.organizationId, workOrder.id],
    });
    else statements.push({ sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('closed', 'cancelled')", params: [removed ? "waiting_on_vendor" : "scheduled", input.organizationId, workOrder.id] });
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId, aggregateType: "service_run", aggregateId: run.id,
    eventType: "service_run.counter_accepted", actor: input.actor, occurredAt: now,
    payload: { responseId: response.id, originalRecommendation: JSON.parse(run.originalRecommendationJson), finalAcceptedPlan: resultingPlan, committedStartsAt: startsAt, committedEndsAt: endsAt, travelImpactMinutes: response.travelImpactMinutes, dueWindowImpactCount: response.dueWindowImpactCount, economicImpact: response.economicImpact }, ids,
  }));
  await atomicWorkOrderSetMutation({ repository, workOrders, now, statements, conflictMessage: "A bundled Work Order changed while the counterproposal was being accepted" });
  return accepted;
}
