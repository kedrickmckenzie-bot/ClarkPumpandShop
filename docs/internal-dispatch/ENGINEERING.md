# Internal dispatch: engineering contract

This is a planning document, not an implementation-completion claim. Baseline inspection: `861630053e7fdff3686926047399f55a9be10495` on `codex/platform-rebuild`. Recheck the current implementation before each phase. Later commits may close a gap listed here.

## 1. Boundaries and implementation approach

Build internal dispatch on the canonical work order. Assignment, a schedule, a visit, a result, and confirmation are separate facts. Do not create another service-record lifecycle inside a calendar.

The approved sequence is P1 assignment; P2 field execution and results; P3 live week/day/time scheduling; P4 draft/share, availability and ordered trips; P5 routing; P6 suggested scheduling options; P7 hardening. Consult the companion plan and phase prompts for acceptance gates. Each phase must produce a usable workflow, with later capabilities visibly absent rather than simulated.

Reuse domain behavior that conforms to this contract. New screens use bounded repository queries. Do not extend the full-tenant snapshot path to implement dispatch. Do not rewrite unrelated vendor, invoice, compliance, or warranty workflows as a prerequisite.

## 2. Verified baseline: reuse and gaps

All paths below are repository-relative and describe the inspected revision, not a promise about newer code.

| Area | Reuse | Gap or restriction to address |
|---|---|---|
| `lib/ops/commands.ts::assignWorkOrder` | Tenant-owned assignment records; active member/store checks; supersedes prior assignment; audit/outbox; work-order mutation fence | Internal assignment requires a named `internal_technician`. No team pickup, return-to-team command, or explicit client expected-version argument. Do not expose this unchanged as the claim command. |
| `WorkOrder.internalAccountableType/Id/Party`, `reassignWorkOrderInternalAccountability` | Durable manager/team ownership distinct from the provider; owner handoff updates appropriate tasks while preserving vendor responsibility | This is the correct basis for handing coordination to a field manager. It is not technician assignment. |
| `lib/ops/types.ts::WorkOrderAssignment` | `internal`, `outside_vendor`, `choose_later`; named technician; assignment history | Add an explicit internal pool target. Do not interpret every missing provider as internal. |
| `components/ops/role-policy.ts` | Technician screen role; field-manager persona uses regional screen policy; shared `sessionHasNoStores` | Technician capabilities are currently empty. New actions need narrowly scoped UI and server permissions. |
| `lib/server/operator-membership.ts`, `ops-request-context.ts` | Active membership identity, authenticated permission checks, role mapping, organization/store scope | New commands must revalidate actor and target membership/scope; hiding controls is insufficient. |
| `lib/ops/concurrency.ts` | `atomicWorkOrderMutation`, `atomicWorkOrderSetMutation`; durable unique fences serialize mutations | Require client-visible expected versions and expected assignment identities too. Fences alone do not detect an already stale user intent if a command fetches the latest state first. |
| `lib/ops/postgres-repository.ts`, `d1-repository.ts`, `fixture-repository.ts` | Atomic PostgreSQL transaction, D1 batch, fixture copy-before-commit | New records, SQL guards, constraints and query semantics need adapter parity. A zero-row UPDATE must not allow subsequent audit/notification inserts to commit. |
| `commands.ts::prepareCheckInVisit` | Shared multi-work-order visit, observed evidence, same-store/provider checks, active-visit conflict checks | Allowed statuses currently start at issued/accepted/scheduled. Internal work must have one named provider. Held-work selection explicitly requires an outside vendor. An internal path must remove inappropriate vendor prerequisites without weakening vendor checks. |
| `commands.ts::checkOutVisit` and `site-visit-outcomes.ts` | Exactly one result per selected job; unresolved follow-up; shared presence evidence; atomic multi-job changes | Reuse the consequences of each result. Do not equate checkout with successful repair or allocate visit duration into job labor. |
| `work-order-outcome.ts`, `work-order-verification-commands.ts`, `work-order-closure.ts` | Current-outcome selection, exact-outcome confirmation, closure policy | Results and confirmations are tied to `SiteVisitWorkOrder`. A result without check-in needs a real result record, not an invented visit. |
| `commands.ts::updateWorkOrderControl.manualCompletion` | Attributed manager recording of phone/email/in-person completion and existing closure safeguards | Manager-only direct completion is not a substitute for a technician recording a result, and must retain its attribution/policy semantics. |
| `confirmation-policy.ts` | Store-default confirmation with optional named confirmer; per-work-order requirement | Preserve this policy for visitless results. Do not automatically let a technician confirm their own repair. |
| `ServiceAppointment`, vendor continuation commands | Vendor proposals and confirmed appointments, exact times, source history | These are actual commitments. Do not use them as week buckets, fictitious midnight appointments, or draft internal schedules. |
| `WorkOrderVisitHold`, `held-work-policy.ts`, service runs | Canonical held work, vendor eligibility, visit links, historical outcomes | Current policy is vendor-specific. Internal next-visit eligibility must explicitly require internal routing and cannot leak vendor-held work into technician suggestions. |
| `workflow-task-commands.ts::buildWorkflowTaskProjectionStatement` | Current accountable party, next action, escalation and next-action deadline | It overwrites `WorkOrder.dueAt` from the primary workflow task. That field is not a stable original repair deadline. Scheduling must not treat it as one. |

