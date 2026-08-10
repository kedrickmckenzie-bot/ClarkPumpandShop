"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  History,
  PackageSearch,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import {
  DEFAULT_LIFECYCLE_ANALYTICS_POLICY,
  formatMoney,
  getUpcomingLifecycleCapexProjection,
  listAssetLifecycleDecisionFacts,
  type AssetLifecycleDecisionFacts,
  type LifecycleCapexPlanDraft,
  type LifecycleCapexProjectionRow,
} from "../../lib/cstore/analytics";
import type { DemoDataset, RecordScope } from "../../lib/cstore/types";
import styles from "./lifecycle-planning.module.css";

export type LifecyclePlanningTab = "review" | "capex" | "equipment";

export type LifecycleCapexDraftMap = Record<string, LifecycleCapexPlanDraft>;

export interface LifecyclePlanningProps {
  dataset: DemoDataset;
  tab: LifecyclePlanningTab;
  onTabChange: (tab: LifecyclePlanningTab) => void;
  capexDrafts: LifecycleCapexDraftMap;
  onCapexDraftsChange: (drafts: LifecycleCapexDraftMap) => void;
  onOpenAsset: (assetId: string) => void;
  scope?: RecordScope;
  canManage?: boolean;
  className?: string;
}

interface ReviewSignal {
  key: string;
  text: string;
}

