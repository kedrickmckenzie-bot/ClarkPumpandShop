# Platform improvement passes

This is the persistent execution checklist for the September 14, 2026 review. Read it at the start of platform work and update it before ending a session. The approved rebuild blueprint remains the product authority; [the dated review](PLATFORM_REVIEW_2026-09-14.md) records the original evidence. Older completion notes are not proof of current behavior.

## Checkpoint

- Completed passes: **1 — role/scope and accountability correctness** and **2 — trustworthy metrics and drill-through** (10 acceptance items).
- Next product pass: **3 — manager and store workflow usability**. **11 of 40 items complete; 29 remain**. No later pass is complete.
- Completed exception: **P6-08 — populated D1 upgrade repair**, pulled forward after the first private publication failed; the repaired publication succeeded. All original item IDs remain unchanged.
- Completion means acceptance evidence is recorded below, not merely that code was edited.
- Deployment and real-customer readiness are separate gates. Fictional preview controls are not production authentication.

## How to execute and remember

**Standing acceptance rule for every pass:** user experience and interface polish come first. Use short, plain words, obvious next actions, sensible defaults, and clean desktop/phone layouts. Remove long explanatory boxes and repeated instructions. Validate the affected journey visually as well as testing its behavior. A correct calculation behind confusing UI is unfinished work.

Keep the IDs below stable. Mark items `[x]` only after their acceptance checks pass; leave partial items unchecked with an explicit note. Append discoveries instead of silently expanding or dropping an item. After each pass record changes, checks, unresolved failures and the next starting point. On resume, inspect the working tree and this checkpoint before changing code. Never infer that an unchecked later pass was completed by an earlier one.

The order groups shared data models, UI surfaces and validation to avoid repeatedly changing the same code. Passes 1–3 stabilize behavior before architectural extraction. Pass 4 establishes production boundaries before pass 5 changes query paths. Pass 6 covers infrastructure-dependent proof. Pass 7 is the final cross-platform acceptance gate. Update documentation during every pass, not just at the end.

## Pass 1 — role/scope and accountability correctness

- [x] P1-01 Fix preview role **and edition** cookies for page/API parity; migrate old path-scoped cookies. Prove an ordinary cookie round trip keeps Store 104 scope on exports and rejects facilities-only actions.
- [x] P1-02 Retire the applicable held-work provider obligation when a vendor starts service. Diagnosis checkout must identify the manager and findings-review action before and after the hold deadline; preserve unrelated legitimate tasks. Cover fixture and persisted SQL adapters.
- [x] P1-03 Audit the other held-work entry points (adding work to an active visit, confirmed-visit pickup and service-run paths) for the same obsolete-task projection. Cover applicable paths without duplicating or erasing source evidence.
- [x] P1-04 Verify page identity, mutation actor attribution, permissions and audit actor remain consistent; retain the explicit fictional-preview boundary.

## Pass 2 — trustworthy metrics and drill-through

- [x] P2-01 Make pending-request count and destination share submitted/under-review IDs, including search, scope and pagination. The five pending requests must not link to all 100 reports.
- [x] P2-02 Separate work ready to issue from work awaiting a vendor response; share cohort definitions between counts, labels and queue filters.
- [x] P2-03 Reconcile equipment spotlight spending with its destination. Preserve cost basis, planned/reactive cohort and reporting window; include upper as-of bounds. Regress the Store 115 $0/$440 example.
- [x] P2-04 Inventory every principal dashboard metric, segment, exception and outlier. Test exact supporting IDs/counts and preservation of scope, period, taxonomy, cost basis, cohort and classification coverage; make omitted segments explicit.
- [x] P2-05 Verify onsite labels distinguish active visits from distinct vendors. Verify invoice counts distinguish invoice records, references and allocated/unmatched amounts without double counting.
- [x] P2-06 Verify PM numerator/denominator/window/source occurrences and lifecycle rules are transparent; no inferred downtime or automatic replacement/payment decisions.

## Pass 3 — manager and store workflow usability

