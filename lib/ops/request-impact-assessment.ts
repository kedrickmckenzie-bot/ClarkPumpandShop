import { OpsDomainError } from "./errors";
import { atomicRequestImpactReview } from "./concurrency";
import type { OpsRepository, OpsStatement } from "./repository";
import type {
  ActorContext,
  ComplianceImpact,
  ImpactAnswer,
  ImpactConfidence,
  ImpactSafetyConcern,
  ImpactSource,
  IsoDateTime,
  OpsId,
  ProductInventoryRisk,
  RequestImpactAssessment,
  RevenueFunctionImpact,
  StoreOperatingState,
  WorkOrderPriority,
  WorkflowTask,
} from "./types";

export interface RequestImpactAssessmentDraft {
  storeOperatingState: StoreOperatingState;
  safetyConcern: ImpactSafetyConcern;
  productInventoryRisk: ProductInventoryRisk;
  productInventoryValueMinor?: number;
  productInventoryCurrency?: string;
  customersAffected: ImpactAnswer;
  complianceImpact: ComplianceImpact;
  capacityUnavailableBps?: number;
  redundantEquipment: ImpactAnswer;
  revenueFunctionImpact?: RevenueFunctionImpact;
  estimatedDailyRevenueExposureMinor?: number;
  estimatedDailyRevenueExposureCurrency?: string;
  estimatedDowntimeMinutes?: number;
  confidence: ImpactConfidence;
  source: ImpactSource;
  notes?: string;
}

interface ImpactIdSource { next(prefix: string): OpsId }
interface ImpactClock { now(): IsoDateTime }

export interface RequestImpactCommandServices {
  repository: OpsRepository;
  clock?: ImpactClock;
  ids?: ImpactIdSource;
}

const systemClock: ImpactClock = { now: () => new Date().toISOString() };
const randomIds: ImpactIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };

const operatingStates = new Set<StoreOperatingState>(["open", "partially_operational", "unable_to_operate", "unknown"]);
const safetyConcerns = new Set<ImpactSafetyConcern>(["none_reported", "potential", "immediate", "unknown"]);
const inventoryRisks = new Set<ProductInventoryRisk>(["none_reported", "at_risk", "loss_reported", "unknown"]);
const answers = new Set<ImpactAnswer>(["yes", "no", "unknown"]);
const complianceImpacts = new Set<ComplianceImpact>(["none_reported", "potential", "confirmed", "unknown"]);
const revenueFunctions = new Set<RevenueFunctionImpact>(["fuel", "foodservice", "refrigerated_merchandise", "beverages", "lottery", "car_wash", "other"]);
const confidences = new Set<ImpactConfidence>(["low", "medium", "high"]);
const sources = new Set<ImpactSource>(["store_report", "manager_review", "imported", "not_assessed"]);

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  requestId: OpsId;
  assessment: RequestImpactAssessment;
  actor: ActorContext;
  ids: ImpactIdSource;
}): OpsStatement[] {
  const eventType = input.assessment.assessmentKind === "initial_report"
    ? "request.impact_assessed"
    : "request.impact_reviewed";
  const payloadJson = JSON.stringify({
    assessmentId: input.assessment.id,
    assessmentKind: input.assessment.assessmentKind,
    reviewDisposition: input.assessment.reviewDisposition,
    storeId: input.assessment.storeId,
    storeOperatingState: input.assessment.storeOperatingState,
    safetyConcern: input.assessment.safetyConcern,
    productInventoryRisk: input.assessment.productInventoryRisk,
    productInventoryValueMinor: input.assessment.productInventoryValue?.amountMinor,
    productInventoryCurrency: input.assessment.productInventoryValue?.currency,
    customersAffected: input.assessment.customersAffected,
    complianceImpact: input.assessment.complianceImpact,
    capacityUnavailableBps: input.assessment.capacityUnavailableBps,
    redundantEquipment: input.assessment.redundantEquipment,
    revenueFunctionImpact: input.assessment.revenueFunctionImpact,
    estimatedDailyRevenueExposureMinor: input.assessment.estimatedDailyRevenueExposure?.amountMinor,
    estimatedDailyRevenueExposureCurrency: input.assessment.estimatedDailyRevenueExposure?.currency,
    estimatedDowntimeMinutes: input.assessment.estimatedDowntimeMinutes,
    confidence: input.assessment.confidence,
    source: input.assessment.source,
  });
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"),
      organization_id: input.organizationId,
      aggregate_type: "request",
      aggregate_id: input.requestId,
      event_type: eventType,
      actor_type: input.actor.actorType,
      actor_id: input.actor.actorId,
      actor_name: input.actor.actorName,
      occurred_at: input.assessment.assessedAt,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"),
      organization_id: input.organizationId,
      topic: `ops.${eventType}`,
      aggregate_type: "request",
      aggregate_id: input.requestId,
      payload_json: payloadJson,
      status: "pending",
      available_at: input.assessment.assessedAt,
      created_at: input.assessment.assessedAt,
      attempt_count: 0,
    }),
  ];
}

