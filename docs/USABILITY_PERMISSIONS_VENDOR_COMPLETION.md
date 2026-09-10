# Usability, permissions, and vendor completion contract

**Reviewed baseline:** `b8651a8`
**Date:** September 8, 2026
**Status:** coordinated implementation delivered with verified boundaries and explicit remaining gaps

This pass preserves the canonical work order, append-only service evidence, scoped repositories, query-first lists, account-free vendor links, five-vendor/fifteen-store presentation fixture, and separate 65-store scale fixture.

## Journey contract

| Journey | Start and visible entry | Decision and required information | Permission and invariant | Result, recovery, and return |
|---|---|---|---|---|
| Store report | Store-manager Overview → **Report a problem** | Describe the observed problem and business impact; classification stays optional | `create_request`; store scope remains mandatory | A scoped request and review obligation are created; related open work is shown before explicit linking or new work |
| Observable confirmation | Store-manager **Needs your response** → work-order confirmation | Compare the original problem with the latest provider result; choose **Working again**, **Still a problem**, or **I can’t confirm** | `confirm_observable_result`; only the exact current outcome can be assessed | Working again records scoped verification and may close eligible routine work; still a problem creates corrective work; inconclusive routes review to the internal owner; stale evidence returns an explanatory conflict |
| Client responsibility setup | Setup → **Maintenance responsibilities** | Choose which existing role may create work, dispatch eligible routine work, or confirm observable results; see dependencies and defaults | `administer`; capability changes never alter store scope, approval policy, vendor eligibility, or administration | A durable audited override is saved; disabled/conflicting combinations are shown explicitly; changes affect future actions without rewriting history |
| Routine closure | Verification or completion of the last operational obligation | Determine whether the latest outcome is verified, visits are finished, and required operational obligations are complete | One shared closure evaluator; versioned organization workflow policy | Eligible routine work closes atomically when enabled; otherwise it remains resolved for manual close. Financial review remains separate and open |
| Internal handoff | Work-order overview → **Responsible person or team** | Choose a supported, in-scope person or the facilities coordination team | `control_work_order`; current vendor/store/finance/technical delegation is preserved | Existing owner-following tasks and future facilities obligations use the chosen owner; unavailable owners fall back visibly to the supported team |
| Work-order decision | Work Orders/queue → case overview | Understand store/problem, current service state, latest operating observation, responsible internal owner, next workflow actor/deadline, and the viewer's permitted action | Shared case facts plus a viewer-aware action projection | One useful role-appropriate action is prominent; forbidden controls are not advertised; list context survives detail actions |
| Held-work discovery | Work Orders → **Approved work waiting for a suitable visit** | Choose all held work, multi-job stores, due review, or possible confirmed-visit matches | `issue_work_order`; aggregates and rows remain server-scoped and bounded | Empty and non-empty analyses are always discoverable; suggestions explain evidence and do not imply booking, authorization expansion, or savings |
| Combined-visit request | Filtered held list or work order → planner | Choose store, vendor, and intentional jobs; review authorization, response deadline, and final selection | `issue_work_order`; job eligibility and versions are rechecked atomically | One idempotent request is created; stale jobs produce recoverable validation; `returnTo` survives planner, submission, result, and back navigation |
| Vendor authorization | Secure authorization → response controls | Review requester, store/access, WO reference, authorized scope/NTE, deadline, appointment, and next step | Purpose-bound vendor token; no account required | Accept, decline, propose a date, or ask a question. The receipt exposes the next valid step and never treats page load as acknowledgment |
| Vendor question/date loop | Vendor response → internal attention item → work-order response | Answer a question or accept/counter a proposed date using the relevant context | Current internal owner receives the obligation; operator scope and stale-response checks remain | The source obligation completes, the next vendor/scheduling obligation appears once, history is retained, and return context is preserved |
| Quote request | Work order → **Request a quote** or competitive comparison | Review requested scope, entered amount/currency, proposal scope, exclusions, availability, and validity | `request_estimate`; quote evidence never authorizes service | A single-vendor quote or multi-vendor round remains distinct from selection, approval, authorization, appointment, and visit |
| Quote revision/selection | Vendor quote link or operator comparison | Revise from the current proposal; compare scope as well as amount; select only the current valid revision | `select_estimate`; immutable revisions, approval policy, and stale-version fence | Selection records the decision and then exposes approval/authorization; stale selection is rejected without changing the existing decision |
| Attention review | Overview → **Needs attention** | See what, why now, store/record, responsible party, deadline, and the action that clears the obligation | Role-aware scoped projection over tasks, follow-ups, exceptions, approvals, vendor commitments, and financial review | Related sources group under an actionable case without collapsing independent obligations; counts precede pagination; acting returns to or advances within the same queue |
| Owner evidence | Owner Overview → spend or verified value | Understand basis, scope, period, date field, states, and source identities | Read-only leadership projection | Recorded spend and verified value open their matching evidence populations and preserve period/scope |

