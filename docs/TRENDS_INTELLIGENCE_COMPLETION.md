# Trends Intelligence and Usability Completion

**Status:** implemented completion contract
**Date:** September 9, 2026
**Authority:** `AGENTS.md`, the platform rebuild blueprint, and the focused Trends brief

## Analysis contract

Trends is a guided investigation workspace, not a decorative dashboard. The default view now presents compact scope/measure/date/comparison context, one main result, at most three deterministic evidence-backed findings, and an exact-value monthly chart. Separate views expose change drivers, store comparisons, vendor follow-through, planning, and source records without losing the active operating or maintenance scope.

Every result preserves the metric's actual source basis:

- Recorded work cost uses cost-line service dates and integer minor units.
- Linked invoice amount uses only confirmed allocations and remains distinct from invoice gross and recorded work cost.
- Work orders use creation time; visits use observed check-in; PM uses eligible occurrence-window results.
- Vendor response speed is calculated only for answered requests. Issuance-cohort coverage, outstanding count, overdue count, and response mix remain separate.
- Store and organization time zones determine displayed/local grouping dates.

Invalid or incompatible URL filters are removed with a visible notice instead of silently broadening the analysis.

## Historical vendor attribution

Recorded cost is attributed to the vendor observed on a linked visit on the service date or, when that evidence is absent, the latest assignment already in effect by the service date. Internal, ambiguous, and unattributed history stay explicit. A later reassignment cannot rewrite old cost history. Linked invoice amount continues to use the vendor named on the linked invoice, and vendor-response evidence uses the assignment that received the response.

## Equipment exposure and peer evidence

- Peer comparison uses the same replacement profile or taxonomy/equipment cohort at other accessible company stores; it is not an external industry benchmark.
- The reference window is stable for the selected analysis and aligns comparable calendar months.
- Install and retirement dates determine equipment-month exposure. Partial months are prorated by active days.
- Equipment exposure and recording coverage are independent. A quiet month contributes zero only when an explicit store/measure recording declaration covers that month and installation/retirement dates support exposure. A transaction alone establishes neither complete recording nor equipment-month exposure. Unknown coverage is excluded even when some source rows exist; those rows remain available as recorded evidence.
- The deterministic showcase declares August 2024 through August 25, 2026 recording coverage for each store and additive measure. The dense synthetic fixture declares its own generated window. Declarations persist as tenant-scoped `recording.coverage_attested` audit facts, with a source manifest that invalidates a declaration when required source records are missing. They are not inferred at query time.
- Declarations cover the complete store and measure, including equipment, taxonomy, provider and work-type subsets. Targets need covered recording windows too. Unknown target coverage and insufficient covered peer observations reduce eligibility and evidence-quality labels. Partial installation/retirement exposure remains prorated independently.
- Current activity after documented retirement is excluded from the comparable result and remains visibly outside the equipment match.
- Peer rates are winsorized, equal-store weighted, and accumulated into a descriptive monthly quartile range. The range is neither a prediction interval nor a failure probability.
- Expected values, comparable actuals, ranges, exclusions, equipment coverage, peer-store count, applicable reference months, and target equipment-months are labeled separately.

Opening comparison inputs exposes calculated contributions and raw historical source records. Each calculated row carries uncapped input, capped input, peer weight, target exposure, coverage state, contributing source IDs, and the exact underlying record links. Measured zero contributions state why zero is supported.

## Vendor accountability

The vendor panel uses one denominator row per outside-vendor assignment based on first issuance. Later authorization revisions do not inflate the cohort. Accepted, declined, proposed-date, question, and closed-without-response outcomes remain distinct. Cancelled or superseded assignments stay in historical coverage but are removed from currently outstanding/overdue counts. **Open exact outstanding assignments** opens one evidence row per assignment counted in the active first-issuance cohort, retaining the period and applicable location, taxonomy, equipment, component, vendor and work-type filters. Sorting, pagination and CSV preserve this evidence view; first issuance is the date basis, assignment IDs are stable source IDs, and counts are distinct from response hours and cost.

## Planning and export

**At recent pace** uses the latest twelve complete months independent of the visible 3/6/12/24-month chart. It is labeled as a simple planning scenario, never a budget, staffing commitment, forecast, or automatic action.

CSV export runs one consistently scoped analysis pass and contains stable source IDs, original timestamps, store-local dates, exact raw values, integer amount-minor values, currency, units, store/work/invoice/visit/PM IDs, taxonomy/equipment references, provider-attribution rule, peer calculation inputs, coverage status, contributing source IDs, and resolvable source links. Spreadsheet-formula prefixes are escaped.

## Usability and responsive access

Chart bars use their true proportional height; zero has a dedicated state and small non-zero values are not given a fake minimum. Exact values are visible above bars and in a mobile list, so hover is never required. Tables, filters, breadcrumbs, findings, and pagination preserve investigation context through drill-through and back navigation.

## Operational caveats

- Peer results are descriptive company evidence. Sparse cohorts correctly produce no reliable comparison.
- Missing installation dates or explicit recording declarations reduce comparison coverage. There is no new production coverage-authoring UI in this pass; existing persisted tenants without declarations remain unknown. A missing manifest row conservatively invalidates the entire declared store/measure window until source completeness is restored or explicitly re-attested.
- The vendor overdue threshold is currently the product's explicit 24-hour analysis rule; it is not a vendor contract promise.
- The planning scenario excludes the partial current month and cannot infer future large jobs, price changes, or capital events.
- Trends continues to consume the tenant-scoped persisted snapshot adapter. Larger-scale coverage verifies bounded rendered output and deterministic calculations; future warehouse/materialized-view work remains an operational scaling option, not a prerequisite for this preview.

