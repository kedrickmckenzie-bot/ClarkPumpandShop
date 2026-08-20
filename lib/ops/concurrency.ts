import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { IsoDateTime, OpsId, ServiceRequest, WorkOrder } from "./types";

const FENCE_EXPIRY = "9999-12-31T23:59:59.999Z";
const WORK_ORDER_FENCE_NAMESPACE = "__ops_internal__";
const LEGACY_WORK_ORDER_FENCE_NAMESPACE = "__traceops_internal__";
const REQUEST_IMPACT_REVIEW_FENCE_NAMESPACE = "__ops_internal__/request-impact-review";
const REQUEST_FENCE_NAMESPACE = "__ops_internal__/request";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function insertFence(input: {
  organizationId: OpsId;
  key: string;
  command: string;
  resultId: OpsId;
  requestHash: string;
  now: IsoDateTime;
}): OpsStatement {
  return {
    sql: "INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, request_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    params: [
      input.organizationId,
      input.key,
      input.command,
      input.resultId,
      input.requestHash,
      input.now,
      FENCE_EXPIRY,
    ],
  };
}

export function persistedWorkOrderVersion(workOrder: WorkOrder) {
  return workOrder.version ?? 0;
}

export function persistedRequestVersion(request: ServiceRequest) {
  return request.version ?? 0;
}

async function requestVersionFence(input: {
  request: ServiceRequest;
  now: IsoDateTime;
}): Promise<OpsStatement> {
  const nextVersion = persistedRequestVersion(input.request) + 1;
  const key = `${REQUEST_FENCE_NAMESPACE}:${input.request.id}:version:${nextVersion}`;
  const requestHash = await sha256Hex(key);
  return {
    // The scalar subquery is an in-transaction affected-row assertion. The
    // preceding conditional version update must have advanced this exact
    // request state; otherwise request_hash becomes NULL and the NOT NULL
    // constraint rolls the whole transaction back before domain facts/audits.
    sql: "INSERT INTO ops_idempotency_keys (organization_id, key, command, result_id, created_at, expires_at, request_hash) VALUES (?, ?, ?, ?, ?, ?, (SELECT ? FROM ops_requests WHERE organization_id = ? AND id = ? AND version = ? AND status = ? AND COALESCE(converted_work_order_id, '') = ?))",
    params: [
      input.request.organizationId,
      key,
      "request.version_fence",
      input.request.id,
      input.now,
      FENCE_EXPIRY,
      requestHash,
      input.request.organizationId,
      input.request.id,
      nextVersion,
      input.request.status,
      input.request.convertedWorkOrderId ?? "",
    ],
  };
}

/**
 * Serializes every state-bearing mutation of a service request. The guarded
 * version update acquires the request row and the following durable fence
 * proves that exactly the observed state advanced before any domain fact or
 * audit event can commit.
 */
export async function atomicRequestMutation(input: {
  repository: OpsRepository;
  request: ServiceRequest;
  now: IsoDateTime;
  statements: readonly OpsStatement[];
  additionalFences?: readonly OpsStatement[];
  conflictMessage?: string;
}) {
  const observedVersion = persistedRequestVersion(input.request);
  const nextVersion = observedVersion + 1;
  const versionStatement: OpsStatement = {
    sql: "UPDATE ops_requests SET version = ? WHERE organization_id = ? AND id = ? AND version = ? AND status = ? AND converted_work_order_id IS NULL",
    params: [
      nextVersion,
      input.request.organizationId,
      input.request.id,
      observedVersion,
      input.request.status,
    ],
  };
  const fence = await requestVersionFence({ request: input.request, now: input.now });
  try {
    await input.repository.atomicWrite([
      versionStatement,
      fence,
      ...(input.additionalFences ?? []),
      ...input.statements,
    ]);
  } catch (error) {
    const current = await input.repository.getRequest(input.request.organizationId, input.request.id);
    const existingFence = await input.repository.getIdempotencyKey(
      input.request.organizationId,
      String(fence.params[1]),
    );
    if (!current
      || persistedRequestVersion(current) !== observedVersion
      || current.status !== input.request.status
      || current.convertedWorkOrderId !== input.request.convertedWorkOrderId
      || existingFence) {
      throw new OpsDomainError(
        "CONFLICT",
        input.conflictMessage ?? "This request changed. Refresh before trying again.",
      );
    }
    throw error;
  }
}

