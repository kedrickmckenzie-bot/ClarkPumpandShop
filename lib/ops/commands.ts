import type { OpsRepository, OpsStatement } from "./repository";
import { atomicRequestMutation, atomicWorkOrderMutation, atomicWorkOrderSetMutation, persistedRequestVersion } from "./concurrency";
import { OpsDomainError } from "./errors";
import { assertWorkOrderReadyForClosure } from "./work-order-verification-commands";
import { prepareApprovalRequestForWorkOrder } from "./approval-governance";
import {
  buildInitialRequestImpactAssessment,
  buildInitialRequestReviewTask,
  type RequestImpactAssessmentDraft,
} from "./request-impact-assessment";
import {
  legacyOutcomeFromSiteVisit,
  siteVisitOutcomeFromLegacy,
  siteVisitOutcomeRequiresFollowUp,
} from "./site-visit-outcomes";
import { blockingVendorComplianceIssue, heldWorkVendorEligibility } from "./held-work-policy";
import {
  buildCompleteTasksForTransition,
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildReplacePrimaryTaskStatements,
  buildStartWorkflowTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
  selectPrimaryWorkflowTask,
  workflowTaskUpdateStatement,
} from "./workflow-task-commands";
import type { ServiceAuthorizationSnapshot } from "./view-models";
import type {
  ActorContext,
  AssignmentKind,
  AssignmentStatus,
  IsoDateTime,
  HeldWorkPosture,
  LocationObservation,
  OpsId,
  SiteVisitWorkOrder,
  SiteVisitWorkOrderOutcome,
  VendorFollowUpTiming,
  ServiceRequest,
  VendorResponseKind,
  VisitChannel,
  VisitOutcome,
  WorkOrder,
  WorkOrderEstimateRequest,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkflowTask,
  WorkflowTaskPriority,
  WorkflowTaskType,
} from "./types";

export interface OpsClock { now(): IsoDateTime }
export interface OpsIdSource { next(prefix: string): OpsId }
export interface OpsCommandServices { repository: OpsRepository; clock?: OpsClock; ids?: OpsIdSource }

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function required(value: string, label: string) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return clean;
}

function json(value: unknown) { return JSON.stringify(value); }

const terminalWorkOrderStatuses = new Set<WorkOrderStatus>(["closed", "cancelled"]);

/**
 * The generic control editor is intentionally not a workflow-state machine.
 * Evidence-bearing states are projected only by their named domain commands
 * (issuance, vendor response, visit check-in/out, and follow-up completion).
 */
const workOrderControlTransitionMap: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  draft: ["cancelled"],
  awaiting_approval: ["cancelled"],
  approved: ["cancelled"],
  issued: ["cancelled"],
  accepted: ["cancelled"],
  scheduled: ["cancelled"],
  in_progress: ["cancelled"],
  waiting_on_vendor: ["cancelled"],
  waiting_on_parts: ["cancelled"],
  completed_pending_review: ["cancelled"],
  resolved: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function allowedWorkOrderControlTransitions(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return workOrderControlTransitionMap[status];
}

/** @deprecated Prefer the explicit control-editor name. */
export function allowedWorkOrderTransitions(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return allowedWorkOrderControlTransitions(status);
}

const routeAndIssueEligibleStatuses = new Set<WorkOrderStatus>([
  "approved",
  "issued",
  "accepted",
  "scheduled",
  "waiting_on_vendor",
  "waiting_on_parts",
]);

const vendorResponseClosedWorkStatuses = new Set<WorkOrderStatus>([
  "in_progress",
  "waiting_on_vendor",
  "waiting_on_parts",
  "completed_pending_review",
  "resolved",
  "closed",
  "cancelled",
]);

const openBidRequestStatuses = new Set(["requested", "opened", "submitted"]);

function assertNoOpenBidRequests(requests: WorkOrderEstimateRequest[]) {
  if (requests.some((request) => openBidRequestStatuses.has(request.status))) {
    throw new OpsDomainError(
      "CONFLICT",
      "Open bid requests must be selected or withdrawn before service work can be issued",
    );
  }
}

export function canRouteAndIssueWorkOrder(status: WorkOrderStatus): boolean {
  return routeAndIssueEligibleStatuses.has(status);
}

function addHours(instant: IsoDateTime, hours: number): IsoDateTime {
  return new Date(Date.parse(instant) + hours * 60 * 60 * 1000).toISOString();
}

function defaultWorkOrderDueAt(priority: WorkOrderPriority, createdAt: IsoDateTime): IsoDateTime {
  const hours: Record<WorkOrderPriority, number> = {
    emergency: 2,
    urgent: 24,
    routine: 72,
    planned: 168,
  };
  return addHours(createdAt, hours[priority]);
}

function workflowTaskPriority(priority: WorkOrderPriority): WorkflowTaskPriority {
  return ({ emergency: "critical", urgent: "high", routine: "normal", planned: "low" } as const)[priority];
}

function vendorResponseDueAt(priority: WorkOrderPriority, now: IsoDateTime): IsoDateTime {
  return addHours(now, ({ emergency: 1, urgent: 4, routine: 24, planned: 48 } as const)[priority]);
}

function nextTaskDueAt(candidate: IsoDateTime | undefined, now: IsoDateTime, fallbackHours = 24): IsoDateTime {
  return candidate && Date.parse(candidate) >= Date.parse(now) ? candidate : addHours(now, fallbackHours);
}

function taskDraft(input: {
  workOrder: Pick<WorkOrder, "number" | "problem" | "priority">;
  taskType: WorkflowTaskType;
  title: string;
  assignee: Pick<WorkflowTask, "assigneeType" | "assigneeId" | "assigneeRole" | "assigneeName">;
  dueAt?: IsoDateTime;
  noSlaReason?: string;
  applicableSlaClock?: WorkflowTask["applicableSlaClock"];
  blocking?: boolean;
  requiredForProgress?: boolean;
  sourceFollowUpId?: OpsId;
  sourceApprovalRequestId?: OpsId;
  escalationDestination?: string;
  completionCriteria?: string;
  initialStatus?: "open" | "in_progress";
}) {
  return {
    taskType: input.taskType,
    title: input.title,
    reason: `Keep ${input.workOrder.number} moving: ${input.workOrder.problem}`,
    ...input.assignee,
    priority: workflowTaskPriority(input.workOrder.priority),
    blocking: input.blocking ?? true,
    requiredForProgress: input.requiredForProgress ?? true,
    dueAt: input.dueAt,
    noSlaReason: input.dueAt ? undefined : input.noSlaReason ?? "No SLA target applies to this obligation",
    applicableSlaClock: input.applicableSlaClock,
    completionCriteria: input.completionCriteria ?? `Record evidence that this action is complete: ${input.title}`,
    escalationDestination: input.escalationDestination ?? "Facilities director",
    escalationLevel: 0,
    sourceFollowUpId: input.sourceFollowUpId,
    sourceApprovalRequestId: input.sourceApprovalRequestId,
    initialStatus: input.initialStatus,
  };
}

function facilitiesAssignee(name = "Facilities coordinator") {
  return { assigneeType: "role" as const, assigneeRole: "facilities_admin" as const, assigneeName: name };
}

function buildReplaceMatchingTaskStatements(input: {
  workOrder: WorkOrder;
  tasks: readonly WorkflowTask[];
  targetTask?: WorkflowTask;
  replacementTask: WorkflowTask;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  ids: OpsIdSource;
  resolutionNote: string;
}) {
  const targetTask = input.targetTask && ["open", "in_progress"].includes(input.targetTask.status)
    ? input.targetTask
    : undefined;
  const resolvedTasks = input.tasks.map((task): WorkflowTask => task.id === targetTask?.id
    ? {
        ...task,
        status: "completed",
        completedByActorType: input.actor.actorType,
        completedByActorId: input.actor.actorId,
        completedByActorName: input.actor.actorName,
        completedAt: input.occurredAt,
        resolutionNote: input.resolutionNote,
      }
    : task);
  return [
    ...(targetTask ? buildCompleteWorkflowTaskStatements({
      task: targetTask, actor: input.actor, occurredAt: input.occurredAt,
      ids: input.ids, resolutionNote: input.resolutionNote,
    }) : []),
    ...buildCreateTaskStatements({ task: input.replacementTask, actor: input.actor, ids: input.ids }),
    buildWorkflowTaskProjectionStatement(
      input.workOrder.organizationId,
      input.workOrder.id,
      [...resolvedTasks, input.replacementTask],
    ),
  ];
}

function taskForCreatedWorkOrder(input: {
  workOrder: WorkOrder;
  assignment?: CreateWorkOrderInput["initialAssignment"];
  approvalRequest?: { id: OpsId; requiredRole: NonNullable<WorkflowTask["assigneeRole"]>; dueAt?: IsoDateTime };
}) {
  if (input.approvalRequest) {
    const assigneeName = input.workOrder.accountableParty;
    return taskDraft({
      workOrder: input.workOrder,
      taskType: "approve_quote",
      title: "Review authorization",
      assignee: { assigneeType: "role", assigneeRole: input.approvalRequest.requiredRole, assigneeName },
      dueAt: input.approvalRequest.dueAt,
      applicableSlaClock: "approval",
      sourceApprovalRequestId: input.approvalRequest.id,
      escalationDestination: input.workOrder.escalationTo,
      completionCriteria: "Record an authorized, rejected, escalated, or cancelled approval decision",
    });
  }
  if (input.assignment?.kind === "internal" && input.assignment.internalMembershipId) {
    return taskDraft({
      workOrder: input.workOrder,
      taskType: "schedule_service",
      title: input.workOrder.nextAction,
      assignee: { assigneeType: "user", assigneeId: input.assignment.internalMembershipId, assigneeName: input.workOrder.accountableParty },
      dueAt: input.workOrder.dueAt,
      applicableSlaClock: "scheduling",
      escalationDestination: input.workOrder.escalationTo,
    });
  }
  return taskDraft({
    workOrder: input.workOrder,
    taskType: input.assignment?.kind === "outside_vendor" ? "other" : "choose_service_provider",
    title: input.workOrder.nextAction,
    assignee: facilitiesAssignee(input.workOrder.accountableParty),
    dueAt: input.workOrder.dueAt,
    applicableSlaClock: "scheduling",
    escalationDestination: input.workOrder.escalationTo,
  });
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function revokeServiceAuthorizationTokens(
  organizationId: OpsId,
  issuanceIds: readonly OpsId[],
  now: IsoDateTime,
): OpsStatement[] {
  return issuanceIds.map((issuanceId) => ({
    sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
    params: [now, organizationId, "service_authorization", "work_order_issuance", issuanceId],
  }));
}

async function assertSelectedEstimateIsCurrent(
  repository: OpsRepository,
  selectedEstimate: WorkOrderEstimateRequest | undefined,
  now: IsoDateTime,
) {
  if (!selectedEstimate) return;
  const proposal = await repository.getLatestEstimateProposal(
    selectedEstimate.organizationId,
    selectedEstimate.id,
  );
  if (!proposal) {
    throw new OpsDomainError("CONFLICT", "The selected bid is missing its proposal evidence. Reopen the provider decision before issuing service work.");
  }
  if (proposal.validUntil && Date.parse(proposal.validUntil) <= Date.parse(now)) {
    throw new OpsDomainError("CONFLICT", "The selected vendor bid has expired. Reopen the bid decision before issuing work.");
  }
}

export interface CommandIdempotency {
  key: string;
  command: string;
  requestHash: string;
  expiresAt: IsoDateTime;
}

function idempotencyStatement(
  organizationId: OpsId,
  resultId: OpsId,
  now: IsoDateTime,
  input: CommandIdempotency,
): OpsStatement {
  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(input.key)) throw new OpsDomainError("VALIDATION", "Idempotency key is invalid");
  if (!/^[a-z0-9._:-]{3,100}$/.test(input.command)) throw new OpsDomainError("VALIDATION", "Idempotency command is invalid");
  if (!/^[a-f0-9]{64}$/i.test(input.requestHash)) throw new OpsDomainError("VALIDATION", "Idempotency request hash is invalid");
  if (input.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Idempotency expiry must be in the future");
  return insert("ops_idempotency_keys", {
    organization_id: organizationId,
    key: input.key,
    command: input.command,
    result_id: resultId,
    request_hash: input.requestHash.toLowerCase(),
    created_at: now,
    expires_at: input.expiresAt,
  });
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
      id: input.ids.next("audit"), organization_id: input.organizationId,
      aggregate_type: input.aggregateType, aggregate_id: input.aggregateId,
      event_type: input.eventType, actor_type: input.actor.actorType,
      actor_id: input.actor.actorId, actor_name: input.actor.actorName,
      occurred_at: input.occurredAt, payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"), organization_id: input.organizationId,
      topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId, payload_json: payloadJson,
      status: "pending", available_at: input.occurredAt, created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

export { OpsDomainError } from "./errors";

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
}

const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const LOCATION_MAX_FUTURE_SKEW_MS = 60 * 1000;

function assertFreshLocationCapture(location: LocationObservation, serverObservedAt: IsoDateTime) {
  const capturedAt = Date.parse(location.capturedAt);
  const observedAt = Date.parse(serverObservedAt);
  if (!Number.isFinite(capturedAt)) throw new OpsDomainError("VALIDATION", "Location capture time is invalid");
  const age = observedAt - capturedAt;
  if (age > LOCATION_MAX_AGE_MS || age < -LOCATION_MAX_FUTURE_SKEW_MS) {
    throw new OpsDomainError("VALIDATION", "Location evidence must be captured at check-in or checkout time");
  }
}

export interface CreateStoreInput {
  organizationId: OpsId; regionId?: OpsId; storeNumber: string; name: string;
  address1: string; address2?: string; city: string; state: string; postalCode: string;
  aliases?: string[]; latitudeE6?: number; longitudeE6?: number; geofenceRadiusM?: number;
  locationPolicyEnabled?: boolean; timeZone?: string; actor: ActorContext;
}

export async function createStore(svc: OpsCommandServices, input: CreateStoreInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getOrganization(input.organizationId))) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const now = clock.now();
  const id = ids.next("store");
  const storeNumber = required(input.storeNumber, "Store number");
  const name = required(input.name, "Store name");
  const address1 = required(input.address1, "Address");
  const city = required(input.city, "City");
  const state = required(input.state, "State");
  const postalCode = required(input.postalCode, "Postal code");
  const aliases = [...new Set((input.aliases ?? []).map((item) => item.trim()).filter(Boolean))];
  const searchText = [storeNumber, name, address1, input.address2, city, state, postalCode, ...aliases].filter(Boolean).join(" ").toLocaleLowerCase("en-US");
  const statements = [
    insert("ops_stores", {
      id, organization_id: input.organizationId, region_id: input.regionId,
      store_number: storeNumber, name, address_1: address1, address_2: input.address2,
      city, state, postal_code: postalCode, aliases_json: json(aliases), search_text: searchText,
      latitude_e6: input.latitudeE6, longitude_e6: input.longitudeE6,
      geofence_radius_m: input.geofenceRadiusM ?? 200, location_policy_enabled: input.locationPolicyEnabled === false ? 0 : 1,
      time_zone: input.timeZone, status: "active", created_at: now,
    }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "store", aggregateId: id, eventType: "store.created", actor: input.actor, occurredAt: now, payload: { storeNumber, name }, ids }),
  ];
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, regionId: input.regionId, storeNumber, name, address1, address2: input.address2, city, state, postalCode, aliases, latitudeE6: input.latitudeE6, longitudeE6: input.longitudeE6, geofenceRadiusM: input.geofenceRadiusM ?? 200, locationPolicyEnabled: input.locationPolicyEnabled !== false, timeZone: input.timeZone, status: "active" as const, createdAt: now };
}

export interface OnboardVendorInput {
  organizationId: OpsId; code: string; name: string; dispatchEmail: string; dispatchPhone?: string;
  preferred?: boolean; specialties: Array<{ canonicalKey: string; displayName: string; searchAliases?: string[] }>;
  coverage: Array<{ scopeKind: "organization" | "region" | "store"; scopeId: OpsId; preferredRank?: number }>;
  actor: ActorContext;
}

export async function onboardVendor(svc: OpsCommandServices, input: OnboardVendorInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getOrganization(input.organizationId))) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const now = clock.now();
  const id = ids.next("vendor");
  const code = required(input.code, "Vendor code");
  const name = required(input.name, "Vendor name");
  const dispatchEmail = required(input.dispatchEmail, "Dispatch email");
  if (!dispatchEmail.includes("@")) throw new OpsDomainError("VALIDATION", "Dispatch email is invalid");
  if (!input.specialties.length) throw new OpsDomainError("VALIDATION", "At least one specialty is required");
  const searchText = [name, ...input.specialties.flatMap((item) => [item.displayName, ...(item.searchAliases ?? [])])].join(" ").toLocaleLowerCase("en-US");
  const statements: OpsStatement[] = [insert("ops_vendors", { id, organization_id: input.organizationId, code, name, dispatch_email: dispatchEmail, dispatch_phone: input.dispatchPhone, status: "approved", preferred: input.preferred ? 1 : 0, search_text: searchText, created_at: now })];
  for (const specialty of input.specialties) statements.push(insert("ops_vendor_specialties", { id: ids.next("specialty"), organization_id: input.organizationId, vendor_id: id, canonical_key: required(specialty.canonicalKey, "Specialty key"), display_name: required(specialty.displayName, "Specialty name"), search_aliases_json: json(specialty.searchAliases ?? []) }));
  for (const coverage of input.coverage) statements.push(insert("ops_vendor_coverage", { id: ids.next("coverage"), organization_id: input.organizationId, vendor_id: id, scope_kind: coverage.scopeKind, scope_id: coverage.scopeId, preferred_rank: coverage.preferredRank }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "vendor", aggregateId: id, eventType: "vendor.onboarded", actor: input.actor, occurredAt: now, payload: { code, name, specialtyCount: input.specialties.length }, ids }));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, code, name, dispatchEmail, dispatchPhone: input.dispatchPhone, status: "approved" as const, preferred: input.preferred ?? false, createdAt: now };
}

export interface RecordVendorComplianceDocumentInput {
  organizationId: OpsId;
  vendorId: OpsId;
  documentType: "insurance" | "license" | "certification" | "tax" | "safety" | "other";
  issuer?: string;
  reference: string;
  effectiveAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
  reviewStatus: "pending" | "approved" | "rejected" | "expired";
  blocking?: boolean;
  storedFileId?: OpsId;
  actor: ActorContext;
}

export async function recordVendorComplianceDocument(svc: OpsCommandServices, input: RecordVendorComplianceDocumentInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const vendor = await repository.getVendor(input.organizationId, input.vendorId);
  if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
  const now = clock.now();
  const id = ids.next("vendor-document");
  const reference = required(input.reference, "Document reference");
  if (input.effectiveAt && input.expiresAt && Date.parse(input.expiresAt) < Date.parse(input.effectiveAt)) {
    throw new OpsDomainError("VALIDATION", "Document expiration cannot be before its effective date");
  }
  const statements: OpsStatement[] = [
    insert("ops_vendor_compliance_documents", {
      id,
      organization_id: input.organizationId,
      vendor_id: vendor.id,
      document_type: input.documentType,
      issuer: input.issuer,
      reference,
      effective_at: input.effectiveAt,
      expires_at: input.expiresAt,
      review_status: input.reviewStatus,
      blocking: input.blocking ? 1 : 0,
      stored_file_id: input.storedFileId,
      created_at: now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "vendor",
      aggregateId: vendor.id,
      eventType: "vendor.compliance_document_recorded",
      actor: input.actor,
      occurredAt: now,
      payload: { documentId: id, documentType: input.documentType, reviewStatus: input.reviewStatus, blocking: Boolean(input.blocking) },
      ids,
    }),
  ];
  await repository.atomicWrite(statements);
  return { id, vendorId: vendor.id, recordedAt: now };
}

export interface RecordVendorQualificationInput {
  organizationId: OpsId;
  vendorId: OpsId;
  tradeKey: string;
  workType?: string;
  serviceType?: string;
  assetType?: string;
  componentType?: string;
  pmWork?: boolean;
  emergencyResponse?: boolean;
  warrantyWork?: boolean;
  manufacturerAuthorization?: string;
  regionId?: OpsId;
  storeId?: OpsId;
  afterHours?: boolean;
  maximumJobAmountMinor?: number;
  currency?: string;
  requiredLicense?: string;
  requiredCertification?: string;
  effectiveAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
  actor: ActorContext;
}

export async function recordVendorQualification(svc: OpsCommandServices, input: RecordVendorQualificationInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const vendor = await repository.getVendor(input.organizationId, input.vendorId);
  if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
  if (input.maximumJobAmountMinor !== undefined && (!Number.isInteger(input.maximumJobAmountMinor) || input.maximumJobAmountMinor < 0)) {
    throw new OpsDomainError("VALIDATION", "Maximum job amount must be zero or greater");
  }
  const now = clock.now();
  const effectiveAt = input.effectiveAt ?? now;
  if (input.expiresAt && Date.parse(input.expiresAt) < Date.parse(effectiveAt)) {
    throw new OpsDomainError("VALIDATION", "Qualification expiration cannot be before its effective date");
  }
  const id = ids.next("vendor-qualification");
  const tradeKey = required(input.tradeKey, "Trade");
  const statements: OpsStatement[] = [
    insert("ops_vendor_qualifications", {
      id,
      organization_id: input.organizationId,
      vendor_id: vendor.id,
      trade_key: tradeKey,
      work_type: input.workType,
      service_type: input.serviceType,
      asset_type: input.assetType,
      component_type: input.componentType,
      pm_work: input.pmWork ? 1 : 0,
      emergency_response: input.emergencyResponse ? 1 : 0,
      warranty_work: input.warrantyWork ? 1 : 0,
      manufacturer_authorization: input.manufacturerAuthorization,
      region_id: input.regionId,
      store_id: input.storeId,
      after_hours: input.afterHours ? 1 : 0,
      maximum_job_amount_minor: input.maximumJobAmountMinor,
      currency: input.maximumJobAmountMinor === undefined ? undefined : input.currency ?? "USD",
      required_license: input.requiredLicense,
      required_certification: input.requiredCertification,
      effective_at: effectiveAt,
      expires_at: input.expiresAt,
      status: "active",
      created_at: now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "vendor",
      aggregateId: vendor.id,
      eventType: "vendor.qualification_recorded",
      actor: input.actor,
      occurredAt: now,
      payload: { qualificationId: id, tradeKey, pmWork: Boolean(input.pmWork), emergencyResponse: Boolean(input.emergencyResponse), afterHours: Boolean(input.afterHours) },
      ids,
    }),
  ];
  await repository.atomicWrite(statements);
  return { id, vendorId: vendor.id, recordedAt: now };
}

