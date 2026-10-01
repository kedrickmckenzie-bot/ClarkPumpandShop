import type { SiteVisitWorkOrder, WorkOrderVerification } from "./types";

type OutcomeRecord = Pick<SiteVisitWorkOrder, "id" | "outcome" | "outcomeRecordedAt" | "linkedAt">;
type VerificationRecord = Pick<WorkOrderVerification, "siteVisitWorkOrderId" | "decidedAt"> & { cycle?: number; outcomeRecordedAt?: string };

/** One ordering rule for the currently applicable immutable service outcome. */
export function latestRecordedWorkOutcome<T extends OutcomeRecord>(records: readonly T[]): T | undefined {
  const currentCycle = [...records]
    .sort((left, right) => (
      right.linkedAt.localeCompare(left.linkedAt)
      || (right.outcomeRecordedAt ?? "").localeCompare(left.outcomeRecordedAt ?? "")
      || right.id.localeCompare(left.id)
    ))[0];
  return currentCycle?.outcome && currentCycle.outcomeRecordedAt ? currentCycle : undefined;
}

/** A decision applies only to the exact immutable outcome it reviewed. */
export function applicableOutcomeVerification<T extends VerificationRecord>(
  records: readonly T[],
  outcome: OutcomeRecord | undefined,
): T | undefined {
  if (!outcome) return undefined;
  return [...records]
    .filter((record) => record.siteVisitWorkOrderId === outcome.id && (!record.outcomeRecordedAt || record.outcomeRecordedAt === outcome.outcomeRecordedAt))
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

export const COMPLETION_FALLBACK = "Work reported complete—confirmation needed.";

/**
 * One line saying who recorded the job result and when, taken from the recorded
 * outcome itself, so later notes or edits never change it.
 */
export function completionSummary(records: readonly SiteVisitWorkOrder[], formatTime: (iso: string) => string): string {
  const current = latestRecordedWorkOutcome(records);
  if (!current?.outcome || !current.outcomeRecordedAt || !current.outcomeRecordedByActorName?.trim()) return COMPLETION_FALLBACK;
  return `${current.outcomeRecordedByActorName.trim()} recorded ${OUTCOME_WORDS[current.outcome] ?? current.outcome.replaceAll("_", " ")} ${formatTime(current.outcomeRecordedAt)}.`;
}
