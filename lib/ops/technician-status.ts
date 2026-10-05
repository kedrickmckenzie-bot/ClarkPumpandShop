import type { OpsCommandServices } from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import type { ActorContext, WorkOrder } from "./types";
import { OpsDomainError } from "./errors";
import {
  dispatchAccessAssertion,
  dispatchIdentity,
  insertDispatchRecord,
} from "./internal-dispatch";

export interface TechnicianStatus {
  id: string;
  organizationId: string;
  membershipId: string;
  revision: number;
  status: "heading" | "parts" | "break" | "done";
  workOrderId?: string;
  storeId: string;
  recordedAt: string;
}
export async function recordTechnicianStatus(
  svc: OpsCommandServices,
  input: {
    organizationId: string;
    actor: ActorContext;
    storeId: string;
    status: TechnicianStatus["status"];
    workOrderId?: string;
    expectedRevision: number;
  },
) {
  const r = svc.repository,
    member = input.actor.actorId;
  if (
    input.actor.organizationId !== input.organizationId ||
    input.actor.actorType !== "user" ||
    !member
  )
    throw new OpsDomainError("FORBIDDEN", "Sign in to update your status.");
  if (
    !["heading", "parts", "break", "done"].includes(input.status) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  )
    throw new OpsDomainError("VALIDATION", "Choose a valid status.");
  await dispatchIdentity(r, input.organizationId, member, input.storeId, [
    "internal_technician",
  ]);
  let headingWork: WorkOrder | undefined;
  if (input.status === "heading") {
    const work = input.workOrderId
      ? await r.getWorkOrder(input.organizationId, input.workOrderId)
      : null;
    const assignment = work
      ? await r.getActiveAssignment(input.organizationId, work.id)
      : null;
    if (
      !work ||
      work.storeId !== input.storeId ||
      assignment?.internalMembershipId !== member ||
      [
        "closed",
        "cancelled",
        "resolved",
        "completed_pending_review",
        "waiting_on_parts",
        "waiting_on_vendor",
      ].includes(work.status)
    )
      throw new OpsDomainError(
        "FORBIDDEN",
        "Choose an open job assigned to you.",
      );
    const detail = await r.getWorkOrderDetail(
      { organizationId: input.organizationId },
      work.id,
    );
    if (detail?.followUps.some((f) => f.status === "open"))
      throw new OpsDomainError(
        "CONFLICT",
        "This job needs manager follow-up before another visit.",
      );
    headingWork = work;
  }
  const current = await r.getTechnicianStatus(input.organizationId, member);
  if ((current?.revision ?? 0) !== input.expectedRevision)
    throw new OpsDomainError(
      "CONFLICT",
      "Your status changed. Refresh before saving.",
    );
  const now = svc.clock?.now() ?? new Date().toISOString(),
    id =
      svc.ids?.next("technician-status") ??
      `technician-status-${crypto.randomUUID()}`;
  const result: TechnicianStatus = {
    id,
    organizationId: input.organizationId,
    membershipId: member,
    revision: input.expectedRevision + 1,
    status: input.status,
    workOrderId: input.status === "heading" ? input.workOrderId : undefined,
    storeId: input.storeId,
    recordedAt: now,
  };
  try {
    const statements = [
      dispatchAccessAssertion(
        input.organizationId,
        member,
        input.storeId,
        ["internal_technician"],
        now,
      ),
      insertDispatchRecord("ops_technician_statuses", {
        id,
        organization_id: input.organizationId,
        membership_id: member,
        revision: result.revision,
        status: result.status,
        work_order_id: result.workOrderId,
        store_id: result.storeId,
        recorded_at: now,
      }),
      insertDispatchRecord("ops_audit_events", {
        id: `audit-${id}`,
        organization_id: input.organizationId,
        aggregate_type: "technician",
        aggregate_id: member,
        event_type: "technician.status_recorded",
        actor_type: "user",
        actor_id: member,
        actor_name: input.actor.actorName,
        occurred_at: now,
        payload_json: JSON.stringify(result),
      }),
    ];
    if (headingWork)
      await atomicWorkOrderMutation({
        repository: r,
        workOrder: headingWork,
        now,
        statements,
      });
    else await r.atomicWrite(statements);
  } catch (error) {
    if (
      (await r.getTechnicianStatus(input.organizationId, member))?.revision !==
      input.expectedRevision
    )
      throw new OpsDomainError(
        "CONFLICT",
        "Your status changed. Refresh before saving.",
      );
    throw error;
  }
  return result;
}
