# Metric Catalog

**Status:** target semantic contract; current calculations are source-derived but not yet centralized/versioned

Every material number must define scope, period, date basis, cost basis, numerator, denominator, inclusion/exclusion rules, source entities, calculation version, freshness, confidence/coverage, and an exact drill-through query. UI components format metric results; they do not independently calculate executive totals.

## Status legend

- **Available:** a current source-derived projection exists, though it still needs migration into the centralized catalog.
- **Partial:** some required source facts or projections exist; the target definition cannot yet be calculated faithfully.
- **Target:** required but its governing source model is absent.

## Principal operating and financial metrics

| Metric ID | Definition | Status |
|---|---|---|
| `closed_loop_coverage_count` | Applicable Work Orders satisfying the versioned, work-type-specific completeness policy / all applicable Work Orders in period | Target |
| `closed_loop_coverage_spend` | Recognized cost of complete applicable Work Orders / recognized cost of all applicable Work Orders; zero-cost work is reported separately | Target |
| `recorded_work_cost` | Sum of included finalized/entered Cost Lines by service date, minor units and currency | Available |
| `authorized_amount` | Sum of governing Authorization ceilings/revisions for included work; never substitute estimate or invoice | Partial |
| `linked_invoice_amount` | Sum of confirmed invoice allocations in scope; allocations count once | Available foundation |
| `unmatched_invoice_amount` | Invoice gross/line amount less confirmed allocations, including unallocated/under-review balance | Available foundation |
| `authorization_variance` | Invoiced or reviewed amount minus governing Authorized Ceiling, reported only on comparable scope/currency | Partial |
| `warranty_covered_amount` | Final line amounts classified to provider/manufacturer coverage after diagnosis/decision | Target |
| `realized_value` | Sum of approved realized Value Events; excludes exposure and opportunity | Target |
| `identified_exposure` | Sum or count of open reviewed exposure events, always labeled non-realized | Target |
| `estimated_opportunity` | Versioned estimate of possible benefit with confidence and caveats; never included in realized value | Target |

## Service and vendor metrics

| Metric ID | Numerator / denominator or measure | Required exclusions/context | Status |
|---|---|---|---|
| `vendor_response_time` | Median elapsed issuance-to-first-response duration | Manual responses are attributed; show timed coverage | Available foundation |
| `vendor_acceptance_rate` | Accepted / (accepted + declined) issued authorizations | Questions/date proposals excluded from terminal denominator | Available foundation |
| `first_observed_resolution_rate` | Work Orders whose first eligible Site Visit outcome indicates resolved completion / Work Orders with an eligible first visit | Evidence is an observed claim, not certified repair; exclude no-access/customer cancellation | Partial |
| `callback_rate` | Eligible completed repairs with related return/callback in policy window / eligible completed repairs | Customer-caused/approved planned returns excluded by reason | Target |
| `evidence_completeness_rate` | Visits meeting versioned evidence policy / eligible visits | Policy varies by work type/channel | Partial |
| `no_access_rate` | Eligible visits with structured no-access outcome / eligible visits | Show store/customer/vendor reason attribution | Target |
| `vendor_no_show_rate` | Missed committed appointments attributable to provider / eligible committed appointments | Customer reschedule/access and force majeure excluded | Target |
| `work_orders_per_site_visit` | Count of SiteVisitWorkOrder links / count of eligible Site Visits | Requires multi-WO visit model | Target |
| `service_run_acceptance_rate` | Accepted Service Runs / terminally answered proposed Runs | Counterproposal is reported separately | Target |
| `sla_breach_rate` | Breached clock instances / eligible clock instances | Policy/calendar/version and paused time shown | Target |

Vendor scorecards also require assignment response, schedule confirmation, arrival, completion, first-time fix, PM timeliness, warranty response, rate-card variance, discrepancy outcome, counterproposal behavior, and capacity reliability. Every score shows numerator, denominator, target, period, sample size, exclusions, definition version, and source records. Do not penalize a Vendor for structured customer/manufacturer causes.

## PM and lifecycle metrics

| Metric ID | Definition | Status |
|---|---|---|
| `pm_on_time_rate` | Occurrences completed early/on time / occurrences due in the reporting window; missed/late remain in denominator, waived/canceled shown separately | Partial; current occurrence states cannot preserve the full distinction |
| `pm_at_risk_rate` | Open occurrences forecast to miss window / open occurrences with an active window | Target |
| `failures_per_100_asset_months` | Eligible failure events / active exposure months × 100 | Target |
| `component_replacements_per_100_asset_months` | Structured Component replacement events / exposure months × 100 | Target |
| `component_life_ratio` | Actual installed-to-removed life / expected-life reference for comparable Component | Target |
| `trailing_repair_spend` | Related recorded Work Order cost over exact 12/24/36-month windows | Available foundation |
| `repair_to_replacement_share` | Current repair amount / effective-dated replacement benchmark | Partial; transparent lifecycle projection exists |
| `pm_effectiveness` | Versioned before/after or comparable-cohort outcomes with sample size and confounders | Target; no causal claim from completion alone |

Weather-normalized metrics are target-only and apply only through a controlled relevance map, adequate samples, source provider/version, exposure window, cohort, confidence, and exclusions. Weather is context, never sole causation.

## Adoption metrics

Track the share of maintenance intake entering the platform, eligible visits captured, completed work with Asset association, repairs with structured Repair Items, eligible repairs with Applied Warranty, invoices matched to authorized work, PM occurrences scheduled/completed in platform, verification completion, active owner/operator use, and open Work Orders with a valid accountable owner/task. Current fixtures can illustrate some counts; production adoption requires real identity and event telemetry and is therefore partial or target.

## Closed-Loop Maintenance Coverage

This is the primary target operating metric. The policy is versioned and conditional by work type. Candidate requirements include source intake/PM, accountable owner and task/SLA history, approved assignment, Contract Version or exception, Site Visit when attendance occurred, per-WO outcome, required evidence, Asset/unknown-Asset disposition, Repair Item/warranty when applicable, Quote/Authorization when required, expected invoice match, customer verification, resolution/closure reason, and complete audit history.

The result must return failed requirement codes per Work Order. A percentage without a missing-requirement drill-through is invalid.

## Query and presentation contract

- Apply `organization_id`, granted scope, period, and source date basis before aggregation.
- Use indexed/bounded queries or governed read models; never ship a tenant snapshot to calculate a KPI in the browser.
- Keep Unclassified, Unmatched, Unknown, and low-confidence buckets visible.
- Preserve exact filter tokens through chart/table drill-down and reconcile source totals.
- Version definitions and snapshots; policy edits must not rewrite historical published reports.
- Display freshness, sample size, numerator/denominator, currency/cost basis, and material exclusions near the number.
- Do not compare Stores, Vendors, Assets, or cohorts with incompatible exposure or denominators.

The current large operator presenter contains several compatible calculations, but there is no persisted `MetricDefinition` catalog or centralized semantic service. Those calculations are migration inputs, not proof that the target metric architecture is complete.
