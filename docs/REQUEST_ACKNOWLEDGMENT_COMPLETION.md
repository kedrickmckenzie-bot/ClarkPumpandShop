# Request Acknowledgment and Optional Work Linking

**Status:** implemented completion contract
**Date:** September 9, 2026
**Authority:** `AGENTS.md`, the platform rebuild blueprint, and the additional acknowledgment scope

## User contract

A store report remains an immutable source report. Similar reports are never automatically merged or discarded. An authorized store, regional, or facilities manager with the request-review capability now has two direct paths:

1. **Aware — being handled** records acknowledgment without linking work.
2. **Acknowledge and link** associates the report with one explicitly selected, non-terminal Work Order at the same store.

Neither path requires a note, equipment classification, spending authorization, or a new Work Order. The UI begins with a blank work-order choice, offers a compact related-work list, and provides a separate query-first search/pagination page for the store's active work. Suggestions are presented as possible context, never as duplicate proof.

## Persisted facts and invariants

- `acknowledged_at` and the acknowledging actor type, ID, and name are durable request facts.
- `linked_work_order_id` and the linking actor/time are separate from `converted_work_order_id`. A linked report is additional evidence; a converted request is the source of canonical work.
- A request cannot be both converted and linked as an additional report. Work-order creation rejects a request that already has a related-work link.
- Link targets are tenant-scoped, same-store, and non-terminal. Replacing an incorrect link requires a reason and appends an audit event containing the previous and replacement IDs. **Remove incorrect work-order link** also requires a reason, but needs no replacement work order. It clears only the optional association and its current link provenance, retaining acknowledgment provenance and the complete historical link audit. The former work order is untouched, even if it has since become terminal.
- Unlink checks the expected request version and former work-order ID, uses the existing atomic request fence, and records `request.work_order_unlinked` plus its outbox event in the same transaction. An immediate successful retry is harmless; a stale removal cannot remove a newer association. Route capability and tenant/store scope checks are identical to linking. Unlink alone creates no task, dispatch, or work order.
- Every request mutation advances the optimistic version and commits the domain state, audit event, outbox record, and task changes in one transaction. The existing request fence prevents competing managers from producing contradictory links or duplicate follow-up tasks.
- A routine acknowledgment completes the existing intake-review task but creates no Work Order, assignment, issuance, visit, outcome, cost, approval, follow-up, vendor reminder, or notification promise.
- Emergency priority and the current effective assessment (potential/immediate safety, potential/confirmed compliance, or unable-to-operate) retain exceptional intake review after either acknowledgment path. Superseded concerns remain in immutable impact history but do not keep routine intake open. Other active obligations are not completed by acknowledgment.
- Acknowledgment leaves priority, original problem, employee identity, impact history, evidence, timestamps, and later operational facts unchanged.

## Follow-up and visibility

The request detail and list show the exact state **Acknowledged — being handled**, actor/time provenance, and either the linked Work Order or **No linked work order**. The normal request list includes **Acknowledged without linked work** as a first-class filter.

Aging does not reopen an acknowledged report. **Request follow-up** requires an explanation, returns the report to under review while preserving acknowledgment history, and creates exactly one assigned, due `review_issue` task. A retry reuses the active task; concurrent attempts are version-fenced.

The Work Order record lists every linked source report. Linking does not authorize scope, prove a duplicate, verify a repair, create a visit, or resolve the report.

## Reporting boundaries

These remain distinct concepts: reports submitted, reports acknowledged, acknowledged reports with no linked work, reports linked to existing work, and reports converted into new canonical work. The implementation does not relabel any of those as completed repair or successful service.

## Operational caveats

- The outbox records internal domain events, but this pass does not claim external email/SMS delivery or notifications.
- The 15-store fixture remains demonstration data. D1 and PostgreSQL migrations persist the new facts; production identity and import readiness remain governed by the rebuild blueprint.
- Link correction supports replacement or reasoned removal. Source audit history remains append-only. After removal, explicit follow-up and manager review/work creation remain available under their existing permissions and approval requirements. Aging alone still creates no follow-up.

## Verification coverage

Focused tests cover quick acknowledgment, harmless retry, report preservation, exact unlinked filtering, optional/later linking, no service-side effects, reasoned link correction, second-work prevention, follow-up deduplication, exceptional obligation preservation, role/capability and store-scope routing, unsafe/missing form input, and concurrent manager actions.

## Verification results

The full required command suite passed on September 9, 2026: deterministic seed validation, type checking, lint, 765 unit/behavioral tests, 44 end-to-end/boundary tests, the Vinext/Cloudflare build, and the Next.js/Render portability build.

The browser walkthrough exercised the companywide request queue, quick acknowledgment, actor/time provenance, retained safety obligation, the acknowledged-without-work state, blank related-work selection, query-first store-work search, explicit linking, correction-reason controls, return navigation, and the inbound linked-report table on the Work Order. A true 390×844 viewport confirmed that the related-work browse/search/link controls remain usable without desktop-only interaction.


## Focused review of 7047ebb

The completion pass uses the effective impact assessment for both acknowledgment paths and adds reasoned unlinking. Regressions cover superseded safety concerns, report/acknowledgment preservation, no unlink service/task side effects, audit payloads, harmless retries, stale former-link/version rejection, cross-tenant denial, route scope and required input, concurrent unlink versus replacement, and explicit follow-up through new canonical work creation.

Desktop and 390×844 mobile browser checks exercised acknowledgment without note/link, optional linking, reasoned removal, retained acknowledgment time, the restored unlinked state, and same-store work browsing. Validation results for this correction are recorded below; earlier results above describe the original implementation.

### Local correction validation — September 9, 2026

- `npm run db:seed`: passed (15 stores, five vendors, two internal technicians; separate 65-store fixture).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 115 files / 775 tests passed.
- `npm run test:e2e`: four files / 44 tests passed, including persisted PostgreSQL and public/workflow boundaries.
- `npm run build`: passed. Vinext emitted a nonfatal duplicate CSS output filename warning and plugin timing notices.
- Desktop and 390×844 browser validation covered quick acknowledgment, link/unlink, retained actor/time, unlinked follow-up access, related-work browsing, peer evidence, exact vendor assignment drill-down and preserved scope. The browser console contained no warnings or errors.
- Broader browser inspection covered manager search, the store creation form, successful work creation with classification and provider deferred, vendor response controls, service-link/QR/trusted-device visit entry, the no-WO reason path, invoice safeguards, PM/lifecycle views and responsive store detail. Cross-channel visit completion was verified by the automated workflow suite; live geolocation was not requested during this browser pass.

No push or deployment was performed. `dev4.log` was preserved. The separate Render build was not rerun for this correction.
