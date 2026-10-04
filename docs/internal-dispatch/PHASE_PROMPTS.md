# Internal dispatch: implementation and review prompts

Use the common contract with exactly one phase prompt. These prompts are prepared for a new implementation chat; saving them is not authorization to run all phases. Read [README.md](README.md), [UX_SPEC.md](UX_SPEC.md), [ENGINEERING.md](ENGINEERING.md), and [ACCEPTANCE.md](ACCEPTANCE.md) first.

## Common execution contract — include with every phase

```text
Implement the requested phase of the saved internal dispatch plan in this repository.

Read AGENTS.md, docs/PLATFORM_IMPROVEMENT_PASSES.md and docs/internal-dispatch/{README,UX_SPEC,ENGINEERING,ACCEPTANCE,PHASE_PROMPTS}.md. Use the current source, not a remembered older commit. The documented audit baseline is 8616300. Check HEAD, branch, git status and newer remote changes; preserve all existing local work. If this is the managed planning worktree, the plan files may still be uncommitted and HEAD may be detached. Create/reuse a suitable codex/ implementation branch without losing them. Never reset the user's original checkout or dev4.log.

Implement only this phase and prerequisite defects that demonstrably prevent its acceptance. If newer code already satisfies a requirement, verify it instead of rebuilding it. Record necessary plan adjustments with evidence; do not silently change product behavior. Reconcile contract conflicts before choosing table names or coding. Preserve the existing IM IDs and history.

UX is a deliverable: plain labels, real work visible immediately, one primary action, exact action destinations, keyboard access, and complete 390px phone paths without drag-and-drop. Manager and technician use the same canonical work orders through different focused views. Do not expose implementation terms, long help essays or financial controls in the technician's primary flow. Reuse existing design tokens and brand configuration.

All reads, mutations, counts, search, file access and notifications are organization-scoped first, then actor/store scope. Enforce actual active membership and grants server-side, including field_manager companywide and empty-scope rules. UI hiding is not authorization. Add narrow internal-action permissions; do not give technicians general management or finance capabilities.

Use existing domain commands and persistence adapters where they fit. Add explicit shared behavior where they do not; never use a fixture-only or browser-local implementation. Mutation, audit, concurrency guards and notification outbox commit together. Use idempotency and version checks for retries and competing edits. New dispatch lists use bounded native repository queries with stable pagination; do not load the whole tenant or add N+1 reads. Preserve fixture, SQLite/D1 and PostgreSQL behavior.

Never confuse assignment, planned work, observed visits, reported results or repair confirmation. Existing WorkOrder.dueAt is the current next-action deadline. An optional repair completion target is separate and must not be invented for historical records. No fake visits, midnight week/day appointments, assumed location, made-up duration, automatic payment approval or silent deadline changes.

No continuous tracking, payroll, employee shift rosters, outside-vendor workforce dispatch, autonomous reassignment, runtime LLM dependency or native app work. Normal calls/texts remain valid and manager-entered reports show the actual actor and source.

Do not provision a paid service, transmit real addresses/files to a new provider, deploy, reset hosted data, commit or push unless the user explicitly authorizes that action. Already-given authorization need not be requested again. Fictional sample estimates must be labeled; do not claim real integrations from test fixtures.

Run focused tests while building, then the required final checks for a completed implementation phase: npm run db:seed; npm run typecheck; npm run lint; npm test; npm run test:e2e; npm run build; npm run build:render. Run resource-heavy suites/builds sequentially if needed. Use a safe isolated database for seeding/tests. npm run test:e2e here is a Vitest workflow/database suite, not a substitute for browser checks. Do not relax failing tests, widen timeouts or weaken permissions to obtain a pass. Investigate failures and report actual limitations.

Exercise the affected real browser journey on desktop 1440px and phone 390px with the appropriate manager/technician roles, persistence reloads, and error/conflict recovery. A link crawl or screenshot of an empty page is insufficient. Record engine used (actual PostgreSQL vs PGlite/SQLite), exact revision or dirty tree, role/scope, test results and screenshots. If a required engine/provider/browser is unavailable, complete independent work, preserve the acceptance item as open, and say precisely what remains unverified.

Update docs/PLATFORM_IMPROVEMENT_PASSES.md, the phase status in docs/internal-dispatch/README.md, and the phase evidence section in ACCEPTANCE.md. Mark complete only what was implemented and verified. Finish with a concise result, validation, remaining limitations and next-phase handoff. Stop at this phase checkpoint; do not start the next phase automatically.
```