## Architecture adjustments

1. Capability overrides are organization-scoped, role-template deltas for a small allowlist of maintenance actions. Effective capability = role default plus explicit organization override plus dependency resolution. Scope grants and approval rules remain separate inputs.
2. Automatic closure is an append-only, versioned organization workflow policy. The conservative no-policy default is manual closure. A new policy affects later eligibility evaluations for active work; it never sweeps or mass-closes historical work.
3. New observable confirmations add basis and scope to the existing exact-outcome verification record. Historical records remain readable without being upgraded to claims their evidence did not establish.
4. Internal task routing uses one resolver that returns a valid named membership or the supported facilities team fallback. It does not rewrite historical/completed attribution.
5. The shared attention projection groups presentation around a case while retaining source IDs and independent domain actions. Repository aggregates and pagination replace presenter caps.
6. Existing vendor, estimate, appointment, public-token, and workflow-task commands remain the sources of truth. UI simplification composes those records rather than creating parallel states.

## Required result semantics

| Action | User-facing result |
|---|---|
| Working again and auto-close eligible | **Closed.** The observable result and closure policy basis are recorded. |
| Working again with another operational requirement | **Confirmation recorded; another operational requirement remains.** |
| I can't confirm | **Sent to facilities for review.** No success or failure claim is recorded. |
| Still a problem | **Corrective work required.** The provider outcome remains evidence, not an allegation. |
| Quote selected but approval required | **Provider selected; authorization is still pending.** |
| Combined-visit request sent | **Request sent; the visit date is not confirmed.** |

## Validation contract

The final evidence will distinguish automated domain/repository tests, mutation-capable browser journeys using disposable local state, metric source-identity checks across pagination, responsive interaction checks, and any unverified requirement. The repository-required seed, typecheck, lint, unit/integration, E2E, Vinext build, and Render compatibility build must all pass before the pass is marked complete.

## Effective maintenance responsibilities

Only the three maintenance responsibilities below are client-configurable. All other role permissions remain template-owned. A capability change never expands the member's store/region scope, approval amount, eligible vendor set, public-token scope, or Setup access.

| Role template | Report an issue | Confirm observable result | Create routine work order | Dispatch eligible routine work | Change Setup |
|---|---:|---:|---:|---:|---:|
| Store manager | Yes | Yes | No by default; configurable | No by default; configurable only with create enabled | No |
| Regional manager | Yes | Yes | Yes; configurable | Yes; configurable | No |
| Facilities administrator | Yes | Yes | Yes; configurable | Yes; configurable | Yes |
| Owner / executive | Read only | No | No | No | No |
| Finance reviewer | Financial recording/review only | No | No | No | No |

The saved organization override is resolved into the session once and is used by navigation/action presentation, route/API checks, and the configurable domain commands. Dispatch without create is rejected rather than inferred. The Setup mutation writes all three role-capability values, supersedes the prior workflow-policy version, appends the new policy, and records an organization audit event atomically.

## Verification and closure decisions

| Current evidence and decision | Persisted meaning | Operational result | Next owner / closure behavior |
|---|---|---|---|
| Technician checked in/out | Attendance/presence only | No statement that the problem is fixed, labor is certified, or payment is approved | Per-job provider outcome is still required |
| Provider says completed; manager chooses **Yes** | Observable verification of the exact current outcome and reported-problem scope | Resolved | Auto-closes only when the versioned policy applies to routine work and no active visit, open required operational follow-up, newer outcome, contradiction, or other required operational task remains |
| Manager chooses **No** | Rejected observable result with reason | In progress; provider claim remains in history | Corrective return-work obligation goes to the current internal owner/team |
| Manager chooses **Not sure** | Inconclusive observation, not rejection and not success | In progress; case says the result could not be confirmed | Facilities review precedes financial work or closure |
| Technical repair / technical PM | Technical evidence scope | Store manager cannot certify technical workmanship | Authorized facilities/regional reviewer is required |
| Verified service with invoice exception | Service and finance remain separate | Operational close may proceed | Financial task stays open and visible after service closure |
| Verification passed while another required task remains | Accepted verification | Resolved, not closed | Completing the final required operational task re-runs the same evaluator; an eligible auto-close records the trigger and policy/version atomically |
| Auto-close disabled, non-routine priority, or policy excludes older active work | Accepted verification | Resolved | A guarded manual close task remains |

