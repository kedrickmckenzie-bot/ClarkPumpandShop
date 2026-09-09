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
- A quiet month is a measured zero only when lifecycle dates prove exposure. Missing installation history is excluded rather than converted to zero.
- Current activity after documented retirement is excluded from the comparable result and remains visibly outside the equipment match.
- Peer rates are winsorized, equal-store weighted, and accumulated into a descriptive monthly quartile range. The range is neither a prediction interval nor a failure probability.
- Expected values, comparable actuals, ranges, exclusions, equipment coverage, peer-store count, applicable reference months, and target equipment-months are labeled separately.

Opening comparison inputs exposes calculated contributions and raw historical source records. Each calculated row carries uncapped input, capped input, peer weight, target exposure, coverage state, contributing source IDs, and the exact underlying record links. Measured zero contributions state why zero is supported.

## Vendor accountability

The vendor panel uses one denominator row per outside-vendor assignment based on first issuance. Later authorization revisions do not inflate the cohort. Accepted, declined, proposed-date, question, and closed-without-response outcomes remain distinct. Cancelled or superseded assignments stay in historical coverage but are removed from currently outstanding/overdue counts.

## Planning and export

**At recent pace** uses the latest twelve complete months independent of the visible 3/6/12/24-month chart. It is labeled as a simple planning scenario, never a budget, staffing commitment, forecast, or automatic action.

CSV export runs one consistently scoped analysis pass and contains stable source IDs, original timestamps, store-local dates, exact raw values, integer amount-minor values, currency, units, store/work/invoice/visit/PM IDs, taxonomy/equipment references, provider-attribution rule, peer calculation inputs, coverage status, contributing source IDs, and resolvable source links. Spreadsheet-formula prefixes are escaped.

## Usability and responsive access

Chart bars use their true proportional height; zero has a dedicated state and small non-zero values are not given a fake minimum. Exact values are visible above bars and in a mobile list, so hover is never required. Tables, filters, breadcrumbs, findings, and pagination preserve investigation context through drill-through and back navigation.

## Operational caveats

- Peer results are descriptive company evidence. Sparse cohorts correctly produce no reliable comparison.
- Missing install dates reduce comparison coverage until lifecycle history is supplied.
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