## P0 — planning baseline refresh (only if the source has changed)

The October 3 planning pass supplies P0. Do not repeat it as an implementation delay when the source and decisions still match.

```text
Refresh the saved internal-dispatch plan against the current branch. Documentation only.

Verify the current assignment, role/scope, held-work, result/verification, scheduling, repository and outbox contracts. Compare them with the 8616300 evidence in ENGINEERING.md. Correct only demonstrated drift; retain settled product decisions and all original IM item IDs. Update the concrete file/function map, migration baseline, screen paths and acceptance dependencies. Distinguish implemented behavior from intended behavior.

Preserve these decisions: Dispatch under Work; simple My work for technicians; optional direct/person/pool/manager assignment; week/day/exact scheduling; honest visitless results; shared state with explicit drafts; planned-store exclusion from route suggestions; no guessed availability or employee monitoring.

Produce a short change summary and verify Markdown links/phase references. No application edits, schema changes, hosted mutations, automatic commits or full application test claims. The deliverable is an accurate packet ready for P1.
```

## P1 — internal assignment and team pickup

**Useful result:** a manager can give work to a technician, a field manager, or an eligible team pool. A technician can take/return a job, and everyone sees the same owner. Scheduling and results are the next phases.

```text
Implement P1 using the common execution contract.

Read the verified assignment and accountability gaps in ENGINEERING.md first. Internal routing currently requires a named internal_technician. Do not implement manager handoff by pretending a field manager is a technician, or implement team work as Choose later.

Build:
1. Internal routing choices for named technician, Available to the team, or a scoped field/facilities manager to arrange it. Keep Outside vendor and Choose later behavior intact. Distinguish responsible manager from current performer. Preserve existing internalAccountableType/Id when appropriate; require or default a valid existing manager/team, next action, action deadline and escalation.
2. Explicit internal allocation state for manager-pending versus claimable pool work. A null technician alone is not enough to distinguish them. Pool eligibility is active internal_technician membership whose current grants cover this store. Do not build a crew administration system or infer team membership from role labels.
3. Narrow shared commands for assign, take, return and reassign. Direct assignments are effective without an acceptance step. Take job is one atomic claim. Return preserves due/target fields and records actor/reason when supplied; alert the responsible manager for urgent/overdue returns. Do not force long notes for ordinary assignment.
4. For an active visit, reject direct reassignment/return with a useful message and route to the current visit/help workflow. Preserve the recorded performer. Do not invent a complicated future-handoff engine in this phase.
5. Bounded manager Dispatch assignment queues and technician My jobs/Available work views, using the existing work-order details. Current assignee, responsible manager, next action and exact action link must agree in work lists, relevant queues and store views. Empty assigned lists must not hide available team work.
6. Extend existing held-work eligibility to internal work explicitly, preserving vendor rules. Normal internal backlog is not automatically a hold. Next visit work has its existing review obligation, is included in All open work, and requires no cost/invoice to cancel as Not needed with a short recorded reason. Store managers continue request intake; a Next visit is fine preference does not grant work-order creation or override urgent review.
7. Make newly seeded fictional examples useful for both existing demo technicians without changing 15 stores / 5 approved vendors / 2 technicians or resetting hosted edits. Use existing safe seed conventions; do not treat the demonstration team size as a customer fact.

Inspect/update the actual touchpoints: work-routing-fields.tsx; commands.ts assignWorkOrder and reassignWorkOrderInternalAccountability; internal-accountability.ts; held/approved work eligibility; types/schema/repositories; role-policy.ts and server access; operator list projections; primary workflow-task projection. Search for all assumptions that internal assignment always names one technician before changing nullability.

Acceptance emphasis: internal vs Choose later isolation; named/pool/manager transitions; stale assignment and stale grants; two simultaneous claims; claim racing reassignment; retry with same key and changed payload; old assignee loses current work; terminal work cannot be claimed; active visit protected; primary owner/task alignment; fixture/SQL parity; real PostgreSQL transaction test; browser facilities -> field manager -> technician claim/return at 1440/390px.

Complete P1 evidence only. If results/scheduling remain unavailable, label that phase boundary honestly; do not claim the complete dispatch release works yet.
```

