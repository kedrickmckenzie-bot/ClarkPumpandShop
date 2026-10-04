# P1 implementation and Astra review handoff

Worktree: `C:\Users\Kedrick\.codex\worktrees\internal-dispatch-plan\Clark Pump and Shop App`.
Branch: `codex/internal-dispatch-p1`. HEAD is the planning baseline `861630053e7fdff3686926047399f55a9be10495`; implementation and previously saved planning documents are uncommitted. Review the working changes, including new files. The original project checkout and its preview were not modified.

Current review checkpoint: F1–F3 were independently reassessed. The later review's R1–R3 corrections and new cross-adapter evidence are in [P1_CORRECTIONS.md](P1_CORRECTIONS.md); these require independent reassessment. Final validation passes 1,335 tests, 66 workflow tests, seed, typecheck, lint and both builds. All three correction journeys pass in the rebuilt PostgreSQL desktop/phone preview. Existing local P2 work is preserved, with no further P2 implementation in this correction pass. The original [independent audit](P1_AUDIT.md) remains preserved.

## Implemented boundary

P1 adds explicit **Named technician**, **Available to the team**, and **Manager to arrange it** assignments over the existing work-order lifecycle. The responsible manager or coordination team remains separate from the performer. Direct assignment needs no acceptance or vendor issuance.

Managers use `/app/dispatch`; technicians use `/app/my-work`. Queries filter by tenant and current store scope before returning 25 records with stable cursors. People searches filter eligible roles and writable grants on the server before pagination. Detail, search and queues prefer the current assignment even when successive actions share a timestamp.

The new POST `/api/ops/work-orders/[id]/internal-dispatch` invokes the shared `changeInternalDispatch` command. Each action requires current identity/access, the rendered work-order version and assignment ID, and a command key. Assignment, primary task, version, audit, receipt and applicable notification commit together. Replay returns the stored assignment; a changed payload or stale action conflicts. Atomic access assertions protect membership/grant revocation between the precheck and commit.

Active visits, open quotes/approvals, parts/vendor blockers and unfinished inspections cannot be bypassed by replacing the assignment task. Inspections retain their specialized workflow; corrective repair work orders remain eligible for ordinary dispatch. Assignment changes preserve the existing next-action deadline, including overdue dates. There is no new repair completion target in P1.

Internal next-visit work requires a store, problem and review deadline; classification and costs are optional. It retains a manager review task, stays visible as held work, and supports audited “Not needed” cancellation. Vendor eligibility rejects internal work. Adding held internal jobs to an actual technician visit is P2.

Migration `0067_internal_dispatch` is additive in D1/SQLite and PostgreSQL. Named legacy internal assignments remain readable as person assignments. Provider-shape checks reject null or contradictory internal targets. Dispatch and inspection lookup indexes support the new bounded reads. The schema generators report no remaining changes against the saved snapshots.

The insert-only v16 seed enrichment adds five deterministic internal examples. The presentation remains exactly 15 fictional stores, five vendors and two technicians. No hosted reset, deployment, commit, push, live email delivery or paid provider setup was performed.

## Validation checkpoint

Final command results and counts are recorded in [ACCEPTANCE.md](ACCEPTANCE.md). Logs are retained locally under `.codex-runtime/dispatch-final-*.log`. Real PostgreSQL tests use an explicitly opted-in localhost test database and create/drop a separate database for each run; they do not migrate customer data. D1 tests run the actual Miniflare adapter and full migration chain.

Browser evidence used an isolated local PostgreSQL preview at `http://127.0.0.1:3035`, with independent in-app-browser manager and Chrome technician sessions:

- Facilities creates an unclassified job for Chris; Chris releases it to the pool; Maria takes and returns it; Chris assigns Devon directly. Reloaded dispatch and workspace search show Devon and the original deadline.
- A stale Maria claim after Devon's assignment receives a helpful conflict without changing ownership.
- Phone creation saves unclassified internal next-visit work. “Not needed” records Chris, time and cancellation reason, with no cost requirement.
- Dispatch renders at 1440 px and 390 px without horizontal overflow. Empty filtered personal work retains the Available team work link. Maria takes CPS-2026-0303 from that store-filtered phone view; My jobs and the manager queue both show her, with Chris still responsible and the original deadline preserved.