There is no verified first-class maintenance-team/team-membership table in the inspected schemas. Existing `team` values are task/accountability identities. Do not invent a complicated organization chart to deliver P1.

## 3. State and identity invariants

Every open internal job must retain:

- Tenant and store identity.
- Explicit fulfillment choice; `choose_later` remains distinct from internal work.
- A responsible manager or existing facilities coordination team.
- An explicit allocation state: awaiting manager allocation, a named eligible technician, or the eligible internal pool. Awaiting allocation has no performer and is not claimable.
- A next action and its review deadline/escalation path.
- Its existing service history and work-order number.

Keep these independent:

1. **Accountable owner:** coordinates unresolved work and receives exceptions.
2. **Execution assignment:** who may perform/claim it.
3. **Schedule intention:** week, day, exact appointment or unscheduled.
4. **Readiness:** ready, suitable for a future convenient visit, or blocked with a reason.
5. **Observed visit:** actual recorded arrival/departure, when used.
6. **Work result:** what was reported for this job and by whom.
7. **Confirmation:** a separate authorized decision about the exact result.

Do not create one giant status enum combining these dimensions. Derive readable labels from the independent facts. A planned stop is never evidence that a person arrived, started work, or completed it.

## 4. P1: assignment and team pickup

### Minimal model

Extend the existing assignment representation to distinguish internal **awaiting allocation**, **person**, and **pool** states. Preserve `kind: internal`; use an explicit target discriminator or equivalent schema constraint. Existing named internal assignments migrate/read as person targets. Awaiting-allocation and pool assignments have no technician ID but different eligibility; only an explicit pool assignment is claimable. Outside/choose-later rows cannot carry internal target fields. A missing technician is never sufficient to infer either internal state.

For the first release, the eligible pool is active `internal_technician` memberships in the same organization whose current grants cover the job's store. Keep the existing durable owner on the work order. Do not add arbitrary team IDs which have no membership definition. If real separate teams become necessary, add them later as an explicit extension of pool eligibility.

Sending coordination to a field manager updates internal accountability. It must not disguise the manager as a technician or outside vendor. Routing to the internal pool is an explicit fulfillment decision, and any approval/readiness restrictions still apply before pickup.

If no performer has been chosen, Send to field manager sets awaiting allocation plus the named accountable manager. Releasing to the pool is a separate explicit command. Changing only the accountable manager on an already assigned job does not implicitly unassign the technician; choosing a reallocation operation states both changes.

### Commands and guards

Provide narrow commands equivalent to `assignInternalWork`, `claimInternalWork`, `returnInternalWork`, and manager reassignment. Reuse the existing assignment append/supersession pattern rather than overwriting who historically performed work.

Each mutation validates:

- Active actor membership, domain role/capability, tenant and writable store scope.
- Active target membership, permitted role and target store coverage.
- Expected work-order version and expected current assignment identity.
- Work not terminal, cancelled, in an incompatible approval/quote decision, or owned by an incompatible active visit.
- Claim allowed only from a currently eligible pool assignment; technician identity comes from the authenticated session.
- A technician cannot take another person's assignment through crafted IDs.
- Reassignment of active work requires an explicit supported handoff, not silent mutation of the current visit performer. Initially reject and explain that the active visit must be finished or handled by the appropriate manager flow.

Return-to-team preserves the manager owner, service target, priority and existing deadlines. Record actor/reason and schedule consequences. Do not leave the job on the releasing technician's committed day as though they still own it. Urgent/overdue returns create one actionable owner notification, not a duplicate notification on every refresh/retry.

Named assignment has no technician acceptance ceremony. It also does not require service authorization, vendor acknowledgment, task start, or check-in. Resolve legacy internal pending/issued wording through a compatible internal-specific transition/projection; do not falsify a vendor response to advance internal work.

### Default action authority

These are feature defaults within actual current organization/store grants. Existing explicit customer permission overrides and financial/issuance rules remain authoritative. Map each action through server policy as well as the UI; do not grant the broad `control_work_order` power to make technician buttons work.