## P2 — technician execution, results, and blockers

**Useful result:** technicians can do assigned work and report what happened with or without a required visit; unresolved work reaches the manager. This is the most integration-sensitive phase.

```text
Implement P2 using the common execution contract. P1 must be verified first.

Make this phase complete the technician journey: My jobs / Available team work -> focused job screen -> result or problem -> accountable follow-up. Keep P1's three assignment choices. Opening a job must show store/equipment, problem/work requested, photos/instructions, and Record result / Flag a problem before the broader record sections. Keep Full work record secondary and permission-scoped. Reduce repeated ownership names with Assigned to Maria and secondary Manager: Chris (or the actual coordination team). Use Ready to work / Needs a technician only where the actual readiness allows them, preserving canonical tasks/deadlines. Show held work separately under For a suitable visit after immediate work, with its reason and applicable deadline; urgent work stays prominent. Buttons state what clicking does. Follow UX_SPEC.md section 6.

Start by tracing result consumers and confirmation end to end. The baseline latestRecordedWorkOutcome and WorkOrderVerification assume SiteVisitWorkOrder. Technician capabilities are restricted. A new result button alone cannot satisfy optional check-in.

Build:
1. A durable, auditable result source for work performed without a recorded visit, linked to the canonical work order and real performer/recorder. Support corrections with preserved prior facts. Reuse existing visit outcomes when a visit exists. Implement one normalized applicable-result/confirmation contract across legacy and new records, as specified in ENGINEERING.md, without a mandatory destructive historical backfill.
2. Optional internal check-in default, configurable required policy, and an explicitly attributed authorized manager exception. A no-visit result never fabricates arrival, departure, GPS, a visit count or onsite time. Required policy cannot be bypassed through a different endpoint. Managers reporting by phone retain source, reported performer and actual actor.
3. A dedicated technician job screen and actions: Record result and Flag a problem. Instructions and saved photos open directly; full-record navigation is secondary. Plain outcomes map to existing domain meanings. Support Fixed, Needs more work, Needs outside vendor, with one notes/files action. Blockers: Need parts, Need help, Need a vendor, Cannot get to it today. The last choice leaves assignment intact unless Return to team is explicitly chosen. Preserve required check-in and specialized inspection paths in this focused screen.
4. Signed-in internal check-in/out and no-WO exception through shared visit commands, not new parallel state. Identity comes from membership. Handle team claims/additional internal held jobs atomically before linking them. One store visit can hold multiple WOs with different outcomes. Retry after attaching extra work cannot create another visit or lose the original receipt.
5. Create/update the required operational follow-up with owner, next action, due and escalation in the result transaction. Avoid duplicate tasks when the technician retries or reports the same blocker. A manager can record parts arrived/ready for return through the same lifecycle. Do not infer parts arrival from time passing.
6. Needs vendor returns the same WO to the accountable manager. It does not issue to a vendor automatically or grant technicians issuance/approval powers. Preserve earlier internal assignment, visits, costs and files. New vendor work obeys existing approval/warranty/issuance rules.
7. Respect existing confirmation policy: technician result is not technician verification. Required confirmations appear in the existing Needs confirmation flow and remain reviewable without SiteVisitWorkOrder. Optional completion closes only when existing operational blockers permit. Corrected results invalidate or supersede the applicable confirmation correctly.
8. Update the needed result consumers (history/header, work and attention queues, verification, warranty work matching, compliance/PM linkage, invoice visit evidence, reports). Every consumer uses the same outcome identity/cycle. Specialized inspections still require their existing checklist/evidence/result process; a generic Fixed button cannot bypass it. Do not count visitless results as visits or automatically start warranties based on insufficient component/work facts.
9. Files/photos are uploaded once per action and remain openable from the saved record with proper scope. Failed upload/save preserves input and safe retry. Keep actual file-storage configuration errors distinct from no-file operations.

Inspect commands.ts visit preparations/checkouts and manualCompletion, work-order-outcome.ts, work-order-verification-commands.ts, confirmation-policy.ts, warranty work hooks, workflow follow-ups, public server-gateway, recording/verification routes and consumers. Preserve public vendor behavior and separate manager manual confirmation semantics; don't reuse a close-now shortcut as an ordinary tech result.

Acceptance emphasis: optional no-visit completion and unresolved result; required-policy rejection and manager override; multi-job visit mixed outcomes; late corrections; return visit on same WO; exact confirmation source/cycle; no false visit/warranty/PM facts; transactional audit/outbox/follow-up; cross-role/store rejection; real reload; files open; field-manager -> technician -> store-confirmation -> manager loop on desktop and phone. On 1440px and 390px, find a job in a mixed ready/held/blocked list, open the focused screen, read instructions/photos, record a result and flag a problem without navigating the broad record sections. Confirm concise ownership text, held work clearly secondary, and meaningful empty/loading/error states. Include regression checks for vendor checkout, warranties and inspections.

Stop at P2 and document the new outcome API/normalization contract for P3. Do not add maps, schedule optimization or a separate messaging system.
```

