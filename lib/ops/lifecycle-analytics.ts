import type { Asset, CurrencyCode, IsoDateTime, OpsId } from "@/lib/ops/types";

export type RepairReplacementScreeningState =
  | "incomplete"
  | "below_materiality"
  | "below_economic_review"
  | "compare_alternatives";

export type RepairReplacementReviewTrigger =
  | "same_horizon_economics"
  | "direct_replacement_share";

export type RepairReplacementScreeningReason =
  | "required_economic_inputs_missing"
  | "comparison_horizon_unavailable"
  | "repair_amount_below_minimum"
  | "repair_share_below_minimum"
  | "same_horizon_below_review_threshold"
  | "same_horizon_meets_review_threshold"
  | "direct_replacement_share_meets_review_threshold";

export type CapitalPlanningScreeningState =
  | "inputs_needed"
  | "not_economically_flagged"
  | "review_candidate";

export type ComparisonHorizonSource =
  | "estimated_service_extension"
  | "chronological_remaining_expected_life"
  | "unavailable";

export type RepairReplacementDataGap =
  | "missing_install_date"
  | "invalid_install_date"
  | "install_date_after_as_of"
  | "missing_expected_life"
  | "invalid_expected_life"
  | "missing_replacement_estimate"
  | "invalid_replacement_estimate"
  | "missing_repair_estimate"
  | "invalid_repair_estimate"
  | "invalid_service_extension"
  | "no_positive_comparison_horizon";

/**
 * A current repair proposal is deliberately separate from WorkOrder. TraceOps can
 * screen an estimate before a work order exists or before it is issued.
 */
export interface RepairProposalInput {
  proposalId?: OpsId;
  repairEstimateMinor?: number;
  estimatedServiceExtensionMonths?: number;
  sourceRecordIds?: OpsId[];
}

/**
 * Historical activity is supporting evidence only. It is never used to calculate
 * the break-even amount or the screening state.
 */
export interface LifecycleHistoricalContextInput {
  recordedWorkCostMinor?: number;
  distinctWorkOrderCount?: number;
  distinctVisitCount?: number;
  repeatIssueCount?: number;
  sourceRecordIds?: OpsId[];
}

export interface RepairReplacementScreeningPolicy {
  minimumRepairAmountMinor: number;
  minimumRepairToReplacementRatio: number;
  nearSameHorizonRatio: number;
  directHighReplacementShareRatio: number;
}

export const DEFAULT_REPAIR_REPLACEMENT_SCREENING_POLICY: Readonly<RepairReplacementScreeningPolicy> =
  Object.freeze({
    minimumRepairAmountMinor: 250_000,
    minimumRepairToReplacementRatio: 0.1,
    nearSameHorizonRatio: 0.8,
    directHighReplacementShareRatio: 0.5,
  });

export interface RepairReplacementScreeningOptions {
  asOf?: IsoDateTime;
  historicalContext?: LifecycleHistoricalContextInput;
  policy?: Partial<RepairReplacementScreeningPolicy>;
}

export interface RepairReplacementScreening {
  assetId: OpsId;
  organizationId: OpsId;
  storeId: OpsId;
  asOf: IsoDateTime;
  state: RepairReplacementScreeningState;
  capitalPlanningState: CapitalPlanningScreeningState;
  reviewTriggers: RepairReplacementReviewTrigger[];
  reasons: RepairReplacementScreeningReason[];
  dataGaps: RepairReplacementDataGap[];
  age: {
    installedAt?: IsoDateTime;
    ageMonths?: number;
    ageYears?: number;
    expectedLifeYears?: number;
    lifeUsedPercentage?: number;
    chronologicalRemainingExpectedLifeMonths?: number;
    chronologicalRemainingExpectedLifeYears?: number;
  };
  comparison: {
    currency?: CurrencyCode;
    repairEstimateMinor?: number;
    replacementEstimateMinor?: number;
    estimatedServiceExtensionMonths?: number;
    comparisonHorizonMonths?: number;
    comparisonHorizonYears?: number;
    comparisonHorizonSource: ComparisonHorizonSource;
    replacementAnnualizedCapitalCostMinor?: number;
    breakEvenRepairAmountMinor?: number;
    repairAnnualizedCostMinor?: number;
    repairToBreakEvenRatio?: number;
    repairToReplacementRatio?: number;
    minimumRepairAmountMinor: number;
    minimumRepairToReplacementRatio: number;
    nearSameHorizonRatio: number;
    directHighReplacementShareRatio: number;
  };
  historicalContext?: LifecycleHistoricalContextInput;
  economicSourceRecordIds: OpsId[];
  historicalContextSourceRecordIds: OpsId[];
  sourceRecordIds: OpsId[];
  definition: string;
}

