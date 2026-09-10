# Accounting review corrections after f57cbdb

## Scope and starting state

This focused pass started on `codex/platform-rebuild` at `f57cbdb`, which was also the upstream commit. There were no later commits. The only pre-existing working-tree item was untracked `dev4.log`; it remains untouched. This work preserves the earlier connected workflow, acknowledgment, request link correction, equipment-exposure and vendor-cohort implementation. No reset, push, deployment, external accounting connection or external delivery was performed.

## Root causes and corrections

| Issue | Root cause | Correction |
|---|---|---|
| Imported $450 absent from Trends | Imports wrote canonical invoices and line allocations while Trends read older references | One `invoiceReporting` boundary reads authoritative confirmed allocations. Trends and Spending use it; canonical identity prevents fallback or double counting. |
| Same-price reference correction kept old work | Change detection omitted matching references | Classify financial, matching, payment and metadata changes. Store/work reference changes reopen only affected lines. |
| Initial link retained an old $425 approval on changed charges | Initial existing-invoice linking disabled invalidation | Compare current invoice vendor/currency/total/charge details before any replacement. Clear affected approval, preserve history, and add a separate financial review flag. |
| Concurrent finance decision could restore stale approval | Accounting and finance did not share a version boundary | Add invoice version to both database schemas and readers. Both command paths use a guarded version update and durable transactional assertion; UI finance forms submit the displayed version. |
| Search erased the matching draft | Search navigated/re-mounted a form initialized from original amounts | Search uses a bounded tenant-authorized endpoint; controlled draft state retains selections, amounts, vendor, existing invoice and note. Saved confirmed allocations populate editing. |
| Unmapped vendor could not resolve duplicate | Candidate invoices were loaded before a vendor was selected | Vendor choice refreshes candidates. A rejected duplicate save retains the draft; explicit existing-invoice or distinct-bill decisions remain required. |
| Technical language on ordinary screens | The previous wording pass missed specialized forms and details | Updated warranty, finance, PM, follow-up, approvals, errors and accessible form text. Rule-selection details are optional; repair correction accepts a plain note while the structured API remains supported. |

## Reporting and review semantics

- Confirmed positive allocations are reportable only when invoice items reconcile to the canonical invoice total in its currency and the line's confirmed allocations do not exceed its amount. Partial line allocation is allowed in reporting; saving an accounting match still requires every source charge to be fully allocated. Pending amounts are excluded, not approved or silently converted to work cost.
- Canonical invoice identity wins over the legacy reference even if its current matching is incomplete. A legacy-only confirmed reference remains compatible. Invoice date determines reporting month; the invoice vendor and allocation store/work/equipment determine attribution. Source rows open `#allocation-<id>` on the exact invoice, where the amount and confirmed state are visible.
- Replay changes no amount or source identity. Reviewed corrections/rematches update the same invoice. Removed lines and superseded allocations remain persisted as audited amendments. Voided and non-maintenance bills do not contribute. Accounting credits remain separate source evidence and do not automatically create verified financial benefits or subtract the bill twice.
- Trends currencies are separate. No confirmed observations displays **No data**. Known recording coverage can still support quiet peer periods; equipment installation/retirement dates only establish exposure. Imported transactions never imply complete recording history. A single-invoice filter opens a Records view and preserves its identity/currency through source sorting, pagination and export; clear the invoice filter for broader analysis.
- PostgreSQL and D1 load the same explicit Trends source tables, including canonical invoice records and accounting maintenance status, with tenant predicates and only `recording.coverage_attested` audit events. They exclude unrelated files, outbox, warranty and contract domains. This remains a bounded domain snapshot, not a production aggregate/query plan for unlimited historical backfills.
- Existing seeded `invoice-history-104-4` item detail does not reconcile to its total. Its confirmed amount is therefore withheld and the invoice shows a review notice. No charge detail was invented and the older reference was not used to hide that gap.