- [ ] P3-01 Make store and problem sufficient for basic work creation with valid default priority and choose-later routing in UI and API. Preserve deferred category/asset/component classification.
- [ ] P3-02 Align internal-assignment instructions with the actual command requirements. Test internal, outside and blended fulfillment, vendor search and issue/reissue references.
- [ ] P3-03 Stack phone section headings, descriptions and actions; visually verify actual 375/390 px layouts, readable text and touch controls on store and public visit views.
- [ ] P3-04 Consolidate the work-order case into one dominant accountable state/owner/action/due/escalation header and concise evidence summary; preserve detailed source facts in appropriate tabs.
- [ ] P3-05 Restore useful attention rows on the facilities home and prioritize immediate responsibilities, critical work, PM exceptions and store outliers. Validate manager roles and the six-destination navigation contract.
- [ ] P3-06 Audit loading, empty, error, partial and permission states, labels, visible scope, keyboard/form behavior and every primary action. No dead controls or misleading optional/required instructions.
- [ ] P3-07 Complete store creation, no-WO visit reconciliation and cross-channel visit journeys. Verify a reconciliation failure has atomic behavior or explicit recoverable state without losing/duplicating either record.

## Pass 4 — production identity and domain safeguards

- [ ] P4-01 Resolve authenticated users to active organization memberships; isolate preview personas and fail closed outside the fictional preview. Verify missing identity, revoked membership and multiple organizations.
- [ ] P4-02 Verify organization-first access on every read, command, search, aggregate, export, private file, public token and job; add cross-tenant and cross-store adversarial tests.
- [ ] P4-03 Verify all channels use shared commands with transactional audit, idempotent retries and optimistic concurrency. Test append-only amendments for reports, issuance, responses, visits, costs, allocations and deadlines.
- [ ] P4-04 Verify purpose-bound, expiring, hashed action tokens and vendor-eligible work selection; no-WO service remains possible and location remains check-in/out only with explicit evidence status.

## Pass 5 — bounded reads and maintainable persistence

- [ ] P5-01 Inventory remaining snapshot consumers; replace dashboard snapshots with scoped repository aggregates and source queries with stable pagination and indexed ordering.
- [ ] P5-02 Replace record/program/lifecycle full snapshots with bounded feature queries. Prove scoped callers do not fetch the whole tenant and drill-through remains exact.
- [ ] P5-03 Extract feature presenters and command modules along domain boundaries while preserving shared commands and all evidence semantics; avoid introducing parallel application stacks.
- [ ] P5-04 Replace PostgreSQL dependence on D1 SQL translation with a provider-neutral repository boundary and native queries; retain D1/R2 adapters and migration parity during the active hosted preview.
- [ ] P5-05 Audit imports/routes before retiring legacy cstore/demo/domain/root stacks. Delete only proven unused code and verify routes/builds afterward.
- [ ] P5-06 Verify production import, stable store IDs/numbers/addresses/aliases, optional operating hierarchy and independent taxonomy. Keep the presentation at exactly 15 stores/five vendors; validate one-store and 65-store fixtures separately.

## Pass 6 — delivery, operations and deployment proof

- [ ] P6-01 Make issuance delivery durable and retryable across crashes between issuance, provider delivery and audit. Preserve immutable revisions and secure token handling; prove no duplicate authorization or misleading delivered status.
- [ ] P6-02 Verify PM recurrence, SLA/outbox/compliance workers are idempotent, observable and recoverable. Exercise provider failures and retry exhaustion; external delivery requires configured infrastructure and authorized recipients.
- [ ] P6-03 Verify private evidence uploads/downloads, tenant/file permissions, retention and S3-compatible storage portability; do not use ephemeral production disk.
- [ ] P6-04 Validate real PostgreSQL migrations, DATABASE_URL, injected PORT, health checks and worker entry points. Create no Render project/manifest until intentionally authorized.
- [ ] P6-05 Run backup/restore, rollback and alert-routing drills with recorded outcomes. Prove agreed recovery targets (review references RPO ≤1 hour/RTO ≤4 hours) on actual infrastructure.
- [ ] P6-06 Measure real-backend multi-user 65-store query latency, concurrency and failure recovery; fixture size and local development timings are not throughput proof.
- [ ] P6-07 Prepare an exact validated hosted version and verify its access policy before publication. Record deployment status separately from local validation and production readiness.
- [x] P6-08 Repair the populated D1 migration failure discovered during Pass 1 publication. Preserve visit-work rows and their verification records under enforced foreign keys, verify an upgrade with existing data, and confirm the private publication succeeds without resetting the tenant.

