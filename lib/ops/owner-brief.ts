import type { LifecycleRecommendation, OpsFixture } from "./types";

/**
 * The Monday Morning Owner Brief: one plain-language executive digest computed
 * entirely from source records. Every decision item carries a drill-through
 * reference so the owner can verify the evidence in one click, and every
 * principal metric names the exact records behind it.
 *
 * Money rules:
 * - "Invoice review amount" counts each distinct invoice with at least one
 *   OPEN review flag exactly once at its full invoice total. One invoice can
 *   carry several flags (authorization, warranty hold, duplicate suspicion);
 *   its dollars are never summed once per flag.
 * - Any other identified exposure is reported separately and never merged
 *   into the invoice figure.
 * - Identified exposure and estimated opportunity are never presented as
 *   realized value.
 */

export type OwnerBriefDecisionKind =
  | "capital_review"
  | "replacement_review"
  | "approval"
  | "escalated_task";

export interface OwnerBriefDecision {
  kind: OwnerBriefDecisionKind;
  id: string;
  /** For lifecycle items: the derived outstanding-decision state in plain language. */
  state?: string;
  label: string;
  detail: string;
  drillThrough: { type: "asset" | "workflow_task" | "work_order"; id: string };
}

export interface OwnerBriefStoreLine {
  storeId: string;
  storeNumber: string;
  storeName: string;
  workOrdersOpenedInPeriod: number;
  recordedSpendMinor: number;
}

export interface OwnerBriefPmObligations {
  completedOnTimeOrEarly: number;
  completedLate: number;
  missed: number;
  finishedWithoutTimingRecord: number;
  openInWindow: number;
  waived: number;
  notYetScheduled: number;
}

export interface OwnerBrief {
  generatedAt: string;
  periodStartsAt: string;
  periodEndsAt: string;
  headline: {
    openedWorkOrders: number;
    activeWorkOrders: number;
    escalationsActive: number;
    decisionsNeededCount: number;
  };
  drillThrough: {
    recordedSpendHref: string;
    invoiceReviewHref: string;
    pmComplianceHref: string;
    activeWorkOrdersHref: string;
    escalationsHref: string;
  };
  money: {
    currency: string;
    recordedSpendMinor: number;
    /** Distinct invoices with open review flags, each counted once at invoice total. */
    invoiceReviewAmountMinor: number;
    invoiceReviewCount: number;
    otherIdentifiedExposureMinor: number;
    realizedVerifiedMinor: number;
    estimatedOpportunityMinor: number;
  };
  pmCompliance: {
    numerator: number;
    denominator: number;
    method: string;
    obligations: OwnerBriefPmObligations;
  };
  decisionsNeeded: OwnerBriefDecision[];
  lifecycleOutstandingCount: number;
  workOrderDefinition: string;
  storeLines: OwnerBriefStoreLine[];
}

const COMPLIANT_PM_STATUSES = new Set(["completed_early", "completed_on_time"]);
const OPEN_TASK_STATUSES = new Set(["open", "in_progress"]);
const ACTIVE_WORK_ORDER_EXCLUSIONS = new Set(["resolved", "closed", "cancelled"]);

/**
 * Derives the plain-language outstanding-decision state for the latest
 * recommendation on an asset. Persisted recommendations always carry a recorded
 * user decision, so "awaiting a decision" is a derived state, never an absence
 * of one. Returns null when the recommendation needs nothing further from the
 * owner (a recorded outcome closes it).
 */
export function lifecycleOutstandingState(
  recommendation: Pick<LifecycleRecommendation, "userDecision" | "userReason" | "actualOutcome">,
): string | null {
  if (recommendation.actualOutcome) return null;
  switch (recommendation.userDecision) {
    case "investigate":
      return recommendation.userReason.trim().length > 0 ? "Investigation underway" : "Review required";
    case "defer":
      return "Deferred — re-review not yet scheduled";
    case "repair":
      return "Repair approved — outcome pending";
    case "replace":
      return "Replacement approved — outcome pending";
    default:
      return null;
  }
}

