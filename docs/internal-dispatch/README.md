# Internal dispatch: build plan and handoff

**Planning checkpoint:** October 3, 2026. **Code baseline:** `861630053e7fdff3686926047399f55a9be10495` on `origin/codex/platform-rebuild`.

**Status:** P0 planning is complete. P1's F1–F3 are closed by [Astra's independent reassessment](P1_AUDIT.md); its separate later R1–R3 corrections still await independent reassessment. P2 is implemented on `codex/internal-dispatch-p1`, and [the user-supplied Astra reassessment](P2_CORRECTIONS.md) clears its five reported defects. Broader phase/release acceptance remains open. [P2 handoff](P2_HANDOFF.md) records behavior, validation and review limits. P3 live scheduling and its two reviewed corrections are implemented and verified locally; [P3 handoff](P3_HANDOFF.md) and [P3 corrections](P3_CORRECTIONS.md) record validation and the pending independent reassessment. The user authorized a combined P1–P3 commit and push for Claude; [P1_P3_REVIEW.md](P1_P3_REVIEW.md) defines the committed review scope and exact baseline. P4–P7 remain unimplemented. Earlier uncommitted-status notes are historical implementation checkpoints.

**Current layout and demo contract (October 4):** the owner approved Assign as the main Dispatch view, Today as second, a Compare window, six technicians and approximately 36 open internal jobs. [ASSIGN_RELEASE.md](ASSIGN_RELEASE.md) records this implementation and insert-only backfill. Earlier two-technician evidence remains historical; the current AT80 presentation rule is six. This layout approval does not implement or close P4–P7.

## October 5 Review direction

**Full workflow continuation:** [WORKFLOW_2026_10_05.md](WORKFLOW_2026_10_05.md) is the current execution checkpoint for the owner's replacement workflow. It records the revised shared Review, day-based Plan, event-derived Today, checkout/status and delayed confirmation. The owner subsequently authorized the entire implementation and reserved approval for the end. Plan, Today, Review routing, checkout/status and delayed confirmation are implemented; the linked checkpoint records current validation. Earlier hour-grid, default-duration, prioritization, map and trip proposals are not part of this pass.

The owner superseded step 2 of the attached in-house workflow: facilities and field managers use the same Review list within their permitted store scope and can review and route accessible work. Review has no separate reviewer claim, handoff, or automatic regional reviewer setting. Delegate a specific job with the existing **Assign a task** action. Review shows the earliest-due active linked task, its responsible person/team and deadline, with a count/link when more tasks remain. Task assignment does not reserve the job or prevent another authorized manager from routing it. Required service accountability and technician assignment remain separate source facts.

The shared Review correction is included in the full workflow implementation. Existing Tasks remain the only job-specific delegation feature.

## 1. Outcome

Build internal dispatch for a convenience-store company's maintenance team. A manager can see incoming work, plan the week across a wide store footprint, assign technicians, and adjust when urgent jobs arrive. A technician gets a simple work list, useful job information, and one place to record a result or ask for help.

The manager needs a capable workspace; the technician needs a small number of useful actions. Calls and texts remain valid ways to coordinate. A manager can record those updates with clear attribution. Someone must record the outcome or blocker for the records to stay useful; constant status updates are unnecessary.

Scheduling is optional. A valid work order still needs only a store and problem plus existing accountability defaults. Equipment, precise estimates, a saved trip, and maps are not prerequisites.

This is internal dispatch. It does not manage an outside vendor's employees, introduce payroll or shift rosters, continuously track people, or score employee productivity.

## 2. Reading order

1. This document: decisions, scope, phase order, and existing checklist crosswalk.
2. [UX_SPEC.md](UX_SPEC.md): manager and technician screens and interactions.
3. [ENGINEERING.md](ENGINEERING.md): verified integration points, data/state rules, queries, transactions, and compatibility.
4. [ACCEPTANCE.md](ACCEPTANCE.md): scenario matrix, checks, and evidence template.
5. [PHASE_PROMPTS.md](PHASE_PROMPTS.md): common execution contract and copyable phase prompts.

Continue following [AGENTS.md](../../AGENTS.md), the [blueprint](../CSTORE_PLATFORM_REBUILD_BLUEPRINT.md), and [persistent checklist](../PLATFORM_IMPROVEMENT_PASSES.md). This plan records the user's newer internal-dispatch direction and explicitly supersedes only the older clauses listed below. It does not reopen unrelated product work.

## 3. Baseline and safe implementation workspace

The user's original checkout at planning time was `ea63d68`, with an untracked `dev4.log`. The current remote branch was `8616300`. These documents were created in a managed worktree based on `8616300`:

`C:\Users\Kedrick\.codex\worktrees\internal-dispatch-plan\Clark Pump and Shop App`