## P3 — flexible scheduling and basic weekly visibility

**Useful result:** the first complete dispatch release: assign/schedule -> technician agenda -> result or blocker -> manager. A week view is required; sophisticated drag-and-drop is not.

```text
Implement P3 using the common execution contract. P1-P2 are dependencies.

Build:
1. Persist internal execution planning separately from assignment, observed visits and vendor ServiceAppointment commitments. Support unscheduled, week-only, day-anytime and exact appointment. Use explicit calendar/zone fields; do not create midnight appointments for weeks or days. One WO can have successive execution attempts without cloning its number.
2. Add an optional explicit Target completion, separate from WorkOrder.dueAt (current next-action deadline) and Planned. Record target source and authorized amendments. Existing rows with no reliable completion target stay unset. Do not label the current task deadline as the original repair deadline. Moving work does not silently edit either deadline.
3. A shared Schedule action from WO, Dispatch and technician/day context. Primary flow is Who -> When (week/day/appointment) -> Save schedule. Existing assignee prefilled; choosing another person is an explicit assignment change committed with the plan. Scheduling the pool keeps a To allocate group; scheduling manager-owned work keeps it out of the claimable pool until authorized release. Do not create duplicate available and assigned entries for one current attempt.
4. Week/day values use the stored dispatch planning zone, with a Monday week start and weekends reachable. Exact input uses the store IANA zone; display board/store equivalents where needed. Validate DST gaps/ambiguous times, cross-year weeks, and Central/Eastern journeys without browser-zone shifts.
5. Simple manager Dispatch workspace: Needs planning and This week grouped by technician/day plus week-only/to-allocate. Search stores by number/name/address and problems/WO. Readiness filters keep normal unscheduled, Waiting, and Next visit distinct. Due/urgent unscheduled work stays accessible regardless of week. Counts match scoped/paged records.
6. Technician Today/Upcoming/All my jobs/Available views share the same sources. Only planned work appears as planned today. Older unfinished work remains visible as Needs replanning; it is not auto-moved at midnight. Record result opens P2 directly. Completion removes an execution item from actionable lists only under the correct outcome rules and leaves history.
7. Save/move/remove schedule, with version/idempotency checks, audit and one deduplicated material recipient update. P3 saves are LIVE. No draft/share UI until P4 implements draft isolation. Removing a schedule leaves the job assigned and unscheduled. If this action fulfills a real Schedule service task, complete it and atomically establish the next execution obligation with an explicit policy-derived action deadline. Otherwise a calendar edit must not complete unrelated tasks or copy Planned into dueAt. Preserve the independent Target completion.
8. Exact internal appointments and flexible internal plans remain visibly different from existing vendor-confirmed appointments. Preserve vendor Upcoming visits count/drill-through. Do not double-count an internal commitment through both legacy appointment and dispatch projections; record the chosen compatibility approach.
9. A schedule beyond a Target completion warns with an explicit keep/move choice, without changing the target. Exact overlaps warn from known intervals; unknown duration cannot yield a false no-conflict/availability claim. A block or Need vendor prevents ready-work scheduling unless the manager explicitly resolves/reviews that blocker. Planning while waiting is visibly tentative and excluded from Ready candidates.

New reads must be bounded by org/scope/period, with separate backlog queries and stable pagination. Do not send a whole tenant snapshot to a client calendar. Include small 1-store and 65-store synthetic parity/query coverage. No third-party calendar library is required unless justified; buttons and grouped lists can satisfy the first release.

Acceptance emphasis: same week/day/appointment on manager/tech/store/WO surfaces; no date shift; named/team/manager groups; schedule+reassign rollback; no missing backlog; past target warnings; fixed commitments retained; dueAt not repurposed; unfinished work and return attempt; no false upcoming vendor counts. Browser run the entire first-release story on 1440px and 390px including a manager phone update and store confirmation.

At this checkpoint report whether P1-P3 are ready for a limited internal-work pilot, with any remaining evidence limits. Stop before P4.
```

