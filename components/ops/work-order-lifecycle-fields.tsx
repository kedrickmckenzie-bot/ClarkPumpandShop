"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Info } from "lucide-react";

import { calculateRepairReplacementScreening } from "@/lib/ops/lifecycle-analytics";
import type { AssetLifecycleInputViewModel } from "./data-contract";
import styles from "./ops.module.css";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(amountMinor: number | undefined): string {
  return amountMinor === undefined ? "Not available" : dollars.format(amountMinor / 100);
}

function duration(months: number | undefined): string {
  if (months === undefined) return "Not available";
  if (months < 24) {
    const rounded = Math.round(months * 10) / 10;
    return `${rounded} ${rounded === 1 ? "month" : "months"}`;
  }
  const rounded = Math.round((months / 12) * 10) / 10;
  return `${rounded} ${rounded === 1 ? "year" : "years"}`;
}

function percentage(value: number | undefined): string {
  return value === undefined ? "Not available" : `${Math.round(value * 100)}%`;
}

export function WorkOrderLifecycleFields({
  assets,
  asOf,
  defaultAssetId,
}: {
  assets: AssetLifecycleInputViewModel[];
  asOf: string;
  defaultAssetId?: string;
}) {
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [repairEstimate, setRepairEstimate] = useState("");
  const [serviceExtensionYears, setServiceExtensionYears] = useState("");

  const asset = assets.find((candidate) => candidate.id === assetId);
  const extensionMonths = serviceExtensionYears === ""
    ? undefined
    : Math.round(Number(serviceExtensionYears) * 12);
  const estimateMinor = repairEstimate === ""
    ? undefined
    : Math.round(Number(repairEstimate) * 100);

  const screening = useMemo(() => {
    if (!asset) return undefined;
    return calculateRepairReplacementScreening(
      {
        id: asset.id,
        organizationId: asset.organizationId,
        storeId: asset.storeId,
        categoryKey: "unclassified",
        groupPath: [],
        assetTag: asset.label,
        name: asset.label,
        installedAt: asset.installedAt,
        expectedLifeYears: asset.expectedLifeYears,
        replacementEstimate: asset.replacementEstimate,
        status: "operational",
        createdAt: asset.installedAt ?? asOf,
      },
      {
        repairEstimateMinor: Number.isFinite(estimateMinor) ? estimateMinor : undefined,
        estimatedServiceExtensionMonths:
          extensionMonths !== undefined && Number.isFinite(extensionMonths)
            ? extensionMonths
            : undefined,
      },
      { asOf },
    );
  }, [asset, asOf, estimateMinor, extensionMonths]);

  const resultTitle = !asset
    ? "Choose equipment to compare repair and replacement capital"
    : screening?.state === "compare_alternatives"
      ? "Compare repair and replacement before authorizing"
      : screening?.state === "below_materiality"
        ? "Small repair; no capital-review flag"
        : screening?.state === "below_economic_review"
          ? "Repair stays below the capital-review threshold"
          : "Add the current repair estimate when it is known";

  const resultDescription = !asset
    ? "This optional check appears only when a real equipment record is selected."
    : screening?.state === "incomplete"
      ? "Expected life is a planning reference, not an expiration date. Enter missing facts rather than forcing a repair-or-replace conclusion."
      : screening?.state === "below_materiality"
        ? `${money(screening.comparison.repairEstimateMinor)} is small in dollars or as a share of the ${money(screening.comparison.replacementEstimateMinor)} replacement estimate. A short remaining life does not turn a low-cost bridge repair into a replacement recommendation.`
        : screening?.state === "below_economic_review"
          ? `${money(screening.comparison.repairEstimateMinor)} does not meet the configured economic-review threshold against ${money(screening.comparison.replacementEstimateMinor)} of replacement capital over ${duration(screening.comparison.comparisonHorizonMonths)}. Repair can still be reviewed normally.`
          : `${money(screening?.comparison.repairEstimateMinor)} is material enough to compare with a ${money(screening?.comparison.replacementEstimateMinor)} replacement over ${duration(screening?.comparison.comparisonHorizonMonths)} of expected service. Review the evidence; TraceOps does not direct replacement.`;

  return (
    <>
      <label className={styles.field} htmlFor="work-asset">
        <span>Equipment or asset <small>Optional — can be deferred</small></span>
        <input
          id="work-asset"
          name="assetId"
          list="work-asset-options"
          placeholder="Search an asset, or leave blank when unknown"
          autoComplete="off"
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
        />
        <datalist id="work-asset-options">
          {assets.map((option) => (
            <option value={option.id} label={option.label} key={option.id}>
              {option.description}
            </option>
          ))}
        </datalist>
        <small>Leaving this blank will not create a placeholder asset. It can be linked after diagnosis.</small>
      </label>

      <div className={styles.lifecyclePlanningPanel}>
        <div className={styles.lifecyclePlanningHeading}>
          <CircleDollarSign aria-hidden="true" size={21} />
          <div>
            <strong>Repair vs. replacement planning</strong>
            <p>Optional when a quote or credible repair estimate exists. This is separate from the authorization limit below.</p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor="work-repair-estimate">
            <span>Current repair estimate <small>Optional</small></span>
            <input
              id="work-repair-estimate"
              name="repairEstimateAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={repairEstimate}
              onChange={(event) => setRepairEstimate(event.target.value)}
            />
            <small>Use the current repair under consideration—not past work cost.</small>
          </label>
          <label className={styles.field} htmlFor="work-service-extension">
            <span>Expected service this repair could buy <small>Optional years</small></span>
            <input
              id="work-service-extension"
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              placeholder="Uses remaining expected life when blank"
              value={serviceExtensionYears}
              onChange={(event) => setServiceExtensionYears(event.target.value)}
            />
            <input type="hidden" name="estimatedServiceExtensionMonths" value={extensionMonths ?? ""} />
            <small>A planning estimate, not a warranty or guaranteed outcome.</small>
          </label>
        </div>

        <div className={styles.lifecyclePlanningResult} data-state={screening?.state ?? "incomplete"}>
          <Info aria-hidden="true" size={18} />
          <div>
            <strong>{resultTitle}</strong>
            <p>{resultDescription}</p>
            {screening ? (
              <dl>
                <div><dt>Equipment age</dt><dd>{screening.age.ageYears === undefined ? "Not entered" : duration(screening.age.ageYears * 12)}</dd></div>
                <div><dt>Expected life left</dt><dd>{duration(screening.age.chronologicalRemainingExpectedLifeMonths)}</dd></div>
                <div><dt>Replacement estimate</dt><dd>{money(screening.comparison.replacementEstimateMinor)}</dd></div>
                <div><dt>Repair share</dt><dd>{percentage(screening.comparison.repairToReplacementRatio)}</dd></div>
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