function eventStatements(input: {
  organizationId: OpsId;
  aggregateType: string;
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: ImpactIdSource;
}): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", { id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson }),
    insert("ops_outbox_messages", { id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, payload_json: payloadJson, status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0 }),
  ];
}

function addHours(value: IsoDateTime, hours: number): IsoDateTime {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1_000).toISOString();
}

function reviewTaskPriority(priority: WorkOrderPriority): WorkflowTask["priority"] {
  return ({ emergency: "critical", urgent: "high", routine: "normal", planned: "low" } as const)[priority];
}

function reviewTaskDueAt(priority: WorkOrderPriority, submittedAt: IsoDateTime) {
  return addHours(submittedAt, ({ emergency: 1, urgent: 4, routine: 24, planned: 72 } as const)[priority]);
}

function taskInsert(task: WorkflowTask): OpsStatement {
  return insert("ops_workflow_tasks", {
    id: task.id, organization_id: task.organizationId, work_order_id: task.workOrderId, service_request_id: task.serviceRequestId,
    task_type: task.taskType, title: task.title, reason: task.reason, assignee_type: task.assigneeType, assignee_id: task.assigneeId,
    assignee_role: task.assigneeRole, assignee_name: task.assigneeName, priority: task.priority, status: task.status,
    blocking: task.blocking ? 1 : 0, required_for_progress: task.requiredForProgress ? 1 : 0, due_at: task.dueAt,
    no_sla_reason: task.noSlaReason, applicable_sla_clock: task.applicableSlaClock, completion_criteria: task.completionCriteria,
    escalation_destination: task.escalationDestination, escalation_level: task.escalationLevel, created_by_actor_type: task.createdByActorType,
    created_by_actor_id: task.createdByActorId, created_by_actor_name: task.createdByActorName, created_at: task.createdAt,
    started_by_actor_type: task.startedByActorType, started_by_actor_id: task.startedByActorId,
    started_by_actor_name: task.startedByActorName, started_at: task.startedAt,
  });
}

export function buildInitialRequestReviewTask(input: {
  organizationId: OpsId;
  requestId: OpsId;
  reference: string;
  problem: string;
  priority: WorkOrderPriority;
  actor: ActorContext;
  createdAt: IsoDateTime;
  ids: ImpactIdSource;
}) {
  const task: WorkflowTask = {
    id: input.ids.next("workflow-task"), organizationId: input.organizationId, serviceRequestId: input.requestId,
    taskType: "review_issue", title: `Review ${input.reference} business impact`, reason: `Assess the reported operating impact before authorizing work: ${input.problem}`,
    assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities review", priority: reviewTaskPriority(input.priority),
    status: "open", blocking: true, requiredForProgress: true, dueAt: reviewTaskDueAt(input.priority, input.createdAt), applicableSlaClock: "intake_review",
    completionCriteria: "Business impact is confirmed or revised and the issue is ready for an approval or work-order decision",
    escalationDestination: input.priority === "emergency" ? "Regional maintenance leader" : "Facilities director", escalationLevel: 0,
    createdByActorType: input.actor.actorType, createdByActorId: input.actor.actorId, createdByActorName: input.actor.actorName, createdAt: input.createdAt,
  };
  return {
    task,
    statements: [
      taskInsert(task),
      ...eventStatements({ organizationId: input.organizationId, aggregateType: "workflow_task", aggregateId: task.id, eventType: "workflow_task.created", actor: input.actor, occurredAt: input.createdAt, payload: { serviceRequestId: input.requestId, taskType: task.taskType, dueAt: task.dueAt, blocking: true }, ids: input.ids }),
    ],
  };
}