function uniqueIds(ids: Array<OpsId | undefined>): OpsId[] {
  return [...new Set(ids.filter((id): id is OpsId => Boolean(id)))];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isNonNegativeMinorUnits(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0;
}

function validPositiveNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function anniversaryInYear(installed: Date, year: number): Date {
  const month = installed.getUTCMonth();
  const day = Math.min(installed.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(Date.UTC(
    year,
    month,
    day,
    installed.getUTCHours(),
    installed.getUTCMinutes(),
    installed.getUTCSeconds(),
    installed.getUTCMilliseconds(),
  ));
}

/** Calendar-anniversary age makes an exact fifth anniversary exactly five years. */
function calendarAgeYears(installedTime: number, asOfTime: number): number {
  const installed = new Date(installedTime);
  const asOf = new Date(asOfTime);
  let wholeYears = asOf.getUTCFullYear() - installed.getUTCFullYear();
  let lastAnniversary = anniversaryInYear(installed, installed.getUTCFullYear() + wholeYears);
  if (lastAnniversary.getTime() > asOfTime) {
    wholeYears -= 1;
    lastAnniversary = anniversaryInYear(installed, installed.getUTCFullYear() + wholeYears);
  }
  const nextAnniversary = anniversaryInYear(installed, installed.getUTCFullYear() + wholeYears + 1);
  const fractionalYear =
    (asOfTime - lastAnniversary.getTime()) /
    (nextAnniversary.getTime() - lastAnniversary.getTime());
  return wholeYears + fractionalYear;
}

function screeningPolicy(
  override?: Partial<RepairReplacementScreeningPolicy>,
): RepairReplacementScreeningPolicy {
  const policy = { ...DEFAULT_REPAIR_REPLACEMENT_SCREENING_POLICY, ...override };
  if (
    !Number.isSafeInteger(policy.minimumRepairAmountMinor) ||
    policy.minimumRepairAmountMinor < 0 ||
    !Number.isFinite(policy.minimumRepairToReplacementRatio) ||
    policy.minimumRepairToReplacementRatio < 0 ||
    policy.minimumRepairToReplacementRatio > 1 ||
    !Number.isFinite(policy.nearSameHorizonRatio) ||
    policy.nearSameHorizonRatio < 0 ||
    !Number.isFinite(policy.directHighReplacementShareRatio) ||
    policy.directHighReplacementShareRatio < policy.minimumRepairToReplacementRatio ||
    policy.directHighReplacementShareRatio > 1
  ) {
    throw new Error("Repair/replacement screening thresholds must be valid, ordered materiality values.");
  }
  return policy;
}

/**
 * Screens a proposed repair against the annualized capital cost of a replacement.
 *
 * The comparison horizon is the explicitly estimated service extension when one
 * is entered. Otherwise it is the asset's positive chronological remaining
 * expected life. Expected life is a planning reference, not an expiration date.
 * This function surfaces evidence for human review and never directs replacement.
 */
export function calculateRepairReplacementScreening(
  asset: Asset,
  proposal?: RepairProposalInput,
  options: RepairReplacementScreeningOptions = {},
): RepairReplacementScreening {
  const asOf = options.asOf ?? new Date().toISOString();
  const asOfTime = Date.parse(asOf);
  if (!Number.isFinite(asOfTime)) {
    throw new Error("Repair/replacement screening requires a valid asOf timestamp.");
  }

  const policy = screeningPolicy(options.policy);
  const dataGaps: RepairReplacementDataGap[] = [];

  let ageMonthsExact: number | undefined;
  if (!asset.installedAt) {
    dataGaps.push("missing_install_date");
  } else {
    const installedTime = Date.parse(asset.installedAt);
    if (!Number.isFinite(installedTime)) {
      dataGaps.push("invalid_install_date");
    } else if (installedTime > asOfTime) {
      dataGaps.push("install_date_after_as_of");
    } else {
      ageMonthsExact = calendarAgeYears(installedTime, asOfTime) * 12;
    }
  }

  const expectedLifeYears = asset.expectedLifeYears;
  const expectedLifeIsValid = validPositiveNumber(expectedLifeYears);
  if (expectedLifeYears === undefined) dataGaps.push("missing_expected_life");
  else if (!expectedLifeIsValid) dataGaps.push("invalid_expected_life");

  const replacementEstimateMinor = asset.replacementEstimate?.amountMinor;
  const replacementEstimateIsValid = isNonNegativeMinorUnits(replacementEstimateMinor);
  if (replacementEstimateMinor === undefined) dataGaps.push("missing_replacement_estimate");
  else if (!replacementEstimateIsValid) dataGaps.push("invalid_replacement_estimate");

  const repairEstimateMinor = proposal?.repairEstimateMinor;
  const repairEstimateIsValid = isNonNegativeMinorUnits(repairEstimateMinor);
  if (repairEstimateMinor === undefined) dataGaps.push("missing_repair_estimate");
  else if (!repairEstimateIsValid) dataGaps.push("invalid_repair_estimate");

  const chronologicalRemainingMonthsExact =
    expectedLifeIsValid && ageMonthsExact !== undefined
      ? Math.max(0, expectedLifeYears * 12 - ageMonthsExact)
      : undefined;

  const extensionWasEntered = proposal?.estimatedServiceExtensionMonths !== undefined;
  const extensionIsValid = validPositiveNumber(proposal?.estimatedServiceExtensionMonths);
  let horizonMonthsExact: number | undefined;
  let horizonSource: ComparisonHorizonSource = "unavailable";

  if (extensionWasEntered) {
    if (extensionIsValid) {
      horizonMonthsExact = proposal.estimatedServiceExtensionMonths;
      horizonSource = "estimated_service_extension";
    } else {
      dataGaps.push("invalid_service_extension");
    }
  } else if (chronologicalRemainingMonthsExact !== undefined && chronologicalRemainingMonthsExact > 0) {
    horizonMonthsExact = chronologicalRemainingMonthsExact;
    horizonSource = "chronological_remaining_expected_life";
  } else {
    dataGaps.push("no_positive_comparison_horizon");
  }

  let replacementAnnualizedRaw: number | undefined;
  let breakEvenRepairAmountRaw: number | undefined;
  let repairAnnualizedRaw: number | undefined;
  let repairToBreakEvenRatio: number | undefined;
  let repairToReplacementRatio: number | undefined;

  if (expectedLifeIsValid && replacementEstimateIsValid) {
    replacementAnnualizedRaw = replacementEstimateMinor / expectedLifeYears;
  }
  if (replacementAnnualizedRaw !== undefined && horizonMonthsExact !== undefined) {
    breakEvenRepairAmountRaw = replacementAnnualizedRaw * (horizonMonthsExact / 12);
  }
  if (repairEstimateIsValid && horizonMonthsExact !== undefined) {
    repairAnnualizedRaw = repairEstimateMinor * (12 / horizonMonthsExact);
  }
  if (
    repairEstimateIsValid &&
    breakEvenRepairAmountRaw !== undefined &&
    breakEvenRepairAmountRaw > 0
  ) {
    repairToBreakEvenRatio = repairEstimateMinor / breakEvenRepairAmountRaw;
  }
  if (
    repairEstimateIsValid &&
    replacementEstimateIsValid &&
    replacementEstimateMinor > 0
  ) {
    repairToReplacementRatio = repairEstimateMinor / replacementEstimateMinor;
  }

  let state: RepairReplacementScreeningState = "incomplete";
  const reviewTriggers: RepairReplacementReviewTrigger[] = [];
  const reasons: RepairReplacementScreeningReason[] = [];

  // Materiality is intentionally evaluated before horizon economics. An $800
  // bridge repair must not become a capital-review alert merely because a very
  // short service extension makes its annualized ratio look large.
  if (!repairEstimateIsValid) {
    reasons.push("required_economic_inputs_missing");
  } else if (repairEstimateMinor < policy.minimumRepairAmountMinor) {
    state = "below_materiality";
    reasons.push("repair_amount_below_minimum");
  } else if (repairToReplacementRatio === undefined) {
    reasons.push("required_economic_inputs_missing");
  } else if (repairToReplacementRatio >= policy.directHighReplacementShareRatio) {
    state = "compare_alternatives";
    reviewTriggers.push("direct_replacement_share");
    reasons.push("direct_replacement_share_meets_review_threshold");
    if (
      repairToBreakEvenRatio !== undefined &&
      repairToBreakEvenRatio >= policy.nearSameHorizonRatio
    ) {
      reviewTriggers.push("same_horizon_economics");
      reasons.push("same_horizon_meets_review_threshold");
    }
  } else if (repairToReplacementRatio < policy.minimumRepairToReplacementRatio) {
    state = "below_economic_review";
    reasons.push("repair_share_below_minimum");
  } else if (repairToBreakEvenRatio === undefined) {
    reasons.push("comparison_horizon_unavailable");
  } else if (repairToBreakEvenRatio >= policy.nearSameHorizonRatio) {
    state = "compare_alternatives";
    reviewTriggers.push("same_horizon_economics");
    reasons.push("same_horizon_meets_review_threshold");
  } else {
    state = "below_economic_review";
    reasons.push("same_horizon_below_review_threshold");
  }

  const capitalPlanningState: CapitalPlanningScreeningState = state === "incomplete"
    ? "inputs_needed"
    : state === "compare_alternatives"
      ? "review_candidate"
      : "not_economically_flagged";

  const economicSourceRecordIds = uniqueIds([
    asset.id,
    proposal?.proposalId,
    ...(proposal?.sourceRecordIds ?? []),
  ]);
  const historicalContextSourceRecordIds = uniqueIds(options.historicalContext?.sourceRecordIds ?? []);

  return {
    assetId: asset.id,
    organizationId: asset.organizationId,
    storeId: asset.storeId,
    asOf,
    state,
    capitalPlanningState,
    reviewTriggers,
    reasons,
    dataGaps,
    age: {
      installedAt: asset.installedAt,
      ageMonths: ageMonthsExact === undefined ? undefined : round(ageMonthsExact, 1),
      ageYears: ageMonthsExact === undefined ? undefined : round(ageMonthsExact / 12, 2),
      expectedLifeYears: expectedLifeIsValid ? expectedLifeYears : undefined,
      lifeUsedPercentage:
        expectedLifeIsValid && ageMonthsExact !== undefined
          ? round((ageMonthsExact / (expectedLifeYears * 12)) * 100, 1)
          : undefined,
      chronologicalRemainingExpectedLifeMonths:
        chronologicalRemainingMonthsExact === undefined
          ? undefined
          : round(chronologicalRemainingMonthsExact, 1),
      chronologicalRemainingExpectedLifeYears:
        chronologicalRemainingMonthsExact === undefined
          ? undefined
          : round(chronologicalRemainingMonthsExact / 12, 2),
    },
    comparison: {
      currency: asset.replacementEstimate?.currency,
      repairEstimateMinor: repairEstimateIsValid ? repairEstimateMinor : undefined,
      replacementEstimateMinor: replacementEstimateIsValid ? replacementEstimateMinor : undefined,
      estimatedServiceExtensionMonths: extensionIsValid
        ? proposal.estimatedServiceExtensionMonths
        : undefined,
      comparisonHorizonMonths:
        horizonMonthsExact === undefined ? undefined : round(horizonMonthsExact, 1),
      comparisonHorizonYears:
        horizonMonthsExact === undefined ? undefined : round(horizonMonthsExact / 12, 2),
      comparisonHorizonSource: horizonSource,
      replacementAnnualizedCapitalCostMinor:
        replacementAnnualizedRaw === undefined ? undefined : Math.round(replacementAnnualizedRaw),
      breakEvenRepairAmountMinor:
        breakEvenRepairAmountRaw === undefined ? undefined : Math.round(breakEvenRepairAmountRaw),
      repairAnnualizedCostMinor:
        repairAnnualizedRaw === undefined ? undefined : Math.round(repairAnnualizedRaw),
      repairToBreakEvenRatio:
        repairToBreakEvenRatio === undefined ? undefined : round(repairToBreakEvenRatio, 3),
      repairToReplacementRatio:
        repairToReplacementRatio === undefined ? undefined : round(repairToReplacementRatio, 3),
      minimumRepairAmountMinor: policy.minimumRepairAmountMinor,
      minimumRepairToReplacementRatio: policy.minimumRepairToReplacementRatio,
      nearSameHorizonRatio: policy.nearSameHorizonRatio,
      directHighReplacementShareRatio: policy.directHighReplacementShareRatio,
    },
    historicalContext: options.historicalContext,
    economicSourceRecordIds,
    historicalContextSourceRecordIds,
    sourceRecordIds: uniqueIds([...economicSourceRecordIds, ...historicalContextSourceRecordIds]),
    definition:
      "Repair cost must first meet both the configured dollar and replacement-share materiality gates. Material repairs are flagged when they approach the annualized installed replacement cost over the same service horizon or directly exceed the high replacement-share threshold. Expected life, age, historical spend, and reliability are context only and never change this economic screening state.",
  };
}
