# P3 live internal scheduling handoff

**Implementation checkpoint: October 3–4, 2026. The two independent P3 review findings are corrected and locally verified; independent reassessment remains open.**

Latest evidence: [P3_CORRECTIONS.md](P3_CORRECTIONS.md). Both defects failed regression tests before fixes on fixture, D1 and real PostgreSQL. The final rerun passes seed/typecheck/lint, 1,454 tests (15 intentional skips), 68 workflow tests and both builds. Corrected desktop/phone manager → technician → store-confirmation → manager-closeout journeys pass on the local development preview. Relative agenda filtering now respects saved zones; tentative combined reassignment preserves real scheduling obligations. IDP-03 remains open pending independent reassessment.

**Publication note:** The user subsequently authorized the combined P1–P3 commit and push for Claude. Use [P1_P3_REVIEW.md](P1_P3_REVIEW.md) for the committed comparison; earlier uncommitted-status and no-commit notes below describe the validation checkpoints before publication.

Validation used `C:\Users\Kedrick\.codex\worktrees\internal-dispatch-plan\Clark Pump and Shop App`, branch `codex/internal-dispatch-p1`, pre-P1 HEAD/base `861630053e7fdff3686926047399f55a9be10495`, including staged, unstaged and untracked files. The original OneDrive checkout is a different checkout. Existing P1/P2 application and review changes were preserved. P4–P7 remain unimplemented.

Read [README](README.md), [ENGINEERING](ENGINEERING.md), [P3 prompt](PHASE_PROMPTS.md), [AT33–AT48](ACCEPTANCE.md), [P1 corrections](P1_CORRECTIONS.md) and [P2 corrections](P2_CORRECTIONS.md). P2's five reported defects were independently cleared by the user-supplied Astra reassessment; that reassessment did not independently repeat PostgreSQL, browser journeys or the full suite. Later P1 R1–R3 reassessment and broader release gates remain open.

## Delivered behavior

Managers can save a week, a day marked Anytime, or a store-zone exact appointment from Dispatch or a work order. The same Schedule page lets them explicitly change Who and When in one transaction. Saving is live. Separate controls change an optional Target completion with a reason; legacy targets remain unset. The current next-action deadline is labeled separately and retained through ordinary calendar edits.

Dispatch provides a selected-week agenda grouped by handler and day, Week only / To allocate / Manager to arrange groups, an independent Needs planning backlog, older unfinished Needs replanning and Results to review. Region/store/person/search/readiness filters retain context through schedule drill-down and pagination. Technicians have Today, Upcoming, All my jobs and Available team work; only their own flexible week/day plans can be moved or removed. Fixed appointments, assignment changes and targets remain manager actions. P2 result/help controls are the execution path.

Taking a planned pool job carries its calendar plan onto the claimed assignment in an immutable revision. Returning or separately reassigning work clears the current plan and explains the consequence; assignment and schedule history remain. Reporting a result retires that execution attempt. Parts readiness and a deliberate return plan create a new numbered attempt on the same work order, preserving findings and follow-ups. No job is automatically moved at midnight.

Waiting work can receive a tentative plan only after a manager records a review reason; it stays out of Ready. Unrelated safety/approval/follow-up obligations remain open. An actual Schedule service/return task is completed only by a ready live plan, with an explicit execution-policy deadline (urgent/emergency: 24 hours; other work: 72 hours from the save). Ordinary plan edits preserve existing tasks/deadlines and the independent target.

Targets warn for late/uncertain plans and require an explicit keep/move choice. Known exact intervals warn about overlap. Unknown repair duration and incomplete comparison windows are stated as uncertain. A saved organization planning-zone snapshot gives week/day values civil-calendar meaning; exact input preserves the store IANA zone and actual instant. DST gaps are rejected; repeated times require Earlier or Later occurrence. Monday is the first day; weekends and cross-year weeks are reachable.

## Persistence, access and compatibility

