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
