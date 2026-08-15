import {
  OpsDomainError,
  type OpsClock,
  type OpsCommandServices,
  type OpsIdSource,
} from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import type { OpsRepository, OpsStatement } from "./repository";
import type {
  ActorContext,
  EstimateRequestChannel,
  EstimateRequestKind,
  EstimateRequestStatus,
  IsoDateTime,
  OpsId,
  VendorEstimateProposal,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderEstimateRequest,
} from "./types";

export type EstimateCommandServices = OpsCommandServices;

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const terminalWorkOrderStatuses = new Set(["closed", "cancelled"]);
const activeEstimateRequestStatuses = new Set<EstimateRequestStatus>(["requested", "opened", "submitted"]);
const liveOutsideServiceAssignmentStatuses = new Set(["issued", "opened", "accepted"]);
const selectableBlockedWorkOrderStatuses = new Set(["in_progress", "completed_pending_review", "closed", "cancelled"]);
const requestKinds = new Set<EstimateRequestKind>(["estimate_only", "diagnostic_and_estimate"]);
const requestChannels = new Set<EstimateRequestChannel>(["email", "sms", "manual"]);
const MAX_MONEY_MINOR = 999_999_999_999;
const MAX_SCOPE_LENGTH = 4_000;
const MAX_NOTE_LENGTH = 2_000;

function services(input: EstimateCommandServices) {
  return {
    repository: input.repository,
    clock: input.clock ?? systemClock,
    ids: input.ids ?? randomIds,
  };
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) {
    throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
  }
}

function required(value: string, label: string, maxLength: number) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  if (clean.length > maxLength) throw new OpsDomainError("VALIDATION", `${label} is too long`);
  return clean;
}

function optionalText(value: string | undefined, label: string, maxLength: number) {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (clean.length > maxLength) throw new OpsDomainError("VALIDATION", `${label} is too long`);
  return clean;
}

function validInstant(value: IsoDateTime, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
  return value;
}

function futureInstant(value: IsoDateTime, now: IsoDateTime, label: string) {
  validInstant(value, label);
  if (Date.parse(value) <= Date.parse(now)) throw new OpsDomainError("VALIDATION", `${label} must be in the future`);
  return value;
}

function currency(value: string) {
  const clean = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(clean)) throw new OpsDomainError("VALIDATION", "Bid currency must be a three-letter code");
  return clean;
}

function amountMinor(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_MONEY_MINOR) {
    throw new OpsDomainError("VALIDATION", "Bid amount must be a positive safe integer in minor units");
  }
  return value;
}

function expectedRevision(value: number, allowZero: boolean) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new OpsDomainError("VALIDATION", `Expected bid revision must be an integer of at least ${minimum}`);
  }
  return value;
}

function assertTokenHash(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new OpsDomainError("VALIDATION", "Bid-request token SHA-256 is invalid");
  return value.toLowerCase();
}

