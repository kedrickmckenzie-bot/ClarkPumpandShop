# Rebuild Implementation Status

**Snapshot date:** August 24, 2026  
**Demo implementation status:** reactive loop accepted end to end; PM, Service Runs, warranty, invoice controls, lifecycle planning, and source-linked value are now interactive; transactional-outbox delivery/retry worker and SLA escalation worker added  
**Authority:** the merged Codex master rebuild directive supplied for this rebuild, the user's active Wave 1 acceptance target, and repository `AGENTS.md`. Earlier c-store plans remain useful history only where they do not conflict.

This is an honest inventory of the active worktree. “Complete” below means the step is connected through persisted data, server authorization, product UI, bounded Workflow Tasks, Audit Events, deterministic fixture coverage, and automated tests. The original merged master directive remains the capability authority; demo sequencing does not narrow those requirements.

## Active Wave 1 acceptance loop

> Store issue -> business-impact assessment -> review -> approval when required -> Vendor Assignment -> store Work Order selection -> Vendor inference -> Site Visit -> per-Work-Order outcome -> internal verification/rejection -> resolution -> closure

| Step | Current state | Implemented evidence |
|---|---|---|
| Store issue | Complete | Structured public store intake persists the Service Request, initial impact assessment, request-review Workflow Task, Audit Event, and outbox record atomically. Repeated submissions are idempotent. |
| Business-impact assessment | Complete | Append-only, tenant/request/store-bound assessments capture operating, safety, inventory, customer, compliance, downtime, and optional revenue-exposure evidence with source, confidence, and an explicit non-verified-loss caveat. |
| Manager review | Complete | Scoped manager review confirms or revises impact evidence with an optimistic latest-assessment fence. Conversion is blocked until the latest assessment is manager-reviewed, including a concurrent review/conversion race. |
| Approval when required | Complete | Versioned policy evaluation, immutable request/decision history, requester/approver separation, amount, role, and membership-scope enforcement, request-level decision UI/API, and approval-linked Workflow Tasks are connected. A Service Request with no required approval history may advance after review; a current pending, escalated, rejected, or cancelled chain cannot be converted, while an approved chain can. |
| Vendor Assignment and issuance | Complete | Outside-vendor assignment and immutable/versioned Service Authorization issuance use server-authorized commands, Work Order version fences, Audit Events, and bounded task transitions. Operator Work Order, vendor ticket, invoice, and optional accounting-PO references remain separate. |
| Store Work Order selection | Complete | The trusted-store technician flow presents only eligible issued Work Orders at that Store before vendor identity is established. The “No work order provided / I don't see my work order” path creates a reviewable unmatched visit instead of blocking service. |
| Vendor inference | Complete | The selected Work Orders deterministically infer one read-only Vendor. Domain checks reject mixed-Store, mixed-Vendor, unissued, ineligible, cross-tenant, or conflicting active-visit selections. |
| Site Visit | Complete | One channel-independent visit can link multiple selected Work Orders through the canonical join, with one presence interval plus crew, contact, vehicle, arrival, consent, and point-in-time location evidence. D1 and PostgreSQL include legacy-link backfill. |
| Per-Work-Order outcome | Complete | Checkout requires an exact outcome and notes independently for each visit/Work Order link. Unresolved outcomes atomically create the required, owned, due, and escalated follow-up; their lineage remains attached to the originating visit outcome. |
| Internal verification/rejection | Complete | Append-only verification decisions operate on the latest exact visit outcome with a Work Order version fence. Verification creates a distinct close obligation; rejection reopens the Work Order and creates the next owned repair cycle without rewriting visit evidence. |
| Resolution | Complete | Internal verification projects the Work Order to `resolved` only after the latest applicable visit outcome and required follow-up state are eligible. Manually completing an unresolved follow-up cannot bypass verification readiness. |
| Closure | Complete | Closure is a separate authorized command blocked by active visits, open follow-ups, and other required/blocking tasks. Store managers may verify scoped work but may not close it; the close task exposes only the governed close action, not generic Complete/Cancel controls. |