The original checkout, its running preview, `dev4.log`, hosted records, and Render were not changed. This worktree may have a detached HEAD; check before implementation. Planning documents are local working-tree changes until separately committed. Do not assume a fresh chat in the original project directory has them.

At implementation start:

- Read this packet from this directory. Inspect `git status` and the actual revision.
- Fetch the latest branch and compare it to the baseline. If code has advanced, update the integration map from evidence before implementing. Do not reset, overwrite, or blindly copy a stale whole checklist over the latest one.
- Preserve all planning files and other user work. Continue in this worktree, or deliberately carry only these documentation changes to a suitable latest checkout.
- Use a `codex/` branch for implementation if creating one. No commit, push, deployment, hosted reset, or paid-provider provisioning is included in the current planning-only request.
- Run one requested phase at a time. A phase prompt authorizes its bounded implementation when the user invokes it, not every later phase.

## 4. Decisions to carry into every phase

### Work, assignment, and ownership

- Keep the existing canonical work order and its number. Dispatch entries and planned visits are references to it, not new billing work orders.
- Internal work can go directly to a technician, to the eligible internal pool, or to the field manager to organize. The field manager is optional in the chain.
- A manager handoff and the person doing the repair are separate. Use structured internal accountability for the responsible manager; use the current internal assignment for the performer or available team work.
- `Choose later` never becomes claimable internal work automatically.
- A direct assignment does not require technician acceptance. `Take job` claims available pool work atomically. `Return to team` is explicit and preserves history and existing deadlines.
- Default pool eligibility is active internal technicians with current access to the work order's store. There is no existing real team-membership model to assume. Do not infer that a field manager owns every technician from the role name alone. Named crews are deferred; existing grants bound manager actions.
- An unresolved work order retains one responsible internal person/team, next action, action due time, and escalation. A shared queue is not an owner.

### Planning and time

- Normal ready repairs, scheduled work, waiting work, and `Next visit is fine` are different. Do not classify all unscheduled routine work as held work.
- Support no plan, a week, a day without a time, or an exact appointment. The ordinary Schedule action works on a phone; drag-and-drop is optional.
- Only scheduled jobs and explicit choices enter a technician's day. Their entire assigned backlog must not become today's workload.
- **Existing `WorkOrder.dueAt` is a projected next-action deadline, not a stable original repair deadline.** Add a separately identified optional completion target when planning needs that concept. Preserve and label both honestly. Never backfill an invented original completion target from a mutable task deadline.
- Schedule changes do not change completion targets, primary task deadlines, report age, assignment, or observed facts unless the user also explicitly performs the relevant domain action.
- Week/day values are calendar values in a saved planning timezone. Exact appointment input is store-local with an explicit IANA zone and a real stored instant. Browser timezone must not change meaning.
- Technician may reorder flexible stops. Changing a fixed appointment or moving a job to another date is an explicit scheduling action. Default technician authority covers their own flexible work only; manager authority and existing store scope govern reassignment and fixed commitments.
- P3 scheduling saves are live and clearly labeled. P4 introduces an explicit draft/share workflow. Do not show a Share button that merely sends a notification after draft edits have already changed live assignments.

### Field execution

- Check-in is optional by default for internal work, or required by company policy with an attributed authorized manager override.
- Claiming or scheduling never creates an observed visit. Recording a result without check-in must not fabricate arrival, departure, GPS, or onsite duration.
- Repair results and subsequent confirmation are separate. A technician reports the work; existing confirmation rules decide whether a review is needed.
- Show `Need parts`, `Need help`, `Need a vendor`, and `Cannot get to it today`. Route the next action to the appropriate existing accountable manager and keep the record visible.
- Several work orders at one store can share a visit; each keeps its own result. Return visits stay on the same work order. Finishing the store stop never completes every job automatically.
- Manager phone updates record the actual manager, the reported technician when known, and the source. No impersonation or backdated verified visit.

### Geography and capacity

- Planning must account for a wide footprint, start/end locations, and substantial return travel. Two fictional technicians do not establish the real customer's staffing.
- Use directional driving estimates; do not turn aerial distance into driving minutes. Plans use stated locations, not live tracking or the assumption that the last check-in is a current location.
- Route suggestions exclude **every store already on that specific plan**, including stores with unaccepted held jobs. Same-store extras remain in the existing additional-work flow.
- Opportunistic suggestions include eligible held internal work and the technician's own ready assigned work at other stores. Exclude vendor/choose-later work, other technicians' jobs, blocked work, and emergencies requiring direct dispatch. Managers still see urgent work prominently on the main dispatch board.
- Completion targets and fixed commitments take precedence over reducing drive time. A faraway store cannot disappear because nearer work ranks better.
- Optional repair estimates have a source and are planning estimates. Unknown stays unknown. Do not use observed visit time as per-job labor or default every unknown to one hour.
- Travel opportunity and capacity are different claims. `Adds about 35 minutes driving; repair duration unknown` is valid with routing data. `Fits Thursday` needs adequate workload and availability information.
- No runtime AI reader or LLM API is required for these phases. Use explicit rules and routing calculations. Mapping services, if chosen, have their own separately reviewed setup and usage costs.