function json(value: unknown) {
  return JSON.stringify(value);
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
      id: input.ids.next("audit"),
      organization_id: input.organizationId,
      aggregate_type: input.aggregateType,
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
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      payload_json: payloadJson,
      status: "pending",
      available_at: input.occurredAt,
      created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

export interface VendorEstimateTokenInput {
  organizationId: OpsId;
  estimateRequestId: OpsId;
  vendorId: OpsId;
  tokenHash: string;
  actor: ActorContext;
}

async function resolveVendorEstimateRequest(
  repository: OpsRepository,
  now: IsoDateTime,
  input: VendorEstimateTokenInput,
) {
  assertActorOrganization(input.actor, input.organizationId);
  if (input.actor.actorType !== "vendor_link") {
    throw new OpsDomainError("FORBIDDEN", "Vendor bid actions require a secure bid-request link");
  }
  const capability = await repository.getEstimateRequestByPublicToken({
    tokenHash: assertTokenHash(input.tokenHash),
    purpose: "vendor_estimate",
    now,
    vendorId: input.vendorId,
  });
  const capabilityRequest = capability?.request;
  if (
    !capabilityRequest
    || capabilityRequest.organizationId !== input.organizationId
    || capabilityRequest.id !== input.estimateRequestId
    || capabilityRequest.vendorId !== input.vendorId
  ) {
    throw new OpsDomainError("FORBIDDEN", "Bid-request link is invalid, expired, consumed, or not valid for this vendor");
  }
  const request = await repository.getEstimateRequest(capabilityRequest.organizationId, capabilityRequest.id);
  if (!request || request.vendorId !== capabilityRequest.vendorId || request.workOrderId !== capabilityRequest.workOrderId) {
    throw new OpsDomainError("FORBIDDEN", "Bid request no longer matches the vendor capability");
  }
  return { request, tokenId: capability.tokenId, tokenExpiresAt: capability.expiresAt };
}

async function requireEstimateWorkOrder(
  repository: OpsRepository,
  request: WorkOrderEstimateRequest,
): Promise<WorkOrder> {
  const workOrder = await repository.getWorkOrder(request.organizationId, request.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Canonical work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot accept a bid response");
  }
  return workOrder;
}

async function atomicEstimateWorkOrderMutation(input: {
  repository: OpsRepository;
  workOrder: WorkOrder;
  now: IsoDateTime;
  statements: readonly OpsStatement[];
  conflictMessage?: string;
}) {
  await atomicWorkOrderMutation({
    repository: input.repository,
    workOrder: input.workOrder,
    now: input.now,
    statements: input.statements,
    conflictMessage: input.conflictMessage ?? "This bid request or its work order changed. Refresh before trying again.",
  });
}

export interface RequestEstimateInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  kind: EstimateRequestKind;
  decisionKind?: WorkOrderEstimateRequest["decisionKind"];
  requestedScope: string;
  channel: EstimateRequestChannel;
  dueAt: IsoDateTime;
  publicToken: { tokenHash: string; expiresAt: IsoDateTime };
  actor: ActorContext;
}

