import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { IsoDateTime, OpsId, WorkOrder } from "./types";

const FENCE_EXPIRY = "9999-12-31T23:59:59.999Z";

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

export async function workOrderMutationFence(workOrder: WorkOrder, now: IsoDateTime): Promise<OpsStatement> {
  const version = persistedWorkOrderVersion(workOrder);
  // Slash deliberately places internal serialization keys outside the public
  // idempotency-key grammar, so a bearer-link caller cannot preclaim a fence.
  const key = `__traceops_internal__/work-order:${workOrder.id}:version:${version}`;
  return insertFence({
    organizationId: workOrder.organizationId,
    key,
    command: "work_order.version_fence",
    resultId: workOrder.id,
    requestHash: await sha256Hex(key),
    now,
  });
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
  const fence = await workOrderMutationFence(input.workOrder, input.now);
  const versionStatement: OpsStatement = {
    sql: "UPDATE ops_work_orders SET version = ? WHERE organization_id = ? AND id = ? AND version = ?",
    params: [observedVersion + 1, input.workOrder.organizationId, input.workOrder.id, observedVersion],
  };
  try {
    await input.repository.atomicWrite([
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