function requiredNote(value: string | undefined) {
  const notes = value?.trim();
  if (notes && notes.length > 2_000) throw new OpsDomainError("VALIDATION", "Impact notes must be 2,000 characters or fewer");
  return notes || undefined;
}

export function normalizeRequestImpactAssessmentDraft(input: RequestImpactAssessmentDraft): RequestImpactAssessmentDraft {
  if (!operatingStates.has(input.storeOperatingState)) throw new OpsDomainError("VALIDATION", "Choose a supported store operating state");
  if (!safetyConcerns.has(input.safetyConcern)) throw new OpsDomainError("VALIDATION", "Choose a supported safety-impact answer");
  if (!inventoryRisks.has(input.productInventoryRisk)) throw new OpsDomainError("VALIDATION", "Choose a supported product or inventory risk");
  if (!answers.has(input.customersAffected)) throw new OpsDomainError("VALIDATION", "Choose whether customers are affected");
  if (!complianceImpacts.has(input.complianceImpact)) throw new OpsDomainError("VALIDATION", "Choose a supported compliance impact");
  if (!answers.has(input.redundantEquipment)) throw new OpsDomainError("VALIDATION", "Choose whether redundant equipment is available");
  if (input.revenueFunctionImpact && !revenueFunctions.has(input.revenueFunctionImpact)) throw new OpsDomainError("VALIDATION", "Choose a supported revenue function");
  if (!confidences.has(input.confidence)) throw new OpsDomainError("VALIDATION", "Choose an impact confidence");
  if (!sources.has(input.source)) throw new OpsDomainError("VALIDATION", "Choose an impact source");
  if (input.capacityUnavailableBps !== undefined && (!Number.isSafeInteger(input.capacityUnavailableBps) || input.capacityUnavailableBps < 0 || input.capacityUnavailableBps > 10_000)) {
    throw new OpsDomainError("VALIDATION", "Unavailable capacity must be between 0 and 100 percent");
  }
  if (input.productInventoryValueMinor !== undefined && (!Number.isSafeInteger(input.productInventoryValueMinor) || input.productInventoryValueMinor < 0)) {
    throw new OpsDomainError("VALIDATION", "Product or inventory value at risk must be a non-negative minor-unit amount");
  }
  if (input.estimatedDailyRevenueExposureMinor !== undefined && (!Number.isSafeInteger(input.estimatedDailyRevenueExposureMinor) || input.estimatedDailyRevenueExposureMinor < 0)) {
    throw new OpsDomainError("VALIDATION", "Estimated daily revenue exposure must be a non-negative minor-unit amount");
  }
  if (input.estimatedDowntimeMinutes !== undefined && (!Number.isSafeInteger(input.estimatedDowntimeMinutes) || input.estimatedDowntimeMinutes < 0 || input.estimatedDowntimeMinutes > 525_600)) {
    throw new OpsDomainError("VALIDATION", "Estimated downtime must be between 0 and 525,600 minutes");
  }
  const currency = input.productInventoryValueMinor === undefined
    ? undefined
    : (input.productInventoryCurrency ?? "USD").trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new OpsDomainError("VALIDATION", "Inventory-value currency must be a three-letter code");
  const revenueCurrency = input.estimatedDailyRevenueExposureMinor === undefined
    ? undefined
    : (input.estimatedDailyRevenueExposureCurrency ?? "USD").trim().toUpperCase();
  if (revenueCurrency && !/^[A-Z]{3}$/.test(revenueCurrency)) throw new OpsDomainError("VALIDATION", "Revenue-exposure currency must be a three-letter code");
  if (input.productInventoryValueMinor !== undefined && input.productInventoryRisk === "none_reported") {
    throw new OpsDomainError("VALIDATION", "Remove the inventory value or record an inventory risk");
  }
  return {
    ...input,
    productInventoryCurrency: currency,
    estimatedDailyRevenueExposureCurrency: revenueCurrency,
    revenueFunctionImpact: input.revenueFunctionImpact || undefined,
    notes: requiredNote(input.notes),
  };
}

