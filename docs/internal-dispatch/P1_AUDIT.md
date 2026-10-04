# P1 independent audit — October 3, 2026

## Correction reassessment — October 3, 2026

F1–F3 are closed after independent source review and a fresh run of all five focused dispatch files: **33 tests passed in 71.91 seconds**, including the nine correction cases on fixture, actual Miniflare D1 and real PostgreSQL. Tests exercise inspection endpoint rejection without writes, separate corrective repair eligibility, division-only ownership and delivery with revoked/read-only access, and initial assignment/handoff notifications with rollback/retry coverage. The local rebuilt inspection service page was independently checked: the inspection task, Cameron and October 9 deadline remain visible, the hold control is absent, and assignment changes link to the inspection record. The recorded 1,268-test full-suite log was reviewed, not independently rerun.

**P1 is ready to proceed to P2.** This closes the three concrete findings below; it does not claim P2 execution/results or its simpler technician screen are implemented. Those usability priorities are now in the saved P2 contracts. No application edits, live delivery, hosted reset, deployment, commit or push occurred in this reassessment. The original findings and evidence below are retained as historical context.

## Decision

**P1 needs the three corrections below before proceeding to P2.** The assignment transaction and concurrency foundation passed the focused checks; these are bounded P1 integration defects, not a request to implement P2–P7.

Reviewed the uncommitted tracked and new implementation on `codex/internal-dispatch-p1`, based on `861630053e7fdff3686926047399f55a9be10495`, against AT06–AT18, the handoff, AGENTS.md, persistent checklist and five planning documents. Application changes were preserved. This audit adds documentation and ignored local reproduction artifacts only. No hosted reset, deployment, commit, push or real email delivery was performed.

## Findings

### F1 — High: internal hold bypasses inspection workflow protection

References: `lib/ops/commands.ts:1010–1017`, `lib/ops/commands.ts:1064–1072`, `app/app/_data/operator-loader.ts:720`. Compare the correct inspection guard in `lib/ops/internal-dispatch.ts:103–104`.

Reproduction:

1. Build the showcase fixture at `2026-10-03T18:00:00.000Z`.
2. As facilities, place approved internal inspection work order `showcase-work-walk-101` on a visit hold, posture `look_and_report`, review deadline `2026-10-25T18:00:00.000Z`.
3. The command succeeds. The open task `Complete inspection and return paperwork` is replaced by `Wait for a suitable internal visit`; the work-order action deadline changes to October 25. The inspection itself has not been performed.

The new UI eligibility and category exemption expose this path for internal inspection work. The assignment command protects the specialized workflow, but the hold command does not. This can hide an outstanding inspection behind a generic future-visit task.

Required correction: reject this transition for inspection service work and direct the user to the inspection. Preserve eligibility for separate corrective repair work orders. Do not mark inspection work complete as a side effect of holding a job.

Missing validation: exercise the hold endpoint as well as the dispatch endpoint against an unfinished inspection, verify unchanged task/status/deadline/history on rejection, and run that regression on fixture, D1 and PostgreSQL. Recheck the actual work-order hold control.

### F2 — Medium: claiming drops a valid division-scoped responsible manager

References: `lib/ops/internal-dispatch.ts:116–121`; underlying coverage helper `lib/ops/internal-accountability.ts:12–15`.

Reproduction:

1. Give Chris an active `ops:write` grant for Store 101's division, removing his other grants.
2. Create internal pool work for that store with Chris as the responsible manager. The new dispatch identity check accepts his access.
3. Have an eligible technician claim the job without requesting a manager change.
4. `internalAccountableId` changes from Chris's membership to `facilities-coordination`.

The reused accountability resolver recognizes organization, region and store grants but not division grants. The new command persists its fallback, so a claim silently loses the valid owner and can misdirect future urgent returns. This violates the owner-preservation part of AT08/AT11/AT12/AT17.

Required correction: align responsibility resolution with the new current writable-scope checks; preserve an eligible division-scoped manager. Also inspect notification recipient filtering: `sql-repository.ts:505–517` and the fixture equivalent only consider organization/region/store, before the new delivery handler validates dispatch identity. Division-scoped recipients need equivalent coverage semantics.

Missing validation: division-only manager and technician coverage through claim, return, reassignment and configured fake notification delivery on all adapters. Test revoked/read-only division grants separately so correcting coverage does not weaken authorization.

### F3 — Medium: initial direct assignment does not produce its notification

References: `lib/ops/commands.ts:891–921`; `lib/ops/email-delivery.ts:182`; compare the dispatch notification insertion at `lib/ops/internal-dispatch.ts:156`.

Reproduction:

1. Enable `internal_dispatch_changed` for internal technicians and install a fake email transport.
2. Create a new work order with `initialAssignment.kind = internal`, target `person`, and Maria's membership.
3. Process that work order's outbox messages.
4. Only `ops.work_order.created` and `ops.work_order.assigned` are present. Both are logged as `not_routed`; no assignment email is sent.

Assigning an existing job uses the new notification topic; assigning during creation does not. The saved engineering contract requires a notice for direct assignments and manager handoffs, subject to configured delivery. The job appears in the list, but the intended recipient is not alerted. This is not caused by an absent live provider.

Required correction: emit the applicable notification within the creation transaction, using the same recipient, stale-event and deduplication rules as subsequent assignment. Do not broadcast pool creation to every technician.

Missing validation: create-and-assign to technician, create-and-handoff to manager, pool creation without broadcast, approval-pending behavior, rollback and retry deduplication with a fake transport. Cover creation as well as reassignment.

## Independent validation and limits

- Reran the four focused dispatch test files: **24 tests passed** (63.82 seconds), including actual Miniflare D1 and separate real PostgreSQL connections. PostgreSQL used the guarded localhost disposable-database harness, not hosted data.
- Those tests cover person/pool/manager routing, tenant/role/current-scope denial, stale actions and retries, claim/reassignment/provider races, access revocation at commit, rollback, audit/outbox consistency and deadlines. Their success does not cover the three additional paths above.
- Independently reproduced F1–F3 through domain commands on isolated in-memory showcase fixtures. Script and output are retained in ignored `.codex-runtime/p1-audit-probes.ts` and `.codex-runtime/p1-audit-probes.log`. These extra reproductions were not rerun on D1/PostgreSQL; adapter regressions are explicitly requested above.
- Reviewed recorded full-run logs: 1,259 tests, 66 workflow tests, Sites build and Render build passed. Did not rerun the full suite or builds during this audit. `git diff --check` passed.
- Inspected the local PostgreSQL preview at port 3035: desktop Dispatch/assignment controls, technician access denial for Dispatch, phone My work and Available team work at 390 px, and the held-work detail link. My work did not horizontally overflow at 390 px. Reviewed implementation browser evidence for the completed assignment/return/held-cancellation and vendor compatibility journeys; did not repeat every mutation or every legacy journey.
- Actual dropped-network browser retry and live delivery remain untested. Command-level idempotency/concurrency was tested. Production authentication and P2–P7 remain outside this review.

## Exit criteria

Fix F1–F3, add the missing targeted regressions, rerun the focused cross-adapter tests, and recheck the changed browser paths. Then reassess P1 readiness. No later-phase work is needed to close these findings.