Settings never sweep historical work. `appliesToActiveWork` controls whether a later eligibility evaluation may use the new version for work created before that version.

## Ownership and task routing

- The customer-side `internalAccountableParty` remains the responsible person/team while the store, vendor, technician, approver, or finance reviewer acts next.
- New vendor-decline, unanswered-response, parts/return, rejected/inconclusive verification, final review, held-work, continuation, and reopened-work obligations use the shared resolver.
- An active, in-scope named owner receives owner-following work. Otherwise routing falls back explicitly to the `facilities-coordination` team queue.
- Reassignment moves only active internal owner-following obligations. It does not seize vendor, store, technical, approval, or finance delegation and never rewrites completed attribution.
- The UI says **Responsible person or team** and exposes the workflow's next actor separately.
- Financial review never becomes the primary operational state when a rejected or inconclusive current verification still needs facilities action.

## Metric definitions and destinations

| Summary | Definition | Destination contract |
|---|---|---|
| Approved for next suitable visit | Active hold + approved work order within the session's full scope | `/app/work-orders?visitPlan=ready`; query-first rows, portfolio count before pagination |
| Stores with multiple approved jobs | Distinct scoped stores with at least two eligible active held jobs | Visible multi-job analysis link even at zero; specialized mode explains the match |
| Due / overdue reconsideration | Active held jobs whose policy review deadline is inside/past the selected window | Review-window analysis; never treated as a scheduled visit |
| Potential confirmed-visit match | Approved held job and compatible confirmed appointment facts | Match view explains store/vendor/timing evidence and requires explicit authorized scope addition |
| Upcoming visits | Distinct work tied to a vendor-confirmed future appointment at/after the as-of instant | Visits summary opens the same appointment predicate rather than `status=scheduled` work |
| Stores and recorded work cost | All scoped stores and persisted cost lines across the requested basis/period | Portfolio-wide count remains labeled separately from filtered rows/current page |
| Attention count | Complete scoped attention projection before lane/type/priority filtering and pagination | Action Center exposes 25-row pages and the full total; no 200-record presenter cap |
| Owner recorded spend | Persisted recorded work cost basis | Correct recorded-spend destination |
| Owner verified value | Verified value-ledger events only | Correct verified-value destination |

## Representative before / after journeys

| Journey | Before | After |
|---|---|---|
| Store manager | Generic store dashboard and facilities-only controls could leak into a list | Home starts with **Report a problem**, **Needs your response**, **Being handled**, and **Upcoming visits**; Store 104 scope is retained and the bulk follow-up control is absent |
| Work-order review | Stage, next action, ownership, and operating evidence repeated or contradicted each other | One case summary shows problem, plain state, latest observation/source/age, responsible internal owner, next actor/deadline, and a viewer-permitted action |
| Inconclusive confirmation | Could be presented like rejected work and financial review could jump ahead | Header says the result could not be confirmed and links to the operational facilities review first |
| Held work | Main query-first list hid the richer entry points | Default Work Orders exposes held count, multi-job stores, due review, confirmed opportunities, portfolio, planner, and exact return path without restoring broad fixture loading |
| Combined request | Planner return context was lost by POST/success navigation | Filtered list → portfolio → planner → success → original context retains a validated relative `returnTo`; stale/ineligible jobs fail safely and duplicate submission is fenced |
| Vendor authorization | Scope and the next step were less prominent; receipt could stop at “recorded” | Public screen leads with requester, store/address/access, operator WO, authorized scope/NTE, deadline, appointment state, and response choices; question/date responses continue through current authorization |
| Vendor quote | Amount could be blank on revision and quote/authorization language overlapped | Latest amount/scope/exclusions/availability/validity prepopulate; revision history and latest-valid state are visible; selection is stale-fenced and never silently authorizes work |
| Facilities queue | Tasks were omitted and inputs were capped before filtering | Shared projection includes tasks, follow-ups, exceptions, vendor reminders, held review, quote rounds, and finance for the appropriate role; related sources group without collapsing independent obligations |

## Validation evidence

