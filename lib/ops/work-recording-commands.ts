import type { OpsCommandServices, OpsIdSource } from "./commands";
import { OpsDomainError } from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import type { OpsRepository, OpsStatement } from "./repository";
import type {
  ActorContext,
  CostLineKind,
  IsoDateTime,
  OpsId,
} from "./types";

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
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
      id: input.ids.next("audit"),
      organization_id: input.organizationId,
      aggregate_type: "work_order",
      aggregate_id: input.aggregateId,
      event_type: input.eventType,
      actor_type: input.actor.actorType,
      actor_id: input.actor.actorId,
      actor_name: input.actor.actorName,
      occurred_at: input.occurredAt,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"),
      organization_id: input.organizationId,
      topic: `ops.${input.eventType}`,
      aggregate_type: "work_order",
      aggregate_id: input.aggregateId,
      payload_json: payloadJson,
      status: "pending",
      available_at: input.occurredAt,
      created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

function commandServices(input: OpsCommandServices) {
  return {
    repository: input.repository,
    now: input.clock?.now() ?? new Date().toISOString(),
    ids: input.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` },
  };
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) {
    throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
  }
}

export interface WorkRecordingIdempotency {
  key: string;
  requestHash: string;
  expiresAt: IsoDateTime;
}

const CLASSIFICATION_COMMAND = "work_order.update_classification.v1";
const COST_COMMAND = "work_order.record_cost.v1";

function idempotencyStatement(input: {
  organizationId: OpsId;
  resultId: OpsId;
  command: string;
  now: IsoDateTime;
  idempotency: WorkRecordingIdempotency;
}): OpsStatement {
  if (!/^[A-Za-z0-9._:-]{16,120}$/u.test(input.idempotency.key)) throw new OpsDomainError("VALIDATION", "Submission key is invalid");
  if (!/^[a-f0-9]{64}$/iu.test(input.idempotency.requestHash)) throw new OpsDomainError("VALIDATION", "Submission request hash is invalid");
  if (input.idempotency.expiresAt <= input.now) throw new OpsDomainError("VALIDATION", "Submission retry window must be in the future");
  return insert("ops_idempotency_keys", {
    organization_id: input.organizationId,
    key: input.idempotency.key,
    command: input.command,
    result_id: input.resultId,
    request_hash: input.idempotency.requestHash.toLowerCase(),
    created_at: input.now,
    expires_at: input.idempotency.expiresAt,
  });
}

async function priorIdempotentResult(
  repository: OpsRepository,
  organizationId: OpsId,
  command: string,
  now: IsoDateTime,
  idempotency?: WorkRecordingIdempotency,
) {
  if (!idempotency) return null;
  const prior = await repository.getIdempotencyKey(organizationId, idempotency.key);
  if (!prior) return null;
  if (prior.command !== command || prior.requestHash !== idempotency.requestHash.toLowerCase()) {
    throw new OpsDomainError("CONFLICT", "This submission key was already used for different work-record details");
  }
  if (prior.expiresAt <= now) throw new OpsDomainError("CONFLICT", "This submission retry window has expired");
  return prior;
}

export interface UpdateWorkOrderClassificationInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  categoryKey?: string;
  assetId?: OpsId;
  componentId?: OpsId;
  note: string;
  idempotency?: WorkRecordingIdempotency;
  actor: ActorContext;
}

export async function updateWorkOrderClassification(
  svc: OpsCommandServices,
  input: UpdateWorkOrderClassificationInput,
) {
  const { repository, now, ids } = commandServices(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  const priorResult = await priorIdempotentResult(repository, input.organizationId, CLASSIFICATION_COMMAND, now, input.idempotency);
  if (priorResult) return { ...workOrder, replayed: true };
  if (input.componentId && !input.assetId) {
    throw new OpsDomainError("VALIDATION", "Choose equipment before selecting a component");
  }

  let categoryKey = input.categoryKey?.trim() || undefined;
  const taxonomyNodes = categoryKey ? await repository.listTaxonomyNodes(input.organizationId) : [];
  let taxonomyNodeId = categoryKey
    ? taxonomyNodes.find((node) => node.active && node.nodeKind === "category" && node.canonicalKey === categoryKey)?.id
    : undefined;
  if (categoryKey && !taxonomyNodeId) {
    throw new OpsDomainError("VALIDATION", "Choose a company-defined service area");
  }
  if (input.assetId) {
    const asset = await repository.getAsset(input.organizationId, input.assetId);
    if (!asset || asset.storeId !== workOrder.storeId) {
      throw new OpsDomainError("VALIDATION", "Equipment must belong to the work-order store");
    }
    if (categoryKey && categoryKey !== asset.categoryKey) {
      throw new OpsDomainError("VALIDATION", "Equipment must belong to the selected service area");
    }
    categoryKey = asset.categoryKey;
    taxonomyNodeId = asset.taxonomyNodeId ?? taxonomyNodes.find((node) => node.active && node.nodeKind === "category" && node.canonicalKey === asset.categoryKey)?.id;
    if (input.componentId) {
      const component = await repository.getComponent(input.organizationId, input.componentId);
      if (!component || component.assetId !== asset.id) {
        throw new OpsDomainError("VALIDATION", "Component must belong to the selected equipment record");
      }
    }
  }
  const note = required(input.note, "Classification note");
  const statements: OpsStatement[] = [
    {
      sql: "UPDATE ops_work_orders SET category_key = ?, taxonomy_node_id = ?, asset_id = ?, component_id = ? WHERE organization_id = ? AND id = ?",
      params: [categoryKey ?? null, taxonomyNodeId ?? null, input.assetId ?? null, input.componentId ?? null, input.organizationId, workOrder.id],
    },
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateId: workOrder.id,
      eventType: "work_order.classification_updated",
      actor: input.actor,
      occurredAt: now,
      payload: {
        note,
        previous: { categoryKey: workOrder.categoryKey, taxonomyNodeId: workOrder.taxonomyNodeId, assetId: workOrder.assetId, componentId: workOrder.componentId },
        current: { categoryKey, taxonomyNodeId, assetId: input.assetId, componentId: input.componentId },
      },
      ids,
    }),
  ];
  if (input.idempotency) statements.unshift(idempotencyStatement({ organizationId: input.organizationId, resultId: workOrder.id, command: CLASSIFICATION_COMMAND, now, idempotency: input.idempotency }));
  try {
    await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  } catch (error) {
    if (await priorIdempotentResult(repository, input.organizationId, CLASSIFICATION_COMMAND, now, input.idempotency)) {
      const persisted = await repository.getWorkOrder(input.organizationId, workOrder.id);
      if (!persisted) throw new OpsDomainError("CONFLICT", "The prior classification result could not be loaded");
      return {
        ...persisted,
        categoryKey: persisted.categoryKey ?? undefined,
        taxonomyNodeId: persisted.taxonomyNodeId ?? undefined,
        assetId: persisted.assetId ?? undefined,
        componentId: persisted.componentId ?? undefined,
        replayed: true,
      };
    }
    throw error;
  }
  return { ...workOrder, categoryKey, taxonomyNodeId: taxonomyNodeId ?? undefined, assetId: input.assetId, componentId: input.componentId, classifiedAt: now };
}

export interface RecordWorkOrderCostInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  kind: CostLineKind;
  description: string;
  amountMinor: number;
  currency?: string;
  serviceDate: string;
  idempotency?: WorkRecordingIdempotency;
  actor: ActorContext;
}

export async function recordWorkOrderCost(
  svc: OpsCommandServices,
  input: RecordWorkOrderCostInput,
) {
  const { repository, now, ids } = commandServices(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  const priorResult = await priorIdempotentResult(repository, input.organizationId, COST_COMMAND, now, input.idempotency);
  if (priorResult) return { id: priorResult.resultId, organizationId: input.organizationId, workOrderId: workOrder.id, replayed: true };
  if (!["labor", "parts", "travel", "materials", "other"].includes(input.kind)) {
    throw new OpsDomainError("VALIDATION", "Recorded work cost type is invalid");
  }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new OpsDomainError("VALIDATION", "Recorded work cost must be greater than zero");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.serviceDate) || !Number.isFinite(Date.parse(`${input.serviceDate}T00:00:00Z`))) {
    throw new OpsDomainError("VALIDATION", "Service date is invalid");
  }
  if (input.serviceDate > now.slice(0, 10)) throw new OpsDomainError("VALIDATION", "Recorded work cost cannot use a future service date");
  const description = required(input.description, "Cost description");
  const id = ids.next("cost");
  const currency = input.currency?.trim().toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/u.test(currency)) throw new OpsDomainError("VALIDATION", "Currency must use a three-letter code");
  const statements: OpsStatement[] = [
    insert("ops_cost_lines", {
      id,
      organization_id: input.organizationId,
      work_order_id: workOrder.id,
      kind: input.kind,
      description,
      amount_minor: input.amountMinor,
      currency,
      service_date: input.serviceDate,
      recorded_at: now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateId: workOrder.id,
      eventType: "work_order.cost_recorded",
      actor: input.actor,
      occurredAt: now,
      payload: { costLineId: id, kind: input.kind, description, amountMinor: input.amountMinor, currency, serviceDate: input.serviceDate, costBasis: "recorded_work_cost" },
      ids,
    }),
  ];
  if (input.idempotency) statements.unshift(idempotencyStatement({ organizationId: input.organizationId, resultId: id, command: COST_COMMAND, now, idempotency: input.idempotency }));
  try {
    await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  } catch (error) {
    const prior = await priorIdempotentResult(repository, input.organizationId, COST_COMMAND, now, input.idempotency);
    if (prior) return { id: prior.resultId, organizationId: input.organizationId, workOrderId: workOrder.id, replayed: true };
    throw error;
  }
  return { id, organizationId: input.organizationId, workOrderId: workOrder.id, kind: input.kind, description, amount: { amountMinor: input.amountMinor, currency }, serviceDate: input.serviceDate, recordedAt: now };
}