Workflow Tasks and SLA metadata express only the accountable obligations inside this loop: request review, approval, assignment/issuance, vendor response, visit, follow-up, repair verification, return work, and final closure. They are not being treated as a standalone workflow-engine feature.

## Persistence, deterministic data, authorization, and audit

- D1 schema coverage is current through migration `0026`; PostgreSQL schema coverage is current through migration `0021`. In addition to the reactive loop, both persist PM/Service Run, Contract/Warranty, Invoice Line/allocation/exception/adjustment, Service Discrepancy, Value Event, versioned Lifecycle Recommendation, and structured Component Lifecycle Event records used by the interactive demo.
- New Wave 1 records are organization-bound. Command reads establish organization scope before Store, role, membership-scope, or record checks, and public tokens remain opaque, purpose-bound, expiring, and hashed at rest.
- Unsafe mutations use optimistic Work Order, request-state, latest-assessment, or active-visit fences. Database constraints prevent duplicate request conversion and overlapping active visits for the same Work Order.
- Domain mutations, their bounded Workflow Task changes, Audit Events, and outbox records commit in the same repository transaction. UI and public-link routes invoke the same domain commands.
- A fresh or explicitly reset database receives deterministic fixture release `northline-ops-2026-08-20-v12`. The Northline showcase remains exactly 15 Stores, exactly five approved outside Vendors, and a two-person internal maintenance team; separate fixtures continue to prove one-Store and approximately 65-Store shapes.
- A database carrying an older completed bootstrap receives additive `INSERT OR IGNORE` enrichment: existing facts and preview mutations win, migration-generated Visit/Work Order link identities are reused, and no fact is broadly reprojected. One exact legacy Component identity receives a narrowly guarded serial/install/warranty amendment only when every old value still matches, so user edits and unrelated records are untouched. The database receives the distinct `northline-ops-2026-08-20-v12:enriched-existing` receipt and is not falsely marked as a fresh v12 seed. D1 and PostgreSQL use the same release decision.
- The deterministic journey covers a reviewed Service Request with approval, outside assignment and issuance, a two-Work-Order inferred-vendor visit, independent outcomes, one accepted verification, one rejected/return-work cycle, resolution, and final closure.

## Recorded browser proof

The following inspection was completed against the local application backed by the real local D1 database, including a post-build rerun after applying additive migration `0021` to the preserved local database.

- Facilities/operator views loaded successfully at `/app/overview`, `/app/requests`, the Store 101 freezer-door request detail, the filtered Work Orders workspace, and Work Order service/activity views.
- The Store 106 ceiling-stain request displayed its current Service Request approval ledger and an executable authorization-decision form with amount, required role, approve/reject choices, conditional reason guidance, and subject-specific copy. Conversion was not offered while the current approval remained pending.
- A Store Manager preview scoped to Store 104 was denied the Store 101 request, demonstrating server-presented scope enforcement rather than a cosmetic role picker.
- The trusted-store technician page required Work Order-first selection, inferred Summit Refrigeration from the chosen eligible work, displayed that Vendor read-only, and collected crew details before check-in.
- An active visit displayed exact per-Work-Order checkout controls. Selecting `return_visit_required` revealed the required owner, next action, due timestamp, and escalation destination for that individual Work Order; the multi-Work-Order form and atomic commit are additionally covered by the database-backed test journey.
- `/app/work-orders/wo-recent-aug-111-plumbing?view=visits` displayed immutable verified visit history and resolved state. Its activity view exposed the governed `close_verified_work` action and explicit Closed option without generic Complete/Cancel bypasses.
- The trusted-store technician flow was inspected at a 390 x 844 mobile viewport and rendered without a blocking responsive defect; desktop application views were also inspected.
- Public-link forms were inspected without submitting mutations during this browser pass; their command behavior is covered by the passing database-backed automated journeys and idempotency tests below. All inspected GET and visit-context requests returned `200`.
- The preserved local D1 database was advanced additively from `0021` through `0024` with Wrangler's automatic backup; no reset or historical rewrite occurred. `/app/overview` then returned `200` with Northline source data.
- A fictional $125 trip-charge invoice was created through `/app/invoices/new` against `NL-2026-0104`. The browser followed the real `303` to the persisted invoice detail, which showed exact line/allocation evidence, two review flags, `$0` approved, `$0` adjusted, and `$0` paid.
- The identified-exposure Value Ledger immediately displayed the invoice's authorization and unsupported-trip-charge facts with separate deduplication keys and links back to the exact Work Order and Invoice. No realized value was created.
- The current deterministic fixture rendered a populated Warranty Center (one diagnosis-required case and invoice hold), Service Run planner (two Stores/two Work Orders, protected capacity, and estimated opportunity), and PM workspace (76 occurrences; 49 completed / 51 eligible = 96%, with open windows and waived work excluded).
- Private Sites version 27 (`66118c5`) published successfully at the owner-only hosted URL. A hosted browser pass verified Overview, PM, Warranty Center, Invoice review and invoice detail, Lifecycle & CapEx, Value Ledger, Service Run planner, and the Store 104 replacement-Compressor detail against live D1 data. The Component summary and immutable lifecycle row consistently show serial `CMP104-2026-0710`, July 10, 2026 installation, July 10, 2028 warranty, and the linked removed-component history. Recent production Worker error logs were empty after the walkthrough.

