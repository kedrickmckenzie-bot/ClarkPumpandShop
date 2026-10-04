# P1 audit corrections — October 3, 2026

This preserves the implementation response to [Astra's independent audit](P1_AUDIT.md) and its original F1–F3 correction evidence. Work remains uncommitted on `codex/internal-dispatch-p1` in the worktree recorded in [P1_HANDOFF.md](P1_HANDOFF.md). Existing local P2 work is preserved; the additional review corrections below are confined to P1.

## Additional review corrections — R1–R3

The subsequent review reproduced three P1 integration defects. Before application fixes, 21 new cases failed across fixture, actual Miniflare D1 and real PostgreSQL. `p1-review-red.log` preserves those failures. Further approval rollback, escalation and reapproval probes retain their original failing evidence in the ignored local runtime directory. No application fix preceded the main reproduction regressions.

- **R1 — required follow-up:** Return, claim and reassignment reject an open follow-up before replacing the primary task. The API gives a follow-up conflict. The follow-up, its task, accountable party, deadline, assignment, audit and outbox remain unchanged. Browser QA then found a queue mismatch: the list still advertised Ready to work and offered assignment changes. Three rendered-queue cases failed on all adapters (`p1-review-list-red.log`) before correction. Tenant-scoped fixture/SQL projections now expose the persisted open follow-up, and Dispatch/My work retain its next action and hide assignment controls. Existing organization/work indexes support the bounded read; no migration or P2 feature was added.
- **R2 — approval resumption:** Approval resumes the current internal person, pool or manager action instead of creating a vendor issuance obligation. It resolves current writable responsibility, retains the action deadline and queues the applicable targeted notice in the approval transaction. Pool work has no technician broadcast. Escalation stays in approval; a separate required follow-up remains open. Reapproval replaces only recognized internal assignment tasks. If a technician loses access, the old assignment becomes history and coordination must arrange work; an unavailable manager falls back to Facilities coordination. Commit-time recipient access assertions prevent partial approval after a concurrent revocation.
- **R3 — manager fallback:** Technician and pool forms no longer submit a hidden manager ID. The command retains an eligible owner or explicitly uses Facilities coordination. The form explains this fallback. Manager handoff still requires an explicit eligible manager; stale explicit selections are rejected.

The audit test file now has 54 cases, including 45 new regression cases, across the three adapters. The final correction/approval run passes 70 tests in 62.64 seconds (`p1-review-corrections-release.log`). It covers actual rendered fields, both queues and API responses, follow-up preservation, all three approved targets, fake provider delivery and stable retries, escalation, reapproval, rollback, access loss and current scope fallback. Each test isolates its pending outbox because the worker intentionally reads at most 100 messages.

### Final R1–R3 validation

All required checks passed on the final application source, including the queue correction. The commands ran sequentially; no assertions were weakened or timeouts extended. The eight intentional skips are fixture/D1 copies of four PostgreSQL-only race cases; the actual PostgreSQL cases ran.

| Check | Final result | Local log under `.codex-runtime/` |
|---|---|---|
| `npm run db:seed` | Pass: 15 fictional stores, five vendors, two technicians; separate 65-store fixture | `p1-review-release-seed.log` |
| `npm run typecheck` | Pass | `p1-review-release-typecheck.log` |
| `npm run lint` | Pass | `p1-review-release-lint.log` |
| `npm test -- --maxWorkers=2` | 205 files / 1,335 tests passed / eight intentional skips; 476.05 seconds | `p1-review-release-unit.log` |
| `npm run test:e2e -- --maxWorkers=1` | Four files / 66 workflow tests passed; 128.72 seconds | `p1-review-release-workflow.log` |
| `npm run build` | Sites/Vinext build passed | `p1-review-release-build-sites.log` |
| `npm run build:render` | Next/Render build passed | `p1-review-release-build-render.log` |
| Focused audit and approval files | 70 passed; 62.64 seconds; fixture, native D1 and real PostgreSQL | `p1-review-corrections-release.log` |

`p1-review-release-checks.json` records exit codes and command timings. The retained localhost QA database was not reset. Automated database tests create their own isolated databases, and fake transports exercise delivery without sending email.

### Three browser journeys

The rebuilt application uses the retained local PostgreSQL database on port 3035 with independent manager/technician sessions, at 1440 × 900 and 390 × 844.

1. **Required follow-up (CPS-2026-3207):** Manager and technician detail retain “Confirm safe access before work continues,” Facilities coordination and the original October 4 deadline. Dispatch and My work show that action and omit assignment/return controls. The API regression separately reproduces a rejected bypass; browser QA does not claim to have submitted an absent control. [Desktop queue](../../outputs/internal-dispatch/p1-review-followup-queue-desktop.png) and [phone queue](../../outputs/internal-dispatch/p1-review-followup-queue-phone.png).
2. **Approval (CPS-2026-3208–3210):** Jordan records the three approval decisions through the existing form. Person work resumes Begin internal work for Maria; pool work resumes Arrange team pickup for Chris; manager handoff resumes Arrange internal work for Chris. Original October 4 deadlines remain. Persisted outbox evidence contains one resumed notice to Maria, one to Chris for the manager handoff and no pool broadcast. The existing phone job view shows approved person work as ready. [Person on phone](../../outputs/internal-dispatch/p1-review-approved-phone.png), [pool](../../outputs/internal-dispatch/p1-review-approved-pool.png), [manager](../../outputs/internal-dispatch/p1-review-approved-manager.png).
3. **Unavailable responsible manager (CPS-2026-3211–3212):** Temporarily change fictional Chris's local grants to read-only. The visible form explains coordination fallback, and DOM inspection confirms no hidden `managerId` input. The phone person submission assigns Devon Price; the desktop pool submission returns work to the team. Both save and reload with Facilities coordination as durable owner and their original October 6 deadlines. Chris's original grants are restored after QA. [Phone person fallback](../../outputs/internal-dispatch/p1-review-fallback-person-phone.png) and [team fallback](../../outputs/internal-dispatch/p1-review-fallback-pool.png).

`p1-review-browser-final-evidence.log` records the six persisted work states, tasks, follow-up, targeted outbox payloads and exactly 15 stores. The phone queue and forms fit within the 390px viewport without page overflow. Screenshots are ignored local review artifacts.

Compatibility spotchecks opened exact manager search → filtered source records; the 15-store phone list and unsaved store-creation form; SUM-104-2607's linked/unmatched amounts, review flag and presence-versus-labor text; PM's 92/99 ended-window denominator and missed source occurrence; lifecycle source costs/issues and human decision controls; the existing cross-channel vendor visit; no-WO entry; and the retained BrightLine handoff's immutable sent authorization. No sixteenth store was created. A fresh public vendor action, trusted-device transition, deliberate network disconnect and every legacy browser variant were not manually replayed in this pass; existing automated regressions and earlier recorded browser evidence remain available.

### Independent reassessment instructions

Confirm the worktree and `codex/internal-dispatch-p1` branch before reviewing. Review staged, unstaged and untracked changes, using this R1–R3 checkpoint, [P1_HANDOFF.md](P1_HANDOFF.md) and [ACCEPTANCE.md](ACCEPTANCE.md). Focus on required-follow-up protection in commands/queues, current internal accountability after approval, atomic targeted notices and access-loss rollback, and actual form submissions without hidden manager IDs. Preserve existing local P2 work and do not treat its separate acceptance as part of this P1 correction. Report concrete defects with reproductions and file/line references. Do not edit, commit, push, deploy or send messages. IDP-01 remains open pending this independent reassessment.

No further P2 features, hosted reset, live delivery, deployment, commit or push occurred. The F1–F3 evidence below is historical and remains intact.

## Corrections

- **F1:** `placeWorkOrderOnVisitHold` rejects the canonical inspection work order before writing a hold, task, deadline, audit or outbox event. The hold presenter excludes that inspection from the control. Creating inspection service work with a future-visit hold is also rejected. Separate corrective repair work keeps ordinary assignment and hold eligibility.
- **F2:** Dispatch identity and durable responsibility use the same tenant/division/region/store coverage helper. Named owners require an active membership, active user and writable grant; an invalid person falls back to the coordination team without retaining that person's name. Fixture and SQL notification lookups derive division/region coverage from the tenant-owned store. Dispatch delivery still revalidates current writable access, so read-only, revoked and obsolete notices do not bypass authorization.
- **F3:** Initial technician assignments and manager handoffs insert the dispatch notification in the creation transaction through the same builder as later assignment changes. Ordinary pool work has no technician broadcast. Unapproved work retains its approval obligation and receives no ready-to-work assignment notice. Inspection issuance retains its specialized delivery path. Creation retries preserve one work order/event; transaction failure rolls back the notification and receipt with the work.

## Regression coverage

`tests/ops-internal-dispatch-audit.test.ts` runs three shared cases on fixture, actual Miniflare D1 and real PostgreSQL, for nine cases total:

1. Invoke the actual hold and dispatch endpoints for `showcase-work-walk-101`. Both reject the transition, preserving work-order detail/history, inspection, tasks, deadline and outbox. Link separate corrective repair work to that inspection and verify assignment/hold remain available.
2. Use division-only manager/technician grants through creation, claim, urgent return and reassignment. Verify the manager is preserved and fake delivery reaches the intended person. Read-only manager access and revoked technician coverage reject commands/delivery; obsolete return messages are suppressed.
3. Create a named technician assignment, manager handoff, legacy named assignment, plain pool work and approval-pending work. Verify applicable notices and fake delivery, same-key creation replay, stable provider retry keys, and injected transaction rollback without an orphan notification or receipt.

The earlier dispatch rollback/retry tests now distinguish initial-assignment notices from later-change notices while retaining their exact one-event/no-extra-event assertions.

## Validation checkpoint

All required commands passed on the corrected application source. Tests and builds ran sequentially. No test timeouts were extended or failure assertions relaxed.

| Check | Result | Local log under `.codex-runtime/` |
|---|---|---|
| `npm run db:seed` | 15 fictional stores, five vendors, two technicians; separate 65-store fixture | `p1-corrections-seed.log` |
| `npm run typecheck` | Pass, including final regression assertions | `p1-corrections-typecheck.log` |
| `npm run lint` | Pass, including final regression assertions | `p1-corrections-lint.log` |
| `npm test -- --maxWorkers=2` | 203 files / 1,268 tests passed, with real PostgreSQL dispatch coverage | `p1-corrections-unit.log` |
| `npm run test:e2e` | Four files / 66 tests passed | `p1-corrections-e2e.log` |
| `npm run build` | Sites/Vinext build passed | `p1-corrections-sites-build.log` |
| `npm run build:render` | Next/Render build passed | `p1-corrections-render-build.log` |
| Five focused dispatch files | 33 tests passed, including nine new cross-adapter cases | `p1-corrections-focused.log` |

After the full suite, the same nine audit cases gained explicit assertions for inspection creation with a hold, legacy-assignment fake delivery, and absence of an orphan work order after creation rollback. The final five-file rerun, typecheck and lint passed on those strengthened assertions. Application source did not change after the full run/builds.

Browser checks used the rebuilt PostgreSQL preview at `http://127.0.0.1:3035`, with fictional Chris Delgado / Maria Santos roles:

- Inspection CPS-2026-3100 still requires **Complete inspection and return paperwork**, retains Cameron Blake and its October 9 deadline, and directs assignment changes to the inspection. Its service page has no future-visit hold control. Checked at 1440 px and 390 px.
- Chris created unclassified CPS-2026-3204 for Store 101 on the 390 px form and directly assigned Maria, without equipment, cost or a hold. Reload preserved Maria, the coordination owner and the original action deadline. Maria's phone My work list shows the same job and obligation. The creation/detail/technician pages fit without document overflow (390 px viewport; 375 px document).
- A read-only query of the isolated PostgreSQL database confirms one `ops.internal_dispatch.notification` alongside the creation/assignment audit outbox events, addressed only to Maria's membership and linked to the persisted assignment. That preview notice remains pending; no real email was sent. Query evidence is retained in `p1-corrections-browser-persistence.log`.

Screenshots: [inspection service](../../outputs/internal-dispatch/p1-corrections-inspection.png), [phone direct assignment](../../outputs/internal-dispatch/p1-corrections-direct-phone.png), [desktop direct assignment](../../outputs/internal-dispatch/p1-corrections-direct-desktop.png), [Maria's phone work list](../../outputs/internal-dispatch/p1-corrections-my-work.png). Temporary viewport overrides were reset; the retained preview returns to the manager role.

The unaffected broad vendor/invoice/PM/lifecycle journeys retain the earlier named browser spot checks in the handoff and passed their current full-suite/workflow regressions. They were not all manually replayed during this bounded correction.

Static checks passed: `git diff --check`, whitespace checks on all 30 new files, 32 resolving local packet links, and 88 unique acceptance scenario definitions. The original checkout remains on `codex/platform-rebuild` with only its pre-existing untracked `dev4.log`.

Local PostgreSQL uses the guarded disposable `dispatch_*test` harness at port 55439. Actual production identity, a dropped-network browser simulation and live email delivery remain outside this checkpoint. No hosted reset, deployment, commit or push occurred.

## Astra reassessment

Review F1–F3 against this correction record and the current working changes, including new files. Independently rerun the five focused dispatch files listed in the handoff and recheck the affected browser controls. Report any remaining concrete defect with severity, reproduction and exact file/line references. Separate future-phase requirements from P1 defects. Do not modify, commit, push, deploy or reset hosted data. P1 is awaiting this independent reassessment before P2.