| Actor | Dispatch authority |
|---|---|
| Facilities manager | Plan/assign/reassign, manage targets and internal readiness, record attributed updates and authorized exceptions within scope |
| Field manager / regional manager | Same internal planning actions within their actual grants and existing manager capabilities; field persona alone does not confer companywide access |
| Technician | Read permitted work; claim eligible pool work for self; return own work; record own assigned/authorized visit work; flag blockers; schedule/move own flexible work and reorder own stops. No assigning others, target amendments, fixed-appointment amendments or approval/issuance powers |
| Executive/owner | Read dispatch within existing readable store scope. Write actions only when an existing explicit delegated permission grants the corresponding manager action; do not widen authority because of title |
| Store manager | Existing store job/plan context, issue reporting and permitted confirmation. No dispatch assignment/publishing power added |
| Finance / vendor / public links | Preserve existing permitted financial/vendor workflows; no access to internal dispatch management merely because related work is visible elsewhere |

Technician flexible date changes retain the repair target and current action obligations. Show target/fixed-dependency conflicts and route material date changes or new conflicts to the accountable manager. Do not require manager approval for every routine reorder. Exact appointments and target amendments use the manager action. A tech whose store grant has been revoked cannot act just because an old assignment still names them; the manager gets a scoped exception without automatically widening access.

## 5. P2: field execution and a result without a visit

### Canonical result contract

Introduce an append-only work-result representation that can reference an optional existing visit-job link. Suggested logical fields:

- `id`, `organizationId`, `workOrderId`, optional `assignmentId`.
- Optional `siteVisitWorkOrderId`; validate that it belongs to the same tenant and work order.
- Result kind using shared service-outcome semantics, concise notes and linked evidence.
- Performer identity when known, recorded-by identity, recorded-at server instant.
- Source such as technician self-report, visit checkout, manager phone/email/in-person report.
- Optional reported performed date/time, explicitly reported rather than verified.
- Optional superseded-result reference and correction reason.

Do not overload a general task comment as the only result record. Do not generate zero-length visits, backdated check-ins, synthetic location evidence, or invented duration to reuse a visit-only completion path.

This is a logical contract, not a demand for a historical rewrite. Add the new representation incrementally. New result-producing paths write canonical records; legacy visit outcomes remain readable until migrated. When a new canonical record references an existing visit-job outcome, normalize it once and do not count both.

### Backward-compatible outcome selection

Create one normalized outcome source used by all current-result consumers. Its reference is discriminated, for example `{ kind: 'work_result', id }` or `{ kind: 'legacy_visit_outcome', id, recordedAt }`. Preserve the legacy shape at compatibility boundaries while callers are migrated.

The normalized read must include pending newer service cycles, not just completed results. Existing `latestRecordedWorkOutcome` deliberately returns no current result when a newer visit-job link has no result yet. Preserve that protection: opening a return visit must not resurrect a previous completed result and confirmation.

Ordering needs a deterministic server-side sequence or other explicit cycle/revision ordering. Do not let a back-entered performed date become the current outcome just because its reported time happens to sort later. Corrections append a new revision; source facts, original actor and original recorded time remain available.

No full historical backfill is required before P2 is usable. Read legacy rows through the adapter, prefer a linked canonical successor when one exists, and regression-test mixed old/new histories. Audit-only historical corrections may remain legacy history; do not invent missing original facts during migration.

### Confirmation and downstream integration

Extend confirmation to reference exactly one supported result source. Existing `site_visit_work_order_id` is NOT NULL with a composite work-order foreign key in both schemas; changing only a TypeScript type is insufficient. Add a canonical-result foreign key or equivalent discriminated target, enforce exactly one target, and preserve existing rows and legacy API compatibility.

Expected-result identity/revision and expected work-order version must accompany decisions. A confirmation for an old result never applies to a new return visit or corrected result.

Update shared selectors and consumers together:

- `work-order-outcome.ts`, `work-order-case.ts`, `work-order-closure.ts`.
- `work-order-verification-commands.ts` and its presenter/API.
- `work-review.ts`, work/store/equipment queues and dashboards.
- `compliance.ts` where completion is read from the linked work order.
- Warranty/repair-history integrations that inspect results directly, including checkout and confirmation hooks.
- Invoice/evidence views which display completion facts.

Do not fabricate vendor, warranty, site-visit, or repair-item relationships for internal results. Existing vendor labor warranties retain their vendor/source rules. Invoice views must distinguish a reported result from observed onsite evidence, and lack of a visit must not silently become proof against an invoice.