## Preserved platform safeguards

- Runtime persistence fails closed in production when durable database configuration is missing.
- Current Sites hosting bindings remain D1 `DB` and R2 `FILES`; Render portability retains PostgreSQL/S3-compatible boundaries without adding `render.yaml`.
- `npm run db:reset:postgres` is fail-closed and restricted to explicitly confirmed development/demo targets. It has guard tests; no live database reset is claimed unless separately recorded.
- Approval-policy currency constraints are aligned between D1 and PostgreSQL.
- Hosted Sites versions 24 and 25 were saved from the earlier source, but their private publish attempts were rolled back automatically. The exact prior Sites source checkpoint (`33939f6`, migrations through `0009`) and its complete 2,397-statement seed were reconstructed locally. The populated chain now advances through D1 `0026` with zero foreign-key violations: migration `0015` creates the required composite Store index before its new foreign key, and migration `0019` adds `resolved_at` without rebuilding the referenced Work Order table. Private version 27 is the current successful release; its v12 seed reconciliation uses exact legacy-value predicates and requires no destructive hosted reset.

## Interactive demo expansion

- PM Plans and source occurrences create canonical Work Orders and retain checklist/evidence/compliance denominators.
- Service Runs are persisted, constraint-checked recommendations with Vendor counter/acceptance, exact Stops and Work Orders, protected duration, public response, and Site Visit handoff. Estimated opportunity remains separate from realized value.
- Warranty review preserves immutable Repair Items and Applied Warranty category lines; future effective-dated rules, one-repair amendments, routing overrides, coverage decisions, invoice holds, manufacturer evidence, and Audit Events are interactive.
- Invoice intake persists exact Invoice Lines, Work Order allocations, optional private evidence, Contract Version/Authorization/Visit comparisons, and review tasks. Automated differences are flags only. Only an authorized human decision may create an immutable adjustment and realized Value Event; the platform does not execute payment or resolve operational work.
- Lifecycle and capital planning allow operators to create functional replacement profiles, publish dated benchmarks, set equipment-specific estimates, approve selected replacement quotes, and close out a replacement by retiring the old Asset and creating its linked successor with final installed cost. A manager can also freeze the current transparent rule inputs/model version, recommendation, confidence, explanation, missing data, decision, and reason as a new immutable version; replacement closeout records the later actual outcome against the latest version.
- Component replacement is a real verified-service action: one atomic transaction creates the immutable Repair Item, retires the removed Component, creates the separately identified installed Component, calculates applicable warranty lines, records manufacturer/model/serial, install/removal dates, failure/root cause, labor/part cost, Vendor, planned/reactive classification, expected life, warranty end, Component Lifecycle Event, Audit Event, and outbox fact. Component detail shows actual life, life ratio, model-cohort median and premature-failure rate where supported, repeat work, warranty opportunity, exact Work Order drill-through, and explicit small-sample cautions.
- PM effectiveness now presents trailing reactive Work Orders per 100 equipment-months for latest-compliant and latest-noncompliant PM cohorts, plus recorded reactive-cost trend context. Every view opens supporting source records and explicitly withholds an effectiveness conclusion when a cohort is too small.
- The Value Ledger displays realized-and-verified value, identified exposure, and estimated opportunity as three separate totals. Each row retains a deduplication key and opens its supporting operational or financial record.

