# Internal dispatch acceptance and review

Status: P0 source/document review is complete. P1's F1–F3 are cleared by [Astra's reassessment](P1_AUDIT.md); later R1–R3 reassessment remains open. P2 is implemented locally and its five reported defects are independently cleared by the user-supplied Astra reassessment recorded in [P2_CORRECTIONS.md](P2_CORRECTIONS.md). [P2_HANDOFF.md](P2_HANDOFF.md) and the checkpoints below distinguish implementing-agent validation, independent targeted verification and broader acceptance still open. P3–P7 remain implementation requirements. Earlier checkpoints remain historical.

Baseline inspected: `861630053e7fdff3686926047399f55a9be10495` (`origin/codex/platform-rebuild`). Recheck the implementation baseline before using this matrix. Read the phase plan, phase prompt, `AGENTS.md`, and `docs/PLATFORM_IMPROVEMENT_PASSES.md` together. Keep the existing IM item IDs and their evidence; this matrix does not replace the persistent checklist.

## 1. How to use the gates

- **P0:** baseline, documentation, and design contracts.
- **P1:** assignment, team pickup, and return/reassignment.
- **P2:** technician results, blockers, visits, and optional check-in.
- **P3:** basic live scheduling by week/day/time and shared weekly visibility. **P1–P3 form the first usable release.** There are no drafts in P3; a save changes the live schedule, and the interface says so.
- **P4:** draft/share, ordered daily stops, availability, and honest workload estimates.
- **P5:** provider-neutral travel estimates, map support, and suggestions at additional stores.
- **P6:** transparent scheduling comparisons and suggestions.
- **P7:** complete-journey, scale, migration, and release rehearsal.

For each phase, run its scenarios and the earlier scenarios affected by its changes. A phase is not accepted because its pages load or its unit tests pass. Acceptance includes domain behavior, the actual database path, permissions, saved-state behavior, and the human journey.

Record each scenario as **passed**, **failed**, **not run**, or **blocked**, with an exact revision and evidence. “Not applicable” needs a concrete reason and must not be used to remove an agreed requirement. New discoveries get additional IDs; do not renumber these IDs. Do not mark unbuilt later phases complete.

### Evidence types

| Code | Evidence |
|---|---|
| D | Domain and command tests, including failed transactions and audit |
| R | Repository parity on the fixture and the supported SQL adapters |
| G | Real PostgreSQL with separate connections/transactions where concurrency matters |
| A | Actual API/auth boundary tests, beyond merely hiding a button |
| B | Browser journey on the built application, with saved state inspected after refresh |
| U | Visual and interaction review at 1440 px desktop and 390 px phone width |

PGlite and in-process mocks are useful for fast checks. They do not prove concurrent behavior on the actual `pg`/PostgreSQL path. Record them by their real name. Do not label PGlite evidence as a real PostgreSQL race test.

## 2. Shared invariants

1. The work order remains the canonical service record. Scheduling does not create a second job with a second problem description.
2. Assignment, schedule, current next-action deadline, optional repair target, actual visit, result, and confirmation remain distinct.
3. The current `dueAt` behavior must be inspected before use: it is a current task/next-action deadline, not a stable repair-completion deadline. Do not relabel all existing values as “Repair due.” A new optional target such as `targetCompletionAt` needs separate semantics, migration, commands, and labeling. Legacy records with no target say that no repair target is set.
4. Every unresolved work order still has a responsible party, next action, next-action due timestamp, and escalation. Optional dispatch planning cannot remove that accountability.
5. Reads and writes are organization-scoped before role, team, technician, or store filters. Count links, search, files, exports, and recommendations follow the same scope.
6. Domain changes, current projections, audit, and required follow-up/outbox records commit consistently. Failed writes must not leave a partial assignment, plan, visit, or result.
7. Retries and simultaneous requests do not duplicate assignments, scheduled work, visits, results, or alerts. A deliberate new work attempt is distinguishable from retrying the old one.
8. Planned locations are not current physical locations. Estimated driving and recorded presence are not payroll or per-job labor.
9. Existing public vendor/QR/store-device flows retain their permissions and behavior. Technician accounts do not grant access to internal manager, finance, or vendor-company functions merely to make dispatch work.
10. Normal unscheduled repairs, week/day commitments, and held “next visit is fine” work are distinct. Routine does not mean “can wait indefinitely.”

## 3. P0 — baseline and design contracts

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT01 | Inspect the working checkout, remote baseline, existing internal commands, role mapping, migrations, and scripts | Record the exact revisions and local changes. Use the approved base and preserve unrelated files. Do not overwrite a newer implementation with the planning baseline. | Source report |
| AT02 | Crosswalk IM-01–IM-10 into the phase plan | Retain completed evidence and outstanding requirements. Explicitly replace superseded radius-only suggestions and invented one-hour estimates; preserve the additional-work flow at existing stops. | Document review |
| AT03 | Review the manager and technician screen contracts | Work → Dispatch is a secondary Work destination. Every task can be performed with labeled buttons on a phone; desktop drag-and-drop is optional. Confirm where unplanned, assigned backlog, today, week, blockers, and history appear. | Sketch/review |
| AT04 | Confirm scope and data assumptions | Two technicians means the fictional demo, not verified customer staffing. No live tracking, payroll, leave reasons, forced en-route updates, or automatic vendor dispatch. Travel-provider choice is not inferred from a sample fixture. | Decision log |
| AT05 | Trace existing deadline and result semantics | Document actual `dueAt`, task generation, assignments, visits, verification, and completion behavior. Define a separate optional repair target before implementing comparisons against it. | Source report |

## 4. P1 — assignment and team pickup

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT06 | Facilities assigns directly to technician, team, or field manager | All three routes work without a mandatory field-manager approval. Exactly one current accountable state is shown, with a useful next action and fallback. | D/R/A/B |
| AT07 | Route work as Choose later or Outside vendor | It does not become claimable internal work. Changing routing through the authorized command updates eligibility consistently. | D/R/A/B |
| AT08 | Internal work is available to the team | Only an active internal_technician with current grants covering this store can take an explicitly claimable pool job. An unclaimed job retains a responsible manager and next-action deadline. Manager-pending work cannot be claimed even by an otherwise eligible technician. No named-crew membership table is assumed. | D/R/A |
| AT09 | Two technicians tap Take job at the same time | Run through separate real PostgreSQL connections with a controlled overlapping start. Exactly one wins. The other gets a helpful current-owner conflict. One current assignment and one successful command audit remain. | G/A/B |
| AT10 | Claim competes with manager reassignment or provider change | No silent overwrite or two owners. The losing stale action refreshes the actual state. Repeat with the two operations started in both orders. | G/D/A |
| AT11 | Return a job to the team | Current next-action semantics remain explicit; the optional repair target is unchanged. Record the releasing person and time. The job leaves the technician's assigned list and returns to the eligible queue. | D/R/B |
| AT12 | Return urgent or overdue work | The responsible manager receives one actionable in-app/outbox event under configured delivery policy. Repeated requests do not produce repeated events. Ordinary returns do not create an unnecessary acknowledgment ceremony. | D/G/B |
| AT13 | Manager reassigns work with no active visit | Old history remains. The old technician's current list loses the assignment; the new technician sees it after refresh. Search, detail, team view, and counts agree. | D/R/B |
| AT14 | Reassign work with an active visit | The interface offers the designed explicit handoff path or blocks with the action needed. Existing visit performer, observations, and attachments are never rewritten. The old technician can finish the authorized existing visit. | D/G/A/B |
| AT15 | Client resubmits after timeout or loses the first success response | Replaying the same command key returns the persisted result without another assignment/history/outbox row. A genuinely different stale request receives a conflict. | D/G/A/B |
| AT16 | Finance, store manager, outside vendor, ineligible member, wrong store, or wrong organization calls assignment endpoints directly | Deny according to the explicit permission contract. Buttons and API agree. Outside-provider links cannot use internal member assignment commands. | A/G |
| AT17 | Field manager has companywide access, partial scope, empty scope, or absent unconfirmed scope | Use `sessionHasNoStores` semantics. Confirmed companywide access works; empty/unconfirmed scope never expands to all stores. Test both list totals and mutation targets. Technician reads likewise stay within granted scope. | R/A/B |
| AT18 | Assignment or audit persistence fails midway | Whole transaction rolls back. No current owner without history, no audit claiming success without assignment, no orphan notification. | D/G |