## Pass 7 — acceptance, documentation and release decision

- [ ] P7-01 Add repeatable real-browser coverage for role-cookie round trips, native form validation, metric destinations and mobile layout. Clearly distinguish this from the existing Vitest `test:e2e` suite.
- [ ] P7-02 Run all required commands sequentially enough to avoid resource-contention false failures: db:seed, typecheck, lint, npm test, test:e2e and build. Record failures accurately; also run build:render when portability changes.
- [ ] P7-03 Complete the required browser matrix: manager search/drill-down; store creation; deferred/internal/outside work routing; vendor action link; cross-channel visit; no-WO exception; invoice safeguards; PM/lifecycle; responsive store/mobile. Record which journeys actually mutated data and which were inspection only.
- [ ] P7-04 Reconcile README/demo/status docs with verified implementation and deterministic seed counts. Keep historical reviews dated, centralize current status and verify all temporary branding uses configuration.
- [ ] P7-05 Review every remaining unchecked item and external dependency before declaring release readiness. No principal metric or primary workflow may end at a dead control; no production claim without production evidence.

## Evidence log

### Baseline — September 14, 2026

Review at commit `6330d5e`: seed/typecheck/lint/e2e/build/Render build passed; 144 sampled routes passed. Full test run: 876 passed/3 failed (one reproducible held-work assertion, two timeouts under overlapping workload). Isolated rerun retained the held-work failure. Browser findings and inspection limitations are recorded in the linked review. Existing untracked `dev4.log` is unrelated and must be preserved.

### Pass 1 — complete, September 14, 2026

Implemented shared root-path preview cookies with explicit expiration of the older `/app` cookie on role/package selection. Existing open preview sessions should apply their role/package once after the update to migrate the older cookie. This fixes preview consistency; production identity remains P4-01.

Held-work check-in and active-visit pickup now replace only a relevant service-preparation obligation. Unrelated tasks remain open, including a higher-priority blocking obligation. The original named-manager diagnosis case is tested on both September 1 and September 14 (before/after the September 12 deadline). Additional shared regressions exercise fixture and embedded PostgreSQL transactions, QR-to-secure-link checkout, and work added during a visit. Combined store visits retain the appropriate task projection and held-work provenance.

Evidence so far:

- `npm test`: **131 files / 890 tests passed**, normal configured worker count, 162.91 seconds. The original held-work failure and both baseline timeout cases pass in this full run.
- Seed: **15 stores, 3 regions, 5 vendors, 2 internal technicians, 100 requests, 422 work orders, 399 visits, 144 assets, 222 PM occurrences**; separate 65-store fixture validated.
- Real HTTP cookie-container test preloaded the old facilities/accountability `/app` cookies, then selected store-manager/complete. Page and API headers both contained only the new selections. Export returned **Store 104**; facilities-only accounting endpoint returned **403**. This did not manually inject the role header into the API requests.
- Session/command regression uses the actual session loader and API command with fixture persistence: selected regional membership is the audit actor; Store 104 scope and facilities-only restrictions are enforced.
- Browser: switched facilities → store manager, observed Store 104 scope and denied work creation under its configured permissions; switched back to facilities and observed the creation form. Manager search for 104 still returned 81 matches across five types. No browser-created service/store/work record and no location permission request.
- README fixture counts and status links updated. The dated review remains historical evidence.

Final typecheck, lint and build passed; `test:e2e` passed **4 files / 52 tests**. All six required commands passed for this pass. Private-preview publication succeeded after the populated-upgrade repair described below. The full browser mutation matrix remains P7-03; domain/database journeys do not substitute for it.