## Outbox delivery/retry worker (added August 24, 2026)

The delivery half of the transactional outbox is now implemented and tested end to end:

- `lib/ops/outbox-delivery.ts` runs one idempotent cycle: recover abandoned processing leases (`claimed_at` older than the stale window), conditionally claim due `pending` messages (a lost race is counted as skipped), deliver through an injected transport, and settle atomically — delivered timestamps, exponential-backoff retry capped at one hour, or terminal `failed` after `maxAttempts` with the last error retained for forensics.
- Additive migration `ops_outbox_messages.claimed_at`: D1 `drizzle/0027_damp_stick.sql` and PostgreSQL `drizzle-postgres/0022_equal_captain_america.sql`, generated from the schema files with no other drift.
- Repository support on all three adapters: `listDueOutboxMessages`, `listStaleProcessingOutboxMessages`, conditional `claimOutboxMessage` (D1/PostgreSQL via `UPDATE … WHERE status='pending' RETURNING`; fixture via guarded clone-commit), and `recordOutboxDeliveryOutcome`.
- Entry points: Cloudflare Worker `scheduled` handler (D1) and `npm run jobs:outbox:postgres` for a Render cron context. Both are repeatable and safe to run concurrently.
- The only transport is the structured operational log. No email/SMS/vendor-notification channel is implied; adding one requires a named, message-id-idempotent transport.
- Tests: `tests/ops-outbox-delivery.test.ts` covers full delivery and settlement, backoff retry then success, terminal failure and non-reclaim, stale-lease recovery with fresh leases untouched, claim-race skipping, and the empty-queue no-op.

Also fixed this session: `tests/ops-public-multi-work-order-visit.test.ts` used a hardcoded follow-up due time that aged into the past and began failing against the real clock; it now derives its due time relative to now.

## SLA escalation worker and job-run registry (added August 24, 2026)

- `lib/ops/job-workers.ts` (`runSlaEscalationCycle`) escalates overdue open Workflow Tasks by reusing the governed `escalateWorkflowTask` command — system actor, Audit Event, outbox intent, version fencing, and Work Order projection are identical to a human escalation.
- New `JobRun` registry: `ops_job_runs` (D1 migration `drizzle/0028_high_steel_serpent.sql`, PostgreSQL `drizzle-postgres/0023_quick_post.sql`) is unique per organization + job type + slot key, so each recurring slot executes at most once per organization and repeated scheduling is safe. The default slot is the UTC hour.
- Overdue tasks climb one level per slot up to a ceiling (default 3); tasks at the ceiling are counted and left untouched, so automation can never rewrite history it does not understand.
- The Cloudflare Worker `scheduled` handler now runs outbox delivery followed by escalation; `npm run jobs:postgres` replaces `jobs:outbox:postgres` for PostgreSQL cron contexts.
- Tests: `tests/ops-sla-escalation-worker.test.ts` covers first-slot escalation with audit/outbox/job-run evidence, same-slot skip, one-level-per-slot climb to the ceiling, and exclusion of no-due-time or terminal tasks.

## Demo-readiness pass: scorecards and record-integrity surfaces wired (added August 24, 2026)

- Vendor scorecards now render on `/app/vendors` for internal roles: work orders assigned, outcomes recorded, verification pass rate, quote acceptance rate, and open invoice flags with dollar amounts. Small samples display "Small sample" instead of a rate.
- `/app/overview` now carries an "Operating record integrity" section (executive/facilities only): Closed-Loop Coverage percentage with per-requirement satisfaction counts and drill-through links to closed-with-gaps Work Orders, plus the data-quality queue by severity with source-record links.
- With these two surfaces, every register item that computes in the domain is now also visible in a screen. Remaining register items are enhancement-tier: bulk actions on the Work table, weather ingestion + metric registry, import/onboarding pipeline, production authentication.