Manager recording remains attributed as manager-recorded evidence with the actual source/person. Technician self-report does not inherit the manager's authority to approve/confirm/close. Existing confirmation-required, designated confirmer and permitted direct-manager-completion policies remain effective.

### Results, blockers and return visits

An unresolved result creates or updates its accountable follow-up in the same transaction. Need parts, need help, need a vendor and cannot get to it today are distinct operational facts; they must not all mean completed or waiting on vendor.

- Need parts: preserve the work order, identify follow-up owner and next review, remove it from ready-to-do suggestions until ready.
- Need help: preserve performer/owner facts and route a clear action; do not silently release ownership.
- Need a vendor: ask the responsible authorized manager to route/issue the same work order. The technician does not gain vendor-issuance authority.
- Cannot get to it today: preserve assignment unless the user explicitly returns it; schedule needs a decision and the deadline stays intact.
- Completed: run the existing confirmation/closure policy. Outcome completion is not automatically store confirmation.

Flagging a blocker does not automatically fabricate checkout. If a real visit is active, the UI must clearly finish the appropriate per-job outcome and visit action, preserving exactly one outcome for every selected job. If check-in is optional, record the result without creating presence evidence. A future return visit uses the same work order and a new actual visit/cycle.

## 6. P3: scheduling without changing service obligations

Use a current schedule intention attached to the canonical work order or its explicit next service attempt. Minimal schedule precision: unscheduled, week, day, exact time. Keep precision explicit; do not store a weekly bucket as a Monday 00:00 appointment.

Suggested logical fields are work order/assignment identity, precision, civil week/day, optional exact instant/timezone, fixed-appointment flag, actor, revision and history. Optional estimated work duration is a range or explicit value with provenance; unknown is null, not zero or an invented hour.

### Deadline distinction

`WorkOrder.dueAt` currently means the projected primary next-action deadline. If the dispatch UI shows a stable repair target, add an explicit target-completion field with provenance and its own authorized change action. New schedules never update that target or the task deadline merely because someone drags a job.

For old jobs, label the existing value as the current action/review deadline unless a real repair target is known. Do not claim it is the original resolution deadline. A manager may explicitly set a service target; that is an audited decision, not a hidden migration assumption.

Scheduling can legitimately fulfill a current `Schedule service` obligation. In that case, complete the matching task and establish the actual next execution/follow-up obligation atomically, with an explicit policy-derived action deadline and audit. Do not leave a satisfied scheduling task overdue, or blindly copy the planned date into every task. The independent completion target stays unchanged.

### Dates and timezones

- Week/day are civil dates in an explicit planning timezone; do not coerce them through browser-local `Date` or UTC midnight.
- Use one saved organization dispatch timezone for week/day membership, and persist that zone as a snapshot on each commitment/plan. A technician-specific display preference does not redefine its calendar date. An organization-zone change applies to newly created plans; existing commitments retain their saved meaning unless explicitly rescheduled.
- Exact appointments store an instant plus the IANA timezone used for entry. Default an exact store appointment to that store's timezone and label it.
- Display cross-timezone stops clearly; use instants for drive/appointment arithmetic, civil dates for week/day membership.
- Reject nonexistent local times around daylight-saving changes and require an explicit interpretation for ambiguous times. Do not silently shift the entered appointment.
- Display schedule and fixed vendor appointment conflicts; do not mutate a vendor's agreed date by moving internal work.

Existing vendor `ServiceAppointment` records remain authoritative vendor commitments, with their original proposal/confirmation provenance. An internal exact schedule is typed internal intent/commitment in the dispatch model. Aggregate readers deduplicate overlapping display facts and never count a draft or week bucket as another upcoming actual visit.

The first scheduling UI is live and honest about immediate changes. It must show a basic weekly agenda across technicians as well as the individual daily list. P4 introduces drafts and publishing; do not label P3 edits as private drafts if they already change the technician's work list.

## 7. P4: draft/share, availability and ordered trips

Use an explicit revisioned technician-day plan (or equivalent aggregate) with committed and draft state. A trip contains a starting point, ordered store stops with selected work orders, and optional ending point. Several jobs intended for the same store visit share a stop while preserving their canonical identities. Each stop has its own occurrence ID: an explicit return to the same store later that day or a second fixed appointment remains a separate occurrence. Do not enforce uniqueness on store plus day. Exclusion from route suggestions still uses the set of every store ID appearing anywhere in the plan.

Draft editing must not change live assignment, technician instructions, visits, workflow tasks or notifications. Draft-assigned jobs are provisional proposals, not hidden claims. If another person changes/claims the job while the plan is drafted, publishing must revalidate it and explain the conflict.

