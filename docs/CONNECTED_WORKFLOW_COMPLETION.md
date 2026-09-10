# Connected workflow and evidence review

This pass follows the September 10, 2026 review of `9e925d2`. The acceptance standard is that a person can understand the relationship between the records they are reviewing, and continue existing work with its context intact. Existing service commands, acknowledgment, audited link correction, scope grants, accounting bases, and recording-coverage rules remain in force.

## Implemented behavior

| Starting point | What is assembled and how the journey continues |
| --- | --- |
| Action center, work lists and search | **Review here** opens the work's evidence while the original queue, filters, selection, and scroll position remain mounted. Normal full-record/action links remain available. Closing restores keyboard focus to the opening control. |
| Store history, vendor response/cost/visit evidence, Spending, Trends and PM source tables | Supporting work can open the same in-place review. Cohort and analysis filters stay on the source screen. The review explicitly identifies its separate scope: one work order, across all recorded dates. It does not silently reinterpret the source metric as a lifetime amount. |
| Request and invoice records | Linked work can be reviewed from the report's facts or an invoice allocation. A missing work link remains missing. Invoice allocation anchors remain exact and the normal matching/correction workflow is retained. |
| Work review | Reported problem, authorized scope, current impact assessment, accountable operator, provider, open obligations, per-job visit outcomes, the applicable manager verification, entered costs, confirmed invoice allocations, current quotes, warranty references, and other equipment work are assembled together. Each available source link opens the supporting record. |
| Full work-order overview and equipment view | Prior equipment work, outcomes, warranty responsibility, and available options appear inline. Quote selection and later actions continue on the existing canonical work order. |
| Equipment | One workspace switches between whole equipment, a component and its descendants, and work with no component specified. It updates history, costs, options, open work, and warranty references together. Existing open work takes priority over creating separate work. Separate creation carries the store, asset and an actual selected component; it never sends `unlinked` as an invented component ID. |
| Equipment history | 12 months, 24 months, and all recorded dates are explicit. Work appears for creation, linked job activity, or a cost in the chosen window. Cost uses service dates; current outcome/quote status is labeled separately. History pages preserve component and period. Parent-component review includes descendants; its separately labeled broader queue opens whole-equipment work. |
| Shared service visits and lifecycle | The visit list/search includes every explicitly linked job and its own outcome. Secondary work-order references are searchable. Lifecycle history and service-stage input include the canonical job/visit joins and verification evidence. |
| PM analytical charts | Cost segments open exact cost lines by service date for the selected PM equipment, store, region and program. Reactive-work comparisons open their exact work-order numerator and a separate equipment/latest-PM-window denominator. Both evidence lists retain scope through pagination. |

The new equipment workspace replaces the duplicate generic component/service-history overview. Equipment identity, PM and setup remain available. Legacy equipment section URLs still reveal the connected review. On phones, a compact component selector replaces the long button list; history fields retain visible labels. The modal review uses the browser's modal focus behavior, provides loading/error/retry states, and locks background scrolling while open.

## Evidence and accounting rules

- A verification applies to its exact immutable outcome. A newer service cycle without an outcome cannot inherit an older completion confirmation.
- A related cooling complaint remains a reported problem. Equipment/component classification identifies related records; it does not diagnose a repeated failure.
- Current quote revisions and active quote requests are used. Withdrawn, declined, expired-request, and unselected alternatives are excluded from current options. An expired proposal's validity date is visible. Vendor, scope, exclusions, availability and missing details are retained.
- Warranty references show the earlier repair, provider/routing, term dates and relevant manufacturer terms. Recorded amendments prevent reliance on the superseded calculated term. A recorded coverage decision and invoice hold remain distinct from an unconfirmed reference.
- Invoice evidence reuses `invoiceReporting`. Narrow repository reads include the associated invoices' sibling lines and allocations so reconciliation is evaluated correctly. Canonical invoices suppress older compatibility references, including after match invalidation. Only the current work's supported allocations are returned to its review.
- Recorded work cost and linked invoice amount remain separate. Multiple currencies are displayed separately. No cost rows means **No amounts recorded**; a genuine entered zero remains zero. Equipment dates and a quiet list do not establish recording coverage.
- Reviews create no report, follow-up, task, dispatch, assignment, approval or work order. Acknowledgment and unlinking retain their existing behavior and provenance.
- PM cost analysis excludes PM-generated work and equipment outside the selected program. The chart explicitly uses USD; other currencies are excluded rather than combined or converted. Unrecorded months are not manufactured as zero. A cost on an older work order belongs to its service-date period. PM cohort rates retain their existing nominal equipment-count × 12 denominator and disclose that it is not adjusted for partial equipment exposure; these are descriptive groups, not proof of PM effectiveness. Latest closed, non-waived windows determine group membership, and every denominator asset and source window is reviewable.