## UX grouping pass: dedicated Owner brief page + plain-language vendors (added August 24, 2026)

- Owner Brief moved to its own destination: `/app/brief`, seventh primary navigation slot ("Owner brief", BookOpenText icon), gated to executive/facilities/regional. Overview returns to its single control-tower job - no more duplicated executive content.
 - Vendor scorecards redesigned as plain-language verdict cards for non-maintenance readers: each vendor gets a colored verdict (Reliable / Watch / Billing under review / Building history) derived from verification outcomes and invoice flags, with three plain facts (jobs handled, site visits finished, work passed inspection). Jargon columns removed from the default view.
- The dense vendor performance workspace remains available but collapsed behind a "Detailed vendor performance workspace" disclosure - progressive disclosure per the UX doctrine: simple by default, complete on demand.
- Coverage/quality section headings simplified to owner language ("Jobs followed through to done", "Records that need cleanup").
- Local dev D1 repair utility added: `apply-local-d1.mjs` applies the full drizzle chain to the local miniflare database after sync incidents.

## Vendor verdict cards v2 with drill-through (added August 24, 2026)

- Verdict logic now uses the full honest signal set: open invoice exceptions (Attention - billing under review), declined dispatches (Watch - declined work recently), open callbacks owed from prior visits (Watch), and only vendors with 10+ finished visits and zero flags earn Reliable. Scorecards gained responsesDeclined and openFollowUpCount fields.
- Every card drills through: "See their work orders" opens the filtered work-order list for that vendor; cards with invoice flags add a direct "Review invoice flags" link to the invoice safeguards queue.
- Card styling strengthened with the platform shadow so tiles separate visibly from the canvas.

## Tile-first list surfaces (added August 24, 2026)

- New `ListSurface` component replaces flat tables on `/app/work-orders`, `/app/action-center`, `/app/requests`, `/app/visits`, `/app/stores`, and `/app/estimates`: every record renders as a clickable card showing its title plus up to five labeled facts, tone-colored where status matters. Every card links to the full record - drill-down is universal.
- Card/table toggle preserves all active filters via a "Switch to table/card view" control; pagination, search, filter chips, and saved views work identically in both modes.
- Tile styles live in `enterprise-workspace.module.css` consuming the shared token layer (hover lift, focus-visible rings).


## Enterprise visual system pass (added August 24, 2026)