Publish an entire technician-day revision atomically. A cross-technician move publishes both affected day revisions and the assignment changes as one unit; otherwise the job could disappear from one list before appearing in another. Fence touched plans and work orders in deterministic order to avoid lost updates and reduce deadlock risk.

The basic publishing unit is explicit. If a selected coherent group cannot commit, report the conflict without partially changing that group's live work. The initial UI can publish one day or one coupled move at a time. Week-wide sharing may process explicitly independent groups, with a visible success/conflict result for each; never describe the entire week as shared when a group failed. A cross-technician move cannot be split between those groups.

Use coalesced actionable notifications after publish; repeated edits inside a draft emit no technician notification. An urgent direct live assignment remains possible with clear wording. Notification content must describe the committed revision and be suppressed/replaced when obsolete before delivery, rather than sending a stale sequence of moves.

Availability is optional planning capacity: usual planning hours or minutes and unavailable dates/blocks. No absence reason, attendance inference, leave balance, payroll or shift-management requirement. Technicians can edit their flexible stop order; managers can prepare it; concurrent edits never silently overwrite one another.

Removing a stop does not release the assignment. Rescheduling does not change service targets. Moving a fixed appointment warns and requires the proper explicit appointment action. Cancelling/completing/reassigning a job must reconcile live plan visibility, while retaining historical/draft context and marking stale drafts for review.

## 8. P5/P6: routing and suggestions

Routing is an adapter, not a domain dependency on one provider. Store stable coordinates separately from user-facing names/addresses; validate missing/poor coordinates. A provider/account/key/cache policy is an implementation gate. Choose storage/refresh behavior only after checking the provider's actual terms.

A drive-time matrix may use directed pairs and source/as-of metadata. Unknown pairs are unknown, never straight-line minutes or zero. Include actual selected origin and endpoint, not an assumed last check-in location. Demo estimates are deterministic and visibly fictional, never live traffic claims.

For ordered stops, insertion cost is the added trip driving time relative to the current plan. Recompute after selected additions; independent detours cannot simply be added together. All route requests and cache keys include ordered endpoints and relevant routing options. Impose request/pair bounds and timeouts; failure must leave assignment and scheduling fully usable.

Suggestion eligibility is enforced server-side at read and acceptance:

- Same organization and permitted store scope.
- Explicit internal routing, appropriate readiness/held posture, nonterminal job.
- Eligible held internal pool work, or this technician's own ready assigned work whether held or ordinary. Moving an own job that already has a live commitment is explicit, not duplicate scheduling. Ordinary unassigned ready work stays in the main scheduling board rather than becoming opportunistic held work automatically.
- Exclude work assigned to somebody else as freely claimable.
- **Exclude every store already in the current plan, regardless of which jobs at that store were accepted.**
- Respect fixed appointments, blocked work, scope, approvals and active visits.

Store suggestions carry existing problem/details and explicit selected jobs. Accepting a suggestion claims only the selected eligible pool jobs and updates the committed/draft plan through the appropriate atomic path. Own jobs are scheduled without a second assignment. Additional jobs at a newly added store remain part of the normal same-store flow, not repeated route suggestions.

P6 compares alternatives rather than automatically dispatching. State the added driving, estimated repair work, unknown durations, existing fixed commitments and displaced work. No precise “fits today” conclusion from missing estimates. Known geography alone may support “already planning a trip in this area,” even when capacity is uncertain.

Suggestions are advisory, expiring calculations. Acceptance revalidates underlying work/assignment/plan versions; never trust a client-submitted eligibility flag or stale estimate as authority. No live tracking, inferred location, individual productivity score or automatic penalty for exceeding an estimate.

## 9. Transaction, idempotency and read contracts

Use the repository's atomic transaction mechanism for domain changes, history/audit, workflow projections and outbox records together. Never update the calendar and then call an assignment endpoint as a second independent transaction for a combined user action.

Every retryable mutation has an idempotency key scoped by tenant, command and actor, with a normalized payload hash and stored result. Same key/same intent returns the original result; same key/different intent fails. A losing concurrent claim returns conflict and current handler, not a second assignment or notification.

Keep optimistic versions at all relevant aggregate boundaries. A stale browser must not overwrite a newer schedule merely because the API fetched the latest object internally. Use durable conditional-write assertions/fences supported by PostgreSQL, D1 and fixtures; a process-local mutex is not sufficient.

Database constraints reinforce the commands: tenant-composite ownership references, one current execution assignment/claim, valid target-field combinations, unique plan revision identities and one selected current schedule per service intention. Audit-only tests do not replace real database concurrency tests.