export function unknownRequestImpactAssessment(): RequestImpactAssessmentDraft {
  return {
    storeOperatingState: "unknown",
    safetyConcern: "unknown",
    productInventoryRisk: "unknown",
    customersAffected: "unknown",
    complianceImpact: "unknown",
    redundantEquipment: "unknown",
    confidence: "low",
    source: "not_assessed",
  };
}

export function buildRequestImpactAssessment(input: {
  id: OpsId;
  organizationId: OpsId;
  requestId: OpsId;
  storeId: OpsId;
  assessmentKind: RequestImpactAssessment["assessmentKind"];
  reviewDisposition?: RequestImpactAssessment["reviewDisposition"];
  draft: RequestImpactAssessmentDraft;
  actor: ActorContext;
  assessedAt: IsoDateTime;
}): RequestImpactAssessment {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match impact assessment organization");
  if (input.assessmentKind === "initial_report" && input.reviewDisposition) throw new OpsDomainError("VALIDATION", "An initial impact report cannot have a review disposition");
  if (input.assessmentKind === "review" && !input.reviewDisposition) throw new OpsDomainError("VALIDATION", "A review disposition is required");
  const draft = normalizeRequestImpactAssessmentDraft(input.draft);
  return {
    id: input.id,
    organizationId: input.organizationId,
    requestId: input.requestId,
    storeId: input.storeId,
    assessmentKind: input.assessmentKind,
    reviewDisposition: input.reviewDisposition,
    storeOperatingState: draft.storeOperatingState,
    safetyConcern: draft.safetyConcern,
    productInventoryRisk: draft.productInventoryRisk,
    productInventoryValue: draft.productInventoryValueMinor === undefined ? undefined : {
      amountMinor: draft.productInventoryValueMinor,
      currency: draft.productInventoryCurrency ?? "USD",
    },
    customersAffected: draft.customersAffected,
    complianceImpact: draft.complianceImpact,
    capacityUnavailableBps: draft.capacityUnavailableBps,
    redundantEquipment: draft.redundantEquipment,
    revenueFunctionImpact: draft.revenueFunctionImpact,
    estimatedDailyRevenueExposure: draft.estimatedDailyRevenueExposureMinor === undefined ? undefined : {
      amountMinor: draft.estimatedDailyRevenueExposureMinor,
      currency: draft.estimatedDailyRevenueExposureCurrency ?? "USD",
    },
    estimatedDowntimeMinutes: draft.estimatedDowntimeMinutes,
    confidence: draft.confidence,
    source: draft.source,
    notes: draft.notes,
    assessedByActorType: input.actor.actorType,
    assessedByActorId: input.actor.actorId,
    assessedByActorName: input.actor.actorName.trim() || "Unknown actor",
    assessedAt: input.assessedAt,
  };
}

