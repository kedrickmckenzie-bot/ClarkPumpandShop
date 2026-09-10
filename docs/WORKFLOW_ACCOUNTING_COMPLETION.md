# Workflow, language and accounting completion

## Comparison of the two prompts

The first prompt defines the coordinated workflow and accounting-readiness completion. The second keeps those functional requirements and expands the plain-language standard: reachable-route/role inventory, concrete wording replacements, short action receipts, human-readable status values, and a file/before/after/reason change log. It is a wording and usability refinement, not permission to redesign the platform or change authorization, acknowledgment, visit, financial, or safety semantics.

This work started from `de85f49` on `codex/platform-rebuild`, preserving the connected-navigation work after `00ef8c7` and the original `7047ebb` implementation. No reset, push or deployment was performed. `dev4.log` remains untouched.

## Completed changes

- Review queues expose every retained task, follow-up, approval and quote-version source with its owner, due information and completion requirement. Independent obligations remain separate. Completed/canceled workflow tasks have a dated history lane. Supporting links retain queue filters and exact anchors, including expanding a closed history disclosure when its source is targeted.
- “Save and open next” is available for supported review/completion forms and generic task completion. A failed or stale command stays on the current form. After a successful save, the server reloads the queue under current permissions and filters, skips unavailable/completed candidates, preserves the original following-item order, and shows an explicit end state instead of restarting earlier work. Selection is bounded to the next 25 candidates and the current paginated result; the end state provides queue/pagination links.
- Old `view=accountability` links resolve to the actual task/activity view. A legacy work-order status no longer hides quote controls when current approval evidence says there is no pending approval. Genuine pending approvals keep their stage. Quote-list rows open the exact request/version and vendor records. Creating a quote gives an inline receipt and recoverable error rather than leaving an unchanged form behind a new tab. Already-issued work opens its existing authorization disclosure; the vendor-response link targets the current status.
- Vendor quote PDFs/images are associated with the exact immutable proposal revision in the same transaction as submission. Earlier versions retain their files; stale selection and stale submissions fail. Operator downloads check tenant, store, request and proposal; public downloads additionally require the vendor-bound capability and a vendor-shared association. Local files last until process restart; hosted files use the configured private R2/S3 storage adapter. The quote receipt opens the submitted evidence and refreshes the current version.
- Acknowledgment still needs neither a note nor a work-order link. Link correction/removal now works after explicit follow-up, retains acknowledgment provenance and the active task, and leaves the former work order unchanged. If an exceptional intake task already exists, a deliberate new follow-up saves its explanation in audit history while reusing that task; replay does not duplicate the explanation or task. Time passing creates no acknowledgment follow-up.
- PostgreSQL Trends reads now include only tenant-bounded `recording.coverage_attested` audit rows alongside the required source tables. Session organization is resolved before loading. Recording completeness remains independent of equipment installation/retirement exposure; missing recording history is excluded, covered quiet periods can be zero, and partial exposure remains proportional. No threshold was raised.
- Inbound accounting has a provider-neutral normalized delivery, deterministic demo adapter, persisted external identity and versions, source/review history, maintenance exclusion, human vendor/work matching, reconciled multi-work splits, existing-invoice duplicate review, correction/void/payment/credit evidence, and atomic replay/concurrency fences. Source corrections update the same invoice and invalidate stale review without creating work costs or changing service completion. See `ACCOUNTING_IMPORT_HANDOFF.md` for the live-connector boundary and discovery questions.
- Requested deductions are estimated opportunities rather than verified savings. Imported credits, deferred purchases, speculative trips and payment metadata do not manufacture confirmed benefits. Financial totals do not sum different currencies. Original report/quote/invoice/actor wording is retained; only interface labels and guidance are rewritten.

## Language inventory

`WORKFLOW_ROUTE_LANGUAGE_INVENTORY.md` inventories all current page entry points and the role journeys. `PLAIN_LANGUAGE_CHANGES.json` records 144 wording changes/additions with their file and rationale. Methodology retains precise exposure, recording coverage, comparison-cohort, percentile and range definitions; routine actions use short descriptions of what the operator does.

## Browser verification

The local app ran at `http://localhost:3010/app`. Browser checks used desktop and an explicit 390×844 viewport. No hosted records were modified.

Executed in the browser during this pass:

- Accounting demo bill import, explicit work matching, amount correction from $450 to $400, retained earlier review, and successful corrected match. Readable mobile form and horizontally contained table were inspected.
- Quote comparison, withdrawal with retained earlier evidence, fresh quote request and account-free opening, first PDF upload, revised amount with a second PDF, earlier-version disclosure, current PDF download, and rejection of the operator’s stale version selection. Exact public and operator file URLs retain the proposal ID.
- Grouped quote expansion with five separately navigable source records, filtered request review, successful acknowledgment plus continuation to the next item in that same filtered selection, and completed-task history.
- Acknowledged report linking, deliberate follow-up while an exceptional task remains open, reasoned unlink after follow-up, retained acknowledgment and outstanding approval, and the restored unlinked state.

Additional browser checks completed: the empty/end-of-selection state and exact filtered return; Store 104 manager search and accounting access denial; store creation and deferred-classification/routing forms; the approved-work queue and combined-visit planner with its originating filter; public service authorization through the work-order evidence link; phone technician selection/check-in fields and no-WO vendor/reason fields; store-related records, PM-to-equipment occurrence links and scoped lifecycle views; invoice-to-work/store/visit evidence and independent financial-review flags. The corrected quote-creation form produced its inline success receipt, public link and updated-comparison return in the browser. Store creation, new work dispatch, combined-visit creation, and visit check-in/out were inspected but not submitted in this final browser sweep. Existing domain and public-boundary tests cover cross-channel visits, no-WO exceptions, held work, temporary repairs, uncertain confirmation and separate financial/service completion. A manual visit to a screen is not claimed as manual execution of every mutation it offers.

## Verification results

- `npm run db:seed`: passed, including 15 presentation stores, five vendors, two internal technicians and the 65-store synthetic fixture.
- `npm run typecheck` and `npm run lint`: passed.
- `npm test -- --maxWorkers=1 --no-file-parallelism`: 119 files / 800 tests passed. Worker settings limit local resource contention; no test or performance threshold was relaxed.
- `npm run test:e2e`: four files / 45 tests passed. These are repository workflow, PostgreSQL-engine, public-boundary and presenter integration tests; browser interaction is separately described above.
- `npm run build` and `npm run build:render`: passed. Vinext retains its non-failing duplicate emitted-CSS warning.
- Persisted Trends profiling includes the actual bounded PostgreSQL-engine read and model construction. Observed runs included 153 + 144 = 297 ms, a contended full-suite run of 236 + 234 = 470 ms, and an integration run of 163 + 155 = 318 ms. These are local measurements, not network or production-scale promises.
- A focused accounting rerun passed all four cases after strengthening the shared-bill assertion to verify allocations across Stores 104 and 105 reconcile exactly.
- `git diff --check`: passed.

## Remaining operating boundaries

- No live accounting provider or customer company is selected. OAuth, live polling/webhooks, provider document retrieval, resumable backfill, production worker recovery and provider-specific mappings are future connector work, not a working integration claim.
- Accounting history views are bounded to the latest 50 audit events and source matching to 50 work orders/100 vendors; older source history remains persisted. Production import volumes still need connector-specific indexing, backfill and operating tests.
- Imported credits remain source evidence, not automatically confirmed savings. Confirmed-benefit recognition needs evidence of application and a correction/reversal workflow; this pass makes no automatic claim.
- The attention history lane covers completed/canceled workflow tasks. Other historical facts remain on their source records. Sequential review does not automatically perform source-governed approvals, service authorization, dispatch or technical confirmation.
- Advanced confirmed-opportunity/review-window projections retain their existing compatibility snapshot. The persisted Trends measurement below is a local PostgreSQL-engine fixture measurement, not hosted network latency or a production-scale SLA.
- Demo identity and delivery boundaries remain unchanged. Local process memory is not production persistence. No live geolocation or external message delivery was used in these browser tests.

The local server uses port 3010. Printed/copied QR URLs still reflect the existing configured public origin (`localhost:3000`); relative in-app “Open live page” links were verified on 3010. Configure the public origin to the serving port before printing local QR material.


## Focused review correction after f57cbdb — September 10, 2026

The follow-up implementation and validation are recorded in [ACCOUNTING_REVIEW_CORRECTIONS.md](ACCOUNTING_REVIEW_CORRECTIONS.md). This supersedes the earlier accounting reporting and all-or-nothing correction description: canonical confirmed invoice allocations now feed Trends and Spending, reference changes invalidate affected matching, and invoice-version protection also covers initial existing-invoice linking and finance decisions. Search preserves matching drafts and saved allocations; an unmapped vendor refreshes duplicate candidates. Earlier workflow and acknowledgment behavior is retained.