Add bounded queries for dispatch backlog, week/day agenda, eligible technicians, plan versions and route candidates. Filter tenant before scope; sort deterministically; paginate large lists; count from the identical predicate used by drill-down. Do not load all jobs, members or visits into the browser to hide them locally.

The UI must read its committed write. Return committed versions and affected IDs; invalidate the affected scoped query/cache entries. Do not rely on a TTL or an unrelated full-snapshot refresh. Any cache includes organization, caller scope, date/filter inputs and relevant revision; do not share an authorized view across different scopes.

### Notification contract

Notifications point to the actual committed record/action and use existing configured delivery infrastructure. The default recipients are explicit so implementation does not broadcast every change to the whole company:

| Event | Default recipient / behavior |
|---|---|
| Direct assignment | Assigned technician; no required acceptance reply |
| Reassignment | Newly assigned technician and prior technician whose instructions changed; routine self-pickup does not require a manager acknowledgment |
| Manager handoff | Newly accountable manager, with Arrange internal work action |
| Pool claim | Update shared queue/history; no broadcast to all technicians |
| Routine return to pool | Update queue/history; no separate mandatory alert |
| Urgent/overdue return | Accountable manager, one actionable alert |
| Parts/help/vendor/cannot-get-to-it blocker | Accountable manager; deduplicate against the same operational follow-up, do not create a second task just for the notification |
| Successful result | Follow existing closure/confirmation policy; required confirmation notifies its existing designated recipient, not a global team |
| Manager live schedule/material destination change | Affected technician(s); consolidate within one command |
| Technician flexible date change / new target conflict | Accountable manager; simple same-day flexible reorder is visible without a ping |
| Share plan | One summary per affected technician for each publication group; obsolete pending notifications are suppressed/replaced without erasing audit |
| View/open/draft edit | No delivery event |

In-app committed state remains available when no email/SMS provider is configured. `Queued` and `Delivered` are different facts. Automated tests use fake transports/disposable recipients; a live-send test needs the user's authorization. Notifications are not a substitute for persisted accountable follow-up.

## 10. High-value acceptance cases

These must be covered across suitable domain tests, real-adapter tests and actual UI workflows, not by dozens of implementation-mirroring assertions.

1. Two technicians claim the same pool job: one assignment, one audit/outbox outcome, useful conflict for the other.
2. Assignment races a return, outcome, closure, reassignment or active-visit start: no contradictory committed ownership/result.
3. Two managers edit the same day; a manager and technician reorder it; stale edits cannot erase newer work.
4. A draft move has no live side effects; publish moves all affected day/assignment state together or none.
5. Retrying a timed-out successful action creates no duplicate assignment, stop, result, follow-up, notification or visit.
6. Internal work is performable without vendor issuance/acceptance. `choose_later` and vendor-held work never enter internal pool/route results.
7. A visitless result completes correctly with optional check-in; required-check-in policy follows the explicit exception path. No synthetic evidence appears.
8. A partial multi-job checkout records one result per job, creates unresolved follow-ups atomically and leaves unrelated jobs intact.
9. A new return visit invalidates the previous result's applicability; a corrected result requires confirmation against the new exact source/revision.
10. Legacy visit, new visit-linked result and visitless result all appear once in work history, confirmation, equipment/store views and downstream completion readers.
11. Manager phone completion remains visibly attributed; a technician cannot use it to grant themselves confirmation/closure privileges.
12. No cross-tenant or out-of-scope read/write/suggestion/file access; assignment cannot expand a technician's store access.
13. Authenticated and preview personas agree, including companywide field manager, scoped field manager, empty scope and revoked membership.
14. Reordering or rescheduling preserves original service target and deadlines; future work stays visible without making all of it urgent today.
15. Cross-timezone schedules and daylight-saving boundaries preserve entered intent; exact appointments are not duplicated in upcoming-visit counts.
16. Route candidates exclude all planned stores; partial missing routing data is explicit; a second accepted detour is recalculated.
17. Unavailable time and unknown estimates are visible without HR fields, fake precision, tracking or automatic accusations.
18. Desktop and 390px phone complete manager-to-technician-to-manager workflows without drag-only controls, dead links or hidden primary actions.
19. New queries remain bounded with a separate approximately 65-store synthetic fixture and realistic backlog/concurrent mutation load.

## 11. Migration and rollout guardrails

Use additive migrations where possible and preserve the five-vendor/fifteen-store/two-technician fictional presentation contract. Add deterministic connected internal-work examples, but do not reset hosted data or erase user edits as part of implementing dispatch.

Existing named assignments, vendor appointments, results, verifications and audit history must remain readable throughout. Backfill only facts that can be derived truthfully; record compatibility provenance when necessary. Never infer employee schedules, working hours or historic service time from gaps between visits.

