import type { SiteVisitWorkOrder, WorkOrderVerification } from "./types";

type OutcomeRecord = Pick<SiteVisitWorkOrder, "id" | "outcome" | "outcomeRecordedAt" | "linkedAt">;
type VerificationRecord = Pick<WorkOrderVerification, "siteVisitWorkOrderId" | "decidedAt">;

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
    .filter((record) => record.siteVisitWorkOrderId === outcome.id)
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
}