export async function requestEstimate(svc: EstimateCommandServices, input: RequestEstimateInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [workOrder, vendor] = await Promise.all([
    repository.getWorkOrder(input.organizationId, input.workOrderId),
    repository.getVendor(input.organizationId, input.vendorId),
  ]);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Canonical work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "Closed or cancelled work cannot receive a bid request");
  }
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Approved vendor is required");
  if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, workOrder.storeId))) {
    throw new OpsDomainError("FORBIDDEN", "Vendor does not cover this work-order store");
  }
  if (!requestKinds.has(input.kind)) throw new OpsDomainError("VALIDATION", "Bid-request kind is invalid");
  if (input.decisionKind && !["service_bid", "replacement_quote"].includes(input.decisionKind)) throw new OpsDomainError("VALIDATION", "Bid decision kind is invalid");
  if (!requestChannels.has(input.channel)) throw new OpsDomainError("VALIDATION", "Bid-request channel is invalid");
  const now = clock.now();
  const scope = required(input.requestedScope, "Bid scope", MAX_SCOPE_LENGTH);
  if (!input.dueAt) throw new OpsDomainError("VALIDATION", "Bid response due date is required");
  const dueAt = futureInstant(input.dueAt, now, "Bid response due date");
  const tokenHash = assertTokenHash(input.publicToken.tokenHash);
  const expiresAt = futureInstant(input.publicToken.expiresAt, now, "Bid-request link expiry");
  if (Date.parse(expiresAt) < Date.parse(dueAt)) {
    throw new OpsDomainError("VALIDATION", "Bid-request link must remain valid through the response due date");
  }
  const [existing, activeAssignment, workDetail] = await Promise.all([
    repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id),
    repository.getActiveAssignment(input.organizationId, workOrder.id),
    repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
  ]);
  if (
    activeAssignment?.kind === "outside_vendor"
    && liveOutsideServiceAssignmentStatuses.has(activeAssignment.status)
  ) {
    throw new OpsDomainError(
      "CONFLICT",
      "Active service authorization must be explicitly ended before requesting vendor bids",
    );
  }
  if (workDetail?.visits.some((visit) => visit.status === "active")) {
    throw new OpsDomainError("CONFLICT", "Vendor bids cannot be requested while a technician is onsite");
  }
  if (existing.some((request) => request.status === "selected")) {
    throw new OpsDomainError("CONFLICT", "This work order already has a selected provider. Reopen that decision before requesting another bid.");
  }
  if (existing.some((request) => request.vendorId === vendor.id && activeEstimateRequestStatuses.has(request.status))) {
    throw new OpsDomainError("CONFLICT", "This vendor already has an active bid request for the work order");
  }

  const requestId = ids.next("estimate-request");
  const tokenId = ids.next("public-token");
  const request: WorkOrderEstimateRequest = {
    id: requestId,
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    vendorId: vendor.id,
    kind: input.kind,
    decisionKind: input.decisionKind ?? "service_bid",
    requestedScope: scope,
    status: "requested",
    channel: input.channel,
    requestedAt: now,
    dueAt,
  };
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    insert("ops_work_order_estimate_requests", {
      id: request.id,
      organization_id: request.organizationId,
      work_order_id: request.workOrderId,
      vendor_id: request.vendorId,
      kind: request.kind,
      decision_kind: request.decisionKind,
      requested_scope: request.requestedScope,
      status: request.status,
      channel: request.channel,
      requested_at: request.requestedAt,
      due_at: request.dueAt,
    }),
    insert("ops_public_tokens", {
      id: tokenId,
      organization_id: request.organizationId,
      purpose: "vendor_estimate",
      subject_type: "work_order_estimate_request",
      subject_id: request.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: now,
    }),
    ...auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order_estimate_request",
      aggregateId: request.id,
      eventType: "work_order_estimate.requested",
      actor: input.actor,
      occurredAt: now,
      payload: {
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.number,
        vendorId: vendor.id,
        kind: request.kind,
        channel: request.channel,
        dueAt: request.dueAt,
        tokenId,
        tokenExpiresAt: expiresAt,
      },
      ids,
    }),
  ] });
  return { request, tokenId, tokenExpiresAt: expiresAt };
}

export type MarkEstimateOpenedInput = VendorEstimateTokenInput;

export async function markEstimateOpened(svc: EstimateCommandServices, input: MarkEstimateOpenedInput) {
  const { repository, clock, ids } = services(svc);
  const now = clock.now();
  const { request } = await resolveVendorEstimateRequest(repository, now, input);
  if (request.status === "opened") return { request, changed: false };
  if (request.status !== "requested") {
    throw new OpsDomainError("CONFLICT", "Only a newly created bid request can transition to opened");
  }
  if (request.dueAt && Date.parse(request.dueAt) <= Date.parse(now)) {
    throw new OpsDomainError("CONFLICT", "This bid response deadline has passed");
  }
  const workOrder = await requireEstimateWorkOrder(repository, request);
  const opened: WorkOrderEstimateRequest = { ...request, status: "opened", openedAt: now };
  try {
    await atomicEstimateWorkOrderMutation({
      repository,
      workOrder,
      now,
      statements: [
      {
        sql: "UPDATE ops_work_order_estimate_requests SET status = ?, opened_at = ? WHERE organization_id = ? AND id = ? AND vendor_id = ? AND status = ?",
        params: ["opened", now, request.organizationId, request.id, request.vendorId, "requested"],
      },
      ...auditAndOutbox({
        organizationId: request.organizationId,
        aggregateType: "work_order_estimate_request",
        aggregateId: request.id,
        eventType: "work_order_estimate.opened",
        actor: input.actor,
        occurredAt: now,
        payload: { workOrderId: request.workOrderId, vendorId: request.vendorId },
        ids,
      }),
      ],
    });
  } catch (error) {
    if (error instanceof OpsDomainError && error.code === "CONFLICT") {
      const current = await repository.getEstimateRequest(request.organizationId, request.id);
      if (
        current?.status === "opened"
        && current.vendorId === request.vendorId
        && current.workOrderId === request.workOrderId
      ) return { request: current, changed: false };
    }
    throw error;
  }
  return { request: opened, changed: true };
}