## P4 — shared plans, day order, and workload visibility

**Useful result:** a manager can prepare a week without disturbing current work, share coherent changes, and adjust together with the technician.

```text
Implement P4 using the common execution contract. Preserve P3 live scheduling as a distinct explicit action.

Build:
1. Persist versioned draft versus published planning. Prepare changes clones a relevant published version; editing a draft never changes live assignment, live status, current tech list, or sends field notifications. Draft reservations are advisory and cannot hide pool work from eligible technicians. Current accountable ownership remains intact.
2. Share plan validates all affected job/assignment/scope/policy/schedule versions, then commits assignment changes, planned attempts, affected plan revisions, audit and outbox together. Publish a bounded per-person/day or selected coherent group; any cross-tech move covers both sides in one transaction. Never silently publish a valid subset of a failed group. Keep the draft and show specific conflicts. Week-wide sharing can process explicit independent groups with per-group success/error; do not claim all shared if some fail.
3. Version conflicts between planners, technician reorder, claims, completion, vendor handoff or changed store access. Refresh/rebase requires an explicit reviewed diff; no last-write-wins. Repeating Share with the same request cannot create a second publication or alert.
4. Ordered day stops referencing existing planned jobs. Group jobs intended for the same visit into one stop, preserving per-WO outcomes. A deliberate second visit/appointment at the same store has a distinct stop occurrence; do not use a unique(store,day) rule. User-selectable saved start/end preferences; don't assume a current position or home. Phone has Move up/down/after controls, desktop may also drag. Technician can reorder their flexible stops and see manager changes. Fixed appointments remain explicit and cannot be moved silently by reorder.
5. Normal planning availability and Unavailable periods only, without reasons, shifts or payroll. Technicians can flag a planning conflict; managers maintain authoritative availability in this release. Adding unavailability marks existing conflicts without cancelling work. Changes are auditable but do not notify on every routine edit.
6. Optional estimate ranges/source per job attempt, including unknown. Simple presets map to documented editable assumptions. Show known repair estimates and count of unknown jobs. No default one-hour unknowns, no inferred per-job labor from visits, no employee speed score. Driving is unavailable until P5 supplies it. Do not call an empty calendar available if planning capacity is unset.
7. Overload/conflict warnings with Move work/Give to someone else/Keep plan actions. Keep explicit capacity inputs and slack visible; don't claim a perfect full day. At most publish one summary per affected recipient per share group. Material urgent destination/assignment changes get a clear update; routine draft edits and simple flexible reorders do not generate a ping each.
8. Today exceptions are concise: unfinished, needs parts/help/vendor, unavailable, target conflict. They lead to actual work/plan actions. A technician flag records the work issue rather than opening a second generic messenger. Manager can use calls/texts and record an attributed update.

Acceptance emphasis: draft isolation; two editors; a tech reordering against a manager draft; cross-tech move rollback; completing a draft job; Share retries and outbox dedup; unavailable-day conflicts; unknown load; day start/end persistence; fixed appointment vs flexible order; phone complete planner path. Confirm that suppressing notifications never suppresses operational records or mandatory exception escalation.

Stop at P4 and write a concrete P5 input handoff: current plan API/versioning, origin/end model, coordinate availability, estimates, and provider configuration still needed.
```