- Immutable `ops_internal_schedules` revisions carry an execution attempt and org/work/assignment identity; `WorkOrder.internalScheduleId` points to the single current plan. Queries join all four identities. Results/return/reassignment retire the pointer without overwriting historical facts.
- Fixture, D1 and PostgreSQL use the same command/API contract. Expected work version, assignment and plan pointer fence stale writes; actor-bound request hashes fence retries. Assignment, plan, tasks, audit, access assertions, receipt and targeted outbox commit atomically.
- Native scoped counts/queries use separate 25-row backlog/period/replanning/review pages and stable cursors. Calendar clients receive projections, not whole-tenant snapshots. Conflict comparisons are bounded to 100 records; person/region choices are bounded to 100. History shows the newest 50 revisions.
- New D1 migrations: `0069_chilly_lila_cheney.sql`, `0070_flippant_leopardon.sql`. New PostgreSQL migrations: `0070_brief_ultron.sql`, `0071_dazzling_blue_blade.sql`. Additive nullable fields preserve existing unset targets/plans; populated pre-P3 upgrades are tested. PostgreSQL creates the assignment composite unique index before its referencing foreign key.
- Internal plans do not create or modify vendor `ServiceAppointment` rows. Vendor Upcoming visits retains its existing source/count. A separate confirmed provider appointment warns and remains unchanged. Targeted schedule/target notices reuse configured dispatch channels and fake-provider tests; obsolete plan/target notices are suppressed. No live delivery was attempted.
- Organization/store grants are checked before reads/mutations/replay and again inside the transaction. Technicians do not gain general work-control, vendor, financial or setup powers. The visible role picker remains a fictional preview control.

## Initial P3 validation checkpoint

The initial P3 implementation passed all required checks. `.codex-runtime/p3-verified-checks.json` records that run; corresponding logs use `p3-verified-*`. The post-review correction run in [P3_CORRECTIONS.md](P3_CORRECTIONS.md) supersedes it for current application/test-source validation.

| Check | Final result |
|---|---|
| `npm run db:seed` | Passed; separate 65-store scale fixture plus 15-store presentation |
| `npm run typecheck` / `npm run lint` | Passed |
| `npm test` | 207 files / 1,435 passed / 15 intentional skips |
| `npm run test:e2e` | Four workflow files / 68 passed |
| `npm run build` / `npm run build:render` | Sites and Render production builds passed |
| Focused final API/page run | 11 passed; `p3-route-final.log` |

Actual fixture, Miniflare D1 and PostgreSQL domain/upgrade scenarios ran, including three PostgreSQL schedule/move/result/return races. Native 1-store and 65-store parity creates real work orders, tasks, assignments and plans and compares scoped pagination/counts. The skips are non-PostgreSQL copies of PostgreSQL-only races and redundant fixture-only comparisons; the native checks ran against the guarded localhost database. The earlier `p3-final-unit.log` has three failures before the final corrections and is not passing evidence. Unclaimed-pool Schedule controls and stale-plan conflict wording were reproduced first in `p3-pool-control-red.log` / `p3-stale-current-red.log`; final regressions pass.

The final local PostgreSQL **development** browser preview on `127.0.0.1:3035` uses the frozen source, separate fictional role sessions, measured 1440 × 900 desktop and 390 × 844 phone views. The production-mode preview launch with fictional preview access was rejected by automatic approval review as “blocked by policy,” without a more specific reason; it did not run. Both production builds passed, but this is not a production-mode browser rehearsal. The retained QA database was backed up before its normal additive migration upgrade. The original checkout/port 3000 and hosted data were untouched.

