# P3 review corrections

**October 4, 2026. Both reported defects were reproduced, corrected and locally verified. Independent reassessment remains open.**

Validation used `C:\Users\Kedrick\.codex\worktrees\internal-dispatch-plan\Clark Pump and Shop App`, branch `codex/internal-dispatch-p1`, pre-P1 HEAD/base `861630053e7fdff3686926047399f55a9be10495`, including all staged, unstaged and untracked files. The user subsequently authorized committing and pushing P1–P3 for Claude; use [P1_P3_REVIEW.md](P1_P3_REVIEW.md) for that committed comparison. These corrections extend the P3 implementation described in [P3_HANDOFF.md](P3_HANDOFF.md). P4–P7 have not started. No-commit/no-push notes below describe the earlier validation checkpoint.

## R1 — tentative reassignment must preserve required scheduling

Create internal work with an open, unlinked Schedule service or Schedule return visit task due October 4. Change Who and save a tentative October 8 plan. Before correction, the combined assignment command completed the required task and substituted Complete planned internal work with a later execution deadline. Its assignment composition bypassed the scheduling command's ready-plan guard.

`changeInternalDispatch` now preserves the real scheduling tasks when composing a tentative plan. It passes their unchanged state into scheduling rather than projecting a completed primary task. Obsolete allocation tasks may retire after reassignment; the required scheduling task, its deadline and work-order next action remain. `saveInternalSchedule` supplies an execution deadline only for a ready plan. A subsequent ready save completes scheduling once and creates the applicable execution action and policy deadline. Existing follow-up/approval guards and transaction access checks remain in force.

Regression tests cover both task types on fixture, native Miniflare D1 and real PostgreSQL. They assert the entire required task, work-order action/deadline, actual new performer, actor-bound replay, a single targeted tentative notification, and the later ready transition. Both tentative and ready composition paths have fault-injected rollback tests that preserve assignment, work, tasks, plan history and outbox before a successful retry.

This supports [AT46](ACCEPTANCE.md) and the ready-plan invariant in [ENGINEERING.md](ENGINEERING.md).

## R2 — relative agenda membership must use the saved planning zone

Save an October 4, 00:30 Eastern appointment, then change the organization planning zone to Central. At `2026-10-04T04:30:00Z`, the current Central date is October 3. Before correction, Today compared that date against the saved Eastern October 4 day and omitted the appointment. The same comparison could misclassify upcoming and unfinished work.

The server captures one reference instant for the response. Today, Upcoming and Needs replanning evaluate that instant in each plan's saved zone. Selected Week remains an absolute range of saved civil dates. Fixture filtering happens before counts and pagination. D1/PostgreSQL read only distinct, tenant/store-scoped zone metadata in stable pages of 100; one parameterized JSON map supplies the date/week comparisons inside native record and count queries. Records retain server filtering, ordering and cursor pagination. Stored commitments and exact instants are unchanged.

Agenda warnings use the same response instant. The header identifies the current planning zone; a row identifies its saved zone when different. Regression tests cover day/exact Today membership, exclusion from Upcoming/replanning, later overdue membership, mixed saved zones before pagination/counts, Sunday-to-Monday year rollover, unchanged selected Week, empty scope and another tenant. The real rendered-page regression checks Today, Upcoming and Needs replanning together.

This supports [AT39–AT42 and AT47](ACCEPTANCE.md) and the saved-zone contract in [ENGINEERING.md](ENGINEERING.md).

## Reproduction and targeted validation

- `.codex-runtime/p3-review-red.log`: **16 failures before application fixes** — six required-task cases, nine saved-zone query cases and one rendered-page case. All three persistence adapters reproduced both defects.
- `.codex-runtime/p3-review-focused-final.log`: **96 passed / seven intentional skips** across the complete scheduling/domain and authenticated-route/render suites. Actual PostgreSQL tests ran, including the three existing schedule/move/result/return races. The skips are adapter-inapplicable race/parity copies.
- The first full-check attempt stopped at lint because an earlier local QA assertion script used loose types. That retained script now has repository-derived types; application lint passed on the final rerun. The failing log is not passing evidence.

All required checks pass on the final application/test source. `.codex-runtime/p3-review-final-checks.json` records exit code zero for seed, typecheck, lint, the full unit suite (**207 files / 1,454 passed / 15 intentional skips**), workflow suite (**four files / 68 passed**), Sites build and Render build. Corresponding logs use `p3-review-final-*`. No PostgreSQL-unavailable skips were substituted for the real database runs.

## Browser correction journeys

The final-source local PostgreSQL development preview is `127.0.0.1:3035`. Browser checks use independent manager and technician/store sessions, desktop 1440 × 900 and phone 390 × 844. Fictional QA work orders CPS-2026-3223–3226 use an existing store and preserve the 15-store presentation.

Manager changes Devon to Maria and saves a tentative return plan. The saved Schedule return visit and October 4, 2 PM Eastern deadline remain visible after reopening; a guarded database assertion confirms the entire task is unchanged. Saving the reviewed ready plan creates Complete planned internal work. Maria finds the plan, records a visitless result and Robin confirms that exact result on the phone. Manager review agrees with the store's verified state, then the dedicated closeout checklist closes the work with explicit cost/invoice/classification deferrals. Refresh after the development server restarts preserves the closed state.

To exercise different civil dates at the real browser clock, only the retained fictional localhost organization's zone was temporarily changed from Eastern to Honolulu, then restored to its original value. Today contains all three October 4 Eastern plans; Upcoming contains none; the October 3 Eastern job appears under Needs replanning for the technician and manager. Saved-zone labels distinguish the current preference from old commitments. The automated tests also reproduce the original Eastern/Central midnight case and cross-year mixed-zone paging. Phone form/agenda measurements show no horizontal overflow.

Guarded read-only `.codex-runtime/p3-review-browser-final.json` / `p3-review-browser-assertions.json` pass: three immutable revisions in one attempt, scheduling completed only at the ready revision while keeping its original deadline, one attributed visitless result, one verification tied to that result, completed assignment/tasks, closed work and pending targeted notifications. The other day/exact plans retain their saved Eastern zone and the exact instant. The original organization zone is restored. The presentation retains 15 stores and five vendors.

Screenshots: [tentative obligation on desktop](../../outputs/internal-dispatch/p3-review-tentative-desktop.png), [tentative phone form](../../outputs/internal-dispatch/p3-review-tentative-phone.png), [saved-zone Today on phone](../../outputs/internal-dispatch/p3-review-zone-today-phone.png), [technician result](../../outputs/internal-dispatch/p3-review-result-phone.png), [store confirmation](../../outputs/internal-dispatch/p3-review-store-confirmation-phone.png), [manager closure after restart](../../outputs/internal-dispatch/p3-review-manager-closed.png).

Read-only compatibility spotchecks after the final builds covered exact manager search and its one-record drill-through, phone store visibility, unsaved store creation and internal-routing forms with optional classification, the existing outside-vendor response and immutable Version 1 authorization, the technician's no-work-order check-in form, invoice allocation/variance evidence, PM numerator/denominator and an exact missed source occurrence, and equipment/lifecycle cost sources with human replacement choices. The retained three-job visit still has independent completed, quote-required and parts-required outcomes. A guarded retained-fixture count confirms 15 stores, five vendors and two technicians. These spotchecks did not repeat public-link/device mutations, every existing workflow variant, browser fault injection or live delivery.

These are implementing-agent checks, not an independent reassessment. The preview is development mode; production-mode browser rehearsal, production authentication and hosted release acceptance remain open as recorded in the handoff. No live email/SMS, hosted reset, original-checkout change, commit, push or deployment occurred.