async function workOrderMutationFenceForNamespace(
  workOrder: WorkOrder,
  now: IsoDateTime,
  namespace: string,
): Promise<OpsStatement> {
  const version = persistedWorkOrderVersion(workOrder);
  // Slash deliberately places internal serialization keys outside the public
  // idempotency-key grammar, so a bearer-link caller cannot preclaim a fence.
  const key = `${namespace}/work-order:${workOrder.id}:version:${version}`;
  return insertFence({
    organizationId: workOrder.organizationId,
    key,
    command: "work_order.version_fence",
    resultId: workOrder.id,
    requestHash: await sha256Hex(key),
    now,
  });
}

export function workOrderMutationFence(workOrder: WorkOrder, now: IsoDateTime): Promise<OpsStatement> {
  return workOrderMutationFenceForNamespace(workOrder, now, WORK_ORDER_FENCE_NAMESPACE);
}

async function requestImpactReviewFence(input: {
  organizationId: OpsId;
  requestId: OpsId;
  expectedLatestAssessmentId?: OpsId;
  resultId: OpsId;
  now: IsoDateTime;
}): Promise<OpsStatement> {
  const key = `${REQUEST_IMPACT_REVIEW_FENCE_NAMESPACE}:${input.requestId}:after:${input.expectedLatestAssessmentId ?? "none"}`;
  return insertFence({
    organizationId: input.organizationId,
    key,
    command: "request.impact_review_fence",
    resultId: input.resultId,
    requestHash: await sha256Hex(key),
    now: input.now,
  });
}

/**
 * Serializes manager impact reviews that observed the same latest assessment.
 * The assessment identity is an immutable revision token, so concurrent
 * reviewers cannot both append a successor to the same observed revision.
 */
export async function atomicRequestImpactReview(input: {
  repository: OpsRepository;
  request: ServiceRequest;
  expectedLatestAssessmentId?: OpsId;
  resultId: OpsId;
  now: IsoDateTime;
  statements: readonly OpsStatement[];
}) {
  const fence = await requestImpactReviewFence({
    organizationId: input.request.organizationId,
    requestId: input.request.id,
    expectedLatestAssessmentId: input.expectedLatestAssessmentId,
    resultId: input.resultId,
    now: input.now,
  });
  try {
    await atomicRequestMutation({
      repository: input.repository,
      request: input.request,
      now: input.now,
      additionalFences: [fence],
      statements: input.statements,
      conflictMessage: "The request or its impact assessment changed. Refresh before recording this review",
    });
  } catch (error) {
    const latest = (await input.repository.listRequestImpactAssessments(
      input.request.organizationId,
      input.request.id,
    )).at(-1);
    if ((latest?.id ?? undefined) !== input.expectedLatestAssessmentId) {
      throw new OpsDomainError(
        "CONFLICT",
        "The impact assessment changed. Refresh before recording this review",
      );
    }
    throw error;
  }
}

/**
 * Serializes every state-bearing mutation of one canonical work order. The
 * durable unique fence is inserted in the same transaction as the domain
 * facts, while the monotonic version makes the next legitimate command use a
 * new fence. Concurrent commands based on the same observed version cannot
 * both commit in D1, PostgreSQL, or the fixture adapter.
 */