export interface CreateServiceRequestInput {
  organizationId: OpsId; storeId: OpsId; reporterName: string; reporterEmployeeId?: string;
  problem: string; priority?: WorkOrderPriority; impact?: RequestImpactAssessmentDraft; idempotency?: CommandIdempotency; actor: ActorContext;
}

export async function createServiceRequest(svc: OpsCommandServices, input: CreateServiceRequestInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!(await repository.getStore(input.organizationId, input.storeId))) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  const now = clock.now(); const id = ids.next("request"); const reference = `REQ-${id.slice(-8).toUpperCase()}`;
  const problem = required(input.problem, "Problem description"); const reporterName = required(input.reporterName, "Reporter name");
  const priority = input.priority ?? "routine";
  const impact = buildInitialRequestImpactAssessment({ organizationId: input.organizationId, requestId: id, storeId: input.storeId, draft: input.impact, actor: input.actor, assessedAt: now, ids });
  const reviewTask = buildInitialRequestReviewTask({ organizationId: input.organizationId, requestId: id, reference, problem, priority, actor: input.actor, createdAt: now, ids });
  const statements: OpsStatement[] = [
    insert("ops_requests", { id, organization_id: input.organizationId, reference, store_id: input.storeId, reporter_name: reporterName, reporter_employee_id: input.reporterEmployeeId, problem, priority, status: "submitted", version: 0, submitted_at: now }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "request", aggregateId: id, eventType: "request.submitted", actor: input.actor, occurredAt: now, payload: { reference, storeId: input.storeId, problem }, ids }),
    ...impact.statements,
    ...reviewTask.statements,
  ];
  if (input.idempotency) statements.unshift(idempotencyStatement(input.organizationId, id, now, input.idempotency));
  await repository.atomicWrite(statements);
  return { id, organizationId: input.organizationId, reference, storeId: input.storeId, reporterName, reporterEmployeeId: input.reporterEmployeeId, problem, priority, status: "submitted" as const, version: 0, submittedAt: now, impactAssessment: impact.assessment, workflowTask: reviewTask.task };
}

export interface CreateWorkOrderInput {
  organizationId: OpsId; number?: string; storeId: OpsId; requestId?: OpsId; problem: string;
  authorizedScope?: string; categoryKey?: string; taxonomyNodeId?: OpsId; assetId?: OpsId; componentId?: OpsId;
  priority?: WorkOrderPriority; accountableParty: string; nextAction: string; dueAt?: IsoDateTime;
  escalationTo?: string; nteAmountMinor?: number; currency?: string;
  repairEstimateAmountMinor?: number; repairEstimateCurrency?: string;
  estimatedServiceExtensionMonths?: number;
  initialAssignment?: {
    kind: AssignmentKind;
    vendorId?: OpsId;
    internalMembershipId?: OpsId;
  };
  holdForVisit?: {
    posture: HeldWorkPosture;
    deadlineAt: IsoDateTime;
    internalReviewThresholdAmountMinor?: number;
    currency?: string;
  };
  actor: ActorContext;
}

export async function createWorkOrder(svc: OpsCommandServices, input: CreateWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  let sourceReviewTasks: WorkflowTask[] = [];
  let sourceRequest: ServiceRequest | undefined;
  if (input.requestId) {
    const request = await repository.getRequest(input.organizationId, input.requestId);
    if (!request || request.storeId !== input.storeId) throw new OpsDomainError("NOT_FOUND", "Request not found for this store and organization");
    if (request.status === "converted" || request.convertedWorkOrderId) throw new OpsDomainError("CONFLICT", "Request already has a canonical work order");
    if (request.status !== "under_review") throw new OpsDomainError("CONFLICT", "Review and confirm the request impact before creating its work order");
    const assessments = await repository.listRequestImpactAssessments(input.organizationId, request.id);
    const latestAssessment = assessments.at(-1);
    if (!latestAssessment || latestAssessment.assessmentKind !== "review" || latestAssessment.source !== "manager_review" || !latestAssessment.reviewDisposition) {
      throw new OpsDomainError("CONFLICT", "A current manager-confirmed or revised impact assessment is required before work-order creation");
    }
    const approvalRequests = await repository.listApprovalRequestsForSubject(input.organizationId, "service_request", request.id);
    if (approvalRequests.length) {
      const currentApproval = approvalRequests[0]!;
      const currentDecision = (await repository.listApprovalDecisionsForRequest(input.organizationId, currentApproval.id))[0];
      if (currentDecision?.decision !== "approved") {
        throw new OpsDomainError("CONFLICT", "The current request approval must be approved before work-order creation");
      }
    }
    sourceRequest = request;
    sourceReviewTasks = await repository.listWorkflowTasksForRequest(input.organizationId, request.id);
  }
  if (input.componentId && !input.assetId) throw new OpsDomainError("VALIDATION", "A component cannot be selected without its asset");
  if (input.taxonomyNodeId) {
    const selected = await repository.getTaxonomyNode(input.organizationId, input.taxonomyNodeId);
    if (!selected || !selected.active) throw new OpsDomainError("VALIDATION", "Taxonomy selection is not active in this organization");
    if (input.categoryKey) {
      const nodes = await repository.listTaxonomyNodes(input.organizationId);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      let root = selected;
      const visited = new Set<OpsId>();
      while (root.parentNodeId) {
        if (visited.has(root.id)) throw new OpsDomainError("VALIDATION", "Taxonomy hierarchy contains a cycle");
        visited.add(root.id);
        const parent = byId.get(root.parentNodeId);
        if (!parent) throw new OpsDomainError("VALIDATION", "Taxonomy selection has an invalid parent path");
        root = parent;
      }
      if (root.canonicalKey !== input.categoryKey) throw new OpsDomainError("VALIDATION", "Taxonomy selection must belong to the selected category");
    }
  }
  if (input.assetId) {
    const asset = await repository.getAsset(input.organizationId, input.assetId);
    if (!asset || asset.storeId !== input.storeId) throw new OpsDomainError("VALIDATION", "Asset must belong to the selected store and organization");
    if (input.categoryKey && asset.categoryKey !== input.categoryKey) throw new OpsDomainError("VALIDATION", "Asset must belong to the selected category");
    if (input.componentId) {
      const component = await repository.getComponent(input.organizationId, input.componentId);
      if (!component || component.assetId !== asset.id) throw new OpsDomainError("VALIDATION", "Component must belong to the selected asset and organization");
    }
  }
  if (input.nteAmountMinor !== undefined && (!Number.isInteger(input.nteAmountMinor) || input.nteAmountMinor < 0)) throw new OpsDomainError("VALIDATION", "NTE must be a non-negative integer minor-unit amount");
  if (input.repairEstimateAmountMinor !== undefined && (!Number.isInteger(input.repairEstimateAmountMinor) || input.repairEstimateAmountMinor < 0)) throw new OpsDomainError("VALIDATION", "Repair estimate must be a non-negative integer minor-unit amount");
  if (input.estimatedServiceExtensionMonths !== undefined && (!Number.isInteger(input.estimatedServiceExtensionMonths) || input.estimatedServiceExtensionMonths < 1 || input.estimatedServiceExtensionMonths > 1_200)) throw new OpsDomainError("VALIDATION", "Estimated service extension must be a whole number from 1 to 1,200 months");
  if ((input.repairEstimateAmountMinor !== undefined || input.estimatedServiceExtensionMonths !== undefined) && !input.assetId) throw new OpsDomainError("VALIDATION", "Repair planning inputs require a selected asset");
  if (input.initialAssignment?.kind === "outside_vendor") {
    if (!input.initialAssignment.vendorId || input.initialAssignment.internalMembershipId) {
      throw new OpsDomainError("VALIDATION", "An outside assignment requires exactly one vendor");
    }
    const vendor = await repository.getVendor(input.organizationId, input.initialAssignment.vendorId);
    if (!vendor || vendor.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Outside vendor is not approved");
    if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, input.storeId))) {
      throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
    }
  }
  if (input.initialAssignment?.kind === "internal") {
    if (!input.initialAssignment.internalMembershipId || input.initialAssignment.vendorId) {
      throw new OpsDomainError("VALIDATION", "An internal assignment requires exactly one maintenance member");
    }
    const member = await repository.getMembership(input.organizationId, input.initialAssignment.internalMembershipId);
    if (!member || member.status !== "active" || member.role !== "internal_technician") {
      throw new OpsDomainError("FORBIDDEN", "Internal assignee is not an active maintenance team member");
    }
  }
  if (input.initialAssignment?.kind === "choose_later" && (input.initialAssignment.vendorId || input.initialAssignment.internalMembershipId)) {
    throw new OpsDomainError("VALIDATION", "Choose later cannot include a provider");
  }
  const now = clock.now(); const id = ids.next("work-order");
  if (input.holdForVisit) {
    if (!input.categoryKey) throw new OpsDomainError("VALIDATION", "Choose a service category before approving work for later");
    if (input.initialAssignment && input.initialAssignment.kind !== "choose_later") throw new OpsDomainError("VALIDATION", "Held work cannot also be assigned to a provider");
    if (!Number.isFinite(Date.parse(input.holdForVisit.deadlineAt)) || input.holdForVisit.deadlineAt <= now) throw new OpsDomainError("VALIDATION", "Held work needs a future review deadline");
    if (!(["complete_using_professional_judgment", "look_and_report"] as const).includes(input.holdForVisit.posture)) throw new OpsDomainError("VALIDATION", "Choose a supported held-work instruction");
    const threshold = input.holdForVisit.internalReviewThresholdAmountMinor;
    if (threshold !== undefined && (!Number.isInteger(threshold) || threshold < 0)) throw new OpsDomainError("VALIDATION", "The internal review threshold must be a non-negative minor-unit amount");
  }
  const organization = await repository.getOrganization(input.organizationId);
  if (!organization) throw new OpsDomainError("NOT_FOUND", "Organization not found");
  const number = input.number ? required(input.number, "Work order number") : await repository.allocateWorkOrderNumber(input.organizationId, organization.workOrderPrefix, Number(now.slice(0, 4)));
  const problem = required(input.problem, "Problem description");
  const priority = input.priority ?? "routine";
  const approval = await prepareApprovalRequestForWorkOrder({
    repository,
    ids,
    organizationId: input.organizationId,
    workOrderId: id,
    store,
    categoryKey: input.categoryKey,
    amountMinor: input.nteAmountMinor,
    currency: input.currency ?? "USD",
    actor: input.actor,
    requestedAt: now,
  });
  const status: WorkOrderStatus = approval.request ? "awaiting_approval" : "approved";
  const assignmentProjection = input.holdForVisit
    ? { accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit" }
    : input.initialAssignment
    ? input.initialAssignment.kind === "outside_vendor"
      ? { accountableParty: "Facilities coordinator", nextAction: "Issue service authorization" }
      : input.initialAssignment.kind === "internal"
        ? { accountableParty: "Internal maintenance", nextAction: "Acknowledge internal assignment" }
        : { accountableParty: "Facilities coordinator", nextAction: required(input.nextAction, "Next action") }
    : undefined;
  const accountableParty = approval.request
    ? approval.request.requiredRole === "executive" ? "Executive approver" : approval.request.requiredRole === "facilities_admin" ? "Facilities administrator" : approval.request.requiredRole === "regional_manager" ? "Regional manager" : approval.request.requiredRole === "store_manager" ? "Store manager" : "Finance reviewer"
    : assignmentProjection?.accountableParty ?? required(input.accountableParty, "Accountable party");
  const nextAction = approval.request ? "Review authorization" : assignmentProjection?.nextAction ?? required(input.nextAction, "Next action");
  const dueAt = approval.request?.dueAt ?? input.holdForVisit?.deadlineAt ?? input.dueAt ?? defaultWorkOrderDueAt(priority, now);
  const escalationTo = required(input.escalationTo ?? "Facilities director", "Escalation destination");
  const statements: OpsStatement[] = [insert("ops_work_orders", { id, organization_id: input.organizationId, number, store_id: input.storeId, request_id: input.requestId, problem, authorized_scope: input.authorizedScope, category_key: input.categoryKey, taxonomy_node_id: input.taxonomyNodeId, asset_id: input.assetId, component_id: input.componentId, priority, status, version: 0, accountable_party: accountableParty, next_action: nextAction, due_at: dueAt, escalation_to: escalationTo, nte_amount_minor: input.nteAmountMinor, nte_currency: input.nteAmountMinor === undefined ? undefined : input.currency ?? "USD", repair_estimate_amount_minor: input.repairEstimateAmountMinor, repair_estimate_currency: input.repairEstimateAmountMinor === undefined ? undefined : input.repairEstimateCurrency ?? "USD", estimated_service_extension_months: input.estimatedServiceExtensionMonths, created_at: now })];
  const visitHoldId = input.holdForVisit ? ids.next("visit-hold") : undefined;
  if (input.holdForVisit) {
    statements.push(insert("ops_work_order_visit_holds", {
      id: visitHoldId, organization_id: input.organizationId, work_order_id: id,
      posture: input.holdForVisit.posture, status: "active",
      internal_review_threshold_minor: input.holdForVisit.internalReviewThresholdAmountMinor,
      currency: input.holdForVisit.internalReviewThresholdAmountMinor === undefined ? undefined : input.holdForVisit.currency ?? "USD",
      deadline_at: input.holdForVisit.deadlineAt, version: 0,
      created_by_membership_id: input.actor.actorId, created_by_name: input.actor.actorName,
      created_at: now, updated_at: now,
    }));
  }
  statements.push(...approval.statements);
  if (sourceRequest) statements.push({ sql: "UPDATE ops_requests SET status = ?, converted_work_order_id = ? WHERE organization_id = ? AND id = ? AND store_id = ? AND version = ? AND status = ? AND converted_work_order_id IS NULL", params: ["converted", id, input.organizationId, sourceRequest.id, input.storeId, persistedRequestVersion(sourceRequest) + 1, "under_review"] });
  sourceReviewTasks.filter((task) => task.taskType === "review_issue" && ["open", "in_progress"].includes(task.status)).forEach((task) => {
    statements.push(...buildCompleteWorkflowTaskStatements({ task, actor: input.actor, occurredAt: now, ids, resolutionNote: `Impact review completed; converted to ${number}` }));
  });
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: id, eventType: "work_order.created", actor: input.actor, occurredAt: now, payload: { number, storeId: input.storeId, requestId: input.requestId, classified: Boolean(input.categoryKey), assetLinked: Boolean(input.assetId), repairPlanning: input.repairEstimateAmountMinor === undefined && input.estimatedServiceExtensionMonths === undefined ? undefined : { repairEstimateAmountMinor: input.repairEstimateAmountMinor, repairEstimateCurrency: input.repairEstimateAmountMinor === undefined ? undefined : input.repairEstimateCurrency ?? "USD", estimatedServiceExtensionMonths: input.estimatedServiceExtensionMonths } }, ids }));
  if (input.holdForVisit) statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: id, eventType: "work_order.visit_hold_created", actor: input.actor, occurredAt: now, payload: { holdId: visitHoldId, posture: input.holdForVisit.posture, deadlineAt: input.holdForVisit.deadlineAt, internalReviewThresholdRecorded: input.holdForVisit.internalReviewThresholdAmountMinor !== undefined, thresholdMeaning: "internal_invoice_review_not_vendor_price_or_authorization" }, ids }));
  let initialAssignment: Awaited<ReturnType<typeof assignWorkOrder>> | undefined;
  if (input.initialAssignment) {
    const assignmentId = ids.next("assignment");
    statements.push(
      insert("ops_work_order_assignments", {
        id: assignmentId,
        organization_id: input.organizationId,
        work_order_id: id,
        kind: input.initialAssignment.kind,
        vendor_id: input.initialAssignment.vendorId,
        internal_membership_id: input.initialAssignment.internalMembershipId,
        status: "pending",
        assigned_at: now,
      }),
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: id,
        eventType: "work_order.assigned",
        actor: input.actor,
        occurredAt: now,
        payload: {
          assignmentId,
          kind: input.initialAssignment.kind,
          vendorId: input.initialAssignment.vendorId,
          internalMembershipId: input.initialAssignment.internalMembershipId,
          initialAssignment: true,
        },
        ids,
      }),
    );
    initialAssignment = {
      id: assignmentId,
      organizationId: input.organizationId,
      workOrderId: id,
      kind: input.initialAssignment.kind,
      vendorId: input.initialAssignment.vendorId,
      internalMembershipId: input.initialAssignment.internalMembershipId,
      status: "pending",
      assignedAt: now,
    };
  }
  const createdWorkOrder: WorkOrder = {
    id, organizationId: input.organizationId, number, storeId: input.storeId, requestId: input.requestId,
    problem, authorizedScope: input.authorizedScope, categoryKey: input.categoryKey,
    taxonomyNodeId: input.taxonomyNodeId, assetId: input.assetId, componentId: input.componentId,
    priority, status, version: 0, accountableParty, nextAction, dueAt, escalationTo,
    nte: input.nteAmountMinor === undefined ? undefined : { amountMinor: input.nteAmountMinor, currency: input.currency ?? "USD" },
    repairEstimate: input.repairEstimateAmountMinor === undefined ? undefined : { amountMinor: input.repairEstimateAmountMinor, currency: input.repairEstimateCurrency ?? "USD" },
    estimatedServiceExtensionMonths: input.estimatedServiceExtensionMonths,
    createdAt: now,
  };
  const initialTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"),
    organizationId: input.organizationId,
    workOrderId: id,
    draft: taskForCreatedWorkOrder({ workOrder: createdWorkOrder, assignment: input.initialAssignment, approvalRequest: approval.request }),
    actor: input.actor,
    createdAt: now,
  });
  statements.push(
    ...buildCreateTaskStatements({ task: initialTask, actor: input.actor, ids }),
    buildWorkflowTaskProjectionStatement(input.organizationId, id, [initialTask]),
  );
  if (sourceRequest) {
    await atomicRequestMutation({
      repository,
      request: sourceRequest,
      now,
      statements,
      conflictMessage: "This request changed or was already converted. Refresh before creating its work order.",
    });
  } else {
    await repository.atomicWrite(statements);
  }
  return { ...createdWorkOrder, initialAssignment, approvalRequest: approval.request, visitHoldId };
}

export interface PlaceWorkOrderOnVisitHoldInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  posture: HeldWorkPosture;
  deadlineAt: IsoDateTime;
  internalReviewThresholdAmountMinor?: number;
  currency?: string;
  actor: ActorContext;
}

/** Creates or updates the one manager-approved "while you're here" posture for a canonical work order. */
export async function placeWorkOrderOnVisitHold(svc: OpsCommandServices, input: PlaceWorkOrderOnVisitHoldInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (terminalWorkOrderStatuses.has(workOrder.status) || workOrder.status === "resolved") throw new OpsDomainError("CONFLICT", "Closed or resolved work cannot be approved for the next suitable visit");
  if (workOrder.status !== "approved") throw new OpsDomainError("CONFLICT", "Only manager-approved work can be held for a future vendor visit");
  if (!workOrder.categoryKey) throw new OpsDomainError("VALIDATION", "Choose a service category before holding this work");
  const now = clock.now();
  if (!Number.isFinite(Date.parse(input.deadlineAt)) || input.deadlineAt <= now) throw new OpsDomainError("VALIDATION", "Held work needs a future review deadline");
  if (!(["complete_using_professional_judgment", "look_and_report"] as const).includes(input.posture)) throw new OpsDomainError("VALIDATION", "Choose a supported held-work instruction");
  if (input.internalReviewThresholdAmountMinor !== undefined && (!Number.isInteger(input.internalReviewThresholdAmountMinor) || input.internalReviewThresholdAmountMinor < 0)) throw new OpsDomainError("VALIDATION", "The internal review threshold must be a non-negative amount");
  const existing = await repository.getWorkOrderVisitHold(input.organizationId, workOrder.id);
  if (existing?.status === "claimed") throw new OpsDomainError("CONFLICT", "This work was claimed by an active visit. Review that visit before changing the hold");
  if (existing?.status === "completed") throw new OpsDomainError("CONFLICT", "Completed work cannot be approved for a future visit again");
  const activeAssignment = await repository.getActiveAssignment(input.organizationId, workOrder.id);
  if (activeAssignment && ["issued", "opened", "accepted"].includes(activeAssignment.status)) throw new OpsDomainError("CONFLICT", "Work already sent to a provider cannot be moved to a future-visit hold");
  const holdId = existing?.id ?? ids.next("visit-hold");
  const holdStatement: OpsStatement = existing
    ? {
        sql: "UPDATE ops_work_order_visit_holds SET posture = ?, status = ?, internal_review_threshold_minor = ?, currency = ?, deadline_at = ?, version = version + 1, claimed_visit_id = NULL, claimed_vendor_id = NULL, claimed_at = NULL, planned_review_appointment_id = NULL, planned_review_selected_at = NULL, planned_review_selected_by_membership_id = NULL, updated_at = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND version = ? AND status = ?",
        params: [
          input.posture,
          "active",
          input.internalReviewThresholdAmountMinor ?? null,
          input.internalReviewThresholdAmountMinor === undefined ? null : input.currency ?? "USD",
          input.deadlineAt,
          now,
          input.organizationId,
          existing.id,
          workOrder.id,
          existing.version,
          existing.status,
        ],
      }
    : insert("ops_work_order_visit_holds", {
        id: holdId,
        organization_id: input.organizationId,
        work_order_id: workOrder.id,
        posture: input.posture,
        status: "active",
        internal_review_threshold_minor: input.internalReviewThresholdAmountMinor,
        currency: input.internalReviewThresholdAmountMinor === undefined ? undefined : input.currency ?? "USD",
        deadline_at: input.deadlineAt,
        version: 0,
        created_by_membership_id: input.actor.actorId,
        created_by_name: input.actor.actorName,
        created_at: now,
        updated_at: now,
      });
  const statements: OpsStatement[] = [
    holdStatement,
    { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ? WHERE organization_id = ? AND id = ?", params: ["Facilities coordinator", "Wait for a matching vendor visit", input.deadlineAt, input.organizationId, workOrder.id] },
  ];
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder, taskType: "choose_service_provider", title: "Wait for a matching vendor visit", assignee: facilitiesAssignee(), dueAt: input.deadlineAt, applicableSlaClock: "scheduling", escalationDestination: workOrder.escalationTo, completionCriteria: "A matching vendor claims the approved work onsite, or facilities releases the hold" }),
    actor: input.actor, createdAt: now,
  });
  statements.push(...buildReplaceMatchingTaskStatements({ workOrder, tasks, targetTask: selectPrimaryWorkflowTask(tasks), replacementTask, actor: input.actor, occurredAt: now, ids, resolutionNote: existing ? "Held-work instructions updated" : "Work held for a matching vendor visit" }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: existing ? "work_order.visit_hold_updated" : "work_order.visit_hold_created", actor: input.actor, occurredAt: now, payload: { holdId, posture: input.posture, deadlineAt: input.deadlineAt, internalReviewThresholdRecorded: input.internalReviewThresholdAmountMinor !== undefined, thresholdMeaning: "internal_invoice_review_not_vendor_price_or_authorization" }, ids }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements, conflictMessage: "This work order changed. Refresh before updating its future-visit hold." });
  return { id: holdId, workOrderId: workOrder.id, posture: input.posture, status: "active" as const, deadlineAt: input.deadlineAt };
}