| Source change | Matching | Financial decision |
|---|---|---|
| Store/work-order reference | Reconfirm affected line(s) | Preserved if charges are unchanged |
| Added/removed line, description, category or amount | Reconfirm affected line(s); retain unrelated valid lines | Clear affected invoice approval; retain original decision/history |
| Vendor identity/mapping or currency | Reconfirm all bill allocations | Clear approval |
| Void or maintenance-filter change | Clear confirmations; exclude void/non-maintenance bills | Clear approval |
| Payment only | Preserve matched or pending-review state | Keep accounting payment facts separate; do not manufacture an approval |
| Invoice date/number/document metadata | Keep valid allocations; date moves reporting period | Preserve unchanged financial decisions |

Matching flags and financial authorization flags are distinct. Confirming the corrected work resolves only accounting matching flags. Any prior financial review reason remains in its original audit record. A stale accounting or finance command cannot commit against a newer invoice version.

## Usability and language coverage

`ACCOUNTING_REVIEW_WORDING_CHANGES.json` records concrete file/before/after/reason entries in addition to the earlier 144-entry log. Examples include “Review this issue and choose the next step,” “Where this warranty rule applies,” “Save warranty rule,” “Approval requests and decision history,” and “Recorded vendor response times.” Warranty selection explains quote/authorization, contract and vendor priority accurately in an optional section; the start date remains an ordinary field. Original employee reports, vendor replies, invoice item descriptions and historical evidence were not rewritten.

Reviewed source areas include the reachable operator presenter, warranty rule/case, invoice receive/detail/accounting forms, service/follow-up controls, PM program management, public vendor/technician components, Trends methodology/export wording, task permission errors and job-health labels. Dormant legacy component stacks are not a product foundation and were not rewritten. This is a contextual language review, not a claim to have exercised every role, every rare error, every generated report/template or every live connector response in a browser.

## Validation

Automated validation completed:

- `npm run db:seed`: passed; exactly 15 presentation stores, five vendors, two internal technicians and a separate 65-store fixture; 10,710 seed statements.
- `npm run typecheck` and `npm run lint`: passed, including a final rerun after the UI adjustments.
- `npm test -- --maxWorkers=1 --no-file-parallelism`: **121 files / 812 tests passed**. The worker settings avoid local resource contention; no performance threshold or behavioral assertion was relaxed.
- `npm run test:e2e -- --maxWorkers=1`: **4 files / 46 tests passed**. These are workflow, public-boundary, presenter and embedded PostgreSQL integration tests, not browser automation.
- Final targeted rendering/public-boundary rerun after the allocation highlight and public wording: **2 files / 14 tests passed**.
- Both `npm run build` (Vinext) and `npm run build:render` passed. Final builds were repeated for the allocation highlight. The existing Vinext emitted-CSS/static route-classification notices are non-failing.
- `git diff --check`: passed. `dev4.log` remains untracked, 259,130 bytes, with its original August 25 modification time.

The shared accounting regression runs through the fixture repository, the D1 adapter against real SQLite with the complete D1 migration chain, and the PostgreSQL adapter against the embedded PostgreSQL engine. It checks exactly +$450 after review, +$0 on replay, exact store/vendor/source links, reference correction with the other line retained, payment-only pending state, stale review rejection, rematch, removed line, void, existing canonical/legacy identity without double counting, unchanged approval preservation, changed-charge invalidation, and racing finance/import transactions. Additional cases cover initial approved-invoice linking, category/description changes, later vendor/currency/maintenance corrections, draft recovery, unmapped-vendor duplicates, foreign tenant denial and No data despite a stale legacy reference. A persisted Trends read plus model construction measured 463 ms in the final full-suite run (270 ms load + 193 ms model); this is local fixture evidence, not a network or production promise.

Earlier runs exposed a PostgreSQL invoice-date normalization mismatch, the embedded test-pool's reentrant advisory lock, and two old presenter assertions (legacy invoice counts and superseded copy). The reader and test pool were corrected. Count expectations now use reconciled canonical invoice items and confirmed allocations; the unreconciled seeded bill remains excluded rather than inventing a missing charge. Wording assertions now check the requested replacement text. All final cases pass.