## 5. Recommended implementation defaults

These settle routine choices so the executor can proceed; they are design defaults, not claims about Clark's actual policies.

| Choice | Default |
|---|---|
| Manager entry | Work -> Dispatch; Week is the initial view |
| Technician entry | My work; Today, Upcoming, Available, and access to all assigned work |
| Planning week | Monday start in a saved organization dispatch timezone; visible on schedule |
| Exact appointment | Enter in store time; display board conversion when different |
| Assignment fallback | Existing structured accountable manager/team, with a review due time |
| Pool membership | Active internal technician with current store grant; no new crew administration in P1 |
| Unscheduled field-manager work | Owned by the manager, not claimable until explicitly released to the pool |
| Internal check-in | Optional default; reuse versioned policy settings |
| Missing duration | No numeric substitute; show count of unknown estimates |
| Availability | Planning minutes/unavailable periods only; no reason or payroll fields |
| Start/end | Explicit saved preference or user selection; never guess a home or assume last visit |
| Notifications | One useful update per material action/publication; recorded outbox is not proof of delivery |
| Simultaneous edits | Version conflict with retained input and a useful refresh/review action |
| Active visit reassignment | Block direct takeover in the initial release; finish/correct visit or request help through the existing task/call workflow, then reassign |
| Stop ordering | User controlled; compare candidate insertion positions while preserving that order |

Automatic whole-route ordering, autonomous assignment, formal skill/certification management, native apps, offline mutation queues, parts inventory, labor costing, and workforce shifts remain deferred. A manager can make the skill decision now. Broad specialty defaults can be considered in P6 without creating a certification prerequisite.

## 6. Phase order and completion status

Do not implement the entire packet in one turn. Each phase has a copyable prompt and a review checkpoint. All new acceptance boxes stay open until evidence exists.

| Phase | Deliverable | Dependencies | Status |
|---|---|---|---|
| P0 | Verified baseline, decisions, screen/data contracts, prompts, acceptance packet | None | Planning complete; no feature implemented |
| P1 | Internal assignment, manager handoff, team claim/return, held-work eligibility, scoped queues | P0 | Implemented; F1–F3 cleared; later R1–R3 reassessment pending |
| P2 | Technician results, blockers, optional check-in, same-WO return/vendor handoff | P1 | Implemented locally; five fixes independently cleared; broader acceptance open |
| P3 | Week/day/time scheduling, completion targets, basic manager weekly view and technician agenda | P1-P2 | Implemented and locally verified; independent audit pending |
| P4 | Draft/share, day stop ordering, availability, rough workload, clear plan changes | P3 | Not started |
| P5 | Provider decision, travel data, map/list, complete trip estimates, additional-store suggestions | P4; provider gate for live integration | Not started |
| P6 | Explainable scheduling comparisons with missing-data limits and interruption preview | P4-P5 | Not started |
| P7 | Release rehearsal, migration/scale checks, adoption guide, reviewer handoff | Requested release phases | Not started |

**First useful release:** P1-P3 together: manager assigns and schedules -> technician sees work and records a result/problem -> manager sees the outcome. P1/P2 can be reviewed and used incrementally, but do not call the complete scheduling release finished before P3.

**Advanced dispatch release:** P4-P6. P7 can validate a limited P1-P3 pilot earlier, with P4-P6 explicitly unshipped. Final P7 repeats the full advanced story when those phases are complete.

P2 is deliberately before P3: the source audit found no honest technician result path without a visit. Building only schedules would leave the day list without a usable completion loop.

## 7. Existing IM checklist crosswalk

Preserve the original IDs and completed evidence. Do not replace IM-01/IM-02 or mark deferred work done because it has a phase.