## P5 — complete-trip travel and additional-store work

**Useful result:** managers can see geography and driving impact across the footprint, and technicians can choose held jobs at other stores on the way. This phase has an explicit live-provider prerequisite.

```text
Implement P5 using the common execution contract. Start with P5A provider preparation, then P5B travel/suggestions. Do not silently choose a paid provider.

P5A: Inspect existing map/routing configuration. If a provider is already authorized, use it. Otherwise research current primary documentation for suitable services and produce a concise decision: directional matrix/routing support, map display if separate, geocoding, allowed caching/storage/refresh, usage pricing/caps, data sent and practical call volume for the actual footprint. Do not assume 63 stores means only 2,000 directional pairs; include shop/endpoints and direction. Do not save full addresses in URLs/logs unnecessarily. Prepare the adapter/configuration contract before asking for the missing provider/account/budget decision. No credential in chat/source. Defer only dependent live work, not the local deterministic algorithms and UI. Record live integration as blocked on configuration, not completed by a sample matrix.

P5B build:
1. Provider-neutral validated location and directional driving-leg records/cache. Include coordinate/version, source/profile, timestamp/freshness, typical-vs-traffic and sample markers. Storage and expiry must obey the chosen provider. No default permanent cache. No real-address transmission without authorized configuration. Use timeouts, bounded calls, rate/cost limits and explicit unavailable/partial behavior.
2. Complete-trip estimates from selected origin through the user's ordered stops to selected endpoint. No last-check-in origin inference. Preserve exact appointments and existing order. Show driving separate from repair ranges/unknowns. A day without an endpoint says one-way/return not included instead of showing a full-day total. If locations/legs are missing, keep planning usable and show unavailable estimates.
3. Optional store/route map beside the list, with exact list alternatives for every action. Missing/unverified coordinates remain visible in a Needs location list; no accidental pin at 0,0 or guessed real customer sites. Fictional demo drives show Sample driving estimates and use consistent fictional geography; they do not prove real directions.
4. Find work along my route: query org/store/pool-scoped ready open work at additional stores. Candidate classes are held internal pool work and the technician's own ready assigned jobs outside the plan. Own already scheduled jobs require an explicit move, not another live commitment. Exclude every storeId on the route regardless of its unaccepted held jobs; exclude vendor/Choose later/other-tech/blocked/terminal jobs. Emergency/urgent work needing direct action remains on the main board, not disguised as optional extras. Existing generated inspection WOs may qualify by the same rules; don't create inspections just to populate suggestions.
5. For each legal insertion between A and B, compute drive(A,C)+drive(C,B)-drive(A,B). Use directional values and complete return legs, compare feasible slots, preserve appointment constraints. Unknown duration prevents promising appointment feasibility. Missing/stale legs are unavailable; don't substitute aerial miles. Inconsistent negative detours are a data-quality case, not invented saved time. Show source/freshness and that repair time is extra. Do not automatically reorder the whole route.
6. Group suggestions by store with WO, original problem/description, equipment/location if known, priority/target and added driving. Select jobs independently from expanding details. Short confirmation states proposed position and selected job count. Refresh estimates after each confirmed addition.
7. Confirm on a live plan atomically claims eligible available jobs, releases their held execution state appropriately, adds references to the versioned plan and writes audit/outbox. In a draft, add proposed references only; revalidate/claim at Share. A stale taken job, changed plan, failure or retry cannot leave a partial claim or duplicate stop. A newly added store leaves all further along-route suggestions, even if other held work remains there. Same-store extras stay in the existing visit flow.

Acceptance emphasis: wide distances and nonuniform travel; asymmetric matrix; start/end legs; missing coordinate/leg/provider outage; partial matrix refresh; two added stops recomputed; job claim race; already planned store exclusion; team vs own-job candidate rules; draft vs live add; fixed appointment risk with unknown repairs; safe provider request limits. Use deterministic sample tests plus an explicitly authorized small real-location provider check for live readiness.

Stop at P5. State separately whether algorithms/UI, actual map, and actual live driving estimates were verified. Do not claim savings achieved from hypothetical drive reductions or show a technician-location map.
```

