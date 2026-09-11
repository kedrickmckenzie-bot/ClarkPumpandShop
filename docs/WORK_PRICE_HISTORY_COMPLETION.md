# Work prices, history, and confirmed planning updates

September 11, 2026. This completes the reported-price workflow agreed with the user. It does not mark the entire platform UX audit complete.

## Product behavior

- Work orders have a **Prices & costs** tab and a price panel on the overview. Enter Repair or Replace, a price, vendor, and what it covers. Replacement scope must be chosen explicitly. No extra note, quote request, assignment, authorization, task, or dispatch is created.
- Each reported price is a new dated source record with the work order, store, equipment, optional component, vendor, scope, currency, and recorder. Repair prices update the current work-order estimate while preserving prior prices. Replacement prices do not change that repair estimate.
- Price history supports repair/replacement filters and this job, this unit, or the equipment group. It pages through 20 records at a time. Repair-only views show relative price bars, with the scope beside each observation. This is an audit history of reported prices, not a claim that different jobs are comparable or a market average. Formal vendor quotes remain in their original workflow with a direct link.
- The current estimate sits beside the unit's recorded spending for the displayed 12-month window. A saved repair estimate with prior cost lines shows a neutral **Worth a look** prompt. It creates no task and gives no repair/replacement direction. The spending link opens the exact cost lines, including zero and credit entries, with currencies kept separate. An empty period is not treated as complete zero spending.
- A whole-unit installed replacement price can open **Update plans**. The page shows the proposed prices and every affected unit before confirmation. Only active, included equipment with an exact profile match is eligible. Equipment-specific overrides remain unchanged. Existing escalation and equipment adjustments remain in effect.
- Equipment match keys are fingerprinted when the price is saved. If the source equipment's size/setup or the profile's match details change, the old price cannot be applied to the revised group. The confirmation signature also detects changes to group membership, overrides, adjustment factors, or the current benchmark between preview and confirmation.
- A confirmed reported total is stored as a `reported_price` planning source. Its equipment, installation, and other amounts remain **unknown**, not fabricated zero splits. The source work, vendor, equipment, recorded date, price ID, and audit record remain traceable. Approved replacement quotes and actual costs are never overwritten.
- The repair/replacement screen retains an explicitly selected job and component. A later fan repair cannot supply the compressor's current repair price. Active approved replacement work keeps its execution path; a later repair after closure is a separate review. Calculated labels say **Costs to review**, **No cost flag**, or **Price details needed**. Human decisions remain recorded facts.

## Connected review fixes

- Overview displays the recorded replacement decision and selected/approved price ($32,800 in the Southgate example), instead of a new repair recommendation and an escalated planning figure.
- Approved replacement work opens the selected vendor's service authorization form. Approval does not send it. After issuance, normal vendor response and service progress take over.
- Recurring-work findings keep period, measure, store, equipment and active analysis filters through an exact reactive-work source view. Planned work and records assigned to multiple units remain outside that finding's source set.
- PM rows open a scoped read-only occurrence with dates, result, source work/visits and the parent plan. A separate permitted action can create work for an eligible occurrence.
- Invoice review renders one stable 20-row register, with separate all/review views and totals for the full scope. The phone layout labels each field without requiring sideways page scrolling. Linked warranty cases open directly from the invoice into diagnosis and terms.
- Trends puts its chart before the long results and filter explanations. Filters and saved views are under a disclosure; active scope and dates stay visible. At 390 × 844, the chart heading was about 745 px down, compared with the audit's approximately 2,975 px. This measures layout, not production loading speed.

## Persistence and access

The domain command requires an active facilities or regional membership and a write grant for the store. Company planning updates require facilities access with an organization-wide write grant. Reads begin with the organization and then apply visible stores. Browser forms use the same commands as other channels.

Price insertion, current-estimate update, work-version protection, idempotency record, and audit commit in one transaction. Repeated saves return the original result; changed payloads or stale work versions fail. Planning confirmation uses the current work-version fence, a profile publication fence, the existing single-published-benchmark database constraint, a durable replay key, and an audit in one transaction.

SQLite/D1 and PostgreSQL migrations add the reported-price table and allow explicitly unknown planning cost splits. PostgreSQL also enforces organization-aware foreign keys. Seed serialization and snapshot readers support both additions. The presentation fixture remains exactly 15 stores and five vendors. No prior quote history has been invented to populate the new table.

## Validation

- `npm run db:seed`: passed; 15 stores, five vendors, and the separate 65-store fixture.
- `npm run typecheck` and `npm run lint`: passed.
- `npm test`: 130 files / 879 tests passed. Price regressions cover audited repair history, tenant/store access, read-only grants, stale work versions, concurrent saves, replay, exact equipment matching, changed fingerprints, preview changes, preserved overrides and quote amounts, and component-specific work selection. Additional regressions cover recurring-work drill-down, approved replacement handoff, PM occurrence links, invoice paging and direct warranty evidence.
- `npm run test:e2e`: 4 files / 49 tests passed. This is the repository's domain/public-boundary/persistence suite, not a browser runner. SQLite/D1 and PostgreSQL engine tests persisted and replayed price saves and confirmed planning updates, including unknown cost splits.
- `npm run build`: passed. The existing Vinext static route-classification notice remains.
- `npm run test:routes`: 144 local routes passed with no HTTP or rendered server errors. Includes invoice paging, new price/cost history, PM occurrence, generated overview chart destinations and sampled related records. Timing excludes browser hydration.
- Desktop and 390 × 844 browser checks: work search to price entry; save repair and whole-unit replacement prices; inspect exact past costs; repair history/group filters; preview and confirm 14 planning updates while retaining one equipment override; preserve compressor and work scope in lifecycle review; approved replacement to its selected vendor setup form; PM row to a recorded occurrence; invoice register/paging layout to warranty diagnosis; Trends chart placement; store creation and deferred-classification work forms; secure vendor response choices; technician entry from the vendor link; no-WO exception to the crew check-in form.
- Browser pricing and planning submissions used fictional local preview data. Store/work creation, vendor response, location capture and technician check-in/checkout were not submitted in the browser; mutation/cross-channel behavior is covered by automated tests. Opening the vendor response form recorded only the fictional link-open event.
- The local preview was restarted to clear stale server modules, resetting its in-memory demo edits. `dev4.log` was preserved. No push, hosted migration, or deployment was performed.

## Remaining platform work

This is a connected source-to-review-to-planning workflow, not a completed redesign of every platform screen. Broader work remains in vendor portfolio evidence (exact documents/eligible-visit/cost cohorts), other long mobile queues, inconsistent review wording, semantic navigation context, and the existing compatibility-snapshot query path. No production latency improvement is claimed. The new history has bounded repository reads, but the surrounding application still uses large compatibility snapshots.

Historical bid proposals keep their existing audit trail and are linked from the new history. They are not silently reclassified into reported repair or replacement prices. Reliable statistical baselines across different repair scopes need richer comparable service classifications; the current history exposes scope and source instead of inventing that comparability.