export function buildOwnerBrief(
  fixture: Pick<OpsFixture, "stores" | "workOrders" | "costLines" | "valueEvents" | "invoices" | "invoiceExceptions" | "pmOccurrences" | "workflowTasks" | "lifecycleRecommendations" | "assets">,
  organizationId: string,
  period: { startsAt: string; endsAt: string },
): OwnerBrief {
  const orgStores = fixture.stores.filter((row) => row.organizationId === organizationId);
  const orgWorkOrders = fixture.workOrders.filter((row) => row.organizationId === organizationId);
  const costLines = fixture.costLines.filter((row) => row.organizationId === organizationId && row.serviceDate >= period.startsAt && row.serviceDate <= period.endsAt);
  const valueEvents = fixture.valueEvents.filter((row) => row.organizationId === organizationId && row.occurredAt >= period.startsAt && row.occurredAt <= period.endsAt);
  const currency = costLines[0]?.amount.currency ?? "USD";
  const spendByWorkOrder = new Map<string, number>();
  for (const line of costLines) spendByWorkOrder.set(line.workOrderId, (spendByWorkOrder.get(line.workOrderId) ?? 0) + line.amount.amountMinor);

  const openedInPeriod = (createdAt: string) => createdAt >= period.startsAt && createdAt <= period.endsAt;

  const storeLines = orgStores.map((store) => {
    const storeWorkOrderIds = new Set(orgWorkOrders.filter((row) => row.storeId === store.id).map((row) => row.id));
    return {
      storeId: store.id,
      storeNumber: store.storeNumber,
      storeName: store.name,
      workOrdersOpenedInPeriod: orgWorkOrders.filter((row) => row.storeId === store.id && openedInPeriod(row.createdAt)).length,
      recordedSpendMinor: [...spendByWorkOrder.entries()].filter(([workOrderId]) => storeWorkOrderIds.has(workOrderId)).reduce((sum, [, amountMinor]) => sum + amountMinor, 0),
    };
  }).sort((a, b) => b.recordedSpendMinor - a.recordedSpendMinor || b.workOrdersOpenedInPeriod - a.workOrdersOpenedInPeriod);

  const dueThisPeriod = fixture.pmOccurrences.filter((row) => row.organizationId === organizationId && row.dueAt >= period.startsAt && row.dueAt <= period.endsAt);
  const evaluatedPm = dueThisPeriod.filter((row) => !["upcoming", "unscheduled", "proposed", "scheduled", "due", "waived", "cancelled"].includes(String(row.status)));
  const pmCompliant = evaluatedPm.filter((row) => COMPLIANT_PM_STATUSES.has(String(row.status)));
  const countStatus = (...statuses: string[]) => dueThisPeriod.filter((row) => statuses.includes(String(row.status))).length;
  const obligations = {
    completedOnTimeOrEarly: pmCompliant.length,
    completedLate: countStatus("completed_late"),
    missed: countStatus("missed"),
    finishedWithoutTimingRecord: countStatus("completed"),
    openInWindow: countStatus("scheduled", "due"),
    waived: countStatus("waived"),
    notYetScheduled: countStatus("proposed", "upcoming", "unscheduled"),
  };

  // Exposure dedupe: one invoice carrying five open flags is still one
  // invoice's worth of money under review, counted once at its invoice total.
  // The review figure reflects what is currently open, independent of period.
  const openExceptionInvoiceIds = new Set(
    fixture.invoiceExceptions
      .filter((row) => row.organizationId === organizationId && row.status === "open")
      .map((row) => row.invoiceId),
  );
  const flaggedInvoices = fixture.invoices.filter((row) => row.organizationId === organizationId && openExceptionInvoiceIds.has(row.id));
  const invoiceReviewAmountMinor = flaggedInvoices.reduce((sum, row) => sum + row.total.amountMinor, 0);
  const otherIdentifiedExposureMinor = valueEvents
    .filter((row) => String(row.category) === "identified_exposure" && !String(row.eventType).startsWith("invoice_"))
    .reduce((sum, row) => sum + row.amount.amountMinor, 0);

  const openTasks = fixture.workflowTasks.filter((row) => row.organizationId === organizationId && OPEN_TASK_STATUSES.has(row.status));
  const escalatedTasks = openTasks.filter((row) => row.escalationLevel > 0).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const latestRecommendationPerAsset = new Map<string, LifecycleRecommendation>();
  for (const recommendation of fixture.lifecycleRecommendations.filter((row) => row.organizationId === organizationId)) {
    const current = latestRecommendationPerAsset.get(recommendation.assetId);
    if (!current || recommendation.version > current.version) latestRecommendationPerAsset.set(recommendation.assetId, recommendation);
  }

  const decisionsNeeded: OwnerBriefDecision[] = [];
  let lifecycleOutstandingCount = 0;
  for (const recommendation of latestRecommendationPerAsset.values()) {
    const state = lifecycleOutstandingState(recommendation);
    if (!state) continue;
    lifecycleOutstandingCount += 1;
    if (recommendation.recommendation !== "capital_review" && recommendation.recommendation !== "replace") continue;
    decisionsNeeded.push({
      kind: recommendation.recommendation === "capital_review" ? "capital_review" : "replacement_review",
      id: recommendation.id,
      state,
      label: `${state} on an asset`,
      detail: recommendation.explanation,
      drillThrough: { type: "asset", id: recommendation.assetId },
    });
  }
  for (const task of openTasks.filter((row) => row.taskType === "approve_quote")) {
    decisionsNeeded.push({
      kind: "approval",
      id: task.id,
      label: task.title,
      detail: task.reason,
      drillThrough: { type: task.workOrderId ? "work_order" : "workflow_task", id: task.workOrderId ?? task.id },
    });
  }
  for (const task of escalatedTasks.slice(0, 3)) {
    decisionsNeeded.push({
      kind: "escalated_task",
      id: task.id,
      label: `Escalated ${task.escalationLevel > 1 ? `(level ${task.escalationLevel}) ` : ""}${task.title}`,
      detail: `${task.completionCriteria} Destination: ${task.escalationDestination}.`,
      drillThrough: { type: task.workOrderId ? "work_order" : "workflow_task", id: task.workOrderId ?? task.id },
    });
  }

  const workOrderDefinition = "Work orders counted here were opened between the period start and end dates shown above.";

  return {
    generatedAt: period.endsAt,
    periodStartsAt: period.startsAt,
    periodEndsAt: period.endsAt,
    headline: {
      openedWorkOrders: orgWorkOrders.filter((row) => openedInPeriod(row.createdAt)).length,
      activeWorkOrders: orgWorkOrders.filter((row) => !ACTIVE_WORK_ORDER_EXCLUSIONS.has(row.status)).length,
      escalationsActive: escalatedTasks.length,
      decisionsNeededCount: decisionsNeeded.length,
    },
    drillThrough: {
      recordedSpendHref: "/app/spend",
      invoiceReviewHref: "/app/invoices",
      pmComplianceHref: "/app/pm",
      activeWorkOrdersHref: "/app/work-orders?status=open",
      escalationsHref: "/app/action-center",
    },
    money: {
      currency,
      recordedSpendMinor: costLines.reduce((sum, row) => sum + row.amount.amountMinor, 0),
      invoiceReviewAmountMinor,
      invoiceReviewCount: flaggedInvoices.length,
      otherIdentifiedExposureMinor,
      realizedVerifiedMinor: valueEvents.filter((row) => String(row.category) === "realized_verified").reduce((sum, row) => sum + row.amount.amountMinor, 0),
      estimatedOpportunityMinor: valueEvents.filter((row) => String(row.category) === "estimated_opportunity").reduce((sum, row) => sum + row.amount.amountMinor, 0),
    },
    pmCompliance: {
      numerator: pmCompliant.length,
      denominator: evaluatedPm.length,
      method: "On-time or early completions divided by PM occurrences whose due date fell inside the period; occurrences still inside their completion window are listed separately below and excluded until the window closes.",
      obligations,
    },
    decisionsNeeded,
    lifecycleOutstandingCount,
    workOrderDefinition,
    storeLines,
  };
}
