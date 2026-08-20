import type { SiteVisitWorkOrderOutcome, VisitOutcome } from "./types";

const unresolvedSiteVisitOutcomes = new Set<SiteVisitWorkOrderOutcome>([
  "diagnosis_only",
  "quote_required",
  "parts_required",
  "return_visit_required",
  "store_access_unavailable",
  "work_not_authorized",
  "not_addressed",
]);

export function siteVisitOutcomeRequiresFollowUp(outcome: SiteVisitWorkOrderOutcome) {
  return unresolvedSiteVisitOutcomes.has(outcome);
}

/** Temporary adapter for the legacy single-work-order checkout contract. */
export function siteVisitOutcomeFromLegacy(outcome: VisitOutcome): SiteVisitWorkOrderOutcome {
  const mapping: Record<VisitOutcome, SiteVisitWorkOrderOutcome> = {
    resolved: "completed",
    temporary_repair: "return_visit_required",
    diagnosed_waiting_parts: "parts_required",
    return_required: "return_visit_required",
    unable_to_complete: "not_addressed",
    unable_to_reproduce: "no_issue_found",
    no_issue_found: "no_issue_found",
    inspection_complete: "completed",
    pm_complete: "completed",
    other: "not_addressed",
  };
  return mapping[outcome];
}

/** Temporary scalar projection retained only for a visit linked to one WO. */
export function legacyOutcomeFromSiteVisit(outcome: SiteVisitWorkOrderOutcome): VisitOutcome {
  const mapping: Record<SiteVisitWorkOrderOutcome, VisitOutcome> = {
    completed: "resolved",
    diagnosis_only: "other",
    quote_required: "other",
    parts_required: "diagnosed_waiting_parts",
    return_visit_required: "return_required",
    no_issue_found: "no_issue_found",
    store_access_unavailable: "unable_to_complete",
    work_not_authorized: "unable_to_complete",
    not_addressed: "other",
  };
  return mapping[outcome];
}
