import type { RepairReplacementScreening } from "./lifecycle-analytics";
import type { LifecycleRecommendation, ReplacementEvent } from "./types";

export type LifecycleDecisionTone = "neutral" | "positive" | "warning" | "critical" | "info";

export type LifecycleDecisionStateKind =
  | "replacement_completed"
  | "replacement_approved"
  | "replacement_planned"
  | "replacement_deferred"
  | "repair_selected"
  | "investigation_needed"
  | "compare_alternatives"
  | "below_materiality"
  | "below_economic_review"
  | "incomplete";

export interface LifecycleDecisionState {
  kind: LifecycleDecisionStateKind;
  label: string;
  helper: string;
  tone: LifecycleDecisionTone;
}

function sentence(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function latestActiveReplacementEvent(events: ReplacementEvent[]): ReplacementEvent | undefined {
  return events
    .filter((event) => event.status !== "cancelled")
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "completed" ? -1 : 1;
      return right.approvedAt.localeCompare(left.approvedAt);
    })[0];
}

/**
 * Resolves the one plain-language lifecycle state shown on every surface.
 * Persisted outcomes and management decisions always outrank a calculated
 * screening so the list cannot contradict its own decision workspace.
 */
export function resolveLifecycleDecisionState(input: {
  screening: RepairReplacementScreening;
  latestDecision?: LifecycleRecommendation;
  replacementEvents?: ReplacementEvent[];
}): LifecycleDecisionState {
  const replacementEvent = latestActiveReplacementEvent(input.replacementEvents ?? []);
  const { latestDecision, screening } = input;

  if (replacementEvent?.status === "completed" || latestDecision?.actualOutcome === "replaced") {
    return {
      kind: "replacement_completed",
      label: "Replacement completed",
      helper: "The installed replacement and its recorded outcome now belong to this equipment history.",
      tone: "positive",
    };
  }
  if (replacementEvent?.status === "approved") {
    return {
      kind: "replacement_approved",
      label: "Replacement approved",
      helper: "Management approved the selected vendor quote. The work order remains the source for installation, visits, cost, and closeout.",
      tone: "warning",
    };
  }
  if (latestDecision?.userDecision === "replace") {
    return {
      kind: "replacement_planned",
      label: `Replacement planned${latestDecision.plannedForYear ? ` for ${latestDecision.plannedForYear}` : ""}`,
      helper: latestDecision.userReason,
      tone: "warning",
    };
  }
  if (latestDecision?.userDecision === "defer") {
    return {
      kind: "replacement_deferred",
      label: `Replacement deferred${latestDecision.plannedForYear ? ` until ${latestDecision.plannedForYear}` : ""}`,
      helper: latestDecision.userReason,
      tone: "info",
    };
  }
  if (latestDecision?.userDecision === "repair") {
    return {
      kind: "repair_selected",
      label: latestDecision.actualOutcome === "repaired" ? "Repair completed" : "Repair selected",
      helper: latestDecision.userReason,
      tone: "positive",
    };
  }
  if (latestDecision?.userDecision === "investigate") {
    return {
      kind: "investigation_needed",
      label: "More information needed",
      helper: latestDecision.userReason,
      tone: "info",
    };
  }

  if (screening.state === "compare_alternatives") {
    return {
      kind: "compare_alternatives",
      label: "Costs to review",
      helper: "The cost rule flagged this unit for a closer look.",
      tone: "warning",
    };
  }
  if (screening.state === "below_materiality") {
    return {
      kind: "below_materiality",
      label: "No cost flag",
      helper: "The repair price is below your cost limit.",
      tone: "neutral",
    };
  }
  if (screening.state === "below_economic_review") {
    return {
      kind: "below_economic_review",
      label: "No cost flag",
      helper: "The current prices do not raise a cost flag.",
      tone: "neutral",
    };
  }
  return {
    kind: "incomplete",
    label: "Price details needed",
    helper: screening.dataGaps.length
      ? `Still needed: ${screening.dataGaps.map(sentence).join(", ")}.`
      : "Open the source records before making a lifecycle decision.",
    tone: "info",
  };
}