export interface SubmitEstimateInput extends VendorEstimateTokenInput {
  expectedRevision: number;
  amountMinor: number;
  currency: string;
  scope: string;
  exclusions?: string;
  leadTimeDays?: number;
  validUntil?: IsoDateTime;
}

export async function submitEstimate(svc: EstimateCommandServices, input: SubmitEstimateInput) {
  const { repository, clock, ids } = services(svc);
  const now = clock.now();
  const { request } = await resolveVendorEstimateRequest(repository, now, input);
  if (!activeEstimateRequestStatuses.has(request.status)) {
    throw new OpsDomainError("CONFLICT", "This bid request no longer accepts proposals");
  }
  if (request.dueAt && Date.parse(request.dueAt) <= Date.parse(now)) {
    throw new OpsDomainError("CONFLICT", "This bid response deadline has passed");
  }
  const workOrder = await requireEstimateWorkOrder(repository, request);
  const latest = await repository.getLatestEstimateProposal(request.organizationId, request.id);
  const currentRevision = latest?.revision ?? 0;
  expectedRevision(input.expectedRevision, true);
  if (input.expectedRevision !== currentRevision) {
    throw new OpsDomainError("CONFLICT", "The bid changed. Refresh before submitting another revision");
  }
  if (request.status === "submitted" && !latest) {
    throw new OpsDomainError("CONFLICT", "Submitted bid request is missing its immutable proposal revision");
  }
  const cleanAmount = amountMinor(input.amountMinor);
  const cleanCurrency = currency(input.currency);
  const scope = required(input.scope, "Bid scope", MAX_SCOPE_LENGTH);
  const exclusions = optionalText(input.exclusions, "Bid exclusions", MAX_SCOPE_LENGTH);
  if (input.leadTimeDays !== undefined && (!Number.isSafeInteger(input.leadTimeDays) || input.leadTimeDays < 0 || input.leadTimeDays > 3_650)) {
    throw new OpsDomainError("VALIDATION", "Bid lead time must be a whole number from 0 to 3,650 days");
  }
  const validUntil = input.validUntil ? futureInstant(input.validUntil, now, "Bid validity date") : undefined;
  const proposal: VendorEstimateProposal = {
    id: ids.next("estimate-proposal"),
    organizationId: request.organizationId,
    requestId: request.id,
    workOrderId: request.workOrderId,
    vendorId: request.vendorId,
    revision: currentRevision + 1,
    amount: { amountMinor: cleanAmount, currency: cleanCurrency },
    scope,
    exclusions,
    leadTimeDays: input.leadTimeDays,
    validUntil,
    submittedAt: now,
  };
  const submitted: WorkOrderEstimateRequest = { ...request, status: "submitted", respondedAt: now };
  await atomicEstimateWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements: [
    insert("ops_vendor_estimate_proposals", {
      id: proposal.id,
      organization_id: proposal.organizationId,
      request_id: proposal.requestId,
      work_order_id: proposal.workOrderId,
      vendor_id: proposal.vendorId,
      revision: proposal.revision,
      amount_minor: proposal.amount.amountMinor,
      currency: proposal.amount.currency,
      scope: proposal.scope,
      exclusions: proposal.exclusions,
      lead_time_days: proposal.leadTimeDays,
      valid_until: proposal.validUntil,
      submitted_at: proposal.submittedAt,
    }),
    {
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, responded_at = ? WHERE organization_id = ? AND id = ? AND vendor_id = ? AND status = ?",
      params: ["submitted", now, request.organizationId, request.id, request.vendorId, request.status],
    },
    ...auditAndOutbox({
      organizationId: proposal.organizationId,
      aggregateType: "vendor_estimate_proposal",
      aggregateId: proposal.id,
      eventType: "vendor_estimate.submitted",
      actor: input.actor,
      occurredAt: now,
      payload: {
        requestId: request.id,
        workOrderId: request.workOrderId,
        vendorId: request.vendorId,
        revision: proposal.revision,
        amountMinor: proposal.amount.amountMinor,
        currency: proposal.amount.currency,
        validUntil: proposal.validUntil,
      },
      ids,
    }),
    ],
    conflictMessage: "The bid request changed. Refresh before submitting another bid revision.",
  });
  return { request: submitted, proposal };
}