export interface PlanHeldWorkForConfirmedAppointmentInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  appointmentId: OpsId;
  expectedHoldVersion: number;
  actor: ActorContext;
}

/**
 * Records a manager's plan to show one held job to the vendor associated with
 * a confirmed appointment. This does not assign the job or add it to a visit;
 * only the technician's atomic onsite claim can do that.
 */
export async function planHeldWorkForConfirmedAppointment(
  svc: OpsCommandServices,
  input: PlanHeldWorkForConfirmedAppointmentInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!Number.isInteger(input.expectedHoldVersion) || input.expectedHoldVersion < 0) {
    throw new OpsDomainError("VALIDATION", "The approved-job version is invalid");
  }
  const [workOrder, hold, appointment] = await Promise.all([
    repository.getWorkOrder(input.organizationId, input.workOrderId),
    repository.getWorkOrderVisitHold(input.organizationId, input.workOrderId),
    repository.getServiceAppointment(input.organizationId, input.appointmentId),
  ]);
  if (!workOrder || !hold) throw new OpsDomainError("NOT_FOUND", "Approved work was not found");
  if (!appointment) throw new OpsDomainError("NOT_FOUND", "Confirmed visit was not found");
  if (workOrder.status !== "approved" || hold.status !== "active") {
    throw new OpsDomainError("CONFLICT", "This job is no longer available for a suitable visit");
  }
  const now = clock.now();
  if (appointment.status !== "confirmed" || Date.parse(appointment.startsAt) < Date.parse(now)) {
    throw new OpsDomainError("CONFLICT", "Choose a future confirmed visit");
  }
  if (Date.parse(appointment.startsAt) > Date.parse(hold.deadlineAt)) {
    throw new OpsDomainError("CONFLICT", "The confirmed visit is after this job's review date");
  }
  const [scheduledWorkOrder, assignment] = await Promise.all([
    repository.getWorkOrder(input.organizationId, appointment.workOrderId),
    repository.getAssignment(input.organizationId, appointment.assignmentId),
  ]);
  if (
    !scheduledWorkOrder
    || scheduledWorkOrder.id === workOrder.id
    || scheduledWorkOrder.status !== "scheduled"
    || scheduledWorkOrder.storeId !== workOrder.storeId
    || !workOrder.categoryKey
    || scheduledWorkOrder.categoryKey !== workOrder.categoryKey
  ) {
    throw new OpsDomainError("CONFLICT", "The confirmed visit no longer matches this store and service area");
  }
  if (
    !assignment
    || assignment.id !== appointment.assignmentId
    || assignment.workOrderId !== scheduledWorkOrder.id
    || assignment.kind !== "outside_vendor"
    || assignment.status !== "accepted"
    || !assignment.vendorId
  ) {
    throw new OpsDomainError("CONFLICT", "The confirmed visit no longer has an accepted outside vendor");
  }
  const eligibility = await heldWorkVendorEligibility({
    repository,
    organizationId: input.organizationId,
    vendorId: assignment.vendorId,
    workOrder,
    now,
  });
  if (!eligibility.allowed) {
    throw new OpsDomainError("FORBIDDEN", eligibility.reason ?? "This job cannot be offered to that vendor");
  }
  if (hold.plannedReviewAppointmentId === appointment.id) {
    return { hold, appointment, vendorId: assignment.vendorId, changed: false };
  }
  if (hold.version !== input.expectedHoldVersion) {
    throw new OpsDomainError("CONFLICT", "This approved job changed. Refresh before planning it for a visit");
  }
  const statements: OpsStatement[] = [
    {
      sql: "UPDATE ops_work_order_visit_holds SET planned_review_appointment_id = ?, planned_review_selected_at = ?, planned_review_selected_by_membership_id = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status = ? AND version = ?",
      params: [appointment.id, now, input.actor.actorId, now, input.organizationId, hold.id, workOrder.id, "active", hold.version],
    },
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "work_order",
      aggregateId: workOrder.id,
      eventType: hold.plannedReviewAppointmentId
        ? "work_order.visit_review_plan_changed"
        : "work_order.visit_review_planned",
      actor: input.actor,
      occurredAt: now,
      payload: {
        holdId: hold.id,
        appointmentId: appointment.id,
        scheduledWorkOrderId: scheduledWorkOrder.id,
        vendorId: assignment.vendorId,
        priorAppointmentId: hold.plannedReviewAppointmentId,
        meaning: "operator_plan_only_vendor_acceptance_not_recorded",
      },
      ids,
    }),
  ];
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "This approved job or confirmed visit changed. Refresh before planning it for vendor review.",
  });
  return {
    hold: {
      ...hold,
      version: hold.version + 1,
      plannedReviewAppointmentId: appointment.id,
      plannedReviewSelectedAt: now,
      plannedReviewSelectedByMembershipId: input.actor.actorId,
      updatedAt: now,
    },
    appointment,
    vendorId: assignment.vendorId,
    changed: true,
  };
}

export async function releaseWorkOrderVisitHold(svc: OpsCommandServices, input: { organizationId: OpsId; workOrderId: OpsId; actor: ActorContext }) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [workOrder, hold] = await Promise.all([repository.getWorkOrder(input.organizationId, input.workOrderId), repository.getWorkOrderVisitHold(input.organizationId, input.workOrderId)]);
  if (!workOrder || !hold) throw new OpsDomainError("NOT_FOUND", "Active held work was not found");
  if (hold.status === "claimed") throw new OpsDomainError("CONFLICT", "This work is already part of an active visit");
  if (!["active", "review_required"].includes(hold.status)) throw new OpsDomainError("CONFLICT", "This hold is no longer active");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const replacementTask = buildWorkflowTaskRecord({ id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id, draft: taskDraft({ workOrder, taskType: "choose_service_provider", title: "Choose service provider", assignee: facilitiesAssignee(), dueAt: workOrder.dueAt, applicableSlaClock: "scheduling", escalationDestination: workOrder.escalationTo }), actor: input.actor, createdAt: now });
  const statements: OpsStatement[] = [
    { sql: "UPDATE ops_work_order_visit_holds SET status = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status IN ('active','review_required')", params: ["cancelled", now, input.organizationId, hold.id] },
    { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["Facilities coordinator", "Choose service provider", input.organizationId, workOrder.id] },
    ...buildReplaceMatchingTaskStatements({ workOrder, tasks, targetTask: selectPrimaryWorkflowTask(tasks), replacementTask, actor: input.actor, occurredAt: now, ids, resolutionNote: "Future-visit hold released" }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.visit_hold_released", actor: input.actor, occurredAt: now, payload: { holdId: hold.id }, ids }),
  ];
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id: hold.id, status: "cancelled" as const };
}

export interface AssignWorkOrderInput { organizationId: OpsId; workOrderId: OpsId; kind: AssignmentKind; vendorId?: OpsId; internalMembershipId?: OpsId; actor: ActorContext }
export async function assignWorkOrder(svc: OpsCommandServices, input: AssignWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (["resolved", "closed", "cancelled"].includes(workOrder.status)) throw new OpsDomainError("CONFLICT", "Resolved, closed, or cancelled work cannot be reassigned");
  if (input.kind === "outside_vendor" && (!input.vendorId || !(await repository.getVendor(input.organizationId, input.vendorId)))) throw new OpsDomainError("VALIDATION", "Approved outside vendor is required");
  if (input.kind === "outside_vendor" && input.vendorId) {
    const vendor = await repository.getVendor(input.organizationId, input.vendorId);
    if (vendor?.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Outside vendor is not approved");
    if (!(await repository.vendorCoversStore(input.organizationId, input.vendorId, workOrder.storeId))) throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
    if (["routine", "planned"].includes(workOrder.priority)) {
      const complianceIssue = blockingVendorComplianceIssue(await repository.listVendorComplianceDocuments(input.organizationId, input.vendorId), clock.now());
      if (complianceIssue) throw new OpsDomainError("FORBIDDEN", `New routine work is paused because the vendor's customer-required ${complianceIssue.documentType} record is not current. Active jobs are not cancelled.`);
    }
  }
  if (input.kind === "internal" && (!input.internalMembershipId || !(await repository.getMembership(input.organizationId, input.internalMembershipId)))) throw new OpsDomainError("VALIDATION", "Internal maintenance member is required");
  if (input.kind === "choose_later" && (input.vendorId || input.internalMembershipId)) throw new OpsDomainError("VALIDATION", "Choose later cannot include a provider");
  const now = clock.now(); const id = ids.next("assignment"); const status: AssignmentStatus = "pending";
  const prior = await repository.getActiveAssignment(input.organizationId, input.workOrderId);
  const priorIssuances = prior
    ? await repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId)
    : [];
  const selectedEstimate = (await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId))
    .find((request) => request.status === "selected");
  if (selectedEstimate) {
    throw new OpsDomainError("CONFLICT", "This work order has a selected bid. Issue that vendor or reopen the bid decision before reassigning it.");
  }
  const statements: OpsStatement[] = [];
  if (prior) statements.push(
    { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)", params: ["superseded", input.organizationId, prior.id, input.workOrderId, "cancelled", "declined", "completed", "superseded"] },
    ...revokeServiceAuthorizationTokens(input.organizationId, priorIssuances.map((issuance) => issuance.id), now),
  );
  statements.push(insert("ops_work_order_assignments", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, kind: input.kind, vendor_id: input.vendorId, internal_membership_id: input.internalMembershipId, status, assigned_at: now, supersedes_assignment_id: prior?.id }), { sql: "UPDATE ops_work_orders SET next_action = ?, accountable_party = ? WHERE organization_id = ? AND id = ?", params: [input.kind === "choose_later" ? "Choose service provider" : "Issue service authorization", input.kind === "outside_vendor" ? "Facilities coordinator" : input.kind === "internal" ? "Internal maintenance" : "Facilities coordinator", input.organizationId, input.workOrderId] }, ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.assigned", actor: input.actor, occurredAt: now, payload: { assignmentId: id, supersedesAssignmentId: prior?.id, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId }, ids }));
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, input.workOrderId);
  const taskTitle = input.kind === "choose_later" ? "Choose service provider" : "Issue service authorization";
  const taskAssignee = input.kind === "internal" && input.internalMembershipId
    ? { assigneeType: "user" as const, assigneeId: input.internalMembershipId, assigneeName: "Internal maintenance" }
    : facilitiesAssignee();
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder, taskType: input.kind === "choose_later" ? "choose_service_provider" : "other",
      title: taskTitle, assignee: taskAssignee, dueAt: nextTaskDueAt(workOrder.dueAt, now),
      applicableSlaClock: "scheduling", escalationDestination: workOrder.escalationTo }),
    actor: input.actor, createdAt: now,
  });
  const primaryTask = selectPrimaryWorkflowTask(tasks);
  statements.push(...(primaryTask?.sourceApprovalRequestId
    ? [
        ...buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }),
        buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, replacementTask]),
      ]
    : buildReplacePrimaryTaskStatements({
        workOrder, tasks, replacementTask, actor: input.actor, occurredAt: now, ids,
        resolutionNote: "Provider assignment recorded",
      })));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, kind: input.kind, vendorId: input.vendorId, internalMembershipId: input.internalMembershipId, status, assignedAt: now };
}

export interface IssueWorkOrderInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; revision: number; channel: "email" | "sms" | "print" | "manual"; authorizationSnapshot: ServiceAuthorizationSnapshot; publicToken?: { tokenHash: string; expiresAt: IsoDateTime }; actor: ActorContext }
export async function issueWorkOrder(svc: OpsCommandServices, input: IssueWorkOrderInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const now = clock.now();
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId); const assignment = await repository.getAssignment(input.organizationId, input.assignmentId);
  if (!workOrder || !assignment || assignment.workOrderId !== input.workOrderId) throw new OpsDomainError("NOT_FOUND", "Work order assignment not found");
  if (!canRouteAndIssueWorkOrder(workOrder.status)) throw new OpsDomainError("CONFLICT", "Work is not eligible for issuance in its current state");
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new OpsDomainError("VALIDATION", "Issuance revision must be a positive integer");
  const activeAssignment = await repository.getActiveAssignment(input.organizationId, input.workOrderId);
  if (!activeAssignment || activeAssignment.id !== assignment.id) throw new OpsDomainError("CONFLICT", "Only the current active assignment can be issued");
  if (assignment.kind === "choose_later") throw new OpsDomainError("CONFLICT", "Choose a service provider before issuing work");
  const estimateRequests = await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId);
  assertNoOpenBidRequests(estimateRequests);
  const selectedEstimate = estimateRequests.find((request) => request.status === "selected");
  if (selectedEstimate && (assignment.kind !== "outside_vendor" || assignment.vendorId !== selectedEstimate.vendorId)) {
    throw new OpsDomainError("CONFLICT", "Only the vendor selected from the bid comparison can receive this service authorization.");
  }
  await assertSelectedEstimateIsCurrent(repository, selectedEstimate, now);
  const [latest, priorIssuances] = await Promise.all([
    repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
    repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId),
  ]);
  if (latest && input.revision !== latest.revision + 1) throw new OpsDomainError("CONFLICT", "Issuance revision must follow the latest immutable revision");
  if (!latest && input.revision !== 1) throw new OpsDomainError("CONFLICT", "First issuance revision must be 1");
  if (input.authorizationSnapshot.workOrderNumber !== workOrder.number || input.authorizationSnapshot.store.id !== workOrder.storeId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the work order");
  if (assignment.kind === "outside_vendor" && input.authorizationSnapshot.vendor.id !== assignment.vendorId) throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the assigned vendor");
  required(input.authorizationSnapshot.organizationName, "Authorization organization name");
  required(input.authorizationSnapshot.problem, "Authorization problem");
  required(input.authorizationSnapshot.billingInstruction, "Authorization billing instruction");
  const id = ids.next("issuance"); const payload = json(input.authorizationSnapshot);
  if (input.publicToken) {
    if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Only outside-vendor work uses a public authorization link");
    if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
    if (input.publicToken.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Authorization link expiry must be in the future");
  }
  const statements: OpsStatement[] = [
    ...revokeServiceAuthorizationTokens(input.organizationId, priorIssuances.map((issuance) => issuance.id), now),
    insert("ops_work_order_issuances", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, assignment_id: input.assignmentId, revision: input.revision, immutable_payload_json: payload, channel: input.channel, issued_at: now }),
    { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ?", params: ["issued", input.organizationId, input.assignmentId, input.workOrderId] },
    { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["issued", assignment.kind === "outside_vendor" ? "Outside vendor" : "Internal maintenance", "Acknowledge service authorization", input.organizationId, input.workOrderId] },
  ];
  if (input.publicToken) statements.push(insert("ops_public_tokens", { id: ids.next("public-token"), organization_id: input.organizationId, purpose: "service_authorization", subject_type: "work_order_issuance", subject_id: id, token_hash: input.publicToken.tokenHash, expires_at: input.publicToken.expiresAt, created_at: now }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "work_order.issued", actor: input.actor, occurredAt: now, payload: { issuanceId: id, assignmentId: input.assignmentId, revision: input.revision, channel: input.channel }, ids }));
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, input.workOrderId);
  const taskAssignee = assignment.kind === "outside_vendor" && assignment.vendorId
    ? { assigneeType: "vendor" as const, assigneeId: assignment.vendorId, assigneeName: "Outside vendor" }
    : assignment.kind === "internal" && assignment.internalMembershipId
      ? { assigneeType: "user" as const, assigneeId: assignment.internalMembershipId, assigneeName: "Internal maintenance" }
      : undefined;
  if (!taskAssignee) throw new OpsDomainError("VALIDATION", "Issued assignment has no accountable provider");
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder,
      taskType: assignment.kind === "outside_vendor" ? "vendor_response_required" : "schedule_service",
      title: "Acknowledge service authorization", assignee: taskAssignee,
      dueAt: vendorResponseDueAt(workOrder.priority, now),
      applicableSlaClock: assignment.kind === "outside_vendor" ? "vendor_response" : "scheduling",
      escalationDestination: workOrder.escalationTo }),
    actor: input.actor, createdAt: now,
  });
  statements.push(...buildReplaceMatchingTaskStatements({
    workOrder, tasks,
    targetTask: selectPrimaryWorkflowTask(tasks.filter((task) => !task.sourceApprovalRequestId && !task.sourceFollowUpId)),
    replacementTask, actor: input.actor, occurredAt: now, ids,
    resolutionNote: "Service authorization issued",
  }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, assignmentId: input.assignmentId, revision: input.revision, immutablePayloadJson: payload, channel: input.channel, issuedAt: now };
}

export interface RouteAndIssueWorkOrderInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  vendorId: OpsId;
  expectedRevision: number;
  channel: "email" | "sms" | "print" | "manual";
  authorizationSnapshot: ServiceAuthorizationSnapshot;
  publicToken: { tokenHash: string; expiresAt: IsoDateTime };
  actor: ActorContext;
}

/**
 * Selects (or reuses) an outside vendor and creates the immutable authorization
 * in one transaction. This is the operator handoff boundary: a failed issuance
 * must never leave behind a new active assignment with no authorization.
 */
