import { OpsDomainError, type OpsCommandServices } from "./commands";
import type { ServiceAppointment, VendorResponse } from "./types";

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

const CONTINUATION_ROLES = new Set(["facilities_admin", "executive", "regional_manager"]);

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
    actor: { organizationId: string; actorType: "user"; actorId: string; actorName: string };
  },
): Promise<{ appointment?: ServiceAppointment; response: Pick<VendorResponse, "id" | "workOrderId" | "response"> }> {
  const repository = svc.repository;
  const clock = svc.clock ?? { now: () => new Date().toISOString() };
  const now = clock.now();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) {
    throw new OpsDomainError("FORBIDDEN", "An authenticated operator is required");
  }
  const membership = await repository.getMembership(input.organizationId, input.actor.actorId);
  if (!membership || membership.status !== "active" || !CONTINUATION_ROLES.has(membership.role)) {
    throw new OpsDomainError("FORBIDDEN", "Facilities, regional, or executive authority is required to continue a vendor response");
  }
  const response = await repository.getVendorResponse(input.organizationId, input.vendorResponseId);
  if (!response) throw new OpsDomainError("NOT_FOUND", "Vendor response not found in this organization");
  if (input.decision === "reply_to_question" && !input.message?.trim()) {
    throw new OpsDomainError("VALIDATION", "A vendor question reply needs a message");
  }

  const statements: { sql: string; params: unknown[] }[] = [];
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

  await repository.atomicWrite(statements);
  return { appointment, response: { id: response.id, workOrderId: response.workOrderId, response: response.response } };
}
