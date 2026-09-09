import { OpsDomainError, type OpsCommandServices } from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import {
  buildReplacePrimaryTaskStatements,
  buildWorkflowTaskRecord,
  selectPrimaryWorkflowTask,
} from "./workflow-task-commands";
import type { OpsStatement } from "./repository";
import type { ActorContext, ServiceAppointment, VendorResponse, WorkOrderPriority } from "./types";
import { resolveInternalAccountability } from "./internal-accountability";

/**
 * Operator-side continuation of an outside vendor's response.
 *
 * A proposed date or a question must never remain free-form message evidence:
 * accepting or countering a date persists a ServiceAppointment, and replying
 * to a question records the reply as auditable correspondence with outbox
 * intent for delivery to the vendor channel. Every statement commits in one
 * atomic write together with its audit event.
 */

export type VendorContinuationDecision =
  | "accept_proposed_date"
  | "counter_proposed_date"
  | "reply_to_question";

const CONTINUATION_ROLES = new Set(["facilities_admin", "regional_manager"]);
const CONTINUATION_DECISIONS = new Set<VendorContinuationDecision>([
  "accept_proposed_date",
  "counter_proposed_date",
  "reply_to_question",
]);
const RESPONSE_TASK_TYPES = new Set(["vendor_response_required", "schedule_service", "confirm_store_access"]);

const RESPONSE_SLA_HOURS: Record<WorkOrderPriority, number> = {
  emergency: 1,
  urgent: 4,
  routine: 24,
  planned: 48,
};