- Retired the last of the rejected teal/coral prototype identity from `app/traceops.css`: canvas is now neutral cool gray (#f2f4f7), sidebar deep slate (#16212e), and the single action color is a restrained cobalt (#2a5cc7) used for brand mark, active navigation, focus rings, links, and primary buttons. Semantic amber/red/green/blue tones retained; radii tightened (12/16px); shadow softened; topbar/backdrop cooled to match. All hardcoded old-hue rgba values replaced - zero leftovers.
- The five workspace component stylesheets (owner brief, coverage/quality, vendor scorecards, job health, saved views) now consume the shared tokens instead of scattered hex values, with hover and focus-visible states on interactive controls.



## Saved views on the Work queue (added August 24, 2026)

- New `ops_saved_views` table (D1 `drizzle/0029_bouncy_tenebrous.sql`, PostgreSQL `drizzle-postgres/0024_great_major_mapleleaf.sql`): named URL-query filter sets per organization + membership + surface, unique on name so re-saving updates in place via delete+insert inside one transaction.
- Repository CRUD on all three adapters (`listSavedViews`, `putSavedView`, `deleteSavedView`).
- `POST /app/../api/ops/saved-views` handles save and delete for any authenticated operator role; the stored query must parse as URLSearchParams with at least one key.
- `/app/work-orders` now renders a saved-views bar above the list: chips link to their stored filter query, each carries a delete control, and saving captures the current query string verbatim.


## Coverage, data-quality, PM recurrence, and job health (added August 24, 2026)

- Closed-Loop Maintenance Coverage policy v1 (`lib/ops/coverage-quality.ts`): every resolved/closed Work Order is evaluated against three transparent requirements - visit outcome recorded, vendor claim verified internally (outside-vendor work only), cost evidence recorded. Results carry the policy version, per-requirement satisfaction counts, and the exact incomplete Work Orders.
- Operational data-quality queue: high (active work with no open Workflow Task - a direct invariant check), medium (unclassified problems, invoice reviews aging past 30 days), low (missing equipment links, incomplete lifecycle inputs). Issues name their source entity; nothing is fixed silently.
- PM recurrence worker (`runPmRecurrenceCycle`): for each plan whose latest occurrence is completed, schedules the next occurrence at due date + cadence inside the completion window, idempotent per organization + daily slot (`ops_job_runs`) and per plan + `recurrence_key` unique index. Creation emits Audit Event + outbox intent atomically like every governed change.
- Job-health surface on `/app/admin`: recent job runs (job, slot, status, processed/failed counts) and outbox depth by status, gated to executive/facilities roles.

- Known limitation: the Vinext-after-Next build ordering leaves `.next/types` stale for tsc; run `build:render` before `typecheck`.

## Owner Brief on Overview (added August 24, 2026)

- `loadOwnerBriefModel()` joins the operator loader: executive, facilities, and regional preview roles receive a 30-day Owner Brief computed by `lib/ops/owner-brief.ts`; other roles get no section (role-appropriate presentation, not hidden data).
- New `components/workspace/owner-brief.tsx` renders the brief above the Control Tower on `/app/overview`: separated money bases (recorded spend / identified exposure / verified savings / estimated opportunity - each labeled so estimated is never read as realized), PM compliance with its explicit method, active escalation count, a "What needs you" decision list where every item links to its exact source record (`/app/equipment/[id]`, `/app/work-orders/[id]`, or `/app/action-center/[id]`), and an expandable per-store spend table sorted worst-first.
- Vendor scorecards domain module shipped alongside (`lib/ops/vendor-scorecards.ts`); UI wiring onto the existing vendor-performance surface is the next slice.
- Known toolchain quirk documented: running the Vinext build after Next's build leaves `.next/types` in a format `tsc` rejects until the next `build:render`; run `build:render` before `typecheck` when validating.

## Lifecycle model v2 and near-duplicate invoice safeguard (added August 24, 2026)

- `buildLifecycleRecommendationDraft` upgraded to `transparent-rules-v2`: abnormal component churn (two or more Component Lifecycle Events on an asset's components within 24 months) is now a fourth transparent threshold; explanations enumerate exactly which thresholds were met; active warranty coverage demotes a would-be "replace" outcome to a human capital review with an explicit reason; high confidence is capped when the replacement-profile match is not exact; missing-data labeling adds component-history gaps; inputs snapshots record component counts, met thresholds, profile-match classification, and warranty end.
- Near-duplicate invoice safeguard: `receiveInvoice` still hard-blocks exact vendor invoice-number repeats, and now also raises a review-only `duplicate_invoice` exception when a different invoice number from the same vendor arrives within 30 days carrying the same total — creating identified-exposure evidence and a finance review task without any deduction or payment decision.
- Tests: `tests/ops-lifecycle-v2.test.ts` (warranty demotion, component-churn threshold, zero-dollar callbacks counting toward repeat work) plus a near-duplicate flag test in the financial safeguards suite.


## Verified gap register (code-audited August 24, 2026)

Corrects earlier assumptions; each item was checked against domain source, not docs. Updated after the v2 lifecycle slice: the duplicate-invoice row is now "Partial — exact blocked + near-duplicate review flag shipped", and the job-workers row reflects outbox delivery + SLA escalation shipped:

| Directive requirement | Actual state |
|---|---|
| Lifecycle / repair-vs-replace algorithm | **Implemented** — transparent rule inputs, versioned frozen recommendations with confidence/missing data, manager decisions, replacement closeout with actual outcome. Gaps are only in what feeds it (weather, trends, cohorts breadth). |
| Duplicate invoices | **Partial** — exact vendor+invoice-number repeats are hard-blocked (`receiveInvoice` CONFLICT). Near-duplicate review flags (same vendor/amount/date, different number) do not exist. |
| Vendor scorecards | Missing. |
| Closed-Loop Maintenance Coverage queue/metric | Catalog target only; not implemented. |
| Data-quality queue | Legacy components only; not in active ops domain. |
| Saved views / bulk actions | Not implemented. |
| Weather ingestion / exposure windows / normalized trends | Only an SLA pause-reason enum value exists. |
| Versioned metric registry in code | Markdown catalog only; no enforcement. |
| PM recurrence worker | Occurrences exist; no scheduler generates the next slot. |
| Structured import/onboarding | Not started. |
| Job workers | Outbox delivery + SLA escalation shipped this session; job-run registry live; health UI surface still open. |

## Known limitations outside the current demo claim

- Preview identity and role selection are not production authentication and must not protect real customer data.
- Operator read paths still include broad snapshot/presenter behavior that requires later tenant-scale and least-privilege replacement.
- The outbox delivery worker delivers to the structured operational log only; external notification channels, cron scheduling configuration for the `scheduled` handler in the hosted deployment, an outbox observability dashboard, and delivery-proof evidence remain open.
- Structured production import, broad versioned metric coverage, and generalized background-job infrastructure remain later production work; they are not required for the current private working-demo claim.
- Existing `test:e2e` coverage is a server/database Vitest journey, not a configured cross-browser automation suite; the manual browser proof is recorded above.
- The repository still contains parallel legacy/prototype stacks. Reference-safe retirement is later work and must not be conflated with Wave 1 acceptance.

## Exact final validation (August 24, 2026 — outbox delivery slice)

| Command | Exact latest result |
|---|---|
| `npm run db:seed` | **PASS** — deterministic fixture release reseeded: 15 Stores, five Vendors, 94 requests, 120 Work Orders, 116 visits, 138 assets, 76 PM occurrences, 4,609 seed statements, and the separate 65-Store scale fixture. |
| `npm run lint` | **PASS** — zero ESLint findings. |
| `npm test` | **PASS** — 85 files / 493 tests, zero failures (includes SLA-escalation, outbox-delivery, lifecycle-v2, and executive-intelligence suites). |
| `npm run test:e2e` | **PASS** — exit code 0 across all four suites including the PostgreSQL engine integration journey. |
| `npm run typecheck` | **PASS** — zero TypeScript errors (after regenerating `.next/types` via `npm run build:render`; the pre-build state had stale generated-validator errors unrelated to source). |
| `npm run build:render` | **PASS** — exit code 0; Next.js production build compiled and finalized. |
| `npm run build` | **PASS** — exit code 0; Vinext production build completed ("Build complete"). |
| D1 migration chain through `0027` | **PASS** — all 28 migrations applied with foreign keys enabled by the updated chain guard inside `npm test`. |
| PostgreSQL migration chain through `0022` | **PASS** — exercised by `npm run test:e2e` (PostgreSQL engine integration journey), exit code 0. |

The first full `npm test` run surfaced two failures, both addressed and then verified by targeted rerun (`ops-d1-migration-chain.test.ts` asserted the previous 27-migration count before migration `0027`; the multi-work-order visit test carried the expired hardcoded due time described above).

## Exact final validation

Prior-snapshot results from the same settled worktree on August 20, 2026 (superseded above for changed surfaces):

| Command | Exact latest result |
|---|---|
| `npm run db:seed` | **PASS** — deterministic fixture: 15 Stores, five Vendors, two internal technicians, 94 requests, 120 Work Orders, 116 visits, 138 assets, 76 PM occurrences, 4,609 source seed statements, and the separate 65-Store scale fixture. |
| `npm run typecheck` | **PASS** — zero TypeScript errors. |
| `npm run lint` | **PASS** — zero ESLint errors. |
| `npm test` | **PASS** — 81 files / 472 tests. |
| `npm run test:e2e` | **PASS** — 4 files / 31 tests, including the complete Wave 1 loop and real PostgreSQL engine. |
| `npm run build` | **PASS** — Vinext production build completed; only its existing plugin-timing and duplicate CSS filename warnings were emitted. |
| `npm run build:render` | **PASS** — Next.js 16.3 production build compiled, typechecked, generated routes, and finalized successfully. |
| PostgreSQL migration + integration | **PASS** — all 22 migrations through `0021`, fresh deterministic seed, constraints, issuance, and full reactive-loop engine journey. |
| D1 migration chain through `0026` | **PASS** — all 27 migrations applied with foreign keys enabled, the full deterministic seed, and a populated hosted-era upgrade regression. |
| `git diff --check` | **PASS** — exit 0; only repository line-ending conversion warnings. |
| Browser smoke | **PASS** — real local D1 invoice creation/flagging/Value Ledger propagation plus populated deterministic Warranty, Service Run, PM, lifecycle, scoped-search, reactive-loop, and 390×844 technician views. |

## Next action

Publish this settled source privately, allow the protected hosted database to run its additive migration/enrichment path (now through D1 `0027`), and complete the final browser walkthrough against the hosted URL. Configure cron scheduling for the new outbox `scheduled` handler as part of that hosted step. Production authentication, external notification transports behind the existing outbox worker contract, imports, and broad scale hardening remain a later production-readiness phase.

## Correctness repair pass (added August 24, 2026)

An external review of the previous commit (5ff7437) identified five correctness defects and several honesty/UX gaps. All were verified against source, then repaired in this commit. This pass repairs defects; it is **not** a new capability wave and not a completion of the platform rebuild.

Defects fixed:

1. `listOverdueEscalationCandidates` bound three SQL parameters to a two-placeholder statement; every real SLA escalation cycle would have failed on D1/PostgreSQL. Fixture tests masked it. Fixed, with a PGlite regression test that runs the worker through the actual SQL adapter.
2. `outboxStatusCounts` was tenant-unbounded and rendered inside one tenant's admin page. It now requires and filters by `organizationId`, with fixture- and engine-level isolation tests.
3. Saved views stored a URL query string into a PostgreSQL JSONB column, which rejects non-JSON text. The column is now TEXT named `query_string` on both dialects (D1 migration 0030, PostgreSQL migration 0025), the domain field is renamed `queryString`, and a write/read/replace/delete round trip is covered on PGlite.
4. The Owner Brief summed every `identified_exposure` value event, so one invoice carrying authorization + warranty + duplicate flags counted its dollars once per flag. The brief now reports distinct invoices under review at invoice totals, each counted once, plus separately-labeled other exposure.
5. The lifecycle decision queue treated any latest capital_review recommendation as awaiting a decision even though persisted recommendations always carry a decision. Decisions are now derived outstanding states (review required, investigation underway, deferred, repair approved, replacement approved, closed by recorded outcome), including replace recommendations.

Additional repairs: per-organization job-run success status (was mixed with global cycle counters), period-qualified "work orders opened" store lines with a printed definition, a full PM obligation breakdown beside the compliance ratio (late, missed, open-in-window, waived, unscheduled are no longer invisible), drill-through links on every principal Owner Brief metric, work orders restored to the tile-capable list surface while keeping saved views, operational queues default to dense tables (cards remain available via toggle; stores default to cards), six-destination navigation restored with one role-aware Overview slot (executives land on `/app/brief`; the route stays reachable as a secondary page), worker actor names read from the centralized presentation config instead of hardcoding the temporary brand, `apply-local-d1.mjs` is idempotent via a marker table and documented local-only, and the PostgreSQL adapter now surfaces affected-row counts so claim/delete semantics match D1.

Known debt deliberately not solved here: executive calculations still load tenant snapshots rather than server-side aggregates (demo architecture); deferred lifecycle recommendations have no modeled re-review date; the stage-driven work-order case screen remains future work.