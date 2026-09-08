import "server-only";

import type { OperatorRole, OperatorSession, Tone } from "@/components/ops/data-contract";
import type {
  OpsFixture,
  SiteVisitWorkOrderOutcome,
  WorkOrder,
  WorkflowTask,
} from "@/lib/ops/types";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDateTime } from "@/lib/ops/local-time";
import { applicableOutcomeVerification, latestRecordedWorkOutcome } from "@/lib/ops/work-order-outcome";

export interface WorkOrderVerificationViewModel {
  available: boolean;
  permitted: boolean;
  permissionMessage: string;
  action: string;
  workOrderId: string;
  workOrderNumber: string;
  workOrderStatus: string;
  resolvedLabel?: string;
  currentOutcome?: {
    siteVisitWorkOrderId: string;
    outcome: SiteVisitWorkOrderOutcome;
    outcomeLabel: string;
    notes?: string;
    recordedAt: string;
    recordedLabel: string;
    visitId: string;
    technicianLabel: string;
    canConfirmAvoidedSeparateTrip: boolean;
  };
  canDecide: boolean;
  decisionBlockReason?: string;
  expectedWorkOrderVersion: number;
  expectedSiteVisitWorkOrderId?: string;
  expectedOutcomeRecordedAt?: string;
  history: Array<{
    id: string;
    cycle: number;
    decision: "verified" | "rejected";
    decisionLabel: string;
    tone: Tone;
    outcomeLabel: string;
    decidedByLabel: string;
    decidedLabel: string;
    reason?: string;
    avoidedSeparateTripConfirmed: boolean;
    current: boolean;
  }>;
}

const domainRoleByOperatorRole: Record<OperatorRole, string> = {
  executive: "executive",
  facilities: "facilities_admin",
  regional: "regional_manager",
  store_manager: "store_manager",
  finance: "finance_reviewer",
};
const permittedRoles = new Set<OperatorRole>(["facilities", "regional", "store_manager"]);
const reviewableOutcomes = new Set<SiteVisitWorkOrderOutcome>(["completed", "no_issue_found"]);
const outcomeLabels: Record<SiteVisitWorkOrderOutcome, string> = {
  completed: "Work completed",
  temporary_repair: "Temporary repair — follow-up needed",
  diagnosis_only: "Diagnosis only",
  quote_required: "Quote required",
  parts_required: "Parts required",
  return_visit_required: "Return visit required",
  no_issue_found: "No issue found",
  store_access_unavailable: "Store access unavailable",
  work_not_authorized: "Work not authorized",
  not_addressed: "Not addressed",
};

function dateTime(value: string, timeZone: string) {
  return formatOperationsDateTime(value, timeZone);
}

function storeInScope(fixture: OpsFixture, session: OperatorSession, workOrder: WorkOrder) {
  if (workOrder.organizationId !== session.organizationId) return false;
  if (session.storeIds?.length && !session.storeIds.includes(workOrder.storeId)) return false;
  const store = fixture.stores.find((candidate) => (
    candidate.organizationId === session.organizationId && candidate.id === workOrder.storeId
  ));
  if (!store) return false;
  if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
  if (session.role === "store_manager" && !session.storeIds?.length) return false;
  if (session.role === "regional" && !session.regionIds?.length) return false;
  return true;
}

function verificationRows(fixture: OpsFixture, organizationId: string, workOrderId: string) {
  return fixture.workOrderVerifications
    .filter((record) => (
      record.organizationId === organizationId && record.workOrderId === workOrderId
    ));
}

function resolvedAt(workOrder: WorkOrder) {
  return workOrder.resolvedAt;
}

