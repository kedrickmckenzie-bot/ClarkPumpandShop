# Demo UX and planning recommendation — September 15, 2026

Status: researched recommendation, not implemented. User asked for a clearer work history, equipment browsing, companywide vendor dashboard and more useful spending/planning, then delegated the product recommendation after research. Desktop first; vendor check-in/out remains the only mobile acceptance requirement. User confirmed Render access works.

## Research and decision

Fiix recommends using 12–24 months of history alongside scheduled maintenance, unplanned repairs, capital needs and equipment age; periodically revising the forecast. ServiceChannel separates budget, incurred cost and forecast, supports fiscal periods and location/trade scope, and warns against overlapping budget lines. Its provider guidance separates speed, quality, engagement and comparable cost, acknowledging circumstances outside the vendor's control.

Primary sources, reviewed September 15, 2026:
- https://fiixsoftware.com/blog/how-to-budget-and-forecast-for-maintenace-teams/
- https://servicechannel.atlassian.net/wiki/spaces/SCU/pages/4492591106/Budget%2BInsights%2BQuick%2BReference%2Band%2BFAQs
- https://servicechannel.com/provider-scores/
- https://servicechannel.com/function/finance/

Product recommendation (our synthesis, not a claim that these sources prescribe our UI): keep spending analysis and planning separate, with simple routes from a question to supporting records. Use recorded maintenance costs rather than implying complete accounting actuals. Keep existing store comparisons; add decisions, not more copies of the same chart. Do not copy payment/AP features or composite vendor scores from competitors.

## Work

Primary views: Active / History / All work. History contains closed/cancelled work with those statuses distinguishable. Active status and history date controls are separate. Preserve the chosen store/vendor/search when moving views, reset pagination, and visibly remove incompatible status filters. Dates state their basis (created/completed/cost date) explicitly. Keep special source drill-through context intact; never silently default a cost source link to active work. Put rarely used filters under More filters, keep applied chips and Clear filters visible. Saved views secondary. Make the record's service timeline distinct from its audit log.

## Equipment

Primary views: All equipment / By type / By store. Needs attention is a filter, not the only landing story. Types use the configured asset taxonomy/type, not fuzzy name matching; accept gas pumps as a search alias for dispensers. A type opens exact equipment across allowed stores. A store opens its equipment inventory. Preserve scope and breadcrumbs; show unclassified equipment. Keep status, model/serial, store and latest relevant service easily scanned. Use bounded scoped queries; do not build another full-tenant browser container.

## Vendors

Primary views: Overview / Directory. Companywide for companywide managers; scoped for regional/store roles. Make discovery explicit and explain package limitations rather than silently making the dashboard disappear. Overview shows recorded work cost, active work, overdue responses, response time, visit evidence coverage and unresolved outcomes, with denominators and exact sources. Compare like trades and work types; do not rank landscaping against refrigeration by average invoice. Return visits are facts, not proof of poor workmanship; first-visit resolution requires verified outcome evidence. No opaque overall score.

## Spending and planning

Keep two clear views: Spending (what happened/what changed) and Plan (what is coming/what to decide). Retain Compare stores inside Spending. Lead with actionable evidence: recurring equipment work, one-off large repairs, planned/reactive cost mix and missing cost coverage, linking to exact records. Do not label all repeat work avoidable or promise savings without proof.

Plan shows separate operating and replacement sections, monthly timing, and a target only when the user supplies one. Without a target, say No budget set; do not invent an over/under-budget verdict.

Operating plan components:
1. Scheduled PM: priced occurrences/contracts in the chosen horizon. Missing prices are visible, not zero.
2. Open work: approved or estimated remaining work with the basis visible; NTE is a ceiling, not automatically expected spend. Reconcile already-recorded cost and avoid counting the same job again through PM or invoices.
3. Future unplanned repair allowance: comparable history separated from PM, capital and user-identified one-offs, adjusted for store exposure and season only where history supports it. Show months/records of coverage and an editable assumption. Do not present a statistical confidence interval without validation.
4. Optional contingency: explicit user amount/percentage, separate from the estimate.

Replacement plan: human-selected equipment replacements, quote/estimate source, year/month and decision status. Never sum replacement values for every asset into an implied plan. Show candidate replacements separately from chosen ones. Warranty recoveries and potential savings remain separate until supported and confirmed.

Useful scenarios: move a selected replacement to next year; change contingency; include a priced PM schedule. Recalculate only affected lines. Never invent an automatic reduction in future repairs just because a replacement was selected. Show the old and new amount and the assumption changed. Every included cost has an origin; saved changes require durable scoped/audited plan records, not session-only state.

The current annualized history view can remain a small Baseline comparison. It should not be the planning headline. The strongest demo story is: identify repeated repair cost, inspect equipment and vendor evidence, compare a real quote, choose timing, see the plan change, and retain the supporting work records.

## Implementation batches and acceptance

UX-R1: work navigation/history and equipment browse modes, preserving exact record filters and source links.
UX-R2: explicit vendor Overview/Directory with source-linked metrics and scoped denominators.
UX-R3: simplify spending navigation, demote run rate, and build plan components using available prices; visible unknowns and no double counting mandatory. Missing persisted plan commands require implementation before editable scenarios can be called complete.
UX-R4: one consolidated behavioral/browser validation and publication after the implementation batch, per user's usage preference. Existing production checklist IDs remain; these UX items are additive and open.

Do not claim these changes are delivered. Research completed; implementation and new browser acceptance remain outstanding.

## Implementation checkpoint

The September 15 batch implements the core work/equipment navigation, makes existing vendor overview and directory explicit, and replaces the planning headline with current open estimates and price gaps. Existing PM, repair/replacement and capital routes are reused. Historical baseline is collapsed. Validation and publication evidence live in PLATFORM_IMPROVEMENT_PASSES.md.

UX-R1/R2/R3 remain partial against the full acceptance above: date controls and bounded equipment aggregation, exact filtered vendor portfolio drill-through, and durable budget/allowance/scenario commands are still outstanding. This batch does not establish production readiness or complete competitive parity. The scheduled continuation was paused at user request and must remain paused.

## Small follow-up scope (user-approved usage constraint)

Delivered a lightweight personal scenario using existing saved views: target + extra-work allowance + contingency compared with current open repair estimates. Values and scope persist; source totals recalculate on reopen. This is not an approved or frozen company budget. Shared approvals, monthly forecasts, PM/replacement consolidation and richer scenarios remain outside this small follow-up. Created-date history filters and filtered vendor portfolio destinations are also implemented. See the persistent checklist for browser/test/publication evidence.