export async function routeAndIssueWorkOrder(
  svc: OpsCommandServices,
  input: RouteAndIssueWorkOrderInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const now = clock.now();
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (!canRouteAndIssueWorkOrder(workOrder.status)) throw new OpsDomainError("CONFLICT", "Work is not eligible for issuance in its current state");
  const [organization, vendor, store, asset] = await Promise.all([
    repository.getOrganization(input.organizationId),
    repository.getVendor(input.organizationId, input.vendorId),
    repository.getStore(input.organizationId, workOrder.storeId),
    workOrder.assetId ? repository.getAsset(input.organizationId, workOrder.assetId) : Promise.resolve(null),
  ]);
  if (!organization || !store) throw new OpsDomainError("NOT_FOUND", "Work-order organization or store not found");
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Approved outside vendor is required");
  if (!(await repository.vendorCoversStore(input.organizationId, vendor.id, workOrder.storeId))) {
    throw new OpsDomainError("FORBIDDEN", "Outside vendor does not cover this store");
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new OpsDomainError("VALIDATION", "Expected issuance revision must be a non-negative integer");
  }
  const [latest, priorIssuances] = await Promise.all([
    repository.getLatestIssuanceForWorkOrder(input.organizationId, workOrder.id),
    repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
  ]);
  const currentRevision = latest?.revision ?? 0;
  if (input.expectedRevision !== currentRevision) {
    throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before issuing a new revision");
  }
  const [activeAssignment, estimateRequests, visitHold] = await Promise.all([
    repository.getActiveAssignment(input.organizationId, workOrder.id),
    repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id),
    repository.getWorkOrderVisitHold(input.organizationId, workOrder.id),
  ]);
  assertNoOpenBidRequests(estimateRequests);
  const selectedEstimate = estimateRequests.find((request) => request.status === "selected");
  if (selectedEstimate && selectedEstimate.vendorId !== vendor.id) {
    throw new OpsDomainError("CONFLICT", "Only the vendor selected from the bid comparison can receive this service authorization.");
  }
  await assertSelectedEstimateIsCurrent(repository, selectedEstimate, now);
  if (activeAssignment?.kind === "internal") {
    throw new OpsDomainError("CONFLICT", "Internal work must be reassigned before it can be issued to a vendor");
  }
  if (activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId !== vendor.id) {
    throw new OpsDomainError("CONFLICT", "Another vendor is already assigned. Record an explicit reassignment before issuing a different provider.");
  }
  const snapshot = input.authorizationSnapshot;
  const formattedAddress = [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", ");
  const snapshotNteMatches = snapshot.nte?.amountMinor === workOrder.nte?.amountMinor
    && snapshot.nte?.currency === workOrder.nte?.currency;
  if (
    snapshot.organizationName !== organization.name
    || snapshot.workOrderNumber !== workOrder.number
    || snapshot.store.id !== workOrder.storeId
    || snapshot.store.storeNumber !== store.storeNumber
    || snapshot.store.name !== store.name
    || snapshot.store.formattedAddress !== formattedAddress
    || snapshot.vendor.id !== vendor.id
    || snapshot.vendor.name !== vendor.name
    || snapshot.problem !== workOrder.problem
    || snapshot.priority !== workOrder.priority
    || snapshot.authorizedScope !== workOrder.authorizedScope
    || snapshot.categoryKey !== workOrder.categoryKey
    || snapshot.asset?.id !== workOrder.assetId
    || snapshot.asset?.name !== asset?.name
    || snapshot.asset?.assetTag !== asset?.assetTag
    || snapshot.requestedTiming !== workOrder.dueAt
    || !snapshotNteMatches
  ) {
    throw new OpsDomainError("VALIDATION", "Authorization snapshot does not match the current work order");
  }
  required(snapshot.organizationName, "Authorization organization name");
  required(snapshot.problem, "Authorization problem");
  required(snapshot.billingInstruction, "Authorization billing instruction");
  if (!/^[a-f0-9]{64}$/i.test(input.publicToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (input.publicToken.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Authorization link expiry must be in the future");

  const reuseAssignment = activeAssignment?.kind === "outside_vendor" && activeAssignment.vendorId === vendor.id;
  const priorAssignment = activeAssignment ?? (latest ? await repository.getAssignment(input.organizationId, latest.assignmentId) : null);
  const assignmentId = reuseAssignment ? activeAssignment.id : ids.next("assignment");
  const issuanceId = ids.next("issuance");
  const revision = currentRevision + 1;
  const payload = json(snapshot);
  const statements: OpsStatement[] = [];
  if (visitHold && ["active", "review_required"].includes(visitHold.status)) {
    statements.push(
      {
        sql: "UPDATE ops_work_order_visit_holds SET status = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status = ? AND version = ?",
        params: ["cancelled", now, input.organizationId, visitHold.id, workOrder.id, visitHold.status, visitHold.version],
      },
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: workOrder.id,
        eventType: "work_order.visit_hold_released",
        actor: input.actor,
        occurredAt: now,
        payload: { holdId: visitHold.id, reason: "service_authorization_issued", vendorId: vendor.id },
        ids,
      }),
    );
  }
  if (!reuseAssignment) {
    if (activeAssignment) {
      statements.push({
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)",
        params: ["superseded", input.organizationId, activeAssignment.id, workOrder.id, "cancelled", "declined", "completed", "superseded"],
      });
    }
    statements.push(
      insert("ops_work_order_assignments", {
        id: assignmentId,
        organization_id: input.organizationId,
        work_order_id: workOrder.id,
        kind: "outside_vendor",
        vendor_id: vendor.id,
        status: "pending",
        assigned_at: now,
        supersedes_assignment_id: priorAssignment?.id,
      }),
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: workOrder.id,
        eventType: "work_order.assigned",
        actor: input.actor,
        occurredAt: now,
        payload: {
          assignmentId,
          supersedesAssignmentId: priorAssignment?.id,
          kind: "outside_vendor",
          vendorId: vendor.id,
          issuedAtomically: true,
        },
        ids,
      }),
    );
  }
  statements.push(
    insert("ops_work_order_issuances", {
      id: issuanceId,
      organization_id: input.organizationId,
      work_order_id: workOrder.id,
      assignment_id: assignmentId,
      revision,
      immutable_payload_json: payload,
      channel: input.channel,
      issued_at: now,
    }),
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ?",
      params: ["issued", input.organizationId, assignmentId, workOrder.id],
    },
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", "Outside vendor", "Acknowledge service authorization", input.organizationId, workOrder.id],
    },
  );
  statements.push(...revokeServiceAuthorizationTokens(
    input.organizationId,
    priorIssuances.map((issuance) => issuance.id),
    now,
  ));
  statements.push(
    insert("ops_public_tokens", {
      id: ids.next("public-token"),
      organization_id: input.organizationId,
      purpose: "service_authorization",
      subject_type: "work_order_issuance",
      subject_id: issuanceId,
      token_hash: input.publicToken.tokenHash.toLowerCase(),
      expires_at: input.publicToken.expiresAt,
      created_at: now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "work_order",
      aggregateId: workOrder.id,
      eventType: "work_order.issued",
      actor: input.actor,
      occurredAt: now,
      payload: { issuanceId, assignmentId, revision, channel: input.channel, vendorId: vendor.id, supersedesIssuanceId: latest?.id },
      ids,
    }),
  );
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder, taskType: "vendor_response_required", title: "Acknowledge service authorization",
      assignee: { assigneeType: "vendor", assigneeId: vendor.id, assigneeName: "Outside vendor" },
      dueAt: vendorResponseDueAt(workOrder.priority, now), applicableSlaClock: "vendor_response",
      escalationDestination: workOrder.escalationTo }),
    actor: input.actor, createdAt: now,
  });
  statements.push(...buildReplaceMatchingTaskStatements({
    workOrder, tasks,
    targetTask: selectPrimaryWorkflowTask(tasks.filter((task) => !task.sourceApprovalRequestId && !task.sourceFollowUpId)),
    replacementTask, actor: input.actor, occurredAt: now, ids,
    resolutionNote: "Vendor selected and service authorization issued",
  }));
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
    conflictMessage: "This work order changed while the authorization was being created. Refresh and verify the selected provider.",
  });
  return {
    assignment: {
      id: assignmentId,
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      kind: "outside_vendor" as const,
      vendorId: vendor.id,
      status: "issued" as const,
      assignedAt: reuseAssignment ? activeAssignment.assignedAt : now,
      supersedesAssignmentId: reuseAssignment ? activeAssignment.supersedesAssignmentId : priorAssignment?.id,
    },
    issuance: {
      id: issuanceId,
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      assignmentId,
      revision,
      immutablePayloadJson: payload,
      channel: input.channel,
      issuedAt: now,
    },
  };
}

export interface RecordVendorResponseInput { organizationId: OpsId; workOrderId: OpsId; assignmentId: OpsId; issuanceId: OpsId; response: VendorResponseKind; responderName: string; proposedAt?: IsoDateTime; message?: string; actor: ActorContext }

export interface MarkServiceAuthorizationOpenedInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  assignmentId: OpsId;
  issuanceId: OpsId;
  actor: ActorContext;
}

export async function markServiceAuthorizationOpened(
  svc: OpsCommandServices,
  input: MarkServiceAuthorizationOpenedInput,
) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [workOrder, assignment, issuance, activeAssignment, latestIssuance] = await Promise.all([
    repository.getWorkOrder(input.organizationId, input.workOrderId),
    repository.getAssignment(input.organizationId, input.assignmentId),
    repository.getIssuance(input.organizationId, input.issuanceId),
    repository.getActiveAssignment(input.organizationId, input.workOrderId),
    repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
  ]);
  if (
    !workOrder ||
    !assignment ||
    !issuance ||
    assignment.kind !== "outside_vendor" ||
    assignment.workOrderId !== input.workOrderId ||
    issuance.workOrderId !== input.workOrderId ||
    issuance.assignmentId !== assignment.id
  ) throw new OpsDomainError("NOT_FOUND", "Service authorization was not found");
  if (activeAssignment?.id !== assignment.id || latestIssuance?.id !== issuance.id) {
    throw new OpsDomainError("CONFLICT", "This service authorization has been superseded");
  }
  if (assignment.status !== "issued") return { assignment, changed: false };
  const openedAt = clock.now();
  try {
    await atomicWorkOrderMutation({ repository, workOrder, now: openedAt, statements: [
      {
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status = ?",
        params: ["opened", input.organizationId, assignment.id, input.workOrderId, "issued"],
      },
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order",
        aggregateId: input.workOrderId,
        eventType: "service_authorization.opened",
        actor: input.actor,
        occurredAt: openedAt,
        payload: { assignmentId: assignment.id, issuanceId: issuance.id, revision: issuance.revision },
        ids,
      }),
    ] });
  } catch (error) {
    if (error instanceof OpsDomainError && error.code === "CONFLICT") {
      const [currentAssignment, currentActiveAssignment, currentLatestIssuance] = await Promise.all([
        repository.getAssignment(input.organizationId, input.assignmentId),
        repository.getActiveAssignment(input.organizationId, input.workOrderId),
        repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId),
      ]);
      if (
        currentAssignment?.status === "opened"
        && currentAssignment.workOrderId === input.workOrderId
        && currentActiveAssignment?.id === currentAssignment.id
        && currentLatestIssuance?.id === input.issuanceId
        && currentLatestIssuance.assignmentId === currentAssignment.id
      ) return { assignment: currentAssignment, changed: false };
    }
    throw error;
  }
  return { assignment: { ...assignment, status: "opened" as const }, changed: true, openedAt };
}

export async function recordVendorResponse(svc: OpsCommandServices, input: RecordVendorResponseInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const assignment = await repository.getAssignment(input.organizationId, input.assignmentId);
  const issuance = await repository.getIssuance(input.organizationId, input.issuanceId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder || !assignment || !issuance || assignment.workOrderId !== input.workOrderId || issuance.assignmentId !== assignment.id) {
    throw new OpsDomainError("NOT_FOUND", "Issued vendor assignment not found");
  }
  if (assignment.kind !== "outside_vendor") throw new OpsDomainError("VALIDATION", "Vendor responses apply only to outside-vendor assignments");
  if (["accepted", "declined", "completed", "cancelled", "superseded"].includes(assignment.status)) throw new OpsDomainError("CONFLICT", "Assignment no longer accepts vendor responses");
  if (vendorResponseClosedWorkStatuses.has(workOrder.status)) {
    throw new OpsDomainError("CONFLICT", "Vendor response is closed because onsite work or follow-up has already started");
  }
  const workDetail = await repository.getWorkOrderDetail({ organizationId: input.organizationId }, input.workOrderId);
  if (workDetail?.visits.some((visit) => visit.status === "active")) {
    throw new OpsDomainError("CONFLICT", "Finish the active onsite visit before changing the service-authorization response");
  }
  const latestIssuance = await repository.getLatestIssuanceForWorkOrder(input.organizationId, input.workOrderId);
  if (!latestIssuance || latestIssuance.id !== issuance.id) throw new OpsDomainError("CONFLICT", "Response link is for a superseded issuance revision");
  const priorResponse = await repository.getLatestVendorResponseForIssuance(input.organizationId, input.issuanceId);
  if (priorResponse && ["accepted", "declined"].includes(priorResponse.response)) throw new OpsDomainError("CONFLICT", "Assignment already has a terminal vendor response");
  if (input.response === "proposed_date" && !input.proposedAt) throw new OpsDomainError("VALIDATION", "Proposed date is required");
  const now = clock.now();
  const id = ids.next("vendor-response");
  const assignmentStatus = input.response === "accepted" ? "accepted" : input.response === "declined" ? "declined" : assignment.status;
  const workStatus = input.response === "accepted" ? "accepted" : input.response === "declined" ? "approved" : "issued";
  const facilitiesOwnsNext = ["declined", "proposed_date", "question"].includes(input.response);
  const nextAction = input.response === "declined" ? "Select another provider" : input.response === "proposed_date" ? "Review proposed service date" : input.response === "question" ? "Answer vendor question" : "Complete onsite service";
  const selectedEstimate = input.response === "declined"
    ? (await repository.listEstimateRequestsForWorkOrder(input.organizationId, input.workOrderId))
        .find((request) => request.status === "selected" && request.vendorId === assignment.vendorId)
    : undefined;
  const serviceAuthorizationIssuances = input.response === "declined"
    ? await repository.listIssuancesForWorkOrder(input.organizationId, input.workOrderId)
    : [];
  const statements: OpsStatement[] = [
    insert("ops_vendor_responses", {
      id,
      organization_id: input.organizationId,
      work_order_id: input.workOrderId,
      assignment_id: input.assignmentId,
      issuance_id: input.issuanceId,
      response: input.response,
      responder_name: required(input.responderName, "Responder name"),
      proposed_at: input.proposedAt,
      message: input.message,
      responded_at: now,
    }),
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: [assignmentStatus, input.organizationId, input.assignmentId],
    },
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?",
      params: [workStatus, facilitiesOwnsNext ? "Facilities coordinator" : "Outside vendor", nextAction, input.organizationId, input.workOrderId],
    },
  ];
  if (selectedEstimate) {
    statements.push(
      {
        sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
        params: ["not_selected", now, input.organizationId, selectedEstimate.id, "selected"],
      },
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "work_order_estimate_request",
        aggregateId: selectedEstimate.id,
        eventType: "work_order_estimate.selection_reopened",
        actor: input.actor,
        occurredAt: now,
        payload: {
          workOrderId: input.workOrderId,
          vendorId: assignment.vendorId,
          reason: "selected_vendor_declined_service_authorization",
          responseId: id,
        },
        ids,
      }),
    );
  }
  if (input.response === "declined") {
    statements.push(...revokeServiceAuthorizationTokens(
      input.organizationId,
      serviceAuthorizationIssuances.map((item) => item.id),
      now,
    ));
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId,
    aggregateType: "work_order",
    aggregateId: input.workOrderId,
    eventType: `vendor.${input.response}`,
    actor: input.actor,
    occurredAt: now,
    payload: {
      responseId: id,
      assignmentId: input.assignmentId,
      issuanceId: input.issuanceId,
      revision: issuance.revision,
      proposedAt: input.proposedAt,
      message: input.message,
      reopenedEstimateRequestId: selectedEstimate?.id,
    },
    ids,
  }));
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, input.workOrderId);
  const responseTaskType: WorkflowTaskType = input.response === "accepted"
    ? "schedule_service"
    : input.response === "declined"
      ? "choose_service_provider"
      : input.response === "proposed_date"
        ? "schedule_service"
        : "other";
  const responseAssignee = input.response === "accepted" && assignment.vendorId
    ? { assigneeType: "vendor" as const, assigneeId: assignment.vendorId, assigneeName: "Outside vendor" }
    : facilitiesAssignee();
  const replacementTask = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder, taskType: responseTaskType, title: nextAction, assignee: responseAssignee,
      dueAt: nextTaskDueAt(input.proposedAt ?? workOrder.dueAt, now),
      applicableSlaClock: input.response === "accepted" ? "scheduling" : "vendor_response",
      escalationDestination: workOrder.escalationTo }),
    actor: input.actor, createdAt: now,
  });
  statements.push(...buildReplaceMatchingTaskStatements({
    workOrder, tasks,
    targetTask: selectPrimaryWorkflowTask(tasks.filter((task) => task.taskType === "vendor_response_required")),
    replacementTask, actor: input.actor, occurredAt: now, ids,
    resolutionNote: `Vendor response recorded: ${input.response}`,
  }));
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, assignmentId: input.assignmentId, issuanceId: input.issuanceId, response: input.response, responderName: input.responderName.trim(), proposedAt: input.proposedAt, message: input.message, respondedAt: now };
}

export interface CheckInVisitInput {
  organizationId: OpsId;
  storeId: OpsId;
  vendorId?: OpsId;
  internalMembershipId?: OpsId;
  workOrderId?: OpsId;
  workOrderIds?: readonly OpsId[];
  heldWorkOrderIds?: readonly OpsId[];
  serviceRunId?: OpsId;
  plannedWorkOrderRemovalReason?: string;
  unmatchedReason?: string;
  technicianName: string;
  technicianPhoneOrPin?: string;
  crewCount?: number;
  additionalTechnicianNames?: readonly string[];
  vehicleIdentifier?: string;
  arrivalNote?: string;
  purpose: string;
  channel: VisitChannel;
  location: LocationObservation;
  actor: ActorContext;
}

const siteVisitEligibleWorkStatuses = new Set<WorkOrderStatus>([
  "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts",
]);

function selectedVisitWorkOrderIds(input: Pick<CheckInVisitInput, "workOrderId" | "workOrderIds">) {
  if (input.workOrderId && input.workOrderIds && (input.workOrderIds.length !== 1 || input.workOrderIds[0] !== input.workOrderId)) {
    throw new OpsDomainError("VALIDATION", "Use either workOrderId or workOrderIds; the compatibility id cannot change the selected set");
  }
  const selected = input.workOrderIds ? [...input.workOrderIds] : input.workOrderId ? [input.workOrderId] : [];
  if (selected.some((id) => !id.trim())) throw new OpsDomainError("VALIDATION", "Selected work-order ids cannot be blank");
  if (new Set(selected).size !== selected.length) throw new OpsDomainError("VALIDATION", "A work order can be selected only once per visit");
  return selected;
}