export interface DeclineEstimateInput extends VendorEstimateTokenInput {
  expectedRevision: number;
  reason: string;
}

export async function declineEstimate(svc: EstimateCommandServices, input: DeclineEstimateInput) {
  const { repository, clock, ids } = services(svc);
  const now = clock.now();
  const { request, tokenId } = await resolveVendorEstimateRequest(repository, now, input);
  if (!activeEstimateRequestStatuses.has(request.status)) {
    throw new OpsDomainError("CONFLICT", "This bid request no longer accepts a decline response");
  }
  const workOrder = await requireEstimateWorkOrder(repository, request);
  const latest = await repository.getLatestEstimateProposal(request.organizationId, request.id);
  const currentRevision = latest?.revision ?? 0;
  expectedRevision(input.expectedRevision, true);
  if (input.expectedRevision !== currentRevision) {
    throw new OpsDomainError("CONFLICT", "The bid changed. Refresh before declining the request");
  }
  const reason = required(input.reason, "Decline reason", MAX_NOTE_LENGTH);
  const declined: WorkOrderEstimateRequest = { ...request, status: "declined", respondedAt: now, decisionAt: now };
  await atomicEstimateWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements: [
    {
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, responded_at = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND vendor_id = ? AND status = ?",
      params: ["declined", now, now, request.organizationId, request.id, request.vendorId, request.status],
    },
    {
      sql: "UPDATE ops_public_tokens SET used_at = ? WHERE organization_id = ? AND id = ? AND purpose = ? AND subject_type = ? AND subject_id = ?",
      params: [now, request.organizationId, tokenId, "vendor_estimate", "work_order_estimate_request", request.id],
    },
    ...auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order_estimate_request",
      aggregateId: request.id,
      eventType: "work_order_estimate.declined",
      actor: input.actor,
      occurredAt: now,
      payload: {
        workOrderId: request.workOrderId,
        vendorId: request.vendorId,
        latestProposalRevision: currentRevision,
        reason,
      },
      ids,
    }),
    ],
  });
  return { request: declined };
}

export interface WithdrawEstimateInput {
  organizationId: OpsId;
  estimateRequestId: OpsId;
  expectedRevision: number;
  note: string;
  actor: ActorContext;
}

export async function withdrawEstimate(svc: EstimateCommandServices, input: WithdrawEstimateInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const request = await repository.getEstimateRequest(input.organizationId, input.estimateRequestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Bid request not found");
  if (!activeEstimateRequestStatuses.has(request.status)) {
    throw new OpsDomainError("CONFLICT", "Only an active bid request can be withdrawn");
  }
  const workOrder = await requireEstimateWorkOrder(repository, request);
  const latest = await repository.getLatestEstimateProposal(request.organizationId, request.id);
  const currentRevision = latest?.revision ?? 0;
  expectedRevision(input.expectedRevision, true);
  if (input.expectedRevision !== currentRevision) {
    throw new OpsDomainError("CONFLICT", "The bid changed. Refresh before withdrawing this request");
  }
  const note = required(input.note, "Withdrawal note", MAX_NOTE_LENGTH);
  const now = clock.now();
  const withdrawn: WorkOrderEstimateRequest = { ...request, status: "withdrawn", decisionAt: now };
  await atomicEstimateWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements: [
    {
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["withdrawn", now, request.organizationId, request.id, request.status],
    },
    {
      sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ?",
      params: [now, request.organizationId, "vendor_estimate", "work_order_estimate_request", request.id],
    },
    ...auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order_estimate_request",
      aggregateId: request.id,
      eventType: "work_order_estimate.withdrawn",
      actor: input.actor,
      occurredAt: now,
      payload: { workOrderId: request.workOrderId, vendorId: request.vendorId, note },
      ids,
    }),
    ],
  });
  return { request: withdrawn };
}