export function buildRequestImpactAssessmentStatements(input: {
  assessment: RequestImpactAssessment;
  actor: ActorContext;
  ids: ImpactIdSource;
}): OpsStatement[] {
  const { assessment } = input;
  return [
    insert("ops_request_impact_assessments", {
      id: assessment.id,
      organization_id: assessment.organizationId,
      request_id: assessment.requestId,
      store_id: assessment.storeId,
      assessment_kind: assessment.assessmentKind,
      review_disposition: assessment.reviewDisposition,
      store_operating_state: assessment.storeOperatingState,
      safety_concern: assessment.safetyConcern,
      product_inventory_risk: assessment.productInventoryRisk,
      product_inventory_value_minor: assessment.productInventoryValue?.amountMinor,
      product_inventory_currency: assessment.productInventoryValue?.currency,
      customers_affected: assessment.customersAffected,
      compliance_impact: assessment.complianceImpact,
      capacity_unavailable_bps: assessment.capacityUnavailableBps,
      redundant_equipment: assessment.redundantEquipment,
      revenue_function_impact: assessment.revenueFunctionImpact,
      estimated_daily_revenue_exposure_minor: assessment.estimatedDailyRevenueExposure?.amountMinor,
      estimated_daily_revenue_exposure_currency: assessment.estimatedDailyRevenueExposure?.currency,
      estimated_downtime_minutes: assessment.estimatedDowntimeMinutes,
      confidence: assessment.confidence,
      source: assessment.source,
      notes: assessment.notes,
      assessed_by_actor_type: assessment.assessedByActorType,
      assessed_by_actor_id: assessment.assessedByActorId,
      assessed_by_actor_name: assessment.assessedByActorName,
      assessed_at: assessment.assessedAt,
    }),
    ...auditAndOutbox({
      organizationId: assessment.organizationId,
      requestId: assessment.requestId,
      assessment,
      actor: input.actor,
      ids: input.ids,
    }),
  ];
}

export function buildInitialRequestImpactAssessment(input: {
  organizationId: OpsId;
  requestId: OpsId;
  storeId: OpsId;
  draft?: RequestImpactAssessmentDraft;
  actor: ActorContext;
  assessedAt: IsoDateTime;
  ids: ImpactIdSource;
}) {
  const assessment = buildRequestImpactAssessment({
    id: input.ids.next("request-impact"),
    organizationId: input.organizationId,
    requestId: input.requestId,
    storeId: input.storeId,
    assessmentKind: "initial_report",
    draft: input.draft ? { ...input.draft, source: "store_report" } : unknownRequestImpactAssessment(),
    actor: input.actor,
    assessedAt: input.assessedAt,
  });
  return { assessment, statements: buildRequestImpactAssessmentStatements({ assessment, actor: input.actor, ids: input.ids }) };
}

function coreFacts(assessment: RequestImpactAssessment | RequestImpactAssessmentDraft) {
  const persisted = "assessmentKind" in assessment ? assessment : undefined;
  const draft = persisted ? undefined : assessment as RequestImpactAssessmentDraft;
  return JSON.stringify({
    storeOperatingState: assessment.storeOperatingState,
    safetyConcern: assessment.safetyConcern,
    productInventoryRisk: assessment.productInventoryRisk,
    productInventoryValueMinor: persisted?.productInventoryValue?.amountMinor ?? draft?.productInventoryValueMinor,
    productInventoryCurrency: persisted?.productInventoryValue?.currency ?? draft?.productInventoryCurrency,
    customersAffected: assessment.customersAffected,
    complianceImpact: assessment.complianceImpact,
    capacityUnavailableBps: assessment.capacityUnavailableBps,
    redundantEquipment: assessment.redundantEquipment,
    revenueFunctionImpact: assessment.revenueFunctionImpact,
    estimatedDailyRevenueExposureMinor: persisted?.estimatedDailyRevenueExposure?.amountMinor ?? draft?.estimatedDailyRevenueExposureMinor,
    estimatedDailyRevenueExposureCurrency: persisted?.estimatedDailyRevenueExposure?.currency ?? draft?.estimatedDailyRevenueExposureCurrency,
    estimatedDowntimeMinutes: assessment.estimatedDowntimeMinutes,
  });
}

export interface ReviewRequestImpactAssessmentInput {
  organizationId: OpsId;
  requestId: OpsId;
  expectedRequestStatus: "submitted" | "under_review";
  expectedLatestAssessmentId?: OpsId;
  disposition: "confirmed" | "revised";
  assessment: RequestImpactAssessmentDraft;
  actor: ActorContext;
}