## 5. P2 — field results, blockers, and visits

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT19 | Signed-in technician finds and opens their assigned job on desktop and phone | At 1440px and 390px, My jobs / Available team work use concise assignment text and secondary manager information without repeated names. Immediate ready work precedes a distinct For a suitable visit group with held reason and applicable deadline; blocked/held work never appears Ready to work. Opening a job shows store, equipment if known, problem/work requested, instructions/photos, and Record result / Flag a problem immediately, with Full work record secondary. The complete result/help journey does not require broad record navigation. Identity fills from the session; no typed technician name or separate assignment acceptance is required. | A/B/U |
| AT20 | Check-in is optional; technician records a result without a visit | The result saves through the canonical work commands with actor and history. Do not fabricate check-in/out, verified arrival, or onsite duration. | D/R/A/B |
| AT21 | Check-in is required; technician tries to finish without a visit | Show the required path. Only the authorized manager override can bypass the requirement, with a recorded reason and actual actor. Policy is enforced server-side and does not become a location-permission requirement. | D/A/B |
| AT22 | Technician begins through a supported channel and finishes through another | Reuse one channel-independent visit. Reload, double tap, back navigation, and timeout retry do not create duplicate active visits. Preserve existing QR/trusted-device behavior. | D/G/A/B |
| AT23 | Technician selects and deselects additional work at the same store | Details can be opened without accepting work. Saved selected jobs persist after refresh and checkout applies per job. Availability is rechecked when adding. | D/G/B/U |
| AT24 | Multi-job visit records one fixed, one waiting on parts, and one needs a vendor | One visit, separate work-order outcomes. Required follow-ups commit atomically with unresolved results. One finished visit does not close every linked work order. | D/R/G/B |
| AT25 | Record Need parts, Need help, Need a vendor, or Cannot get to it today | Flag a problem is available on the focused job screen and asks only relevant details. Manager board and work record show the actual blocker, responsible next person, and next action. Cannot get to it today preserves assignment unless Return to team is explicitly selected. Waiting work remains visible but is not labeled ready or presented as ready for travel suggestions. | D/R/B |
| AT26 | Needs a vendor becomes an outside assignment | Preserve the same work-order number, internal work history, costs, findings, and evidence. Authorized manager performs issuance; the technician cannot silently authorize external charges. | D/R/A/B |
| AT27 | Manager records a phone update or result on behalf of a technician | Show who entered it and who was reported to have done the work. A reported time remains unverified; the manager cannot backdate a verified observation. | D/A/B |
| AT28 | Technician uploads photos/files with a result and opens them after refresh | One notes/files action works on the focused job screen; saved evidence reopens there without broad record navigation. Files remain tenant/record scoped, downloadable, and linked to the actual result. Failed upload/save preserves notes and selection where recoverable, allows safe retry, and does not falsely report evidence saved. Required versus optional evidence is clear. | D/A/B |
| AT29 | Record Fixed with confirmation required versus not required | Follow existing confirmation policy. “Visit finished,” “result recorded,” “awaiting confirmation,” and “closed” remain distinct. Dispatch does not bypass confirmation or require it on every job. | D/R/B |
| AT30 | Correct a mistaken result, or schedule another attempt after an unresolved result | Keep original evidence and an auditable amendment. Reuse the same work order. A second legitimate visit differs from replaying the first result. | D/G/B |
| AT31 | Follow-up/audit write fails after submitting an unresolved outcome | Result and follow-up remain atomic; no unresolved job disappears from accountable queues. A safe retry creates the intended records once. | D/G |
| AT32 | Internal technician has no matching work order | Use the authorized unmatched-visit path with a reviewable exception. Do not grant Create work order, invoice, setup, or vendor-management permissions to work around the missing match. | D/A/B |

## 6. P3 — live scheduling and weekly visibility

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT33 | Assign without scheduling, or schedule a week before choosing a technician | Assignment and plan remain distinct. Work stays in the correct assigned or needs-planning list, with accountability intact. Week-only work is not silently placed on Monday at midnight. | D/R/B |
| AT34 | Schedule This week, a specific day, or an exact appointment | All modes save and reopen faithfully. Exact time is optional. The manager can see the full selected week's work and the technician can find scheduled and unscheduled assigned work. | D/R/B/U |
| AT35 | Change a job's planned week/day/time | No automatic change to priority, existing next-action due semantics, or optional targetCompletion. History records the schedule change separately. A technician can move only their own flexible work, with material date/conflict notice to the manager; fixed appointments, other people's work and targets require the proper manager action. | D/R/A/B |
| AT36 | Compare schedule to deadline on a legacy work order | Current `dueAt` is labeled as the next action's deadline. A missing optional repair target is shown as missing, not inferred from `dueAt`. Never claim a repair is scheduled late using an unrelated task deadline. | D/R/B |
| AT37 | Set an optional repair target, then move the plan beyond it | Show the target and an understandable warning; preserve the target unless the separate authorized deadline-change action is used. Unknown day within a week is shown as uncertain when the target falls midweek. | D/R/A/B |
| AT38 | Move a normal repair to next week or mark Next visit is fine | These actions remain distinct. Original reported date, target if present, and accountable follow-up remain visible. Neither action silently excludes the work from All open work. | D/R/B |
| AT39 | Save a calendar week/day from devices in different timezones | Persist calendar semantics in the declared dispatch zone. No `Date`/UTC-midnight shift changes the intended week/day. Test year boundaries, month boundaries, and the configured first day of week. | D/R/B |
| AT40 | Save an exact appointment at an Eastern store while viewer/dispatch zone is Central | Input and store detail identify store time. Board comparison shows the correct instant with useful zone labels. Refresh from a UTC browser and phone produces the same appointment. | D/R/B |
| AT41 | Input a nonexistent or repeated local time at DST change | Nonexistent time is rejected clearly; ambiguous time follows the explicit disambiguation contract. No silent one-hour movement. Week/day-only work is unaffected. | D/R/A/B |
| AT42 | Change organization/viewer timezone preferences after schedules exist | Existing exact appointments retain their instant; saved calendar commitments retain defined semantics. Display preference changes do not silently reschedule jobs. | D/R/B |
| AT43 | Two managers schedule/move the same job concurrently, or one completes it while the other schedules | Real PostgreSQL version checks prevent duplicate active commitments and stale revival. Conflict response retains useful entered data and shows current state. | G/A/B |
| AT44 | Remove a scheduled stop or cancel a commitment | Assignment stays unless explicitly returned/reassigned. Work remains visible in backlog. Canceling a plan does not cancel the work order or erase an active/previous visit. | D/R/B |
| AT45 | Schedule one work order for a continuation/return attempt | Distinguish a deliberate new attempt from duplicate scheduling. Keep one canonical WO and an intelligible history; don't enforce “one schedule forever” or permit accidental duplicate current attempts. | D/R/G/B |
| AT46 | Use P3 scheduling controls | Saves are live, immediately visible after reload, and clearly described. No misleading Share before drafts exist. Fulfilling a real Schedule service task completes/replaces that obligation with an explicit next action and policy deadline; unrelated tasks and Target completion are unchanged. Notifications use the ENGINEERING event/recipient table and configured channel. | D/R/B/U |
| AT47 | Browse needs-planning and week views with region/store/technician filters | Counts and links open the exact scoped records; filters survive appropriate drill-down and reset deliberately. Stable pagination finds all eligible work without a full-tenant browser payload. | R/A/B |
| AT48 | First-release manager → technician → manager journey | Manager reviews routine work, assigns and schedules it; technician finds it, records result or blocker; manager sees what needs action. Complete at 1440 and 390 px without drag, map, exact appointment, or check-in when optional. | B/U |