export interface ReopenEstimateSelectionInput {
  organizationId: OpsId;
  estimateRequestId: OpsId;
  expectedRevision: number;
  note: string;
  actor: ActorContext;
}

export async function reopenEstimateSelection(
  svc: EstimateCommandServices,
  input: ReopenEstimateSelectionInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  expectedRevision(input.expectedRevision, false);
  const request = await repository.getEstimateRequest(input.organizationId, input.estimateRequestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Selected bid request not found");
  if (request.status !== "selected") {
    throw new OpsDomainError("CONFLICT", "Only the currently selected bid can be reopened");
  }
  const workOrder = await requireEstimateWorkOrder(repository, request);
  const [latestProposal, activeAssignment, priorIssuances] = await Promise.all([
    repository.getLatestEstimateProposal(input.organizationId, request.id),
    repository.getActiveAssignment(input.organizationId, workOrder.id),
    repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
  ]);
  if (!latestProposal || latestProposal.revision !== input.expectedRevision) {
    throw new OpsDomainError("CONFLICT", "The selected bid changed. Refresh before reopening the decision");
  }
  if (activeAssignment && ["issued", "opened", "accepted"].includes(activeAssignment.status)) {
    throw new OpsDomainError("CONFLICT", "Decline or cancel the current service authorization before reopening the vendor decision");
  }
  if (activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId !== request.vendorId) {
    throw new OpsDomainError("CONFLICT", "The active provider no longer matches the selected bid");
  }
  const note = required(input.note, "Reopen reason", MAX_NOTE_LENGTH);
  const now = clock.now();
  const statements: OpsStatement[] = [
    {
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["not_selected", now, request.organizationId, request.id, "selected"],
    },
  ];
  if (activeAssignment) {
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["superseded", request.organizationId, activeAssignment.id, activeAssignment.status],
    });
  }
  for (const issuance of priorIssuances) {
    statements.push({
      sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
      params: [now, request.organizationId, "service_authorization", "work_order_issuance", issuance.id],
    });
  }
  statements.push(
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["awaiting_approval", "Facilities coordinator", "Review vendor bids and select a service provider", request.organizationId, workOrder.id, workOrder.status],
    },
    ...auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order_estimate_request",
      aggregateId: request.id,
      eventType: "work_order_estimate.selection_reopened",
      actor: input.actor,
      occurredAt: now,
      payload: {
        workOrderId: workOrder.id,
        vendorId: request.vendorId,
        proposalId: latestProposal.id,
        proposalRevision: latestProposal.revision,
        supersededAssignmentId: activeAssignment?.id,
        note,
      },
      ids,
    }),
  );
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "The work order or selected bid changed. Refresh before reopening the decision.",
  });
  return {
    request: { ...request, status: "not_selected" as const, decisionAt: now },
    proposal: latestProposal,
    supersededAssignmentId: activeAssignment?.id,
  };
}

export interface SelectEstimateInput {
  organizationId: OpsId;
  estimateRequestId: OpsId;
  proposalId: OpsId;
  expectedRevision: number;
  note: string;
  actor: ActorContext;
}