| Existing item | New implementation location / adjustment |
|---|---|
| IM-01 Internal/outside labels | Preserve; P1-P3 extend to new surfaces and any remaining queue labels |
| IM-02 Roles/scope | Preserve `8616300` fixes; all phases test real membership resolution |
| IM-03 Optional assignment chain | P1; responsible manager is distinct from technician assignment |
| IM-04 My day | P2 work actions + P3 agenda + P4 ordered plan; same-store extras remain separate from route suggestions |
| IM-05 Signed-in visits/results | P2; must also implement honest visitless results and confirmation compatibility |
| IM-06 Needs outside vendor | P2; same work order, manager-authorized handoff |
| IM-07 Next-visit work | P1 eligibility/intake/closure, P2 field pickup, P5 other-store suggestions |
| IM-08 Nearby work | P5 replaces radius-only automatic suggestions with directional added-drive comparisons and exact planned-store exclusion |
| IM-09 Team board | P1 queues, P3 weekly view, P4 shared planning; scope grants define visibility until named crews exist |
| IM-10 Optional/required check-in | P2; no manufactured visits or technician self-confirmation |

Explicitly superseded earlier ideas:

- Unknown repairs counted as one hour, or job durations learned directly from whole-store visit times.
- Listing same-store held work inside the along-route list.
- Filling Today with every assigned job.
- A compulsory facilities -> field manager -> technician chain.
- A single mutable `dueAt` treated as both plan date and permanent repair deadline.
- Using a fake midnight appointment to represent a week/day plan.
- Automatically creating inspection jobs for route suggestions. Existing generated internal work orders may qualify; raw inspections remain in their own workflow.
- A field manager role implying a real team hierarchy that does not exist in storage.
- Requiring a separate acceptance tap after direct assignment.
- Automatic Shortest drive ordering as a prerequisite. Candidate insertion comparisons are in P5; whole-route optimization needs a separate later decision.

## 8. Decisions intentionally deferred

### Live map/drive-time provider

P1-P4 do not need a provider or key. P5 prepares a concrete provider comparison, expected calls/storage, caching terms, usage limits, privacy implications of sent addresses, and a bounded cost estimate using verified current sources. Then ask for the exact missing account/provider/budget information. Do not purchase, provision, or send real addresses to an unapproved service. Existing provider authorization, if supplied later, remains valid and should not be requested twice.

A deterministic fictional matrix can exercise the interface and algorithms before this decision. Label it **Sample driving estimates**. It does not prove real routing. Missing coordinates or driving legs result in unavailable estimates, not guessed times. Demo identifiers can use a clearly fictional schematic; do not imply fake store addresses are real customer sites.

### Actual company operating choices

Actual technician count, workday capacity, shop locations, overnight travel policy, skills, and availability are not established by the fictional fixture. Keep sane configurable defaults where specified; do not populate real-company facts by inference. Initial daily travel assumes the configured origin/end. Multi-day work has explicit continuation scheduling; overnight travel logistics are not a hidden new feature.

## 9. Completion and review discipline

- Every phase ends with working behavior, appropriate tests, browser evidence, checklist status, and a compact next-phase handoff.
- A page returning HTTP 200 is not a usability test. Exercise actual manager -> technician -> manager mutations, reload, error recovery, and phone controls.
- Tests must cover stored state and commands, not only snapshot strings. Concurrency needs the supported persistence adapters and an actual PostgreSQL transaction check before claiming PostgreSQL concurrency verified.
- New dispatch lists/aggregates must use bounded server queries, tenant first. Do not add another whole-tenant snapshot read or per-row query loop.
- Preserve existing vendor, invoice, warranty, compliance, equipment, and cost behavior. Dispatch is an additional view and command surface over the lifecycle.
- Run the prescribed quality checks before phase completion. If an environment is unavailable, keep its acceptance open and report what is missing. Do not widen timeouts or substitute a crawl to obtain a green summary.
- Record any plan adjustment with evidence. Do not reopen settled UX choices merely because another implementation is easier.

## 10. New-thread starter

Copy this after selecting the same managed workspace (or replace the path with the deliberately transferred latest checkout):

```text
Work in C:\Users\Kedrick\.codex\worktrees\internal-dispatch-plan\Clark Pump and Shop App.
Read AGENTS.md, docs/PLATFORM_IMPROVEMENT_PASSES.md, and all five files under docs/internal-dispatch.
These files contain the agreed internal dispatch plan; do not redesign the scope from scratch.
The planning baseline is 8616300. Inspect the actual branch, HEAD and working changes, preserve the saved documents, and check for newer code before implementation. The original project checkout was older and has an unrelated dev4.log; do not overwrite it.
Implement only Phase P1 using its prompt in PHASE_PROMPTS.md and the common execution contract. Use the acceptance matrix and update the persistent checklist with honest evidence. Preserve vendor workflows and tenant/store access. No hosted reset, deployment, paid-provider setup, commit or push unless I separately request it.
Stop after the P1 review checkpoint with a clear handoff for P2.
```

Routine implementation can use medium reasoning with these bounded prompts. Raise reasoning or seek a focused review when a real data-model, concurrency, or integration conflict appears. A saved plan does not replace reading the code and testing the behavior.