## 7. P4 — draft/share, daily order, availability, and workload

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT49 | Manager prepares future draft changes | Published technician view and current assignment remain unchanged. Proposed reassignment is visibly pending. Current live accountability does not move until the explicit publish/apply action. | D/R/B |
| AT50 | Share a valid plan | Recheck current job status, assignment versions, access, appointment constraints, and plan revisions. Publish accepted changes with audit and required outbox events consistently. Technician refresh shows the publication. | D/G/A/B |
| AT51 | A technician reorders published stops while the manager holds an older draft | Manager cannot silently overwrite the technician. Show the conflict, preserve draft intent, and require an explicit reconciliation/retry using fresh versions. | G/A/B |
| AT52 | Job is claimed, completed, blocked, moved to vendor, or removed from scope before sharing | Publish revalidation catches the changed item. No stale job revival or unauthorized reassignment. Clearly report what was or was not published; avoid hidden partial success. | D/G/A/B |
| AT53 | Share request/notification delivery retries after timeouts | One publication revision and one deduplicated material-change event per intended recipient/change. Provider failure cannot undo published work or falsely claim delivery. In-app state remains usable without email configuration. | D/G/A/B |
| AT54 | Rearrange many future jobs and then share | Draft edits do not generate an alert per drag. Share gives a useful grouped update; urgent current-day changes remain actionable. Notification text links to the actual updated work. | D/B/U |
| AT55 | Technician changes flexible stop order on phone | Button-based ordering works. Manager sees the saved order. Exact appointments are not silently moved; rescheduling them remains explicit. Concurrent stale reorder is handled. | D/G/B/U |
| AT56 | Add an unavailable day/period after work is planned | Flag affected plans without silently moving jobs, deadlines, or assignments. Store only planning availability, with no leave reason, attendance, payroll, or shift-management requirement. | D/R/A/B |
| AT57 | Compare several short jobs with an all-day repair | Workload uses disclosed estimates/ranges rather than job count. Keep travel and repair estimates separate. Duration is optional and editable; changing it does not amend actual visit evidence. | D/R/B |
| AT58 | Two jobs lack estimates or travel data is missing | Show known totals and unknown counts. Never insert a hidden one-hour default, display precise free capacity, or mark “fits” from incomplete inputs. Warn without blocking ordinary scheduling. | D/R/B |
| AT59 | Set origin and endpoint for a journey across the footprint | P4 saves the explicitly selected start/end and identifies return intent without guessing current location. Driving remains unavailable before P5. After P5, repeat with three hours of repairs and five hours of driving; show the full journey, not a light day. No last-check-in inference as live origin. | D/R/B; calculation depends on P5 |
| AT60 | Interrupt today's plan for urgent work | Manager sees affected commitments and chooses what moves. Neither the system nor technician changes deadlines implicitly. Existing active work and fixed appointments remain visible. | D/G/B/U |

## 8. P5 — travel estimates and additional-store suggestions

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT61 | Provider-neutral route contract with sample and real sources | Store source, computation time, profile, direction, coordinate/version key, freshness, and sample/real distinction. Adapter tests use deterministic data. No provider key or secret appears in client output or source. | D/A |
| AT62 | Provider account/key or license decision is unavailable | Ordinary assignment/scheduling works. Missing setup is explicit; no fabricated route success. Credential/budget/caching decisions are a documented dependency for live provider validation, not a reason to skip provider-independent math/tests. | D/B |
| AT63 | Compute added driving for inserting C between A and B | Use directional `A→C + C→B − A→B` and valid insertion positions, including route endpoints. Reordering user stops is not implicit optimization. Explain inconsistent negative results rather than selling them as free travel. | D/R |
| AT64 | One required leg is missing, expired beyond policy, or has invalid coordinates | Mark estimate unavailable and omit unsupported ranking/fit claims. Do not substitute aerial distance as driving time or silently geocode a fictional address. Refresh/retry recovers without losing the selected jobs. | D/A/B |
| AT65 | Existing planned store has unaccepted held jobs | Exclude the store entirely from along-the-way suggestions. Existing additional-work-at-this-store remains the path, regardless of whether those extra jobs are accepted. | D/R/B |
| AT66 | Compare claimable internal held work, own eligible work, vendor-held work, and another technician's assignment | Only agreed internal candidate types are suggested within scope. Own work is labeled as assigned already. No vendor/Choose-later/other-person work is silently claimed. Show a colleague's planned visit only through authorized consolidation context. | D/R/A/B |
| AT67 | Several eligible jobs exist at an additional store | Group by store; show existing description, WO number, equipment/location if known, priority, target/next-action labels correctly, and details. Select without expanding; opening details does not accept. | B/U |
| AT68 | Accept an additional stop while another person takes the job | Live acceptance atomically claims and plans, revalidating availability. A draft addition has no live claim; Share revalidates and atomically claims/publishes. Losing request gets a helpful conflict; no partial assignment/plan. Existing own assignment is not recreated. | G/D/A/B |
| AT69 | Repeated accept after network failure or double tap | One intended stop occurrence and job inclusion; multiple chosen WOs remain separate WOs under that stop. A deliberate later return appointment may be a different occurrence at the same store/day. Retry never creates an observed visit or marks work started. | D/G/A/B |
| AT70 | Accept two suggested stops in sequence | Recalculate all candidate detours against the changed route. Do not sum stale independent deltas. A newly added store disappears from the suggestion list immediately and after refresh. | D/R/B |
| AT71 | Route crosses a region boundary, has an exact appointment, or uses an alternate start/end | Geography does not override store permissions or appointment constraints. Administrative regions filter access, not road adjacency. Calculations use explicitly selected origins/endpoints and visible estimate basis. | D/R/A/B |
| AT72 | Map fails, route source times out, or candidate list is empty | Usable list and schedule remain. Show meaningful missing/error/empty state and retry. No global page crash, stalled indefinite spinner, or implied guaranteed route. | A/B/U |
| AT73 | Fictional demo versus live data | Exactly labeled sample estimates in the showcase. Real-source validation uses permitted verified locations and reports actual provider/setup status. A sample table test cannot be cited as live road-route evidence. | D/B |