Check startup migrations and all supported adapters, fixtures, query mappers, seeds, schema declarations and indexes. Do not expose a phase's controls before its backend is durable. Production role access uses actual identity/grants, not the demo persona picker.

For each checkpoint, record what changed, tests run, browser scenarios verified, unresolved limitations and the exact revision in the persistent checklist. Do not mark a phase complete because its screens render or because lower-level tests pass. The user journey and its failure/retry path must work.

## 12. Implemented P2 contract for P3

P2 adds `WorkResult` and `Repository.listWorkResults` / `listWorkOutcomes`. A result is an immutable fact linked to the canonical work order, current assignment and actual performer/recorder. `siteVisitWorkOrderId` is optional. Visitless results do not create a visit, location, presence interval, vendor report or component-warranty fact. Sources are technician report, visit checkout, phone, email, in person or correction. Manager exceptions retain their actor and reason in the same audited command.

`normalizeWorkOutcomes` replaces a legacy visit-job outcome with its canonical successor once, retaining the actual parent visit. `latestWorkOutcomeCycle` orders by persisted `cycleVersion`, then linked/recorded timestamps and ID. A newer pending visit suppresses an older completed result, including when clocks are equal. `latestRecordedWorkOutcome` returns only the current cycle's recorded result. Use these helpers rather than sorting historical results independently.

The canonical case reads each job's normalized outcome when a shared visit has no aggregate outcome. A manager's outside assignment following the exact prior internal vendor finding advances to authorization, then vendor response; the completed internal stop and prior costs remain evidence. Do not send that new service step back to closeout solely because the old shared visit lacks one aggregate outcome.

`applicableOutcomeVerification` / `verificationMatchesOutcome` match the exact canonical result, or the legacy visit-job parent where that compatibility is valid. A correction appends a successor and preserves the original fact and decision; the old decision does not confirm the correction. Verification stores exactly one of `workResultId` and `siteVisitWorkOrderId`. Reports of observed visits use `applicableVisitWorkOutcomes`; they exclude visitless results. Work review, store/equipment views, closure, compliance, warranty consumers and record-integrity checks share this identity/cycle contract.

| P2 action | Existing durable entry point | Boundary |
|---|---|---|
| Result / problem | `POST /api/ops/work-orders/[id]/internal-result`, action `result` / `problem`; `recordInternalWorkResult` | Current writable store grants, assigned technician or authorized manager, work/assignment version, submission key; technicians cannot supply manager attribution or bypass required check-in |
| Parts arrived / ready for return | Same endpoint, action `ready`; `markInternalWorkReady` | Authorized manager, current unresolved internal result, no active visit; retains assignment and work-order number; requires explicit readiness review |
| Choose an outside vendor | Same endpoint, action `vendor`; `handoffInternalWorkToVendor` | Authorized manager, current internal vendor finding, exact work/assignment version and actor-bound receipt; existing provider command validates coverage/approval and atomically cancels the obsolete internal hold; service authorization remains a separate manager action |
| Check-in | `POST /api/ops/internal-visits`, action `check_in`; shared `checkInVisit` | Actual signed-in technician; optional by default or required by versioned organization workflow policy; held claims and links are atomic |
| Same-store extra work | Same endpoint, action `add_work`; shared `addHeldWorkToActiveVisit` | Eligible internal held pool/own work at this store, current grants and visit selection fence; no inspections or other technician's assignment |
| Results and checkout | Same endpoint, action `check_out`; shared `checkOutVisit` | One outcome/notes/files per linked work order, exact work/assignment versions; no-WO visit has attributed notes and a reviewable exception |
| Confirmation / correction / vendor handoff | Existing verification, correction, closeout and provider commands | Same work-order lifecycle, existing policy/approval limits, append-only prior facts; no new technician verification or issuance authority |

Result and visit APIs use actor-bound idempotency receipts and payload/file-content hashes. Replays recheck current access and return the committed result; changed intent conflicts. Visit selection is fenced against concurrent extras/checkout. Result, task, follow-up, audit and required outbox changes commit together. Private uploads use stable per-action keys, at most five files and 8 MB total; no-file operations do not require storage configuration. The focused job and visit forms retain input on validation or failed save.

P3 must call this execution contract from its agenda. Scheduling/claiming still cannot manufacture an observed visit or result, and `WorkOrder.dueAt` remains the current action deadline. P2 introduces neither a planning date nor a completion target. Read [P2_HANDOFF.md](P2_HANDOFF.md) for concrete validation and independent-audit instructions.

## 13. Implemented P3 contract