## Verification coverage

Focused tests cover local-date grouping, metric reconciliation, invoice allocation basis, PM denominators, stable comparison windows, scope-preserving links, historical provider attribution, install/retire/unknown exposure, raw and calculated peer reconstruction, first-issuance cohorts, deterministic finding limits, planning-window independence, machine-precise export, role visibility, fail-closed location grants, invalid-filter disclosure, and a 65-store/36-month synthetic fixture.

## Verification results

The following checks ran successfully on September 9, 2026:

- `npm run db:seed` — deterministic 15-store/five-vendor showcase and 65-store scale fixture validated.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 115 files and 765 tests passed.
- `npm run test:e2e` — four files and 44 tests passed.
- `npm run build` — Vinext/Cloudflare preview build passed.
- `npm run build:render` — Next.js/Render portability build passed.

The browser walkthrough covered the Store manager and Maintenance / facilities scopes, invalid-filter disclosure, all six analysis views, supported and unsupported peer states, vendor issuance cohorts, independent planning history, exact source-record pagination/export access, and a true 390×844 viewport. The responsive Trends summary, filters, investigation trail, navigation, and planning panel remained readable and actionable. The browser console reported no warnings or errors.


## Focused review of 7047ebb

The completion pass separates recording coverage from exposure and replaces the broad vendor queue drill-down with exact issuance-cohort evidence. The July-only cost-history reproduction now yields **zero measured-zero peer contributions** and no unsupported reliable comparison. Complete declared fixtures retain legitimate quiet zeros and partial exposure.

Regression coverage includes removed history with stale declarations, absent measure-specific declarations despite transactions, independent coverage of other measures, quiet periods, partial target installation, exact assignment identities, revisions, superseded assignments, scope-preserving evidence URLs, and export units/date basis. Validation results for this local correction are recorded below; earlier results above describe the original implementation.

### Local correction validation — September 9, 2026

- `npm run db:seed`: passed (15 stores, five vendors, two internal technicians; separate 65-store fixture).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 115 files / 775 tests passed.
- `npm run test:e2e`: four files / 44 tests passed, including persisted PostgreSQL and public/workflow boundaries.
- `npm run build`: passed. Vinext emitted a nonfatal duplicate CSS output filename warning and plugin timing notices.
- Desktop and 390×844 browser validation covered quick acknowledgment, link/unlink, retained actor/time, unlinked follow-up access, related-work browsing, peer evidence, exact vendor assignment drill-down and preserved scope. The browser console contained no warnings or errors.
- Broader browser inspection covered manager search, the store creation form, successful work creation with classification and provider deferred, vendor response controls, service-link/QR/trusted-device visit entry, the no-WO reason path, invoice safeguards, PM/lifecycle views and responsive store detail. Cross-channel visit completion was verified by the automated workflow suite; live geolocation was not requested during this browser pass.

No push or deployment was performed. `dev4.log` was preserved. The separate Render build was not rerun for this correction.

## Coordinated completion follow-on

The PostgreSQL narrow snapshot now loads tenant-scoped `recording.coverage_attested` audit events explicitly rather than omitting the fixture declarations or loading general audit history. All three Trends entry loaders resolve the session organization before querying. Installation/retirement still describe equipment exposure only; the source measure and declared recording interval independently determine whether a quiet period is supported zero. Missing declarations, missing manifest rows, and incomplete older histories remain unsupported. The original July-only reproduction and neighboring legitimate quiet/partial-exposure cases remain regression-covered.

The persisted PostgreSQL-engine integration now exercises the bounded loader and benchmark model together with export rows. One local run measured 153 ms load + 144 ms model = 297 ms combined for the 15-store persisted fixture. This is not hosted network timing. Existing timing thresholds were not increased. Plain methodology was shortened while optional calculation details retain the percentile caps, quartile range, exposure and source definitions. See `WORKFLOW_ACCOUNTING_COMPLETION.md` for final check results.


## Accounting reporting correction — September 10, 2026

See [ACCOUNTING_REVIEW_CORRECTIONS.md](ACCOUNTING_REVIEW_CORRECTIONS.md). Linked invoice amount now uses canonical invoice/line allocations through `invoiceReporting`, with legacy references used only for identities absent from the canonical ledger. Corrected and unconfirmed amounts cannot reappear from stale references. Currencies are selected separately; rows preserve invoice date and allocation store/work/equipment, and open the exact allocation. Invoice detail opens a filtered Records view; broader comparisons require clearing the invoice filter. PostgreSQL and D1 use the same explicit source-table boundary and only recording-coverage audit events. Source completeness still does not follow from equipment installation dates or from one transaction.

## Connected drill-down validation — September 10, 2026

The Overview and Spending cost-source lists now keep date and taxonomy filters on bounded repository queries, calculate row amounts within the same filters, and open the actual Costs tab. Filtered invoice links reconcile to canonical allocations. Monthly PostgreSQL date queries are regression-tested alongside SQLite/D1 and the fixture. See [WORKFLOW_RELIABILITY_AUDIT.md](WORKFLOW_RELIABILITY_AUDIT.md). These navigation and loading changes do not change recording coverage, measured-zero eligibility, or equipment exposure.
