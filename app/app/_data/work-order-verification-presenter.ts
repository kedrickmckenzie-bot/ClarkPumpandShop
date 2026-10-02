import "server-only";
import { sessionHasNoStores } from "@/components/ops/role-policy";

import type { OperatorRole, OperatorSession, Tone } from "@/components/ops/data-contract";
import type {
  OpsFixture,
  SiteVisitWorkOrderOutcome,
  WorkOrder,
} from "@/lib/ops/types";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadOperatorSession } from "./operator-loader";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDateTime } from "@/lib/ops/local-time";
import { applicableOutcomeVerification, latestRecordedWorkOutcome } from "@/lib/ops/work-order-outcome";
import { roleCan } from "@/components/ops/role-policy";

export interface WorkOrderVerificationViewModel {
  outcomeCorrections?: Array<{id:string;original:string;corrected:string;reason:string;by:string;when:string}>;
  confirmationSetting?: string;
  canCorrect?: boolean;
  correcting?: boolean;
  available: boolean;
  permitted: boolean;
  permissionMessage: string;
  action: string;
  workOrderId: string;
  workOrderNumber: string;
  workOrderStatus: string;
  originalProblem?: string;
  canUseTechnicalBasis: boolean;
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
    decision: "verified" | "rejected" | "inconclusive";
    decisionLabel: string;
    tone: Tone;
    outcomeLabel: string;
    decidedByLabel: string;
    decidedLabel: string;
    reason?: string;
    basisLabel: string;
    scopeLabel: string;
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
  technician: "internal_technician",
};
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
  if (session.storeIds !== undefined && !session.storeIds.includes(workOrder.storeId)) return false;
  const store = fixture.stores.find((candidate) => (
    candidate.organizationId === session.organizationId && candidate.id === workOrder.storeId
  ));
  if (!store) return false;
  if (session.regionIds !== undefined && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
  if (sessionHasNoStores(session)) return false;
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
    originalProblem: workOrder?.problem,
    canUseTechnicalBasis: session.role === "facilities" || session.role === "regional",
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
  const permitted = roleCan(session, "confirm_observable_result") && Boolean(membership);
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
  const canRecord = Boolean(
    permitted
    && ["completed_pending_review", "closed", "resolved", "in_progress"].includes(workOrder.status)
    && currentOutcome?.outcome
    && reviewableOutcomes.has(currentOutcome.outcome),
  );
  const canDecide = canRecord && !currentDecision;
  const decisionBlockReason = !permitted
    ? "You can view the result, but your role cannot record confirmation."
    : currentDecision
      ? undefined
      : "The repair can be confirmed once the service result is recorded.";

  return {
    ...base,
    outcomeCorrections: fixture.auditEvents.filter(e => e.organizationId === session.organizationId && e.aggregateId === workOrder.id && e.eventType === "work_order.service_result_corrected").flatMap(e => {
      try { const payload=JSON.parse(e.payloadJson) as {previous:{outcome:SiteVisitWorkOrderOutcome;outcomeNotes?:string};correctedOutcome:SiteVisitWorkOrderOutcome;reason:string}; return [{id:e.id,original:`${outcomeLabels[payload.previous.outcome]}${payload.previous.outcomeNotes ? ` — ${payload.previous.outcomeNotes}` : ""}`,corrected:outcomeLabels[payload.correctedOutcome],reason:payload.reason,by:e.actorName,when:dateTime(e.occurredAt,storeTimeZone)}]; } catch { return []; }
    }),
    confirmationSetting: workOrder.requireConfirmation === false ? "Confirmation is optional for this job." : "Confirmation is required for this job.",
    canCorrect: canRecord && Boolean(currentDecision),
    correcting: Boolean(currentDecision),
    permitted,
    permissionMessage: permitted
      ? "Confirm only what you can observe about the reported problem. Provider evidence remains separate."
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
          technicianLabel: currentOutcome.outcomeRecordedByActorType === "user"
            ? `Corrected by ${currentOutcome.outcomeRecordedByActorName ?? "management"}${visit ? ` · Visit: ${visit.providerName}` : ""}`
            : visit
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
        decisionLabel: verification.decision === "verified" ? "Completed as expected" : verification.decision === "rejected" ? "Needs follow-up" : "Not sure",
        tone: verification.decision === "verified" ? "positive" : verification.decision === "rejected" ? "critical" : "warning",
        outcomeLabel: outcomeLabels[verification.outcome],
        decidedByLabel: verification.decidedByName,
        decidedLabel: dateTime(verification.decidedAt, storeTimeZone),
        reason: verification.reason,
        basisLabel: verification.basis === "technical_evidence" ? "Technical evidence" : verification.basis === "operational_review" ? "Operations review" : "Observable result",
        scopeLabel: verification.verificationScope === "pm_task" ? "PM task" : verification.verificationScope === "technical_work" ? "Technical work" : "Reported problem",
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
        current: verification.id === currentDecision?.id,
      })),
  };
}

export async function loadWorkOrderVerificationModel(workOrderId: string) {
  const session = await loadOperatorSession();
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  return buildWorkOrderVerificationModel(fixture, session, workOrderId);
}