## 9. P6 — scheduling comparisons

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT74 | Nearby technician has an all-day commitment; another is farther away with short jobs | Compare complete-trip travel, existing commitments, known estimate ranges, and uncertainty. Do not rank simply by closest store or number of stops. Explain why an option requires moving work. | D/R/B |
| AT75 | Candidate repair duration or technician workload is unknown | Can show a travel opportunity, but cannot assert sufficient capacity or a finish time. Labels distinguish “could add to this trip,” “requires moving work,” and “availability needs checking.” | D/B |
| AT76 | A convenient held job competes with urgent/due work or a repeatedly deferred remote store | Urgency, known targets, and existing commitments stay visible. Never automatically displace due work or repeatedly hide inconvenient stores to minimize driving. | D/R/B |
| AT77 | Manager applies a proposed fit after inputs have changed | Revalidate plan, assignment, appointment, availability, and source versions. Show the changed impact before applying; no silent whole-team rescheduling or assignment beyond authority. | G/A/B |
| AT78 | Suggestion engine is disabled or unavailable | Manual assignment and planning continue fully. No mandatory specialist matrix, duration entry, routing provider, or recommendation acceptance is introduced. | A/B/U |

## 10. P7 — end-to-end and operational hardening

| ID | Scenario | Acceptance | Evidence |
|---|---|---|---|
| AT79 | One-store and separate approximately 65-store synthetic workloads | Bounded scoped queries and stable pagination. Measure representative list/week/detail calls and query counts; data volume must not introduce new full-tenant snapshots or full-tenant client hydration. Test sparse, dense, and empty result sets. | R/G/B |
| AT80 | Presentation seed and repeated migrations | Preserve exactly 15 fictional stores, five outside vendors, and two technicians. Field manager is not counted as a technician. Seed/backfill does not overwrite existing assignments, schedules, or user edits and is safe on repeat. | D/R/G |
| AT81 | Existing tenant upgrades without any dispatch data | Previous work, visits, due semantics, permissions, costs, and links remain usable. New optional fields have safe defaults. No forced onboarding or hosted reset is required to use existing workflows. | R/G/B |
| AT82 | Rollback/recovery rehearsal on a disposable database | Verify documented compatible application rollback/feature-disable path, retained data, migration failure recovery, and outbox retry behavior. Do not destroy committed audit or run destructive rollback against the hosted demo/customer database. | G/Runbook |
| AT83 | Wider regression journeys | Manager search/drill-down; store creation; deferred classification; direct/estimate/vendor issuance; accountless vendor response; cross-channel/no-WO visits; invoice safeguards; PM/compliance/lifecycle; confirmation. No dispatch shortcut bypasses their existing requirements. | D/A/B |
| AT84 | Complete broad-footprint week with an urgent interruption | Plan ordinary repairs; publish when P4 exists; tech completes one, blocks one, and needs a return; manager inserts urgent work and moves an affected commitment; later add a valid other-store stop. Roles see consistent state after independent refresh. | G/B/U |
| AT85 | All relevant roles and two independent browser sessions | Facilities, companywide/scoped field manager, technician A/B, store manager, owner, finance, and vendor retain intended boundaries. Inspect real screen contents, commands, direct URLs, scoped counts, and meaningful empty/denied states. | A/B/U |
| AT86 | Keyboard, phone, and degraded UI | Complete primary actions without drag; visible focus, labeled controls, touch targets, readable descriptions, errors near inputs, and no document-level horizontal overflow at 390 px. Selected filters and pending saves remain visible. | B/U |
| AT87 | Concurrent load, restart, stale tabs, and refresh | Saved state persists on the durable backend; stale tabs reconcile rather than overwrite; exact counts still drill to matching records. Compare baseline/resource measurements on the same fixture/build and report conditions. | G/B |
| AT88 | Enable/disable dispatch incrementally | Existing work-order workflows remain usable with the dispatch surface disabled. No data deletion. Partial feature enablement cannot show controls whose required commands/policies are unavailable. | D/A/B |

## 11. Required commands and what they prove

These script names were verified in baseline `package.json`. Run them in the implementation checkout, with an isolated test configuration where commands could mutate data:

```text
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:render
```

Also run the phase's targeted new regressions. If a full-suite failure is investigated separately, report the original failure, the cause, the exact rerun, and whether the full suite was rerun. Do not turn a timeout into a pass by merely increasing its deadline. A build or crawl does not prove an interactive workflow.

The existing `test:e2e` script includes a file named `ops-postgres-engine.integration.test.ts`; inspect the actual engine used before describing it. Add or run a dedicated **real PostgreSQL** integration harness for G scenarios. It must use the real repository/transaction adapter, isolated schema/database and independent client connections, with reproducible overlap rather than sleeps that hope to race. Record engine version and test command. Test both the success and conflict/rollback paths. Never use the shared Render/customer database for destructive tests.

Fixture, SQLite/D1-compatible, and PostgreSQL implementations must agree on supported command/read semantics. Document runtime limits honestly; do not silently drop the retained adapter or present a fixture-only implementation as durable multi-user behavior.

For external mapping and notification delivery, split evidence:

- **Required without external credentials:** adapter contract tests, deterministic failure/retry cases, calculation correctness, configured/unconfigured UI, authorization, and outbox persistence/idempotency.
- **Required to claim live integration:** actual configured-provider exercise with permitted inputs, observed responses/delivery, and configuration/cost/caching constraints resolved.

No key is requested in chat or committed. If live credentials are unavailable, mark that verification **blocked/not run**, keep the rest of the phase reviewable, and leave the live-integration acceptance open. Do not fabricate data, relax the contract, or claim provider success from mocks.

## 12. Browser acceptance protocol

1. Identify the built revision, backend, dataset, role, store scope, timezone, and local URL. Do not use an unrelated running checkout as evidence for a reviewed commit.
2. Use independent sessions for manager and technician when ownership or concurrent editing is involved. A role picker in one session cannot prove simultaneous behavior.
3. Execute actions through the UI, inspect the result, reload, and verify persistence from the other role. Confirm counts, links, histories, and next-action labels.
4. Inspect screenshots at 1440 px and 390 px widths. Review the first screen and the completed form, not only a screenshot of the top navigation. State the viewport height used.
5. Exercise empty, permission, error, stale-conflict, saving, and success states. A usable happy path alone is insufficient.
6. Record actual navigation/action counts and unnecessary fields where the journey feels burdensome. Fix friction in the current phase rather than adding explanatory paragraphs.
7. Do not conflate local browser validation with hosted deployment. Report hosted checks separately. Do not reset hosted data or send real messages merely to get test evidence.

## 13. Phase handoff evidence template

Copy this into the phase handoff and summarize the result in the persistent checklist. Keep sensitive configuration values out of it.

