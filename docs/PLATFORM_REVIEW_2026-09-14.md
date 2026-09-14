# Platform review — September 14, 2026

Reviewed commit: `6330d5e`. Scope: current repository, local fixture runtime, browser walkthrough, required checks, and comparison with the approved rebuild blueprint. Older conversations were not used as evidence. This is a review, not an implementation or deployment.

Implementation status now lives in [the persistent pass checklist](PLATFORM_IMPROVEMENT_PASSES.md). Findings below remain the dated baseline; consult that checklist for fixes and subsequent validation.

## Assessment

The platform is a substantial connected working demo with a credible service domain. It has a coherent six-destination shell, useful search, work-order accountability, vendor authorization, visit evidence, invoice/warranty review, PM, and repair/replacement history. Another wholesale restart would discard useful work.

It is not ready for real customer operations. There are reproducible correctness defects, preview identity is still the identity boundary, and several important reads still assemble the entire tenant. The next phase should stabilize the existing service chain and make manager summaries trustworthy before adding more modules.

## Verified defects, in priority order

### 1. P1 — API requests lose the selected preview role and location scope

The role switch sets `ops-preview-role` with `Path=/app`. Browser requests to `/api/ops/...` do not send that cookie. `loadOperatorSession()` then defaults to facilities when there is no environment override. The server therefore handles a different role and scope from the page the user sees.

Read-only local reproduction:

- Set the preview role to `store_manager`: HTTP 303; the cookie container sends the cookie to `/app/overview` and none to `/api/ops/accounting/review-options`.
- The accounting endpoint returns 404 for the deliberately absent source with automatic cookie handling, versus 403 when the store-manager cookie is explicitly supplied. The first request passed the role gate.
- `/api/ops/trends/export` with no cookie returns HTTP 200 and CSV scope **Companywide**. With an explicit store-manager cookie, the same endpoint returns HTTP 200 and scope **Store 104**.

This affects exports, role-specific mutation rules, and actor attribution. It is a current preview correctness defect as well as a reason the preview cannot protect real data. The current role-cookie test explicitly expects the wrong path.

Sources: `app/api/ops/preview-role/route.ts:48–56`; `app/app/_data/operator-loader.ts:86–143`; `lib/server/ops-request-context.ts:38–55`; `tests/ops-preview-role-route.test.ts:37`. The edition cookie has the same path configuration.

Acceptance: page, form submission, export, and audit actor use the same selected identity/scope; a Store 104 preview cannot export companywide sources or exercise facilities-only commands through ordinary requests. Add a real HTTP/browser cookie round trip, not just a mocked session test. Production membership resolution remains a separate required implementation.

### 2. P1 — inspected held work retains an obsolete next action

The existing test `moves look-and-report findings to manager review instead of pretending the repair was completed` fails in both the full suite and an isolated single-worker rerun.

After checkout with `diagnosis_only`, the hold correctly becomes `review_required`, but the work order remains:

- Accountable party: **Facilities coordinator**.
- Next action: **Approved for a future vendor visit**.

Expected: **Jordan Lee**, **Review the onsite findings and choose the next step**.

The command writes the intended review projection, then projects the open task set again. Check-in's target-task selection excludes the existing held-work provider-choice task; an obsolete obligation can remain eligible to win the primary projection. The date-sensitive ordering matters because the seeded hold deadline has now passed.

Sources: `tests/ops-held-work.test.ts:185–210`; `lib/ops/commands.ts:1970–1994` and `2270–2320`; `lib/ops/workflow-task-commands.ts:270–297`.

Acceptance: check-in and checkout retire the applicable previous obligation, preserve unrelated legitimate tasks, and leave the manager review as the correct next step. Verify both before and after the hold deadline, including a database-adapter regression. The reproduced failure is on the fixture adapter; a failing persisted-adapter journey was not established in this review.

### 3. P2 — dashboard drill-through and labels do not consistently describe their sources

Browser reproduction: **New requests — 5 / Waiting for review** opens `/app/requests`, which shows **100 source records**, including converted and closed reports. The count is for submitted/under-review requests; the destination omits that filter.

The **Awaiting vendor response — 18** metric also includes approved work that has not been sent. The overview separately shows 14 records as **Ready to send**. This can misdirect accountability toward the vendor when an operator action is still required.

Sources: `app/app/_data/operator-presenter.ts:1150–1158`, `1224–1238`, `1471–1473`, and `1684`.