## P6 — explainable scheduling comparisons

**Useful result:** Find someone compares the consequences of giving a job to each eligible person/day, without claiming to know current location or unknown job lengths.

```text
Implement P6 using the common execution contract. P4-P5 must supply the inputs; do not invent estimates to complete this phase.

Build Find someone / Suggest a fit from a job and the dispatch queue. Generate a bounded set of eligible person/day insertion options over the selected planning horizon. Enforce org/store/current role/pool scope, explicit readiness, unavailable periods, fixed commitments and existing active visits. Current authorized managers retain the skill judgment unless a verified simple skill setting exists. Do not introduce a certification platform or rank technician performance.

For each option show: relevant existing trip, added total driving including return, known repair estimate range, unknown estimate count, planning availability, target/appointment conflicts, and jobs that would need to move. Label Could fit based on estimates / Would require moving work / Availability uncertain. Missing job lengths may still permit a travel comparison but never a confident fits/free-hours claim. Current location is planned or explicitly confirmed, not inferred from last check-in. Do not manufacture precise ETAs from incomplete information.

Prioritize meeting explicit commitments/targets and addressing urgent/aging work before reducing travel. Show why an option is offered; avoid an opaque best-person score. Offer internal separate trip, later planned trip, or existing manager vendor-routing action when applicable. A distant store must remain visible even if every convenient option fails. Do not auto-dispatch or auto-move lower-priority work.

Select option opens a concise before/after preview. Any displaced jobs stay visible and require an explicit new plan or remain marked Needs replanning with manager ownership. Never drop assignments or extend targets to make an option fit. Apply the chosen change through shared P3/P4 commands and version checks. On stale input, recompute and let the manager review; do not apply an old recommendation to a new schedule.

No runtime LLM is needed. Use deterministic eligibility/conflict/travel comparisons with testable reasons and bounded calculations. Persist the chosen decision and relevant inputs/version for audit; don't claim it was globally optimal.

Acceptance emphasis: one nearby all-day job vs two farther short jobs; unknown repair durations; unavailable day; urgent interruption; fixed appointment; parts blocker; full return drive; inactive/unauthorized tech; missing provider data; change during preview; conflicting move across two plans; remote overdue work retained; capacity totals with ranges and unknowns. Test explanations against actual sources and confirm desktop/phone action paths.

Stop at P6 with an evidence-based statement of which recommendations the data can support. Leave autonomous scheduling and route optimization deferred.
```

## P7 — release rehearsal and adoption handoff

**Useful result:** a verified scoped release, with deployment prerequisites and a short daily-use guide. This can target P1-P3 first, then run again for the advanced release.

