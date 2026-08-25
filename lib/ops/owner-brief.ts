import type { OpsFixture } from "./types";

/**
 * The Monday Morning Owner Brief: one plain-language executive digest computed
 * entirely from source records. Every decision item carries a drill-through
 * reference so the owner can verify the evidence in one click. Money totals
 * keep the platform's three bases separate — identified exposure and
 * estimated opportunity are never presented as realized value.
 */

export interface OwnerBriefDecision {
  kind: "capital_review" | "approval" | "escalated_task";
  id: string;
  label: string;
  detail: string;
  drillThrough: { type: "asset" | "workflow_task" | "work_order"; id: string };
}

export interface OwnerBriefStoreLine {
  storeId: string;
  storeNumber: string;
  storeName: string;
  workOrdersTouched: number;
  recordedSpendMinor: number;
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
  money: {
    currency: string;
    recordedSpendMinor: number;
    identifiedExposureMinor: number;
    realizedVerifiedMinor: number;
    estimatedOpportunityMinor: number;
  };
  pmCompliance: { numerator: number; denominator: number; method: string };
  decisionsNeeded: OwnerBriefDecision[];
  storeLines: OwnerBriefStoreLine[];
}

const COMPLIANT_PM_STATUSES = new Set(["completed_early", "completed_on_time"]);
const OPEN_TASK_STATUSES = new Set(["open", "in_progress"]);
const ACTIVE_WORK_ORDER_EXCLUSIONS = new Set(["resolved", "closed", "cancelled"]);
export function buildOwnerBrief(
  fixture: Pick<OpsFixture, "stores" | "workOrders" | "costLines" | "valueEvents" | "pmOccurrences" | "workflowTasks" | "lifecycleRecommendations" | "assets">,
  organizationId: string,
  period: { startsAt: string; endsAt: string },
): OwnerBrief {
  const orgStores = fixture.stores.filter((row) => row.organizationId === organizationId);
  const orgWorkOrders = fixture.workOrders.filter((row) => row.organizationId === organizationId);
  const costLines = fixture.costLines.filter((row) => row.organizationId === organizationId && row.serviceDate >= period.startsAt && row.serviceDate <= period.endsAt);
  const valueEvents = fixture.valueEvents.filter((row) => row.organizationId === organizationId && row.occurredAt >= period.startsAt && row.occurredAt <= period.endsAt);
  const sumByCategory = (category: string) => valueEvents.filter((row) => String(row.category) === category).reduce((sum, row) => sum + row.amount.amountMinor, 0);
  const currency = costLines[0]?.amount.currency ?? "USD";
  const spendByWorkOrder = new Map<string, number>();
  for (const line of costLines) spendByWorkOrder.set(line.workOrderId, (spendByWorkOrder.get(line.workOrderId) ?? 0) + line.amount.amountMinor);

  const storeLines = orgStores.map((store) => {
    const storeWorkOrderIds = new Set(orgWorkOrders.filter((row) => row.storeId === store.id).map((row) => row.id));
    return {
      storeId: store.id,
      storeNumber: store.storeNumber,
      storeName: store.name,
      workOrdersTouched: storeWorkOrderIds.size,
      recordedSpendMinor: [...spendByWorkOrder.entries()].filter(([workOrderId]) => storeWorkOrderIds.has(workOrderId)).reduce((sum, [, amountMinor]) => sum + amountMinor, 0),
    };
  }).sort((a, b) => b.recordedSpendMinor - a.recordedSpendMinor || b.workOrdersTouched - a.workOrdersTouched);

  const dueThisPeriod = fixture.pmOccurrences.filter((row) => row.organizationId === organizationId && row.dueAt >= period.startsAt && row.dueAt <= period.endsAt);
  const evaluatedPm = dueThisPeriod.filter((row) => !["upcoming", "unscheduled", "proposed", "scheduled", "due", "waived"].includes(String(row.status)));
  const pmCompliant = evaluatedPm.filter((row) => COMPLIANT_PM_STATUSES.has(String(row.status)));

  const openTasks = fixture.workflowTasks.filter((row) => row.organizationId === organizationId && OPEN_TASK_STATUSES.has(row.status));
  const escalatedTasks = openTasks.filter((row) => row.escalationLevel > 0).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const latestRecommendationPerAsset = new Map<string, typeof fixture.lifecycleRecommendations[number]>();
  for (const recommendation of fixture.lifecycleRecommendations.filter((row) => row.organizationId === organizationId)) {
    const current = latestRecommendationPerAsset.get(recommendation.assetId);
    if (!current || recommendation.version > current.version) latestRecommendationPerAsset.set(recommendation.assetId, recommendation);
  }

  const decisionsNeeded: OwnerBriefDecision[] = [];
  for (const recommendation of latestRecommendationPerAsset.values()) {
    if (recommendation.recommendation !== "capital_review") continue;
    decisionsNeeded.push({
      kind: "capital_review",
      id: recommendation.id,
      label: `Capital decision needed on an asset`,
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

  return {
    generatedAt: period.endsAt,
    periodStartsAt: period.startsAt,
    periodEndsAt: period.endsAt,
    headline: {
      openedWorkOrders: orgWorkOrders.filter((row) => row.createdAt >= period.startsAt && row.createdAt <= period.endsAt).length,
      activeWorkOrders: orgWorkOrders.filter((row) => !ACTIVE_WORK_ORDER_EXCLUSIONS.has(row.status)).length,
      escalationsActive: escalatedTasks.length,
      decisionsNeededCount: decisionsNeeded.length,
    },
    money: {
      currency,
      recordedSpendMinor: costLines.reduce((sum, row) => sum + row.amount.amountMinor, 0),
      identifiedExposureMinor: sumByCategory("identified_exposure"),
      realizedVerifiedMinor: sumByCategory("realized_verified"),
      estimatedOpportunityMinor: sumByCategory("estimated_opportunity"),
    },
    pmCompliance: {
      numerator: pmCompliant.length,
      denominator: evaluatedPm.length,
      method: "On-time or early completions divided by PM occurrences whose due date fell inside the period; waived occurrences are excluded.",
    },
    decisionsNeeded,
    storeLines,
  };
}