### Pass 1 handoff — historical starting point for Pass 2

Work together on `operator-presenter.ts` dashboard cohorts, `operator-query-presenter.ts` filter labels, loader query normalization and repository filter implementations. Pending requests need a combined submitted/under-review filter carried into query-first lists. Vendor-response stages must use the same source predicate across shared/store/regional/facilities dashboards and both list paths. Inspect all occurrences of onsite-vendor labels, including store summaries. Reconcile the lifecycle spotlight with the exact cost/history destination before changing its label. Add record-ID equality assertions across presentation and repository queries, not only URL/string assertions.

### Publication repair — P6-08, complete

Private version 28 from commit `f076dc08cba4b43b81d49d71be7886ab8e8c151e` failed with `FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)`. Site: `appgprj_6a733d7dbb708191a9b80f3f9424582a`; version: `appgprj_6a733d7dbb708191a9b80f3f9424582a~appgver_3e74728869f88191b5b0e5ff58bc6e80`; deployment: `appgdep_6aa8673ca87c8191b0b7edbd8c0c5a1e`. Recent worker logs contained no additional errors.

The new populated migration regression reproduced that error at `0039_uneven_morph.sql`: existing work verifications reference the visit-work table being rebuilt. Empty-chain and work-order-only upgrade tests missed it. The repair preserves verification rows in a transaction-local staging table, rebuilds visit-work and its indexes, restores the original verification schema/indexes and all records, then removes staging. Foreign keys stay enabled. The populated regression now passes and checks record preservation and foreign-key integrity after each remaining migration. The populated migration tests, typecheck and lint passed after the repair. Application source is unchanged from the fully validated Pass 1 build; the deployment archive will be repackaged with the repaired migration. Private version 29 subsequently published successfully; see the final checkpoint below.

### Pass 1 final checkpoint — September 14, 2026

- **5 of 40 items complete:** P1-01 through P1-04 and P6-08. **35 remain.** Resume at Pass 2; do not skip later architectural or production-readiness gates.
- Private version **29** published successfully at **2026-09-14 21:40:30 UTC**: https://clarks-operations-demo.kedrick-mckenzie.chatgpt.site . Access remained owner-only; no sharing policy was expanded.
- Published application/migration source: `b5697ab50105cd9646be74d0f09c22de7345d6c1`. Version: `appgprj_6a733d7dbb708191a9b80f3f9424582a~appgver_c5e61f0b8e80819180bb723dea91d4d3`. Deployment: `appgdep_6aa869babddc8191aa3192afb0a018fe`.
- All six required checks passed for Pass 1: seed, typecheck, lint, full suite (890 tests), e2e (52 tests), build. After the migration-only repair, the expanded migration-chain tests, typecheck and lint passed again; the unchanged application build was repackaged with the repaired SQL. The full suite/e2e were not repeated after that SQL-only change.
- P6-07/P7 remain final-release gates after the remaining passes, despite this successful incremental private publication. Real production identity, external delivery, recovery/load proof and the complete browser mutation matrix remain unverified.
- The working checkpoint documentation is updated after publication; no application change follows the published source. Existing unrelated `dev4.log` was preserved.

### Pass 2 — implementation and browser evidence, September 14, 2026

The standing UX rule is saved in this checklist and AGENTS.md. [The metric map](PLATFORM_PASS2_METRIC_MAP.md) inventories current dashboard counts, cost bases, windows, cohorts, destinations and their tests.

Implemented pending-request filtering in fixture and SQL repositories, bounded stage queues, shared plain-language work statuses, task-owned vendor waits, complete chart groups, whole-equipment spotlight cost parity, role-filtered attention counts, distinct invoice-record counts, and exact PM closed-window evidence. Phone overview now uses a compact two-column metric layout, readable supporting text, stacked section headings/actions and a high-contrast primary button. Repeated chart-footer instructions and unnecessary dashboard prose were removed.