export function buildWorkOrderVerificationModel(
  fixture: OpsFixture,
  session: OperatorSession,
  workOrderId: string,
): WorkOrderVerificationViewModel {
  const workOrder = fixture.workOrders.find((candidate) => (
    candidate.organizationId === session.organizationId
    && candidate.id === workOrderId
    && storeInScope(fixture, session, candidate)
  ));
  const base = {
    available: Boolean(workOrder),
    action: `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/verification`,
    workOrderId,
    workOrderNumber: workOrder?.number ?? workOrderId,
    workOrderStatus: workOrder?.status ?? "unavailable",
    expectedWorkOrderVersion: workOrder ? persistedWorkOrderVersion(workOrder) : 0,
  };
  if (!workOrder) {
    return {
      ...base,
      permitted: false,
      permissionMessage: "This work order is unavailable or outside your operating scope.",
      canDecide: false,
      decisionBlockReason: "Verification evidence is unavailable.",
      history: [],
    };
  }
  const store = fixture.stores.find((candidate) => candidate.organizationId === session.organizationId && candidate.id === workOrder.storeId);
  const storeTimeZone = store?.timeZone
    ?? fixture.organizations.find((organization) => organization.id === session.organizationId)?.timeZone
    ?? DEFAULT_OPERATIONS_TIME_ZONE;

  const membership = session.membershipId
    ? fixture.memberships.find((candidate) => (
        candidate.organizationId === session.organizationId
        && candidate.id === session.membershipId
        && candidate.status === "active"
        && candidate.role === domainRoleByOperatorRole[session.role]
      ))
    : undefined;
  const permitted = permittedRoles.has(session.role) && Boolean(membership);
  const outcomes = fixture.siteVisitWorkOrders.filter((record) => (
    record.organizationId === session.organizationId && record.workOrderId === workOrder.id
  ));
  const currentOutcome = latestRecordedWorkOutcome(outcomes);
  const visit = currentOutcome
    ? fixture.visits.find((candidate) => (
        candidate.organizationId === session.organizationId && candidate.id === currentOutcome.visitId
      ))
    : undefined;
  const verifications = verificationRows(fixture, session.organizationId, workOrder.id);
  const currentDecision = applicableOutcomeVerification(verifications, currentOutcome);
  const visitWork = currentOutcome
    ? fixture.siteVisitWorkOrders.filter((record) => record.organizationId === session.organizationId && record.visitId === currentOutcome.visitId)
    : [];
  const currentOutcomeCanConfirmAvoidedSeparateTrip = currentOutcome?.selectionSource === "held_work" && (
    fixture.routeStops.some((stop) => stop.organizationId === session.organizationId && stop.siteVisitId === currentOutcome.visitId)
    || visitWork.some((record) => record.selectionSource === "assigned_work" || record.selectionSource === "service_run")
  );
  const activeVerifyTask = fixture.workflowTasks.some((task: WorkflowTask) => (
    task.organizationId === session.organizationId
    && task.workOrderId === workOrder.id
    && task.taskType === "verify_repair"
    && (task.status === "open" || task.status === "in_progress")
  ));
  const canDecide = Boolean(
    permitted
    && workOrder.status === "completed_pending_review"
    && currentOutcome?.outcome
    && reviewableOutcomes.has(currentOutcome.outcome)
    && !currentDecision
    && activeVerifyTask,
  );
  const decisionBlockReason = canDecide
    ? undefined
    : !permitted
      ? "An active facilities, regional, or scoped store-manager membership must record verification."
      : (workOrder.status as string) === "resolved"
        ? "The current outcome is verified and resolved. Facilities can close it after the remaining closure checks pass."
        : currentDecision?.decision === "rejected"
          ? "This outcome was rejected. A new observed visit and outcome are required before another verification."
          : currentDecision?.decision === "verified"
            ? "This outcome already has an accepted immutable verification decision."
            : workOrder.status !== "completed_pending_review"
              ? "Verification becomes available after checkout records a completed result for this work order."
              : !activeVerifyTask
                ? "The required repair-verification task is missing or already complete."
                : "The current outcome requires provider follow-up rather than internal verification.";

  return {
    ...base,
    permitted,
    permissionMessage: permitted
      ? "You can verify or reject the current per-work-order outcome."
      : "This role can review verification history but cannot record a decision.",
    resolvedLabel: resolvedAt(workOrder) ? dateTime(resolvedAt(workOrder)!, storeTimeZone) : undefined,
    currentOutcome: currentOutcome?.outcome && currentOutcome.outcomeRecordedAt
      ? {
          siteVisitWorkOrderId: currentOutcome.id,
          outcome: currentOutcome.outcome,
          outcomeLabel: outcomeLabels[currentOutcome.outcome],
          notes: currentOutcome.outcomeNotes,
          recordedAt: currentOutcome.outcomeRecordedAt,
          recordedLabel: dateTime(currentOutcome.outcomeRecordedAt, storeTimeZone),
          visitId: currentOutcome.visitId,
          technicianLabel: visit
            ? `${visit.technicianName} · ${visit.providerName}`
            : "Linked technician visit",
          canConfirmAvoidedSeparateTrip: currentOutcomeCanConfirmAvoidedSeparateTrip,
        }
      : undefined,
    canDecide,
    decisionBlockReason,
    expectedSiteVisitWorkOrderId: currentOutcome?.id,
    expectedOutcomeRecordedAt: currentOutcome?.outcomeRecordedAt,
    history: [...verifications]
      .sort((left, right) => right.cycle - left.cycle || right.decidedAt.localeCompare(left.decidedAt))
      .map((verification) => ({
        id: verification.id,
        cycle: verification.cycle,
        decision: verification.decision,
        decisionLabel: verification.decision === "verified" ? "Verified" : "Rejected",
        tone: verification.decision === "verified" ? "positive" : "critical",
        outcomeLabel: outcomeLabels[verification.outcome],
        decidedByLabel: verification.decidedByName,
        decidedLabel: dateTime(verification.decidedAt, storeTimeZone),
        reason: verification.reason,
        avoidedSeparateTripConfirmed: fixture.auditEvents.some((event) => {
          if (event.organizationId !== session.organizationId
            || event.aggregateId !== workOrder.id
            || event.eventType !== "work_order.held_work_avoided_trip_verified") return false;
          try {
            return (JSON.parse(event.payloadJson) as { verificationId?: string }).verificationId === verification.id;
          } catch {
            return false;
          }
        }),
        current: verification.siteVisitWorkOrderId === currentOutcome?.id,
      })),
  };
}

export async function loadWorkOrderVerificationModel(workOrderId: string) {
  const [fixture, session] = await Promise.all([
    getServerOpsFixtureSnapshot(),
    loadOperatorSession(),
  ]);
  return buildWorkOrderVerificationModel(fixture, session, workOrderId);
}