The final quality-gate results are recorded in `COORDINATED_WORKFLOW_IMPLEMENTATION.md`. In addition, focused tests prove capability defaults/overrides/dependencies, D1 and PostgreSQL migration continuity, exact-outcome verification, technical/scope denial, automatic closure both at verification and after the final operational task, financial-task preservation, internal-owner fallback, query-first whole-scope metrics, exact metric links, quote revision/stale selection, attention populations above 200, source grouping, and two independent obligations on one work order.

The mutation-capable browser pass used disposable local fixture state and verified:

- Default Work Orders → held portfolio → combined-visit planner → successful request → exact return to `visitPlan=ready`. A stale duplicate attempt returned a recoverable `409`; a second eligible vendor request succeeded.
- Setup denial for a regional role, Setup visibility for the authorized facilities role, saving a store-manager create override, and restoring the default.
- Store-manager Store 104 home, its four explicit starting paths, scope-limited work, and absence of bulk task controls.
- Public service authorization → deliberate open → vendor question → useful receipt; the resulting owner task appeared in Action Center.
- Public quote detail and immutable latest-valid revision presentation. The deterministic link was past its response deadline, so a fresh quote revision was not submitted manually; revision and stale-selection mutations are covered by automated command/route tests.
- A real **Not sure** confirmation with a reason. The browser surfaced an initial precedence defect; after correction, the case and queue both showed facilities operational review ahead of cost review.
- Action Center's 61-item scoped population, lane/type filters, 25-row pagination, grouped quote round, vendor-question task, and inconclusive-verification task.
- Public authorization and store-manager layouts at the app's collapsed-navigation width. Exact phone viewport resizing was unavailable in the browser automation surface; responsive CSS and mobile E2E coverage ran instead.

## Acceptance matrix

| Requirement group | Status | Evidence / boundary |
|---|---|---|
| Client permissions, scope, dependencies, audit, and conservative defaults | Implemented and verified | Fixture/D1/PostgreSQL adapters, Setup save/restore browser mutation, capability/route tests |
| Tri-state observable verification, technical boundary, exact outcome, result copy | Implemented and verified | Domain/route/UI/case tests plus live inconclusive browser mutation |
| Automatic closure at verification and after final operational obligation | Implemented and verified | Shared evaluator tests; policy/version and triggering evidence audited; finance task preserved |
| Internal owner lifecycle and supported team fallback | Implemented and verified | Command tests and work-order/queue presentation |
| Viewer-aware work-order hierarchy and state precedence | Implemented and verified | Case/presenter tests and corrected live inconclusive record |
| Query-first held-work summaries and combined-visit return journey | Implemented and verified | Query tests and successful end-to-end browser mutation |
| Role starts, scope, and forbidden-control suppression | Implemented and verified | Role tests and store-manager/regional/facilities/owner browser review; finance source semantics verified automatically |
| Metric-to-record semantics and whole-population counts | Implemented and verified | Presenter source-identity/count tests and browser drill-throughs |
| Quote terminology, latest revision, comparison, and stale selection | Implemented and verified | Command/route/public/operator tests; read-only public browser review |
| Vendor authorization question/date continuation | Implemented and verified | Continuation/case/public tests; question submission and operator task verified manually |
| Complete attention population, grouping, lanes, stable order, pagination | Implemented and verified | >225-source regression, independent-obligation regression, 61-item browser queue |
| Public quote file attachment | Completed in September pass | Exact proposal/file association, authorized download, revision/stale-selection tests and mobile upload/download |
| Expand a grouped queue row into every source obligation | Completed in September pass | Every retained source has a link, owner, deadline and completion requirement |
| Completed/history attention lane | Completed for workflow tasks | Dated completed/canceled task history; other history remains on source records |
| **Save and open next** review command | Completed for supported review forms | Save must succeed; server reload checks scope and eligibility, skips changed candidates and provides an end state |
| Manual browser execution of every 1–18 and A–O mutation | Implemented but not fully verified | High-risk representative mutations ran; date counterproposal, multi-vendor selection, phone attribution, >200-row live browser fixture, and vendor mobile error retry rely on automated coverage |
| Advanced confirmed-opportunity/review-window read model | Implemented but not production-scaled | Default list and ordinary held portfolio are bounded/query-first; explicit advanced analysis still uses the compatibility snapshot |

The four previously missing UI/evidence capabilities were addressed in the September completion pass. `WORKFLOW_ACCOUNTING_COMPLETION.md` records the new acceptance evidence and remaining production/connector boundaries; the older validation above remains a historical record.