Browser findings changed the implementation: the broad vendor state contained a declined job and an operator's date decision, so the final vendor-response cohort follows the primary typed task and active assignment. It contains **2** jobs, not the initially corrected status-only count of 4. The matching status category is labelled **Vendor follow-up**. A store-manager count included an inaccessible task; visibility now precedes counting. The unfiltered invoice page lacked the existing role guard used by filtered evidence; both paths now reject unauthorized roles before reading invoice data. This narrow fix does not complete the broader P4-02 authorization audit.

Local browser evidence:

- Pending tile opens exactly **5** requests with the selected filter visible. Vendor tile opens **CPS-2026-0116 and CPS-2026-0206**; approved unsent work remains a separate **14-job** queue.
- Overview shows all **9** work statuses totalling **34** open jobs. Three active visits are labelled as visits; the vendor grouping shows two companies. Work follow-ups opens the full **53-item** task/follow-up cohort.
- Store 115 review retains whole-equipment scope, Aug 25, 2025–Aug 25, 2026, **$440** and two supporting cost lines. Repair price, approved replacement and planning estimate remain separate.
- Finance's **90 Invoice records** link opens the **90-invoice** register. Switching to Store manager on that URL now displays the intended access message. Store 104 dashboard and the manager search (**81 matches across five types** for 104) remain scoped and connected.
- Closed PM evidence shows **92 completed / 99 eligible**, including **7 missed**. Window filters persist through status/view/page links; program/store/region context remains attached.
- Visually inspected Overview at **390 px**, vendor queue and public visit forms at **375 px**, and desktop at **1280 px**. Overview fits the viewport and has no document-level horizontal overflow. Inspected store creation and deferred work routing forms, vendor authorization, no-WO option, and the Store 112 checkout link showing the same QR-started active visit. These were inspections, not service/store creation or checkout submissions; P7-03 remains open.

Validation is finishing. The first full run passed 903 tests. A later full run caught a PostgreSQL timestamp-ordering incompatibility in the new vendor filter; it was fixed with portable null ordering, and all 15 PostgreSQL integration cases passed afterward. A transient duplicate local variable in the invoice-page edit was fixed and its two route-boundary tests passed. Final required command results and publication status will be recorded below.

Pass 3 should start with P3-01/P3-02 defaults and routing, then the work-record header and remaining mobile/forms copy. P3-03 is only partially addressed by this pass's Overview improvements; public/store forms and broader responsive polish still need their dedicated pass. Keep all later IDs and production gates open.

### Pass 2 validation checkpoint

All six required checks passed on the final application source: seed; typecheck; lint; **133 files / 905 tests** in the full suite (129.66 seconds); **4 files / 52 tests** in test:e2e (55.09 seconds); and production build. The Sites Node build wrapper failed to resolve npm on Windows before starting the application build; direct `npm run build` then completed successfully. The build reports duplicate emitted CSS filename warnings and static route-classification limitations; these did not fail the build.

**P2-01 through P2-06 are complete. 11 of 40 items are complete; 29 remain.** The full browser submission matrix and final production-readiness gates remain open.

### Pass 2 publication — complete

- Private version **30** published successfully at **2026-09-14 22:25:01 UTC**: https://clarks-operations-demo.kedrick-mckenzie.chatgpt.site . Owner-only access was preserved.
- Published source: `2f6cd3e0353ffd307930e4259b564fbe751f221e`. Version: `appgprj_6a733d7dbb708191a9b80f3f9424582a~appgver_a1bf4c83142c819185d7ff17acbd9451`. Deployment: `appgdep_6aa8742fe62c81918584881f47d78ff2`.
- The Node packaging wrapper could not locate bash in the Windows environment. Running its unchanged packaging script through the installed Git Bash succeeded; archive validation confirmed the worker entrypoint, hosting manifest and migrations before saving. No application source changed after validation/publication.
- This post-publication checkpoint is documentation only. Existing unrelated `dev4.log` was preserved. Resume with **Pass 3**, retaining the standing UX rule and all 29 remaining IDs.