```text
Run P7 for the explicitly requested release scope. Use the common execution contract. State which of P1-P6 are included, and never imply deferred features are live.

1. Reconcile every relevant ACCEPTANCE.md scenario, original IM checkbox and phase evidence against current code. Resolve real defects; remove misleading completion claims. Verify fresh install and upgrade from 8616300 with existing assignments, vendor appointments, active/closed visits, held work, manual results, verification/warranty facts and uploaded files preserved. Never reset hosted demo data as a migration strategy.
2. Complete the manager -> field manager -> technician -> store-confirmation -> manager story, plus direct manager assignment and team pickup, on desktop and 390px phone. Cover no-check-in and required-check-in, mixed-result multi-job visit, parts return, vendor handoff, unfinished-day replanning and scoped access. Advanced release also covers draft race, route extras and urgent compare/apply.
3. Run real simultaneous PostgreSQL clients for claim/return/reassign/publish/add-stop conflicts, replay and transaction failure. Preserve parity with fixture and SQLite/D1 adapters. If PostgreSQL cannot run, mark its gate open rather than substituting PGlite evidence without saying so.
4. Use separate deterministic 1-store and approximately 65-store synthetic datasets with jobs spread across weeks, waiting reasons, unknown estimates, several technicians and wide travel. Preserve showcase exactly 15 stores / 5 vendors / 2 technicians. Verify bounded queries/payloads and no full-snapshot route, memory growth or per-job query loops. Record dataset sizes, database, hardware/runtime, page/command timings and query plans for slow cases. Derive practical regression budgets from measured baseline; don't invent production capacity claims.
5. Run the full required check list sequentially as appropriate and investigate failures. Browser checks are additional. Verify unrelated vendor issue/accept/check-in/out, source files, work confirmation, inspection evidence, warranty, invoice visit evidence and core source-count drill-throughs.
6. Save an operator guide explaining the few daily actions and known estimate limits, plus deployment/migration/configuration and recovery notes. Existing ordinary WO operation must remain usable if a routing provider is unavailable or advanced dispatch is disabled. Rollback must preserve new audit/results/plans; do not drop tables or revert into old code that cannot safely read new records.
7. Produce an independent-review handoff with exact revision, diff scope, migrations, commands/test evidence, browser roles/journeys, remaining open items, and sample vs live routing status. Do not claim a feature is proven simply because pages load or tests check strings.

No deployment, hosted reset, commit or push unless separately authorized. Stop after the release-readiness report and saved handoff.
```

## Independent reviewer prompt — use after each phase

```text
Audit the supplied internal-dispatch phase commit against docs/internal-dispatch and the original IM checklist. Read the actual diff and relevant callers; do not edit application code. Verify the implementation's claims independently where practical.

Focus on the requested phase plus affected integration paths: tenant/store/role checks; stale scope; assignment vs manager ownership; simultaneous claims/edits; idempotency and atomic rollback; draft vs live behavior; primary next-action deadline vs completion target vs plan; observed visit vs reported result vs confirmation; return work and vendor handoff; exact count/action destinations; phone usability; bounded data access; fictional vs actual routing.

Report actionable findings in severity order with concrete reproduction and code locations. Separate confirmed bugs from design suggestions and unavailable validation. Do not claim a real security breach from an impossible test session without tracing the actual resolver, and do not dismiss inconsistent screen guards merely because the resolver currently blocks them. Verify fixed findings can close; do not invent new scope to keep the review open.

Run meaningful focused tests and browser workflows where available. Record the exact revision, environment and limits. All-tests-pass or HTTP-200 crawls are not enough to prove usability. End with whether this phase can advance and which remaining items are genuine blockers.
```

## Short phase-to-phase continuation prompt

```text
Continue internal dispatch with Phase P<N> only. Read the saved packet and the preceding phase's evidence first. Verify current HEAD and local changes. Carry forward unresolved findings; do not repeat completed implementation or start later phases. Follow the common contract and the exact P<N> prompt. Update the persistent checklist and acceptance evidence, then stop at the review checkpoint.
```