async function prepareCheckInVisit(svc: OpsCommandServices, input: CheckInVisitInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  if (input.vendorId && input.internalMembershipId) throw new OpsDomainError("VALIDATION", "A visit cannot identify both an outside vendor and internal maintenance member");
  const workOrderIds = selectedVisitWorkOrderIds(input);
  const heldWorkOrderIds = [...(input.heldWorkOrderIds ?? [])];
  if (heldWorkOrderIds.some((id) => !id.trim()) || new Set(heldWorkOrderIds).size !== heldWorkOrderIds.length) throw new OpsDomainError("VALIDATION", "Choose each held work order only once");
  if (heldWorkOrderIds.some((id) => workOrderIds.includes(id))) throw new OpsDomainError("VALIDATION", "A work order cannot be selected as both assigned and held work");
  const linkedWorkOrders = await Promise.all(workOrderIds.map((workOrderId) => repository.getWorkOrder(input.organizationId, workOrderId)));
  if (linkedWorkOrders.some((workOrder) => !workOrder || workOrder.storeId !== input.storeId)) {
    throw new OpsDomainError("NOT_FOUND", "One or more selected work orders are not eligible at this store");
  }
  const assignedWorkOrders = linkedWorkOrders as WorkOrder[];
  if (assignedWorkOrders.some((workOrder) => !siteVisitEligibleWorkStatuses.has(workOrder.status))) {
    throw new OpsDomainError("CONFLICT", "Selected work must be issued and open for onsite service");
  }
  const heldPairs = await Promise.all(heldWorkOrderIds.map(async (workOrderId) => ({
    workOrder: await repository.getWorkOrder(input.organizationId, workOrderId),
    hold: await repository.getWorkOrderVisitHold(input.organizationId, workOrderId),
  })));
  if (heldPairs.some(({ workOrder, hold }) => !workOrder || workOrder.storeId !== input.storeId || workOrder.status !== "approved" || !hold || hold.status !== "active")) {
    throw new OpsDomainError("CONFLICT", "One or more held items are no longer available at this store");
  }
  const heldWorkOrders = heldPairs.map(({ workOrder }) => workOrder!) as WorkOrder[];
  const workOrders = [...assignedWorkOrders, ...heldWorkOrders];
  const activeVisitFlags = await Promise.all(workOrders.map(async (workOrder) => {
    const links = await repository.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, workOrder.id);
    const visits = await Promise.all([...new Set(links.map((link) => link.visitId))]
      .map((visitId) => repository.getVisit(input.organizationId, visitId)));
    return visits.some((visit) => visit?.status === "active");
  }));
  if (activeVisitFlags.some(Boolean)) {
    throw new OpsDomainError("CONFLICT", "A selected work order is already linked to an active visit");
  }
  const assignments = await Promise.all(assignedWorkOrders.map((workOrder) => repository.getActiveAssignment(input.organizationId, workOrder.id)));
  if (assignments.some((assignment) => !assignment || assignment.kind === "choose_later")) {
    throw new OpsDomainError("FORBIDDEN", "Every selected work order must have an active service-provider assignment");
  }
  const firstAssignment = assignments[0];
  let vendorId: OpsId | undefined;
  let internalMembershipId: OpsId | undefined;
  if (firstAssignment) {
    vendorId = firstAssignment.kind === "outside_vendor" ? firstAssignment.vendorId : undefined;
    internalMembershipId = firstAssignment.kind === "internal" ? firstAssignment.internalMembershipId : undefined;
    if (!vendorId && !internalMembershipId) throw new OpsDomainError("FORBIDDEN", "Selected work has no accountable service provider");
    if (assignments.some((assignment) => assignment?.kind !== firstAssignment.kind
      || assignment.vendorId !== vendorId
      || assignment.internalMembershipId !== internalMembershipId)) {
      throw new OpsDomainError("FORBIDDEN", "One site visit can include only work assigned to the same service provider");
    }
    if (input.vendorId && input.vendorId !== vendorId || input.internalMembershipId && input.internalMembershipId !== internalMembershipId) {
      throw new OpsDomainError("FORBIDDEN", "The supplied provider does not match the selected work-order assignments");
    }
    if (vendorId && input.internalMembershipId || internalMembershipId && input.vendorId) {
      throw new OpsDomainError("FORBIDDEN", "The supplied provider kind does not match the selected work-order assignments");
    }
  } else {
    if (Boolean(input.vendorId) === Boolean(input.internalMembershipId)) throw new OpsDomainError("VALIDATION", "Choose exactly one outside vendor or internal maintenance member when no work order is provided");
    vendorId = input.vendorId;
    internalMembershipId = input.internalMembershipId;
    required(input.unmatchedReason ?? "", "Reason when no work order is provided");
  }
  const vendor = vendorId ? await repository.getVendor(input.organizationId, vendorId) : null;
  const internalMember = internalMembershipId ? await repository.getMembership(input.organizationId, internalMembershipId) : null;
  if (vendorId && !vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
  if (vendor && vendor.status !== "approved") throw new OpsDomainError("FORBIDDEN", "Vendor is not approved");
  if (vendor && !(await repository.vendorCoversStore(input.organizationId, vendor.id, input.storeId))) throw new OpsDomainError("FORBIDDEN", "Vendor does not cover this store");
  if (internalMembershipId && (!internalMember || internalMember.status !== "active")) throw new OpsDomainError("NOT_FOUND", "Active internal maintenance member not found in organization");
  if (heldWorkOrders.length && !vendorId) throw new OpsDomainError("FORBIDDEN", "Held work can be selected only by an approved outside vendor");
  if (vendorId) {
    for (const workOrder of heldWorkOrders) {
      const eligibility = await heldWorkVendorEligibility({ repository, organizationId: input.organizationId, vendorId, workOrder, now: clock.now() });
      if (!eligibility.allowed) throw new OpsDomainError("FORBIDDEN", eligibility.reason ?? "This held work is not available to the selected vendor");
    }
  }
  const serviceRun = input.serviceRunId ? await repository.getServiceRun(input.organizationId, input.serviceRunId) : null;
  const serviceRunStop = serviceRun ? (await repository.listRouteStops(input.organizationId, serviceRun.id)).find((stop) => stop.storeId === input.storeId) : undefined;
  let removedPlannedWorkOrderIds: OpsId[] = [];
  if (input.serviceRunId) {
    if (!serviceRun || !serviceRunStop) throw new OpsDomainError("NOT_FOUND", "Committed Service Run stop was not found for this Store");
    if (!vendorId || serviceRun.vendorId !== vendorId) throw new OpsDomainError("FORBIDDEN", "Service Run Vendor does not match the selected Work Orders");
    if (!["committed", "accepted", "in_progress"].includes(serviceRun.status)) throw new OpsDomainError("CONFLICT", "Only a committed Service Run can start a Store visit");
    if (serviceRunStop.siteVisitId || serviceRunStop.status !== "planned") throw new OpsDomainError("CONFLICT", "This Service Run stop has already started or completed");
    const runWork = await repository.listServiceRunWorkOrders(input.organizationId, serviceRun.id);
    const plannedAtStop = runWork.filter((row) => row.routeStopId === serviceRunStop!.id && row.planned);
    const selectedSet = new Set(workOrderIds);
    removedPlannedWorkOrderIds = plannedAtStop.filter((row) => !selectedSet.has(row.workOrderId)).map((row) => row.workOrderId);
    if (removedPlannedWorkOrderIds.length && !input.plannedWorkOrderRemovalReason?.trim()) {
      throw new OpsDomainError("VALIDATION", "Explain why planned Service Run work is being removed from this Store visit");
    }
  } else if (input.plannedWorkOrderRemovalReason?.trim()) {
    throw new OpsDomainError("VALIDATION", "A planned-work removal reason requires a Service Run");
  }
  const serviceRunHeldPairs = serviceRun
    ? (await Promise.all(assignedWorkOrders.map(async (workOrder) => ({
        workOrder,
        hold: await repository.getWorkOrderVisitHold(input.organizationId, workOrder.id),
      })))).filter((pair) => pair.hold?.status === "active")
    : [];
  const visitHoldByWorkOrderId = new Map([
    ...heldPairs.flatMap(({ workOrder, hold }) => workOrder && hold ? [[workOrder.id, hold] as const] : []),
    ...serviceRunHeldPairs.map(({ workOrder, hold }) => [workOrder.id, hold!] as const),
  ]);
  const providerName = vendor?.name ?? "Internal maintenance";
  const technicianName = required(input.technicianName, "Technician name"); const purpose = required(input.purpose, "Visit purpose");
  const crewCount = input.crewCount ?? 1;
  if (!Number.isInteger(crewCount) || crewCount < 1 || crewCount > 100) throw new OpsDomainError("VALIDATION", "Crew count must be a whole number between 1 and 100");
  const additionalTechnicianNames = (input.additionalTechnicianNames ?? []).map((name) => required(name, "Additional technician name"));
  const normalizedTechnicianNames = [technicianName, ...additionalTechnicianNames].map((name) => name.toLocaleLowerCase("en-US"));
  if (new Set(normalizedTechnicianNames).size !== normalizedTechnicianNames.length) throw new OpsDomainError("VALIDATION", "Technician names cannot be duplicated within a visit");
  if (additionalTechnicianNames.length > crewCount - 1) throw new OpsDomainError("VALIDATION", "Additional technician names cannot exceed the declared crew count");
  const technicianPhoneOrPin = input.technicianPhoneOrPin?.trim() || undefined;
  const vehicleIdentifier = input.vehicleIdentifier?.trim() || undefined;
  const arrivalNote = input.arrivalNote?.trim() || undefined;
  if (await repository.findActiveVisit(input.organizationId, input.storeId, { vendorId, internalMembershipId, technicianName })) throw new OpsDomainError("CONFLICT", "This technician already has an active visit at this store");
  const now = clock.now();
  assertFreshLocationCapture(input.location, now);
  const id = ids.next("visit"); const evidenceId = ids.next("evidence");
  const scalarWorkOrderId = workOrders.length === 1 ? workOrders[0]!.id : undefined;
  const visitWorkOrders: SiteVisitWorkOrder[] = workOrders.map((workOrder, index) => {
    const hold = visitHoldByWorkOrderId.get(workOrder.id);
    return {
      id: ids.next("site-visit-work"), organizationId: input.organizationId, visitId: id, workOrderId: workOrder.id,
      ordinal: index + 1, linkedByActorType: input.actor.actorType, linkedByActorId: input.actor.actorId,
      linkedByActorName: input.actor.actorName, linkedAt: now,
      // Preserve the manager-approved-next-visit origin even when those jobs
      // were sent together first. The route stop separately proves whether
      // the visit itself was planned; unrelated Service Run work stays
      // service_run and can never masquerade as held work.
      selectionSource: hold ? "held_work" : serviceRun ? "service_run" : "assigned_work",
      workOrderHoldId: hold?.id,
    };
  });
  const visitWorkByWorkOrderId = new Map(visitWorkOrders.map((link) => [link.workOrderId, link] as const));
  const statements: OpsStatement[] = [
    insert("ops_visit_sessions", { id, organization_id: input.organizationId, store_id: input.storeId, provider_kind: vendorId ? "outside_vendor" : "internal", vendor_id: vendorId, internal_membership_id: internalMembershipId, work_order_id: scalarWorkOrderId, unmatched_reason: assignedWorkOrders.length ? undefined : input.unmatchedReason?.trim(), technician_name: technicianName, technician_phone_or_pin: technicianPhoneOrPin, crew_count: crewCount, additional_technician_names_json: json(additionalTechnicianNames), vehicle_identifier: vehicleIdentifier, arrival_note: arrivalNote, provider_name: providerName, purpose, status: "active", started_channel: input.channel, checked_in_at: now }),
    ...visitWorkOrders.map((link) => insert("ops_site_visit_work_orders", { id: link.id, organization_id: link.organizationId, visit_id: link.visitId, work_order_id: link.workOrderId, ordinal: link.ordinal, linked_by_actor_type: link.linkedByActorType, linked_by_actor_id: link.linkedByActorId, linked_by_actor_name: link.linkedByActorName, linked_at: link.linkedAt, selection_source: link.selectionSource, work_order_hold_id: link.workOrderHoldId })),
    insert("ops_visit_evidence", { id: evidenceId, organization_id: input.organizationId, visit_id: id, kind: "check_in", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now, crewCount, additionalTechnicianNames, vehicleIdentifier, arrivalNote }) }),
  ];
  if (serviceRun && serviceRunStop) {
    statements.push(
      { sql: "UPDATE ops_route_stops SET status = ?, site_visit_id = ? WHERE organization_id = ? AND id = ? AND service_run_id = ? AND status = ? AND site_visit_id IS NULL", params: ["arrived", id, input.organizationId, serviceRunStop.id, serviceRun.id, "planned"] },
      { sql: "UPDATE ops_service_runs SET status = ? WHERE organization_id = ? AND id = ? AND status IN ('accepted', 'committed')", params: ["in_progress", input.organizationId, serviceRun.id] },
    );
    for (const removedWorkOrderId of removedPlannedWorkOrderIds) statements.push({ sql: "UPDATE ops_service_run_work_orders SET planned = ?, removal_reason = ? WHERE organization_id = ? AND service_run_id = ? AND route_stop_id = ? AND work_order_id = ? AND planned = ?", params: [false, input.plannedWorkOrderRemovalReason!.trim(), input.organizationId, serviceRun.id, serviceRunStop.id, removedWorkOrderId, true] });
    statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "service_run", aggregateId: serviceRun.id, eventType: "service_run.stop_started", actor: input.actor, occurredAt: now, payload: { routeStopId: serviceRunStop.id, visitId: id, storeId: input.storeId, selectedWorkOrderIds: workOrderIds, removedPlannedWorkOrderIds, plannedWorkOrderRemovalReason: input.plannedWorkOrderRemovalReason?.trim() }, ids }));
  }
  for (const { workOrder, hold } of serviceRunHeldPairs) {
    statements.push(
      { sql: "UPDATE ops_work_order_visit_holds SET status = ?, claimed_visit_id = ?, claimed_vendor_id = ?, claimed_at = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status = ? AND version = ?", params: ["claimed", id, vendorId, now, now, input.organizationId, hold!.id, "active", hold!.version] },
      ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.sweep_work_started", actor: input.actor, occurredAt: now, payload: { holdId: hold!.id, visitId: id, vendorId, serviceRunId: serviceRun!.id, deadlineAt: hold!.deadlineAt }, ids }),
    );
  }
  if (!assignedWorkOrders.length) statements.push(insert("ops_exceptions", { id: ids.next("exception"), organization_id: input.organizationId, kind: "no_work_order", store_id: input.storeId, visit_id: id, vendor_id: vendorId, severity: "attention", status: "open", summary: heldWorkOrders.length ? `${providerName} arrived without an issued work order and selected ${heldWorkOrders.length} approved held ${heldWorkOrders.length === 1 ? "item" : "items"}` : `${providerName} checked in without an operator work order`, detected_at: now }));
  for (const { workOrder, hold } of heldPairs) {
    const priorAssignment = await repository.getActiveAssignment(input.organizationId, workOrder!.id);
    if (priorAssignment) statements.push({ sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('cancelled','declined','completed','superseded')", params: ["superseded", input.organizationId, priorAssignment.id] });
    statements.push(
      insert("ops_work_order_assignments", { id: ids.next("assignment"), organization_id: input.organizationId, work_order_id: workOrder!.id, kind: "outside_vendor", vendor_id: vendorId, status: "accepted", assigned_at: now, supersedes_assignment_id: priorAssignment?.id }),
      { sql: "UPDATE ops_work_order_visit_holds SET status = ?, claimed_visit_id = ?, claimed_vendor_id = ?, claimed_at = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status = ? AND version = ?", params: ["claimed", id, vendorId, now, now, input.organizationId, hold!.id, "active", hold!.version] },
      ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder!.id, eventType: "work_order.held_work_claimed", actor: input.actor, occurredAt: now, payload: { holdId: hold!.id, visitId: id, vendorId, posture: hold!.posture, deadlineAt: hold!.deadlineAt }, ids }),
    );
  }
  if (heldWorkOrders.length) statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: id, eventType: "held_work.claimed", actor: input.actor, occurredAt: now, payload: { storeId: input.storeId, vendorId, workOrderIds: heldWorkOrders.map((row) => row.id), holdIds: heldPairs.map((row) => row.hold!.id), completeCount: heldPairs.filter((row) => row.hold!.posture === "complete_using_professional_judgment").length, inspectCount: heldPairs.filter((row) => row.hold!.posture === "look_and_report").length, priceMeaning: "no_price_or_authorization_recorded" }, ids }));
  if (["outside_geofence", "low_accuracy"].includes(input.location.result)) statements.push(insert("ops_exceptions", { id: ids.next("exception"), organization_id: input.organizationId, kind: input.location.result === "outside_geofence" ? "outside_geofence" : "low_accuracy_location", store_id: input.storeId, work_order_id: scalarWorkOrderId, visit_id: id, vendor_id: vendorId, severity: "attention", status: "open", summary: `Check-in location result: ${input.location.result}`, detected_at: now }));
  for (const linkedWorkOrder of workOrders) {
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", providerName, "Record service outcome", input.organizationId, linkedWorkOrder.id] });
    const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, linkedWorkOrder.id);
    const targetTask = selectPrimaryWorkflowTask(tasks.filter((task) => ["vendor_response_required", "schedule_service", "confirm_store_access", "schedule_return_visit"].includes(task.taskType)));
    const assignee = vendorId
      ? { assigneeType: "vendor" as const, assigneeId: vendorId, assigneeName: providerName }
      : { assigneeType: "user" as const, assigneeId: internalMembershipId!, assigneeName: providerName };
    const replacementTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: linkedWorkOrder.id,
      draft: taskDraft({ workOrder: linkedWorkOrder, taskType: "record_service_outcome", title: "Record service outcome",
        assignee, dueAt: addHours(now, 8), applicableSlaClock: "completion", initialStatus: "in_progress",
        escalationDestination: linkedWorkOrder.escalationTo,
        completionCriteria: "Record checkout evidence and one outcome for the linked service work" }),
      actor: input.actor, createdAt: now,
    });
    if (targetTask?.taskType === "schedule_return_visit" && targetTask.sourceFollowUpId) {
      if (targetTask.status === "open") statements.push(...buildStartWorkflowTaskStatements({ task: targetTask, actor: input.actor, occurredAt: now, ids }));
      statements.push(...buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }));
    } else {
      statements.push(...buildReplaceMatchingTaskStatements({
        workOrder: linkedWorkOrder, tasks, targetTask,
        replacementTask, actor: input.actor, occurredAt: now, ids,
        resolutionNote: "Technician checked in for onsite service",
      }));
    }
    statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: linkedWorkOrder.id, eventType: "work_order.visit_started", actor: input.actor, occurredAt: now, payload: { visitId: id, workOrderIds: workOrders.map((row) => row.id), vendorId, internalMembershipId, crewCount, channel: input.channel, selectionSource: visitWorkByWorkOrderId.get(linkedWorkOrder.id)!.selectionSource }, ids }));
  }
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: id, eventType: "visit.checked_in", actor: input.actor, occurredAt: now, payload: { storeId: input.storeId, vendorId, internalMembershipId, workOrderIds: workOrders.map((row) => row.id), heldWorkOrderIds, serviceRunId: serviceRun?.id, routeStopId: serviceRunStop?.id, removedPlannedWorkOrderIds, plannedWorkOrderRemovalReason: input.plannedWorkOrderRemovalReason?.trim(), crewCount, additionalTechnicianNames, vehicleIdentifier, arrivalNote, channel: input.channel, locationResult: input.location.result }, ids }));
  const visit = { id, organizationId: input.organizationId, storeId: input.storeId, providerKind: vendorId ? "outside_vendor" as const : "internal" as const, vendorId, internalMembershipId, workOrderId: scalarWorkOrderId, unmatchedReason: assignedWorkOrders.length ? undefined : input.unmatchedReason?.trim(), technicianName, technicianPhoneOrPin, crewCount, additionalTechnicianNames, vehicleIdentifier, arrivalNote, providerName, purpose, status: "active" as const, startedChannel: input.channel, checkedInAt: now };
  return { repository, ids, now, statements, visit, linkedWorkOrders: workOrders, visitWorkOrders };
}

export async function checkInVisit(svc: OpsCommandServices, input: CheckInVisitInput) {
  const prepared = await prepareCheckInVisit(svc, input);
  await atomicWorkOrderSetMutation({ repository: prepared.repository, workOrders: prepared.linkedWorkOrders, now: prepared.now, statements: prepared.statements });
  return { ...prepared.visit, siteVisitWorkOrders: prepared.visitWorkOrders };
}

export interface CheckInVisitWithCheckoutTokenInput extends CheckInVisitInput {
  checkoutToken: { tokenHash: string; expiresAt: IsoDateTime };
  idempotency?: CommandIdempotency;
}

export async function checkInVisitWithCheckoutToken(
  svc: OpsCommandServices,
  input: CheckInVisitWithCheckoutTokenInput,
) {
  const prepared = await prepareCheckInVisit(svc, input);
  if (!/^[a-f0-9]{64}$/i.test(input.checkoutToken.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  if (input.checkoutToken.expiresAt <= prepared.now) throw new OpsDomainError("VALIDATION", "Checkout token expiry must be in the future");
  const tokenId = prepared.ids.next("public-token");
  if (input.idempotency) {
    prepared.statements.unshift(idempotencyStatement(input.organizationId, prepared.visit.id, prepared.now, input.idempotency));
  }
  prepared.statements.push(
    insert("ops_public_tokens", {
      id: tokenId,
      organization_id: input.organizationId,
      purpose: "active_visit",
      subject_type: "visit",
      subject_id: prepared.visit.id,
      token_hash: input.checkoutToken.tokenHash.toLowerCase(),
      expires_at: input.checkoutToken.expiresAt,
      created_at: prepared.now,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "visit",
      aggregateId: prepared.visit.id,
      eventType: "visit.checkout_token_issued",
      actor: input.actor,
      occurredAt: prepared.now,
      payload: { tokenId, expiresAt: input.checkoutToken.expiresAt },
      ids: prepared.ids,
    }),
  );
  await atomicWorkOrderSetMutation({ repository: prepared.repository, workOrders: prepared.linkedWorkOrders, now: prepared.now, statements: prepared.statements });
  return { visit: { ...prepared.visit, siteVisitWorkOrders: prepared.visitWorkOrders }, tokenId, expiresAt: input.checkoutToken.expiresAt };
}

export interface AddHeldWorkToActiveVisitInput {
  organizationId: OpsId;
  visitId: OpsId;
  heldWorkOrderIds: readonly OpsId[];
  actor: ActorContext;
  idempotency?: CommandIdempotency;
}

/** Adds manager-approved work to an active visit without making the technician check in again. */
export async function addHeldWorkToActiveVisit(svc: OpsCommandServices, input: AddHeldWorkToActiveVisitInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrderIds = [...input.heldWorkOrderIds];
  if (!workOrderIds.length || workOrderIds.length > 100 || workOrderIds.some((id) => !id.trim()) || new Set(workOrderIds).size !== workOrderIds.length) {
    throw new OpsDomainError("VALIDATION", "Choose each additional approved item once, up to 100 items");
  }
  const visit = await repository.getVisit(input.organizationId, input.visitId);
  if (!visit || visit.status !== "active" || visit.providerKind !== "outside_vendor" || !visit.vendorId) {
    throw new OpsDomainError("CONFLICT", "This vendor visit is no longer active");
  }
  const existingLinks = await repository.listSiteVisitWorkOrders(input.organizationId, visit.id);
  if (workOrderIds.some((workOrderId) => existingLinks.some((link) => link.workOrderId === workOrderId))) {
    throw new OpsDomainError("CONFLICT", "One of these items is already part of this visit");
  }
  const pairs = await Promise.all(workOrderIds.map(async (workOrderId) => ({
    workOrder: await repository.getWorkOrder(input.organizationId, workOrderId),
    hold: await repository.getWorkOrderVisitHold(input.organizationId, workOrderId),
  })));
  if (pairs.some(({ workOrder, hold }) => !workOrder || workOrder.storeId !== visit.storeId || workOrder.status !== "approved" || !hold || hold.status !== "active")) {
    throw new OpsDomainError("CONFLICT", "One or more additional items are no longer available at this store");
  }
  const workOrders = pairs.map((pair) => pair.workOrder!);
  for (const workOrder of workOrders) {
    const eligibility = await heldWorkVendorEligibility({ repository, organizationId: input.organizationId, vendorId: visit.vendorId, workOrder, now: clock.now() });
    if (!eligibility.allowed) throw new OpsDomainError("FORBIDDEN", eligibility.reason ?? "This item is not available to the onsite vendor");
    const links = await repository.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, workOrder.id);
    const linkedVisits = await Promise.all([...new Set(links.map((link) => link.visitId))].map((visitId) => repository.getVisit(input.organizationId, visitId)));
    if (linkedVisits.some((candidate) => candidate?.status === "active")) throw new OpsDomainError("CONFLICT", "One of these items is already part of another active visit");
  }

  const now = clock.now();
  const providerName = visit.providerName;
  const addedLinks: SiteVisitWorkOrder[] = workOrders.map((workOrder, index) => ({
    id: ids.next("site-visit-work"), organizationId: input.organizationId, visitId: visit.id,
    workOrderId: workOrder.id, ordinal: existingLinks.length + index + 1,
    linkedByActorType: input.actor.actorType, linkedByActorId: input.actor.actorId,
    linkedByActorName: input.actor.actorName, linkedAt: now, selectionSource: "held_work",
    workOrderHoldId: pairs[index]!.hold!.id,
  }));
  const statements: OpsStatement[] = [];
  if (input.idempotency) statements.push(idempotencyStatement(input.organizationId, visit.id, now, input.idempotency));
  statements.push(
    ...addedLinks.map((link) => insert("ops_site_visit_work_orders", {
      id: link.id, organization_id: link.organizationId, visit_id: link.visitId,
      work_order_id: link.workOrderId, ordinal: link.ordinal,
      linked_by_actor_type: link.linkedByActorType, linked_by_actor_id: link.linkedByActorId,
      linked_by_actor_name: link.linkedByActorName, linked_at: link.linkedAt,
      selection_source: link.selectionSource, work_order_hold_id: link.workOrderHoldId,
    })),
    { sql: "UPDATE ops_visit_sessions SET work_order_id = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [existingLinks.length + addedLinks.length === 1 ? addedLinks[0]!.workOrderId : null, input.organizationId, visit.id, "active"] },
  );
  for (let index = 0; index < pairs.length; index += 1) {
    const { workOrder, hold } = pairs[index]!;
    const priorAssignment = await repository.getActiveAssignment(input.organizationId, workOrder!.id);
    const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder!.id);
    const replacementTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder!.id,
      draft: taskDraft({ workOrder: workOrder!, taskType: "record_service_outcome", title: "Record service outcome",
        assignee: { assigneeType: "vendor", assigneeId: visit.vendorId, assigneeName: providerName },
        dueAt: addHours(now, 8), applicableSlaClock: "completion", initialStatus: "in_progress",
        escalationDestination: workOrder!.escalationTo,
        completionCriteria: "Record checkout evidence and one outcome for this approved item" }),
      actor: input.actor, createdAt: now,
    });
    if (priorAssignment) statements.push({ sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND status NOT IN ('cancelled','declined','completed','superseded')", params: ["superseded", input.organizationId, priorAssignment.id] });
    statements.push(
      insert("ops_work_order_assignments", { id: ids.next("assignment"), organization_id: input.organizationId, work_order_id: workOrder!.id, kind: "outside_vendor", vendor_id: visit.vendorId, status: "accepted", assigned_at: now, supersedes_assignment_id: priorAssignment?.id }),
      { sql: "UPDATE ops_work_order_visit_holds SET status = ?, claimed_visit_id = ?, claimed_vendor_id = ?, claimed_at = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status = ? AND version = ?", params: ["claimed", visit.id, visit.vendorId, now, now, input.organizationId, hold!.id, "active", hold!.version] },
      { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", providerName, "Record service outcome", input.organizationId, workOrder!.id] },
      ...buildReplaceMatchingTaskStatements({
        workOrder: workOrder!, tasks, targetTask: selectPrimaryWorkflowTask(tasks), replacementTask,
        actor: input.actor, occurredAt: now, ids, resolutionNote: "Vendor added this approved item during an active visit",
      }),
      ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder!.id, eventType: "work_order.held_work_claimed", actor: input.actor, occurredAt: now, payload: { holdId: hold!.id, visitId: visit.id, vendorId: visit.vendorId, posture: hold!.posture, deadlineAt: hold!.deadlineAt, addedAfterCheckIn: true }, ids }),
    );
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id,
    eventType: "held_work.added_during_visit", actor: input.actor, occurredAt: now,
    payload: { storeId: visit.storeId, vendorId: visit.vendorId, workOrderIds, itemCount: workOrderIds.length, amountMeaning: "no_price_or_authorization_recorded" }, ids,
  }));
  await atomicWorkOrderSetMutation({ repository, workOrders, now, statements, conflictMessage: "This visit or one of the selected items changed. Refresh before adding work." });
  return { visit, addedLinks };
}