const planHorizonYears = 5;

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function formatDate(value?: string) {
  if (!value) return "Not entered";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function warrantyLabel(facts: AssetLifecycleDecisionFacts) {
  if (facts.warranty.status === "active") return `Warranty through ${formatDate(facts.warranty.endsOn)}`;
  if (facts.warranty.status === "expired") return `Warranty ended ${formatDate(facts.warranty.endsOn)}`;
  if (facts.warranty.status === "not_started") return `Warranty starts ${formatDate(facts.warranty.startsOn)}`;
  if (facts.warranty.status === "not_recorded") return "No warranty entered";
  return "Warranty dates need review";
}

function pmLabel(facts: AssetLifecycleDecisionFacts) {
  const pm = facts.pm.trailing12Months;
  if (!facts.pm.planCount) return "No PM plan entered";
  if (!pm.occurrenceCount) return `${facts.pm.activePlanCount} active PM ${facts.pm.activePlanCount === 1 ? "plan" : "plans"}`;
  const dueCount = pm.completedCount + pm.skippedCount + pm.overdueCount + pm.dueCount;
  return `${pm.completedCount} of ${dueCount} PM occurrences completed${pm.overdueCount ? ` · ${pm.overdueCount} overdue` : ""}`;
}

function coreReviewSignals(facts: AssetLifecycleDecisionFacts): ReviewSignal[] {
  const codes = new Set(facts.reviewReasons.map((reason) => reason.code));
  const signals: ReviewSignal[] = [];
  const activity = facts.reactiveActivity.trailing12Months;
  const recorded12 = facts.costs.trailing12Months.recordedMinor;
  const recorded24 = facts.costs.trailing24Months.recordedMinor;
  const replacement = facts.currentReplacementEstimateMinor;
  const recordedShare12 = percent(recorded12, replacement);
  const recordedShare24 = percent(recorded24, replacement);

  if (codes.has("expected_life_reference_reached")) {
    signals.push({
      key: "life-reached",
      text: `${facts.assetAgeYears ?? "Unknown"} years old against an entered ${facts.expectedLifeYears}-year typical life`,
    });
  } else if (codes.has("expected_life_reference_near")) {
    signals.push({
      key: "life-near",
      text: `Age is approaching the entered ${facts.expectedLifeYears}-year typical life`,
    });
  }

  if (codes.has("reactive_work_order_volume")) {
    signals.push({
      key: "reactive-work",
      text: `${activity.distinctWorkOrderCount} reactive work orders and ${activity.distinctVisitCount} observed visits in 12 months`,
    });
  }

  for (const recurrence of facts.confirmedComponentRecurrences.trailing12Months) {
    signals.push({
      key: `component-${recurrence.componentId}`,
      text: `${recurrence.componentName} appears on ${recurrence.distinctWorkOrderCount} completed work orders`,
    });
  }

  if (recordedShare12 >= DEFAULT_LIFECYCLE_ANALYTICS_POLICY.cleanCostShare12MonthsPercentage) {
    signals.push({
      key: "recorded-cost-12",
      text: `${formatMoney(recorded12)} recorded work cost in 12 months is ${recordedShare12}% of the current replacement estimate`,
    });
  } else if (recordedShare24 >= DEFAULT_LIFECYCLE_ANALYTICS_POLICY.cleanCostShare24MonthsPercentage) {
    signals.push({
      key: "recorded-cost-24",
      text: `${formatMoney(recorded24)} recorded work cost in 24 months is ${recordedShare24}% of the current replacement estimate`,
    });
  }

  if (codes.has("temporary_or_unresolved_work")) {
    signals.push({
      key: "follow-up",
      text: `${activity.temporaryOrUnresolvedWorkOrderIds.length} recent work ${activity.temporaryOrUnresolvedWorkOrderIds.length === 1 ? "order has" : "orders have"} a temporary, waiting-parts, or unresolved outcome`,
    });
  }

  if (codes.has("pm_overdue")) {
    signals.push({
      key: "pm-overdue",
      text: `${facts.pm.trailing12Months.overdueCount} preventive-maintenance ${facts.pm.trailing12Months.overdueCount === 1 ? "visit is" : "visits are"} overdue`,
    });
  }

  return signals;
}

function storeLabel(dataset: DemoDataset, storeId: string) {
  const store = dataset.stores.find((record) => record.id === storeId);
  return store ? `Store ${store.storeNumber} · ${store.address.city}` : "Store not found";
}

function categoryLabel(dataset: DemoDataset, categoryId: string) {
  return dataset.categories.find((record) => record.id === categoryId)?.label ?? "Unclassified";
}

function capexRowForFacts(
  dataset: DemoDataset,
  facts: AssetLifecycleDecisionFacts,
  currentYear: number,
): LifecycleCapexProjectionRow | undefined {
  if (!facts.expectedReplacementOn || !facts.expectedReplacementYear) return undefined;
  const store = dataset.stores.find((record) => record.id === facts.asset.storeId);
  return {
    rowId: `lifecycle-capex-${facts.asset.id}`,
    assetId: facts.asset.id,
    storeId: facts.asset.storeId,
    regionId: store?.regionId,
    categoryId: facts.asset.categoryId,
    assetCode: facts.asset.assetCode,
    assetName: facts.asset.name,
    expectedReplacementOn: facts.expectedReplacementOn,
    expectedReplacementYear: facts.expectedReplacementYear,
    currentReplacementEstimateMinor: facts.currentReplacementEstimateMinor,
    currency: facts.currency,
    draft: {
      include: true,
      targetYear: Math.max(currentYear, facts.expectedReplacementYear),
      amountMinor: facts.currentReplacementEstimateMinor,
      note: "",
    },
    sourceRecordIds: [facts.asset.id],
  };
}

export function LifecyclePlanning({
  dataset,
  tab,
  onTabChange,
  capexDrafts,
  onCapexDraftsChange,
  onOpenAsset,
  scope = {},
  canManage = true,
  className,
}: LifecyclePlanningProps) {
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const asOfYear = new Date(dataset.asOf).getUTCFullYear();
  const currentYear = Number.isFinite(asOfYear) ? asOfYear : new Date().getUTCFullYear();
  const endYear = currentYear + planHorizonYears - 1;

  const allFacts = useMemo(
    () => listAssetLifecycleDecisionFacts(dataset, dataset.organization.id, scope),
    [dataset, scope],
  );
  const projection = useMemo(
    () => getUpcomingLifecycleCapexProjection(dataset, dataset.organization.id, {
      regionId: scope.regionId,
      storeId: scope.storeId,
      categoryId: scope.categoryId,
      vendorId: scope.vendorId,
      assetId: scope.assetId,
      startYear: currentYear,
      endYear,
    }),
    [currentYear, dataset, endYear, scope.assetId, scope.categoryId, scope.regionId, scope.storeId, scope.vendorId],
  );

  const reviewFacts = useMemo(
    () => allFacts
      .map((facts) => ({ facts, signals: coreReviewSignals(facts) }))
      .filter((record) => record.signals.length > 0)
      .sort((left, right) => {
        const leftComponent = left.facts.confirmedComponentRecurrences.trailing12Months.length > 0 ? 1 : 0;
        const rightComponent = right.facts.confirmedComponentRecurrences.trailing12Months.length > 0 ? 1 : 0;
        return rightComponent - leftComponent ||
          right.facts.costs.trailing24Months.recordedMinor - left.facts.costs.trailing24Months.recordedMinor ||
          left.facts.asset.assetCode.localeCompare(right.facts.asset.assetCode);
      }),
    [allFacts],
  );

  const capexRows = useMemo(() => {
    const baseRows = [...projection.overdueRows, ...projection.yearBuckets.flatMap((bucket) => bucket.rows)];
    const baseIds = new Set(baseRows.map((row) => row.assetId));
    const explicitlyPlanned = allFacts
      .filter((facts) => Boolean(capexDrafts[facts.asset.id]) && !baseIds.has(facts.asset.id))
      .map((facts) => capexRowForFacts(dataset, facts, currentYear))
      .filter((row): row is LifecycleCapexProjectionRow => Boolean(row));
    return [...baseRows, ...explicitlyPlanned];
  }, [allFacts, capexDrafts, currentYear, dataset, projection.overdueRows, projection.yearBuckets]);

  function effectiveDraft(row: LifecycleCapexProjectionRow) {
    return capexDrafts[row.assetId] ?? row.draft;
  }

  function updateDraft(assetId: string, patch: Partial<LifecycleCapexPlanDraft>) {
    const row = capexRows.find((candidate) => candidate.assetId === assetId);
    const facts = allFacts.find((candidate) => candidate.asset.id === assetId);
    const fallback: LifecycleCapexPlanDraft = row?.draft ?? {
      include: true,
      targetYear: Math.max(currentYear, facts?.expectedReplacementYear ?? currentYear),
      amountMinor: facts?.currentReplacementEstimateMinor ?? 0,
      note: "",
    };
    onCapexDraftsChange({
      ...capexDrafts,
      [assetId]: { ...(capexDrafts[assetId] ?? fallback), ...patch },
    });
  }

  function addToCapex(facts: AssetLifecycleDecisionFacts) {
    const row = capexRows.find((candidate) => candidate.assetId === facts.asset.id);
    const current = capexDrafts[facts.asset.id] ?? row?.draft ?? {
      include: true,
      targetYear: Math.max(currentYear, facts.expectedReplacementYear ?? currentYear),
      amountMinor: facts.currentReplacementEstimateMinor,
      note: "",
    };
    onCapexDraftsChange({ ...capexDrafts, [facts.asset.id]: { ...current, include: true } });
    onTabChange("capex");
  }

  const yearSummaries = Array.from({ length: planHorizonYears }, (_, index) => {
    const year = currentYear + index;
    const includedRows = capexRows.filter((row) => {
      const draft = effectiveDraft(row);
      return draft.include && draft.targetYear === year;
    });
    return {
      year,
      amountMinor: includedRows.reduce((sum, row) => sum + effectiveDraft(row).amountMinor, 0),
      assetCount: includedRows.length,
    };
  });
  const plannedRows = capexRows.filter((row) => effectiveDraft(row).include);
  const fiveYearAmount = plannedRows
    .filter((row) => effectiveDraft(row).targetYear >= currentYear && effectiveDraft(row).targetYear <= endYear)
    .reduce((sum, row) => sum + effectiveDraft(row).amountMinor, 0);

  const normalizedSearch = equipmentSearch.trim().toLowerCase();
  const filteredEquipment = allFacts.filter((facts) => {
    if (!normalizedSearch) return true;
    const store = dataset.stores.find((record) => record.id === facts.asset.storeId);
    const category = dataset.categories.find((record) => record.id === facts.asset.categoryId);
    return [
      facts.asset.assetCode,
      facts.asset.name,
      facts.asset.assetType,
      facts.asset.manufacturer,
      facts.asset.model,
      facts.asset.serialNumber,
      facts.asset.locationDetail,
      store?.storeNumber,
      store?.name,
      store?.normalizedAddress,
      store?.address.city,
      category?.label,
      ...facts.asset.searchTerms,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
  });

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")}>
      <nav className={styles.tabs} aria-label="Lifecycle planning views">
        <button type="button" data-active={tab === "review"} aria-current={tab === "review" ? "page" : undefined} onClick={() => onTabChange("review")}>Repair vs. replace</button>
        <button type="button" data-active={tab === "capex"} aria-current={tab === "capex" ? "page" : undefined} onClick={() => onTabChange("capex")}>Upcoming CapEx</button>
        <button type="button" data-active={tab === "equipment"} aria-current={tab === "equipment" ? "page" : undefined} onClick={() => onTabChange("equipment")}>All equipment</button>
      </nav>

      {tab === "review" ? (
        <>
          <section className={styles.summaryGrid} aria-label="Repair or replace review summary">
            <article className={styles.summaryCard}>
              <span><ClipboardList aria-hidden="true" /> Histories to review</span>
              <strong>{reviewFacts.length}</strong>
              <small>Equipment with age, work, component, cost, follow-up, or PM facts worth reviewing together.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><CircleDollarSign aria-hidden="true" /> Recorded work cost</span>
              <strong>{formatMoney(reviewFacts.reduce((sum, record) => sum + record.facts.costs.trailing24Months.recordedMinor, 0))}</strong>
              <small>Completed-work cost entered on these equipment records in the trailing 24 months.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><Wrench aria-hidden="true" /> Reactive work</span>
              <strong>{reviewFacts.reduce((sum, record) => sum + record.facts.reactiveActivity.trailing12Months.distinctWorkOrderCount, 0)}</strong>
              <small>Distinct reactive work orders across these records in the trailing 12 months.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><PackageSearch aria-hidden="true" /> Same-component history</span>
              <strong>{reviewFacts.filter((record) => record.facts.confirmedComponentRecurrences.trailing12Months.length > 0).length}</strong>
              <small>Equipment with the same tracked component linked to multiple completed work orders.</small>
            </article>
          </section>

          {reviewFacts.length ? (
            <div className={styles.reviewList}>
              {reviewFacts.map(({ facts, signals }) => {
                const activity = facts.reactiveActivity.trailing12Months;
                const recurrence = facts.confirmedComponentRecurrences.trailing12Months[0];
                const optionalInvoiceAmount = facts.costs.trailing24Months.needsReviewInvoiceMinor;
                const row = capexRows.find((candidate) => candidate.assetId === facts.asset.id);
                const inPlan = Boolean(row && effectiveDraft(row).include);
                return (
                  <article className={styles.reviewCard} key={facts.asset.id}>
                    <header className={styles.reviewHeader}>
                      <div>
                        <h2>{facts.asset.name}</h2>
                        <p>{storeLabel(dataset, facts.asset.storeId)} · {categoryLabel(dataset, facts.asset.categoryId)} · {facts.asset.assetCode}</p>
                      </div>
                      <span className={styles.reviewBadge}>History to review</span>
                    </header>

                    <div className={styles.facts}>
                      <div className={styles.fact}>
                        <span>Recorded work cost</span>
                        <strong>{formatMoney(facts.costs.trailing12Months.recordedMinor)}</strong>
                        <small>12 months · {formatMoney(facts.costs.trailing24Months.recordedMinor)} over 24 months</small>
                      </div>
                      <div className={styles.fact}>
                        <span>Reactive activity</span>
                        <strong>{activity.distinctWorkOrderCount} work · {activity.distinctVisitCount} visits</strong>
                        <small>{pmLabel(facts)}</small>
                      </div>
                      <div className={styles.fact}>
                        <span>Same-component history</span>
                        <strong>{recurrence ? `${recurrence.distinctWorkOrderCount} work orders` : "None recorded"}</strong>
                        <small>{recurrence ? `${recurrence.componentName} · no cause inferred` : "No component appears on multiple completed work orders"}</small>
                      </div>
                      <div className={styles.fact}>
                        <span>Age and typical life</span>
                        <strong>{facts.assetAgeYears == null ? "Age not available" : `${facts.assetAgeYears} years`}</strong>
                        <small>{facts.expectedLifeYears}-year entered typical life · {warrantyLabel(facts)}</small>
                      </div>
                      <div className={styles.fact}>
                        <span>Replacement estimate</span>
                        <strong>{formatMoney(facts.currentReplacementEstimateMinor)}</strong>
                        <small>Typical-life date {formatDate(facts.expectedReplacementOn)} · editable in CapEx</small>
                      </div>
                    </div>

                    <div className={styles.reviewBody}>
                      <div className={styles.reasonList} aria-label="Facts behind this review">
                        {signals.map((signal) => <span key={signal.key}>{signal.text}</span>)}
                        {optionalInvoiceAmount > 0 ? (
                          <span>Optional invoice reconciliation: {formatMoney(optionalInvoiceAmount)} in linked invoice entries still needs review and is not included in the recorded work cost above.</span>
                        ) : null}
                      </div>
                      <div className={styles.actions}>
                        <button type="button" onClick={() => onOpenAsset(facts.asset.id)}><History aria-hidden="true" /> Open full history</button>
                        <button type="button" disabled={!canManage} onClick={() => addToCapex(facts)}><CalendarRange aria-hidden="true" /> {inPlan ? "View in CapEx" : "Add to CapEx"}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <ShieldCheck aria-hidden="true" />
              <div><strong>No equipment history is flagged in this scope</strong><p>All equipment remains available under All equipment. Invoice entry is not required for this review.</p></div>
            </div>
          )}
        </>
      ) : null}

      {tab === "capex" ? (
        <>
          <section className={styles.summaryGrid} aria-label="Upcoming capital planning summary">
            <article className={styles.summaryCard}>
              <span><CircleDollarSign aria-hidden="true" /> Five-year working total</span>
              <strong>{formatMoney(fiveYearAmount)}</strong>
              <small>Included equipment using the editable year and amount below.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><Gauge aria-hidden="true" /> Included equipment</span>
              <strong>{plannedRows.length}</strong>
              <small>{capexRows.length - plannedRows.length} equipment records are currently excluded from this working plan.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><CalendarRange aria-hidden="true" /> Past typical-life date</span>
              <strong>{projection.overdueRows.length}</strong>
              <small>Based on installation date plus the entered typical-life value, not a failure prediction.</small>
            </article>
            <article className={styles.summaryCard}>
              <span><PackageSearch aria-hidden="true" /> Date unavailable</span>
              <strong>{projection.unprojectableAssetIds.length}</strong>
              <small>Equipment without enough entered information for a typical-life planning date.</small>
            </article>
          </section>

          <section className={styles.yearGrid} aria-label="Capital plan by year">
            {yearSummaries.map((summary) => (
              <article className={styles.yearCard} key={summary.year}>
                <span>{summary.year}</span>
                <strong>{formatMoney(summary.amountMinor)}</strong>
                <small>{summary.assetCount} {summary.assetCount === 1 ? "equipment record" : "equipment records"}</small>
              </article>
            ))}
          </section>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <h2>Upcoming CapEx working plan</h2>
                <p>Starting dates come from installation date plus entered typical life. Choose what to include, then change the year, budget amount, or note. Nothing here makes the repair-or-replace decision for you.</p>
              </div>
            </header>
            {capexRows.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Include</th>
                      <th scope="col">Equipment</th>
                      <th scope="col">Typical-life date</th>
                      <th scope="col">Plan year</th>
                      <th scope="col">Working amount</th>
                      <th scope="col">Planning note</th>
                      <th scope="col">History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...capexRows]
                      .sort((left, right) => effectiveDraft(left).targetYear - effectiveDraft(right).targetYear || left.assetCode.localeCompare(right.assetCode))
                      .map((row) => {
                        const draft = effectiveDraft(row);
                        return (
                          <tr key={row.rowId}>
                            <td><input className={styles.check} type="checkbox" checked={draft.include} disabled={!canManage} aria-label={`Include ${row.assetName} in the working capital plan`} onChange={(event) => updateDraft(row.assetId, { include: event.target.checked })} /></td>
                            <td><strong>{row.assetName}</strong><small>{storeLabel(dataset, row.storeId)} · {row.assetCode}</small></td>
                            <td><strong>{formatDate(row.expectedReplacementOn)}</strong><small>From entered typical life</small></td>
                            <td>
                              <select className={styles.select} value={draft.targetYear} disabled={!canManage} aria-label={`Plan year for ${row.assetName}`} onChange={(event) => updateDraft(row.assetId, { targetYear: Number(event.target.value) })}>
                                {Array.from({ length: 11 }, (_, index) => currentYear + index).map((year) => <option key={year} value={year}>{year}</option>)}
                              </select>
                            </td>
                            <td><input className={`${styles.input} ${styles.amountInput}`} type="number" min="0" step="100" value={draft.amountMinor / 100} disabled={!canManage} aria-label={`Working replacement amount in dollars for ${row.assetName}`} onChange={(event) => updateDraft(row.assetId, { amountMinor: Math.max(0, Math.round((Number(event.target.value) || 0) * 100)) })} /></td>
                            <td><input className={styles.input} type="text" value={draft.note} disabled={!canManage} placeholder="Optional note" aria-label={`Planning note for ${row.assetName}`} onChange={(event) => updateDraft(row.assetId, { note: event.target.value })} /></td>
                            <td><button type="button" onClick={() => onOpenAsset(row.assetId)}>Open <ChevronRight aria-hidden="true" /></button></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.empty}><CalendarRange aria-hidden="true" /><div><strong>No equipment falls inside this five-year window</strong><p>Add equipment from Repair vs. replace or review every record under All equipment.</p></div></div>
            )}
          </article>
        </>
      ) : null}

      {tab === "equipment" ? (
        <>
          <section className={styles.summaryGrid} aria-label="Equipment lifecycle summary">
            <article className={styles.summaryCard}><span><Gauge aria-hidden="true" /> Equipment records</span><strong>{allFacts.length}</strong><small>Equipment in the current operating scope.</small></article>
            <article className={styles.summaryCard}><span><CircleDollarSign aria-hidden="true" /> Replacement estimates</span><strong>{formatMoney(allFacts.reduce((sum, facts) => sum + facts.currentReplacementEstimateMinor, 0))}</strong><small>Current entered estimates across this equipment list.</small></article>
            <article className={styles.summaryCard}><span><ShieldCheck aria-hidden="true" /> Warranty entered</span><strong>{allFacts.filter((facts) => facts.warranty.status !== "not_recorded").length}</strong><small>Equipment with supplier warranty details available.</small></article>
            <article className={styles.summaryCard}><span><Wrench aria-hidden="true" /> Reactive work in 12 months</span><strong>{allFacts.reduce((sum, facts) => sum + facts.reactiveActivity.trailing12Months.distinctWorkOrderCount, 0)}</strong><small>Distinct work orders linked to an equipment record.</small></article>
          </section>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div><h2>All equipment</h2><p>Search by store, address, service area, equipment name, asset code, manufacturer, model, or serial number.</p></div>
              <div><Search aria-hidden="true" /><input className={styles.input} type="search" value={equipmentSearch} aria-label="Search all equipment" placeholder="Search equipment or store" onChange={(event) => setEquipmentSearch(event.target.value)} /></div>
            </header>
            {filteredEquipment.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th scope="col">Equipment</th><th scope="col">Store</th><th scope="col">Service area</th><th scope="col">Model and serial</th><th scope="col">Age and typical life</th><th scope="col">24-month recorded cost</th><th scope="col">Replacement estimate</th><th scope="col">History</th></tr></thead>
                  <tbody>
                    {filteredEquipment.map((facts) => (
                      <tr key={facts.asset.id}>
                        <td><strong>{facts.asset.name}</strong><small>{facts.asset.assetCode} · {facts.asset.locationDetail}</small></td>
                        <td><strong>{storeLabel(dataset, facts.asset.storeId)}</strong><small>{dataset.stores.find((store) => store.id === facts.asset.storeId)?.normalizedAddress}</small></td>
                        <td><strong>{categoryLabel(dataset, facts.asset.categoryId)}</strong><small>{facts.asset.assetType}</small></td>
                        <td><strong>{facts.asset.manufacturer} {facts.asset.model}</strong><small>Serial {facts.asset.serialNumber}</small></td>
                        <td><strong>{facts.assetAgeYears == null ? "Age unavailable" : `${facts.assetAgeYears} years`}</strong><small>{facts.expectedLifeYears}-year entered typical life · {warrantyLabel(facts)}</small></td>
                        <td><strong>{formatMoney(facts.costs.trailing24Months.recordedMinor)}</strong><small>{facts.reactiveActivity.trailing24Months.distinctWorkOrderCount} reactive work orders</small></td>
                        <td><strong>{formatMoney(facts.currentReplacementEstimateMinor)}</strong><small>Typical-life date {formatDate(facts.expectedReplacementOn)}</small></td>
                        <td><button type="button" onClick={() => onOpenAsset(facts.asset.id)}>Open <ChevronRight aria-hidden="true" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.empty}><Search aria-hidden="true" /><div><strong>No equipment matches “{equipmentSearch}”</strong><p>Try a store number, address, asset code, model, serial number, or service area.</p></div></div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
