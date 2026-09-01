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

function formatRunway(months: number | undefined): string {
  if (months === undefined) return "an unknown amount of time";
  if (months < 12) return `${Math.max(1, Math.round(months))} month${Math.round(months) === 1 ? "" : "s"}`;
  const years = months / 12;
  return `${Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)} years`;
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

  const runway = screening.comparison.requiredEconomicRunwayMonths;
  const runwayLabel = runway === undefined
    ? "The required service runway cannot be calculated until repair, replacement, and expected-life inputs are entered."
    : `The repair would need about ${formatRunway(runway)} of continued service to equal the replacement's annualized installed-capital cost.`;

  if (screening.state === "compare_alternatives") {
    return {
      kind: "compare_alternatives",
      label: "Compare repair and replacement",
      helper: `${runwayLabel} Compare the entered repair-service estimate, warranty, and service history before authorizing; this is not a replacement direction.`,
      tone: "warning",
    };
  }
  if (screening.state === "below_materiality") {
    return {
      kind: "below_materiality",
      label: "Small repair; not flagged",
      helper: `${runwayLabel} The current repair remains below the materiality threshold, so a short remaining expected life does not turn it into a replacement signal.`,
      tone: "positive",
    };
  }
  if (screening.state === "below_economic_review") {
    return {
      kind: "below_economic_review",
      label: "Below capital-review threshold",
      helper: `${runwayLabel} The available planning runway is above that requirement, so the repair is not flagged for capital review.`,
      tone: "positive",
    };
  }
  return {
    kind: "incomplete",
    label: "Current comparison inputs needed",
    helper: screening.dataGaps.length
      ? `Still needed: ${screening.dataGaps.map(sentence).join(", ")}.`
      : "Open the source records before making a lifecycle decision.",
    tone: "info",
  };
}