| Browser journey | Saved-record evidence |
|---|---|
| Manager plans week/day/exact | CPS-2026-3218–3222 cover Week only, Anytime, To allocate, Manager to arrange, an older unfinished job and exact appointment. Target warning keeps entered values; a stale form shows the current plan/action. The exact form rejects a DST gap and an ambiguous fold, then accepts explicit Earlier. CPS-2026-3220 ends at Oct 4, 11 AM Eastern / 45 minutes; the Nov 1 fold revision remains in history. |
| Technician picks up and moves work | CPS-2026-3219 is claimable only after Take job; pickup carries its week plan onto Maria's assignment. Unclaimed pool jobs have no Schedule control. Maria can move her own week/day plan; fixed appointments, targets and reassignment remain manager actions. Today contains dated work, not the entire assigned backlog. |
| Parts → tentative return → readiness → result | Maria flags parts on CPS-2026-3218. Its old plan retires. Jordan records a tentative attempt 2 while the parts follow-up remains open, marks ready with a reason, then saves a ready return day. The same work order/assignment retains both results and both attempts; Maria records completion without a fabricated visit. |
| Store confirmation → manager closure | Robin confirms the exact current result on the phone. Manager Results to review and the work record agree; the dedicated manager closeout checklist closes the verified work with cost/invoice/classification deliberately deferred. The older manual-close form correctly rejects bypassing that recorded-result path. Closed work leaves actionable queries and result review. |

Guarded read-only `.codex-runtime/p3-browser-final.json` / `p3-browser-assertions.json` confirm CPS-2026-3218 is closed, its assignment is completed, its plan pointer is retired, nine immutable revisions span two attempts, two attributed visitless results remain, Robin's verification names the current result, all required tasks/follow-ups are completed, and no observed-visit link exists. The independent target is unchanged. Native filtered queries contain three other planned jobs and the one older replanning job; no closed job leaks into them. Thirteen targeted dispatch notices remain pending, with no live delivery. The retained presentation is exactly 15 stores / five vendors / two technicians.

Screenshots: [manager agenda](../../outputs/internal-dispatch/p3-manager-week.png), [manager phone](../../outputs/internal-dispatch/p3-manager-phone.png), [stale conflict](../../outputs/internal-dispatch/p3-stale-save.png), [DST validation](../../outputs/internal-dispatch/p3-dst-validation.png), [technician result](../../outputs/internal-dispatch/p3-technician-result-phone.png), [store confirmation](../../outputs/internal-dispatch/p3-store-confirmation-phone.png), [manager closure](../../outputs/internal-dispatch/p3-manager-closed.png).

Compatibility spotchecks include exact manager search/source links, unsaved store creation and deferred-classification routing forms, invoice amount/review safeguards, PM 92/99 and its source occurrence, and lifecycle's $3,490 source-cost/human-review view. The existing three-job internal visit still shows separate outcomes; CPS-2026-3206 remains Waiting on vendor with immutable BrightLine Version 1 and its canonical billing instruction. Maria's phone Today excludes the closed job and the no-WO form still loads with store scope/review reason. Existing public vendor/cross-channel/unmatched mutation evidence is retained in P1/P2 handoffs, and the final 68 workflow tests pass. Fresh public-link/device transitions, every legacy variant, browser fault injection, lost-network replay, production authentication and hosted release rehearsal were not repeated manually. The local development preview remains available on port 3035; temporary test viewports were reset and the technician preview role restored. No original-checkout changes, hosted reset, live email/SMS, commit, push or deployment.

## Independent reviewer instructions

First confirm the exact directory/branch and that the uncommitted P3 files are present. Review all changed/new files without changing application code, committing, pushing, posting externally or deploying. Evaluate AT33–AT48 and P1/P2 compatibility. Reproduce concrete defects in permissions/tenant scope, civil dates/DST, target versus next-action deadlines, concurrent schedule/result/return, atomic combined assignment, retry/rollback, notifications, native counts/pagination, unresolved backlog, return attempts and the manager → technician → store-confirmation journey. Report reproduction steps and file/line references. Do not flag P4–P7 absence. Distinguish independently repeated evidence from implementing-agent logs.

P3 and its two reviewed corrections are locally verified. Read [P3_CORRECTIONS.md](P3_CORRECTIONS.md) and independently reassess this exact uncommitted worktree before closing IDP-03 or deciding on a limited P1–P3 pilot. Later P1 R1–R3 reassessment and broader P2/production-release limits remain open. Stop before P4.