export async function reviewRequestImpactAssessment(
  services: RequestImpactCommandServices,
  input: ReviewRequestImpactAssessmentInput,
) {
  const clock = services.clock ?? systemClock;
  const ids = services.ids ?? randomIds;
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match impact assessment organization");
  const request = await services.repository.getRequest(input.organizationId, input.requestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Service request not found");
  if (request.status === "closed") throw new OpsDomainError("CONFLICT", "A closed request cannot receive another impact review");
  if (request.status !== input.expectedRequestStatus || !["submitted", "under_review"].includes(request.status)) {
    throw new OpsDomainError("CONFLICT", "The request review state changed. Refresh before recording this review");
  }
  const prior = await services.repository.listRequestImpactAssessments(input.organizationId, input.requestId);
  const latest = prior.at(-1);
  if ((latest?.id ?? undefined) !== input.expectedLatestAssessmentId) {
    throw new OpsDomainError("CONFLICT", "The impact assessment changed. Refresh before recording this review");
  }
  const normalized = normalizeRequestImpactAssessmentDraft({ ...input.assessment, source: "manager_review" });
  if (input.disposition === "confirmed") {
    if (!latest) throw new OpsDomainError("VALIDATION", "There is no prior impact assessment to confirm");
    if (coreFacts(latest) !== coreFacts(normalized)) {
      throw new OpsDomainError("VALIDATION", "Choose revised when changing reported impact facts");
    }
  }
  const assessment = buildRequestImpactAssessment({
    id: ids.next("request-impact"),
    organizationId: input.organizationId,
    requestId: request.id,
    storeId: request.storeId,
    assessmentKind: "review",
    reviewDisposition: input.disposition,
    draft: normalized,
    actor: input.actor,
    assessedAt: clock.now(),
  });
  const statements = buildRequestImpactAssessmentStatements({ assessment, actor: input.actor, ids });
  if (request.status === "submitted") {
    statements.unshift({ sql: "UPDATE ops_requests SET status = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["under_review", input.organizationId, request.id, "submitted"] });
    statements.push(...eventStatements({ organizationId: input.organizationId, aggregateType: "request", aggregateId: request.id, eventType: "request.review_started", actor: input.actor, occurredAt: assessment.assessedAt, payload: { previousStatus: "submitted", status: "under_review", impactAssessmentId: assessment.id }, ids }));
  }
  const tasks = await services.repository.listWorkflowTasksForRequest(input.organizationId, request.id);
  const activeTask = tasks.find((task) => task.taskType === "review_issue" && ["open", "in_progress"].includes(task.status));
  let workflowTaskId = activeTask?.id;
  if (!activeTask) {
    const created = buildInitialRequestReviewTask({ organizationId: input.organizationId, requestId: request.id, reference: request.reference, problem: request.problem, priority: request.priority, actor: input.actor, createdAt: assessment.assessedAt, ids });
    const task: WorkflowTask = { ...created.task, status: "in_progress", startedByActorType: input.actor.actorType, startedByActorId: input.actor.actorId, startedByActorName: input.actor.actorName, startedAt: assessment.assessedAt };
    workflowTaskId = task.id;
    statements.push(
      taskInsert(task),
      ...created.statements.slice(1),
      ...eventStatements({ organizationId: input.organizationId, aggregateType: "workflow_task", aggregateId: task.id, eventType: "workflow_task.started", actor: input.actor, occurredAt: assessment.assessedAt, payload: { serviceRequestId: request.id, impactAssessmentId: assessment.id }, ids }),
    );
  } else if (activeTask.status === "open") {
    statements.push(
      { sql: "UPDATE ops_workflow_tasks SET status = ?, started_by_actor_type = ?, started_by_actor_id = ?, started_by_actor_name = ?, started_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["in_progress", input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, assessment.assessedAt, input.organizationId, activeTask.id, "open"] },
      ...eventStatements({ organizationId: input.organizationId, aggregateType: "workflow_task", aggregateId: activeTask.id, eventType: "workflow_task.started", actor: input.actor, occurredAt: assessment.assessedAt, payload: { serviceRequestId: request.id, impactAssessmentId: assessment.id }, ids }),
    );
  }
  await atomicRequestImpactReview({
    repository: services.repository,
    request,
    expectedLatestAssessmentId: input.expectedLatestAssessmentId,
    resultId: assessment.id,
    now: assessment.assessedAt,
    statements,
  });
  return { ...assessment, requestStatus: "under_review" as const, workflowTaskId };
}
