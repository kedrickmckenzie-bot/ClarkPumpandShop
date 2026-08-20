import { atomicRequestMutation, atomicWorkOrderMutation } from "./concurrency";
import { OpsDomainError } from "./errors";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
} from "./workflow-task-commands";
import type { OpsRepository, OpsStatement } from "./repository";
import type {
  ActorContext,
  ApprovalDecision,
  ApprovalDecisionKind,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRequiredRole,
  ApprovalSubjectType,
  IsoDateTime,
  OpsId,
  ServiceRequest,
  Store,
  WorkOrder,
  WorkflowTask,
} from "./types";

export type ApprovalRequestState = "pending" | ApprovalDecisionKind;

export interface ApprovalServices {
  repository: OpsRepository;
  clock?: { now(): IsoDateTime };
  ids?: { next(prefix: string): OpsId };
}

const systemClock = { now: () => new Date().toISOString() };
const randomIds = { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };

function services(input: ApprovalServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match approval organization");
}

function addHours(value: IsoDateTime, hours: number) {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function approvalTaskPriority(workOrder: WorkOrder): WorkflowTask["priority"] {
  return ({ emergency: "critical", urgent: "high", routine: "normal", planned: "low" } as const)[workOrder.priority];
}

function buildApprovalWorkflowTask(input: {
  workOrder: WorkOrder;
  request: ApprovalRequest;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  ids: { next(prefix: string): OpsId };
  title?: string;
}) {
  return buildWorkflowTaskRecord({
    id: input.ids.next("workflow-task"), organizationId: input.workOrder.organizationId,
    workOrderId: input.workOrder.id, actor: input.actor, createdAt: input.occurredAt,
    draft: {
      taskType: "approve_quote", title: input.title ?? "Review authorization",
      reason: `Authorization for ${input.workOrder.number} requires the governed ${input.request.policyName} decision`,
      assigneeType: "role", assigneeRole: input.request.requiredRole,
      assigneeName: roleLabel(input.request.requiredRole), priority: approvalTaskPriority(input.workOrder),
      blocking: true, requiredForProgress: true, dueAt: input.request.dueAt ?? addHours(input.occurredAt, 24),
      applicableSlaClock: "approval", completionCriteria: "Record an immutable approval decision",
      escalationDestination: input.request.escalationRole ? roleLabel(input.request.escalationRole) : "Facilities director",
      sourceApprovalRequestId: input.request.id,
    },
  });
}

function buildApprovalResolutionTask(input: {
  workOrder: WorkOrder;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  ids: { next(prefix: string): OpsId };
  decision: ApprovalDecisionKind;
}) {
  const approved = input.decision === "approved";
  const title = approved ? "Issue service authorization" : "Revise or cancel authorization";
  return buildWorkflowTaskRecord({
    id: input.ids.next("workflow-task"), organizationId: input.workOrder.organizationId,
    workOrderId: input.workOrder.id, actor: input.actor, createdAt: input.occurredAt,
    draft: {
      taskType: approved ? "other" : "approve_quote", title,
      reason: approved
        ? `The governed authorization for ${input.workOrder.number} is approved and ready for issuance`
        : `The governed authorization for ${input.workOrder.number} requires revision or cancellation`,
      assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator",
      priority: approved ? approvalTaskPriority(input.workOrder) : "critical",
      blocking: true, requiredForProgress: true, dueAt: addHours(input.occurredAt, 24),
      applicableSlaClock: approved ? "scheduling" : "approval",
      completionCriteria: approved ? "Issue the service authorization" : "Record a revised authorization request or cancel the work order",
      escalationDestination: "Facilities director",
    },
  });
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: { next(prefix: string): OpsId };
}): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: "approval_request",
      aggregate_id: input.aggregateId, event_type: input.eventType, actor_type: input.actor.actorType,
      actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`,
      aggregate_type: "approval_request", aggregate_id: input.aggregateId, payload_json: payloadJson,
      status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0,
    }),
  ];
}

export function approvalRequestState(
  request: ApprovalRequest,
  decisions: readonly ApprovalDecision[],
): ApprovalRequestState {
  const latest = decisions
    .filter((decision) => decision.organizationId === request.organizationId && decision.approvalRequestId === request.id)
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt) || right.id.localeCompare(left.id))[0];
  return latest?.decision ?? "pending";
}

/**
 * Applies the most specific active rule: store before region before company,
 * category-specific before catch-all, then the tightest/highest threshold.
 */
export function resolveApprovalPolicy(input: {
  policies: readonly ApprovalPolicy[];
  organizationId: OpsId;
  store: Pick<Store, "id" | "organizationId" | "regionId">;
  categoryKey?: string;
  amountMinor: number;
  currency: string;
}): ApprovalPolicy | undefined {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) throw new OpsDomainError("VALIDATION", "Approval amount must be a non-negative integer minor-unit amount");
  if (input.store.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Approval store does not belong to this organization");
  const scopeRank = { organization: 1, region: 2, store: 3 } as const;
  const eligible = input.policies.filter((policy) => {
    if (policy.organizationId !== input.organizationId || policy.status !== "active" || policy.currency !== input.currency) return false;
    if (policy.categoryKey && policy.categoryKey !== input.categoryKey) return false;
    if (input.amountMinor < policy.minAmountMinor || policy.maxAmountMinor !== undefined && input.amountMinor > policy.maxAmountMinor) return false;
    if (policy.scopeKind === "organization") return policy.scopeId === input.organizationId;
    if (policy.scopeKind === "region") return Boolean(input.store.regionId && policy.scopeId === input.store.regionId);
    return policy.scopeId === input.store.id;
  });
  return eligible.sort((left, right) =>
    scopeRank[right.scopeKind] - scopeRank[left.scopeKind]
    || Number(Boolean(right.categoryKey)) - Number(Boolean(left.categoryKey))
    || right.minAmountMinor - left.minAmountMinor
    || right.version - left.version
    || left.id.localeCompare(right.id))[0];
}

function requestInsert(request: ApprovalRequest): OpsStatement {
  return insert("ops_approval_requests", {
    id: request.id, organization_id: request.organizationId, subject_type: request.subjectType, subject_id: request.subjectId,
    store_id: request.storeId, category_key: request.categoryKey, amount_minor: request.amount.amountMinor, currency: request.amount.currency,
    policy_id: request.policyId, policy_key: request.policyKey, policy_version: request.policyVersion, policy_name: request.policyName,
    policy_scope_kind: request.policyScopeKind, policy_scope_id: request.policyScopeId, required_role: request.requiredRole,
    escalation_role: request.escalationRole, requested_by_membership_id: request.requestedByMembershipId,
    requested_by_name: request.requestedByName, reason: request.reason, requested_at: request.requestedAt,
    due_at: request.dueAt, parent_approval_request_id: request.parentApprovalRequestId,
  });
}

function buildRequest(input: {
  id: OpsId;
  organizationId: OpsId;
  subjectType: ApprovalSubjectType;
  subjectId: OpsId;
  storeId: OpsId;
  categoryKey?: string;
  amountMinor: number;
  currency: string;
  policy: ApprovalPolicy;
  actor: ActorContext;
  reason?: string;
  requestedAt: IsoDateTime;
  dueAt?: IsoDateTime;
  parentApprovalRequestId?: OpsId;
  requiredRole?: ApprovalRequiredRole;
  escalationRole?: ApprovalRequiredRole;
}): ApprovalRequest {
  return {
    id: input.id, organizationId: input.organizationId, subjectType: input.subjectType, subjectId: input.subjectId,
    storeId: input.storeId, categoryKey: input.categoryKey, amount: { amountMinor: input.amountMinor, currency: input.currency },
    policyId: input.policy.id, policyKey: input.policy.policyKey, policyVersion: input.policy.version, policyName: input.policy.name,
    policyScopeKind: input.policy.scopeKind, policyScopeId: input.policy.scopeId,
    requiredRole: input.requiredRole ?? input.policy.requiredRole,
    escalationRole: input.escalationRole ?? input.policy.escalationRole,
    requestedByMembershipId: input.actor.actorId, requestedByName: input.actor.actorName, reason: input.reason,
    requestedAt: input.requestedAt, dueAt: input.dueAt, parentApprovalRequestId: input.parentApprovalRequestId,
  };
}

export async function prepareApprovalRequestForWorkOrder(input: {
  repository: OpsRepository;
  ids: { next(prefix: string): OpsId };
  organizationId: OpsId;
  workOrderId: OpsId;
  store: Store;
  categoryKey?: string;
  amountMinor?: number;
  currency: string;
  actor: ActorContext;
  requestedAt: IsoDateTime;
}): Promise<{ request?: ApprovalRequest; statements: OpsStatement[] }> {
  if (input.amountMinor === undefined) return { statements: [] };
  const policy = resolveApprovalPolicy({
    policies: await input.repository.listApprovalPolicies(input.organizationId),
    organizationId: input.organizationId,
    store: input.store,
    categoryKey: input.categoryKey,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  if (!policy) return { statements: [] };
  const request = buildRequest({
    id: input.ids.next("approval-request"), organizationId: input.organizationId, subjectType: "work_order",
    subjectId: input.workOrderId, storeId: input.store.id, categoryKey: input.categoryKey,
    amountMinor: input.amountMinor, currency: input.currency, policy, actor: input.actor,
    reason: "Not-to-exceed authorization requires review", requestedAt: input.requestedAt, dueAt: addHours(input.requestedAt, 24),
  });
  return {
    request,
    statements: [
      requestInsert(request),
      ...auditAndOutbox({ organizationId: request.organizationId, aggregateId: request.id, eventType: "approval.requested", actor: input.actor, occurredAt: input.requestedAt, payload: { subjectType: request.subjectType, subjectId: request.subjectId, policyId: request.policyId, policyVersion: request.policyVersion, requiredRole: request.requiredRole, amountMinor: request.amount.amountMinor, currency: request.amount.currency }, ids: input.ids }),
    ],
  };
}

export interface RequestSubjectApprovalInput {
  organizationId: OpsId;
  subjectType: ApprovalSubjectType;
  subjectId: OpsId;
  amountMinor: number;
  currency?: string;
  categoryKey?: string;
  reason?: string;
  dueAt?: IsoDateTime;
  actor: ActorContext;
}

export async function requestSubjectApproval(svc: ApprovalServices, input: RequestSubjectApprovalInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const subject = input.subjectType === "work_order"
    ? await repository.getWorkOrder(input.organizationId, input.subjectId)
    : await repository.getRequest(input.organizationId, input.subjectId);
  if (!subject) throw new OpsDomainError("NOT_FOUND", "Approval subject not found in this organization");
  const requestSubject = input.subjectType === "service_request" ? subject as ServiceRequest : undefined;
  if (requestSubject && (requestSubject.status === "converted" || requestSubject.status === "closed" || requestSubject.convertedWorkOrderId)) {
    throw new OpsDomainError("CONFLICT", "Converted or closed requests cannot receive a new approval request");
  }
  const store = await repository.getStore(input.organizationId, subject.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Approval store not found in this organization");
  const currency = input.currency ?? "USD";
  const policy = resolveApprovalPolicy({ policies: await repository.listApprovalPolicies(input.organizationId), organizationId: input.organizationId, store, categoryKey: input.categoryKey ?? ("categoryKey" in subject ? subject.categoryKey : undefined), amountMinor: input.amountMinor, currency });
  if (!policy) throw new OpsDomainError("VALIDATION", "No active approval policy applies to this scope, category, and amount");
  const prior = await repository.listApprovalRequestsForSubject(input.organizationId, input.subjectType, input.subjectId);
  for (const request of prior) {
    if ((await repository.listApprovalDecisionsForRequest(input.organizationId, request.id)).length === 0) throw new OpsDomainError("CONFLICT", "This record already has a pending approval request");
  }
  const now = clock.now();
  if (input.dueAt && input.dueAt < now) throw new OpsDomainError("VALIDATION", "Approval due time cannot be in the past");
  const request = buildRequest({ id: ids.next("approval-request"), organizationId: input.organizationId, subjectType: input.subjectType, subjectId: input.subjectId, storeId: store.id, categoryKey: input.categoryKey ?? ("categoryKey" in subject ? subject.categoryKey : undefined), amountMinor: input.amountMinor, currency, policy, actor: input.actor, reason: input.reason, requestedAt: now, dueAt: input.dueAt ?? addHours(now, 24) });
  const statements = [requestInsert(request), ...auditAndOutbox({ organizationId: input.organizationId, aggregateId: request.id, eventType: "approval.requested", actor: input.actor, occurredAt: now, payload: { subjectType: request.subjectType, subjectId: request.subjectId, policyId: request.policyId, policyVersion: request.policyVersion, requiredRole: request.requiredRole, amountMinor: request.amount.amountMinor, currency: request.amount.currency }, ids })];
  if (input.subjectType === "work_order") {
    const workOrder = await repository.getWorkOrder(input.organizationId, input.subjectId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ? WHERE organization_id = ? AND id = ?", params: ["awaiting_approval", roleLabel(request.requiredRole), "Review authorization", request.dueAt, input.organizationId, input.subjectId] });
    const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
    const task = buildApprovalWorkflowTask({ workOrder, request, actor: input.actor, occurredAt: now, ids });
    statements.push(
      ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
      buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, task]),
    );
    await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  } else if (requestSubject) {
    await atomicRequestMutation({
      repository,
      request: requestSubject,
      now,
      statements,
      conflictMessage: "This request changed. Refresh before requesting approval.",
    });
  }
  return request;
}

function roleLabel(role: ApprovalRequiredRole) {
  const labels: Record<ApprovalRequiredRole, string> = {
    executive: "Executive approver", facilities_admin: "Facilities administrator", regional_manager: "Regional manager",
    store_manager: "Store manager", finance_reviewer: "Finance reviewer",
  };
  return labels[role];
}

async function assertMembershipCanApproveStore(
  repository: OpsRepository,
  organizationId: OpsId,
  membershipId: OpsId,
  storeId: OpsId,
) {
  const [store, grants] = await Promise.all([
    repository.getStore(organizationId, storeId),
    repository.listScopeGrantsForMembership(organizationId, membershipId),
  ]);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Approval store not found in this organization");
  const inScope = grants.some((grant) => (
    grant.scopeKind === "organization" && grant.scopeId === organizationId
    || grant.scopeKind === "store" && grant.scopeId === store.id
    || grant.scopeKind === "region" && Boolean(store.regionId && grant.scopeId === store.regionId)
  ));
  if (!inScope) throw new OpsDomainError("FORBIDDEN", "The approving membership is not authorized for this store");
}

export interface RecordApprovalDecisionInput {
  organizationId: OpsId;
  approvalRequestId: OpsId;
  decision: ApprovalDecisionKind;
  deciderMembershipId: OpsId;
  reason?: string;
  actor: ActorContext;
}

export async function recordApprovalDecision(svc: ApprovalServices, input: RecordApprovalDecisionInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const request = await repository.getApprovalRequest(input.organizationId, input.approvalRequestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Approval request not found in this organization");
  if ((await repository.listApprovalDecisionsForRequest(input.organizationId, request.id)).length) throw new OpsDomainError("CONFLICT", "This approval request already has an immutable decision");
  const membership = await repository.getMembership(input.organizationId, input.deciderMembershipId);
  if (!membership || membership.status !== "active" || membership.role !== request.requiredRole) throw new OpsDomainError("FORBIDDEN", `${roleLabel(request.requiredRole)} approval is required`);
  if (input.actor.actorId && input.actor.actorId !== input.deciderMembershipId) throw new OpsDomainError("FORBIDDEN", "Decision actor does not match the approving membership");
  await assertMembershipCanApproveStore(repository, input.organizationId, membership.id, request.storeId);
  if (request.requestedByMembershipId === input.deciderMembershipId) {
    throw new OpsDomainError("FORBIDDEN", "The requester cannot decide their own approval request");
  }
  const now = clock.now();
  const escalatedToRole = input.decision === "escalated" ? request.escalationRole : undefined;
  if (input.decision === "escalated" && !escalatedToRole) throw new OpsDomainError("VALIDATION", "This approval policy has no escalation role");
  if (["rejected", "escalated", "cancelled"].includes(input.decision) && !input.reason?.trim()) throw new OpsDomainError("VALIDATION", "A reason is required for a non-approval decision");
  const decision: ApprovalDecision = {
    id: ids.next("approval-decision"), organizationId: input.organizationId, approvalRequestId: request.id,
    decision: input.decision, decidedByMembershipId: membership.id, decidedByName: input.actor.actorName,
    decidedByRole: request.requiredRole, reason: input.reason?.trim(), escalatedToRole, decidedAt: now,
  };
  const statements: OpsStatement[] = [
    insert("ops_approval_decisions", { id: decision.id, organization_id: decision.organizationId, approval_request_id: decision.approvalRequestId, decision: decision.decision, decided_by_membership_id: decision.decidedByMembershipId, decided_by_name: decision.decidedByName, decided_by_role: decision.decidedByRole, reason: decision.reason, escalated_to_role: decision.escalatedToRole, decided_at: decision.decidedAt }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateId: request.id, eventType: `approval.${input.decision}`, actor: input.actor, occurredAt: now, payload: { subjectType: request.subjectType, subjectId: request.subjectId, decisionId: decision.id, policyId: request.policyId, policyVersion: request.policyVersion, decidedByRole: decision.decidedByRole, reason: decision.reason, escalatedToRole }, ids }),
  ];
  let escalatedRequest: ApprovalRequest | undefined;
  if (input.decision === "escalated" && escalatedToRole) {
    const policy = await repository.getApprovalPolicy(input.organizationId, request.policyId);
    if (!policy) throw new OpsDomainError("NOT_FOUND", "Approval policy snapshot source no longer exists");
    escalatedRequest = buildRequest({ id: ids.next("approval-request"), organizationId: input.organizationId, subjectType: request.subjectType, subjectId: request.subjectId, storeId: request.storeId, categoryKey: request.categoryKey, amountMinor: request.amount.amountMinor, currency: request.amount.currency, policy, actor: input.actor, reason: `Escalated from ${roleLabel(request.requiredRole)}: ${input.reason?.trim()}`, requestedAt: now, dueAt: addHours(now, 24), parentApprovalRequestId: request.id, requiredRole: escalatedToRole, escalationRole: undefined });
    statements.push(requestInsert(escalatedRequest), ...auditAndOutbox({ organizationId: input.organizationId, aggregateId: escalatedRequest.id, eventType: "approval.requested", actor: input.actor, occurredAt: now, payload: { subjectType: escalatedRequest.subjectType, subjectId: escalatedRequest.subjectId, parentApprovalRequestId: request.id, requiredRole: escalatedRequest.requiredRole, amountMinor: escalatedRequest.amount.amountMinor, currency: escalatedRequest.amount.currency }, ids }));
  }
  if (request.subjectType === "work_order") {
    const workOrder = await repository.getWorkOrder(input.organizationId, request.subjectId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Approval work order no longer exists");
    const projection = input.decision === "approved"
      ? ["approved", "Facilities coordinator", "Issue service authorization", workOrder.dueAt]
      : input.decision === "escalated" && escalatedRequest
        ? ["awaiting_approval", roleLabel(escalatedRequest.requiredRole), "Review escalated authorization", escalatedRequest.dueAt]
        : ["awaiting_approval", "Facilities coordinator", "Revise or cancel authorization", workOrder.dueAt];
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ? WHERE organization_id = ? AND id = ?", params: [...projection, input.organizationId, workOrder.id] });
    const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
    const sourceTask = tasks.find((task) => task.sourceApprovalRequestId === request.id && ["open", "in_progress"].includes(task.status));
    const resolutionNote = `Approval decision recorded: ${input.decision}`;
    const resolvedTasks = tasks.map((task): WorkflowTask => task.id === sourceTask?.id
      ? { ...task, status: "completed", completedByActorType: input.actor.actorType,
          completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName,
          completedAt: now, resolutionNote }
      : task);
    const remainingRequired = resolvedTasks.some((task) => ["open", "in_progress"].includes(task.status) && task.requiredForProgress);
    const replacementTask = input.decision === "escalated" && escalatedRequest
      ? buildApprovalWorkflowTask({ workOrder, request: escalatedRequest, actor: input.actor, occurredAt: now, ids, title: "Review escalated authorization" })
      : !remainingRequired || input.decision !== "approved"
        ? buildApprovalResolutionTask({ workOrder, actor: input.actor, occurredAt: now, ids, decision: input.decision })
        : undefined;
    statements.push(
      ...(sourceTask ? buildCompleteWorkflowTaskStatements({ task: sourceTask, actor: input.actor, occurredAt: now, ids, resolutionNote }) : []),
      ...(replacementTask ? buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }) : []),
      buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...resolvedTasks, ...(replacementTask ? [replacementTask] : [])]),
    );
    await atomicWorkOrderMutation({ repository, workOrder, now, statements, conflictMessage: "This work order or its approval changed. Refresh before deciding." });
  } else {
    const serviceRequest = await repository.getRequest(input.organizationId, request.subjectId);
    if (!serviceRequest) throw new OpsDomainError("NOT_FOUND", "Approval service request no longer exists");
    if (serviceRequest.status === "converted" || serviceRequest.status === "closed" || serviceRequest.convertedWorkOrderId) {
      throw new OpsDomainError("CONFLICT", "Converted or closed requests cannot receive an approval decision");
    }
    await atomicRequestMutation({
      repository,
      request: serviceRequest,
      now,
      statements,
      conflictMessage: "This request or its approval changed. Refresh before deciding.",
    });
  }
  return { decision, escalatedRequest };
}

export interface CreateApprovalPolicyVersionInput {
  organizationId: OpsId;
  policyKey: string;
  name: string;
  scopeKind: ApprovalPolicy["scopeKind"];
  scopeId: OpsId;
  categoryKey?: string;
  minAmountMinor: number;
  maxAmountMinor?: number;
  currency?: string;
  requiredRole: ApprovalRequiredRole;
  escalationRole?: ApprovalRequiredRole;
  createdByMembershipId: OpsId;
  actor: ActorContext;
}

export async function createApprovalPolicyVersion(svc: ApprovalServices, input: CreateApprovalPolicyVersionInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const member = await repository.getMembership(input.organizationId, input.createdByMembershipId);
  if (!member || member.status !== "active" || !["facilities_admin", "executive"].includes(member.role)) throw new OpsDomainError("FORBIDDEN", "Facilities administrator or executive access is required");
  if (input.actor.actorId && input.actor.actorId !== member.id) throw new OpsDomainError("FORBIDDEN", "Policy actor does not match the creating membership");
  if (!Number.isSafeInteger(input.minAmountMinor) || input.minAmountMinor < 0 || input.maxAmountMinor !== undefined && (!Number.isSafeInteger(input.maxAmountMinor) || input.maxAmountMinor < input.minAmountMinor)) throw new OpsDomainError("VALIDATION", "Approval policy amount range is invalid");
  if (input.scopeKind === "organization" && input.scopeId !== input.organizationId) throw new OpsDomainError("VALIDATION", "Organization policy scope must use the organization id");
  if (input.scopeKind === "store" && !(await repository.getStore(input.organizationId, input.scopeId))) throw new OpsDomainError("NOT_FOUND", "Policy store scope was not found in this organization");
  const key = required(input.policyKey, "Policy key");
  const prior = (await repository.listApprovalPolicies(input.organizationId)).filter((policy) => policy.policyKey === key).sort((left, right) => right.version - left.version)[0];
  const now = clock.now();
  const policy: ApprovalPolicy = { id: ids.next("approval-policy"), organizationId: input.organizationId, policyKey: key, version: (prior?.version ?? 0) + 1, name: required(input.name, "Policy name"), scopeKind: input.scopeKind, scopeId: input.scopeId, categoryKey: input.categoryKey?.trim() || undefined, minAmountMinor: input.minAmountMinor, maxAmountMinor: input.maxAmountMinor, currency: input.currency ?? "USD", requiredRole: input.requiredRole, escalationRole: input.escalationRole, status: "active", supersedesPolicyId: prior?.id, createdByMembershipId: member.id, createdAt: now };
  const statements: OpsStatement[] = [];
  if (prior?.status === "active") statements.push({ sql: "UPDATE ops_approval_policies SET status = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["superseded", input.organizationId, prior.id, "active"] });
  statements.push(insert("ops_approval_policies", { id: policy.id, organization_id: policy.organizationId, policy_key: policy.policyKey, version: policy.version, name: policy.name, scope_kind: policy.scopeKind, scope_id: policy.scopeId, category_key: policy.categoryKey, min_amount_minor: policy.minAmountMinor, max_amount_minor: policy.maxAmountMinor, currency: policy.currency, required_role: policy.requiredRole, escalation_role: policy.escalationRole, status: policy.status, supersedes_policy_id: policy.supersedesPolicyId, created_by_membership_id: policy.createdByMembershipId, created_at: policy.createdAt }), ...auditAndOutbox({ organizationId: input.organizationId, aggregateId: policy.id, eventType: "approval_policy.version_created", actor: input.actor, occurredAt: now, payload: { policyKey: policy.policyKey, version: policy.version, scopeKind: policy.scopeKind, scopeId: policy.scopeId, categoryKey: policy.categoryKey, minAmountMinor: policy.minAmountMinor, maxAmountMinor: policy.maxAmountMinor, currency: policy.currency, requiredRole: policy.requiredRole, supersedesPolicyId: policy.supersedesPolicyId }, ids }));
  await repository.atomicWrite(statements);
  return policy;
}