```text
Phase / linked IM items:
Implemented revision and branch:
Reviewed baseline:
Files / migrations / schema changes:
Concrete user behavior delivered:
Scope deliberately deferred:

Acceptance IDs:
  Passed:
  Failed:
  Not run:
  Blocked (reason and required dependency):

Automated evidence:
  Commands, exit statuses, test counts, exact revision:
  First failures and their fixes/reruns:
  Fixture / SQLite / real PostgreSQL parity:
  PostgreSQL version, isolated harness, concurrency interleavings:
  Transaction rollback and idempotency evidence:

Browser evidence:
  Build/backend/dataset:
  Roles and scopes:
  Desktop and phone viewport sizes:
  Complete action paths and saved-state results:
  Independent-session conflict/retry checks:
  Screenshots or other captured evidence:
  Visual/usability issues corrected:

External integration:
  Mock/sample versus live:
  Mapping provider validation, if applicable:
  Outbox versus actual delivery, if applicable:
  Missing configuration or other open dependencies:

Release information:
  Migration/backfill instructions and repeat-run behavior:
  Feature enablement and compatible rollback/recovery:
  Tests/data mutations performed only locally or in disposable environments:
  Hosted changes (normally none without authorization):
  Known risks and acceptance items still open:
  Next phase and review checkpoint:
```

## Documentation checkpoint

### P0 — October 3, 2026

**Passed as source/document review: AT01–AT05.** Planning baseline: `861630053e7fdff3686926047399f55a9be10495`. The original checkout remained at `ea63d68` with its unrelated untracked `dev4.log`. The planning changes are uncommitted in the managed `internal-dispatch-plan` worktree.

- Inspected existing assignment/accountability, role and store-scope resolution, held-work selection, check-in/out, result/verification/closure, task-deadline projection, appointment, transaction, repository and package-script contracts.
- Three separate reviews covered domain integration, manager/technician UX, and implementation risks/acceptance. Reconciled their findings across the packet, including visitless-result compatibility, the mutable `dueAt` field, pool versus manager-pending work, technician scheduling permissions, repeat stop occurrences and atomic publishing groups.
- Preserved IM-01–IM-10 and their existing evidence. Added the IDP phase crosswalk without marking implementation complete.
- Static document checks passed: 30 local Markdown links resolve; AT01–AT88 are unique and contiguous; all eight P0–P7 prompts and ten IM crosswalk entries are present; the five new files have no trailing whitespace; `git diff --check` passed for tracked documentation changes.

**At the P0 checkpoint, AT06–AT88 remained pending implementation.** Application tests, browser acceptance, live PostgreSQL races, provider calls, deployments, and hosted resets were not performed in that documentation-only pass. P0's reviewed screen sketches are not rendered-UI evidence. P1 evidence follows.

## P1 implementation checkpoint — October 3, 2026

Branch `codex/internal-dispatch-p1`, HEAD `861630053e7fdff3686926047399f55a9be10495`, uncommitted implementation in the managed planning worktree. At this historical checkpoint, P1 was implemented and ready for Astra; AT19–AT88 remained unimplemented. Automated and browser evidence are distinguished below. Later reassessment and P2 evidence supersede its status.

| Scenarios | Concrete evidence |
|---|---|
| AT06–AT08 | Shared domain regression on fixture, actual Miniflare D1 and real PostgreSQL: person/pool/manager targets, current writable membership, no separate acceptance, Choose later isolation and vendor-held eligibility. Independent browser sessions exercise facilities → Chris → pool → Maria. |
| AT09–AT10 | Separate actual PostgreSQL connections overlap two claims, claim/reassignment, and claim/legacy provider change in both start orders. One current assignment, successful mutation audit and version increment. Browser stale claim after assignment to Devon returns a useful conflict. |
| AT11–AT13 | Shared regression verifies return attribution/history, deadline preservation including overdue work, one configured urgent-return notice, old/new technician list agreement and no ordinary-return ceremony. Browser return/reassignment/reload and workspace search agree on Devon. |
| AT14 | Shared regression creates a linked active internal visit whose job already has an outcome; return/reassignment is blocked and performer stays unchanged on all three adapters. UI blocks assignment controls during in-progress work and directs the user to finish the visit. Inspection and parts/vendor blockers retain their specialized task. |
| AT15 | Same-key replay returns the persisted assignment. Changed payload conflicts. Simultaneous PostgreSQL return retries produce one assignment receipt and notification. Browser stale-form feedback is verified; an actual network-disconnect simulation was not performed. |
| AT16–AT17 | Actual API handler/request-context tests cover authenticated identity, forbidden roles, substitution, wrong-origin, empty/read-only scope and revoked membership. Field-manager companywide/one-store/empty/unconfirmed reads and mutation targets are exercised. Native D1 and fixture queries additionally test isolated one-store and 65-store fixtures with 25-row pages, people filtering and a claimed page-boundary record. |
| AT18 | Failure injected after the mutation statements rolls back assignment, version, primary task and outbox on all three adapters. PostgreSQL access revocation between precheck and transaction also rolls back without a successful command audit. |

Browser acceptance used a local PostgreSQL preview and independent in-app-browser manager / Chrome technician sessions, not production identity. Desktop width 1440 px and phone width 390 px fit without horizontal overflow. Phone creation saves internal next-visit work with no category/asset/cost; “Not needed” cancellation preserves the actor, timestamp and reason in history. Existing vendor execution, invoice, PM, confirmation and lifecycle regressions run in the full and workflow suites; the new optional/required internal-result journeys belong to P2.

Screenshots and a focused audit prompt are linked in [P1_HANDOFF.md](P1_HANDOFF.md). No hosted reset, deployment, external provider call or live email delivery was performed.

### Final command evidence

All commands exited 0. The full test/workflow runs were serialized with builds to avoid contention; no test timeouts or assertions were relaxed.

| Command | Result | Local log under `.codex-runtime/` |
|---|---|---|
| `npm run db:seed` | Pass; 15 fictional stores, five vendors, two technicians; separate 65-store synthetic fixture | `dispatch-final-seed.log` |
| `npm run typecheck` | Pass | `dispatch-final-typecheck.log` |
| `npm run lint` | Pass | `dispatch-final-lint.log` |
| `npm test` | 202 files / 1,259 tests passed; includes real PostgreSQL 18.3 dispatch tests | `dispatch-final-all-tests.log` |
| `npm run test:e2e` | Four files / 66 tests passed | `dispatch-final-e2e.log` |
| `npm run build` | Sites/Vinext build passed | `dispatch-final-sites-build.log` |
| `npm run build:render` | Next/Render build passed | `dispatch-final-render-build.log` |

After the final navigation-prefix correction, typecheck, lint and both builds passed again; the three relevant role/edition/repair-contract files passed all 18 tests (`dispatch-final-navigation.log`). The rebuilt PostgreSQL preview confirms Dispatch's Work navigation state, search → exact source-record agreement, and a phone pool claim appearing under My jobs with the store filter retained. Source record CPS-2026-3202 retains Devon, Chris, the original deadline and each actor's assignment history.

Earlier failures led to fixes for SQL projection ordering, SQLite/PostgreSQL constraint parity and null-target enforcement, held-work wording, current grant assertions, and fixture cursor parity. Three existing heavy tests timed out during an earlier full run overlapping a build; they passed focused reruns and the final serialized full suite. The 65-store test exposed ID-based fixture cursors; dispatch fixtures now use the SQL timestamp/ID keyset and pass when the page-boundary job is claimed. Schema generators report no additional SQLite/PostgreSQL migrations. Logs and screenshots are local review artifacts; hosted data was not touched.

