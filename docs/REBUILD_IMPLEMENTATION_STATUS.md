# Rebuild Implementation Status

**Snapshot date:** August 20, 2026  
**Demo implementation status:** reactive loop accepted end to end; PM, Service Runs, warranty, invoice controls, lifecycle planning, and source-linked value are now interactive  
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

## Known limitations outside the current demo claim

- Preview identity and role selection are not production authentication and must not protect real customer data.
- Operator read paths still include broad snapshot/presenter behavior that requires later tenant-scale and least-privilege replacement.
- Outbox persistence exists, but production delivery/retry workers and external notification proof are not part of this completed loop.
- Structured production import, broad versioned metric coverage, and generalized background-job infrastructure remain later production work; they are not required for the current private working-demo claim.
- Existing `test:e2e` coverage is a server/database Vitest journey, not a configured cross-browser automation suite; the manual browser proof is recorded above.
- The repository still contains parallel legacy/prototype stacks. Reference-safe retirement is later work and must not be conflated with Wave 1 acceptance.

## Exact final validation

These results are from the same settled worktree on August 20, 2026.

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

Publish this settled source privately, allow the protected hosted database to run its additive migration/enrichment path, and complete the final browser walkthrough against the hosted URL. Production authentication, worker delivery, imports, and broad scale hardening remain a later production-readiness phase.