Acceptance: each metric and its destination share an exact cohort definition. Split unsent authorizations from actual outstanding vendor responses, and preserve the source filters in the destination. Test count/record-ID equality, not only that the link resolves.

### 4. P2 — equipment spending changes meaning across a drill-through

The overview's Store 115 beer-cave spotlight says **Spent · 12 months — $0**. Its linked repair/replacement history shows **$440** of recorded cost in the 12-month equipment scope.

Both amounts derive from records, but they measure different cohorts without saying so. The spotlight uses reactive work only. The history includes two planned-service cost lines of $220, dated November 19, 2025 and February 17, 2026. The spotlight label does not disclose that exclusion.

The same helper's cost filter has a lower date bound without an upper as-of bound; that should also be corrected before mixing new mutations with the fixed demo reporting date.

Sources: `app/app/_data/operator-presenter.ts:975–1000` and `1446–1458`; browser comparison of the overview spotlight with `/app/lifecycle?asset=asset-115-beer-cave&decision=asset-115-beer-cave&work=wo-northline-115&view=review`.

Acceptance: use the same cost basis/cohort/window, or explicitly label reactive-only cost and preserve that selection in the destination. Every displayed amount must explain the included source lines and as-of boundary.

### 5. P2 — basic creation requires more than the page promises

The creation page repeatedly says store and problem are the only required facts. Supplying those two fields and choosing **Create only** is blocked by native validation for priority and service path, neither of which has an initial selection in the complete package. The API also requires both values.

The internal-assignee helper says it can be assigned after creation, while the API rejects an internal route without an assignee.

Sources: `components/ops/forms.tsx:143–193`; `app/api/ops/work-orders/route.ts:40–49` and the internal-assignee validation near `94–99`.

Acceptance: provide a valid low-friction default such as routine/choose-later where appropriate, and align the displayed requirements with the command contract. If internal assignment is genuinely required, say so at the point of selection.

### 6. P2 — the phone home layout compresses critical explanatory text

In the narrow browser viewport, the Store 104 home header **Your store workflow** shares a flex row with the unwrappable **Open complete store record** link. The description is squeezed into a narrow column, often one or two words per line, producing a tall section before the useful work rows.

Observed document width was 375 CSS pixels; the browser capability had been requested at 390 × 844. There was no document-wide horizontal overflow in this sample. A lack of overflow therefore does not establish a usable layout.

Sources: `components/workspace/control-tower.module.css:126–154`; its phone breakpoint does not stack `.sectionHeader`. Browser screenshot inspection of Store 104's manager home.

Acceptance: stack section titles/descriptions and links on phones, and visually inspect the resulting first-screen hierarchy. Validate at actual 375/390 widths, not just with overflow assertions.

## Product experience

**What is working:** the neutral/slate/cobalt shell and six primary destinations are coherent. Search for 104 returned 81 matches across five types, with bounded previews and useful independent store, cost, work, and equipment links. The work-order case showed a named internal owner, next action, deadline, escalation destination, original report, and related evidence. The sampled invoice correctly separated its warranty flag from deductions, linked the diagnosis case, and withheld financial decisions from facilities. PM offers exact occurrence/status links. The replacement page clearly separates repair price, approved replacement, planning estimate, quote inclusions/exclusions, and historical cost.

**What needs editorial work:** the work-order overview repeats state and evidence across its summary, nine-stage rail, independent-state cards, evidence map, origin panel, and history. Useful facts exist, but a manager has to scan too much repetition. Keep a single dominant state/next-action header and a short evidence summary, with the existing tabs carrying the detail.

The facilities overview currently suppresses its detailed attention section through `prioritySection.display = "summary"`. It gives a count and a queue link, but omits the owner/next-action rows from the home surface. Relative to the blueprint's Control Tower, immediate responsibilities, critical work, PM exceptions, and high-impact store outliers need more prominence. Treat this as a product-design recommendation, not an assertion that the underlying queues are missing.

## Production gates that remain