The implementation chooses immutable live schedule revisions plus one nullable work-order current pointer. Each revision binds organization, work order and assignment, and carries a numbered execution attempt. A calendar move appends a revision in the same attempt. A result retires the pointer; readiness followed by a deliberate return plan starts the next attempt without cloning the work order. Pool pickup carries the calendar to the claimed assignment. Separate return/reassignment retires the current pointer, records the consequence and preserves history. Combined Who/When saves replace assignment and plan in one fenced transaction.

`internal-scheduling.ts` implements `saveInternalSchedule` and `setInternalCompletionTarget`. The real authenticated `/api/ops/work-orders/[id]/internal-schedule` handler delegates both; it does not expose general work-control capability to technicians. Manager and technician read/write scope uses current persisted organization/store/division/region grants. The saved work version, assignment and plan pointer guard concurrent schedule/result/return. Actor-bound receipts include the proposed intent; retry after a lost response returns the original persisted revision. Transaction-time access assertions fail closed if grants change after preflight. Mutation/audit/receipt/outbox/task changes roll back together.

Planning uses the existing saved organization `timeZone`, copied onto each revision, with Monday week starts and civil `week`/`day` fields. Flexible work does not get fake midnight timestamps. Exact input is store-local, with IANA `entryZone`, entered wall time, explicit fold disambiguation and ISO instant. Both known repair interval and uncertainty are preserved. Gaps reject input; folds require earlier/later. Board/store labels state the relevant zone. Saved calendar snapshots and instants survive later organization-zone changes.

P3's reviewed timezone correction supplies one server reference instant to Today, Upcoming and Needs replanning. Each current plan compares against that instant's date/week in its saved planning zone, including row warnings. Selected Week retains absolute saved civil membership. D1/PostgreSQL load scoped distinct zone metadata in stable 100-zone pages and apply a parameterized JSON date map inside native filtering/counting/pagination; calendar records are never filtered after paging in JavaScript. Different saved/current zones are labeled in the agenda. The fixture follows the same date semantics before its counts/cursors.

Target completion is an optional separately authorized work-order field with source `manager:<membershipId>` and append-only before/after audit. Its UI requests a reason for change/removal. No migration infers a repair target from mutable `dueAt`. Ordinary scheduling does not change priority, target, report date or existing primary obligation. A ready plan fulfilling an actual unlinked Schedule service/return task completes that task and establishes Complete planned internal work, using an explicit initial execution policy: urgent/emergency 24 hours; other work 72 hours from the save. The policy and transition are recorded; this is a product default, not a claimed customer configuration. Independently linked approval/follow-up requirements are preserved. Waiting parts/vendor/follow-up/held work requires a manager's tentative review reason and remains outside Ready.

A combined Who/When tentative save preserves the actual scheduling tasks through assignment composition, including their deadline and projected next action. Retiring an old allocation task does not satisfy scheduling. Only a ready plan supplies the execution deadline and completes the required scheduling action. [P3 corrections](P3_CORRECTIONS.md) records the failures before fixes, native regression coverage and remaining reassessment gate.

The manager weekly agenda and independent backlog/replanning/results-review pages use repository-native filtered counts and stable cursors, 25 records per page. The selected period does not hide due/urgent unscheduled work. Technician Today contains dated commitments only; Upcoming includes current week-only and later work; All my jobs retains the assigned backlog. Past unfinished commitments remain visible and are never moved automatically. Filter choices are scoped/bounded; calendar clients receive projected rows. Native 1/65-store parity cases create actual work/tasks/assignments/plans and exercise counts, pagination and store restrictions.

Internal schedules remain separate from existing vendor `ServiceAppointment` records and Vendor Upcoming visits aggregates. This avoids double counting and preserves external commitments. A confirmed legacy provider appointment is retained and warns during a new internal plan. Known exact intervals warn on overlap; unknown duration or a comparison beyond the bounded window cannot claim availability. Target/overlap warnings offer explicit Keep this plan or change the date. Manager UI is button/form/list based and works without drag, map or mandatory exact time.

Material schedule/target updates reuse the configured `internal_dispatch_changed` notification rules and delivery channels. Combined assignment/schedule creates one targeted material update, including the saved plan, while retaining other domain outbox messages. Actor moves across dates/weeks notify the accountable manager/team; irrelevant same-day flexible edits avoid extra notices. Current assignment/schedule/target checks suppress superseded queued notices. Pool work is not broadcast merely because a calendar field changes. Delivery verification uses a fake provider only.

P3 live saves have no draft, Publish or Share semantics. P4 alone introduces draft isolation, shared ordered days and rough workload. Read [P3_HANDOFF.md](P3_HANDOFF.md) for migrations, evidence, review boundaries and the first-release pilot decision.