export interface VisitFollowUpInput { accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string }
export interface PerWorkOrderVisitOutcomeInput { workOrderId: OpsId; outcome: SiteVisitWorkOrderOutcome; outcomeNotes?: string; vendorFollowUpTiming?: VendorFollowUpTiming; followUp?: VisitFollowUpInput }
export interface CheckOutVisitInput { organizationId: OpsId; visitId: OpsId; channel: VisitChannel; outcome?: VisitOutcome; outcomeNotes?: string; location: LocationObservation; followUp?: VisitFollowUpInput; perWorkOrderOutcomes?: readonly PerWorkOrderVisitOutcomeInput[]; idempotency?: CommandIdempotency; actor: ActorContext }
export async function checkOutVisit(svc: OpsCommandServices, input: CheckOutVisitInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const visit = await repository.getVisit(input.organizationId, input.visitId);
  if (!visit) throw new OpsDomainError("NOT_FOUND", "Visit not found");
  if (visit.status !== "active" || visit.checkedOutAt) throw new OpsDomainError("CONFLICT", "Visit is already closed");
  const now = clock.now();
  assertFreshLocationCapture(input.location, now);
  const observedDurationSeconds = Math.max(0, Math.floor((Date.parse(now) - Date.parse(visit.checkedInAt)) / 1000));
  if (!Number.isFinite(observedDurationSeconds)) throw new OpsDomainError("VALIDATION", "Visit check-in timestamp is invalid");
  const links = await repository.listSiteVisitWorkOrders(input.organizationId, visit.id);
  const serviceRunStop = await repository.getRouteStopForVisit(input.organizationId, visit.id);
  const serviceRun = serviceRunStop ? await repository.getServiceRun(input.organizationId, serviceRunStop.serviceRunId) : null;
  if (!links.length) {
    if (input.perWorkOrderOutcomes?.length) throw new OpsDomainError("VALIDATION", "An unmatched visit cannot record work-order outcomes");
    if (!input.outcome) throw new OpsDomainError("VALIDATION", "Visit outcome is required");
    const statements: OpsStatement[] = [
      { sql: "UPDATE ops_visit_sessions SET status = ?, ended_channel = ?, checked_out_at = ?, outcome = ?, outcome_notes = ?, observed_duration_seconds = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["checked_out", input.channel, now, input.outcome, input.outcomeNotes ?? null, observedDurationSeconds, input.organizationId, input.visitId, "active"] },
      insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.visitId, kind: "check_out", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes }) }),
      ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actor: input.actor, occurredAt: now, payload: { workOrderIds: [], outcome: input.outcome, channel: input.channel, observedDurationSeconds, durationMeaning: "approximate_presence_not_labor" }, ids }),
    ];
    if (input.idempotency) statements.unshift(idempotencyStatement(input.organizationId, visit.id, now, input.idempotency));
    await repository.atomicWrite(statements);
    return { ...visit, workOrderId: undefined, status: "checked_out" as const, endedChannel: input.channel, checkedOutAt: now, outcome: input.outcome, outcomeNotes: input.outcomeNotes, observedDurationSeconds, followUpId: undefined, siteVisitWorkOrders: [] as SiteVisitWorkOrder[] };
  }
  if (input.perWorkOrderOutcomes && (input.outcome || input.followUp)) throw new OpsDomainError("VALIDATION", "Do not mix per-work-order outcomes with the legacy scalar checkout fields");
  const requestedOutcomes: PerWorkOrderVisitOutcomeInput[] = input.perWorkOrderOutcomes
    ? [...input.perWorkOrderOutcomes]
    : links.length === 1 && input.outcome
      ? [{ workOrderId: links[0]!.workOrderId, outcome: siteVisitOutcomeFromLegacy(input.outcome), outcomeNotes: input.outcomeNotes, followUp: input.followUp }]
      : [];
  if (requestedOutcomes.length !== links.length || new Set(requestedOutcomes.map((item) => item.workOrderId)).size !== requestedOutcomes.length) {
    throw new OpsDomainError("VALIDATION", "Provide exactly one outcome for every work order selected for this visit");
  }
  const allowedOutcomes = new Set<SiteVisitWorkOrderOutcome>(["completed", "temporary_repair", "diagnosis_only", "quote_required", "parts_required", "return_visit_required", "no_issue_found", "store_access_unavailable", "work_not_authorized", "not_addressed"]);
  const linksByWork = new Map(links.map((link) => [link.workOrderId, link]));
  const holdsById = new Map((await Promise.all(links
    .filter((link) => link.workOrderHoldId)
    .map(async (link) => repository.getWorkOrderVisitHold(input.organizationId, link.workOrderId))))
    .filter((hold): hold is NonNullable<typeof hold> => Boolean(hold))
    .map((hold) => [hold.id, hold] as const));
  const vendorFollowUpTimings = new Set<VendorFollowUpTiming>(["within_7_days", "within_30_days", "within_90_days", "next_pm", "unknown"]);
  const normalizedOutcomes = requestedOutcomes.map((requested) => {
    const link = linksByWork.get(requested.workOrderId);
    if (!link || !allowedOutcomes.has(requested.outcome)) throw new OpsDomainError("VALIDATION", "Checkout includes an outcome for work that is not linked to this visit");
    if (link.outcome) throw new OpsDomainError("CONFLICT", "A linked work-order outcome has already been recorded");
    const hold = link.workOrderHoldId ? holdsById.get(link.workOrderHoldId) : undefined;
    if (link.workOrderHoldId && (!hold || hold.status !== "claimed" || hold.claimedVisitId !== visit.id)) {
      throw new OpsDomainError("CONFLICT", "A held item is no longer claimed by this visit");
    }
    if (hold?.posture === "look_and_report" && ["completed", "temporary_repair"].includes(requested.outcome)) {
      throw new OpsDomainError("VALIDATION", "Look-and-report work can be inspected or left unattempted, but not marked complete");
    }
    if (requested.vendorFollowUpTiming && requested.outcome !== "temporary_repair") {
      throw new OpsDomainError("VALIDATION", "Expected follow-up timing applies only to a temporary repair");
    }
    if (requested.vendorFollowUpTiming && !vendorFollowUpTimings.has(requested.vendorFollowUpTiming)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported temporary-repair follow-up window");
    }
    const heldItemNeedsReview = Boolean(hold && !["completed", "not_addressed"].includes(requested.outcome));
    const requiresFollowUp = hold ? heldItemNeedsReview : siteVisitOutcomeRequiresFollowUp(requested.outcome);
    if (!hold && requiresFollowUp && !requested.followUp) throw new OpsDomainError("VALIDATION", `Outcome ${requested.outcome} requires its own accountable follow-up`);
    if (!requiresFollowUp && requested.followUp) throw new OpsDomainError("VALIDATION", `Outcome ${requested.outcome} cannot create an unresolved-work follow-up`);
    const followUp = hold && heldItemNeedsReview ? {
      accountableParty: "Facilities coordinator",
      nextAction: requested.outcome === "temporary_repair"
        ? "Review the temporary repair and plan permanent work"
        : "Review the onsite findings and choose the next step",
      dueAt: addHours(now, 4),
      escalationTo: "Facilities director",
    } : requested.followUp ? {
      accountableParty: required(requested.followUp.accountableParty, "Follow-up accountable party"),
      nextAction: required(requested.followUp.nextAction, "Follow-up next action"),
      dueAt: requested.followUp.dueAt,
      escalationTo: required(requested.followUp.escalationTo, "Follow-up escalation"),
    } : undefined;
    return { link, hold, outcome: requested.outcome, outcomeNotes: requested.outcomeNotes?.trim() || undefined, vendorFollowUpTiming: requested.vendorFollowUpTiming, followUp };
  });
  const workOrders = await Promise.all(links.map((link) => repository.getWorkOrder(input.organizationId, link.workOrderId)));
  if (workOrders.some((workOrder) => !workOrder)) throw new OpsDomainError("NOT_FOUND", "One or more linked visit work orders were not found");
  const linkedWorkOrders = workOrders as WorkOrder[];
  const tasksByWorkOrder = new Map(await Promise.all(linkedWorkOrders.map(async (workOrder) => [workOrder.id, await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id)] as const)));
  const scalarOutcome = links.length === 1 ? legacyOutcomeFromSiteVisit(normalizedOutcomes[0]!.outcome) : undefined;
  const scalarOutcomeNotes = links.length === 1 ? normalizedOutcomes[0]!.outcomeNotes : undefined;
  const statements: OpsStatement[] = [
    { sql: "UPDATE ops_visit_sessions SET status = ?, ended_channel = ?, checked_out_at = ?, outcome = ?, outcome_notes = ?, observed_duration_seconds = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["checked_out", input.channel, now, scalarOutcome ?? null, scalarOutcomeNotes ?? null, observedDurationSeconds, input.organizationId, input.visitId, "active"] },
    insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.visitId, kind: "check_out", channel: input.channel, observed_at: now, location_result: input.location.result, latitude_e6: input.location.latitudeE6, longitude_e6: input.location.longitudeE6, accuracy_m: input.location.accuracyM, distance_m: input.location.distanceM, payload_json: json({ clientCapturedAt: input.location.capturedAt, serverObservedAt: now, perWorkOrderOutcomes: normalizedOutcomes.map(({ link, outcome, outcomeNotes, vendorFollowUpTiming }) => ({ workOrderId: link.workOrderId, outcome, outcomeNotes, vendorFollowUpTiming })) }) }),
  ];
  if (serviceRunStop && serviceRun) {
    const runWork = await repository.listServiceRunWorkOrders(input.organizationId, serviceRun.id);
    for (const link of links) {
      const planned = runWork.find((row) => row.routeStopId === serviceRunStop.id && row.workOrderId === link.workOrderId && row.planned);
      if (planned) statements.push({ sql: "UPDATE ops_service_run_work_orders SET addressed = ? WHERE organization_id = ? AND id = ? AND service_run_id = ?", params: [true, input.organizationId, planned.id, serviceRun.id] });
    }
    statements.push({ sql: "UPDATE ops_route_stops SET status = ? WHERE organization_id = ? AND id = ? AND service_run_id = ? AND site_visit_id = ?", params: ["completed", input.organizationId, serviceRunStop.id, serviceRun.id, visit.id] });
    const otherOpenStops = (await repository.listRouteStops(input.organizationId, serviceRun.id)).filter((stop) => stop.id !== serviceRunStop.id && stop.status !== "completed");
    if (!otherOpenStops.length) statements.push({ sql: "UPDATE ops_service_runs SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", now, input.organizationId, serviceRun.id, "in_progress"] });
    statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "service_run", aggregateId: serviceRun.id, eventType: "service_run.stop_completed", actor: input.actor, occurredAt: now, payload: { routeStopId: serviceRunStop.id, visitId: visit.id, addressedWorkOrderIds: links.map((link) => link.workOrderId), remainingStopCount: otherOpenStops.length }, ids }));
  }
  const updatedLinks: SiteVisitWorkOrder[] = [];
  const visitWasAlreadyPlanned = Boolean(serviceRunStop)
    || links.some((link) => link.selectionSource === "assigned_work" || link.selectionSource === "service_run");
  const heldOutcomeSummary = {
    completed: 0,
    temporaryRepair: 0,
    inspectionCaptured: 0,
    notAttempted: 0,
    plannedVisitBundle: 0,
    unplannedOnsitePickup: 0,
  };
  for (const normalized of normalizedOutcomes) {
    const workOrder = linkedWorkOrders.find((candidate) => candidate.id === normalized.link.workOrderId)!;
    const followUpId = normalized.followUp ? ids.next("follow-up") : undefined;
    if (normalized.followUp) statements.push(insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: workOrder.id, source_visit_id: visit.id, accountable_party: normalized.followUp.accountableParty, next_action: normalized.followUp.nextAction, due_at: normalized.followUp.dueAt, escalation_to: normalized.followUp.escalationTo, status: "open", created_at: now }));
    statements.push({ sql: "UPDATE ops_site_visit_work_orders SET outcome = ?, outcome_notes = ?, outcome_recorded_by_actor_type = ?, outcome_recorded_by_actor_id = ?, outcome_recorded_by_actor_name = ?, outcome_recorded_at = ?, follow_up_id = ?, vendor_follow_up_timing = ? WHERE organization_id = ? AND id = ?", params: [normalized.outcome, normalized.outcomeNotes ?? null, input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, now, followUpId ?? null, normalized.vendorFollowUpTiming ?? null, input.organizationId, normalized.link.id] });
    if (normalized.hold) {
      const valueCategory = normalized.outcome === "not_addressed"
        ? undefined
        : normalized.hold.posture === "look_and_report" || !["completed", "temporary_repair"].includes(normalized.outcome)
          ? "inspection_captured"
          : visitWasAlreadyPlanned
            ? "planned_visit_bundle"
            : "unplanned_onsite_pickup";
      const holdStatus = normalized.outcome === "completed"
        ? "completed"
        : normalized.outcome === "not_addressed" || normalized.outcome === "temporary_repair"
          ? "active"
          : "review_required";
      const workOrderProjection = normalized.outcome === "completed"
        ? { status: "completed_pending_review", accountableParty: "Facilities coordinator", nextAction: "Verify the completed held work", dueAt: addHours(now, 24) }
        : normalized.outcome === "not_addressed"
          ? { status: "approved", accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: normalized.hold.deadlineAt }
          : normalized.outcome === "temporary_repair"
            ? { status: "approved", accountableParty: "Facilities coordinator", nextAction: "Review the temporary repair and plan permanent work", dueAt: normalized.hold.deadlineAt }
            : { status: "approved", accountableParty: "Facilities coordinator", nextAction: "Review the onsite findings and choose the next step", dueAt: addHours(now, 4) };
      statements.push(
        { sql: "UPDATE ops_work_order_visit_holds SET status = ?, planned_review_appointment_id = NULL, planned_review_selected_at = NULL, planned_review_selected_by_membership_id = NULL, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status = ? AND claimed_visit_id = ?", params: [holdStatus, now, input.organizationId, normalized.hold.id, "claimed", visit.id] },
        { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [workOrderProjection.status, workOrderProjection.accountableParty, workOrderProjection.nextAction, workOrderProjection.dueAt, "Facilities director", input.organizationId, workOrder.id] },
        { sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND work_order_id = ? AND vendor_id = ? AND status = ?", params: [normalized.outcome === "not_addressed" ? "superseded" : "completed", input.organizationId, workOrder.id, visit.vendorId ?? null, "accepted"] },
      );
      const tasks = tasksByWorkOrder.get(workOrder.id) ?? [];
      const sourceTask = selectPrimaryWorkflowTask(tasks.filter((task) => task.taskType === "record_service_outcome"));
      const taskTitle = workOrderProjection.nextAction;
      const replacementTask = buildWorkflowTaskRecord({
        id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
        draft: taskDraft({
          workOrder,
          taskType: normalized.outcome === "completed" ? "verify_repair" : normalized.outcome === "not_addressed" ? "choose_service_provider" : "schedule_return_visit",
          title: taskTitle,
          assignee: facilitiesAssignee(),
          dueAt: workOrderProjection.dueAt,
          applicableSlaClock: normalized.outcome === "completed" ? "verification" : "scheduling",
          sourceFollowUpId: followUpId,
          escalationDestination: "Facilities director",
          completionCriteria: normalized.outcome === "not_addressed"
            ? "A matching vendor claims the approved held work before its original deadline"
            : "Facilities reviews the recorded result and chooses the next step",
        }),
        actor: input.actor, createdAt: now,
      });
      statements.push(...buildReplaceMatchingTaskStatements({
        workOrder, tasks, targetTask: sourceTask, replacementTask,
        actor: input.actor, occurredAt: now, ids,
        resolutionNote: `Held-work checkout recorded with outcome ${normalized.outcome}`,
      }));
      statements.push(...auditAndOutbox({
        organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id,
        eventType: "work_order.held_work_outcome_recorded", actor: input.actor, occurredAt: now,
        payload: { visitId: visit.id, holdId: normalized.hold.id, outcome: normalized.outcome, holdStatus, followUpId, vendorFollowUpTiming: normalized.vendorFollowUpTiming, originalDeadlineAt: normalized.hold.deadlineAt, valueCategory, valueMeaning: valueCategory ? "recorded_operating_fact_without_invented_dollars" : "no_value_claim_recorded" }, ids,
      }));
      if (normalized.outcome === "completed") heldOutcomeSummary.completed += 1;
      else if (normalized.outcome === "temporary_repair") heldOutcomeSummary.temporaryRepair += 1;
      else if (normalized.outcome === "not_addressed") heldOutcomeSummary.notAttempted += 1;
      else heldOutcomeSummary.inspectionCaptured += 1;
      if (valueCategory === "planned_visit_bundle") heldOutcomeSummary.plannedVisitBundle += 1;
      if (valueCategory === "unplanned_onsite_pickup") heldOutcomeSummary.unplannedOnsitePickup += 1;
      updatedLinks.push({ ...normalized.link, outcome: normalized.outcome, outcomeNotes: normalized.outcomeNotes, outcomeRecordedByActorType: input.actor.actorType, outcomeRecordedByActorId: input.actor.actorId, outcomeRecordedByActorName: input.actor.actorName, outcomeRecordedAt: now, followUpId, vendorFollowUpTiming: normalized.vendorFollowUpTiming });
      continue;
    }
    const unresolved = siteVisitOutcomeRequiresFollowUp(normalized.outcome);
    statements.push(unresolved
      ? { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [normalized.outcome === "parts_required" ? "waiting_on_parts" : "waiting_on_vendor", normalized.followUp!.accountableParty, normalized.followUp!.nextAction, normalized.followUp!.dueAt, normalized.followUp!.escalationTo, input.organizationId, workOrder.id] }
      : { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ? WHERE organization_id = ? AND id = ?", params: ["completed_pending_review", "Facilities coordinator", "Verify current service outcome", input.organizationId, workOrder.id] });
    const tasks = tasksByWorkOrder.get(workOrder.id) ?? [];
    const sourceTask = selectPrimaryWorkflowTask(tasks.filter((task) => task.taskType === "record_service_outcome"));
    const originatingReturnTask = [...tasks]
      .filter((task) => task.taskType === "schedule_return_visit" && task.sourceFollowUpId && task.status === "in_progress")
      .sort((left, right) => (right.startedAt ?? right.createdAt).localeCompare(left.startedAt ?? left.createdAt) || right.id.localeCompare(left.id))[0];
    const originatingFollowUp = originatingReturnTask?.sourceFollowUpId
      ? await repository.getFollowUp(input.organizationId, originatingReturnTask.sourceFollowUpId)
      : undefined;
    if (originatingReturnTask && (!originatingFollowUp || originatingFollowUp.workOrderId !== workOrder.id || originatingFollowUp.status !== "open")) {
      throw new OpsDomainError("CONFLICT", "The active return visit has an invalid originating follow-up");
    }
    let tasksForReplacement = tasks;
    if (originatingReturnTask && originatingFollowUp) {
      statements.push(
        { sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", now, input.organizationId, originatingFollowUp.id, "open"] },
        ...buildCompleteWorkflowTaskStatements({
          task: originatingReturnTask, actor: input.actor, occurredAt: now, ids,
          resolutionNote: `Return visit checkout recorded outcome ${normalized.outcome}`,
        }),
        ...auditAndOutbox({
          organizationId: input.organizationId, aggregateType: "follow_up", aggregateId: originatingFollowUp.id,
          eventType: "follow_up.completed_by_return_visit", actor: input.actor, occurredAt: now,
          payload: { workOrderId: workOrder.id, visitId: visit.id, siteVisitWorkOrderId: normalized.link.id, outcome: normalized.outcome }, ids,
        }),
      );
      tasksForReplacement = tasks.map((task): WorkflowTask => task.id === originatingReturnTask.id
        ? { ...task, status: "completed", completedByActorType: input.actor.actorType, completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName, completedAt: now }
        : task);
    }
    const taskTitle = normalized.followUp?.nextAction ?? "Verify current service outcome";
    const replacementTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      draft: taskDraft({ workOrder,
        taskType: unresolved ? "schedule_return_visit" : "verify_repair",
        title: taskTitle,
        assignee: facilitiesAssignee(normalized.followUp?.accountableParty ?? "Facilities coordinator"),
        dueAt: normalized.followUp?.dueAt ?? addHours(now, 24),
        applicableSlaClock: unresolved ? "scheduling" : "verification",
        sourceFollowUpId: followUpId,
        escalationDestination: normalized.followUp?.escalationTo ?? workOrder.escalationTo,
        completionCriteria: unresolved
          ? `Record resolution of the required follow-up: ${taskTitle}`
          : "Record store or facilities verification of the reported service outcome",
      }),
      actor: input.actor, createdAt: now,
    });
    statements.push(...buildReplaceMatchingTaskStatements({
      workOrder, tasks: tasksForReplacement,
      targetTask: sourceTask,
      replacementTask, actor: input.actor, occurredAt: now, ids,
      resolutionNote: `Visit checkout recorded with outcome ${normalized.outcome}`,
    }));
    statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.visit_outcome_recorded", actor: input.actor, occurredAt: now, payload: { visitId: visit.id, siteVisitWorkOrderId: normalized.link.id, outcome: normalized.outcome, followUpId, observedDurationSeconds, durationMeaning: "approximate_presence_not_labor" }, ids }));
    updatedLinks.push({ ...normalized.link, outcome: normalized.outcome, outcomeNotes: normalized.outcomeNotes, outcomeRecordedByActorType: input.actor.actorType, outcomeRecordedByActorId: input.actor.actorId, outcomeRecordedByActorName: input.actor.actorName, outcomeRecordedAt: now, followUpId, vendorFollowUpTiming: normalized.vendorFollowUpTiming });
  }
  const heldOutcomeCount = normalizedOutcomes.filter((row) => Boolean(row.link.workOrderHoldId)).length;
  if (heldOutcomeCount) statements.push(...auditAndOutbox({
    organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id,
    eventType: "held_work.outcomes_recorded", actor: input.actor, occurredAt: now,
    payload: {
      storeId: visit.storeId,
      vendorId: visit.vendorId,
      workOrderIds: normalizedOutcomes.filter((row) => Boolean(row.link.workOrderHoldId)).map((row) => row.link.workOrderId),
      itemCount: heldOutcomeCount,
      ...heldOutcomeSummary,
      amountMeaning: "no_price_or_authorization_recorded",
      verifiedAvoidedTripCount: 0,
      verifiedAvoidedTripMeaning: "requires_separate_manager_verification",
    }, ids,
  }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actor: input.actor, occurredAt: now, payload: { workOrderIds: links.map((link) => link.workOrderId), perWorkOrderOutcomes: updatedLinks.map((link) => ({ workOrderId: link.workOrderId, outcome: link.outcome, followUpId: link.followUpId })), channel: input.channel, observedDurationSeconds, durationMeaning: "approximate_presence_not_labor" }, ids }));
  if (input.idempotency) statements.unshift(idempotencyStatement(input.organizationId, visit.id, now, input.idempotency));
  await atomicWorkOrderSetMutation({ repository, workOrders: linkedWorkOrders, now, statements, conflictMessage: "This visit or one of its selected work orders changed. Refresh before recording checkout." });
  return { ...visit, workOrderId: links.length === 1 ? links[0]!.workOrderId : undefined, status: "checked_out" as const, endedChannel: input.channel, checkedOutAt: now, outcome: scalarOutcome, outcomeNotes: scalarOutcomeNotes, observedDurationSeconds, followUpId: updatedLinks.length === 1 ? updatedLinks[0]!.followUpId : undefined, siteVisitWorkOrders: updatedLinks };
}