1. **Real identity and tenant membership.** Session construction always selects a fixed fictional organization and role persona. ChatGPT identity supplies display information but does not resolve the selected membership from that authenticated user. An absent identity still receives the demo fallback. Keep this isolated to fictional preview data until an authenticated membership boundary replaces it.
2. **Bounded reads for the complete platform.** Search and several lists use repository queries, but dashboard, record, and program loaders still call `sessionAndFixture()`. D1/PostgreSQL snapshots are organization-filtered, then broad data is processed for the presenter. This is not evidence of a cross-tenant database read; it is a remaining scale and least-privilege architecture gap. `operator-presenter.ts` is now 6,827 lines.
3. **Native persistence boundaries and retirement of old stacks.** PostgreSQL still translates SQL emitted through the D1-shaped implementation. Parallel `components/cstore`, `lib/cstore`, `lib/demo`, `lib/domain`, and root UI stacks remain in the repository. Their presence is confirmed; this review did not establish that every file is unreachable. Retire only after an import/reachability audit.
4. **Delivery and recovery proof.** Resend integration, notification workers, PM recurrence, and other operational code now exist, so older “not implemented” statements are stale. No external message was sent or provider configuration validated here. Service-authorization email is attempted after issuance in the interactive request, and its delivery audit is a separate write; crash/retry recovery for that path requires proof. Restore, rollback, alert routing, and real backend latency/load evidence were not established.
5. **Browser acceptance automation.** `test:e2e` is a Vitest server/domain/database suite, not a browser journey. It is useful coverage, but cannot prove native cookie behavior, form validation, responsive layout, or completed browser workflows.

Primary architecture sources: `app/app/_data/operator-loader.ts`, `app/app/_data/request-data.ts`, `lib/server/ops-repository-provider.ts`, `lib/ops/d1-snapshot.ts`, `lib/ops/postgres-repository.ts`, `lib/server/work-order-issuance.ts`, and `package.json`.

## Verification performed

| Check | Result |
|---|---|
| `npm run db:seed` | Pass: 15 stores, three regions, five vendors, two internal technicians; 100 requests, 422 work orders, 399 visits, 144 assets, 222 PM occurrences; separate 65-store fixture validated. |
| `npm run typecheck` | Pass. |
| `npm run lint` | Pass. |
| `npm test` | Fail: 127 files passed / 3 failed; 876 tests passed / 3 failed out of 879. One assertion failure and two timeouts. |
| `npm run test:e2e` | Pass: 4 files / 49 tests, including the previously timed-out trusted-store boundary case. |
| Isolated rerun: held work + public multi-work visit, one worker | 13 passed / 1 failed. Public multi-work checkout passed; the held-work assertion failed again. |
| `npm run build` | Pass. |
| `npm run build:render` | Pass: Next.js production build completed, including TypeScript and route generation. |
| `npm run test:routes -- http://localhost:3000` | Pass: 144 sampled routes, no HTTP/rendered-server errors. Local development timings are not a production benchmark. |
| Read-only HTTP role/export probes | Confirmed page/API cookie-path mismatch and companywide versus Store 104 export scope. |

The full test run overlapped other local checks and server startup, so the two timeouts are not presented as confirmed product defects. The separate successful runs do not make the original `npm test` result green.

Browser inspection covered facilities overview, metric drill-through, global search, work-order case, deferred/outside routing form, store record/creation form, store-manager scope and permission state, public vendor authorization, no-WO visit selection and crew step, invoice/warranty evidence, PM, and lifecycle. Phone inspection sampled the store record and manager home. No service/work/store creation, vendor response, check-in, or checkout mutation was completed in the browser. The final visit control remained disabled pending a location attempt under the enabled demo policy; no device location permission was requested. Cross-channel mutation behavior was checked by the server/database suite, not demonstrated end to end in the browser.

No hosted deployment, real PostgreSQL service, external delivery, R2/S3 upload, recovery drill, or multi-user 65-store load test was performed. The separate scale fixture proves structural fixture behavior, not production throughput.

## Recommended sequence

1. Fix the role-cookie boundary and held-work transition; make their regression tests pass through realistic request/task lifecycles.
2. Reconcile dashboard counts, labels, links, and cost cohorts. Include the Store 115 $0/$440 example and exact pending-request drill-through in acceptance tests.
3. Simplify the work-order summary and facilities home; correct basic creation and phone layout inconsistencies.
4. Establish real identity and membership, then replace full snapshots with bounded feature queries and aggregates. Retain the existing service domain and evidence semantics.
5. Complete delivery/recovery/load/browser acceptance gates before admitting real customer operations.

Update README/demo/status documentation alongside these slices. Current README/demo fixture counts and several architecture/status claims lag the implementation. This dated review records the observed state without treating historical completion notes as current proof.