Browser compatibility spot checks on the rebuilt PostgreSQL preview: the five-vendor directory opens source evidence; the existing no-WO exception opens its review record and QR-arrival/store-device-departure visit with separate timestamps; SUM-104-2607 preserves invoice flags, linked/unmatched amounts and the presence-versus-labor distinction; PM shows 92/99 ended-window completions and source occurrences; Repair or replace retains explicit human decisions; the unsaved store-creation form fits at 390 px. A locally regenerated link for CPS-2026-0216 opens the account-free BrightLine authorization and visit selection. That purpose-bound visit lists only CPS-2026-0216, excluding the internal CPS-2026-3202 at the same store. No vendor response or visit was submitted in this spot check.

Static checks pass: `git diff --check`, new-file whitespace, all 88 scenario definitions unique/contiguous, and local packet/handoff links resolving. Screenshot captures are review artifacts in the ignored local `outputs/internal-dispatch` directory.

Review limitations: actual dropped-network retry simulation and a fresh manual replay of every legacy vendor/invoice/PM journey were not performed. Existing workflow regressions and the named browser compatibility spot checks supplement the new dispatch journeys. P2/P3 and production identity/delivery remain separate work.

### P1 audit correction checkpoint — October 3, 2026

[Astra's audit](P1_AUDIT.md) reproduced three integration defects after the preceding implementation checkpoint. [P1_CORRECTIONS.md](P1_CORRECTIONS.md) records the corrected source, exact regression contracts, final logs and affected browser journeys. F1 adds actual hold/dispatch endpoint rejection with unchanged inspection task/deadline/history across all three adapters; F2 adds division-only claim/return/reassignment and current writable notification delivery; F3 adds creation notices, no pool broadcast, approval-pending suppression, rollback and retry coverage.

The corrected application passed seed, typecheck, lint, all 1,268 tests in 203 files, all 66 workflow tests, Sites build and Render build. The final five-file focused run passed 33 tests after strengthening the audit assertions, followed by passing typecheck/lint. Rebuilt-browser inspection, phone create/assign/reload, technician My work and isolated PostgreSQL outbox checks passed; screenshots are linked in the correction record. No timeouts were widened, hosted data reset or real delivery invoked. At this checkpoint P1 awaited reassessment. The later independent reassessment closes F1–F3 and clears P1 for P2.

## P2 implementation checkpoint — October 3, 2026

Branch `codex/internal-dispatch-p1`, HEAD/base `861630053e7fdff3686926047399f55a9be10495`; tracked and new implementation files remain uncommitted in the managed planning worktree. P2 is implemented locally; **independent Astra review is pending**. [P2_HANDOFF.md](P2_HANDOFF.md) contains commands/logs, migration/recovery detail, screenshots, limitations and a copyable audit prompt. P3–P7 remain unimplemented.

The table records the implementation's evidence. A “passed” automated case does not imply every browser variant was manually performed. Remaining variants are explicit.

| Scenario | Local status and evidence |
|---|---|
| AT19 | Passed A/B/U: measured 1440 × 900 and 390 × 844 focused jobs, My jobs/Available groups, concise assignee/manager, urgent-first ready queue and secondary held group; problem/result/evidence actions accessible without the broad service tabs. |
| AT20 | Passed D/R/A/B: all three adapters and actual API store visitless result/actor/source; ordinary fixture cycle and built PostgreSQL restart preserve saved result with zero visits. |
| AT21 | Passed D/A/B: versioned required policy blocks technician result; authorized explained manager phone exception records Maria/Jordan/source without observed presence. Policy restored to optional after local QA. |
| AT22 | Passed D/G/A; partial B: command tests begin internal_web and end store_device on the same visit with retry receipts. Browser refreshed actual signed-in visits and completed the older public vendor service-link visit. A fresh trusted-device cross-channel browser transition and deliberately lost response were not run manually. |
| AT23 | Passed D/G/B/U: built PostgreSQL visit opens held details before accepting; select/deselect/reselect, save and refresh retain two added jobs. Real PostgreSQL overlap checks extras against checkout without stranded claims. |
| AT24 | Passed D/R/G/B: actual PostgreSQL browser stop saves Fixed/Needs parts/Needs outside vendor separately on three WOs; all-adapter command assertions retain blockers, tasks/follow-ups, exact sources and actual visit identity. |
| AT25 | Passed D/R; partial B: parts and vendor blockers, accountable manager/next action and phone input retention manually exercised. Help/cannot-get-to-it transitions are covered by common command logic/queue tests; every wording/selection variant was not submitted manually. |
| AT26 | Passed D/R/A/B: version-checked manager vendor choice preserves same number/history, cancels obsolete hold atomically, denies technician/stale/changed intent/revoked access and retries once. Cross-adapter mixed-stop projection opens authorization, then vendor response. Final built PostgreSQL handoff generates manual version 1, reloads as Waiting on vendor and retains Maria's prior finding/visit. Earlier fixture issuance opens its public authorization, records acceptance and finishes an actual vendor visit. No live email/text. |
| AT27 | Passed D/A/B: required-policy phone report displays reported Maria, actual Jordan, source and reason; API denies forged technician identity and unauthorized exceptions. Reported time is unverified. |
| AT28 | Passed D/A/B: private result PNG opens after reload; actual API checks exact bytes, scope, failed-upload no mutation and retry with no second upload. Phone oversized file error preserves notes/outcome, replacement file saves successfully. Synthetic QA image is not repair evidence. |
| AT29 | Passed D/R; partial B: confirmed fixture cycle → explicit manager closeout and built PostgreSQL exact confirmation. Confirmation-disabled closure passes on all adapters; that policy variant was not changed/submitted in the browser. |
| AT30 | Passed D/G; partial B: append correction retains old result/decision, new exact-source confirmation required, equal-clock return attempt suppresses old decision. Same-WO parts/readiness/return completed in browser; result correction and every stale-verification form variant were not repeated manually. |
| AT31 | Passed D/G: injected transaction failures preserve original work/assignment/hold, no successful receipt, no partial result/follow-up/audit; safe retry completes once. No manual database fault injection. |
| AT32 | Passed D/A/B: phone Store 104 unmatched signed-in visit saves recorder/notes, finishes and remains reviewable; no fabricated WO or Create/finance/setup capability added. |

Affected P1 regression coverage remains in the full suite. Existing verification, public boundary, invoice allocation, warranty, compliance and PM tests exercise downstream compatibility. The focused final handoff run passes four files / 62 tests / eight intentional skips with actual D1 and PostgreSQL; the skips are non-PostgreSQL copies of four actual PostgreSQL-only races. All required final checks pass on the last correction: seed, typecheck, lint, 205 files / 1,290 tests / eight intentional skips, four files / 66 workflow tests, Sites build and Render build. Exact logs are recorded in the handoff.

Browser compatibility spotchecks pass on the built PostgreSQL preview: manager search → matching work with query/All-work scope retained; SUM-104-2607 invoice amounts, review flag, source WO and approximate presence/labor distinction; PM 92/99 ended-window numerator/denominator and its missed source occurrence; lifecycle source costs/issues and human decision controls; measured 390px store list and unsaved creation form without overflow. A sixteenth presentation store was not created. Final rebuilt manager handoff evidence is recorded in the handoff. Desktop/phone screenshots are ignored local review artifacts. No original-checkout/port-3000 changes, commit, push, deployment, hosted reset, live delivery or paid provider setup occurred.

IDP-02 remains open for independent acceptance. Scheduling and the technician dated agenda remain P3 work. Production-authentication/hosted storage/deployed migration and the full 1/65-store release rehearsal remain separate acceptance gates.

## Additional P1 review correction checkpoint — October 3, 2026

The subsequent R1–R3 review reopened IDP-01. The correction pass protects required follow-ups, resumes the current internal action after approval with applicable atomic notification, and removes hidden manager submission while explaining coordination fallback. [P1_CORRECTIONS.md](P1_CORRECTIONS.md) is the current evidence and independent reassessment handoff. Existing local P2 work is preserved; this pass adds no P2 features and makes no new P2 acceptance claim.

| P1 scenario | Additional correction evidence |
|---|---|
| AT06–AT08 | Fixture/native D1/real PostgreSQL approval regressions resume person, pool and manager tasks with the original deadline. Current writable scope determines responsibility and recipients. Pool approval produces no technician broadcast. Browser approvals CPS-2026-3208–3210 persist the correct actions; targeted outbox evidence is retained. |
| AT09–AT10 | Existing separate-connection PostgreSQL assignment races remain green in the final full suite. New commit-time access-loss assertions roll back approval and dispatch rather than partially recording success. No new browser concurrency simulation is claimed. |
| AT11–AT14 | Return, claim and reassignment cannot complete an open required follow-up or replace its task/deadline. Actual API rejection and unchanged records are asserted on all adapters. Three rendered-queue regressions prevent misleading ready/assignment controls. Browser manager/technician detail and both queues retain CPS-2026-3207's required next action; previous active-visit/inspection protections remain green. |
| AT15 | New approval retry/conflict and fake transport retry tests preserve one targeted notice and stable delivery keys; existing dispatch same-key receipts remain green. Reapproval replaces only recognized assignment tasks and preserves a separate required follow-up. Deliberate dropped-network browser replay remains unperformed. |
| AT16–AT17 | Actual rendered person/pool forms invoke the API without hidden manager IDs. Current eligibility retains the owner or falls back to coordination; an explicit stale manager handoff is denied. All-adapter suspended/read-only scope cases pass. Browser CPS-2026-3211–3212 submit with fictional Chris temporarily read-only, reload with the correct person/pool and coordination owner, and preserve deadlines. Original grants are restored. |
| AT18 | Injected transactional failure and concurrent access-loss regressions leave approval, assignment, task, follow-up, audit and outbox unchanged. The full suite retains existing dispatch rollback coverage. No browser database fault was injected. |

Reproduction preceded fixes: 21 main new cases failed across all three adapters, followed by retained escalation/reapproval failures and three rendered-queue failures. The final audit file has 54 tests, including 45 new cases; the focused audit/approval run passes 70 tests in 62.64 seconds. Final source validation passes seed, typecheck, lint, 205 files / 1,335 tests / eight intentional skips, four files / 66 workflow tests, Sites build and Render build. The skips are fixture/D1 copies of four PostgreSQL-only races; actual PostgreSQL cases ran. Exact logs are under `.codex-runtime/p1-review-release-*` and linked by name in the correction record.

All three correction browser journeys pass on the final built localhost PostgreSQL preview, with independent sessions at 1440 × 900 and 390 × 844. Persisted evidence records six new fictional QA WOs, unchanged required follow-up/deadlines, correct notification targets and exactly 15 stores. Compatibility spotchecks inspect exact search drill-through, phone stores/unsaved creation, invoice safeguards, PM 92/99 and source occurrence, lifecycle sources/human decisions, the existing cross-channel vendor visit, no-WO entry and immutable BrightLine authorization. Fresh public vendor/device transitions, every legacy variant and live delivery were not replayed manually. No original-checkout changes, additional P2 features, hosted reset, live messages, deployment, commit or push. IDP-01 remains open for independent reassessment.

## Additional P2 review correction checkpoint — October 3, 2026

Latest independent evidence: the user supplied Astra's reassessment clearing all five reported fixes. Five files passed 116 tests with 21 skips; PostgreSQL was not configured, and PostgreSQL/browser/full-release checks were not independently repeated. The implementing-agent evidence below remains applicable. Together these support P3 development without claiming complete P2 release certification. C1–C5 are closed as defects; IDP-02 and P1's separate later correction gate remain open for broader acceptance. P3 has not started.

The five independently reproduced P2 findings are corrected locally. [P2_CORRECTIONS.md](P2_CORRECTIONS.md) is the current evidence and reassessment handoff, including the related table/state mismatches discovered through the interface. Existing P1/P2 work is preserved. This is implementation verification; IDP-02 remains open for independent reassessment.

| P2 scenario | Additional correction evidence |
|---|---|
| AT19, AT25 | The focused job preserves the independent safe-access action and deadline through Need parts and parts readiness. Completion/check-in stay unavailable while required actions remain; Flag a problem stays available. Actual server-page regressions and desktop/phone CPS-2026-3213 verify this. The targeted readiness notice explicitly says required actions remain. |
| AT20–AT21, AT23–AT24 | Checkout and visitless reports share the look-and-report outcome restriction. Fixture/native D1/real PostgreSQL commands and the actual API reject forged completion without mutation; permitted unresolved findings still save. Browser CPS-2026-3216–3217 show clear instructions, omit Fixed and retain review-required holds/follow-ups after reload, with zero fabricated visits for the visitless report. |
| AT25, AT31 | Overdue parts readiness preserves the elapsed action deadline and creates the next task once on replay. The independent safety follow-up/task remain unchanged, including their deadline and accountable action. New all-adapter regressions plus the retained rollback/retry suite pass. Browser CPS-2026-3214 resumes with the original Oct 1 deadline; persisted evidence confirms one open ready task. |
| AT29–AT30 | Successive checkout amendments preserve parent visit, performer membership, assignment and immutable original evidence. Technician finished visit, manager visit table and work-order visit history agree on the current amendment. A corrected result submitted through its accepted legacy parent binds confirmation to the canonical result on all three adapters; ordinary legacy compatibility stays green. Browser CPS-2026-3215 retains the old confirmation, requires fresh review for a newer amendment and stores a second exact confirmation. The final No issue found state says result verified and offers Close verified work. Verified/rejected/inconclusive and stale-source projection regressions pass. |

All five domain cases fail before fixes on all three adapters (15 failures). Separate form/safety-screen, two manager-table and three confirmation-state failures also precede their corrections. The pass adds 23 regressions; the focused execution/API/verification/P1-audit run passes 119 tests with eight intentional skips, the last readiness-notice check passes three adapter cases, and the final case/presenter run passes 64 tests. The final required source run passes seed, typecheck, lint, 205 files / 1,358 unit tests / eight intentional skips, four files / 68 workflow tests, Sites build and Render build. The skips are non-PostgreSQL copies of PostgreSQL-only races; actual PostgreSQL cases ran. Exact final logs use `.codex-runtime/p2-review-verified-*`.

Browser correction workflows and saved-state reloads pass on the rebuilt localhost PostgreSQL preview at measured 1440 × 900 / 390 × 844. Guarded read-only assertions confirm unchanged independent obligation/deadlines, truthful targeted pending notice, overdue readiness, five immutable visit results with preserved performer/source, two separate confirmations, accountable look-only findings and exactly 15 stores. Final compatibility spotchecks cover exact manager search/scope, phone stores/unsaved creation, invoice safeguards, PM 92/99/source occurrence and lifecycle source costs/human decisions. Earlier routing/public-link/cross-channel/unmatched browser evidence is retained in the handoff; those mutations, every legacy variant, lost-network replay, fault injection and live delivery were not repeated manually. No original-checkout change, P3–P7 feature, hosted reset, live message, deployment, commit or push. Production authentication/hosted release rehearsal and independent phase acceptance remain separate gates.


## P3 implementation evidence — October 3–4, 2026

P3 is implemented and locally verified in the managed worktree recorded in [P3_HANDOFF.md](P3_HANDOFF.md), base `861630053e7fdff3686926047399f55a9be10495`. The final corrected source passes seed/typecheck/lint, all 207 files / 1,435 unit tests / 15 intentional skips, all four files / 68 workflow tests, and both Sites/Render production builds. Actual fixture, Miniflare D1 and PostgreSQL scheduling cases, populated pre-P3 upgrades, rollback/access revocation, three PostgreSQL races and native 1/65-store query parity ran. Browser journeys pass on the final-source local PostgreSQL development preview. A production-mode fictional-preview launch was automatically rejected as “blocked by policy” without further explanation; it did not run, so production-mode browser rehearsal remains an evidence limit. Final logs use `.codex-runtime/p3-verified-*`; the earlier `p3-final-unit.log` records three failures before correction and is not passing evidence.

| Scenarios | Implementing evidence / remaining checkpoint |
|---|---|
| `AT33` | Independent assignment/calendar fields; fixture/D1/PostgreSQL pool/manager-group tests; browser saved a team week without allocating it, then pickup retained it. |
| `AT34` | All precision modes/native query projections; browser This week, day Anytime and exact appointment save/reopen, including persisted reload after restarting the final-source local development preview. |
| `AT35` | Own flexible authority, fixed/target/other-person denial, deadline preservation; browser technician date move and manager phone save; targeted manager update in persisted evidence. |
| `AT36` | Populated migration preserves unset targets; all screens label Planned, Target completion and Next action due separately; legacy due never backfilled. |
| `AT37` | Explicit target amendments/retry and late/midweek/same-day uncertainty tests; browser warning preserves input and requires explicit acknowledgement. |
| `AT38` | Waiting/Next visit/ready native filters and separate backlog; moving a calendar date does not create a visit hold or edit report/target/task facts. |
| `AT39` | Civil calendar helper and all adapters exercise Monday, weekend, month/year boundaries; browser selects Sunday without a fake exact time. |
| `AT40` | Native cross-zone exact-save test preserves Central board day and Eastern store instant; browser exact label/reopen agrees; no browser timezone-emulation claim. |
| `AT41` | Date/DST helper and real route gap/fold denial; browser rejects both and saves explicit Earlier occurrence. |
| `AT42` | Fixture/D1/PostgreSQL zone-change test preserves existing planning snapshot, day and instant. Actual customer preference controls were not changed. |
| `AT43` | Actual PostgreSQL schedule/move/result/return races; stale API response includes the current plan/action; two browser manager forms preserve the stale entered date and show current state. |
| `AT44` | All three adapters preserve assignment/tasks/history after removal; return/reassign retires old performer's plan with explicit audited consequence. |
| `AT45` | Parts result/readiness/new-attempt regression on all adapters; browser blocker → tentative attempt 2 → readiness → ready return → completion → exact store confirmation → manager closure preserves the same WO and both results. Nine revisions/two attempts and completed follow-ups are asserted in retained PostgreSQL. |
| `AT46` | Atomic combined assignment/schedule/real-task transition, explicit 24/72-hour policy, unrelated-follow-up preservation, fake provider and obsolete suppression; browser live wording and waiting/tentative review. No live delivery. |
| `AT47` | Tenant/scope/empty choices and native 1/65-store cursor/count parity; browser search/selected-week retained through drill-down. Final exact manager search finds all five QA records, including the closed result; actionable native queries exclude it. |
| `AT48` | Measured 1440 × 900 / 390 × 844 manager planning, technician pickup/date/blocker/return-result and store confirmation journeys pass on the final-source local PostgreSQL development preview. Manager dedicated closeout completes; no fake visit exists. |

Two UI failures were reproduced before correction: an unclaimed pool job incorrectly exposed technician Schedule controls, and stale conflict messages did not show the saved plan. The route suite now passes all 11 tests. The full suite also caught an outdated capability expectation and direct formatter construction; the narrow technician expectation and cached formatter use are corrected. The final full run passes.

## P3 review correction checkpoint — October 4, 2026

Both independent P3 findings were reproduced before fixes: the combined tentative assignment replaced a required scheduling task, and relative agenda queries compared old-zone commitments against the new organization date. The new regression run has 16 failures before application changes across fixture, native D1 and actual PostgreSQL plus the rendered page. After correction, the complete scheduling/route suites pass 96 tests with seven intentional adapter-inapplicable skips, including retry, targeted notification, ready-transition and both composition rollback paths. Current final-source seed/typecheck/lint, 207 files / 1,454 tests / 15 intentional skips, four files / 68 workflow tests and Sites/Render builds all pass.

| Scenario | Additional correction evidence |
|---|---|
| `AT46` | Both Schedule service/return tasks retain their entire saved state and deadline across tentative reassignment and replay on all three adapters. Only a ready plan completes them and creates the execution action/policy deadline. Fake-provider/obsolete-notice coverage remains; fault-injected rollback includes both tentative and ready compositions. Desktop/phone browser reassignment preserves the required return task; a later ready save advances it. |
| `AT39`–`AT42`, `AT47` | A single reference instant determines relative membership separately in every saved planning zone before native filtering/counts/pagination. Tests cover exact/day midnight, mixed-zone keyset pages, empty/other-tenant scope, year/week rollover and absolute selected Week. The real rendered page agrees across Today, Upcoming and Needs replanning. At the actual browser clock, a temporary fictional localhost Honolulu preference retains Eastern commitments and correctly marks the older Eastern day unfinished; the original preference is restored. |
| `AT48` | Final-source local PostgreSQL development browser sessions at 1440 × 900 / 390 × 844 complete manager tentative → ready plan, technician visitless result, Robin's exact-result confirmation and explicit manager closeout. Refresh after restart preserves closed work. Guarded assertions retain three immutable revisions/one attempt, the scheduling deadline, one attributed result/verification, completed tasks/assignment, pending targeted notices and exactly 15 stores/five vendors. |

[P3_CORRECTIONS.md](P3_CORRECTIONS.md) records reproduction steps, logs, screenshots and limits. This is local implementing-agent evidence; independent reassessment remains open and IDP-03 stays unchecked. Production-mode browser/identity and hosted release gates remain separate. No P4–P7 implementation, live delivery, hosted reset, original-checkout change, commit, push or deployment.

Read-only `p3-browser-final.json` / `p3-browser-assertions.json` confirm completed assignment, retired current plan, nine immutable revisions/two attempts, two attributed results, exact current confirmation, completed tasks/follow-ups, unchanged independent target, no visit links, 13 targeted pending notices, and exactly 15 stores/five vendors/two technicians. [P3_HANDOFF.md](P3_HANDOFF.md) links screenshots and records compatibility checks and manual limits. Independent P3 reassessment and a limited-pilot decision remain open. Later P1 R1–R3 independent reassessment and broader P2/production-readiness evidence limits are preserved. P4–P7 are not implemented. No original-checkout changes, live messaging, hosted reset, commit, push or deployment.