export interface CreateFollowUpInput { organizationId: OpsId; workOrderId: OpsId; sourceVisitId?: OpsId; accountableParty: string; nextAction: string; dueAt: IsoDateTime; escalationTo: string; promoteToPrimary?: boolean; actor: ActorContext }
export async function createFollowUp(svc: OpsCommandServices, input: CreateFollowUpInput) {
  const { repository, clock, ids } = services(svc); assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (workOrder.status === "resolved" || terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Resolved, closed, or cancelled work cannot receive a follow-up");
  if (input.sourceVisitId && !(await repository.getVisit(input.organizationId, input.sourceVisitId))) throw new OpsDomainError("NOT_FOUND", "Source visit not found");
  const now = clock.now(); const id = ids.next("follow-up");
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const promoteToPrimary = input.promoteToPrimary !== false;
  const task = buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: taskDraft({ workOrder, taskType: "schedule_return_visit", title: required(input.nextAction, "Next action"),
      assignee: facilitiesAssignee(required(input.accountableParty, "Accountable party")), dueAt: input.dueAt,
      applicableSlaClock: "scheduling", sourceFollowUpId: id,
      blocking: promoteToPrimary, requiredForProgress: promoteToPrimary,
      escalationDestination: required(input.escalationTo, "Escalation") }),
    actor: input.actor, createdAt: now,
  });
  const primaryTask = selectPrimaryWorkflowTask(tasks);
  const taskStatements = !promoteToPrimary
    ? [
        ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
        buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, task]),
      ]
    : primaryTask && !primaryTask.sourceFollowUpId && !primaryTask.sourceApprovalRequestId
      ? buildReplaceMatchingTaskStatements({
          workOrder, tasks, targetTask: primaryTask, replacementTask: task,
          actor: input.actor, occurredAt: now, ids, resolutionNote: "Required follow-up created",
        })
      : [
          ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
          buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, task]),
        ];
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    insert("ops_follow_ups", { id, organization_id: input.organizationId, work_order_id: input.workOrderId, source_visit_id: input.sourceVisitId, accountable_party: required(input.accountableParty, "Accountable party"), next_action: required(input.nextAction, "Next action"), due_at: input.dueAt, escalation_to: required(input.escalationTo, "Escalation"), status: "open", created_at: now }),
    ...(promoteToPrimary ? [{ sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [input.accountableParty, input.nextAction, input.dueAt, input.escalationTo, input.organizationId, input.workOrderId] }] : []),
    ...taskStatements,
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: input.workOrderId, eventType: "follow_up.created", actor: input.actor, occurredAt: now, payload: { followUpId: id, sourceVisitId: input.sourceVisitId, dueAt: input.dueAt, promoteToPrimary }, ids }),
  ] });
  return { id, organizationId: input.organizationId, workOrderId: input.workOrderId, sourceVisitId: input.sourceVisitId, accountableParty: input.accountableParty.trim(), nextAction: input.nextAction.trim(), dueAt: input.dueAt, escalationTo: input.escalationTo.trim(), status: "open" as const, createdAt: now };
}

export interface CreateBulkFollowUpsInput {
  organizationId: OpsId;
  workOrderIds: OpsId[];
  accountableParty: string;
  nextAction: string;
  dueAt: IsoDateTime;
  escalationTo: string;
  actor: ActorContext;
}

/** Adds the same non-blocking reminder to a bounded work-order set in one commit. */
export async function createBulkFollowUps(svc: OpsCommandServices, input: CreateBulkFollowUpsInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrderIds = [...new Set(input.workOrderIds.map((id) => id.trim()).filter(Boolean))];
  if (!workOrderIds.length) throw new OpsDomainError("VALIDATION", "Select at least one work order.");
  if (workOrderIds.length > 50) throw new OpsDomainError("VALIDATION", "A bulk follow-up can include at most 50 work orders.");
  if (!Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Follow-up due date is invalid.");
  const accountableParty = required(input.accountableParty, "Accountable party");
  const nextAction = required(input.nextAction, "Next action");
  const escalationTo = required(input.escalationTo, "Escalation");
  const workOrders = await Promise.all(workOrderIds.map((id) => repository.getWorkOrder(input.organizationId, id)));
  if (workOrders.some((workOrder) => !workOrder)) {
    throw new OpsDomainError("NOT_FOUND", "One or more selected work orders are no longer available in your organization.");
  }
  const eligible = workOrders as WorkOrder[];
  if (eligible.some((workOrder) => workOrder.status === "resolved" || terminalWorkOrderStatuses.has(workOrder.status))) {
    throw new OpsDomainError("CONFLICT", "Resolved, closed, or cancelled work cannot receive a follow-up.");
  }
  const tasksByWorkOrder = await Promise.all(eligible.map((workOrder) => repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id)));
  const now = clock.now();
  const created: Array<{ id: OpsId; workOrderId: OpsId }> = [];
  const statements: OpsStatement[] = [];
  eligible.forEach((workOrder, index) => {
    const followUpId = ids.next("follow-up");
    const task = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      draft: taskDraft({ workOrder, taskType: "schedule_return_visit", title: nextAction,
        assignee: facilitiesAssignee(accountableParty), dueAt: input.dueAt,
        applicableSlaClock: "scheduling", sourceFollowUpId: followUpId,
        blocking: false, requiredForProgress: false, escalationDestination: escalationTo }),
      actor: input.actor, createdAt: now,
    });
    statements.push(
      insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: workOrder.id, accountable_party: accountableParty, next_action: nextAction, due_at: input.dueAt, escalation_to: escalationTo, status: "open", created_at: now }),
      ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
      buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasksByWorkOrder[index]!, task]),
      ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "follow_up.created", actor: input.actor, occurredAt: now, payload: { followUpId, dueAt: input.dueAt, promoteToPrimary: false, bulk: true }, ids }),
    );
    created.push({ id: followUpId, workOrderId: workOrder.id });
  });
  await atomicWorkOrderSetMutation({
    repository,
    workOrders: eligible,
    now,
    statements,
    conflictMessage: "One of the selected work orders changed. Refresh the queue and apply the follow-up again.",
  });
  return { created, count: created.length, dueAt: input.dueAt, nextAction };
}

export interface CreateVendorReminderInput { organizationId: OpsId; vendorId: OpsId; title: string; note?: string; accountableParty: string; dueAt: IsoDateTime; escalationTo: string; actor: ActorContext }
export async function createVendorReminder(svc: OpsCommandServices, input: CreateVendorReminderInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const vendor = await repository.getVendor(input.organizationId, input.vendorId);
  if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found");
  if (!Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Vendor reminder due date is invalid");
  const title = required(input.title, "Reminder");
  const accountableParty = required(input.accountableParty, "Accountable party");
  const escalationTo = required(input.escalationTo, "Escalation destination");
  const note = input.note?.trim() || undefined;
  const now = clock.now();
  const id = ids.next("vendor-reminder");
  await repository.atomicWrite([
    insert("ops_vendor_reminders", { id, organization_id: input.organizationId, vendor_id: vendor.id, title, note, accountable_party: accountableParty, due_at: input.dueAt, escalation_to: escalationTo, status: "open", created_by_actor_type: input.actor.actorType, created_by_actor_id: input.actor.actorId, created_by_actor_name: input.actor.actorName, created_at: now }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "vendor", aggregateId: vendor.id, eventType: "vendor.reminder_created", actor: input.actor, occurredAt: now, payload: { reminderId: id, title, accountableParty, dueAt: input.dueAt, escalationTo }, ids }),
  ]);
  return { id, organizationId: input.organizationId, vendorId: vendor.id, title, note, accountableParty, dueAt: input.dueAt, escalationTo, status: "open" as const, createdByActorType: input.actor.actorType, createdByActorId: input.actor.actorId, createdByActorName: input.actor.actorName, createdAt: now };
}

export interface UpdateVendorReminderInput extends Omit<CreateVendorReminderInput, "vendorId"> { reminderId: OpsId; updateNote: string }
export async function updateVendorReminder(svc: OpsCommandServices, input: UpdateVendorReminderInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const reminder = await repository.getVendorReminder(input.organizationId, input.reminderId);
  if (!reminder) throw new OpsDomainError("NOT_FOUND", "Vendor reminder not found");
  if (reminder.status !== "open") throw new OpsDomainError("CONFLICT", "Only an open vendor reminder can be updated");
  if (!Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Vendor reminder due date is invalid");
  const title = required(input.title, "Reminder");
  const accountableParty = required(input.accountableParty, "Accountable party");
  const escalationTo = required(input.escalationTo, "Escalation destination");
  const updateNote = required(input.updateNote, "Update note");
  const note = input.note?.trim() || undefined;
  const now = clock.now();
  await repository.atomicWrite([
    { sql: "UPDATE ops_vendor_reminders SET title = ?, note = ?, accountable_party = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status = 'open'", params: [title, note ?? null, accountableParty, input.dueAt, escalationTo, input.organizationId, reminder.id] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "vendor", aggregateId: reminder.vendorId, eventType: "vendor.reminder_updated", actor: input.actor, occurredAt: now, payload: { reminderId: reminder.id, updateNote, previous: { title: reminder.title, note: reminder.note, accountableParty: reminder.accountableParty, dueAt: reminder.dueAt, escalationTo: reminder.escalationTo }, current: { title, note, accountableParty, dueAt: input.dueAt, escalationTo } }, ids }),
  ]);
  return { ...reminder, title, note, accountableParty, dueAt: input.dueAt, escalationTo };
}

export interface CompleteVendorReminderInput { organizationId: OpsId; reminderId: OpsId; completionNote: string; actor: ActorContext }
export async function completeVendorReminder(svc: OpsCommandServices, input: CompleteVendorReminderInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const reminder = await repository.getVendorReminder(input.organizationId, input.reminderId);
  if (!reminder) throw new OpsDomainError("NOT_FOUND", "Vendor reminder not found");
  if (reminder.status !== "open") throw new OpsDomainError("CONFLICT", "Vendor reminder is already complete or cancelled");
  const completionNote = required(input.completionNote, "Completion note");
  const now = clock.now();
  await repository.atomicWrite([
    { sql: "UPDATE ops_vendor_reminders SET status = ?, completed_by_actor_type = ?, completed_by_actor_id = ?, completed_by_actor_name = ?, completed_at = ?, completion_note = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", input.actor.actorType, input.actor.actorId ?? null, input.actor.actorName, now, completionNote, input.organizationId, reminder.id, "open"] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "vendor", aggregateId: reminder.vendorId, eventType: "vendor.reminder_completed", actor: input.actor, occurredAt: now, payload: { reminderId: reminder.id, completionNote }, ids }),
  ]);
  return { ...reminder, status: "completed" as const, completedByActorType: input.actor.actorType, completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName, completedAt: now, completionNote };
}

export interface ReviewServiceRequestInput {
  organizationId: OpsId;
  requestId: OpsId;
  expectedStatus: "submitted" | "under_review";
  decision: "start_review" | "escalate" | "close";
  note?: string;
  actor: ActorContext;
}

export async function reviewServiceRequest(svc: OpsCommandServices, input: ReviewServiceRequestInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const request = await repository.getRequest(input.organizationId, input.requestId);
  if (!request) throw new OpsDomainError("NOT_FOUND", "Service request not found");
  if (request.status !== input.expectedStatus) throw new OpsDomainError("CONFLICT", "This request changed. Refresh before recording another decision");
  if (request.convertedWorkOrderId) throw new OpsDomainError("CONFLICT", "The request already has a canonical work order");
  if (input.decision === "start_review" && request.status !== "submitted") throw new OpsDomainError("CONFLICT", "Review has already started");
  const note = input.note?.trim();
  if ((input.decision === "close" || input.decision === "escalate") && !note) {
    throw new OpsDomainError("VALIDATION", "A reason is required for this review decision");
  }
  const now = clock.now();
  const nextStatus = input.decision === "close" ? "closed" : "under_review";
  const eventType = input.decision === "start_review"
    ? "request.review_started"
    : input.decision === "escalate"
      ? "request.escalated"
      : "request.closed";
  const statements: OpsStatement[] = [
    {
      sql: "UPDATE ops_requests SET status = ? WHERE organization_id = ? AND id = ? AND version = ? AND status = ? AND converted_work_order_id IS NULL",
      params: [nextStatus, input.organizationId, request.id, persistedRequestVersion(request) + 1, input.expectedStatus],
    },
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "request",
      aggregateId: request.id,
      eventType,
      actor: input.actor,
      occurredAt: now,
      payload: { previousStatus: request.status, status: nextStatus, note },
      ids,
    }),
  ];
  if (input.decision === "close") {
    const tasks = await repository.listWorkflowTasksForRequest(input.organizationId, request.id);
    tasks
      .filter((task) => task.taskType === "review_issue" && ["open", "in_progress"].includes(task.status))
      .forEach((task) => statements.push(...buildCompleteWorkflowTaskStatements({
        task,
        actor: input.actor,
        occurredAt: now,
        ids,
        resolutionNote: note ?? "Request closed during review",
      })));
  }
  await atomicRequestMutation({
    repository,
    request,
    now,
    statements,
    conflictMessage: "This request changed. Refresh before recording another decision",
  });
  return { ...request, status: nextStatus, version: persistedRequestVersion(request) + 1, reviewDecision: input.decision, reviewedAt: now, note };
}

export interface UpdateWorkOrderControlInput {
  organizationId: OpsId;
  workOrderId: OpsId;
  expectedStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  priority?: WorkOrderPriority;
  accountableParty?: string;
  nextAction?: string;
  dueAt?: IsoDateTime;
  escalationTo?: string;
  note: string;
  actor: ActorContext;
}

export async function updateWorkOrderControl(svc: OpsCommandServices, input: UpdateWorkOrderControlInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order not found");
  if (workOrder.status !== input.expectedStatus) throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before recording another update");
  if (terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Closed or cancelled work orders cannot be edited");
  if (input.status !== workOrder.status && !allowedWorkOrderControlTransitions(workOrder.status).includes(input.status)) {
    throw new OpsDomainError("CONFLICT", `Work cannot move directly from ${workOrder.status} to ${input.status}`);
  }
  const note = required(input.note, "Update note");
  if (input.status === "closed") {
    await assertWorkOrderReadyForClosure(repository, workOrder, input.actor);
  }
  const now = clock.now();
  const terminal = terminalWorkOrderStatuses.has(input.status);
  let estimateRequestsToRetire: WorkOrderEstimateRequest[] = [];
  let serviceAuthorizationIssuanceIds: OpsId[] = [];
  let workflowTasks: WorkflowTask[] = [];
  let visitHoldToCancel: { id: OpsId; status: string } | undefined;
  const priority = input.priority ?? workOrder.priority;
  let accountableParty: string;
  let nextAction: string;
  let dueAt: IsoDateTime | null;
  let escalationTo: string | null;
  if (terminal) {
    const [detail, estimateRequests, serviceAuthorizations, tasks, visitHold] = await Promise.all([
      repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
      repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id),
      repository.listIssuancesForWorkOrder(input.organizationId, workOrder.id),
      repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id),
      repository.getWorkOrderVisitHold(input.organizationId, workOrder.id),
    ]);
    workflowTasks = tasks;
    if (visitHold && ["active", "review_required"].includes(visitHold.status)) {
      visitHoldToCancel = { id: visitHold.id, status: visitHold.status };
    }
    if (detail?.visits.some((visit) => visit.status === "active")) {
      throw new OpsDomainError("CONFLICT", "Finish the active visit before closing or cancelling this work order");
    }
    if (detail?.followUps.some((followUp) => followUp.status === "open")) {
      throw new OpsDomainError("CONFLICT", "Complete or cancel open follow-ups before closing or cancelling this work order");
    }
    estimateRequestsToRetire = estimateRequests.filter((request) => (
      ["requested", "opened", "submitted"].includes(request.status)
      || (input.status === "cancelled" && request.status === "selected")
    ));
    serviceAuthorizationIssuanceIds = serviceAuthorizations.map((issuance) => issuance.id);
    accountableParty = "No active owner";
    nextAction = "No further action";
    dueAt = null;
    escalationTo = null;
  } else {
    accountableParty = required(input.accountableParty ?? workOrder.accountableParty, "Accountable party");
    nextAction = required(input.nextAction ?? workOrder.nextAction, "Next action");
    dueAt = input.dueAt ?? workOrder.dueAt ?? defaultWorkOrderDueAt(priority, now);
    escalationTo = required(input.escalationTo ?? workOrder.escalationTo ?? "Facilities director", "Escalation destination");
    if (!Number.isFinite(Date.parse(dueAt))) throw new OpsDomainError("VALIDATION", "Due date is invalid");
  }
  const closedAt = terminal ? now : null;
  const eventType = input.status !== workOrder.status
    ? input.status === "closed"
      ? "work_order.closed"
      : input.status === "cancelled"
        ? "work_order.cancelled"
        : "work_order.status_changed"
    : "work_order.control_updated";
  const statements: OpsStatement[] = [{
    sql: "UPDATE ops_work_orders SET status = ?, priority = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ?, closed_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
    params: [input.status, priority, accountableParty, nextAction, dueAt, escalationTo, closedAt, input.organizationId, workOrder.id, input.expectedStatus],
  }];
  if (terminal) {
    if (visitHoldToCancel) {
      statements.push(
        {
          sql: "UPDATE ops_work_order_visit_holds SET status = ?, version = version + 1, updated_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
          params: ["cancelled", now, input.organizationId, visitHoldToCancel.id, visitHoldToCancel.status],
        },
        ...auditAndOutbox({
          organizationId: input.organizationId,
          aggregateType: "work_order",
          aggregateId: workOrder.id,
          eventType: "work_order.visit_hold_cancelled_with_work_order",
          actor: input.actor,
          occurredAt: now,
          payload: { holdId: visitHoldToCancel.id, terminalWorkOrderStatus: input.status },
          ids,
        }),
      );
    }
    statements.push(...buildCompleteTasksForTransition({
      workOrder, tasks: workflowTasks, targetStatus: input.status as "closed" | "cancelled",
      actor: input.actor, occurredAt: now, ids,
      resolutionNote: note,
    }));
    statements.push({
      sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?",
      params: ["No active owner", "No further action", null, null, input.organizationId, workOrder.id],
    });
    statements.push(...revokeServiceAuthorizationTokens(
      input.organizationId,
      serviceAuthorizationIssuanceIds,
      now,
    ));
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND work_order_id = ? AND status NOT IN (?, ?, ?, ?)",
      params: [input.status === "closed" ? "completed" : "cancelled", input.organizationId, workOrder.id, "cancelled", "declined", "completed", "superseded"],
    });
    for (const estimateRequest of estimateRequestsToRetire) {
      const nextEstimateStatus = estimateRequest.status === "selected" ? "not_selected" : "withdrawn";
      statements.push(
        {
          sql: "UPDATE ops_work_order_estimate_requests SET status = ?, decision_at = ? WHERE organization_id = ? AND id = ? AND status = ?",
          params: [nextEstimateStatus, now, input.organizationId, estimateRequest.id, estimateRequest.status],
        },
        {
          sql: "UPDATE ops_public_tokens SET revoked_at = ? WHERE organization_id = ? AND purpose = ? AND subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
          params: [now, input.organizationId, "vendor_estimate", "work_order_estimate_request", estimateRequest.id],
        },
        ...auditAndOutbox({
          organizationId: input.organizationId,
          aggregateType: "work_order_estimate_request",
          aggregateId: estimateRequest.id,
          eventType: "work_order_estimate.retired_with_work_order",
          actor: input.actor,
          occurredAt: now,
          payload: {
            workOrderId: workOrder.id,
            previousStatus: estimateRequest.status,
            status: nextEstimateStatus,
            terminalWorkOrderStatus: input.status,
          },
          ids,
        }),
      );
    }
  }
  statements.push(...auditAndOutbox({
    organizationId: input.organizationId,
    aggregateType: "work_order",
    aggregateId: workOrder.id,
    eventType,
    actor: input.actor,
    occurredAt: now,
    payload: {
      note,
      previous: {
        status: workOrder.status,
        priority: workOrder.priority,
        accountableParty: workOrder.accountableParty,
        nextAction: workOrder.nextAction,
        dueAt: workOrder.dueAt,
        escalationTo: workOrder.escalationTo,
      },
      current: { status: input.status, priority, accountableParty, nextAction, dueAt, escalationTo },
    },
    ids,
  }));
  await atomicWorkOrderMutation({
    repository,
    workOrder,
    now,
    statements,
  });
  return { ...workOrder, status: input.status, priority, accountableParty, nextAction, dueAt: dueAt ?? undefined, escalationTo: escalationTo ?? undefined, closedAt: closedAt ?? undefined, updatedAt: now };
}

export interface RescheduleFollowUpInput {
  organizationId: OpsId;
  followUpId: OpsId;
  accountableParty: string;
  nextAction: string;
  dueAt: IsoDateTime;
  escalationTo: string;
  note: string;
  actor: ActorContext;
}