Actual browser interaction on `http://localhost:3010`:

- Desktop import of the August $450 bill; selected Store 104 work, wrote a note, searched Store 105, confirmed the earlier selection and note remained, selected the second store, and saved.
- Reopened the saved match with populated allocations; split travel into $60 and $40, observed the $10 excess warning during an invalid draft, corrected it, and saved. The draft stayed present during validation.
- Opened a second browser tab to import a same-price store-reference correction while a desktop draft was open. The stale save was rejected, the specific change appeared, the draft survived, and explicit recovery plus corrected selection saved successfully.
- At an actual **390 × 844** Chrome viewport, searched another store without losing selected work or the note. Imported a concurrent amount correction in another tab. Mobile stale save was blocked; recovery retained the original $100 travel split and showed **Over by $50** against the new $50 charge. Corrected it to $30/$20 and saved the $400 bill.
- Imported an unmapped-vendor duplicate from the mobile form. Selecting ColdLine populated `SUM-104-2607`. An attempted duplicate creation was rejected with all store selections and the note retained. Selected the existing invoice on desktop and saved successfully, without a second invoice identity.
- Followed invoice → its filtered Trends records → an exact invoice allocation on desktop and mobile. Observed $450 before correction and $400 after, with the corrected $350/$30/$20 source rows. The mobile target identified **$30.00 · Confirmed match · CPS-2026-0117 · Store 105** and was visibly highlighted below the header. Tables stayed contained; measured mobile document width was 375 within a 390 viewport.
- Inspected warranty rule setup and expanded rule-selection guidance, PM schedule wording, the filtered follow-up queue and its actual task/service-control page on desktop and mobile. Inspected source invoice warnings, approval separation and the revised public vendor/technician wording.
- Additional preservation checks: Store 104 manager search returned scoped linked records; company accounting intake denied that role. Restored the facilities preview role. Inspected store creation, store+problem work creation with Internal/Outside/Choose later routing, scoped lifecycle review, the public authorization response options, work-linked technician entry, and the shared store-device no-WO vendor/reason controls. Store, work-order, warranty-rule and visit mutations were not submitted during this preservation sweep. Cross-channel visit and unresolved-checkout behavior were exercised by the automated workflow/public tests, not claimed as fresh manual check-in/out.

Browser state and screenshots were used for visual checks. A transient development hydration warning occurred while a disclosure was open during hot reload; the fresh-page journeys above worked. Temporary viewport overrides were reset. No live location, external message, payment or hosted mutation was performed.

## Remaining operating limits

- No customer accounting product or company has been selected. OAuth, provider polling/webhooks, provider document retrieval, production retry/recovery, resumable backfill and customer mapping remain connector work. The demo adapter is explicitly fictional and now includes separate August multi-store, reference-change, amount-change and unmapped-vendor scenarios.
- Intake pages show 25 records, searches return 50 work choices and up to 100 vendors, and history displays the latest 50 events. Previously selected work remains available outside the current search result. Drafts survive search and recoverable errors while the form stays open; they are not durable cross-device drafts and are not promised to survive browser/process termination.
- Local data resets with the server process. PostgreSQL validation uses the embedded PostgreSQL engine; D1 validation executes the adapter's SQL on SQLite. These are persisted engine checks, not tests against a deployed Cloudflare database or production PostgreSQL network. PGlite lacks `pg_trgm`, so that extension/index capability remains outside the embedded migration check.
- The embedded PostgreSQL test pool now serializes ownership of its one connection in JavaScript. Session advisory locks are reentrant and did not correctly isolate concurrent test transactions. The new regression makes both commands read the same version before transaction serialization, then proves only one commits. This does not claim a production load test.
- The local public origin still targets port 3000 while the development browser uses port 3010. Configure the origin before printing local QR material. In-app relative links work on 3010. No live geolocation or external vendor message was sent.