function insert(table: string, values: Record<string, unknown>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

export async function resolveVendorResponse(
  svc: OpsCommandServices,
  input: {
    organizationId: string;
    vendorResponseId: string;
    decision: VendorContinuationDecision;
    scheduledFor?: string;
    message?: string;
    actor: ActorContext;
  },
): Promise<{ appointment?: ServiceAppointment; response: Pick<VendorResponse, "id" | "workOrderId" | "response"> }> {
  const repository = svc.repository;
  const clock = svc.clock ?? { now: () => new Date().toISOString() };
  const now = clock.now();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (!CONTINUATION_DECISIONS.has(input.decision)) {
    throw new OpsDomainError("VALIDATION", "Choose a valid vendor-response action");
  }
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) {
    throw new OpsDomainError("FORBIDDEN", "An authenticated operator is required");
  }
  const membership = await repository.getMembership(input.organizationId, input.actor.actorId);
  if (!membership || membership.status !== "active" || !CONTINUATION_ROLES.has(membership.role)) {
    throw new OpsDomainError("FORBIDDEN", "Facilities or regional authority is required to continue a vendor response");
  }
  const response = await repository.getVendorResponse(input.organizationId, input.vendorResponseId);
  if (!response) throw new OpsDomainError("NOT_FOUND", "Vendor response not found in this organization");
  const [workOrder, activeAssignment, latestIssuance, latestResponse, tasks, existing] = await Promise.all([
    repository.getWorkOrder(input.organizationId, response.workOrderId),
    repository.getActiveAssignment(input.organizationId, response.workOrderId),
    repository.getLatestIssuanceForWorkOrder(input.organizationId, response.workOrderId),
    repository.getLatestVendorResponseForIssuance(input.organizationId, response.issuanceId),
    repository.listWorkflowTasksForWorkOrder(input.organizationId, response.workOrderId),
    repository.listVendorContinuationsForWorkOrder(input.organizationId, response.workOrderId),
  ]);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found in this organization");
  if (["completed_pending_review", "resolved", "closed", "cancelled"].includes(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "This vendor response is no longer actionable because service has moved to closeout");
  }
  if (
    activeAssignment?.id !== response.assignmentId
    || latestIssuance?.id !== response.issuanceId
    || latestResponse?.id !== response.id
  ) {
    throw new OpsDomainError("CONFLICT", "This is not the current vendor response. Refresh the work order before continuing.");
  }
  // A vendor response is a decision point, not three independent buttons.
  // The work-order version fence below makes this cross-action check safe when
  // two operators submit different choices at the same time.
  const actionKey = input.decision === "accept_proposed_date" ? "accept_date" : input.decision === "counter_proposed_date" ? "counter_date" : "reply";
  if (existing.some((row) => row.vendorResponseId === response.id)) {
    throw new OpsDomainError("CONFLICT", "This vendor response has already been handled");
  }
  if (input.decision === "reply_to_question" && !input.message?.trim()) {
    throw new OpsDomainError("VALIDATION", "A vendor question reply needs a message");
  }

  const statements: OpsStatement[] = [];
  let appointment: ServiceAppointment | undefined;

  if (input.decision !== "reply_to_question") {
    if (response.response !== "proposed_date") {
      throw new OpsDomainError("CONFLICT", "Only a proposed-date response can be accepted or countered");
    }
    if (input.decision === "accept_proposed_date" && !response.proposedAt) {
      throw new OpsDomainError("CONFLICT", "The proposed date is missing from the vendor response");
    }
    let startsAt: string;
    if (input.decision === "accept_proposed_date") {
      startsAt = response.proposedAt!;
    } else {
      if (!input.scheduledFor || !Number.isFinite(Date.parse(input.scheduledFor))) {
        throw new OpsDomainError("VALIDATION", "A counter proposal needs a valid scheduled date and time");
      }
      startsAt = new Date(input.scheduledFor).toISOString();
    }
    if (Date.parse(startsAt) <= Date.parse(now)) {
      throw new OpsDomainError("VALIDATION", "The service date and time must be in the future");
    }
    appointment = {
      id: ids.next("appointment"),
      organizationId: input.organizationId,
      workOrderId: response.workOrderId,
      assignmentId: response.assignmentId,
      issuanceId: response.issuanceId,
      sourceVendorResponseId: response.id,
      status: input.decision === "accept_proposed_date" ? "confirmed" : "counter_proposed",
      proposedBy: input.decision === "accept_proposed_date" ? "vendor" : "operator",
      startsAt,
      note: input.message,
      createdByMembershipId: membership.id,
      createdAt: now,
    };
    statements.push(insert("ops_service_appointments", {
      id: appointment.id, organization_id: appointment.organizationId, work_order_id: appointment.workOrderId,
      assignment_id: appointment.assignmentId, issuance_id: appointment.issuanceId,
      source_vendor_response_id: appointment.sourceVendorResponseId, status: appointment.status,
      proposed_by: appointment.proposedBy, starts_at: appointment.startsAt, note: appointment.note,
      created_by_membership_id: appointment.createdByMembershipId, created_at: appointment.createdAt,
    }));
  }

  const eventType =
    input.decision === "accept_proposed_date" ? "vendor_response.date_accepted"
    : input.decision === "counter_proposed_date" ? "vendor_response.date_countered"
    : "vendor_response.question_replied";
  const payload = JSON.stringify({
    vendorResponseId: response.id, decision: input.decision, appointmentId: appointment?.id ?? null,
    scheduledFor: appointment?.startsAt ?? null, message: input.message ?? null,
  });
  statements.push(insert("ops_vendor_continuations", {
    id: ids.next("continuation"), organization_id: input.organizationId, work_order_id: response.workOrderId,
    vendor_response_id: response.id, action: actionKey, message: input.message,
    created_by_membership_id: membership.id, created_at: now,
  }));
  statements.push(insert("ops_audit_events", {
    id: ids.next("audit"), organization_id: input.organizationId, aggregate_type: "vendor_response",
    aggregate_id: response.id, event_type: eventType, actor_type: "user",
    actor_name: input.actor.actorName, occurred_at: now, payload_json: payload,
  }));
  statements.push(insert("ops_outbox_messages", {
    id: ids.next("outbox"), organization_id: input.organizationId,
    topic: `ops.${eventType}`, aggregate_type: "vendor_response", aggregate_id: response.id,
    payload_json: payload, status: "pending", available_at: now, created_at: now, attempt_count: 0,
  }));

  const primaryTask = selectPrimaryWorkflowTask(tasks);
  if (primaryTask && !RESPONSE_TASK_TYPES.has(primaryTask.taskType)) {
    throw new OpsDomainError("CONFLICT", `Complete the current required action (${primaryTask.title}) before handling this vendor response.`);
  }
  const vendor = activeAssignment.vendorId
    ? await repository.getVendor(input.organizationId, activeAssignment.vendorId)
    : null;
  if (!vendor) throw new OpsDomainError("CONFLICT", "The active outside-vendor assignment is incomplete");
  const internalAccountability = await resolveInternalAccountability(repository, workOrder);
  const responseDueAt = new Date(Date.parse(now) + RESPONSE_SLA_HOURS[workOrder.priority] * 60 * 60_000).toISOString();
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"),
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    actor: input.actor,
    createdAt: now,
    draft: input.decision === "accept_proposed_date" ? {
      taskType: "confirm_store_access",
      title: "Arrive for the confirmed service window and check in",
      reason: `${vendor.name} and the operator confirmed the service appointment.`,
      assigneeType: "vendor",
      assigneeId: vendor.id,
      assigneeName: vendor.name,
      priority: workOrder.priority === "emergency" ? "critical" : workOrder.priority === "urgent" ? "high" : "normal",
      blocking: true,
      requiredForProgress: true,
      dueAt: appointment!.startsAt,
      applicableSlaClock: "arrival",
      completionCriteria: "A technician starts an observed visit for this work order at the store.",
      escalationDestination: internalAccountability.assigneeName,
    } : {
      taskType: input.decision === "counter_proposed_date" ? "schedule_service" : "vendor_response_required",
      title: input.decision === "counter_proposed_date"
        ? "Respond to the operator counterproposal"
        : "Confirm the service plan after the operator reply",
      reason: input.decision === "counter_proposed_date"
        ? `The operator proposed ${appointment!.startsAt} to ${vendor.name}.`
        : `The operator answered ${vendor.name}'s service question.`,
      assigneeType: "vendor",
      assigneeId: vendor.id,
      assigneeName: vendor.name,
      priority: workOrder.priority === "emergency" ? "critical" : workOrder.priority === "urgent" ? "high" : "normal",
      blocking: true,
      requiredForProgress: true,
      dueAt: responseDueAt,
      applicableSlaClock: input.decision === "counter_proposed_date" ? "scheduling" : "vendor_response",
      completionCriteria: "The vendor accepts, proposes another date, asks a follow-up question, or declines.",
      escalationDestination: internalAccountability.assigneeName,
    },
  });
  statements.push(
    ...buildReplacePrimaryTaskStatements({
      workOrder,
      tasks,
      replacementTask,
      actor: input.actor,
      occurredAt: now,
      ids,
      resolutionNote: input.decision === "accept_proposed_date"
        ? "Operator accepted the vendor's proposed service date."
        : input.decision === "counter_proposed_date"
          ? "Operator sent a counterproposal to the vendor."
          : "Operator replied to the vendor's question.",
    }),
    {
      sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
      params: [input.decision === "accept_proposed_date" ? "scheduled" : "waiting_on_vendor", input.organizationId, workOrder.id],
    },
  );
  if (input.decision === "accept_proposed_date") {
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["accepted", input.organizationId, activeAssignment.id],
    });
  }

  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "This vendor response was handled by another operator. Refresh the work order to see the current state.",
  });
  return { appointment, response: { id: response.id, workOrderId: response.workOrderId, response: response.response } };
}