Screenshots: [desktop dispatch](../../outputs/internal-dispatch/p1-desktop-final.png), [phone dispatch](../../outputs/internal-dispatch/p1-phone-dispatch.jpg), [phone technician assignment](../../outputs/internal-dispatch/p1-phone-my-work.png), [phone cancellation history](../../outputs/internal-dispatch/p1-phone-not-needed.jpg), [vendor action page](../../outputs/internal-dispatch/p1-vendor-action.png). Final captures use the rebuilt preview; earlier full-page captures show the complete phone queue/cancellation path.

Compatibility spot checks cover the existing vendor directory/authorization, no-WO review, separate QR/store-device visit evidence, invoice balances/flags, PM numerator/denominator, human lifecycle decisions and the phone store-creation form. The locally regenerated BrightLine link for CPS-2026-0216 opens its public authorization and lists only that eligible job for the visit; internal CPS-2026-3202 at the same store is absent. No vendor response or visit was submitted.

Local review services: PostgreSQL 18.3 on port 55439, isolated database `dispatch_p1_test`; rebuilt preview on port 3035. Both are task-owned. The preview uses fictional role controls, not production authentication. No actual network-disconnect retry or fresh manual replay of all legacy workflows was claimed; see the acceptance checkpoint for specific evidence and limits.

To rerun the focused regressions in PowerShell from this worktree while the local test service is running:

```powershell
$env:OPS_DISPATCH_TEST_DATABASE_URL = 'postgresql://dispatch_test@127.0.0.1:55439/dispatch_p1_test'
npm exec vitest -- run tests/ops-internal-dispatch.test.ts tests/ops-internal-dispatch-sql.test.ts tests/ops-internal-dispatch-postgres.test.ts tests/ops-internal-dispatch-route.test.ts tests/ops-internal-dispatch-audit.test.ts
Remove-Item Env:OPS_DISPATCH_TEST_DATABASE_URL
```

Keep ordinary `DATABASE_URL` unset for test runs; the explicit test opt-in is separate from the preview backend. The five focused files contain 33 tests, including scale fixtures, API scope coverage and the nine F1–F3 cross-adapter regression cases.

## Focused Astra audit prompt

```text
Audit Phase P1 in the worktree and branch named above. Preserve the dirty planning documents and inspect new files as well as git diff. Read AGENTS.md, the persistent checklist, and the five original internal-dispatch plan files before reviewing.

Read P1_AUDIT.md and P1_CORRECTIONS.md. Independently reassess F1–F3 and the added endpoint, division-only access, creation-notification and rollback/retry coverage. Preserve the original audit as the dated review record.

Check internal-dispatch.ts, its API/context boundaries, commands.ts integration, fixture/SQL repository parity, migration 0067 and snapshots, notification delivery, held-work presenters, and the Dispatch/My work/detail forms. Use AT06–AT18 as the review contract. Validate current writable scope, role substitution, person/pool/manager distinctions, deadline preservation, concurrent claim vs reassignment/provider change, active visits and specialized inspection protections, idempotency, rollback, and current-assignment query projections. Inspect whether existing vendor/approval/result behavior remains compatible.

Separate findings from future-phase requirements. P2 outcomes/visitless completion and P3 scheduling are not shipped. Named crews, live routing, plans and recommendations are not implemented. The legacy assignWorkOrder command remains the provider/inspection compatibility path; assess its boundaries separately from the new generic dispatch API. Existing dueAt remains a primary-action projection.

Review the recorded command and browser evidence. Report actionable findings with severity and exact file/line references; identify any acceptance scenario that still needs a more specific browser or persistence test. Do not claim an independent audit happened before you perform it. Do not deploy, reset hosted data, commit or push.
```

P2 should start with the normalized result/confirmation contract and optional check-in path in ENGINEERING.md. Preserve P1 assignment receipts and current identity protections. P1–P3 together form the first complete dispatch release; P1 alone is not that release.