## Reads and performance

`GET /api/ops/work-orders/:id/review` checks active membership and the work's tenant/location scope before fetching related evidence. It uses record-scoped repository queries, not a tenant snapshot. Other equipment work is capped at five with a full-list link. Rendered histories, quotes, costs and invoice lists are capped with counts and evidence destinations. Equipment history uses twelve-row pages.

The full-record server render reuses its request-owned snapshot through a read projection that does not clone or normalize/mutate that snapshot again. No persistent response cache is introduced. Lists/charts do not prefetch these evidence bundles in the background.

Three local development HTTP samples during implementation returned the review in **127–214 ms / 7,883 bytes**, versus **410–837 ms / 471,107 bytes** for the full work-order page. These endpoints intentionally return different amounts of information. The samples exclude client hydration, include development variability, and are not a production performance guarantee. Full compatibility snapshots on several existing record/analytical routes remain a known performance limitation.

## Validation record

- Required checks passed: `npm run db:seed`, `npm run typecheck`, `npm run lint`, `npm test` (**127 files / 845 tests**), `npm run test:e2e` (**4 files / 46 tests**), and `npm run build`. The Render/Next build (`npm run build:render`) also passed. Final presentation changes received additional type, lint, targeted regression and build checks.
- `npm run test:routes` checked **134 routes with no failures**. This is a local HTTP render audit, not a substitute for browser interaction.
- Browser inspection covered desktop at **1280 × 720** and mobile at **390 × 844**: action-center/work/search reviews; filtered overview July spend → records → work review; Spending; Trends sources; PM occurrences and July cost evidence; vendor evidence on a later page; invoice allocation and warranty follow-up; equipment component/period switching and prefilled work creation; and the lifecycle decision's quote/service history. Reviews retained the source URL, scope and keyboard return focus. Mobile evidence and equipment layouts were visually inspected and checked for horizontal overflow. The viewport was restored afterward.
- The July PM chart opened exactly four cost lines totaling **$9,385**, preserving the selected store and month. Regression fixtures also cover old work with current service-date costs, entered zero, missing history, other currencies, foreign tenant records, equipment outside PM, PM-generated work, cohort changes, invalid selectors and paginated numerator/denominator reconciliation.
- Existing public vendor authorization/recorded-response and technician entry were inspected. The store-QR-started visit continued to its per-job checkout outcomes through a public link. The no-work-order path continued to crew check-in with an approved vendor and reason. Store creation and deferred-routing forms were inspected, including equipment prefill. These browser checks stopped before submitting mutations; command, persistence, cross-channel, authorization and replay behavior were exercised by the automated workflow/integration suite.
- Browser testing caught and fixed a server/client module boundary error in Spending and moved the mobile Trends review action beside the record name. A server-render regression now guards the boundary. An early parallel-build test run timed out on one integration case; the subsequent sequential full workflow runs passed without changing the timeout.

## Boundaries

This provides a common evidence review across the principal maintenance and data-review surfaces. It does not claim that every specialized screen now answers every possible question. Unmatched visits/invoices still require their explicit reconciliation workflows; the platform does not infer a missing relationship. Public vendor/store actions and setup forms retain their existing specialized journeys. Complete histories and management actions remain available through the full records.

No push or deployment is part of this pass. The prior local implementation and user-owned `dev4.log` are preserved.

## Repair-or-replace and warranty follow-up

The lifecycle decision now uses an ordinary full page instead of the earlier stacked modal. Approved replacement price, its exact quote, related repair evidence, and lower history are reachable without clipped rows. Warranty tasks open the diagnosis and terms together in a dedicated case workspace. See [the rebuild completion record](DECISION_WARRANTY_REBUILD_COMPLETION.md) for evidence rules and validation. The in-place work review elsewhere remains available.
