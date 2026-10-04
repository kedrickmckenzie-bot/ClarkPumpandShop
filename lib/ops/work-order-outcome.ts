import type { SiteVisitWorkOrder, WorkOrderVerification, WorkResult, WorkOutcome } from "./types";

type OutcomeRecord = Pick<SiteVisitWorkOrder, "id" | "outcome" | "outcomeRecordedAt" | "linkedAt" | "cycleVersion"> & { workResultId?: string; siteVisitWorkOrderId?: string; source?: WorkResult["source"] };
type VerificationRecord = Pick<WorkOrderVerification, "siteVisitWorkOrderId" | "workResultId" | "decidedAt"> & { cycle?: number; outcomeRecordedAt?: string };

/** Linked canonical successors replace legacy results once; pending visits remain service cycles. */
export function normalizeWorkOutcomes(visits: readonly SiteVisitWorkOrder[], results: readonly WorkResult[] = []): WorkOutcome[] {
  const replaced = new Set(results.flatMap(result => result.siteVisitWorkOrderId ? [result.siteVisitWorkOrderId] : []));
  return [
    ...visits.filter(visit => !replaced.has(visit.id)),
    ...results.map(result => ({ ...visits.find(visit => visit.id === result.siteVisitWorkOrderId), ...result, workResultId: result.id,
      visitId: visits.find(visit => visit.id === result.siteVisitWorkOrderId)?.visitId,
      linkedByActorType: result.outcomeRecordedByActorType, linkedByActorId: result.outcomeRecordedByActorId,
      linkedByActorName: result.outcomeRecordedByActorName,
    })),
  ];
}

export function verificationMatchesOutcome(record: Pick<WorkOrderVerification, "siteVisitWorkOrderId" | "workResultId">, outcome: OutcomeRecord) {
  return outcome.workResultId ? record.workResultId === outcome.workResultId || !record.workResultId && outcome.source !== "correction" && Boolean(outcome.siteVisitWorkOrderId && record.siteVisitWorkOrderId === outcome.siteVisitWorkOrderId) : !record.workResultId && record.siteVisitWorkOrderId === outcome.id;
}

/** One ordering rule for the currently applicable immutable service outcome. */
export function latestWorkOutcomeCycle<T extends OutcomeRecord>(records: readonly T[]): T | undefined {
  return [...records]
    .sort((left, right) => (
      ((right.cycleVersion ?? 0) - (left.cycleVersion ?? 0))
      || right.linkedAt.localeCompare(left.linkedAt)
      || (right.outcomeRecordedAt ?? "").localeCompare(left.outcomeRecordedAt ?? "")
      || right.id.localeCompare(left.id)
    ))[0];
}

export function latestRecordedWorkOutcome<T extends OutcomeRecord>(records: readonly T[]): T | undefined {
  const currentCycle = latestWorkOutcomeCycle(records);
  return currentCycle?.outcome && currentCycle.outcomeRecordedAt ? currentCycle : undefined;
}

/** A decision applies only to the exact immutable outcome it reviewed. */
export function applicableOutcomeVerification<T extends VerificationRecord>(
  records: readonly T[],
  outcome: OutcomeRecord | undefined,
): T | undefined {
  if (!outcome) return undefined;
  return [...records]
    .filter((record) => verificationMatchesOutcome(record, outcome) && (!record.outcomeRecordedAt || record.outcomeRecordedAt === outcome.outcomeRecordedAt))
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt) || (right.cycle ?? 0) - (left.cycle ?? 0))[0];
}

const OUTCOME_WORDS: Record<string, string> = {
  completed: "the work completed",
  temporary_repair: "a temporary repair",
  diagnosis_only: "a diagnosis only",
  quote_required: "a quote is needed",
  parts_required: "parts are needed",
  return_visit_required: "a return visit is needed",
  no_issue_found: "no issue found",
  store_access_unavailable: "no store access",
};

export function internalWorkResultLabel(outcome: string | undefined): string {
  const labels: Record<string, string> = {
    completed: "Fixed", no_issue_found: "No issue found", return_visit_required: "Needs more work",
    parts_required: "Needs parts", quote_required: "Needs an outside vendor",
    diagnosis_only: "Needs help / diagnosis recorded", not_addressed: "Not completed today",
    temporary_repair: "Temporary repair", store_access_unavailable: "Could not access the store",
    work_not_authorized: "Work needs authorization",
  };
  return outcome ? labels[outcome] ?? outcome.replaceAll("_", " ") : "No result recorded";
}

export const COMPLETION_FALLBACK = "Work reported complete—confirmation needed.";

/**
 * One line saying who recorded the job result and when, taken from the recorded
 * outcome itself, so later notes or edits never change it.
 */
export function completionSummary(records: readonly WorkOutcome[], formatTime: (iso: string) => string): string {
  const current = latestRecordedWorkOutcome(records);
  if (!current?.outcome || !current.outcomeRecordedAt || !current.outcomeRecordedByActorName?.trim()) return COMPLETION_FALLBACK;
  return `${current.outcomeRecordedByActorName.trim()} recorded ${OUTCOME_WORDS[current.outcome] ?? current.outcome.replaceAll("_", " ")} ${formatTime(current.outcomeRecordedAt)}.`;
}

/** Reports retain one applicable outcome per observed visit/job, including amendments. */
export function applicableVisitWorkOutcomes(visits:readonly SiteVisitWorkOrder[],results:readonly WorkResult[] = []):WorkOutcome[]{
  const groups=new Map<string,WorkOutcome[]>();
  for(const row of normalizeWorkOutcomes(visits,results)){if(!row.visitId)continue;const key=row.siteVisitWorkOrderId??row.id;groups.set(key,[...(groups.get(key)??[]),row]);}
  return [...groups.values()].map(rows=>latestWorkOutcomeCycle(rows)!);
}