export async function selectEstimate(svc: EstimateCommandServices, input: SelectEstimateInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  expectedRevision(input.expectedRevision, false);
  const request = await repository.getEstimateRequest(input.organizationId, input.estimateRequestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Bid request not found");
  if (!["submitted", "not_selected"].includes(request.status)) {
    throw new OpsDomainError("CONFLICT", "Only a submitted bid can be selected or reconsidered");
  }
  const workOrder = await repository.getWorkOrder(input.organizationId, request.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Canonical work order not found");
  if (selectableBlockedWorkOrderStatuses.has(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "Work in progress, completed, closed, or cancelled cannot change vendors through bid selection");
  }
  const selectedVendor = await repository.getVendor(input.organizationId, request.vendorId);
  if (!selectedVendor || selectedVendor.status !== "approved") {
    throw new OpsDomainError("CONFLICT", "This vendor is no longer approved and cannot be selected");
  }
  if (!(await repository.vendorCoversStore(input.organizationId, selectedVendor.id, workOrder.storeId))) {
    throw new OpsDomainError("CONFLICT", "This vendor no longer covers the work-order store");
  }
  const [latestProposal, requests, workDetail, activeAssignment, latestIssuance, priorIssuances] = await Promise.all([
    repository.getLatestEstimateProposal(input.organizationId, request.id),
    repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id),
    repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
    repository.getActiveAssignment(input.organizationId, workOrder.id),
    repository.getLatestIssuanceForWorkOrder(input.organizationId, workOrder.id),
    repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
  ]);
  if (!latestProposal) throw new OpsDomainError("CONFLICT", "Submitted bid is missing its immutable proposal");
  if (!workDetail) throw new OpsDomainError("NOT_FOUND", "Canonical work-order detail not found");
  if (latestProposal.id !== input.proposalId || latestProposal.revision !== input.expectedRevision) {
    throw new OpsDomainError("CONFLICT", "Select the latest submitted bid revision");
  }
  if (
    latestProposal.organizationId !== request.organizationId
    || latestProposal.requestId !== request.id
    || latestProposal.workOrderId !== request.workOrderId
    || latestProposal.vendorId !== request.vendorId
  ) {
    throw new OpsDomainError("CONFLICT", "Bid proposal does not match its vendor request and canonical work order");
  }
  if (
    !Number.isSafeInteger(latestProposal.amount.amountMinor)
    || latestProposal.amount.amountMinor <= 0
    || latestProposal.amount.amountMinor > MAX_MONEY_MINOR
    || !/^[A-Z]{3}$/.test(latestProposal.amount.currency)
    || !latestProposal.scope.trim()
    || latestProposal.scope.length > MAX_SCOPE_LENGTH
    || (latestProposal.leadTimeDays !== undefined
      && (!Number.isSafeInteger(latestProposal.leadTimeDays)
        || latestProposal.leadTimeDays < 0
        || latestProposal.leadTimeDays > 3_650))
  ) {
    throw new OpsDomainError("CONFLICT", "The latest bid revision contains invalid selection evidence");
  }
  const now = clock.now();
  if (latestProposal.validUntil) {
    if (!Number.isFinite(Date.parse(latestProposal.validUntil))) {
      throw new OpsDomainError("CONFLICT", "The latest bid revision has an invalid validity date");
    }
    if (Date.parse(latestProposal.validUntil) <= Date.parse(now)) {
      throw new OpsDomainError("CONFLICT", "This bid revision is no longer valid");
    }
  }
  if (workDetail.visits.some((visit) => visit.status === "active")) {
    throw new OpsDomainError("CONFLICT", "Finish the active visit before selecting another vendor bid");
  }
  if (activeAssignment && ["issued", "opened", "accepted"].includes(activeAssignment.status)) {
    throw new OpsDomainError("CONFLICT", "The current service authorization must be declined or cancelled before selecting another vendor");
  }
  if (requests.some((candidate) => candidate.id !== request.id && candidate.status === "selected")) {
    throw new OpsDomainError("CONFLICT", "This work order already has a selected bid");
  }
  const note = required(input.note, "Selection note", MAX_NOTE_LENGTH);
  const competing = requests.filter(
    (candidate) => candidate.id !== request.id && activeEstimateRequestStatuses.has(candidate.status),
  );
  const createsServiceAssignment = request.decisionKind !== "replacement_quote";
  const assignmentId = createsServiceAssignment ? ids.next("assignment") : undefined;
  const assignment: WorkOrderAssignment | undefined = assignmentId ? {
    id: assignmentId,
    organizationId: request.organizationId,
    workOrderId: request.workOrderId,
    kind: "outside_vendor",
    vendorId: request.vendorId,
    status: "pending",
    assignedAt: now,
    supersedesAssignmentId: activeAssignment?.id,
  } : undefined;
  const selected: WorkOrderEstimateRequest = { ...request, status: "selected", decisionAt: now };
  const statements: OpsStatement[] = [
    {
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND vendor_id = ? AND status = ?",
      params: ["selected", now, request.organizationId, request.id, request.vendorId, request.status],
    },
  ];
  for (const candidate of competing) {
    statements.push({
      sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: ["not_selected", now, candidate.organizationId, candidate.id, candidate.status],
    });
  }
  for (const candidate of requests) {
    statements.push({
      sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ?",
      params: [now, candidate.organizationId, "vendor_estimate", "work_order_estimate_request", candidate.id],
    });
  }
  for (const issuance of priorIssuances) {
    statements.push({
      sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
      params: [now, request.organizationId, "service_authorization", "work_order_issuance", issuance.id],
    });
  }
  if (createsServiceAssignment && activeAssignment) {
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status = ?",
      params: ["superseded", request.organizationId, activeAssignment.id, workOrder.id, activeAssignment.status],
    });
  }
  if (assignment) statements.push(insert("ops_work_order_assignments", {
    id: assignment.id,
    organization_id: assignment.organizationId,
    work_order_id: assignment.workOrderId,
    kind: assignment.kind,
    vendor_id: assignment.vendorId,
    status: assignment.status,
    assigned_at: assignment.assignedAt,
    supersedes_assignment_id: assignment.supersedesAssignmentId,
  }));
  statements.push(
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ? AND status = ?",
      params: createsServiceAssignment
        ? ["approved", "Facilities coordinator", "Generate service authorization", request.organizationId, workOrder.id, workOrder.status]
        : ["awaiting_approval", "Facilities coordinator", "Review replacement quote and record capital decision", request.organizationId, workOrder.id, workOrder.status],
    },
    ...auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order_estimate_request",
      aggregateId: request.id,
      eventType: "work_order_estimate.selected",
      actor: input.actor,
      occurredAt: now,
      payload: {
        workOrderId: workOrder.id,
        vendorId: request.vendorId,
        proposalId: latestProposal.id,
        proposalRevision: latestProposal.revision,
        amountMinor: latestProposal.amount.amountMinor,
        currency: latestProposal.amount.currency,
        assignmentId,
        decisionKind: request.decisionKind ?? "service_bid",
        supersededAssignmentId: activeAssignment?.id,
        supersededIssuanceId: latestIssuance?.id,
        notSelectedRequestIds: competing.map((candidate) => candidate.id),
        note,
      },
      ids,
    }),
    ...(assignment ? auditAndOutbox({
      organizationId: request.organizationId,
      aggregateType: "work_order",
      aggregateId: workOrder.id,
      eventType: "work_order.assigned",
      actor: input.actor,
      occurredAt: now,
      payload: {
        assignmentId,
        supersedesAssignmentId: activeAssignment?.id,
        kind: "outside_vendor",
        vendorId: request.vendorId,
        source: "selected_estimate",
        estimateRequestId: request.id,
        estimateProposalId: latestProposal.id,
      },
      ids,
    }) : []),
  );
  try {
    await atomicWorkOrderMutation({
      repository,
      workOrder,
      now,
      statements,
      conflictMessage: "This work order changed while the vendor decision was being recorded. Refresh and review the active visit and provider.",
    });
  } catch (error) {
    if (error instanceof OpsDomainError) throw error;
    const [currentRequest, currentProposal] = await Promise.all([
      repository.getEstimateRequest(request.organizationId, request.id),
      repository.getLatestEstimateProposal(request.organizationId, request.id),
    ]);
    if (currentRequest?.status !== request.status || currentProposal?.revision !== latestProposal.revision) {
      throw new OpsDomainError("CONFLICT", "This bid changed while the vendor decision was being recorded. Refresh before selecting it.");
    }
    throw error;
  }
  return { request: selected, proposal: latestProposal, assignment };
}