export async function atomicWorkOrderMutation(input: {
  repository: OpsRepository;
  workOrder: WorkOrder;
  now: IsoDateTime;
  statements: readonly OpsStatement[];
  conflictMessage?: string;
}) {
  const observedVersion = persistedWorkOrderVersion(input.workOrder);
  const [legacyFence, fence] = await Promise.all([
    workOrderMutationFenceForNamespace(
      input.workOrder,
      input.now,
      LEGACY_WORK_ORDER_FENCE_NAMESPACE,
    ),
    workOrderMutationFence(input.workOrder, input.now),
  ]);
  const versionStatement: OpsStatement = {
    sql: "UPDATE ops_work_orders SET version = ? WHERE organization_id = ? AND id = ? AND version = ?",
    params: [observedVersion + 1, input.workOrder.organizationId, input.workOrder.id, observedVersion],
  };
  try {
    await input.repository.atomicWrite([
      // Acquire the legacy fence during rolling deployments so an older
      // process and a neutral-namespace process cannot both mutate the same
      // observed work-order version.
      legacyFence,
      fence,
      ...input.statements,
      versionStatement,
    ]);
  } catch (error) {
    const current = await input.repository.getWorkOrder(input.workOrder.organizationId, input.workOrder.id);
    if (!current || persistedWorkOrderVersion(current) !== observedVersion) {
      throw new OpsDomainError(
        "CONFLICT",
        input.conflictMessage ?? "This work order changed. Refresh before trying again.",
      );
    }
    throw error;
  }
}

/**
 * Serializes one transaction that mutates several canonical work orders, such
 * as a single site-visit checkout with a separately recorded outcome for each
 * selected work order. Every observed work-order version is fenced before any
 * domain statement commits, so the whole visit action succeeds or fails as a
 * unit.
 */
export async function atomicWorkOrderSetMutation(input: {
  repository: OpsRepository;
  workOrders: readonly WorkOrder[];
  now: IsoDateTime;
  statements: readonly OpsStatement[];
  conflictMessage?: string;
}) {
  if (input.workOrders.length === 0) {
    await input.repository.atomicWrite(input.statements);
    return;
  }

  const uniqueWorkOrders = new Map(input.workOrders.map((workOrder) => [workOrder.id, workOrder]));
  if (uniqueWorkOrders.size !== input.workOrders.length) {
    throw new OpsDomainError("VALIDATION", "A work order can be mutated only once in the same transaction");
  }

  const workOrders = [...uniqueWorkOrders.values()];
  const organizationId = workOrders[0]!.organizationId;
  if (workOrders.some((workOrder) => workOrder.organizationId !== organizationId)) {
    throw new OpsDomainError("FORBIDDEN", "Work orders from different organizations cannot share one transaction");
  }

  const fencePairs = await Promise.all(workOrders.map(async (workOrder) => [
    await workOrderMutationFenceForNamespace(workOrder, input.now, LEGACY_WORK_ORDER_FENCE_NAMESPACE),
    await workOrderMutationFence(workOrder, input.now),
  ] as const));
  const observedVersions = new Map(workOrders.map((workOrder) => [workOrder.id, persistedWorkOrderVersion(workOrder)]));
  const versionStatements: OpsStatement[] = workOrders.map((workOrder) => {
    const observedVersion = observedVersions.get(workOrder.id)!;
    return {
      sql: "UPDATE ops_work_orders SET version = ? WHERE organization_id = ? AND id = ? AND version = ?",
      params: [observedVersion + 1, organizationId, workOrder.id, observedVersion],
    };
  });

  try {
    await input.repository.atomicWrite([
      ...fencePairs.flat(),
      ...input.statements,
      ...versionStatements,
    ]);
  } catch (error) {
    const current = await Promise.all(workOrders.map((workOrder) =>
      input.repository.getWorkOrder(organizationId, workOrder.id)));
    if (current.some((workOrder, index) =>
      !workOrder || persistedWorkOrderVersion(workOrder) !== observedVersions.get(workOrders[index]!.id))) {
      throw new OpsDomainError(
        "CONFLICT",
        input.conflictMessage ?? "One of these work orders changed. Refresh before trying again.",
      );
    }
    throw error;
  }
}