export async function rescheduleFollowUp(svc: OpsCommandServices, input: RescheduleFollowUpInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const followUp = await repository.getFollowUp(input.organizationId, input.followUpId);
  if (!followUp) throw new OpsDomainError("NOT_FOUND", "Follow-up not found");
  if (followUp.status !== "open") throw new OpsDomainError("CONFLICT", "Only an open follow-up can be updated");
  const workOrder = await repository.getWorkOrder(input.organizationId, followUp.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Linked work order not found");
  if (workOrder.status === "resolved" || terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Resolved, closed, or cancelled work cannot receive a follow-up update");
  if (!Number.isFinite(Date.parse(input.dueAt))) throw new OpsDomainError("VALIDATION", "Follow-up due date is invalid");
  const accountableParty = required(input.accountableParty, "Accountable party");
  const nextAction = required(input.nextAction, "Next action");
  const escalationTo = required(input.escalationTo, "Escalation destination");
  const note = required(input.note, "Update note");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const sourceTask = tasks.find((task) => task.sourceFollowUpId === followUp.id && ["open", "in_progress"].includes(task.status));
  const updatedTask = sourceTask ? {
    ...sourceTask,
    title: nextAction,
    assigneeName: accountableParty,
    dueAt: input.dueAt,
    noSlaReason: undefined,
    escalationDestination: escalationTo,
  } satisfies WorkflowTask : undefined;
  const taskStatements: OpsStatement[] = sourceTask && updatedTask
    ? [
        workflowTaskUpdateStatement({ organizationId: input.organizationId, workflowTaskId: sourceTask.id, patch: {
          title: nextAction, assigneeName: accountableParty, dueAt: input.dueAt,
          escalationDestination: escalationTo, completionCriteria: `Record resolution of the required follow-up: ${nextAction}`,
        } }),
        buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, tasks.map((task) => task.id === sourceTask.id ? updatedTask : task)),
      ]
    : (() => {
        const task = buildWorkflowTaskRecord({
          id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
          draft: taskDraft({ workOrder, taskType: "schedule_return_visit", title: nextAction,
            assignee: facilitiesAssignee(accountableParty), dueAt: input.dueAt, applicableSlaClock: "scheduling",
            sourceFollowUpId: followUp.id, escalationDestination: escalationTo }),
          actor: input.actor, createdAt: now,
        });
        return [
          ...buildCreateTaskStatements({ task, actor: input.actor, ids }),
          buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...tasks, task]),
        ];
      })();
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    { sql: "UPDATE ops_follow_ups SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [accountableParty, nextAction, input.dueAt, escalationTo, input.organizationId, followUp.id, "open"] },
    { sql: "UPDATE ops_work_orders SET accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [accountableParty, nextAction, input.dueAt, escalationTo, input.organizationId, followUp.workOrderId] },
    ...taskStatements,
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: followUp.workOrderId, eventType: "follow_up.updated", actor: input.actor, occurredAt: now, payload: { followUpId: followUp.id, note, previous: { accountableParty: followUp.accountableParty, nextAction: followUp.nextAction, dueAt: followUp.dueAt, escalationTo: followUp.escalationTo }, current: { accountableParty, nextAction, dueAt: input.dueAt, escalationTo } }, ids }),
  ] });
  return { ...followUp, accountableParty, nextAction, dueAt: input.dueAt, escalationTo, updatedAt: now };
}

export interface CompleteFollowUpInput {
  organizationId: OpsId;
  followUpId: OpsId;
  resolution: string;
  actor: ActorContext;
}

export async function completeFollowUp(svc: OpsCommandServices, input: CompleteFollowUpInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const followUp = await repository.getFollowUp(input.organizationId, input.followUpId);
  if (!followUp) throw new OpsDomainError("NOT_FOUND", "Follow-up not found");
  if (followUp.status !== "open") throw new OpsDomainError("CONFLICT", "Follow-up is already complete or cancelled");
  const workOrder = await repository.getWorkOrder(input.organizationId, followUp.workOrderId);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Linked work order not found");
  if (workOrder.status === "resolved" || terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "Resolved, closed, or cancelled work cannot receive a follow-up completion");
  const resolution = required(input.resolution, "Completion note");
  const [detail, visitWorkOrders] = await Promise.all([
    repository.getWorkOrderDetail({ organizationId: input.organizationId }, workOrder.id),
    repository.listSiteVisitWorkOrdersForWorkOrder(input.organizationId, workOrder.id),
  ]);
  const remaining = (detail?.followUps ?? [])
    .filter((candidate) => candidate.id !== followUp.id && candidate.status === "open")
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const next = remaining[0];
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const sourceTask = tasks.find((task) => task.sourceFollowUpId === followUp.id && ["open", "in_progress"].includes(task.status));
  const sourceOutcome = visitWorkOrders.find((candidate) => candidate.followUpId === followUp.id);
  const unresolvedSourceOutcome = Boolean(
    sourceOutcome?.outcome && siteVisitOutcomeRequiresFollowUp(sourceOutcome.outcome),
  );
  const activeVisit = Boolean(detail?.visits.some((visit) => visit.status === "active"));
  const returnTaskTitle = "Complete return service and record a new onsite outcome";
  const returnTaskDueAt = nextTaskDueAt(followUp.dueAt, now, 24);
  const nextProjection = next
    ? { status: workOrder.status, accountableParty: next.accountableParty, nextAction: next.nextAction, dueAt: next.dueAt, escalationTo: workOrder.escalationTo ?? "Facilities director" }
    : activeVisit
      ? { status: "in_progress" as const, accountableParty: workOrder.accountableParty, nextAction: "Record service outcome", dueAt: workOrder.dueAt ?? addHours(now, 8), escalationTo: workOrder.escalationTo ?? "Facilities director" }
      : unresolvedSourceOutcome
        ? { status: "waiting_on_vendor" as const, accountableParty: "Facilities coordinator", nextAction: returnTaskTitle, dueAt: returnTaskDueAt, escalationTo: followUp.escalationTo }
        : { status: "completed_pending_review" as const, accountableParty: "Facilities coordinator", nextAction: "Verify current service outcome", dueAt: addHours(now, 24), escalationTo: "Facilities director" };
  const resolvedTasks = tasks.map((task): WorkflowTask => task.id === sourceTask?.id
    ? { ...task, status: "completed", completedByActorType: input.actor.actorType,
        completedByActorId: input.actor.actorId, completedByActorName: input.actor.actorName,
        completedAt: now, resolutionNote: resolution }
    : task);
  const replacementTask = next || activeVisit ? undefined : buildWorkflowTaskRecord({
    id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
    draft: unresolvedSourceOutcome
      ? taskDraft({ workOrder, taskType: "schedule_return_visit", title: returnTaskTitle,
          assignee: facilitiesAssignee(), dueAt: returnTaskDueAt, applicableSlaClock: "scheduling",
          escalationDestination: followUp.escalationTo,
          completionCriteria: "Observe a new onsite return visit and record its per-work-order outcome" })
      : taskDraft({ workOrder, taskType: "verify_repair", title: "Verify current service outcome",
          assignee: facilitiesAssignee(), dueAt: addHours(now, 24), applicableSlaClock: "verification",
          escalationDestination: "Facilities director",
          completionCriteria: "Record store or facilities verification before resolving the work order" }),
    actor: input.actor, createdAt: now,
  });
  await atomicWorkOrderMutation({ repository, workOrder, now, statements: [
    { sql: "UPDATE ops_follow_ups SET status = ?, completed_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["completed", now, input.organizationId, followUp.id, "open"] },
    { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [nextProjection.status, nextProjection.accountableParty, nextProjection.nextAction, nextProjection.dueAt, nextProjection.escalationTo, input.organizationId, workOrder.id] },
    ...(sourceTask ? buildCompleteWorkflowTaskStatements({ task: sourceTask, actor: input.actor, occurredAt: now, ids, resolutionNote: resolution }) : []),
    ...(replacementTask ? buildCreateTaskStatements({ task: replacementTask, actor: input.actor, ids }) : []),
    buildWorkflowTaskProjectionStatement(input.organizationId, workOrder.id, [...resolvedTasks, ...(replacementTask ? [replacementTask] : [])]),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "follow_up.completed", actor: input.actor, occurredAt: now, payload: { followUpId: followUp.id, sourceSiteVisitWorkOrderId: sourceOutcome?.id, unresolvedSourceOutcome, resolution, remainingOpenFollowUps: remaining.length, nextProjection }, ids }),
  ] });
  return { ...followUp, status: "completed" as const, completedAt: now, resolution, nextProjection };
}

export interface ReviewExceptionInput {
  organizationId: OpsId;
  exceptionId: OpsId;
  decision: "acknowledge" | "resolve";
  note: string;
  actor: ActorContext;
}

export async function reviewException(svc: OpsCommandServices, input: ReviewExceptionInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const exception = await repository.getException(input.organizationId, input.exceptionId);
  if (!exception) throw new OpsDomainError("NOT_FOUND", "Review item not found");
  if (exception.status === "resolved") throw new OpsDomainError("CONFLICT", "This review item is already resolved");
  const note = required(input.note, "Review note");
  const now = clock.now();
  const status = input.decision === "resolve" ? "resolved" : "acknowledged";
  await repository.atomicWrite([
    { sql: "UPDATE ops_exceptions SET status = ?, resolved_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: [status, status === "resolved" ? now : null, input.organizationId, exception.id, exception.status] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "exception", aggregateId: exception.id, eventType: status === "resolved" ? "exception.resolved" : "exception.acknowledged", actor: input.actor, occurredAt: now, payload: { note, kind: exception.kind, storeId: exception.storeId, workOrderId: exception.workOrderId, visitId: exception.visitId }, ids }),
  ]);
  return { ...exception, status, resolvedAt: status === "resolved" ? now : undefined, note };
}

export interface ReconcileUnmatchedVisitInput {
  organizationId: OpsId;
  exceptionId: OpsId;
  workOrderId: OpsId;
  note: string;
  actor: ActorContext;
}

export async function reconcileUnmatchedVisit(svc: OpsCommandServices, input: ReconcileUnmatchedVisitInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const exception = await repository.getException(input.organizationId, input.exceptionId);
  if (!exception || exception.kind !== "no_work_order" || !exception.visitId) throw new OpsDomainError("NOT_FOUND", "Unmatched visit review item not found");
  if (exception.status === "resolved") throw new OpsDomainError("CONFLICT", "This unmatched visit is already resolved");
  const visit = await repository.getVisit(input.organizationId, exception.visitId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!visit || !workOrder || visit.storeId !== workOrder.storeId) throw new OpsDomainError("VALIDATION", "Choose open work for the same store as this visit");
  const existingLinks = await repository.listSiteVisitWorkOrders(input.organizationId, visit.id);
  if (visit.workOrderId || existingLinks.length) throw new OpsDomainError("CONFLICT", "This visit is already linked to a work order");
  if (workOrder.status === "resolved" || terminalWorkOrderStatuses.has(workOrder.status)) throw new OpsDomainError("CONFLICT", "A visit cannot be linked to resolved, closed, or cancelled work");
  const assignment = await repository.getActiveAssignment(input.organizationId, workOrder.id);
  if (visit.vendorId && (!assignment || assignment.kind !== "outside_vendor" || assignment.vendorId !== visit.vendorId)
    || visit.internalMembershipId && (!assignment || assignment.kind !== "internal" || assignment.internalMembershipId !== visit.internalMembershipId)) {
    throw new OpsDomainError("CONFLICT", "The visit vendor does not match the active work-order assignment");
  }
  const note = required(input.note, "Reconciliation note");
  const now = clock.now();
  const tasks = await repository.listWorkflowTasksForWorkOrder(input.organizationId, workOrder.id);
  const siteVisitWorkOrderId = ids.next("site-visit-work");
  const linkedOutcome = visit.status === "active"
    ? undefined
    : visit.outcome
      ? siteVisitOutcomeFromLegacy(visit.outcome)
      : "not_addressed" as const;
  const statements: OpsStatement[] = [
    { sql: "UPDATE ops_visit_sessions SET work_order_id = ? WHERE organization_id = ? AND id = ? AND work_order_id IS NULL", params: [workOrder.id, input.organizationId, visit.id] },
    { sql: "UPDATE ops_exceptions SET status = ?, work_order_id = ?, resolved_at = ? WHERE organization_id = ? AND id = ?", params: ["resolved", workOrder.id, now, input.organizationId, exception.id] },
    insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: visit.id, kind: "amendment", channel: visit.endedChannel ?? visit.startedChannel, observed_at: now, payload_json: json({ amendment: "linked_to_work_order", workOrderId: workOrder.id, workOrderNumber: workOrder.number, originalUnmatchedReason: visit.unmatchedReason, note }) }),
  ];
  if (assignment && ["pending", "issued", "opened"].includes(assignment.status)) {
    statements.push({
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ? AND work_order_id = ? AND status IN (?, ?, ?)",
      params: ["accepted", input.organizationId, assignment.id, workOrder.id, "pending", "issued", "opened"],
    });
  }
  let followUpId: OpsId | undefined;
  let activeVisitTask: WorkflowTask | undefined;
  let followUpTask: WorkflowTask | undefined;
  let verificationTask: WorkflowTask | undefined;
  if (visit.status === "active") {
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: ["in_progress", visit.providerName, "Record service outcome", workOrder.dueAt ?? addHours(now, 8), workOrder.escalationTo ?? "Facilities director", input.organizationId, workOrder.id] });
    const visitAssignee = visit.vendorId
      ? { assigneeType: "vendor" as const, assigneeId: visit.vendorId, assigneeName: visit.providerName }
      : visit.internalMembershipId
        ? { assigneeType: "user" as const, assigneeId: visit.internalMembershipId, assigneeName: visit.providerName }
        : facilitiesAssignee(visit.providerName);
    activeVisitTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      draft: taskDraft({ workOrder, taskType: "record_service_outcome", title: "Record service outcome",
        assignee: visitAssignee, dueAt: nextTaskDueAt(workOrder.dueAt, now, 8), applicableSlaClock: "completion",
        initialStatus: "in_progress", escalationDestination: workOrder.escalationTo ?? "Facilities director",
        completionCriteria: "Record checkout evidence and one outcome for this observed visit" }),
      actor: input.actor, createdAt: now,
    });
  } else if (linkedOutcome && siteVisitOutcomeRequiresFollowUp(linkedOutcome)) {
    followUpId = ids.next("follow-up");
    const waitingStatus = linkedOutcome === "parts_required" ? "waiting_on_parts" : "waiting_on_vendor";
    const nextAction = linkedOutcome === "parts_required" ? "Confirm parts and return date" : visit.outcome ? "Coordinate required follow-up service" : "Record the missing service outcome";
    const dueAt = addHours(now, 48);
    statements.push(
      insert("ops_follow_ups", { id: followUpId, organization_id: input.organizationId, work_order_id: workOrder.id, source_visit_id: visit.id, accountable_party: "Facilities coordinator", next_action: nextAction, due_at: dueAt, escalation_to: "Facilities director", status: "open", created_at: now }),
      { sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: [waitingStatus, "Facilities coordinator", nextAction, dueAt, "Facilities director", input.organizationId, workOrder.id] },
    );
    followUpTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      draft: taskDraft({ workOrder, taskType: "schedule_return_visit", title: nextAction,
        assignee: facilitiesAssignee(), dueAt, applicableSlaClock: "scheduling", sourceFollowUpId: followUpId,
        escalationDestination: "Facilities director", completionCriteria: `Record resolution of the required follow-up: ${nextAction}` }),
      actor: input.actor, createdAt: now,
    });
  } else {
    const verificationDueAt = addHours(now, 24);
    statements.push({ sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?", params: ["completed_pending_review", "Facilities coordinator", "Verify current service outcome", verificationDueAt, "Facilities director", input.organizationId, workOrder.id] });
    verificationTask = buildWorkflowTaskRecord({
      id: ids.next("workflow-task"), organizationId: input.organizationId, workOrderId: workOrder.id,
      draft: taskDraft({ workOrder, taskType: "verify_repair", title: "Verify current service outcome",
        assignee: facilitiesAssignee(), dueAt: verificationDueAt, applicableSlaClock: "verification",
        escalationDestination: "Facilities director",
        completionCriteria: "Record an accepted or rejected internal decision against the exact reconciled visit outcome" }),
      actor: input.actor, createdAt: now,
    });
  }
  statements.push(insert("ops_site_visit_work_orders", {
    id: siteVisitWorkOrderId, organization_id: input.organizationId, visit_id: visit.id, work_order_id: workOrder.id,
    ordinal: 1, linked_by_actor_type: input.actor.actorType, linked_by_actor_id: input.actor.actorId,
    linked_by_actor_name: input.actor.actorName, linked_at: now, outcome: linkedOutcome,
    outcome_notes: visit.outcomeNotes, outcome_recorded_by_actor_type: linkedOutcome ? input.actor.actorType : undefined,
    outcome_recorded_by_actor_id: linkedOutcome ? input.actor.actorId : undefined,
    outcome_recorded_by_actor_name: linkedOutcome ? input.actor.actorName : undefined,
    outcome_recorded_at: linkedOutcome ? visit.checkedOutAt ?? now : undefined, follow_up_id: followUpId,
  }));
  const reconciliationTask = activeVisitTask ?? followUpTask ?? verificationTask;
  if (reconciliationTask) statements.push(...buildReplaceMatchingTaskStatements({
    workOrder, tasks, targetTask: selectPrimaryWorkflowTask(tasks), replacementTask: reconciliationTask,
    actor: input.actor, occurredAt: now, ids,
    resolutionNote: activeVisitTask
      ? "Observed onsite visit linked to the after-the-fact work order"
      : followUpTask
        ? "Checked-out visit reconciled with an accountable follow-up"
        : "Checked-out visit reconciled to a completed service outcome",
  }));
  statements.push(
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.reconciled", actor: input.actor, occurredAt: now, payload: { exceptionId: exception.id, siteVisitWorkOrderId, workOrderId: workOrder.id, workOrderNumber: workOrder.number, linkedOutcome, note, followUpId, authorizationTiming: "recorded_after_service_began" }, ids }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.visit_reconciled", actor: input.actor, occurredAt: now, payload: { exceptionId: exception.id, siteVisitWorkOrderId, visitId: visit.id, linkedOutcome, note, followUpId, authorizationTiming: "recorded_after_service_began" }, ids }),
  );
  await atomicWorkOrderMutation({ repository, workOrder, now, statements });
  return { visitId: visit.id, siteVisitWorkOrderId, exceptionId: exception.id, workOrderId: workOrder.id, workOrderNumber: workOrder.number, followUpId, reconciledAt: now };
}

export interface AttachPublicEvidenceInput {
  organizationId: OpsId;
  entityType: "request" | "work_order" | "visit";
  entityId: OpsId;
  storageKey: string;
  sha256: string;
  originalName: string;
  contentType: string;
  byteLength: number;
  purpose: "photo" | "service_document" | "other";
  visibility?: "internal" | "vendor_shared" | "public_receipt";
  channel?: VisitChannel;
  actor: ActorContext;
}

export async function attachPublicEvidence(svc: OpsCommandServices, input: AttachPublicEvidenceInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const entity = input.entityType === "request"
    ? await repository.getRequest(input.organizationId, input.entityId)
    : input.entityType === "work_order"
      ? await repository.getWorkOrder(input.organizationId, input.entityId)
      : await repository.getVisit(input.organizationId, input.entityId);
  if (!entity) throw new OpsDomainError("NOT_FOUND", "Evidence target not found in organization");
  if (!Number.isInteger(input.byteLength) || input.byteLength < 1) throw new OpsDomainError("VALIDATION", "File size must be a positive integer");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new OpsDomainError("VALIDATION", "File SHA-256 is invalid");
  const now = clock.now();
  const fileId = ids.next("file");
  const linkId = ids.next("file-link");
  const statements: OpsStatement[] = [
    insert("ops_files", { id: fileId, organization_id: input.organizationId, storage_key: required(input.storageKey, "Storage key"), sha256: input.sha256.toLowerCase(), original_name: required(input.originalName, "Original file name"), content_type: required(input.contentType, "Content type"), byte_length: input.byteLength, status: "available", created_at: now }),
    insert("ops_entity_files", { id: linkId, organization_id: input.organizationId, file_id: fileId, entity_type: input.entityType, entity_id: input.entityId, purpose: input.purpose, visibility: input.visibility ?? "vendor_shared", created_at: now }),
  ];
  if (input.entityType === "visit") statements.push(insert("ops_visit_evidence", { id: ids.next("evidence"), organization_id: input.organizationId, visit_id: input.entityId, kind: input.purpose === "photo" ? "photo" : "file", channel: input.channel ?? "secure_link", observed_at: now, payload_json: json({ fileId, linkId, purpose: input.purpose }) }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: input.entityType, aggregateId: input.entityId, eventType: "evidence.attached", actor: input.actor, occurredAt: now, payload: { fileId, linkId, purpose: input.purpose, contentType: input.contentType, byteLength: input.byteLength }, ids }));
  await repository.atomicWrite(statements);
  return { fileId, linkId, organizationId: input.organizationId, entityType: input.entityType, entityId: input.entityId, createdAt: now };
}

export interface IssueVisitCheckoutTokenInput {
  organizationId: OpsId;
  visitId: OpsId;
  tokenHash: string;
  expiresAt: IsoDateTime;
  actor: ActorContext;
}

export async function issueVisitCheckoutToken(svc: OpsCommandServices, input: IssueVisitCheckoutTokenInput) {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const visit = await repository.getVisit(input.organizationId, input.visitId);
  if (!visit || visit.status !== "active") throw new OpsDomainError("NOT_FOUND", "Active visit not found");
  if (!/^[a-f0-9]{64}$/i.test(input.tokenHash)) throw new OpsDomainError("VALIDATION", "Token SHA-256 is invalid");
  const now = clock.now();
  if (input.expiresAt <= now) throw new OpsDomainError("VALIDATION", "Checkout token expiry must be in the future");
  const tokenId = ids.next("public-token");
  await repository.atomicWrite([
    insert("ops_public_tokens", { id: tokenId, organization_id: input.organizationId, purpose: "active_visit", subject_type: "visit", subject_id: visit.id, token_hash: input.tokenHash.toLowerCase(), expires_at: input.expiresAt, created_at: now }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checkout_token_issued", actor: input.actor, occurredAt: now, payload: { tokenId, expiresAt: input.expiresAt }, ids }),
  ]);
  return { tokenId, organizationId: input.organizationId, visitId: visit.id, expiresAt: input.expiresAt };
}
